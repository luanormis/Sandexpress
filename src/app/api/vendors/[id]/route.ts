import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { purgeKiosk } from '@/lib/admin-data-erasure';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { getAdminPassword } from '@/lib/runtime-config';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';
import { ADMIN_UMBRELLA_LIMIT } from '@/lib/plans';

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
  'button_color',
  'button_text_color',
  'subscription_status',
  'is_active',
  'plan_type',
  'plan_expires_at',
  'trial_ends_at',
  'max_umbrellas',
]);

const SAFE_VENDOR_SELECT = [
  'id',
  'tenant_id',
  'name',
  'address',
  'city',
  'state',
  'owner_name',
  'owner_phone',
  'owner_email',
  'cpf',
  'cnpj',
  'document_login',
  'beach_name',
  'logo_url',
  'primary_color',
  'secondary_color',
  'button_color',
  'button_text_color',
  'subscription_status',
  'is_active',
  'plan_type',
  'plan_expires_at',
  'plan_monthly_price',
  'plan_quarterly_price',
  'plan_semester_price',
  'plan_annual_monthly_price',
  'trial_ends_at',
  'max_umbrellas',
  'created_at',
  'updated_at',
].join(', ');

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
    const query = supabaseAdmin.from('vendors').select(SAFE_VENDOR_SELECT).eq('id', id);
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
    if ('max_umbrellas' in safeUpdate) {
      const maxUmbrellas = Number(safeUpdate.max_umbrellas);
      if (!Number.isInteger(maxUmbrellas) || maxUmbrellas < 1 || maxUmbrellas > ADMIN_UMBRELLA_LIMIT) {
        return NextResponse.json({ error: `O limite deve ficar entre 1 e ${ADMIN_UMBRELLA_LIMIT} guarda-sois.` }, { status: 400 });
      }
      safeUpdate.max_umbrellas = maxUmbrellas;
    }
    if (Object.keys(safeUpdate).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo valido para atualizar.' }, { status: 400 });
    }

    const query = supabaseAdmin
      .from('vendors')
      .update({ ...safeUpdate, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(SAFE_VENDOR_SELECT);
    const { data, error } = await (tenantId ? enforceTenantScope(query, tenantId) : query).single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Vendor PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

function verifyAdminPassword(password: unknown) {
  const provided = Buffer.from(String(password || ''));
  const expected = Buffer.from(getAdminPassword());
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (!verifyAdminPassword(body.admin_password)) {
      return NextResponse.json({ error: 'Senha do admin invalida.' }, { status: 401 });
    }
    if (body.confirmation !== 'APAGAR QUIOSQUE') {
      return NextResponse.json({ error: 'Digite APAGAR QUIOSQUE para confirmar.' }, { status: 400 });
    }

    const result = await purgeKiosk(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('Vendor DELETE error:', err);
    return NextResponse.json({ error: 'Erro ao apagar quiosque.' }, { status: 500 });
  }
}
