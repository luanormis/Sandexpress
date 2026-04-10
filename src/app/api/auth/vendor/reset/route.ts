import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/auth/vendor/reset
 * Inicia recuperação de senha por email ou telefone.
 */
export async function POST(req: NextRequest) {
  try {
    const { owner_email, owner_phone } = await req.json();

    if (!owner_email && !owner_phone) {
      return NextResponse.json({ error: 'Informe email ou telefone do proprietário.' }, { status: 400 });
    }

    const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock.supabase.co';
    if (isDemo) {
      return NextResponse.json({ message: 'Em modo demo, a recuperação de senha foi simulada.' });
    }

    let query: any = supabaseAdmin.from('vendors').select('*').limit(1);
    if (owner_email) query = query.eq('owner_email', owner_email);
    if (owner_phone) query = query.eq('owner_phone', owner_phone);

    const { data: vendors, error } = await query;
    if (error) {
      console.error('Vendor reset lookup error:', error);
      return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }

    const vendor = (vendors as any)?.[0];
    if (!vendor) {
      return NextResponse.json({ error: 'Não encontramos um quiosque com estas informações.' }, { status: 404 });
    }

    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: updateError } = await (supabaseAdmin.from('vendors') as any)
      .update({
        password_reset_token: resetToken,
        password_reset_expires_at: expiresAt,
      })
      .eq('id', vendor.id as string);

    if (updateError) {
      console.error('Vendor reset token error:', updateError);
      return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Token de recuperação gerado. Use-o para alterar a senha.',
      reset_token: resetToken,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('Vendor reset error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
