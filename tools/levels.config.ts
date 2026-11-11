import type { Lang } from '../src/core/alphabet';

/** Number of levels on each of the 8 islands (100 levels per language). */
export const ISLAND_SIZES = [10, 12, 12, 12, 13, 13, 14, 14];

export const ISLAND_LEVELS: Record<Lang, number[]> = {
  en: ISLAND_SIZES,
  fr: ISLAND_SIZES,
  de: ISLAND_SIZES,
  es: ISLAND_SIZES,
  it: ISLAND_SIZES,
  ru: ISLAND_SIZES,
};

/** Total levels the difficulty curve is designed for. */
export const CURVE_LENGTH = 100;

export interface Difficulty { letters: number; words: number }

/**
 * Difficulty curve. The first island is quick and rewarding: 3-4 letters and 3-4 short words.
 * After that the wheel grows slowly (5 letters from level 13, 6 from 36, 7 from 66) and the grid
 * from 4 to 10 words.
 */
export function difficulty(i: number): Difficulty {
  const letters = i < 1 ? 3 : i < 12 ? 4 : i < 35 ? 5 : i < 65 ? 6 : 7;
  const words = i < 6 ? 3 : i < 10 ? 4 : Math.min(10, Math.round(4 + ((i - 10) * 6) / 85));
  return { letters, words };
}

export const MAX_ROWS = 8;
export const MAX_COLS = 8;

/** Minimum size of every language's word list (checked by the validator). */
export const MIN_WORDS = 3000;

/** Number of daily puzzles generated per language (the game cycles through them). */
export const DAILY_COUNT = 60;
