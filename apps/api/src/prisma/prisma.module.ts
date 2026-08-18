import { Global, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { disconnectPrismaClient, getPrismaClient } from './prisma-client.singleton';
import { getPrismaConnectionLimit } from './prisma-database-url';
import { PrismaService } from './prisma.service';

/** Long enough that the queries overlap and each has to take its own connection. */
const WARMUP_HOLD_SECONDS = 0.05;

/**
 * Opens the whole pool at startup.
 *
 * Prisma connects lazily — `$connect()` opens one connection, and every further
 * concurrent query opens its own on the spot. Against a hosted Postgres that
 * handshake costs the better part of a second, and it lands in the middle of a
 * user's request: a page that fires two queries at once pays it for the second.
 * Overlapping N trivial queries here forces those connections open while nobody
 * is waiting.
 */
async function warmConnectionPool(client: PrismaClient, size: number): Promise<void> {
  await Promise.all(
    Array.from({ length: size }, () =>
      // Cast: pg_sleep returns void, which Prisma cannot deserialize.
      client.$queryRaw`SELECT pg_sleep(${WARMUP_HOLD_SECONDS})::text`,
    ),
  );
}

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => getPrismaClient(),
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaModule.name);

  async onModuleInit(): Promise<void> {
    const client = getPrismaClient();
    await client.$connect();

    const poolSize = getPrismaConnectionLimit();
    const startedAt = Date.now();
    try {
      await warmConnectionPool(client, poolSize);
      this.logger.log(
        `Connection pool warm: ${poolSize} connections in ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      // Never block startup on this — a cold pool is slow, not broken.
      this.logger.warn(
        `Could not warm the connection pool: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await disconnectPrismaClient();
  }
}
