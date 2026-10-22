import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('default menu for a new kiosk', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/lib/vera-menu-seed.ts'), 'utf8');

  it('preloads the menu prices and leaves product images for the kiosk owner', () => {
    expect(source).toMatch(/price:\s*item\.price/);
    expect(source).toMatch(/image_url:\s*null/);
    expect(source).toMatch(/active:\s*item\.price\s*>\s*0/);
    expect(source).toMatch(/const missing = VERA_MENU\.filter/);
  });

  it('starts inventory empty and optional', () => {
    expect(source).toMatch(/stock_tracking_enabled:\s*false/);
    expect(source).toMatch(/physical_stock_quantity:\s*0/);
    expect(source).toMatch(/beach_stock_quantity:\s*0/);
  });
});
