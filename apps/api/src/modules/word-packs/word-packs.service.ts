import type {
  ListWordPacksQuery,
  WordPackDetail,
  WordPackList,
  WordPackSummary,
} from '@doodle/shared';
import { AppError, notFound } from '../../lib/errors.js';
import type { WordPackRepository, WordPackRow } from './word-packs.repository.js';

export interface WordPackService {
  list(query: ListWordPacksQuery): Promise<WordPackList>;
  get(id: string): Promise<WordPackDetail>;
}

const toSummary = (row: WordPackRow): WordPackSummary => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  language: row.language,
  visibility: row.visibility,
  isOfficial: row.isOfficial,
  createdBy: row.createdBy,
  wordCount: row.wordCount,
  updatedAt: row.updatedAt.toISOString(),
});

export function createWordPackService(repository: WordPackRepository): WordPackService {
  return {
    async list(query) {
      if (query.mine) {
        throw new AppError('UNAUTHORIZED', 'Sign in to list your own word packs');
      }

      const rows = await repository.listPublic({
        language: query.language,
        afterSlug: query.cursor,
        limit: query.limit + 1,
      });
      const items = rows.slice(0, query.limit).map(toSummary);
      const last = items[items.length - 1];

      return { items, nextCursor: rows.length > query.limit && last ? last.slug : null };
    },

    async get(id) {
      const pack = await repository.findById(id);
      if (!pack || pack.visibility === 'private') {
        throw notFound('Word pack');
      }
      const words = await repository.listWords(id);
      return { ...toSummary(pack), words };
    },
  };
}
