import { isProductVisibleToCustomer } from './public-product-visibility';

describe('public product visibility', () => {
  it('hides stock-controlled products when active beach stock is zero', () => {
    expect(isProductVisibleToCustomer({
      stock_tracking_enabled: true,
      beach_stock_quantity: 0,
      stock_quantity: 0,
      blocked_by_stock: false,
    })).toBe(false);
  });

  it('keeps stock-controlled products visible when active beach stock is positive', () => {
    expect(isProductVisibleToCustomer({
      stock_tracking_enabled: true,
      beach_stock_quantity: 3,
      stock_quantity: 0,
      blocked_by_stock: false,
    })).toBe(true);
  });

  it('keeps products without stock control visible even with no stock quantity', () => {
    expect(isProductVisibleToCustomer({
      stock_tracking_enabled: false,
      stock_quantity: null,
      blocked_by_stock: false,
    })).toBe(true);
  });
});
