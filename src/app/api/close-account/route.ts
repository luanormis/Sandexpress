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
  created_at: string;
  customers?: { id: string; name: string; phone: string; visit_count?: number } | null;
};

type OrderPreview = {
  id: string;
  customer_id: string;
  umbrella_id: string;
  total: number;
  status: string;
  created_at: string;
  order_items?: { id: string }[] | null;
  customers?: { id: string; name: string; phone: string } | null;
};

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
    const { vendor_id, umbrella_id, customer_phone, payment_method, notes } = body;

    if (!vendor_id || (!umbrella_id && !customer_phone)) {
      return NextResponse.json(
        { error: 'vendor_id e (umbrella_id ou customer_phone) são obrigatórios' },
        { status: 400 }
      );
    }
    const session = getRequestSession(req);
    const vendorOk = canAccessVendor(session, vendor_id);
    let customerOk = false;
    if (session?.role === 'customer' && session.vendor_id === vendor_id && session.customer_id && customer_phone) {
      const { data: cust } = await supabaseAdmin
        .from('customers')
        .select('id, phone')
        .eq('id', session.customer_id)
        .eq('vendor_id', vendor_id)
        .single();
      if (cust && normalizePhone(cust.phone) === normalizePhone(customer_phone)) {
        customerOk = true;
      }
    }
    if (!vendorOk && !customerOk) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    }

    // 1. Encontrar a ordem aberta
    let query = supabaseAdmin
      .from('orders')
      .select('id, customer_id, umbrella_id, total, status, created_at, customers(id, name, phone, visit_count)')
      .eq('vendor_id', vendor_id)
      .eq('status', 'received')
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

    const orderRows = orders as OrderWithCustomer[];

    // Se houver múltiplas contas abertas, filtrar por customer_phone se fornecido
    let selectedOrder = orderRows[0];
    if (customer_phone && orderRows.length > 1) {
      const matchingOrder = orderRows.find(o => {
        const cleanPhone = (o.customers?.phone || '').replace(/\D/g, '');
        const cleanInput = customer_phone.replace(/\D/g, '');
        return cleanPhone === cleanInput;
      });
      if (matchingOrder) {
        selectedOrder = matchingOrder;
      }
    }

    // 2. Atualizar ordem para completed e pago
    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'completed',
        paid: true,
        payment_method: payment_method || 'cash',
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedOrder.id);

    if (updateErr) throw updateErr;

    // 3. Atualizar statistics do cliente (visit_count, last_visit_at)
    const prevVisits = selectedOrder.customers?.visit_count ?? 0;
    const { error: customerErr } = await supabaseAdmin
      .from('customers')
      .update({
        visit_count: prevVisits + 1,
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
          customer_name: selectedOrder.customers?.name,
          customer_phone: selectedOrder.customers?.phone,
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
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    if (!umbrella_id && !customer_phone) {
      return NextResponse.json({ error: 'umbrella_id ou customer_phone obrigatório' }, { status: 400 });
    }

    // Buscar ordem aberta
    let query = supabaseAdmin
      .from('orders')
      .select('id, customer_id, umbrella_id, total, status, created_at, order_items(id), customers(id, name, phone)')
      .eq('vendor_id', vendor_id)
      .eq('status', 'received');

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

    const orderRows = orders as OrderPreview[];

    // Se houver múltiplas, filtrar por phone
    let selectedOrder = orderRows[0];
    if (customer_phone && orderRows.length > 1) {
      const cleanPhone = customer_phone.replace(/\D/g, '');
      const matching = orderRows.find(o => {
        const orderPhone = (o.customers?.phone || '').replace(/\D/g, '');
        return orderPhone === cleanPhone;
      });
      if (matching) selectedOrder = matching;
    }

    return NextResponse.json({
      order_id: selectedOrder.id,
      customer_id: selectedOrder.customer_id,
      customer_name: selectedOrder.customers?.name,
      customer_phone: selectedOrder.customers?.phone,
      umbrella_id: selectedOrder.umbrella_id,
      total: selectedOrder.total,
      items_count: selectedOrder.order_items?.length ?? 0,
      created_at: selectedOrder.created_at,
      opened_at: selectedOrder.created_at,
    });
  } catch (err) {
    console.error('Close account GET error:', err);
    return NextResponse.json({ error: 'Erro ao buscar conta' }, { status: 500 });
  }
}
