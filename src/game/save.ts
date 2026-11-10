import type { Lang } from '../core/alphabet';
import type { Platform } from '../platform/types';

/** localStorage keys used by the game (documented in README). */
export const SAVE_KEY = 'word-islands.save.v1';

export interface LevelProgress {
  /** index of the level being played (= number of completed levels) */
  level: number;
  /** grid words found in the current level */
  found: string[];
  /** bonus words found in the current level */
  bonus: string[];
  /** revealed cells "r,c" in the current level */
  revealed: string[];
  /** whether the free hint of the current level was used */
  freeHintUsed: boolean;
}

export interface SaveData {
  version: 1;
  lang: Lang | null;
  music: boolean;
  sound: boolean;
  coins: number;
  tutorialDone: boolean;
  progress: Partial<Record<Lang, LevelProgress>>;
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  lang: null,
  music: true,
  sound: true,
  coins: 50,
  tutorialDone: false,
  progress: {},
};

export function emptyProgress(level = 0): LevelProgress {
  return { level, found: [], bonus: [], revealed: [], freeHintUsed: false };
}

export class SaveStore {
  data: SaveData;
  constructor(private platform: Platform) {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = this.platform.storageGet(SAVE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (parsed.version !== 1) return structuredClone(DEFAULT_SAVE);
      return { ...structuredClone(DEFAULT_SAVE), ...parsed, progress: { ...(parsed.progress ?? {}) } };
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  save() {
    this.platform.storageSet(SAVE_KEY, JSON.stringify(this.data));
  }

  progress(lang: Lang): LevelProgress {
    let p = this.data.progress[lang];
    if (!p) {
      p = emptyProgress();
      this.data.progress[lang] = p;
    }
    return p;
  }

  reset() {
    const { lang, music, sound } = this.data;
    this.data = { ...structuredClone(DEFAULT_SAVE), lang, music, sound };
    this.save();
  }
}
