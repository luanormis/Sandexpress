import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(path.join(process.cwd(), 'infra/fix-current-database-grants.sql'), 'utf8');

describe('fix-current-database-grants', () => {
  it('grants operational Data API access to service_role', () => {
    expect(sql).toMatch(/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+service_role/i);
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+public\s+TO\s+service_role/i);
  });

  it('does not grant blanket write access to anon or authenticated', () => {
    expect(sql).not.toMatch(/GRANT\s+ALL\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+anon/i);
    expect(sql).not.toMatch(/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+anon/i);
    expect(sql).not.toMatch(/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+authenticated/i);
  });

  it('keeps public reads explicit for the customer-facing Data API surfaces', () => {
    expect(sql).toMatch(/GRANT\s+SELECT\s+ON\s+product_images\s+TO\s+anon,\s*authenticated/i);
    expect(sql).toMatch(/GRANT\s+SELECT\s+ON\s+products\s+TO\s+anon,\s*authenticated/i);
    expect(sql).toMatch(/GRANT\s+SELECT\s+ON\s+umbrellas\s+TO\s+anon,\s*authenticated/i);
  });
});
