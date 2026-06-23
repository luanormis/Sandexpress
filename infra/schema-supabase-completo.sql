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
  max_umbrellas INTEGER NOT NULL DEFAULT 50 CHECK (max_umbrellas BETWEEN 1 AND 50),
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
CREATE INDEX idx_orders_created_brin ON orders USING BRIN(created_at);

CREATE INDEX idx_order_items_tenant_order ON order_items(tenant_id, order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE INDEX idx_daily_closings_tenant_date ON daily_closings(tenant_id, business_date DESC);
CREATE INDEX idx_daily_closings_vendor_date ON daily_closings(vendor_id, business_date DESC);
CREATE INDEX idx_terms_acceptances_vendor ON terms_acceptances(vendor_id, accepted_at DESC);
CREATE INDEX idx_terms_acceptances_tenant ON terms_acceptances(tenant_id, accepted_at DESC);

CREATE INDEX idx_adjustments_vendor ON account_adjustments(vendor_id);
CREATE INDEX idx_adjustments_customer ON account_adjustments(customer_id);
CREATE INDEX idx_adjustments_order ON account_adjustments(order_id);
CREATE INDEX idx_adjustments_created ON account_adjustments(vendor_id, created_at DESC);

CREATE INDEX idx_rate_limit_reset ON rate_limit_buckets(reset_at);
CREATE INDEX idx_otp_challenges_phone_purpose_created ON otp_challenges(phone_e164, purpose, created_at DESC);
CREATE INDEX idx_otp_challenges_vendor_created ON otp_challenges(vendor_id, created_at DESC);
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
    "max_umbrellas": 50
  }'::jsonb,
  'Planos comerciais atuais: trial de 3 dias, mensal e anual ate 50 guarda-sois.'
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
ANALYZE rate_limit_buckets;
ANALYZE otp_challenges;
ANALYZE analytics_events;
ANALYZE platform_settings;

COMMIT;
