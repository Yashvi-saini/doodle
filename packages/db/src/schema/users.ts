import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, timestamptz, updatedAt } from './columns.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    isBanned: boolean('is_banned').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamptz('deleted_at'),
  },
  (t) => [
    check('users_username_check', sql`${t.username} ~ '^[a-zA-Z0-9_]{3,20}$'`),
    check('users_display_name_check', sql`length(${t.displayName}) BETWEEN 1 AND 40`),
    uniqueIndex('users_username_lower_uq').using('btree', sql`lower(${t.username})`),
  ],
);

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'auth_identities_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    check('auth_identities_provider_check', sql`${t.provider} IN ('google', 'apple', 'guest')`),
    unique('auth_identities_provider_provider_user_id_key').on(t.provider, t.providerUserId),
    index('auth_identities_user_idx').on(t.userId),
  ],
);

export const userStats = pgTable(
  'user_stats',
  {
    userId: uuid('user_id').primaryKey(),
    gamesPlayed: integer('games_played').notNull().default(0),
    gamesWon: integer('games_won').notNull().default(0),
    totalScore: bigint('total_score', { mode: 'number' }).notNull().default(0),
    correctGuesses: integer('correct_guesses').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: 'user_stats_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    check('user_stats_games_played_check', sql`${t.gamesPlayed} >= 0`),
    check('user_stats_games_won_check', sql`${t.gamesWon} >= 0`),
    check('user_stats_total_score_check', sql`${t.totalScore} >= 0`),
    check('user_stats_correct_guesses_check', sql`${t.correctGuesses} >= 0`),
    index('user_stats_leaderboard_idx').on(t.totalScore.desc().nullsFirst()),
  ],
);
