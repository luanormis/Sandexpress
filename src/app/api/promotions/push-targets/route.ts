import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { isOptionalPromotionSchemaError } from '@/lib/kiosk-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const promotionId = String(body.promocao_id || body.promotion_id || '');
    const enqueue = body.enqueue === true;

    if (!isCanonicalUuid(promotionId)) {
      return NextResponse.json({ error: 'promocao_id obrigatorio.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });

    const { data: promotion, error: promotionError } = await (supabaseAdmin.from('promocoes') as any)
      .select('id, vendor_id')
      .eq('id', promotionId)
      .single();

    if (promotionError) {
      if (isOptionalPromotionSchemaError(promotionError)) {
        return NextResponse.json({ targets: [], unavailable: true });
      }
      throw promotionError;
    }
    if (!promotion) return NextResponse.json({ error: 'Promocao nao encontrada.' }, { status: 404 });
    if (!canAccessVendor(session, promotion.vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    if (enqueue) {
      const { data, error } = await supabaseAdmin.rpc('enfileirar_push_promocao', {
        p_promocao_id: promotionId,
      });
      if (error) {
        if (isOptionalPromotionSchemaError(error)) {
          return NextResponse.json({ queued: 0, unavailable: true });
        }
        throw error;
      }
      return NextResponse.json({ queued: Number(data || 0) });
    }

    const { data, error } = await supabaseAdmin.rpc('listar_push_promocao_ativa', {
      p_promocao_id: promotionId,
    });

    if (error) {
      if (isOptionalPromotionSchemaError(error)) {
        return NextResponse.json({ targets: [], unavailable: true });
      }
      throw error;
    }

    return NextResponse.json({ targets: data || [] });
  } catch (err) {
    console.error('Promotion push targets error:', err);
    return NextResponse.json({ error: 'Erro ao buscar publico do push.' }, { status: 500 });
  }
}
