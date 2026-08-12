import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { getTenantFeatureMap, getVendorTenantId, sanitizeFeatureKey } from '@/lib/features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

export async function GET(req: NextRequest) {
  const session = getRequestSession(req);
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
  const vendorId = new URL(req.url).searchParams.get('vendor_id') || '';
  if (!isCanonicalUuid(vendorId)) return NextResponse.json({ error: 'Quiosque inválido.' }, { status: 400 });
  const tenantId = await getVendorTenantId(vendorId);
  if (!tenantId) return NextResponse.json({ error: 'Quiosque não encontrado.' }, { status: 404 });
  return NextResponse.json({ vendor_id: vendorId, tenant_id: tenantId, features: await getTenantFeatureMap(tenantId) });
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (session?.role !== 'admin') return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const featureKey = sanitizeFeatureKey(body.feature_key);
    if (!isCanonicalUuid(vendorId) || !featureKey || typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'Configuração inválida.' }, { status: 400 });
    const tenantId = await getVendorTenantId(vendorId);
    if (!tenantId) return NextResponse.json({ error: 'Quiosque não encontrado.' }, { status: 404 });
    const { error } = await supabaseAdmin.from('tenant_features').upsert({ tenant_id: tenantId, feature_key: featureKey, enabled: body.enabled }, { onConflict: 'tenant_id,feature_key' });
    if (error) throw error;
    return NextResponse.json({ saved: true, feature_key: featureKey, enabled: body.enabled });
  } catch (error) {
    console.error('Admin vendor feature error:', error);
    return NextResponse.json({ error: 'Erro ao liberar módulo.' }, { status: 500 });
  }
}
