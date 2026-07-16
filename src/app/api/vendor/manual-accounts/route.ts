import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { vendorFeatureEnabled, featureDisabledResponse } from '@/lib/features';
import { OPEN_ACCOUNT_STATUSES } from '@/lib/order-account';
import { normalizeBrazilPhoneWithDdd } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';
import { businessDate, cashControlBlock, getCashControl } from '@/lib/cash-control';

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const umbrellaId = String(body.umbrella_id || '');
    const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);

    if (!isCanonicalUuid(vendorId) || !isCanonicalUuid(umbrellaId) || name.length < 2) {
      return NextResponse.json({ error: 'Informe guarda-sol, nome e telefone validos.' }, { status: 400 });
    }
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendorId, 'orders')) {
      return NextResponse.json(featureDisabledResponse('orders'), { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendorId, 'beach_umbrellas')) {
      return NextResponse.json(featureDisabledResponse('beach_umbrellas'), { status: 403 });
    }

    const cashBlock = cashControlBlock(await getCashControl(vendorId));
    if (cashBlock) return NextResponse.json({ ...cashBlock, business_date: businessDate() }, { status: 409 });

    let phone = '';
    try {
      phone = normalizeBrazilPhoneWithDdd(body.phone);
    } catch {
      return NextResponse.json({ error: 'Informe um telefone valido com DDD.' }, { status: 400 });
    }

    const { data: umbrella, error: umbrellaError } = await supabaseAdmin
      .from('umbrellas')
      .select('id, tenant_id, vendor_id, number, active, is_occupied, current_order_id')
      .eq('id', umbrellaId)
      .eq('vendor_id', vendorId)
      .single();

    if (umbrellaError || !umbrella) {
      return NextResponse.json({ error: 'Guarda-sol nao encontrado.' }, { status: 404 });
    }
    if (!umbrella.active) {
      return NextResponse.json({ error: 'Ative o guarda-sol antes de abrir a comanda.' }, { status: 409 });
    }

    const { data: openOrders, error: openOrderError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('vendor_id', vendorId)
      .eq('umbrella_id', umbrellaId)
      .eq('paid', false)
      .in('status', OPEN_ACCOUNT_STATUSES)
      .limit(1);
    if (openOrderError) throw openOrderError;
    if (umbrella.is_occupied || umbrella.current_order_id || openOrders?.length) {
      return NextResponse.json({ error: 'Este guarda-sol ja possui uma comanda aberta.' }, { status: 409 });
    }

    const { data: existingCustomer, error: customerLookupError } = await supabaseAdmin
      .from('customers')
      .select('id, visit_count')
      .eq('vendor_id', vendorId)
      .eq('phone', phone)
      .maybeSingle();
    if (customerLookupError) throw customerLookupError;

    const now = new Date().toISOString();
    let customerId = existingCustomer?.id;
    if (existingCustomer) {
      const { error } = await supabaseAdmin.from('customers').update({
        name,
        visit_count: Number(existingCustomer.visit_count || 0) + 1,
        last_visit_at: now,
        updated_at: now,
      } as any).eq('id', existingCustomer.id);
      if (error) throw error;
    } else {
      const { data: customer, error } = await supabaseAdmin.from('customers').insert({
        tenant_id: umbrella.tenant_id,
        vendor_id: vendorId,
        name,
        phone,
        party_size: 1,
        visit_count: 1,
        last_visit_at: now,
      } as any).select('id').single();
      if (error) throw error;
      customerId = customer.id;
    }

    const { data: order, error: orderError } = await supabaseAdmin.from('orders').insert({
      tenant_id: umbrella.tenant_id,
      vendor_id: vendorId,
      customer_id: customerId,
      umbrella_id: umbrellaId,
      status: 'received',
      total: 0,
      paid: false,
      notes: 'Comanda aberta manualmente pelo quiosque',
    } as any).select('id').single();
    if (orderError) throw orderError;

    const { error: occupyError } = await supabaseAdmin.from('umbrellas').update({
      is_occupied: true,
      current_order_id: order.id,
      updated_at: now,
    } as any).eq('id', umbrellaId).eq('vendor_id', vendorId);
    if (occupyError) {
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      throw occupyError;
    }

    return NextResponse.json({
      order_id: order.id,
      customer_id: customerId,
      umbrella_id: umbrellaId,
      umbrella_number: umbrella.number,
    }, { status: 201 });
  } catch (error) {
    console.error('Manual account POST error:', error);
    return NextResponse.json({ error: 'Nao foi possivel abrir a comanda.' }, { status: 500 });
  }
}
