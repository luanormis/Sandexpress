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

  const value = (data?.value || {}) as Partial<PlatformPlanSettings> & { monthly_price?: number };
  const legacyQuarterly = value.quarterly_price ?? value.monthly_price;
  return {
    trial_days: Math.max(0, Math.floor(Number(value.trial_days ?? DEFAULT_PLATFORM_PLAN_SETTINGS.trial_days))),
    quarterly_price: toPlanMoney(legacyQuarterly, DEFAULT_PLATFORM_PLAN_SETTINGS.quarterly_price),
    semester_price: toPlanMoney(value.semester_price, DEFAULT_PLATFORM_PLAN_SETTINGS.semester_price),
    annual_monthly_price: toPlanMoney(value.annual_monthly_price, DEFAULT_PLATFORM_PLAN_SETTINGS.annual_monthly_price),
    max_umbrellas: Math.max(1, Math.min(50, Math.floor(Number(value.max_umbrellas ?? DEFAULT_PLATFORM_PLAN_SETTINGS.max_umbrellas)))),
  };
}

export async function savePlatformPlanSettings(input: Partial<PlatformPlanSettings>) {
  const current = await getPlatformPlanSettings();
  const next: PlatformPlanSettings = {
    trial_days: Math.max(0, Math.floor(Number(input.trial_days ?? current.trial_days))),
    quarterly_price: toPlanMoney(input.quarterly_price ?? (input as any).monthly_price, current.quarterly_price),
    semester_price: toPlanMoney(input.semester_price, current.semester_price),
    annual_monthly_price: toPlanMoney(input.annual_monthly_price, current.annual_monthly_price),
    max_umbrellas: Math.max(1, Math.min(50, Math.floor(Number(input.max_umbrellas ?? current.max_umbrellas)))),
  };

  const { error } = await supabaseAdmin
    .from('platform_settings')
    .upsert({
      key: PLAN_SETTINGS_KEY,
      value: next,
      description: 'Planos comerciais atuais usados apenas como padrão para novos quiosques.',
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'key' });

  if (error) throw error;
  return next;
}
