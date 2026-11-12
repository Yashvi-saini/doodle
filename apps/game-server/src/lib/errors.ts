import type { ErrorBody, ErrorCode } from '@doodle/shared';
import type { Logger } from './logger.js';

export class GameError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export function toErrorBody(error: unknown, logger: Logger): ErrorBody {
  if (error instanceof GameError) {
    return { code: error.code, message: error.message };
  }
  logger.error({ err: error }, 'unhandled error in socket handler');
  return { code: 'INTERNAL', message: 'Something went wrong' };
}
