import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';

/** Campos que o admin pode atualizar num vendor (whitelist contra mass-assignment) */
const ALLOWED_VENDOR_FIELDS = new Set([
  'name', 'address', 'city', 'state', 'owner_name', 'owner_phone', 'owner_email',
  'logo_url', 'primary_color', 'secondary_color',
  'subscription_status', 'is_active', 'plan_type', 'plan_expires_at', 'max_umbrellas',
]);

/**
 * GET /api/vendors/[id]
 * Detalhes de um vendor.
 *
 * PATCH /api/vendors/[id]
 * Atualiza dados do vendor (incluindo bloquear/desbloquear).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Vendor GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Whitelist: apenas campos permitidos ao admin
    const safeUpdate: Record<string, unknown> = {};
    for (const field of ALLOWED_VENDOR_FIELDS) {
      if (field in body) safeUpdate[field] = body[field];
    }
    if (Object.keys(safeUpdate).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update({ ...safeUpdate, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Vendor PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
