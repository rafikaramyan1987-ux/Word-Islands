import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GamePixPlatform, type GPXAdResult, type GPXSdk } from '../src/platform/gamepix';
import { CrazyGamesPlatform, type CGSdk } from '../src/platform/crazygames';
import { AD_TIMEOUT_MS } from '../src/platform/util';
import type { Platform } from '../src/platform/types';

const store = new Map<string, string>();
const base: Platform = {
  id: 'web',
  init: async () => {},
  locale: () => 'en',
  loadingStart() {}, loadingDone() {}, gameplayStart() {}, gameplayStop() {},
  hasRewarded: () => false,
  showRewarded: async () => false,
  showInterstitial: async () => {},
  storageGet: (k) => store.get(k) ?? null,
  storageSet: (k, v) => void store.set(k, v),
  storageRemove: (k) => void store.delete(k),
  onPause() {},
};

/** a fake GamePix SDK v3 recording every call; ads answer through `answer` */
function fakeGpx() {
  const calls: string[] = [];
  const handlers: Record<string, () => void> = {};
  let answer: (r: unknown) => void = () => {};
  const sdk: GPXSdk = {
    lang: () => 'fr',
    lifecycle: {
      loading: (p) => void calls.push(`loading:${p}`),
      loaded: () => (calls.push('loaded'), Promise.resolve()),
      gameStart: () => void calls.push('gameStart'),
    },
    events: { on: (name, fn) => void (handlers[name] = fn) },
    ads: {
      interstitial: () => (calls.push('interstitial'), new Promise<GPXAdResult>((r) => (answer = r as (x: unknown) => void))),
      reward: () => (calls.push('reward'), new Promise<GPXAdResult>((r) => (answer = r as (x: unknown) => void))),
    },
    happyMoment: (n) => void calls.push(`happy:${n}`),
    sadMoment: (n) => void calls.push(`sad:${n}`),
  };
  return { sdk, calls, emit: (n: string) => handlers[n]?.(), answer: (r: unknown) => answer(r) };
}

describe('GamePix SDK v3 wrapper', () => {
  let f: ReturnType<typeof fakeGpx>;
  let gp: GamePixPlatform;
  let pauses: boolean[];
  let mutes: boolean[];

  beforeEach(async () => {
    vi.useFakeTimers();
    f = fakeGpx();
    (globalThis as unknown as { window: unknown }).window = { GamePix: f.sdk };
    gp = new GamePixPlatform(base, () => f.sdk);
    pauses = [];
    mutes = [];
    gp.onPause((p) => pauses.push(p));
    gp.onMute((m) => mutes.push(m));
    await gp.init();
    await gp.ready();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('reports loading(100), waits for loaded(), reads GamePix.lang() and starts the game once', () => {
    expect(f.calls.slice(0, 2)).toEqual(['loading:100', 'loaded']);
    expect(gp.locale()).toBe('fr');
    gp.gameplayStart();
    gp.gameplayStart();
    expect(f.calls.filter((c) => c === 'gameStart')).toHaveLength(1);
  });

  it('assigns the legacy pause / resume / soundOff / soundOn properties', () => {
    for (const k of ['pause', 'resume', 'soundOff', 'soundOn'] as const) expect(typeof f.sdk[k]).toBe('function');
  });

  it('pause / resume and soundOff / soundOn are idempotent (event + legacy property for one change)', async () => {
    f.emit('pause');
    f.sdk.pause!();
    f.emit('soundOff');
    f.sdk.soundOff!();
    await vi.advanceTimersByTimeAsync(0);
    f.emit('resume');
    f.sdk.resume!();
    f.emit('soundOn');
    expect(pauses).toEqual([true, false]);
    expect(mutes).toEqual([true, false]);
  });

  it('grants the reward only when result.success === true', async () => {
    let p = gp.showRewarded();
    f.answer({ success: true });
    expect(await p).toBe(true);
    p = gp.showRewarded();
    f.answer({ success: false });
    expect(await p).toBe(false);
    p = gp.showRewarded();
    f.answer(true); // a bare true is not a success
    expect(await p).toBe(false);
  });

  it('an ad that never starts settles false after the timeout; a second concurrent request is refused', async () => {
    const p = gp.showRewarded();
    expect(await gp.showRewarded()).toBe(false);
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT_MS + 10);
    expect(await p).toBe(false);
  });

  it('happyMoment on level complete', () => {
    gp.levelCompleted();
    expect(f.calls).toContain('happy:level_complete');
  });
});

function fakeCg(env: CGSdk['environment'] = 'crazygames') {
  const calls: string[] = [];
  let cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void } = {};
  let settings: ((s: { muteAudio?: boolean }) => void) | null = null;
  const data = new Map<string, string>();
  const sdk: CGSdk = {
    init: async () => void calls.push('init'),
    environment: env,
    game: {
      gameplayStart: () => void calls.push('gameplayStart'),
      gameplayStop: () => void calls.push('gameplayStop'),
      loadingStart: () => void calls.push('loadingStart'),
      loadingStop: () => void calls.push('loadingStop'),
      happytime: () => void calls.push('happytime'),
      settings: { muteAudio: true },
      addSettingsChangeListener: (f) => void (settings = f),
    },
    ad: { requestAd: (type, c) => { calls.push(`ad:${type}`); cb = c; } },
    data: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) },
    user: { systemInfo: { locale: 'de-DE' } },
  };
  return { sdk, calls, cb: () => cb, settings: (s: { muteAudio?: boolean }) => settings?.(s), data };
}

