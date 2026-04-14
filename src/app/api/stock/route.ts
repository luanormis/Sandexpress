import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

/**
 * PUT /api/stock
 * Atualizar estoque de produtos (abertura do dia)
 * 
 * Body: { vendor_id, updates: [{ product_id, stock_quantity }] }
 */
export async function PUT(req: NextRequest) {
  try {
    const { vendor_id, updates } = await req.json();

    if (!vendor_id || !updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'vendor_id e updates (array) são obrigatórios' },
        { status: 400 }
      );
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    // Atualizar cada produto
    const results = [];
    for (const { product_id, stock_quantity } of updates) {
      const { error } = await supabaseAdmin
        .from('products')
        .update({
          stock_quantity,
          blocked_by_stock: stock_quantity === 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product_id)
        .eq('vendor_id', vendor_id);

      if (!error) {
        results.push({ product_id, stock_quantity, success: true });
      } else {
        results.push({ product_id, stock_quantity, success: false, error: error.message });
      }
    }

    return NextResponse.json({
      vendor_id,
      updated_count: results.filter(r => r.success).length,
      results,
    });
  } catch (err) {
    console.error('Stock PUT error:', err);
    return NextResponse.json({ error: 'Erro ao atualizar estoque' }, { status: 500 });
  }
}

/**
 * GET /api/stock?vendor_id=xxx
 * Obter estoque atual dos produtos
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, name, category, price, stock_quantity, blocked_by_stock, active')
      .eq('vendor_id', vendor_id)
      .eq('active', true)
      .order('sort_order');

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Stock GET error:', err);
    return NextResponse.json({ error: 'Erro ao obter estoque' }, { status: 500 });
  }
}
