import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns.js';
import { visibility } from './enums.js';
import { users } from './users.js';

export const wordPacks = pgTable(
  'word_packs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    language: text('language').notNull().default('en'),
    visibility: visibility('visibility').notNull().default('private'),
    isOfficial: boolean('is_official').notNull().default(false),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: 'word_packs_created_by_fkey',
      columns: [t.createdBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    unique('word_packs_slug_key').on(t.slug),
    check('word_packs_slug_check', sql`${t.slug} ~ '^[a-z0-9-]{3,50}$'`),
    index('word_packs_creator_idx').on(t.createdBy),
    index('word_packs_public_idx')
      .on(t.language)
      .where(sql`${t.visibility} = 'public'`),
  ],
);

export const words = pgTable(
  'words',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    packId: uuid('pack_id').notNull(),
    text: text('text').notNull(),
    difficulty: smallint('difficulty').notNull().default(2),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'words_pack_id_fkey',
      columns: [t.packId],
      foreignColumns: [wordPacks.id],
    }).onDelete('cascade'),
    check('words_text_check', sql`length(${t.text}) BETWEEN 1 AND 40`),
    check('words_difficulty_check', sql`${t.difficulty} BETWEEN 1 AND 3`),
    uniqueIndex('words_pack_text_uq').using('btree', t.packId, sql`lower(${t.text})`),
  ],
);
