import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { configureApp } from '../../src/app.setup.js';

/**
 * DB-backed e2e suites run only against an explicitly configured test database
 * (NODE_ENV=test + POSTGRES_* in the process env, as in CI) — never against the dev DB
 * from backend/.env by accident. Without it they are skipped.
 */
export const hasE2eDatabase =
  process.env.NODE_ENV === 'test' && Boolean(process.env.POSTGRES_DB);

/** Boots the full AppModule like main.ts does, with migrations applied and rate limits off. */
export async function createE2eApp(): Promise<INestApplication> {
  process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret-0123456789';
  process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-0123456789';
  // Like prod behind nginx: one trusted proxy hop, so X-Forwarded-For sets the client IP.
  process.env.TRUST_PROXY_HOPS ??= '1';
  await runMigrations();

  const { AppModule } = await import('../../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication(new ExpressAdapter());
  configureApp(app);
  // Listen explicitly on IPv4: supertest's implicit ephemeral listen() is flaky on Node 24 (ECONNREFUSED).
  await app.listen(0, '127.0.0.1');
  return app;
}

/** Applies every migration from src/migrations (idempotent: already applied ones are skipped). */
async function runMigrations(): Promise<void> {
  const dir = fileURLToPath(new URL('../../src/migrations/', import.meta.url));
  const migrations: Array<new () => unknown> = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .sort()) {
    const mod = (await import(pathToFileURL(join(dir, file)).href)) as Record<
      string,
      unknown
    >;
    for (const value of Object.values(mod)) {
      if (typeof value === 'function')
        migrations.push(value as new () => unknown);
    }
  }
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    migrations,
  });
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
