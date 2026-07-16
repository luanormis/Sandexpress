-- SandExpress - Promocoes flexiveis, presenca na praia e push segmentado
-- Migration aditiva: nao substitui products.promotional_price nem products.is_combo.

CREATE TABLE IF NOT EXISTS promocoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'combo_misto'
    CHECK (tipo IN ('combo_misto','mesmo_item','horario')),
  desconto_tipo TEXT NOT NULL DEFAULT 'valor_fixo'
    CHECK (desconto_tipo IN ('valor_fixo','percentual','preco_fechado')),
  desconto_valor NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (desconto_valor >= 0),
  hora_inicio TIME,
  hora_fim TIME,
  dias_semana INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  inicia_em TIMESTAMPTZ,
  termina_em TIMESTAMPTZ,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  disparar_push BOOLEAN NOT NULL DEFAULT FALSE,
  push_titulo TEXT,
  push_mensagem TEXT,
  push_disparado_em TIMESTAMPTZ,
  limite_por_pedido INTEGER CHECK (limite_por_pedido IS NULL OR limite_por_pedido > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promocao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promocao_id UUID NOT NULL REFERENCES promocoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  grupo TEXT NOT NULL DEFAULT 'principal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(promocao_id, product_id, grupo)
);

CREATE TABLE IF NOT EXISTS sessoes_quiosque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  umbrella_id UUID REFERENCES umbrellas(id) ON DELETE SET NULL,
  numero_guarda_sol INTEGER,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','closed')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
  closed_at TIMESTAMPTZ,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'web_push',
  platform TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, customer_id, token)
);

