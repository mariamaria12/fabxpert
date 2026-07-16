import { PrismaClient } from '@prisma/client';
import {
  getDefaultPrismaConnectionLimit,
  withPrismaConnectionLimit,
} from './prisma-database-url';

// Prevent multiple PrismaClient instances in development due to hot-reloading.
const globalForPrisma = globalThis as unknown as { fabxpertDbPrisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return new PrismaClient();
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: withPrismaConnectionLimit(rawUrl, getDefaultPrismaConnectionLimit()),
      },
    },
  });
}

export const prisma = globalForPrisma.fabxpertDbPrisma ?? createPrismaClient();

// Always cache on globalThis so hot-reload (dev) and accidental re-imports
// do not open uncapped extra pools against Supabase session mode.
globalForPrisma.fabxpertDbPrisma = prisma;

export default prisma;
