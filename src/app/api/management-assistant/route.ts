import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

function startOfDay(daysAgo = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

async function buildIntelligence(vendorId: string) {
  const since = startOfDay(56);
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id, customer_id, total, paid, paid_at, created_at, order_items(quantity, unit_price, product_id, products(name, category, cost_price))')
    .eq('vendor_id', vendorId)
    .eq('paid', true)
    .gte('paid_at', since.toISOString());
  if (error) throw error;
  const paidOrders = (orders || []) as any[];
  const today = startOfDay();
  const week = startOfDay(7);
  const todayOrders = paidOrders.filter(order => new Date(order.paid_at || order.created_at) >= today);
  const weekOrders = paidOrders.filter(order => new Date(order.paid_at || order.created_at) >= week);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const weekRevenue = weekOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const weekCost = weekOrders.reduce((sum, order) => sum + (order.order_items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.products?.cost_price || 0) * Number(item.quantity || 0), 0), 0);

  const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
  paidOrders.forEach(order => (order.order_items || []).forEach((item: any) => {
    const id = String(item.product_id || item.products?.name || 'produto');
    const current = productSales.get(id) || { name: item.products?.name || 'Produto', quantity: 0, revenue: 0 };
    current.quantity += Number(item.quantity || 0);
    current.revenue += Number(item.unit_price || 0) * Number(item.quantity || 0);
    productSales.set(id, current);
  }));

  const dayMap = new Map<string, { date: Date; orders: number; revenue: number }>();
  paidOrders.forEach(order => {
    const date = new Date(order.paid_at || order.created_at);
    const key = date.toISOString().slice(0, 10);
    const current = dayMap.get(key) || { date, orders: 0, revenue: 0 };
    current.orders += 1; current.revenue += Number(order.total || 0); dayMap.set(key, current);
  });
  const targetWeekday = new Date(Date.now() + 24 * 60 * 60 * 1000).getDay();
  const comparableDays = Array.from(dayMap.values()).filter(day => day.date.getDay() === targetWeekday).slice(-8);
  const avgOrders = comparableDays.length ? comparableDays.reduce((sum, day) => sum + day.orders, 0) / comparableDays.length : 0;
  const avgRevenue = comparableDays.length ? comparableDays.reduce((sum, day) => sum + day.revenue, 0) / comparableDays.length : 0;
  const peak = Math.max(1, ...Array.from(dayMap.values()).map(day => day.orders));
  const movementPercent = Math.min(100, Math.round(avgOrders / peak * 100));

  const { data: products } = await supabaseAdmin.from('products').select('id, name, stock_tracking_enabled, beach_stock_quantity, stock_quantity, blocked_by_stock').eq('vendor_id', vendorId).eq('active', true);
  const lowStock = ((products || []) as any[]).filter(product => product.stock_tracking_enabled && (product.blocked_by_stock || Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0) <= 10)).map(product => ({ name: product.name, quantity: Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0) })).sort((a, b) => a.quantity - b.quantity);
  const topProduct = Array.from(productSales.values()).sort((a, b) => b.quantity - a.quantity)[0] || null;

  const { data: attributionEvents } = await supabaseAdmin.from('analytics_events').select('metadata').eq('vendor_id', vendorId).eq('event_type', 'staff_order_attribution').gte('created_at', week.toISOString());
  const counts = new Map<string, number>();
  (attributionEvents || []).forEach((event: any) => { const id = String(event.metadata?.user_id || ''); if (id) counts.set(id, (counts.get(id) || 0) + 1); });
  const topStaffId = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  let topStaff: { name: string; orders: number } | null = null;
  if (topStaffId) {
    const { data: user } = await supabaseAdmin.from('vendor_users').select('name').eq('id', topStaffId).maybeSingle();
    topStaff = { name: user?.name || 'Equipe', orders: counts.get(topStaffId) || 0 };
  }

  return {
    today: { revenue: todayRevenue, orders: todayOrders.length, customers: new Set(todayOrders.map(order => order.customer_id)).size },
    week: { revenue: weekRevenue, estimated_profit: Math.max(0, weekRevenue - weekCost) },
    top_product: topProduct,
    top_staff: topStaff,
    low_stock: lowStock.slice(0, 10),
    forecast: {
      day: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR', { weekday: 'long' }),
      movement_percent: movementPercent,
      expected_orders: Math.round(avgOrders),
      expected_revenue: Number(avgRevenue.toFixed(2)),
      sample_days: comparableDays.length,
      suggestion: movementPercent >= 75 ? 'Reforce a equipe e antecipe o estoque dos mais vendidos.' : movementPercent >= 45 ? 'Movimento moderado: mantenha a equipe completa e confira o estoque.' : 'Movimento mais tranquilo: aproveite para promover combos e revisar o estoque.',
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const vendorId = new URL(req.url).searchParams.get('vendor_id') || '';
    if (!isCanonicalUuid(vendorId) || !canAccessVendor(getRequestSession(req), vendorId)) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    return NextResponse.json(await buildIntelligence(vendorId));
  } catch (error) {
    console.error('Management intelligence GET error:', error);
    return NextResponse.json({ error: 'Erro ao gerar previsao.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    if (!isCanonicalUuid(vendorId) || !canAccessVendor(getRequestSession(req), vendorId)) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    const data = await buildIntelligence(vendorId);
    const question = String(body.question || '').toLowerCase();
    let answer = `Hoje voce faturou ${money(data.today.revenue)} em ${data.today.orders} pedidos.`;
    if (question.includes('garçom') || question.includes('garcom') || question.includes('equipe')) answer = data.top_staff ? `${data.top_staff.name} lidera a equipe com ${data.top_staff.orders} pedidos atribuídos nos últimos 7 dias.` : 'Ainda não há vendas atribuídas a usuários da equipe.';
    else if (question.includes('acabando') || question.includes('estoque')) answer = data.low_stock.length ? `Estoque baixo: ${data.low_stock.map(item => `${item.name} (${item.quantity})`).join(', ')}.` : 'Nenhum produto controlado está com estoque baixo.';
    else if (question.includes('lucro')) answer = `O lucro estimado da semana é ${money(data.week.estimated_profit)}, considerando os custos cadastrados nos produtos.`;
    else if (question.includes('comprar') || question.includes('amanhã') || question.includes('amanha')) answer = data.low_stock.length ? `Priorize a compra de ${data.low_stock.slice(0, 5).map(item => item.name).join(', ')}. ${data.forecast.suggestion}` : `O estoque não tem alertas críticos. ${data.forecast.suggestion}`;
    else if (question.includes('produto') && question.includes('mais')) answer = data.top_product ? `${data.top_product.name} é o produto com maior saída: ${data.top_product.quantity} unidades no período analisado.` : 'Ainda não há vendas suficientes para identificar o produto líder.';
    return NextResponse.json({ answer, data });
  } catch (error) {
    console.error('Management assistant POST error:', error);
    return NextResponse.json({ error: 'Erro ao responder.' }, { status: 500 });
  }
}
