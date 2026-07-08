'use client';

// Single place in apps/web that wires NEXT_PUBLIC_API_URL into the shared API
// client. Rendered once from the root layout; the module-scope call below runs
// both during SSR and in the browser bundle, before any page code makes requests.

import { configureApiClient, resolveApiBaseUrl } from '@fabxpert/shared';

configureApiClient(
  resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, {
    production: process.env.NODE_ENV === 'production',
    pageOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
  }),
);

export function ApiClientBootstrap() {
  return null;
}
