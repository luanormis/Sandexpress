export const TRIAL_DAYS = 3;
export const PLAN_UMBRELLA_LIMIT = 100;
// Limite fisico da plataforma. Acima do padrao comercial, somente o admin
// pode autorizar individualmente no cadastro do quiosque.
export const ADMIN_UMBRELLA_LIMIT = 120;

export const PLAN_PRICES = {
  quarterly: 499.99,
  semester: 399.99,
  annualMonthly: 299.99,
} as const;

export const PLAN_PRICE_LABELS = {
  quarterly: "R$499,99",
  semester: "R$399,99",
  annualMonthly: "R$299,99",
} as const;

export type PlatformPlanSettings = {
  trial_days: number;
  quarterly_price: number;
  semester_price: number;
  annual_monthly_price: number;
  max_umbrellas: number;
};

export const DEFAULT_PLATFORM_PLAN_SETTINGS: PlatformPlanSettings = {
  trial_days: TRIAL_DAYS,
  quarterly_price: PLAN_PRICES.quarterly,
  semester_price: PLAN_PRICES.semester,
  annual_monthly_price: PLAN_PRICES.annualMonthly,
  max_umbrellas: PLAN_UMBRELLA_LIMIT,
};

export function toPlanMoney(value: unknown, fallback: number) {
  const raw = String(value ?? '').trim();
  const normalized = typeof value === 'number' || !raw.includes(',')
    ? raw
    : raw.replace(/\./g, '').replace(',', '.');
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Number(numeric.toFixed(2));
}

export function formatPlanPriceLabel(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
