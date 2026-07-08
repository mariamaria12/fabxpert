/** Trim env-style API URL values (no trailing slash). */
export function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
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
 * Resolves the API base URL for browser fetch/EventSource.
 * Cross-origin absolute URLs (e.g. Vercel → Railway) break httpOnly cookies —
 * use same-origin `/api` when a reverse proxy is configured.
 */
export function resolveApiBaseUrl(
  configured: string | undefined,
  options: { production: boolean; pageOrigin?: string },
): string {
  if (!configured?.trim()) {
    if (options.production) {
      return '/api';
    }
    throw new Error('API base URL is not configured.');
  }

  const normalized = normalizeApiBaseUrl(configured);

  // Same-origin /api proxy whenever the configured API host differs from the page.
  if (options.pageOrigin && /^https?:\/\//i.test(normalized)) {
    try {
      if (new URL(normalized).origin !== options.pageOrigin) {
        return '/api';
      }
    } catch {
      return '/api';
    }
  }

  // Production fallback when env points cross-origin but pageOrigin is unavailable (SSR).
  if (
    options.production &&
    !options.pageOrigin &&
    /^https?:\/\//i.test(normalized)
  ) {
    return '/api';
  }

  return normalized;
}

/** Upstream API origin for Next/Vercel rewrites (`/api` → Railway). */
export function apiUpstreamOrigin(configured: string | undefined): string | null {
  if (!configured?.trim()) {
    return null;
  }
  const normalized = normalizeApiBaseUrl(configured);
  if (normalized.startsWith('/')) {
    return null;
  }
  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}
