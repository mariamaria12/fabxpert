/**
 * HTTP latency benchmark against a running API with perf seed data.
 *
 * Prerequisites:
 *   1. API running (default http://localhost:4000)
 *   2. Perf data seeded: ALLOW_PERF_SEED=true pnpm --filter @fabxpert/db db:seed:perf
 *   3. PERF_SEED_PASSWORD or TEST_USERS_SEED_PASSWORD (auto-loaded from packages/db/.env when present)
 *
 * Usage:
 *   pnpm --filter @fabxpert/api test:perf
 *
 * Env:
 *   PERF_API_URL          — base URL (default http://localhost:4000)
 *   PERF_ITERATIONS       — measured requests per endpoint (default 25)
 *   PERF_WARMUP           — warmup requests per endpoint (default 3)
 *   PERF_P95_MS           — global p95 cap for all endpoints (optional)
 *   PERF_STRICT           — set to 1 to exit 1 on threshold failures (default 0 = report only)
 *   PERF_SEED_PASSWORD    — login password for perf admin
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

function loadEnvFiles(): void {
  const candidates = [
    join(scriptDir, '../.env'),
    join(scriptDir, '../../../packages/db/.env'),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    const contents = readFileSync(filePath, 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separator = trimmed.indexOf('=');
      if (separator <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadEnvFiles();

const DEFAULT_API_URL = 'http://localhost:4000';
const PERF_ADMIN_EMAIL = 'perf.admin001@perf.fabxpert.test';

type BenchmarkCase = {
  name: string;
  path: string;
  /** Optional p95 threshold in ms for this endpoint. */
  p95Ms?: number;
};

type TimingStats = {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  samples: number;
};

const ENDPOINTS: BenchmarkCase[] = [
  {
    name: 'projects (in_progress, sort name)',
    path: '/projects?statusGroup=in_progress&sortBy=name&sortOrder=asc&page=1&pageSize=20',
    p95Ms: 600,
  },
  {
    name: 'projects (in_progress, compact)',
    path: '/projects?statusGroup=in_progress&sortBy=name&sortOrder=asc&page=1&pageSize=20&compact=true',
    p95Ms: 500,
  },
  {
    name: 'projects (search perf)',
    path: '/projects?search=PERF&page=1&pageSize=20',
    p95Ms: 600,
  },
  {
    name: 'timesheets (month, sort person)',
    path: '/timesheets?period=month&sortBy=person&sortOrder=asc&page=1&pageSize=20',
    p95Ms: 600,
  },
  {
    name: 'timesheets pinned-summary',
    path: '/timesheets/pinned-summary',
    p95Ms: 400,
  },
  {
    name: 'timesheets project-summary (month)',
    path: '/timesheets/project-summary?period=month',
    p95Ms: 800,
  },
  {
    name: 'timesheets person-summary (month)',
    path: '/timesheets/person-summary?period=month',
    p95Ms: 800,
  },
  {
    name: 'timesheets dashboard-metrics',
    path: '/timesheets/dashboard-metrics',
    p95Ms: 600,
  },
  {
    name: 'persons (sort name)',
    path: '/persons?sortBy=name&sortOrder=asc&page=1&pageSize=20',
    p95Ms: 400,
  },
  {
    name: 'companies (page 1)',
    path: '/companies?page=1&pageSize=20',
    p95Ms: 400,
  },
];

function resolvePassword(): string {
  const password =
    process.env.PERF_SEED_PASSWORD?.trim() || process.env.TEST_USERS_SEED_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      'Set PERF_SEED_PASSWORD or TEST_USERS_SEED_PASSWORD before running the perf benchmark.',
    );
  }
  return password;
}

function parseCookieHeader(setCookie: string | null): string {
  if (!setCookie) {
    return '';
  }

  return setCookie
    .split(/,(?=[^;]+=[^;]+)/)
    .map((entry) => entry.trim().split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? sorted[sorted.length - 1]!;
}

function computeStats(durationsMs: number[]): TimingStats {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);

  return {
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    avg: sorted.length > 0 ? sum / sorted.length : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    samples: sorted.length,
  };
}

