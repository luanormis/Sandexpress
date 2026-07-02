-- Atualizacao incremental para ativar o controle de estoque em bancos existentes.
-- Pode ser executado mais de uma vez no SQL Editor do Supabase.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS physical_stock_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS beach_stock_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS blocked_by_stock BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE products
SET
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
  updated_at = NOW();

ALTER TABLE products
  ALTER COLUMN stock_tracking_enabled SET DEFAULT FALSE,
  ALTER COLUMN stock_tracking_enabled SET NOT NULL,
  ALTER COLUMN physical_stock_quantity SET DEFAULT 0,
  ALTER COLUMN physical_stock_quantity SET NOT NULL,
  ALTER COLUMN beach_stock_quantity SET DEFAULT 0,
  ALTER COLUMN beach_stock_quantity SET NOT NULL,
  ALTER COLUMN blocked_by_stock SET DEFAULT FALSE,
  ALTER COLUMN blocked_by_stock SET NOT NULL;

DO $$
BEGIN
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
