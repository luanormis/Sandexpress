-- SandExpress - protecoes contra concorrencia em pedidos, estoque e rate limit.
-- Aplicar em projetos existentes. Nao apaga dados.

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_open_per_umbrella
  ON orders(vendor_id, umbrella_id)
  WHERE paid = FALSE AND status IN ('received','preparing','delivering','completed','closing_requested');

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
  WHERE id = p_customer_id
    AND vendor_id = p_vendor_id
    AND tenant_id = umbrella_row.tenant_id
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
      SELECT * INTO order_row
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
  WHERE id = p_umbrella_id AND vendor_id = p_vendor_id;

  UPDATE customers
  SET total_spent = total_spent + order_total,
      updated_at = NOW()
  WHERE id = p_customer_id AND vendor_id = p_vendor_id;

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

ANALYZE orders;
ANALYZE order_items;
ANALYZE products;
ANALYZE rate_limit_buckets;
