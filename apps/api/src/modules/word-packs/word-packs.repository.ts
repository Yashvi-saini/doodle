import { and, asc, count, type Database, eq, gt, wordPacks, words } from '@doodle/db';

export interface WordPackRow {
  id: string;
  slug: string;
  name: string;
  language: string;
  visibility: 'public' | 'unlisted' | 'private';
  isOfficial: boolean;
  createdBy: string | null;
  updatedAt: Date;
  wordCount: number;
}

export interface WordRow {
  id: string;
  text: string;
  difficulty: number;
}

export interface ListPublicParams {
  language?: string | undefined;
  afterSlug?: string | undefined;
  limit: number;
}

export interface WordPackRepository {
  listPublic(params: ListPublicParams): Promise<WordPackRow[]>;
  findById(id: string): Promise<WordPackRow | null>;
  listWords(packId: string): Promise<WordRow[]>;
}

export function createWordPackRepository(db: Database): WordPackRepository {
  const selectSummaries = () =>
    db
      .select({
        id: wordPacks.id,
        slug: wordPacks.slug,
        name: wordPacks.name,
        language: wordPacks.language,
        visibility: wordPacks.visibility,
        isOfficial: wordPacks.isOfficial,
        createdBy: wordPacks.createdBy,
        updatedAt: wordPacks.updatedAt,
        wordCount: count(words.id),
      })
      .from(wordPacks)
      .leftJoin(words, eq(words.packId, wordPacks.id))
      .groupBy(wordPacks.id)
      .$dynamic();

  return {
    listPublic: ({ language, afterSlug, limit }) =>
      selectSummaries()
        .where(
          and(
            eq(wordPacks.visibility, 'public'),
            language ? eq(wordPacks.language, language) : undefined,
            afterSlug ? gt(wordPacks.slug, afterSlug) : undefined,
          ),
        )
        .orderBy(asc(wordPacks.slug))
        .limit(limit),

    findById: async (id) => {
      const [row] = await selectSummaries().where(eq(wordPacks.id, id)).limit(1);
      return row ?? null;
    },

    listWords: (packId) =>
      db
        .select({ id: words.id, text: words.text, difficulty: words.difficulty })
        .from(words)
        .where(eq(words.packId, packId))
        .orderBy(asc(words.text)),
  };
}
