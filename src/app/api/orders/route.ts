import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

/**
 * GET /api/orders?vendor_id=xxx&status=received
 * Lista pedidos de um vendor, filtrável por status.
 *
 * POST /api/orders
 * Cria novo pedido. Preços lidos do banco — nunca confiados no body do cliente.
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
        '*, order_items(quantity, unit_price, subtotal, product_id, cancelled, products(name)), customers(name, phone), umbrellas(number)'
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

    if (!vendor_id || !customer_id || !umbrella_id || !Array.isArray(items) || items.length === 0) {
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

    // Validar guarda-sol pertence ao vendor
    const { data: umbrella, error: umbrellaErr } = await supabaseAdmin
      .from('umbrellas')
      .select('id, vendor_id, is_occupied, current_order_id, active')
      .eq('id', umbrella_id)
      .eq('vendor_id', vendor_id)
      .single();

    if (umbrellaErr || !umbrella) {
      return NextResponse.json({ error: 'Guarda-sol inválido para este quiosque.' }, { status: 400 });
    }
    if (!umbrella.active) {
      return NextResponse.json({ error: 'Guarda-sol inativo.' }, { status: 400 });
    }

    // Buscar preços reais dos produtos no banco (nunca confiar no cliente)
    const productIds: string[] = items.map((i: { product_id: string }) => i.product_id);

    const { data: dbProducts, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, price, promotional_price, active, blocked_by_stock, stock_quantity, vendor_id')
      .in('id', productIds)
      .eq('vendor_id', vendor_id);

    if (prodErr || !dbProducts) {
      return NextResponse.json({ error: 'Erro ao validar produtos.' }, { status: 500 });
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Validar produtos e calcular total com preços do banco
    const orderItems: { product_id: string; quantity: number; unit_price: number; subtotal: number }[] = [];
    let total = 0;

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return NextResponse.json({ error: `Produto ${item.product_id} não encontrado neste quiosque.` }, { status: 400 });
      }
      if (!product.active || product.blocked_by_stock) {
        return NextResponse.json({ error: `Produto indisponível.` }, { status: 400 });
      }
      if (product.stock_quantity !== null && product.stock_quantity < item.quantity) {
        return NextResponse.json({ error: `Estoque insuficiente.` }, { status: 400 });
      }
      const unit_price: number = Number(product.promotional_price ?? product.price);
      const subtotal = unit_price * item.quantity;
      total += subtotal;
      orderItems.push({ product_id: item.product_id, quantity: item.quantity, unit_price, subtotal });
    }

    // Criar pedido
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({ vendor_id, customer_id, umbrella_id, total, notes: notes || null })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // Criar itens do pedido
    const { error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems.map((oi) => ({ ...oi, order_id: order.id })));

    if (itemsErr) throw itemsErr;

    // Decrementar estoque
    for (const item of orderItems) {
      const product = productMap.get(item.product_id)!;
      if (product.stock_quantity !== null) {
        const newQty = product.stock_quantity - item.quantity;
        await supabaseAdmin
          .from('products')
          .update({
            stock_quantity: newQty,
            blocked_by_stock: newQty <= 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.product_id);
      }
    }

    // Marcar guarda-sol como ocupado
    if (!umbrella.is_occupied) {
      await supabaseAdmin
        .from('umbrellas')
        .update({ is_occupied: true, current_order_id: order.id })
        .eq('id', umbrella_id);
    }

    // Atualizar total gasto do cliente
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('total_spent')
      .eq('id', customer_id)
      .single();

    if (customer) {
      await supabaseAdmin
        .from('customers')
        .update({
          total_spent: Number(customer.total_spent) + total,
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
