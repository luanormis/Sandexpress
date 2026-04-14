import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';

const DEFAULT_VENDOR_PASSWORD = 'senha123@';

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
 * POST /api/vendors/register
 * Cadastro de novo quiosque (a partir da landing page ou admin).
 */
export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admin pode cadastrar quiosques.' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.name || !body.owner_name || !body.owner_phone) {
      return NextResponse.json({ error: 'name, owner_name e owner_phone são obrigatórios.' }, { status: 400 });
    }

    if (!body.document_login) {
      return NextResponse.json({ error: 'CPF ou CNPJ (document_login) é obrigatório para login.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(DEFAULT_VENDOR_PASSWORD);

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .insert({
        name: body.name,
        owner_name: body.owner_name,
        owner_phone: body.owner_phone,
        owner_email: body.owner_email || null,
        cpf: body.cpf || null,
        cnpj: body.cnpj || null,
        document_login: body.document_login,
        city: body.city || null,
        state: body.state || null,
        password_hash: passwordHash,
        password_needs_reset: true,
        subscription_status: 'trial',
        plan_type: 'trial',
        max_umbrellas: 120,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      ...data,
      message: 'Conta criada com senha padrão. Altere a senha no primeiro acesso.',
    }, { status: 201 });
  } catch (err) {
    console.error('Vendor register error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
