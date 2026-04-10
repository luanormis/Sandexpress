-- ============================================================================
-- SUPABASE SCHEMA + SEED DATA - SandExpress
-- ============================================================================
-- Este arquivo cria todas as tabelas e popula com dados de teste:
-- - 500 quiosques (nomes: "Teste 1", "Teste 2", ..., "Teste 500")
-- - 50 guarda-sóis por quiosque (total: 25.000)
-- - Cardápio básico por quiosque (bebidas, comidas, combos)
-- ============================================================================

-- ============================================================================
-- 1. CRIAR EXTENSÕES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- 2. CRIAR TABELAS
-- ============================================================================

-- VENDORS (quiosques de praia)
CREATE TABLE IF NOT EXISTS vendors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL UNIQUE,
  cnpj                TEXT,
  cpf                 TEXT,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  owner_name          TEXT NOT NULL,
  owner_phone         TEXT NOT NULL,
  owner_email         TEXT,
  logo_url            TEXT,
  password_hash       TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial','active','overdue','blocked')),
  trial_ends_at       TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  plan_type           TEXT CHECK (plan_type IN ('trial','monthly','6months','12months')),
  plan_expires_at     TIMESTAMPTZ,
  max_umbrellas       INTEGER NOT NULL DEFAULT 50,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- CUSTOMERS (clientes de cada quiosque)
