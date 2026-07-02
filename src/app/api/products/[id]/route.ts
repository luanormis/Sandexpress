import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';
import { isMissingProductStockColumnError, normalizeProductStockForWrite, removeProductStockFields } from '@/lib/product-stock';

const ALLOWED_PRODUCT_FIELDS = new Set([
  'name',
  'description',
  'price',
  'promotional_price',
  'category',
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

const OPTIONAL_PRODUCT_FIELDS = new Set([
  'is_default_image',
  'is_combo',
  'sort_order',
  'stock_tracking_enabled',
  'stock_quantity',
  'physical_stock_quantity',
  'beach_stock_quantity',
  'blocked_by_stock',
  'promotional_price',
]);

function missingColumnFromError(error: any) {
  if (!['42703', 'PGRST204'].includes(error?.code || '')) return null;
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  const quoted = message.match(/column "([^"]+)"/i) || message.match(/'([^']+)' column/i);
  if (quoted?.[1]) return quoted[1];
  return Array.from(OPTIONAL_PRODUCT_FIELDS).find((column) => message.includes(column)) || null;
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

    let currentUpdate: Record<string, unknown> = { ...safeUpdate, updated_at: new Date().toISOString() };
    let result: any = null;
    for (let attempt = 0; attempt < OPTIONAL_PRODUCT_FIELDS.size + 1; attempt += 1) {
      result = await (supabaseAdmin.from('products') as any)
        .update(currentUpdate)
        .eq('id', id)
        .eq('tenant_id', productLookup.data.tenant_id)
        .select()
        .single();

      if (!result.error) break;
      if (isMissingProductStockColumnError(result.error)) {
        currentUpdate = removeProductStockFields(currentUpdate);
        continue;
      }

      const missingColumn = missingColumnFromError(result.error);
      if (!missingColumn || !OPTIONAL_PRODUCT_FIELDS.has(missingColumn)) break;
      const { [missingColumn]: _removed, ...nextUpdate } = currentUpdate;
      currentUpdate = nextUpdate;
    }

    if (result?.error) throw result.error;
    return NextResponse.json(result.data);
  } catch (err) {
    console.error('Product PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
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
    console.error('Product DELETE error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
