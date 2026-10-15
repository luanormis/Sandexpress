import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { featureDisabledResponse, getTenantFeatureMap } from '@/lib/features';
import { isProductVisibleToCustomer } from '@/lib/public-product-visibility';
import { normalizeRenderableProductImageUrl } from '@/lib/product-image-url';

/**
 * GET /api/public/umbrella/[umbrellaId]?vendor_id=xxx
 * Public data after scanning the QR code.
 *
 * The vendor_id query is part of the new QR format and makes the tenant/vendor
 * relationship explicit. Old QR codes with only the umbrella id still work
 * because the umbrella id is globally unique in the database.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ umbrellaId: string }> }
) {
  try {
    const { umbrellaId } = await params;
    const { searchParams } = new URL(req.url);
    let vendorId = searchParams.get('vendor_id');
    const vendorSlug = searchParams.get('vendor_slug');

    // QR codes antigos carregam o nome do quiosque e o número do guarda-sol.
    // Resolva esse formato também para não deixar links impressos inutilizados.
    if (!vendorId && vendorSlug) {
      const { data: vendors } = await supabaseAdmin.from('vendors').select('id, name');
      const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      vendorId = (vendors || []).find((vendor: any) => normalize(String(vendor.name)) === vendorSlug)?.id || null;
    }

    const numberMatch = String(umbrellaId).match(/^guarda-sol-(\d+)(?:-|$)/i);
    const umbrellaNumber = numberMatch ? Number(numberMatch[1]) : null;

    let umbrellaQuery = supabaseAdmin
      .from('umbrellas')
      .select('id, tenant_id, number, label, active, vendor_id')
      .eq('id', umbrellaId);

    if (umbrellaNumber && vendorId) {
      umbrellaQuery = supabaseAdmin.from('umbrellas').select('id, tenant_id, number, label, active, vendor_id').eq('number', umbrellaNumber).eq('vendor_id', vendorId).limit(1);
    }

    if (vendorId) {
      umbrellaQuery = umbrellaQuery.eq('vendor_id', vendorId);
    }

    const { data: umbrella, error: umbrellaError } = await umbrellaQuery.single();

    if (umbrellaError || !umbrella) {
      return NextResponse.json({ error: 'Guarda-sol nao encontrado para este quiosque.' }, { status: 404 });
    }

    if (!umbrella.active) {
      return NextResponse.json({ error: 'Este guarda-sol esta inativo.' }, { status: 403 });
    }

    const features = await getTenantFeatureMap(umbrella.tenant_id);
    if (!features.beach_umbrellas || !features.qr_code) {
      return NextResponse.json(featureDisabledResponse('beach_umbrellas'), { status: 403 });
    }
    if (!features.digital_menu) {
      return NextResponse.json(featureDisabledResponse('digital_menu'), { status: 403 });
    }

    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors')
      .select('id, tenant_id, name, primary_color, secondary_color, button_color, button_text_color, logo_url, is_active, subscription_status')
      .eq('id', umbrella.vendor_id)
      .eq('tenant_id', umbrella.tenant_id)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    if (!vendor.is_active || vendor.subscription_status === 'blocked') {
      return NextResponse.json({ error: 'Quiosque indisponivel.' }, { status: 403 });
    }

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, name, category, subcategory, description, price, promotional_price, image_url, active, is_combo, sort_order, stock_tracking_enabled, beach_stock_quantity, stock_quantity, blocked_by_stock, option_group_name, option_values, menu_highlight, promotion_starts_at, promotion_ends_at')
      .eq('tenant_id', umbrella.tenant_id)
      .eq('vendor_id', umbrella.vendor_id)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (productsError) throw productsError;

    const visible = ((products || []) as any[])
      .filter(isProductVisibleToCustomer)
      .map((product) => ({
        ...product,
        image_url: normalizeRenderableProductImageUrl(product.image_url),
      }));

    return NextResponse.json({
      umbrella: {
        id: umbrella.id,
        tenant_id: umbrella.tenant_id,
        number: umbrella.number,
        label: umbrella.label,
      },
      vendor: {
        id: vendor.id,
        tenant_id: vendor.tenant_id,
        name: vendor.name,
        primary_color: vendor.primary_color,
        secondary_color: vendor.secondary_color,
        button_color: (vendor as any).button_color,
        button_text_color: (vendor as any).button_text_color,
        logo_url: vendor.logo_url,
      },
      features,
      products: visible,
    });
  } catch (err) {
    console.error('Public umbrella error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
