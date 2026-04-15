import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

function normalizePhone(p: string) {
  return p.replace(/\D/g, '');
}

type OrderWithCustomer = {
  id: string;
  customer_id: string;
  umbrella_id: string;
  total: number;
  status: string;
  pending_close: boolean;
  created_at: string;
  customers?: { id: string; name: string; phone: string } | null;
};

type OrderPreview = {
  id: string;
  customer_id: string;
  umbrella_id: string;
  total: number;
  status: string;
  pending_close: boolean;
  created_at: string;
  order_items?: { id: string }[] | null;
  customers?: { id: string; name: string; phone: string } | null;
};

/**
 * POST /api/close-account
 * Dois fluxos:
 *   - Cliente (role=customer): marca pending_close=true (solicitação).
 *   - Quiosque (role=vendor/admin): confirma fechamento, libera guarda-sol.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendor_id, umbrella_id, customer_phone, payment_method, notes } = body;

    if (!vendor_id || (!umbrella_id && !customer_phone)) {
      return NextResponse.json(
        { error: 'vendor_id e (umbrella_id ou customer_phone) são obrigatórios' },
        { status: 400 }
      );
    }

    const session = getRequestSession(req);
    const isVendor = canAccessVendor(session, vendor_id);
    const isCustomer = session?.role === 'customer' && session.vendor_id === vendor_id;

    if (!isVendor && !isCustomer) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    }

    // Validação extra: cliente só pode fechar sua própria conta
    if (isCustomer && !isVendor) {
      const { data: cust } = await supabaseAdmin
        .from('customers')
        .select('id, phone')
        .eq('id', session!.customer_id!)
        .eq('vendor_id', vendor_id)
        .single();
      if (!cust || (customer_phone && normalizePhone(cust.phone) !== normalizePhone(customer_phone))) {
        return NextResponse.json({ error: 'Não autorizado para esta conta.' }, { status: 403 });
      }
    }

    // Encontrar a ordem aberta
    let query = supabaseAdmin
      .from('orders')
      .select('id, customer_id, umbrella_id, total, status, pending_close, created_at, customers(id, name, phone)')
      .eq('vendor_id', vendor_id)
      .in('status', ['received', 'preparing', 'delivering'])
      .order('created_at', { ascending: true });

    if (umbrella_id) query = query.eq('umbrella_id', umbrella_id);

    const { data: orders, error: ordersErr } = await query;
    if (ordersErr) throw ordersErr;

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma conta aberta encontrada.' },
        { status: 404 }
      );
    }

    const orderRows = orders as unknown as OrderWithCustomer[];
    let selectedOrder = orderRows[0];

    if (customer_phone && orderRows.length > 1) {
      const match = orderRows.find(o =>
        normalizePhone(o.customers?.phone || '') === normalizePhone(customer_phone)
      );
      if (match) selectedOrder = match;
    }

    // Fluxo CLIENTE: apenas sinaliza pending_close
    if (isCustomer && !isVendor) {
      await supabaseAdmin
        .from('orders')
        .update({ pending_close: true, updated_at: new Date().toISOString() })
        .eq('id', selectedOrder.id);

      return NextResponse.json({
        success: true,
        pending: true,
        message: 'Solicitação de fechamento enviada. Aguarde a confirmação do quiosque.',
      });
    }

    // Fluxo QUIOSQUE/ADMIN: confirma fechamento e libera guarda-sol
    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'completed',
        paid: true,
        pending_close: false,
        payment_method: payment_method || 'cash',
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedOrder.id);

    if (updateErr) throw updateErr;

    // Liberar guarda-sol
    await supabaseAdmin
      .from('umbrellas')
      .update({ is_occupied: false, current_order_id: null })
      .eq('id', selectedOrder.umbrella_id);

    // NÃO incrementa visit_count aqui (feito apenas no login)

    return NextResponse.json(
      {
        success: true,
        order: {
          id: selectedOrder.id,
          customer_name: selectedOrder.customers?.name,
          customer_phone: selectedOrder.customers?.phone,
          umbrella_id: selectedOrder.umbrella_id,
          total: selectedOrder.total,
          status: 'completed',
          paid: true,
          payment_method: payment_method || 'cash',
          closed_at: new Date().toISOString(),
        },
        message: `Conta fechada com sucesso! Guarda-sol liberado.`,
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
 * Buscar conta aberta (preview) — apenas vendor/admin.
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
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }
    if (!umbrella_id && !customer_phone) {
      return NextResponse.json({ error: 'umbrella_id ou customer_phone obrigatório' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('orders')
      .select('id, customer_id, umbrella_id, total, status, pending_close, created_at, order_items(id), customers(id, name, phone)')
      .eq('vendor_id', vendor_id)
      .in('status', ['received', 'preparing', 'delivering']);

    if (umbrella_id) query = query.eq('umbrella_id', umbrella_id);

    const { data: orders, error } = await query;
    if (error) throw error;

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'Nenhuma conta aberta encontrada' }, { status: 404 });
    }

    const orderRows = orders as unknown as OrderPreview[];
    let selectedOrder = orderRows[0];

    if (customer_phone && orderRows.length > 1) {
      const cleanPhone = normalizePhone(customer_phone);
      const matching = orderRows.find(o =>
        normalizePhone(o.customers?.phone || '') === cleanPhone
      );
      if (matching) selectedOrder = matching;
    }

    return NextResponse.json({
      order_id: selectedOrder.id,
      customer_id: selectedOrder.customer_id,
      customer_name: selectedOrder.customers?.name,
      customer_phone: selectedOrder.customers?.phone,
      umbrella_id: selectedOrder.umbrella_id,
      total: selectedOrder.total,
      pending_close: selectedOrder.pending_close,
      items_count: selectedOrder.order_items?.length ?? 0,
      opened_at: selectedOrder.created_at,
    });
  } catch (err) {
    console.error('Close account GET error:', err);
    return NextResponse.json({ error: 'Erro ao buscar conta' }, { status: 500 });
  }
}