function formatMs(value: number): string {
  return `${value.toFixed(1)}ms`;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

async function login(baseUrl: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: PERF_ADMIN_EMAIL,
      password,
      rememberMe: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Login failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const cookie = parseCookieHeader(response.headers.get('set-cookie'));
  if (!cookie) {
    throw new Error('Login succeeded but no auth cookie was returned.');
  }

  return cookie;
}

async function timedGet(
  baseUrl: string,
  path: string,
  cookie: string,
): Promise<{ durationMs: number; status: number; itemCount?: number }> {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Cookie: cookie },
  });
  const body = await response.text();
  const durationMs = performance.now() - started;

  let itemCount: number | undefined;
  if (response.ok) {
    try {
      const parsed = JSON.parse(body) as { data?: unknown[]; items?: unknown[]; total?: number };
      if (Array.isArray(parsed.data)) {
        itemCount = parsed.data.length;
      } else if (Array.isArray(parsed.items)) {
        itemCount = parsed.items.length;
      } else if (typeof parsed.total === 'number') {
        itemCount = parsed.total;
      }
    } catch {
      // Non-JSON or summary shape — skip count
    }
  }

  if (!response.ok) {
    throw new Error(`GET ${path} failed (${response.status}): ${body.slice(0, 200)}`);
  }

  return { durationMs, status: response.status, itemCount };
}

async function benchmarkEndpoint(
  baseUrl: string,
  path: string,
  cookie: string,
  warmup: number,
  iterations: number,
): Promise<TimingStats> {
  for (let i = 0; i < warmup; i += 1) {
    await timedGet(baseUrl, path, cookie);
  }

  const durations: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const { durationMs } = await timedGet(baseUrl, path, cookie);
    durations.push(durationMs);
  }

  return computeStats(durations);
}

async function assertApiReachable(baseUrl: string): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}/health`, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`health check returned ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `API not reachable at ${baseUrl} (${message}). Start it with: pnpm --filter @fabxpert/api dev`,
    );
  }
}

async function main(): Promise<void> {
  const baseUrl = (process.env.PERF_API_URL?.trim() || DEFAULT_API_URL).replace(/\/$/, '');
  const iterations = Number(process.env.PERF_ITERATIONS ?? 25);
  const warmup = Number(process.env.PERF_WARMUP ?? 3);
  const globalP95Limit = process.env.PERF_P95_MS ? Number(process.env.PERF_P95_MS) : undefined;
  const strict = process.env.PERF_STRICT === '1';

  if (!Number.isFinite(iterations) || iterations < 1) {
    throw new Error('PERF_ITERATIONS must be a positive number.');
  }
  if (!Number.isFinite(warmup) || warmup < 0) {
    throw new Error('PERF_WARMUP must be a non-negative number.');
  }

  console.log(`FabXpert API performance benchmark`);
  console.log(`  API:         ${baseUrl}`);
  console.log(`  User:        ${PERF_ADMIN_EMAIL}`);
  console.log(`  Warmup:      ${warmup} req/endpoint`);
  console.log(`  Iterations:  ${iterations} req/endpoint`);
  if (globalP95Limit !== undefined) {
    console.log(`  Global p95:  <= ${globalP95Limit}ms`);
  }
  console.log('');

  await assertApiReachable(baseUrl);
  const password = resolvePassword();
  const cookie = await login(baseUrl, password);
  console.log('Authenticated.\n');

  const nameWidth = Math.max(...ENDPOINTS.map((entry) => entry.name.length), 4);
  const header =
    `${pad('Endpoint', nameWidth)}  ` +
    `${pad('p50', 8)}  ${pad('p95', 8)}  ${pad('avg', 8)}  ${pad('min', 8)}  ${pad('max', 8)}  status`;
  console.log(header);
  console.log('-'.repeat(header.length));

  const failures: string[] = [];

  for (const endpoint of ENDPOINTS) {
    const stats = await benchmarkEndpoint(baseUrl, endpoint.path, cookie, warmup, iterations);
    const limit = endpoint.p95Ms ?? globalP95Limit;
    const failed = limit !== undefined && stats.p95 > limit;
    const status = failed ? 'FAIL' : 'OK';

    console.log(
      `${pad(endpoint.name, nameWidth)}  ` +
        `${pad(formatMs(stats.p50), 8)}  ${pad(formatMs(stats.p95), 8)}  ` +
        `${pad(formatMs(stats.avg), 8)}  ${pad(formatMs(stats.min), 8)}  ${pad(formatMs(stats.max), 8)}  ${status}`,
    );

    if (failed) {
      failures.push(`${endpoint.name}: p95 ${formatMs(stats.p95)} > ${limit}ms`);
    }
  }

  console.log('');
  if (failures.length > 0) {
    console.log('Threshold warnings:');
    for (const failure of failures) {
      console.log(`  - ${failure}`);
    }
    if (strict) {
      process.exitCode = 1;
    } else {
      console.log('\nSet PERF_STRICT=1 to fail the run on threshold breaches.');
    }
    return;
  }

  console.log('All endpoints within thresholds.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
