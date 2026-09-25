import { clampDeliveredQuantity, latestDeliveredQuantities } from '@/lib/partial-delivery';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }

    const { id } = await params;
    const vendorId = new URL(req.url).searchParams.get('vendor_id') || session.vendor_id;

    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, vendor_id')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Cliente nao encontrado.' }, { status: 404 });
    }
    if (vendorId && customer.vendor_id !== vendorId) {
      return NextResponse.json({ error: 'Cliente nao pertence a este quiosque.' }, { status: 403 });
    }
    if (session.role === 'customer' && session.customer_id !== id) {
      return NextResponse.json({ error: 'Nao autorizado para este cliente.' }, { status: 403 });
    }
    if (session.role !== 'customer' && !canAccessVendor(session, customer.vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este cliente.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, total, status, created_at, order_items(id, order_request_id, quantity, unit_price, subtotal, cancelled, products(name)), customer_order_requests(id, sequence, subtotal, status, created_at)')
      .eq('customer_id', id)
      .eq('vendor_id', customer.vendor_id)
      .eq('paid', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const enriched = await Promise.all((data || []).map(async (order: any) => {
      const events: any[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: batch, error: deliveryError } = await supabaseAdmin.from('analytics_events')
          .select('metadata, created_at').eq('vendor_id', customer.vendor_id)
          .eq('event_type', 'order_item_delivery').contains('metadata', { order_id: order.id })
          .order('created_at', { ascending: true }).range(offset, offset + 999);
        if (deliveryError) throw deliveryError;
        events.push(...(batch || []));
        if (!batch || batch.length < 1000) break;
      }
      const delivered = latestDeliveredQuantities(events);
      return { ...order, items: (order.order_items || []).map((item: any) => ({
        id: item.id, order_request_id: item.order_request_id, name: item.products?.name || 'Produto',
        quantity: Number(item.quantity), unit_price: Number(item.unit_price), subtotal: Number(item.subtotal),
        cancelled: Boolean(item.cancelled), delivered_quantity: clampDeliveredQuantity(delivered[item.id] ?? ((order.customer_order_requests || []).find((request: any) => request.id === item.order_request_id)?.status === 'completed' || order.status === 'completed' ? item.quantity : 0), item.quantity),
      })) };
    }));
    const orderLines = enriched.flatMap((order: any) => {
      const requests = Array.isArray(order.customer_order_requests) ? order.customer_order_requests : [];
      if (requests.length === 0) return [order];
      return requests
        .sort((a: any, b: any) => Number(b.sequence || 0) - Number(a.sequence || 0))
        .map((request: any, index: number) => ({
          items: order.items.filter((item: any) => item.order_request_id === request.id || (!requests.some((entry: any) => entry.id === item.order_request_id) && index === 0)),
          id: request.id,
          account_id: order.id,
          sequence: request.sequence,
          total: Number(request.subtotal || 0),
          account_total: Number(order.total || 0),
          status: request.status || order.status,
          account_status: order.status,
          created_at: request.created_at || order.created_at,
        }));
    });
    return NextResponse.json(orderLines);
  } catch (err) {
    console.error('Customer orders error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
