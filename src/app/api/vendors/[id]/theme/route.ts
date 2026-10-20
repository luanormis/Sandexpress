import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

const FIXED_PALETTE = { primary_color: '#fff8e8', secondary_color: '#241b16', button_color: '#ff9a3c', button_text_color: '#241b16' };

function normalizeFeeRate(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Number(numeric.toFixed(2)) : 0;
}

function normalizeFixedFeeAmount(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Number(numeric.toFixed(2)) : 0;
}

function normalizeFeeType(value: unknown) {
  return value === 'fixed' ? 'fixed' : 'percent';
}

function normalizePayoutDays(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback;
}

function normalizeActive(value: unknown, fallback = true) {
  return typeof value === 'boolean' ? value : fallback;
}

const PAYMENT_METHOD_CONFIG = [
  {
    method: 'cash',
    rateField: 'cash_fee_rate',
    typeField: 'cash_fee_type',
    fixedField: 'cash_fixed_fee_amount',
    daysField: 'cash_payout_days',
    apiField: 'cash_api_enabled',
    fallbackDays: 0,
  },
  {
    method: 'pix',
    rateField: 'pix_fee_rate',
    typeField: 'pix_fee_type',
    fixedField: 'pix_fixed_fee_amount',
    daysField: 'pix_payout_days',
    apiField: 'pix_api_enabled',
    fallbackDays: 0,
  },
  {
    method: 'debit_card',
    rateField: 'debit_card_fee_rate',
    typeField: 'debit_card_fee_type',
    fixedField: 'debit_card_fixed_fee_amount',
    daysField: 'debit_card_payout_days',
    apiField: 'debit_card_api_enabled',
    fallbackDays: 1,
  },
  {
    method: 'credit_card',
    rateField: 'credit_card_fee_rate',
    typeField: 'credit_card_fee_type',
    fixedField: 'credit_card_fixed_fee_amount',
    daysField: 'credit_card_payout_days',
    apiField: 'credit_card_api_enabled',
    fallbackDays: 30,
  },
] as const;

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

    const { data: rateRows, error: rateError } = await (supabaseAdmin.from('payment_method_rates') as any)
      .select('payment_method, fee_rate, fee_type, fixed_fee_amount, payout_delay_days, active, api_enabled')
      .eq('vendor_id', id);
    if (rateError) throw rateError;
    const rates = ((rateRows || []) as any[]).reduce((acc, row) => {
      acc[row.payment_method] = row;
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      tenant_id: vendor.tenant_id,
      ...FIXED_PALETTE,
      logo_url: vendor.logo_url,
      cash_fee_rate: Number(rates.cash?.fee_rate ?? 0),
      cash_fee_type: rates.cash?.fee_type || 'percent',
      cash_fixed_fee_amount: Number(rates.cash?.fixed_fee_amount ?? 0),
      cash_payout_days: Number(rates.cash?.payout_delay_days ?? 0),
      cash_active: rates.cash?.active ?? true,
      cash_api_enabled: rates.cash?.api_enabled ?? false,
      debit_card_fee_rate: Number(rates.debit_card?.fee_rate ?? vendor.debit_card_fee_rate ?? 0),
      debit_card_fee_type: rates.debit_card?.fee_type || 'percent',
      debit_card_fixed_fee_amount: Number(rates.debit_card?.fixed_fee_amount ?? 0),
      credit_card_fee_rate: Number(rates.credit_card?.fee_rate ?? vendor.credit_card_fee_rate ?? 0),
      credit_card_fee_type: rates.credit_card?.fee_type || 'percent',
      credit_card_fixed_fee_amount: Number(rates.credit_card?.fixed_fee_amount ?? 0),
      pix_fee_rate: Number(rates.pix?.fee_rate ?? vendor.pix_fee_rate ?? 0),
      pix_fee_type: rates.pix?.fee_type || 'percent',
      pix_fixed_fee_amount: Number(rates.pix?.fixed_fee_amount ?? 0),
      debit_card_payout_days: Number(rates.debit_card?.payout_delay_days ?? 1),
      debit_card_active: rates.debit_card?.active ?? true,
      debit_card_api_enabled: rates.debit_card?.api_enabled ?? false,
      credit_card_payout_days: Number(rates.credit_card?.payout_delay_days ?? 30),
      credit_card_active: rates.credit_card?.active ?? true,
      credit_card_api_enabled: rates.credit_card?.api_enabled ?? false,
      pix_payout_days: Number(rates.pix?.payout_delay_days ?? 0),
      pix_active: rates.pix?.active ?? true,
      pix_api_enabled: rates.pix?.api_enabled ?? false,
    }, { headers: NO_STORE_HEADERS });
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
    if (body.background_only === true) {
      return NextResponse.json(FIXED_PALETTE, { headers: NO_STORE_HEADERS });
    }
    const paymentFeeUpdate = {
      debit_card_fee_rate: normalizeFeeRate(body.debit_card_fee_rate),
      credit_card_fee_rate: normalizeFeeRate(body.credit_card_fee_rate),
      pix_fee_rate: normalizeFeeRate(body.pix_fee_rate),
    };
    const paymentSettings = PAYMENT_METHOD_CONFIG.reduce((acc, config) => {
      acc[config.method] = {
        feeRate: normalizeFeeRate(body[config.rateField]),
        feeType: normalizeFeeType(body[config.typeField]),
        fixedFeeAmount: normalizeFixedFeeAmount(body[config.fixedField]),
        payoutDays: normalizePayoutDays(body[config.daysField], config.fallbackDays),
        active: normalizeActive(body[`${config.method}_active`], true),
        apiEnabled: normalizeActive(body[config.apiField], false),
      };
      return acc;
    }, {} as Record<string, { feeRate: number; feeType: string; fixedFeeAmount: number; payoutDays: number; active: boolean; apiEnabled: boolean }>);
    const payoutDays = {
      cash_payout_days: paymentSettings.cash.payoutDays,
      debit_card_payout_days: paymentSettings.debit_card.payoutDays,
      credit_card_payout_days: paymentSettings.credit_card.payoutDays,
      pix_payout_days: paymentSettings.pix.payoutDays,
    };

    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors')
      .select('id, tenant_id')
      .eq('id', id)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    const { error: vendorUpdateError } = await supabaseAdmin
      .from('vendors')
      .update({ ...paymentFeeUpdate, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (vendorUpdateError) throw vendorUpdateError;

    const paymentRatesPayload = PAYMENT_METHOD_CONFIG.map((config) => ({
        tenant_id: vendor.tenant_id,
        vendor_id: id,
        payment_method: config.method,
        fee_rate: paymentSettings[config.method].feeType === 'percent' ? paymentSettings[config.method].feeRate : 0,
        fee_type: paymentSettings[config.method].feeType,
        fixed_fee_amount: paymentSettings[config.method].feeType === 'fixed' ? paymentSettings[config.method].fixedFeeAmount : 0,
        payout_delay_days: paymentSettings[config.method].payoutDays,
        active: paymentSettings[config.method].active,
        api_enabled: paymentSettings[config.method].apiEnabled,
        updated_at: new Date().toISOString(),
      }));
    const { error: ratesError } = await (supabaseAdmin.from('payment_method_rates') as any)
      .upsert(paymentRatesPayload, { onConflict: 'vendor_id,payment_method' });
    if (ratesError) throw ratesError;

    return NextResponse.json({
      tenant_id: vendor.tenant_id,
      ...FIXED_PALETTE,
      ...paymentFeeUpdate,
      ...payoutDays,
      cash_fee_rate: paymentSettings.cash.feeRate,
      cash_fee_type: paymentSettings.cash.feeType,
      cash_fixed_fee_amount: paymentSettings.cash.fixedFeeAmount,
      cash_active: paymentSettings.cash.active,
      cash_api_enabled: paymentSettings.cash.apiEnabled,
      debit_card_fee_type: paymentSettings.debit_card.feeType,
      debit_card_fixed_fee_amount: paymentSettings.debit_card.fixedFeeAmount,
      debit_card_active: paymentSettings.debit_card.active,
      debit_card_api_enabled: paymentSettings.debit_card.apiEnabled,
      credit_card_fee_type: paymentSettings.credit_card.feeType,
      credit_card_fixed_fee_amount: paymentSettings.credit_card.fixedFeeAmount,
      credit_card_active: paymentSettings.credit_card.active,
      credit_card_api_enabled: paymentSettings.credit_card.apiEnabled,
      pix_fee_type: paymentSettings.pix.feeType,
      pix_fixed_fee_amount: paymentSettings.pix.fixedFeeAmount,
      pix_active: paymentSettings.pix.active,
      pix_api_enabled: paymentSettings.pix.apiEnabled,
    }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error('Vendor theme PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
