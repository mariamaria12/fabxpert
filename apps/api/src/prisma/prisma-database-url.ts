const DEFAULT_CONNECTION_LIMIT = process.env.NODE_ENV === 'production' ? '5' : '2';

export function getPrismaDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set');
  }

  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', DEFAULT_CONNECTION_LIMIT);
    }
    return url.toString();
  } catch {
    return raw;
  }
}
