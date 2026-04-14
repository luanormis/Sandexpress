-- Seed data para product_images (Galeria padrão de imagens)
-- Imagens gratuitas e premium para cada categoria

-- Bebidas (Free)
INSERT INTO public.product_images (category, name, image_url, description, plan_type)
VALUES
  ('Bebidas', 'Refrigerante Vidro', 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop', 'Refrigerante em garrafa de vidro gelada', 'free'),
  ('Bebidas', 'Suco Natural', 'https://images.unsplash.com/photo-1600271886742-f049cd1f3033?w=400&h=300&fit=crop', 'Suco natural de frutas frescas', 'free'),
  ('Bebidas', 'Agua com Gelo', 'https://images.unsplash.com/photo-1535950596d3d6b935c1a13d5e64869f2c44a851?w=400&h=300&fit=crop', 'Água gelada com gelo', 'free'),
  ('Bebidas', 'Chopp', 'https://images.unsplash.com/photo-1608656526686-d0bf2a8acfb6?w=400&h=300&fit=crop', 'Chopp gelado servido em copo', 'free'),
  ('Bebidas', 'Cappuccino', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop', 'Cappuccino com espuma de leite', 'free'),
  ('Bebidas', 'Coquetel', 'https://images.unsplash.com/photo-1609331368753-ffc0dd57f055?w=400&h=300&fit=crop', 'Coquetel tropical refrescante', 'plus'),
  ('Bebidas', 'Milkshake', 'https://images.unsplash.com/photo-1555014393-54563dc25268?w=400&h=300&fit=crop', 'Milkshake espesso e cremoso', 'plus');

-- Petiscos (Free)
INSERT INTO public.product_images (category, name, image_url, description, plan_type)
VALUES
  ('Petiscos', 'Batata Frita', 'https://images.unsplash.com/photo-1599599810694-4c73bbd2eefd?w=400&h=300&fit=crop', 'Batata frita crocante e quente', 'free'),
  ('Petiscos', 'Bolinhas de Queijo', 'https://images.unsplash.com/photo-1599599810942-d3ee11effa11?w=400&h=300&fit=crop', 'Bolinhas de queijo empanadas', 'free'),
  ('Petiscos', 'Frango Frito', 'https://images.unsplash.com/photo-1608737033454-2d04aad213f8?w=400&h=300&fit=crop', 'Frango frito dourado e crocante', 'free'),
  ('Petiscos', 'Camarao a Milanesa', 'https://images.unsplash.com/photo-1599053566950-e64ffd069615?w=400&h=300&fit=crop', 'Camarão à milanesa crocante', 'free'),
  ('Petiscos', 'Coxinha', 'https://images.unsplash.com/photo-1599599810694-4c73bbd2eefd?w=400&h=300&fit=crop', 'Coxinha de frango quente e suculenta', 'free'),
  ('Petiscos', 'Bolinha de Carne', 'https://images.unsplash.com/photo-1555939594-58d7cb561911?w=400&h=300&fit=crop', 'Bolinha de carne moída empanada', 'plus'),
  ('Petiscos', 'Aipe Queijo', 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop', 'Aipim frito com queijo derretido', 'plus');

-- Pratos Principais (Free)
INSERT INTO public.product_images (category, name, image_url, description, plan_type)
VALUES
  ('Pratos Principais', 'Arroz com Frango', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop', 'Arroz solto com frango suculento', 'free'),
  ('Pratos Principais', 'Estrogonofe de Frango', 'https://images.unsplash.com/photo-1555939594-58d7cb561911?w=400&h=300&fit=crop', 'Estrogonofe cremoso e saboroso', 'free'),
  ('Pratos Principais', 'Picanha Grelhada', 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=300&fit=crop', 'Picanha grelhada no ponto', 'free'),
  ('Pratos Principais', 'Peixe Frito', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop', 'Peixe frito inteiro e crocante', 'free'),
  ('Pratos Principais', 'Moqueca de Peixe', 'https://images.unsplash.com/photo-1626082001525-e85eca22f77b?w=400&h=300&fit=crop', 'Moqueca baiana cremosa e saudável', 'free'),
  ('Pratos Principais', 'Filé Mignon', 'https://images.unsplash.com/photo-1555939594-58d7cb561911?w=400&h=300&fit=crop', 'Filé mignon grelhado ao ponto', 'plus'),
  ('Pratos Principais', 'Frango ao Molho Pardo', 'https://images.unsplash.com/photo-1626082901512-aa4fff8e6f19?w=400&h=300&fit=crop', 'Frango ao molho pardo português', 'plus');

-- Sobremesas (Free)
INSERT INTO public.product_images (category, name, image_url, description, plan_type)
VALUES
  ('Sobremesas', 'Pudim', 'https://images.unsplash.com/photo-1488477181946-6558a6b037e3?w=400&h=300&fit=crop', 'Pudim cremoso com calda de caramelo', 'free'),
  ('Sobremesas', 'Brigadeiro', 'https://images.unsplash.com/photo-1586985289688-ca3242da3c3a?w=400&h=300&fit=crop', 'Brigadeiro derretendo na boca', 'free'),
  ('Sobremesas', 'Pavê', 'https://images.unsplash.com/photo-1488477181946-6558a6b037e3?w=400&h=300&fit=crop', 'Pavê tradicional refrescante', 'free'),
  ('Sobremesas', 'Sorvete', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop', 'Sorvete cremoso em várias sabores', 'free'),
  ('Sobremesas', 'Bolo de Chocolate', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop', 'Bolo de chocolate molhadinha suculento', 'free'),
  ('Sobremesas', 'Tiramisu', 'https://images.unsplash.com/photo-1571115764595-644a1f56b55c?w=400&h=300&fit=crop', 'Tiramisu italiano autêntico', 'plus'),
  ('Sobremesas', 'Mousse de Maracuja', 'https://images.unsplash.com/photo-1488477181946-6558a6b037e3?w=400&h=300&fit=crop', 'Mousse leve e refrescante', 'plus');

-- Combos (Free)
INSERT INTO public.product_images (category, name, image_url, description, plan_type)
VALUES
  ('Combos', 'Combo Frango Frito', 'https://images.unsplash.com/photo-1555939594-58d7cb561911?w=400&h=300&fit=crop', 'Frango, batata e bebida', 'free'),
  ('Combos', 'Combo Executivo', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop', 'Prato, acompanhamento e bebida', 'free'),
  ('Combos', 'Combo Petiscos', 'https://images.unsplash.com/photo-1599599810694-4c73bbd2eefd?w=400&h=300&fit=crop', 'Variedade de petiscos e bebida', 'free'),
  ('Combos', 'Combo Familia', 'https://images.unsplash.com/photo-1555939594-58d7cb561911?w=400&h=300&fit=crop', 'Prato principal doble com acompanhamentos', 'plus'),
  ('Combos', 'Combo Premium', 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=300&fit=crop', 'Carnes nobres com acompanhamentos especiais', 'plus');
