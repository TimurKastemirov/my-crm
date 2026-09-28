import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * DataSource for the TypeORM CLI (migrations). §4.1 / §5 of the spec.
 *
 * In the app, the connection is configured in PostgresModule (TypeOrmModule.forRootAsync)
 * with autoLoadEntities — this file is needed ONLY for migration CLI commands.
 *
 * We detect the mode from the module's own extension:
 *  - dev via tsx    → data-source.ts → globs over src/**.ts
 *  - prod (built)   → data-source.js → globs over dist/**.js
 */
const isTs = import.meta.url.endsWith('.ts');
const root = isTs ? 'src' : 'dist';
const ext = isTs ? 'ts' : 'js';

// TypeORM CLI requires EXACTLY one DataSource export — default only.
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  synchronize: false,
  logging: process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'development',
  entities: [`${root}/**/*.entity.${ext}`],
  migrations: [`${root}/migrations/*.${ext}`],
});

export default dataSource;
