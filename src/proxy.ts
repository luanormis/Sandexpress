import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';

const PUBLIC_API_PATHS = new Set([
  '/api/health',
  '/api/qr',
  '/api/customers/login',
  '/api/customers/request-otp',
]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (
    PUBLIC_API_PATHS.has(pathname) ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/public/')
  ) {
    return NextResponse.next();
  }

  const session = await getRequestSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
