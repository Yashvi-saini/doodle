import { existsSync } from 'node:fs';
import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url(),
  CORS_ORIGINS: csv,
  JWT_SECRET: z.string().min(32),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadDotenv(): void {
  const rootEnv = new URL('../../../../.env', import.meta.url);
  if (process.env.NODE_ENV !== 'production' && existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }
}

export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
