import { clampDeliveredQuantity, latestDeliveredQuantities } from './partial-delivery';

describe('partial delivery', () => {
  it('limits a delivered amount to the ordered quantity', () => {
    expect(clampDeliveredQuantity(8, 3)).toBe(3);
    expect(clampDeliveredQuantity(-2, 3)).toBe(0);
  });

  it('uses the most recent quantity recorded for each item', () => {
    expect(latestDeliveredQuantities([
      { metadata: { order_item_id: 'item-a', delivered_quantity: 1 } },
      { metadata: { order_item_id: 'item-b', delivered_quantity: 2 } },
      { metadata: { order_item_id: 'item-a', delivered_quantity: 3 } },
    ])).toEqual({ 'item-a': 3, 'item-b': 2 });
  });
});

