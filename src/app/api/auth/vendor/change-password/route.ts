import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  })) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * POST /api/auth/vendor/change-password
 * Altera senha a partir de token de recuperação ou senha atual.
 */
export async function POST(req: NextRequest) {
  try {
    const { document_login, current_password, reset_token, new_password } = await req.json();

    if (!new_password || new_password.length < 8) {
      return NextResponse.json({ error: 'Nova senha deve ter ao menos 8 caracteres.' }, { status: 400 });
    }

    const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock.supabase.co';
    if (isDemo) {
      return NextResponse.json({ message: 'Em modo demo, a senha foi alterada com sucesso.' });
    }

    let vendor: any;
    if (reset_token) {
      const { data, error } = await (supabaseAdmin.from('vendors') as any)
        .select('*')
        .eq('password_reset_token', reset_token)
        .single();
      if (error || !data) {
        return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 400 });
      }
      const vendorData: any = data;
      if (!vendorData.password_reset_expires_at || new Date(vendorData.password_reset_expires_at) < new Date()) {
        return NextResponse.json({ error: 'Token de recuperação expirou.' }, { status: 400 });
      }
      vendor = vendorData;
    } else {
      if (!document_login || !current_password) {
        return NextResponse.json({ error: 'CPF/CNPJ e senha atual são obrigatórios para alteração.' }, { status: 400 });
      }
      const { data, error } = await (supabaseAdmin.from('vendors') as any)
        .select('*')
        .eq('document_login', document_login)
        .single();
      if (error || !data) {
        return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
      }
      const passwordMatches = await (async () => {
        const storedHash = data.password_hash || '';
        const [salt, key] = storedHash.split(':');
        if (!salt || !key) return false;
        const derivedKey = (await new Promise<Buffer>((resolve, reject) => {
          crypto.scrypt(current_password, salt, 64, (err, derived) => {
            if (err) reject(err);
            else resolve(derived);
          });
        })) as Buffer;
        return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
      })();
      if (!passwordMatches) {
        return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
      }
      vendor = data;
    }

    const passwordHash = await hashPassword(new_password);
    const { error: updateError } = await (supabaseAdmin.from('vendors') as any)
      .update({
        password_hash: passwordHash,
        password_needs_reset: false,
        password_reset_token: null,
        password_reset_expires_at: null,
      })
      .eq('id', vendor.id as string);

    if (updateError) {
      console.error('Vendor change password error:', updateError);
      return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) {
    console.error('Vendor change password error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
