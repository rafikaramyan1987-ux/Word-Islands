import type { StringKey } from '../i18n';
import type { SaveData } from './save';

export interface Achievement {
  id: string;
  name: StringKey;
  desc: StringKey;
  done(s: SaveData, islandsDone: number): boolean;
}

const a = (id: string, done: Achievement['done']): Achievement => ({
  id,
  name: `ach_${id}` as StringKey,
  desc: `ach_${id}_d` as StringKey,
  done,
});

export const ACHIEVEMENTS: Achievement[] = [
  a('first_word', (s) => s.stats.words >= 1),
  a('level_10', (s) => s.stats.levels >= 10),
  a('level_50', (s) => s.stats.levels >= 50),
  a('level_100', (s) => s.stats.levels >= 100),
  a('island_1', (_s, n) => n >= 1),
  a('island_4', (_s, n) => n >= 4),
  a('island_8', (_s, n) => n >= 8),
  a('bonus_10', (s) => s.stats.bonus >= 10),
  a('bonus_100', (s) => s.stats.bonus >= 100),
  a('words_500', (s) => s.stats.words >= 500),
  a('no_hint_10', (s) => s.stats.noHelpLevels >= 10),
  a('daily_1', (s) => s.stats.dailies >= 1),
  a('daily_7', (s) => s.daily.best >= 7),
];

export const ACHIEVEMENT_COINS = 20;

/** Newly unlocked achievements (also records them in the save). */
export function checkAchievements(s: SaveData, islandsDone: number): Achievement[] {
  const out: Achievement[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (s.achievements.includes(ach.id)) continue;
    if (ach.done(s, islandsDone)) {
      s.achievements.push(ach.id);
      out.push(ach);
    }
  }
  return out;
}

/** Local calendar date as YYYY-MM-DD. */
export function today(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** Streak after solving today's puzzle. */
export function nextStreak(lastSolved: string | null, streak: number, now: string): number {
  if (lastSolved === now) return streak;
  if (lastSolved && dayNumber(now) - dayNumber(lastSolved) === 1) return streak + 1;
  return 1;
}
