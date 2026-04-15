import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth-session';

/**
 * POST /api/auth/admin
 * Login do admin — verifica senha via variável de ambiente.
 */
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: 'Senha é obrigatória.' }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD || '123@senha123@';

    if (password !== adminPassword) {
      return NextResponse.json({ error: 'Senha inválida.' }, { status: 401 });
    }

    const token = createSessionToken({ role: 'admin' }, 12 * 60 * 60);
    const response = NextResponse.json({
      role: 'admin',
      token,
    });
    response.cookies.set({
      name: 'admin_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
    });
    return response;
  } catch (err) {
    console.error('Admin auth error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
