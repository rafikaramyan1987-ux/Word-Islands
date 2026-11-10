import { describe, expect, it } from 'vitest';
import { TABLES, pickLang } from '../src/i18n';
import { LANGS } from '../src/core/alphabet';

describe('i18n', () => {
  it('every language has every key, non-empty', () => {
    const keys = Object.keys(TABLES.en);
    for (const l of LANGS) {
      for (const k of keys) expect((TABLES[l] as Record<string, string>)[k], `${l}.${k}`).toBeTruthy();
      expect(Object.keys(TABLES[l]).sort()).toEqual([...keys].sort());
    }
  });
  it('keeps placeholders', () => {
    for (const l of LANGS) for (const [k, v] of Object.entries(TABLES.en)) {
      const ph = v.match(/\{\w+\}/g) ?? [];
      for (const p of ph) expect((TABLES[l] as Record<string, string>)[k], `${l}.${k}`).toContain(p);
    }
  });
  it('maps locales', () => {
    expect(pickLang('fr-CA')).toBe('fr');
    expect(pickLang('ru_RU')).toBe('ru');
    expect(pickLang('pt-BR', null)).toBe('en');
    expect(pickLang(null, 'de-DE')).toBe('de');
  });
});
