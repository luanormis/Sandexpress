import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope } from '@/lib/tenant-utils';
import { fetchArchivedOrders } from '@/lib/order-archive';

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function buildSatisfactionSummary(rows: any[]) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  let total = 0;
  let sum = 0;

  rows.forEach((row) => {
    const rating = Number(row.rating) as 1 | 2 | 3 | 4 | 5;
    if (rating >= 1 && rating <= 5) {
      distribution[rating] += 1;
      total += 1;
      sum += rating;
    }
  });

  return {
    average_rating: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
    total_responses: total,
    distribution,
    latest: rows.slice(0, 8).map((row) => ({
      rating: Number(row.rating),
      comment: row.comment || null,
      created_at: row.created_at,
      customer_name: firstRelation<{ name?: string }>(row.customers)?.name || 'Cliente',
    })),
  };
}

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
      return NextResponse.json({ error: 'vendor_id obrigatorio.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    const { data: vendorTenant, error: vendorTenantError } = await supabaseAdmin
      .from('vendors')
      .select('tenant_id')
      .eq('id', vendor_id)
      .single();

    if (vendorTenantError || !vendorTenant?.tenant_id) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    const tenantId = vendorTenant.tenant_id;

    // Calcular período
    const now = new Date();
    const startDate = new Date();
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
    const { data: orders } = await enforceTenantScope(
      supabaseAdmin
        .from('orders')
        .select('*, order_items(*, products(name, price)), customers(name, phone)')
        .eq('vendor_id', vendor_id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false }),
      tenantId
    );

    const archivedOrders = await fetchArchivedOrders({
      vendorId: vendor_id,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    });

    const allOrders: any[] = [...(orders || []), ...archivedOrders];
    const total_revenue = allOrders.reduce((acc, o) => acc + Number(o.total), 0);
    const total_gross_revenue = allOrders.reduce((acc, o) => acc + Number(o.gross_total || o.total || 0), 0);
    const total_payment_fees = allOrders.reduce((acc, o) => acc + Number(o.payment_fee_amount || 0), 0);
    const total_net_revenue = allOrders.reduce((acc, o) => acc + Number(o.net_total || o.total || 0), 0);
    const total_orders = allOrders.length;
    const avg_ticket = total_orders > 0 ? total_revenue / total_orders : 0;
    const uniqueCustomerIds = new Set(allOrders.map(o => o.customer_id));

    // Produtos ativos e guarda-sóis ativos
    const [productsResult, umbrellasResult] = await Promise.all([
      enforceTenantScope(
        supabaseAdmin.from('products').select('active').eq('vendor_id', vendor_id),
        tenantId
      ),
      enforceTenantScope(
        supabaseAdmin.from('umbrellas').select('active').eq('vendor_id', vendor_id),
        tenantId
      ),
    ]);

    const available_products = ((productsResult.data || []) as any[]).filter((p) => p.active).length;
    const umbrellasActiveCount = ((umbrellasResult.data || []) as any[]).filter((u) => u.active).length;

    // Relatórios diários
    const todayOrders = allOrders.filter(o => o.created_at && new Date(o.created_at) >= todayStart);
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
      if (!order.created_at) return;
      const createdAt = new Date(order.created_at);
      const hour = `${createdAt.getHours().toString().padStart(2, '0')}h`;
      hourlySalesMap.set(hour, (hourlySalesMap.get(hour) || 0) + 1);
    });

    const hourly_sales = Array.from(hourlySalesMap.entries())
      .sort(([a], [b]) => Number(a.replace('h', '')) - Number(b.replace('h', '')))
      .map(([hour, orders]) => ({ hour, orders }));

    const payment_methods = allOrders.reduce((acc, order) => {
      const method = order.payment_method || 'cash';
      if (!acc[method]) acc[method] = { count: 0, gross: 0, fees: 0, net: 0, total: 0 };
      acc[method].count += 1;
      acc[method].gross += Number(order.gross_total || order.total || 0);
      acc[method].fees += Number(order.payment_fee_amount || 0);
      acc[method].net += Number(order.net_total || order.total || 0);
      acc[method].total += Number(order.total || 0);
      return acc;
    }, {} as Record<string, { count: number; gross: number; fees: number; net: number; total: number }>);

    const { data: satisfactionRows, error: satisfactionError } = await enforceTenantScope(
      supabaseAdmin
        .from('customer_satisfaction_surveys')
        .select('rating, comment, created_at, customers(name)')
        .eq('vendor_id', vendor_id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50),
      tenantId
    );

    if (satisfactionError && !['42P01', 'PGRST205'].includes(satisfactionError.code)) {
      throw satisfactionError;
    }

    return NextResponse.json({
      period,
      kpis: {
        total_revenue,
        total_gross_revenue,
        total_payment_fees,
        total_net_revenue,
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
      payment_methods,
      satisfaction: buildSatisfactionSummary((satisfactionRows || []) as any[]),
    });
  } catch (err) {
    console.error('Reports error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
