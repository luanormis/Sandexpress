-- MIGRAÇÃO: adicionar tabela praia para analytics de vendas por praia
-- Execute este script no Supabase SQL Editor

-- Tabela para analytics de praias mais visitadas e vendas
CREATE TABLE IF NOT EXISTS beaches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  city            TEXT,
  state           TEXT,
  region          TEXT,
  latitude        DECIMAL(10,8),
  longitude       DECIMAL(11,8),
  total_visits    INTEGER NOT NULL DEFAULT 0,
  total_sales     NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_ticket      NUMERIC(10,2) NOT NULL DEFAULT 0,
  peak_hours      JSONB, -- {"0": 5, "1": 3, ...} - visitas por hora
  popular_products JSONB, -- [{"product_id": "uuid", "name": "Produto", "sales": 100}]
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_beaches_tenant ON beaches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beaches_active ON beaches(is_active);
CREATE INDEX IF NOT EXISTS idx_beaches_location ON beaches(latitude, longitude);

-- RLS
ALTER TABLE beaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY pol_beaches_select ON beaches FOR SELECT USING (TRUE);
CREATE POLICY pol_beaches_insert ON beaches FOR INSERT WITH CHECK (TRUE);
CREATE POLICY pol_beaches_update ON beaches FOR UPDATE USING (TRUE);

-- Função para atualizar analytics da praia quando uma venda é feita
CREATE OR REPLACE FUNCTION update_beach_analytics()
RETURNS TRIGGER AS $$
DECLARE
  beach_record RECORD;
  order_hour INTEGER;
  product_data JSONB;
BEGIN
  -- Buscar dados da praia através do tenant do vendor
  SELECT b.* INTO beach_record
  FROM beaches b
  JOIN vendors v ON v.id = NEW.vendor_id
  JOIN tenants t ON t.id = v.tenant_id
  WHERE b.tenant_id = t.id
  LIMIT 1;

  IF beach_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calcular hora do pedido
  order_hour := EXTRACT(HOUR FROM NEW.created_at);

  -- Buscar produto mais vendido (simplificado - apenas o primeiro item)
  SELECT jsonb_build_object(
    'product_id', oi.product_id,
    'name', p.name,
    'sales', 1
  ) INTO product_data
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id
  LIMIT 1;

  -- Atualizar analytics da praia
  UPDATE beaches SET
    total_visits = total_visits + 1,
    total_sales = total_sales + NEW.total,
    avg_ticket = (total_sales + NEW.total) / (total_visits + 1),
    peak_hours = jsonb_set(
      COALESCE(peak_hours, '{}'),
      ARRAY[order_hour::text],
      (COALESCE(peak_hours->>order_hour::text, '0')::integer + 1)::text::jsonb
    ),
    popular_products = CASE
      WHEN popular_products IS NULL THEN jsonb_build_array(product_data)
      ELSE popular_products || product_data
    END,
    updated_at = NOW()
  WHERE id = beach_record.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar analytics quando um pedido é criado
CREATE OR REPLACE TRIGGER trigger_update_beach_analytics
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_beach_analytics();

-- Função para criar praia automaticamente quando tenant é criado
CREATE OR REPLACE FUNCTION create_beach_for_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.beach_name IS NOT NULL THEN
    INSERT INTO beaches (tenant_id, name, city, state, region)
    VALUES (NEW.id, NEW.beach_name, NEW.city, NEW.state, NEW.region)
    ON CONFLICT (tenant_id, name) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar praia quando tenant é inserido
CREATE OR REPLACE TRIGGER trigger_create_beach_for_tenant
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_beach_for_tenant();</content>
<parameter name="filePath">c:\Users\55119\.gemini\antigravity\scratch\sandexpress\infra\migration-beach-analytics.sql