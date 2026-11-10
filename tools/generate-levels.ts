/**
 * Level generator. Usage: npm run levels:generate [-- en fr ...]
 * Deterministic: the same word list and config always produce the same levels.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canForm, letterCounts, type Lang } from '../src/core/alphabet';
import { hashString, layoutCrossword, rng, shuffle } from '../src/core/crossword';
import type { Level, LevelPack } from '../src/core/level';
import { loadDictionary } from './lib/dict';
import { difficulty, ISLAND_LEVELS, MAX_COLS, MAX_ROWS } from './levels.config';

const ROOT = path.resolve(import.meta.dirname, '..');

function formable(base: string, dict: Set<string>): string[] {
  const counts = letterCounts(base);
  return [...dict].filter((w) => w.length <= base.length && canForm(w, counts));
}

export function generatePack(lang: Lang): LevelPack {
  const islands = ISLAND_LEVELS[lang];
  if (!islands) throw new Error(`no island config for ${lang}`);
  const dict = loadDictionary(lang).words;
  const total = islands.reduce((a, b) => a + b, 0);
  const usedSets = new Set<string>();
  const usedWordsRecent: string[] = [];
  const levels: Level[] = [];
  const rand = rng(hashString(`word-islands-${lang}`));
  const byLen = new Map<number, string[]>();
  for (const w of [...dict].sort()) byLen.set(w.length, [...(byLen.get(w.length) ?? []), w]);

  let island = 0, stage = 0;
  for (let i = 0; i < total; i++) {
    const want = difficulty(i);
    let level: Level | null = null;
    // relax the word count only if no base word in the dictionary can satisfy it
    // (and, for the tiny first level, allow one more letter if the language has no 3-letter anagram trio)
    const tries: Array<[number, number]> = [];
    for (let relax = 0; relax <= 2; relax++) tries.push([want.letters, Math.max(3, want.words - relax)]);
    if (want.letters < 4) tries.push([want.letters + 1, want.words]);
    for (const [n, k] of tries) {
      if (level) break;
      const bases = shuffle(byLen.get(n) ?? [], rand);
      for (const base of bases) {
        const setKey = [...base].sort().join('');
        if (usedSets.has(setKey)) continue;
        const all = formable(base, dict);
        if (all.length < k) continue;
        // prefer longer words and words not used in the last few levels
        const fresh = all.filter((w) => w !== base && !usedWordsRecent.includes(w));
        const pool = shuffle(fresh, rand).sort((a, b) => b.length - a.length);
        const picks = [base, ...pickVaried(pool, k - 1, rand)];
        if (picks.length < k) continue;
        const layout = layoutCrossword(picks, hashString(base + i), { maxRows: MAX_ROWS, maxCols: MAX_COLS });
        if (!layout) continue;
        const inGrid = new Set(picks);
        const letters = shuffle([...base], rand);
        level = {
          id: `${lang}-${String(i + 1).padStart(3, '0')}`,
          lang,
          island,
          stage,
          letters,
          rows: layout.rows,
          cols: layout.cols,
          words: layout.words,
          bonus: all.filter((w) => !inGrid.has(w)).sort(),
        };
        usedSets.add(setKey);
        usedWordsRecent.push(...picks);
        while (usedWordsRecent.length > 30) usedWordsRecent.shift();
        break;
      }
    }
    if (!level) throw new Error(`${lang}: could not build level ${i + 1} (${JSON.stringify(want)})`);
    levels.push(level);
    stage++;
    if (stage >= islands[island]) { island++; stage = 0; }
  }
  return { lang, islands, levels };
}

/** Pick n words with a mix of lengths, longest first. */
function pickVaried(pool: string[], n: number, rand: () => number): string[] {
  const out: string[] = [];
  const lens = [...new Set(pool.map((w) => w.length))].sort((a, b) => b - a);
  let li = 0;
  while (out.length < n && pool.length) {
    const len = lens[li % lens.length];
    const cand = pool.filter((w) => w.length === len && !out.includes(w));
    if (cand.length) out.push(cand[Math.floor(rand() * Math.min(2, cand.length))]);
    li++;
    if (li > n * lens.length * 4) break;
  }
  return out.slice(0, n);
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const langs = (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ISLAND_LEVELS)) as Lang[];
  for (const lang of langs) {
    const pack = generatePack(lang);
    const out = path.join(ROOT, 'src', 'data', 'levels', `${lang}.json`);
    fs.writeFileSync(out, JSON.stringify(pack) + '\n');
    console.log(`${lang}: ${pack.levels.length} levels -> ${path.relative(ROOT, out)}`);
    for (const l of pack.levels) console.log(`  ${l.id} [${l.letters.join('')}] ${l.words.map((w) => w.word).join(' ')}  (+${l.bonus.length} bonus)`);
  }
}
