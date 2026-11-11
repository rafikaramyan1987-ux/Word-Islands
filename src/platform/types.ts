export type PlatformId = 'web' | 'crazygames' | 'gd' | 'gamepix' | 'playgama' | 'gamemonetize' | 'y8';

/**
 * Which natural break an interstitial is for (Y8 `showAd` types; the other platforms ignore it):
 * - `start`: the player's first Play click on the menu
 * - `next`: Next / Menu on a level-complete screen
 */
export type AdSlot = 'start' | 'next';

/** Build-time platform layer. Every SDK call in the game goes through this interface. */
export interface Platform {
  id: PlatformId;
  /** Load/initialise the SDK. Must resolve quickly even if the SDK is unavailable. */
  init(): Promise<void>;
  /** Assets are loaded and the menu is about to show (GamePix: loading(100) + await loaded()). */
  ready?(): Promise<void>;
  /** A sad moment (GamePix sadMoment); only portals that track it implement this. */
  sadMoment?(name: string): void;
  /** Preferred language code from the platform (2 letters) or null. */
  locale(): string | null;
  loadingStart(): void;
  loadingDone(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** True when the platform can show rewarded ads (the web build never can). */
  hasRewarded(): boolean;
  /** Resolves true only when the rewarded ad really completed. */
  showRewarded(): Promise<boolean>;
  /** Interstitial at a natural break; resolves when the game may continue. */
  showInterstitial(slot?: AdSlot): Promise<void>;
  /** Key/value storage; defaults to localStorage. */
  storageGet(key: string): string | null;
  storageSet(key: string, value: string): void;
  storageRemove(key: string): void;
  /** Optional celebration hooks (CrazyGames happytime, GamePix happyMoment/updateLevel, Playgama messages). */
  levelCompleted?(level: number): void;
  achievement?(id: string): void;
  /** Platform asks the game to mute/pause (e.g. during ads). */
  onPause(cb: (paused: boolean) => void): void;
  /** Platform asks the game to mute/unmute audio. */
  onMute?(cb: (muted: boolean) => void): void;
}
