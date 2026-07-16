import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth-session';
import { isRateLimited } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { featureDisabledResponse, vendorFeatureEnabled } from '@/lib/features';
import { normalizeBrazilPhoneWithDdd } from '@/lib/phone';
import { OPEN_ACCOUNT_STATUSES } from '@/lib/order-account';
import { touchKioskSession } from '@/lib/kiosk-session';
import { businessDate, cashControlBlock, getCashControl } from '@/lib/cash-control';

async function ensureOpenAccount({
  tenantId,
  vendorId,
  customerId,
  umbrellaId,
}: {
  tenantId: string | null;
  vendorId: string;
  customerId: string;
  umbrellaId?: string | null;
}) {
  if (!umbrellaId) return null;
  if (!tenantId) throw new Error('Tenant nao identificado para abrir comanda.');

  const { data: openOrders, error: openOrderError } = await supabaseAdmin
    .from('orders')
    .select('id, customer_id, status, paid')
    .eq('vendor_id', vendorId)
    .eq('umbrella_id', umbrellaId)
    .eq('paid', false)
    .in('status', OPEN_ACCOUNT_STATUSES)
    .order('created_at', { ascending: true })
    .limit(1);

  if (openOrderError) throw openOrderError;
  const openOrder = openOrders?.[0];
  if (openOrder) {
    if (openOrder.customer_id !== customerId) {
      return {
        error: 'Este guarda-sol esta com uma conta aberta. Ele sera liberado apos o pagamento.',
      };
    }
    await supabaseAdmin
      .from('umbrellas')
      .update({ is_occupied: true, current_order_id: openOrder.id })
      .eq('id', umbrellaId)
      .eq('vendor_id', vendorId);
    return { orderId: openOrder.id };
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      tenant_id: tenantId,
      vendor_id: vendorId,
      customer_id: customerId,
      umbrella_id: umbrellaId,
      status: 'received',
      total: 0,
      paid: false,
      notes: 'Comanda aberta pelo QR Code',
    } as any)
    .select('id')
    .single();

  if (orderError) throw orderError;

  await supabaseAdmin
    .from('umbrellas')
    .update({ is_occupied: true, current_order_id: order.id })
    .eq('id', umbrellaId)
    .eq('vendor_id', vendorId);

  return { orderId: order.id };
}

