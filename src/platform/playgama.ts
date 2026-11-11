/**
 * Playgama Bridge (https://github.com/Playgama/bridge), set up as in Mahjong Jade Garden / Fix It Garage:
 * - index.html of the Playgama build loads the official Bridge from Playgama's CDN
 *   (https://bridge.playgama.com/v2/stable/playgama-bridge.js) as its first script, then an inline boot script calls
 *   `bridge.initialize()`; the game bundle starts only once that has settled (vite.config.ts, tools/playgama/boot.js).
 *   With every platform adapter in that build, Playgama's checker (?platform_id=qa_tool) gets its initialize handshake.
 * - init: the outcome of that initialize() (no timeout of the game's own), `platform.language`, the save through Bridge
 *   Storage (one `storage.get([...])` of every key, kept in memory), `platform.isAudioEnabled`, and the
 *   AUDIO_STATE_CHANGED / PAUSE_STATE_CHANGED events
 * - `game_ready` once the loading screen is gone; every gameplay message (level_started, level_completed,
 *   player_got_achievement) sent before it is held and sent right after it, so game_ready is always first
 * - interstitials (`advertisement.showInterstitial()`) at every natural break between levels; Bridge alone decides
 *   whether one is shown (Playgama's own defaults, no settings in playgama-bridge-config.json, no timer in the game)
 * - rewarded (`advertisement.showRewarded()`) only from the labelled "Watch an ad" button; the reward only when Bridge
 *   reports the `rewarded` state before `closed`
 * - every ad request settles exactly once (closed / failed, or not opened within AD_TIMEOUT_MS)
 * - an ad, Bridge's pause state or a hidden page pause the game and mute it; Bridge's audio state mutes without pausing
 * - no localStorage anywhere in this build: the save lives in Bridge Storage
 */
import { SAVE_KEY } from '../game/save';
import type { Platform } from './types';
import { AD_TIMEOUT_MS } from './util';

/** every storage key the game uses, read in one `storage.get([...])` at startup */
export const PLAYGAMA_STORAGE_KEYS = [SAVE_KEY];
/** Bridge lifecycle messages that must come after game_ready */
export const GAMEPLAY_MESSAGES = ['level_started', 'level_completed', 'level_failed', 'player_got_achievement'];

type Listener = (v: never) => void;
export interface BridgeSdk {
  initialize(): Promise<unknown>;
  EVENT_NAME: Record<'INTERSTITIAL_STATE_CHANGED' | 'REWARDED_STATE_CHANGED' | 'AUDIO_STATE_CHANGED' | 'PAUSE_STATE_CHANGED', string>;
  platform: {
    id?: string;
    language: string;
    isAudioEnabled: boolean;
    sendMessage(message: string, options?: Record<string, unknown>): unknown;
    on(event: string, fn: Listener): void;
  };
  advertisement: {
    isInterstitialSupported: boolean;
    isRewardedSupported: boolean;
    showInterstitial(placement?: string): void;
    showRewarded(placement?: string): void;
    on(event: string, fn: Listener): void;
  };
  storage: {
    get(keys: string[]): Promise<unknown[]>;
    set(key: string, value: string): Promise<unknown>;
  };
}

declare global {
  interface Window {
    bridge?: BridgeSdk;
    /** set by the boot script: bridge.initialize()'s outcome (null = initialized, else the error) */
    __playgamaBridgeInit?: Promise<unknown>;
  }
}

/** Bridge after the boot script's `bridge.initialize()`, or null when it failed (already logged with console.error). */
export async function initBridge(win: Window | undefined = typeof window === 'undefined' ? undefined : window): Promise<BridgeSdk | null> {
  const b = win?.bridge;
  if (!win || !b?.initialize) {
    console.error('[Playgama Bridge] window.bridge is missing: the game runs WITHOUT Playgama Bridge (no ads, no Bridge storage, no game_ready)');
    return null;
  }
  const booted = win.__playgamaBridgeInit;
  const err = booted
    ? await booted
    : await b.initialize().then(
        () => null,
        (e: unknown) => e ?? new Error('bridge.initialize() rejected'),
      );
  if (err) {
    if (!booted) console.error('[Playgama Bridge] bridge.initialize() failed; the game runs WITHOUT Playgama Bridge:', err);
    return null;
  }
  return b;
}

type PauseReason = 'sdk' | 'hidden' | 'ad';
type AdType = 'interstitial' | 'rewarded';
interface Pending {
  type: AdType;
  opened: boolean;
  earned: boolean;
  finish: (ok: boolean) => void;
}

export class PlaygamaPlatform implements Platform {
  readonly id = 'playgama' as const;
  private b: BridgeSdk | null = null;
  private levelOn = false;
  private readySent = false;
  /** gameplay messages waiting for game_ready */
  private held: string[] = [];
  private pausedBy = new Set<PauseReason>();
  private paused = false;
  private soundOff = false;
  private muted = false;
  private lang: string | null = null;
  private mem = new Map<string, string>();
  private pending: Pending | null = null;
  private pauseCb: (p: boolean) => void = () => {};
  private muteCb: (m: boolean) => void = () => {};
  /** what was sent to Bridge, for tests */
  readonly log: string[] = [];

  constructor(private readonly getBridge: () => Promise<BridgeSdk | null> = () => initBridge()) {}

