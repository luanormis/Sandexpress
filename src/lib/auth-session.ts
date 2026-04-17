import type { NextRequest } from 'next/server';

export type SessionRole = 'admin' | 'vendor' | 'customer' | 'user';

export type SessionPayload = {
  role: SessionRole;
  vendor_id?: string;
  customer_id?: string;
  umbrella_id?: string;
  user_id?: string;
  tenant_id?: string;
  exp: number;
};

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.VENDOR_JWT_SECRET;

function base64UrlEncode(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf8').toString('base64url');
  }

  const encoded = new TextEncoder().encode(input);
  let binary = '';
  encoded.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'base64url').toString('utf8');
  }

  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
}

async function hmacSha256(value: string): Promise<string> {
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET (ou VENDOR_JWT_SECRET) não definido.');
  }

  if (typeof process !== 'undefined' && process.release?.name === 'node') {
    const crypto = await import('crypto');
    return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  const signatureBytes = new Uint8Array(signature);
  let binary = '';
  signatureBytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createSessionToken(
  payload: Omit<SessionPayload, 'exp'>,
  ttlSeconds: number
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const signature = await hmacSha256(body);
  return `${body}.${signature}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  if ((await hmacSha256(body)) !== signature) return null;

  const parsed = JSON.parse(base64UrlDecode(body)) as SessionPayload;
  if (!parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
  if (!parsed.role) return null;
  return parsed;
}

export async function getRequestSession(req: NextRequest): Promise<SessionPayload | null> {
  const vendorSession = await verifySessionToken(req.cookies.get('vendor_session')?.value);
  if (vendorSession) return vendorSession;

  const adminSession = await verifySessionToken(req.cookies.get('admin_session')?.value);
  if (adminSession) return adminSession;

  const customerSession = await verifySessionToken(req.cookies.get('customer_session')?.value);
  if (customerSession) return customerSession;

  return null;
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
