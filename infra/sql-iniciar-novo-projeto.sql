-- SandExpress - SQL iniciar novo projeto
-- Use este arquivo quando quiser recriar o Supabase do zero.
-- Consolidado com as atualizacoes de:
-- - recuperacao de senha por email;
-- - validacao de email do cadastro do quiosque;
-- - usuarios da equipe do quiosque;
-- - cadastro real de cardapio e guarda-sois pelo painel do quiosque.
--
-- ATENCAO:
-- 1. Este script APAGA as tabelas do SandExpress listadas abaixo.
-- 2. Rode no SQL Editor do Supabase em um projeto novo ou apos fazer backup.
-- 3. Depois de rodar, configure as variaveis do Vercel e crie/cadastre o primeiro quiosque pelo sistema.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- LIMPEZA DO PROJETO
-- =========================================================

DROP VIEW IF EXISTS admin_product_sales_analytics;
DROP VIEW IF EXISTS admin_daily_closing_analytics;

DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS daily_closings CASCADE;
DROP TABLE IF EXISTS rate_limit_buckets CASCADE;
DROP TABLE IF EXISTS otp_challenges CASCADE;
DROP TABLE IF EXISTS account_adjustments CASCADE;
DROP TABLE IF EXISTS customer_satisfaction_surveys CASCADE;
DROP TABLE IF EXISTS tenant_features CASCADE;
DROP TABLE IF EXISTS vendor_plans CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS umbrellas CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS vendor_users CASCADE;
DROP TABLE IF EXISTS terms_acceptances CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS beaches CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

DROP FUNCTION IF EXISTS set_updated_at();

-- =========================================================
-- FUNCOES
-- =========================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- TENANTS / QUIOSQUES
-- =========================================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','deleted')),
  beach_id UUID,
  city TEXT,
  state TEXT,
  region TEXT,
  beach_name TEXT,
  primary_color TEXT NOT NULL DEFAULT '#ff6b00',
  secondary_color TEXT NOT NULL DEFAULT '#82533f',
  button_color TEXT NOT NULL DEFAULT '#ff6b00',
  button_text_color TEXT NOT NULL DEFAULT '#ffffff',
  logo_url TEXT DEFAULT '/logo-sandexpress.png',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE beaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  region TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, city, state)
);

ALTER TABLE tenants
  ADD CONSTRAINT tenants_beach_id_fkey
  FOREIGN KEY (beach_id) REFERENCES beaches(id) ON DELETE SET NULL;

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  beach_id UUID REFERENCES beaches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  cpf TEXT UNIQUE,
  document_login TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  state TEXT,
  beach_name TEXT,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  owner_email TEXT,
  logo_url TEXT DEFAULT '/logo-sandexpress.png',
  primary_color TEXT NOT NULL DEFAULT '#ff6b00',
  secondary_color TEXT DEFAULT '#82533f',
  button_color TEXT NOT NULL DEFAULT '#ff6b00',
  button_text_color TEXT NOT NULL DEFAULT '#ffffff',
  password_hash TEXT,
  password_needs_reset BOOLEAN NOT NULL DEFAULT TRUE,
  password_reset_token TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  owner_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  owner_email_verified_at TIMESTAMPTZ,
  owner_email_verification_token TEXT,
  owner_email_verification_expires_at TIMESTAMPTZ,
  subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial','active','overdue','blocked')),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'),
  plan_type TEXT NOT NULL DEFAULT 'trial'
    CHECK (plan_type IN ('trial','monthly','annual')),
  plan_expires_at TIMESTAMPTZ,
  plan_monthly_price NUMERIC(10,2) NOT NULL DEFAULT 499.99 CHECK (plan_monthly_price >= 0),
  plan_annual_monthly_price NUMERIC(10,2) NOT NULL DEFAULT 299.99 CHECK (plan_annual_monthly_price >= 0),
  max_umbrellas INTEGER NOT NULL DEFAULT 100 CHECK (max_umbrellas BETWEEN 1 AND 120),
  pix_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pix_key TEXT,
  pix_account_name TEXT,
  debit_card_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (debit_card_fee_rate >= 0),
  credit_card_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (credit_card_fee_rate >= 0),
  pix_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pix_fee_rate >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_ip TEXT,
  accepted_user_agent TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vendor_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  login TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'seller'
    CHECK (role IN ('owner','manager','seller')),
  password_hash TEXT NOT NULL,
  password_needs_reset BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1 CHECK (party_size BETWEEN 1 AND 50),
  visit_count INTEGER NOT NULL DEFAULT 1,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  last_visit_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, phone)
);

CREATE TABLE umbrellas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number > 0),
  label TEXT,
  location_hint TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  qr_url TEXT,
  qr_path TEXT,
  is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
  current_order_id UUID,
  map_x NUMERIC(5,2),
  map_y NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, number)
);

