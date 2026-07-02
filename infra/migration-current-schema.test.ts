import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(path.join(process.cwd(), 'infra/migration-current-schema.sql'), 'utf8');

describe('migration-current-schema', () => {
  it('adds beaches tenant_id before creating the tenant index for old databases', () => {
    const alterPosition = sql.indexOf('ALTER TABLE beaches');
    const indexPosition = sql.indexOf('idx_beaches_tenant');

    expect(alterPosition).toBeGreaterThan(-1);
    expect(indexPosition).toBeGreaterThan(-1);
    expect(alterPosition).toBeLessThan(indexPosition);
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE');
  });
});
