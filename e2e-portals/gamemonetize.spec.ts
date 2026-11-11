import { expect, test } from '@playwright/test';
import { boot, ctxStates, longAgo, progress, solveLevel } from './helpers';

const GM_SDK = 'https://api.gamemonetize.com/sdk.js';
const GAME_ID = '0cqkyktpv3nnr3nokt7jhqbzryqmfh2h';

declare global {
  interface Window {
    __gm?: { calls: string[]; optionsAtLoad: string | null; hold: boolean; finish?: () => void };
  }
}

/**
 * stand-in for sdk.js: records whether SDK_OPTIONS was set before it loaded, sends SDK_READY, and showBanner() plays
 * SDK_GAME_PAUSE → (300 ms, or g.finish() when held) → SDK_GAME_START, as the real SDK does around a video ad
 */
const STUB = `(() => {
  const g = (window.__gm = { calls: [], optionsAtLoad: window.SDK_OPTIONS ? window.SDK_OPTIONS.gameId : null, hold: false });
  let ready = false;
  window.sdk = {
    showBanner() {
      g.calls.push((ready ? '' : 'BEFORE-READY:') + 'showBanner');
      const o = window.SDK_OPTIONS;
      o.onEvent({ name: 'SDK_GAME_PAUSE' });
      g.finish = () => o.onEvent({ name: 'SDK_GAME_START' });
      if (!g.hold) setTimeout(g.finish, 300);
    },
  };
  setTimeout(() => { ready = true; window.SDK_OPTIONS.onEvent({ name: 'SDK_READY' }); }, 0);
})();`;

test('GameMonetize build: SDK_OPTIONS then sdk.js once at boot, a level plays with no ad in it, no console errors', async ({ page }) => {
  const { errors, requests } = await boot(page, GM_SDK, STUB, progress(1));
  expect(requests.filter((u) => u === GM_SDK)).toHaveLength(1);
  expect(await page.locator('script#gamemonetize-sdk').count()).toBe(1);
  expect(await page.evaluate(() => window.__gm!.optionsAtLoad)).toBe(GAME_ID);
  expect(requests.filter((u) => /^https?:/.test(u) && !/localhost|127\.0\.0\.1/.test(u))).toEqual([GM_SDK]);
  await page.getByTestId('play').click();
  await solveLevel(page);
  // the first Next comes less than 2 minutes after boot: no ad, the next level starts
  await page.getByTestId('next').click();
  await expect(page.locator('.hud .title small')).toHaveText('Level 3');
  expect(await page.evaluate(() => window.__gm!.calls)).toEqual([]);
  expect(errors).toEqual([]);
});

test('GameMonetize build: Next after ~2 minutes shows one interstitial; SDK_GAME_PAUSE pauses + mutes, SDK_GAME_START resumes', async ({ page }) => {
  const { errors } = await boot(page, GM_SDK, STUB, progress(1));
  await page.getByTestId('play').click();
  await solveLevel(page);
  await longAgo(page);
  await page.evaluate(() => (window.__gm!.hold = true));
  await page.getByTestId('next').click();
  await expect.poll(() => page.evaluate(() => window.__gm!.calls)).toEqual(['showBanner']);
  await expect.poll(() => ctxStates(page)).toEqual(['suspended']);
  await page.waitForTimeout(500);
  await expect(page.locator('.hud .title small')).toHaveText('Level 2'); // still waiting for the ad
  await page.evaluate(() => window.__gm!.finish!());
  await expect(page.locator('.hud .title small')).toHaveText('Level 3');
  await expect.poll(() => ctxStates(page)).toEqual(['running']);
  expect(errors).toEqual([]);
});

test('GameMonetize build: no "watch an ad" button anywhere (no rewarded API), even without coins', async ({ page }) => {
  const { errors } = await boot(page, GM_SDK, STUB, progress(1, 0));
  await page.getByTestId('play').click();
  await page.getByTestId('hint').click(); // free hint
  await page.getByTestId('hint').click(); // not enough coins
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.getByTestId('watch-ad')).toHaveCount(0);
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('resume')).toBeVisible();
  await expect(page.getByText('Watch an ad')).toHaveCount(0);
  expect(await page.evaluate(() => window.__gm!.calls)).toEqual([]);
  expect(errors).toEqual([]);
});

test('GameMonetize build: with the SDK blocked (ad blocker) a level plays and Next goes on', async ({ page }) => {
  const { errors } = await boot(page, GM_SDK, null, progress(1));
  await page.getByTestId('play').click();
  await solveLevel(page);
  await longAgo(page);
  await page.getByTestId('next').click();
  await expect(page.locator('.hud .title small')).toHaveText('Level 3');
  expect(errors).toEqual([]);
});
