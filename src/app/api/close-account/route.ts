import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';

const OPEN_ACCOUNT_STATUSES = ['received', 'preparing', 'delivering'];

/**
 * POST /api/close-account
 * Fechar conta do cliente (após pagamento confirmado)
 *
 * Body: {
 *   vendor_id,
 *   umbrella_id OR (customer_phone),
 *   payment_method (optional),
 *   notes (optional)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || (session.role !== 'vendor' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não identificado.' }, { status: 400 });
    }

    const body = await req.json();
    const vendor_id = body.vendor_id || session.vendor_id;
    const { umbrella_id, customer_phone, payment_method, notes } = body;

    if (!vendor_id || (!umbrella_id && !customer_phone)) {
      return NextResponse.json(
        { error: 'vendor_id e (umbrella_id ou customer_phone) são obrigatórios' },
        { status: 400 }
      );
    }

    if (session.role === 'vendor' && session.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    let query = enforceTenantScope(
      supabaseAdmin
        .from('orders')
        .select('id, customer_id, umbrella_id, total, status, created_at, customers(id, name, phone)')
        .eq('vendor_id', vendor_id)
        .in('status', OPEN_ACCOUNT_STATUSES)
        .or('paid.is.null,paid.eq.false')
        .order('created_at', { ascending: true }),
      tenantId
    );

    if (umbrella_id) {
      query = query.eq('umbrella_id', umbrella_id);
    }

    const { data: orders, error: ordersErr } = await query;

    if (ordersErr) throw ordersErr;

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma conta aberta encontrada para este guarda-sol/cliente' },
        { status: 404 }
      );
    }

    let selectedOrders = orders;
    if (customer_phone && orders.length > 1) {
      const cleanInput = customer_phone.replace(/\D/g, '');
      const matchingOrders = orders.filter((o: any) => {
        const cleanPhone = (o.customers?.phone || '').replace(/\D/g, '');
        return cleanPhone === cleanInput;
      });
      if (matchingOrders.length > 0) selectedOrders = matchingOrders;
      else if (!umbrella_id) {
        return NextResponse.json({ error: 'Nenhuma conta aberta encontrada para este cliente.' }, { status: 404 });
      }
    }

    const orderIds = selectedOrders.map((order: any) => order.id);
    const firstOrder = selectedOrders[0];
    const total = selectedOrders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);

    const closeUpdate = {
      status: 'completed',
      paid: true,
      payment_method: payment_method || 'cash',
      pending_close: false,
      paid_at: new Date().toISOString(),
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    let { error: updateErr } = await enforceTenantScope(
      supabaseAdmin
        .from('orders')
        .update(closeUpdate)
        .in('id', orderIds),
      tenantId
    );

    if (updateErr && String(updateErr.message || '').includes('paid_at')) {
      const legacyCloseUpdate: Partial<typeof closeUpdate> = { ...closeUpdate };
      delete legacyCloseUpdate.paid_at;
      const fallback = await enforceTenantScope(
        supabaseAdmin
          .from('orders')
          .update(legacyCloseUpdate)
          .in('id', orderIds),
        tenantId
      );
      updateErr = fallback.error;
    }

    if (updateErr) throw updateErr;

    const { error: customerErr } = await enforceTenantScope(
      supabaseAdmin
        .from('customers')
        .update({
          last_visit_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', firstOrder.customer_id),
      tenantId
    );

    if (customerErr) throw customerErr;

    const { error: umbrellaErr } = await enforceTenantScope(
      supabaseAdmin
        .from('umbrellas')
        .update({
          is_occupied: false,
          current_order_id: null,
        })
        .eq('id', firstOrder.umbrella_id)
        .eq('vendor_id', vendor_id),
      tenantId
    );

    if (umbrellaErr) throw umbrellaErr;

    return NextResponse.json(
      {
        success: true,
        account: {
          order_ids: orderIds,
          customer_id: firstOrder.customer_id,
          customer_name: (firstOrder as any).customers?.name,
          customer_phone: (firstOrder as any).customers?.phone,
          umbrella_id: firstOrder.umbrella_id,
          total,
          status: 'completed',
          paid: true,
          payment_method: payment_method || 'cash',
          closed_at: new Date().toISOString(),
          umbrella_released: true,
        },
        message: `Conta fechada com sucesso! Guarda-sol ${firstOrder.umbrella_id} liberado.`,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Close account error:', err);
    return NextResponse.json({ error: 'Erro ao fechar conta' }, { status: 500 });
  }
}

/**
 * GET /api/close-account?vendor_id=xxx&umbrella_id=yyy
 * Buscar conta aberta para fechar (preview)
 */
export async function GET(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || (session.role !== 'vendor' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id') || session.vendor_id;
    const umbrella_id = searchParams.get('umbrella_id');
    const customer_phone = searchParams.get('customer_phone');
    const tenantId = getTenantIdFromRequest(req);

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant nÃ£o identificado.' }, { status: 400 });
    }

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório' }, { status: 400 });
    }
    if (session.role === 'vendor' && session.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    if (!umbrella_id && !customer_phone) {
      return NextResponse.json({ error: 'umbrella_id ou customer_phone obrigatório' }, { status: 400 });
    }

    let query = enforceTenantScope(
      supabaseAdmin
        .from('orders')
        .select('id, customer_id, umbrella_id, total, status, created_at, order_items(id), customers(id, name, phone)')
        .eq('vendor_id', vendor_id)
        .in('status', OPEN_ACCOUNT_STATUSES)
        .or('paid.is.null,paid.eq.false'),
      tenantId
    );

    if (umbrella_id) {
      query = query.eq('umbrella_id', umbrella_id);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma conta aberta encontrada' },
        { status: 404 }
      );
    }

    let selectedOrders = orders;
    if (customer_phone && orders.length > 1) {
      const cleanPhone = customer_phone.replace(/\D/g, '');
      const matching = orders.filter((o: any) => {
        const orderPhone = (o.customers?.phone || '').replace(/\D/g, '');
        return orderPhone === cleanPhone;
      });
      if (matching.length > 0) selectedOrders = matching;
      else if (!umbrella_id) {
        return NextResponse.json({ error: 'Nenhuma conta aberta encontrada para este cliente.' }, { status: 404 });
      }
    }

    const firstOrder = selectedOrders[0];

    return NextResponse.json({
      order_ids: selectedOrders.map((order: any) => order.id),
      customer_id: firstOrder.customer_id,
      customer_name: (firstOrder as any).customers?.name,
      customer_phone: (firstOrder as any).customers?.phone,
      umbrella_id: firstOrder.umbrella_id,
      total: selectedOrders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0),
      items_count: selectedOrders.reduce((sum: number, order: any) => sum + ((order as any).order_items?.length || 0), 0),
      created_at: firstOrder.created_at,
      opened_at: firstOrder.created_at,
    });
  } catch (err) {
    console.error('Close account GET error:', err);
    return NextResponse.json({ error: 'Erro ao buscar conta' }, { status: 500 });
  }
}
