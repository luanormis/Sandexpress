import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope } from '@/lib/tenant-utils';
import { fetchArchivedOrders } from '@/lib/order-archive';
import { serviceFeeFromOrderNotes } from '@/lib/service-fee';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';

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
    const currentOrderPage = await fetchAllSupabaseRows<any>((from, to) => enforceTenantScope(
      supabaseAdmin
        .from('orders')
        .select('*, order_items(*, products(name, price, category, cost_price)), customers(name, phone)')
        .eq('vendor_id', vendor_id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .range(from, to),
      tenantId
    ), { maxRows: 50000 });

    if (currentOrderPage.truncated) {
      return NextResponse.json({ error: 'Periodo muito grande para processamento seguro. Selecione um intervalo menor.' }, { status: 413 });
    }

    const archivedOrders = await fetchArchivedOrders({
      vendorId: vendor_id,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    });

    const allOrders: any[] = [...currentOrderPage.rows, ...archivedOrders];
    const paidOrders = allOrders.filter((order) => Boolean(order.paid));
    const total_revenue = paidOrders.reduce((acc, o) => acc + Number(o.total), 0);
    const total_gross_revenue = paidOrders.reduce((acc, o) => acc + Number(o.gross_total || o.total || 0), 0);
    const total_payment_fees = paidOrders.reduce((acc, o) => acc + Number(o.payment_fee_amount || 0), 0);
    const total_net_revenue = paidOrders.reduce((acc, o) => acc + Number(o.net_total || o.total || 0), 0);
    const total_service_fees = paidOrders.reduce((acc, order) => acc + serviceFeeFromOrderNotes(order.notes), 0);
    const total_orders = paidOrders.length;
    const avg_ticket = total_orders > 0 ? total_revenue / total_orders : 0;
    const uniqueCustomerIds = new Set(paidOrders.map(o => o.customer_id).filter(Boolean));

    // Produtos ativos e guarda-sóis ativos
    const [productsResult, umbrellasResult] = await Promise.all([
      enforceTenantScope(
        supabaseAdmin
          .from('products')
          .select('active, name, category, price, cost_price, promotional_price, stock_tracking_enabled, beach_stock_quantity, stock_quantity, blocked_by_stock')
          .eq('vendor_id', vendor_id),
        tenantId
      ),
      enforceTenantScope(
        supabaseAdmin.from('umbrellas').select('active').eq('vendor_id', vendor_id),
        tenantId
      ),
    ]);

    const productRows = (productsResult.data || []) as any[];
    const available_products = productRows.filter((p) => p.active).length;
    const umbrellasActiveCount = ((umbrellasResult.data || []) as any[]).filter((u) => u.active).length;
    const low_stock_alerts = productRows
      .filter((product) => product.active && product.stock_tracking_enabled)
      .map((product) => ({
        name: product.name || 'Produto',
        category: product.category || 'Sem categoria',
        quantity: Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0),
        blocked: Boolean(product.blocked_by_stock),
      }))
      .filter((product) => product.blocked || product.quantity <= 10)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 8);

    // Relatórios diários
    const todayOrders = paidOrders.filter(o => o.paid_at ? new Date(o.paid_at) >= todayStart : o.created_at && new Date(o.created_at) >= todayStart);
    const today_revenue = todayOrders.reduce((acc, o) => acc + Number(o.total), 0);
    const today_customers = new Set(todayOrders.map(o => o.customer_id).filter(Boolean)).size;

    // Top products
    const productCostByName = new Map(productRows.map(product => [String(product.name || ''), product.cost_price]));
    const topProductsMap = new Map<string, { name: string; quantity: number; revenue: number; cost: number; profit: number; cost_configured: boolean; margin_percent: number }>();
    paidOrders.forEach(order => {
      (order.order_items || []).forEach((item: any) => {
        const productName = item.products?.name || 'Produto';
        const quantity = Number(item.quantity) || 0;
        const revenue = Number(item.unit_price) * quantity || 0;
        const rawUnitCost = item.products?.cost_price ?? productCostByName.get(productName);
        const hasCost = rawUnitCost !== null && rawUnitCost !== undefined && Number.isFinite(Number(rawUnitCost));
        const cost = hasCost ? Number(rawUnitCost) * quantity : 0;
        const existing = topProductsMap.get(productName);
        if (existing) {
          existing.quantity += quantity;
          existing.revenue += revenue;
          existing.cost += cost;
          existing.profit = existing.revenue - existing.cost;
          existing.cost_configured = existing.cost_configured && hasCost;
          existing.margin_percent = existing.revenue > 0 ? Math.round((existing.profit / existing.revenue) * 1000) / 10 : 0;
        } else {
          topProductsMap.set(productName, { name: productName, quantity, revenue, cost, profit: revenue - cost, cost_configured: hasCost, margin_percent: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : 0 });
        }
      });
    });

    const top_products = Array.from(topProductsMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const categoryMap = new Map<string, { category: string; quantity: number; revenue: number; cost: number; profit: number; cost_configured: boolean; margin_percent: number }>();
    paidOrders.forEach(order => {
      (order.order_items || []).forEach((item: any) => {
        const category = item.products?.category || 'Sem categoria';
        const quantity = Number(item.quantity) || 0;
        const revenue = Number(item.unit_price || 0) * quantity;
        const productName = item.products?.name || 'Produto';
        const rawUnitCost = item.products?.cost_price ?? productCostByName.get(productName);
        const hasCost = rawUnitCost !== null && rawUnitCost !== undefined && Number.isFinite(Number(rawUnitCost));
        const cost = hasCost ? Number(rawUnitCost) * quantity : 0;
        const existing = categoryMap.get(category) || { category, quantity: 0, revenue: 0, cost: 0, profit: 0, cost_configured: true, margin_percent: 0 };
        existing.quantity += quantity;
        existing.revenue += revenue;
        existing.cost += cost;
        existing.profit = existing.revenue - existing.cost;
        existing.cost_configured = existing.cost_configured && hasCost;
        existing.margin_percent = existing.revenue > 0 ? Math.round((existing.profit / existing.revenue) * 1000) / 10 : 0;
        categoryMap.set(category, existing);
      });
    });

    const category_performance = Array.from(categoryMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const top_customers = Array.from(
      new Map((paidOrders || []).map(order => [order.customer_id, order])).values()
    ).map(order => ({
      name: order.customers?.name || 'Cliente',
      phone: order.customers?.phone || '',
      visits: paidOrders.filter(o => o.customer_id === order.customer_id).length,
      total_spent: paidOrders
        .filter(o => o.customer_id === order.customer_id)
        .reduce((sum, x) => sum + Number(x.total), 0),
    }))
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 5);

    const hourlySalesMap = new Map<string, { orders: number; revenue: number }>();
    const businessHourFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    paidOrders.forEach(order => {
      const orderDate = order.paid_at || order.created_at;
      if (!orderDate) return;
      const createdAt = new Date(orderDate);
      if (Number.isNaN(createdAt.getTime())) return;
      const hour = `${businessHourFormatter.format(createdAt).replace(/\D/g, '').padStart(2, '0')}h`;
      const current = hourlySalesMap.get(hour) || { orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += Number(order.total || 0);
      hourlySalesMap.set(hour, current);
    });

    const hourly_sales = Array.from(hourlySalesMap.entries())
      .sort(([a], [b]) => Number(a.replace('h', '')) - Number(b.replace('h', '')))
      .map(([hour, values]) => ({
        hour,
        orders: values.orders,
        revenue: Math.round(values.revenue * 100) / 100,
        avg_ticket: values.orders > 0 ? Math.round((values.revenue / values.orders) * 100) / 100 : 0,
      }));

    const [{ data: staffUsers }, { data: attributionEvents }, { data: commissionEvents }, { data: partialPaymentEvents }, { data: waiterResolvedEvents }, { data: statusTransitionEvents }] = await Promise.all([
      supabaseAdmin.from('vendor_users').select('id, name, role').eq('vendor_id', vendor_id).eq('active', true),
      supabaseAdmin.from('analytics_events').select('metadata, created_at').eq('vendor_id', vendor_id).eq('event_type', 'staff_order_attribution').gte('created_at', startDate.toISOString()).order('created_at', { ascending: false }),
      supabaseAdmin.from('analytics_events').select('metadata, created_at').eq('vendor_id', vendor_id).eq('event_type', 'staff_commission_config').order('created_at', { ascending: false }),
      supabaseAdmin.from('analytics_events').select('metadata, created_at').eq('vendor_id', vendor_id).eq('event_type', 'partial_account_payment').order('created_at', { ascending: true }).limit(5000),
      supabaseAdmin.from('analytics_events').select('metadata, created_at').eq('vendor_id', vendor_id).eq('event_type', 'waiter_call_resolved').gte('created_at', startDate.toISOString()).order('created_at', { ascending: false }).limit(5000),
      supabaseAdmin.from('analytics_events').select('metadata, created_at').eq('vendor_id', vendor_id).eq('event_type', 'order_status_transition').gte('created_at', startDate.toISOString()).order('created_at', { ascending: true }).limit(10000),
    ]);
    const staffNameById = new Map<string, string>((staffUsers || []).map((user: any) => [String(user.id), String(user.name || 'Equipe')] as [string, string]));
    const commissionByUser = new Map<string, any>();
    (commissionEvents || []).forEach((event: any) => {
      const userId = String(event.metadata?.user_id || '');
      if (userId && !commissionByUser.has(userId)) commissionByUser.set(userId, event.metadata);
    });
    const staffPerformanceMap = new Map<string, { user_id: string; name: string; orders: number; revenue: number; commission_type: string; commission_value: number; commission_due: number }>();
    const paidOrderById = new Map(paidOrders.map(order => [String(order.id), order]));
    const legacyStaffByOrder = new Map<string, string>();
    const attributedRequestRevenueByOrder = new Map<string, number>();
    (attributionEvents || []).forEach((event: any) => {
      const orderId = String(event.metadata?.order_id || '');
      const userId = String(event.metadata?.user_id || '');
      if (!orderId || !userId || !paidOrderById.has(orderId)) return;
      const hasRequestTotal = event.metadata?.request_total !== null && event.metadata?.request_total !== undefined && Number.isFinite(Number(event.metadata.request_total));
      if (!hasRequestTotal) {
        if (!legacyStaffByOrder.has(orderId)) legacyStaffByOrder.set(orderId, userId);
        return;
      }
      const config = commissionByUser.get(userId) || {};
      const current = staffPerformanceMap.get(userId) || { user_id: userId, name: staffNameById.get(userId) || 'Equipe', orders: 0, revenue: 0, commission_type: config.commission_type || 'none', commission_value: Number(config.commission_value || 0), commission_due: 0 };
      current.orders += 1;
      const requestRevenue = Math.max(0, Number(event.metadata.request_total || 0));
      current.revenue += requestRevenue;
      attributedRequestRevenueByOrder.set(orderId, (attributedRequestRevenueByOrder.get(orderId) || 0) + requestRevenue);
      staffPerformanceMap.set(userId, current);
    });
    legacyStaffByOrder.forEach((userId, orderId) => {
      const order = paidOrderById.get(orderId);
      if (!order) return;
      const config = commissionByUser.get(userId) || {};
      const current = staffPerformanceMap.get(userId) || { user_id: userId, name: staffNameById.get(userId) || 'Equipe', orders: 0, revenue: 0, commission_type: config.commission_type || 'none', commission_value: Number(config.commission_value || 0), commission_due: 0 };
      current.orders += 1;
      current.revenue += Math.max(0, Number(order.total || 0) - Number(attributedRequestRevenueByOrder.get(orderId) || 0));
      staffPerformanceMap.set(userId, current);
    });
    const staff_performance = Array.from(staffPerformanceMap.values()).map((staff) => ({
      ...staff,
      revenue: Math.round(staff.revenue * 100) / 100,
      commission_due: Math.round((staff.commission_type === 'percent' ? staff.revenue * staff.commission_value / 100 : staff.commission_type === 'fixed' ? staff.orders * staff.commission_value : 0) * 100) / 100,
    })).sort((a, b) => b.revenue - a.revenue);
    const waiterServiceByUser = new Map<string, { user_id: string; name: string; calls: number; response_seconds: number; service_seconds: number }>();
    (waiterResolvedEvents || []).forEach((event: any) => {
      const userId = String(event.metadata?.user_id || '');
      if (!userId) return;
      const current = waiterServiceByUser.get(userId) || { user_id: userId, name: String(event.metadata?.waiter_name || staffNameById.get(userId) || 'Garcom'), calls: 0, response_seconds: 0, service_seconds: 0 };
      current.calls += 1; current.response_seconds += Number(event.metadata?.response_seconds || 0); current.service_seconds += Number(event.metadata?.service_seconds || 0);
      waiterServiceByUser.set(userId, current);
    });
    const waiter_service = {
      total_calls: (waiterResolvedEvents || []).length,
      avg_response_seconds: (waiterResolvedEvents || []).length ? Math.round((waiterResolvedEvents || []).reduce((sum: number, event: any) => sum + Number(event.metadata?.response_seconds || 0), 0) / (waiterResolvedEvents || []).length) : 0,
      avg_service_seconds: (waiterResolvedEvents || []).length ? Math.round((waiterResolvedEvents || []).reduce((sum: number, event: any) => sum + Number(event.metadata?.service_seconds || 0), 0) / (waiterResolvedEvents || []).length) : 0,
      by_waiter: Array.from(waiterServiceByUser.values()).map(item => ({ ...item, avg_response_seconds: Math.round(item.response_seconds / item.calls), avg_service_seconds: Math.round(item.service_seconds / item.calls) })).sort((a, b) => b.calls - a.calls),
    };
    const transitionByRequest = new Map<string, any[]>();
    (statusTransitionEvents || []).forEach((event: any) => {
      const key = String(event.metadata?.request_id || event.metadata?.order_id || '');
      if (!key) return;
      transitionByRequest.set(key, [...(transitionByRequest.get(key) || []), event]);
    });
    const completedTimings = Array.from(transitionByRequest.values()).map(events => {
      const completed = events.find((event: any) => event.metadata?.to_status === 'completed');
      if (!completed) return null;
      const preparing = events.find((event: any) => event.metadata?.to_status === 'preparing');
      const start = new Date(completed.metadata?.started_at || events[0]?.created_at).getTime();
      const prepareStart = new Date(preparing?.created_at || completed.metadata?.started_at || events[0]?.created_at).getTime();
      const end = new Date(completed.created_at).getTime();
      const serviceSeconds = Math.max(0, Math.round((end - start) / 1000));
      const preparationSeconds = Math.max(0, Math.round((end - prepareStart) / 1000));
      if (!Number.isFinite(serviceSeconds) || serviceSeconds > 43200) return null;
      return { order_id: completed.metadata?.order_id, request_id: completed.metadata?.request_id, service_seconds: serviceSeconds, preparation_seconds: preparationSeconds };
    }).filter(Boolean) as Array<{ order_id: string; request_id: string | null; service_seconds: number; preparation_seconds: number }>;
    const operational_times = {
      completed_requests: completedTimings.length,
      avg_preparation_seconds: completedTimings.length ? Math.round(completedTimings.reduce((sum, item) => sum + item.preparation_seconds, 0) / completedTimings.length) : 0,
      avg_service_seconds: completedTimings.length ? Math.round(completedTimings.reduce((sum, item) => sum + item.service_seconds, 0) / completedTimings.length) : 0,
      delayed_requests: completedTimings.filter(item => item.preparation_seconds > 20 * 60).length,
      fastest_preparation_seconds: completedTimings.length ? Math.min(...completedTimings.map(item => item.preparation_seconds)) : 0,
      slowest_preparation_seconds: completedTimings.length ? Math.max(...completedTimings.map(item => item.preparation_seconds)) : 0,
    };

    const soldNames = new Set(Array.from(topProductsMap.keys()));
    const least_sold = Array.from(topProductsMap.values()).sort((a, b) => a.quantity - b.quantity).slice(0, 5);
    const highest_revenue_products = Array.from(topProductsMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const highest_profit_products = Array.from(topProductsMap.values()).filter(product => product.cost_configured).sort((a, b) => b.profit - a.profit).slice(0, 5);
    const stagnant_products = productRows.filter((product) => product.active && !soldNames.has(product.name)).map((product) => ({ name: product.name, category: product.category })).slice(0, 10);

    const paymentsByOrder = new Map<string, any[]>();
    (partialPaymentEvents || []).forEach((event: any) => {
      const orderId = String(event.metadata?.order_id || '');
      if (!orderId) return;
      paymentsByOrder.set(orderId, [...(paymentsByOrder.get(orderId) || []), event.metadata]);
    });
    const payment_methods = paidOrders.reduce((acc, order) => {
      const parts = paymentsByOrder.get(String(order.id)) || [];
      const allocations = parts.length > 0 ? parts : [{ payment_method: order.payment_method || 'cash', amount: Number(order.total || 0) }];
      const orderFee = Number(order.payment_fee_amount || 0);
      allocations.forEach((payment: any) => {
        const method = payment.payment_method || 'cash';
        const amount = Number(payment.amount || 0);
        const proportionalFee = Number(order.total || 0) > 0 ? orderFee * amount / Number(order.total) : 0;
        if (!acc[method]) acc[method] = { count: 0, gross: 0, fees: 0, net: 0, total: 0 };
        acc[method].count += 1;
        acc[method].gross += amount;
        acc[method].fees += proportionalFee;
        acc[method].net += amount - proportionalFee;
        acc[method].total += amount;
      });
      return acc;
    }, {} as Record<string, { count: number; gross: number; fees: number; net: number; total: number }>);

    const { data: receivableRows, error: receivablesError } = await enforceTenantScope(
      (supabaseAdmin.from('payment_receivables') as any)
        .select('id, order_id, payment_method, gross_amount, fee_rate, fee_amount, net_amount, paid_at, expected_payment_date, status')
        .eq('vendor_id', vendor_id)
        .gte('paid_at', startDate.toISOString())
        .order('expected_payment_date', { ascending: true }),
      tenantId
    );

    if (receivablesError) throw receivablesError;
    const receivables = receivableRows || [];
    const receivablesByDate = receivables.reduce((acc: Record<string, { gross: number; fees: number; net: number; count: number }>, row: any) => {
      const date = row.expected_payment_date || String(row.paid_at || '').slice(0, 10) || 'sem_data';
      if (!acc[date]) acc[date] = { gross: 0, fees: 0, net: 0, count: 0 };
      acc[date].gross += Number(row.gross_amount || 0);
      acc[date].fees += Number(row.fee_amount || 0);
      acc[date].net += Number(row.net_amount || 0);
      acc[date].count += 1;
      return acc;
    }, {});

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

    if (satisfactionError) throw satisfactionError;

    return NextResponse.json({
      period,
      kpis: {
        total_revenue,
        total_gross_revenue,
        total_payment_fees,
        total_net_revenue,
        total_service_fees,
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
      category_performance,
      low_stock_alerts,
      top_customers,
      hourly_sales,
      staff_performance,
      waiter_service,
      operational_times,
      product_insights: { least_sold, highest_revenue_products, highest_profit_products, stagnant_products },
      payment_methods,
      receivables,
      receivables_by_date: receivablesByDate,
      satisfaction: buildSatisfactionSummary((satisfactionRows || []) as any[]),
    });
  } catch (err) {
    console.error('Reports error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
