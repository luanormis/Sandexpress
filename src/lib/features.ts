import { supabaseAdmin } from './supabase-admin';

export const CORE_FEATURE_KEYS = [
  'login',
  'multi_tenant',
  'beach_umbrellas',
  'qr_code',
  'digital_menu',
  'orders',
  'kitchen',
  'cashier',
  'push_notifications',
  'operational_dashboard',
  'beach_map',
  'waiter_call',
  'cleaning_request',
  'umbrella_transfer',
  'vip_areas',
] as const;

export const OPTIONAL_FEATURE_KEYS = [
  'restaurant',
  'internal_tables',
  'food_court',
  'events',
  'delivery',
  'pickup',
  'loyalty',
  'cashback',
  'benefits_club',
  'marketplace',
  'franchises',
] as const;

export const FEATURE_KEYS = [...CORE_FEATURE_KEYS, ...OPTIONAL_FEATURE_KEYS] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];
export type FeatureMap = Record<FeatureKey, boolean>;
type TenantFeatureRow = {
  feature_key: string | null;
  enabled: boolean | null;
};

const FEATURE_CACHE_TTL_MS = 30_000;
const vendorFeatureCache = new Map<string, { expiresAt: number; enabled: boolean }>();
const vendorFeatureInFlight = new Map<string, Promise<boolean>>();

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  login: 'Login',
  multi_tenant: 'Multi Tenant',
  beach_umbrellas: 'Guarda-Sois',
  qr_code: 'QR Code',
  digital_menu: 'Cardapio Digital',
  orders: 'Pedidos',
  kitchen: 'Cozinha',
  cashier: 'Caixa',
  push_notifications: 'Push Notification',
  operational_dashboard: 'Dashboard Operacional',
  beach_map: 'Mapa da Praia',
  waiter_call: 'Chamar Atendente',
  cleaning_request: 'Solicitar Limpeza',
  umbrella_transfer: 'Troca de Guarda-Sol',
  vip_areas: 'Areas VIP',
  restaurant: 'Restaurante Tradicional',
  internal_tables: 'Mesas Internas',
  food_court: 'Praca de Alimentacao',
  events: 'Eventos',
  delivery: 'Delivery',
  pickup: 'Retirada Balcao',
  loyalty: 'Programa de Fidelidade',
  cashback: 'Cashback',
  benefits_club: 'Clube de Beneficios',
  marketplace: 'Marketplace',
  franchises: 'Franquias',
};

export const DEFAULT_FEATURES = FEATURE_KEYS.reduce((acc, key) => {
  acc[key] = (CORE_FEATURE_KEYS as readonly string[]).includes(key);
  return acc;
}, {} as FeatureMap);

function isMissingFeatureTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.message?.includes('tenant_features');
}

export function sanitizeFeatureKey(value: unknown): FeatureKey | null {
  const key = String(value || '').trim();
  return (FEATURE_KEYS as readonly string[]).includes(key) ? key as FeatureKey : null;
}

export async function getVendorTenantId(vendorId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('vendors')
    .select('tenant_id')
    .eq('id', vendorId)
    .single();

  if (error || !data?.tenant_id) return null;
  return data.tenant_id;
}

export async function getTenantFeatureMap(tenantId: string): Promise<FeatureMap> {
  const features: FeatureMap = { ...DEFAULT_FEATURES };
  const { data, error } = await supabaseAdmin
    .from('tenant_features')
    .select('feature_key, enabled')
    .eq('tenant_id', tenantId);

  if (error) {
    if (isMissingFeatureTable(error)) return features;
    throw error;
  }

  ((data || []) as TenantFeatureRow[]).forEach((row) => {
    const key = sanitizeFeatureKey(row.feature_key);
    if (key) features[key] = Boolean(row.enabled);
  });

  return features;
}

export async function featureEnabled(tenantId: string, featureKey: FeatureKey): Promise<boolean> {
  const features = await getTenantFeatureMap(tenantId);
  return features[featureKey];
}

export async function vendorFeatureEnabled(vendorId: string, featureKey: FeatureKey): Promise<boolean> {
  const cacheKey = `${vendorId}:${featureKey}`;
  const cached = vendorFeatureCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.enabled;
  const pending = vendorFeatureInFlight.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
  const tenantId = await getVendorTenantId(vendorId);
    if (!tenantId) return false;
    return featureEnabled(tenantId, featureKey);
  })();
  vendorFeatureInFlight.set(cacheKey, request);
  try {
    const enabled = await request;
    vendorFeatureCache.set(cacheKey, { enabled, expiresAt: Date.now() + FEATURE_CACHE_TTL_MS });
    return enabled;
  } finally {
    vendorFeatureInFlight.delete(cacheKey);
  }
}

export function featureDisabledResponse(featureKey: FeatureKey) {
  return {
    error: `${FEATURE_LABELS[featureKey]} esta desativado para este tenant.`,
    feature_key: featureKey,
  };
}

export function buildTenantFeatureRows(tenantId: string) {
  return FEATURE_KEYS.map((feature_key) => ({
    tenant_id: tenantId,
    feature_key,
    enabled: DEFAULT_FEATURES[feature_key],
  }));
}