CREATE TABLE IF NOT EXISTS customers (
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
CREATE TABLE IF NOT EXISTS umbrellas (
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

-- PRODUCTS (cardápio de cada quiosque)
CREATE TABLE IF NOT EXISTS products (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id          UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category           TEXT NOT NULL DEFAULT 'Geral',
  name               TEXT NOT NULL,
  description        TEXT,
  price              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  promotional_price  NUMERIC(10,2),
  image_url          TEXT,
  active             BOOLEAN DEFAULT TRUE,
  is_combo           BOOLEAN DEFAULT FALSE,
  sort_order         INTEGER DEFAULT 99,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ORDERS (pedidos)
CREATE TABLE IF NOT EXISTS orders (
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
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10,2) NOT NULL,
  subtotal    NUMERIC(10,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 3. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_vendor ON customers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_umbrellas_vendor ON umbrellas(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(vendor_id, active);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);


-- ============================================================================
-- 4. SEED DATA - POPULAR 500 QUIOSQUES
-- ============================================================================
-- O script abaixo insere:
-- - 500 quiosques
-- - 50 guarda-sóis por quiosque (25.000 total)
-- - Cardápio com 15 produtos por quiosque (7.500 total)
-- ============================================================================

-- Desabilitar triggers/constraints temporariamente se necessário
-- (descomente se tiver triggers que atrapalhem insertion em massa)
-- ALTER TABLE vendors DISABLE TRIGGER ALL;
-- ALTER TABLE umbrellas DISABLE TRIGGER ALL;
-- ALTER TABLE products DISABLE TRIGGER ALL;

DO $$
DECLARE
  v_vendor_id UUID;
  i INTEGER;
  j INTEGER;
  v_product_categories TEXT[] := ARRAY['Bebidas', 'Comidas', 'Combos', 'Lanches', 'Sorvetes'];
  v_products_data RECORD;
BEGIN
  -- Inserir 500 quiosques
  FOR i IN 1..500 LOOP
    INSERT INTO vendors (
      name,
      owner_name,
      owner_phone,
      owner_email,
      city,
      state,
      subscription_status,
      plan_type,
      max_umbrellas,
      is_active,
      created_at
    ) VALUES (
      'Teste ' || i::TEXT,                          -- name: "Teste 1", "Teste 2", ..., "Teste 500"
      'Proprietário Teste ' || i::TEXT,
      '11999999' || LPAD((i % 100)::TEXT, 3, '0'), -- telefone variado
      'teste' || i::TEXT || '@sandexpress.com',
      'Praia do Teste',
      'SP',
      'active',
      'monthly',
      50,
      TRUE,
      NOW() - (500 - i) || ' days'::INTERVAL
    ) RETURNING id INTO v_vendor_id;

    -- Inserir 50 guarda-sóis (umbrellas) para cada quiosque
    FOR j IN 1..50 LOOP
      INSERT INTO umbrellas (
        vendor_id,
        number,
        label,
        location_hint,
        active,
        created_at
      ) VALUES (
        v_vendor_id,
        j,
        'Guarda-sol ' || j::TEXT,
        'Posição ' || j::TEXT,
        TRUE,
        NOW()
      );
    END LOOP;

    -- Inserir cardápio (15 produtos variados)
    -- Bebidas (5 produtos)
    INSERT INTO products (vendor_id, category, name, description, price, active, sort_order)
    VALUES
      (v_vendor_id, 'Bebidas', 'Água', 'Água mineral 500ml', 3.00, TRUE, 1),
      (v_vendor_id, 'Bebidas', 'Refrigerante', 'Refrigerante 350ml', 5.00, TRUE, 2),
      (v_vendor_id, 'Bebidas', 'Suco Natural', 'Suco de laranja fresco', 8.00, TRUE, 3),
      (v_vendor_id, 'Bebidas', 'Chopp Gelado', 'Chopp artesanal 1L', 25.00, TRUE, 4),
      (v_vendor_id, 'Bebidas', 'Água de Coco', 'Água de coco gelada', 6.00, TRUE, 5);

    -- Comidas (5 produtos)
    INSERT INTO products (vendor_id, category, name, description, price, active, sort_order)
    VALUES
      (v_vendor_id, 'Comidas', 'Pastel', 'Pastel de carne frito', 8.00, TRUE, 6),
      (v_vendor_id, 'Comidas', 'Coxinha', 'Coxinha de frango quentinha', 6.00, TRUE, 7),
      (v_vendor_id, 'Comidas', 'Cachorro Quente', 'Cachorro quente especial', 12.00, TRUE, 8),
      (v_vendor_id, 'Comidas', 'Acarajé', 'Acarajé baiano tradicional', 10.00, TRUE, 9),
      (v_vendor_id, 'Comidas', 'Moqueca', 'Moqueca de camarão', 35.00, TRUE, 10);

    -- Combos (3 produtos)
    INSERT INTO products (vendor_id, category, name, description, price, is_combo, active, sort_order)
    VALUES
      (v_vendor_id, 'Combos', 'Combo Praia', 'Chopp + Pastel + Água', 35.00, TRUE, TRUE, 11),
      (v_vendor_id, 'Combos', 'Combo Festa', 'Chopp + 2x Coxinha + Suco', 42.00, TRUE, TRUE, 12),
      (v_vendor_id, 'Combos', 'Combo Família', 'Chopp 2L + 3x Pastel + Água Coco', 65.00, TRUE, TRUE, 13);

    -- Lanches (2 produtos)
    INSERT INTO products (vendor_id, category, name, description, price, active, sort_order)
    VALUES
      (v_vendor_id, 'Lanches', 'Queijo Quente', 'Queijo grelhado na chapa', 7.00, TRUE, 14),
      (v_vendor_id, 'Lanches', 'Biscoito Polvilho', 'Biscoito polvilho caseiro', 5.00, TRUE, 15);

  END LOOP;

  RAISE NOTICE 'Seed data criado com sucesso!';
  RAISE NOTICE '✓ 500 quiosques inseridos';
  RAISE NOTICE '✓ 25.000 guarda-sóis inseridos (50 por quiosque)';
  RAISE NOTICE '✓ 7.500 produtos de cardápio inseridos (15 por quiosque)';

END $$;

-- Reabilitar triggers/constraints se foram desabilitados
-- ALTER TABLE vendors ENABLE TRIGGER ALL;
-- ALTER TABLE umbrellas ENABLE TRIGGER ALL;
-- ALTER TABLE products ENABLE TRIGGER ALL;


-- ============================================================================
-- 5. CONFIGURAR ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE vendors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrellas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (leitura do cardápio e acesso dos clientes)
-- ⚠️ IMPORTANTE: Estas políticas são muito permissivas para desenvolvimento.
-- Em PRODUÇÃO, vincule ao auth.uid() do vendor!
CREATE POLICY IF NOT EXISTS pol_vendors_select 
  ON vendors FOR SELECT USING (is_active = TRUE AND subscription_status != 'blocked');

CREATE POLICY IF NOT EXISTS pol_umbrellas_select 
  ON umbrellas FOR SELECT USING (active = TRUE);

CREATE POLICY IF NOT EXISTS pol_products_select 
  ON products FOR SELECT USING (active = TRUE);

CREATE POLICY IF NOT EXISTS pol_customers_insert 
  ON customers FOR INSERT WITH CHECK (TRUE);

CREATE POLICY IF NOT EXISTS pol_customers_update 
  ON customers FOR UPDATE USING (TRUE);

CREATE POLICY IF NOT EXISTS pol_customers_select 
  ON customers FOR SELECT USING (TRUE);

CREATE POLICY IF NOT EXISTS pol_orders_insert 
  ON orders FOR INSERT WITH CHECK (TRUE);

CREATE POLICY IF NOT EXISTS pol_orders_select 
  ON orders FOR SELECT USING (TRUE);

CREATE POLICY IF NOT EXISTS pol_orders_update 
  ON orders FOR UPDATE USING (TRUE);

CREATE POLICY IF NOT EXISTS pol_items_insert 
  ON order_items FOR INSERT WITH CHECK (TRUE);

CREATE POLICY IF NOT EXISTS pol_items_select 
  ON order_items FOR SELECT USING (TRUE);


-- ============================================================================
-- 6. VERIFICAR DADOS INSERIDOS
-- ============================================================================
-- Execute estas queries para verificar:

-- Contar quiosques
-- SELECT COUNT(*) as total_vendors FROM vendors;
-- Expected: 500

-- Contar guarda-sóis
-- SELECT COUNT(*) as total_umbrellas FROM umbrellas;
-- Expected: 25.000

-- Contar produtos
-- SELECT COUNT(*) as total_products FROM products;
-- Expected: 7.500

-- Ver exemplo de um quiosque com seus dados
-- SELECT 
--   v.name as vendor_name,
--   COUNT(DISTINCT u.id) as umbrella_count,
--   COUNT(DISTINCT p.id) as product_count
-- FROM vendors v
-- LEFT JOIN umbrellas u ON v.id = u.vendor_id
-- LEFT JOIN products p ON v.id = p.vendor_id
-- WHERE v.name = 'Teste 1'
-- GROUP BY v.name;

-- ============================================================================
-- METADATA
-- ============================================================================
-- Criado em: 2026-04-10
-- Versão do Script: 1.0
-- Status: Pronto para usar em Supabase
-- 
-- Passos para usar:
-- 1. Copie este arquivo inteiro
-- 2. Acesse seu projeto Supabase
-- 3. Vá em SQL Editor → New Query
-- 4. Cole este conteúdo
-- 5. Clique em "Run" ou "Ctrl+Enter"
-- 6. Aguarde - pode levar 2-5 minutos com 500 quiosques
-- ============================================================================
