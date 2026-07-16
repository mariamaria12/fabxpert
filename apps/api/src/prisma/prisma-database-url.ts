const DEFAULT_CONNECTION_LIMIT = process.env.NODE_ENV === 'production' ? 5 : 2;

/**
 * Ensures DATABASE_URL has an explicit Prisma connection_limit so Nest
 * cannot open the default pool size (num_cpus*2+1) against Supabase session mode.
 */
export function getPrismaDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set');
  }

  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(DEFAULT_CONNECTION_LIMIT));
    }
    return url.toString();
  } catch {
    return raw;
  }
}
