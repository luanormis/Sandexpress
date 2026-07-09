import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { isOptionalPromotionSchemaError } from '@/lib/kiosk-session';
import { supabaseAdmin } from '@/lib/supabase-admin';

function hasCronSecret(req: NextRequest) {
  const configured = process.env.PROMOTION_DISPATCH_SECRET;
  if (!configured) return false;
  const header = req.headers.get('x-promotion-dispatch-secret') || '';
  return header.length > 0 && header === configured;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const session = getRequestSession(req);
    const cronAuthorized = hasCronSecret(req);

    if (!cronAuthorized && !session) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }
    if (!cronAuthorized && vendorId && !canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }
    if (!cronAuthorized && !vendorId && session?.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admin pode despachar todos os quiosques.' }, { status: 403 });
    }

    let query = (supabaseAdmin.from('promocoes') as any)
      .select('id, vendor_id')
      .eq('ativa', true)
      .eq('disparar_push', true)
      .is('push_disparado_em', null)
      .or(`inicia_em.is.null,inicia_em.lte.${new Date().toISOString()}`);

    if (vendorId) query = query.eq('vendor_id', vendorId);

    const { data: promotions, error } = await query;
    if (error) {
      if (isOptionalPromotionSchemaError(error)) {
        return NextResponse.json({ dispatched: 0, unavailable: true });
      }
      throw error;
    }

    let dispatched = 0;
    const details: Array<{ promocao_id: string; queued: number }> = [];
    for (const promotion of promotions || []) {
      if (!cronAuthorized && !canAccessVendor(session, promotion.vendor_id)) continue;
      const { data, error: enqueueError } = await supabaseAdmin.rpc('enfileirar_push_promocao', {
        p_promocao_id: promotion.id,
      });
      if (enqueueError) {
        if (isOptionalPromotionSchemaError(enqueueError)) continue;
        throw enqueueError;
      }
      const queued = Number(data || 0);
      dispatched += queued;
      details.push({ promocao_id: promotion.id, queued });
    }

    return NextResponse.json({ dispatched, details });
  } catch (err) {
    console.error('Promotion dispatch error:', err);
    return NextResponse.json({ error: 'Erro ao despachar promocoes.' }, { status: 500 });
  }
}
