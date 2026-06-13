import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';

const OPEN_ACCOUNT_STATUSES = ['received', 'preparing', 'delivering', 'completed', 'closing_requested'];
const WAITER_MARKER = '[WAITER_CALL]';

type WaiterCallBody = {
  vendor_id?: string;
  customer_id?: string;
  umbrella_id?: string;
};

type OpenOrder = {
  id: string;
  customer_id: string;
  notes: string | null;
  status: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const { vendor_id, customer_id, umbrella_id } = (await req.json()) as WaiterCallBody;

    if (!vendor_id || !customer_id || !umbrella_id) {
      return NextResponse.json({ error: 'vendor_id, customer_id e umbrella_id sao obrigatorios.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }
    if (session.role !== 'customer' || session.vendor_id !== vendor_id || session.customer_id !== customer_id) {
      return NextResponse.json({ error: 'Sessao de cliente invalida para chamar o garcom.' }, { status: 403 });
    }

    const { data: umbrella, error: umbrellaErr } = await supabaseAdmin
      .from('umbrellas')
      .select('id, tenant_id, vendor_id, active')
      .eq('id', umbrella_id)
      .eq('vendor_id', vendor_id)
      .single();

    if (umbrellaErr || !umbrella) {
      return NextResponse.json({ error: 'Guarda-sol invalido.' }, { status: 400 });
    }
    if (!umbrella.active) {
      return NextResponse.json({ error: 'Guarda-sol inativo.' }, { status: 400 });
    }

    const { data: openOrders, error: openErr } = await supabaseAdmin
      .from('orders')
      .select('id, customer_id, notes, status')
      .eq('vendor_id', vendor_id)
      .eq('umbrella_id', umbrella_id)
      .eq('paid', false)
      .in('status', OPEN_ACCOUNT_STATUSES)
      .order('created_at', { ascending: true })
      .limit(1);

    if (openErr) throw openErr;

    const waiterNote = `${WAITER_MARKER} Cliente solicitou garcom em ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    let order = openOrders?.[0] as OpenOrder | undefined;

    if (order && order.customer_id !== customer_id) {
      return NextResponse.json({ error: 'Este guarda-sol esta em uso por outro cliente.' }, { status: 409 });
    }

    if (order) {
      const nextNotes = [order.notes, waiterNote].filter(Boolean).join('\n');
      const { data: updatedOrder, error: updateErr } = await supabaseAdmin
        .from('orders')
        .update({
          notes: nextNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .select()
        .single();

      if (updateErr) throw updateErr;
      order = updatedOrder as OpenOrder;
    } else {
      const { data: newOrder, error: insertErr } = await supabaseAdmin
        .from('orders')
        .insert({
          tenant_id: umbrella.tenant_id,
          vendor_id,
          customer_id,
          umbrella_id,
          total: 0,
          status: 'received',
          paid: false,
          notes: waiterNote,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      order = newOrder as OpenOrder;
    }

    await supabaseAdmin
      .from('umbrellas')
      .update({ is_occupied: true, current_order_id: order.id } as never)
      .eq('id', umbrella_id)
      .eq('vendor_id', vendor_id);

    return NextResponse.json({
      success: true,
      order,
      message: 'Garcom solicitado no painel do quiosque.',
    });
  } catch (err) {
    console.error('Waiter call error:', err);
    return NextResponse.json({ error: 'Erro ao chamar garcom.' }, { status: 500 });
  }
}
