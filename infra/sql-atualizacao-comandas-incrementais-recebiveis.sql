-- Comandas incrementais, taxas por meio de pagamento e recebiveis.
-- Rode no SQL Editor do Supabase em bancos existentes.

CREATE TABLE IF NOT EXISTS customer_order_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  umbrella_id UUID REFERENCES umbrellas(id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','preparing','delivering','completed','cancelled')),
  notes TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, sequence)
);

CREATE TABLE IF NOT EXISTS payment_method_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','pix','debit_card','credit_card')),
  fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (fee_rate >= 0),
  payout_delay_days INTEGER NOT NULL DEFAULT 0 CHECK (payout_delay_days >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, payment_method)
);

CREATE TABLE IF NOT EXISTS payment_receivables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','pix','debit_card','credit_card')),
  gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (fee_rate >= 0),
  fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id)
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS gross_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pix_payload TEXT,
  ADD COLUMN IF NOT EXISTS close_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS order_request_id UUID REFERENCES customer_order_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

CREATE INDEX IF NOT EXISTS idx_order_requests_order ON customer_order_requests(order_id, sequence);
CREATE INDEX IF NOT EXISTS idx_order_requests_vendor_created ON customer_order_requests(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_rates_vendor_method ON payment_method_rates(vendor_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_receivables_vendor_expected ON payment_receivables(vendor_id, expected_payment_date, status);
CREATE INDEX IF NOT EXISTS idx_order_items_request ON order_items(order_request_id);

INSERT INTO payment_method_rates(tenant_id, vendor_id, payment_method, fee_rate, payout_delay_days)
SELECT v.tenant_id, v.id, method.payment_method, method.fee_rate, method.payout_delay_days
FROM vendors v
CROSS JOIN LATERAL (
  VALUES
    ('cash', 0::NUMERIC, 0),
    ('pix', GREATEST(COALESCE(v.pix_fee_rate, 0), 0), 0),
    ('debit_card', GREATEST(COALESCE(v.debit_card_fee_rate, 0), 0), 1),
    ('credit_card', GREATEST(COALESCE(v.credit_card_fee_rate, 0), 0), 30)
) AS method(payment_method, fee_rate, payout_delay_days)
ON CONFLICT (vendor_id, payment_method) DO UPDATE
SET fee_rate = EXCLUDED.fee_rate,
    updated_at = NOW();

INSERT INTO customer_order_requests(tenant_id, vendor_id, order_id, customer_id, umbrella_id, sequence, status, notes, subtotal, created_at, updated_at)
SELECT o.tenant_id, o.vendor_id, o.id, o.customer_id, o.umbrella_id, 1,
       CASE WHEN o.status = 'cancelled' THEN 'cancelled' ELSE 'completed' END,
       o.notes,
       COALESCE(o.total, 0),
       o.created_at,
       COALESCE(o.updated_at, o.created_at)
FROM orders o
WHERE NOT EXISTS (
  SELECT 1 FROM customer_order_requests cor WHERE cor.order_id = o.id
);

UPDATE order_items oi
SET order_request_id = cor.id
FROM customer_order_requests cor
WHERE oi.order_id = cor.order_id
  AND oi.order_request_id IS NULL;

ALTER TABLE customer_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_method_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receivables ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_order_requests' AND policyname = 'service_only_order_requests') THEN
    CREATE POLICY service_only_order_requests ON customer_order_requests FOR ALL USING (FALSE) WITH CHECK (FALSE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_method_rates' AND policyname = 'service_only_payment_rates') THEN
    CREATE POLICY service_only_payment_rates ON payment_method_rates FOR ALL USING (FALSE) WITH CHECK (FALSE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_receivables' AND policyname = 'service_only_receivables') THEN
    CREATE POLICY service_only_receivables ON payment_receivables FOR ALL USING (FALSE) WITH CHECK (FALSE);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON customer_order_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_method_rates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_receivables TO service_role;

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
  request_row customer_order_requests%ROWTYPE;
  item JSONB;
  product_row products%ROWTYPE;
  item_product_id UUID;
  item_quantity INTEGER;
  item_unit_price NUMERIC(10,2);
  item_subtotal NUMERIC(10,2);
  request_total NUMERIC(10,2) := 0;
  next_sequence INTEGER := 1;
  normalized_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  order_items_payload JSONB := '[]'::JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Dados de pedido incompletos.';
  END IF;

  SELECT * INTO umbrella_row
  FROM umbrellas
  WHERE id = p_umbrella_id AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guarda-sol invalido para este quiosque.';
  END IF;

  IF NOT umbrella_row.active THEN
    RAISE EXCEPTION 'Guarda-sol inativo.';
  END IF;

  SELECT * INTO customer_row
  FROM customers
  WHERE id = p_customer_id AND vendor_id = p_vendor_id AND tenant_id = umbrella_row.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao pertence a este quiosque.';
  END IF;

  SELECT * INTO order_row
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

    SELECT * INTO product_row
    FROM products
    WHERE id = item_product_id AND vendor_id = p_vendor_id AND tenant_id = umbrella_row.tenant_id
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
    request_total := request_total + item_subtotal;
    order_items_payload := order_items_payload || jsonb_build_array(jsonb_build_object(
      'product_id', item_product_id,
      'quantity', item_quantity,
      'unit_price', item_unit_price,
      'subtotal', item_subtotal
    ));
  END LOOP;

  IF order_row.id IS NULL THEN
    INSERT INTO orders(tenant_id, vendor_id, customer_id, umbrella_id, total, gross_total, notes)
    VALUES (umbrella_row.tenant_id, p_vendor_id, p_customer_id, p_umbrella_id, request_total, request_total, normalized_notes)
    RETURNING * INTO order_row;
  ELSE
    UPDATE orders
    SET total = total + request_total,
        gross_total = gross_total + request_total,
        status = CASE WHEN status = 'completed' THEN 'received' ELSE status END,
        pending_close = FALSE,
        notes = NULLIF(CONCAT_WS(E'\n', notes, normalized_notes), ''),
        updated_at = NOW()
    WHERE id = order_row.id
    RETURNING * INTO order_row;
  END IF;

  SELECT COALESCE(MAX(sequence), 0) + 1 INTO next_sequence
  FROM customer_order_requests
  WHERE order_id = order_row.id;

  INSERT INTO customer_order_requests(tenant_id, vendor_id, order_id, customer_id, umbrella_id, sequence, notes, subtotal)
  VALUES (umbrella_row.tenant_id, p_vendor_id, order_row.id, p_customer_id, p_umbrella_id, next_sequence, normalized_notes, request_total)
  RETURNING * INTO request_row;

  INSERT INTO order_items(tenant_id, order_id, order_request_id, product_id, quantity, unit_price, subtotal)
  SELECT
    umbrella_row.tenant_id,
    order_row.id,
    request_row.id,
    (payload->>'product_id')::UUID,
    (payload->>'quantity')::INTEGER,
    (payload->>'unit_price')::NUMERIC,
    (payload->>'subtotal')::NUMERIC
  FROM jsonb_array_elements(order_items_payload) AS payload;

  UPDATE umbrellas
  SET is_occupied = TRUE, current_order_id = order_row.id, updated_at = NOW()
  WHERE id = p_umbrella_id AND vendor_id = p_vendor_id;

  UPDATE customers
  SET total_spent = total_spent + request_total, updated_at = NOW()
  WHERE id = p_customer_id AND vendor_id = p_vendor_id;

  RETURN jsonb_build_object(
    'id', order_row.id,
    'order_request_id', request_row.id,
    'order_sequence', request_row.sequence,
    'tenant_id', order_row.tenant_id,
    'vendor_id', order_row.vendor_id,
    'customer_id', order_row.customer_id,
    'umbrella_id', order_row.umbrella_id,
    'request_total', request_total,
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
  rate_row payment_method_rates%ROWTYPE;
  normalized_method TEXT;
  fee_rate NUMERIC(5,2) := 0;
  payout_delay_days INTEGER := 0;
  fee_amount NUMERIC(10,2) := 0;
  gross_amount NUMERIC(10,2) := 0;
  net_amount NUMERIC(10,2) := 0;
  expected_date DATE := CURRENT_DATE;
  normalized_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
BEGIN
  IF p_vendor_id IS NULL OR (p_umbrella_id IS NULL AND NULLIF(BTRIM(COALESCE(p_customer_phone, '')), '') IS NULL) THEN
    RAISE EXCEPTION 'vendor_id e guarda-sol ou telefone sao obrigatorios.';
  END IF;

  SELECT o.* INTO order_row
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

  SELECT * INTO customer_row
  FROM customers
  WHERE id = order_row.customer_id AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente da conta nao encontrado.';
  END IF;

  IF p_request_only THEN
    UPDATE orders
    SET status = 'closing_requested',
        pending_close = TRUE,
        close_requested_at = NOW(),
        notes = COALESCE(normalized_notes, notes),
        updated_at = NOW()
    WHERE id = order_row.id AND paid = FALSE
    RETURNING * INTO order_row;
  ELSE
    SELECT * INTO vendor_row FROM vendors WHERE id = p_vendor_id FOR UPDATE;
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

    SELECT * INTO rate_row
    FROM payment_method_rates
    WHERE vendor_id = p_vendor_id AND payment_method = normalized_method AND active = TRUE
    LIMIT 1;

    IF FOUND THEN
      fee_rate := GREATEST(COALESCE(rate_row.fee_rate, 0), 0);
      payout_delay_days := GREATEST(COALESCE(rate_row.payout_delay_days, 0), 0);
    ELSE
      fee_rate := CASE normalized_method
        WHEN 'debit_card' THEN GREATEST(COALESCE(vendor_row.debit_card_fee_rate, 0), 0)
        WHEN 'credit_card' THEN GREATEST(COALESCE(vendor_row.credit_card_fee_rate, 0), 0)
        WHEN 'pix' THEN GREATEST(COALESCE(vendor_row.pix_fee_rate, 0), 0)
        ELSE 0
      END;
      payout_delay_days := CASE normalized_method
        WHEN 'credit_card' THEN 30
        WHEN 'debit_card' THEN 1
        ELSE 0
      END;
    END IF;

    gross_amount := ROUND(GREATEST(COALESCE(order_row.total, 0), 0), 2);
    fee_amount := ROUND(gross_amount * (fee_rate / 100), 2);
    net_amount := ROUND(GREATEST(gross_amount - fee_amount, 0), 2);
    expected_date := (CURRENT_DATE + payout_delay_days);

    UPDATE orders
    SET status = 'completed',
        paid = TRUE,
        pending_close = FALSE,
        payment_method = normalized_method,
        gross_total = gross_amount,
        payment_fee_rate = fee_rate,
        payment_fee_amount = fee_amount,
        net_total = net_amount,
        paid_at = NOW(),
        notes = COALESCE(normalized_notes, notes),
        updated_at = NOW()
    WHERE id = order_row.id AND paid = FALSE
    RETURNING * INTO order_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conta ja foi fechada.';
    END IF;

    INSERT INTO payment_receivables(
      tenant_id, vendor_id, order_id, payment_method, gross_amount, fee_rate, fee_amount,
      net_amount, paid_at, expected_payment_date, status
    )
    VALUES (
      order_row.tenant_id, p_vendor_id, order_row.id, normalized_method, gross_amount, fee_rate,
      fee_amount, net_amount, COALESCE(order_row.paid_at, NOW()), expected_date,
      CASE WHEN normalized_method IN ('cash','pix') AND payout_delay_days = 0 THEN 'received' ELSE 'pending' END
    )
    ON CONFLICT (order_id) DO UPDATE
    SET payment_method = EXCLUDED.payment_method,
        gross_amount = EXCLUDED.gross_amount,
        fee_rate = EXCLUDED.fee_rate,
        fee_amount = EXCLUDED.fee_amount,
        net_amount = EXCLUDED.net_amount,
        paid_at = EXCLUDED.paid_at,
        expected_payment_date = EXCLUDED.expected_payment_date,
        status = EXCLUDED.status,
        updated_at = NOW();

    UPDATE umbrellas
    SET is_occupied = FALSE, current_order_id = NULL, updated_at = NOW()
    WHERE id = order_row.umbrella_id AND vendor_id = p_vendor_id;

    UPDATE customers
    SET visit_count = COALESCE(visit_count, 0) + 1,
        last_visit_at = NOW(),
        updated_at = NOW()
    WHERE id = order_row.customer_id AND vendor_id = p_vendor_id
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
    'expected_payment_date', expected_date,
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
