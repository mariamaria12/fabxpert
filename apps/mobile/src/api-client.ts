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

/**
 * Resolves the API base URL. In production, cross-origin URLs (e.g. Railway) are
 * replaced with `/api` so httpOnly cookies work via vercel.json rewrite.
 */
function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();

  if (!configured) {
    if (import.meta.env.PROD) {
      return '/api';
    }
    throw new Error(
      'VITE_API_URL is not set. Add it to apps/mobile/.env (see .env.example).',
    );
  }

  const normalized = normalizeApiUrl(configured);

  if (
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    /^https?:\/\//i.test(normalized)
  ) {
    try {
      if (new URL(normalized).origin !== window.location.origin) {
        return '/api';
      }
    } catch {
      return '/api';
    }
  }

  return normalized;
}

configureApiClient(resolveApiBaseUrl());
