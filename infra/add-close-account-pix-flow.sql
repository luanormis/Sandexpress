-- SandExpress: fechamento de conta, PIX e relatorios
-- Execute no Supabase SQL Editor antes de testar o novo fluxo.

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS pix_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_account_name TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pending_close BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS close_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pix_payload TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS party_size INTEGER NOT NULL DEFAULT 1 CHECK (party_size BETWEEN 1 AND 50);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS party_size INTEGER NOT NULL DEFAULT 1 CHECK (party_size BETWEEN 1 AND 50);

ALTER TABLE umbrellas
  ADD COLUMN IF NOT EXISTS map_x NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS map_y NUMERIC(5,2);

CREATE TABLE IF NOT EXISTS service_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  umbrella_id UUID NOT NULL REFERENCES umbrellas(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','cancelled')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_service_calls_open
  ON service_calls(vendor_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_close_flow
  ON orders(vendor_id, umbrella_id, customer_id, pending_close, paid);

CREATE INDEX IF NOT EXISTS idx_orders_paid_at
  ON orders(vendor_id, paid_at);

-- Realtime precisa publicar alteracoes em pedidos e itens para o Kanban.
DO $$
BEGIN
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
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE service_calls;
  END IF;
END $$;
