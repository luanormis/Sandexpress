import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { clearVendorFeatureCache, FEATURE_LABELS, getTenantFeatureMap, getVendorTenantId, sanitizeFeatureKey, type FeatureKey } from '@/lib/features';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendor_id');

    if (!vendorId) {
      return NextResponse.json({ error: 'vendor_id obrigatorio.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este vendor.' }, { status: 403 });
    }

    const tenantId = await getVendorTenantId(vendorId);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant nao encontrado para este vendor.' }, { status: 404 });
    }

    const features = await getTenantFeatureMap(tenantId);

    return NextResponse.json({
      tenant_id: tenantId,
      features,
      labels: FEATURE_LABELS,
    });
  } catch (err) {
    console.error('Features GET error:', err);
    return NextResponse.json({ error: 'Erro ao carregar modulos do tenant.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Somente o administrador pode liberar modulos.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const featureKey = sanitizeFeatureKey(body.feature_key);
    if (!vendorId || !featureKey || typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'Quiosque, modulo e status sao obrigatorios.' }, { status: 400 });
    }
    const tenantId = await getVendorTenantId(vendorId);
    if (!tenantId) return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });

    const { error } = await supabaseAdmin.from('tenant_features').upsert({
      tenant_id: tenantId,
      feature_key: featureKey,
      enabled: body.enabled,
    } as any, { onConflict: 'tenant_id,feature_key' });
    if (error) throw error;
    clearVendorFeatureCache(vendorId, featureKey);
    return NextResponse.json({ vendor_id: vendorId, tenant_id: tenantId, feature_key: featureKey, enabled: body.enabled });
  } catch (err) {
    console.error('Features PATCH error:', err);
    return NextResponse.json({ error: 'Erro ao atualizar modulo do quiosque.' }, { status: 500 });
  }
}

const BASIC_MODE_FEATURES: Partial<Record<FeatureKey, boolean>> = {
  system_full: false, inventory: true, financial: true, owner_master_dashboard: true,
  operational_dashboard: false, beach_map: false, menu_management: false,
  team_management: false, branding: false, printer_management: false,
  crm_customers: false, crm_promotions: false, loyalty: false, cashback: false, benefits_club: false,
};

const COMPLETE_MODE_FEATURES: Partial<Record<FeatureKey, boolean>> = {
  ...BASIC_MODE_FEATURES,
  system_full: true, operational_dashboard: true, beach_map: true,
  menu_management: true, team_management: true, branding: true, printer_management: true,
};

export async function PUT(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Somente o administrador pode trocar o tipo do sistema.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const mode = body.mode === 'complete' ? 'complete' : body.mode === 'basic' ? 'basic' : null;
    if (!vendorId || !mode) return NextResponse.json({ error: 'Quiosque e tipo do sistema sao obrigatorios.' }, { status: 400 });
    const tenantId = await getVendorTenantId(vendorId);
    if (!tenantId) return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    const preset = mode === 'complete' ? COMPLETE_MODE_FEATURES : BASIC_MODE_FEATURES;
    const rows = Object.entries(preset).map(([feature_key, enabled]) => ({ tenant_id: tenantId, feature_key, enabled }));
    const { error } = await supabaseAdmin.from('tenant_features').upsert(rows as any, { onConflict: 'tenant_id,feature_key' });
    if (error) throw error;
    clearVendorFeatureCache(vendorId);
    return NextResponse.json({ vendor_id: vendorId, tenant_id: tenantId, mode, features: await getTenantFeatureMap(tenantId) });
  } catch (err) {
    console.error('Features PUT error:', err);
    return NextResponse.json({ error: 'Erro ao trocar o tipo do sistema.' }, { status: 500 });
  }
}
