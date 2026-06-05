-- SandExpress - inserir usuario/quiosque teste
-- Use se o banco ja foi criado e voce quer apenas adicionar um login de teste.
--
-- Area do quiosque: /vendor/login
-- Usuario: teste
-- Senha: teste01

BEGIN;

INSERT INTO tenants (
  id, name, status, city, state, beach_name, primary_color
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Quiosque Teste',
  'active',
  'Cidade Teste',
  'SP',
  'Praia Teste',
  '#ff7a1a'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  beach_name = EXCLUDED.beach_name,
  primary_color = EXCLUDED.primary_color;

INSERT INTO vendors (
  id,
  tenant_id,
  name,
  document_login,
  address,
  city,
  state,
  beach_name,
  owner_name,
  owner_phone,
  owner_email,
  primary_color,
  secondary_color,
  password_hash,
  password_needs_reset,
  subscription_status,
  plan_type,
  max_umbrellas,
  pix_enabled,
  pix_key,
  pix_account_name,
  is_active
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Quiosque Teste',
  'teste',
  'Praia Teste',
  'Cidade Teste',
  'SP',
  'Praia Teste',
  'Operador Teste',
  '11999999999',
  'teste@sandexpress.local',
  '#ff7a1a',
  '#0f3d4f',
  'sandexpress_teste_2026:595ed58ccd5a1a008d551cd9c14e3063b25e512b82b70df4d8dd6d83cf6d5979f98ea4bde2e658b8a5ddd517c77f0476658cd2f0f8ba75d645ffb8ede613b6c6',
  FALSE,
  'active',
  'monthly',
  50,
  TRUE,
  '11999999999',
  'Quiosque Teste',
  TRUE
)
ON CONFLICT (document_login) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  password_needs_reset = FALSE,
  subscription_status = 'active',
  plan_type = 'monthly',
  is_active = TRUE;

INSERT INTO vendor_plans (
  vendor_id, plan_type, can_upload_images, max_custom_images, custom_images_used
) VALUES (
  '20000000-0000-0000-0000-000000000001', 'monthly', TRUE, 100, 0
)
ON CONFLICT (vendor_id) DO UPDATE SET
  plan_type = EXCLUDED.plan_type,
  can_upload_images = EXCLUDED.can_upload_images,
  max_custom_images = EXCLUDED.max_custom_images;

INSERT INTO umbrellas (
  tenant_id, vendor_id, number, label, active, is_occupied, map_x, map_y
)
SELECT
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  gs,
  'Guarda-sol ' || gs,
  TRUE,
  FALSE,
  8 + (((gs - 1) % 10) * 9),
  10 + (FLOOR((gs - 1) / 10) * 14)
FROM generate_series(1, 50) AS gs
ON CONFLICT (vendor_id, number) DO UPDATE SET
  label = EXCLUDED.label,
  active = TRUE;

DELETE FROM products
WHERE vendor_id = '20000000-0000-0000-0000-000000000001';

INSERT INTO products (
  tenant_id, vendor_id, category, name, price, active, sort_order, stock_quantity, blocked_by_stock
) VALUES
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Petiscos e Porcoes','Porcao de Peixe Frito',75,TRUE,10,100,FALSE),
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Petiscos e Porcoes','Porcao de Camarao Frito',90,TRUE,20,100,FALSE),
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Petiscos e Porcoes','Porcao de Batata Frita',35,TRUE,30,100,FALSE),
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Pasteis','Pastel de Camarao',14,TRUE,40,100,FALSE),
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Pasteis','Pastel de Carne',12,TRUE,50,100,FALSE),
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Drinks, Caipirinhas e Batidas','Caipirinha de Limao',22,TRUE,60,100,FALSE),
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Cervejas em Lata','Cerveja Heineken / Corona / Stella Artois',12,TRUE,70,100,FALSE),
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Bebidas Nao Alcoolicas','Agua Mineral sem Gas',5,TRUE,80,100,FALSE),
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Bebidas Nao Alcoolicas','Refrigerante Lata',7,TRUE,90,100,FALSE);

COMMIT;
