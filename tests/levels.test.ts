import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LevelPack } from '../src/core/level';
import { generatePack } from '../tools/generate-levels';
import { validatePack } from '../tools/validate-levels';
import { ISLAND_LEVELS } from '../tools/levels.config';
import { loadDictionary } from '../tools/lib/dict';
import type { Lang } from '../src/core/alphabet';
import { ISLANDS } from '../src/data/islands';

const langs = Object.keys(ISLAND_LEVELS) as Lang[];

describe.each(langs)('levels %s', (lang) => {
  const file = path.resolve(__dirname, '..', 'src', 'data', 'levels', `${lang}.json`);
  const pack = JSON.parse(fs.readFileSync(file, 'utf8')) as LevelPack;

  it('committed pack equals a fresh generation (deterministic generator)', () => {
    expect(generatePack(lang)).toEqual(pack);
  });
  it('passes the validator', () => {
    const r = validatePack(pack);
    expect(r.errors).toEqual([]);
  });
  it('has a 3D island for every island in the pack', () => {
    expect(pack.islands.length).toBeLessThanOrEqual(ISLANDS.length);
  });
  it('word list contains no blocklisted words', () => {
    const d = loadDictionary(lang);
    for (const w of d.words) expect(d.blocked.has(w)).toBe(false);
  });
});
