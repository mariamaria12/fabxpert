'use client';

// Single place in apps/web that wires NEXT_PUBLIC_API_URL into the shared API
// client. Rendered once from the root layout; the module-scope call below runs
// both during SSR and in the browser bundle, before any page code makes requests.

import { configureApiClient } from '@fabxpert/shared';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set. Add it to apps/web/.env (see .env.example).',
  );
}

configureApiClient(apiUrl);

export function ApiClientBootstrap() {
  return null;
}
