import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { setupSwagger } from './config/swagger.config.js';

async function bootstrap() {
  // Pass ExpressAdapter explicitly: Nest's HTTP platform auto-detection doesn't work in the ESM build.
  const app = await NestFactory.create(AppModule, new ExpressAdapter());

  configureApp(app);
  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
