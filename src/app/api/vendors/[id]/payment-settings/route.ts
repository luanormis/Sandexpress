import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

function cleanPixKey(value: unknown) {
  const key = typeof value === 'string' ? value.trim() : '';
  return key.length > 140 ? key.slice(0, 140) : key;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    const { id } = await params;
    if (!canAccessVendor(session, id)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .select('id, pix_enabled, pix_key, pix_account_name')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Payment settings GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(req);
    const { id } = await params;
    if (!canAccessVendor(session, id)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }

    const body = await req.json();
    const pixEnabled = Boolean(body.pix_enabled);
    const pixKey = cleanPixKey(body.pix_key);
    const pixAccountName = cleanPixKey(body.pix_account_name);

    if (pixEnabled && !pixKey) {
      return NextResponse.json({ error: 'Informe a chave PIX para ativar pagamentos via PIX.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update({
        pix_enabled: pixEnabled,
        pix_key: pixKey || null,
        pix_account_name: pixAccountName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, pix_enabled, pix_key, pix_account_name')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Payment settings PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
