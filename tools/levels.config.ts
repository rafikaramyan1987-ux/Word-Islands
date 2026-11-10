import type { Lang } from '../src/core/alphabet';

/** Number of levels on each island, per language. Phase A ships a 3-level preview. */
export const ISLAND_LEVELS: Partial<Record<Lang, number[]>> = {
  en: [2, 1],
  fr: [2, 1],
  ru: [2, 1],
};

/** Total levels the difficulty curve is designed for (the curve is stable when more are added). */
export const CURVE_LENGTH = 100;

export interface Difficulty { letters: number; words: number }

/**
 * Smooth difficulty curve: level 1 has 3 letters / 3 words; letters grow 4 -> 7 and
 * the number of grid words 3 -> 10 over the first ~90 levels.
 */
export function difficulty(i: number): Difficulty {
  if (i === 0) return { letters: 3, words: 3 };
  const letters = Math.min(7, Math.max(4, Math.round(4 + ((i - 1) * 3) / 60)));
  const words = Math.min(10, Math.max(3, Math.round(3 + (i * 7) / 90)));
  return { letters, words };
}

export const MAX_ROWS = 8;
export const MAX_COLS = 8;
