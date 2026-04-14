import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';

const PLAN_PRICES: Record<string, number> = {
  monthly: 199,
  '6months': 165,
  '12months': 149,
  trial: 199,
};

function getVendorPlanAmount(vendor: { plan_type: string | null }) {
  return PLAN_PRICES[vendor.plan_type || 'monthly'] ?? PLAN_PRICES.monthly;
}

/**
 * GET /api/reports/platform
 * Relatórios da plataforma (para admin).
 * GMV, total de pedidos, faturamento e inadimplência.
 */
export async function GET(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    // Contar vendors por status
    const { data: vendors } = await supabaseAdmin.from('vendors').select('subscription_status, plan_type, is_active');
    const allVendors = vendors || [];
    const active_vendors = allVendors.filter(v => v.subscription_status === 'active' && v.is_active).length;
    const trial_vendors = allVendors.filter(v => v.subscription_status === 'trial').length;
    const overdue_vendors = allVendors.filter(v => v.subscription_status === 'overdue').length;
    const blocked_vendors = allVendors.filter(v => v.subscription_status === 'blocked' || !v.is_active).length;

    const next_cycle_receivable = allVendors
      .filter(v => v.subscription_status !== 'blocked')
      .reduce((sum, v) => sum + getVendorPlanAmount(v), 0);

    const overdue_amount = allVendors
      .filter(v => v.subscription_status === 'overdue')
      .reduce((sum, v) => sum + getVendorPlanAmount(v), 0);

    // GMV do mês atual
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('total')
      .gte('created_at', monthStart.toISOString());

    const allOrders = orders || [];
    const gmv = allOrders.reduce((acc, o) => acc + Number(o.total), 0);

    return NextResponse.json({
      gmv,
      total_orders: allOrders.length,
      total_customers: 0,
      avg_ticket: allOrders.length > 0 ? gmv / allOrders.length : 0,
      active_vendors,
      trial_vendors,
      overdue_vendors,
      blocked_vendors,
      retention_rate: 0,
      top_vendors: [],
      monthly_received: gmv,
      next_cycle_receivable,
      overdue_amount,
    });
  } catch (err) {
    console.error('Platform reports error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
