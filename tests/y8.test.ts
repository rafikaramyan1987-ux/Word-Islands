import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AD_MAX_MS, Y8Platform, Y8_APP_ID, Y8_GAME_ID, type Y8ShowAdOptions, type Y8Sdk } from '../src/platform/y8';
import { AD_TIMEOUT_MS } from '../src/platform/util';
import { fakeDom, memBase } from './portal-dom';

type W = Window & typeof globalThis;
const w = () => globalThis.window as unknown as W;

/** a fake Y8 SDK: records calls; the test plays the ad callbacks through `last` */
function fakeY8() {
  const calls: string[] = [];
  let inited = false;
  let last: Y8ShowAdOptions | null = null;
  let result: Promise<unknown> | undefined;
  const sdk: Y8Sdk = {
    init(app, ad) {
      calls.push(`init:${app.appId}:${app.autoLogin}:${ad.gameId}:${ad.preloadAdBreaks}:${ad.sound}`);
      inited = true;
      ad.onReady();
    },
    onAuth(cb) {
      calls.push('onAuth');
      cb(null, null);
    },
    showAd(o) {
      calls.push((inited ? '' : 'BEFORE-INIT:') + o.type);
      last = o;
      return result;
    },
  };
  return {
    sdk,
    calls,
    get last() {
      return last!;
    },
    reject() {
      let rej: (e: unknown) => void = () => {};
      result = new Promise((_r, j) => (rej = j));
      return (e: unknown) => rej(e);
    },
  };
}

