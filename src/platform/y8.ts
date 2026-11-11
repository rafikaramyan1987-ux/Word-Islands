/**
 * Y8 SDK (docs.y8.com: sdk/advertising, sdk/ad-placement-guidelines, studio/game-requirements), as in Cookie Heist:
 * - the SDK comes only from Y8's CDN: `<script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async>` in <head>
 *   (vite.config.ts, Y8 build only), never bundled
 * - initialized once, exactly as the portal snippet: a `y8sdk.ready` listener ({ once: true }) that runs
 *   `y8Sdk = y8.sdk()`, `y8Sdk.init({ appId, autoLogin: true }, { gameId, preloadAdBreaks: 'on', sound: 'on', onReady })`
 *   and `y8Sdk.onAuth(…)`, then `window.y8.emitReadyEvent()` in case the SDK had already loaded. Guest play always
 *   works: onAuth only logs, nothing waits for a login.
 * - no ad call before init; with an ad blocker (no SDK) the game plays on without ads and without rewarded buttons
 * - interstitials only from a click outside gameplay: `start` on the player's first Play click on the menu, `next` on
 *   Next / Menu of a level-complete screen. No frequency cap of our own: the SDK paces them, and a break that shows
 *   nothing continues at once.
 * - pause + mute in beforeAd, resume + restore audio (the player's settings) in afterAd. Every request settles exactly
 *   once: adBreakDone, .catch(), a throw, or a timeout (nothing started within AD_TIMEOUT_MS, AD_MAX_MS in all)
 * - rewarded (`reward`), from the "Watch an ad: +25 coins" button only: beforeReward(showAdFn) calls showAdFn(); the
 *   reward only after adViewed; adDismissed or no ad = no reward ("No ad available right now, try later")
 * - pause + mute while the page is hidden (visibilitychange) or the window has lost focus (blur), resume on return
 * - saves use localStorage (the web platform's storage); no external links
 */
import type { AdSlot, Platform } from './types';
import { AD_TIMEOUT_MS } from './util';

export const Y8_APP_ID = '6af4b1c73c0f1c5e7ad96ecf';
export const Y8_GAME_ID = '292549';
export const Y8_SDK_URL = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
/** a started ad whose break never ends is given up after this long, so the game cannot stay paused (ms) */
export const AD_MAX_MS = 120_000;

export interface Y8AdBreakInfo {
  breakStatus?: string;
}
export interface Y8ShowAdOptions {
  type: 'start' | 'next' | 'reward';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adViewed?: () => void;
  adDismissed?: () => void;
  adBreakDone?: (info: Y8AdBreakInfo) => void;
}
export interface Y8Sdk {
  init(
    appConfig: { appId: string; autoLogin: boolean },
    adConfig: { gameId: string; preloadAdBreaks: string; sound: string; onReady: () => void },
  ): unknown;
  onAuth(cb: (user: unknown, error: unknown) => void): unknown;
  showAd(opts: Y8ShowAdOptions): Promise<unknown> | unknown;
}

declare global {
  interface Window {
    y8?: { sdk(): Y8Sdk; emitReadyEvent?: () => void };
  }
}

type PauseReason = 'ad' | 'hidden' | 'blur';

export class Y8Platform implements Platform {
  readonly id = 'y8' as const;
  /** the SDK instance, set only once `init()` has been called on it */
  private y8Sdk: Y8Sdk | null = null;
  private adSystemReady = false;
  private playing = false;
  private startShown = false;
  private busy = false;
  private pausedBy = new Set<PauseReason>();
  private pauseCb: (p: boolean) => void = () => {};
  private muteCb: (m: boolean) => void = () => {};
  /** showAd() calls (type:name), for tests */
  readonly log: string[] = [];

  constructor(
    private readonly base: Platform,
    private readonly appId = Y8_APP_ID,
    private readonly gameId = Y8_GAME_ID,
  ) {}

