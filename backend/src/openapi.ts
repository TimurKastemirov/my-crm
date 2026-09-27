import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { buildOpenApiConfig } from './config/swagger.config.js';

/**
 * Оффлайн-экспорт OpenAPI-спеки в openapi.json (для клиентской кодогенерации и ревью).
 * Preview-режим не инстанцирует провайдеры и не подключается к БД/Redis.
 * Запуск: npm run openapi (backend).
 */
async function generate(): Promise<void> {
  // preview: не инстанцируем провайдеры (нет коннекта к БД/Redis).
  // ExpressAdapter передаём явно — иначе в preview нет HTTP-драйвера для сканера маршрутов.
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    preview: true,
    logger: false,
  });
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  writeFileSync('openapi.json', JSON.stringify(document, null, 2));
  const paths = Object.keys(document.paths ?? {});
  // eslint-disable-next-line no-console
  console.log(`OpenAPI сгенерирован: ${paths.length} путей → openapi.json`);
  await app.close();
}

void generate().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
