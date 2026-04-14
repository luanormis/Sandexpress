import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

/**
 * GET /api/orders?vendor_id=xxx&status=received
 * Lista pedidos de um vendor, filtrável por status.
 *
 * POST /api/orders
 * Cria um novo pedido com itens.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');
    const status = searchParams.get('status');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório.' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    let query = supabaseAdmin
      .from('orders')
      .select(
        '*, order_items(quantity, unit_price, subtotal, product_id, products(name)), customers(name, phone), umbrellas(number)'
      )
      .eq('vendor_id', vendor_id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Orders GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { vendor_id, customer_id, umbrella_id, items, notes } = await req.json();

    if (!vendor_id || !customer_id || !umbrella_id || !items?.length) {
      return NextResponse.json({ error: 'Dados de pedido incompletos.' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    if (session.role === 'vendor' && session.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Vendor não autorizado.' }, { status: 403 });
    }
    if (session.role === 'customer') {
      if (session.vendor_id !== vendor_id || session.customer_id !== customer_id) {
        return NextResponse.json({ error: 'Sessão do cliente inválida para este pedido.' }, { status: 403 });
      }
    }

    // Calcular total
    const total = items.reduce((acc: number, i: any) => acc + i.unit_price * i.quantity, 0);

    // Criar pedido
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({ vendor_id, customer_id, umbrella_id, total, notes })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // Criar itens do pedido
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.unit_price * item.quantity,
    }));

    const { error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems);

    if (itemsErr) throw itemsErr;

    // Atualizar total gasto do cliente (fallback manual)
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('total_spent')
      .eq('id', customer_id)
      .single();

    if (customer) {
      await supabaseAdmin
        .from('customers')
        .update({
          total_spent: customer.total_spent + total,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer_id);
    }

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    console.error('Orders POST error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
