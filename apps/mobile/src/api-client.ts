import { configureApiClient } from '@fabxpert/shared';

const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error(
    'VITE_API_URL is not set. Add it to apps/mobile/.env (see .env.example).',
  );
}

configureApiClient(apiUrl);
