import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { featureDisabledResponse, vendorFeatureEnabled } from '@/lib/features';

const OPEN_ACCOUNT_STATUSES = ['received', 'preparing', 'delivering', 'completed', 'closing_requested'];

function toMoney(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Number(numeric.toFixed(2)) : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * POST /api/close-account
 * Fechar conta do cliente (após pagamento confirmado)
 * 
 * Body: {
 *   vendor_id,
 *   umbrella_id OR (customer_phone),
 *   payment_method (optional),
 *   notes (optional)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      vendor_id,
      umbrella_id,
      customer_phone,
      payment_method,
      notes,
      request_only,
      payment_amount,
      service_fee_amount,
      service_fee_enabled,
      split_people,
      split_mode,
    } = body;

    if (!vendor_id || (!umbrella_id && !customer_phone)) {
      return NextResponse.json(
        { error: 'vendor_id e (umbrella_id ou customer_phone) são obrigatórios' },
        { status: 400 }
      );
    }

    const session = getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }
    if (session.role === 'vendor' || session.role === 'admin') {
      if (!canAccessVendor(session, vendor_id)) {
        return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
      }
    } else if (session.role === 'customer' && session.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Sessao de cliente invalida para este quiosque.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendor_id, 'cashier')) {
      return NextResponse.json(featureDisabledResponse('cashier'), { status: 403 });
    }

    // 1. Encontrar a ordem aberta
    let query = supabaseAdmin
      .from('orders')
      .select('id, customer_id, umbrella_id, total, status, created_at, customers(id, name, phone)')
      .eq('vendor_id', vendor_id)
      .in('status', OPEN_ACCOUNT_STATUSES)
      .eq('paid', false)
      .order('created_at', { ascending: true });

    if (umbrella_id) {
      query = query.eq('umbrella_id', umbrella_id);
    }

    const { data: orders, error: ordersErr } = await query;

    if (ordersErr) throw ordersErr;

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma conta aberta encontrada para este guarda-sol/cliente' },
        { status: 404 }
      );
    }

    // Se houver múltiplas contas abertas, filtrar por customer_phone se fornecido
    let selectedOrder = orders[0];
    if (customer_phone && orders.length > 1) {
      const matchingOrder = orders.find((o: any) => {
        const cleanPhone = (o.customers?.phone || '').replace(/\D/g, '');
        const cleanInput = customer_phone.replace(/\D/g, '');
        return cleanPhone === cleanInput;
      });
      if (matchingOrder) {
        selectedOrder = matchingOrder;
      }
    }

    if (session.role === 'customer' && selectedOrder.customer_id !== session.customer_id) {
      return NextResponse.json({ error: 'Conta nao pertence a este cliente.' }, { status: 403 });
    }

    if (request_only) {
      const paymentAmount = toMoney(payment_amount);
      const serviceFeeAmount = toMoney(service_fee_amount);
      const splitPeople = Math.max(1, Math.min(50, Number(split_people || 1)));
      const requestedTotal = Number(selectedOrder.total || 0) + serviceFeeAmount;
      const remainingAmount = Math.max(requestedTotal - paymentAmount, 0);
      const closeSummary = [
        notes || 'Fechamento solicitado pelo cliente',
        '--- Resumo solicitado pelo cliente ---',
        `Valor da conta: ${formatMoney(Number(selectedOrder.total || 0))}`,
        `10% do garcom: ${service_fee_enabled === false ? 'dispensado' : formatMoney(serviceFeeAmount)}`,
        `Total com ajustes: ${formatMoney(requestedTotal)}`,
        split_mode === 'split'
          ? `Divisao: ${splitPeople} pessoas - ${formatMoney(requestedTotal / splitPeople)} por pessoa`
          : split_mode === 'custom'
            ? `Pagamento parcial solicitado: ${formatMoney(paymentAmount)}`
            : `Pagamento integral solicitado: ${formatMoney(requestedTotal)}`,
        remainingAmount > 0 ? `Saldo restante apos este pagamento: ${formatMoney(remainingAmount)}` : 'Pagamento cobre o total solicitado',
      ].join('\n');
      const { data: requested, error: requestErr } = await supabaseAdmin
        .from('orders')
        .update({
          status: 'closing_requested',
          close_requested_at: new Date().toISOString(),
          notes: closeSummary,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', selectedOrder.id)
        .select()
        .single();

      if (requestErr) throw requestErr;
      return NextResponse.json({
        success: true,
        order: requested,
        message: 'Pedido de fechamento enviado ao quiosque.',
      });
    }

    // 2. Atualizar ordem para completed e pago
    const { error: updateErr } = await supabaseAdmin
      .from('orders')
        .update({
          status: 'completed',
          paid: true,
          payment_method: payment_method || 'cash',
          paid_at: new Date().toISOString(),
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
      .eq('id', selectedOrder.id);

    if (updateErr) throw updateErr;

    if (selectedOrder.umbrella_id) {
      const { error: umbrellaErr } = await supabaseAdmin
        .from('umbrellas')
        .update({
          is_occupied: false,
          current_order_id: null,
        })
        .eq('id', selectedOrder.umbrella_id)
        .eq('vendor_id', vendor_id);

      if (umbrellaErr) throw umbrellaErr;
    }

    // 3. Atualizar statistics do cliente (visit_count, last_visit_at)
    const { error: customerErr } = await supabaseAdmin
      .from('customers')
      .update({
        visit_count: (selectedOrder as any).customers?.visit_count ? (selectedOrder as any).customers.visit_count + 1 : 1,
        last_visit_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedOrder.customer_id);

    if (customerErr) throw customerErr;

    return NextResponse.json(
      {
        success: true,
        order: {
          id: selectedOrder.id,
          customer_id: selectedOrder.customer_id,
          customer_name: (selectedOrder as any).customers?.name,
          customer_phone: (selectedOrder as any).customers?.phone,
          umbrella_id: selectedOrder.umbrella_id,
          total: selectedOrder.total,
          status: 'completed',
          paid: true,
          payment_method: payment_method || 'cash',
          closed_at: new Date().toISOString(),
        },
        message: `Conta fechada com sucesso! Guarda-sol ${selectedOrder.umbrella_id} liberado.`,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Close account error:', err);
    return NextResponse.json({ error: 'Erro ao fechar conta' }, { status: 500 });
  }
}

/**
 * GET /api/close-account?vendor_id=xxx&umbrella_id=yyy
 * Buscar conta aberta para fechar (preview)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');
    const umbrella_id = searchParams.get('umbrella_id');
    const customer_phone = searchParams.get('customer_phone');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório' }, { status: 400 });
    }

    if (!umbrella_id && !customer_phone) {
      return NextResponse.json({ error: 'umbrella_id ou customer_phone obrigatório' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendor_id, 'cashier')) {
      return NextResponse.json(featureDisabledResponse('cashier'), { status: 403 });
    }

    // Buscar ordem aberta
    let query = supabaseAdmin
      .from('orders')
      .select('id, customer_id, umbrella_id, total, status, created_at, order_items(id), customers(id, name, phone)')
      .eq('vendor_id', vendor_id)
      .in('status', OPEN_ACCOUNT_STATUSES)
      .eq('paid', false);

    if (umbrella_id) {
      query = query.eq('umbrella_id', umbrella_id);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma conta aberta encontrada' },
        { status: 404 }
      );
    }

    // Se houver múltiplas, filtrar por phone
    let selectedOrder = orders[0];
    if (customer_phone && orders.length > 1) {
      const cleanPhone = customer_phone.replace(/\D/g, '');
      const matching = orders.find((o: any) => {
        const orderPhone = (o.customers?.phone || '').replace(/\D/g, '');
        return orderPhone === cleanPhone;
      });
      if (matching) selectedOrder = matching;
    }

    return NextResponse.json({
      order_id: selectedOrder.id,
      customer_id: selectedOrder.customer_id,
      customer_name: (selectedOrder as any).customers?.name,
      customer_phone: (selectedOrder as any).customers?.phone,
      umbrella_id: selectedOrder.umbrella_id,
      total: selectedOrder.total,
      items_count: (selectedOrder as any).order_items ? (selectedOrder as any).order_items.length : 0,
      created_at: selectedOrder.created_at,
      opened_at: selectedOrder.created_at,
    });
  } catch (err) {
    console.error('Close account GET error:', err);
    return NextResponse.json({ error: 'Erro ao buscar conta' }, { status: 500 });
  }
}
