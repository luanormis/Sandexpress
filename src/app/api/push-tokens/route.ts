import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { isOptionalPromotionSchemaError } from '@/lib/kiosk-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'customer' || !session.vendor_id || !session.customer_id) {
      return NextResponse.json({ error: 'Sessao de cliente obrigatoria.' }, { status: 401 });
    }

    const body = await req.json();
    const token = String(body.token || '').trim();
    const platform = String(body.platform || 'web').slice(0, 40);
    const provider = String(body.provider || 'web_push').slice(0, 40);

    if (!token || token.length > 2048 || !isCanonicalUuid(session.vendor_id) || !isCanonicalUuid(session.customer_id)) {
      return NextResponse.json({ error: 'Token push invalido.' }, { status: 400 });
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('tenant_id, vendor_id')
      .eq('id', session.customer_id)
      .eq('vendor_id', session.vendor_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Cliente nao encontrado.' }, { status: 404 });
    }

    const { error } = await (supabaseAdmin.from('customer_push_tokens') as any)
      .upsert({
        tenant_id: customer.tenant_id,
        vendor_id: session.vendor_id,
        customer_id: session.customer_id,
        token,
        provider,
        platform,
        active: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'vendor_id,customer_id,token' });

    if (error) {
      if (isOptionalPromotionSchemaError(error)) {
        return NextResponse.json({ saved: false, unavailable: true });
      }
      throw error;
    }

    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error('Push token error:', err);
    return NextResponse.json({ error: 'Erro ao salvar token push.' }, { status: 500 });
  }
}
