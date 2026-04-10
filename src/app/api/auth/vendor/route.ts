import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derivedKey = (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  })) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
}

/**
 * POST /api/auth/vendor
 * Login do vendor (quiosque).
 * Recebe phone + password, valida no banco, retorna sessão.
 */
export async function POST(req: NextRequest) {
  try {
    const { document_login, password } = await req.json();

    if (!document_login || !password) {
      return NextResponse.json({ error: 'CPF/CNPJ e senha são obrigatórios.' }, { status: 400 });
    }

    const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock.supabase.co';

    if (isDemo) {
      return NextResponse.json({
        vendor_id: 'demo-vendor-id',
        vendor_name: 'Quiosque Demo',
        owner_name: 'Usuário Demo',
        token: 'demo-token-' + Date.now(),
        must_change_password: false,
      });
    }

    const { data: vendor, error } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('document_login', document_login)
      .single() as { data: any; error: any };

    if (error || !vendor || !vendor.password_hash) {
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
    }

    const passwordMatches = await verifyPassword(password, vendor.password_hash);
    if (!passwordMatches) {
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
    }

    if (!vendor.is_active || vendor.subscription_status === 'blocked') {
      return NextResponse.json({ error: 'Quiosque bloqueado. Entre em contato com o suporte.' }, { status: 403 });
    }

    const token = Buffer.from(`${vendor.id}:${Date.now()}`).toString('base64');

    return NextResponse.json({
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      owner_name: vendor.owner_name,
      token,
      must_change_password: vendor.password_needs_reset ?? false,
    });
  } catch (err) {
    console.error('Vendor auth error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
