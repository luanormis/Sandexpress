import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';
import { verifyAdminCredentials } from '@/lib/admin-auth';

const ALLOWED_UMBRELLA_FIELDS = new Set(['active', 'label', 'location_hint', 'qr_url']);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant nao identificado.' }, { status: 400 });
    }

    const { id } = await params;

    const { data, error } = await enforceTenantScope(
      supabaseAdmin
        .from('umbrellas')
        .select('id, number, label, active, vendor_id')
        .eq('id', id),
      tenantId
    ).single();

    if (error || !data) {
      return NextResponse.json({ error: 'Guarda-sol nao encontrado.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Umbrella GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant nao identificado.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const safeUpdate: {
      active?: boolean | null;
      label?: string | null;
      location_hint?: string | null;
      qr_url?: string | null;
    } = {};
    for (const field of ALLOWED_UMBRELLA_FIELDS) {
      if (!(field in body)) continue;
      if (field === 'active') safeUpdate.active = body.active as boolean | null;
      if (field === 'label') safeUpdate.label = body.label as string | null;
      if (field === 'location_hint') safeUpdate.location_hint = body.location_hint as string | null;
      if (field === 'qr_url') safeUpdate.qr_url = body.qr_url as string | null;
    }
    if (Object.keys(safeUpdate).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo valido para atualizar.' }, { status: 400 });
    }

    const umbrellaLookup = await enforceTenantScope(
      supabaseAdmin.from('umbrellas').select('vendor_id').eq('id', id),
      tenantId
    ).single();
    if (umbrellaLookup.error || !umbrellaLookup.data) {
      return NextResponse.json({ error: 'Guarda-sol nao encontrado.' }, { status: 404 });
    }
    if (!canAccessVendor(session, umbrellaLookup.data.vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este guarda-sol.' }, { status: 403 });
    }

    const { data, error } = await enforceTenantScope(
      supabaseAdmin
        .from('umbrellas')
        .update(safeUpdate)
        .eq('id', id)
        .select(),
      tenantId
    ).single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Umbrella PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Somente admin pode remover guarda-sol.' }, { status: 403 });
    }

    const { admin_username, admin_password } = await req.json();
    if (!verifyAdminCredentials(admin_username, admin_password)) {
      return NextResponse.json({ error: 'Senha de admin invalida para exclusao.' }, { status: 401 });
    }

    const { id } = await params;

    const umbrellaLookup = await supabaseAdmin
      .from('umbrellas')
      .select('vendor_id, is_occupied')
      .eq('id', id)
      .single();

    if (umbrellaLookup.error || !umbrellaLookup.data) {
      return NextResponse.json({ error: 'Guarda-sol nao encontrado.' }, { status: 404 });
    }
    if (umbrellaLookup.data.is_occupied) {
      return NextResponse.json({ error: 'Nao e possivel remover guarda-sol com conta aberta.' }, { status: 409 });
    }

    const { data: relatedOrders, error: ordersLookupError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('umbrella_id', id);

    if (ordersLookupError) throw ordersLookupError;

    const orderIds = ((relatedOrders || []) as { id: string }[]).map((order) => order.id);
    if (orderIds.length > 0) {
      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .delete()
        .in('order_id', orderIds);
      if (itemsError) throw itemsError;

      const { error: ordersError } = await supabaseAdmin
        .from('orders')
        .delete()
        .in('id', orderIds);
      if (ordersError) throw ordersError;
    }

    const { error } = await supabaseAdmin
      .from('umbrellas')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Umbrella DELETE error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
