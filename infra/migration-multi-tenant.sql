-- Multi-tenancy foundation
-- This migration creates tenants + users + sessions and adds tenant_id to core operational tables.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
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

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);

-- 2. Seed tenants from existing vendors to preserve current data mapping
INSERT INTO tenants (id, name, status, city, state, region, beach_name, primary_color, logo_url, created_at)
SELECT id, name, 'active', city, state, NULL, NULL, primary_color, logo_url, created_at
FROM vendors
ON CONFLICT (id) DO NOTHING;

-- 3. Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'vendor' CHECK (role IN ('admin','vendor','seller','customer')),
  password_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- 4. Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
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

CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

-- 5. Add tenant_id to core tables and preserve compatibility with existing vendor_id mapping
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE customers SET tenant_id = vendor_id WHERE tenant_id IS NULL;
ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE customers ADD CONSTRAINT customers_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

ALTER TABLE umbrellas ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE umbrellas SET tenant_id = vendor_id WHERE tenant_id IS NULL;
ALTER TABLE umbrellas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE umbrellas ADD CONSTRAINT umbrellas_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_umbrellas_tenant ON umbrellas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_umbrellas_created_at ON umbrellas(created_at DESC);

ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE products SET tenant_id = vendor_id WHERE tenant_id IS NULL;
ALTER TABLE products ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE products ADD CONSTRAINT products_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE orders SET tenant_id = vendor_id WHERE tenant_id IS NULL;
ALTER TABLE orders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE order_items SET tenant_id = orders.tenant_id FROM orders WHERE order_items.order_id = orders.id AND order_items.tenant_id IS NULL;
ALTER TABLE order_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE order_items ADD CONSTRAINT order_items_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON order_items(created_at DESC);

-- 6. Keep vendor_id compatibility on core tables for incremental migration
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vendor_id UUID;
ALTER TABLE umbrellas ADD COLUMN IF NOT EXISTS vendor_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS vendor_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_id UUID;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor_id UUID;

UPDATE customers SET vendor_id = tenant_id WHERE vendor_id IS NULL;
UPDATE umbrellas SET vendor_id = tenant_id WHERE vendor_id IS NULL;
UPDATE products SET vendor_id = tenant_id WHERE vendor_id IS NULL;
UPDATE orders SET vendor_id = tenant_id WHERE vendor_id IS NULL;
UPDATE order_items SET vendor_id = tenant_id WHERE vendor_id IS NULL;

-- Ensure vendor_id is preserved for compatibility, but tenant_id is authoritative.
