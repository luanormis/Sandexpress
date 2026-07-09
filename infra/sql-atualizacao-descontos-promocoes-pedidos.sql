-- SandExpress - Persistencia financeira de descontos de promocoes.
-- Rode no SQL Editor do Supabase depois da migration de promocoes flexiveis.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  ADD COLUMN IF NOT EXISTS promotion_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE customer_order_requests
  ADD COLUMN IF NOT EXISTS gross_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (gross_subtotal >= 0),
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  ADD COLUMN IF NOT EXISTS promotion_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS gross_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (gross_subtotal >= 0),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS promotion_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE orders
SET discount_total = COALESCE(discount_total, 0),
    promotion_snapshot = COALESCE(promotion_snapshot, '[]'::jsonb)
WHERE discount_total IS NULL OR promotion_snapshot IS NULL;

UPDATE customer_order_requests
SET gross_subtotal = CASE WHEN COALESCE(gross_subtotal, 0) <= 0 THEN COALESCE(subtotal, 0) ELSE gross_subtotal END,
    discount_total = COALESCE(discount_total, 0),
    promotion_snapshot = COALESCE(promotion_snapshot, '[]'::jsonb)
WHERE COALESCE(gross_subtotal, 0) <= 0 OR discount_total IS NULL OR promotion_snapshot IS NULL;

UPDATE order_items
SET gross_subtotal = CASE WHEN COALESCE(gross_subtotal, 0) <= 0 THEN COALESCE(subtotal, 0) ELSE gross_subtotal END,
    discount_amount = COALESCE(discount_amount, 0),
    promotion_snapshot = COALESCE(promotion_snapshot, '[]'::jsonb)
