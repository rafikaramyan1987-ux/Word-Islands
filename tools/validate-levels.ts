/**
 * Level validator (run in CI). Checks every shipped level pack and writes docs/levels-report.md.
 * Exits with code 1 on any error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canForm, isAlphabetic, LANGS, letterCounts, type Lang } from '../src/core/alphabet';
import { checkGrid } from '../src/core/crossword';
import type { Level, LevelPack } from '../src/core/level';
import { loadDictionary, MIN_LEN } from './lib/dict';
import { difficulty, DAILY_COUNT, ISLAND_LEVELS, MAX_COLS, MAX_ROWS, MIN_WORDS } from './levels.config';

const ROOT = path.resolve(import.meta.dirname, '..');

export interface LangReport {
  lang: Lang;
  dictionarySize: number;
  coreSize: number;
  daily: number;
  levels: number;
  islands: number[];
  errors: string[];
  warnings: string[];
  rows: string[];
}

export function validatePack(pack: LevelPack): LangReport {
  const { lang } = pack;
  const dict = loadDictionary(lang);
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: string[] = [];
  const err = (id: string, m: string) => errors.push(`${id}: ${m}`);

  if (dict.words.size < MIN_WORDS) errors.push(`word list has ${dict.words.size} words, minimum is ${MIN_WORDS}`);
  if (JSON.stringify(pack.islands) !== JSON.stringify(ISLAND_LEVELS[lang])) errors.push(`island sizes ${pack.islands} differ from config`);
  for (const n of pack.islands) if (n < 10 || n > 15) errors.push(`island with ${n} levels (must be 10-15)`);
  if ((pack.daily?.length ?? 0) !== DAILY_COUNT) errors.push(`expected ${DAILY_COUNT} daily puzzles, got ${pack.daily?.length ?? 0}`);
  const expected = pack.islands.reduce((a, b) => a + b, 0);
  if (expected !== pack.levels.length) errors.push(`island sizes sum to ${expected} but pack has ${pack.levels.length} levels`);
  const ids = new Set<string>();
  const letterSets = new Set<string>();
  let prev: { letters: number; words: number } | null = null;
  let island = 0, stage = 0;

  const checkContent = (lv: Level) => {
    if (ids.has(lv.id)) err(lv.id, 'duplicate id');
    ids.add(lv.id);
    if (lv.lang !== lang) err(lv.id, `lang ${lv.lang} != ${lang}`);

    const counts = letterCounts(lv.letters.join(''));
    if (lv.letters.length < 3 || lv.letters.length > 7) err(lv.id, `${lv.letters.length} wheel letters (allowed 3-7)`);
    for (const ch of lv.letters) if (!isAlphabetic(ch, lang) || ch.length !== 1) err(lv.id, `bad wheel letter "${ch}"`);
    if (dict.blocked.has(lv.letters.join(''))) err(lv.id, `wheel order spells a blocked word`);
    const setKey = [...lv.letters].sort().join('');
    if (letterSets.has(setKey)) warnings.push(`${lv.id}: same wheel letters as an earlier level`);
    letterSets.add(setKey);

    const gridWords = lv.words.map((w) => w.word);
    for (const w of gridWords) {
      if (!dict.words.has(w)) err(lv.id, `grid word ${w} is not in the ${lang} word list`);
      else if (!dict.core.has(w)) err(lv.id, `grid word ${w} is an inflected form (grid words must be base forms)`);
      if (dict.blocked.has(w)) err(lv.id, `grid word ${w} is blocklisted`);
      if (!canForm(w, counts)) err(lv.id, `grid word ${w} uses letters not on the wheel`);
      if (w.length < MIN_LEN) err(lv.id, `grid word ${w} shorter than ${MIN_LEN}`);
    }
    if (!gridWords.some((w) => w.length === lv.letters.length)) warnings.push(`${lv.id}: no grid word uses all wheel letters`);
    for (const e of checkGrid(lv)) err(lv.id, e);
    if (lv.rows > MAX_ROWS || lv.cols > MAX_COLS) err(lv.id, `grid ${lv.rows}x${lv.cols} exceeds ${MAX_ROWS}x${MAX_COLS}`);

    const gridSet = new Set(gridWords);
    for (const b of lv.bonus) {
      if (gridSet.has(b)) err(lv.id, `bonus word ${b} is also in the grid`);
      if (!dict.words.has(b)) err(lv.id, `bonus word ${b} is not in the word list`);
      if (dict.blocked.has(b)) err(lv.id, `bonus word ${b} is blocklisted`);
      if (!canForm(b, counts)) err(lv.id, `bonus word ${b} uses letters not on the wheel`);
    }
    // every formable dictionary word must be either in the grid or a bonus word
    for (const w of dict.words) {
      if (w.length <= lv.letters.length && canForm(w, counts) && !gridSet.has(w) && !lv.bonus.includes(w)) {
        err(lv.id, `formable word ${w} missing from bonus list`);
      }
    }

    return gridWords;
  };

  pack.levels.forEach((lv, i) => {
    if (lv.island !== island || lv.stage !== stage) err(lv.id, `expected island ${island} stage ${stage}, got ${lv.island}/${lv.stage}`);
    stage++;
    if (stage >= (pack.islands[island] ?? Infinity)) { island++; stage = 0; }
    const gridWords = checkContent(lv);
    // smooth difficulty: never jump by more than 1 letter or 2 words between levels,
    // and never be harder than the curve allows by more than one step
    const cur = { letters: lv.letters.length, words: gridWords.length };
    const target = difficulty(i);
    if (prev) {
      if (Math.abs(cur.letters - prev.letters) > 1) err(lv.id, `letter count jumps ${prev.letters} -> ${cur.letters}`);
      if (Math.abs(cur.words - prev.words) > 2) err(lv.id, `word count jumps ${prev.words} -> ${cur.words}`);
    }
    if (cur.letters > target.letters + 1) err(lv.id, `${cur.letters} letters but curve allows ${target.letters}`);
    if (cur.words > target.words + 1) err(lv.id, `${cur.words} words but curve allows ${target.words}`);
    if (cur.words < target.words - 2) warnings.push(`${lv.id}: only ${cur.words} words (curve ${target.words})`);
    prev = cur;
    rows.push(`| ${lv.id} | ${lv.island + 1}.${lv.stage + 1} | ${lv.letters.join(' ')} | ${cur.letters} | ${cur.words} | ${lv.rows}×${lv.cols} | ${gridWords.join(', ')} | ${lv.bonus.length} |`);
  });
  for (const lv of pack.daily ?? []) {
    if (lv.island !== -1) err(lv.id, 'daily puzzle must have island -1');
    const gridWords = checkContent(lv);
    rows.push(`| ${lv.id} | daily | ${lv.letters.join(' ')} | ${lv.letters.length} | ${gridWords.length} | ${lv.rows}×${lv.cols} | ${gridWords.join(', ')} | ${lv.bonus.length} |`);
  }

  return { lang, dictionarySize: dict.words.size, coreSize: dict.core.size, daily: pack.daily?.length ?? 0, levels: pack.levels.length, islands: pack.islands, errors, warnings, rows };
}

function main() {
  const dir = path.join(ROOT, 'src', 'data', 'levels');
  const reports: LangReport[] = [];
  const missing: Lang[] = [];
  for (const lang of LANGS) {
    const file = path.join(dir, `${lang}.json`);
    if (!fs.existsSync(file)) { missing.push(lang); console.error(`  ERROR ${lang}: level pack missing`); continue; }
    reports.push(validatePack(JSON.parse(fs.readFileSync(file, 'utf8')) as LevelPack));
  }
  let md = '# Level validation report\n\n';
  md += 'Generated by `npm run levels:validate` (also run in CI; CI fails on any error).\n\n';
  md += '| Language | Word list (base forms) | Levels | Daily | Islands | Errors | Warnings |\n|---|---|---|---|---|---|---|\n';
  for (const r of reports) md += `| ${r.lang} | ${r.dictionarySize} (${r.coreSize}) | ${r.levels} | ${r.daily} | ${r.islands.join(' + ')} | ${r.errors.length} | ${r.warnings.length} |\n`;
  if (missing.length) md += `\nMissing level packs: ${missing.join(', ')}.\n`;
  for (const r of reports) {
    md += `\n## ${r.lang}\n\n`;
    md += r.errors.length ? r.errors.map((e) => `- ❌ ${e}`).join('\n') + '\n\n' : '- ✅ no errors\n';
    if (r.warnings.length) md += r.warnings.map((w) => `- ⚠️ ${w}`).join('\n') + '\n';
    md += '\n| Level | Island.stage | Wheel | Letters | Words | Grid | Grid words | Bonus |\n|---|---|---|---|---|---|---|---|\n';
    md += r.rows.join('\n') + '\n';
  }
  fs.writeFileSync(path.join(ROOT, 'docs', 'levels-report.md'), md);
  const errors = reports.reduce((a, r) => a + r.errors.length, 0);
  for (const r of reports) console.log(`${r.lang}: ${r.levels} levels, ${r.errors.length} errors, ${r.warnings.length} warnings`);
  for (const r of reports) for (const e of r.errors) console.error(`  ERROR ${e}`);
  if (errors || missing.length) process.exit(1);
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) main();
