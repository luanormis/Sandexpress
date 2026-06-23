import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { FEATURE_LABELS, getTenantFeatureMap, getVendorTenantId } from '@/lib/features';

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
