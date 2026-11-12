import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, timestamptz } from './columns.js';
import { reportReason, reportStatus } from './enums.js';
import { rounds } from './games.js';
import { users } from './users.js';

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id'),
    reportedUserId: uuid('reported_user_id').notNull(),
    roundId: uuid('round_id'),
    reason: reportReason('reason').notNull(),
    details: text('details'),
    status: reportStatus('status').notNull().default('open'),
    createdAt: createdAt(),
    resolvedAt: timestamptz('resolved_at'),
  },
  (t) => [
    foreignKey({
      name: 'reports_reporter_id_fkey',
      columns: [t.reporterId],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'reports_reported_user_id_fkey',
      columns: [t.reportedUserId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'reports_round_id_fkey',
      columns: [t.roundId],
      foreignColumns: [rounds.id],
    }).onDelete('set null'),
    check('reports_details_check', sql`length(${t.details}) <= 1000`),
    check('reports_check', sql`${t.reporterId} IS DISTINCT FROM ${t.reportedUserId}`),
    index('reports_open_idx')
      .on(t.createdAt)
      .where(sql`${t.status} = 'open'`),
    index('reports_reported_user_idx').on(t.reportedUserId),
  ],
);
