-- Remove do cardápio público apenas os 12 produtos de demonstração gerados automaticamente.
-- Preserva os registros para manter o histórico financeiro e de pedidos íntegro.
begin;

with mock_signatures(name, image_url) as (
  values
    ('Heineken 350 ml', 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?auto=format&fit=crop&w=900&q=80'),
    ('Cerveja long neck', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80'),
    ('Caipirinha', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80'),
    ('Refrigerante lata', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80'),
    ('Suco natural', 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=900&q=80'),
    ('Agua mineral', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80'),
    ('Batata frita', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80'),
    ('Porcao de camarao', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80'),
    ('Isca de peixe', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80'),
    ('Mandioca frita', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80'),
    ('Hamburguer artesanal', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80'),
    ('Pastel de queijo', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80')
)
update public.products p
set active = false,
    updated_at = now()
from mock_signatures m
where p.name = m.name
  and p.image_url = m.image_url
  and coalesce(p.is_default_image, false) = true
  and coalesce(p.active, true) = true;

commit;

-- Deve retornar zero; se houver linhas, elas não correspondem integralmente à assinatura do mock.
select id, vendor_id, name
from public.products
where active = true
  and coalesce(is_default_image, false) = true
  and name in (
    'Heineken 350 ml', 'Cerveja long neck', 'Caipirinha', 'Refrigerante lata',
    'Suco natural', 'Agua mineral', 'Batata frita', 'Porcao de camarao',
    'Isca de peixe', 'Mandioca frita', 'Hamburguer artesanal', 'Pastel de queijo'
  );
