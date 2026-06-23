import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession, canAccessVendor } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';
import { closeBeachStockToPhysical, openBeachStockFromPhysical, toStock } from '@/lib/inventory';

/**
 * PUT /api/stock
 * Atualizar estoque de produtos (abertura do dia)
 *
 * Body: { vendor_id, mode: 'open'|'close'|'set_physical', updates: [{ product_id, stock_quantity, physical_stock_quantity, stock_tracking_enabled }] }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || (session.role !== 'vendor' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não identificado.' }, { status: 400 });
    }

    const { vendor_id: rawVendorId, updates, mode = 'open' } = await req.json();
    const vendor_id = rawVendorId || session.vendor_id;

    if (!vendor_id || !updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'vendor_id e updates (array) são obrigatórios' },
        { status: 400 }
      );
    }

    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    const productIds = updates.map((update: any) => update.product_id).filter(Boolean);
    const { data: currentProducts, error: currentError } = await supabaseAdmin
      .from('products')
      .select('id, stock_tracking_enabled, physical_stock_quantity, beach_stock_quantity, stock_quantity')
      .eq('vendor_id', vendor_id)
      .in('id', productIds);
    if (currentError) throw currentError;
    const currentMap = new Map((currentProducts || []).map((product: any) => [product.id, product]));

    const results = [];
    for (const update of updates) {
      const { product_id } = update;
      const current = currentMap.get(product_id) as any;
      if (!current) {
        results.push({ product_id, success: false, error: 'Produto nao encontrado.' });
        continue;
      }

      const stockTrackingEnabled = update.stock_tracking_enabled ?? current.stock_tracking_enabled ?? false;
      let payload: Record<string, unknown> = {
        stock_tracking_enabled: stockTrackingEnabled,
        updated_at: new Date().toISOString(),
      };

      if (!stockTrackingEnabled) {
        payload = {
          ...payload,
          physical_stock_quantity: 0,
          beach_stock_quantity: 0,
          stock_quantity: null,
          blocked_by_stock: false,
        };
      } else if (mode === 'close') {
        const next = closeBeachStockToPhysical({
          physicalStock: current.physical_stock_quantity,
          beachStock: current.beach_stock_quantity ?? current.stock_quantity,
        });
        payload = {
          ...payload,
          physical_stock_quantity: next.physicalStock,
          beach_stock_quantity: next.beachStock,
          stock_quantity: next.beachStock,
          blocked_by_stock: next.blockedByStock,
        };
      } else if (mode === 'set_physical') {
        const physicalStock = toStock(update.physical_stock_quantity ?? update.stock_quantity);
        payload = {
          ...payload,
          physical_stock_quantity: physicalStock,
          blocked_by_stock: Number(current.beach_stock_quantity ?? current.stock_quantity ?? 0) <= 0,
        };
      } else {
        const next = openBeachStockFromPhysical({
          physicalStock: current.physical_stock_quantity,
          beachStock: current.beach_stock_quantity ?? current.stock_quantity,
          openingQuantity: update.stock_quantity,
        });
        payload = {
          ...payload,
          physical_stock_quantity: next.physicalStock,
          beach_stock_quantity: next.beachStock,
          stock_quantity: next.beachStock,
          blocked_by_stock: next.blockedByStock,
        };
      }

      const { error } = await enforceTenantScope(
        supabaseAdmin
          .from('products')
          .update(payload)
          .eq('id', product_id)
          .eq('vendor_id', vendor_id),
        tenantId
      );

      if (!error) {
        results.push({ product_id, success: true });
      } else {
        results.push({ product_id, success: false, error: error.message });
      }
    }

    return NextResponse.json({
      vendor_id,
      updated_count: results.filter((r) => r.success).length,
      results,
    });
  } catch (err) {
    console.error('Stock PUT error:', err);
    return NextResponse.json({ error: 'Erro ao atualizar estoque' }, { status: 500 });
  }
}

/**
 * GET /api/stock?vendor_id=xxx
 * Obter estoque atual dos produtos
 */
export async function GET(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || (session.role !== 'vendor' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id') || session.vendor_id;

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório' }, { status: 400 });
    }
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, name, category, price, stock_tracking_enabled, physical_stock_quantity, beach_stock_quantity, stock_quantity, blocked_by_stock, active')
      .eq('vendor_id', vendor_id)
      .eq('active', true)
      .order('sort_order');

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Stock GET error:', err);
    return NextResponse.json({ error: 'Erro ao obter estoque' }, { status: 500 });
  }
}
