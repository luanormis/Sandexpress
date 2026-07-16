import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { featureDisabledResponse, vendorFeatureEnabled } from '@/lib/features';
import { normalizeProductStockForWrite } from '@/lib/product-stock';
import { normalizeRenderableProductImageUrl } from '@/lib/product-image-url';

function normalizeMoney(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Number(numeric.toFixed(2)) : null;
}

function normalizeText(value: unknown, max = 120) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function normalizeOptions(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 50);
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
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
      error: 'Produto sem vendor/tenant válido. Faça login novamente no painel do quiosque e tente salvar outra vez.',
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
    return NextResponse.json((data || []).map((product: any) => {
      const price = Number(product.price);
      const cost = product.cost_price === null || product.cost_price === undefined ? null : Number(product.cost_price);
      return {
        ...product,
        image_url: normalizeRenderableProductImageUrl(product.image_url),
        gross_margin_amount: cost === null ? null : Number((price - cost).toFixed(2)),
        gross_margin_percent: cost === null || price <= 0 ? null : Number((((price - cost) / price) * 100).toFixed(2)),
      };
    }));
  } catch (err) {
    console.error('Products GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.vendor_id || !body.name || body.price === undefined) {
      return NextResponse.json({ error: 'vendor_id, name e price são obrigatórios.' }, { status: 400 });
    }
    const price = normalizeMoney(body.price);
    const costPrice = body.cost_price === null || body.cost_price === undefined || body.cost_price === ''
      ? null
      : normalizeMoney(body.cost_price);
    if (body.cost_price !== null && body.cost_price !== undefined && body.cost_price !== '' && costPrice === null) {
      return NextResponse.json({ error: 'Custo de insumo inválido.' }, { status: 400 });
    }
    let promotionalPrice: number | null = null;
    if (body.promotional_price !== null && body.promotional_price !== undefined && body.promotional_price !== '') {
      promotionalPrice = normalizeMoney(body.promotional_price);
      if (promotionalPrice === null) {
        return NextResponse.json({ error: 'Preço promocional inválido.' }, { status: 400 });
      }
    }
    if (price === null) {
      return NextResponse.json({ error: 'Preço inválido.' }, { status: 400 });
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
      cost_price: costPrice,
      promotional_price: promotionalPrice,
      category: String(body.category || 'Geral').trim().slice(0, 80),
      subcategory: normalizeText(body.subcategory, 80),
      option_group_name: normalizeText(body.option_group_name, 80),
      option_values: normalizeOptions(body.option_values),
      menu_highlight: Boolean(body.menu_highlight || body.is_combo || promotionalPrice !== null),
      promotion_starts_at: body.promotion_starts_at || null,
      promotion_ends_at: body.promotion_ends_at || null,
      image_url: body.image_url ? String(body.image_url).trim().slice(0, 2048) : null,
      is_default_image: body.image_url ? body.is_default_image !== false : true,
      active: body.active !== false,
      is_combo: Boolean(body.is_combo),
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
      ...stockPayload,
    };

    const { data, error } = await (supabaseAdmin.from('products') as any)
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({
      ...data,
      image_url: normalizeRenderableProductImageUrl((data as any)?.image_url),
      gross_margin_amount: data.cost_price === null ? null : Number((Number(data.price) - Number(data.cost_price)).toFixed(2)),
      gross_margin_percent: data.cost_price === null || Number(data.price) <= 0
        ? null
        : Number((((Number(data.price) - Number(data.cost_price)) / Number(data.price)) * 100).toFixed(2)),
    }, { status: 201 });
  } catch (err) {
    return productErrorResponse(err);
  }
}
