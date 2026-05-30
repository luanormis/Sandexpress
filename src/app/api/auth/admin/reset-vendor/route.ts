import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  })) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

function generateTemporaryPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

/**
 * POST /api/auth/admin/reset-vendor
 * Admin reset vendor password. Requires admin session.
 *
 * Body: { vendor_id, new_password? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Não autenticado como admin.' }, { status: 401 });
    }

    const { vendor_id, new_password } = await req.json();
    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id é obrigatório.' }, { status: 400 });
    }

    const password = new_password || generateTemporaryPassword();
    const passwordHash = await hashPassword(password);

    const { data: vendor, error } = await supabaseAdmin
      .from('vendors')
      .update({
        password_hash: passwordHash,
        password_needs_reset: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendor_id)
      .select('id')
      .single();

    if (error) {
      console.error('Admin reset vendor error:', error);
      return NextResponse.json({ error: 'Erro ao resetar senha do vendor.' }, { status: 500 });
    }

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      vendor_id,
      temporary_password: new_password ? undefined : password,
      must_change_password: true,
      message: 'Senha do vendor atualizada com sucesso. O vendor deverá alterar a senha no próximo login.',
    });
  } catch (err) {
    console.error('Admin reset vendor exception:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
