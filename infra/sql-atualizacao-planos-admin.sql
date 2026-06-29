-- SandExpress - precos de planos editaveis pelo admin.
-- Aplicar em projetos existentes. Nao apaga dados.

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS plan_monthly_price NUMERIC(10,2) NOT NULL DEFAULT 499.99 CHECK (plan_monthly_price >= 0),
  ADD COLUMN IF NOT EXISTS plan_annual_monthly_price NUMERIC(10,2) NOT NULL DEFAULT 299.99 CHECK (plan_annual_monthly_price >= 0);

INSERT INTO platform_settings (key, value, description)
VALUES (
  'plans.current',
  '{
    "currency": "BRL",
    "trial_days": 3,
    "monthly_price": 499.99,
    "annual_monthly_price": 299.99,
    "max_umbrellas": 50
  }'::jsonb,
  'Planos comerciais atuais usados apenas como padrao para novos quiosques.'
)
ON CONFLICT (key) DO UPDATE
SET value = platform_settings.value
  || jsonb_build_object(
    'monthly_price', COALESCE(platform_settings.value->'monthly_price', '499.99'::jsonb),
    'annual_monthly_price', COALESCE(platform_settings.value->'annual_monthly_price', '299.99'::jsonb),
    'trial_days', COALESCE(platform_settings.value->'trial_days', '3'::jsonb),
    'max_umbrellas', COALESCE(platform_settings.value->'max_umbrellas', '50'::jsonb)
  ),
  description = EXCLUDED.description,
  updated_at = NOW();

ANALYZE vendors;
ANALYZE platform_settings;
