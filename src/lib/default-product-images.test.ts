import { categoryKey, getDefaultProductImages } from './default-product-images';

describe('default product images', () => {
  it('matches alcoholic categories across accented and legacy spellings', () => {
    expect(categoryKey('Alcoólicos')).toBe('alcoolicos');
    expect(categoryKey('AlcoÃ³licos')).toBe('alcoolicos');
    expect(getDefaultProductImages('Alcoólicos')).toHaveLength(3);
    expect(getDefaultProductImages('Alcoolicos')).toHaveLength(3);
  });

  it('matches non alcoholic categories across accented and legacy spellings', () => {
    expect(categoryKey('Não Alcoólicos')).toBe('naoalcoolicos');
    expect(categoryKey('NÃ£o AlcoÃ³licos')).toBe('naoalcoolicos');
    expect(getDefaultProductImages('Nao Alcoolicos')).toHaveLength(1);
  });
});
