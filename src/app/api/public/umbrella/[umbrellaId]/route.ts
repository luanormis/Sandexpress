import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { featureDisabledResponse, getTenantFeatureMap } from '@/lib/features';
import { isProductVisibleToCustomer } from '@/lib/public-product-visibility';

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
    const vendorId = searchParams.get('vendor_id');

    let umbrellaQuery = supabaseAdmin
      .from('umbrellas')
      .select('id, tenant_id, number, label, active, vendor_id')
      .eq('id', umbrellaId);

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

    const { data: tenantTheme } = await (supabaseAdmin.from('tenants') as any)
      .select('primary_color, secondary_color, button_color, button_text_color, logo_url')
      .eq('id', umbrella.tenant_id)
      .single();

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, name, category, description, price, promotional_price, image_url, active, is_combo, sort_order, stock_tracking_enabled, beach_stock_quantity, stock_quantity, blocked_by_stock')
      .eq('tenant_id', umbrella.tenant_id)
      .eq('vendor_id', umbrella.vendor_id)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (productsError) throw productsError;

    const visible = ((products || []) as any[]).filter(isProductVisibleToCustomer);

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
        primary_color: tenantTheme?.primary_color || vendor.primary_color || '#ff6b00',
        secondary_color: tenantTheme?.secondary_color || vendor.secondary_color || '#82533f',
        button_color: tenantTheme?.button_color || (vendor as any).button_color || '#ff6b00',
        button_text_color: tenantTheme?.button_text_color || (vendor as any).button_text_color || '#ffffff',
        logo_url: tenantTheme?.logo_url || vendor.logo_url || '/logo-sandexpress.png',
      },
      features,
      products: visible,
    });
  } catch (err) {
    console.error('Public umbrella error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
