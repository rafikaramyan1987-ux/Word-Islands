import type { Platform } from './types';
import { AD_TIMEOUT_MS, loadScript, withTimeout } from './util';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Word Islands' GameDistribution game ID (checked in CI by tools/check-gd.mjs) */
export const GD_GAME_ID = '53ecfdcc22b1483c86e809d8c324febe';
const SDK_URL = 'https://html5.api.gamedistribution.com/main.min.js';

/** GameDistribution HTML5 SDK: GD_OPTIONS + onEvent, gdsdk.showAd() interstitials and rewarded ads. */
export function createGdPlatform(base: Platform): Platform {
  let pauseCb: (p: boolean) => void = () => {};
  let rewardedWatched = false;
  let ready = false;
  const gdsdk = () => (window as any).gdsdk;

  return {
    ...base,
    id: 'gd',
    async init() {
      (window as any).GD_OPTIONS = {
        gameId: GD_GAME_ID,
        onEvent: (event: { name: string }) => {
          switch (event.name) {
            case 'SDK_READY': ready = true; break;
            case 'SDK_GAME_START': pauseCb(false); break;
            case 'SDK_GAME_PAUSE': pauseCb(true); break;
            case 'SDK_REWARDED_WATCH_COMPLETE': rewardedWatched = true; break;
          }
        },
      };
      try {
        await loadScript(SDK_URL, AD_TIMEOUT_MS, 'gamedistribution-jssdk');
      } catch (e) {
        console.warn('GameDistribution SDK unavailable', e);
      }
    },
    hasRewarded: () => ready && !!gdsdk(),
    async showRewarded() {
      const sdk = gdsdk();
      if (!sdk) return false;
      rewardedWatched = false;
      const ok = await withTimeout<boolean>(
        sdk.preloadAd('rewarded').then(() => sdk.showAd('rewarded')).then(() => true),
        AD_TIMEOUT_MS * 8,
        false,
      );
      pauseCb(false);
      return ok && rewardedWatched; // reward only on SDK_REWARDED_WATCH_COMPLETE
    },
    async showInterstitial() {
      const sdk = gdsdk();
      if (!sdk) return;
      await withTimeout(Promise.resolve(sdk.showAd()).then(() => undefined), AD_TIMEOUT_MS * 8, undefined);
      pauseCb(false);
    },
    onPause: (cb) => { pauseCb = cb; },
  };
}
