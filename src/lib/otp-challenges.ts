import { supabaseAdmin } from './supabase-admin';
import { normalizeBrazilPhoneE164, OtpPurpose } from './otp';

type ConsumeOtpInput = {
  challengeId: string;
  phone: string;
  purpose: OtpPurpose;
  vendorId?: string | null;
};

type OtpChallengeLookup = {
  id: string;
  phone_e164: string;
  vendor_id: string | null;
  purpose: string;
  status: string;
  expires_at: string;
};

export async function consumeVerifiedOtp(input: ConsumeOtpInput) {
  const phoneE164 = normalizeBrazilPhoneE164(input.phone);
  const { data, error } = await supabaseAdmin
    .from('otp_challenges')
    .select('id, phone_e164, vendor_id, purpose, status, expires_at')
    .eq('id', input.challengeId)
    .single();
  const challenge = data as OtpChallengeLookup | null;

  if (error || !challenge) return false;
  if (challenge.status !== 'verified') return false;
  if (challenge.purpose !== input.purpose) return false;
  if (challenge.phone_e164 !== phoneE164) return false;
  if (input.vendorId && challenge.vendor_id !== input.vendorId) return false;
  if (new Date(challenge.expires_at).getTime() < Date.now()) return false;

  const { error: updateError } = await supabaseAdmin
    .from('otp_challenges')
    .update({ status: 'used', used_at: new Date().toISOString() })
    .eq('id', input.challengeId)
    .eq('status', 'verified');

  return !updateError;
}
