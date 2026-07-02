import { REQUIRED_SCHEMA_CHECKS } from './readiness-schema';

describe('required schema checks', () => {
  it('includes inventory columns required by the kiosk stock panel', () => {
    expect(REQUIRED_SCHEMA_CHECKS).toEqual(
      expect.arrayContaining([
        { table: 'products', column: 'stock_tracking_enabled' },
        { table: 'products', column: 'physical_stock_quantity' },
        { table: 'products', column: 'beach_stock_quantity' },
        { table: 'products', column: 'stock_quantity' },
        { table: 'products', column: 'blocked_by_stock' },
      ])
    );
  });
});
