import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isRateLimited } from '@/lib/rate-limit';
import {
  buildOtpExpiry,
  generateOtpCode,
  getOtpPepper,
  hashOtpCode,
  isOtpPurpose,
  normalizeBrazilPhoneE164,
} from '@/lib/otp';
import { sendMetaOtp } from '@/lib/meta-whatsapp';

type OtpChallengeInsert = {
  tenant_id: string | null;
  vendor_id: string | null;
  phone_e164: string;
  purpose: string;
  code_hash: string;
  provider_message_id: string | null;
  expires_at: string;
  created_ip: string | null;
  created_user_agent: string | null;
};

export async function POST(req: NextRequest) {
  try {
    if (await isRateLimited(req, 'otp-send', 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const body = await req.json();
    const purpose = body.purpose;
    if (!isOtpPurpose(purpose)) {
      return NextResponse.json({ error: 'Finalidade de OTP invalida.' }, { status: 400 });
    }

    const phoneE164 = normalizeBrazilPhoneE164(body.phone);
    const code = generateOtpCode();
    const ttlSeconds = Number(process.env.OTP_TTL_SECONDS || 300);
    const expiresAt = buildOtpExpiry(ttlSeconds).toISOString();
    const pepper = getOtpPepper();

    const metaResult = await sendMetaOtp({
      to: phoneE164,
      templateName: process.env.META_WHATSAPP_OTP_TEMPLATE_NAME || 'sandexpress_otp_ptbr',
      language: process.env.META_WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'pt_BR',
      code,
    });

    const insertPayload: OtpChallengeInsert = {
      tenant_id: typeof body.tenant_id === 'string' ? body.tenant_id : null,
      vendor_id: typeof body.vendor_id === 'string' ? body.vendor_id : null,
      phone_e164: phoneE164,
      purpose,
      code_hash: hashOtpCode(code, pepper),
      provider_message_id: metaResult?.messages?.[0]?.id || null,
      expires_at: expiresAt,
      created_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip'),
      created_user_agent: req.headers.get('user-agent'),
    };

    const { data, error } = await supabaseAdmin
      .from('otp_challenges')
      .insert(insertPayload)
      .select('id, expires_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ challenge_id: data.id, expires_at: data.expires_at });
  } catch (err) {
    console.error('OTP send error:', err);
    const message = err instanceof Error ? err.message : 'Nao foi possivel enviar o codigo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
