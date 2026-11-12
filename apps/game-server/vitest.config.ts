import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const rootEnv = new URL('../../.env', import.meta.url);
if (!process.env.CI && existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

if (process.env.CI && !process.env.TEST_REDIS_URL) {
  throw new Error('TEST_REDIS_URL must be set in CI so Redis tests are not skipped');
}

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
  },
});
