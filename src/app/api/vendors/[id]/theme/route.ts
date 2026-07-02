import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : null;
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

function normalizePayoutDays(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback;
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

    const { data: rateRows } = await (supabaseAdmin.from('payment_method_rates') as any)
      .select('payment_method, fee_rate, payout_delay_days')
      .eq('vendor_id', id);
    const rates = ((rateRows || []) as any[]).reduce((acc, row) => {
      acc[row.payment_method] = row;
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      tenant_id: vendor.tenant_id,
      primary_color: tenant?.primary_color || vendor.primary_color,
      secondary_color: tenant?.secondary_color || vendor.secondary_color,
      button_color: tenant?.button_color || (vendor as any).button_color,
      button_text_color: tenant?.button_text_color || (vendor as any).button_text_color,
      logo_url: tenant?.logo_url || vendor.logo_url,
      debit_card_fee_rate: Number(rates.debit_card?.fee_rate ?? vendor.debit_card_fee_rate ?? 0),
      credit_card_fee_rate: Number(rates.credit_card?.fee_rate ?? vendor.credit_card_fee_rate ?? 0),
      pix_fee_rate: Number(rates.pix?.fee_rate ?? vendor.pix_fee_rate ?? 0),
      debit_card_payout_days: Number(rates.debit_card?.payout_delay_days ?? 1),
      credit_card_payout_days: Number(rates.credit_card?.payout_delay_days ?? 30),
      pix_payout_days: Number(rates.pix?.payout_delay_days ?? 0),
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
    const primaryColor = normalizeColor(body.primary_color);
    const secondaryColor = normalizeColor(body.secondary_color);
    const buttonColor = normalizeColor(body.button_color);
    const buttonTextColor = normalizeColor(body.button_text_color);
    const logoUrl = normalizeLogoUrl(body.logo_url);
    if (!primaryColor || !secondaryColor || !buttonColor || !buttonTextColor) {
      return NextResponse.json({ error: 'Informe cores validas no formato #RRGGBB.' }, { status: 400 });
    }
    const paymentFeeUpdate = {
      debit_card_fee_rate: normalizeFeeRate(body.debit_card_fee_rate),
      credit_card_fee_rate: normalizeFeeRate(body.credit_card_fee_rate),
      pix_fee_rate: normalizeFeeRate(body.pix_fee_rate),
    };
    const payoutDays = {
      debit_card_payout_days: normalizePayoutDays(body.debit_card_payout_days, 1),
      credit_card_payout_days: normalizePayoutDays(body.credit_card_payout_days, 30),
      pix_payout_days: normalizePayoutDays(body.pix_payout_days, 0),
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

    const paymentRatesPayload = [
      {
        tenant_id: vendor.tenant_id,
        vendor_id: id,
        payment_method: 'pix',
        fee_rate: paymentFeeUpdate.pix_fee_rate,
        payout_delay_days: payoutDays.pix_payout_days,
        active: true,
        updated_at: new Date().toISOString(),
      },
      {
        tenant_id: vendor.tenant_id,
        vendor_id: id,
        payment_method: 'debit_card',
        fee_rate: paymentFeeUpdate.debit_card_fee_rate,
        payout_delay_days: payoutDays.debit_card_payout_days,
        active: true,
        updated_at: new Date().toISOString(),
      },
      {
        tenant_id: vendor.tenant_id,
        vendor_id: id,
        payment_method: 'credit_card',
        fee_rate: paymentFeeUpdate.credit_card_fee_rate,
        payout_delay_days: payoutDays.credit_card_payout_days,
        active: true,
        updated_at: new Date().toISOString(),
      },
      {
        tenant_id: vendor.tenant_id,
        vendor_id: id,
        payment_method: 'cash',
        fee_rate: 0,
        payout_delay_days: 0,
        active: true,
        updated_at: new Date().toISOString(),
      },
    ];
    const { error: ratesError } = await (supabaseAdmin.from('payment_method_rates') as any)
      .upsert(paymentRatesPayload, { onConflict: 'vendor_id,payment_method' });
    if (ratesError) throw ratesError;

    return NextResponse.json({
      tenant_id: vendor.tenant_id,
      ...themeUpdate,
      ...paymentFeeUpdate,
      ...payoutDays,
    });
  } catch (err) {
    console.error('Vendor theme PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