describe('Y8 SDK wrapper', () => {
  let dom: ReturnType<typeof fakeDom>;
  let f: ReturnType<typeof fakeY8>;
  let y8: Y8Platform;
  let pauses: boolean[];
  let mutes: boolean[];

  /** the SDK script already loaded: emitReadyEvent() dispatches y8sdk.ready */
  function installSdk() {
    w().y8 = { sdk: () => f.sdk, emitReadyEvent: () => void w().dispatchEvent(new Event('y8sdk.ready')) };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    dom = fakeDom();
    f = fakeY8();
    y8 = new Y8Platform(memBase());
    pauses = [];
    mutes = [];
    y8.onPause((p) => pauses.push(p));
    y8.onMute((m) => mutes.push(m));
  });
  afterEach(() => {
    vi.useRealTimers();
    dom.cleanup();
  });

  it('initializes exactly as the portal snippet (App ID, Game ID, autoLogin, preloadAdBreaks, sound, onAuth), once', async () => {
    installSdk();
    await y8.init();
    expect(Y8_APP_ID).toBe('6af4b1c73c0f1c5e7ad96ecf');
    expect(Y8_GAME_ID).toBe('292549');
    expect(f.calls).toEqual(['init:6af4b1c73c0f1c5e7ad96ecf:true:292549:on:on', 'onAuth']);
    expect(y8.initialized).toBe(true);
    expect(y8.adsReady).toBe(true);
    w().dispatchEvent(new Event('y8sdk.ready')); // { once: true }
    expect(f.calls.filter((c) => c.startsWith('init'))).toHaveLength(1);
  });

  it('an SDK that loads after the game still initializes on y8sdk.ready', async () => {
    const p = y8.init(3500);
    vi.advanceTimersByTime(3500);
    await p;
    expect(y8.initialized).toBe(false);
    installSdk();
    w().dispatchEvent(new Event('y8sdk.ready'));
    expect(y8.initialized).toBe(true);
  });

  it('no SDK (ad blocker): no ad calls, no rewarded button, the game goes on at once', async () => {
    const p = y8.init(3500);
    vi.advanceTimersByTime(3500);
    await p;
    expect(y8.hasRewarded()).toBe(false);
    await y8.showInterstitial('start');
    await y8.showInterstitial('next');
    await expect(y8.showRewarded()).resolves.toBe(false);
    expect(f.calls).toEqual([]);
  });

  it('`start` only on the first Play, `next` at every break with no cap of our own; never during a level', async () => {
    installSdk();
    await y8.init();
    for (const slot of ['start', 'start', 'next', 'next'] as const) {
      const p = y8.showInterstitial(slot);
      f.last?.adBreakDone?.({ breakStatus: 'notReady' });
      await p;
    }
    y8.gameplayStart();
    await y8.showInterstitial('next');
    expect(f.calls.slice(2)).toEqual(['start', 'next', 'next']);
    expect(f.calls.some((c) => c.startsWith('BEFORE-INIT'))).toBe(false);
  });

  it('beforeAd pauses + mutes, afterAd resumes + unmutes, adBreakDone settles exactly once', async () => {
    installSdk();
    await y8.init();
    let settled = 0;
    const p = y8.showInterstitial('next').then(() => settled++);
    f.last.beforeAd!();
    expect(pauses).toEqual([true]);
    expect(mutes).toEqual([true]);
    f.last.afterAd!();
    expect(pauses).toEqual([true, false]);
    expect(mutes).toEqual([true, false]);
    f.last.adBreakDone!({ breakStatus: 'viewed' });
    f.last.adBreakDone!({ breakStatus: 'viewed' });
    await p;
    vi.advanceTimersByTime(AD_MAX_MS * 2);
    await Promise.resolve();
    expect(settled).toBe(1);
  });

  it('a rejected showAd(), a throw, or nothing started within AD_TIMEOUT_MS settles the request', async () => {
    installSdk();
    await y8.init();
    const rej = f.reject();
    const a = y8.showInterstitial('next');
    rej(new Error('ad error'));
    await a;
    f.sdk.showAd = () => {
      throw new Error('boom');
    };
    await y8.showInterstitial('next');
    f.sdk.showAd = () => undefined;
    const c = y8.showInterstitial('next');
    vi.advanceTimersByTime(AD_TIMEOUT_MS);
    await c;
    expect(pauses).toEqual([]);
  });

  it('an ad that started but never ends is given up after AD_MAX_MS (the game cannot stay paused)', async () => {
    installSdk();
    await y8.init();
    const p = y8.showInterstitial('next');
    f.last.beforeAd!();
    vi.advanceTimersByTime(AD_MAX_MS);
    await p;
    expect(pauses).toEqual([true, false]);
  });

  it('rewarded: showAdFn() in beforeReward, the reward only after adViewed; dismissed / no ad = no reward', async () => {
    installSdk();
    await y8.init();
    expect(y8.hasRewarded()).toBe(true);
    // viewed
    let p = y8.showRewarded();
    expect(f.last.type).toBe('reward');
    const show = vi.fn(() => f.last.beforeAd!());
    f.last.beforeReward!(show);
    expect(show).toHaveBeenCalledTimes(1);
    expect(pauses).toEqual([true]);
    f.last.adViewed!();
    f.last.afterAd!();
    f.last.adBreakDone!({ breakStatus: 'viewed' });
    await expect(p).resolves.toBe(true);
    // dismissed
    p = y8.showRewarded();
    f.last.beforeReward!(() => f.last.beforeAd!());
    f.last.adDismissed!();
    f.last.afterAd!();
    f.last.adBreakDone!({ breakStatus: 'dismissed' });
    await expect(p).resolves.toBe(false);
    // no ad: only adBreakDone
    p = y8.showRewarded();
    f.last.adBreakDone!({ breakStatus: 'noAdPreloaded' });
    await expect(p).resolves.toBe(false);
    // adViewed after the request settled grants nothing
    p = y8.showRewarded();
    vi.advanceTimersByTime(AD_TIMEOUT_MS);
    await expect(p).resolves.toBe(false);
    f.last.adViewed?.();
    expect(pauses.at(-1)).toBe(false);
  });

  it('pauses + mutes while the page is hidden or the window lost focus, resumes on return', async () => {
    installSdk();
    await y8.init();
    dom.setHidden(true);
    expect(pauses).toEqual([true]);
    expect(mutes).toEqual([true]);
    w().dispatchEvent(new Event('blur'));
    dom.setHidden(false);
    expect(pauses).toEqual([true]); // still unfocused
    w().dispatchEvent(new Event('focus'));
    expect(pauses).toEqual([true, false]);
    expect(mutes).toEqual([true, false]);
  });

  it('saves and locale come from the web platform (localStorage)', () => {
    y8.storageSet('k', 'v');
    expect(y8.storageGet('k')).toBe('v');
    expect(y8.locale()).toBe('de');
    expect(y8.id).toBe('y8');
  });
});
