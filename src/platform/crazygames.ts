/**
 * CrazyGames SDK v3 (https://docs.crazygames.com/sdk/html5-v3/), ported from the integrations used in Cookie Heist
 * and Mahjong Jade Garden.
 * - the SDK script is loaded once at start; `SDK.init()` is awaited (with a timeout) before the save is read, so saves
 *   go to the Data Module (localStorage fallback when the SDK is missing or disabled)
 * - loadingStart / loadingStop while the game boots; gameplayStart / gameplayStop only around real play (de-duplicated)
 * - happytime when a level is solved
 * - midgame ads only between levels (the game applies "at most one per 2 minutes"); no pre-roll
 * - rewarded ads only from the "Watch an ad" button; the reward is granted only on adFinished
 * - every ad request settles exactly once: adFinished, adError, a throwing requestAd, a second concurrent request, or
 *   nothing started within 8 s; the game then shows "No ad available right now, try later" for 2.5 s
 * - the platform mute setting (`game.settings.muteAudio`) is respected and followed live
 * - locale from `user.systemInfo.locale`
 */
import type { Platform } from './types';
import { AD_TIMEOUT_MS, loadScript } from './util';

export const CG_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
export const CG_SCRIPT_ID = 'crazygames-sdk';

type AdCallbacks = { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void };

export interface CGSdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener?(cb: (s: { muteAudio?: boolean }) => void): void;
  };
  ad: { requestAd(type: 'midgame' | 'rewarded', cb: AdCallbacks): void };
  data?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void };
  user?: { systemInfo?: { locale?: string } };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CGSdk };
  }
}

export class CrazyGamesPlatform implements Platform {
  readonly id = 'crazygames' as const;
  private s: CGSdk | null = null;
  private playing = false;
  private loading = false;
  private busy = false;
  muted = false;
  private muteCb: (m: boolean) => void = () => {};
  private pauseCb: (p: boolean) => void = () => {};

  constructor(private readonly base: Platform, private readonly get: () => CGSdk | undefined = () => window.CrazyGames?.SDK) {}

  async init(timeoutMs = 3000) {
    try {
      if (!window.CrazyGames && !document.getElementById(CG_SCRIPT_ID)) await loadScript(CG_SDK_URL, timeoutMs, CG_SCRIPT_ID);
      const s = this.get();
      if (!s) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([s.init(), new Promise((_, rej) => (timer = setTimeout(() => rej(new Error('sdk timeout')), timeoutMs)))]).finally(() => clearTimeout(timer));
      if (s.environment === 'disabled') return;
      this.s = s;
      this.muted = !!s.game.settings?.muteAudio;
      s.game.addSettingsChangeListener?.((st) => {
        if (st.muteAudio === undefined) return;
        this.muted = !!st.muteAudio;
        this.muteCb(this.muted);
      });
    } catch {
      this.s = null; // blocked / offline / not on CrazyGames: play on without the SDK
    }
  }

  locale() {
    return this.s?.user?.systemInfo?.locale ?? this.base.locale();
  }
  loadingStart() {
    if (this.loading) return;
    this.loading = true;
    this.call(() => this.s?.game.loadingStart());
  }
  loadingDone() {
    if (!this.loading) return;
    this.loading = false;
    this.call(() => this.s?.game.loadingStop());
  }
  gameplayStart() {
    if (this.playing) return;
    this.playing = true;
    this.call(() => this.s?.game.gameplayStart());
  }
  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    this.call(() => this.s?.game.gameplayStop());
  }
  levelCompleted() {
    this.call(() => this.s?.game.happytime());
  }
  private call(f: () => void) {
    try {
      f();
    } catch {
      /* an SDK hiccup must never break the game */
    }
  }

  hasRewarded() {
    return !!this.s;
  }

  /**
   * Request an ad and settle exactly once: true on adFinished, false on adError, a throwing requestAd, a second
   * concurrent request, or when the ad has not started within AD_TIMEOUT_MS. Settling always resumes the game.
   */
  requestAd(type: 'midgame' | 'rewarded'): Promise<boolean> {
    const s = this.s;
    if (!s || this.busy) return Promise.resolve(false);
    this.busy = true;
    return new Promise((res) => {
      let done = false;
      let started = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        this.busy = false;
        clearTimeout(timer);
        if (started) this.pauseCb(false);
        res(ok);
      };
      const timer = setTimeout(() => finish(false), AD_TIMEOUT_MS);
      try {
        s.ad.requestAd(type, {
          adStarted: () => {
            if (done || started) return;
            started = true;
            clearTimeout(timer); // the ad is playing: wait for it to finish
            this.pauseCb(true);
          },
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch {
        finish(false);
      }
    });
  }

  showRewarded() {
    return this.requestAd('rewarded');
  }
  async showInterstitial() {
    await this.requestAd('midgame');
  }

  private dataStore() {
    return this.s?.data ?? null;
  }
  storageGet(k: string) {
    const d = this.dataStore();
    try {
      return d ? d.getItem(k) : this.base.storageGet(k);
    } catch {
      return this.base.storageGet(k);
    }
  }
  storageSet(k: string, v: string) {
    const d = this.dataStore();
    try {
      if (d) d.setItem(k, v);
      else this.base.storageSet(k, v);
    } catch {
      this.base.storageSet(k, v);
    }
  }
  storageRemove(k: string) {
    const d = this.dataStore();
    try {
      if (d?.removeItem) d.removeItem(k);
      else this.base.storageRemove(k);
    } catch {
      this.base.storageRemove(k);
    }
  }
  onPause(cb: (p: boolean) => void) {
    this.pauseCb = cb;
  }
  onMute(cb: (m: boolean) => void) {
    this.muteCb = cb;
    if (this.muted) cb(true);
  }
}

export function createCrazyGamesPlatform(base: Platform): Platform {
  return new CrazyGamesPlatform(base);
}
