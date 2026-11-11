/** Inject an SDK <script>; rejects on error or after `timeout` ms. */
export function loadScript(src: string, timeout = 8000, id?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (id) s.id = id;
    const timer = setTimeout(() => reject(new Error(`timeout loading ${src}`)), timeout);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); reject(new Error(`failed to load ${src}`)); };
    document.head.appendChild(s);
  });
}

/** Resolve with `fallback` if `p` takes longer than `ms` (ad calls must never block the game). */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, () => { clearTimeout(timer); resolve(fallback); });
  });
}

export const AD_TIMEOUT_MS = 8000;
