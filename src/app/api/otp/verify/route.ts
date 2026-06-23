import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isRateLimited } from '@/lib/rate-limit';
import { getOtpPepper, verifyOtpHash } from '@/lib/otp';

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

    const { challenge_id, code } = await req.json();
    if (!challenge_id || !code) {
      return NextResponse.json({ error: 'challenge_id e code sao obrigatorios.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('otp_challenges')
      .select('*')
      .eq('id', challenge_id)
      .single();
    const challenge = data as OtpChallengeRow | null;

    if (error || !challenge) {
      return NextResponse.json({ error: 'Codigo invalido.' }, { status: 400 });
    }

    if (challenge.status !== 'pending' || new Date(challenge.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from('otp_challenges')
        .update({ status: 'expired' })
        .eq('id', challenge_id)
        .eq('status', 'pending');
      return NextResponse.json({ error: 'Codigo expirado.' }, { status: 400 });
    }

    if (Number(challenge.attempts || 0) >= 5) {
      await supabaseAdmin.from('otp_challenges').update({ status: 'blocked' }).eq('id', challenge_id);
      return NextResponse.json({ error: 'Codigo bloqueado por tentativas.' }, { status: 429 });
    }

    const isValid = verifyOtpHash(String(code), challenge.code_hash, getOtpPepper());
    if (!isValid) {
      await supabaseAdmin
        .from('otp_challenges')
        .update({ attempts: Number(challenge.attempts || 0) + 1 })
        .eq('id', challenge_id);
      return NextResponse.json({ error: 'Codigo invalido.' }, { status: 400 });
    }

    await supabaseAdmin
      .from('otp_challenges')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', challenge_id);

    return NextResponse.json({
      ok: true,
      challenge_id,
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
