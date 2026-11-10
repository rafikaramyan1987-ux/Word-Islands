import { describe, expect, it } from 'vitest';
import { SaveStore, SAVE_KEY } from '../src/game/save';
import type { Platform } from '../src/platform/types';

function memPlatform(): Platform & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
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
}

describe('SaveStore', () => {
  it('starts with defaults and persists changes', () => {
    const p = memPlatform();
    const s = new SaveStore(p);
    expect(s.data.coins).toBe(50);
    s.progress('fr').level = 2;
    s.data.coins = 7;
    s.save();
    const s2 = new SaveStore(p);
    expect(s2.data.coins).toBe(7);
    expect(s2.progress('fr').level).toBe(2);
  });
  it('survives corrupt data', () => {
    const p = memPlatform();
    p.store.set(SAVE_KEY, '{not json');
    expect(new SaveStore(p).data.coins).toBe(50);
  });
  it('reset keeps language and audio settings', () => {
    const p = memPlatform();
    const s = new SaveStore(p);
    s.data.lang = 'ru';
    s.data.music = false;
    s.data.coins = 999;
    s.reset();
    expect(s.data.lang).toBe('ru');
    expect(s.data.music).toBe(false);
    expect(s.data.coins).toBe(50);
  });
});
