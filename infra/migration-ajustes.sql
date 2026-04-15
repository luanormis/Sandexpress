-- MIGRAÇÃO: ajustes/seguranca-e-funcionalidades
-- Execute este script no Supabase SQL Editor

-- 1. Ocupação de guarda-sol
ALTER TABLE umbrellas
  ADD COLUMN IF NOT EXISTS is_occupied   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS current_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_umbrellas_occupied ON umbrellas(vendor_id, is_occupied);

-- 2. Status de cancelamento em order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS cancelled      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 3. Solicitação de fechamento pelo cliente (pending_close)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pending_close BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. OTP persistido no banco (substitui Map em memória)
CREATE TABLE IF NOT EXISTS customer_otps (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone      TEXT NOT NULL,
  vendor_id  UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otps_lookup ON customer_otps(vendor_id, phone, used, expires_at);

ALTER TABLE customer_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY pol_otps_all ON customer_otps USING (TRUE) WITH CHECK (TRUE);

-- 5. Rate limit persistido no banco
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 1,
  reset_at   TIMESTAMPTZ NOT NULL
);
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY pol_rate_limit_all ON rate_limit_buckets USING (TRUE) WITH CHECK (TRUE);

-- Limpeza automática de registros expirados (executar periodicamente)
-- DELETE FROM customer_otps WHERE expires_at < NOW();
-- DELETE FROM rate_limit_buckets WHERE reset_at < NOW();

-- Helper function para repor estoque ao cancelar item
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
