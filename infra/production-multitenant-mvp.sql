-- SandExpress MVP production schema / migration
-- Run this in Supabase SQL Editor before deploying Vercel production.
-- It is intentionally idempotent: safe to run again after small code updates.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  city TEXT,
  state TEXT,
  region TEXT,
  beach_name TEXT,
  primary_color TEXT NOT NULL DEFAULT '#ff7a1a',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  cpf TEXT UNIQUE,
  document_login TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  state TEXT,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  owner_email TEXT,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#ff7a1a',
  secondary_color TEXT DEFAULT '#0f3d4f',
  password_hash TEXT,
  password_needs_reset BOOLEAN NOT NULL DEFAULT TRUE,
  password_reset_token TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial','active','overdue','blocked')),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'),
  plan_type TEXT DEFAULT 'trial' CHECK (plan_type IN ('trial','monthly','annual')),
  plan_expires_at TIMESTAMPTZ,
  max_umbrellas INTEGER NOT NULL DEFAULT 50 CHECK (max_umbrellas BETWEEN 1 AND 50),
  pix_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pix_key TEXT,
  pix_account_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pix_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pix_key TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pix_account_name TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS password_needs_reset BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#0f3d4f';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS max_umbrellas INTEGER NOT NULL DEFAULT 50;

DO $$
DECLARE
  vendor_record RECORD;
  new_tenant_id UUID;
BEGIN
  FOR vendor_record IN SELECT * FROM vendors WHERE tenant_id IS NULL LOOP
    INSERT INTO tenants (name, city, state, beach_name, primary_color, logo_url)
    VALUES (
      vendor_record.name,
      vendor_record.city,
      vendor_record.state,
      vendor_record.address,
      COALESCE(vendor_record.primary_color, '#ff7a1a'),
      vendor_record.logo_url
    )
    RETURNING id INTO new_tenant_id;

    UPDATE vendors SET tenant_id = new_tenant_id WHERE id = vendor_record.id;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1 CHECK (party_size BETWEEN 1 AND 50),
  visit_count INTEGER NOT NULL DEFAULT 1,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, phone)
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS party_size INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS umbrellas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  label TEXT,
  location_hint TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  qr_url TEXT,
  is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
  current_order_id UUID,
  map_x NUMERIC(5,2),
  map_y NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, number)
);

ALTER TABLE umbrellas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE umbrellas ADD COLUMN IF NOT EXISTS is_occupied BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE umbrellas ADD COLUMN IF NOT EXISTS current_order_id UUID;
ALTER TABLE umbrellas ADD COLUMN IF NOT EXISTS map_x NUMERIC(5,2);
ALTER TABLE umbrellas ADD COLUMN IF NOT EXISTS map_y NUMERIC(5,2);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Geral',
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  promotional_price NUMERIC(10,2),
  image_url TEXT,
  is_default_image BOOLEAN DEFAULT TRUE,
  image_plan_type TEXT DEFAULT 'free',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_combo BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 99,
  stock_quantity INTEGER,
  blocked_by_stock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS blocked_by_stock BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  umbrella_id UUID NOT NULL REFERENCES umbrellas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','preparing','delivering','closing_requested','completed','cancelled')),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT,
  pix_payload TEXT,
  close_requested_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pix_payload TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS close_requested_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('received','preparing','delivering','closing_requested','completed','cancelled'));

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancelled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  title TEXT,
  name TEXT,
  image_url TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'trial',
  can_upload_images BOOLEAN NOT NULL DEFAULT FALSE,
  max_custom_images INTEGER NOT NULL DEFAULT 0,
  custom_images_used INTEGER NOT NULL DEFAULT 0,
  custom_theme TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_closings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_items_sold INTEGER NOT NULL DEFAULT 0,
  avg_ticket NUMERIC(12,2) NOT NULL DEFAULT 0,
  unique_customers INTEGER NOT NULL DEFAULT 0,
  payment_methods JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  hourly_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  orders_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  closed_by TEXT,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, business_date)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE customers c SET tenant_id = v.tenant_id FROM vendors v WHERE c.vendor_id = v.id AND c.tenant_id IS NULL;
