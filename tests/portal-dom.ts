/** a tiny fake browser (window + document as EventTargets) for the GameMonetize / Y8 adapter tests */
export interface FakeScript {
  id: string;
  src: string;
  async?: boolean;
  onload?: () => void;
  onerror?: () => void;
}

export function fakeDom() {
  const scripts: FakeScript[] = [];
  const win = new EventTarget() as EventTarget & Record<string, unknown>;
  const doc = new EventTarget() as EventTarget & Record<string, unknown>;
  doc.hidden = false;
  doc.getElementById = (id: string) => scripts.find((s) => s.id === id) ?? null;
  doc.getElementsByTagName = () => [];
  doc.createElement = () => ({ id: '', src: '' }) as FakeScript;
  doc.head = { appendChild: (s: FakeScript) => void scripts.push(s) };
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = win;
  g.document = doc;
  return {
    win,
    doc,
    scripts,
    setHidden(h: boolean) {
      doc.hidden = h;
      doc.dispatchEvent(new Event('visibilitychange'));
    },
    cleanup() {
      delete g.window;
      delete g.document;
    },
  };
}

export const memBase = () => {
  const store = new Map<string, string>();
  return {
    id: 'web' as const,
    init: async () => {},
    locale: () => 'de',
    loadingStart() {},
    loadingDone() {},
    gameplayStart() {},
    gameplayStop() {},
    hasRewarded: () => false,
    showRewarded: async () => false,
    showInterstitial: async () => {},
    storageGet: (k: string) => store.get(k) ?? null,
    storageSet: (k: string, v: string) => void store.set(k, v),
    storageRemove: (k: string) => void store.delete(k),
    onPause() {},
    store,
  };
};
