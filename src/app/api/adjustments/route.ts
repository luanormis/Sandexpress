import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derivedKey = (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  })) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
}

/**
 * GET /api/adjustments?vendor_id=xxx&customer_id=yyy
 * POST /api/adjustments
 * Cria ajuste (cancelamento de item) com validação de senha do vendor.
 * Ao cancelar um order_item, recalcula orders.total automaticamente.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');
    const customer_id = searchParams.get('customer_id');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório.' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    let query = supabaseAdmin
      .from('account_adjustments')
      .select('*')
      .eq('vendor_id', vendor_id)
      .order('created_at', { ascending: false });

    if (customer_id) query = query.eq('customer_id', customer_id);

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
      order_item_id,
      adjustment_type,
      amount,
      reason,
      description,
    } = await req.json();

    if (!vendor_id || !vendor_password || !customer_id || !adjustment_type || !amount) {
      return NextResponse.json(
        { error: 'vendor_id, vendor_password, customer_id, adjustment_type e amount são obrigatórios.' },
        { status: 400 }
      );
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    const validTypes = ['cancellation', 'deduction', 'credit'];
    if (!validTypes.includes(adjustment_type)) {
      return NextResponse.json({ error: 'adjustment_type inválido.' }, { status: 400 });
    }
    if (amount <= 0) {
      return NextResponse.json({ error: 'Valor do ajuste deve ser positivo.' }, { status: 400 });
    }

    // Verificar senha do vendor
    const { data: vendor, error: vendorErr } = await supabaseAdmin
      .from('vendors')
      .select('id, password_hash')
      .eq('id', vendor_id)
      .single();

    if (vendorErr || !vendor || !vendor.password_hash) {
      return NextResponse.json({ error: 'Vendor não encontrado ou sem senha configurada.' }, { status: 404 });
    }
    if (!(await verifyPassword(vendor_password, vendor.password_hash))) {
      return NextResponse.json({ error: 'Senha do vendor inválida.' }, { status: 403 });
    }

    // Verificar customer pertence ao vendor
    const { data: customer, error: customerErr } = await supabaseAdmin
      .from('customers')
      .select('id, total_spent, vendor_id')
      .eq('id', customer_id)
      .single();

    if (customerErr || !customer || customer.vendor_id !== vendor_id) {
      return NextResponse.json({ error: 'Cliente não encontrado ou não pertence a este vendor.' }, { status: 404 });
    }

    // Verificar order e order_item (se fornecidos)
    if (order_id) {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('id, total, customer_id, vendor_id')
        .eq('id', order_id)
        .single();

      if (orderErr || !order || order.customer_id !== customer_id || order.vendor_id !== vendor_id) {
        return NextResponse.json({ error: 'Pedido não encontrado ou não pertence a este cliente/vendor.' }, { status: 404 });
      }

      // Se fornecido order_item_id, cancelar o item específico
      if (order_item_id && adjustment_type === 'cancellation') {
        const { data: item, error: itemErr } = await supabaseAdmin
          .from('order_items')
          .select('id, order_id, subtotal, quantity, product_id, cancelled')
          .eq('id', order_item_id)
          .eq('order_id', order_id)
          .single();

        if (itemErr || !item) {
          return NextResponse.json({ error: 'Item do pedido não encontrado.' }, { status: 404 });
        }
        if (item.cancelled) {
          return NextResponse.json({ error: 'Item já cancelado.' }, { status: 409 });
        }

        // Marcar item como cancelado
        await supabaseAdmin
          .from('order_items')
          .update({ cancelled: true, cancelled_at: new Date().toISOString(), cancel_reason: reason || null })
          .eq('id', order_item_id);

        // Recalcular total do pedido (soma apenas itens não cancelados)
        const { data: activeItems } = await supabaseAdmin
          .from('order_items')
          .select('subtotal')
          .eq('order_id', order_id)
          .eq('cancelled', false);

        const newTotal = (activeItems || []).reduce((sum, i) => sum + Number(i.subtotal), 0);
        await supabaseAdmin
          .from('orders')
          .update({ total: newTotal, updated_at: new Date().toISOString() })
          .eq('id', order_id);

        // Repor estoque do item cancelado
        await supabaseAdmin.rpc('increment_stock', { p_product_id: item.product_id, p_qty: item.quantity }).maybeSingle();
      }
    }

    // Registrar ajuste
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

    // Atualizar total_spent do cliente
    let newTotalSpent = Number(customer.total_spent);
    if (adjustment_type === 'cancellation' || adjustment_type === 'deduction') {
      newTotalSpent = Math.max(0, newTotalSpent - amount);
    } else if (adjustment_type === 'credit') {
      newTotalSpent = newTotalSpent + amount;
    }

    await supabaseAdmin
      .from('customers')
      .update({ total_spent: newTotalSpent, updated_at: new Date().toISOString() })
      .eq('id', customer_id);

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
