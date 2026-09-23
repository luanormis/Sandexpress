import { isBeverageCategory } from './printer-routing';

export type ProductOptionGroup = { name: string; options: string[] };
export type OptionProduct = { category?: string | null; option_group_name?: string | null; option_values?: string[] | null };

export const NO_CUSTOMIZATION = 'Sem alteração';

const BEVERAGE_QUICK_OPTIONS: ProductOptionGroup[] = [
  { name: 'Gelo', options: [NO_CUSTOMIZATION, 'Com gelo'] },
  { name: 'Açúcar', options: [NO_CUSTOMIZATION, 'Sem açúcar'] },
  { name: 'Limão', options: [NO_CUSTOMIZATION, 'Com limão'] },
];

function storedOptionGroups(product: OptionProduct): ProductOptionGroup[] {
  const values = Array.isArray(product.option_values) ? product.option_values.map(String).filter(Boolean) : [];
  if (values.length === 0) return [];
  if (!values.some(value => value.includes('::'))) return [{ name: product.option_group_name || 'Opção', options: values }];
  const groups = new Map<string, string[]>();
  values.forEach(value => {
    const [rawName, ...parts] = value.split('::');
    const name = rawName.trim() || 'Opção';
    const option = parts.join('::').trim();
    if (option) groups.set(name, [...(groups.get(name) || []), option]);
  });
  return Array.from(groups, ([name, options]) => ({ name, options: Array.from(new Set(options)) }));
}

export function getOrderOptionGroups(product: OptionProduct): ProductOptionGroup[] {
  const groups = storedOptionGroups(product);
  if (!isBeverageCategory(product.category)) return groups;
  const existing = new Set(groups.map(group => group.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  return [...groups, ...BEVERAGE_QUICK_OPTIONS.filter(group => !existing.has(group.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))];
}

export function selectedOrderOptions(product: OptionProduct, selections: Record<string, string>, productId: string) {
  return getOrderOptionGroups(product)
    .map(group => ({ name: group.name, value: selections[`${productId}:${group.name}`] || group.options[0] }))
    .filter(choice => choice.value && choice.value !== NO_CUSTOMIZATION);
}

export function selectedOrderOptionLabel(product: OptionProduct, selections: Record<string, string>, productId: string) {
  return selectedOrderOptions(product, selections, productId).map(choice => `${choice.name}: ${choice.value}`).join(' | ');
}
