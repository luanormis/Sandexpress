import { DEFAULT_PLATFORM_PLAN_SETTINGS, PlatformPlanSettings, toPlanMoney } from '@/lib/plans';
import { supabaseAdmin } from '@/lib/supabase-admin';

const PLAN_SETTINGS_KEY = 'plans.current';

export async function getPlatformPlanSettings(): Promise<PlatformPlanSettings> {
  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('value')
    .eq('key', PLAN_SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code || '')) return DEFAULT_PLATFORM_PLAN_SETTINGS;
    throw error;
  }

  const value = (data?.value || {}) as Partial<PlatformPlanSettings>;
  return {
    trial_days: Math.max(0, Math.floor(Number(value.trial_days ?? DEFAULT_PLATFORM_PLAN_SETTINGS.trial_days))),
    monthly_price: toPlanMoney(value.monthly_price, DEFAULT_PLATFORM_PLAN_SETTINGS.monthly_price),
    annual_monthly_price: toPlanMoney(value.annual_monthly_price, DEFAULT_PLATFORM_PLAN_SETTINGS.annual_monthly_price),
    max_umbrellas: Math.max(1, Math.min(50, Math.floor(Number(value.max_umbrellas ?? DEFAULT_PLATFORM_PLAN_SETTINGS.max_umbrellas)))),
  };
}

export async function savePlatformPlanSettings(input: Partial<PlatformPlanSettings>) {
  const current = await getPlatformPlanSettings();
  const next: PlatformPlanSettings = {
    trial_days: Math.max(0, Math.floor(Number(input.trial_days ?? current.trial_days))),
    monthly_price: toPlanMoney(input.monthly_price, current.monthly_price),
    annual_monthly_price: toPlanMoney(input.annual_monthly_price, current.annual_monthly_price),
    max_umbrellas: Math.max(1, Math.min(50, Math.floor(Number(input.max_umbrellas ?? current.max_umbrellas)))),
  };

  const { error } = await supabaseAdmin
    .from('platform_settings')
    .upsert({
      key: PLAN_SETTINGS_KEY,
      value: next,
      description: 'Planos comerciais atuais usados apenas como padrao para novos quiosques.',
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'key' });

  if (error) throw error;
  return next;
}
