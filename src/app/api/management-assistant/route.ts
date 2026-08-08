import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';
import { fetchWeatherForecast } from '@/lib/weather-forecast';
import { businessDate } from '@/lib/cash-control';

function startOfDay(daysAgo = 0) {
  const reference = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return new Date(`${businessDate(reference)}T00:00:00-03:00`);
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export async function buildIntelligence(vendorId: string) {
  const { data: vendor } = await supabaseAdmin.from('vendors').select('city, state, beach_name').eq('id', vendorId).maybeSingle();
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
  const todayItems = todayOrders.reduce((sum, order) => sum + (order.order_items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.quantity || 0), 0), 0);
  const todayCost = todayOrders.reduce((sum, order) => sum + (order.order_items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.products?.cost_price || 0) * Number(item.quantity || 0), 0), 0);
  const weekCost = weekOrders.reduce((sum, order) => sum + (order.order_items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.products?.cost_price || 0) * Number(item.quantity || 0), 0), 0);

  const productSales = new Map<string, { id: string; name: string; category: string; quantity: number; revenue: number; cost: number; cost_configured: boolean }>();
  const recentProductQuantities = new Map<string, number>();
  const recentCutoff = startOfDay(14);
  paidOrders.forEach(order => (order.order_items || []).forEach((item: any) => {
    const id = String(item.product_id || item.products?.name || 'produto');
    const current = productSales.get(id) || { id, name: item.products?.name || 'Produto', category: item.products?.category || 'Sem categoria', quantity: 0, revenue: 0, cost: 0, cost_configured: true };
    current.quantity += Number(item.quantity || 0);
    current.revenue += Number(item.unit_price || 0) * Number(item.quantity || 0);
    current.cost += Number(item.products?.cost_price || 0) * Number(item.quantity || 0);
    current.cost_configured = current.cost_configured && item.products?.cost_price !== null && item.products?.cost_price !== undefined && Number.isFinite(Number(item.products.cost_price));
    productSales.set(id, current);
    if (new Date(order.paid_at || order.created_at) >= recentCutoff) {
      recentProductQuantities.set(id, (recentProductQuantities.get(id) || 0) + Number(item.quantity || 0));
    }
  }));

  const dayMap = new Map<string, { date: Date; orders: number; revenue: number }>();
  paidOrders.forEach(order => {
    const date = new Date(order.paid_at || order.created_at);
    const key = businessDate(date);
    const current = dayMap.get(key) || { date: new Date(`${key}T12:00:00-03:00`), orders: 0, revenue: 0 };
    current.orders += 1; current.revenue += Number(order.total || 0); dayMap.set(key, current);
  });
  const tomorrowKey = businessDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const tomorrow = new Date(`${tomorrowKey}T12:00:00-03:00`);
  const targetWeekday = tomorrow.getDay();
  const comparableDays = Array.from(dayMap.values()).filter(day => day.date.getDay() === targetWeekday).slice(-8);
  const avgOrders = comparableDays.length ? comparableDays.reduce((sum, day) => sum + day.orders, 0) / comparableDays.length : 0;
  const avgRevenue = comparableDays.length ? comparableDays.reduce((sum, day) => sum + day.revenue, 0) / comparableDays.length : 0;
  const peak = Math.max(1, ...Array.from(dayMap.values()).map(day => day.orders));
  const historicalMovementPercent = Math.min(100, Math.round(avgOrders / peak * 100));
  const weather = vendor?.city ? await fetchWeatherForecast(vendor.city, vendor.state, vendor.beach_name) : { available: false, error: 'Localização não cadastrada.' };
  const rainProbability = Number(weather.precipitation_probability || 0);
  const maxTemperature = Number(weather.temperature_max || 0);
  const weatherAdjustment = !weather.available ? 0 : rainProbability >= 70 ? -25 : rainProbability >= 40 ? -12 : maxTemperature >= 30 ? 15 : maxTemperature >= 26 ? 8 : 0;
  const movementPercent = Math.max(0, Math.min(100, historicalMovementPercent + weatherAdjustment));

  const { data: products } = await supabaseAdmin.from('products').select('id, name, category, stock_tracking_enabled, beach_stock_quantity, stock_quantity, blocked_by_stock').eq('vendor_id', vendorId).eq('active', true);
  const lowStock = ((products || []) as any[]).filter(product => product.stock_tracking_enabled && (product.blocked_by_stock || Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0) <= 10)).map(product => ({ name: product.name, quantity: Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0) })).sort((a, b) => a.quantity - b.quantity);
  const demandFactor = Math.max(0.5, movementPercent / 50);
  const purchaseSuggestions = ((products || []) as any[])
    .filter(product => product.stock_tracking_enabled)
    .map(product => {
      const stock = Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0);
      const soldLast14Days = recentProductQuantities.get(String(product.id)) || 0;
      const expectedDemand = Math.ceil((soldLast14Days / 14) * demandFactor);
      return {
        name: product.name || 'Produto',
        current_stock: stock,
        sold_last_14_days: soldLast14Days,
        expected_demand: expectedDemand,
        suggested_quantity: Math.max(0, Math.ceil(expectedDemand * 1.2 - stock)),
      };
    })
    .filter(product => product.suggested_quantity > 0)
    .sort((a, b) => b.suggested_quantity - a.suggested_quantity)
    .slice(0, 10);
  const productRanking = Array.from(productSales.values());
  const topProduct = [...productRanking].sort((a, b) => b.quantity - a.quantity)[0] || null;
  const highestRevenueProduct = [...productRanking].sort((a, b) => b.revenue - a.revenue)[0] || null;
  const highestProfitProduct = [...productRanking].filter(product => product.cost_configured).map(product => ({ ...product, profit: product.revenue - product.cost })).sort((a, b) => b.profit - a.profit)[0] || null;
  const leastSoldProduct = [...productRanking].filter(product => product.quantity > 0).sort((a, b) => a.quantity - b.quantity)[0] || null;
  const stagnantProducts = ((products || []) as any[]).filter(product => !productSales.has(String(product.id))).map(product => ({ name: String(product.name || 'Produto'), category: String(product.category || 'Sem categoria') })).slice(0, 8);

  const categoryRanking = new Map<string, { category: string; revenue: number; quantity: number }>();
  productRanking.forEach(product => {
    const current = categoryRanking.get(product.category) || { category: product.category, revenue: 0, quantity: 0 };
    current.revenue += product.revenue; current.quantity += product.quantity; categoryRanking.set(product.category, current);
  });
  const topCategory = Array.from(categoryRanking.values()).sort((a, b) => b.revenue - a.revenue)[0] || null;

  const hourFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' });
  const hourlyToday = new Map<string, { orders: number; revenue: number }>();
  todayOrders.forEach(order => {
    const date = new Date(order.paid_at || order.created_at);
    if (Number.isNaN(date.getTime())) return;
    const hour = `${hourFormatter.format(date).replace(/\D/g, '').padStart(2, '0')}h`;
    const current = hourlyToday.get(hour) || { orders: 0, revenue: 0 };
    current.orders += 1; current.revenue += Number(order.total || 0); hourlyToday.set(hour, current);
  });
  const peakHour = Array.from(hourlyToday, ([hour, values]) => ({ hour, ...values })).sort((a, b) => b.revenue - a.revenue)[0] || null;

  const { data: goalEvent } = await supabaseAdmin.from('analytics_events').select('metadata').eq('vendor_id', vendorId).eq('event_type', 'daily_sales_goal_config').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const dailyGoal = Math.max(0, Number((goalEvent as any)?.metadata?.daily_goal || 0));

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
    today: {
      revenue: todayRevenue,
      orders: todayOrders.length,
      customers: new Set(todayOrders.map(order => order.customer_id).filter(Boolean)).size,
      avg_ticket: todayOrders.length ? todayRevenue / todayOrders.length : 0,
      items_sold: todayItems,
      estimated_profit: Math.max(0, todayRevenue - todayCost),
    },
    week: { revenue: weekRevenue, estimated_profit: Math.max(0, weekRevenue - weekCost) },
    top_product: topProduct,
    product_insights: { highest_revenue: highestRevenueProduct, highest_profit: highestProfitProduct, least_sold: leastSoldProduct, stagnant: stagnantProducts },
    top_category: topCategory,
    peak_hour: peakHour,
    goal: { daily: dailyGoal, achieved_percent: dailyGoal > 0 ? Math.min(100, Math.round(todayRevenue / dailyGoal * 100)) : 0, remaining: Math.max(0, dailyGoal - todayRevenue) },
    top_staff: topStaff,
    low_stock: lowStock.slice(0, 10),
    purchase_suggestions: purchaseSuggestions,
    forecast: {
      day: tomorrow.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }),
      movement_percent: movementPercent,
      expected_orders: Math.round(avgOrders),
      expected_revenue: Number(avgRevenue.toFixed(2)),
      sample_days: comparableDays.length,
      historical_percent: historicalMovementPercent,
      weather_adjustment: weatherAdjustment,
      weather,
      suggestion: rainProbability >= 70 ? 'Chuva provável: ajuste a equipe e use promoções para estimular pedidos.' : movementPercent >= 75 ? 'Reforce a equipe e antecipe o estoque dos mais vendidos.' : movementPercent >= 45 ? 'Movimento moderado: mantenha a equipe completa e confira o estoque.' : 'Movimento mais tranquilo: aproveite para promover combos e revisar o estoque.',
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
    const question = String(body.question || '').slice(0, 200).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let answer = `Hoje voce faturou ${money(data.today.revenue)} em ${data.today.orders} pedidos.`;
    if (question.includes('garcom') || question.includes('equipe')) answer = data.top_staff ? `${data.top_staff.name} lidera a equipe com ${data.top_staff.orders} pedidos atribuídos nos últimos 7 dias.` : 'Ainda não há vendas atribuídas a usuários da equipe.';
    else if (question.includes('acabando') || question.includes('estoque')) answer = data.low_stock.length ? `Estoque baixo: ${data.low_stock.map(item => `${item.name} (${item.quantity})`).join(', ')}.` : 'Nenhum produto controlado está com estoque baixo.';
    else if (question.includes('produto') && question.includes('lucro')) answer = data.product_insights.highest_profit ? `${data.product_insights.highest_profit.name} gerou o maior lucro estimado no período: ${money(data.product_insights.highest_profit.profit)} sobre ${money(data.product_insights.highest_profit.revenue)} de faturamento.` : 'Ainda não há vendas com custos suficientes para comparar o lucro dos produtos.';
    else if ((question.includes('produto') && question.includes('fatur')) || question.includes('maior faturamento')) answer = data.product_insights.highest_revenue ? `${data.product_insights.highest_revenue.name} teve o maior faturamento no período: ${money(data.product_insights.highest_revenue.revenue)}, com ${data.product_insights.highest_revenue.quantity} unidades.` : 'Ainda não há vendas suficientes para comparar o faturamento dos produtos.';
    else if (question.includes('parado') || question.includes('sem venda')) answer = data.product_insights.stagnant.length ? `Produtos sem venda nos últimos 56 dias: ${data.product_insights.stagnant.map(item => item.name).join(', ')}.` : 'Nenhum produto ativo está sem vendas no período analisado.';
    else if (question.includes('menos vend') || question.includes('menor saida')) answer = data.product_insights.least_sold ? `${data.product_insights.least_sold.name} teve a menor saída entre os produtos vendidos: ${data.product_insights.least_sold.quantity} unidade(s).` : 'Ainda não há vendas suficientes para identificar o produto de menor saída.';
    else if (question.includes('horario') || question.includes('hora') || question.includes('pico')) answer = data.peak_hour ? `Hoje, o melhor horário foi ${data.peak_hour.hour}, com ${money(data.peak_hour.revenue)} em ${data.peak_hour.orders} pedido(s).` : 'Ainda não há vendas pagas hoje para identificar o horário de pico.';
    else if (question.includes('setor') || question.includes('categoria')) answer = data.top_category ? `${data.top_category.category} lidera o faturamento por setor no período: ${money(data.top_category.revenue)}, com ${data.top_category.quantity} item(ns) vendidos.` : 'Ainda não há vendas suficientes para comparar os setores.';
    else if (question.includes('meta')) answer = data.goal.daily > 0 ? `A meta de hoje é ${money(data.goal.daily)}. Você atingiu ${data.goal.achieved_percent}% e ${data.goal.remaining > 0 ? `faltam ${money(data.goal.remaining)}` : 'a meta já foi alcançada'}.` : 'A meta diária ainda não foi definida. Use o botão “Definir meta diária” no resumo de hoje.';
    else if (question.includes('lucro')) answer = question.includes('hoje') ? `O lucro estimado de hoje é ${money(data.today.estimated_profit)}, considerando os custos cadastrados nos produtos.` : `O lucro estimado da semana é ${money(data.week.estimated_profit)}, considerando os custos cadastrados nos produtos.`;
    else if (question.includes('comprar') || question.includes('amanha') || question.includes('reposi')) answer = data.purchase_suggestions.length ? `Sugestão para amanhã: ${data.purchase_suggestions.slice(0, 5).map(item => `${item.suggested_quantity} un. de ${item.name}`).join(', ')}. A estimativa usa as vendas dos últimos 14 dias, o estoque atual e 20% de segurança.` : `O estoque atual atende à demanda prevista. ${data.forecast.suggestion}`;
    else if (question.includes('produto') && question.includes('mais')) answer = data.top_product ? `${data.top_product.name} é o produto com maior saída: ${data.top_product.quantity} unidades no período analisado.` : 'Ainda não há vendas suficientes para identificar o produto líder.';
    else if (question.includes('ticket')) answer = `O ticket médio de hoje é ${money(data.today.avg_ticket)}.`;
    else if (question.includes('cliente')) answer = `Hoje foram atendidos ${data.today.customers} clientes em ${data.today.orders} pedidos.`;
    else if (question.includes('previs') || question.includes('movimento')) answer = `O movimento previsto para ${data.forecast.day} é de ${data.forecast.movement_percent}%, com cerca de ${data.forecast.expected_orders} pedidos. ${data.forecast.suggestion}`;
    else if (question.includes('semana') || question.includes('7 dias')) answer = `Nos últimos 7 dias o faturamento foi ${money(data.week.revenue)} e o lucro estimado foi ${money(data.week.estimated_profit)}.`;
    return NextResponse.json({ answer, data });
  } catch (error) {
    console.error('Management assistant POST error:', error);
    return NextResponse.json({ error: 'Erro ao responder.' }, { status: 500 });
  }
}
