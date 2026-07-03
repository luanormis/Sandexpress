import { getProductStockStatus, isMissingProductStockColumnError, normalizeProductStockForWrite, removeProductStockFields } from './product-stock';

describe('product stock status', () => {
  it('marks products without stock tracking as not controlled', () => {
    expect(getProductStockStatus({ stock_tracking_enabled: false })).toEqual({
      label: 'Sem controle',
      tone: 'neutral',
      quantityLabel: '-',
    });
  });

  it('uses beach stock as the active kiosk quantity', () => {
    expect(getProductStockStatus({
      stock_tracking_enabled: true,
      beach_stock_quantity: 8,
      stock_quantity: 5,
      blocked_by_stock: false,
    })).toEqual({
      label: 'Em estoque',
      tone: 'ok',
      quantityLabel: '8 un.',
    });
  });

  it('marks controlled products with zero stock as blocked', () => {
    expect(getProductStockStatus({
      stock_tracking_enabled: true,
      beach_stock_quantity: 0,
      stock_quantity: 0,
      blocked_by_stock: true,
    })).toEqual({
      label: 'Sem estoque',
      tone: 'blocked',
      quantityLabel: '0 un.',
    });
  });
});

describe('product stock schema compatibility', () => {
  it('detects missing stock column errors from Supabase', () => {
    expect(isMissingProductStockColumnError({
      code: 'PGRST204',
      message: "Could not find the 'physical_stock_quantity' column of 'products'",
    })).toBe(true);
  });

  it('removes stock fields from retry payloads', () => {
    expect(removeProductStockFields({
      name: 'Agua',
      stock_tracking_enabled: true,
      physical_stock_quantity: 10,
      beach_stock_quantity: 4,
      stock_quantity: 4,
      blocked_by_stock: false,
    })).toEqual({ name: 'Agua' });
  });
});

describe('product stock write normalization', () => {
  it('blocks stock-controlled products created without active beach stock', () => {
    expect(normalizeProductStockForWrite({
      stock_tracking_enabled: true,
      stock_quantity: null,
      beach_stock_quantity: 0,
      blocked_by_stock: false,
    })).toEqual({
      stock_tracking_enabled: true,
      stock_quantity: 0,
      physical_stock_quantity: 0,
      beach_stock_quantity: 0,
      blocked_by_stock: true,
    });
  });

  it('clears stock fields when tracking is disabled', () => {
    expect(normalizeProductStockForWrite({
      stock_tracking_enabled: false,
      stock_quantity: 12,
      physical_stock_quantity: 30,
      beach_stock_quantity: 12,
      blocked_by_stock: true,
    })).toEqual({
      stock_tracking_enabled: false,
      stock_quantity: null,
      physical_stock_quantity: 0,
      beach_stock_quantity: 0,
      blocked_by_stock: false,
    });
  });

  it('unblocks products when active beach stock is restored', () => {
    expect(normalizeProductStockForWrite({
      stock_tracking_enabled: true,
      physical_stock_quantity: 30,
      beach_stock_quantity: 5,
      blocked_by_stock: true,
    })).toEqual({
      stock_tracking_enabled: true,
      stock_quantity: 5,
      physical_stock_quantity: 30,
      beach_stock_quantity: 5,
      blocked_by_stock: false,
    });
  });
});
