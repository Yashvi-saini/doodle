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
  /** Hosting platforms set PORT; GAME_SERVER_PORT wins when both are present. */
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  GAME_SERVER_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  /** Leave unset (or start with --memory) to keep rooms in memory, no Redis needed. */
  REDIS_URL: z.url().optional(),
  CORS_ORIGINS: csv,
  JWT_SECRET: z.string().min(32),
  /** Accept "dev:<uuid>:<name>" tokens in production. For demos only, until real auth lands. */
  ALLOW_DEV_TOKENS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  ROOM_TTL_S: z.coerce
    .number()
    .int()
    .min(60)
    .default(6 * 60 * 60),
});

export type GameServerConfig = Omit<z.infer<typeof EnvSchema>, 'PORT' | 'GAME_SERVER_PORT'> & {
  GAME_SERVER_PORT: number;
};

export function loadDotenv(): void {
  const rootEnv = new URL('../../../../.env', import.meta.url);
  if (process.env.NODE_ENV !== 'production' && existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }
}

export function parseConfig(env: NodeJS.ProcessEnv): GameServerConfig {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  const { PORT, GAME_SERVER_PORT, ...config } = result.data;
  return { ...config, GAME_SERVER_PORT: GAME_SERVER_PORT ?? PORT ?? 4001 };
}
