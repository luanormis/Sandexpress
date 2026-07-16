import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(path.join(process.cwd(), 'infra/sql-atualizacao-limite-admin-120.sql'), 'utf8');

describe('sql-atualizacao-limite-admin-120', () => {
  it('is incremental, repeatable, and preserves the commercial default of 100', () => {
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain('DEFAULT 100');
    expect(sql).toContain('BETWEEN 1 AND 120');
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE TABLE|DELETE FROM/);
  });

  it('updates the concurrent quota trigger to honor the individual admin limit', () => {
    expect(sql).toContain('SELECT LEAST(120, COALESCE(max_umbrellas, 100))');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('CREATE TRIGGER trg_enforce_vendor_umbrella_limit');
  });
});
