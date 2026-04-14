import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

/**
 * PATCH /api/umbrellas/[id]
 * Atualiza um guarda-sol (ex: toggle ativo/inativo).
 *
 * DELETE /api/umbrellas/[id]
 * Remove um guarda-sol.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const umbrellaLookup = await supabaseAdmin.from('umbrellas').select('vendor_id').eq('id', id).single();
    if (umbrellaLookup.error || !umbrellaLookup.data) {
      return NextResponse.json({ error: 'Guarda-sol não encontrado.' }, { status: 404 });
    }
    if (!canAccessVendor(session, umbrellaLookup.data.vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este guarda-sol.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('umbrellas')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Umbrella PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { id } = await params;

    const umbrellaLookup = await supabaseAdmin.from('umbrellas').select('vendor_id').eq('id', id).single();
    if (umbrellaLookup.error || !umbrellaLookup.data) {
      return NextResponse.json({ error: 'Guarda-sol não encontrado.' }, { status: 404 });
    }
    if (!canAccessVendor(session, umbrellaLookup.data.vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este guarda-sol.' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('umbrellas')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Umbrella DELETE error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
