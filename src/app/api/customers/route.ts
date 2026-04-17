import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';

/**
 * GET /api/customers?vendor_id=xxx
 * Lista clientes do quiosque (painel vendor / admin).
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não identificado.' }, { status: 400 });
    }

    const vendor_id = new URL(req.url).searchParams.get('vendor_id');
    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório.' }, { status: 400 });
    }
    const session = await getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    }

    const { data, error } = await enforceTenantScope(
      supabaseAdmin
        .from('customers')
        .select('id, name, phone, visit_count, total_spent, last_visit_at, created_at')
        .eq('vendor_id', vendor_id)
        .order('last_visit_at', { ascending: false }),
      tenantId
    );

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Customers GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
