import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { vendorFeatureEnabled, featureDisabledResponse } from '@/lib/features';
import { toMoney } from '@/lib/payments';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';
import { accountAmountsWithServiceFee } from '@/lib/service-fee';

const PAYMENT_METHODS = new Set(['cash', 'pix', 'debit_card', 'credit_card']);
const OPEN_STATUSES = ['received', 'preparing', 'delivering', 'completed', 'closing_requested'];

type PaymentRow = {
  id: string;
  created_at: string;
  metadata?: { order_id?: string; amount?: number; payment_method?: string; payer_name?: string; note?: string } | null;
  payload?: { staff_user_id?: string | null; staff_name?: string | null } | null;
};

async function loadPayments(vendorId: string, orderId: string) {
  const { data, error } = await supabaseAdmin.from('analytics_events')
    .select('id, metadata, payload, created_at')
    .eq('vendor_id', vendorId)
    .eq('event_type', 'partial_account_payment')
    .contains('metadata', { order_id: orderId })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data || []) as PaymentRow[]).map(row => ({
    id: row.id,
    amount: toMoney(row.metadata?.amount),
    payment_method: String(row.metadata?.payment_method || 'cash'),
    payer_name: String(row.metadata?.payer_name || 'Cliente'),
    note: String(row.metadata?.note || ''),
    staff_user_id: row.payload?.staff_user_id || null,
    staff_name: row.payload?.staff_name || null,
    created_at: row.created_at,
  }));
}

async function loadOpenOrder(vendorId: string, orderId: string) {
  const { data, error } = await supabaseAdmin.from('orders')
    .select('id, tenant_id, vendor_id, umbrella_id, customer_id, total, status, paid, notes')
    .eq('id', orderId).eq('vendor_id', vendorId).single();
  if (error || !data) return null;
  return data as any;
}

