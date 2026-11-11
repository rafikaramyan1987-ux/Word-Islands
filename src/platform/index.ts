import type { Platform } from './types';
import { createWebPlatform } from './web';

/**
 * Platform selected at build time with VITE_PLATFORM (web | crazygames | gd | gamepix | playgama).
 * `__PLATFORM__` is a compile-time constant, so each build only contains its own SDK layer.
 */
export async function createPlatform(): Promise<Platform> {
  const base = createWebPlatform();
  if (__PLATFORM__ === 'crazygames') return (await import('./crazygames')).createCrazyGamesPlatform(base);
  if (__PLATFORM__ === 'gd') return (await import('./gd')).createGdPlatform(base);
  if (__PLATFORM__ === 'gamepix') return (await import('./gamepix')).createGamePixPlatform(base);
  if (__PLATFORM__ === 'playgama') return (await import('./playgama')).createPlaygamaPlatform(base);
  return base;
}

export type { Platform };
