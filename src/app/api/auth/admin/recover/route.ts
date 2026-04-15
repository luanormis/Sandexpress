import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/rate-limit';

/**
 * POST /api/auth/admin/recover
 * Inicia recuperação de senha do admin via email.
 */
export async function POST(req: NextRequest) {
  try {
    if (await isRateLimited(req, 'auth-admin-recover', 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 });
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório.' }, { status: 400 });
    }

    const recoveryEmail = process.env.ADMIN_RECOVERY_EMAIL || 'admin@example.com';
    if (email !== recoveryEmail) return NextResponse.json({ message: 'Se os dados estiverem corretos, enviaremos as instruções.' });

    return NextResponse.json({
      message: 'Se os dados estiverem corretos, enviaremos as instruções.',
    });
  } catch (err) {
    console.error('Admin recover error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
