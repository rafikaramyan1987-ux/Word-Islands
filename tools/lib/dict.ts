import fs from 'node:fs';
import path from 'node:path';
import { isAlphabetic, normalizeWord, type Lang } from '../../src/core/alphabet';

export const MIN_LEN = 3;
export const MAX_LEN = 7;
const ROOT = path.resolve(import.meta.dirname, '..', '..');

function readTokens(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*/, ''))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean);
}

export interface Dictionary {
  lang: Lang;
  /** canonical, allowed words */
  words: Set<string>;
  /** canonical blocked words */
  blocked: Set<string>;
  /** raw tokens rejected while loading, with reason */
  rejected: Array<{ raw: string; reason: string }>;
}

export function loadDictionary(lang: Lang): Dictionary {
  const blocked = new Set(readTokens(path.join(ROOT, 'tools', 'blocklists', `${lang}.txt`)).map((w) => normalizeWord(w, lang)));
  const words = new Set<string>();
  const rejected: Dictionary['rejected'] = [];
  for (const raw of readTokens(path.join(ROOT, 'tools', 'wordlists', `${lang}.txt`))) {
    if (/[-'’.]/.test(raw)) { rejected.push({ raw, reason: 'punctuation' }); continue; }
    if (raw !== raw.toLocaleLowerCase(lang)) { rejected.push({ raw, reason: 'capitalised (proper noun?)' }); continue; }
    const w = normalizeWord(raw, lang);
    if (!isAlphabetic(w, lang)) { rejected.push({ raw, reason: 'non-alphabet letters' }); continue; }
    if (w.length < MIN_LEN || w.length > MAX_LEN) continue;
    if (blocked.has(w)) { rejected.push({ raw, reason: 'blocklisted' }); continue; }
    words.add(w);
  }
  return { lang, words, blocked, rejected };
}
