import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';

const OPEN_ACCOUNT_STATUSES = ['received', 'preparing', 'delivering', 'completed'];

function buildPixPayload(input: {
  vendorName: string;
  pixKey: string;
  amount: number;
  umbrellaId: string;
  customerId: string;
}) {
  return [
    'SANDEXPRESS_PIX_ACCOUNT',
    `QUIOSQUE=${input.vendorName}`,
    `CHAVE=${input.pixKey}`,
    `VALOR=${input.amount.toFixed(2)}`,
    `GUARDA_SOL=${input.umbrellaId}`,
    `CLIENTE=${input.customerId}`,
  ].join('|');
}

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'customer' || !session.customer_id || !session.vendor_id) {
      return NextResponse.json({ error: 'Cliente nao autenticado.' }, { status: 401 });
    }

    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant nao identificado.' }, { status: 400 });
    }

    const body = await req.json();
    const umbrellaId = body.umbrella_id || session.umbrella_id;
    const requestedPaymentMethod = body.payment_method === 'pix' ? 'pix' : 'cash';

    if (!umbrellaId) {
      return NextResponse.json({ error: 'Guarda-sol nao informado.' }, { status: 400 });
    }

    let { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors')
      .select('id, name, pix_enabled, pix_key, pix_account_name')
      .eq('id', session.vendor_id)
      .single();

    if (vendorError && String(vendorError.message || '').includes('pix_enabled')) {
      const fallback = await supabaseAdmin
        .from('vendors')
        .select('id, name')
        .eq('id', session.vendor_id)
        .single();
      vendor = fallback.data as any;
      vendorError = fallback.error;
    }

    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    const { data: orders, error: ordersError } = await enforceTenantScope(
      supabaseAdmin
        .from('orders')
        .select('id, total, status, payment_method, paid')
        .eq('vendor_id', session.vendor_id)
        .eq('customer_id', session.customer_id)
        .eq('umbrella_id', umbrellaId)
        .in('status', OPEN_ACCOUNT_STATUSES)
        .or('paid.is.null,paid.eq.false')
        .order('created_at', { ascending: true }),
      tenantId
    );

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'Nenhuma conta aberta encontrada para este cliente.' }, { status: 404 });
    }

    const total = orders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);
    const orderIds = orders.map((order: any) => order.id);
    const pixEnabled = Boolean(vendor.pix_enabled && vendor.pix_key);
    const paymentMethod = requestedPaymentMethod === 'pix' && pixEnabled ? 'pix' : 'cash';
    const pixPayload = paymentMethod === 'pix'
      ? buildPixPayload({
          vendorName: vendor.pix_account_name || vendor.name,
          pixKey: vendor.pix_key,
          amount: total,
          umbrellaId,
          customerId: session.customer_id,
        })
      : null;

    const closeRequestUpdate = {
      pending_close: true,
      payment_method: paymentMethod,
      pix_payload: pixPayload,
      close_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { error: updateError } = await enforceTenantScope(
      supabaseAdmin
        .from('orders')
        .update(closeRequestUpdate)
        .in('id', orderIds),
      tenantId
    );

    if (updateError && /pix_payload|close_requested_at/.test(String(updateError.message || ''))) {
      const legacyUpdate: Partial<typeof closeRequestUpdate> = { ...closeRequestUpdate };
      delete legacyUpdate.pix_payload;
      delete legacyUpdate.close_requested_at;
      const fallback = await enforceTenantScope(
        supabaseAdmin
          .from('orders')
          .update(legacyUpdate)
          .in('id', orderIds),
        tenantId
      );
      updateError = fallback.error;
    }

    if (updateError) throw updateError;

    const pixQrImageUrl = pixPayload ? await QRCode.toDataURL(pixPayload, { width: 360, margin: 2 }) : null;

    return NextResponse.json({
      success: true,
      order_ids: orderIds,
      total,
      payment_method: paymentMethod,
      pix_enabled: pixEnabled,
      pix_qr_image_url: pixQrImageUrl,
      message: paymentMethod === 'pix'
        ? 'Conta enviada ao quiosque. Pague o PIX e aguarde a confirmacao.'
        : 'Conta enviada ao quiosque. Aguarde o garcom para fechar.',
    });
  } catch (err) {
    console.error('Request close account error:', err);
    return NextResponse.json({ error: 'Erro ao solicitar fechamento da conta.' }, { status: 500 });
  }
}
