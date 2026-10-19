import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, verifySessionToken } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { OPEN_ACCOUNT_STATUSES } from '@/lib/order-account';
import { touchKioskSession } from '@/lib/kiosk-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = verifySessionToken(req.cookies.get('customer_session')?.value);
    if (session?.role !== 'customer' || !session.customer_id || !session.vendor_id) {
      return NextResponse.json({ error: 'Sessao do cliente nao encontrada.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const umbrellaId = searchParams.get('umbrella_id');
    const vendorId = searchParams.get('vendor_id');
    if (!umbrellaId || (vendorId && vendorId !== session.vendor_id)) {
      return NextResponse.json({ error: 'Este acesso nao corresponde a comanda salva.' }, { status: 403 });
    }

    const { data: umbrella, error: umbrellaError } = await supabaseAdmin
      .from('umbrellas')
      .select('id, vendor_id, active')
      .eq('id', umbrellaId)
      .eq('vendor_id', session.vendor_id)
      .single();
    if (umbrellaError || !umbrella || !umbrella.active) {
      return NextResponse.json({ error: 'Guarda-sol indisponivel.' }, { status: 404 });
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, vendor_id, name, phone, party_size')
      .eq('id', session.customer_id)
      .eq('vendor_id', session.vendor_id)
      .single();
    if (customerError || !customer) {
      return NextResponse.json({ error: 'Cliente nao encontrado.' }, { status: 404 });
    }

    const { data: openOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('vendor_id', session.vendor_id)
      .eq('umbrella_id', umbrellaId)
      .eq('customer_id', customer.id)
      .eq('paid', false)
      .in('status', OPEN_ACCOUNT_STATUSES)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!openOrder) return NextResponse.json({ error: 'Nao ha uma comanda aberta neste guarda-sol.' }, { status: 404 });

    await touchKioskSession({
      vendorId: session.vendor_id,
      customerId: customer.id,
      umbrellaId,
      userAgent: req.headers.get('user-agent'),
    });

    const token = createSessionToken({
      role: 'customer',
      vendor_id: session.vendor_id,
      customer_id: customer.id,
      umbrella_id: umbrellaId,
    }, 12 * 60 * 60);
    const response = NextResponse.json({ ...customer, current_order_id: openOrder.id });
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
  } catch (error) {
    console.error('Customer session restore error:', error);
    return NextResponse.json({ error: 'Nao foi possivel recuperar a comanda.' }, { status: 500 });
  }
}
