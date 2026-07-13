-- SandExpress - planos trimestral e semestral.
-- Migração complementar, idempotente e sem apagar dados.

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS plan_quarterly_price NUMERIC(10,2) NOT NULL DEFAULT 499.99 CHECK (plan_quarterly_price >= 0),
  ADD COLUMN IF NOT EXISTS plan_semester_price NUMERIC(10,2) NOT NULL DEFAULT 399.99 CHECK (plan_semester_price >= 0);

UPDATE vendors
SET plan_quarterly_price = COALESCE(plan_quarterly_price, plan_monthly_price, 499.99),
    plan_semester_price = COALESCE(plan_semester_price, 399.99)
WHERE plan_quarterly_price IS NULL OR plan_semester_price IS NULL;

UPDATE platform_settings
SET value = jsonb_set(
      jsonb_set(value, '{quarterly_price}', COALESCE(value->'quarterly_price', value->'monthly_price', '499.99'::jsonb), true),
      '{semester_price}', COALESCE(value->'semester_price', '399.99'::jsonb), true
    ),
    updated_at = NOW()
WHERE key = 'plans.current';

INSERT INTO platform_settings(key, value, description)
VALUES (
  'plans.current',
  '{"trial_days":3,"quarterly_price":499.99,"semester_price":399.99,"annual_monthly_price":299.99,"max_umbrellas":50}'::jsonb,
  'Planos comerciais trimestral, semestral e anual.'
)
ON CONFLICT (key) DO NOTHING;

ANALYZE vendors;
ANALYZE platform_settings;
