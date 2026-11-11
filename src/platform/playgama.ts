import { SAVE_KEY } from '../game/save';
import type { Platform } from './types';
import { AD_TIMEOUT_MS, loadScript, withTimeout } from './util';

/* eslint-disable @typescript-eslint/no-explicit-any */
const SDK_URL = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';

/**
 * Playgama Bridge v2: initialize(), platform.language, sendMessage('game_ready' | 'gameplay_started' |
 * 'gameplay_stopped' | 'level_completed' | 'player_got_achievement'), advertisement state events,
 * async storage (cached in memory so the game's save stays synchronous), pause/audio state events.
 * The interstitial delay comes from playgama-bridge-config.json (emitted by the playgama build).
 */
export function createPlaygamaPlatform(base: Platform): Platform {
  let bridge: any = null;
  let pauseCb: (p: boolean) => void = () => {};
  let muteCb: (m: boolean) => void = () => {};
  const cache = new Map<string, string>();
  const send = (msg: string, opts?: unknown) => { try { void bridge?.platform.sendMessage(msg, opts)?.catch?.(() => {}); } catch { /* ignore */ } };

  /** Show an ad and resolve with whether it reached `success` state ('rewarded' or 'closed'). */
  const showAd = (kind: 'interstitial' | 'rewarded') =>
    new Promise<boolean>((resolve) => {
      if (!bridge) return resolve(false);
      const ev = kind === 'rewarded' ? bridge.EVENT_NAME.REWARDED_STATE_CHANGED : bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED;
      let rewarded = false;
      let opened = false;
      const done = (ok: boolean) => {
        clearTimeout(timer);
        try { bridge.advertisement.off(ev, handler); } catch { /* ignore */ }
        pauseCb(false);
        resolve(ok);
      };
      const handler = (state: string) => {
        if (state === 'opened') { opened = true; clearTimeout(timer); pauseCb(true); }
        if (state === 'rewarded') rewarded = true;
        if (state === 'closed') done(kind === 'rewarded' ? rewarded : true);
        if (state === 'failed') done(false);
      };
      const timer = setTimeout(() => { if (!opened) done(false); }, AD_TIMEOUT_MS);
      bridge.advertisement.on(ev, handler);
      try {
        if (kind === 'rewarded') bridge.advertisement.showRewarded();
        else bridge.advertisement.showInterstitial();
      } catch {
        done(false);
      }
    });

  return {
    ...base,
    id: 'playgama',
    async init() {
      try {
        await loadScript(SDK_URL, AD_TIMEOUT_MS, 'playgama-bridge');
        bridge = (window as any).bridge ?? null;
        if (!bridge) return;
        await withTimeout(bridge.initialize().then(() => true), AD_TIMEOUT_MS, false);
        const saved = await withTimeout<any>(bridge.storage.get(SAVE_KEY, false), 3000, null);
        if (typeof saved === 'string' && saved) cache.set(SAVE_KEY, saved);
        bridge.platform.on?.(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (p: boolean) => pauseCb(p));
        bridge.platform.on?.(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (on: boolean) => muteCb(!on));
      } catch (e) {
        console.warn('Playgama Bridge unavailable', e);
        bridge = null;
      }
    },
    locale: () => bridge?.platform?.language ?? base.locale(),
    loadingDone: () => send('game_ready'),
    gameplayStart: () => send('gameplay_started'),
    gameplayStop: () => send('gameplay_stopped'),
    levelCompleted: () => send('level_completed'),
    achievement: () => send('player_got_achievement'),
    hasRewarded: () => !!bridge?.advertisement?.isRewardedSupported,
    showRewarded: () => showAd('rewarded'),
    showInterstitial: async () => { await showAd('interstitial'); },
    storageGet: (k) => (bridge ? (cache.get(k) ?? base.storageGet(k)) : base.storageGet(k)),
    storageSet: (k, v) => {
      base.storageSet(k, v);
      if (!bridge) return;
      cache.set(k, v);
      try { void bridge.storage.set(k, v)?.catch?.(() => {}); } catch { /* ignore */ }
    },
    storageRemove: (k) => {
      base.storageRemove(k);
      cache.delete(k);
      try { void bridge?.storage.delete(k)?.catch?.(() => {}); } catch { /* ignore */ }
    },
    onPause: (cb) => { pauseCb = cb; },
    onMute: (cb) => { muteCb = cb; },
  };
}
