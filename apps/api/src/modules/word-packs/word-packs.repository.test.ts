import { createDb, type DbHandle, inArray, runMigrations, wordPacks, words } from '@doodle/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWordPackRepository } from './word-packs.repository.js';

const url = process.env.TEST_DATABASE_URL;
const slugs = ['it-animals', 'it-food', 'it-secret'];

describe.skipIf(!url)('word pack repository (Postgres)', () => {
  let handle: DbHandle;

  beforeAll(async () => {
    await runMigrations(url as string);
    handle = createDb(url as string, { maxConnections: 2 });
    await handle.db.delete(wordPacks).where(inArray(wordPacks.slug, slugs));

    const inserted = await handle.db
      .insert(wordPacks)
      .values([
        { slug: 'it-animals', name: 'Animals', visibility: 'public' },
        { slug: 'it-food', name: 'Food', visibility: 'public', language: 'hi' },
        { slug: 'it-secret', name: 'Secret', visibility: 'private' },
      ])
      .returning({ id: wordPacks.id, slug: wordPacks.slug });

    const animals = inserted.find((row) => row.slug === 'it-animals');
    await handle.db.insert(words).values([
      { packId: animals!.id, text: 'cat' },
      { packId: animals!.id, text: 'dog' },
      { packId: animals!.id, text: 'ant' },
    ]);
  });

  afterAll(async () => {
    await handle.db.delete(wordPacks).where(inArray(wordPacks.slug, slugs));
    await handle.close();
  });

  it('counts words per pack and hides private packs', async () => {
    const repository = createWordPackRepository(handle.db);
    const rows = (await repository.listPublic({ limit: 100 })).filter((row) =>
      slugs.includes(row.slug),
    );

    expect(rows.map((row) => [row.slug, row.wordCount])).toEqual([
      ['it-animals', 3],
      ['it-food', 0],
    ]);
  });

  it('filters by language and pages by slug', async () => {
    const repository = createWordPackRepository(handle.db);

    const hindi = await repository.listPublic({ language: 'hi', limit: 100 });
    expect(hindi.map((row) => row.slug)).toContain('it-food');
    expect(hindi.map((row) => row.slug)).not.toContain('it-animals');

    const afterAnimals = await repository.listPublic({ afterSlug: 'it-animals', limit: 100 });
    expect(afterAnimals.map((row) => row.slug)).not.toContain('it-animals');
  });

  it('returns words sorted alphabetically', async () => {
    const repository = createWordPackRepository(handle.db);
    const [animals] = await repository.listPublic({ afterSlug: 'it-a', limit: 1 });
    const list = await repository.listWords(animals!.id);
    expect(list.map((word) => word.text)).toEqual(['ant', 'cat', 'dog']);
  });
});
