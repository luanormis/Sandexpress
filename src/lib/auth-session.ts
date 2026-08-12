import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { getSessionSecret } from './runtime-config';

export type SessionRole = 'admin' | 'vendor' | 'owner_sales' | 'customer' | 'user';

export type SessionPayload = {
  role: SessionRole;
  vendor_id?: string;
  customer_id?: string;
  umbrella_id?: string;
  user_id?: string;
  user_role?: 'owner' | 'manager' | 'seller';
  tenant_id?: string;
  exp: number;
};

const SESSION_SECRET = getSessionSecret();

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(value: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  try {
    if (!token || token.length > 4096) return null;
    const [body, signature] = token.split('.');
    if (!body || !signature) return null;

    const expected = sign(body);
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return null;
    }

    const parsed = JSON.parse(base64UrlDecode(body)) as SessionPayload;
    if (!parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getRequestSession(req: NextRequest): SessionPayload | null {
  const adminSession = verifySessionToken(req.cookies.get('admin_session')?.value);
  if (adminSession) return adminSession;

  const vendorSession = verifySessionToken(req.cookies.get('vendor_session')?.value);
  if (vendorSession) return vendorSession;

  const customerSession = verifySessionToken(req.cookies.get('customer_session')?.value);
  if (customerSession) return customerSession;

  return null;
}

export function getOwnerSalesSession(req: NextRequest): SessionPayload | null {
  const session = verifySessionToken(req.cookies.get('owner_sales_session')?.value);
  return session?.role === 'owner_sales' && session.vendor_id ? session : null;
}

export function resolveTenantIdFromSession(session: SessionPayload | null): string | null {
  if (!session) return null;
  return session.tenant_id || session.vendor_id || null;
}

export function canAccessVendor(session: SessionPayload | null, vendorId: string): boolean {
  if (!session) return false;
  if (session.role === 'admin') return true;
  return session.role === 'vendor' && session.vendor_id === vendorId;
}
