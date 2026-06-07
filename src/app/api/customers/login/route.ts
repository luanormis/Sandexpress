import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth-session';
import { isRateLimited } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    if (await isRateLimited(req, 'customer-login', 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { name, phone, vendor_id, umbrella_id, party_size } = await req.json();

    if (!name || !phone || !vendor_id) {
      return NextResponse.json({ error: 'name, phone e vendor_id sao obrigatorios.' }, { status: 400 });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (String(name).trim().length < 2 || cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Informe nome e celular validos.' }, { status: 400 });
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

    const partySize = Math.max(1, Math.min(50, Number(party_size || 1)));

    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('vendor_id', vendor_id)
      .eq('phone', cleanPhone)
      .single();

    if (umbrellaState?.is_occupied || umbrellaState?.current_order_id) {
      const { data: openOrders, error: openOrderError } = await supabaseAdmin
        .from('orders')
        .select('id, customer_id, status, paid')
        .eq('vendor_id', vendor_id)
        .eq('umbrella_id', umbrella_id)
        .eq('paid', false)
        .in('status', ['received', 'preparing', 'delivering', 'closing_requested'])
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
      const token = createSessionToken({ role: 'customer', vendor_id, customer_id: updated.id }, 12 * 60 * 60);
      const response = NextResponse.json(updated);
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
    const token = createSessionToken({ role: 'customer', vendor_id, customer_id: newCustomer.id }, 12 * 60 * 60);
    const response = NextResponse.json(newCustomer, { status: 201 });
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
