import { describe, expect, it } from 'vitest';
import { canForm, isAlphabetic, letterCounts, normalizeWord } from '../src/core/alphabet';

describe('normalizeWord', () => {
  it('folds French accents and ligatures', () => {
    expect(normalizeWord('été', 'fr')).toBe('ETE');
    expect(normalizeWord('garçon', 'fr')).toBe('GARCON');
    expect(normalizeWord('sœur', 'fr')).toBe('SOEUR');
    expect(normalizeWord('île', 'fr')).toBe('ILE');
  });
  it('keeps German umlauts and writes ß as SS', () => {
    expect(normalizeWord('Bär', 'de')).toBe('BÄR');
    expect(normalizeWord('Straße', 'de')).toBe('STRASSE');
  });
  it('keeps Spanish Ñ but folds accents', () => {
    expect(normalizeWord('niño', 'es')).toBe('NIÑO');
    expect(normalizeWord('canción', 'es')).toBe('CANCION');
  });
  it('folds Italian accents', () => {
    expect(normalizeWord('città', 'it')).toBe('CITTA');
  });
  it('treats Russian Ё as Е and keeps Й', () => {
    expect(normalizeWord('ёлка', 'ru')).toBe('ЕЛКА');
    expect(normalizeWord('чай', 'ru')).toBe('ЧАЙ');
    expect(isAlphabetic('ЧАЙ', 'ru')).toBe(true);
  });
  it('normalises single typed keys (keyboard layouts)', () => {
    expect(normalizeWord('é', 'fr')).toBe('E');
    expect(normalizeWord('ö', 'de')).toBe('Ö');
    expect(normalizeWord('ё', 'ru')).toBe('Е');
  });
});

describe('letter multisets', () => {
  it('canForm respects letter counts', () => {
    const c = letterCounts('STAR');
    expect(canForm('RATS', c)).toBe(true);
    expect(canForm('STARS', c)).toBe(false);
    expect(canForm('TOR', c)).toBe(false);
  });
});
