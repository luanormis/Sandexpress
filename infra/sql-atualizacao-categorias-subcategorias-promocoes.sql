-- SandExpress - Categorias, subcategorias, variacoes simples e destaque de promocoes.
-- Migration aditiva: nao altera o fluxo transacional de pedidos.

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, parent_id, slug)
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS option_group_name TEXT,
  ADD COLUMN IF NOT EXISTS option_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS menu_highlight BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS promotion_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promotion_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_product_categories_vendor_parent ON product_categories(vendor_id, parent_id, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_vendor_highlight ON products(vendor_id, menu_highlight, promotional_price, sort_order);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_only_product_categories ON product_categories;
CREATE POLICY service_only_product_categories ON product_categories FOR ALL USING (FALSE) WITH CHECK (FALSE);

GRANT SELECT, INSERT, UPDATE, DELETE ON product_categories TO service_role;

UPDATE products
SET menu_highlight = TRUE
WHERE active = TRUE
  AND (is_combo = TRUE OR promotional_price IS NOT NULL)
  AND menu_highlight = FALSE;
