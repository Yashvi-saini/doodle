import type { ApiError } from '@doodle/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    const body: ApiError = {
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
    };
    return reply.status(404).send(body);
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const body: ApiError = {
        error: {
          code: 'VALIDATION',
          message: 'Request validation failed',
          details: error.validation,
        },
      };
      return reply.status(400).send(body);
    }

    if (error instanceof AppError) {
      const body: ApiError = {
        error: { code: error.code, message: error.message, details: error.details },
      };
      return reply.status(error.statusCode).send(body);
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ err: error, cause: error.cause }, 'response did not match schema');
    } else if (error.statusCode !== undefined && error.statusCode < 500) {
      const body: ApiError = { error: { code: 'VALIDATION', message: error.message } };
      return reply.status(error.statusCode).send(body);
    } else {
      request.log.error({ err: error }, 'unhandled error');
    }

    const body: ApiError = { error: { code: 'INTERNAL', message: 'Internal server error' } };
    return reply.status(500).send(body);
  });
}
