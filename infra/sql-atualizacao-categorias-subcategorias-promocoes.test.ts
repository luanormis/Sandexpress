import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'infra/sql-atualizacao-categorias-subcategorias-promocoes.sql'),
  'utf8'
);

describe('sql-atualizacao-categorias-subcategorias-promocoes', () => {
  it('creates hierarchical product categories per vendor', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS product_categories');
    expect(sql).toContain('parent_id UUID REFERENCES product_categories(id)');
    expect(sql).toContain('UNIQUE(vendor_id, parent_id, slug)');
  });

  it('adds submenu, option and promotion highlight fields to products', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS subcategory TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS option_group_name TEXT');
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS option_values JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS menu_highlight BOOLEAN NOT NULL DEFAULT FALSE');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS promotion_ends_at TIMESTAMPTZ');
  });

  it('backfills combo and promotional products into highlighted menu area', () => {
    expect(sql).toContain('UPDATE products');
    expect(sql).toContain('is_combo = TRUE OR promotional_price IS NOT NULL');
    expect(sql).toContain('menu_highlight = TRUE');
  });
});
