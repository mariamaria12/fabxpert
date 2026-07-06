import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  // Credentialed CORS requires explicit origins — wildcard is not allowed.
  const webAppUrl = process.env.WEB_APP_URL;
  const mobileAppUrl = process.env.MOBILE_APP_URL;
  if (!webAppUrl) {
    throw new Error('WEB_APP_URL environment variable is not set. Refusing to start.');
  }
  if (!mobileAppUrl) {
    throw new Error('MOBILE_APP_URL environment variable is not set. Refusing to start.');
  }
  app.enableCors({
    origin: [webAppUrl, mobileAppUrl],
    credentials: true,
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
