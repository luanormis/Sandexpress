import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchArchivedOrders } from '@/lib/order-archive';

type VendorRow = {
  id: string;
  name: string | null;
  address: string | null;
  beach_name: string | null;
  city: string | null;
  state: string | null;
  subscription_status: string | null;
  plan_type: string | null;
  plan_monthly_price: number | null;
  plan_annual_monthly_price: number | null;
  is_active: boolean | null;
};

type SatisfactionVendorSummary = {
  name: string;
  city: string;
  beach: string;
  average_rating: number;
  total_responses: number;
};

function getVendorPlanAmount(vendor: {
  plan_type: string | null;
  plan_monthly_price: number | null;
  plan_annual_monthly_price: number | null;
}) {
  if (vendor.plan_type === 'trial') return 0;
  if (vendor.plan_type === 'annual' || vendor.plan_type === '12months') {
    return Number(vendor.plan_annual_monthly_price ?? 299.99);
  }
  return Number(vendor.plan_monthly_price ?? 499.99);
}

function includesFilter(value: string | null | undefined, filter: string) {
  return !filter || String(value || '').toLowerCase().includes(filter);
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export async function GET(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendor_id') || '';
    const city = (searchParams.get('city') || '').trim().toLowerCase();
    const beach = (searchParams.get('beach') || '').trim().toLowerCase();
    const productFilter = (searchParams.get('product') || '').trim().toLowerCase();
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const { data: vendors, error: vendorsError } = await supabaseAdmin
      .from('vendors')
      .select('id, name, address, beach_name, city, state, subscription_status, plan_type, plan_monthly_price, plan_annual_monthly_price, is_active');

    if (vendorsError) throw vendorsError;

    const allVendors = (vendors || []) as VendorRow[];
    const vendorMap = new Map(allVendors.map((vendor) => [vendor.id, vendor]));
    const selectedVendors = allVendors.filter((vendor) => {
      if (vendorId && vendor.id !== vendorId) return false;
      if (!includesFilter(vendor.city, city)) return false;
      if (!includesFilter(vendor.beach_name || vendor.address, beach)) return false;
      return true;
    });
    const selectedVendorIds = new Set(selectedVendors.map((vendor) => vendor.id));

    const active_vendors = allVendors.filter((v) => v.subscription_status === 'active' && v.is_active).length;
    const trial_vendors = allVendors.filter((v) => v.subscription_status === 'trial').length;
    const overdue_vendors = allVendors.filter((v) => v.subscription_status === 'overdue').length;
    const blocked_vendors = allVendors.filter((v) => v.subscription_status === 'blocked' || !v.is_active).length;

    const next_cycle_receivable = allVendors
      .filter((v) => v.subscription_status !== 'blocked')
      .reduce((sum, v) => sum + getVendorPlanAmount(v), 0);

    const overdue_amount = allVendors
      .filter((v) => v.subscription_status === 'overdue')
      .reduce((sum, v) => sum + getVendorPlanAmount(v), 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let orderQuery = supabaseAdmin
      .from('orders')
      .select(
        'id, vendor_id, customer_id, total, status, paid, payment_method, created_at, order_items(quantity, unit_price, subtotal, product_id, products(name, category)), customers(visit_count)'
      )
      .neq('status', 'cancelled')
      .gte('created_at', from || monthStart.toISOString());

    if (to) {
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      orderQuery = orderQuery.lte('created_at', endDate.toISOString());
    }

    const { data: orders, error: ordersError } = await orderQuery;
    if (ordersError) throw ordersError;

    const archiveEndDate = to
      ? (() => {
          const endDate = new Date(to);
          endDate.setHours(23, 59, 59, 999);
          return endDate.toISOString();
        })()
      : new Date().toISOString();
    const archivedOrders = await fetchArchivedOrders({
      vendorId: vendorId || undefined,
      startDate: from || monthStart.toISOString(),
      endDate: archiveEndDate,
    });

    const filteredOrders = [...(orders || []), ...archivedOrders].filter((order: any) => selectedVendorIds.has(order.vendor_id));
    const countedCustomers = new Set<string>();
    const productAgg = new Map<string, { product_id: string; name: string; category: string; quantity: number; revenue: number; orders: number }>();
    const categoryAgg = new Map<string, { category: string; quantity: number; revenue: number }>();
    const cityAgg = new Map<string, { city: string; quantity: number; revenue: number; orders: number }>();
    const beachAgg = new Map<string, { beach: string; city: string; quantity: number; revenue: number; orders: number }>();
    const vendorAgg = new Map<string, { name: string; city: string; beach: string; revenue: number; orders: number; visitors: number }>();
    const hourlyAgg = new Map<number, { hour: number; orders: number; quantity: number; revenue: number }>();
    const productHourlyAgg = new Map<string, { product: string; category: string; hour: number; quantity: number; revenue: number }>();

    let totalProductsSold = 0;

    let satisfactionRows: any[] = [];
    if (selectedVendorIds.size > 0) {
      let satisfactionQuery = supabaseAdmin
        .from('customer_satisfaction_surveys')
        .select('vendor_id, rating, created_at')
        .gte('created_at', from || monthStart.toISOString())
        .in('vendor_id', Array.from(selectedVendorIds));

      if (to) {
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        satisfactionQuery = satisfactionQuery.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await satisfactionQuery;
      if (error && !['42P01', 'PGRST205'].includes(error.code)) throw error;
      satisfactionRows = (data || []) as any[];
    }

    const satisfactionVendorAgg = new Map<string, { sum: number; count: number }>();
    satisfactionRows.forEach((row) => {
      const rating = Number(row.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) return;
      const current = satisfactionVendorAgg.get(row.vendor_id) || { sum: 0, count: 0 };
      current.sum += rating;
      current.count += 1;
      satisfactionVendorAgg.set(row.vendor_id, current);
    });

    const satisfaction_total = satisfactionRows.length;
    const satisfaction_sum = satisfactionRows.reduce((sum, row) => sum + Number(row.rating || 0), 0);
    const satisfaction_by_vendor: SatisfactionVendorSummary[] = Array.from(satisfactionVendorAgg.entries())
      .map(([vendorKey, value]) => {
        const vendor = vendorMap.get(vendorKey);
        return {
          name: vendor?.name || 'Quiosque',
          city: vendor?.city || 'Sem cidade',
          beach: vendor?.beach_name || vendor?.address || 'Sem praia/localizacao',
          average_rating: Math.round((value.sum / value.count) * 10) / 10,
          total_responses: value.count,
        };
      })
      .sort((a, b) => b.average_rating - a.average_rating || b.total_responses - a.total_responses)
      .slice(0, 10);

    filteredOrders.forEach((order: any) => {
      const vendor = vendorMap.get(order.vendor_id);
      const vendorName = vendor?.name || 'Quiosque';
      const vendorCity = vendor?.city || 'Sem cidade';
      const vendorBeach = vendor?.beach_name || vendor?.address || 'Sem praia/localizacao';
      const orderRevenue = Number(order.total || 0);
      const hour = new Date(order.created_at).getHours();

      if (order.customer_id) countedCustomers.add(order.customer_id);

      const currentVendor = vendorAgg.get(order.vendor_id) || {
        name: vendorName,
        city: vendorCity,
        beach: vendorBeach,
        revenue: 0,
        orders: 0,
        visitors: 0,
      };
      currentVendor.revenue += orderRevenue;
      currentVendor.orders += 1;
      currentVendor.visitors = countedCustomers.size;
      vendorAgg.set(order.vendor_id, currentVendor);

      const currentHour = hourlyAgg.get(hour) || { hour, orders: 0, quantity: 0, revenue: 0 };
      currentHour.orders += 1;
      currentHour.revenue += orderRevenue;
      hourlyAgg.set(hour, currentHour);

      const items = Array.isArray(order.order_items) ? order.order_items : [];
      items.forEach((item: any) => {
        const product = firstRelation<{ name?: string; category?: string }>(item.products);
        const productName = product?.name || 'Produto';
        const category = product?.category || 'Sem categoria';
        if (productFilter && !`${productName} ${category}`.toLowerCase().includes(productFilter)) return;

        const quantity = Number(item.quantity || 0);
        const revenue = Number(item.subtotal ?? Number(item.unit_price || 0) * quantity);
        totalProductsSold += quantity;

        const productKey = item.product_id || productName;
        const currentProduct = productAgg.get(productKey) || {
          product_id: productKey,
          name: productName,
          category,
          quantity: 0,
          revenue: 0,
          orders: 0,
        };
        currentProduct.quantity += quantity;
        currentProduct.revenue += revenue;
        currentProduct.orders += 1;
        productAgg.set(productKey, currentProduct);

        const currentCategory = categoryAgg.get(category) || { category, quantity: 0, revenue: 0 };
        currentCategory.quantity += quantity;
        currentCategory.revenue += revenue;
        categoryAgg.set(category, currentCategory);

        const currentCity = cityAgg.get(vendorCity) || { city: vendorCity, quantity: 0, revenue: 0, orders: 0 };
        currentCity.quantity += quantity;
        currentCity.revenue += revenue;
        currentCity.orders += 1;
        cityAgg.set(vendorCity, currentCity);

        const beachKey = `${vendorCity}:${vendorBeach}`;
        const currentBeach = beachAgg.get(beachKey) || { beach: vendorBeach, city: vendorCity, quantity: 0, revenue: 0, orders: 0 };
        currentBeach.quantity += quantity;
        currentBeach.revenue += revenue;
        currentBeach.orders += 1;
        beachAgg.set(beachKey, currentBeach);

        const updatedHour = hourlyAgg.get(hour) || { hour, orders: 0, quantity: 0, revenue: 0 };
        updatedHour.quantity += quantity;
        hourlyAgg.set(hour, updatedHour);

        const productHourKey = `${productKey}:${hour}`;
        const productHour = productHourlyAgg.get(productHourKey) || { product: productName, category, hour, quantity: 0, revenue: 0 };
        productHour.quantity += quantity;
        productHour.revenue += revenue;
        productHourlyAgg.set(productHourKey, productHour);
      });
    });

    const gmv = filteredOrders.reduce((acc: number, order: any) => acc + Number(order.total || 0), 0);
    const hourly_sales = Array.from(hourlyAgg.values()).sort((a, b) => a.hour - b.hour);
    const peak_hour = hourly_sales.reduce(
      (best, current) => (current.revenue > best.revenue ? current : best),
      { hour: 0, orders: 0, quantity: 0, revenue: 0 }
    );

    return NextResponse.json({
      gmv,
      total_orders: filteredOrders.length,
      total_customers: countedCustomers.size,
      total_visitors: countedCustomers.size,
      total_products_sold: totalProductsSold,
      avg_ticket: filteredOrders.length > 0 ? gmv / filteredOrders.length : 0,
      satisfaction_average: satisfaction_total > 0 ? Math.round((satisfaction_sum / satisfaction_total) * 10) / 10 : 0,
      satisfaction_total,
      satisfaction_by_vendor,
      active_vendors,
      trial_vendors,
      overdue_vendors,
      blocked_vendors,
      retention_rate: 0,
      top_vendors: Array.from(vendorAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      top_products: Array.from(productAgg.values()).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 20),
      top_categories: Array.from(categoryAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      top_cities: Array.from(cityAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      top_beaches: Array.from(beachAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      hourly_sales,
      peak_hour,
      peak_product_hours: Array.from(productHourlyAgg.values())
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
        .slice(0, 10),
      monthly_received: gmv,
      next_cycle_receivable,
      overdue_amount,
      filter_options: {
        vendors: allVendors.map((v) => ({ id: v.id, name: v.name || 'Quiosque' })),
        cities: Array.from(new Set(allVendors.map((v) => v.city).filter(Boolean))).sort(),
        beaches: Array.from(new Set(allVendors.map((v) => v.beach_name || v.address).filter(Boolean))).sort(),
      },
    });
  } catch (err) {
    console.error('Platform reports error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