export async function GET(req: NextRequest) {
  try {
    const vendorId = req.nextUrl.searchParams.get('vendor_id') || '';
    const orderId = req.nextUrl.searchParams.get('order_id') || '';
    const session = getRequestSession(req);
    if (!isCanonicalUuid(vendorId) || !isCanonicalUuid(orderId) || !canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }
    const order = await loadOpenOrder(vendorId, orderId);
    if (!order) return NextResponse.json({ error: 'Comanda nao encontrada.' }, { status: 404 });
    const totals = accountAmountsWithServiceFee(order);
    const payments = await loadPayments(vendorId, orderId);
    const paidAmount = toMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
    return NextResponse.json({ order_id: orderId, total: totals.accountTotal, base_total: totals.baseTotal, service_fee_amount: totals.serviceFeeAmount, paid_amount: paidAmount, remaining_amount: toMoney(Math.max(0, totals.accountTotal - paidAmount)), payments, closed: Boolean(order.paid) });
  } catch (err) {
    console.error('Account payments GET error:', err);
    return NextResponse.json({ error: 'Erro ao carregar pagamentos da comanda.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const orderId = String(body.order_id || '');
    const amount = toMoney(body.amount);
    const paymentMethod = String(body.payment_method || 'cash');
    const payerName = String(body.payer_name || 'Cliente').trim().slice(0, 100) || 'Cliente';
    const note = String(body.note || '').trim().slice(0, 300);
    const idempotencyKey = isCanonicalUuid(String(body.idempotency_key || '')) ? String(body.idempotency_key) : null;
    if (!isCanonicalUuid(vendorId) || !isCanonicalUuid(orderId) || !canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendorId, 'cashier')) return NextResponse.json(featureDisabledResponse('cashier'), { status: 403 });
    if (amount <= 0 || !PAYMENT_METHODS.has(paymentMethod)) return NextResponse.json({ error: 'Valor e forma de pagamento invalidos.' }, { status: 400 });

    const order = await loadOpenOrder(vendorId, orderId);
    const totals = order ? accountAmountsWithServiceFee(order) : { baseTotal: 0, serviceFeeAmount: 0, accountTotal: 0 };
    if (order && idempotencyKey) {
      const { data: duplicate } = await supabaseAdmin.from('analytics_events')
        .select('id, created_at').eq('vendor_id', vendorId).eq('event_type', 'partial_account_payment')
        .contains('metadata', { order_id: orderId, idempotency_key: idempotencyKey }).limit(1).maybeSingle();
      if (duplicate) {
        const payments = await loadPayments(vendorId, orderId);
        const paidAmount = toMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
        return NextResponse.json({ id: duplicate.id, created_at: duplicate.created_at, paid_amount: paidAmount, remaining_amount: toMoney(Math.max(0, totals.accountTotal - paidAmount)), closed: Boolean(order.paid), duplicate: true });
      }
    }
    if (!order || order.paid || !OPEN_STATUSES.includes(String(order.status))) {
      return NextResponse.json({ error: 'Esta comanda nao esta aberta para recebimento.' }, { status: 409 });
    }
    const previousPayments = await loadPayments(vendorId, orderId);
    const paidBefore = toMoney(previousPayments.reduce((sum, payment) => sum + payment.amount, 0));
    const remainingBefore = toMoney(Math.max(0, totals.accountTotal - paidBefore));
    if (amount > remainingBefore + 0.009) {
      return NextResponse.json({ error: `O valor excede o saldo restante de R$ ${remainingBefore.toFixed(2).replace('.', ',')}.` }, { status: 409 });
    }

    const { data: staff } = session?.user_id ? await supabaseAdmin.from('vendor_users').select('name').eq('id', session.user_id).maybeSingle() : { data: null } as any;
    const { data: event, error } = await supabaseAdmin.from('analytics_events').insert({
      tenant_id: order.tenant_id,
      vendor_id: vendorId,
      customer_id: order.customer_id,
      umbrella_id: order.umbrella_id,
      event_type: 'partial_account_payment',
      metadata: { order_id: orderId, amount, payment_method: paymentMethod, payer_name: payerName, note, idempotency_key: idempotencyKey },
      payload: { staff_user_id: session?.user_id || null, staff_name: staff?.name || null },
    } as any).select('id, created_at').single();
    if (error) throw error;

    const paidAmount = toMoney(paidBefore + amount);
    const remainingAmount = toMoney(Math.max(0, totals.accountTotal - paidAmount));
    let closed = false;
    if (remainingAmount <= 0.009) {
      const allPayments = [...previousPayments, { amount, payment_method: paymentMethod, payer_name: payerName }];
      const paymentSummary = allPayments.map((payment, index) => `${index + 1}. ${payment.payer_name}: R$ ${payment.amount.toFixed(2).replace('.', ',')} (${payment.payment_method})`).join('\n');
      const { error: closeError } = await supabaseAdmin.rpc('close_customer_account', {
        p_vendor_id: vendorId,
        p_umbrella_id: order.umbrella_id,
        p_customer_phone: null,
        p_session_customer_id: null,
        p_request_only: false,
        p_payment_method: paymentMethod,
        p_notes: [order.notes, '--- Conta compartilhada ---', paymentSummary].filter(Boolean).join('\n'),
      });
      if (closeError) {
        if (event?.id) await supabaseAdmin.from('analytics_events').delete().eq('id', event.id).eq('vendor_id', vendorId);
        throw closeError;
      }
      closed = true;
    }

    return NextResponse.json({ id: event?.id, created_at: event?.created_at, base_total: totals.baseTotal, service_fee_amount: totals.serviceFeeAmount, total: totals.accountTotal, paid_amount: paidAmount, remaining_amount: remainingAmount, closed }, { status: 201 });
  } catch (err) {
    console.error('Account payments POST error:', err);
    return NextResponse.json({ error: 'Erro ao registrar pagamento parcial.' }, { status: 500 });
  }
}
