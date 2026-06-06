import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const JSON_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;
const MAX_UPLOAD_BODY_BYTES = 8 * 1024 * 1024;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const PUBLIC_API_PATHS = new Set([
  '/api/health',
  '/api/qr',
  '/api/customers/login',
  '/api/vendors/register',
]);

const SENSITIVE_PUBLIC_PATHS = new Set([
  '/api/customers/login',
  '/api/vendors/register',
  '/api/auth/admin',
  '/api/auth/vendor',
]);

function securityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
  response.headers.set(
    'Content-Security-Policy',
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests"
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

function isUploadPath(pathname: string) {
  return pathname === '/api/products/upload' || /^\/api\/products\/[^/]+\/upload-image$/.test(pathname);
}

function isAllowedOrigin(req: NextRequest) {
  if (!MUTATING_METHODS.has(req.method)) return true;
  const origin = req.headers.get('origin');
  if (!origin) return process.env.NODE_ENV !== 'production';

  const requestOrigin = req.nextUrl.origin;
  let configuredOrigin = requestOrigin;
  try {
    configuredOrigin = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
      : requestOrigin;
  } catch {
    configuredOrigin = requestOrigin;
  }

  return origin === requestOrigin || origin === configuredOrigin;
}

function isRateLimited(req: NextRequest, pathname: string) {
  const sensitive = SENSITIVE_PUBLIC_PATHS.has(pathname);
  const mutating = MUTATING_METHODS.has(req.method);
  if (!sensitive && !mutating) return false;

  const now = Date.now();
  const windowMs = sensitive ? 60_000 : 10_000;
  const max = sensitive ? 20 : 80;
  const key = `${getClientIp(req)}:${pathname}:${req.method}`;
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  current.count += 1;
  return current.count > max;
}

function validateRequestShape(req: NextRequest, pathname: string) {
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(req.method)) {
    return NextResponse.json({ error: 'Metodo nao permitido.' }, { status: 405 });
  }

  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: 'Origem nao autorizada.' }, { status: 403 });
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  const maxBody = isUploadPath(pathname) ? MAX_UPLOAD_BODY_BYTES : MAX_JSON_BODY_BYTES;
  if (contentLength > maxBody) {
    return NextResponse.json({ error: 'Payload muito grande.' }, { status: 413 });
  }

  if (JSON_METHODS.has(req.method) && !isUploadPath(pathname)) {
    const contentType = req.headers.get('content-type') || '';
    if (contentLength > 0 && !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type invalido.' }, { status: 415 });
    }
  }

  if (isRateLimited(req, pathname)) {
    return NextResponse.json({ error: 'Muitas requisicoes. Aguarde e tente novamente.' }, { status: 429 });
  }

  return null;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/')) {
    return securityHeaders(NextResponse.next());
  }

  const badRequest = validateRequestShape(req, pathname);
  if (badRequest) return securityHeaders(badRequest);

  if (
    PUBLIC_API_PATHS.has(pathname) ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/public/')
  ) {
    return securityHeaders(NextResponse.next());
  }

  const session = getRequestSession(req);
  if (!session) {
    return securityHeaders(NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 }));
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/api/:path*'],
};
