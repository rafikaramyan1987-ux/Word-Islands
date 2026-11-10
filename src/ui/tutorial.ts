import { ICONS } from './icons';
import { el } from './dom';
import type { Wheel } from './wheel';

/** In-game tutorial: an animated hand drags across the letters of the first word. */
export class Tutorial {
  private hand: HTMLDivElement;
  private text: HTMLDivElement;
  private anim: Animation | null = null;
  private active = true;

  constructor(private host: HTMLElement, private wheel: Wheel, private indices: number[], line: string, skipLabel: string, private onSkip: () => void) {
    this.hand = el('div', 'tut-hand', ICONS.hand);
    this.text = el('div', 'tut-text');
    const s = el('span');
    s.textContent = line;
    const b = el('button');
    b.textContent = skipLabel;
    b.addEventListener('click', () => this.onSkip());
    this.text.append(s, b);
    document.body.appendChild(this.hand);
    host.appendChild(this.text);
    this.relayout();
  }

  setLine(line: string, showSkip: boolean) {
    (this.text.querySelector('span') as HTMLElement).textContent = line;
    (this.text.querySelector('button') as HTMLElement).style.display = showSkip ? '' : 'none';
  }

  hideHand() {
    this.anim?.cancel();
    this.hand.remove();
    this.active = false;
  }

  relayout() {
    const wr = this.wheel.root.getBoundingClientRect();
    const hr = this.host.getBoundingClientRect();
    this.text.style.top = `${Math.max(4, wr.top - hr.top - 104)}px`;
    if (!this.active) return;
    this.anim?.cancel();
    const pts = this.indices.map((i) => {
      const r = this.wheel.letterRect(i);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!pts.length) return;
    const frames: Keyframe[] = [];
    const n = pts.length;
    frames.push({ left: `${pts[0].x}px`, top: `${pts[0].y}px`, opacity: 0, offset: 0 });
    frames.push({ left: `${pts[0].x}px`, top: `${pts[0].y}px`, opacity: 1, offset: 0.1 });
    pts.forEach((p, k) => frames.push({ left: `${p.x}px`, top: `${p.y}px`, opacity: 1, offset: 0.15 + (0.6 * k) / Math.max(1, n - 1) }));
    frames.push({ left: `${pts[n - 1].x}px`, top: `${pts[n - 1].y}px`, opacity: 0, offset: 0.95 });
    frames.push({ left: `${pts[n - 1].x}px`, top: `${pts[n - 1].y}px`, opacity: 0, offset: 1 });
    this.anim = this.hand.animate(frames, { duration: 2400, iterations: Infinity, easing: 'ease-in-out' });
  }

  destroy() {
    this.anim?.cancel();
    this.hand.remove();
    this.text.remove();
  }
}
