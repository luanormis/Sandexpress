-- SandExpress - custo opcional de insumos e métricas de margem por produto.
-- Seguro para execução repetida.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_cost_price_nonnegative'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_cost_price_nonnegative CHECK (cost_price IS NULL OR cost_price >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_vendor_active_sort
  ON products(vendor_id, active, sort_order, id);

ANALYZE products;
