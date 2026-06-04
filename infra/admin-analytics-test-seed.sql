-- SandExpress - fictional analytics seed for staging only.
-- Safe to run repeatedly: it creates deterministic fake vendors by document_login.

DELETE FROM vendors
WHERE document_login IN ('TEST-ANALYTICS-001', 'TEST-ANALYTICS-002', 'TEST-ANALYTICS-003');

WITH vendor_seed AS (
  INSERT INTO vendors (
    name, document_login, owner_name, owner_phone, owner_email, address, beach_name,
    city, state, subscription_status, plan_type, max_umbrellas, is_active
  )
  VALUES
    ('Quiosque Sol Azul', 'TEST-ANALYTICS-001', 'Marina Teste', '11990000001', 'solazul@example.com', 'Praia do Gonzaga', 'Praia do Gonzaga', 'Santos', 'SP', 'active', 'monthly', 50, TRUE),
    ('Quiosque Brisa Norte', 'TEST-ANALYTICS-002', 'Rafael Teste', '11990000002', 'brisanorte@example.com', 'Praia da Enseada', 'Praia da Enseada', 'Guaruja', 'SP', 'active', '12months', 50, TRUE),
    ('Quiosque Mar Forte', 'TEST-ANALYTICS-003', 'Camila Teste', '11990000003', 'marforte@example.com', 'Praia de Maresias', 'Praia de Maresias', 'Sao Sebastiao', 'SP', 'trial', 'trial', 50, TRUE)
  ON CONFLICT (document_login) DO UPDATE SET
    name = EXCLUDED.name,
    owner_name = EXCLUDED.owner_name,
    owner_phone = EXCLUDED.owner_phone,
    owner_email = EXCLUDED.owner_email,
    address = EXCLUDED.address,
    beach_name = EXCLUDED.beach_name,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    subscription_status = EXCLUDED.subscription_status,
    plan_type = EXCLUDED.plan_type,
    max_umbrellas = EXCLUDED.max_umbrellas,
    is_active = EXCLUDED.is_active
  RETURNING id, document_login
),
all_vendors AS (
  SELECT id, document_login FROM vendor_seed
  UNION
  SELECT id, document_login FROM vendors WHERE document_login IN ('TEST-ANALYTICS-001', 'TEST-ANALYTICS-002', 'TEST-ANALYTICS-003')
),
umbrella_seed AS (
  INSERT INTO umbrellas (vendor_id, number, label, location_hint, active)
  SELECT id, 1, 'Guarda-sol 1', 'Primeira fileira', TRUE FROM all_vendors
  ON CONFLICT (vendor_id, number) DO UPDATE SET active = TRUE
  RETURNING id, vendor_id
),
customer_seed AS (
  INSERT INTO customers (vendor_id, name, phone, visit_count, total_spent)
  SELECT id, 'Cliente Teste ' || right(document_login, 3), '11988' || right(document_login, 3) || '000', 1, 0 FROM all_vendors
  ON CONFLICT (vendor_id, phone) DO UPDATE SET last_visit_at = NOW()
  RETURNING id, vendor_id
),
product_seed AS (
  INSERT INTO products (vendor_id, category, name, description, price, active, sort_order, stock_quantity, blocked_by_stock)
  SELECT id, product.category, product.name, product.description, product.price, TRUE, product.sort_order, 500, FALSE
  FROM all_vendors
  CROSS JOIN (
    VALUES
      ('Cervejas', 'Cerveja Heineken Lata 350ml', 'Cerveja premium gelada', 12.00, 1),
      ('Cervejas', 'Cerveja Amstel Lata 350ml', 'Cerveja tradicional gelada', 10.00, 2),
      ('Petiscos', 'Porcao de Peixe Frito', 'Porcao para compartilhar', 75.00, 3),
      ('Petiscos', 'Porcao de Batata Frita', 'Batata crocante', 35.00, 4),
      ('Drinks', 'Caipirinha de Limao', 'Cachaca, limao e gelo', 22.00, 5),
      ('Bebidas sem alcool', 'Agua Mineral sem Gas', 'Garrafa 500ml', 5.00, 6)
  ) AS product(category, name, description, price, sort_order)
  ON CONFLICT DO NOTHING
  RETURNING id, vendor_id, name, price
),
all_products AS (
  SELECT p.id, p.vendor_id, p.name, p.price
  FROM products p
  JOIN all_vendors v ON v.id = p.vendor_id
  WHERE p.name IN (
    'Cerveja Heineken Lata 350ml',
    'Cerveja Amstel Lata 350ml',
    'Porcao de Peixe Frito',
    'Porcao de Batata Frita',
    'Caipirinha de Limao',
    'Agua Mineral sem Gas'
  )
),
order_seed AS (
  INSERT INTO orders (vendor_id, customer_id, umbrella_id, status, total, notes, paid, payment_method, created_at)
  SELECT
    v.id,
    c.id,
    u.id,
    'completed',
    0,
    'Pedido ficticio analytics',
    TRUE,
    CASE WHEN right(v.document_login, 1) = '1' THEN 'pix' ELSE 'card' END,
    NOW() - (interval '1 hour' * series.hour_offset)
  FROM all_vendors v
  JOIN customer_seed c ON c.vendor_id = v.id
  JOIN umbrella_seed u ON u.vendor_id = v.id
  CROSS JOIN (VALUES (2), (3), (5), (7), (11), (14)) AS series(hour_offset)
  RETURNING id, vendor_id, created_at
),
item_seed AS (
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
  SELECT
    o.id,
    p.id,
    CASE
      WHEN p.name LIKE 'Cerveja%' THEN 4
      WHEN p.name LIKE 'Agua%' THEN 2
      ELSE 1
    END,
    p.price,
    p.price * CASE
      WHEN p.name LIKE 'Cerveja%' THEN 4
      WHEN p.name LIKE 'Agua%' THEN 2
      ELSE 1
    END
  FROM order_seed o
  JOIN all_products p ON p.vendor_id = o.vendor_id
  WHERE p.name IN ('Cerveja Heineken Lata 350ml', 'Cerveja Amstel Lata 350ml', 'Porcao de Batata Frita', 'Agua Mineral sem Gas')
  RETURNING order_id
)
UPDATE orders o
SET total = totals.total
FROM (
  SELECT order_id, SUM(subtotal) AS total
  FROM order_items
  WHERE order_id IN (SELECT id FROM order_seed)
  GROUP BY order_id
) totals
WHERE o.id = totals.order_id;
