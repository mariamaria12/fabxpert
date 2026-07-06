import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
