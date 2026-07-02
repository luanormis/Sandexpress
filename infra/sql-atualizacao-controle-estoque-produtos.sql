-- SandExpress - prepara a tabela products para cadastro, edicao e exclusao.
-- Pode ser executado mais de uma vez no SQL Editor do Supabase.
-- Rode este script no projeto de producao antes de testar novos produtos.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID,
  vendor_id UUID,
  category TEXT NOT NULL DEFAULT 'Geral',
  name TEXT NOT NULL DEFAULT 'Produto sem nome',
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  promotional_price NUMERIC(10,2),
  image_url TEXT,
  is_default_image BOOLEAN DEFAULT TRUE,
  image_plan_type TEXT DEFAULT 'free',
  active BOOLEAN DEFAULT TRUE,
  is_combo BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 99,
  stock_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  physical_stock_quantity INTEGER NOT NULL DEFAULT 0,
  beach_stock_quantity INTEGER NOT NULL DEFAULT 0,
  stock_quantity INTEGER,
  blocked_by_stock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS vendor_id UUID,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Geral',
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotional_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_default_image BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS image_plan_type TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_combo BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 99,
  ADD COLUMN IF NOT EXISTS stock_tracking_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS physical_stock_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS beach_stock_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS blocked_by_stock BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF to_regclass('public.vendors') IS NOT NULL THEN
    UPDATE products p
    SET tenant_id = v.tenant_id
    FROM vendors v
    WHERE p.vendor_id = v.id
      AND p.tenant_id IS NULL
      AND v.tenant_id IS NOT NULL;
  END IF;
END $$;

UPDATE products
SET
  category = COALESCE(NULLIF(category, ''), 'Geral'),
  name = COALESCE(NULLIF(name, ''), 'Produto sem nome'),
  price = GREATEST(COALESCE(price, 0), 0),
  is_default_image = COALESCE(is_default_image, TRUE),
  image_plan_type = COALESCE(NULLIF(image_plan_type, ''), 'free'),
  active = COALESCE(active, TRUE),
  is_combo = COALESCE(is_combo, FALSE),
  sort_order = COALESCE(sort_order, 99),
  stock_tracking_enabled = COALESCE(stock_tracking_enabled, FALSE),
  physical_stock_quantity = GREATEST(COALESCE(physical_stock_quantity, 0), 0),
  beach_stock_quantity = GREATEST(COALESCE(beach_stock_quantity, stock_quantity, 0), 0),
  stock_quantity = CASE
    WHEN COALESCE(stock_tracking_enabled, FALSE) THEN GREATEST(COALESCE(beach_stock_quantity, stock_quantity, 0), 0)
    ELSE NULL
  END,
  blocked_by_stock = CASE
    WHEN COALESCE(stock_tracking_enabled, FALSE) THEN GREATEST(COALESCE(beach_stock_quantity, stock_quantity, 0), 0) <= 0
    ELSE FALSE
  END,
  created_at = COALESCE(created_at, NOW()),
  updated_at = NOW();

ALTER TABLE products
  ALTER COLUMN category SET DEFAULT 'Geral',
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN name SET DEFAULT 'Produto sem nome',
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN price SET DEFAULT 0,
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN is_default_image SET DEFAULT TRUE,
  ALTER COLUMN active SET DEFAULT TRUE,
  ALTER COLUMN is_combo SET DEFAULT FALSE,
  ALTER COLUMN sort_order SET DEFAULT 99,
  ALTER COLUMN stock_tracking_enabled SET DEFAULT FALSE,
  ALTER COLUMN stock_tracking_enabled SET NOT NULL,
  ALTER COLUMN physical_stock_quantity SET DEFAULT 0,
  ALTER COLUMN physical_stock_quantity SET NOT NULL,
  ALTER COLUMN beach_stock_quantity SET DEFAULT 0,
  ALTER COLUMN beach_stock_quantity SET NOT NULL,
  ALTER COLUMN blocked_by_stock SET DEFAULT FALSE,
  ALTER COLUMN blocked_by_stock SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
  IF to_regclass('public.vendors') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'products_vendor_id_fkey'
        AND conrelid = 'products'::regclass
    )
  THEN
    ALTER TABLE products
      ADD CONSTRAINT products_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'products_tenant_id_fkey'
        AND conrelid = 'products'::regclass
    )
  THEN
    ALTER TABLE products
      ADD CONSTRAINT products_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_price_nonnegative'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_price_nonnegative
      CHECK (price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_promotional_price_nonnegative'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_promotional_price_nonnegative
      CHECK (promotional_price IS NULL OR promotional_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_physical_stock_quantity_nonnegative'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_physical_stock_quantity_nonnegative
      CHECK (physical_stock_quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_beach_stock_quantity_nonnegative'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_beach_stock_quantity_nonnegative
      CHECK (beach_stock_quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_stock_quantity_nonnegative'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_stock_quantity_nonnegative
      CHECK (stock_quantity IS NULL OR stock_quantity >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor_sort ON products(vendor_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_tenant_vendor_active_category ON products(tenant_id, vendor_id, active, category);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_products_select ON products;
DROP POLICY IF EXISTS products_public_active_select ON products;
DROP POLICY IF EXISTS service_only_products ON products;

CREATE POLICY products_public_active_select
  ON products
  FOR SELECT
  TO anon, authenticated
  USING (active = TRUE);

-- As rotas server-side usam SUPABASE_SERVICE_ROLE_KEY para criar, editar e excluir.
-- A role service_role ignora RLS, mas ainda precisa de GRANT para a Data API.
GRANT SELECT ON products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO service_role;

ANALYZE products;
