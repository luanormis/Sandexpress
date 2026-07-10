import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isRateLimited } from '@/lib/rate-limit';
import { cleanupOtpChallenges, cleanupOtpForPhone } from '@/lib/otp-cleanup';
import { getOtpPepper, isOtpPurpose, normalizeBrazilPhoneE164, verifyOtpHash } from '@/lib/otp';

type OtpChallengeRow = {
  id: string;
  phone_e164: string;
  vendor_id: string | null;
  tenant_id: string | null;
  purpose: string;
  status: string;
  code_hash: string;
  attempts: number | null;
  expires_at: string;
};

export async function POST(req: NextRequest) {
  try {
    if (await isRateLimited(req, 'otp-verify', 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { challenge_id, code, phone, purpose, vendor_id } = await req.json();
    if (!code || (!challenge_id && (!phone || !isOtpPurpose(purpose)))) {
      return NextResponse.json({ error: 'Informe o codigo e o telefone validado pelo WhatsApp.' }, { status: 400 });
    }
    if ((challenge_id && !/^[0-9a-f-]{36}$/i.test(String(challenge_id))) || !/^\d{6}$/.test(String(code))) {
      return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
    }

    await cleanupOtpChallenges();

    let query = supabaseAdmin
      .from('otp_challenges')
      .select('id, phone_e164, vendor_id, tenant_id, purpose, status, code_hash, attempts, expires_at')
      .order('created_at', { ascending: false })
      .limit(1);
    if (challenge_id) {
      query = query.eq('id', challenge_id);
    } else {
      const phoneE164 = normalizeBrazilPhoneE164(String(phone));
      query = query
        .eq('phone_e164', phoneE164)
        .eq('purpose', purpose)
        .eq('status', 'pending');
      if (vendor_id) {
        query = query.or(`vendor_id.eq.${vendor_id},vendor_id.is.null`);
      }
    }

    const { data: rows, error } = await query;
    const challenge = (Array.isArray(rows) ? rows[0] : rows) as OtpChallengeRow | null;

    if (error || !challenge) {
      return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
    }

    if (challenge.status !== 'pending' || new Date(challenge.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from('otp_challenges')
        .update({ status: 'expired' })
        .eq('id', challenge.id)
        .eq('status', 'pending');
      return NextResponse.json({ error: 'Código expirado.' }, { status: 400 });
    }

    if (Number(challenge.attempts || 0) >= 5) {
      await supabaseAdmin.from('otp_challenges').update({ status: 'blocked' }).eq('id', challenge.id);
      return NextResponse.json({ error: 'Código bloqueado por tentativas.' }, { status: 429 });
    }

    const isValid = verifyOtpHash(String(code), challenge.code_hash, getOtpPepper());
    if (!isValid) {
      await supabaseAdmin
        .from('otp_challenges')
        .update({ attempts: Number(challenge.attempts || 0) + 1 })
        .eq('id', challenge.id);
      return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
    }

    await supabaseAdmin
      .from('otp_challenges')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', challenge.id);

    await cleanupOtpForPhone({
      phoneE164: challenge.phone_e164,
      purpose: challenge.purpose,
      vendorId: challenge.vendor_id,
      keepChallengeId: challenge.id,
    });

    return NextResponse.json({
      ok: true,
      challenge_id: challenge.id,
      phone_e164: challenge.phone_e164,
      purpose: challenge.purpose,
      vendor_id: challenge.vendor_id,
      tenant_id: challenge.tenant_id,
    });
  } catch (err) {
    console.error('OTP verify error:', err);
    return NextResponse.json({ error: 'Nao foi possivel validar o codigo.' }, { status: 500 });
  }
}
