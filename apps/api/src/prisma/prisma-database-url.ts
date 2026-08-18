const DEFAULT_CONNECTION_LIMIT = 5;

/** How many pooled connections the API is allowed against Supabase session mode. */
export function getPrismaConnectionLimit(): number {
  const configured = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).searchParams.get('connection_limit')
    : null;
  const parsed = configured ? Number.parseInt(configured, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONNECTION_LIMIT;
}

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
