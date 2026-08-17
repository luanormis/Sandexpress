Exit code: 0
Wall time: 0.7 seconds
Output:
import { VERA_MENU } from './vera-menu';

describe('VERA_MENU', () => {
  it('mantÃ©m os 91 alimentos transcritos e editÃ¡veis', () => {
    expect(VERA_MENU).toHaveLength(91);
    expect(new Set(VERA_MENU.map(item => item.code)).size).toBe(91);
  });

  it('possui preÃ§o vÃ¡lido e imagem global para todos os itens', () => {
    for (const item of VERA_MENU) {
      expect(item.price).toBeGreaterThan(0);
      expect(item.image).toMatch(/^\/ready-menu\/vera\/.+\.webp$/);
    }
  });
});

