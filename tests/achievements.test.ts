import { describe, expect, it } from 'vitest';
import { checkAchievements, dayNumber, nextStreak, today } from '../src/game/achievements';
import { DEFAULT_SAVE } from '../src/game/save';

describe('daily streak', () => {
  it('continues on consecutive days and resets after a gap', () => {
    expect(nextStreak(null, 0, '2026-11-10')).toBe(1);
    expect(nextStreak('2026-11-10', 1, '2026-11-11')).toBe(2);
    expect(nextStreak('2026-11-11', 2, '2026-11-11')).toBe(2);
    expect(nextStreak('2026-11-11', 5, '2026-11-14')).toBe(1);
    expect(nextStreak('2026-12-31', 3, '2027-01-01')).toBe(4);
  });
  it('formats local dates', () => {
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dayNumber('2026-03-02') - dayNumber('2026-02-28')).toBe(2);
  });
});

describe('achievements', () => {
  it('unlock once', () => {
    const s = structuredClone(DEFAULT_SAVE);
    s.stats.words = 1;
    s.stats.levels = 10;
    const first = checkAchievements(s, 1).map((a) => a.id);
    expect(first).toEqual(expect.arrayContaining(['first_word', 'level_10', 'island_1']));
    expect(checkAchievements(s, 1)).toEqual([]);
  });
});
