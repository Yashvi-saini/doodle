import { existsSync } from 'node:fs';
import { runMigrations } from '../migrate.js';

const rootEnv = new URL('../../../../.env', import.meta.url);
if (!process.env.DATABASE_URL && existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('DATABASE_URL is not set\n');
  process.exit(1);
}

try {
  await runMigrations(url);
  process.stdout.write('Migrations applied\n');
} catch (error) {
  process.stderr.write(`Migration failed: ${String(error)}\n`);
  process.exit(1);
}
