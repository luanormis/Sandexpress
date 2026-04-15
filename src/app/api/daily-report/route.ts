import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/daily-report?vendor_id=xxx&date=2024-04-11
 * Gera relatório completo do dia (pedidos, produtos mais vendidos, faturamento)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]; // padrão: hoje

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório' }, { status: 400 });
    }

    // Construir datas para query
    const startOfDay = new Date(`${dateStr}T00:00:00`).toISOString();
    const endOfDay = new Date(`${dateStr}T23:59:59`).toISOString();

    // 1. Obter todos os pedidos do dia (completados)
    const { data: orders, error: ordersErr } = await supabaseAdmin
      .from('orders')
      .select('id, umbrella_id, customer_id, total, status, paid, payment_method, created_at, order_items(quantity, unit_price, product_id), customers(name, phone), umbrellas(number)')
      .eq('vendor_id', vendor_id)
      .eq('status', 'completed')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: true });

    if (ordersErr) throw ordersErr;

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        date: dateStr,
        summary: {
          total_orders: 0,
          total_revenue: 0,
          total_items_sold: 0,
          avg_ticket: 0,
          unique_customers: 0,
          payment_methods: {},
        },
        orders: [],
        top_products: [],
        hourly_breakdown: [],
      });
    }

    // 2. Calcular resumo
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const totalItems = orders.reduce((sum: number, o: any) => sum + (o.order_items?.length || 0), 0);
    const avgTicket = totalRevenue / orders.length;

    // Contar clientes únicos
    const uniqueCustomers = new Set(orders.map((o: any) => o.customer_id)).size;

    // 3. Agrupar por método de pagamento
    const paymentMethodsMap: Record<string, { count: number; total: number }> = {};
    orders.forEach((o: any) => {
      const method = o.payment_method || 'cash';
      if (!paymentMethodsMap[method]) {
        paymentMethodsMap[method] = { count: 0, total: 0 };
      }
      paymentMethodsMap[method].count += 1;
      paymentMethodsMap[method].total += o.total || 0;
    });

    // 4. Produtos mais vendidos
    const productsMap: Record<string, { name: string; quantity: number; revenue: number; product_id: string }> = {};

    // Obter nomes dos produtos
    const productIds = new Set<string>();
    orders.forEach((o: any) => {
      if (o.order_items) {
        o.order_items.forEach((item: any) => {
          if (item.product_id) productIds.add(item.product_id);
        });
      }
    });

    if (productIds.size > 0) {
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, name')
        .in('id', Array.from(productIds));

      const productNameMap: Record<string, string> = {};
      if (products) {
        products.forEach((p: any) => {
          productNameMap[p.id] = p.name;
        });
      }

      // Agrupar e contar itens
      orders.forEach((o: any) => {
        if (o.order_items) {
          o.order_items.forEach((item: any) => {
            const productId = item.product_id;
            const productName = productNameMap[productId] || 'Produto Desconhecido';

            if (!productsMap[productId]) {
              productsMap[productId] = {
                name: productName,
                quantity: 0,
                revenue: 0,
                product_id: productId,
              };
            }
            productsMap[productId].quantity += item.quantity || 1;
            productsMap[productId].revenue += (item.unit_price * (item.quantity || 1)) || 0;
          });
        }
      });
    }

    const topProducts = Object.values(productsMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // 5. Breakdown por hora
    const hourlyMap: Record<string, { orders: number; revenue: number }> = {};
    orders.forEach((o: any) => {
      const hour = new Date(o.created_at).getHours().toString().padStart(2, '0');
      const hourKey = `${hour}:00`;
      if (!hourlyMap[hourKey]) {
        hourlyMap[hourKey] = { orders: 0, revenue: 0 };
      }
      hourlyMap[hourKey].orders += 1;
      hourlyMap[hourKey].revenue += o.total || 0;
    });

    const hourlyBreakdown = Object.entries(hourlyMap)
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    // 6. Formatar dados dos pedidos
    const formattedOrders = orders.map((o: any) => ({
      id: o.id,
      umbrella_number: (o.umbrellas as any)?.number || 'N/A',
      customer_name: (o.customers as any)?.name || 'Não identificado',
      customer_phone: (o.customers as any)?.phone || 'N/A',
      total: o.total,
      status: o.status,
      payment_method: o.payment_method || 'cash',
      items_count: o.order_items ? o.order_items.length : 0,
      created_at: o.created_at,
    }));

    return NextResponse.json({
      date: dateStr,
      summary: {
        total_orders: orders.length,
        total_revenue: totalRevenue,
        total_items_sold: totalItems,
        avg_ticket: avgTicket,
        unique_customers: uniqueCustomers,
        payment_methods: paymentMethodsMap,
      },
      orders: formattedOrders,
      top_products: topProducts,
      hourly_breakdown: hourlyBreakdown,
    });
  } catch (err) {
    console.error('Daily report error:', err);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
