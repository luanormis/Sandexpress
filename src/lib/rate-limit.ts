import type { NextRequest } from 'next/server';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') || 'unknown';
}

export function isRateLimited(req: NextRequest, keyPrefix: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `${keyPrefix}:${getClientIp(req)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  existing.count += 1;
  buckets.set(key, existing);
  return existing.count > maxAttempts;
}
