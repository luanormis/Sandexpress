import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';

const ALLOWED_VENDOR_FIELDS = new Set([
  'name',
  'address',
  'city',
  'state',
  'owner_name',
  'owner_phone',
  'owner_email',
  'logo_url',
  'primary_color',
  'secondary_color',
  'subscription_status',
  'is_active',
  'plan_type',
  'plan_expires_at',
  'trial_ends_at',
  'max_umbrellas',
]);

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
    const tenantId = getTenantIdFromRequest(req);
    const query = supabaseAdmin.from('vendors').select('*').eq('id', id);
    const { data, error } = await (tenantId ? enforceTenantScope(query, tenantId) : query).single();

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
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();

    const safeUpdate: Record<string, unknown> = {};
    for (const field of ALLOWED_VENDOR_FIELDS) {
      if (field in body) safeUpdate[field] = body[field];
    }
    if (Object.keys(safeUpdate).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo valido para atualizar.' }, { status: 400 });
    }

    const query = supabaseAdmin
      .from('vendors')
      .update({ ...safeUpdate, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    const { data, error } = await (tenantId ? enforceTenantScope(query, tenantId) : query).single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Vendor PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
