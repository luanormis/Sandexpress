export const TRIAL_DAYS = 3;
export const PLAN_UMBRELLA_LIMIT = 50;

export const PLAN_PRICES = {
  monthly: 499.99,
  annualMonthly: 299.99,
} as const;

export const PLAN_PRICE_LABELS = {
  monthly: "R$499,99",
  annualMonthly: "R$299,99",
} as const;

export type PlatformPlanSettings = {
  trial_days: number;
  monthly_price: number;
  annual_monthly_price: number;
  max_umbrellas: number;
};

export const DEFAULT_PLATFORM_PLAN_SETTINGS: PlatformPlanSettings = {
  trial_days: TRIAL_DAYS,
  monthly_price: PLAN_PRICES.monthly,
  annual_monthly_price: PLAN_PRICES.annualMonthly,
  max_umbrellas: PLAN_UMBRELLA_LIMIT,
};

export function toPlanMoney(value: unknown, fallback: number) {
  const numeric = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Number(numeric.toFixed(2));
}

export function formatPlanPriceLabel(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
