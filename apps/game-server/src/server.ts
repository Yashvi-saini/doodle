import { createServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { createGameServer } from './app.js';
import { createDevTokenVerifier, createRejectingTokenVerifier } from './auth/token-verifier.js';
import { loadDotenv, parseConfig } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { createMemoryRoomRepository } from './repositories/memory-room.repository.js';
import { createRedisRoomRepository } from './repositories/redis-room.repository.js';

loadDotenv();
const config = parseConfig(process.env);
const logger = createLogger(config);

// `--memory` runs a single instance with no Redis, which is all a local demo needs.
const redisUrl = process.argv.includes('--memory') ? undefined : config.REDIS_URL;
const redis = redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: 3 }) : null;
const subscriber = redis?.duplicate() ?? null;
redis?.on('error', (error) => logger.error({ err: error }, 'redis error'));
subscriber?.on('error', (error) => logger.error({ err: error }, 'redis subscriber error'));

const httpServer = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    const healthy = !redis || redis.status === 'ready';
    response.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        status: healthy ? 'ok' : 'degraded',
        store: redis ? 'redis' : 'memory',
        uptimeS: process.uptime(),
      }),
    );
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
});

const io = createGameServer(httpServer, {
  config,
  logger,
  roomRepository: redis
    ? createRedisRoomRepository(redis, { ttlSeconds: config.ROOM_TTL_S })
    : createMemoryRoomRepository(),
  verifier:
    config.NODE_ENV === 'production' ? createRejectingTokenVerifier() : createDevTokenVerifier(),
});
if (redis && subscriber) {
  io.adapter(createAdapter(redis, subscriber));
}

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  try {
    await io.close();
    await Promise.allSettled([redis?.quit(), subscriber?.quit()]);
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'error during shutdown');
    process.exit(1);
  }
}

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

httpServer.listen(config.GAME_SERVER_PORT, config.HOST, () => {
  logger.info(
    { port: config.GAME_SERVER_PORT, store: redis ? 'redis' : 'memory' },
    'game server listening',
  );
});
