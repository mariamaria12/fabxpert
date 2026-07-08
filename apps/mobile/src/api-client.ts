import { configureApiClient } from '@fabxpert/shared';

/** Ensures VITE_API_URL is usable in fetch — bare hostnames become relative paths. */
function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  // Relative path (e.g. /api) — same-origin proxy; required for mobile auth cookies.
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const protocol = /^localhost(:\d+)?$/i.test(trimmed) ? 'http' : 'https';
  return `${protocol}://${trimmed}`;
}

const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error(
    'VITE_API_URL is not set. Add it to apps/mobile/.env (see .env.example).',
  );
}

configureApiClient(normalizeApiUrl(apiUrl));
