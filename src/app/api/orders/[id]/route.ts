import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

/**
 * PATCH /api/orders/[id]
 * Atualiza status de um pedido (received → preparing → delivering → completed).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const orderLookup = await supabaseAdmin.from('orders').select('vendor_id').eq('id', id).single();
    if (orderLookup.error || !orderLookup.data) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }
    if (!canAccessVendor(session, orderLookup.data.vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este pedido.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Order PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

/**
 * GET /api/orders/[id]
 * Retorna um pedido específico com itens.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, products(name))')
      .eq('id', id)
      .single();

    if (error) throw error;
    const order = data as { vendor_id: string } | null;
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }
    if (!canAccessVendor(session, order.vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este pedido.' }, { status: 403 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('Order GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