-- =========================================================
-- CARDAPIO / PRODUTOS
-- =========================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Geral',
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  promotional_price NUMERIC(10,2)
    CHECK (promotional_price IS NULL OR (promotional_price >= 0 AND promotional_price <= price)),
  image_url TEXT,
  is_default_image BOOLEAN NOT NULL DEFAULT TRUE,
  image_plan_type TEXT NOT NULL DEFAULT 'free',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_combo BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 99,
  stock_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  physical_stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (physical_stock_quantity >= 0),
  beach_stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (beach_stock_quantity >= 0),
  stock_quantity INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  blocked_by_stock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT,
  name TEXT,
  image_url TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_type IN ('free','plus')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vendor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'trial'
    CHECK (plan_type IN ('trial','free','plus','monthly','annual')),
  can_upload_images BOOLEAN NOT NULL DEFAULT FALSE,
  max_custom_images INTEGER NOT NULL DEFAULT 0 CHECK (max_custom_images >= 0),
  custom_images_used INTEGER NOT NULL DEFAULT 0 CHECK (custom_images_used >= 0),
  custom_theme TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, feature_key)
);

-- =========================================================
-- PEDIDOS / FECHAMENTO DE CONTA / FECHAMENTO DO DIA
-- =========================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  umbrella_id UUID NOT NULL REFERENCES umbrellas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','preparing','delivering','closing_requested','completed','cancelled')),
  total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  gross_total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (gross_total >= 0),
  notes TEXT,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash','pix','debit_card','credit_card')),
  payment_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (payment_fee_rate >= 0),
  payment_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (payment_fee_amount >= 0),
  net_total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (net_total >= 0),
  pending_close BOOLEAN NOT NULL DEFAULT FALSE,
  pix_payload TEXT,
  close_requested_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE umbrellas
  ADD CONSTRAINT umbrellas_current_order_id_fkey
  FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL;

CREATE TABLE daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  total_orders INTEGER NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_revenue >= 0),
  total_gross_revenue NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_gross_revenue >= 0),
  total_payment_fees NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_payment_fees >= 0),
  total_net_revenue NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_net_revenue >= 0),
  total_items_sold INTEGER NOT NULL DEFAULT 0 CHECK (total_items_sold >= 0),
  avg_ticket NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (avg_ticket >= 0),
  unique_customers INTEGER NOT NULL DEFAULT 0 CHECK (unique_customers >= 0),
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

CREATE TABLE account_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  adjustment_type TEXT NOT NULL
    CHECK (adjustment_type IN ('cancellation','deduction','credit')),
  description TEXT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  processed_by TEXT,
  password_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- SEGURANCA / ANALYTICS / RATE LIMIT
-- =========================================================

CREATE TABLE rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_satisfaction_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  umbrella_id UUID REFERENCES umbrellas(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, customer_id)
);

