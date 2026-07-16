/**
 * Applies a Prisma `connection_limit` to a Postgres URL when missing.
 * Safe for session-mode Supabase pooler URLs (port 5432).
 */
export function withPrismaConnectionLimit(
  rawUrl: string,
  defaultLimit: number,
): string {
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(defaultLimit));
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function getDefaultPrismaConnectionLimit(): number {
  return process.env.NODE_ENV === 'production' ? 5 : 2;
}
