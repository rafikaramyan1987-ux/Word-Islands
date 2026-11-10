import type { Lang } from '../core/alphabet';
import { LANGS } from '../core/alphabet';
import en from './locales/en.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import es from './locales/es.json';
import it from './locales/it.json';
import ru from './locales/ru.json';

export type Strings = typeof en;
export type StringKey = keyof Strings;

const TABLES: Record<Lang, Strings> = { en, fr, de, es, it, ru };

/** Language names shown in the language picker (always in their own language). */
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  ru: 'Русский',
};

let current: Lang = 'en';

export function setLang(lang: Lang) {
  current = lang;
  document.documentElement.lang = lang;
}

export function getLang(): Lang {
  return current;
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = TABLES[current][key] ?? TABLES.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** Map a platform / browser locale ("pt-BR", "fr", "ru_RU") to a supported language. */
export function pickLang(...candidates: Array<string | null | undefined>): Lang {
  for (const c of candidates) {
    if (!c) continue;
    const code = c.toLowerCase().slice(0, 2) as Lang;
    if (LANGS.includes(code)) return code;
  }
  return 'en';
}

export { TABLES };