WHERE COALESCE(gross_subtotal, 0) <= 0 OR discount_amount IS NULL OR promotion_snapshot IS NULL;

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
  item_gross_subtotal NUMERIC(10,2);
  request_gross_total NUMERIC(10,2) := 0;
  request_discount_total NUMERIC(10,2) := 0;
  request_total NUMERIC(10,2) := 0;
  next_sequence INTEGER := 1;
  normalized_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  order_items_payload JSONB := '[]'::JSONB;
  promotion_preview JSONB := NULL;
  applied_promotions JSONB := '[]'::JSONB;
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
    item_gross_subtotal := ROUND(item_unit_price * item_quantity, 2);
    request_gross_total := request_gross_total + item_gross_subtotal;
    order_items_payload := order_items_payload || jsonb_build_array(jsonb_build_object(
      'product_id', item_product_id,
      'quantity', item_quantity,
      'unit_price', item_unit_price,
      'gross_subtotal', item_gross_subtotal,
      'discount_amount', 0,
      'subtotal', item_gross_subtotal,
      'promotion_snapshot', '[]'::jsonb
    ));
  END LOOP;

  SELECT calcular_promocoes_carrinho(p_vendor_id, p_items, NOW()) INTO promotion_preview;
  request_discount_total := ROUND(LEAST(
    request_gross_total,
    GREATEST(0, COALESCE((promotion_preview->>'discount_total')::NUMERIC, 0))
  ), 2);
  request_total := ROUND(GREATEST(0, request_gross_total - request_discount_total), 2);
  applied_promotions := COALESCE(promotion_preview->'applied_promotions', '[]'::jsonb);

  IF request_discount_total > 0 AND request_gross_total > 0 THEN
    WITH lines AS (
      SELECT
        payload,
        ordinality,
        (payload->>'gross_subtotal')::NUMERIC AS gross_subtotal
      FROM jsonb_array_elements(order_items_payload) WITH ORDINALITY AS source(payload, ordinality)
    ),
    allocation AS (
      SELECT
        payload,
        ordinality,
        gross_subtotal,
        CASE
          WHEN ordinality = MAX(ordinality) OVER () THEN
            ROUND(request_discount_total - COALESCE(
              SUM(ROUND(request_discount_total * gross_subtotal / request_gross_total, 2))
                OVER (ORDER BY ordinality ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),
              0
            ), 2)
          ELSE ROUND(request_discount_total * gross_subtotal / request_gross_total, 2)
        END AS line_discount
      FROM lines
    )
    SELECT jsonb_agg(
      payload || jsonb_build_object(
        'gross_subtotal', ROUND(gross_subtotal, 2),
        'discount_amount', LEAST(gross_subtotal, GREATEST(0, line_discount)),
        'subtotal', ROUND(GREATEST(0, gross_subtotal - LEAST(gross_subtotal, GREATEST(0, line_discount))), 2),
        'promotion_snapshot', applied_promotions
      )
      ORDER BY ordinality
    )
    INTO order_items_payload
    FROM allocation;
  END IF;

  IF order_row.id IS NULL THEN
    INSERT INTO orders(tenant_id, vendor_id, customer_id, umbrella_id, total, gross_total, discount_total, promotion_snapshot, notes)
    VALUES (
      umbrella_row.tenant_id,
      p_vendor_id,
      p_customer_id,
      p_umbrella_id,
      request_total,
      request_gross_total,
      request_discount_total,
      applied_promotions,
      normalized_notes
    )
    RETURNING * INTO order_row;
  ELSE
    UPDATE orders
    SET total = total + request_total,
        gross_total = gross_total + request_gross_total,
        discount_total = discount_total + request_discount_total,
        promotion_snapshot = COALESCE(promotion_snapshot, '[]'::jsonb) || applied_promotions,
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

  INSERT INTO customer_order_requests(
    tenant_id, vendor_id, order_id, customer_id, umbrella_id, sequence, notes,
    subtotal, gross_subtotal, discount_total, promotion_snapshot
  )
  VALUES (
    umbrella_row.tenant_id, p_vendor_id, order_row.id, p_customer_id, p_umbrella_id, next_sequence, normalized_notes,
    request_total, request_gross_total, request_discount_total, applied_promotions
  )
  RETURNING * INTO request_row;

  INSERT INTO order_items(
    tenant_id, order_id, order_request_id, product_id, quantity, unit_price,
    subtotal, gross_subtotal, discount_amount, promotion_snapshot
  )
  SELECT
    umbrella_row.tenant_id,
    order_row.id,
    request_row.id,
    (payload->>'product_id')::UUID,
    (payload->>'quantity')::INTEGER,
    (payload->>'unit_price')::NUMERIC,
    (payload->>'subtotal')::NUMERIC,
    (payload->>'gross_subtotal')::NUMERIC,
    (payload->>'discount_amount')::NUMERIC,
    COALESCE(payload->'promotion_snapshot', '[]'::jsonb)
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
    'request_gross_total', request_gross_total,
    'request_discount_total', request_discount_total,
    'total', order_row.total,
    'gross_total', order_row.gross_total,
    'discount_total', order_row.discount_total,
    'promotion_snapshot', order_row.promotion_snapshot,
    'promotion_preview', jsonb_build_object(
      'subtotal', request_gross_total,
      'discount_total', request_discount_total,
      'total', request_total,
      'applied_promotions', applied_promotions
    ),
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
  fee_type TEXT := 'percent';
  fee_rate NUMERIC(5,2) := 0;
  fixed_fee_amount NUMERIC(10,2) := 0;
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
      fee_type := CASE WHEN COALESCE(rate_row.fee_type, 'percent') = 'fixed' THEN 'fixed' ELSE 'percent' END;
      fee_rate := CASE WHEN fee_type = 'percent' THEN GREATEST(COALESCE(rate_row.fee_rate, 0), 0) ELSE 0 END;
      fixed_fee_amount := CASE WHEN fee_type = 'fixed' THEN GREATEST(COALESCE(rate_row.fixed_fee_amount, 0), 0) ELSE 0 END;
      payout_delay_days := GREATEST(COALESCE(rate_row.payout_delay_days, 0), 0);
    ELSE
      fee_type := 'percent';
      fixed_fee_amount := 0;
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
    fee_amount := CASE
      WHEN fee_type = 'fixed' THEN LEAST(gross_amount, ROUND(fixed_fee_amount, 2))
      ELSE ROUND(gross_amount * (fee_rate / 100), 2)
    END;
    net_amount := ROUND(GREATEST(gross_amount - fee_amount, 0), 2);
    expected_date := (CURRENT_DATE + payout_delay_days);

    UPDATE orders
    SET status = 'completed',
        paid = TRUE,
        pending_close = FALSE,
        payment_method = normalized_method,
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
    'discount_total', order_row.discount_total,
    'promotion_snapshot', order_row.promotion_snapshot,
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
