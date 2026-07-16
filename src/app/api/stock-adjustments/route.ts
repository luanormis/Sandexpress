import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

const REASONS = new Set(['loss', 'internal_consumption', 'theft', 'breakage', 'expired', 'count_error', 'other']);

export async function GET(req: NextRequest) {
  try {
    const vendorId = new URL(req.url).searchParams.get('vendor_id') || '';
    const session = getRequestSession(req);
    if (!isCanonicalUuid(vendorId) || !canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }
    const { data, error } = await supabaseAdmin
      .from('analytics_events')
      .select('id, metadata, payload, created_at')
      .eq('vendor_id', vendorId)
      .eq('event_type', 'stock_adjustment')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const events = (data || []) as any[];
    const productIds = [...new Set(events.map(event => String(event.metadata?.product_id || '')).filter(isCanonicalUuid))];
    const userIds = [...new Set(events.map(event => String(event.metadata?.user_id || '')).filter(isCanonicalUuid))];
    const [{ data: products }, { data: users }] = await Promise.all([
      productIds.length ? supabaseAdmin.from('products').select('id, name, cost_price').eq('vendor_id', vendorId).in('id', productIds) : Promise.resolve({ data: [] as any[] }),
      userIds.length ? supabaseAdmin.from('vendor_users').select('id, name').eq('vendor_id', vendorId).in('id', userIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const productById = new Map((products || []).map((product: any) => [String(product.id), product]));
    const userById = new Map((users || []).map((user: any) => [String(user.id), String(user.name || 'Equipe')]));
    const items = events.map(event => {
      const metadata = event.metadata || {};
      const product = productById.get(String(metadata.product_id || '')) as any;
      const unitCost = Number(metadata.unit_cost ?? product?.cost_price ?? 0);
      const quantity = Number(metadata.quantity || 0);
      return {
        id: event.id,
        created_at: event.created_at,
        product_id: metadata.product_id,
        product_name: metadata.product_name || product?.name || 'Produto',
        reason: metadata.reason || 'other',
        location: metadata.location || 'beach',
        quantity,
        previous_quantity: Number(metadata.previous_quantity || 0),
        next_quantity: Number(metadata.next_quantity || 0),
        note: metadata.note || '',
        user_name: userById.get(String(metadata.user_id || '')) || 'Responsavel do quiosque',
        unit_cost: unitCost,
        estimated_cost: Number(metadata.estimated_cost ?? unitCost * quantity),
      };
    });
    const summary = items.reduce((acc: Record<string, { quantity: number; estimated_cost: number }>, item) => {
      if (!acc[item.reason]) acc[item.reason] = { quantity: 0, estimated_cost: 0 };
      acc[item.reason].quantity += item.quantity;
      acc[item.reason].estimated_cost += item.estimated_cost;
      return acc;
    }, {});
    return NextResponse.json({ items, summary, total_quantity: items.reduce((sum, item) => sum + item.quantity, 0), total_estimated_cost: items.reduce((sum, item) => sum + item.estimated_cost, 0) });
  } catch (error) {
    console.error('Stock adjustments GET error:', error);
    return NextResponse.json({ error: 'Erro ao consultar movimentacoes.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const productId = String(body.product_id || '');
    const reason = String(body.reason || '');
    const location = body.location === 'physical' ? 'physical' : 'beach';
    const quantity = Number(body.quantity);
    const note = String(body.note || '').trim().slice(0, 500);
    const session = getRequestSession(req);
    if (!isCanonicalUuid(vendorId) || !isCanonicalUuid(productId) || !canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }
    if (!REASONS.has(reason) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      return NextResponse.json({ error: 'Informe produto, quantidade e motivo validos.' }, { status: 400 });
    }
    if (!note) return NextResponse.json({ error: 'A justificativa detalhada e obrigatoria.' }, { status: 400 });

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, tenant_id, vendor_id, name, cost_price, stock_tracking_enabled, physical_stock_quantity, beach_stock_quantity, stock_quantity')
      .eq('id', productId)
      .eq('vendor_id', vendorId)
      .single();
    if (productError || !product) return NextResponse.json({ error: 'Produto nao encontrado.' }, { status: 404 });
    if (!product.stock_tracking_enabled) return NextResponse.json({ error: 'Ative o controle de estoque deste produto primeiro.' }, { status: 409 });

    const current = location === 'physical'
      ? Number(product.physical_stock_quantity || 0)
      : Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0);
    if (quantity > current) return NextResponse.json({ error: `Quantidade maior que o estoque atual (${current}).` }, { status: 409 });
    const next = current - quantity;
    const update = location === 'physical'
      ? { physical_stock_quantity: next, updated_at: new Date().toISOString() }
      : { beach_stock_quantity: next, stock_quantity: next, blocked_by_stock: next <= 0, updated_at: new Date().toISOString() };
    const { error: updateError } = await supabaseAdmin.from('products').update(update as any).eq('id', productId).eq('vendor_id', vendorId);
    if (updateError) throw updateError;

    const { data: event, error: eventError } = await supabaseAdmin.from('analytics_events').insert({
      tenant_id: product.tenant_id,
      vendor_id: vendorId,
      event_type: 'stock_adjustment',
      metadata: { product_id: productId, product_name: product.name, reason, location, quantity, previous_quantity: current, next_quantity: next, note, user_id: session?.user_id || null, unit_cost: Number(product.cost_price || 0), estimated_cost: Number(product.cost_price || 0) * quantity },
      payload: { source: 'vendor_dashboard' },
    } as any).select('id, metadata, created_at').single();
    if (eventError) throw eventError;
    return NextResponse.json({ success: true, event, stock_quantity: next });
  } catch (error) {
    console.error('Stock adjustments POST error:', error);
    return NextResponse.json({ error: 'Erro ao registrar a baixa de estoque.' }, { status: 500 });
  }
}
