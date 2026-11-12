import { pgEnum } from 'drizzle-orm/pg-core';

export const visibility = pgEnum('visibility', ['public', 'unlisted', 'private']);

export const gameStatus = pgEnum('game_status', ['finished', 'abandoned']);

export const reportReason = pgEnum('report_reason', [
  'inappropriate_drawing',
  'offensive_chat',
  'cheating',
  'spam',
  'other',
]);

export const reportStatus = pgEnum('report_status', ['open', 'reviewed', 'actioned', 'dismissed']);
