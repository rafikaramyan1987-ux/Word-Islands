/**
 * GameMonetize.com HTML5 SDK (https://github.com/GameMonetize/GameMonetize.com-SDK), as in Cookie Heist:
 * - `window.SDK_OPTIONS = { gameId, onEvent }`, then https://api.gamemonetize.com/sdk.js injected once while the game
 *   boots (never from a click), as the README's loader does it: a `<script id="gamemonetize-sdk">` inserted before the
 *   first script of the page, only if no element with that id exists yet
 * - SDK_GAME_PAUSE: pause the game and mute all audio; SDK_GAME_START: resume, and audio comes back through the
 *   player's own music / sound settings (only the platform mute is lifted); SDK_READY: interstitials can be shown
 * - interstitials (`sdk.showBanner()`) only at the same natural break as the GameDistribution build: the Next click on
 *   a level-complete screen, never during a level, never on a timer, at most one per ~2 minutes (the game's own gap in
 *   App.afterComplete, and again here)
 * - every ad request settles exactly once: SDK_GAME_START, a throwing showBanner(), or not started within AD_TIMEOUT_MS
 *   (and AD_MAX_MS in all, so the game can never stay paused)
 * - rewarded: the SDK documents no rewarded API and no completion event, so there is none: hasRewarded() is false and
 *   the game shows no "watch an ad" button in this build
 * - saves use localStorage (the web platform's storage); if the SDK fails to load the game plays on without ads
 */
import type { Platform } from './types';
import { AD_TIMEOUT_MS } from './util';

export const GM_GAME_ID = '0cqkyktpv3nnr3nokt7jhqbzryqmfh2h';
export const GM_SDK_URL = 'https://api.gamemonetize.com/sdk.js';
export const GM_SCRIPT_ID = 'gamemonetize-sdk';
/** at most one interstitial per ~2 minutes */
export const GM_AD_GAP_MS = 120_000;
/** a started ad that never sends SDK_GAME_START is given up after this long (ms) */
export const AD_MAX_MS = 120_000;

export interface GMEvent {
  name: string;
}
export interface GMSdk {
  showBanner(): unknown;
}

declare global {
  interface Window {
    SDK_OPTIONS?: { gameId: string; onEvent: (e: GMEvent) => void };
    sdk?: GMSdk;
  }
}

interface Pending {
  started: boolean;
  finish: () => void;
}

export class GameMonetizePlatform implements Platform {
  readonly id = 'gamemonetize' as const;
  private sdkReady = false;
  private playing = false;
  private adPaused = false;
  private lastAd: number | null = null;
  private pending: Pending | null = null;
  private pauseCb: (p: boolean) => void = () => {};
  private muteCb: (m: boolean) => void = () => {};
  /** showBanner() calls, for tests */
  requests = 0;

  constructor(
    private readonly base: Platform,
    private readonly gameId = GM_GAME_ID,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** README loader: SDK_OPTIONS first, then sdk.js once. Waits for the script at most `timeoutMs` (blocked: at once). */
  async init(timeoutMs = 3500) {
    window.SDK_OPTIONS = { gameId: this.gameId, onEvent: (e) => this.onEvent(e) };
    if (document.getElementById(GM_SCRIPT_ID)) return;
    await new Promise<void>((res) => {
      const done = () => {
        clearTimeout(to);
        res();
      };
      const to = setTimeout(done, timeoutMs);
      try {
        const first = document.getElementsByTagName('script')[0];
        const el = document.createElement('script');
        el.id = GM_SCRIPT_ID;
        el.src = GM_SDK_URL;
        el.onload = done;
        el.onerror = () => {
          console.warn('GameMonetize SDK unavailable: playing without ads');
          done();
        };
        if (first?.parentNode) first.parentNode.insertBefore(el, first);
        else document.head.appendChild(el);
      } catch {
        done();
      }
    });
  }

  /** SDK_READY seen and `sdk.showBanner` present */
  get adsReady() {
    return this.sdkReady && typeof window.sdk?.showBanner === 'function';
  }

  /** SDK events (also sent for ads the SDK shows by itself) */
  onEvent(e: GMEvent) {
    switch (e?.name) {
      case 'SDK_READY':
        this.sdkReady = true;
        break;
      case 'SDK_GAME_PAUSE':
        if (this.pending) this.pending.started = true;
        this.setAdPaused(true);
        break;
      case 'SDK_GAME_START':
        this.setAdPaused(false);
        this.pending?.finish();
        break;
    }
  }

  private setAdPaused(p: boolean) {
    if (this.adPaused === p) return;
    this.adPaused = p;
    this.muteCb(p);
    this.pauseCb(p);
  }

  /** showBanner(), settled exactly once: SDK_GAME_START, a throw, nothing started in AD_TIMEOUT_MS, or AD_MAX_MS */
  private requestAd(): Promise<void> {
    const s = window.sdk;
    if (!s || this.pending) return Promise.resolve();
    return new Promise((res) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(notStarted);
        clearTimeout(cap);
        if (this.pending === pending) this.pending = null;
        this.setAdPaused(false);
        res();
      };
      const pending: Pending = { started: false, finish };
      this.pending = pending;
      const notStarted = setTimeout(() => {
        if (!pending.started) finish();
      }, AD_TIMEOUT_MS);
      const cap = setTimeout(finish, AD_MAX_MS);
      this.requests++;
      try {
        s.showBanner();
      } catch {
        finish();
      }
    });
  }

  /** the Next click on a level-complete screen: an interstitial, at most one per ~2 minutes, never in a level */
  async showInterstitial() {
    if (!this.adsReady || this.playing || this.pending) return;
    const t = this.now();
    if (this.lastAd !== null && t - this.lastAd < GM_AD_GAP_MS) return;
    this.lastAd = t;
    await this.requestAd();
  }

  /** no rewarded API in the GameMonetize SDK */
  hasRewarded() {
    return false;
  }
  async showRewarded() {
    return false;
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

export function createGameMonetizePlatform(base: Platform): Platform {
  return new GameMonetizePlatform(base);
}
