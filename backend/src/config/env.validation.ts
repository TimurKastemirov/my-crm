import { z } from 'zod';

/**
 * Environment variable validation (§4.1 / §10 of the spec).
 * Plugged into ConfigModule.forRoot({ validate: validateEnv }) — the app
 * fails to start with a clear message if .env is invalid.
 */

/**
 * true only for 'true' / '1' / 'yes'. Unlike z.coerce.boolean(),
 * which treats any non-empty string (including 'false') as true.
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

  // JWT — required (Auth module, §6 of the spec). Secrets must be long random strings.
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('30d'),

  // Comma-separated list of origins, or '*' in dev.
  CORS_ORIGINS: z.string().default('*'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
