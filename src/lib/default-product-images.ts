export type DefaultProductImage = {
  id: string;
  category: string;
  title: string;
  name: string;
  image_url: string;
  description: string;
  plan_type: 'free' | 'plus';
};

export const DEFAULT_PRODUCT_IMAGES: DefaultProductImage[] = [
  {
    id: 'default-beer-long-neck',
    category: 'Alcoolicos',
    title: 'Cerveja long neck',
    name: 'Cerveja long neck gelada',
    image_url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80',
    description: 'Imagem padrao para cervejas long neck e garrafas.',
    plan_type: 'free',
  },
  {
    id: 'default-beer-can',
    category: 'Alcoolicos',
    title: 'Cerveja lata',
    name: 'Cerveja lata gelada',
    image_url: 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?auto=format&fit=crop&w=900&q=80',
    description: 'Imagem padrao para cervejas em lata.',
    plan_type: 'free',
  },
  {
    id: 'default-tropical-drink',
    category: 'Alcoolicos',
    title: 'Drink tropical',
    name: 'Drink tropical colorido',
    image_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80',
    description: 'Imagem padrao para drinks tropicais.',
    plan_type: 'free',
  },
  {
    id: 'default-soda',
    category: 'Bebidas',
    title: 'Refrigerante',
    name: 'Refrigerante gelado',
    image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80',
    description: 'Imagem padrao para refrigerantes.',
    plan_type: 'free',
  },
  {
    id: 'default-juice',
    category: 'Nao Alcoolicos',
    title: 'Suco natural',
    name: 'Suco natural de frutas',
    image_url: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=900&q=80',
    description: 'Imagem padrao para sucos naturais.',
    plan_type: 'free',
  },
  {
    id: 'default-fries',
    category: 'Petiscos',
    title: 'Batata frita',
    name: 'Porcao de batata frita',
    image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80',
    description: 'Imagem padrao para batata frita e porcoes.',
    plan_type: 'free',
  },
  {
    id: 'default-shrimp',
    category: 'Petiscos',
    title: 'Camarao',
    name: 'Porcao de camarao',
    image_url: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80',
    description: 'Imagem padrao para camarao e frutos do mar.',
    plan_type: 'free',
  },
  {
    id: 'default-burger',
    category: 'Comidas',
    title: 'Hamburguer',
    name: 'Hamburguer artesanal',
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
    description: 'Imagem padrao para hamburguer e lanches.',
    plan_type: 'free',
  },
];

export function categoryKey(category?: string | null) {
  const key = String(category || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (key.includes('noalco') || key.includes('naoalco')) return 'naoalcoolicos';
  if (key.includes('alco')) return 'alcoolicos';
  return key;
}

export function getDefaultProductImages(category?: string | null, planType = 'free') {
  return DEFAULT_PRODUCT_IMAGES.filter((image) => {
    if (category && categoryKey(image.category) !== categoryKey(category)) return false;
    if (planType === 'free' && image.plan_type !== 'free') return false;
    return true;
  });
}