describe('CrazyGames SDK v3 wrapper', () => {
  let f: ReturnType<typeof fakeCg>;
  let cg: CrazyGamesPlatform;
  let mutes: boolean[];
  let pauses: boolean[];

  beforeEach(async () => {
    vi.useFakeTimers();
    f = fakeCg();
    (globalThis as unknown as { window: unknown }).window = { CrazyGames: { SDK: f.sdk } };
    (globalThis as unknown as { document: unknown }).document = { getElementById: () => null };
    cg = new CrazyGamesPlatform(base, () => f.sdk);
    await cg.init();
    mutes = [];
    pauses = [];
    cg.onMute((m) => mutes.push(m));
    cg.onPause((p) => pauses.push(p));
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  it('reads the locale, saves through the Data module and follows muteAudio live', () => {
    expect(cg.locale()).toBe('de-DE');
    cg.storageSet('k', 'v');
    expect(f.data.get('k')).toBe('v');
    expect(mutes).toEqual([true]);
    f.settings({ muteAudio: false });
    expect(mutes).toEqual([true, false]);
  });

  it('de-duplicates loading and gameplay events, happytime on level complete', () => {
    cg.loadingStart();
    cg.loadingStart();
    cg.loadingDone();
    cg.gameplayStart();
    cg.gameplayStart();
    cg.gameplayStop();
    cg.levelCompleted();
    expect(f.calls.filter((c) => c !== 'init')).toEqual(['loadingStart', 'loadingStop', 'gameplayStart', 'gameplayStop', 'happytime']);
  });

  it('rewarded pays only on adFinished and settles once; pauses the game during the ad', async () => {
    const p = cg.showRewarded();
    f.cb().adStarted!();
    f.cb().adFinished!();
    f.cb().adError!(new Error('late'));
    expect(await p).toBe(true);
    expect(pauses).toEqual([true, false]);
    const q = cg.showRewarded();
    f.cb().adError!(new Error('no fill'));
    expect(await q).toBe(false);
  });

  it('an ad that does not start within 8 s settles false', async () => {
    const p = cg.showInterstitial();
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT_MS + 10);
    await expect(p).resolves.toBeUndefined();
    const r = cg.showRewarded();
    await vi.advanceTimersByTimeAsync(AD_TIMEOUT_MS + 10);
    expect(await r).toBe(false);
  });

  it('a disabled environment plays on without the SDK', async () => {
    const g = fakeCg('disabled');
    const c = new CrazyGamesPlatform(base, () => g.sdk);
    await c.init();
    expect(c.hasRewarded()).toBe(false);
    expect(await c.showRewarded()).toBe(false);
  });
});
