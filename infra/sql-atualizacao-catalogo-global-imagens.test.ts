import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'infra/sql-atualizacao-catalogo-global-imagens.sql'),
  'utf8'
);

describe('sql-atualizacao-catalogo-global-imagens', () => {
  it('uses the global catalog storage bucket', () => {
    expect(sql).toContain("VALUES ('catalogo-global', 'catalogo-global', TRUE)");
    expect(sql).toContain('catalogo_global_storage_public_read');
    expect(sql).toContain('catalogo_global_storage_service_all');
  });

  it('adds searchable image catalog metadata', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS tags TEXT[]');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS source_bucket TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS storage_path TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS active BOOLEAN');
    expect(sql).toContain('USING GIN(tags)');
  });

  it('keeps public reads and service role writes explicit', () => {
    expect(sql).toContain('GRANT SELECT ON product_images TO anon, authenticated');
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO service_role');
  });
});
