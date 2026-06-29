import { supabaseAdmin } from './supabase-admin';

const DEFAULT_USED_RETENTION_MINUTES = 10;

export async function cleanupOtpChallenges(retentionMinutes = DEFAULT_USED_RETENTION_MINUTES) {
  const now = new Date();
  const retentionCutoff = new Date(now.getTime() - Math.max(1, retentionMinutes) * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  await supabaseAdmin
    .from('otp_challenges')
    .delete()
    .or(`expires_at.lt.${nowIso},used_at.lt.${retentionCutoff},status.in.(expired,blocked)`);
}

export async function cleanupOtpForPhone(input: {
  phoneE164: string;
  purpose: string;
  vendorId?: string | null;
  keepChallengeId?: string | null;
}) {
  let query = supabaseAdmin
    .from('otp_challenges')
    .delete()
    .eq('phone_e164', input.phoneE164)
    .eq('purpose', input.purpose);

  if (input.vendorId) {
    query = query.eq('vendor_id', input.vendorId);
  }
  if (input.keepChallengeId) {
    query = query.neq('id', input.keepChallengeId);
  }

  await query;
}
