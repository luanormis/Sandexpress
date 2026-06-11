import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl, sendEmail } from '@/lib/email';
import { buildPasswordResetEmail } from '@/lib/email-templates';

export async function POST(req: NextRequest) {
  try {
    const { to, vendor_name, owner_name } = await req.json();
    if (!to) {
      return NextResponse.json({ error: 'Informe o email de destino em "to".' }, { status: 400 });
    }

    const resetUrl = `${getAppBaseUrl(req)}/vendor/reset-password?token=teste-local`;
    const email = buildPasswordResetEmail({
      vendorName: vendor_name || 'Quiosque de Teste',
      ownerName: owner_name || 'Responsavel',
      resetUrl,
      expiresIn: '1 hora',
    });
    const result = await sendEmail({
      to: String(to).trim().toLowerCase(),
      ...email,
    });

    if (!result.ok) {
      return NextResponse.json({
        error: 'Nao foi possivel enviar o email de teste. Configure RESEND_API_KEY e EMAIL_FROM.',
        reason: result.reason,
        preview: {
          to,
          reset_url: resetUrl,
          subject: email.subject,
        },
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Email de teste de recuperacao enviado.',
    });
  } catch (err) {
    console.error('Vendor reset test email error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
