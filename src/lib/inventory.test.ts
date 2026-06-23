import {
  closeBeachStockToPhysical,
  openBeachStockFromPhysical,
  shouldTrackStock,
} from './inventory';

describe('inventory helpers', () => {
  it('moves physical stock to active beach stock at opening', () => {
    expect(openBeachStockFromPhysical({ physicalStock: 20, beachStock: 0, openingQuantity: 8 })).toEqual({
      physicalStock: 12,
      beachStock: 8,
      blockedByStock: false,
    });
  });

  it('never opens more beach stock than available physical stock', () => {
    expect(openBeachStockFromPhysical({ physicalStock: 5, beachStock: 0, openingQuantity: 9 })).toEqual({
      physicalStock: 0,
      beachStock: 5,
      blockedByStock: false,
    });
  });

  it('returns beach leftovers to physical stock at closing', () => {
    expect(closeBeachStockToPhysical({ physicalStock: 12, beachStock: 3 })).toEqual({
      physicalStock: 15,
      beachStock: 0,
      blockedByStock: true,
    });
  });

  it('only tracks stock when the product flag is enabled', () => {
    expect(shouldTrackStock(true)).toBe(true);
    expect(shouldTrackStock(false)).toBe(false);
    expect(shouldTrackStock(null)).toBe(false);
  });
});
