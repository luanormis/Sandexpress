import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_MENU } from '@/lib/default-menu';

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
 * Cria um tenant isolado, o vendor, o cardapio padrao e ate 50 guarda-sois.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.owner_name || !body.owner_phone || !body.city || !body.state || !body.beach_name) {
      return NextResponse.json({
        error: 'Nome do quiosque, responsavel, telefone, praia, cidade e estado sao obrigatorios.',
      }, { status: 400 });
    }

    const cleanPhone = String(body.owner_phone || '').replace(/\D/g, '');
    const cleanCpf = String(body.cpf || '').replace(/\D/g, '');
    const cleanCnpj = String(body.cnpj || '').replace(/\D/g, '');
    const documentLogin = String(body.document_login || cleanCnpj || cleanCpf || cleanPhone).trim();
    if (!documentLogin) {
      return NextResponse.json({ error: 'Informe telefone, CPF ou CNPJ para criar o login.' }, { status: 400 });
    }
    if (!cleanCpf && !cleanCnpj) {
      return NextResponse.json({ error: 'Informe CPF ou CNPJ para o cadastro do quiosque.' }, { status: 400 });
    }

    const duplicateFilters = [
      `document_login.eq.${documentLogin}`,
      cleanCpf ? `cpf.eq.${cleanCpf}` : '',
      cleanCnpj ? `cnpj.eq.${cleanCnpj}` : '',
    ].filter(Boolean).join(',');

    const { data: duplicateVendor, error: duplicateError } = await supabaseAdmin
      .from('vendors')
      .select('id, document_login, cpf, cnpj')
      .or(duplicateFilters)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicateVendor) {
      return NextResponse.json({
        error: 'Ja existe um quiosque cadastrado com este CPF, CNPJ ou login. Use outro documento ou entre pelo painel do quiosque.',
      }, { status: 409 });
    }

    const initialPassword = String(body.password || crypto.randomBytes(9).toString('base64url'));
    if (initialPassword.length < 8) {
      return NextResponse.json({ error: 'A senha inicial deve ter pelo menos 8 caracteres.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(initialPassword);
    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const maxUmbrellas = Math.min(Math.max(Number(body.max_umbrellas || 50), 1), 50);

    const { data: tenant, error: tenantError } = await (supabaseAdmin.from('tenants') as any)
      .insert({
        name: body.name,
        status: 'active',
        city: body.city || null,
        state: body.state || null,
        beach_name: body.beach_name,
        primary_color: body.primary_color || '#ff7a1a',
        logo_url: body.logo_url || null,
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    const { data: vendor, error: vendorError } = await (supabaseAdmin.from('vendors') as any)
      .insert({
        tenant_id: tenant.id,
        name: body.name,
        owner_name: body.owner_name,
        owner_phone: body.owner_phone,
        owner_email: body.owner_email || null,
        cpf: cleanCpf || null,
        cnpj: cleanCnpj || null,
        document_login: documentLogin,
        address: body.address || body.beach_name,
        city: body.city,
        state: String(body.state).toUpperCase(),
        logo_url: body.logo_url || null,
        primary_color: body.primary_color || '#ff7a1a',
        secondary_color: body.secondary_color || '#0f3d4f',
        password_hash: passwordHash,
        password_needs_reset: !body.password,
        subscription_status: 'trial',
        plan_type: 'trial',
        trial_ends_at: trialEndsAt,
        max_umbrellas: maxUmbrellas,
        is_active: true,
      })
      .select()
      .single();

    if (vendorError) throw vendorError;

    const { error: productsError } = await (supabaseAdmin.from('products') as any).insert(
      DEFAULT_MENU.map((item) => ({
        tenant_id: tenant.id,
        vendor_id: vendor.id,
        ...item,
        active: true,
        stock_quantity: null,
        blocked_by_stock: false,
      }))
    );
    if (productsError) throw productsError;

    const { error: umbrellasError } = await (supabaseAdmin.from('umbrellas') as any).insert(
      Array.from({ length: maxUmbrellas }, (_, index) => ({
        tenant_id: tenant.id,
        vendor_id: vendor.id,
        number: index + 1,
        label: `Guarda-sol ${index + 1}`,
        active: true,
        is_occupied: false,
        map_x: 8 + ((index % 10) * 9),
        map_y: 10 + (Math.floor(index / 10) * 14),
      }))
    );
    if (umbrellasError) throw umbrellasError;

    return NextResponse.json({
      ...vendor,
      tenant_id: tenant.id,
      document_login: documentLogin,
      message: body.password
        ? 'Quiosque criado com senha definida pelo vendor.'
        : 'Quiosque criado com senha temporaria. O vendor deve alterar no primeiro acesso.',
      temporary_password: body.password ? undefined : initialPassword,
    }, { status: 201 });
  } catch (err) {
    console.error('Vendor register error:', err);
    return NextResponse.json({
      error: 'Erro ao gravar no Supabase. Confirme que o banco foi criado com infra/sql-iniciar-novo-projeto.sql e que as variaveis do Vercel apontam para esse projeto.',
    }, { status: 500 });
  }
}
