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
    return NextResponse.json(data || []);
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
      .select('id, tenant_id, vendor_id, name, stock_tracking_enabled, physical_stock_quantity, beach_stock_quantity, stock_quantity')
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
      metadata: { product_id: productId, product_name: product.name, reason, location, quantity, previous_quantity: current, next_quantity: next, note, user_id: session?.user_id || null },
      payload: { source: 'vendor_dashboard' },
    } as any).select('id, metadata, created_at').single();
    if (eventError) throw eventError;
    return NextResponse.json({ success: true, event, stock_quantity: next });
  } catch (error) {
    console.error('Stock adjustments POST error:', error);
    return NextResponse.json({ error: 'Erro ao registrar a baixa de estoque.' }, { status: 500 });
  }
}
