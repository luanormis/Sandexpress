import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/admin/recover
 * Inicia recuperação de senha do admin via email.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório.' }, { status: 400 });
    }

    const recoveryEmail = process.env.ADMIN_RECOVERY_EMAIL || 'admin@example.com';
    if (email !== recoveryEmail) {
      return NextResponse.json({ error: 'Email não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Solicitação de recuperação recebida. Envie instruções por email para o administrador.',
      recovery_email: recoveryEmail,
    });
  } catch (err) {
    console.error('Admin recover error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
