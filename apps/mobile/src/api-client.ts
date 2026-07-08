import { configureApiClient, resolveApiBaseUrl } from '@fabxpert/shared';

configureApiClient(
  resolveApiBaseUrl(import.meta.env.VITE_API_URL, {
    production: import.meta.env.PROD,
    pageOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
  }),
);