  async init() {
    this.b = await this.getBridge();
    const s = this.b;
    if (s) {
      try {
        this.lang = s.platform.language || null;
      } catch {
        this.lang = null;
      }
      try {
        const vals = await s.storage.get(PLAYGAMA_STORAGE_KEYS);
        PLAYGAMA_STORAGE_KEYS.forEach((k, i) => {
          const v = Array.isArray(vals) ? vals[i] : null;
          if (v !== null && v !== undefined) this.mem.set(k, typeof v === 'string' ? v : JSON.stringify(v));
        });
      } catch {
        /* nothing saved yet / storage unavailable */
      }
      const E = s.EVENT_NAME;
      try {
        this.soundOff = s.platform.isAudioEnabled === false;
        s.platform.on(E.AUDIO_STATE_CHANGED, ((on: boolean) => this.setSound(on !== false)) as Listener);
        s.platform.on(E.PAUSE_STATE_CHANGED, ((p: boolean) => this.setPaused('sdk', !!p)) as Listener);
        s.advertisement.on(E.INTERSTITIAL_STATE_CHANGED, ((st: string) => this.onAdState('interstitial', st)) as Listener);
        s.advertisement.on(E.REWARDED_STATE_CHANGED, ((st: string) => this.onAdState('rewarded', st)) as Listener);
      } catch {
        /* no events: play on */
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.setPaused('hidden', document.hidden));
      document.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  setPaused(reason: PauseReason, on: boolean) {
    if (on === this.pausedBy.has(reason)) return;
    if (on) this.pausedBy.add(reason);
    else this.pausedBy.delete(reason);
    const p = this.pausedBy.size > 0;
    if (p !== this.paused) {
      this.paused = p;
      this.pauseCb(p);
    }
    this.updateMute();
  }

  setSound(on: boolean) {
    if (this.soundOff === !on) return;
    this.soundOff = !on;
    this.updateMute();
  }

  private updateMute() {
    const m = this.soundOff;
    if (m === this.muted) return;
    this.muted = m;
    this.muteCb(m);
  }

  private onAdState(type: AdType, state: string) {
    this.log.push(`${type}:${state}`);
    const p = this.pending;
    if (!p || p.type !== type) return;
    if (state === 'opened') {
      p.opened = true;
      this.setPaused('ad', true);
    } else if (state === 'rewarded') p.earned = true;
    else if (state === 'closed') p.finish(type === 'rewarded' ? p.earned : true);
    else if (state === 'failed') p.finish(false);
  }

  /** every Bridge message goes through here: gameplay messages before game_ready are held and sent right after it */
  private send(m: string) {
    if (!this.b) return;
    if (m !== 'game_ready' && !this.readySent) {
      this.held.push(m);
      return;
    }
    this.log.push(m);
    try {
      void Promise.resolve(this.b.platform.sendMessage(m)).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  locale() {
    return this.lang;
  }
  loadingStart() {}
  /** the loading screen is gone and the player can play: `game_ready`, once, then any held gameplay messages */
  loadingDone() {
    if (this.readySent || !this.b) return;
    this.readySent = true;
    this.send('game_ready');
    for (const m of this.held.splice(0)) this.send(m);
  }
  /** a level starts: `level_started` once per level */
  gameplayStart() {
    if (this.levelOn) return;
    this.levelOn = true;
    this.send('level_started');
  }
  gameplayStop() {}
  levelCompleted() {
    if (!this.levelOn) return;
    this.levelOn = false;
    this.send('level_completed');
  }
  achievement() {
    this.send('player_got_achievement');
  }

  hasRewarded() {
    try {
      return !!this.b && this.b.advertisement.isRewardedSupported === true;
    } catch {
      return false;
    }
  }

  private requestAd(type: AdType): Promise<boolean> {
    const s = this.b;
    if (!s || this.pending) return Promise.resolve(false);
    return new Promise((res) => {
      let done = false;
      const pending: Pending = {
        type,
        opened: false,
        earned: false,
        finish: (ok) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (this.pending === pending) this.pending = null;
          this.setPaused('ad', false);
          res(ok);
        },
      };
      this.pending = pending;
      const timer = setTimeout(() => {
        if (!pending.opened) pending.finish(false);
      }, AD_TIMEOUT_MS);
      try {
        if (type === 'rewarded') s.advertisement.showRewarded();
        else s.advertisement.showInterstitial();
      } catch {
        pending.finish(false);
      }
    });
  }

  /** a natural break between levels: ask Bridge, which alone decides whether an interstitial is shown */
  async showInterstitial() {
    if (!this.b || this.pending || this.levelOn) return;
    try {
      if (!this.b.advertisement.isInterstitialSupported) return;
    } catch {
      return;
    }
    await this.requestAd('interstitial');
  }

  async showRewarded() {
    if (!this.hasRewarded()) return false;
    return this.requestAd('rewarded');
  }

  /** Bridge Storage, kept in memory (read once at start) */
  storageGet(k: string) {
    return this.mem.get(k) ?? null;
  }
  storageSet(k: string, v: string) {
    if (this.mem.get(k) === v) return;
    this.mem.set(k, v);
    try {
      if (this.b) void Promise.resolve(this.b.storage.set(k, v)).catch(() => {});
    } catch {
      /* the in-memory copy stays */
    }
  }
  storageRemove(k: string) {
    this.mem.delete(k);
  }
  onPause(cb: (p: boolean) => void) {
    this.pauseCb = cb;
  }
  onMute(cb: (m: boolean) => void) {
    this.muteCb = cb;
    if (this.muted) cb(true);
  }
}

export function createPlaygamaPlatform(): Platform {
  return new PlaygamaPlatform();
}