export async function POST(req: NextRequest) {
  try {
    if (await isRateLimited(req, 'customer-login', 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { name, phone, vendor_id, umbrella_id, party_size } = await req.json();

    if (!name || !phone || !vendor_id) {
      return NextResponse.json({ error: 'name, phone e vendor_id são obrigatórios.' }, { status: 400 });
    }
    if (!await vendorFeatureEnabled(vendor_id, 'login')) {
      return NextResponse.json(featureDisabledResponse('login'), { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendor_id, 'beach_umbrellas')) {
      return NextResponse.json(featureDisabledResponse('beach_umbrellas'), { status: 403 });
    }

    const cashBlock = cashControlBlock(await getCashControl(vendor_id));
    if (cashBlock) return NextResponse.json({ ...cashBlock, business_date: businessDate() }, { status: 409 });

    let cleanPhone = '';
    try {
      cleanPhone = normalizeBrazilPhoneWithDdd(phone);
    } catch {
      return NextResponse.json({ error: 'Informe um telefone válido com DDD. Exemplo: 1196041957.' }, { status: 400 });
    }
    if (String(name).trim().length < 2) {
      return NextResponse.json({ error: 'Informe nome completo válido.' }, { status: 400 });
    }

    let tenantId: string | null = null;
    let umbrellaState: {
      tenant_id: string;
      vendor_id: string;
      active: boolean;
      is_occupied: boolean;
      current_order_id: string | null;
    } | null = null;
    if (umbrella_id) {
      const { data: umbrella, error: umbrellaError } = await (supabaseAdmin.from('umbrellas') as any)
        .select('tenant_id, vendor_id, active, is_occupied, current_order_id')
        .eq('id', umbrella_id)
        .eq('vendor_id', vendor_id)
        .single();
      if (umbrellaError || !umbrella) {
        return NextResponse.json({ error: 'Guarda-sol nao pertence a este quiosque.' }, { status: 400 });
      }
      if (!umbrella.active) {
        return NextResponse.json({ error: 'Guarda-sol inativo.' }, { status: 400 });
      }
      umbrellaState = umbrella;
      tenantId = umbrella?.tenant_id || null;
    }

    if (!tenantId) {
      const { data: vendor } = await (supabaseAdmin.from('vendors') as any)
        .select('tenant_id')
        .eq('id', vendor_id)
        .single();
      tenantId = vendor?.tenant_id || null;
    }

    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('vendor_id', vendor_id)
      .eq('phone', cleanPhone)
      .single();

    const partySize = Math.max(1, Math.min(50, Number(party_size || 1)));

    if (umbrellaState?.is_occupied || umbrellaState?.current_order_id) {
      const { data: openOrders, error: openOrderError } = await supabaseAdmin
        .from('orders')
        .select('id, customer_id, status, paid')
        .eq('vendor_id', vendor_id)
        .eq('umbrella_id', umbrella_id)
        .eq('paid', false)
        .in('status', OPEN_ACCOUNT_STATUSES)
        .order('created_at', { ascending: true })
        .limit(1);

      if (openOrderError) throw openOrderError;
      const openOrder = openOrders?.[0];
      if (openOrder && (!existing || openOrder.customer_id !== existing.id)) {
        return NextResponse.json({
          error: 'Este guarda-sol esta com uma conta aberta. Ele sera liberado apos o pagamento.',
        }, { status: 409 });
      }
    }

    if (existing) {
      const { data: updated, error } = await supabaseAdmin
        .from('customers')
        .update({
          name,
          visit_count: Number(existing.visit_count || 0) + 1,
          party_size: partySize,
          last_visit_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      const account = await ensureOpenAccount({
        tenantId,
        vendorId: vendor_id,
        customerId: updated.id,
        umbrellaId: umbrella_id,
      });
      if (account?.error) {
        return NextResponse.json({ error: account.error }, { status: 409 });
      }
      await touchKioskSession({
        vendorId: vendor_id,
        customerId: updated.id,
        umbrellaId: umbrella_id,
        userAgent: req.headers.get('user-agent'),
      });
      const token = createSessionToken({ role: 'customer', vendor_id, customer_id: updated.id }, 12 * 60 * 60);
      const response = NextResponse.json({
        ...updated,
        current_order_id: account?.orderId || null,
        returning_customer: true,
        message: `Bem-vindo(a) de volta, ${updated.name || name}!`,
      });
      response.cookies.set({
        name: 'customer_session',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 12 * 60 * 60,
      });
      return response;
    }

    const { data: newCustomer, error } = await supabaseAdmin
      .from('customers')
      .insert({
        tenant_id: tenantId,
        name,
        phone: cleanPhone,
        vendor_id,
        party_size: partySize,
      } as any)
      .select()
      .single();

    if (error) throw error;
    const account = await ensureOpenAccount({
      tenantId,
      vendorId: vendor_id,
      customerId: newCustomer.id,
      umbrellaId: umbrella_id,
    });
    if (account?.error) {
      return NextResponse.json({ error: account.error }, { status: 409 });
    }
    await touchKioskSession({
      vendorId: vendor_id,
      customerId: newCustomer.id,
      umbrellaId: umbrella_id,
      userAgent: req.headers.get('user-agent'),
    });
    const token = createSessionToken({ role: 'customer', vendor_id, customer_id: newCustomer.id }, 12 * 60 * 60);
    const response = NextResponse.json({
      ...newCustomer,
      current_order_id: account?.orderId || null,
      returning_customer: false,
    }, { status: 201 });
    response.cookies.set({
      name: 'customer_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
    });
    return response;
  } catch (err) {
    console.error('Customer login error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
