import type { Platform } from './types';

function safeLocalStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const k = '__wi_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

/** Plain web build: no SDK, no ads, localStorage saves. Other platforms extend it. */
export function createWebPlatform(): Platform {
  const ls = safeLocalStorage();
  const mem = new Map<string, string>();
  return {
    id: 'web',
    async init() {},
    locale() {
      return navigator.language?.slice(0, 2).toLowerCase() ?? null;
    },
    loadingStart() {},
    loadingDone() {},
    gameplayStart() {},
    gameplayStop() {},
    hasRewarded: () => false,
    showRewarded: async () => false,
    showInterstitial: async () => {},
    storageGet: (k) => (ls ? ls.getItem(k) : (mem.get(k) ?? null)),
    storageSet: (k, v) => {
      if (ls) {
        try { ls.setItem(k, v); } catch { mem.set(k, v); }
      } else mem.set(k, v);
    },
    storageRemove: (k) => {
      ls?.removeItem(k);
      mem.delete(k);
    },
    onPause() {},
  };
}
