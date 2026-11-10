export type PlatformId = 'web' | 'crazygames' | 'gd' | 'gamepix' | 'playgama';

/** Build-time platform layer. Every SDK call in the game goes through this interface. */
export interface Platform {
  id: PlatformId;
  /** Load/initialise the SDK. Must resolve quickly even if the SDK is unavailable. */
  init(): Promise<void>;
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
  /** Interstitial between levels; resolves when the game may continue. */
  showInterstitial(): Promise<void>;
  /** Key/value storage; defaults to localStorage. */
  storageGet(key: string): string | null;
  storageSet(key: string, value: string): void;
  storageRemove(key: string): void;
  /** Platform asks the game to mute/pause (e.g. during ads). */
  onPause(cb: (paused: boolean) => void): void;
}
