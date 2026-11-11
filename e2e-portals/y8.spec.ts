import { expect, test } from '@playwright/test';
import { boot, ctxStates, progress, solveLevel } from './helpers';

const Y8_SDK = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';

declare global {
  interface Window {
    __y8?: { calls: string[]; mode: 'viewed' | 'noAd' | 'dismissed'; hold: boolean; finish?: () => void };
  }
}

/**
 * stand-in for y8.min.js: fires `y8sdk.ready` on load (and again on emitReadyEvent); showAd() records the call (and
 * whether init() came first), then plays the documented callbacks: beforeAd → (reward: adViewed / adDismissed) →
 * afterAd → adBreakDone, or only adBreakDone({ breakStatus: 'noAdPreloaded' })
 */
const STUB = `(() => {
  const g = (window.__y8 = window.__y8 || { calls: [], mode: 'viewed', hold: false });
  let inited = false;
  const sdk = {
    init(app, ad) { g.calls.push('init:' + app.appId + ':' + app.autoLogin + ':' + ad.gameId + ':' + ad.preloadAdBreaks + ':' + ad.sound); inited = true; setTimeout(() => ad.onReady && ad.onReady(), 0); },
    onAuth(cb) { setTimeout(() => cb(null, null), 0); },
    showAd(o) {
      g.calls.push((inited ? '' : 'BEFORE-INIT:') + o.type);
      return new Promise((res) => {
        if (g.mode === 'noAd') { o.adBreakDone && o.adBreakDone({ breakStatus: 'noAdPreloaded' }); return res(); }
        const play = () => {
          o.beforeAd && o.beforeAd();
          g.finish = () => {
            if (o.type === 'reward') (g.mode === 'viewed' ? o.adViewed : o.adDismissed)();
            o.afterAd && o.afterAd();
            o.adBreakDone && o.adBreakDone({ breakStatus: g.mode });
            res();
          };
          if (!g.hold) setTimeout(g.finish, 300);
        };
        if (o.type === 'reward') o.beforeReward(play); else play();
      });
    },
  };
  const ready = () => window.dispatchEvent(new Event('y8sdk.ready'));
  window.y8 = { sdk: () => sdk, emitReadyEvent: ready };
  ready();
})();`;

const INIT = 'init:6af4b1c73c0f1c5e7ad96ecf:true:292549:on:on';
const calls = (page: import('@playwright/test').Page) => page.evaluate(() => window.__y8!.calls);
const coins = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('word-islands.save.v1')!).coins as number);

test('Y8 build: y8.min.js from the CDN (async) once, initialized with the App ID + Game ID, no ad before Play, no console errors', async ({ page }) => {
  const { errors, requests } = await boot(page, Y8_SDK, STUB, progress(1));
  expect(await page.locator(`head script[src="${Y8_SDK}"][async]`).count()).toBe(1);
  expect(requests.filter((u) => u === Y8_SDK)).toHaveLength(1);
  expect(requests.filter((u) => /^https?:/.test(u) && !/localhost|127\.0\.0\.1/.test(u))).toEqual([Y8_SDK]);
  await page.waitForTimeout(500);
  expect(await calls(page)).toEqual([INIT]);
  expect(errors).toEqual([]);
});

test('Y8 build: first Play → `start` (paused + muted until afterAd), the level plays, Next → `next`, a second Play does nothing', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB, progress(1));
  await page.evaluate(() => (window.__y8!.hold = true));
  await page.getByTestId('play').click();
  await expect.poll(() => calls(page)).toEqual([INIT, 'start']);
  await expect.poll(() => ctxStates(page)).toEqual(['suspended']);
  await page.getByTestId('play').click(); // during the ad
  await page.waitForTimeout(300);
  expect(await calls(page)).toEqual([INIT, 'start']);
  await expect(page.locator('.wheel')).toHaveCount(0);
  await page.evaluate(() => window.__y8!.finish!());
  await expect.poll(() => ctxStates(page)).toEqual(['running']);
  await page.evaluate(() => (window.__y8!.hold = false));
  await solveLevel(page);
  expect(await calls(page)).toEqual([INIT, 'start']); // nothing during the level
  await page.getByTestId('next').click();
  await expect(page.locator('.hud .title small')).toHaveText('Level 3');
  // no cap of our own: the next Next asks again; no ad shown → the game goes on at once
  await page.evaluate(() => (window.__y8!.mode = 'noAd'));
  await solveLevel(page);
  await page.getByTestId('next').click();
  await expect(page.locator('.hud .title small')).toHaveText('Level 4');
  expect(await calls(page)).toEqual([INIT, 'start', 'next', 'next']);
  expect(errors).toEqual([]);
});

test('Y8 build: "Watch an ad: +25 coins" pays only after adViewed; no ad / dismissed → "No ad available right now, try later"', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB, progress(1, 0));
  await page.evaluate(() => (window.__y8!.mode = 'noAd'));
  await page.getByTestId('play').click();
  await page.getByTestId('hint').click(); // free hint
  for (const mode of ['noAd', 'dismissed'] as const) {
    await page.evaluate((m) => (window.__y8!.mode = m), mode);
    await page.getByTestId('hint').click(); // not enough coins → offer
    await expect(page.getByTestId('watch-ad')).toHaveText('Watch an ad: +25 coins');
    await page.getByTestId('watch-ad').click();
    await expect(page.locator('.toast').last()).toHaveText('No ad available right now, try later');
    await page.waitForTimeout(2800);
  }
  expect(await coins(page)).toBe(0);
  await page.evaluate(() => (window.__y8!.mode = 'viewed'));
  await page.getByTestId('hint').click();
  await page.getByTestId('watch-ad').click();
  await expect.poll(() => coins(page)).toBe(25);
  expect((await calls(page)).filter((c) => c === 'reward')).toHaveLength(3);
  await expect(page.locator('.wheel')).toBeVisible(); // the level goes on
  expect(errors).toEqual([]);
});

test('Y8 build: hidden page / lost focus pause + mute, return resumes', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, STUB, progress(1));
  await page.evaluate(() => (window.__y8!.mode = 'noAd'));
  await page.getByTestId('play').click();
  await expect(page.locator('.wheel')).toBeVisible();
  await expect.poll(() => ctxStates(page)).toEqual(['running']);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(() => ctxStates(page)).toEqual(['suspended']);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => ctxStates(page)).toEqual(['running']);
  expect(errors).toEqual([]);
});

test('Y8 build: with the SDK blocked (ad blocker) a level plays, Next goes on, no rewarded button', async ({ page }) => {
  const { errors } = await boot(page, Y8_SDK, null, progress(1, 0));
  await page.getByTestId('play').click();
  await page.getByTestId('hint').click();
  await page.getByTestId('hint').click();
  await expect(page.getByTestId('watch-ad')).toHaveCount(0);
  await solveLevel(page);
  await page.getByTestId('next').click();
  await expect(page.locator('.hud .title small')).toHaveText('Level 3');
  expect(errors).toEqual([]);
});
