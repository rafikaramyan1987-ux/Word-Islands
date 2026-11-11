import { later } from '../core/timescale';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function iconSpan(svg: string, cls = 'ico'): HTMLElement {
  const s = el('span', cls, svg);
  return s;
}

export function toast(text: string, ms = 1900) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', 'toast');
  t.textContent = text;
  document.body.appendChild(t);
  t.style.animationDuration = `${ms}ms`;
  later(() => t.remove(), ms);
}

export const wait = (ms: number) => new Promise<void>((r) => later(r, ms));

/** Animate an element along a straight path with a little arc, resolves at the end. */
export function flyTo(node: HTMLElement, from: DOMRect, to: DOMRect, ms: number, delay = 0): Promise<void> {
  node.style.left = `${from.left}px`;
  node.style.top = `${from.top}px`;
  node.style.width = `${from.width}px`;
  node.style.height = `${from.height}px`;
  const dx = to.left - from.left, dy = to.top - from.top;
  const s = to.width / from.width;
  const anim = node.animate(
    [
      { transform: 'translate(0,0) scale(1)', offset: 0 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(${(1 + s) / 2 * 1.15}) rotate(8deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, offset: 1 },
    ],
    { duration: ms, delay, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'both' },
  );
  return anim.finished.then(() => undefined).catch(() => undefined);
}

export function sparkBurst(x: number, y: number, n = 10, color?: string) {
  for (let i = 0; i < n; i++) {
    const s = el('div', 'spark');
    s.style.left = `${x - 7}px`;
    s.style.top = `${y - 7}px`;
    if (color) s.style.background = `radial-gradient(circle, #fff 0 20%, ${color} 35%, transparent 70%)`;
    document.body.appendChild(s);
    const a = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 50;
    s.animate(
      [
        { transform: 'translate(0,0) scale(.4)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(${0.8 + Math.random()})`, opacity: 0 },
      ],
      { duration: 500 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.3,1)' },
    ).finished.then(() => s.remove(), () => s.remove());
  }
}
