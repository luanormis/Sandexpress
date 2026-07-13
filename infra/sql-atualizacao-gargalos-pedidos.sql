-- SandExpress - índices para reduzir espera na criação concorrente de pedidos.
-- Não altera dados e pode ser executado repetidamente.

CREATE INDEX IF NOT EXISTS idx_orders_open_vendor_umbrella_created
  ON orders(vendor_id, umbrella_id, created_at)
  WHERE paid = FALSE AND status IN ('received','preparing','delivering','completed','closing_requested');

CREATE INDEX IF NOT EXISTS idx_products_order_lookup
  ON products(id, vendor_id, tenant_id)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_customers_order_lookup
  ON customers(id, vendor_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_umbrellas_order_lookup
  ON umbrellas(id, vendor_id, tenant_id, active);

ANALYZE orders;
ANALYZE order_items;
ANALYZE products;
ANALYZE customers;
ANALYZE umbrellas;
