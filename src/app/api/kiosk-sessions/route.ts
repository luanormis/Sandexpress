import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { isOptionalPromotionSchemaError, touchKioskSession } from '@/lib/kiosk-session';
import { isCanonicalUuid } from '@/lib/uuid';

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'customer' || !session.vendor_id || !session.customer_id) {
      return NextResponse.json({ error: 'Sessao de cliente obrigatoria.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const umbrellaId = body.umbrella_id ? String(body.umbrella_id) : null;
    if (umbrellaId && !isCanonicalUuid(umbrellaId)) {
      return NextResponse.json({ error: 'umbrella_id invalido.' }, { status: 400 });
    }

    await touchKioskSession({
      vendorId: session.vendor_id,
      customerId: session.customer_id,
      umbrellaId,
      userAgent: req.headers.get('user-agent'),
    });

    return NextResponse.json({ active: true });
  } catch (err) {
    if (isOptionalPromotionSchemaError(err)) {
      return NextResponse.json({ active: false, unavailable: true });
    }
    console.error('Kiosk session touch error:', err);
    return NextResponse.json({ error: 'Erro ao atualizar presenca.' }, { status: 500 });
  }
}
