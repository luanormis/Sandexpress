import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyVendorPassword } from '@/lib/vendor-password';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');
    const customer_id = searchParams.get('customer_id');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatorio.' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('account_adjustments')
      .select('*')
      .eq('vendor_id', vendor_id)
      .order('created_at', { ascending: false });

    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Adjustments GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      vendor_id,
      vendor_password,
      customer_id,
      order_id,
      adjustment_type,
      amount,
      reason,
      description,
    } = await req.json();

    if (!vendor_id || !vendor_password || !customer_id || !adjustment_type || !amount) {
      return NextResponse.json(
        { error: 'vendor_id, vendor_password, customer_id, adjustment_type e amount sao obrigatorios.' },
        { status: 400 }
      );
    }

    const validTypes = ['cancellation', 'deduction', 'credit'];
    if (!validTypes.includes(adjustment_type)) {
      return NextResponse.json({ error: 'adjustment_type invalido.' }, { status: 400 });
    }

    if (Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valor do ajuste deve ser positivo.' }, { status: 400 });
    }

    const { data: vendor, error: vendorErr } = await supabaseAdmin
      .from('vendors')
      .select('id, password_hash')
      .eq('id', vendor_id)
      .single();

    if (vendorErr || !vendor) {
      return NextResponse.json({ error: 'Vendor nao encontrado.' }, { status: 404 });
    }

    if (!vendor.password_hash) {
      return NextResponse.json({ error: 'Vendor nao tem senha configurada.' }, { status: 403 });
    }

    const passwordValid = await verifyVendorPassword(vendor_password, vendor.password_hash);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Senha do vendor invalida.' }, { status: 403 });
    }

    const { data: customer, error: customerErr } = await supabaseAdmin
      .from('customers')
      .select('id, total_spent, vendor_id')
      .eq('id', customer_id)
      .single();

    if (customerErr || !customer) {
      return NextResponse.json({ error: 'Cliente nao encontrado.' }, { status: 404 });
    }

    if (customer.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Cliente nao pertence a este vendor.' }, { status: 403 });
    }

    if (order_id) {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('id, total, customer_id')
        .eq('id', order_id)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 });
      }

      if (order.customer_id !== customer_id) {
        return NextResponse.json({ error: 'Pedido nao pertence a este cliente.' }, { status: 403 });
      }
    }

    const { data: adjustment, error: adjustmentErr } = await supabaseAdmin
      .from('account_adjustments')
      .insert({
        vendor_id,
        customer_id,
        order_id: order_id || null,
        adjustment_type,
        amount,
        reason,
        description,
        password_verified: true,
        processed_by: 'vendor-api',
      })
      .select()
      .single();

    if (adjustmentErr) throw adjustmentErr;

    const currentTotalSpent = Number(customer.total_spent || 0);
    let newTotalSpent = currentTotalSpent;
    if (adjustment_type === 'cancellation' || adjustment_type === 'deduction') {
      newTotalSpent = Math.max(0, currentTotalSpent - Number(amount));
    } else if (adjustment_type === 'credit') {
      newTotalSpent = currentTotalSpent + Number(amount);
    }

    const { error: updateErr } = await supabaseAdmin
      .from('customers')
      .update({ total_spent: newTotalSpent, updated_at: new Date().toISOString() })
      .eq('id', customer_id);

    if (updateErr) throw updateErr;

    return NextResponse.json(
      {
        adjustment,
        customer_updated: {
          id: customer_id,
          total_spent_before: currentTotalSpent,
          total_spent_after: newTotalSpent,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Adjustments POST error:', err);
    return NextResponse.json({ error: 'Erro ao processar ajuste.' }, { status: 500 });
  }
}
