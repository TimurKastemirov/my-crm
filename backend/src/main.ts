import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { setupSwagger } from './config/swagger.config.js';

async function bootstrap() {
  // ExpressAdapter передаём явно: в ESM-сборке авто-детект HTTP-платформы Nest не срабатывает.
  const app = await NestFactory.create(AppModule, new ExpressAdapter());

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
