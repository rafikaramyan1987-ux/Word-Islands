import { cellKey, cellsOf, solutionGrid, type Dir, type PlacedWord } from './level';

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface Cell { ch: string; dirs: Set<Dir> }

class Board {
  cells = new Map<string, Cell>();
  words: PlacedWord[] = [];

  get(r: number, c: number) { return this.cells.get(cellKey(r, c)); }

  /** Returns number of crossings if the word can be placed there, or -1. */
  check(word: string, row: number, col: number, dir: Dir): number {
    const dr = dir === 'V' ? 1 : 0;
    const dc = dir === 'H' ? 1 : 0;
    // cells right before and after must be empty
    if (this.get(row - dr, col - dc)) return -1;
    if (this.get(row + dr * word.length, col + dc * word.length)) return -1;
    let crossings = 0;
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const cell = this.get(r, c);
      if (cell) {
        if (cell.ch !== word[i] || cell.dirs.has(dir)) return -1;
        crossings++;
      } else {
        // side neighbours must be empty, otherwise we would form unintended words
        if (this.get(r + dc, c + dr) || this.get(r - dc, c - dr)) return -1;
      }
    }
    return crossings;
  }

  place(w: PlacedWord) {
    cellsOf(w).forEach(([r, c], i) => {
      const k = cellKey(r, c);
      const cell = this.cells.get(k) ?? { ch: w.word[i], dirs: new Set<Dir>() };
      cell.dirs.add(w.dir);
      this.cells.set(k, cell);
    });
    this.words.push(w);
  }

  bounds() {
    let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
    for (const k of this.cells.keys()) {
      const [r, c] = k.split(',').map(Number);
      r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    }
    return { r0, r1, c0, c1, rows: r1 - r0 + 1, cols: c1 - c0 + 1 };
  }

  clone(): Board {
    const b = new Board();
    for (const [k, v] of this.cells) b.cells.set(k, { ch: v.ch, dirs: new Set(v.dirs) });
    b.words = [...this.words];
    return b;
  }
}

export interface Layout { rows: number; cols: number; words: PlacedWord[] }

export interface LayoutOptions {
  maxRows: number;
  maxCols: number;
  attempts?: number;
}

/**
 * Lays out all `words` as a connected crossword, or returns null.
 * Greedy placement with randomised candidate choice, best of N attempts
 * (smallest area, then most square-ish).
 */
export function layoutCrossword(words: string[], seed: number, opts: LayoutOptions): Layout | null {
  const rand = rng(seed);
  const attempts = opts.attempts ?? 60;
  let best: { layout: Layout; score: number } | null = null;
  const sorted = [...words].sort((a, b) => b.length - a.length);

  for (let a = 0; a < attempts; a++) {
    const order = [sorted[0], ...shuffle(sorted.slice(1), rand)];
    const board = new Board();
    board.place({ word: order[0], row: 0, col: 0, dir: rand() < 0.75 ? 'H' : 'V' });
    let pending = order.slice(1);
    let stuck = false;
    while (pending.length && !stuck) {
      stuck = true;
      for (const word of pending) {
        const cands = candidates(board, word, opts);
        if (!cands.length) continue;
        cands.sort((x, y) => y.score - x.score);
        const pick = cands[Math.floor(rand() * Math.min(3, cands.length))];
        board.place(pick.w);
        pending = pending.filter((p) => p !== word);
        stuck = false;
        break;
      }
    }
    if (pending.length) continue;
    const b = board.bounds();
    if (b.rows > opts.maxRows || b.cols > opts.maxCols) continue;
    const area = b.rows * b.cols;
    const score = -area * 10 - Math.abs(b.rows - b.cols) + board.words.length;
    if (!best || score > best.score) {
      best = {
        score,
        layout: {
          rows: b.rows,
          cols: b.cols,
          words: board.words.map((w) => ({ ...w, row: w.row - b.r0, col: w.col - b.c0 })),
        },
      };
    }
  }
  return best?.layout ?? null;
}

