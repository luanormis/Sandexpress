import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAppBaseUrl, sendEmail } from '@/lib/email';
import { buildPasswordResetEmail } from '@/lib/email-templates';
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
    const email = buildPasswordResetEmail({
      vendorName: vendor.name,
      ownerName: vendor.owner_name,
      resetUrl,
      expiresIn: '1 hora',
    });
    const emailResult = await sendEmail({
      to: normalizedEmail,
      ...email,
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
