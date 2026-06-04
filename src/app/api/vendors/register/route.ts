import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

type MenuSeedItem = {
  category: string;
  name: string;
  price: number;
  sort_order: number;
};

const DEFAULT_MENU: MenuSeedItem[] = [
  { category: 'Petiscos e Porcoes', name: 'Porcao de Peixe Frito', price: 75, sort_order: 10 },
  { category: 'Petiscos e Porcoes', name: 'Porcao de Camarao Frito', price: 90, sort_order: 20 },
  { category: 'Petiscos e Porcoes', name: 'Porcao de Batata Frita', price: 35, sort_order: 30 },
  { category: 'Petiscos e Porcoes', name: 'Porcao de Mandioca Frita', price: 38, sort_order: 40 },
  { category: 'Pasteis', name: 'Pastel de Camarao', price: 14, sort_order: 50 },
  { category: 'Pasteis', name: 'Pastel de Carne', price: 12, sort_order: 60 },
  { category: 'Pasteis', name: 'Pastel de Queijo', price: 12, sort_order: 70 },
  { category: 'Pasteis', name: 'Pastel de Palmito', price: 12, sort_order: 80 },
  { category: 'Pasteis', name: 'Pastel de Frango com Catupiry', price: 13, sort_order: 90 },
  { category: 'Drinks, Caipirinhas e Batidas', name: 'Caipirinha de Limao (Cachaca)', price: 22, sort_order: 100 },
  { category: 'Drinks, Caipirinhas e Batidas', name: 'Caipiroska de Frutas (Vodka)', price: 26, sort_order: 110 },
  { category: 'Drinks, Caipirinhas e Batidas', name: 'Batida de Coco', price: 20, sort_order: 120 },
  { category: 'Drinks, Caipirinhas e Batidas', name: 'Batida de Maracuja', price: 20, sort_order: 130 },
  { category: 'Drinks, Caipirinhas e Batidas', name: 'Batida de Morango', price: 20, sort_order: 140 },
  { category: 'Cervejas em Lata', name: 'Cerveja Amstel / Skol / Brahma (Lata 350ml)', price: 10, sort_order: 150 },
  { category: 'Cervejas em Lata', name: 'Cerveja Heineken / Corona / Stella Artois (Lata 350ml)', price: 12, sort_order: 160 },
  { category: 'Cervejas em Lata', name: 'Cerveja Budweiser / Eisenbahn (Lata 350ml)', price: 11, sort_order: 170 },
  { category: 'Cervejas em Lata', name: 'Cervejas Latao (Marcas Tradicionais - 473ml)', price: 13, sort_order: 180 },
  { category: 'Bebidas Nao Alcoolicas', name: 'Suco Natural de Frutas (Laranja, Abacaxi ou Limao)', price: 12, sort_order: 190 },
  { category: 'Bebidas Nao Alcoolicas', name: 'Refrigerante Lata (Coca-Cola / Coca-Cola Zero)', price: 7, sort_order: 200 },
  { category: 'Bebidas Nao Alcoolicas', name: 'Refrigerante Lata (Guarana Antarctica / Sprite / Fanta Laranja)', price: 7, sort_order: 210 },
  { category: 'Bebidas Nao Alcoolicas', name: 'Agua Mineral sem Gas', price: 5, sort_order: 220 },
  { category: 'Bebidas Nao Alcoolicas', name: 'Agua Mineral com Gas', price: 6, sort_order: 230 },
];

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

    if (!body.name || !body.owner_name || !body.owner_phone) {
      return NextResponse.json({ error: 'name, owner_name e owner_phone sao obrigatorios.' }, { status: 400 });
    }

    if (!body.document_login) {
      return NextResponse.json({ error: 'CPF ou CNPJ (document_login) e obrigatorio para login.' }, { status: 400 });
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
        beach_name: body.beach_name || body.address || null,
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
        cpf: body.cpf || null,
        cnpj: body.cnpj || null,
        document_login: body.document_login,
        address: body.address || body.beach_name || null,
        city: body.city || null,
        state: body.state || null,
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
      message: body.password
        ? 'Quiosque criado com senha definida pelo vendor.'
        : 'Quiosque criado com senha temporaria. O vendor deve alterar no primeiro acesso.',
      temporary_password: body.password ? undefined : initialPassword,
    }, { status: 201 });
  } catch (err) {
    console.error('Vendor register error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
