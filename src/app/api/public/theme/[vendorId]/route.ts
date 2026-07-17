import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

const THEME_SELECT = 'id, name, primary_color, secondary_color, button_color, button_text_color, logo_url, is_active, subscription_status, updated_at';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    const { vendorId } = await params;
    const { data: vendor, error } = await supabaseAdmin
      .from('vendors')
      .select(THEME_SELECT)
      .eq('id', vendorId)
      .single();

    if (error || !vendor) return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    if (!vendor.is_active || vendor.subscription_status === 'blocked') {
      return NextResponse.json({ error: 'Quiosque indisponivel.' }, { status: 403 });
    }

    return NextResponse.json({
      id: vendor.id,
      name: vendor.name,
      primary_color: vendor.primary_color,
      secondary_color: vendor.secondary_color,
      button_color: (vendor as any).button_color,
      button_text_color: (vendor as any).button_text_color,
      logo_url: vendor.logo_url,
      updated_at: (vendor as any).updated_at,
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Public theme error:', error);
    return NextResponse.json({ error: 'Erro ao carregar personalizacao.' }, { status: 500 });
  }
}
