import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

type ReportOrderRow = {
  customer_id: string;
  total: number;
  created_at: string;
  order_items?: Array<{
    quantity?: number;
    unit_price?: number;
    products?: { name?: string; price?: number } | null;
  }> | null;
  customers?: { name?: string; phone?: string } | null;
};

/**
 * GET /api/reports?vendor_id=xxx&period=month
 * Relatórios financeiros de um vendor.
 * Retorna KPIs, faturamento, resumo diário e ranking de produtos.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');
    const period = searchParams.get('period') || 'month';

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório.' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    // Calcular período
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case 'week': startDate.setDate(now.getDate() - 7); break;
      case 'month': startDate.setMonth(now.getMonth() - 1); break;
      case 'quarter': startDate.setMonth(now.getMonth() - 3); break;
      case 'semester': startDate.setMonth(now.getMonth() - 6); break;
      case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Buscar pedidos no período
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, products(name, price)), customers(name, phone)')
      .eq('vendor_id', vendor_id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    const allOrders = (orders || []) as ReportOrderRow[];
    const total_revenue = allOrders.reduce((acc, o) => acc + Number(o.total), 0);
    const total_orders = allOrders.length;
    const avg_ticket = total_orders > 0 ? total_revenue / total_orders : 0;
    const uniqueCustomerIds = new Set(allOrders.map(o => o.customer_id));

    // Produtos ativos e guarda-sóis ativos
    const [productsResult, umbrellasResult] = await Promise.all([
      supabaseAdmin.from('products').select('active').eq('vendor_id', vendor_id),
      supabaseAdmin.from('umbrellas').select('active').eq('vendor_id', vendor_id),
    ]);

    const available_products = (productsResult.data || []).filter(p => p.active).length;
    const umbrellasActiveCount = (umbrellasResult.data || []).filter(u => u.active).length;

    // Relatórios diários
    const todayOrders = allOrders.filter(o => new Date(o.created_at) >= todayStart);
    const today_revenue = todayOrders.reduce((acc, o) => acc + Number(o.total), 0);
    const today_customers = new Set(todayOrders.map(o => o.customer_id)).size;

    // Top products
    const topProductsMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    allOrders.forEach(order => {
      (order.order_items || []).forEach((item: any) => {
        const productName = item.products?.name || 'Produto';
        const quantity = Number(item.quantity) || 0;
        const revenue = Number(item.unit_price) * quantity || 0;
        const existing = topProductsMap.get(productName);
        if (existing) {
          existing.quantity += quantity;
          existing.revenue += revenue;
        } else {
          topProductsMap.set(productName, { name: productName, quantity, revenue });
        }
      });
    });

    const top_products = Array.from(topProductsMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const top_customers = Array.from(
      new Map((allOrders || []).map(order => [order.customer_id, order])).values()
    ).map(order => ({
      name: order.customers?.name || 'Cliente',
      phone: order.customers?.phone || '',
      visits: allOrders.filter(o => o.customer_id === order.customer_id).length,
      total_spent: allOrders
        .filter(o => o.customer_id === order.customer_id)
        .reduce((sum, x) => sum + Number(x.total), 0),
    }))
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 5);

    const hourlySalesMap = new Map<string, number>();
    allOrders.forEach(order => {
      const createdAt = new Date(order.created_at);
      const hour = `${createdAt.getHours().toString().padStart(2, '0')}h`;
      hourlySalesMap.set(hour, (hourlySalesMap.get(hour) || 0) + 1);
    });

    const hourly_sales = Array.from(hourlySalesMap.entries())
      .sort(([a], [b]) => Number(a.replace('h', '')) - Number(b.replace('h', '')))
      .map(([hour, orders]) => ({ hour, orders }));

    return NextResponse.json({
      period,
      kpis: {
        total_revenue,
        total_orders,
        avg_ticket: Math.round(avg_ticket * 100) / 100,
        unique_customers: uniqueCustomerIds.size,
      },
      daily_summary: {
        available_products,
        active_umbrellas: umbrellasActiveCount,
        today_orders: todayOrders.length,
        today_revenue: Math.round(today_revenue * 100) / 100,
        new_customers_today: today_customers,
      },
      top_products,
      top_customers,
      hourly_sales,
    });
  } catch (err) {
    console.error('Reports error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
