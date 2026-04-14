import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

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
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
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
    const session = getRequestSession(req);
    if (!canAccessVendor(session, body.vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
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
