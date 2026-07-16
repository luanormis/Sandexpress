import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'infra/sql-atualizacao-escala-1000-quiosques.sql'),
  'utf8',
);

describe('sql-atualizacao-escala-1000-quiosques', () => {
  it('keeps 100 as default and allows an admin ceiling of 120 without recreating operational tables', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS max_umbrellas INTEGER NOT NULL DEFAULT 100');
    expect(sql).toContain('CHECK (max_umbrellas BETWEEN 1 AND 120) NOT VALID');
    expect(sql).toContain('SELECT LEAST(120, COALESCE(max_umbrellas, 100))');
    expect(sql).toContain("'{max_umbrellas}', '100'::JSONB");
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE TABLE/);
  });

  it('serializes umbrella creation per vendor to enforce the limit under concurrency', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION enforce_vendor_umbrella_limit');
    expect(sql).toContain('FROM vendors\n  WHERE id = NEW.vendor_id\n  FOR UPDATE');
    expect(sql).toContain('CREATE TRIGGER trg_enforce_vendor_umbrella_limit');
  });

  it('adds operational indexes and transactional order idempotency', () => {
    expect(sql).toContain('idx_orders_vendor_open_created_scale');
    expect(sql).toContain('PRIMARY KEY (vendor_id, idempotency_key)');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION create_customer_order_idempotent');
    expect(sql).toContain("jsonb_build_object('duplicate', TRUE, 'synchronized', TRUE)");
  });

  it('runs atomically and remains rerunnable', () => {
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS');
    expect(sql).toContain('DROP TRIGGER IF EXISTS');
  });
});
