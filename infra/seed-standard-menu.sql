-- Cardapio padrao SandExpress.
-- Troque os UUIDs abaixo pelo id do vendor/quiosque e execute quando quiser recarregar o cardapio.
-- SELECT seed_standard_menu('00000000-0000-0000-0000-000000000000');

CREATE OR REPLACE FUNCTION seed_standard_menu(p_vendor_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO products (
    tenant_id, vendor_id, category, name, description, price,
    active, is_combo, sort_order, stock_quantity, blocked_by_stock
  )
  SELECT p_vendor_id, p_vendor_id, category, name, description, price,
         TRUE, FALSE, sort_order, stock_quantity, stock_quantity <= 0
  FROM (VALUES
    ('Petiscos e Porcoes', 'Porcao de Peixe Frito', 'Porcao para compartilhar.', 75.00, 10, 20),
    ('Petiscos e Porcoes', 'Porcao de Camarao Frito', 'Camarao frito crocante.', 90.00, 11, 20),
    ('Petiscos e Porcoes', 'Porcao de Batata Frita', 'Batata frita sequinha.', 35.00, 12, 40),
    ('Petiscos e Porcoes', 'Porcao de Mandioca Frita', 'Mandioca frita crocante.', 38.00, 13, 30),
    ('Pasteis', 'Pastel de Camarao', 'Unidade.', 14.00, 20, 60),
    ('Pasteis', 'Pastel de Carne', 'Unidade.', 12.00, 21, 60),
    ('Pasteis', 'Pastel de Queijo', 'Unidade.', 12.00, 22, 60),
    ('Pasteis', 'Pastel de Palmito', 'Unidade.', 12.00, 23, 40),
    ('Pasteis', 'Pastel de Frango com Catupiry', 'Unidade.', 13.00, 24, 50),
    ('Drinks, Caipirinhas e Batidas', 'Caipirinha de Limao (Cachaca)', 'Preparada na hora.', 22.00, 30, 40),
    ('Drinks, Caipirinhas e Batidas', 'Caipiroska de Frutas (Vodka)', 'Escolha a fruta disponivel.', 26.00, 31, 40),
    ('Drinks, Caipirinhas e Batidas', 'Batida de Coco', 'Copo individual.', 20.00, 32, 40),
    ('Drinks, Caipirinhas e Batidas', 'Batida de Maracuja', 'Copo individual.', 20.00, 33, 40),
    ('Drinks, Caipirinhas e Batidas', 'Batida de Morango', 'Copo individual.', 20.00, 34, 40),
    ('Cervejas em Lata', 'Cerveja Amstel / Skol / Brahma (Lata 350ml)', 'Lata 350ml.', 10.00, 40, 120),
    ('Cervejas em Lata', 'Cerveja Heineken / Corona / Stella Artois (Lata 350ml)', 'Lata 350ml.', 12.00, 41, 90),
    ('Cervejas em Lata', 'Cerveja Budweiser / Eisenbahn (Lata 350ml)', 'Lata 350ml.', 11.00, 42, 90),
    ('Cervejas em Lata', 'Cervejas Latao (Marcas Tradicionais - 473ml)', 'Lata 473ml.', 13.00, 43, 80),
    ('Bebidas Nao Alcoolicas', 'Suco Natural de Frutas (Laranja, Abacaxi ou Limao)', 'Copo individual.', 12.00, 50, 60),
    ('Bebidas Nao Alcoolicas', 'Refrigerante Lata (Coca-Cola / Coca-Cola Zero)', 'Lata 350ml.', 7.00, 51, 80),
    ('Bebidas Nao Alcoolicas', 'Refrigerante Lata (Guarana Antarctica / Sprite / Fanta Laranja)', 'Lata 350ml.', 7.00, 52, 80),
    ('Bebidas Nao Alcoolicas', 'Agua Mineral sem Gas', 'Garrafa individual.', 5.00, 53, 120),
    ('Bebidas Nao Alcoolicas', 'Agua Mineral com Gas', 'Garrafa individual.', 6.00, 54, 80)
  ) AS menu(category, name, description, price, sort_order, stock_quantity)
  WHERE NOT EXISTS (
    SELECT 1 FROM products
    WHERE products.vendor_id = p_vendor_id
      AND products.name = menu.name
  );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END $$;
