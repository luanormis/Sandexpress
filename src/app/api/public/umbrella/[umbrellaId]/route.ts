import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/public/umbrella/[umbrellaId]
 * Dados públicos para o cliente após escanear o QR (sem autenticação).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ umbrellaId: string }> }
) {
  try {
    const { umbrellaId } = await params;

    const { data: umbrella, error: uErr } = await supabaseAdmin
      .from('umbrellas')
      .select('id, number, label, active, vendor_id')
      .eq('id', umbrellaId)
      .single();

    if (uErr || !umbrella) {
      return NextResponse.json({ error: 'Guarda-sol não encontrado.' }, { status: 404 });
    }

    if (!umbrella.active) {
      return NextResponse.json({ error: 'Este guarda-sol está inativo.' }, { status: 403 });
    }

    const { data: vendor, error: vErr } = await supabaseAdmin
      .from('vendors')
      .select('id, name, primary_color, secondary_color, logo_url, is_active, subscription_status')
      .eq('id', umbrella.vendor_id)
      .single();

    if (vErr || !vendor) {
      return NextResponse.json({ error: 'Quiosque não encontrado.' }, { status: 404 });
    }

    if (!vendor.is_active || vendor.subscription_status === 'blocked') {
      return NextResponse.json({ error: 'Quiosque indisponível.' }, { status: 403 });
    }

    const { data: products, error: pErr } = await supabaseAdmin
      .from('products')
      .select('id, name, category, description, price, promotional_price, image_url, active, is_combo, sort_order, stock_quantity, blocked_by_stock')
      .eq('vendor_id', umbrella.vendor_id)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (pErr) throw pErr;

    const visible = (products || []).filter((p) => {
      if (p.blocked_by_stock && (p.stock_quantity ?? 0) <= 0) return false;
      return true;
    });

    return NextResponse.json({
      umbrella: {
        id: umbrella.id,
        number: umbrella.number,
        label: umbrella.label,
      },
      vendor: {
        id: vendor.id,
        name: vendor.name,
        primary_color: vendor.primary_color || '#FF6B00',
        secondary_color: vendor.secondary_color || '#394E59',
        logo_url: vendor.logo_url,
      },
      products: visible,
    });
  } catch (err) {
    console.error('public umbrella error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
