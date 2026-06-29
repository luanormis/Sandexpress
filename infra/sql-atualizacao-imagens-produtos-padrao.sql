-- SandExpress - galeria padrao de imagens de produtos.
-- Aplicar em projetos existentes. Nao apaga dados.

INSERT INTO product_images(category, title, name, image_url, description, plan_type)
SELECT *
FROM (VALUES
  ('Alcoólicos', 'Cerveja long neck', 'Cerveja long neck gelada', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para cervejas long neck e garrafas.', 'free'),
  ('Alcoólicos', 'Cerveja lata', 'Cerveja lata na praia', 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para cervejas em lata.', 'free'),
  ('Alcoólicos', 'Drink tropical', 'Drink tropical colorido', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para drinks tropicais.', 'free'),
  ('Alcoólicos', 'Caipirinha', 'Caipirinha com limao', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para caipirinha e drinks com gelo.', 'free'),
  ('Bebidas', 'Agua mineral', 'Agua mineral gelada', 'https://images.unsplash.com/photo-1564419320461-6870880221ad?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para agua mineral.', 'free'),
  ('Bebidas', 'Refrigerante', 'Refrigerante gelado', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para refrigerantes.', 'free'),
  ('Não Alcoólicos', 'Suco natural', 'Suco natural de frutas', 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para sucos naturais.', 'free'),
  ('Não Alcoólicos', 'Agua de coco', 'Agua de coco', 'https://images.unsplash.com/photo-1588413335653-34b770bca7c1?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para agua de coco.', 'free'),
  ('Petiscos', 'Batata frita', 'Porcao de batata frita', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para batata frita e porcoes.', 'free'),
  ('Petiscos', 'Camarao', 'Porcao de camarao', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para camarao e frutos do mar.', 'free'),
  ('Petiscos', 'Isca de peixe', 'Isca de peixe com molho', 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para iscas e peixes fritos.', 'free'),
  ('Comidas', 'Hamburguer', 'Hamburguer artesanal', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para hamburguer e lanches.', 'free'),
  ('Comidas', 'Sanduiche', 'Sanduiche natural', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para sanduiches.', 'free'),
  ('Sobremesas', 'Sorvete', 'Sorvete de verao', 'https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para sorvetes e sobremesas.', 'free'),
  ('Combos', 'Combo praia', 'Combo de bebidas e petiscos', 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80', 'Imagem padrao para combos.', 'free')
) AS seed(category, title, name, image_url, description, plan_type)
WHERE NOT EXISTS (
  SELECT 1
  FROM product_images existing
  WHERE existing.category = seed.category
    AND existing.name = seed.name
);

ANALYZE product_images;
