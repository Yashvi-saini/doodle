import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { AppConfig } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { profileRoutes } from './modules/profiles/profiles.routes.js';
import type { WordPackRepository } from './modules/word-packs/word-packs.repository.js';
import { wordPackRoutes } from './modules/word-packs/word-packs.routes.js';
import { createWordPackService } from './modules/word-packs/word-packs.service.js';
import { registerErrorHandler } from './plugins/error-handler.js';

export interface AppDeps {
  config: AppConfig;
  ping: () => Promise<void>;
  repositories: {
    wordPacks: WordPackRepository;
  };
}

function loggerOptions(config: AppConfig): FastifyServerOptions['logger'] {
  if (config.NODE_ENV === 'test') return false;
  if (config.NODE_ENV === 'development') {
    return {
      level: config.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    };
  }
  return { level: config.LOG_LEVEL, redact: ['req.headers.authorization'] };
}

export async function buildApp({ config, ping, repositories }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(config),
    trustProxy: true,
    bodyLimit: 512 * 1024,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false,
  });

  await app.register(healthRoutes, { ping });
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(profileRoutes, { prefix: '/v1' });
  await app.register(wordPackRoutes, {
    prefix: '/v1/word-packs',
    service: createWordPackService(repositories.wordPacks),
  });

  return app;
}
