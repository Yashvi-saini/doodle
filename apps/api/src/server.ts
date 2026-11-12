import { createDb } from '@doodle/db';
import { buildApp } from './app.js';
import { loadDotenv, parseConfig } from './config/env.js';
import { createWordPackRepository } from './modules/word-packs/word-packs.repository.js';

loadDotenv();
const config = parseConfig(process.env);
const database = createDb(config.DATABASE_URL);

const app = await buildApp({
  config,
  ping: database.ping,
  repositories: {
    wordPacks: createWordPackRepository(database.db),
  },
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down');
  try {
    await app.close();
    await database.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'error during shutdown');
    process.exit(1);
  }
}

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

try {
  await app.listen({ host: config.HOST, port: config.API_PORT });
} catch (error) {
  app.log.fatal({ err: error }, 'failed to start');
  await database.close();
  process.exit(1);
}
