/**
 * Per-language letter rules. Every word (dictionary, level data, typed input) goes
 * through `normalizeWord` so the game only ever compares canonical display letters.
 *
 * Rules (also documented in docs/wordlists.md):
 *  - en: A-Z only.
 *  - fr: accents are folded (É→E, Ç→C, Œ→OE, Æ→AE); the wheel shows unaccented letters.
 *  - de: Ä, Ö, Ü stay distinct wheel letters (they are separate keys on QWERTZ);
 *        ß is written SS (the standard uppercase form).
 *  - es: accents are folded (Á→A …, Ü→U) but Ñ stays a distinct letter.
 *  - it: accents are folded (À→A, È/É→E …).
 *  - ru: Cyrillic А-Я; Ё is treated as Е; Й stays distinct.
 */
export type Lang = 'en' | 'fr' | 'de' | 'es' | 'it' | 'ru';
export const LANGS: Lang[] = ['en', 'fr', 'de', 'es', 'it', 'ru'];

const ALPHABETS: Record<Lang, string> = {
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  fr: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  de: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ',
  es: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ',
  it: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ru: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
};

export function alphabet(lang: Lang): string {
  return ALPHABETS[lang];
}

function stripMarks(s: string, keep: string[]): string {
  let out = '';
  for (const ch of s) {
    if (keep.includes(ch)) { out += ch; continue; }
    out += ch.normalize('NFD').replace(/\p{M}/gu, '');
  }
  return out;
}

/** Canonical uppercase form of a word (or a single typed key) for a language. */
export function normalizeWord(raw: string, lang: Lang): string {
  let s = raw.trim().toLocaleUpperCase(lang === 'ru' ? 'ru-RU' : lang);
  switch (lang) {
    case 'en':
    case 'it':
      s = stripMarks(s, []);
      break;
    case 'fr':
      s = s.replace(/Œ/g, 'OE').replace(/Æ/g, 'AE');
      s = stripMarks(s, []);
      break;
    case 'de':
      s = s.replace(/ß/g, 'SS').replace(/ẞ/g, 'SS');
      s = stripMarks(s, ['Ä', 'Ö', 'Ü']);
      break;
    case 'es':
      s = stripMarks(s, ['Ñ']);
      break;
    case 'ru':
      s = s.replace(/Ё/g, 'Е');
      // Й must survive NFD (it decomposes to И + breve)
      s = stripMarks(s, ['Й']);
      break;
  }
  return s;
}

/** True when every character belongs to the language's display alphabet. */
export function isAlphabetic(word: string, lang: Lang): boolean {
  const a = ALPHABETS[lang];
  for (const ch of word) if (!a.includes(ch)) return false;
  return word.length > 0;
}

/** Letter multiset helpers. */
export function letterCounts(word: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const ch of word) m.set(ch, (m.get(ch) ?? 0) + 1);
  return m;
}

export function canForm(word: string, letters: Map<string, number>): boolean {
  const need = letterCounts(word);
  for (const [ch, n] of need) if ((letters.get(ch) ?? 0) < n) return false;
  return true;
}
