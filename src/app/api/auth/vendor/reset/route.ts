import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAppBaseUrl, sendEmail } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase-admin';

function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/auth/vendor/reset
 * Inicia recuperacao de senha por email.
 */
export async function POST(req: NextRequest) {
  try {
    const { owner_email } = await req.json();
    if (!owner_email) {
      return NextResponse.json({ error: 'Informe o email cadastrado do proprietario.' }, { status: 400 });
    }

    const normalizedEmail = String(owner_email).trim().toLowerCase();
    const { data: vendors, error } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('owner_email', normalizedEmail)
      .limit(1);

    if (error) {
      console.error('Vendor reset lookup error:', error);
      return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }

    const vendor = (vendors as any)?.[0];
    if (!vendor) {
      return NextResponse.json({ message: 'Se o email estiver cadastrado, enviaremos um link de recuperacao.' });
    }

    const resetToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: updateError } = await (supabaseAdmin.from('vendors') as any)
      .update({
        password_reset_token: hashResetToken(resetToken),
        password_reset_expires_at: expiresAt,
      })
      .eq('id', vendor.id as string);

    if (updateError) {
      console.error('Vendor reset token error:', updateError);
      return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }

    const resetUrl = `${getAppBaseUrl(req)}/vendor/reset-password?token=${encodeURIComponent(resetToken)}`;
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: 'Recuperacao de senha SandExpress',
      text: `Use este link para criar uma nova senha do seu quiosque SandExpress: ${resetUrl}\n\nO link vence em 1 hora.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#261812">
          <h2>Recuperacao de senha SandExpress</h2>
          <p>Recebemos uma solicitacao para redefinir a senha do quiosque <strong>${vendor.name}</strong>.</p>
          <p><a href="${resetUrl}" style="display:inline-block;background:#ff6b00;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Criar nova senha</a></p>
          <p>Este link vence em 1 hora. Se voce nao pediu isso, ignore este email.</p>
        </div>
      `,
    });

    if (!emailResult.ok) {
      return NextResponse.json({
        error: 'Nao foi possivel enviar o email de recuperacao. Configure RESEND_API_KEY e EMAIL_FROM no Vercel.',
        ...(process.env.NODE_ENV !== 'production' ? { reset_url: resetUrl, expires_at: expiresAt } : {}),
      }, { status: 503 });
    }

    return NextResponse.json({
      message: 'Se o email estiver cadastrado, enviaremos um link de recuperacao.',
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('Vendor reset error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
