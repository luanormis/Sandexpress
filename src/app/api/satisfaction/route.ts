import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ORDER_STATUSES = new Set(['closing_requested', 'completed']);

function sanitizeComment(value: unknown) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 300) : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'customer' || !session.customer_id || !session.vendor_id) {
      return NextResponse.json({ error: 'Sessao de cliente obrigatoria.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
    const rating = Number(body?.rating);
    const comment = sanitizeComment(body?.comment);

    if (!UUID_RE.test(orderId) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Avaliacao invalida.' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, tenant_id, vendor_id, customer_id, umbrella_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 });
    }

    if (
      order.vendor_id !== session.vendor_id ||
      order.customer_id !== session.customer_id ||
      (session.tenant_id && order.tenant_id !== session.tenant_id)
    ) {
      return NextResponse.json({ error: 'Avaliacao nao autorizada para este pedido.' }, { status: 403 });
    }

    if (!ALLOWED_ORDER_STATUSES.has(order.status)) {
      return NextResponse.json({ error: 'Avaliacao disponivel apos pedir a conta.' }, { status: 409 });
    }

    const { error: upsertError } = await supabaseAdmin
      .from('customer_satisfaction_surveys')
      .upsert(
        {
          tenant_id: order.tenant_id,
          vendor_id: order.vendor_id,
          customer_id: order.customer_id,
          order_id: order.id,
          umbrella_id: order.umbrella_id,
          rating,
          comment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_id,customer_id' }
      );

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Satisfaction survey error:', err);
    return NextResponse.json({ error: 'Nao foi possivel registrar a avaliacao.' }, { status: 500 });
  }
}
