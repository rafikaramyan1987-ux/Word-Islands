import type { Lang } from './alphabet';

export type Dir = 'H' | 'V';

export interface PlacedWord {
  word: string;
  row: number;
  col: number;
  dir: Dir;
}

export interface Level {
  /** stable id, e.g. "en-001" */
  id: string;
  lang: Lang;
  /** 0-based index of the island this level belongs to (-1 for daily puzzles) */
  island: number;
  /** 0-based index of the level inside its island */
  stage: number;
  /** wheel letters, canonical uppercase */
  letters: string[];
  rows: number;
  cols: number;
  words: PlacedWord[];
  /** valid dictionary words that can be built from the wheel but are not in the grid */
  bonus: string[];
}

export interface LevelPack {
  lang: Lang;
  /** number of levels on each island, in order */
  islands: number[];
  levels: Level[];
  /** daily puzzles (island -1), picked by date */
  daily?: Level[];
}

export function cellsOf(w: PlacedWord): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < w.word.length; i++) {
    out.push(w.dir === 'H' ? [w.row, w.col + i] : [w.row + i, w.col]);
  }
  return out;
}

export const cellKey = (r: number, c: number) => `${r},${c}`;

/** Build the solution grid (null = no tile). Throws on conflicting letters. */
export function solutionGrid(level: Pick<Level, 'rows' | 'cols' | 'words'>): (string | null)[][] {
  const g: (string | null)[][] = Array.from({ length: level.rows }, () => Array<string | null>(level.cols).fill(null));
  for (const w of level.words) {
    cellsOf(w).forEach(([r, c], i) => {
      if (r < 0 || c < 0 || r >= level.rows || c >= level.cols) throw new Error(`${w.word} out of bounds`);
      const ch = w.word[i];
      if (g[r][c] !== null && g[r][c] !== ch) throw new Error(`conflict at ${r},${c} for ${w.word}`);
      g[r][c] = ch;
    });
  }
  return g;
}