  /** the portal snippet; waits for `y8sdk.ready` at most `timeoutMs` (ad blocker: never), a late SDK still initializes */
  async init(timeoutMs = 3500) {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.setPaused('hidden', document.hidden));
      window.addEventListener('blur', () => this.setPaused('blur', true));
      window.addEventListener('focus', () => this.setPaused('blur', false));
    }
    await new Promise<void>((res) => {
      const to = setTimeout(res, timeoutMs);
      window.addEventListener(
        'y8sdk.ready',
        () => {
          try {
            const y8Sdk = window.y8!.sdk();
            const appConfig = { appId: this.appId, autoLogin: true };
            const adConfig = { gameId: this.gameId, preloadAdBreaks: 'on', sound: 'on', onReady: () => (this.adSystemReady = true) };
            y8Sdk.init(appConfig, adConfig);
            // guest play needs nothing: a signed-in player is just recognised
            y8Sdk.onAuth((_user, error) => {
              if (error) console.warn('Y8 auth:', error);
            });
            this.y8Sdk = y8Sdk;
          } catch (e) {
            console.warn('Y8 SDK init failed, playing without ads', e);
          }
          clearTimeout(to);
          res();
        },
        { once: true },
      );
      // the SDK may have loaded before this listener: ask it to announce itself again
      try {
        if (window.y8 && window.y8.emitReadyEvent) window.y8.emitReadyEvent();
      } catch {
        /* play on */
      }
    });
  }

  /** the SDK is initialized (init() was called on it) */
  get initialized() {
    return this.y8Sdk !== null;
  }
  /** the ad system reported ready (adConfig.onReady) */
  get adsReady() {
    return this.adSystemReady;
  }

  /** ad, hidden page or lost focus: the game pauses and is silent while any of them holds */
  setPaused(reason: PauseReason, on: boolean) {
    if (on === this.pausedBy.has(reason)) return;
    const was = this.pausedBy.size > 0;
    if (on) this.pausedBy.add(reason);
    else this.pausedBy.delete(reason);
    const p = this.pausedBy.size > 0;
    if (p === was) return;
    this.muteCb(p);
    this.pauseCb(p);
  }

  /** one showAd() call, settled exactly once: adBreakDone, .catch(), a throw, not started in AD_TIMEOUT_MS, or AD_MAX_MS */
  private showAd(type: Y8ShowAdOptions['type'], name: string): Promise<boolean> {
    const s = this.y8Sdk;
    if (!s || this.busy) return Promise.resolve(false);
    this.busy = true;
    return new Promise((res) => {
      let done = false;
      let started = false;
      let viewed = false;
      const settle = () => {
        if (done) return;
        done = true;
        clearTimeout(notStarted);
        clearTimeout(cap);
        this.busy = false;
        this.setPaused('ad', false);
        // a reward only after adViewed
        res(type === 'reward' && viewed);
      };
      const notStarted = setTimeout(() => {
        if (!started) settle();
      }, AD_TIMEOUT_MS);
      const cap = setTimeout(settle, AD_MAX_MS);
      const opts: Y8ShowAdOptions = {
        type,
        name,
        beforeAd: () => {
          if (done) return;
          started = true;
          this.setPaused('ad', true);
        },
        afterAd: () => this.setPaused('ad', false),
        adBreakDone: () => settle(),
      };
      if (type === 'reward') {
        opts.beforeReward = (showAdFn) => {
          if (done) return;
          started = true;
          showAdFn();
        };
        opts.adViewed = () => {
          if (!done) viewed = true;
        };
        opts.adDismissed = () => {
          /* closed early: no reward */
        };
      }
      this.log.push(`${type}:${name}`);
      try {
        const r = s.showAd(opts);
        if (r && typeof (r as Promise<unknown>).then === 'function') (r as Promise<unknown>).catch(() => settle());
      } catch {
        settle();
      }
    });
  }

  /** `start` on the first Play click, `next` on the level-complete buttons; the SDK alone paces them */
  async showInterstitial(slot: AdSlot = 'next') {
    if (!this.y8Sdk || this.playing) return;
    if (slot === 'start') {
      if (this.startShown) return;
      this.startShown = true;
      await this.showAd('start', 'start-game');
    } else await this.showAd('next', 'next-level');
  }

  /** rewarded buttons are offered once the SDK is initialized (not with an ad blocker) */
  hasRewarded() {
    return this.y8Sdk !== null;
  }
  /** true only after adViewed */
  async showRewarded() {
    if (!this.y8Sdk) return false;
    return this.showAd('reward', 'coins');
  }

  locale() {
    return this.base.locale();
  }
  loadingStart() {}
  loadingDone() {}
  gameplayStart() {
    this.playing = true;
  }
  gameplayStop() {
    this.playing = false;
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

export function createY8Platform(base: Platform): Platform {
  return new Y8Platform(base);
}