CREATE TABLE otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  purpose TEXT NOT NULL
    CHECK (purpose IN ('customer_login','vendor_register','vendor_login','password_reset')),
  code_hash TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'meta_whatsapp',
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','used','expired','blocked')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_ip TEXT,
  created_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  umbrella_id UUID REFERENCES umbrellas(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  city TEXT,
  beach_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- INDICES PARA ESCALA
-- =========================================================

CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_beaches_location ON beaches(state, city, name);
CREATE INDEX idx_beaches_active ON beaches(active);
CREATE INDEX idx_vendors_tenant ON vendors(tenant_id);
CREATE INDEX idx_vendors_beach ON vendors(beach_id);
CREATE INDEX idx_vendors_document_login ON vendors(document_login);
CREATE INDEX idx_vendors_city ON vendors(city);
CREATE INDEX idx_vendors_beach_name ON vendors(beach_name);
CREATE INDEX idx_vendors_owner_email_verification ON vendors(owner_email_verification_token);
CREATE INDEX idx_vendor_users_vendor ON vendor_users(vendor_id, active);
CREATE INDEX idx_vendor_users_login ON vendor_users(login);

CREATE INDEX idx_customers_tenant_vendor_phone ON customers(tenant_id, vendor_id, phone);
CREATE INDEX idx_customers_vendor_last_visit ON customers(vendor_id, last_visit_at DESC);

CREATE INDEX idx_umbrellas_tenant_vendor_number ON umbrellas(tenant_id, vendor_id, number);
CREATE INDEX idx_umbrellas_vendor_active ON umbrellas(vendor_id, active);
CREATE INDEX idx_umbrellas_current_order ON umbrellas(current_order_id);
CREATE UNIQUE INDEX idx_umbrellas_qr_url_unique ON umbrellas(qr_url) WHERE qr_url IS NOT NULL;
CREATE UNIQUE INDEX idx_umbrellas_qr_path_unique ON umbrellas(qr_path) WHERE qr_path IS NOT NULL;

CREATE INDEX idx_products_tenant_vendor_active_category ON products(tenant_id, vendor_id, active, category);
CREATE INDEX idx_products_vendor_sort ON products(vendor_id, sort_order);
CREATE INDEX idx_products_category ON products(vendor_id, category);
CREATE INDEX idx_product_images_category ON product_images(category);
CREATE INDEX idx_product_images_plan ON product_images(plan_type);
CREATE INDEX idx_vendor_plans_vendor ON vendor_plans(vendor_id);
CREATE INDEX idx_tenant_features_tenant_key ON tenant_features(tenant_id, feature_key);

CREATE INDEX idx_orders_tenant_vendor_status_created ON orders(tenant_id, vendor_id, status, created_at DESC);
CREATE INDEX idx_orders_tenant_umbrella_status ON orders(tenant_id, umbrella_id, status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_vendor_paid_status_created ON orders(vendor_id, paid, status, created_at DESC);
CREATE INDEX idx_orders_vendor_customer_open ON orders(vendor_id, customer_id, created_at DESC) WHERE paid = FALSE;
CREATE UNIQUE INDEX idx_orders_one_open_per_umbrella
  ON orders(vendor_id, umbrella_id)
  WHERE paid = FALSE AND status IN ('received','preparing','delivering','completed','closing_requested');
CREATE INDEX idx_orders_created_brin ON orders USING BRIN(created_at);

CREATE INDEX idx_order_items_tenant_order ON order_items(tenant_id, order_id);
CREATE INDEX idx_order_items_order_product ON order_items(order_id, product_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE INDEX idx_daily_closings_tenant_date ON daily_closings(tenant_id, business_date DESC);
CREATE INDEX idx_daily_closings_vendor_date ON daily_closings(vendor_id, business_date DESC);
CREATE INDEX idx_terms_acceptances_vendor ON terms_acceptances(vendor_id, accepted_at DESC);
CREATE INDEX idx_terms_acceptances_tenant ON terms_acceptances(tenant_id, accepted_at DESC);

CREATE INDEX idx_adjustments_vendor ON account_adjustments(vendor_id);
CREATE INDEX idx_adjustments_customer ON account_adjustments(customer_id);
CREATE INDEX idx_adjustments_order ON account_adjustments(order_id);
CREATE INDEX idx_adjustments_created ON account_adjustments(vendor_id, created_at DESC);
CREATE INDEX idx_satisfaction_tenant_created ON customer_satisfaction_surveys(tenant_id, created_at DESC);
CREATE INDEX idx_satisfaction_vendor_created ON customer_satisfaction_surveys(vendor_id, created_at DESC);
CREATE INDEX idx_satisfaction_order_customer ON customer_satisfaction_surveys(order_id, customer_id);

CREATE INDEX idx_rate_limit_reset ON rate_limit_buckets(reset_at);
CREATE INDEX idx_otp_challenges_phone_purpose_created ON otp_challenges(phone_e164, purpose, created_at DESC);
CREATE INDEX idx_otp_challenges_vendor_created ON otp_challenges(vendor_id, created_at DESC);
CREATE INDEX idx_otp_challenges_status_expires ON otp_challenges(status, expires_at);
CREATE INDEX idx_otp_challenges_used_at ON otp_challenges(used_at) WHERE used_at IS NOT NULL;
CREATE INDEX idx_analytics_vendor_event_created ON analytics_events(vendor_id, event_type, created_at DESC);
CREATE INDEX idx_analytics_events_location ON analytics_events(city, beach_name);
CREATE INDEX idx_analytics_payload_gin ON analytics_events USING GIN(payload);
CREATE INDEX idx_analytics_metadata_gin ON analytics_events USING GIN(metadata);
CREATE INDEX idx_platform_settings_value ON platform_settings USING GIN(value);

-- =========================================================
-- TRIGGERS UPDATED_AT
-- =========================================================

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_beaches_updated_at BEFORE UPDATE ON beaches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vendor_users_updated_at BEFORE UPDATE ON vendor_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_umbrellas_updated_at BEFORE UPDATE ON umbrellas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_daily_closings_updated_at BEFORE UPDATE ON daily_closings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_account_adjustments_updated_at BEFORE UPDATE ON account_adjustments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customer_satisfaction_surveys_updated_at BEFORE UPDATE ON customer_satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vendor_plans_updated_at BEFORE UPDATE ON vendor_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tenant_features_updated_at BEFORE UPDATE ON tenant_features
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rate_limit_buckets_updated_at BEFORE UPDATE ON rate_limit_buckets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_otp_challenges_updated_at BEFORE UPDATE ON otp_challenges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_platform_settings_updated_at BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- VIEWS DO ADMIN
-- =========================================================

CREATE VIEW admin_product_sales_analytics AS
SELECT
  v.tenant_id,
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
  v.tenant_id,
  v.id,
  v.name,
  COALESCE(v.beach_name, v.address, 'Sem praia/localizacao'),
  COALESCE(v.city, 'Sem cidade'),
  COALESCE(v.state, ''),
  p.id,
  p.name,
  p.category,
  EXTRACT(HOUR FROM o.created_at);

CREATE VIEW admin_daily_closing_analytics AS
SELECT
  dc.tenant_id,
  dc.vendor_id,
  v.name AS vendor_name,
  COALESCE(v.beach_name, v.address, 'Sem praia/localizacao') AS beach_name,
  COALESCE(v.city, 'Sem cidade') AS city,
  COALESCE(v.state, '') AS state,
  dc.business_date,
  dc.total_orders,
  dc.total_revenue,
  dc.total_items_sold,
  dc.avg_ticket,
  dc.unique_customers,
  dc.payment_methods,
  dc.top_products,
  dc.hourly_breakdown,
  dc.closed_at
FROM daily_closings dc
JOIN vendors v ON v.id = dc.vendor_id;

-- =========================================================
-- ROTINAS DE MANUTENCAO
-- =========================================================

CREATE OR REPLACE FUNCTION cleanup_otp_challenges(retention_minutes INTEGER DEFAULT 10)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM otp_challenges
  WHERE expires_at < NOW()
     OR used_at < NOW() - make_interval(mins => GREATEST(retention_minutes, 1))
     OR status IN ('expired', 'blocked');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_otp_challenges(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_otp_challenges(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION cleanup_otp_challenges(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION cleanup_otp_challenges(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION consume_rate_limit(
  p_key TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  next_count INTEGER;
BEGIN
  INSERT INTO rate_limit_buckets(key, count, reset_at)
  VALUES (p_key, 1, NOW() + make_interval(secs => GREATEST(p_window_seconds, 1)))
  ON CONFLICT (key) DO UPDATE
  SET count = CASE
        WHEN rate_limit_buckets.reset_at < NOW() THEN 1
        ELSE rate_limit_buckets.count + 1
      END,
      reset_at = CASE
        WHEN rate_limit_buckets.reset_at < NOW() THEN EXCLUDED.reset_at
        ELSE rate_limit_buckets.reset_at
      END,
      updated_at = NOW()
  RETURNING count INTO next_count;

  RETURN next_count > GREATEST(p_max_attempts, 0);
END;
$$;

REVOKE ALL ON FUNCTION consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_rate_limit(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION consume_rate_limit(TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION create_customer_order(
  p_vendor_id UUID,
  p_customer_id UUID,
  p_umbrella_id UUID,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  umbrella_row umbrellas%ROWTYPE;
  customer_row customers%ROWTYPE;
  order_row orders%ROWTYPE;
  item JSONB;
  product_row products%ROWTYPE;
  item_product_id UUID;
  item_quantity INTEGER;
  item_unit_price NUMERIC(10,2);
  item_subtotal NUMERIC(10,2);
  order_total NUMERIC(10,2) := 0;
  normalized_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  order_items_payload JSONB := '[]'::JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Dados de pedido incompletos.';
  END IF;

  SELECT *
    INTO umbrella_row
  FROM umbrellas
  WHERE id = p_umbrella_id
    AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guarda-sol invalido para este quiosque.';
  END IF;

  IF NOT umbrella_row.active THEN
    RAISE EXCEPTION 'Guarda-sol inativo.';
  END IF;

  SELECT *
    INTO customer_row
  FROM customers
  WHERE id = p_customer_id
    AND vendor_id = p_vendor_id
    AND tenant_id = umbrella_row.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao pertence a este quiosque.';
  END IF;

  SELECT *
    INTO order_row
  FROM orders
  WHERE vendor_id = p_vendor_id
    AND umbrella_id = p_umbrella_id
    AND paid = FALSE
    AND status IN ('received','preparing','delivering','completed','closing_requested')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND order_row.customer_id <> p_customer_id THEN
    RAISE EXCEPTION 'Este guarda-sol esta com uma conta aberta. Ele sera liberado apos o pagamento.';
  END IF;

  IF FOUND AND order_row.status = 'closing_requested' THEN
    RAISE EXCEPTION 'A conta deste guarda-sol ja esta em fechamento.';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    item_product_id := (item->>'product_id')::UUID;
    item_quantity := (item->>'quantity')::INTEGER;

    IF item_quantity IS NULL OR item_quantity < 1 OR item_quantity > 50 THEN
      RAISE EXCEPTION 'Quantidade invalida.';
    END IF;

    SELECT *
      INTO product_row
    FROM products
    WHERE id = item_product_id
      AND vendor_id = p_vendor_id
      AND tenant_id = umbrella_row.tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto nao encontrado neste quiosque.';
    END IF;

    IF NOT product_row.active OR (product_row.stock_tracking_enabled AND product_row.blocked_by_stock) THEN
      RAISE EXCEPTION 'Produto indisponivel.';
    END IF;

    IF product_row.stock_tracking_enabled THEN
      IF COALESCE(product_row.beach_stock_quantity, product_row.stock_quantity, 0) < item_quantity THEN
        RAISE EXCEPTION 'Estoque insuficiente.';
      END IF;

      UPDATE products
      SET beach_stock_quantity = COALESCE(beach_stock_quantity, stock_quantity, 0) - item_quantity,
          stock_quantity = COALESCE(beach_stock_quantity, stock_quantity, 0) - item_quantity,
          blocked_by_stock = (COALESCE(beach_stock_quantity, stock_quantity, 0) - item_quantity) <= 0,
          updated_at = NOW()
      WHERE id = product_row.id;
    END IF;

    item_unit_price := COALESCE(product_row.promotional_price, product_row.price);
    item_subtotal := item_unit_price * item_quantity;
    order_total := order_total + item_subtotal;
    order_items_payload := order_items_payload || jsonb_build_array(jsonb_build_object(
      'product_id', item_product_id,
      'quantity', item_quantity,
      'unit_price', item_unit_price,
      'subtotal', item_subtotal
    ));
  END LOOP;

  IF order_row.id IS NULL THEN
    BEGIN
      INSERT INTO orders(tenant_id, vendor_id, customer_id, umbrella_id, total, gross_total, notes)
      VALUES (umbrella_row.tenant_id, p_vendor_id, p_customer_id, p_umbrella_id, order_total, order_total, normalized_notes)
      RETURNING * INTO order_row;
    EXCEPTION WHEN unique_violation THEN
      SELECT *
        INTO order_row
      FROM orders
      WHERE vendor_id = p_vendor_id
        AND umbrella_id = p_umbrella_id
        AND paid = FALSE
        AND status IN ('received','preparing','delivering','completed','closing_requested')
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE;

      IF order_row.customer_id <> p_customer_id THEN
        RAISE EXCEPTION 'Este guarda-sol esta com uma conta aberta. Ele sera liberado apos o pagamento.';
      END IF;

      IF order_row.status = 'closing_requested' THEN
        RAISE EXCEPTION 'A conta deste guarda-sol ja esta em fechamento.';
      END IF;

      UPDATE orders
      SET total = total + order_total,
          gross_total = gross_total + order_total,
          status = CASE WHEN status = 'completed' THEN 'received' ELSE status END,
          notes = NULLIF(CONCAT_WS(E'\n', notes, normalized_notes), ''),
          updated_at = NOW()
      WHERE id = order_row.id
      RETURNING * INTO order_row;
    END;
  ELSE
    UPDATE orders
    SET total = total + order_total,
        gross_total = gross_total + order_total,
        status = CASE WHEN status = 'completed' THEN 'received' ELSE status END,
        notes = NULLIF(CONCAT_WS(E'\n', notes, normalized_notes), ''),
        updated_at = NOW()
    WHERE id = order_row.id
    RETURNING * INTO order_row;
  END IF;

  INSERT INTO order_items(tenant_id, order_id, product_id, quantity, unit_price, subtotal)
  SELECT
    umbrella_row.tenant_id,
    order_row.id,
    (payload->>'product_id')::UUID,
    (payload->>'quantity')::INTEGER,
    (payload->>'unit_price')::NUMERIC,
    (payload->>'subtotal')::NUMERIC
  FROM jsonb_array_elements(order_items_payload) AS payload;

  UPDATE umbrellas
  SET is_occupied = TRUE,
      current_order_id = order_row.id,
      updated_at = NOW()
  WHERE id = p_umbrella_id
    AND vendor_id = p_vendor_id;

  UPDATE customers
  SET total_spent = total_spent + order_total,
      updated_at = NOW()
  WHERE id = p_customer_id
    AND vendor_id = p_vendor_id;

  RETURN jsonb_build_object(
    'id', order_row.id,
    'tenant_id', order_row.tenant_id,
    'vendor_id', order_row.vendor_id,
    'customer_id', order_row.customer_id,
    'umbrella_id', order_row.umbrella_id,
    'total', order_row.total,
    'gross_total', order_row.gross_total,
    'status', order_row.status,
    'paid', order_row.paid,
    'created_at', order_row.created_at,
    'updated_at', order_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION create_customer_order(UUID, UUID, UUID, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_customer_order(UUID, UUID, UUID, JSONB, TEXT) FROM anon;
REVOKE ALL ON FUNCTION create_customer_order(UUID, UUID, UUID, JSONB, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_customer_order(UUID, UUID, UUID, JSONB, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION close_customer_account(
  p_vendor_id UUID,
  p_umbrella_id UUID DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_session_customer_id UUID DEFAULT NULL,
  p_request_only BOOLEAN DEFAULT FALSE,
  p_payment_method TEXT DEFAULT 'cash',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  order_row orders%ROWTYPE;
  customer_row customers%ROWTYPE;
  vendor_row vendors%ROWTYPE;
  normalized_method TEXT;
  fee_rate NUMERIC(5,2) := 0;
  fee_amount NUMERIC(10,2) := 0;
  gross_amount NUMERIC(10,2) := 0;
  net_amount NUMERIC(10,2) := 0;
  normalized_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
BEGIN
  IF p_vendor_id IS NULL OR (p_umbrella_id IS NULL AND NULLIF(BTRIM(COALESCE(p_customer_phone, '')), '') IS NULL) THEN
    RAISE EXCEPTION 'vendor_id e guarda-sol ou telefone sao obrigatorios.';
  END IF;

  SELECT o.*
    INTO order_row
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE o.vendor_id = p_vendor_id
    AND o.paid = FALSE
    AND o.status IN ('received','preparing','delivering','completed','closing_requested')
    AND (p_umbrella_id IS NULL OR o.umbrella_id = p_umbrella_id)
    AND (
      NULLIF(BTRIM(COALESCE(p_customer_phone, '')), '') IS NULL
      OR regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(p_customer_phone, '\D', '', 'g')
    )
  ORDER BY o.created_at ASC
  LIMIT 1
  FOR UPDATE OF o;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma conta aberta encontrada.';
  END IF;

  IF p_session_customer_id IS NOT NULL AND order_row.customer_id <> p_session_customer_id THEN
    RAISE EXCEPTION 'Conta nao pertence a este cliente.';
  END IF;

  SELECT *
    INTO customer_row
  FROM customers
  WHERE id = order_row.customer_id
    AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente da conta nao encontrado.';
  END IF;

  IF p_request_only THEN
    UPDATE orders
    SET status = 'closing_requested',
        close_requested_at = NOW(),
        notes = COALESCE(normalized_notes, notes),
        updated_at = NOW()
    WHERE id = order_row.id
      AND paid = FALSE
    RETURNING * INTO order_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conta ja foi fechada.';
    END IF;
  ELSE
    SELECT *
      INTO vendor_row
    FROM vendors
    WHERE id = p_vendor_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Quiosque nao encontrado.';
    END IF;

    normalized_method := CASE LOWER(BTRIM(COALESCE(p_payment_method, 'cash')))
      WHEN 'dinheiro' THEN 'cash'
      WHEN 'cash' THEN 'cash'
      WHEN 'pix' THEN 'pix'
      WHEN 'transfer' THEN 'pix'
      WHEN 'transferencia' THEN 'pix'
      WHEN 'debit' THEN 'debit_card'
      WHEN 'debit_card' THEN 'debit_card'
      WHEN 'debito' THEN 'debit_card'
      WHEN 'card' THEN 'credit_card'
      WHEN 'cartao' THEN 'credit_card'
      WHEN 'credit' THEN 'credit_card'
      WHEN 'credit_card' THEN 'credit_card'
      WHEN 'credito' THEN 'credit_card'
      ELSE 'cash'
    END;

    fee_rate := CASE normalized_method
      WHEN 'debit_card' THEN GREATEST(COALESCE(vendor_row.debit_card_fee_rate, 0), 0)
      WHEN 'credit_card' THEN GREATEST(COALESCE(vendor_row.credit_card_fee_rate, 0), 0)
      WHEN 'pix' THEN GREATEST(COALESCE(vendor_row.pix_fee_rate, 0), 0)
      ELSE 0
    END;
    gross_amount := ROUND(GREATEST(COALESCE(order_row.total, 0), 0), 2);
    fee_amount := ROUND(gross_amount * (fee_rate / 100), 2);
    net_amount := ROUND(GREATEST(gross_amount - fee_amount, 0), 2);

    UPDATE orders
    SET status = 'completed',
        paid = TRUE,
        payment_method = normalized_method,
        gross_total = gross_amount,
        payment_fee_rate = fee_rate,
        payment_fee_amount = fee_amount,
        net_total = net_amount,
        paid_at = NOW(),
        notes = normalized_notes,
        updated_at = NOW()
    WHERE id = order_row.id
      AND paid = FALSE
    RETURNING * INTO order_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conta ja foi fechada.';
    END IF;

    UPDATE umbrellas
    SET is_occupied = FALSE,
        current_order_id = NULL,
        updated_at = NOW()
    WHERE id = order_row.umbrella_id
      AND vendor_id = p_vendor_id;

    UPDATE customers
    SET visit_count = COALESCE(visit_count, 0) + 1,
        last_visit_at = NOW(),
        updated_at = NOW()
    WHERE id = order_row.customer_id
      AND vendor_id = p_vendor_id
    RETURNING * INTO customer_row;
  END IF;

  RETURN jsonb_build_object(
    'id', order_row.id,
    'customer_id', order_row.customer_id,
    'customer_name', customer_row.name,
    'customer_phone', customer_row.phone,
    'umbrella_id', order_row.umbrella_id,
    'total', order_row.total,
    'gross_total', order_row.gross_total,
    'payment_fee_rate', order_row.payment_fee_rate,
    'payment_fee_amount', order_row.payment_fee_amount,
    'net_total', order_row.net_total,
    'status', order_row.status,
    'paid', order_row.paid,
    'payment_method', order_row.payment_method,
    'created_at', order_row.created_at,
    'updated_at', order_row.updated_at,
    'closed_at', order_row.paid_at
  );
END;
$$;

REVOKE ALL ON FUNCTION close_customer_account(UUID, UUID, TEXT, UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION close_customer_account(UUID, UUID, TEXT, UUID, BOOLEAN, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION close_customer_account(UUID, UUID, TEXT, UUID, BOOLEAN, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION close_customer_account(UUID, UUID, TEXT, UUID, BOOLEAN, TEXT, TEXT) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'cron'
  ) AND NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'cleanup-otp-challenges-10m'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-otp-challenges-10m',
      '*/10 * * * *',
      'SELECT public.cleanup_otp_challenges(10);'
    );
  END IF;
END;
$$;

-- =========================================================
-- ROW LEVEL SECURITY
-- O app usa APIs server-side com SUPABASE_SERVICE_ROLE_KEY.
-- product_images fica publico para galeria de imagens.
-- =========================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE beaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrellas ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_satisfaction_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_only_tenants ON tenants FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_beaches ON beaches FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_vendors ON vendors FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_vendor_users ON vendor_users FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_customers ON customers FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_umbrellas ON umbrellas FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_products ON products FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_orders ON orders FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_order_items ON order_items FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_daily_closings ON daily_closings FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_terms_acceptances ON terms_acceptances FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_account_adjustments ON account_adjustments FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_customer_satisfaction_surveys ON customer_satisfaction_surveys FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_vendor_plans ON vendor_plans FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_tenant_features ON tenant_features FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY product_images_public_select ON product_images FOR SELECT USING (TRUE);
CREATE POLICY service_only_product_images_write ON product_images FOR INSERT WITH CHECK (FALSE);
CREATE POLICY service_only_product_images_update ON product_images FOR UPDATE USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_product_images_delete ON product_images FOR DELETE USING (FALSE);
CREATE POLICY service_only_rate_limit ON rate_limit_buckets FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_otp_challenges ON otp_challenges FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_analytics ON analytics_events FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY service_only_platform_settings ON platform_settings FOR ALL USING (FALSE) WITH CHECK (FALSE);

-- =========================================================
-- REALTIME
-- =========================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'umbrellas'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE umbrellas;
    END IF;
  END IF;
END $$;

-- =========================================================
-- STORAGE OPCIONAL PARA IMAGENS DE PRODUTOS
-- =========================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('kiosk-assets', 'kiosk-assets', TRUE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('order-archives', 'order-archives', FALSE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS product_images_storage_public_read ON storage.objects;
DROP POLICY IF EXISTS product_images_storage_anon_upload ON storage.objects;
DROP POLICY IF EXISTS product_images_storage_service_all ON storage.objects;
DROP POLICY IF EXISTS kiosk_assets_storage_public_read ON storage.objects;
DROP POLICY IF EXISTS kiosk_assets_storage_service_all ON storage.objects;
DROP POLICY IF EXISTS order_archives_storage_service_all ON storage.objects;

CREATE POLICY product_images_storage_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY product_images_storage_service_all
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY kiosk_assets_storage_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'kiosk-assets');

CREATE POLICY kiosk_assets_storage_service_all
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'kiosk-assets')
  WITH CHECK (bucket_id = 'kiosk-assets');

CREATE POLICY order_archives_storage_service_all
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'order-archives')
  WITH CHECK (bucket_id = 'order-archives');

-- =========================================================
-- GALERIA PADRAO DE IMAGENS DE PRODUTOS
-- =========================================================

INSERT INTO product_images(category, title, name, image_url, description, plan_type)
SELECT *
FROM (VALUES
  ('Alcoólicos', 'Cerveja long neck', 'Cerveja long neck gelada', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para cervejas long neck e garrafas.', 'free'),
  ('Alcoólicos', 'Cerveja lata', 'Cerveja lata na praia', 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para cervejas em lata.', 'free'),
  ('Alcoólicos', 'Drink tropical', 'Drink tropical colorido', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para drinks tropicais.', 'free'),
  ('Alcoólicos', 'Caipirinha', 'Caipirinha com limao', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para caipirinha e drinks com gelo.', 'free'),
  ('Bebidas', 'Agua mineral', 'Agua mineral gelada', 'https://images.unsplash.com/photo-1564419320461-6870880221ad?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para agua mineral.', 'free'),
  ('Bebidas', 'Refrigerante', 'Refrigerante gelado', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para refrigerantes.', 'free'),
  ('Não Alcoólicos', 'Suco natural', 'Suco natural de frutas', 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para sucos naturais.', 'free'),
  ('Não Alcoólicos', 'Agua de coco', 'Agua de coco', 'https://images.unsplash.com/photo-1588413335653-34b770bca7c1?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para agua de coco.', 'free'),
  ('Petiscos', 'Batata frita', 'Porcao de batata frita', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para batata frita e porcoes.', 'free'),
  ('Petiscos', 'Camarao', 'Porcao de camarao', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para camarao e frutos do mar.', 'free'),
  ('Petiscos', 'Isca de peixe', 'Isca de peixe com molho', 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para iscas e peixes fritos.', 'free'),
  ('Comidas', 'Hamburguer', 'Hamburguer artesanal', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para hamburguer e lanches.', 'free'),
  ('Comidas', 'Sanduiche', 'Sanduiche natural', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para sanduiches.', 'free'),
  ('Sobremesas', 'Sorvete', 'Sorvete de verao', 'https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para sorvetes e sobremesas.', 'free'),
  ('Combos', 'Combo praia', 'Combo de bebidas e petiscos', 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para combos.', 'free')
) AS seed(category, title, name, image_url, description, plan_type)
WHERE NOT EXISTS (
  SELECT 1
  FROM product_images existing
  WHERE existing.category = seed.category
    AND existing.name = seed.name
);

-- =========================================================
-- CONFIGURACOES GLOBAIS DA PLATAFORMA
-- Cores oficiais, precos e defaults para novos quiosques
-- =========================================================

INSERT INTO platform_settings (key, value, description) VALUES
(
  'brand.palette',
  '{
    "background": "#fff8f6",
    "foreground": "#261812",
    "surface": "#fff8f6",
    "surface_container": "#ffeae1",
    "surface_container_high": "#fee3d8",
    "surface_container_highest": "#f8ddd2",
    "primary": "#ff6b00",
    "primary_strong": "#a04100",
    "primary_hover": "#e56000",
    "secondary": "#82533f",
    "dark": "#3d1a0a",
    "cream": "#fff8f6",
    "sand": "#f8ddd2",
    "outline": "#e2bfb0",
    "vendor_primary": "#ff6b00",
    "vendor_secondary": "#82533f",
    "button_color": "#ff6b00",
    "button_text_color": "#ffffff"
  }'::jsonb,
  'Paleta oficial do Sandexpress aplicada ao sistema e aos novos quiosques.'
),
(
  'plans.current',
  '{
    "currency": "BRL",
    "trial_days": 3,
    "monthly_price": 499.99,
    "annual_monthly_price": 299.99,
    "max_umbrellas": 100
  }'::jsonb,
  'Planos comerciais atuais: trial de 3 dias, trimestral, semestral e anual ate 100 guarda-sois.'
),
(
  'default.vendor',
  '{
    "primary_color": "#ff6b00",
    "secondary_color": "#82533f",
    "button_color": "#ff6b00",
    "button_text_color": "#ffffff",
    "logo_url": "/logo-sandexpress.png"
  }'::jsonb,
  'Defaults usados para criacao de novos quiosques.'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =========================================================
-- GRANTS EXPLICITOS PARA SUPABASE DATA API
-- RLS continua bloqueando anon/authenticated; service_role e usado pelas API routes.
-- =========================================================

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON product_images TO anon, authenticated;

-- =========================================================
-- ANALYZE
-- =========================================================

ANALYZE tenants;
ANALYZE beaches;
ANALYZE vendors;
ANALYZE vendor_users;
ANALYZE customers;
ANALYZE umbrellas;
ANALYZE products;
ANALYZE product_images;
ANALYZE vendor_plans;
ANALYZE tenant_features;
ANALYZE orders;
ANALYZE order_items;
ANALYZE daily_closings;
ANALYZE terms_acceptances;
ANALYZE account_adjustments;
ANALYZE customer_satisfaction_surveys;
ANALYZE rate_limit_buckets;
ANALYZE otp_challenges;
ANALYZE analytics_events;
ANALYZE platform_settings;

COMMIT;
