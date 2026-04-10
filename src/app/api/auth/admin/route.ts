import { NextRequest, NextResponse } from 'next/server';

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

    const token = Buffer.from(`admin:${Date.now()}`).toString('base64');

    return NextResponse.json({
      role: 'admin',
      token,
    });
  } catch (err) {
    console.error('Admin auth error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
