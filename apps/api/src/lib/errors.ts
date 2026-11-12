import type { ErrorCode } from '@doodle/shared';

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  GAME_IN_PROGRESS: 409,
  NOT_HOST: 403,
  NOT_DRAWER: 403,
  NOT_IMPLEMENTED: 501,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusByCode[code];
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', `${what} not found`);

export const notImplemented = (feature: string) =>
  new AppError('NOT_IMPLEMENTED', `${feature} is not implemented yet`);
