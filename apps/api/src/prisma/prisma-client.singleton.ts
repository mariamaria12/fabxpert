import { PrismaClient } from '@prisma/client';
import { getPrismaDatabaseUrl } from './prisma-database-url';

const globalForPrisma = globalThis as unknown as { fabxpertPrisma?: PrismaClient };

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.fabxpertPrisma) {
    globalForPrisma.fabxpertPrisma = new PrismaClient({
      datasources: {
        db: {
          url: getPrismaDatabaseUrl(),
        },
      },
    });
  }

  return globalForPrisma.fabxpertPrisma;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (!globalForPrisma.fabxpertPrisma) {
    return;
  }

  await globalForPrisma.fabxpertPrisma.$disconnect();
  globalForPrisma.fabxpertPrisma = undefined;
}
