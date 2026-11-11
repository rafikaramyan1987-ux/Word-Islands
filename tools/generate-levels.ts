/**
 * Level generator. Usage: npm run levels:generate [-- en fr ...]
 * Deterministic: the same word list and config always produce the same levels.
 *
 * - Wheel letters come from a base-form word that uses all of them.
 * - Grid words are base forms (the "core" section of the word list).
 * - Every other spellable word (including inflected forms) becomes a bonus word.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canForm, letterCounts, type Lang } from '../src/core/alphabet';
import { hashString, layoutCrossword, rng, shuffle } from '../src/core/crossword';
import type { Level, LevelPack } from '../src/core/level';
import { loadDictionary } from './lib/dict';
import { DAILY_COUNT, difficulty, ISLAND_LEVELS, MAX_COLS, MAX_ROWS, type Difficulty } from './levels.config';

const ROOT = path.resolve(import.meta.dirname, '..');

interface Ctx {
  lang: Lang;
  words: string[];
  core: string[];
  coreByLen: Map<number, string[]>;
  usedSets: Set<string>;
  blocked: Set<string>;
  wordSet: Set<string>;
  recent: string[];
  rand: () => number;
}

function formable(base: string, list: string[]): string[] {
  const counts = letterCounts(base);
  return list.filter((w) => w.length <= base.length && canForm(w, counts));
}

/** Pick n words with a mix of lengths (longest first), avoiding recently used words when possible. */
function pickVaried(pool: string[], n: number, rand: () => number): string[] {
  const out: string[] = [];
  const lens = [...new Set(pool.map((w) => w.length))].sort((a, b) => b - a);
  let li = 0;
  while (out.length < n && li < n * lens.length * 4) {
    const len = lens[li % lens.length];
    const cand = pool.filter((w) => w.length === len && !out.includes(w));
    if (cand.length) out.push(cand[Math.floor(rand() * Math.min(3, cand.length))]);
    li++;
  }
  return out.slice(0, n);
}

/** Shuffle the wheel letters, never leaving them in an order that spells a word (blocked or not). */
function wheelOrder(base: string, ctx: Ctx): string[] {
  let letters = shuffle([...base], ctx.rand);
  for (let k = 0; k < 20 && (ctx.blocked.has(letters.join('')) || ctx.wordSet.has(letters.join(''))); k++) letters = shuffle([...base], ctx.rand);
  return letters;
}

function buildLevel(ctx: Ctx, want: Difficulty, id: string, island: number, stage: number, salt: number): Level | null {
  const tries: Array<[number, number]> = [];
  for (let relax = 0; relax <= 2; relax++) tries.push([want.letters, Math.max(3, want.words - relax)]);
  if (want.letters < 4) tries.push([want.letters + 1, want.words]);
  for (const [n, k] of tries) {
    const bases = shuffle(ctx.coreByLen.get(n) ?? [], ctx.rand);
    for (const base of bases) {
      const setKey = [...base].sort().join('');
      if (ctx.usedSets.has(setKey)) continue;
      const coreForm = formable(base, ctx.core);
      if (coreForm.length < k) continue;
      const fresh = coreForm.filter((w) => w !== base && !ctx.recent.includes(w));
      const pool = (fresh.length >= k - 1 ? fresh : coreForm.filter((w) => w !== base)).sort((a, b) => b.length - a.length);
      const picks = [base, ...pickVaried(shuffle(pool, ctx.rand).sort((a, b) => b.length - a.length), k - 1, ctx.rand)];
      if (picks.length < k) continue;
      const layout = layoutCrossword(picks, hashString(base + salt), { maxRows: MAX_ROWS, maxCols: MAX_COLS, attempts: 40 });
      if (!layout) continue;
      const inGrid = new Set(picks);
      ctx.usedSets.add(setKey);
      ctx.recent.push(...picks);
      while (ctx.recent.length > 40) ctx.recent.shift();
      return {
        id,
        lang: ctx.lang,
        island,
        stage,
        letters: wheelOrder(base, ctx),
        rows: layout.rows,
        cols: layout.cols,
        words: layout.words,
        bonus: formable(base, ctx.words).filter((w) => !inGrid.has(w)).sort(),
      };
    }
  }
  return null;
}

export function generatePack(lang: Lang): LevelPack {
  const islands = ISLAND_LEVELS[lang];
  const dict = loadDictionary(lang);
  const words = [...dict.words].sort();
  const core = [...dict.core].sort();
  const coreByLen = new Map<number, string[]>();
  for (const w of core) coreByLen.set(w.length, [...(coreByLen.get(w.length) ?? []), w]);
  const ctx: Ctx = { lang, words, core, coreByLen, blocked: dict.blocked, wordSet: dict.words, usedSets: new Set(), recent: [], rand: rng(hashString(`word-islands-${lang}`)) };
  const total = islands.reduce((a, b) => a + b, 0);
  const levels: Level[] = [];
  let island = 0, stage = 0;
  for (let i = 0; i < total; i++) {
    const level = buildLevel(ctx, difficulty(i), `${lang}-${String(i + 1).padStart(3, '0')}`, island, stage, i);
    if (!level) throw new Error(`${lang}: could not build level ${i + 1} (${JSON.stringify(difficulty(i))})`);
    levels.push(level);
    stage++;
    if (stage >= islands[island]) { island++; stage = 0; }
  }
  // daily puzzles: medium difficulty, letter sets never used by the main levels
  const daily: Level[] = [];
  for (let d = 0; d < DAILY_COUNT; d++) {
    const want: Difficulty = { letters: d % 3 === 2 ? 6 : 5, words: d % 3 === 2 ? 6 : 5 };
    const level = buildLevel(ctx, want, `${lang}-d${String(d + 1).padStart(2, '0')}`, -1, d, 1000 + d);
    if (!level) throw new Error(`${lang}: could not build daily puzzle ${d + 1}`);
    daily.push(level);
  }
  return { lang, islands, levels, daily };
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const langs = (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ISLAND_LEVELS)) as Lang[];
  for (const lang of langs) {
    const t0 = Date.now();
    const pack = generatePack(lang);
    const out = path.join(ROOT, 'src', 'data', 'levels', `${lang}.json`);
    fs.writeFileSync(out, JSON.stringify(pack) + '\n');
    console.log(`${lang}: ${pack.levels.length} levels + ${pack.daily?.length ?? 0} daily -> ${path.relative(ROOT, out)} (${Date.now() - t0} ms)`);
    for (const l of pack.levels.slice(0, 12)) console.log(`  ${l.id} [${l.letters.join('')}] ${l.words.map((w) => w.word).join(' ')}  (+${l.bonus.length} bonus)`);
  }
}
