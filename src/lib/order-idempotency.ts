import { supabaseAdmin } from '@/lib/supabase-admin';

export async function cleanupOrderIdempotencyKeys(retentionDays = 30) {
  const safeDays = Math.min(365, Math.max(7, Math.floor(retentionDays)));
  const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabaseAdmin
    .from('order_idempotency_keys')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  if (error) throw error;
  return { deleted: count || 0, retention_days: safeDays };
}
