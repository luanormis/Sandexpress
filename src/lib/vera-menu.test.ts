import { VERA_MENU } from './vera-menu';

describe('VERA_MENU', () => {
  it('mantém os 91 alimentos transcritos e editáveis', () => {
    expect(VERA_MENU).toHaveLength(91);
    expect(new Set(VERA_MENU.map(item => item.code)).size).toBe(91);
  });

  it('possui preço válido e imagem global para todos os itens', () => {
    for (const item of VERA_MENU) {
      expect(item.price).toBeGreaterThan(0);
      expect(item.image).toMatch(/^\/ready-menu\/vera\/.+\.webp$/);
    }
  });
});
