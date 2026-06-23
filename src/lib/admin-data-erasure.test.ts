import {
  buildCustomerDatabaseDeletePlan,
  buildKioskStoragePrefixes,
} from './admin-data-erasure';

describe('admin data erasure planning', () => {
  it('deletes customer order dependencies before customer rows', () => {
    expect(buildCustomerDatabaseDeletePlan()).toEqual([
      'account_adjustments',
      'order_items',
      'orders',
      'customers',
    ]);
  });

  it('targets all storage prefixes that can hold kiosk data', () => {
    expect(buildKioskStoragePrefixes('vendor-123')).toEqual([
      { bucket: 'order-archives', prefix: 'vendor-123/' },
      { bucket: 'kiosk-assets', prefix: 'logos/vendor-123/' },
      { bucket: 'product-images', prefix: 'products/vendor-123/' },
      { bucket: 'product-images', prefix: 'vendor-123/' },
      { bucket: 'product-images', prefix: 'logos/vendor-123/' },
    ]);
  });
});
