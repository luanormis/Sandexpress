-- SandExpress - Admin analytics and security hardening
-- Run this in Supabase SQL Editor before testing analytics in a new/staging database.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS beach_name TEXT;

CREATE INDEX IF NOT EXISTS idx_vendors_city ON vendors(city);
CREATE INDEX IF NOT EXISTS idx_vendors_beach_name ON vendors(beach_name);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(vendor_id, category);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_rate_limit_no_anon ON rate_limit_buckets;
CREATE POLICY pol_rate_limit_no_anon
  ON rate_limit_buckets
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  umbrella_id UUID REFERENCES umbrellas(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('menu_open', 'customer_login', 'order_created', 'close_account', 'waiter_call')),
  city TEXT,
  beach_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_vendor ON analytics_events(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_location ON analytics_events(city, beach_name);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_analytics_events_no_anon ON analytics_events;
CREATE POLICY pol_analytics_events_no_anon
  ON analytics_events
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

-- Optional: tighten broad anonymous access created during early prototyping.
-- The app uses server-side API routes with SUPABASE_SERVICE_ROLE_KEY for private data.
-- Keep product_images public if your menu gallery needs anonymous reads.
DROP POLICY IF EXISTS pol_customers_select ON customers;
DROP POLICY IF EXISTS pol_customers_update ON customers;
DROP POLICY IF EXISTS pol_orders_select ON orders;
DROP POLICY IF EXISTS pol_orders_update ON orders;
DROP POLICY IF EXISTS pol_items_select ON order_items;

CREATE POLICY pol_customers_no_anon_select ON customers FOR SELECT USING (FALSE);
CREATE POLICY pol_customers_no_anon_update ON customers FOR UPDATE USING (FALSE);
CREATE POLICY pol_orders_no_anon_select ON orders FOR SELECT USING (FALSE);
CREATE POLICY pol_orders_no_anon_update ON orders FOR UPDATE USING (FALSE);
CREATE POLICY pol_items_no_anon_select ON order_items FOR SELECT USING (FALSE);

CREATE OR REPLACE VIEW admin_product_sales_analytics AS
SELECT
  v.id AS vendor_id,
  v.name AS vendor_name,
  COALESCE(v.beach_name, v.address, 'Sem praia/localizacao') AS beach_name,
  COALESCE(v.city, 'Sem cidade') AS city,
  COALESCE(v.state, '') AS state,
  p.id AS product_id,
  p.name AS product_name,
  p.category,
  EXTRACT(HOUR FROM o.created_at)::INTEGER AS sale_hour,
  SUM(oi.quantity)::INTEGER AS quantity_sold,
  SUM(oi.subtotal)::NUMERIC(12,2) AS revenue,
  COUNT(DISTINCT o.id)::INTEGER AS orders_count,
  COUNT(DISTINCT o.customer_id)::INTEGER AS visitors_count
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
JOIN vendors v ON v.id = o.vendor_id
WHERE o.status <> 'cancelled'
GROUP BY
  v.id,
  v.name,
  COALESCE(v.beach_name, v.address, 'Sem praia/localizacao'),
  COALESCE(v.city, 'Sem cidade'),
  COALESCE(v.state, ''),
  p.id,
  p.name,
  p.category,
  EXTRACT(HOUR FROM o.created_at);
