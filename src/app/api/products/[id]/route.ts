import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';
import { normalizeProductStockForWrite } from '@/lib/product-stock';
import { normalizeRenderableProductImageUrl } from '@/lib/product-image-url';

const ALLOWED_PRODUCT_FIELDS = new Set([
  'name',
  'description',
  'price',
  'promotional_price',
  'category',
  'subcategory',
  'category_id',
  'subcategory_id',
  'option_group_name',
  'option_values',
  'menu_highlight',
  'promotion_starts_at',
  'promotion_ends_at',
  'image_url',
  'is_default_image',
  'active',
  'is_combo',
  'sort_order',
  'stock_tracking_enabled',
  'stock_quantity',
  'physical_stock_quantity',
  'beach_stock_quantity',
  'blocked_by_stock',
]);

function productWriteErrorResponse(error: any) {
  console.error('Product write error:', {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });

  if (['42P01', 'PGRST205'].includes(error?.code || '')) {
    return NextResponse.json({
      error: 'Tabela products nao encontrada. Rode infra/sql-atualizacao-controle-estoque-produtos.sql no Supabase.',
      code: error?.code,
    }, { status: 500 });
  }

  if (['42703', 'PGRST204'].includes(error?.code || '')) {
    return NextResponse.json({
      error: `Schema de products desatualizado: ${error.message}. Rode infra/sql-atualizacao-controle-estoque-produtos.sql no Supabase.`,
      code: error?.code,
    }, { status: 500 });
  }

  if (error?.code === '42501') {
    return NextResponse.json({
      error: 'Permissao insuficiente na tabela products. Rode infra/sql-atualizacao-controle-estoque-produtos.sql no Supabase para liberar edicao e exclusao.',
      code: error.code,
    }, { status: 500 });
  }

  return NextResponse.json({ error: error?.message || 'Erro interno ao salvar produto.' }, { status: 500 });
}

async function loadProductForWrite(req: NextRequest, id: string) {
  const tenantId = getTenantIdFromRequest(req);
  let query = supabaseAdmin
    .from('products')
    .select('id, vendor_id, tenant_id')
    .eq('id', id);
  if (tenantId) query = enforceTenantScope(query, tenantId);
  return query.single();
}

function assertProductAccess(session: any, product: any) {
  if (!session || (session.role !== 'vendor' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
  }
  if (session.role === 'vendor' && session.vendor_id !== product.vendor_id) {
    return NextResponse.json({ error: 'Acesso negado para este produto.' }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    const { id } = await params;
    const body = await req.json();

    const productLookup = await loadProductForWrite(req, id);
    if (productLookup.error && ['42P01', 'PGRST205', '42703', 'PGRST204', '42501'].includes(productLookup.error.code || '')) {
      return productWriteErrorResponse(productLookup.error);
    }
    if (productLookup.error || !productLookup.data) {
      return NextResponse.json({ error: 'Produto nao encontrado.' }, { status: 404 });
    }
    const accessError = assertProductAccess(session, productLookup.data);
    if (accessError) return accessError;

    const safeUpdate: Record<string, unknown> = {};
    for (const field of ALLOWED_PRODUCT_FIELDS) {
      if (field in body) safeUpdate[field] = body[field];
    }
    if ('stock_tracking_enabled' in body || 'stock_quantity' in body || 'physical_stock_quantity' in body || 'beach_stock_quantity' in body || 'blocked_by_stock' in body) {
      Object.assign(safeUpdate, normalizeProductStockForWrite(body));
    }
    if (Object.keys(safeUpdate).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo valido para atualizar.' }, { status: 400 });
    }

    const result = await (supabaseAdmin.from('products') as any)
      .update({ ...safeUpdate, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', productLookup.data.tenant_id)
      .select()
      .single();

    if (result?.error) throw result.error;
    return NextResponse.json({
      ...result.data,
      image_url: normalizeRenderableProductImageUrl(result.data?.image_url),
    });
  } catch (err) {
    return productWriteErrorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    const { id } = await params;

    const productLookup = await loadProductForWrite(req, id);
    if (productLookup.error && ['42P01', 'PGRST205', '42703', 'PGRST204', '42501'].includes(productLookup.error.code || '')) {
      return productWriteErrorResponse(productLookup.error);
    }
    if (productLookup.error || !productLookup.data) {
      return NextResponse.json({ error: 'Produto nao encontrado.' }, { status: 404 });
    }
    const accessError = assertProductAccess(session, productLookup.data);
    if (accessError) return accessError;

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id)
      .eq('tenant_id', productLookup.data.tenant_id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return productWriteErrorResponse(err);
  }
}
