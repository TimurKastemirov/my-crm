import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { buildOpenApiConfig } from './config/swagger.config.js';

/**
 * Offline export of the OpenAPI spec to openapi.json (for client codegen and review).
 * Preview mode doesn't instantiate providers and doesn't connect to the DB/Redis.
 * Run: npm run openapi (backend).
 */
async function generate(): Promise<void> {
  // preview: providers aren't instantiated (no DB/Redis connection).
  // Pass ExpressAdapter explicitly — otherwise there's no HTTP driver for the route scanner in preview.
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    preview: true,
    logger: false,
  });
  app.setGlobalPrefix('api/v1'); // so spec paths match runtime (/api/v1/...)
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  writeFileSync('openapi.json', JSON.stringify(document, null, 2));
  const paths = Object.keys(document.paths ?? {});
  // eslint-disable-next-line no-console
  console.log(`OpenAPI generated: ${paths.length} paths → openapi.json`);
  await app.close();
}

void generate().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
