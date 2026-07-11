import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { featureDisabledResponse, vendorFeatureEnabled } from '@/lib/features';
import { toMoney } from '@/lib/payments';

const OPEN_ACCOUNT_STATUSES = ['received', 'preparing', 'delivering', 'completed', 'closing_requested'];

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function closeAccountErrorResponse(error: any) {
  const message = String(error?.message || error || 'Erro ao fechar conta');
  const lower = message.toLowerCase();
  if (lower.includes('nao pertence') || lower.includes('nao autorizado')) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (lower.includes('nenhuma conta aberta') || lower.includes('nao encontrado')) {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  if (lower.includes('ja foi fechada')) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return NextResponse.json({ error: 'Erro ao fechar conta' }, { status: 500 });
}

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
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    if (session.role === 'vendor' || session.role === 'admin') {
      if (!canAccessVendor(session, vendor_id)) {
        return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
      }
    } else if (session.role === 'customer' && session.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Sessão de cliente inválida para este quiosque.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendor_id, 'cashier')) {
      return NextResponse.json(featureDisabledResponse('cashier'), { status: 403 });
    }

    if (umbrella_id) {
      const { data: openOrder, error: openOrderError } = await supabaseAdmin
        .from('orders')
        .select('id, total, order_items(id)')
        .eq('vendor_id', vendor_id)
        .eq('umbrella_id', umbrella_id)
        .in('status', OPEN_ACCOUNT_STATUSES)
        .eq('paid', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openOrderError) throw openOrderError;
      const itemCount = Array.isArray((openOrder as any)?.order_items) ? (openOrder as any).order_items.length : 0;
      if (openOrder && (Number((openOrder as any).total || 0) <= 0 || itemCount === 0)) {
        return NextResponse.json({
          error: 'Comanda vazia não pode ir para fechamento. Use "Liberar guarda-sol vazio".',
        }, { status: 409 });
      }
    }

    let requestNotes = notes || null;
    if (request_only) {
      const paymentAmount = toMoney(payment_amount);
      const serviceFeeAmount = toMoney(service_fee_amount);
      const splitPeople = Math.max(1, Math.min(50, Number(split_people || 1)));
      requestNotes = [
        notes || 'Fechamento solicitado pelo cliente',
        '--- Resumo solicitado pelo cliente ---',
        `10% do garçom: ${service_fee_enabled === false ? 'dispensado' : formatMoney(serviceFeeAmount)}`,
        split_mode === 'split'
          ? `Divisão: ${splitPeople} pessoas`
          : split_mode === 'custom'
            ? `Pagamento parcial solicitado: ${formatMoney(paymentAmount)}`
            : 'Pagamento integral solicitado',
      ].join('\n');
    }

    const { data: order, error: closeErr } = await supabaseAdmin.rpc('close_customer_account', {
      p_vendor_id: vendor_id,
      p_umbrella_id: umbrella_id || null,
      p_customer_phone: customer_phone || null,
      p_session_customer_id: session.role === 'customer' ? session.customer_id : null,
      p_request_only: Boolean(request_only),
      p_payment_method: payment_method || 'cash',
      p_notes: requestNotes,
    });

    if (closeErr) return closeAccountErrorResponse(closeErr);

    if (request_only) {
      return NextResponse.json({
        success: true,
        order,
        message: 'Pedido de fechamento enviado ao quiosque.',
      });
    }

    return NextResponse.json(
      {
        success: true,
        order,
        message: `Conta fechada com sucesso! Guarda-sol ${(order as any)?.umbrella_id || ''} liberado.`,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Close account error:', err);
    return NextResponse.json({ error: 'Erro ao fechar conta' }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendor_id, 'cashier')) {
      return NextResponse.json(featureDisabledResponse('cashier'), { status: 403 });
    }

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
