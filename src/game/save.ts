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
  /** whether any hint/reveal was used in the current level (for achievements) */
  helped?: boolean;
}

export interface DailyState {
  /** local date (YYYY-MM-DD) of the last solved daily puzzle */
  lastSolved: string | null;
  streak: number;
  best: number;
  /** progress of today's puzzle */
  date: string | null;
  progress: LevelProgress;
}

export interface Stats {
  words: number;
  bonus: number;
  levels: number;
  noHelpLevels: number;
  dailies: number;
}

export interface SaveData {
  version: 1;
  lang: Lang | null;
  music: boolean;
  sound: boolean;
  coins: number;
  tutorialDone: boolean;
  progress: Partial<Record<Lang, LevelProgress>>;
  daily: DailyState;
  stats: Stats;
  achievements: string[];
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  lang: null,
  music: true,
  sound: true,
  coins: 50,
  tutorialDone: false,
  progress: {},
  daily: { lastSolved: null, streak: 0, best: 0, date: null, progress: { level: 0, found: [], bonus: [], revealed: [], freeHintUsed: false } },
  stats: { words: 0, bonus: 0, levels: 0, noHelpLevels: 0, dailies: 0 },
  achievements: [],
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
      const d = structuredClone(DEFAULT_SAVE);
      return {
        ...d,
        ...parsed,
        progress: { ...(parsed.progress ?? {}) },
        daily: { ...d.daily, ...(parsed.daily ?? {}) },
        stats: { ...d.stats, ...(parsed.stats ?? {}) },
        achievements: [...(parsed.achievements ?? [])],
      };
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
