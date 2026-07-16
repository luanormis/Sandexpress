import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const rawLine of readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const match = rawLine.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
}

if (process.env.APPLY_SCALE_DEFAULTS !== 'CONFIRM_100_UMBRELLAS') {
  throw new Error('Defina APPLY_SCALE_DEFAULTS=CONFIRM_100_UMBRELLAS.');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Variaveis do Supabase ausentes.');

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: current, error: settingsReadError } = await admin
  .from('platform_settings')
  .select('value')
  .eq('key', 'plans.current')
  .maybeSingle();
if (settingsReadError) throw settingsReadError;

const nextValue = { ...(current?.value || {}), max_umbrellas: 100 };
const { error: settingsError } = await admin.from('platform_settings').upsert({
  key: 'plans.current',
  value: nextValue,
  description: 'Planos comerciais atuais: ate 100 guarda-sois por quiosque.',
  updated_at: new Date().toISOString(),
}, { onConflict: 'key' });
if (settingsError) throw settingsError;

const { data: vendors, error: vendorReadError } = await admin.from('vendors').select('id, max_umbrellas');
if (vendorReadError) throw vendorReadError;
const legacyVendorIds = (vendors || []).filter((vendor) => Number(vendor.max_umbrellas || 0) === 50).map((vendor) => vendor.id);

let vendorUpdate = { updated: 0, migration_required: false, error: null };
if (legacyVendorIds.length > 0) {
  const { error } = await admin.from('vendors').update({ max_umbrellas: 100, updated_at: new Date().toISOString() }).in('id', legacyVendorIds);
  vendorUpdate = {
    updated: error ? 0 : legacyVendorIds.length,
    migration_required: error?.code === '23514',
    error: error ? `${error.code || ''} ${error.message}`.trim() : null,
  };
}

process.stdout.write(`${JSON.stringify({ platform_max_umbrellas: 100, legacy_vendors: legacyVendorIds.length, vendor_update: vendorUpdate }, null, 2)}\n`);
