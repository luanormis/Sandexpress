import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('authenticated panel visual theme', () => {
  const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
  const finalTheme = css.slice(css.lastIndexOf('/* Unified light cards'));

  it('uses light cards and dark text in vendor and admin panels', () => {
    expect(finalTheme).toContain('.vendor-ops-shell main :where(.bg-white)');
    expect(finalTheme).toContain('.admin-ops-shell main :where(.bg-white)');
    expect(finalTheme).toContain('background-color: #fffdf7 !important');
    expect(finalTheme).toContain('color: #2f241e !important');
    expect(finalTheme).toContain('html body .vendor-ops-shell main table tbody tr');
  });

  it('does not target the public landing page', () => {
    expect(finalTheme).not.toContain('.landing-shell');
  });
});