CREATE TABLE IF NOT EXISTS promocao_push_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  promocao_id UUID NOT NULL REFERENCES promocoes(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  push_token_id UUID REFERENCES customer_push_tokens(id) ON DELETE SET NULL,
  token TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_promocoes_vendor_active_time ON promocoes(vendor_id, ativa, hora_inicio, hora_fim);
CREATE INDEX IF NOT EXISTS idx_promocao_itens_promocao ON promocao_itens(promocao_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_quiosque_vendor_active ON sessoes_quiosque(vendor_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessoes_quiosque_customer_active ON sessoes_quiosque(customer_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_customer_push_tokens_customer_active ON customer_push_tokens(customer_id, active);
CREATE INDEX IF NOT EXISTS idx_promocao_push_queue_status ON promocao_push_queue(status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sessao_quiosque_active_customer
  ON sessoes_quiosque(vendor_id, customer_id)
  WHERE status = 'active';

ALTER TABLE promocoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promocao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_quiosque ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE promocao_push_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_only_promocoes ON promocoes;
CREATE POLICY service_only_promocoes ON promocoes FOR ALL USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS service_only_promocao_itens ON promocao_itens;
CREATE POLICY service_only_promocao_itens ON promocao_itens FOR ALL USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS service_only_sessoes_quiosque ON sessoes_quiosque;
CREATE POLICY service_only_sessoes_quiosque ON sessoes_quiosque FOR ALL USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS service_only_customer_push_tokens ON customer_push_tokens;
CREATE POLICY service_only_customer_push_tokens ON customer_push_tokens FOR ALL USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS service_only_promocao_push_queue ON promocao_push_queue;
CREATE POLICY service_only_promocao_push_queue ON promocao_push_queue FOR ALL USING (FALSE) WITH CHECK (FALSE);

CREATE OR REPLACE FUNCTION touch_sessao_quiosque(
  p_vendor_id UUID,
  p_customer_id UUID,
  p_umbrella_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_inactivity_minutes INTEGER DEFAULT 120
)
RETURNS sessoes_quiosque
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vendor_row vendors%ROWTYPE;
  umbrella_row umbrellas%ROWTYPE;
  session_row sessoes_quiosque%ROWTYPE;
BEGIN
  SELECT * INTO vendor_row FROM vendors WHERE id = p_vendor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiosque nao encontrado.';
  END IF;

  IF p_umbrella_id IS NOT NULL THEN
    SELECT * INTO umbrella_row
    FROM umbrellas
    WHERE id = p_umbrella_id AND vendor_id = p_vendor_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Guarda-sol nao pertence ao quiosque.';
    END IF;
  END IF;

  UPDATE sessoes_quiosque
  SET status = 'expired',
      closed_at = COALESCE(closed_at, NOW()),
      updated_at = NOW()
  WHERE vendor_id = p_vendor_id
    AND status = 'active'
    AND expires_at < NOW();

  INSERT INTO sessoes_quiosque(
    tenant_id,
    vendor_id,
    customer_id,
    umbrella_id,
    numero_guarda_sol,
    status,
    last_seen_at,
    expires_at,
    user_agent,
    updated_at
  )
  VALUES (
    vendor_row.tenant_id,
    p_vendor_id,
    p_customer_id,
    p_umbrella_id,
    CASE WHEN p_umbrella_id IS NULL THEN NULL ELSE umbrella_row.number END,
    'active',
    NOW(),
    NOW() + make_interval(mins => GREATEST(15, COALESCE(p_inactivity_minutes, 120))),
    p_user_agent,
    NOW()
  )
  ON CONFLICT (vendor_id, customer_id)
  WHERE status = 'active'
  DO UPDATE SET
    umbrella_id = EXCLUDED.umbrella_id,
    numero_guarda_sol = EXCLUDED.numero_guarda_sol,
    last_seen_at = NOW(),
    expires_at = EXCLUDED.expires_at,
    user_agent = COALESCE(EXCLUDED.user_agent, sessoes_quiosque.user_agent),
    updated_at = NOW()
  RETURNING * INTO session_row;

  RETURN session_row;
END;
$$;

CREATE OR REPLACE FUNCTION fechar_sessoes_quiosque(p_vendor_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE sessoes_quiosque
  SET status = 'closed',
      closed_at = NOW(),
      updated_at = NOW()
  WHERE vendor_id = p_vendor_id
    AND status = 'active';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION calcular_promocoes_carrinho(
  p_vendor_id UUID,
  p_cart JSONB,
  p_momento TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promo RECORD;
  req RECORD;
  product_row RECORD;
  cart_quantity INTEGER;
  sets_available INTEGER;
  eligible_sets INTEGER;
  group_gross NUMERIC(12,2);
  discount_per_set NUMERIC(12,2);
  discount_total NUMERIC(12,2) := 0;
  subtotal NUMERIC(12,2) := 0;
  applied JSONB := '[]'::jsonb;
  item_count INTEGER;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS tmp_cart_promocoes (
    product_id UUID PRIMARY KEY,
    quantity INTEGER NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE tmp_cart_promocoes;

  INSERT INTO tmp_cart_promocoes(product_id, quantity)
  SELECT product_id, SUM(quantity)::INTEGER
  FROM jsonb_to_recordset(COALESCE(p_cart, '[]'::jsonb)) AS item(product_id UUID, quantity INTEGER)
  WHERE product_id IS NOT NULL AND quantity > 0
  GROUP BY product_id;

  SELECT COUNT(*) INTO item_count FROM tmp_cart_promocoes;
  IF item_count = 0 THEN
    RETURN jsonb_build_object('subtotal', 0, 'discount_total', 0, 'total', 0, 'applied_promotions', applied);
  END IF;

  SELECT COALESCE(SUM(c.quantity * COALESCE(p.promotional_price, p.price)), 0)
  INTO subtotal
  FROM tmp_cart_promocoes c
  JOIN products p ON p.id = c.product_id
  WHERE p.vendor_id = p_vendor_id AND p.active = TRUE;

  FOR promo IN
    SELECT *
    FROM promocoes
    WHERE vendor_id = p_vendor_id
      AND ativa = TRUE
      AND (inicia_em IS NULL OR inicia_em <= p_momento)
      AND (termina_em IS NULL OR termina_em >= p_momento)
      AND EXTRACT(DOW FROM (p_momento AT TIME ZONE 'America/Sao_Paulo'))::INTEGER = ANY(dias_semana)
      AND (hora_inicio IS NULL OR (p_momento AT TIME ZONE 'America/Sao_Paulo')::TIME >= hora_inicio)
      AND (hora_fim IS NULL OR (p_momento AT TIME ZONE 'America/Sao_Paulo')::TIME <= hora_fim)
    ORDER BY desconto_valor DESC, created_at ASC
  LOOP
    eligible_sets := NULL;
    group_gross := 0;

    FOR req IN
      SELECT pi.product_id, pi.quantidade, COALESCE(p.promotional_price, p.price) AS unit_price
      FROM promocao_itens pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.promocao_id = promo.id
    LOOP
      SELECT quantity INTO cart_quantity
      FROM tmp_cart_promocoes
      WHERE product_id = req.product_id;

      IF COALESCE(cart_quantity, 0) < req.quantidade THEN
        eligible_sets := 0;
        EXIT;
      END IF;

      sets_available := FLOOR(cart_quantity::NUMERIC / req.quantidade)::INTEGER;
      eligible_sets := CASE
        WHEN eligible_sets IS NULL THEN sets_available
        ELSE LEAST(eligible_sets, sets_available)
      END;
      group_gross := group_gross + (req.unit_price * req.quantidade);
    END LOOP;

    eligible_sets := COALESCE(eligible_sets, 0);
    IF promo.limite_por_pedido IS NOT NULL THEN
      eligible_sets := LEAST(eligible_sets, promo.limite_por_pedido);
    END IF;

    IF eligible_sets > 0 AND group_gross > 0 THEN
      discount_per_set := CASE promo.desconto_tipo
        WHEN 'percentual' THEN group_gross * LEAST(promo.desconto_valor, 100) / 100
        WHEN 'preco_fechado' THEN GREATEST(0, group_gross - promo.desconto_valor)
        ELSE LEAST(group_gross, promo.desconto_valor)
      END;

      discount_total := discount_total + (discount_per_set * eligible_sets);
      applied := applied || jsonb_build_array(jsonb_build_object(
        'promocao_id', promo.id,
        'titulo', promo.titulo,
        'tipo', promo.tipo,
        'desconto_tipo', promo.desconto_tipo,
        'conjuntos_aplicados', eligible_sets,
        'subtotal_alvo', group_gross * eligible_sets,
        'desconto', ROUND(discount_per_set * eligible_sets, 2)
      ));
    END IF;
  END LOOP;

  discount_total := LEAST(subtotal, ROUND(discount_total, 2));

  RETURN jsonb_build_object(
    'subtotal', ROUND(subtotal, 2),
    'discount_total', discount_total,
    'total', ROUND(GREATEST(0, subtotal - discount_total), 2),
    'applied_promotions', applied
  );
END;
$$;

CREATE OR REPLACE FUNCTION listar_push_promocao_ativa(p_promocao_id UUID)
RETURNS TABLE (
  promocao_id UUID,
  vendor_id UUID,
  customer_id UUID,
  numero_guarda_sol INTEGER,
  token TEXT,
  provider TEXT,
  platform TEXT,
  titulo TEXT,
  mensagem TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS promocao_id,
    p.vendor_id,
    s.customer_id,
    s.numero_guarda_sol,
    t.token,
    t.provider,
    t.platform,
    COALESCE(p.push_titulo, p.titulo) AS titulo,
    COALESCE(p.push_mensagem, p.descricao, 'Tem promocao ativa no quiosque.') AS mensagem
  FROM promocoes p
  JOIN sessoes_quiosque s
    ON s.vendor_id = p.vendor_id
   AND s.status = 'active'
   AND s.expires_at >= NOW()
  JOIN customer_push_tokens t
    ON t.vendor_id = p.vendor_id
   AND t.customer_id = s.customer_id
   AND t.active = TRUE
  WHERE p.id = p_promocao_id
    AND p.ativa = TRUE
    AND p.disparar_push = TRUE
    AND (p.inicia_em IS NULL OR p.inicia_em <= NOW())
    AND (p.termina_em IS NULL OR p.termina_em >= NOW())
    AND EXTRACT(DOW FROM NOW())::INTEGER = ANY(p.dias_semana)
    AND (p.hora_inicio IS NULL OR NOW()::TIME >= p.hora_inicio)
    AND (p.hora_fim IS NULL OR NOW()::TIME <= p.hora_fim);
$$;

CREATE OR REPLACE FUNCTION enfileirar_push_promocao(p_promocao_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target RECORD;
  affected INTEGER := 0;
BEGIN
  FOR target IN SELECT * FROM listar_push_promocao_ativa(p_promocao_id) LOOP
    INSERT INTO promocao_push_queue(
      tenant_id,
      vendor_id,
      promocao_id,
      customer_id,
      push_token_id,
      token,
      titulo,
      mensagem,
      payload
    )
    SELECT
      p.tenant_id,
      target.vendor_id,
      target.promocao_id,
      target.customer_id,
      t.id,
      target.token,
      target.titulo,
      target.mensagem,
      jsonb_build_object(
        'type', 'promotion',
        'promocao_id', target.promocao_id,
        'vendor_id', target.vendor_id,
        'numero_guarda_sol', target.numero_guarda_sol
      )
    FROM promocoes p
    JOIN customer_push_tokens t
      ON t.vendor_id = target.vendor_id
     AND t.customer_id = target.customer_id
     AND t.token = target.token
    WHERE p.id = target.promocao_id
    ON CONFLICT DO NOTHING;

    affected := affected + 1;
  END LOOP;

  UPDATE promocoes
  SET push_disparado_em = NOW(),
      updated_at = NOW()
  WHERE id = p_promocao_id
    AND ativa = TRUE
    AND disparar_push = TRUE
    AND (inicia_em IS NULL OR inicia_em <= NOW())
    AND (termina_em IS NULL OR termina_em >= NOW())
    AND EXTRACT(DOW FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'))::INTEGER = ANY(dias_semana)
    AND (hora_inicio IS NULL OR (NOW() AT TIME ZONE 'America/Sao_Paulo')::TIME >= hora_inicio)
    AND (hora_fim IS NULL OR (NOW() AT TIME ZONE 'America/Sao_Paulo')::TIME <= hora_fim);

  RETURN affected;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON promocoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON promocao_itens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessoes_quiosque TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_push_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON promocao_push_queue TO service_role;
GRANT EXECUTE ON FUNCTION touch_sessao_quiosque(UUID, UUID, UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION fechar_sessoes_quiosque(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION calcular_promocoes_carrinho(UUID, JSONB, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION listar_push_promocao_ativa(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION enfileirar_push_promocao(UUID) TO service_role;

ANALYZE promocoes;
ANALYZE promocao_itens;
ANALYZE sessoes_quiosque;
ANALYZE customer_push_tokens;
ANALYZE promocao_push_queue;
