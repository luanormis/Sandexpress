import { getOrderOptionGroups, selectedOrderOptionLabel } from './order-options';

describe('order options', () => {
  it('adds the standard quick choices to beverages', () => {
    const groups = getOrderOptionGroups({ category: 'Bebidas' });
    expect(groups.map(group => group.name)).toEqual(['Gelo', 'Açúcar', 'Limão']);
  });

  it('does not add beverage choices to food', () => {
    expect(getOrderOptionGroups({ category: 'Porções' })).toEqual([]);
  });

  it('omits unchanged defaults and keeps selected observations', () => {
    const product = { category: 'Sucos' };
    expect(selectedOrderOptionLabel(product, { 'p1:Gelo': 'Com gelo', 'p1:Açúcar': 'Sem açúcar' }, 'p1')).toBe('Gelo: Com gelo | Açúcar: Sem açúcar');
  });
});
