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
import { cleanupOtpChallenges, cleanupOtpForPhone } from '@/lib/otp-cleanup';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getClientMeta(req: NextRequest) {
  return {
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip'),
    userAgent: (req.headers.get('user-agent') || '').slice(0, 300),
  };
}

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
    if (body.vendor_id && !UUID_RE.test(String(body.vendor_id))) {
      return NextResponse.json({ error: 'Quiosque inválido.' }, { status: 400 });
    }

    const phoneE164 = normalizeBrazilPhoneE164(body.phone);
    const vendorId = typeof body.vendor_id === 'string' ? body.vendor_id : null;
    await cleanupOtpChallenges();
    await cleanupOtpForPhone({ phoneE164, purpose, vendorId });

    let tenantId: string | null = null;
    if (vendorId) {
      const { data: vendor, error: vendorError } = await supabaseAdmin
        .from('vendors')
        .select('tenant_id, is_active, subscription_status')
        .eq('id', vendorId)
        .single();
      if (vendorError || !vendor || !vendor.is_active || vendor.subscription_status === 'blocked') {
        return NextResponse.json({ error: 'Quiosque indisponível para envio de código.' }, { status: 403 });
      }
      tenantId = vendor.tenant_id || null;
    }

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
    const clientMeta = getClientMeta(req);

    const insertPayload: OtpChallengeInsert = {
      tenant_id: tenantId,
      vendor_id: vendorId,
      phone_e164: phoneE164,
      purpose,
      code_hash: hashOtpCode(code, pepper),
      provider_message_id: metaResult?.messages?.[0]?.id || null,
      expires_at: expiresAt,
      created_ip: clientMeta.ip,
      created_user_agent: clientMeta.userAgent,
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
    return NextResponse.json({ error: 'Nao foi possivel enviar o codigo agora.' }, { status: 500 });
  }
}
