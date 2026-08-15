import { configureReadyMenuTags, parseReadyMenuPrice } from './ready-menu';

describe('ready menu image tags', () => {
  it('stores and reads a positive price', () => {
    const tags = configureReadyMenuTags(['bebidas'], true, 12.5);
    expect(tags).toEqual(['bebidas', 'ready-menu', 'menu-price:12.50']);
    expect(parseReadyMenuPrice(tags)).toBe(12.5);
  });

  it('removes ready-menu metadata without deleting catalog tags', () => {
    expect(configureReadyMenuTags(['bebidas', 'ready-menu', 'menu-price:12.50'], false)).toEqual(['bebidas']);
  });

  it('rejects an invalid ready-menu price', () => {
    expect(() => configureReadyMenuTags([], true, 0)).toThrow(/preço válido/i);
  });
});
