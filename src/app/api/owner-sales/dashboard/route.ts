import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSalesSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';

function startOfDayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const session = getOwnerSalesSession(req);
    if (!session?.vendor_id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    const vendorId = session.vendor_id;
    const [vendorResult, ordersResult, productsResult, goalResult] = await Promise.all([
      supabaseAdmin.from('vendors').select('id, name, owner_name').eq('id', vendorId).single(),
      supabaseAdmin.from('orders').select('id, total, status, paid, created_at, paid_at, order_items(quantity, subtotal, cancelled, products(name))').eq('vendor_id', vendorId).gte('created_at', startOfDayIso()).order('created_at', { ascending: false }),
      supabaseAdmin.from('products').select('id, name, stock_tracking_enabled, beach_stock_quantity, stock_quantity, blocked_by_stock').eq('vendor_id', vendorId).eq('active', true),
      supabaseAdmin.from('analytics_events').select('metadata').eq('vendor_id', vendorId).eq('event_type', 'owner_sales_goal').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (vendorResult.error) throw vendorResult.error;
    if (ordersResult.error) throw ordersResult.error;
    if (productsResult.error) throw productsResult.error;

    const orders = (ordersResult.data || []) as any[];
    const paid = orders.filter(order => order.paid || order.paid_at || order.status === 'completed');
    const revenue = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    paid.forEach(order => (order.order_items || []).filter((item: any) => !item.cancelled).forEach((item: any) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const name = String(product?.name || 'Produto');
      const current = productMap.get(name) || { name, quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity || 0);
      current.revenue += Number(item.subtotal || 0);
      productMap.set(name, current);
    }));
    const products = (productsResult.data || []) as any[];
    const lowStock = products.filter(product => product.stock_tracking_enabled && (product.blocked_by_stock || Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0) <= 5));
    const dailyGoal = Math.max(0, Number((goalResult.data as any)?.metadata?.daily_goal || 0));

    return NextResponse.json({
      vendor: vendorResult.data,
      updated_at: new Date().toISOString(),
      sales: { revenue, orders: paid.length, open_orders: orders.length - paid.length, average_ticket: paid.length ? revenue / paid.length : 0, daily_goal: dailyGoal, goal_progress: dailyGoal > 0 ? Math.min(100, (revenue / dailyGoal) * 100) : 0 },
      top_products: [...productMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8),
      inventory: { active_products: products.length, low_stock_count: lowStock.length, low_stock: lowStock.slice(0, 10).map(product => ({ id: product.id, name: product.name, quantity: Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0) })) },
      recent_orders: orders.slice(0, 10).map(order => ({ id: order.id, total: Number(order.total || 0), status: order.status, created_at: order.created_at })),
    });
  } catch (error) {
    console.error('Owner sales dashboard error:', error);
    return NextResponse.json({ error: 'Erro ao carregar vendas reais.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getOwnerSalesSession(req);
    if (!session?.vendor_id || !session.tenant_id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const dailyGoal = Number(body.daily_goal);
    if (!Number.isFinite(dailyGoal) || dailyGoal < 0 || dailyGoal > 10_000_000) return NextResponse.json({ error: 'Meta diária inválida.' }, { status: 400 });
    const { error } = await supabaseAdmin.from('analytics_events').insert({ tenant_id: session.tenant_id, vendor_id: session.vendor_id, event_type: 'owner_sales_goal', metadata: { daily_goal: dailyGoal }, payload: { source: 'owner_sales_dashboard' } } as any);
    if (error) throw error;
    return NextResponse.json({ saved: true, daily_goal: dailyGoal });
  } catch (error) {
    console.error('Owner sales goal error:', error);
    return NextResponse.json({ error: 'Erro ao salvar meta.' }, { status: 500 });
  }
}
