import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const rawLine of readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const line = rawLine.trim();
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, '$2');
}

const baseUrl = process.env.LOAD_TEST_BASE_URL || 'http://127.0.0.1:3027';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sessionSecret = process.env.SESSION_SECRET;
const confirmation = process.env.LOAD_TEST_CONFIRM;
const allowedOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || baseUrl).origin;
const runId = `codex-load-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`;
const registrationIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
const reportPath = process.env.LOAD_TEST_REPORT_PATH || null;
const orderConcurrency = Number(process.env.LOAD_TEST_ORDER_CONCURRENCY || 2500);

if (confirmation !== 'CREATE_AND_DELETE') throw new Error('Defina LOAD_TEST_CONFIRM=CREATE_AND_DELETE.');
if (!supabaseUrl || !serviceKey || !sessionSecret) throw new Error('Variáveis Supabase/SESSION_SECRET ausentes.');

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const createdTenantIds = [];
const uploadedPaths = [];
const metrics = [];

function token(payload, ttlSeconds = 43_200) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function summarize(name, values, statuses, started) {
  const durationMs = performance.now() - started;
  const success = [...statuses.entries()].filter(([status]) => status >= 200 && status < 300).reduce((n, [, count]) => n + count, 0);
  const result = {
    name,
    requests: values.length,
    success,
    failed: values.length - success,
    duration_ms: +durationMs.toFixed(2),
    throughput_rps: +(values.length / (durationMs / 1000)).toFixed(2),
    latency_ms: {
      p50: +percentile(values, 0.50).toFixed(2),
      p95: +percentile(values, 0.95).toFixed(2),
      p99: +percentile(values, 0.99).toFixed(2),
      max: +Math.max(...values).toFixed(2),
    },
    statuses: Object.fromEntries(statuses),
  };
  metrics.push(result);
  return result;
}

async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

async function insert(table, rows) {
  const { data, error } = await admin.from(table).insert(rows).select();
  if (error) throw new Error(`${table}: ${error.code || ''} ${error.message}`);
  return data;
}

async function http(path, options = {}) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, baseUrl), {
      signal: AbortSignal.timeout(120_000),
      ...options,
      headers: { origin: allowedOrigin, ...options.headers },
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body, latency: performance.now() - started };
  } catch (error) {
    return { status: 0, body: { error: error?.message || String(error) }, latency: performance.now() - started };
  }
}

async function cleanup() {
  const cleanup = { storage: null, tenants: null, beaches: null, rate_limit: null, remaining: {} };
  const { data: discovered } = await admin.from('tenants').select('id').ilike('name', `${runId}%`);
  for (const row of discovered || []) {
    if (!createdTenantIds.includes(row.id)) createdTenantIds.push(row.id);
  }
  if (uploadedPaths.length) cleanup.storage = await admin.storage.from('product-images').remove(uploadedPaths);
  if (createdTenantIds.length) cleanup.tenants = await admin.from('tenants').delete().in('id', createdTenantIds);
  cleanup.beaches = await admin.from('beaches').delete().ilike('name', `${runId}%`);
  cleanup.rate_limit = await admin.from('rate_limit_buckets').delete().eq('key', `vendor-register:${registrationIp}`);
  for (const table of ['tenants', 'vendors', 'umbrellas', 'customers', 'products', 'orders', 'order_items']) {
    const column = table === 'tenants' ? 'id' : 'tenant_id';
    const { count, error } = await admin.from(table).select('id', { head: true, count: 'exact' }).in(column, createdTenantIds.length ? createdTenantIds : [crypto.randomUUID()]);
    cleanup.remaining[table] = error ? `ERROR ${error.code}: ${error.message}` : count;
  }
  const { count: beachCount, error: beachError } = await admin.from('beaches').select('id', { head: true, count: 'exact' }).ilike('name', `${runId}%`);
  cleanup.remaining.beaches = beachError ? `ERROR ${beachError.code}: ${beachError.message}` : beachCount;
  return cleanup;
}

