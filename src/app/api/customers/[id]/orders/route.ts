import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }

    const { id } = await params;
    const vendorId = new URL(req.url).searchParams.get('vendor_id') || session.vendor_id;

    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, vendor_id')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Cliente nao encontrado.' }, { status: 404 });
    }
    if (vendorId && customer.vendor_id !== vendorId) {
      return NextResponse.json({ error: 'Cliente nao pertence a este quiosque.' }, { status: 403 });
    }
    if (session.role === 'customer' && session.customer_id !== id) {
      return NextResponse.json({ error: 'Nao autorizado para este cliente.' }, { status: 403 });
    }
    if (session.role !== 'customer' && !canAccessVendor(session, customer.vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este cliente.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, total, status, created_at, customer_order_requests(id, sequence, subtotal, status, created_at)')
      .eq('customer_id', id)
      .eq('vendor_id', customer.vendor_id)
      .eq('paid', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const orderLines = (data || []).flatMap((order: any) => {
      const requests = Array.isArray(order.customer_order_requests) ? order.customer_order_requests : [];
      if (requests.length === 0) return [order];
      return requests
        .sort((a: any, b: any) => Number(b.sequence || 0) - Number(a.sequence || 0))
        .map((request: any) => ({
          id: request.id,
          account_id: order.id,
          sequence: request.sequence,
          total: Number(request.subtotal || 0),
          account_total: Number(order.total || 0),
          status: request.status || order.status,
          account_status: order.status,
          created_at: request.created_at || order.created_at,
        }));
    });
    return NextResponse.json(orderLines);
  } catch (err) {
    console.error('Customer orders error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
