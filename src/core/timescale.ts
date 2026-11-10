/**
 * Global game speed. 1 in normal play; the preview-capture tool slows everything down
 * (3D scene, UI timers and, via DevTools, CSS animations) to record smooth video on slow machines.
 */
export const timeScale = { value: 1 };

export function later(fn: () => void, ms: number) {
  return setTimeout(fn, ms / timeScale.value);
}
