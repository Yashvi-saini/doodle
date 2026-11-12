import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const rootEnv = new URL('../../.env', import.meta.url);
if (!process.env.CI && existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

if (process.env.CI && !process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be set in CI so database tests are not skipped');
}

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    fileParallelism: false,
  },
});
