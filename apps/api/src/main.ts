import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { disconnectPrismaClient } from './prisma/prisma-client.singleton';

/** Normalize env origin values (trim, strip wrapping quotes, no trailing slash). */
function normalizeOrigin(value: string): string {
  let origin = value.trim();
  if (
    (origin.startsWith('"') && origin.endsWith('"')) ||
    (origin.startsWith("'") && origin.endsWith("'"))
  ) {
    origin = origin.slice(1, -1).trim();
  }
  return origin.replace(/\/+$/, '');
}

function parseAllowedOrigins(): string[] {
  const webAppUrl = process.env.WEB_APP_URL?.trim();
  if (!webAppUrl) {
    throw new Error('WEB_APP_URL environment variable is not set. Refusing to start.');
  }

  const origins = new Set<string>();

  for (const origin of webAppUrl.split(',')) {
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      origins.add(normalized);
    }
  }

  const mobileAppUrl = process.env.MOBILE_APP_URL?.trim();
  if (mobileAppUrl) {
    origins.add(normalizeOrigin(mobileAppUrl));
  }

  if (origins.size === 0) {
    throw new Error('WEB_APP_URL must contain at least one origin. Refusing to start.');
  }

  return Array.from(origins);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Required so SIGTERM/SIGINT run Nest OnModuleDestroy (Prisma $disconnect).
  app.enableShutdownHooks();
  app.use(cookieParser());

  // Credentialed CORS requires explicit origins — wildcard is not allowed.
  // WEB_APP_URL accepts a comma-separated list (prod: web + mobile Vercel URLs).
  // MOBILE_APP_URL is optional; kept for local dev convenience (localhost:3001).
  const allowedOrigins = parseAllowedOrigins();
  app.enableCors({
    origin(origin, callback) {
      // Non-browser clients (curl, healthchecks) may omit Origin.
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap().catch(async (error) => {
  console.error(error);
  await disconnectPrismaClient();
  process.exit(1);
});
