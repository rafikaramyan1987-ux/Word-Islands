import { later } from '../core/timescale';
import { audio } from '../audio/audio';
import { el } from './dom';

export interface WheelCallbacks {
  onChange(word: string): void;
  onSubmit(word: string, indices: number[]): void;
}

/** Round letter wheel: drag across letters (mouse, touch or pen) or type them on the keyboard. */
export class Wheel {
  root: HTMLDivElement;
  preview: HTMLDivElement;
  private svg: SVGSVGElement;
  private line: SVGPolylineElement;
  private buttons: HTMLDivElement[] = [];
  private centers: Array<{ x: number; y: number }> = [];
  private path: number[] = [];
  private dragging = false;
  private pointer: { x: number; y: number } | null = null;
  private size = 200;
  private letterSize = 60;
  private order: number[];
  enabled = true;

  constructor(public letters: string[], private cb: WheelCallbacks) {
    this.order = letters.map((_, i) => i);
    this.root = el('div', 'wheel');
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('lines');
    this.line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    this.svg.appendChild(this.line);
    this.root.appendChild(this.svg);
    letters.forEach((ch, i) => {
      const b = el('div', 'letter');
      b.textContent = ch;
      b.dataset.i = String(i);
      this.root.appendChild(b);
      this.buttons.push(b);
    });
    this.preview = el('div', 'preview empty');
    this.root.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
  }

  destroy() {
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
  }

  layout(size: number) {
    this.size = size;
    this.root.style.width = this.root.style.height = `${size}px`;
    const n = this.letters.length;
    const R = size * (n <= 3 ? 0.27 : n <= 5 ? 0.31 : 0.33);
    this.letterSize = Math.min(size * (n <= 4 ? 0.3 : n <= 6 ? 0.26 : 0.23), 110);
    this.centers = [];
    this.order.forEach((li, slot) => {
      const a = -Math.PI / 2 + (slot / n) * Math.PI * 2;
      const x = size / 2 + Math.cos(a) * R;
      const y = size / 2 + Math.sin(a) * R;
      this.centers[li] = { x, y };
      const b = this.buttons[li];
      b.style.left = `${x}px`;
      b.style.top = `${y}px`;
      b.style.width = b.style.height = `${this.letterSize}px`;
      b.style.fontSize = `${this.letterSize * 0.6}px`;
    });
    this.svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    this.preview.style.fontSize = `${Math.max(22, Math.min(36, size * 0.12))}px`;
    this.draw();
  }

  shuffle() {
    const n = this.order.length;
    if (n < 2) return;
    const old = this.order.join();
    for (let k = 0; k < 10 && this.order.join() === old; k++) {
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
      }
    }
    this.layout(this.size);
  }

  /** Screen centre of a wheel letter (for the tutorial hand). */
  letterRect(i: number): DOMRect {
    return this.buttons[i].getBoundingClientRect();
  }

  previewRects(): DOMRect[] {
    return [...this.preview.querySelectorAll('span')].map((s) => s.getBoundingClientRect());
  }

  get word() {
    return this.path.map((i) => this.letters[i]).join('');
  }

  private local(e: PointerEvent) {
    const r = this.root.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * this.size, y: ((e.clientY - r.top) / r.height) * this.size };
  }

  private hit(p: { x: number; y: number }): number {
    let best = -1, bd = Infinity;
    this.centers.forEach((c, i) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = i; }
    });
    return bd < this.letterSize * 0.62 ? best : -1;
  }

  private down = (e: PointerEvent) => {
    if (!this.enabled) return;
    audio.unlock();
    e.preventDefault();
    this.root.setPointerCapture?.(e.pointerId);
    this.dragging = true;
    this.path = [];
    const p = this.local(e);
    this.pointer = p;
    const i = this.hit(p);
    if (i >= 0) this.add(i);
    this.draw();
  };

  private move = (e: PointerEvent) => {
    if (!this.dragging) return;
    e.preventDefault();
    const p = this.local(e);
    this.pointer = p;
    const i = this.hit(p);
    if (i >= 0) {
      if (this.path.length >= 2 && this.path[this.path.length - 2] === i) this.removeLast();
      else if (!this.path.includes(i)) this.add(i);
    }
    this.draw();
  };

  private up = () => {
    if (!this.dragging) return;
    this.dragging = false;
    this.pointer = null;
    this.submit();
  };

  private add(i: number) {
    this.path.push(i);
    this.buttons[i].classList.add('on');
    audio.play('letter', this.path.length - 1);
    this.changed();
  }

  private removeLast() {
    const i = this.path.pop();
    if (i !== undefined) this.buttons[i].classList.remove('on');
    this.changed();
  }

  private changed() {
    this.preview.innerHTML = this.path.map((i) => `<span>${this.letters[i]}</span>`).join('');
    this.preview.className = 'preview' + (this.path.length ? '' : ' empty');
    this.cb.onChange(this.word);
  }

  /** Keyboard input: a canonical letter. Returns false if the letter is not available. */
  typeLetter(ch: string): boolean {
    if (!this.enabled || this.dragging) return false;
    const i = this.letters.findIndex((l, k) => l === ch && !this.path.includes(k));
    if (i < 0) return false;
    this.add(i);
    this.draw();
    return true;
  }

  backspace() {
    if (this.dragging) return;
    this.removeLast();
    this.draw();
  }

  submit() {
    const word = this.word;
    const idx = [...this.path];
    this.clear(false);
    if (word.length) this.cb.onSubmit(word, idx);
  }

  /** Clear the selection. Keep the preview visible (for fly animations) unless `hidePreview`. */
  clear(hidePreview = true) {
    for (const i of this.path) this.buttons[i].classList.remove('on');
    this.path = [];
    if (hidePreview) {
      this.preview.className = 'preview empty';
      this.preview.innerHTML = '';
    }
    this.draw();
  }

  feedback(kind: 'ok' | 'bonus' | 'dup' | 'wrong') {
    if (kind === 'wrong') {
      this.preview.classList.add('shake');
      this.root.classList.remove('shake');
      void this.root.offsetWidth;
      this.root.classList.add('shake');
      later(() => { this.root.classList.remove('shake'); this.clear(); }, 450);
      return;
    }
    this.preview.classList.add(kind);
    later(() => this.clear(), kind === 'dup' ? 500 : 650);
  }

  private draw() {
    const pts = this.path.map((i) => this.centers[i]);
    if (this.dragging && this.pointer && pts.length) pts.push(this.pointer);
    this.line.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
    this.line.style.strokeWidth = `${Math.max(8, this.letterSize * 0.16)}`;
  }
}
