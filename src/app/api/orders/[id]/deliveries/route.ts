import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { clampDeliveredQuantity, latestDeliveredQuantities } from '@/lib/partial-delivery';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

async function loadOrder(id: string) {
  const { data } = await supabaseAdmin.from('orders').select('id, tenant_id, vendor_id, customer_id, umbrella_id, paid').eq('id', id).maybeSingle();
  return data as any;
}

async function loadDeliveries(orderId: string, vendorId: string) {
  const { data, error } = await supabaseAdmin.from('analytics_events')
    .select('metadata, created_at').eq('vendor_id', vendorId).eq('event_type', 'order_item_delivery')
    .contains('metadata', { order_id: orderId }).order('created_at', { ascending: true }).limit(1000);
  if (error) throw error;
  return latestDeliveredQuantities((data || []) as any);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getRequestSession(req);
  const { id } = await params;
  const order = isCanonicalUuid(id) ? await loadOrder(id) : null;
  if (!order || !canAccessVendor(session, order.vendor_id)) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
  return NextResponse.json({ delivered: await loadDeliveries(id, order.vendor_id) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getRequestSession(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const itemId = String(body.order_item_id || '');
    const order = isCanonicalUuid(id) ? await loadOrder(id) : null;
    if (!order || !session || !['vendor', 'admin'].includes(session.role) || !canAccessVendor(session, order.vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }
    if (order.paid) return NextResponse.json({ error: 'A conta ja foi encerrada.' }, { status: 409 });
    if (!isCanonicalUuid(itemId)) return NextResponse.json({ error: 'Item invalido.' }, { status: 400 });

    const { data: item } = await supabaseAdmin.from('order_items').select('id, quantity').eq('id', itemId).eq('order_id', id).maybeSingle();
    if (!item) return NextResponse.json({ error: 'Item nao pertence a este pedido.' }, { status: 404 });
    const deliveredQuantity = clampDeliveredQuantity(body.delivered_quantity, item.quantity);
    const { error } = await supabaseAdmin.from('analytics_events').insert({
      tenant_id: order.tenant_id, vendor_id: order.vendor_id, customer_id: order.customer_id,
      umbrella_id: order.umbrella_id, event_type: 'order_item_delivery',
      metadata: { order_id: id, order_item_id: itemId, delivered_quantity: deliveredQuantity, ordered_quantity: Number(item.quantity) },
      payload: { updated_by: session.user_id || session.role },
    } as any);
    if (error) throw error;
    return NextResponse.json({ delivered: await loadDeliveries(id, order.vendor_id) });
  } catch (error) {
    console.error('Partial delivery error:', error);
    return NextResponse.json({ error: 'Nao foi possivel registrar a entrega parcial.' }, { status: 500 });
  }
}

