import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth-session';
import { getAdminUsername, verifyAdminCredentials } from '@/lib/admin-auth';

/**
 * POST /api/auth/admin
 * Login do admin master.
 */
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario e senha sao obrigatorios.' }, { status: 400 });
    }

    if (!verifyAdminCredentials(username, password)) {
      return NextResponse.json({ error: 'Usuario ou senha invalidos.' }, { status: 401 });
    }

    const token = createSessionToken({ role: 'admin', user_id: getAdminUsername() }, 12 * 60 * 60);
    const response = NextResponse.json({
      role: 'admin',
      username: getAdminUsername(),
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
