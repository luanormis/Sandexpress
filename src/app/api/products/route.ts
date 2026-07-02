import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { featureDisabledResponse, vendorFeatureEnabled } from '@/lib/features';
import { isMissingProductStockColumnError, normalizeProductStockForWrite, removeProductStockFields } from '@/lib/product-stock';

function normalizeMoney(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Number(numeric.toFixed(2)) : null;
}

const OPTIONAL_INSERT_COLUMNS = [
  'is_default_image',
  'is_combo',
  'stock_tracking_enabled',
  'stock_quantity',
  'physical_stock_quantity',
  'beach_stock_quantity',
  'blocked_by_stock',
  'sort_order',
  'promotional_price',
];

function missingColumnFromError(error: any) {
  if (!['42703', 'PGRST204'].includes(error?.code || '')) return null;
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  const quoted = message.match(/column "([^"]+)"/i) || message.match(/'([^']+)' column/i);
  if (quoted?.[1]) return quoted[1];
  return OPTIONAL_INSERT_COLUMNS.find((column) => message.includes(column)) || null;
}

async function insertProductWithSchemaFallback(payload: Record<string, unknown>) {
  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < OPTIONAL_INSERT_COLUMNS.length + 1; attempt += 1) {
    const result = await (supabaseAdmin.from('products') as any)
      .insert(currentPayload)
      .select()
      .single();

    if (!result.error) return result;

    if (isMissingProductStockColumnError(result.error)) {
      currentPayload = removeProductStockFields(currentPayload);
      continue;
    }

    const missingColumn = missingColumnFromError(result.error);
    if (!missingColumn || !OPTIONAL_INSERT_COLUMNS.includes(missingColumn)) return result;
    const { [missingColumn]: _removed, ...nextPayload } = currentPayload;
    currentPayload = nextPayload;
  }
  return { data: null, error: new Error('Nao foi possivel adaptar o cadastro ao schema atual.') };
}

function productErrorResponse(error: any) {
  console.error('Products POST error:', {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });

  if (['42P01', 'PGRST205'].includes(error?.code || '')) {
    return NextResponse.json({
      error: 'Tabela de produtos nao encontrada no Supabase. Rode o SQL inicial ou as migracoes antes de cadastrar produtos.',
      code: error?.code,
    }, { status: 500 });
  }

  if (['42703', 'PGRST204'].includes(error?.code || '')) {
    return NextResponse.json({
      error: `Schema de produtos desatualizado: ${error.message}. Rode as migracoes SQL no Supabase.`,
      code: error.code,
    }, { status: 500 });
  }

  if (error?.code === '42501') {
    return NextResponse.json({
      error: 'Permissao insuficiente na tabela products. Rode infra/sql-atualizacao-controle-estoque-produtos.sql no Supabase para liberar os GRANTs da Data API.',
      code: error.code,
    }, { status: 500 });
  }

  if (error?.code === '23503') {
    return NextResponse.json({
      error: 'Produto sem vendor/tenant valido. Faca login novamente no painel do quiosque e tente salvar outra vez.',
      code: error.code,
    }, { status: 400 });
  }

  if (error?.code === '23502') {
    return NextResponse.json({
      error: `Campo obrigatorio ausente em products: ${error.message}. Rode o SQL de preparacao do banco.`,
      code: error.code,
    }, { status: 500 });
  }

  return NextResponse.json({ error: error?.message || 'Erro interno ao salvar produto.' }, { status: 500 });
}

/**
 * GET /api/products?vendor_id=xxx
 * Lista todos os produtos de um vendor.
 *
 * POST /api/products
 * Cria um novo produto dentro do tenant do vendor.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatorio.' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendor_id, 'digital_menu')) {
      return NextResponse.json(featureDisabledResponse('digital_menu'), { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('vendor_id', vendor_id)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Products GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.vendor_id || !body.name || body.price === undefined) {
      return NextResponse.json({ error: 'vendor_id, name e price sao obrigatorios.' }, { status: 400 });
    }
    const price = normalizeMoney(body.price);
    let promotionalPrice: number | null = null;
    if (body.promotional_price !== null && body.promotional_price !== undefined && body.promotional_price !== '') {
      promotionalPrice = normalizeMoney(body.promotional_price);
      if (promotionalPrice === null) {
        return NextResponse.json({ error: 'Preco promocional invalido.' }, { status: 400 });
      }
    }
    if (price === null) {
      return NextResponse.json({ error: 'Preco invalido.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, body.vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(body.vendor_id, 'digital_menu')) {
      return NextResponse.json(featureDisabledResponse('digital_menu'), { status: 403 });
    }

    const { data: vendor, error: vendorErr } = await (supabaseAdmin.from('vendors') as any)
      .select('tenant_id')
      .eq('id', body.vendor_id)
      .single();
    if (vendorErr || !vendor?.tenant_id) {
      return NextResponse.json({ error: 'Vendor sem tenant configurado. Execute a migracao de producao.' }, { status: 400 });
    }

    const stockPayload = normalizeProductStockForWrite(body);
    const insertPayload = {
      tenant_id: vendor.tenant_id,
      vendor_id: body.vendor_id,
      name: String(body.name || '').trim().slice(0, 160),
      description: body.description ? String(body.description).trim().slice(0, 500) : null,
      price,
      promotional_price: promotionalPrice,
      category: String(body.category || 'Geral').trim().slice(0, 80),
      image_url: body.image_url ? String(body.image_url).trim().slice(0, 2048) : null,
      is_default_image: body.image_url ? body.is_default_image !== false : true,
      active: body.active !== false,
      is_combo: Boolean(body.is_combo),
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
      ...stockPayload,
    };

    const { data, error } = await insertProductWithSchemaFallback(insertPayload);

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return productErrorResponse(err);
  }
}
