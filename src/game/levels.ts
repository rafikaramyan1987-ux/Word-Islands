import type { Lang } from '../core/alphabet';
import type { LevelPack } from '../core/level';
import en from '../data/levels/en.json';
import fr from '../data/levels/fr.json';
import de from '../data/levels/de.json';
import es from '../data/levels/es.json';
import it from '../data/levels/it.json';
import ru from '../data/levels/ru.json';

const PACKS: Record<Lang, LevelPack> = {
  en: en as LevelPack,
  fr: fr as LevelPack,
  de: de as LevelPack,
  es: es as LevelPack,
  it: it as LevelPack,
  ru: ru as LevelPack,
};

/** Level pack for a language (every language has its own word list and levels). */
export function levelPack(lang: Lang): { pack: LevelPack; fallback: boolean } {
  return { pack: PACKS[lang] ?? PACKS.en, fallback: !PACKS[lang] };
}

/** First global level index of an island. */
export function islandStart(pack: LevelPack, island: number) {
  return pack.islands.slice(0, island).reduce((a, b) => a + b, 0);
}
