import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchArchivedOrders } from '@/lib/order-archive';
import { returnBeachStockToPhysical } from '@/lib/stock-handler';

type PaymentSummary = Record<string, { count: number; gross: number; fees: number; net: number; total: number }>;

function dayRange(dateStr: string) {
  return {
    startOfDay: new Date(`${dateStr}T00:00:00-03:00`).toISOString(),
    endOfDay: new Date(`${dateStr}T23:59:59.999-03:00`).toISOString(),
  };
}

async function buildDailyReport(vendorId: string, dateStr: string) {
  const { startOfDay, endOfDay } = dayRange(dateStr);

  const { data: orders, error: ordersErr } = await supabaseAdmin
    .from('orders')
    .select('id, umbrella_id, customer_id, total, gross_total, payment_fee_amount, net_total, status, paid, payment_method, created_at, paid_at, order_items(quantity, unit_price, product_id), customers(name, phone), umbrellas!orders_umbrella_id_fkey(number)')
    .eq('vendor_id', vendorId)
    .eq('paid', true)
    .gte('paid_at', startOfDay)
    .lte('paid_at', endOfDay)
    .order('paid_at', { ascending: true });

  if (ordersErr) throw ordersErr;

  const archivedOrders = await fetchArchivedOrders({
    vendorId,
    startDate: startOfDay,
    endDate: endOfDay,
  });

  const completedOrders = [...(orders || []), ...archivedOrders.filter((order: any) => Boolean(order.paid))];
  const totalRevenue = completedOrders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);
  const totalGrossRevenue = completedOrders.reduce((sum: number, order: any) => sum + Number(order.gross_total || order.total || 0), 0);
  const totalPaymentFees = completedOrders.reduce((sum: number, order: any) => sum + Number(order.payment_fee_amount || 0), 0);
  const totalNetRevenue = completedOrders.reduce((sum: number, order: any) => sum + Number(order.net_total || order.total || 0), 0);
  const totalItems = completedOrders.reduce((sum: number, order: any) => {
    return sum + (order.order_items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.quantity || 0), 0);
  }, 0);
  const avgTicket = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
  const uniqueCustomers = new Set(completedOrders.map((order: any) => order.customer_id)).size;

  const paymentMethods: PaymentSummary = {};
  completedOrders.forEach((order: any) => {
    const method = order.payment_method || 'cash';
    if (!paymentMethods[method]) paymentMethods[method] = { count: 0, gross: 0, fees: 0, net: 0, total: 0 };
    paymentMethods[method].count += 1;
    paymentMethods[method].gross += Number(order.gross_total || order.total || 0);
    paymentMethods[method].fees += Number(order.payment_fee_amount || 0);
    paymentMethods[method].net += Number(order.net_total || order.total || 0);
    paymentMethods[method].total += Number(order.total || 0);
  });

  const productIds = new Set<string>();
  completedOrders.forEach((order: any) => {
    (order.order_items || []).forEach((item: any) => {
      if (item.product_id) productIds.add(item.product_id);
    });
  });

  const productNameMap: Record<string, string> = {};
  if (productIds.size > 0) {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .in('id', Array.from(productIds));
    (products || []).forEach((product: any) => {
      productNameMap[product.id] = product.name;
    });
  }

  const productsMap: Record<string, { name: string; quantity: number; revenue: number; product_id: string }> = {};
  completedOrders.forEach((order: any) => {
    (order.order_items || []).forEach((item: any) => {
      const productId = item.product_id;
      if (!productId) return;
      if (!productsMap[productId]) {
        productsMap[productId] = {
          name: productNameMap[productId] || item.products?.name || 'Produto desconhecido',
          quantity: 0,
          revenue: 0,
          product_id: productId,
        };
      }
      const quantity = Number(item.quantity || 0);
      productsMap[productId].quantity += quantity;
      productsMap[productId].revenue += Number(item.unit_price || 0) * quantity;
    });
  });

  const topProducts = Object.values(productsMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const hourlyMap: Record<string, { orders: number; revenue: number }> = {};
  completedOrders.forEach((order: any) => {
    const hour = new Date(order.paid_at || order.created_at).getHours().toString().padStart(2, '0');
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
      total_items_sold: totalItems,
      avg_ticket: avgTicket,
      unique_customers: uniqueCustomers,
      payment_methods: paymentMethods,
    },
    orders: formattedOrders,
    top_products: topProducts,
    hourly_breakdown: hourlyBreakdown,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendor_id');
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!vendorId) {
      return NextResponse.json({ error: 'vendor_id obrigatorio' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
    }

    return NextResponse.json(await buildDailyReport(vendorId, dateStr));
  } catch (err) {
    console.error('Daily report error:', err);
    return NextResponse.json({ error: 'Erro ao gerar relatorio' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vendorId = body.vendor_id;
    const dateStr = body.date || new Date().toISOString().split('T')[0];

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

    const report = await buildDailyReport(vendorId, dateStr);
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
        closed_by: session?.role || 'vendor',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'vendor_id,business_date' })
      .select()
      .single();

    if (closingErr) throw closingErr;
    const stock_return = await returnBeachStockToPhysical(vendorId);

    return NextResponse.json({
      closed: true,
      closing,
      report,
      stock_return,
      message: 'Fechamento do dia consolidado com sucesso.',
    });
  } catch (err) {
    console.error('Daily closing error:', err);
    return NextResponse.json({ error: 'Erro ao fechar o dia' }, { status: 500 });
  }
}
