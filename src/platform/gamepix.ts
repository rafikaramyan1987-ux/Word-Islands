/**
 * GamePix JS SDK v3 (https://integration.gamepix.com/sdk/v3/gamepix.sdk.js, loaded by index.html in the GamePix build
 * only, after `window.GamePixConfig = { lifecycle: 'manual' }` and before the game bundle). Ported from the
 * integration that passed the GamePix preview checks in Mahjong Jade Garden.
 * - lifecycle: `loading(0..100)` (integer, only increasing) while the game boots, `await loaded()` before the menu
 *   is shown (never longer than LOADED_TIMEOUT), `gameStart()` once, when the first level starts
 * - `pause` / `resume` events (also sent around the SDK's ads): pause the game and mute all audio / resume; idempotent
 * - `soundOff` / `soundOn` events (the Player's sound button): mute all audio without pausing / lift only that mute;
 *   idempotent. Older SDKs without `events.on` get the same handlers through `GamePix.on.*`.
 * - the same handlers are also assigned as the legacy properties `GamePix.soundOff / soundOn / pause / resume`
 *   (written as `window.GamePix.soundOff = ...` so the minified bundle keeps the literal text, checked in CI). A
 *   repeat of the same signal in the same tick (event + property for one change) is ignored.
 * - interstitials (`GamePix.ads.interstitial()`) only between levels; rewarded ads (`GamePix.ads.reward()`) only
 *   from an explicit click; the reward only when `result.success === true`
 * - every ad request settles exactly once: the SDK's answer, a throwing call, a second concurrent request, or nothing
 *   started within AD_TIMEOUT_MS
 * - happyMoment('level_complete') when a level is solved; sadMoment(name) where the game has a sad moment
 * - language from `GamePix.lang()`, read once in init(); the save stays in plain localStorage under the game's one
 *   known key (the SDK synchronises it)
 * - without the SDK (blocked, offline) the game plays on: no ads, "no ad available"
 */
import type { Platform } from './types';
import { gpxLoading } from './gamepixLoading';
import { AD_TIMEOUT_MS } from './util';

export const GPX_SDK_URL = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';
/** loaded() resolves even without a Player; this is only a safety net so the menu always appears */
export const LOADED_TIMEOUT = 5000;
/** an ad that started but never answers releases the game after this long (ms) */
export const AD_MAX = 120_000;

export interface GPXAdResult {
  success: boolean;
  message?: string;
}
export interface GPXSdk {
  lang?(): string;
  lifecycle: { loading(p: number): void; loaded(): Promise<unknown>; gameStart(): void };
  events: { on(name: 'pause' | 'resume' | 'soundOff' | 'soundOn', fn: () => void): void };
  on?: { pause?: () => void; resume?: () => void; soundOff?: () => void; soundOn?: () => void };
  ads: { interstitial(): Promise<GPXAdResult>; reward(): Promise<GPXAdResult> };
  happyMoment?(name: string): void;
  sadMoment?(name: string): void;
  soundOff?: () => void;
  soundOn?: () => void;
  pause?: () => void;
  resume?: () => void;
}

type GPXSignal = 'pause' | 'resume' | 'soundOff' | 'soundOn';
const OPPOSITE: Record<GPXSignal, GPXSignal> = { pause: 'resume', resume: 'pause', soundOff: 'soundOn', soundOn: 'soundOff' };

declare global {
  interface Window {
    GamePix?: GPXSdk;
    GamePixConfig?: { lifecycle?: 'auto' | 'manual' };
  }
}

export class GamePixPlatform implements Platform {
  readonly id = 'gamepix' as const;
  private soundOff = false;
  private muteCb: (m: boolean) => void = () => {};
  private pauseCb: (p: boolean) => void = () => {};
  private isLoaded = false;
  private started = false;
  /** what the game was last told */
  private paused = false;
  /** the Player paused the game (pause / resume outside an ad) */
  private playerPaused = false;
  /** one of our ads is playing */
  private adOn = false;
  private busy = false;
  private adStarted: (() => void) | null = null;
  private blocker: HTMLElement | null = null;
  private tick: Set<GPXSignal> | null = null;
  private lang: string | null = null;

  constructor(private readonly base: Platform, private readonly get: () => GPXSdk | undefined = () => window.GamePix) {}

  private get s() {
    return this.get();
  }

  /** register the pause / sound handlers and read the language; never throws */
  async init() {
    const s = this.s;
    if (!s) return;
    const on: Record<GPXSignal, () => void> = {
      pause: () => this.signal('pause', () => this.setPaused(true)),
      resume: () => this.signal('resume', () => this.setPaused(false)),
      soundOff: () => this.signal('soundOff', () => this.setSoundOff(true)),
      soundOn: () => this.signal('soundOn', () => this.setSoundOff(false)),
    };
    this.call(() => {
      s.events.on('pause', on.pause);
      s.events.on('resume', on.resume);
    });
    this.call(() => {
      if (typeof s.events?.on === 'function') {
        s.events.on('soundOff', on.soundOff);
        s.events.on('soundOn', on.soundOn);
      } else if (s.on && typeof s.on === 'object') {
        s.on.pause = on.pause;
        s.on.resume = on.resume;
        s.on.soundOff = on.soundOff;
        s.on.soundOn = on.soundOn;
      }
    });
    // legacy properties the Player checks for (the same handlers)
    this.call(() => {
      if (typeof window !== 'undefined' && window.GamePix && window.GamePix === s) {
        window.GamePix.soundOff = on.soundOff;
        window.GamePix.soundOn = on.soundOn;
        window.GamePix.pause = on.pause;
        window.GamePix.resume = on.resume;
      } else {
        s.soundOff = on.soundOff;
        s.soundOn = on.soundOn;
        s.pause = on.pause;
        s.resume = on.resume;
      }
    });
    // the Player's language, once, before loaded()
    this.call(() => {
      const v = typeof s.lang === 'function' ? s.lang() : null;
      if (typeof v === 'string' && v) this.lang = v;
    });
  }

