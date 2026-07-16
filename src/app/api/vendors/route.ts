import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { DEFAULT_FEATURES } from '@/lib/features';
import { fetchAllSupabaseRows } from '@/lib/supabase-pagination';

type AdminVendorRow = Record<string, unknown> & { tenant_id?: string | null };
type WaiterServiceFeatureRow = { tenant_id: string; enabled: boolean | null };

/**
 * GET /api/vendors?status=active
 * Lista todos os vendors (para admin).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('vendors')
      .select('id, tenant_id, name, owner_name, owner_phone, owner_email, cpf, cnpj, document_login, address, city, state, beach_name, logo_url, primary_color, secondary_color, button_color, button_text_color, subscription_status, plan_type, trial_ends_at, plan_expires_at, plan_monthly_price, plan_quarterly_price, plan_semester_price, plan_annual_monthly_price, max_umbrellas, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('subscription_status', status);

    const { data, error } = await query;
    if (error) throw error;

    const { rows: waiterServiceRows } = await fetchAllSupabaseRows<WaiterServiceFeatureRow>(
      (from, to) => supabaseAdmin
        .from('tenant_features')
        .select('tenant_id, enabled')
        .eq('feature_key', 'waiter_service')
        .range(from, to),
      { maxRows: 10_000 },
    );
    const waiterServiceByTenant = new Map(
      waiterServiceRows.map((row) => [row.tenant_id, Boolean(row.enabled)]),
    );
    return NextResponse.json(((data || []) as AdminVendorRow[]).map((vendor) => ({
      ...vendor,
      waiter_service_enabled: waiterServiceByTenant.get(String(vendor.tenant_id)) ?? DEFAULT_FEATURES.waiter_service,
    })));
  } catch (err) {
    console.error('Vendors GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
