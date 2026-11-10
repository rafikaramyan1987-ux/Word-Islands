import { describe, expect, it } from 'vitest';
import { checkGrid, layoutCrossword } from '../src/core/crossword';

describe('layoutCrossword', () => {
  it('lays out a connected, valid crossword', () => {
    const words = ['PLANET', 'PLANE', 'PLATE', 'LEAP', 'NET', 'TAN'];
    const layout = layoutCrossword(words, 42, { maxRows: 8, maxCols: 8 });
    expect(layout).not.toBeNull();
    expect(layout!.words.map((w) => w.word).sort()).toEqual([...words].sort());
    expect(checkGrid(layout!)).toEqual([]);
  });
  it('is deterministic for a seed', () => {
    const a = layoutCrossword(['STONE', 'NOTES', 'ONE', 'TEN'], 7, { maxRows: 8, maxCols: 8 });
    const b = layoutCrossword(['STONE', 'NOTES', 'ONE', 'TEN'], 7, { maxRows: 8, maxCols: 8 });
    expect(a).toEqual(b);
  });
});

describe('checkGrid', () => {
  it('detects accidental adjacent words', () => {
    const bad = { rows: 2, cols: 3, words: [{ word: 'CAT', row: 0, col: 0, dir: 'H' as const }, { word: 'DOG', row: 1, col: 0, dir: 'H' as const }] };
    const errs = checkGrid(bad);
    expect(errs.some((e) => e.includes('unexpected vertical run'))).toBe(true);
  });
  it('detects disconnected grids', () => {
    const bad = { rows: 3, cols: 3, words: [{ word: 'CAT', row: 0, col: 0, dir: 'H' as const }, { word: 'DOG', row: 2, col: 0, dir: 'H' as const }] };
    expect(checkGrid(bad)).toContain('grid is not connected');
  });
  it('detects conflicting letters', () => {
    const bad = { rows: 3, cols: 3, words: [{ word: 'CAT', row: 0, col: 0, dir: 'H' as const }, { word: 'DOG', row: 0, col: 0, dir: 'V' as const }] };
    expect(checkGrid(bad)[0]).toMatch(/conflict/);
  });
});
