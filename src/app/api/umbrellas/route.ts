import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { buildUmbrellaQrTargetPath, buildUmbrellaQrTargetUrl, getPublicAppUrl } from '@/lib/public-url';
import { featureDisabledResponse, vendorFeatureEnabled } from '@/lib/features';
import { ADMIN_UMBRELLA_LIMIT, PLAN_UMBRELLA_LIMIT } from '@/lib/plans';

/**
 * GET /api/umbrellas?vendor_id=xxx
 * Lista todos os guarda-sois de um vendor.
 *
 * POST /api/umbrellas
 * Cria um novo guarda-sol dentro do tenant do vendor.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id obrigatorio.' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendor_id, 'beach_umbrellas')) {
      return NextResponse.json(featureDisabledResponse('beach_umbrellas'), { status: 403 });
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

    const umbrellaNumber = Number(body.number);
    if (!body.vendor_id || !Number.isInteger(umbrellaNumber) || umbrellaNumber < 1 || umbrellaNumber > 9999) {
      return NextResponse.json({ error: 'vendor_id e number sao obrigatorios.' }, { status: 400 });
    }
    const session = getRequestSession(req);
    if (!canAccessVendor(session, body.vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(body.vendor_id, 'beach_umbrellas')) {
      return NextResponse.json(featureDisabledResponse('beach_umbrellas'), { status: 403 });
    }

    const { data: vendor, error: vendorErr } = await (supabaseAdmin.from('vendors') as any)
      .select('tenant_id, max_umbrellas, name')
      .eq('id', body.vendor_id)
      .single();
    if (vendorErr || !vendor?.tenant_id) {
      return NextResponse.json({ error: 'Vendor sem tenant configurado. Execute a migracao de producao.' }, { status: 400 });
    }

    const { count, error: countError } = await supabaseAdmin
      .from('umbrellas')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', body.vendor_id);

    if (countError) throw countError;
    const configuredLimit = Number(vendor.max_umbrellas || 0);
    const effectiveLimit = !Number.isFinite(configuredLimit) || configuredLimit <= 0 || configuredLimit === 50
      ? PLAN_UMBRELLA_LIMIT
      : Math.min(ADMIN_UMBRELLA_LIMIT, Math.floor(configuredLimit));
    if ((count || 0) >= effectiveLimit) {
      return NextResponse.json({ error: `Limite de ${effectiveLimit} guarda-sois do plano atingido.` }, { status: 409 });
    }

    const { data, error } = await (supabaseAdmin.from('umbrellas') as any)
      .insert({
        tenant_id: vendor.tenant_id,
        vendor_id: body.vendor_id,
        number: umbrellaNumber,
        label: body.label || `Guarda-sol ${umbrellaNumber}`,
        active: true,
        is_occupied: false,
        map_x: body.map_x ?? null,
        map_y: body.map_y ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    const qrOptions = { vendorName: vendor.name, umbrellaNumber: data.number };
    const qrPath = buildUmbrellaQrTargetPath(data.vendor_id, data.id, qrOptions);
    const qrUrl = buildUmbrellaQrTargetUrl(getPublicAppUrl(req), data.vendor_id, data.id, qrOptions);
    if (data.qr_url !== qrUrl) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('umbrellas')
        .update({ qr_url: qrUrl, qr_path: qrPath })
        .eq('id', data.id)
        .select()
        .single();
      if (updateError) throw updateError;
      return NextResponse.json(updated, { status: 201 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Umbrellas POST error:', err);
    const error = err as { code?: string; message?: string };
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ja existe um guarda-sol com este numero.' }, { status: 409 });
    }
    if (String(error.message || '').includes('Limite de')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
