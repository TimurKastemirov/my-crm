import { z } from 'zod';

/**
 * Валидация переменных окружения (§4.1 / §10 ТЗ).
 * Подключается в ConfigModule.forRoot({ validate: validateEnv }) — приложение
 * падает на старте с понятным сообщением, если .env некорректен.
 */

/**
 * true только для 'true' / '1' / 'yes'. В отличие от z.coerce.boolean(),
 * который считает истиной любую непустую строку (включая 'false').
 */
const zBool = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['local', 'development', 'test', 'production'])
    .default('local'),
  PORT: z.coerce.number().int().positive().default(3000),

  POSTGRES_HOST: z.string().min(1).default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),

  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_TLS_ENABLED: zBool,
  REDIS_PASSWORD: z.string().optional(),

  // JWT — обязательны (модуль Auth, §6 ТЗ). Секреты — длинные случайные строки.
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('30d'),

  // Список origin через запятую, либо '*' в dev.
  CORS_ORIGINS: z.string().default('*'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Некорректные переменные окружения:\n${issues}`);
  }
  return parsed.data;
}