UPDATE umbrellas u SET tenant_id = v.tenant_id FROM vendors v WHERE u.vendor_id = v.id AND u.tenant_id IS NULL;
UPDATE products p SET tenant_id = v.tenant_id FROM vendors v WHERE p.vendor_id = v.id AND p.tenant_id IS NULL;
UPDATE orders o SET tenant_id = v.tenant_id FROM vendors v WHERE o.vendor_id = v.id AND o.tenant_id IS NULL;
UPDATE order_items oi SET tenant_id = o.tenant_id FROM orders o WHERE oi.order_id = o.id AND oi.tenant_id IS NULL;

ALTER TABLE vendors ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE umbrellas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_document_login ON vendors(document_login);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_vendor_phone ON customers(tenant_id, vendor_id, phone);
CREATE INDEX IF NOT EXISTS idx_umbrellas_tenant_vendor_number ON umbrellas(tenant_id, vendor_id, number);
CREATE INDEX IF NOT EXISTS idx_umbrellas_vendor_active ON umbrellas(vendor_id, active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_vendor_active_category ON products(tenant_id, vendor_id, active, category);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_vendor_status_created ON orders(tenant_id, vendor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_umbrella_status ON orders(tenant_id, umbrella_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_brin ON orders USING BRIN(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_order ON order_items(tenant_id, order_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_buckets(reset_at);
CREATE INDEX IF NOT EXISTS idx_daily_closings_tenant_date ON daily_closings(tenant_id, business_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_closings_vendor_date ON daily_closings(vendor_id, business_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_vendor_event_created ON analytics_events(vendor_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_payload_gin ON analytics_events USING GIN(payload);
CREATE INDEX IF NOT EXISTS idx_otps_lookup ON customer_otps(vendor_id, phone, used, expires_at);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrellas ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_customers_select ON customers;
DROP POLICY IF EXISTS pol_orders_select ON orders;
DROP POLICY IF EXISTS pol_orders_update ON orders;
DROP POLICY IF EXISTS pol_items_select ON order_items;
DROP POLICY IF EXISTS pol_items_insert ON order_items;
DROP POLICY IF EXISTS pol_vendors_select ON vendors;
DROP POLICY IF EXISTS pol_umbrellas_select ON umbrellas;
DROP POLICY IF EXISTS pol_products_select ON products;

DROP POLICY IF EXISTS service_only_tenants ON tenants;
DROP POLICY IF EXISTS service_only_vendors ON vendors;
DROP POLICY IF EXISTS service_only_customers ON customers;
DROP POLICY IF EXISTS service_only_umbrellas ON umbrellas;
DROP POLICY IF EXISTS service_only_products ON products;
DROP POLICY IF EXISTS service_only_orders ON orders;
DROP POLICY IF EXISTS service_only_order_items ON order_items;
DROP POLICY IF EXISTS service_only_daily_closings ON daily_closings;
DROP POLICY IF EXISTS service_only_analytics ON analytics_events;
DROP POLICY IF EXISTS service_only_otps ON customer_otps;

CREATE POLICY service_only_tenants ON tenants FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_vendors ON vendors FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_customers ON customers FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_umbrellas ON umbrellas FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_products ON products FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_orders ON orders FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_order_items ON order_items FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_daily_closings ON daily_closings FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_analytics ON analytics_events FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_otps ON customer_otps FOR ALL USING (FALSE) WITH CHECK (FALSE);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'umbrellas') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE umbrellas;
    END IF;
  END IF;
END $$;

ANALYZE tenants;
ANALYZE vendors;
ANALYZE customers;
ANALYZE umbrellas;
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE daily_closings;
