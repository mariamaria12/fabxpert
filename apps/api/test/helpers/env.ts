import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Load key=value pairs from a .env file without overwriting existing process.env entries.
 */
export function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

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

/**
 * Validates TEST_DATABASE_URL and maps it onto DATABASE_URL / DIRECT_URL for the test run.
 * Fails loudly if misconfigured to prevent wiping dev data.
 */
export function configureTestEnvironment(): void {
  const apiRoot = resolve(__dirname, '../..');
  loadEnvFile(resolve(apiRoot, '.env'));

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  const devDatabaseUrl = process.env.DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL is not set. E2E tests require a dedicated test database. ' +
        'See apps/api/test/README.md and apps/api/.env.example.',
    );
  }

  if (devDatabaseUrl && testDatabaseUrl === devDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. ' +
        'Use a separate test database or schema to avoid wiping dev data.',
    );
  }

  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? testDatabaseUrl;

  process.env.JWT_SECRET ??=
    'e2e-test-jwt-secret-do-not-use-in-production-0123456789abcdef';
  process.env.JWT_REMEMBER_EXPIRY_ADMIN ??= '30d';
  process.env.JWT_REMEMBER_EXPIRY_EMPLOYEE ??= '365d';
  process.env.JWT_SESSION_EXPIRY ??= '1d';
  process.env.WEB_APP_URL ??= 'http://localhost:3000';
  process.env.MOBILE_APP_URL ??= 'http://localhost:3001';
  process.env.NODE_ENV ??= 'test';
}
