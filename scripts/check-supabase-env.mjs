import fs from 'node:fs';
import dns from 'node:dns/promises';
import { createClient } from '@supabase/supabase-js';

const envPath = '.env.local';
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SESSION_SECRET',
  'ADMIN_PASSWORD',
  'NEXT_PUBLIC_APP_URL',
];
const schemaChecks = [
  ['vendors', 'id'],
  ['vendors', 'plan_monthly_price'],
  ['vendors', 'plan_annual_monthly_price'],
  ['platform_settings', 'key'],
  ['platform_settings', 'value'],
  ['tenants', 'id'],
  ['terms_acceptances', 'id'],
];

function loadEnvFile(path) {
  if (!fs.existsSync(path)) throw new Error(`${path} nao encontrado.`);
  const env = {};
  for (const rawLine of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^"|"$/g, '');
    env[key] = value;
  }
  return env;
}

function statusFor(value) {
  if (!value) return 'MISSING';
  if (/change-this|invalid|example|your_|sua_|coloque|95732/i.test(value)) return 'PLACEHOLDER';
  return `SET len=${value.length}`;
}

async function main() {
  const env = loadEnvFile(envPath);
  let blocked = false;

  console.log(`[${envPath}]`);
  for (const key of required) {
    const status = statusFor(env[key]);
    if (!status.startsWith('SET')) blocked = true;
    console.log(`${key}=${status}`);
  }
  if (blocked) process.exitCode = 1;

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return;

  let host = '';
  try {
    host = new URL(url).host;
    console.log(`supabase_host=${host}`);
  } catch {
    console.log('supabase_url=INVALID_URL');
    process.exitCode = 1;
    return;
  }

  try {
    await dns.lookup(host);
    console.log('dns=OK');
  } catch (err) {
    console.log(`dns=FAIL ${err.code || err.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' },
      signal: AbortSignal.timeout(10000),
    });
    console.log(`rest=${response.status}`);
  } catch (err) {
    console.log(`rest=FAIL ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY || '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (const [table, column] of schemaChecks) {
    const { error } = await client.from(table).select(column).limit(1);
    if (error) {
      console.log(`${table}.${column}=FAIL ${error.code || ''} ${error.message}`);
      process.exitCode = 1;
    } else {
      console.log(`${table}.${column}=OK`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
