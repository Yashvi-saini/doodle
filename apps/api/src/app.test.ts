import { ApiError, WordPackDetail, WordPackList } from '@doodle/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import { parseConfig } from './config/env.js';
import type {
  WordPackRepository,
  WordPackRow,
} from './modules/word-packs/word-packs.repository.js';

const config = parseConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://doodle:doodle@localhost:5432/doodle',
  JWT_SECRET: 'x'.repeat(32),
});

const pack = (overrides: Partial<WordPackRow> = {}): WordPackRow => ({
  id: '0b8f2a8e-6f3c-4c55-9f43-3f8c7c0f2a11',
  slug: 'animals',
  name: 'Animals',
  language: 'en',
  visibility: 'public',
  isOfficial: true,
  createdBy: null,
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  wordCount: 2,
  ...overrides,
});

const fakeRepository = (rows: WordPackRow[]): WordPackRepository => ({
  listPublic: vi.fn<WordPackRepository['listPublic']>(({ limit }) =>
    Promise.resolve(rows.slice(0, limit)),
  ),
  findById: vi.fn<WordPackRepository['findById']>((id) =>
    Promise.resolve(rows.find((row) => row.id === id) ?? null),
  ),
  listWords: vi.fn<WordPackRepository['listWords']>(() =>
    Promise.resolve([
      { id: '5d1c3e0a-0e4b-4f7e-8d1a-2b3c4d5e6f70', text: 'cat', difficulty: 1 },
      { id: '6e2d4f1b-1f5c-4a8f-9e2b-3c4d5e6f7a81', text: 'dog', difficulty: 1 },
    ]),
  ),
});

let app: FastifyInstance | undefined;

async function start(rows: WordPackRow[] = [], ping = () => Promise.resolve()) {
  app = await buildApp({ config, ping, repositories: { wordPacks: fakeRepository(rows) } });
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('health', () => {
  it('reports liveness', async () => {
    const response = await (await start()).inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('reports not ready when the database is down', async () => {
    const server = await start([], () => Promise.reject(new Error('down')));
    const response = await server.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(503);
    expect(ApiError.parse(response.json()).error.code).toBe('INTERNAL');
  });
});

describe('word packs', () => {
  it('lists public packs with a cursor for the next page', async () => {
    const rows = [pack(), pack({ id: '1c9e3b9f-7a4d-4d66-8a54-4a9d8d1a3b22', slug: 'food' })];
    const server = await start(rows);
    const response = await server.inject({ method: 'GET', url: '/v1/word-packs?limit=1' });

    expect(response.statusCode).toBe(200);
    const body = WordPackList.parse(response.json());
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBe('animals');
  });

  it('rejects an invalid query with a VALIDATION error', async () => {
    const response = await (
      await start()
    ).inject({
      method: 'GET',
      url: '/v1/word-packs?limit=500',
    });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error.code).toBe('VALIDATION');
  });

  it('returns a pack with its words', async () => {
    const response = await (
      await start([pack()])
    ).inject({
      method: 'GET',
      url: `/v1/word-packs/${pack().id}`,
    });
    expect(response.statusCode).toBe(200);
    expect(WordPackDetail.parse(response.json()).words.map((word) => word.text)).toEqual([
      'cat',
      'dog',
    ]);
  });

  it('hides private packs', async () => {
    const response = await (
      await start([pack({ visibility: 'private' })])
    ).inject({
      method: 'GET',
      url: `/v1/word-packs/${pack().id}`,
    });
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error.code).toBe('NOT_FOUND');
  });
});

describe('unimplemented and unknown routes', () => {
  it('returns 501 for endpoints planned for later phases', async () => {
    const response = await (
      await start()
    ).inject({
      method: 'POST',
      url: '/v1/auth/guest',
      payload: { displayName: 'Yash' },
    });
    expect(response.statusCode).toBe(501);
    expect(ApiError.parse(response.json()).error.code).toBe('NOT_IMPLEMENTED');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await (await start()).inject({ method: 'GET', url: '/nope' });
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error.code).toBe('NOT_FOUND');
  });
});
