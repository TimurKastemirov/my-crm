import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * DataSource для TypeORM CLI (миграции). §4.1 / §5 ТЗ.
 *
 * В приложении подключение настраивается в PostgresModule (TypeOrmModule.forRootAsync)
 * с autoLoadEntities — этот файл нужен ТОЛЬКО для CLI-команд миграций.
 *
 * Определяем режим по расширению самого модуля:
 *  - dev через tsx  → data-source.ts → globs по src/**.ts
 *  - prod (собрано) → data-source.js → globs по dist/**.js
 */
const isTs = import.meta.url.endsWith('.ts');
const root = isTs ? 'src' : 'dist';
const ext = isTs ? 'ts' : 'js';

export const AppDataSource = new DataSource({
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

export default AppDataSource;
