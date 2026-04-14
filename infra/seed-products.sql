-- Seed de 60 produtos de teste para cada vendor
-- Execute este script diretamente no SQL Editor do Supabase.

-- Gerar 60 produtos de teste por quiosque (50 ativos + 10 inativos)
INSERT INTO products (vendor_id, category, name, description, price, promotional_price, active, sort_order)
SELECT 
  v.id,
  CASE 
    WHEN (row_number - 1) % 10 = 0 THEN 'Bebidas'
    WHEN (row_number - 1) % 10 = 1 THEN 'Petiscos'
    WHEN (row_number - 1) % 10 = 2 THEN 'Pratos Principais'
    WHEN (row_number - 1) % 10 = 3 THEN 'Sobremesas'
    WHEN (row_number - 1) % 10 = 4 THEN 'Combos'
    WHEN (row_number - 1) % 10 = 5 THEN 'Bebidas'
    WHEN (row_number - 1) % 10 = 6 THEN 'Petiscos'
    WHEN (row_number - 1) % 10 = 7 THEN 'Pratos Principais'
    WHEN (row_number - 1) % 10 = 8 THEN 'Sobremesas'
    ELSE 'Bebidas'
  END,
  CASE 
    WHEN (row_number - 1) % 10 = 0 THEN 'Chopp Brahma ' || row_number
    WHEN (row_number - 1) % 10 = 1 THEN 'Batata Frita ' || row_number
    WHEN (row_number - 1) % 10 = 2 THEN 'Moqueca de Peixe ' || row_number
    WHEN (row_number - 1) % 10 = 3 THEN 'Brigadeiro Premium ' || row_number
    WHEN (row_number - 1) % 10 = 4 THEN 'Combo Familiar ' || row_number
    WHEN (row_number - 1) % 10 = 5 THEN 'Água Mineral ' || row_number
    WHEN (row_number - 1) % 10 = 6 THEN 'Croquete de Queijo ' || row_number
    WHEN (row_number - 1) % 10 = 7 THEN 'Carne Grelhada ' || row_number
    WHEN (row_number - 1) % 10 = 8 THEN 'Sorvete Gourmet ' || row_number
    ELSE 'Refrigerante ' || row_number
  END,
  'Delicioso item do cardápio SandExpress - Item ' || row_number,
  FLOOR(RANDOM() * 50 + 10)::numeric(10,2),
  CASE WHEN RANDOM() < 0.3 THEN FLOOR(RANDOM() * 30 + 5)::numeric(10,2) ELSE NULL END,
  CASE 
    WHEN row_number > 60 THEN FALSE
    ELSE TRUE
  END,
  row_number
FROM vendors v
CROSS JOIN LATERAL generate_series(1, 60) WITH ORDINALITY AS series(row_number)
ON CONFLICT DO NOTHING;

-- Ajustar estoque inicial (100 unidades por item)
UPDATE products
SET stock_quantity = 100
WHERE stock_quantity IS NULL;

-- Verificar quantidade de produtos criados
SELECT vendor_id, COUNT(*) AS total_products
FROM products
GROUP BY vendor_id
ORDER BY total_products DESC;
