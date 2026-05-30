-- SANDEXPRESS - SCHEMA COMPLETO PARA BANCO NOVO
-- Use em um projeto Supabase novo ou depois de apagar as tabelas.
-- ATENCAO: este script apaga as tabelas existentes do SandExpress.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS beaches CASCADE;
DROP TABLE IF EXISTS rate_limit_buckets CASCADE;
DROP TABLE IF EXISTS customer_otps CASCADE;
DROP TABLE IF EXISTS account_adjustments CASCADE;
DROP TABLE IF EXISTS vendor_plans CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS umbrellas CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  primary_color TEXT DEFAULT '#FF6B00',
  secondary_color TEXT DEFAULT '#82533F',
  password_hash TEXT,
  password_needs_reset BOOLEAN NOT NULL DEFAULT TRUE,
  password_reset_token TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial','active','overdue','blocked')),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'),
  plan_type TEXT DEFAULT 'trial'
    CHECK (plan_type IN ('trial','monthly','annual','12months')),
  plan_expires_at TIMESTAMPTZ,
  max_umbrellas INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  city TEXT,
  state TEXT,
  region TEXT,
  beach_name TEXT,
  primary_color TEXT DEFAULT '#FF6B00',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 1,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, phone)
);

CREATE TABLE umbrellas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  label TEXT,
  location_hint TEXT,
  active BOOLEAN DEFAULT TRUE,
  is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
  qr_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, number)
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Geral',
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  promotional_price NUMERIC(10,2),
  image_url TEXT,
  is_default_image BOOLEAN DEFAULT TRUE,
  image_plan_type TEXT DEFAULT 'free',
  active BOOLEAN DEFAULT TRUE,
  is_combo BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 99,
  stock_quantity INTEGER,
  blocked_by_stock BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'vendor'
    CHECK (role IN ('admin','vendor','seller','customer')),
  password_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  umbrella_id UUID REFERENCES umbrellas(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','pending')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  umbrella_id UUID NOT NULL REFERENCES umbrellas(id),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','preparing','delivering','completed','cancelled')),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  paid BOOLEAN DEFAULT FALSE,
  payment_method TEXT,
  pending_close BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE umbrellas
  ADD COLUMN current_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free','plus')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vendor_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free','plus')),
  can_upload_images BOOLEAN DEFAULT FALSE,
  max_custom_images INTEGER DEFAULT 0,
  custom_images_used INTEGER DEFAULT 0,
  custom_theme BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE account_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('cancellation','deduction','credit')),
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  processed_by TEXT,
  password_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customer_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE beaches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  region TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  total_visits INTEGER NOT NULL DEFAULT 0,
  total_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_ticket NUMERIC(10,2) NOT NULL DEFAULT 0,
  peak_hours JSONB,
  popular_products JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_customers_vendor ON customers(vendor_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_umbrellas_vendor ON umbrellas(vendor_id);
CREATE INDEX idx_umbrellas_tenant ON umbrellas(tenant_id);
CREATE INDEX idx_umbrellas_occupied ON umbrellas(vendor_id, is_occupied);
CREATE INDEX idx_products_vendor ON products(vendor_id);
CREATE INDEX idx_products_active ON products(vendor_id, active);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_orders_vendor ON orders(vendor_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_status ON orders(vendor_id, status);
CREATE INDEX idx_orders_created ON orders(vendor_id, created_at DESC);
CREATE INDEX idx_orders_pending_close ON orders(vendor_id, pending_close);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX idx_product_images_category ON product_images(category);
CREATE INDEX idx_product_images_plan ON product_images(plan_type);
CREATE INDEX idx_vendor_plans_vendor ON vendor_plans(vendor_id);
CREATE INDEX idx_adjustments_vendor ON account_adjustments(vendor_id);
CREATE INDEX idx_adjustments_customer ON account_adjustments(customer_id);
CREATE INDEX idx_adjustments_order ON account_adjustments(order_id);
CREATE INDEX idx_adjustments_created ON account_adjustments(vendor_id, created_at DESC);
CREATE INDEX idx_otps_lookup ON customer_otps(vendor_id, phone, used, expires_at);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX idx_sessions_created ON sessions(created_at DESC);
CREATE INDEX idx_beaches_tenant ON beaches(tenant_id);
CREATE INDEX idx_beaches_active ON beaches(is_active);
CREATE INDEX idx_beaches_location ON beaches(latitude, longitude);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrellas ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE beaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_vendors_select ON vendors FOR SELECT USING (is_active = TRUE AND subscription_status != 'blocked');
CREATE POLICY pol_umbrellas_select ON umbrellas FOR SELECT USING (active = TRUE);
CREATE POLICY pol_products_select ON products FOR SELECT USING (active = TRUE);
CREATE POLICY pol_customers_all ON customers USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY pol_orders_all ON orders USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY pol_items_all ON order_items USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY pol_product_images_select ON product_images FOR SELECT USING (TRUE);
CREATE POLICY pol_vendor_plans_all ON vendor_plans USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY pol_adjustments_all ON account_adjustments USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY pol_otps_all ON customer_otps USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY pol_rate_limit_all ON rate_limit_buckets USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY pol_beaches_all ON beaches USING (TRUE) WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION increment_stock(p_product_id UUID, p_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock_quantity = COALESCE(stock_quantity, 0) + p_qty,
      blocked_by_stock = FALSE,
      updated_at = NOW()
  WHERE id = p_product_id AND stock_quantity IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