let finalReport;
try {
  const tenants = await insert('tenants', Array.from({ length: 50 }, (_, i) => ({
    name: `${runId}-tenant-${i + 1}`,
    status: 'active', city: 'Load Test', state: 'SP', beach_name: runId,
  })));
  createdTenantIds.push(...tenants.map((row) => row.id));

  const vendors = await insert('vendors', tenants.map((tenant, i) => ({
    tenant_id: tenant.id,
    name: `${runId}-quiosque-${i + 1}`,
    document_login: `${runId}-${i + 1}`,
    owner_name: 'Codex Load Test',
    owner_phone: `119${String(10000000 + i).slice(-8)}`,
    owner_email: 'delivered@resend.dev',
    city: 'Load Test', state: 'SP', beach_name: runId,
    subscription_status: 'trial', plan_type: 'trial', max_umbrellas: 50, is_active: true,
  })));

  const features = [];
  for (const tenant of tenants) {
    for (const feature_key of ['login', 'beach_umbrellas', 'digital_menu', 'orders', 'operational_dashboard']) {
      features.push({ tenant_id: tenant.id, feature_key, enabled: true });
    }
  }
  await insert('tenant_features', features);

  const umbrellas = await insert('umbrellas', vendors.flatMap((vendor) => Array.from({ length: 10 }, (_, i) => ({
    tenant_id: vendor.tenant_id, vendor_id: vendor.id, number: i + 1,
    label: `${runId}-guarda-sol-${i + 1}`, active: true, is_occupied: false,
  }))));
  const products = await insert('products', vendors.flatMap((vendor) => Array.from({ length: 8 }, (_, i) => ({
    tenant_id: vendor.tenant_id, vendor_id: vendor.id, category: 'Carga',
    name: `${runId}-produto-${i + 1}`, description: 'Produto sintético removível',
    price: 10 + i, active: true, stock_tracking_enabled: false,
  }))));

  const activeVendors = vendors.slice(0, 25);
  const activeUmbrellas = umbrellas.filter((row) => activeVendors.some((vendor) => vendor.id === row.vendor_id));
  const customers = await insert('customers', activeUmbrellas.map((umbrella, i) => ({
    tenant_id: umbrella.tenant_id, vendor_id: umbrella.vendor_id,
    name: `${runId}-cliente-${i + 1}`, phone: `119${String(20000000 + i).slice(-8)}`, party_size: 2,
  })));

  const productByVendor = new Map();
  for (const product of products) {
    if (!productByVendor.has(product.vendor_id)) productByVendor.set(product.vendor_id, product);
  }
  const customerByVendorAndIndex = new Map();
  for (const customer of customers) {
    const list = customerByVendorAndIndex.get(customer.vendor_id) || [];
    list.push(customer);
    customerByVendorAndIndex.set(customer.vendor_id, list);
  }

  const orderCalls = [];
  for (let request = 1; request <= 10; request++) {
    for (const umbrella of activeUmbrellas) {
      const vendorUmbrellas = activeUmbrellas.filter((item) => item.vendor_id === umbrella.vendor_id);
      const index = vendorUmbrellas.findIndex((item) => item.id === umbrella.id);
      const customer = customerByVendorAndIndex.get(umbrella.vendor_id)[index];
      const product = productByVendor.get(umbrella.vendor_id);
      const cookie = `customer_session=${token({ role: 'customer', vendor_id: umbrella.vendor_id, customer_id: customer.id, tenant_id: umbrella.tenant_id })}`;
      const virtualClientIp = `2001:db8::${(orderCalls.length + 1).toString(16)}`;
      orderCalls.push(() => http('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'user-agent': `SandExpress-Load/${runId}`, 'x-forwarded-for': virtualClientIp },
        body: JSON.stringify({ vendor_id: umbrella.vendor_id, customer_id: customer.id, umbrella_id: umbrella.id, items: [{ product_id: product.id, quantity: 1 }], notes: `${runId}-${request}` }),
      }));
    }
  }

  const orderStarted = performance.now();
  const orderResponses = await runWithConcurrency(orderCalls, orderConcurrency);
  const orderStatuses = new Map();
  for (const response of orderResponses) orderStatuses.set(response.status, (orderStatuses.get(response.status) || 0) + 1);
  summarize(`2.500 pedidos / concorrência ${orderConcurrency}`, orderResponses.map((item) => item.latency), orderStatuses, orderStarted);

  const { data: savedOrders, error: ordersError } = await admin.from('orders').select('id,tenant_id,vendor_id,customer_id,umbrella_id,total,paid,status').in('tenant_id', tenants.slice(0, 25).map((row) => row.id));
  if (ordersError) throw ordersError;
  const { data: savedItems, count: savedItemCount, error: itemsError } = await admin.from('order_items').select('id,tenant_id,order_id,quantity,subtotal', { count: 'exact' }).in('tenant_id', tenants.slice(0, 25).map((row) => row.id));
  if (itemsError) throw itemsError;

  const firstVendor = vendors[0];
  const vendorCookie = `vendor_session=${token({ role: 'vendor', vendor_id: firstVendor.id, tenant_id: firstVendor.tenant_id })}`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const form = new FormData();
  form.append('vendor_id', firstVendor.id);
  form.append('file', new Blob([png], { type: 'image/png' }), `${runId}.png`);
  const upload = await http('/api/products/upload', { method: 'POST', headers: { cookie: vendorCookie }, body: form });
  if (upload.status === 200 && upload.body?.url) {
    const marker = '/product-images/';
    const offset = upload.body.url.indexOf(marker);
    if (offset >= 0) uploadedPaths.push(decodeURIComponent(upload.body.url.slice(offset + marker.length)));
    await admin.from('products').update({ image_url: upload.body.url, is_default_image: false }).eq('id', productByVendor.get(firstVendor.id).id);
  }

  const registrationPayload = {
    name: `${runId}-cadastro-api`, owner_name: 'Codex Cadastro Teste', owner_phone: '11999999999',
    owner_email: 'delivered@resend.dev', city: 'Load Test', state: 'SP', beach_name: runId,
    cnpj: String(Date.now()).slice(-14).padStart(14, '7'), document_login: `${runId}-api`,
    password: 'CargaSegura#2026', password_confirm: 'CargaSegura#2026', terms_accepted: true,
  };
  const registration = await http('/api/vendors/register', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': registrationIp },
    body: JSON.stringify(registrationPayload),
  });
  if (registration.status === 201 && registration.body?.tenant_id) createdTenantIds.push(registration.body.tenant_id);

  const integrity = {
    expected_order_requests: 2500,
    successful_order_requests: orderResponses.filter((item) => item.status === 201).length,
    persisted_open_orders: savedOrders.length,
    persisted_order_items: savedItemCount,
    orders_with_total_100: savedOrders.filter((row) => Number(row.total) === 100).length,
    duplicate_open_accounts: savedOrders.length - new Set(savedOrders.map((row) => row.umbrella_id)).size,
    negative_totals: savedOrders.filter((row) => Number(row.total) < 0).length,
  };

  finalReport = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    target: { registered_kiosks: 50, active_kiosks: 25, umbrellas_per_kiosk: 10, orders_per_umbrella: 10 },
    seeded: { tenants: tenants.length, vendors: vendors.length, umbrellas: umbrellas.length, products: products.length, customers: customers.length },
    metrics,
    integrity,
    image_upload: { status: upload.status, body: upload.body },
    registration_email_menu: { status: registration.status, body: registration.body },
  };
} catch (error) {
  finalReport = { run_id: runId, generated_at: new Date().toISOString(), metrics, fatal_error: error?.stack || String(error) };
} finally {
  finalReport.cleanup = await cleanup();
  console.log(JSON.stringify(finalReport, null, 2));
  if (reportPath) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(reportPath, JSON.stringify(finalReport, null, 2));
  }
  if (finalReport.fatal_error || Object.values(finalReport.cleanup.remaining).some((count) => count !== 0)) process.exitCode = 1;
}
