-- SandExpress - preparacao para 1.000 quiosques, padrao 100 e autorizacao admin ate 120 guarda-sois.
-- UPDATE consolidado, idempotente e sem exclusao de dados operacionais.
-- Execute uma vez no SQL Editor do Supabase sobre o banco existente.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS max_umbrellas INTEGER NOT NULL DEFAULT 100;

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_order_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  umbrella_id UUID REFERENCES umbrellas(id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','preparing','delivering','completed','cancelled')),
  notes TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, sequence)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  umbrella_id UUID REFERENCES umbrellas(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  city TEXT,
  beach_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS order_request_id UUID REFERENCES customer_order_requests(id) ON DELETE SET NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'vendors'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%max_umbrellas%'
  LOOP
    EXECUTE format('ALTER TABLE public.vendors DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE vendors ALTER COLUMN max_umbrellas SET DEFAULT 100;
UPDATE vendors SET max_umbrellas = CASE WHEN max_umbrellas > 120 THEN 120 ELSE 100 END
WHERE max_umbrellas IS NULL OR max_umbrellas = 50 OR max_umbrellas > 120;
ALTER TABLE vendors
  ADD CONSTRAINT vendors_max_umbrellas_scale_check CHECK (max_umbrellas BETWEEN 1 AND 120) NOT VALID;
ALTER TABLE vendors VALIDATE CONSTRAINT vendors_max_umbrellas_scale_check;

INSERT INTO platform_settings(key, value, description)
VALUES (
  'plans.current',
  '{"trial_days":3,"quarterly_price":499.99,"semester_price":399.99,"annual_monthly_price":299.99,"max_umbrellas":100}'::JSONB,
  'Padrao comercial: 100 guarda-sois. O admin pode autorizar ate 120 por quiosque.'
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_set(COALESCE(platform_settings.value, '{}'::JSONB), '{max_umbrellas}', '100'::JSONB, TRUE),
    description = EXCLUDED.description,
    updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_orders_vendor_open_created_scale
  ON orders(vendor_id, created_at DESC)
  WHERE paid = FALSE;

CREATE INDEX IF NOT EXISTS idx_order_requests_order_status_sequence_scale
  ON customer_order_requests(order_id, status, sequence DESC);

CREATE OR REPLACE FUNCTION enforce_vendor_umbrella_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  vendor_limit INTEGER;
  current_count INTEGER;
BEGIN
  SELECT LEAST(120, COALESCE(max_umbrellas, 100))
  INTO vendor_limit
  FROM vendors
  WHERE id = NEW.vendor_id
  FOR UPDATE;

  IF vendor_limit IS NULL THEN
    RAISE EXCEPTION 'Quiosque nao encontrado.';
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM umbrellas
  WHERE vendor_id = NEW.vendor_id;

  IF current_count >= vendor_limit THEN
    RAISE EXCEPTION 'Limite de % guarda-sois do plano atingido.', vendor_limit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_vendor_umbrella_limit ON umbrellas;
CREATE TRIGGER trg_enforce_vendor_umbrella_limit
BEFORE INSERT ON umbrellas
FOR EACH ROW EXECUTE FUNCTION enforce_vendor_umbrella_limit();

CREATE TABLE IF NOT EXISTS order_idempotency_keys (
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_order_idempotency_created
  ON order_idempotency_keys(created_at);

INSERT INTO order_idempotency_keys(vendor_id, idempotency_key, result, created_at)
SELECT
  vendor_id,
  (metadata->>'idempotency_key')::UUID,
  jsonb_build_object('id', metadata->>'order_id', 'synchronized', TRUE),
  created_at
FROM analytics_events
WHERE event_type = 'offline_order_idempotency'
  AND vendor_id IS NOT NULL
  AND metadata->>'idempotency_key' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND NULLIF(metadata->>'order_id', '') IS NOT NULL
ON CONFLICT (vendor_id, idempotency_key) DO NOTHING;

ALTER TABLE order_idempotency_keys ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_idempotency_keys TO service_role;

CREATE OR REPLACE FUNCTION create_customer_order_idempotent(
  p_vendor_id UUID,
  p_customer_id UUID,
  p_umbrella_id UUID,
  p_items JSONB,
  p_notes TEXT,
  p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  claimed BOOLEAN := FALSE;
  stored_result JSONB;
BEGIN
  INSERT INTO order_idempotency_keys(vendor_id, idempotency_key)
  VALUES (p_vendor_id, p_idempotency_key)
  ON CONFLICT (vendor_id, idempotency_key) DO NOTHING
  RETURNING TRUE INTO claimed;

  IF NOT COALESCE(claimed, FALSE) THEN
    SELECT result INTO stored_result
    FROM order_idempotency_keys
    WHERE vendor_id = p_vendor_id AND idempotency_key = p_idempotency_key;

    IF stored_result IS NULL THEN
      RAISE EXCEPTION 'Pedido com esta chave ainda esta em processamento.';
    END IF;
    RETURN stored_result || jsonb_build_object('duplicate', TRUE, 'synchronized', TRUE);
  END IF;

  stored_result := create_customer_order(p_vendor_id, p_customer_id, p_umbrella_id, p_items, p_notes);

  UPDATE order_idempotency_keys
  SET result = stored_result
  WHERE vendor_id = p_vendor_id AND idempotency_key = p_idempotency_key;

  RETURN stored_result;
END;
$$;

REVOKE ALL ON FUNCTION create_customer_order_idempotent(UUID, UUID, UUID, JSONB, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_customer_order_idempotent(UUID, UUID, UUID, JSONB, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION create_customer_order_idempotent(UUID, UUID, UUID, JSONB, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_customer_order_idempotent(UUID, UUID, UUID, JSONB, TEXT, UUID) TO service_role;

ANALYZE vendors;
ANALYZE umbrellas;
ANALYZE orders;
ANALYZE customer_order_requests;

COMMIT;
