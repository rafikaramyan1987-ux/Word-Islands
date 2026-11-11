/**
 * GamePix build: boot progress. No imports, so main.ts can report progress before the game code is loaded
 * (other builds never call it).
 */
let progress = 0;

/** report boot progress to the Player (integer 0..100, only increasing) */
export function gpxLoading(p: number) {
  const v = Math.max(0, Math.min(100, Math.round(p)));
  if (v <= progress) return;
  progress = v;
  try {
    (window as { GamePix?: { lifecycle?: { loading?(p: number): void } } }).GamePix?.lifecycle?.loading?.(v);
  } catch {
    /* ignore */
  }
}
