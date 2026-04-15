import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyPassword } from '@/lib/utils';

/**
 * GET /api/adjustments?vendor_id=xxx&customer_id=yyy
 * Lista ajustes de conta de um cliente
 *
 * POST /api/adjustments
 * Cria um novo ajuste (cancelamento/abatimento/crédito) com validação de senha
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');
    const customer_id = searchParams.get('customer_id');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório.' }, { status: 400 });
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

    // Validar dados obrigatórios
    if (!vendor_id || !vendor_password || !customer_id || !adjustment_type || !amount) {
      return NextResponse.json(
        { error: 'Dados incompletos: vendor_id, vendor_password, customer_id, adjustment_type, amount são obrigatórios.' },
        { status: 400 }
      );
    }

    // Validar tipo de ajuste
    const validTypes = ['cancellation', 'deduction', 'credit'];
    if (!validTypes.includes(adjustment_type)) {
      return NextResponse.json(
        { error: 'adjustment_type inválido. Use: cancellation, deduction, credit' },
        { status: 400 }
      );
    }

    // Validar amount > 0
    if (amount <= 0) {
      return NextResponse.json({ error: 'Valor do ajuste deve ser positivo.' }, { status: 400 });
    }

    }

    // 1. Verificar vendor existe e validar senha
    const { data: vendor, error: vendorErr } = await supabaseAdmin
      .from('vendors')
      .select('id, password_hash')
      .eq('id', vendor_id)
      .single();

    if (vendorErr || !vendor) {
      return NextResponse.json({ error: 'Vendor não encontrado.' }, { status: 404 });
    }

    // Verificar senha usando bcrypt (se houver password_hash)
    if (!vendor.password_hash) {
      return NextResponse.json({ error: 'Vendor não tem senha configurada.' }, { status: 403 });
    }

    // Importar e usar bcrypt dinamicamente
    let passwordValid = false;
    try {
      const bcrypt = await import('bcryptjs');
      passwordValid = await bcrypt.compare(vendor_password, vendor.password_hash);
    } catch (bcryptErr) {
      console.error('Bcrypt error:', bcryptErr);
      // Fallback: comparação simples (não recomendada em produção)
      passwordValid = vendor_password === vendor.password_hash;
    }

    if (!passwordValid) {
      return NextResponse.json({ error: 'Senha do vendor inválida.' }, { status: 403 });
    }

    // 2. Verificar customer existe
    const { data: customer, error: customerErr } = await supabaseAdmin
      .from('customers')
      .select('id, total_spent, vendor_id')
      .eq('id', customer_id)
      .single();

    if (customerErr || !customer) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    }

    // Verificar se customer pertence ao vendor
    if (customer.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Cliente não pertence a este vendor.' }, { status: 403 });
    }

    // 3. Se for cancelamento e tiver order_id, verificar que a order existe
    if (order_id) {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('id, total, customer_id')
        .eq('id', order_id)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
      }

      if (order.customer_id !== customer_id) {
        return NextResponse.json({ error: 'Pedido não pertence a este cliente.' }, { status: 403 });
      }
    }

    // 4. Criar registro de ajuste
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
        processed_by: 'admin-api',
      })
      .select()
      .single();

    if (adjustmentErr) throw adjustmentErr;

    // 5. Atualizar total_spent do cliente
    let newTotalSpent = customer.total_spent;
    if (adjustment_type === 'cancellation' || adjustment_type === 'deduction') {
      // Reduzir o total gasto
      newTotalSpent = Math.max(0, customer.total_spent - amount);
    } else if (adjustment_type === 'credit') {
      // Adicionar crédito (aumentar total)
      newTotalSpent = customer.total_spent + amount;
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
