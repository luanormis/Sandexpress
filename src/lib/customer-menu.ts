export const CUSTOMER_MENU_CATEGORIES = [
  'Bebidas',
  'Drinks',
  'Doses',
  'Porções',
  'Pastéis',
  'Cervejas',
] as const;

export type CustomerMenuCategory = (typeof CUSTOMER_MENU_CATEGORIES)[number];

type MenuProductLike = {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  option_group_name?: string | null;
  option_values?: string[] | null;
};

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function productSearchText(product: MenuProductLike) {
  return `${normalizeText(product.category)} ${normalizeText(product.subcategory)} ${normalizeText(product.name)} ${normalizeText(product.option_group_name)} ${normalizeText((product.option_values || []).join(' '))}`;
}

export function productMatchesCustomerCategory(product: MenuProductLike, category: CustomerMenuCategory) {
  const text = productSearchText(product);
  switch (category) {
    case 'Bebidas':
      return /bebida|nao alcoolico|agua|agua de coco|refrigerante|suco|energetico|tonica|mate/.test(text);
    case 'Drinks':
      return /drink|caipirinha|caipiroska|coquetel|gin|mojito|aperol|spritz|batida/.test(text);
    case 'Doses':
      return /dose|shot|whisky|vodka|cachaca|tequila|rum|licor/.test(text);
    case 'Porções':
      return /porcao|porcoes|petisco|batata|isca|camarao|calabresa|mandioca|frango|fritas/.test(text);
    case 'Pastéis':
      return /pastel|pasteis/.test(text);
    case 'Cervejas':
      return /cerveja|cervejas|chopp|beer|amstel|heineken|brahma|skol|stella|original|corona/.test(text);
    default:
      return false;
  }
}

export function filterCustomerMenuProducts<T extends MenuProductLike>(products: T[], category: CustomerMenuCategory) {
  return products.filter((product) => productMatchesCustomerCategory(product, category));
}

export function getCustomerMenuThumbnail(url?: string | null) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('unsplash.com')) {
      parsed.searchParams.set('w', '128');
      parsed.searchParams.set('q', '72');
      parsed.searchParams.set('fit', 'crop');
      return parsed.toString();
    }
  } catch {
    return url;
  }
  return url;
}
