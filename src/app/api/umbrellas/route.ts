import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/umbrellas?vendor_id=xxx
 * Lista todos os guarda-sóis de um vendor.
 *
 * POST /api/umbrellas
 * Cria um novo guarda-sol.
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
        { id: 'umb-1', vendor_id, number: 1, label: 'Barraca 1', active: true, qr_url: null },
        { id: 'umb-2', vendor_id, number: 2, label: 'Barraca 2', active: true, qr_url: null },
        { id: 'umb-3', vendor_id, number: 3, label: 'Barraca 3', active: false, qr_url: null },
      ]);
    }

    const { data, error } = await supabaseAdmin
      .from('umbrellas')
      .select('*')
      .eq('vendor_id', vendor_id)
      .order('number', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Umbrellas GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.vendor_id || body.number === undefined) {
      return NextResponse.json({ error: 'vendor_id e number são obrigatórios.' }, { status: 400 });
    }

    const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock.supabase.co';
    if (isDemo) {
      return NextResponse.json({
        id: 'umb-demo-' + Date.now(),
        ...body,
        active: true,
        qr_url: null,
      }, { status: 201 });
    }

    const { data, error } = await supabaseAdmin
      .from('umbrellas')
      .insert({
        vendor_id: body.vendor_id,
        number: body.number,
        label: body.label || `Barraca ${body.number}`,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Umbrellas POST error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
