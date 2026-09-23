import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('default menu for a new kiosk', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/lib/vera-menu-seed.ts'), 'utf8');

  it('creates editable products without commercial prices', () => {
    expect(source).toMatch(/price:\s*0/);
    expect(source).toMatch(/active:\s*true/);
  });

  it('starts inventory empty and optional', () => {
    expect(source).toMatch(/stock_tracking_enabled:\s*false/);
    expect(source).toMatch(/physical_stock_quantity:\s*0/);
    expect(source).toMatch(/beach_stock_quantity:\s*0/);
  });
});
