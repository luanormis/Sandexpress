import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const rawLine of readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const match = rawLine.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
}

if (process.env.LOAD_TEST_CONFIRM !== 'CREATE_AND_DELETE') throw new Error('Defina LOAD_TEST_CONFIRM=CREATE_AND_DELETE.');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const prefix = 'codex-load-%';
const { data: tenants, error: findError } = await admin.from('tenants').select('id,name').ilike('name', prefix);
if (findError) throw findError;
const tenantIds = (tenants || []).map((row) => row.id);
const result = { found_tenants: tenantIds.length, deleted_tenants: null, deleted_beaches: null, deleted_rate_limits: null, remaining: {} };
if (tenantIds.length) result.deleted_tenants = await admin.from('tenants').delete().in('id', tenantIds);
result.deleted_beaches = await admin.from('beaches').delete().ilike('name', prefix);
result.deleted_rate_limits = await admin.from('rate_limit_buckets').delete().like('key', 'vendor-register:198.51.100.%');
for (const [table, column] of [['tenants', 'name'], ['vendors', 'name'], ['customers', 'name'], ['products', 'name'], ['beaches', 'name']]) {
  const { count, error } = await admin.from(table).select('id', { head: true, count: 'exact' }).ilike(column, prefix);
  result.remaining[table] = error ? `ERROR ${error.code}: ${error.message}` : count;
}
console.log(JSON.stringify(result, null, 2));
if (Object.values(result.remaining).some((value) => value !== 0)) process.exitCode = 1;
