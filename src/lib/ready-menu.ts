export const READY_MENU_TAG = 'ready-menu';
const PRICE_PREFIX = 'menu-price:';

export function parseReadyMenuPrice(tags: unknown): number | null {
  if (!Array.isArray(tags) || !tags.map(String).includes(READY_MENU_TAG)) return null;
  const tag = tags.map(String).find(value => value.startsWith(PRICE_PREFIX));
  if (!tag) return null;
  const price = Number(tag.slice(PRICE_PREFIX.length));
  return Number.isFinite(price) && price > 0 ? Number(price.toFixed(2)) : null;
}

export function configureReadyMenuTags(tags: unknown, enabled: boolean, price?: number | null) {
  const clean = (Array.isArray(tags) ? tags : []).map(String)
    .filter(tag => tag !== READY_MENU_TAG && !tag.startsWith(PRICE_PREFIX));
  if (!enabled) return Array.from(new Set(clean));
  const normalizedPrice = Number(price);
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw new Error('Informe um preço válido para o cardápio pronto.');
  }
  return Array.from(new Set([...clean, READY_MENU_TAG, `${PRICE_PREFIX}${normalizedPrice.toFixed(2)}`]));
}
