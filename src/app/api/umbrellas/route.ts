import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';

/**
 * GET /api/umbrellas?vendor_id=xxx
 * Lista todos os guarda-sóis de um vendor.
 *
 * POST /api/umbrellas
 * Cria um novo guarda-sol.
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não identificado.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatório.' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    const { data, error } = await enforceTenantScope(
      supabaseAdmin
        .from('umbrellas')
        .select('*')
        .eq('vendor_id', vendor_id)
        .order('number', { ascending: true }),
      tenantId
    );

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Umbrellas GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não identificado.' }, { status: 400 });
    }

    const body = await req.json();

    if (!body.vendor_id || body.number === undefined) {
      return NextResponse.json({ error: 'vendor_id e number são obrigatórios.' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, body.vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    const mapX = body.map_x === undefined ? Math.min(92, 12 + ((Number(body.number) - 1) % 4) * 24) : Math.min(100, Math.max(0, Number(body.map_x)));
    const mapY = body.map_y === undefined ? Math.min(88, 24 + Math.floor((Number(body.number) - 1) / 4) * 18) : Math.min(100, Math.max(0, Number(body.map_y)));
    const insertPayload = {
      vendor_id: body.vendor_id,
      number: body.number,
      label: body.label || `Barraca ${body.number}`,
      active: true,
      tenant_id: tenantId,
      map_x: mapX,
      map_y: mapY,
    };

    let { data, error } = await enforceTenantScope(
      supabaseAdmin
        .from('umbrellas')
        .insert(insertPayload),
      tenantId
    )
      .select()
      .single();

    if (error && /map_x|map_y/.test(String(error.message || ''))) {
      const legacyInsert: Partial<typeof insertPayload> = { ...insertPayload };
      delete legacyInsert.map_x;
      delete legacyInsert.map_y;
      const fallback = await enforceTenantScope(
        supabaseAdmin
          .from('umbrellas')
          .insert(legacyInsert),
        tenantId
      )
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Umbrellas POST error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
