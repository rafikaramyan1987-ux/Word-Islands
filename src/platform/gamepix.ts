import type { Platform } from './types';
import { AD_TIMEOUT_MS, loadScript, withTimeout } from './util';

/* eslint-disable @typescript-eslint/no-explicit-any */
const SDK_URL = 'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js';

/**
 * GamePix SDK v3 with a manual lifecycle: GamePix.loading(%) during boot, GamePix.loaded() when the
 * game is ready, interstitialAd()/rewardAd() between levels, GamePix.lang(), GamePix.localStorage,
 * happyMoment()/updateLevel() on level complete, and the legacy pause/resume/soundOn/soundOff hooks.
 */
export function createGamePixPlatform(base: Platform): Platform {
  let pauseCb: (p: boolean) => void = () => {};
  let muteCb: (m: boolean) => void = () => {};
  const gp = () => (window as any).GamePix;
  const safe = <T>(fn: () => T, fallback: T): T => { try { return gp() ? fn() : fallback; } catch { return fallback; } };
  const store = () => safe(() => gp().localStorage ?? null, null);

  return {
    ...base,
    id: 'gamepix',
    async init() {
      try {
        await loadScript(SDK_URL, AD_TIMEOUT_MS, 'gamepix-sdk');
      } catch (e) {
        console.warn('GamePix SDK unavailable', e);
        return;
      }
      const sdk = gp();
      if (!sdk) return;
      // legacy assignment-style callbacks
      sdk.pause = () => pauseCb(true);
      sdk.resume = () => pauseCb(false);
      sdk.soundOff = () => muteCb(true);
      sdk.soundOn = () => muteCb(false);
      safe(() => sdk.on?.('pause', () => pauseCb(true)), undefined);
      safe(() => sdk.on?.('resume', () => pauseCb(false)), undefined);
    },
    locale: () => safe(() => gp().lang(), null) ?? base.locale(),
    loadingStart: () => safe(() => gp().loading(10), undefined),
    loadingDone: () => {
      safe(() => gp().loading(100), undefined);
      safe(() => gp().loaded(), undefined);
    },
    levelCompleted: (level) => {
      safe(() => gp().updateLevel?.(level), undefined);
      safe(() => gp().happyMoment?.(), undefined);
    },
    hasRewarded: () => !!gp(),
    async showRewarded() {
      if (!gp()) return false;
      pauseCb(true);
      const res = await withTimeout<any>(Promise.resolve(gp().rewardAd()), AD_TIMEOUT_MS * 8, false);
      pauseCb(false);
      return res === true || res?.success === true;
    },
    async showInterstitial() {
      if (!gp()) return;
      pauseCb(true);
      await withTimeout(Promise.resolve(gp().interstitialAd()), AD_TIMEOUT_MS * 8, undefined);
      pauseCb(false);
    },
    storageGet: (k) => { const s = store(); return s ? s.getItem(k) : base.storageGet(k); },
    storageSet: (k, v) => { const s = store(); if (s) s.setItem(k, v); else base.storageSet(k, v); },
    storageRemove: (k) => { const s = store(); if (s) s.removeItem(k); else base.storageRemove(k); },
    onPause: (cb) => { pauseCb = cb; },
    onMute: (cb) => { muteCb = cb; },
  };
}
