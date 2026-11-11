import type { Platform } from './types';
import { AD_TIMEOUT_MS, loadScript, withTimeout } from './util';

/* eslint-disable @typescript-eslint/no-explicit-any */
const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

/** CrazyGames HTML5 SDK v3: lifecycle events, midgame/rewarded ads, Data module saves, user locale. */
export function createCrazyGamesPlatform(base: Platform): Platform {
  let sdk: any = null;
  let pauseCb: (p: boolean) => void = () => {};
  const call = (fn: () => void) => { try { if (sdk) fn(); } catch (e) { console.warn('CrazyGames SDK', e); } };
  const data = () => (sdk && sdk.environment !== 'disabled' ? sdk.data : null);

  const requestAd = (type: 'midgame' | 'rewarded') =>
    withTimeout(
      new Promise<boolean>((resolve) => {
        if (!sdk) return resolve(false);
        let started = false;
        // 8 s to start; once an ad plays we wait for it to finish
        const startTimer = setTimeout(() => { if (!started) resolve(false); }, AD_TIMEOUT_MS);
        try {
          sdk.ad.requestAd(type, {
            adStarted: () => { started = true; clearTimeout(startTimer); pauseCb(true); },
            adFinished: () => { clearTimeout(startTimer); pauseCb(false); resolve(true); },
            adError: () => { clearTimeout(startTimer); pauseCb(false); resolve(false); },
          });
        } catch {
          clearTimeout(startTimer);
          resolve(false);
        }
      }),
      10 * 60_000,
      false,
    );

  return {
    ...base,
    id: 'crazygames',
    async init() {
      try {
        await loadScript(SDK_URL, AD_TIMEOUT_MS, 'crazygames-sdk');
        sdk = (window as any).CrazyGames?.SDK ?? null;
        if (sdk) await withTimeout(sdk.init().then(() => true), AD_TIMEOUT_MS, false);
      } catch (e) {
        console.warn('CrazyGames SDK unavailable', e);
        sdk = null;
      }
    },
    locale: () => sdk?.user?.systemInfo?.locale ?? base.locale(),
    loadingStart: () => call(() => sdk.game.loadingStart()),
    loadingDone: () => call(() => sdk.game.loadingStop()),
    gameplayStart: () => call(() => sdk.game.gameplayStart()),
    gameplayStop: () => call(() => sdk.game.gameplayStop()),
    levelCompleted: () => call(() => sdk.game.happytime()),
    hasRewarded: () => !!sdk,
    showRewarded: () => requestAd('rewarded'),
    showInterstitial: async () => { await requestAd('midgame'); },
    storageGet: (k) => { const d = data(); try { return d ? d.getItem(k) : base.storageGet(k); } catch { return base.storageGet(k); } },
    storageSet: (k, v) => { const d = data(); try { if (d) d.setItem(k, v); else base.storageSet(k, v); } catch { base.storageSet(k, v); } },
    storageRemove: (k) => { const d = data(); try { if (d) d.removeItem(k); else base.storageRemove(k); } catch { base.storageRemove(k); } },
    onPause: (cb) => { pauseCb = cb; },
  };
}
