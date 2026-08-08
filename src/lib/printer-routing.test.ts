import { isBeverageCategory, normalizePrinters, routeOrderItems } from './printer-routing';

describe('printer routing', () => {
  it('recognizes beverage categories without depending on accents', () => {
    expect(isBeverageCategory('Bebidas não alcoólicas')).toBe(true);
    expect(isBeverageCategory('Porções e petiscos')).toBe(false);
  });

  it('keeps the cashier copy consolidated', () => {
    const items = [{ q: 1, n: 'Água', category: 'Bebidas' }, { q: 2, n: 'Pastel', category: 'Alimentos' }];
    const routed = routeOrderItems(items);
    expect(routed.beverage).toEqual([items[0]]);
    expect(routed.food).toEqual([items[1]]);
    expect(routed.cashier).toEqual(items);
  });

  it('rejects malformed persisted configuration', () => {
    expect(normalizePrinters([{ id: '1', name: 'Cozinha', route: 'food' }, { name: '', route: 'cashier' }])).toHaveLength(1);
  });
});
