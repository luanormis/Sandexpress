import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

const db = supabaseAdmin as any;

/**
 * GET /api/adjustments?vendor_id=xxx&customer_id=yyy
 * Lista ajustes de conta de um cliente
 *
 * POST /api/adjustments
 * Cria um novo ajuste (cancelamento/abatimento/crédito) a partir de sessão autenticada.
 */
export async function GET(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || (session.role !== 'vendor' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id') || session.vendor_id;
    const customer_id = searchParams.get('customer_id');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório.' }, { status: 400 });
    }
    if (session.role === 'vendor' && session.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    let query = db
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
    const session = getRequestSession(req);
    if (!session || (session.role !== 'vendor' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const {
      vendor_id: rawVendorId,
      customer_id,
      order_id,
      adjustment_type,
      amount,
      reason,
      description,
    } = await req.json();

    const vendor_id = rawVendorId || session.vendor_id;

    if (!vendor_id || !customer_id || !adjustment_type || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'Dados incompletos: vendor_id, customer_id, adjustment_type e amount são obrigatórios.' },
        { status: 400 }
      );
    }

    if (session.role === 'vendor' && session.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    const validTypes = ['cancellation', 'deduction', 'credit'];
    if (!validTypes.includes(adjustment_type)) {
      return NextResponse.json(
        { error: 'adjustment_type inválido. Use: cancellation, deduction, credit' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valor do ajuste deve ser positivo.' }, { status: 400 });
    }

    const { data: customer, error: customerErr } = await db
      .from('customers')
      .select('id, total_spent, vendor_id')
      .eq('id', customer_id)
      .single();

    if (customerErr || !customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    }

    if (customer.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Cliente não pertence a este vendor.' }, { status: 403 });
    }

    if (order_id) {
      const { data: order, error: orderErr } = await db
        .from('orders')
        .select('id, total, customer_id, vendor_id')
        .eq('id', order_id)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
      }

      if (order.customer_id !== customer_id || order.vendor_id !== vendor_id) {
        return NextResponse.json({ error: 'Pedido não pertence a este cliente ou vendor.' }, { status: 403 });
      }
    }

    const { data: adjustment, error: adjustmentErr } = await db
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
        processed_by: session.role,
      })
      .select()
      .single();

    if (adjustmentErr) throw adjustmentErr;

    let newTotalSpent = customer.total_spent;
    if (adjustment_type === 'cancellation' || adjustment_type === 'deduction') {
      newTotalSpent = Math.max(0, customer.total_spent - amount);
    } else if (adjustment_type === 'credit') {
      newTotalSpent = customer.total_spent + amount;
    }

    const { error: updateErr } = await db
      .from('customers')
      .update({ total_spent: newTotalSpent, updated_at: new Date().toISOString() })
      .eq('id', customer_id);

    if (updateErr) throw updateErr;

    return NextResponse.json(
      {
        adjustment,
        customer_updated: {
          id: customer_id,
          total_spent_before: customer.total_spent,
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
