import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AD_MAX_MS, GameMonetizePlatform, GM_AD_GAP_MS, GM_GAME_ID, GM_SCRIPT_ID, GM_SDK_URL } from '../src/platform/gamemonetize';
import { AD_TIMEOUT_MS } from '../src/platform/util';
import { fakeDom, memBase } from './portal-dom';

type W = Window & typeof globalThis;
const w = () => globalThis.window as unknown as W;

describe('GameMonetize SDK wrapper', () => {
  let dom: ReturnType<typeof fakeDom>;
  let gm: GameMonetizePlatform;
  let now: number;
  let pauses: boolean[];
  let mutes: boolean[];
  let banner: ReturnType<typeof vi.fn>;

  /** init with the SDK script "loaded": sdk.showBanner present, SDK_READY sent */
  async function boot(ready = true) {
    const p = gm.init();
    dom.scripts[0].onload?.();
    await p;
    w().sdk = { showBanner: banner };
    if (ready) w().SDK_OPTIONS!.onEvent({ name: 'SDK_READY' });
  }
  const ev = (name: string) => w().SDK_OPTIONS!.onEvent({ name });

  beforeEach(() => {
    vi.useFakeTimers();
    dom = fakeDom();
    now = 1_000_000;
    gm = new GameMonetizePlatform(memBase(), GM_GAME_ID, () => now);
    pauses = [];
    mutes = [];
    gm.onPause((p) => pauses.push(p));
    gm.onMute((m) => mutes.push(m));
    banner = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    dom.cleanup();
  });

  it('sets SDK_OPTIONS (exact game ID + onEvent) and then injects sdk.js once, as the README loader', async () => {
    const p = gm.init();
    expect(w().SDK_OPTIONS!.gameId).toBe('0cqkyktpv3nnr3nokt7jhqbzryqmfh2h');
    expect(typeof w().SDK_OPTIONS!.onEvent).toBe('function');
    expect(dom.scripts).toHaveLength(1);
    expect(dom.scripts[0]).toMatchObject({ id: GM_SCRIPT_ID, src: GM_SDK_URL });
    expect(GM_SDK_URL).toBe('https://api.gamemonetize.com/sdk.js');
    dom.scripts[0].onload?.();
    await p;
    await gm.init();
    expect(dom.scripts).toHaveLength(1);
  });

  it('a blocked SDK resolves init at once and the game plays on without ads', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = gm.init();
    dom.scripts[0].onerror?.();
    await p;
    expect(gm.adsReady).toBe(false);
    await gm.showInterstitial();
    expect(gm.requests).toBe(0);
  });

  it('init never waits longer than its timeout', async () => {
    const p = gm.init(3500);
    vi.advanceTimersByTime(3500);
    await expect(p).resolves.toBeUndefined();
  });

  it('no interstitial before SDK_READY', async () => {
    await boot(false);
    await gm.showInterstitial();
    expect(banner).not.toHaveBeenCalled();
  });

  it('SDK_GAME_PAUSE pauses and mutes, SDK_GAME_START resumes, unmutes and settles the request once', async () => {
    await boot();
    let settled = 0;
    const p = gm.showInterstitial().then(() => settled++);
    expect(banner).toHaveBeenCalledTimes(1);
    ev('SDK_GAME_PAUSE');
    expect(pauses).toEqual([true]);
    expect(mutes).toEqual([true]);
    ev('SDK_GAME_START');
    await p;
    ev('SDK_GAME_START');
    vi.advanceTimersByTime(AD_MAX_MS * 2);
    await Promise.resolve();
    expect(settled).toBe(1);
    expect(pauses).toEqual([true, false]);
    expect(mutes).toEqual([true, false]);
  });

  it('an ad that never starts settles after AD_TIMEOUT_MS; one that never ends after AD_MAX_MS', async () => {
    await boot();
    const p = gm.showInterstitial();
    vi.advanceTimersByTime(AD_TIMEOUT_MS);
    await p;
    now += GM_AD_GAP_MS;
    const q = gm.showInterstitial();
    ev('SDK_GAME_PAUSE');
    vi.advanceTimersByTime(AD_TIMEOUT_MS);
    expect(pauses).toEqual([true]);
    vi.advanceTimersByTime(AD_MAX_MS);
    await q;
    expect(pauses).toEqual([true, false]);
  });

  it('a throwing showBanner() settles at once', async () => {
    await boot();
    banner.mockImplementation(() => {
      throw new Error('no ad');
    });
    await gm.showInterstitial();
    expect(pauses).toEqual([]);
  });

  it('at most one interstitial per ~2 minutes, never while a level is played, never two at once', async () => {
    await boot();
    const first = gm.showInterstitial();
    await gm.showInterstitial(); // while the first is pending
    ev('SDK_GAME_START');
    await first;
    expect(banner).toHaveBeenCalledTimes(1);
    now += GM_AD_GAP_MS - 1000;
    await gm.showInterstitial();
    expect(banner).toHaveBeenCalledTimes(1);
    now += 1000;
    gm.gameplayStart();
    await gm.showInterstitial();
    expect(banner).toHaveBeenCalledTimes(1);
    gm.gameplayStop();
    const p = gm.showInterstitial();
    ev('SDK_GAME_START');
    await p;
    expect(banner).toHaveBeenCalledTimes(2);
  });

  it('has no rewarded ads: hasRewarded() is false and showRewarded() never shows an ad', async () => {
    await boot();
    expect(gm.hasRewarded()).toBe(false);
    await expect(gm.showRewarded()).resolves.toBe(false);
    expect(banner).not.toHaveBeenCalled();
  });

  it('pauses / resumes for ads the SDK shows by itself (pre-roll)', async () => {
    await boot();
    ev('SDK_GAME_PAUSE');
    ev('SDK_GAME_START');
    expect(pauses).toEqual([true, false]);
    expect(mutes).toEqual([true, false]);
  });

  it('saves and locale come from the web platform (localStorage)', () => {
    gm.storageSet('k', 'v');
    expect(gm.storageGet('k')).toBe('v');
    gm.storageRemove('k');
    expect(gm.storageGet('k')).toBeNull();
    expect(gm.locale()).toBe('de');
    expect(gm.id).toBe('gamemonetize');
  });
});
