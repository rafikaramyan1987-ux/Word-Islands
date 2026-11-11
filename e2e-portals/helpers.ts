import { expect, type Page } from '@playwright/test';

export const SAVE_KEY = 'word-islands.save.v1';

export const progress = (level: number, coins = 50) => ({
  version: 1, lang: 'en', music: true, sound: true, coins, tutorialDone: true,
  progress: { en: { level, found: [], bonus: [], revealed: [], freeHintUsed: false } },
});

type Wi = { __wi: { app: { level: { words: { word: string }[] }; lastInterstitial: number } }; __ctxs: AudioContext[] };

/**
 * Open the build with a seeded save; `route` answers the SDK URL (stub body, or null = blocked like an ad blocker).
 * Collects page errors and console errors (a blocked SDK's "Failed to load resource" is the case under test).
 */
export async function boot(page: Page, sdkUrl: string, stub: string | null, save: object) {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !(stub === null && /Failed to load resource/.test(m.text()))) errors.push(m.text());
  });
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript(([k, s]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      localStorage.setItem(k, s);
    }
    const AC = window.AudioContext;
    (window as unknown as Wi).__ctxs = [];
    window.AudioContext = class extends AC {
      constructor(o?: AudioContextOptions) {
        super(o);
        (window as unknown as Wi).__ctxs.push(this);
      }
    } as typeof AudioContext;
  }, [SAVE_KEY, JSON.stringify(save)] as const);
  // any other external request would be a bug in these builds: let the test see it, but never reach the network
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) =>
    r.request().url() === sdkUrl && stub !== null ? r.fulfill({ contentType: 'application/javascript', body: stub }) : r.abort(),
  );
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as Wi).__wi && !document.getElementById('boot'), null, { timeout: 60_000 });
  return { errors, requests };
}

export const ctxStates = (page: Page) => page.evaluate(() => (window as unknown as Wi).__ctxs.map((c) => c.state));

/** type every word of the current level (keyboard), until the level-complete screen shows */
export async function solveLevel(page: Page) {
  await expect(page.locator('.wheel .letter').first()).toBeVisible();
  const words = await page.evaluate(() => (window as unknown as Wi).__wi.app.level.words.map((w) => w.word));
  for (const w of words) {
    await page.evaluate((w) => {
      for (const ch of w.toLowerCase()) window.dispatchEvent(new KeyboardEvent('keydown', { key: ch }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }, w);
    await page.waitForTimeout(1400);
  }
  await expect(page.getByTestId('next')).toBeVisible({ timeout: 15_000 });
}

/** pretend the last interstitial was long ago (the game's ~2 minute gap between interstitials) */
export const longAgo = (page: Page) => page.evaluate(() => ((window as unknown as Wi).__wi.app.lastInterstitial = -1e9));
