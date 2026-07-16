import { PrismaClient } from '@prisma/client';
import { withPrismaConnectionLimit } from '../src/prisma-database-url';

/** Short-lived seed/script clients — one connection is enough. */
export function createSeedPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return new PrismaClient();
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: withPrismaConnectionLimit(rawUrl, 1),
      },
    },
  });
}
