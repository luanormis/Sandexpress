-- SandExpress - endurecimento de producao para picos de 500 pedidos simultaneos.
-- Execute depois de sql-atualizacao-escala-1000-quiosques.sql.
-- Incremental, idempotente e sem fallback para funcoes ou tabelas antigas.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_orders_vendor_updated_open
  ON orders(vendor_id, updated_at DESC, id)
  WHERE paid = FALSE;

CREATE INDEX IF NOT EXISTS idx_umbrellas_vendor_number_active
  ON umbrellas(vendor_id, number)
  INCLUDE (active, is_occupied, current_order_id);

CREATE INDEX IF NOT EXISTS idx_products_vendor_active_id
  ON products(vendor_id, id)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_order_items_request_order
  ON order_items(order_request_id, order_id);

CREATE INDEX IF NOT EXISTS idx_order_requests_vendor_created
  ON customer_order_requests(vendor_id, created_at DESC, order_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_created
  ON order_idempotency_keys(created_at);

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

CREATE OR REPLACE FUNCTION create_customer_order_idempotent(
  p_vendor_id UUID,
  p_customer_id UUID,
  p_umbrella_id UUID,
  p_items JSONB,
  p_notes TEXT,
  p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  claimed BOOLEAN := FALSE;
  stored_result JSONB;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key obrigatoria.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Itens do pedido invalidos.';
  END IF;

  INSERT INTO order_idempotency_keys(vendor_id, idempotency_key)
  VALUES (p_vendor_id, p_idempotency_key)
  ON CONFLICT (vendor_id, idempotency_key) DO NOTHING
  RETURNING TRUE INTO claimed;

  IF NOT COALESCE(claimed, FALSE) THEN
    SELECT result INTO stored_result
    FROM order_idempotency_keys
    WHERE vendor_id = p_vendor_id AND idempotency_key = p_idempotency_key;

    IF stored_result IS NULL THEN
      RAISE EXCEPTION 'Pedido idempotente sem resultado persistido.';
    END IF;
    RETURN stored_result || jsonb_build_object('duplicate', TRUE, 'synchronized', TRUE);
  END IF;

  -- Ordem global de bloqueio evita deadlock quando dois carrinhos possuem os
  -- mesmos produtos em sequencias diferentes. A funcao interna reutiliza locks.
  PERFORM p.id
  FROM products p
  WHERE p.vendor_id = p_vendor_id
    AND p.id IN (
      SELECT DISTINCT (item->>'product_id')::UUID
      FROM jsonb_array_elements(p_items) AS item
    )
  ORDER BY p.id
  FOR UPDATE;

  stored_result := create_customer_order(p_vendor_id, p_customer_id, p_umbrella_id, p_items, p_notes);

  UPDATE order_idempotency_keys
  SET result = stored_result
  WHERE vendor_id = p_vendor_id AND idempotency_key = p_idempotency_key;

  RETURN stored_result;
END;
$$;

REVOKE ALL ON FUNCTION create_customer_order_idempotent(UUID, UUID, UUID, JSONB, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_customer_order_idempotent(UUID, UUID, UUID, JSONB, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION create_customer_order_idempotent(UUID, UUID, UUID, JSONB, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_customer_order_idempotent(UUID, UUID, UUID, JSONB, TEXT, UUID) TO service_role;

ANALYZE orders;
ANALYZE umbrellas;
ANALYZE products;
ANALYZE customer_order_requests;
ANALYZE order_idempotency_keys;

COMMIT;
