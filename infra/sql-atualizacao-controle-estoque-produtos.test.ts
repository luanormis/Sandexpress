import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(path.join(process.cwd(), 'infra/sql-atualizacao-controle-estoque-produtos.sql'), 'utf8');

describe('sql-atualizacao-controle-estoque-produtos', () => {
  it('creates products and exposes it to the Supabase Data API roles used by the app', () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+products/i);
    expect(sql).toMatch(/ALTER\s+TABLE\s+products\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(sql).toMatch(/CREATE\s+POLICY\s+products_public_active_select[\s\S]+TO\s+anon,\s*authenticated/i);
    expect(sql).toMatch(/GRANT\s+SELECT\s+ON\s+products\s+TO\s+anon,\s*authenticated/i);
    expect(sql).toMatch(/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+products\s+TO\s+service_role/i);
  });

  it('adds and normalizes inventory columns for existing products', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS stock_tracking_enabled BOOLEAN DEFAULT FALSE');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS physical_stock_quantity INTEGER DEFAULT 0');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS beach_stock_quantity INTEGER DEFAULT 0');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS stock_quantity INTEGER');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS blocked_by_stock BOOLEAN DEFAULT FALSE');
    expect(sql).toMatch(/UPDATE\s+products[\s\S]*stock_quantity\s*=\s*CASE/i);
  });

  it('keeps inventory quantities non-negative', () => {
    expect(sql).toContain('products_physical_stock_quantity_nonnegative');
    expect(sql).toContain('CHECK (physical_stock_quantity >= 0)');
    expect(sql).toContain('products_beach_stock_quantity_nonnegative');
    expect(sql).toContain('CHECK (beach_stock_quantity >= 0)');
    expect(sql).toContain('products_stock_quantity_nonnegative');
    expect(sql).toContain('CHECK (stock_quantity IS NULL OR stock_quantity >= 0)');
  });
});
