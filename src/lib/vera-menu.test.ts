import { VERA_MENU } from './vera-menu';

describe('VERA_MENU', () => {
  it('mantém o cardápio padrão completo e editável', () => {
    expect(VERA_MENU).toHaveLength(150);
    expect(new Set(VERA_MENU.map(item => item.code)).size).toBe(150);
    expect(VERA_MENU.filter(item => /^\d{3}$/.test(item.code)).map(item => item.code))
      .toEqual(Array.from({ length: 124 }, (_, index) => String(index + 1).padStart(3, '0')));
  });

  it('mantém imagens no catálogo global e identifica preços que faltam na foto', () => {
    for (const item of VERA_MENU) {
      expect(item.price).toBeGreaterThanOrEqual(0);
      expect(item.image).toMatch(/^\/ready-menu\/vera\/.+\.(webp|png)$/);
      if (item.price === 0) expect(item.description).toMatch(/preço não informado/i);
    }
  });
});
