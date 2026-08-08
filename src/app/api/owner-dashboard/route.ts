import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { vendorFeatureEnabled } from '@/lib/features';
import { isCanonicalUuid } from '@/lib/uuid';
import { buildIntelligence } from '@/app/api/management-assistant/route';

export async function GET(req: NextRequest) {
  try {
    const vendorId = new URL(req.url).searchParams.get('vendor_id') || '';
    const session = getRequestSession(req);
    if (!isCanonicalUuid(vendorId) || !session || session.role !== 'vendor' || session.vendor_id !== vendorId || session.user_role !== 'owner') {
      return NextResponse.json({ error: 'Acesso exclusivo do proprietario master.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendorId, 'owner_master_dashboard')) return NextResponse.json({ error: 'Dashboard Master nao liberado para este CNPJ.' }, { status: 403 });
    return NextResponse.json(await buildIntelligence(vendorId));
  } catch (error) {
    console.error('Owner dashboard error:', error);
    return NextResponse.json({ error: 'Erro ao carregar o dashboard do proprietario.' }, { status: 500 });
  }
}
