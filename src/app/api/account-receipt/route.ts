import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendor_id');
    const orderId = searchParams.get('order_id');
    if (!vendorId || !orderId) return NextResponse.json({ error: 'vendor_id e order_id são obrigatórios.' }, { status: 400 });
    if (!canAccessVendor(getRequestSession(req), vendorId)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });

    const { data: order, error } = await supabaseAdmin.from('orders')
      .select('id, total, created_at, customers(name, phone), umbrellas!orders_umbrella_id_fkey(number)')
      .eq('id', orderId).eq('vendor_id', vendorId).single();
    if (error || !order) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
    const { data: items, error: itemsError } = await supabaseAdmin.from('order_items')
      .select('id, quantity, unit_price, subtotal, cancelled, products(name)')
      .eq('order_id', orderId);
    if (itemsError) throw itemsError;
    const umbrella = (order as any).umbrellas;
    return NextResponse.json({
      total: Number((order as any).total || 0),
      created_at: (order as any).created_at,
      customer_name: (order as any).customers?.name || 'Cliente',
      customer_phone: (order as any).customers?.phone || '',
      umbrella_number: Array.isArray(umbrella) ? umbrella[0]?.number : umbrella?.number,
      items: (items || []).map((item: any) => ({ name: item.products?.name || 'Produto', quantity: Number(item.quantity || 0), unit_price: Number(item.unit_price || 0), subtotal: Number(item.subtotal || 0), cancelled: Boolean(item.cancelled) })),
    });
  } catch (error) {
    console.error('Account receipt error:', error);
    return NextResponse.json({ error: 'Não foi possível preparar a conta para impressão.' }, { status: 500 });
  }
}
