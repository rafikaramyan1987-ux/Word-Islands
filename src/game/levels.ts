import type { Lang } from '../core/alphabet';
import type { LevelPack } from '../core/level';
import en from '../data/levels/en.json';
import fr from '../data/levels/fr.json';
import ru from '../data/levels/ru.json';

const PACKS: Partial<Record<Lang, LevelPack>> = {
  en: en as LevelPack,
  fr: fr as LevelPack,
  ru: ru as LevelPack,
};

/** Level pack for a language; falls back to English while a language has no levels yet. */
export function levelPack(lang: Lang): { pack: LevelPack; fallback: boolean } {
  const p = PACKS[lang];
  return p ? { pack: p, fallback: false } : { pack: PACKS.en!, fallback: true };
}

/** First global level index of an island. */
export function islandStart(pack: LevelPack, island: number) {
  return pack.islands.slice(0, island).reduce((a, b) => a + b, 0);
}
