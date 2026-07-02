import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { toMoney } from '@/lib/payments';

function cancellationError(message = 'Nao foi possivel cancelar o item.', status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session) return cancellationError('Nao autenticado.', 401);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason || 'Cancelado pela gestao do quiosque').trim().slice(0, 300);

    const { data: item, error: itemError } = await supabaseAdmin
      .from('order_items')
      .select('id, tenant_id, order_id, order_request_id, product_id, quantity, subtotal, cancelled')
      .eq('id', id)
      .single();

    if (itemError || !item) return cancellationError('Item nao encontrado.', 404);
    if ((item as any).cancelled) return cancellationError('Item ja cancelado.', 409);

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, tenant_id, vendor_id, customer_id, total, gross_total, paid, status')
      .eq('id', (item as any).order_id)
      .single();

    if (orderError || !order) return cancellationError('Comanda nao encontrada.', 404);
    if (!canAccessVendor(session, (order as any).vendor_id)) {
      return cancellationError('Nao autorizado para esta comanda.', 403);
    }
    if ((order as any).paid) {
      return cancellationError('Nao da para cancelar item de conta ja paga. Reabra uma nova conta para ajustes.', 409);
    }

    const refundAmount = toMoney((item as any).subtotal);
    const quantity = Math.max(0, Number((item as any).quantity || 0));
    const nextTotal = toMoney(Number((order as any).total || 0) - refundAmount);
    const nextGrossTotal = toMoney(Number((order as any).gross_total || (order as any).total || 0) - refundAmount);
    const now = new Date().toISOString();

    const { data: updatedItem, error: updateItemError } = await supabaseAdmin
      .from('order_items')
      .update({
        cancelled: true,
        cancelled_at: now,
        cancelled_by: session.role,
        cancel_reason: reason,
      } as any)
      .eq('id', id)
      .eq('cancelled', false)
      .select()
      .single();

    if (updateItemError || !updatedItem) {
      return cancellationError('Item ja foi cancelado ou nao pode ser atualizado.', 409);
    }

    const { error: orderUpdateError } = await supabaseAdmin
      .from('orders')
      .update({
        total: nextTotal,
        gross_total: nextGrossTotal,
        updated_at: now,
      } as any)
      .eq('id', (order as any).id);
    if (orderUpdateError) throw orderUpdateError;

    if ((order as any).customer_id) {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('total_spent')
        .eq('id', (order as any).customer_id)
        .maybeSingle();

      if (customer) {
        await supabaseAdmin
          .from('customers')
          .update({
            total_spent: toMoney(Number((customer as any).total_spent || 0) - refundAmount),
            updated_at: now,
          } as any)
          .eq('id', (order as any).customer_id);
      }
    }

    if ((item as any).order_request_id) {
      const { data: requestRow } = await supabaseAdmin
        .from('customer_order_requests')
        .select('subtotal')
        .eq('id', (item as any).order_request_id)
        .maybeSingle();

      if (requestRow) {
        await supabaseAdmin
          .from('customer_order_requests')
          .update({
            subtotal: toMoney(Number((requestRow as any).subtotal || 0) - refundAmount),
            updated_at: now,
          } as any)
          .eq('id', (item as any).order_request_id);
      }
    }

    if ((item as any).product_id && quantity > 0) {
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('id, stock_tracking_enabled, stock_quantity, beach_stock_quantity')
        .eq('id', (item as any).product_id)
        .maybeSingle();

      if ((product as any)?.stock_tracking_enabled) {
        const nextBeachStock = Number((product as any).beach_stock_quantity ?? (product as any).stock_quantity ?? 0) + quantity;
        await supabaseAdmin
          .from('products')
          .update({
            beach_stock_quantity: nextBeachStock,
            stock_quantity: nextBeachStock,
            blocked_by_stock: false,
            updated_at: now,
          } as any)
          .eq('id', (item as any).product_id);
      }
    }

    await supabaseAdmin.from('account_adjustments').insert({
      tenant_id: (order as any).tenant_id,
      vendor_id: (order as any).vendor_id,
      customer_id: (order as any).customer_id,
      order_id: (order as any).id,
      adjustment_type: 'cancellation',
      description: 'Cancelamento de item da comanda',
      amount: refundAmount,
      reason,
      processed_by: session.role,
      password_verified: false,
    } as any);

    return NextResponse.json({
      success: true,
      item: updatedItem,
      order_id: (order as any).id,
      total: nextTotal,
      gross_total: nextGrossTotal,
    });
  } catch (err) {
    console.error('Order item cancellation error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
