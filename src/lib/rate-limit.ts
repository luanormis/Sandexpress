/**
 * Rate limiting persistido no Supabase.
 * Tabela: rate_limit_buckets  (ver infra/migration-ajustes.sql)
 *
 * Funciona corretamente com múltiplas réplicas / reinicializações do servidor.
 */
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function isRateLimited(
  req: NextRequest,
  keyPrefix: string,
  maxAttempts: number,
  windowMs: number
): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(Date.now() + windowMs).toISOString();
  const bucketKey = `${keyPrefix}:${getClientIp(req)}`;

  const { data: existing } = await supabaseAdmin
    .from('rate_limit_buckets')
    .select('count, reset_at')
    .eq('key', bucketKey)
    .single();

  if (!existing || existing.reset_at < now.toISOString()) {
    // Janela expirada ou novo bucket — upsert com count=1
    await supabaseAdmin
      .from('rate_limit_buckets')
      .upsert({ key: bucketKey, count: 1, reset_at: resetAt }, { onConflict: 'key' });
    return false;
  }

  const newCount = existing.count + 1;
  await supabaseAdmin
    .from('rate_limit_buckets')
    .update({ count: newCount })
    .eq('key', bucketKey);

  return newCount > maxAttempts;
}
