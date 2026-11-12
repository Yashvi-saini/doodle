import { z } from 'zod';

export const UserId = z.uuid();
export type UserId = z.infer<typeof UserId>;

export const Username = z.string().regex(/^[a-zA-Z0-9_]{3,20}$/, {
  message: 'Username must be 3-20 letters, numbers or underscores',
});

export const DisplayName = z.string().trim().min(1).max(40);

export const Slug = z.string().regex(/^[a-z0-9-]{3,50}$/, {
  message: 'Slug must be 3-50 lowercase letters, numbers or hyphens',
});

export const LanguageCode = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/);

export const IsoDateTime = z.iso.datetime({ offset: true });

export const EpochMs = z.int().nonnegative();

export const Empty = z.object({});
export type Empty = z.infer<typeof Empty>;

export const ErrorCode = z.enum([
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'GAME_IN_PROGRESS',
  'NOT_HOST',
  'NOT_DRAWER',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBody = z.object({
  code: ErrorCode,
  message: z.string(),
  details: z.unknown().optional(),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

export type AckResult<T> = { ok: true; data: T } | { ok: false; error: ErrorBody };

export const ackResult = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: ErrorBody }),
  ]);
