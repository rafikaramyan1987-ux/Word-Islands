import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAMEPLAY_MESSAGES, PlaygamaPlatform, type BridgeSdk } from '../src/platform/playgama';
import { SAVE_KEY } from '../src/game/save';

/** a fake Playgama Bridge that records every sendMessage call and lets the test drive ad states */
function fakeBridge(stored: string | null = null) {
  const sent: string[] = [];
  const handlers: Record<string, (v: never) => void> = {};
  const sets: Array<[string, string]> = [];
  const b: BridgeSdk = {
    initialize: async () => {},
    EVENT_NAME: {
      INTERSTITIAL_STATE_CHANGED: 'interstitial_state_changed',
      REWARDED_STATE_CHANGED: 'rewarded_state_changed',
      AUDIO_STATE_CHANGED: 'audio_state_changed',
      PAUSE_STATE_CHANGED: 'pause_state_changed',
    },
    platform: {
      language: 'it',
      isAudioEnabled: true,
      sendMessage: (m) => (sent.push(m), Promise.resolve()),
      on: (e, fn) => void (handlers[e] = fn),
    },
    advertisement: {
      isInterstitialSupported: true,
      isRewardedSupported: true,
      showInterstitial: vi.fn(),
      showRewarded: vi.fn(),
      on: (e, fn) => void (handlers[e] = fn),
    },
    storage: {
      get: async (keys) => keys.map((k) => (k === SAVE_KEY ? stored : null)),
      set: async (k, v) => void sets.push([k, v]),
    },
  };
  const emit = (e: string, v: unknown) => handlers[e]?.(v as never);
  return { b, sent, sets, emit };
}

describe('Playgama Bridge platform', () => {
  let f: ReturnType<typeof fakeBridge>;
  let pg: PlaygamaPlatform;

  beforeEach(async () => {
    f = fakeBridge('{"saved":1}');
    pg = new PlaygamaPlatform(async () => f.b);
    await pg.init();
  });

  it('game_ready is the first message: gameplay messages sent earlier are held until it', () => {
    // main.ts starts the first level (a new player) before the loading screen is gone
    pg.gameplayStart();
    pg.achievement();
    expect(f.sent).toEqual([]);
    pg.loadingDone();
    pg.loadingDone();
    pg.levelCompleted();
    pg.gameplayStart();
    expect(f.sent[0]).toBe('game_ready');
    expect(f.sent).toEqual(['game_ready', 'level_started', 'player_got_achievement', 'level_completed', 'level_started']);
    const firstReady = f.sent.indexOf('game_ready');
    for (const m of GAMEPLAY_MESSAGES) {
      const i = f.sent.indexOf(m);
      if (i >= 0) expect(i, `${m} before game_ready`).toBeGreaterThan(firstReady);
    }
  });

  it('reads the language and the save from Bridge, writes the save to Bridge Storage', () => {
    expect(pg.locale()).toBe('it');
    expect(pg.storageGet(SAVE_KEY)).toBe('{"saved":1}');
    pg.storageSet(SAVE_KEY, '{"saved":2}');
    expect(f.sets).toEqual([[SAVE_KEY, '{"saved":2}']]);
  });

  it('asks Bridge for an interstitial at every break, with no throttle of its own, never during a level', async () => {
    pg.loadingDone();
    for (let k = 0; k < 3; k++) {
      pg.gameplayStart();
      await pg.showInterstitial(); // during a level: refused
      pg.levelCompleted();
      const p = pg.showInterstitial();
      f.emit('interstitial_state_changed', 'opened');
      f.emit('interstitial_state_changed', 'closed');
      await p;
    }
    expect(f.b.advertisement.showInterstitial).toHaveBeenCalledTimes(3);
  });

  it('pays a rewarded ad only on the rewarded state before closed', async () => {
    let p = pg.showRewarded();
    f.emit('rewarded_state_changed', 'opened');
    f.emit('rewarded_state_changed', 'closed');
    expect(await p).toBe(false);
    p = pg.showRewarded();
    f.emit('rewarded_state_changed', 'opened');
    f.emit('rewarded_state_changed', 'rewarded');
    f.emit('rewarded_state_changed', 'closed');
    expect(await p).toBe(true);
  });

  it('pauses on Bridge pause and mutes on Bridge audio state (idempotent)', () => {
    const pauses: boolean[] = [];
    const mutes: boolean[] = [];
    pg.onPause((p) => pauses.push(p));
    pg.onMute((m) => mutes.push(m));
    f.emit('pause_state_changed', true);
    f.emit('pause_state_changed', true);
    f.emit('pause_state_changed', false);
    f.emit('audio_state_changed', false);
    f.emit('audio_state_changed', false);
    f.emit('audio_state_changed', true);
    expect(pauses).toEqual([true, false]);
    expect(mutes).toEqual([true, false]);
  });

  it('without Bridge (initialize failed) the game plays on with nothing sent', async () => {
    const p = new PlaygamaPlatform(async () => null);
    await p.init();
    p.gameplayStart();
    p.loadingDone();
    expect(p.hasRewarded()).toBe(false);
    expect(await p.showRewarded()).toBe(false);
  });
});

describe('Playgama config', () => {
  it('playgama-bridge-config.json keeps Playgama defaults (no interstitial delay or other settings)', () => {
    const cfg = JSON.parse(readFileSync('tools/playgama/playgama-bridge-config.json', 'utf8'));
    expect(cfg).toEqual({});
  });
});
