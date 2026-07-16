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
  const bucketKey = `${keyPrefix}:${getClientIp(req)}`;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  const { data: limited, error: rpcError } = await supabaseAdmin.rpc('consume_rate_limit', {
    p_key: bucketKey,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });

  if (rpcError) throw rpcError;
  if (typeof limited !== 'boolean') {
    throw new Error('consume_rate_limit retornou um resultado invalido.');
  }
  return limited;
}
