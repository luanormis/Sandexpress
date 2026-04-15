import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

/** Campos permitidos para atualização de guarda-sol (whitelist contra mass-assignment) */
const ALLOWED_UMBRELLA_FIELDS = new Set(['active', 'label', 'location_hint']);

/**
 * GET /api/umbrellas/[id]
 * Obtém informações públicas de um guarda-sol (para clientes).
 *
 * PATCH /api/umbrellas/[id]
 * Atualiza um guarda-sol (ex: toggle ativo/inativo).
 *
 * DELETE /api/umbrellas/[id]
 * Remove um guarda-sol.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('umbrellas')
      .select('id, number, label, active, vendor_id')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Guarda-sol não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Umbrella GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    // Whitelist de campos com tipo correto para Supabase
    const safeUpdate: {
      active?: boolean | null;
      label?: string | null;
      location_hint?: string | null;
    } = {};
    if ('active' in body) safeUpdate.active = body.active as boolean | null;
    if ('label' in body) safeUpdate.label = body.label as string | null;
    if ('location_hint' in body) safeUpdate.location_hint = body.location_hint as string | null;
    if (Object.keys(safeUpdate).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 });
    }

    const umbrellaLookup = await supabaseAdmin.from('umbrellas').select('vendor_id').eq('id', id).single();
    if (umbrellaLookup.error || !umbrellaLookup.data) {
      return NextResponse.json({ error: 'Guarda-sol não encontrado.' }, { status: 404 });
    }
    if (!canAccessVendor(session, umbrellaLookup.data.vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este guarda-sol.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('umbrellas')
      .update(safeUpdate)
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

    const umbrellaLookup = await supabaseAdmin.from('umbrellas').select('vendor_id, is_occupied').eq('id', id).single();
    if (umbrellaLookup.error || !umbrellaLookup.data) {
      return NextResponse.json({ error: 'Guarda-sol não encontrado.' }, { status: 404 });
    }
    if (!canAccessVendor(session, umbrellaLookup.data.vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este guarda-sol.' }, { status: 403 });
    }
    if (umbrellaLookup.data.is_occupied) {
      return NextResponse.json({ error: 'Não é possível remover guarda-sol com conta aberta.' }, { status: 409 });
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
