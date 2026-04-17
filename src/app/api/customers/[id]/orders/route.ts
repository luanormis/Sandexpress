import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { getTenantIdFromRequest, enforceTenantScope } from '@/lib/tenant-utils';

/**
 * GET /api/customers/[id]/orders
 * Retorna todos os pedidos de um cliente (com itens).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não identificado.' }, { status: 400 });
    }

    const session = await getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { id } = await params;

    const customerLookup = await enforceTenantScope(
      supabaseAdmin
        .from('customers')
        .select('id, vendor_id')
        .eq('id', id),
      tenantId
    ).single();
    if (customerLookup.error || !customerLookup.data) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    }
    if (session.role === 'customer' && session.customer_id !== id) {
      return NextResponse.json({ error: 'Não autorizado para este cliente.' }, { status: 403 });
    }
    if (session.role !== 'customer' && !canAccessVendor(session, customerLookup.data.vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este cliente.' }, { status: 403 });
    }

    const { data, error } = await enforceTenantScope(
      supabaseAdmin
        .from('orders')
        .select('*, order_items(quantity, subtotal, products(name))')
        .eq('customer_id', id)
        .order('created_at', { ascending: false }),
      tenantId
    );

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Customer orders error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
