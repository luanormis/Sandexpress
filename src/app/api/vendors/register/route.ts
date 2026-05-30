import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_UMBRELLA_LIMIT, TRIAL_DAYS } from '@/lib/plans';

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

function generateTemporaryPassword() {
  return crypto.randomBytes(10).toString('base64url');
}

function onlyDigits(value?: string | null) {
  return (value || '').replace(/\D/g, '');
}

/**
 * POST /api/vendors/register
 * Cadastro de novo quiosque a partir da landing page ou admin.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.owner_name || !body.owner_phone) {
      return NextResponse.json({ error: 'name, owner_name e owner_phone sao obrigatorios.' }, { status: 400 });
    }

    const documentLogin = onlyDigits(body.document_login || body.cnpj || body.cpf || body.owner_phone);
    if (!documentLogin) {
      return NextResponse.json({ error: 'CPF ou CNPJ e obrigatorio para login.' }, { status: 400 });
    }

    const password = body.password?.trim();
    let passwordToStore: string;
    let passwordNeedsReset = true;

    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ error: 'A senha deve ter ao menos 8 caracteres.' }, { status: 400 });
      }
      passwordToStore = password;
      passwordNeedsReset = false;
    } else {
      passwordToStore = generateTemporaryPassword();
    }

    const passwordHash = await hashPassword(passwordToStore);

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .insert({
        name: body.name,
        owner_name: body.owner_name,
        owner_phone: onlyDigits(body.owner_phone),
        owner_email: body.owner_email || null,
        cpf: onlyDigits(body.cpf) || null,
        cnpj: onlyDigits(body.cnpj) || null,
        document_login: documentLogin,
        city: body.city || null,
        state: body.state || null,
        password_hash: passwordHash,
        password_needs_reset: passwordNeedsReset,
        subscription_status: 'trial',
        plan_type: 'trial',
        trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
        max_umbrellas: PLAN_UMBRELLA_LIMIT,
      })
      .select()
      .single();

    if (error) throw error;

    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .upsert({
        id: data.id,
        name: data.name,
        status: data.is_active ? 'active' : 'blocked',
        city: data.city,
        state: data.state,
        primary_color: data.primary_color || '#FF6B00',
        logo_url: data.logo_url,
      });

    if (tenantError) throw tenantError;

    const responseBody: any = {
      ...data,
      message: 'Conta criada com sucesso.',
      password_needs_reset: passwordNeedsReset,
    };

    if (!password) {
      responseBody.temporary_password = passwordToStore;
      responseBody.message = 'Conta criada com senha temporaria. Altere a senha no primeiro acesso.';
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    console.error('Vendor register error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
