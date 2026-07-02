export type ProductStockInput = {
  stock_tracking_enabled?: boolean | null;
  physical_stock_quantity?: number | null;
  beach_stock_quantity?: number | null;
  stock_quantity?: number | null;
  blocked_by_stock?: boolean | null;
};

export type ProductStockStatus = {
  label: string;
  tone: 'ok' | 'blocked' | 'neutral';
  quantityLabel: string;
};

export type ProductStockWrite = {
  stock_tracking_enabled: boolean;
  stock_quantity: number | null;
  physical_stock_quantity: number;
  beach_stock_quantity: number;
  blocked_by_stock: boolean;
};

export const PRODUCT_STOCK_FIELDS = [
  'stock_tracking_enabled',
  'stock_quantity',
  'physical_stock_quantity',
  'beach_stock_quantity',
  'blocked_by_stock',
] as const;

export function getProductStockStatus(product: ProductStockInput): ProductStockStatus {
  if (!product.stock_tracking_enabled) {
    return {
      label: 'Sem controle',
      tone: 'neutral',
      quantityLabel: '-',
    };
  }

  const quantity = toDisplayQuantity(product.beach_stock_quantity ?? product.stock_quantity);
  const blocked = Boolean(product.blocked_by_stock) || quantity <= 0;

  return {
    label: blocked ? 'Sem estoque' : 'Em estoque',
    tone: blocked ? 'blocked' : 'ok',
    quantityLabel: `${quantity} un.`,
  };
}

function toDisplayQuantity(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

export function normalizeProductStockForWrite(product: ProductStockInput): ProductStockWrite {
  const stockTrackingEnabled = Boolean(product.stock_tracking_enabled);
  if (!stockTrackingEnabled) {
    return {
      stock_tracking_enabled: false,
      stock_quantity: null,
      physical_stock_quantity: 0,
      beach_stock_quantity: 0,
      blocked_by_stock: false,
    };
  }

  const beachStock = toDisplayQuantity(product.beach_stock_quantity ?? product.stock_quantity);

  return {
    stock_tracking_enabled: true,
    stock_quantity: beachStock,
    physical_stock_quantity: toDisplayQuantity(product.physical_stock_quantity),
    beach_stock_quantity: beachStock,
    blocked_by_stock: Boolean(product.blocked_by_stock) || beachStock <= 0,
  };
}

export function removeProductStockFields<T extends Record<string, unknown>>(payload: T) {
  const next = { ...payload };
  for (const field of PRODUCT_STOCK_FIELDS) {
    delete next[field];
  }
  return next;
}

export function isMissingProductStockColumnError(error: any) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return ['42703', 'PGRST204'].includes(error?.code || '') && PRODUCT_STOCK_FIELDS.some((field) => message.includes(field));
}
