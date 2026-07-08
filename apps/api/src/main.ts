import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function parseAllowedOrigins(): string[] {
  const webAppUrl = process.env.WEB_APP_URL?.trim();
  if (!webAppUrl) {
    throw new Error('WEB_APP_URL environment variable is not set. Refusing to start.');
  }

  const origins = new Set<string>();

  for (const origin of webAppUrl.split(',')) {
    const trimmed = origin.trim();
    if (trimmed) {
      origins.add(trimmed);
    }
  }

  const mobileAppUrl = process.env.MOBILE_APP_URL?.trim();
  if (mobileAppUrl) {
    origins.add(mobileAppUrl);
  }

  if (origins.size === 0) {
    throw new Error('WEB_APP_URL must contain at least one origin. Refusing to start.');
  }

  return Array.from(origins);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  // Credentialed CORS requires explicit origins — wildcard is not allowed.
  // WEB_APP_URL accepts a comma-separated list (prod: web + mobile Vercel URLs).
  // MOBILE_APP_URL is optional; kept for local dev convenience (localhost:3001).
  app.enableCors({
    origin: parseAllowedOrigins(),
    credentials: true,
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
