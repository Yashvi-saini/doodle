import { ApiError, HealthResponse } from '@doodle/shared';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';

export const healthRoutes: FastifyPluginCallbackZod<{ ping: () => Promise<void> }> = (
  app,
  { ping },
  done,
) => {
  app.get('/health', { schema: { response: { 200: HealthResponse } } }, () => ({
    status: 'ok' as const,
    uptimeS: process.uptime(),
  }));

  app.get(
    '/ready',
    { schema: { response: { 200: HealthResponse, 503: ApiError } } },
    async (request, reply) => {
      try {
        await ping();
        return { status: 'ok' as const, uptimeS: process.uptime() };
      } catch (error) {
        request.log.warn({ err: error }, 'readiness check failed');
        return reply
          .status(503)
          .send({ error: { code: 'INTERNAL', message: 'Database unavailable' } });
      }
    },
  );

  done();
};
