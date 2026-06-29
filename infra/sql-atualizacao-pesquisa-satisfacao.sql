-- Pesquisa de satisfacao apos pedido de conta.
-- Aplicar em projetos existentes antes do deploy da funcionalidade.

CREATE TABLE IF NOT EXISTS customer_satisfaction_surveys (
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

CREATE INDEX IF NOT EXISTS idx_satisfaction_tenant_created ON customer_satisfaction_surveys(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_satisfaction_vendor_created ON customer_satisfaction_surveys(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_satisfaction_order_customer ON customer_satisfaction_surveys(order_id, customer_id);

DROP TRIGGER IF EXISTS trg_customer_satisfaction_surveys_updated_at ON customer_satisfaction_surveys;
CREATE TRIGGER trg_customer_satisfaction_surveys_updated_at BEFORE UPDATE ON customer_satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE customer_satisfaction_surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_only_customer_satisfaction_surveys ON customer_satisfaction_surveys;
CREATE POLICY service_only_customer_satisfaction_surveys ON customer_satisfaction_surveys
  FOR ALL USING (FALSE) WITH CHECK (FALSE);

ANALYZE customer_satisfaction_surveys;