function candidates(board: Board, word: string, opts: LayoutOptions) {
  const out: Array<{ w: PlacedWord; score: number }> = [];
  const b0 = board.bounds();
  for (const [k, cell] of board.cells) {
    if (cell.dirs.size > 1) continue;
    const [r, c] = k.split(',').map(Number);
    const dir: Dir = cell.dirs.has('H') ? 'V' : 'H';
    for (let i = 0; i < word.length; i++) {
      if (word[i] !== cell.ch) continue;
      const row = dir === 'V' ? r - i : r;
      const col = dir === 'H' ? c - i : c;
      const crossings = board.check(word, row, col, dir);
      if (crossings < 1) continue;
      const r1 = dir === 'V' ? row + word.length - 1 : row;
      const c1 = dir === 'H' ? col + word.length - 1 : col;
      const rows = Math.max(b0.r1, r1) - Math.min(b0.r0, row) + 1;
      const cols = Math.max(b0.c1, c1) - Math.min(b0.c0, col) + 1;
      if (rows > opts.maxRows || cols > opts.maxCols) continue;
      out.push({ w: { word, row, col, dir }, score: crossings * 6 - rows * cols * 0.4 - Math.abs(rows - cols) * 0.5 });
    }
  }
  return out;
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Independent structural check of a finished grid: every horizontal/vertical run of
 * 2+ letters must be exactly one of the placed words, and all tiles must be connected.
 * Returns a list of problems (empty = valid).
 */
export function checkGrid(layout: Layout): string[] {
  const errors: string[] = [];
  let g: (string | null)[][];
  try {
    g = solutionGrid(layout);
  } catch (e) {
    return [(e as Error).message];
  }
  const placed = new Set(layout.words.map((w) => `${w.dir}:${w.row}:${w.col}:${w.word}`));
  const seen = new Set<string>();
  const words = new Set<string>();
  for (const w of layout.words) {
    if (words.has(w.word)) errors.push(`duplicate word ${w.word}`);
    words.add(w.word);
  }
  // horizontal runs
  for (let r = 0; r < layout.rows; r++) {
    let c = 0;
    while (c < layout.cols) {
      if (!g[r][c]) { c++; continue; }
      let s = '';
      const c0 = c;
      while (c < layout.cols && g[r][c]) s += g[r][c++];
      if (s.length > 1) {
        const k = `H:${r}:${c0}:${s}`;
        if (!placed.has(k)) errors.push(`unexpected horizontal run "${s}" at ${r},${c0}`);
        seen.add(k);
      }
    }
  }
  for (let c = 0; c < layout.cols; c++) {
    let r = 0;
    while (r < layout.rows) {
      if (!g[r][c]) { r++; continue; }
      let s = '';
      const r0 = r;
      while (r < layout.rows && g[r][c]) s += g[r++][c];
      if (s.length > 1) {
        const k = `V:${r0}:${c}:${s}`;
        if (!placed.has(k)) errors.push(`unexpected vertical run "${s}" at ${r0},${c}`);
        seen.add(k);
      }
    }
  }
  for (const k of placed) if (!seen.has(k)) errors.push(`placed word not readable in grid: ${k}`);
  // connectivity
  const tiles: Array<[number, number]> = [];
  for (let r = 0; r < layout.rows; r++) for (let c = 0; c < layout.cols; c++) if (g[r][c]) tiles.push([r, c]);
  if (tiles.length) {
    const visited = new Set<string>([cellKey(...tiles[0])]);
    const stack = [tiles[0]];
    while (stack.length) {
      const [r, c] = stack.pop()!;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= layout.rows || nc >= layout.cols || !g[nr][nc]) continue;
        const k = cellKey(nr, nc);
        if (!visited.has(k)) { visited.add(k); stack.push([nr, nc]); }
      }
    }
    if (visited.size !== tiles.length) errors.push('grid is not connected');
  }
  // tight bounds (no empty border rows/cols)
  if (tiles.length) {
    const rs = tiles.map((t) => t[0]), cs = tiles.map((t) => t[1]);
    if (Math.min(...rs) !== 0 || Math.min(...cs) !== 0 || Math.max(...rs) !== layout.rows - 1 || Math.max(...cs) !== layout.cols - 1) {
      errors.push('grid has empty border rows or columns');
    }
  }
  return errors;
}
