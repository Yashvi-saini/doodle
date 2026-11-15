import type { LeaderboardEntry, Player } from '@doodle/shared';

export const DRAWER_POINTS_PER_GUESS = 50;

const HIDDEN = '_';
const isLetter = (char: string) => /[\p{L}\p{N}]/u.test(char);

/** Lower-cases, strips punctuation and collapses whitespace so "Ice-Cream!" matches "ice cream". */
export function normaliseGuess(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function isCorrectGuess(guess: string, word: string): boolean {
  return normaliseGuess(guess) === normaliseGuess(word);
}

/** One edit away (insert, delete or substitute), ignoring case and punctuation. */
export function isCloseGuess(guess: string, word: string): boolean {
  const a = normaliseGuess(guess);
  const b = normaliseGuess(word);
  if (a === b || Math.abs(a.length - b.length) > 1 || b.length < 4) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (a.length < b.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** "ice cream" -> "___ _____" */
export function maskWord(word: string): string {
  return [...word].map((char) => (isLetter(char) ? HIDDEN : char)).join('');
}

/** Hints never give away more than half of the letters. */
export function maxReveals(word: string): number {
  return Math.floor([...word].filter(isLetter).length / 2);
}

export function revealLetter(
  word: string,
  hint: string,
  random: (max: number) => number = (max) => Math.floor(Math.random() * max),
): string {
  const chars = [...hint];
  const letters = [...word];
  const hidden = chars.flatMap((char, index) => (char === HIDDEN ? [index] : []));
  if (hidden.length === 0) return hint;
  const index = hidden[random(hidden.length)]!;
  chars[index] = letters[index]!;
  return chars.join('');
}

/** Faster guesses score more: 300 at the start of the turn down to 100 at the buzzer. */
export function guessPoints(remainingMs: number, totalMs: number): number {
  const fraction = totalMs > 0 ? Math.min(Math.max(remainingMs / totalMs, 0), 1) : 0;
  return Math.round(100 + 200 * fraction);
}

export function leaderboard(players: readonly Player[]): LeaderboardEntry[] {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return sorted.map((player, index) => {
    const firstWithScore = sorted.findIndex((other) => other.score === player.score);
    return {
      userId: player.userId,
      score: player.score,
      rank: (firstWithScore === -1 ? index : firstWithScore) + 1,
    };
  });
}
