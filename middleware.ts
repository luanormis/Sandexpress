import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from './src/lib/auth-session';
import { validateTenantAccess, resolveTenantIdFromSession } from './src/lib/tenant-utils';

const publicPaths = ['/api/auth', '/api/public', '/_next', '/favicon.ico', '/manifest.json', '/register-sw.js', '/sw.js', '/robots.txt'];

function isPublicPath(pathname: string) {
  return publicPaths.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = getRequestSession(request);
  if (!session) {
    return NextResponse.next();
  }

  const tenantId = resolveTenantIdFromSession(session);
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant não encontrado na sessão.' }, { status: 403 });
  }

  try {
    await validateTenantAccess(tenantId);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Acesso ao tenant negado.' }, { status: 403 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', tenantId);
  requestHeaders.set('x-tenant-status', 'active');

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|register-sw.js|sw.js|api/auth|api/public).*)'],
};
