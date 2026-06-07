-- SandExpress - garante cardapio modelo individual para cada quiosque existente
-- Use quando houver quiosques antigos criados antes da copia automatica do cardapio.
-- Nao apaga produtos existentes.

INSERT INTO products (
  tenant_id,
  vendor_id,
  category,
  name,
  price,
  sort_order,
  active,
  stock_quantity,
  blocked_by_stock
)
SELECT
  v.tenant_id,
  v.id,
  d.category,
  d.name,
  d.price,
  d.sort_order,
  TRUE,
  NULL,
  FALSE
FROM vendors v
CROSS JOIN default_menu_items d
WHERE d.active = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM products p
    WHERE p.vendor_id = v.id
      AND p.tenant_id = v.tenant_id
  );

ANALYZE products;
