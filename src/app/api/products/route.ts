import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/products?vendor_id=xxx
 * Lista todos os produtos de um vendor.
 *
 * POST /api/products
 * Cria um novo produto.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório.' }, { status: 400 });
    }

    const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock.supabase.co';
    if (isDemo) {
      return NextResponse.json([
        { id: '1', vendor_id, name: 'Cerveja Heineken', category: 'Bebidas', price: 15.0, promotional_price: 12.0, description: 'Garrafa 600ml estupidamente gelada', image_url: '', active: true, is_combo: false, sort_order: 1 },
        { id: '2', vendor_id, name: 'Porção de Fritas', category: 'Petiscos', price: 35.0, promotional_price: null, description: 'Porção bem servida para 2 pessoas com molho especial', image_url: '', active: true, is_combo: false, sort_order: 2 },
        { id: '3', vendor_id, name: 'Isca de Peixe', category: 'Petiscos', price: 65.0, promotional_price: null, description: 'Peixe fresco empanado no capricho', image_url: '', active: true, is_combo: false, sort_order: 3 },
        { id: '4', vendor_id, name: 'Água de Coco', category: 'Bebidas', price: 10.0, promotional_price: 8.0, description: 'Coco verde natural', image_url: '', active: true, is_combo: false, sort_order: 4 },
        { id: '5', vendor_id, name: 'Caipirinha', category: 'Alcoólicos', price: 22.0, promotional_price: null, description: 'Limão, cachaça e açúcar. Clássica!', image_url: '', active: true, is_combo: false, sort_order: 5 },
        { id: '6', vendor_id, name: 'Combo Casal', category: 'Combos', price: 89.0, promotional_price: 75.0, description: '2 cervejas + porção de fritas + porção de isca', image_url: '', active: true, is_combo: true, sort_order: 6 },
      ]);
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('vendor_id', vendor_id)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Products GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.vendor_id || !body.name || body.price === undefined) {
      return NextResponse.json({ error: 'vendor_id, name e price são obrigatórios.' }, { status: 400 });
    }

    const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock.supabase.co';
    if (isDemo) {
      return NextResponse.json({ id: 'demo-' + Date.now(), ...body }, { status: 201 });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Products POST error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
