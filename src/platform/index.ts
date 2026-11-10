import type { Platform } from './types';
import { createWebPlatform } from './web';

/**
 * Platform selected at build time with VITE_PLATFORM (web | crazygames | gd | gamepix | playgama).
 * Phase A ships the web layer; the SDK integrations for the portals are added in Phase B and
 * plug in here behind the same interface, so `__PLATFORM__` dead-code-eliminates the others.
 */
export async function createPlatform(): Promise<Platform> {
  const base = createWebPlatform();
  if (__PLATFORM__ === 'web') return base;
  return { ...base, id: __PLATFORM__ };
}

export type { Platform };
