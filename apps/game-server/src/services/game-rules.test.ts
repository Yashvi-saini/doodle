import { describe, expect, it } from 'vitest';
import {
  guessPoints,
  isCloseGuess,
  isCorrectGuess,
  leaderboard,
  maskWord,
  maxReveals,
  normaliseGuess,
  revealLetter,
} from './game-rules.js';
import { pickWords } from './words.js';

const player = (userId: string, score: number) => ({
  userId,
  displayName: userId,
  avatarUrl: null,
  score,
  isConnected: true,
  hasGuessed: false,
});

describe('guess matching', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(normaliseGuess('  Ice-Cream!! ')).toBe('ice cream');
    expect(isCorrectGuess('ICE   cream', 'ice cream')).toBe(true);
    expect(isCorrectGuess('ice', 'ice cream')).toBe(false);
  });

  it('flags guesses one edit away as close', () => {
    expect(isCloseGuess('pengin', 'penguin')).toBe(true);
    expect(isCloseGuess('penguins', 'penguin')).toBe(true);
    expect(isCloseGuess('pinguin', 'penguin')).toBe(true);
    expect(isCloseGuess('pengiun', 'penguin')).toBe(false);
    expect(isCloseGuess('penguin', 'penguin')).toBe(false);
    expect(isCloseGuess('cot', 'cat')).toBe(false);
  });
});

describe('hints', () => {
  it('masks letters but keeps spaces', () => {
    expect(maskWord('hot dog')).toBe('___ ___');
  });

  it('reveals one hidden letter at a time, at most half the word', () => {
    expect(revealLetter('hot dog', '___ ___', () => 0)).toBe('h__ ___');
    expect(revealLetter('hot dog', 'h__ ___', () => 0)).toBe('ho_ ___');
    expect(maxReveals('hot dog')).toBe(3);
  });
});

describe('scoring', () => {
  it('rewards faster guesses', () => {
    expect(guessPoints(60_000, 60_000)).toBe(300);
    expect(guessPoints(0, 60_000)).toBe(100);
    expect(guessPoints(-5, 60_000)).toBe(100);
  });

  it('ranks players and shares ranks on ties', () => {
    const ranks = leaderboard([player('a', 100), player('b', 300), player('c', 100)]);
    expect(ranks.map((entry) => [entry.userId, entry.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
    ]);
  });
});

describe('pickWords', () => {
  it('returns distinct words', () => {
    expect(new Set(pickWords(3)).size).toBe(3);
  });
});