  /** assets are loaded: loading(100), then await loaded() (bounded) before the menu */
  async ready(timeoutMs = LOADED_TIMEOUT) {
    const s = this.s;
    if (!s) return;
    gpxLoading(100);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([Promise.resolve().then(() => s.lifecycle.loaded()), new Promise((res) => (timer = setTimeout(res, timeoutMs)))]);
    } catch {
      /* the game is shown anyway */
    } finally {
      clearTimeout(timer);
    }
    this.isLoaded = true;
  }

  /** the event and the legacy property may both fire for one change: a repeat in the same tick is ignored */
  private signal(name: GPXSignal, f: () => void) {
    if (this.tick?.has(name)) return;
    if (!this.tick) {
      this.tick = new Set();
      void Promise.resolve().then(() => (this.tick = null));
    }
    this.tick.add(name);
    this.tick.delete(OPPOSITE[name]);
    f();
  }

  /** pause / resume. While one of our ads is requested, the first pause is that ad starting. Idempotent. */
  setPaused(p: boolean) {
    if (p && this.adStarted && !this.adOn) {
      this.adOn = true;
      this.adStarted();
    } else if (!p && this.busy && this.adOn && !this.playerPaused) {
      this.adOn = false;
    } else this.playerPaused = p;
    this.update();
  }

  private update() {
    const p = this.playerPaused || this.adOn;
    if (this.paused === p) return;
    this.paused = p;
    this.block(p);
    this.pauseCb(p);
  }

  /** the Player's sound button: mute without pausing; soundOn only lifts this mute. Idempotent. */
  setSoundOff(off: boolean) {
    if (this.soundOff === off) return;
    this.soundOff = off;
    this.muteCb(off);
  }

  get muted() {
    return this.soundOff;
  }

  /** while paused nothing in the game takes input */
  private block(on: boolean) {
    if (on && !this.blocker && typeof document !== 'undefined') {
      const b = document.createElement('div');
      b.dataset.testid = 'gpx-pause';
      b.style.cssText = 'position:fixed;inset:0;z-index:60;background:transparent;touch-action:none';
      for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart', 'wheel'])
        b.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      document.body.append(b);
      this.blocker = b;
    } else if (!on && this.blocker) {
      this.blocker.remove();
      this.blocker = null;
    }
  }

  locale() {
    return this.lang ?? this.base.locale();
  }
  loadingStart() {
    if (this.s) gpxLoading(1);
  }
  loadingDone() {}
  /** the first level starts: gameStart() once per session */
  gameplayStart() {
    if (this.started || !this.isLoaded) return;
    this.started = true;
    this.call(() => this.s?.lifecycle.gameStart());
  }
  gameplayStop() {}
  levelCompleted() {
    this.happyMoment('level_complete');
  }
  happyMoment(name: string) {
    if (this.isLoaded) this.call(() => this.s?.happyMoment?.(name));
  }
  sadMoment(name: string) {
    if (this.isLoaded) this.call(() => this.s?.sadMoment?.(name));
  }
  private call(f: () => void) {
    try {
      f();
    } catch {
      /* an SDK hiccup must never break the game */
    }
  }

  hasRewarded() {
    return this.isLoaded && !!this.s?.ads;
  }

  /**
   * Ask the SDK for an ad and settle exactly once: true only on `{ success: true }`; false on anything else, a
   * rejection, a throwing call, a second concurrent request, or no ad started and no answer within AD_TIMEOUT_MS.
   */
  requestAd(type: 'interstitial' | 'reward'): Promise<boolean> {
    const s = this.s;
    if (!s || !this.isLoaded || this.busy) return Promise.resolve(false);
    this.busy = true;
    return new Promise((res) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        this.busy = false;
        this.adStarted = null;
        clearTimeout(timer);
        this.adOn = false;
        this.update();
        res(ok);
      };
      let timer = setTimeout(() => finish(false), AD_TIMEOUT_MS);
      this.adStarted = () => {
        this.adStarted = null;
        clearTimeout(timer);
        timer = setTimeout(() => finish(false), AD_MAX);
      };
      try {
        const r = type === 'reward' ? s.ads.reward() : s.ads.interstitial();
        Promise.resolve(r).then(
          (v) => finish(!!v && typeof v === 'object' && v.success === true),
          () => finish(false),
        );
      } catch {
        finish(false);
      }
    });
  }

  showRewarded() {
    return this.requestAd('reward');
  }
  async showInterstitial() {
    await this.requestAd('interstitial');
  }

  storageGet(k: string) {
    return this.base.storageGet(k);
  }
  storageSet(k: string, v: string) {
    this.base.storageSet(k, v);
  }
  storageRemove(k: string) {
    this.base.storageRemove(k);
  }
  onPause(cb: (p: boolean) => void) {
    this.pauseCb = cb;
  }
  onMute(cb: (m: boolean) => void) {
    this.muteCb = cb;
  }
}

export function createGamePixPlatform(base: Platform): Platform {
  return new GamePixPlatform(base);
}
