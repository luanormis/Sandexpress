import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildOtpExpiry, getOtpPepper, getStaticOtpCode, hashOtpCode, normalizeBrazilPhoneE164 } from '@/lib/otp';
import { cleanupOtpChallenges, cleanupOtpForPhone } from '@/lib/otp-cleanup';
import { extractMetaWebhookMessages, isSandexpressOtpRequest, sendMetaText } from '@/lib/meta-whatsapp';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expectedToken = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && expectedToken && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Webhook nao autorizado.' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const messages = extractMetaWebhookMessages(payload);
    const code = getStaticOtpCode();
    const ttlSeconds = Number(process.env.OTP_TTL_SECONDS || 300);
    const expiresAt = buildOtpExpiry(ttlSeconds).toISOString();
    const pepper = getOtpPepper();

    await cleanupOtpChallenges();

    for (const message of messages) {
      if (!isSandexpressOtpRequest(message.text)) continue;

      const phoneE164 = normalizeBrazilPhoneE164(message.from);
      await cleanupOtpForPhone({
        phoneE164,
        purpose: 'customer_login',
      });

      await supabaseAdmin
        .from('otp_challenges')
        .insert({
          tenant_id: null,
          vendor_id: null,
          phone_e164: phoneE164,
          purpose: 'customer_login',
          code_hash: hashOtpCode(code, pepper),
          provider: 'meta_whatsapp_inbound',
          provider_message_id: message.id || null,
          expires_at: expiresAt,
          created_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip'),
          created_user_agent: 'meta-whatsapp-webhook',
        } as any);

      await sendMetaText({
        to: phoneE164,
        text: `Seu codigo de validacao SandExpress e ${code}. Digite este codigo no quiosque para abrir sua comanda.`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Meta WhatsApp webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}
