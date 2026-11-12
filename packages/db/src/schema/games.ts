import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './columns.js';
import { gameStatus } from './enums.js';
import { users } from './users.js';
import { wordPacks, words } from './words.js';

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomCode: text('room_code').notNull(),
    hostId: uuid('host_id'),
    packId: uuid('pack_id'),
    status: gameStatus('status').notNull(),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamptz('started_at').notNull(),
    endedAt: timestamptz('ended_at').notNull(),
  },
  (t) => [
    foreignKey({
      name: 'games_host_id_fkey',
      columns: [t.hostId],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'games_pack_id_fkey',
      columns: [t.packId],
      foreignColumns: [wordPacks.id],
    }).onDelete('set null'),
    check('games_check', sql`${t.endedAt} >= ${t.startedAt}`),
    index('games_started_at_idx').on(t.startedAt.desc().nullsFirst()),
    index('games_host_idx').on(t.hostId),
  ],
);

export const gamePlayers = pgTable(
  'game_players',
  {
    gameId: uuid('game_id').notNull(),
    userId: uuid('user_id').notNull(),
    finalScore: integer('final_score').notNull().default(0),
    finalRank: smallint('final_rank'),
    joinedAt: timestamptz('joined_at').notNull(),
    leftAt: timestamptz('left_at'),
  },
  (t) => [
    primaryKey({ name: 'game_players_pkey', columns: [t.gameId, t.userId] }),
    foreignKey({
      name: 'game_players_game_id_fkey',
      columns: [t.gameId],
      foreignColumns: [games.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'game_players_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    index('game_players_user_idx').on(t.userId, t.joinedAt.desc().nullsFirst()),
  ],
);

export const rounds = pgTable(
  'rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id').notNull(),
    roundNumber: smallint('round_number').notNull(),
    turnNumber: smallint('turn_number').notNull(),
    drawerId: uuid('drawer_id'),
    wordId: uuid('word_id'),
    wordText: text('word_text').notNull(),
    drawingKey: text('drawing_key'),
    startedAt: timestamptz('started_at').notNull(),
    endedAt: timestamptz('ended_at').notNull(),
  },
  (t) => [
    foreignKey({
      name: 'rounds_game_id_fkey',
      columns: [t.gameId],
      foreignColumns: [games.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'rounds_drawer_id_fkey',
      columns: [t.drawerId],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'rounds_word_id_fkey',
      columns: [t.wordId],
      foreignColumns: [words.id],
    }).onDelete('set null'),
    check('rounds_round_number_check', sql`${t.roundNumber} >= 1`),
    check('rounds_turn_number_check', sql`${t.turnNumber} >= 1`),
    unique('rounds_game_id_round_number_turn_number_key').on(t.gameId, t.roundNumber, t.turnNumber),
    index('rounds_drawer_idx').on(t.drawerId),
    index('rounds_word_idx').on(t.wordId),
  ],
);

export const roundResults = pgTable(
  'round_results',
  {
    roundId: uuid('round_id').notNull(),
    userId: uuid('user_id').notNull(),
    guessed: boolean('guessed').notNull(),
    guessTimeMs: integer('guess_time_ms'),
    points: integer('points').notNull().default(0),
  },
  (t) => [
    primaryKey({ name: 'round_results_pkey', columns: [t.roundId, t.userId] }),
    foreignKey({
      name: 'round_results_round_id_fkey',
      columns: [t.roundId],
      foreignColumns: [rounds.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'round_results_user_id_fkey',
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete('cascade'),
    check('round_results_guess_time_ms_check', sql`${t.guessTimeMs} >= 0`),
    check('round_results_points_check', sql`${t.points} >= 0`),
    check('round_results_check', sql`${t.guessed} OR ${t.guessTimeMs} IS NULL`),
    index('round_results_user_idx').on(t.userId),
  ],
);
