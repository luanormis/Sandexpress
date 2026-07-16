import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchArchivedOrders } from '@/lib/order-archive';
import { returnBeachStockToPhysical } from '@/lib/stock-handler';
import { closeKioskSessions } from '@/lib/kiosk-session';
import { businessDate, CashControl, parseCashControl, serializeCashControl } from '@/lib/cash-control';
import { OPEN_ACCOUNT_STATUSES } from '@/lib/order-account';
import { serviceFeeFromOrderNotes } from '@/lib/service-fee';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';

type PaymentSummary = Record<string, { count: number; gross: number; fees: number; net: number; total: number }>;

function money(value: unknown) {
  return Number(Math.max(0, Number(value || 0)).toFixed(2));
}

function dayRange(dateStr: string) {
  return {
    startOfDay: new Date(`${dateStr}T00:00:00-03:00`).toISOString(),
    endOfDay: new Date(`${dateStr}T23:59:59.999-03:00`).toISOString(),
  };
}

async function buildDailyReport(vendorId: string, dateStr: string) {
  const { startOfDay, endOfDay } = dayRange(dateStr);

  const currentOrderPage = await fetchAllSupabaseRows<any>((from, to) => supabaseAdmin
    .from('orders')
    .select('id, umbrella_id, customer_id, total, gross_total, payment_fee_amount, net_total, status, paid, payment_method, notes, created_at, paid_at, order_items(quantity, unit_price, product_id), customers(name, phone), umbrellas!orders_umbrella_id_fkey(number)')
    .eq('vendor_id', vendorId)
    .eq('paid', true)
    .gte('paid_at', startOfDay)
    .lte('paid_at', endOfDay)
    .order('paid_at', { ascending: true })
    .range(from, to), { maxRows: 20000 });

  if (currentOrderPage.truncated) throw new Error('Volume diario acima do limite seguro de 20.000 comandas.');

  const archivedOrders = await fetchArchivedOrders({
    vendorId,
    startDate: startOfDay,
    endDate: endOfDay,
  });

  const completedOrders = [...currentOrderPage.rows, ...archivedOrders.filter((order: any) => Boolean(order.paid))];
  const totalRevenue = completedOrders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);
  const totalGrossRevenue = completedOrders.reduce((sum: number, order: any) => sum + Number(order.gross_total || order.total || 0), 0);
  const totalPaymentFees = completedOrders.reduce((sum: number, order: any) => sum + Number(order.payment_fee_amount || 0), 0);
  const totalNetRevenue = completedOrders.reduce((sum: number, order: any) => sum + Number(order.net_total || order.total || 0), 0);
  const totalServiceFees = completedOrders.reduce((sum: number, order: any) => sum + serviceFeeFromOrderNotes(order.notes), 0);
  const totalItems = completedOrders.reduce((sum: number, order: any) => {
    return sum + (order.order_items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.quantity || 0), 0);
  }, 0);
  const avgTicket = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
  const uniqueCustomers = new Set(completedOrders.map((order: any) => order.customer_id).filter(Boolean)).size;

  const completedOrderIds = new Set(completedOrders.map((order: any) => String(order.id)));
  const { data: partialPaymentEvents } = await supabaseAdmin.from('analytics_events')
    .select('metadata, created_at').eq('vendor_id', vendorId).eq('event_type', 'partial_account_payment')
    .order('created_at', { ascending: true }).limit(5000);
  const paymentsByOrder = new Map<string, any[]>();
  (partialPaymentEvents || []).forEach((event: any) => {
    const orderId = String(event.metadata?.order_id || '');
    if (!completedOrderIds.has(orderId)) return;
    paymentsByOrder.set(orderId, [...(paymentsByOrder.get(orderId) || []), event.metadata]);
  });

  const paymentMethods: PaymentSummary = {};
  completedOrders.forEach((order: any) => {
    const parts = paymentsByOrder.get(String(order.id)) || [];
    const allocations = parts.length > 0 ? parts : [{ payment_method: order.payment_method || 'cash', amount: Number(order.total || 0) }];
    allocations.forEach((payment: any) => {
      const method = payment.payment_method || 'cash';
      const amount = Number(payment.amount || 0);
      const proportionalFee = Number(order.total || 0) > 0 ? Number(order.payment_fee_amount || 0) * amount / Number(order.total) : 0;
      if (!paymentMethods[method]) paymentMethods[method] = { count: 0, gross: 0, fees: 0, net: 0, total: 0 };
      paymentMethods[method].count += 1;
      paymentMethods[method].gross += amount;
      paymentMethods[method].fees += proportionalFee;
      paymentMethods[method].net += amount - proportionalFee;
      paymentMethods[method].total += amount;
    });
  });

  const productIds = new Set<string>();
  completedOrders.forEach((order: any) => {
    (order.order_items || []).forEach((item: any) => {
      if (item.product_id) productIds.add(item.product_id);
    });
  });

  const productMetaMap: Record<string, { name: string; category: string }> = {};
  if (productIds.size > 0) {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, category')
      .in('id', Array.from(productIds));
    (products || []).forEach((product: any) => {
      productMetaMap[product.id] = {
        name: product.name || 'Produto desconhecido',
        category: product.category || 'Sem categoria',
      };
    });
  }

  const productsMap: Record<string, { name: string; quantity: number; revenue: number; product_id: string }> = {};
  const categoryMap: Record<string, { category: string; quantity: number; revenue: number }> = {};
  completedOrders.forEach((order: any) => {
    (order.order_items || []).forEach((item: any) => {
      const productId = item.product_id;
      if (!productId) return;
      const meta = productMetaMap[productId] || { name: item.products?.name || 'Produto desconhecido', category: 'Sem categoria' };
      if (!productsMap[productId]) {
        productsMap[productId] = {
          name: meta.name,
          quantity: 0,
          revenue: 0,
          product_id: productId,
        };
      }
      const quantity = Number(item.quantity || 0);
      const revenue = Number(item.unit_price || 0) * quantity;
      productsMap[productId].quantity += quantity;
      productsMap[productId].revenue += revenue;
      if (!categoryMap[meta.category]) categoryMap[meta.category] = { category: meta.category, quantity: 0, revenue: 0 };
      categoryMap[meta.category].quantity += quantity;
      categoryMap[meta.category].revenue += revenue;
    });
  });

  const topProducts = Object.values(productsMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const categoryPerformance = Object.values(categoryMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const { data: stockProducts } = await supabaseAdmin
    .from('products')
    .select('name, category, active, stock_tracking_enabled, beach_stock_quantity, stock_quantity, blocked_by_stock')
    .eq('vendor_id', vendorId);

  const lowStockAlerts = ((stockProducts || []) as any[])
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

  const hourlyMap: Record<string, { orders: number; revenue: number }> = {};
  const businessHourFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' });
  completedOrders.forEach((order: any) => {
    const paidDate = new Date(order.paid_at || order.created_at);
    if (Number.isNaN(paidDate.getTime())) return;
    const hour = businessHourFormatter.format(paidDate).replace(/\D/g, '').padStart(2, '0');
    const hourKey = `${hour}:00`;
    if (!hourlyMap[hourKey]) hourlyMap[hourKey] = { orders: 0, revenue: 0 };
    hourlyMap[hourKey].orders += 1;
    hourlyMap[hourKey].revenue += Number(order.total || 0);
  });

  const hourlyBreakdown = Object.entries(hourlyMap)
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  const formattedOrders = completedOrders.map((order: any) => ({
    id: order.id,
    umbrella_number: order.umbrellas?.number || 'N/A',
    customer_name: order.customers?.name || 'Nao identificado',
    customer_phone: order.customers?.phone || 'N/A',
    total: Number(order.total || 0),
    service_fee_amount: serviceFeeFromOrderNotes(order.notes),
    received_total: Number(order.total || 0) + serviceFeeFromOrderNotes(order.notes),
    gross_total: Number(order.gross_total || order.total || 0),
    payment_fee_amount: Number(order.payment_fee_amount || 0),
    net_total: Number(order.net_total || order.total || 0),
    status: order.status,
    payment_method: order.payment_method || 'cash',
    items_count: (order.order_items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0),
    created_at: order.created_at,
    paid_at: order.paid_at || order.created_at,
  }));

  return {
    date: dateStr,
    summary: {
      total_orders: completedOrders.length,
      total_revenue: totalRevenue,
      total_gross_revenue: totalGrossRevenue,
      total_payment_fees: totalPaymentFees,
      total_net_revenue: totalNetRevenue,
      total_service_fees: totalServiceFees,
      total_items_sold: totalItems,
      avg_ticket: avgTicket,
      unique_customers: uniqueCustomers,
      payment_methods: paymentMethods,
    },
    orders: formattedOrders,
    top_products: topProducts,
    category_performance: categoryPerformance,
    low_stock_alerts: lowStockAlerts,
    hourly_breakdown: hourlyBreakdown,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendor_id');
    const dateStr = searchParams.get('date') || businessDate();

    if (!vendorId) {
      return NextResponse.json({ error: 'vendor_id obrigatorio' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
    }

    const report = await buildDailyReport(vendorId, dateStr);
    const { data: dailyClosing } = await supabaseAdmin
      .from('daily_closings')
      .select('closed_by, closed_at')
      .eq('vendor_id', vendorId)
      .eq('business_date', dateStr)
      .maybeSingle();
    return NextResponse.json({
      ...report,
      cash_control: parseCashControl(dailyClosing?.closed_by),
    });
  } catch (err) {
    console.error('Daily report error:', err);
    return NextResponse.json({ error: 'Erro ao gerar relatorio' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vendorId = body.vendor_id;
    const dateStr = body.date || businessDate();
    const action = body.action === 'open' ? 'open' : 'close';

    if (!vendorId) {
      return NextResponse.json({ error: 'vendor_id obrigatorio' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
    }

    const { data: vendor, error: vendorErr } = await (supabaseAdmin.from('vendors') as any)
      .select('tenant_id')
      .eq('id', vendorId)
      .single();
    if (vendorErr || !vendor?.tenant_id) {
      return NextResponse.json({ error: 'Vendor sem tenant configurado.' }, { status: 400 });
    }


    const { data: currentClosing, error: currentClosingError } = await supabaseAdmin
      .from('daily_closings')
      .select('id, closed_by')
      .eq('vendor_id', vendorId)
      .eq('business_date', dateStr)
      .maybeSingle();
    if (currentClosingError) throw currentClosingError;
    const currentCashControl = parseCashControl(currentClosing?.closed_by);

    if (action === 'open') {
      if (currentCashControl?.status === 'open') {
        return NextResponse.json({ error: 'O caixa de hoje ja esta aberto.', cash_control: currentCashControl }, { status: 409 });
      }
      if (currentCashControl?.status === 'closed') {
        return NextResponse.json({ error: 'O caixa de hoje ja foi fechado.' }, { status: 409 });
      }
      const cashControl: CashControl = {
        status: 'open',
        opened_at: new Date().toISOString(),
        opened_by: session?.role || 'vendor',
        opening_cash: money(body.opening_cash),
        notes: String(body.notes || '').trim().slice(0, 500),
      };
      const { data: opening, error: openingError } = await (supabaseAdmin.from('daily_closings') as any)
        .upsert({
          tenant_id: vendor.tenant_id,
          vendor_id: vendorId,
          business_date: dateStr,
          closed_by: serializeCashControl(cashControl),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'vendor_id,business_date' })
        .select()
        .single();
      if (openingError) throw openingError;
      return NextResponse.json({ opened: true, opening, cash_control: cashControl, message: 'Caixa aberto com sucesso.' });
    }

    if (!currentCashControl || currentCashControl.status !== 'open') {
      return NextResponse.json({ error: 'Abra o caixa antes de fechar o dia.' }, { status: 409 });
    }

    const { count: openAccountCount, error: openAccountError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', vendorId)
      .eq('paid', false)
      .in('status', OPEN_ACCOUNT_STATUSES);
    if (openAccountError) throw openAccountError;
    if (Number(openAccountCount || 0) > 0) {
      return NextResponse.json({
        error: `Existem ${openAccountCount} comanda(s) aberta(s). Receba ou libere todas antes de fechar o caixa.`,
        code: 'OPEN_ACCOUNTS_PENDING',
        open_accounts: openAccountCount,
      }, { status: 409 });
    }

    const report = await buildDailyReport(vendorId, dateStr);
    const cashSales = Number(report.summary.payment_methods.cash?.total || 0);
    const expectedCash = money(currentCashControl.opening_cash + cashSales);
    const countedCash = money(body.counted_cash);
    const difference = Number((countedCash - expectedCash).toFixed(2));
    const allowedReasons = ['discount', 'loss', 'typing_error', 'change_error', 'payment_method_error', 'unregistered_expense', 'cash_withdrawal', 'cash_deposit', 'other'];
    const differenceReason = allowedReasons.includes(String(body.difference_reason)) ? String(body.difference_reason) : '';
    const differenceNotes = String(body.notes || '').trim().slice(0, 500);
    if (Math.abs(difference) >= 0.01 && !differenceReason) {
      return NextResponse.json({ error: 'Informe a justificativa para a diferenca de caixa.', expected_cash: expectedCash, difference }, { status: 400 });
    }
    if (Math.abs(difference) >= 0.01 && differenceNotes.length < 5) {
      return NextResponse.json({ error: 'Descreva em poucas palavras o que causou a diferenca de caixa.', expected_cash: expectedCash, difference }, { status: 400 });
    }
    const closedCashControl: CashControl = {
      ...currentCashControl,
      status: 'closed',
      expected_cash: expectedCash,
      counted_cash: countedCash,
      difference,
      difference_reason: differenceReason || 'no_difference',
      notes: differenceNotes || String(currentCashControl.notes || '').trim().slice(0, 500),
      closed_at: new Date().toISOString(),
      closed_by: session?.role || 'vendor',
    };
    const { data: closing, error: closingErr } = await (supabaseAdmin.from('daily_closings') as any)
      .upsert({
        tenant_id: vendor.tenant_id,
        vendor_id: vendorId,
        business_date: dateStr,
        total_orders: report.summary.total_orders,
        total_revenue: report.summary.total_revenue,
        total_gross_revenue: report.summary.total_gross_revenue,
        total_payment_fees: report.summary.total_payment_fees,
        total_net_revenue: report.summary.total_net_revenue,
        total_items_sold: report.summary.total_items_sold,
        avg_ticket: report.summary.avg_ticket,
        unique_customers: report.summary.unique_customers,
        payment_methods: report.summary.payment_methods,
        top_products: report.top_products,
        hourly_breakdown: report.hourly_breakdown,
        orders_snapshot: report.orders,
        closed_by: serializeCashControl(closedCashControl),
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'vendor_id,business_date' })
      .select()
      .single();

    if (closingErr) throw closingErr;
    const stock_return = await returnBeachStockToPhysical(vendorId);
    await closeKioskSessions(vendorId);

    return NextResponse.json({
      closed: true,
      closing,
      report,
      stock_return,
      cash_control: closedCashControl,
      message: 'Fechamento do dia consolidado com sucesso.',
    });
  } catch (err) {
    console.error('Daily closing error:', err);
    return NextResponse.json({ error: 'Erro ao fechar o dia' }, { status: 500 });
  }
}
