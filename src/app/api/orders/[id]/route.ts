import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

const ALLOWED_ORDER_FIELDS = new Set(['status', 'notes']);
const PRODUCTIVE_STATUSES = new Set(['preparing', 'delivering', 'completed', 'closing_requested']);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const safeUpdate: Record<string, unknown> = {};
    for (const field of ALLOWED_ORDER_FIELDS) {
      if (field in body) safeUpdate[field] = body[field];
    }
    if (Object.keys(safeUpdate).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo valido para atualizar.' }, { status: 400 });
    }

    const { data: lookup, error: lookupError } = await supabaseAdmin
      .from('orders')
      .select('id, vendor_id, tenant_id, umbrella_id, total, status, paid, order_items(id), customer_order_requests(id, status, sequence)')
      .eq('id', id)
      .single();

    if (lookupError || !lookup) {
      return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 });
    }
    if (!canAccessVendor(session, lookup.vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este pedido.' }, { status: 403 });
    }

    const itemCount = Array.isArray((lookup as any).order_items) ? (lookup as any).order_items.length : 0;
    const isEmptyAccount = Number((lookup as any).total || 0) <= 0 || itemCount === 0;
    if (safeUpdate.status && PRODUCTIVE_STATUSES.has(String(safeUpdate.status)) && isEmptyAccount) {
      return NextResponse.json({
        error: 'Comanda vazia nao pode ir para preparo, entrega ou fechamento. Use "Liberar guarda-sol vazio".',
      }, { status: 409 });
    }

    const requests = (((lookup as any).customer_order_requests || []) as any[])
      .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
    const activeRequest = [...requests]
      .reverse()
      .find((request) => ['received', 'preparing', 'delivering'].includes(String(request.status)));

    const requestedStatus = typeof safeUpdate.status === 'string' ? String(safeUpdate.status) : null;
    if (requestedStatus && ['preparing', 'delivering', 'completed'].includes(requestedStatus) && activeRequest) {
      const { error: requestUpdateError } = await (supabaseAdmin.from('customer_order_requests') as any)
        .update({ status: requestedStatus, updated_at: new Date().toISOString() })
        .eq('id', activeRequest.id)
        .eq('order_id', id);
      if (requestUpdateError) throw requestUpdateError;

      const hasRemainingActiveRequests = requests.some((request) => (
        request.id !== activeRequest.id &&
        ['received', 'preparing', 'delivering'].includes(String(request.status))
      ));
      const nextOrderStatus = requestedStatus === 'completed' && !hasRemainingActiveRequests ? 'completed' : requestedStatus;
      safeUpdate.status = nextOrderStatus;
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ ...safeUpdate, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('vendor_id', lookup.vendor_id)
      .select()
      .single();

    if (error) throw error;
    if (safeUpdate.status === 'cancelled' && (data as any)?.umbrella_id) {
      await supabaseAdmin
        .from('umbrellas')
        .update({ is_occupied: false, current_order_id: null, updated_at: new Date().toISOString() })
        .eq('id', (data as any).umbrella_id)
        .eq('vendor_id', lookup.vendor_id);
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('Order PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, products(name))')
      .eq('id', id)
      .single();

    if (error) throw error;
    const order = data as { vendor_id: string } | null;
    if (!order) {
      return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 });
    }
    if (!canAccessVendor(session, order.vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este pedido.' }, { status: 403 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('Order GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
