import fs from 'node:fs';
import path from 'node:path';
import { isAlphabetic, normalizeWord, type Lang } from '../../src/core/alphabet';

export const MIN_LEN = 3;
export const MAX_LEN = 7;
/** Line that starts the section of inflected forms (plurals, conjugations, cases). */
export const INFLECTIONS_MARKER = '#@inflections';
const ROOT = path.resolve(import.meta.dirname, '..', '..');

function readSections(file: string): { core: string[]; inflections: string[] } {
  const core: string[] = [];
  const inflections: string[] = [];
  if (!fs.existsSync(file)) return { core, inflections };
  let target = core;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.trim().startsWith(INFLECTIONS_MARKER)) { target = inflections; continue; }
    target.push(...line.replace(/#.*/, '').split(/\s+/).filter(Boolean));
  }
  return { core, inflections };
}

export interface Dictionary {
  lang: Lang;
  /** canonical, allowed words (core + inflections): valid as bonus words */
  words: Set<string>;
  /** canonical base-form words: preferred for grid words and wheel letters */
  core: Set<string>;
  /** canonical blocked words */
  blocked: Set<string>;
  /** raw tokens rejected while loading, with reason */
  rejected: Array<{ raw: string; reason: string }>;
}

export function loadDictionary(lang: Lang): Dictionary {
  const blk = readSections(path.join(ROOT, 'tools', 'blocklists', `${lang}.txt`));
  const blocked = new Set([...blk.core, ...blk.inflections].map((w) => normalizeWord(w, lang)));
  const words = new Set<string>();
  const core = new Set<string>();
  const rejected: Dictionary['rejected'] = [];
  const { core: coreRaw, inflections } = readSections(path.join(ROOT, 'tools', 'wordlists', `${lang}.txt`));
  const add = (raw: string, isCore: boolean) => {
    if (/[-'’.]/.test(raw)) { rejected.push({ raw, reason: 'punctuation' }); return; }
    if (raw !== raw.toLocaleLowerCase(lang)) { rejected.push({ raw, reason: 'capitalised (proper noun?)' }); return; }
    const w = normalizeWord(raw, lang);
    if (!isAlphabetic(w, lang)) { rejected.push({ raw, reason: 'non-alphabet letters' }); return; }
    if (w.length < MIN_LEN || w.length > MAX_LEN) return;
    if (blocked.has(w)) { rejected.push({ raw, reason: 'blocklisted' }); return; }
    words.add(w);
    if (isCore) core.add(w);
  };
  for (const raw of coreRaw) add(raw, true);
  for (const raw of inflections) add(raw, false);
  return { lang, words, core, blocked, rejected };
}
