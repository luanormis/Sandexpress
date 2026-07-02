import type { ProductStockInput } from './product-stock';

export function isProductVisibleToCustomer(product: ProductStockInput) {
  if (!product.stock_tracking_enabled) return true;
  const availableStock = Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0);
  return !product.blocked_by_stock && Number.isFinite(availableStock) && availableStock > 0;
}
