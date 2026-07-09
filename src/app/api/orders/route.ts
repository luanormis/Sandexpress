import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { featureDisabledResponse, vendorFeatureEnabled } from '@/lib/features';
import { mapOrderForKanban, shouldShowOrderInKanban } from '@/lib/order-kanban';
import { isCanonicalUuid } from '@/lib/uuid';
import { touchKioskSession } from '@/lib/kiosk-session';

const MAX_ORDER_ITEMS = 50;
const MAX_ITEM_QUANTITY = 50;

type IncomingOrderItem = {
  product_id: string;
  quantity: number;
};

function normalizeOrderItems(items: unknown): IncomingOrderItem[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ORDER_ITEMS) return null;

  const merged = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item !== 'object') return null;
    const raw = item as { product_id?: unknown; quantity?: unknown };
    const productId = String(raw.product_id || '').trim();
    const quantity = Number(raw.quantity);
    if (!isCanonicalUuid(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      return null;
    }
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }

  return Array.from(merged.entries()).map(([product_id, quantity]) => ({ product_id, quantity }));
}

function normalizeNotes(value: unknown) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 500) : null;
}

function orderRpcStatus(message: string) {
  if (
    message.includes('conta aberta') ||
    message.includes('fechamento') ||
    message.includes('Estoque insuficiente')
  ) {
    return 409;
  }
  if (
    message.includes('invalido') ||
    message.includes('inativo') ||
    message.includes('indisponivel') ||
    message.includes('nao encontrado') ||
    message.includes('nao pertence')
  ) {
    return 400;
  }
  return 500;
}

/**
 * GET /api/orders?vendor_id=xxx&status=received
 * Lista pedidos de um vendor, filtravel por status.
 *
 * POST /api/orders
 * Cria pedido por RPC transacional no Postgres para evitar corrida de estoque,
 * total da comanda e comanda duplicada no mesmo guarda-sol.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');
    const status = searchParams.get('status');
    const includePaid = searchParams.get('include_paid') === 'true';

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatorio.' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
    }

    if (!await vendorFeatureEnabled(vendor_id, 'operational_dashboard')) {
      return NextResponse.json(featureDisabledResponse('operational_dashboard'), { status: 403 });
    }

    let query = supabaseAdmin
      .from('orders')
      .select(
        '*, order_items(id, order_request_id, quantity, unit_price, subtotal, product_id, cancelled, products(name)), customer_order_requests(id, sequence, subtotal, status, created_at), customers(name, phone), umbrellas!orders_umbrella_id_fkey(number)'
      )
      .eq('vendor_id', vendor_id)
      .order('created_at', { ascending: false });

    if (!includePaid) {
      query = query.eq('paid', false);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    const mapped = (data || []).filter((order: any) => shouldShowOrderInKanban(order)).map((order: any) => {
      const mappedOrder = mapOrderForKanban(order);
      return {
        ...mappedOrder,
        umbrella: order.umbrellas?.number ?? 0,
        customer: order.customers?.name ?? 'Cliente',
        phone: order.customers?.phone ?? '',
        time: mappedOrder.active_request?.created_at
          ? new Date(mappedOrder.active_request.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : order.created_at ? new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      };
    });
    return NextResponse.json(mapped);
  } catch (err) {
    console.error('Orders GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { vendor_id, customer_id, umbrella_id, items, notes } = await req.json();
    const normalizedItems = normalizeOrderItems(items);
    const safeNotes = normalizeNotes(notes);

    if (
      !isCanonicalUuid(vendor_id) ||
      !isCanonicalUuid(customer_id) ||
      !isCanonicalUuid(umbrella_id) ||
      !normalizedItems
    ) {
      return NextResponse.json({ error: 'Dados de pedido incompletos.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }
    if (session.role === 'vendor' && session.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Vendor nao autorizado.' }, { status: 403 });
    }
    if (session.role === 'customer') {
      if (session.vendor_id !== vendor_id || session.customer_id !== customer_id) {
        return NextResponse.json({ error: 'Sessao do cliente invalida para este pedido.' }, { status: 403 });
      }
    }

    if (!await vendorFeatureEnabled(vendor_id, 'orders')) {
      return NextResponse.json(featureDisabledResponse('orders'), { status: 403 });
    }

    if (session.role === 'customer') {
      await touchKioskSession({
        vendorId: vendor_id,
        customerId: customer_id,
        umbrellaId: umbrella_id,
        userAgent: req.headers.get('user-agent'),
      });
    }

    const { data: order, error: orderErr } = await supabaseAdmin.rpc('create_customer_order', {
      p_vendor_id: vendor_id,
      p_customer_id: customer_id,
      p_umbrella_id: umbrella_id,
      p_items: normalizedItems,
      p_notes: safeNotes,
    });

    if (orderErr) {
      const message = orderErr.message || 'Erro ao criar pedido.';
      return NextResponse.json({ error: message }, { status: orderRpcStatus(message) });
    }

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    console.error('Orders POST error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
