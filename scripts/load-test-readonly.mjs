import { performance } from 'node:perf_hooks';

const baseUrl = process.env.LOAD_TEST_BASE_URL || 'http://127.0.0.1:3027';
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 25);
const requests = Number(process.env.LOAD_TEST_REQUESTS || 2500);
const timeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS || 15_000);
const paths = (process.env.LOAD_TEST_PATHS || '/api/health,/').split(',').map((item) => item.trim()).filter(Boolean);

if (!Number.isInteger(concurrency) || concurrency < 1 || !Number.isInteger(requests) || requests < 1) {
  throw new Error('LOAD_TEST_CONCURRENCY e LOAD_TEST_REQUESTS devem ser inteiros positivos.');
}

const latencies = [];
const statuses = new Map();
const errors = new Map();
let cursor = 0;

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= requests) return;
    const path = paths[index % paths.length];
    const started = performance.now();
    try {
      const response = await fetch(new URL(path, baseUrl), {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'SandExpress-ReadOnly-Load-Test/1.0' },
      });
      await response.arrayBuffer();
      latencies.push(performance.now() - started);
      statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
    } catch (error) {
      latencies.push(performance.now() - started);
      const name = error?.name || 'Error';
      errors.set(name, (errors.get(name) || 0) + 1);
    }
  }
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const position = Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1);
  return values[position];
}

const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const durationMs = performance.now() - started;
latencies.sort((a, b) => a - b);
const successful = [...statuses.entries()].filter(([status]) => status < 400).reduce((sum, [, count]) => sum + count, 0);
const failed = requests - successful;

const report = {
  generated_at: new Date().toISOString(),
  mode: 'read-only',
  base_url: baseUrl,
  paths,
  concurrency,
  requests,
  duration_ms: Number(durationMs.toFixed(2)),
  throughput_rps: Number((requests / (durationMs / 1000)).toFixed(2)),
  latency_ms: {
    min: Number((latencies[0] || 0).toFixed(2)),
    p50: Number(percentile(latencies, 0.5).toFixed(2)),
    p95: Number(percentile(latencies, 0.95).toFixed(2)),
    p99: Number(percentile(latencies, 0.99).toFixed(2)),
    max: Number((latencies.at(-1) || 0).toFixed(2)),
  },
  successful,
  failed,
  error_rate_percent: Number(((failed / requests) * 100).toFixed(3)),
  statuses: Object.fromEntries([...statuses.entries()].sort(([a], [b]) => a - b)),
  errors: Object.fromEntries(errors),
};

console.log(JSON.stringify(report, null, 2));
if (failed > 0) process.exitCode = 1;
