import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSessionToken } from '@/lib/auth-session';
import { isRateLimited } from '@/lib/rate-limit';

/**
 * POST /api/auth/admin
 * Login do admin — verifica senha via variável de ambiente.
 */
export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(req, 'auth-admin', 8, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 });
    }

    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: 'Senha é obrigatória.' }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json({ error: 'ADMIN_PASSWORD não configurada no ambiente.' }, { status: 500 });
    }

    const isValid =
      adminPassword.length === password.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword));

    if (!isValid) {
      return NextResponse.json({ error: 'Senha inválida.' }, { status: 401 });
    }

    const token = createSessionToken({ role: 'admin' }, 60 * 60);
    const response = NextResponse.json({
      role: 'admin',
      token,
    });
    response.cookies.set({
      name: 'admin_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60,
    });
    return response;
  } catch (err) {
    console.error('Admin auth error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
