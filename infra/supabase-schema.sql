-- VENDORS (quiosques)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE vendors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  cnpj                TEXT UNIQUE,
  cpf                 TEXT UNIQUE,
  document_login      TEXT NOT NULL UNIQUE,  -- CPF ou CNPJ para login (evita duplicidade)
  address             TEXT,
  city                TEXT,
  state               TEXT,
  owner_name          TEXT NOT NULL,
  owner_phone         TEXT NOT NULL,
  owner_email         TEXT,
  logo_url            TEXT,                  -- logo do quiosque
  primary_color       TEXT DEFAULT '#FF6B00', -- cor primária
  secondary_color     TEXT DEFAULT '#394E59', -- cor secundária (opcional)
  password_hash       TEXT,                  -- senha do painel (hash scrypt)
  password_needs_reset BOOLEAN NOT NULL DEFAULT TRUE,
  password_reset_token TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial','active','overdue','blocked')),
  trial_ends_at       TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  plan_type           TEXT CHECK (plan_type IN ('trial','monthly','6months','12months')),
  plan_expires_at     TIMESTAMPTZ,
  max_umbrellas       INTEGER NOT NULL DEFAULT 120,  -- aumentado para 120
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- CUSTOMERS (clientes de cada quiosque)
CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id      UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  visit_count    INTEGER NOT NULL DEFAULT 1,
  total_spent    NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_visit_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, phone)
);

-- UMBRELLAS (guarda-sóis de cada quiosque)
CREATE TABLE umbrellas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id     UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  number        INTEGER NOT NULL,
  label         TEXT,
  location_hint TEXT,
  active        BOOLEAN DEFAULT TRUE,
  qr_url        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, number)
);

-- PRODUCTS (cardápio de cada quiosque - até 150 itens)
CREATE TABLE products (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id          UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category           TEXT NOT NULL DEFAULT 'Geral',
  name               TEXT NOT NULL,
  description        TEXT,
  price              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  promotional_price  NUMERIC(10,2),
  image_url          TEXT,
  is_default_image   BOOLEAN DEFAULT TRUE,        -- usa imagem padrão da galeria
  image_plan_type    TEXT DEFAULT 'free',        -- 'free' = padrão, 'plus' = exclusiva
  active             BOOLEAN DEFAULT TRUE,          -- visível no cardápio
  is_combo           BOOLEAN DEFAULT FALSE,
  sort_order         INTEGER DEFAULT 99,
  stock_quantity     INTEGER,                       -- estoque (NULL = infinito)
  blocked_by_stock   BOOLEAN DEFAULT FALSE,         -- bloqueado se estoque = 0
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ORDERS (pedidos)
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  umbrella_id     UUID NOT NULL REFERENCES umbrellas(id),
  status          TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','preparing','delivering','completed','cancelled')),
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  paid            BOOLEAN DEFAULT FALSE,
  payment_method  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ORDER ITEMS (itens de cada pedido)
CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10,2) NOT NULL,
  subtotal    NUMERIC(10,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES DE PERFORMANCE
CREATE INDEX idx_customers_vendor    ON customers(vendor_id);
CREATE INDEX idx_customers_phone     ON customers(phone);
CREATE INDEX idx_umbrellas_vendor    ON umbrellas(vendor_id);
CREATE INDEX idx_products_vendor     ON products(vendor_id);
CREATE INDEX idx_products_active     ON products(vendor_id, active);
CREATE INDEX idx_orders_vendor       ON orders(vendor_id);
CREATE INDEX idx_orders_status       ON orders(vendor_id, status);
CREATE INDEX idx_orders_created      ON orders(vendor_id, created_at DESC);
CREATE INDEX idx_order_items_order   ON order_items(order_id);

-- ROW LEVEL SECURITY
ALTER TABLE vendors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrellas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (leitura do cardápio e acesso dos clientes)
CREATE POLICY pol_vendors_select   ON vendors   FOR SELECT USING (is_active = TRUE AND subscription_status != 'blocked');
CREATE POLICY pol_umbrellas_select ON umbrellas FOR SELECT USING (active = TRUE);
CREATE POLICY pol_products_select  ON products  FOR SELECT USING (active = TRUE);
CREATE POLICY pol_customers_insert ON customers FOR INSERT WITH CHECK (TRUE);
CREATE POLICY pol_customers_update ON customers FOR UPDATE USING (TRUE);
CREATE POLICY pol_customers_select ON customers FOR SELECT USING (TRUE);
CREATE POLICY pol_orders_insert    ON orders    FOR INSERT WITH CHECK (TRUE);
CREATE POLICY pol_orders_select    ON orders    FOR SELECT USING (TRUE);
CREATE POLICY pol_orders_update    ON orders    FOR UPDATE USING (TRUE);
CREATE POLICY pol_items_insert     ON order_items FOR INSERT WITH CHECK (TRUE);
CREATE POLICY pol_items_select     ON order_items FOR SELECT USING (TRUE);

-- PRODUCT IMAGE GALLERY (Galeria padrão de imagens por categoria)
CREATE TABLE product_images (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category        TEXT NOT NULL,
  name            TEXT NOT NULL,
  image_url       TEXT NOT NULL,
  description     TEXT,
  plan_type       TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free','plus')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_images_category ON product_images(category);
CREATE INDEX idx_product_images_plan ON product_images(plan_type);

-- VENDOR PLAN CONFIGURATION (Configuração de plano do vendor)
CREATE TABLE vendor_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id       UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  plan_type       TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free','plus')),
  can_upload_images BOOLEAN DEFAULT FALSE,
  max_custom_images INTEGER DEFAULT 0,
  custom_images_used INTEGER DEFAULT 0,
  custom_theme    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_plans_vendor ON vendor_plans(vendor_id);

-- ACCOUNT ADJUSTMENTS (ajustes de conta - cancelamentos/abatimentos)
CREATE TABLE account_adjustments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('cancellation', 'deduction', 'credit')),
  description     TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  reason          TEXT,  -- motivo da alteração (ex: "Cliente solicitou cancelamento", "Erro no pedido")
  processed_by    TEXT,  -- identificação de quem processou (user/admin)
  password_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES PARA ACCOUNT_ADJUSTMENTS
CREATE INDEX idx_adjustments_vendor ON account_adjustments(vendor_id);
CREATE INDEX idx_adjustments_customer ON account_adjustments(customer_id);
CREATE INDEX idx_adjustments_order ON account_adjustments(order_id);
CREATE INDEX idx_adjustments_created ON account_adjustments(vendor_id, created_at DESC);

-- SECURITY POLICY PARA ACCOUNT_ADJUSTMENTS
ALTER TABLE account_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY pol_adjustments_insert ON account_adjustments FOR INSERT WITH CHECK (TRUE);
CREATE POLICY pol_adjustments_select ON account_adjustments FOR SELECT USING (TRUE);
CREATE POLICY pol_adjustments_update ON account_adjustments FOR UPDATE USING (TRUE);
