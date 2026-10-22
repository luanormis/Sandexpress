import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { getVendorTenantId } from '@/lib/features';
import { isCanonicalUuid } from '@/lib/uuid';
import { seedVeraMenuForVendor } from '@/lib/vera-menu-seed';

export async function POST(req: NextRequest) {
  try {
    if (getRequestSession(req)?.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    if (!isCanonicalUuid(vendorId)) {
      return NextResponse.json({ error: 'Quiosque inválido.' }, { status: 400 });
    }
    const tenantId = await getVendorTenantId(vendorId);
    if (!tenantId) return NextResponse.json({ error: 'Quiosque não encontrado.' }, { status: 404 });

    const result = await seedVeraMenuForVendor(tenantId, vendorId);
    return NextResponse.json({ ...result, itemCount: result.total });
  } catch (error) {
    console.error('Default menu sync error:', error);
    return NextResponse.json({ error: 'Não foi possível completar o cardápio padrão.' }, { status: 500 });
  }
}
