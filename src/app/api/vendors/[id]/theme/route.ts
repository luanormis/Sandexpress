import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

const DEFAULT_THEME = {
  primary_color: '#ff6b00',
  secondary_color: '#82533f',
  button_color: '#ff6b00',
  button_text_color: '#ffffff',
  logo_url: '/logo-sandexpress.png',
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

function normalizeLogoUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return null;
}

function normalizeFeeRate(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Number(numeric.toFixed(2)) : 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getRequestSession(req);
    if (!canAccessVendor(session, id)) {
      return NextResponse.json({ error: 'Acesso restrito ao quiosque.' }, { status: 403 });
    }

    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors')
      .select('id, tenant_id, primary_color, secondary_color, button_color, button_text_color, logo_url, debit_card_fee_rate, credit_card_fee_rate, pix_fee_rate')
      .eq('id', id)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    const { data: tenant } = await (supabaseAdmin.from('tenants') as any)
      .select('id, primary_color, secondary_color, button_color, button_text_color, logo_url')
      .eq('id', vendor.tenant_id)
      .single();

    return NextResponse.json({
      tenant_id: vendor.tenant_id,
      primary_color: tenant?.primary_color || vendor.primary_color || DEFAULT_THEME.primary_color,
      secondary_color: tenant?.secondary_color || vendor.secondary_color || DEFAULT_THEME.secondary_color,
      button_color: tenant?.button_color || (vendor as any).button_color || DEFAULT_THEME.button_color,
      button_text_color: tenant?.button_text_color || (vendor as any).button_text_color || DEFAULT_THEME.button_text_color,
      logo_url: tenant?.logo_url || vendor.logo_url || DEFAULT_THEME.logo_url,
      debit_card_fee_rate: vendor.debit_card_fee_rate || 0,
      credit_card_fee_rate: vendor.credit_card_fee_rate || 0,
      pix_fee_rate: vendor.pix_fee_rate || 0,
    });
  } catch (err) {
    console.error('Vendor theme GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getRequestSession(req);
    if (!canAccessVendor(session, id)) {
      return NextResponse.json({ error: 'Acesso restrito ao quiosque.' }, { status: 403 });
    }

    const body = await req.json();
    const primaryColor = normalizeColor(body.primary_color, DEFAULT_THEME.primary_color);
    const secondaryColor = normalizeColor(body.secondary_color, DEFAULT_THEME.secondary_color);
    const buttonColor = normalizeColor(body.button_color, primaryColor || DEFAULT_THEME.button_color);
    const buttonTextColor = normalizeColor(body.button_text_color, DEFAULT_THEME.button_text_color);
    const logoUrl = normalizeLogoUrl(body.logo_url) || DEFAULT_THEME.logo_url;
    const paymentFeeUpdate = {
      debit_card_fee_rate: normalizeFeeRate(body.debit_card_fee_rate),
      credit_card_fee_rate: normalizeFeeRate(body.credit_card_fee_rate),
      pix_fee_rate: normalizeFeeRate(body.pix_fee_rate),
    };

    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors')
      .select('id, tenant_id')
      .eq('id', id)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    const themeUpdate = {
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      button_color: buttonColor,
      button_text_color: buttonTextColor,
      logo_url: logoUrl,
    };

    const { error: tenantError } = await (supabaseAdmin.from('tenants') as any)
      .update(themeUpdate)
      .eq('id', vendor.tenant_id);

    if (tenantError) throw tenantError;

    const { error: vendorUpdateError } = await supabaseAdmin
      .from('vendors')
      .update({ ...themeUpdate, ...paymentFeeUpdate, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (vendorUpdateError) throw vendorUpdateError;

    return NextResponse.json({
      tenant_id: vendor.tenant_id,
      ...themeUpdate,
      ...paymentFeeUpdate,
    });
  } catch (err) {
    console.error('Vendor theme PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
