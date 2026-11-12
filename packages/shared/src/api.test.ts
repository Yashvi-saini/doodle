import { describe, expect, it } from 'vitest';
import { CreateWordPackBody, ListWordPacksQuery, UpdateProfileBody } from './api.js';
import { Username } from './common.js';

describe('Username', () => {
  it.each(['abc', 'user_01', 'A'.repeat(20)])('accepts %s', (name) => {
    expect(Username.safeParse(name).success).toBe(true);
  });

  it.each(['ab', 'has space', 'émoji', 'A'.repeat(21)])('rejects %s', (name) => {
    expect(Username.safeParse(name).success).toBe(false);
  });
});

describe('UpdateProfileBody', () => {
  it('rejects an empty update', () => {
    expect(UpdateProfileBody.safeParse({}).success).toBe(false);
  });

  it('accepts a partial update', () => {
    expect(UpdateProfileBody.parse({ displayName: 'Yash' })).toEqual({ displayName: 'Yash' });
  });
});

describe('CreateWordPackBody', () => {
  it('applies defaults to the pack and its words', () => {
    const parsed = CreateWordPackBody.parse({
      slug: 'animals',
      name: 'Animals',
      words: [{ text: ' cat ' }],
    });
    expect(parsed).toEqual({
      slug: 'animals',
      name: 'Animals',
      language: 'en',
      visibility: 'private',
      words: [{ text: 'cat', difficulty: 2 }],
    });
  });
});

describe('ListWordPacksQuery', () => {
  it('coerces query-string values', () => {
    expect(ListWordPacksQuery.parse({ limit: '50', mine: 'true' })).toEqual({
      limit: 50,
      mine: true,
    });
  });
});
