import { buildDefaultMenuRows } from './default-menu-products';

describe('default menu products', () => {
  it('builds real product rows with inventory columns', () => {
    const [product] = buildDefaultMenuRows('tenant-123', 'vendor-123');

    expect(product).toEqual(expect.objectContaining({
      tenant_id: 'tenant-123',
      vendor_id: 'vendor-123',
      stock_tracking_enabled: false,
      stock_quantity: null,
      physical_stock_quantity: 0,
      beach_stock_quantity: 0,
      blocked_by_stock: false,
    }));
  });
});
