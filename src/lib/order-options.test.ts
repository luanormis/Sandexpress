import { getOrderOptionGroups, selectedOrderOptionLabel } from './order-options';

describe('order options', () => {
  it('keeps account preferences out of beverage items', () => {
    const groups = getOrderOptionGroups({ category: 'Bebidas' });
    expect(groups).toEqual([]);
  });

  it('does not add beverage choices to food', () => {
    expect(getOrderOptionGroups({ category: 'Porções' })).toEqual([]);
  });

  it('omits unchanged defaults and keeps selected observations', () => {
    const product = { category: 'Sucos', option_values: ['Sabor::Laranja', 'Sabor::Uva', 'Gelo::Com gelo', 'Açúcar::Sem açúcar', 'Limão::Com limão'] };
    expect(selectedOrderOptionLabel(product, { 'p1:Sabor': 'Uva', 'p1:Gelo': 'Com gelo', 'p1:Açúcar': 'Sem açúcar' }, 'p1')).toBe('Sabor: Uva');
  });
});
