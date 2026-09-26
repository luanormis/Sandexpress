import { customerOrderView } from './customer-order-view';

it('preserves every API item and delivery quantity when loading the account', () => {
  const items = [
    { id: 'a', name: 'Água', quantity: 2, unit_price: 5, subtotal: 10, delivered_quantity: 1 },
    { id: 'b', name: 'Porção', quantity: 1, unit_price: 30, subtotal: 30, delivered_quantity: 0 },
  ];
  const result = customerOrderView({ id: 'request', items, total: 40 });
  expect(result.items).toEqual(items);
  expect(result.items.reduce((sum, item) => sum + item.subtotal, 0)).toBe(result.total);
});
