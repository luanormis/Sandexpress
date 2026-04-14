import crypto from 'crypto';
import type { NextRequest } from 'next/server';

type SessionRole = 'admin' | 'vendor' | 'customer';

type SessionPayload = {
  role: SessionRole;
  vendor_id?: string;
  customer_id?: string;
  umbrella_id?: string;
  exp: number;
};

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.VENDOR_JWT_SECRET;

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(value: string): string {
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET (ou VENDOR_JWT_SECRET) não definido.');
  }
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  if (sign(body) !== signature) return null;

  const parsed = JSON.parse(base64UrlDecode(body)) as SessionPayload;
  if (!parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
  if (!parsed.role) return null;
  return parsed;
}

export function getRequestSession(req: NextRequest): SessionPayload | null {
  const vendorSession = verifySessionToken(req.cookies.get('vendor_session')?.value);
  if (vendorSession) return vendorSession;

  const adminSession = verifySessionToken(req.cookies.get('admin_session')?.value);
  if (adminSession) return adminSession;

  const customerSession = verifySessionToken(req.cookies.get('customer_session')?.value);
  if (customerSession) return customerSession;

  return null;
}

export function canAccessVendor(session: SessionPayload | null, vendorId: string): boolean {
  if (!session) return false;
  if (session.role === 'admin') return true;
  return session.role === 'vendor' && session.vendor_id === vendorId;
}
