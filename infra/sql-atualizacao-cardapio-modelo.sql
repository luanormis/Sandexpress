-- Cardapio modelo para vendedores ja existentes em producao.
-- Rode este arquivo depois do schema principal e do SQL de imagens padrao.
-- Ele so cria itens para vendors que ainda nao possuem nenhum produto.

insert into products (
  tenant_id,
  vendor_id,
  name,
  category,
  description,
  price,
  image_url,
  active
)
select
  v.tenant_id,
  v.id,
  item.name,
  item.category,
  item.description,
  item.price,
  item.image_url,
  true
from vendors v
cross join (
  values
    ('Heineken 350 ml', 'Alcoolicos', 'Cerveja gelada pronta para servir.', 12.00, 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?auto=format&fit=crop&w=900&q=80'),
    ('Cerveja long neck', 'Alcoolicos', 'Long neck gelada.', 14.00, 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80'),
    ('Caipirinha', 'Alcoolicos', 'Drink classico com limao e gelo.', 24.00, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80'),
    ('Refrigerante lata', 'Bebidas', 'Refrigerante gelado.', 8.00, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80'),
    ('Suco natural', 'Nao Alcoolicos', 'Suco natural de frutas.', 12.00, 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=900&q=80'),
    ('Batata frita', 'Petiscos', 'Porcao crocante para compartilhar.', 32.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80'),
    ('Porcao de camarao', 'Petiscos', 'Porcao de camarao para praia.', 58.00, 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80'),
    ('Hamburguer artesanal', 'Comidas', 'Hamburguer completo.', 34.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80')
) as item(name, category, description, price, image_url)
where not exists (
  select 1
  from products p
  where p.vendor_id = v.id
);
