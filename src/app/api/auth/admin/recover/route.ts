import { NextRequest, NextResponse } from 'next/server';
import { getAdminUsername } from '@/lib/admin-auth';

/**
 * POST /api/auth/admin/recover
 * Registra uma solicitacao de recuperacao de senha do admin por email.
 */
export async function POST(req: NextRequest) {
  try {
    const { username, email } = await req.json();

    if (!username || !email) {
      return NextResponse.json({ error: 'Usuario e email sao obrigatorios.' }, { status: 400 });
    }

    const recoveryEmail = process.env.ADMIN_RECOVERY_EMAIL || 'admin@example.com';
    if (username !== getAdminUsername() || email !== recoveryEmail) {
      return NextResponse.json({ error: 'Email nao encontrado.' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Solicitacao de recuperacao recebida. Configure um provedor de email para envio automatico em producao.',
      recovery_email: recoveryEmail,
    });
  } catch (err) {
    console.error('Admin recover error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
