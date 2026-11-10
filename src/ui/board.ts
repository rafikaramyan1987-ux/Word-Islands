import { cellKey, cellsOf, type Level, type PlacedWord } from '../core/level';
import { el } from './dom';

/** The crossword grid view. */
export class Board {
  root: HTMLDivElement;
  private cells = new Map<string, HTMLDivElement>();
  tile = 44;

  constructor(private level: Level) {
    this.root = el('div', 'board');
    for (const w of level.words) {
      cellsOf(w).forEach(([r, c], i) => {
        const k = cellKey(r, c);
        if (this.cells.has(k)) return;
        const d = el('div', 'cell');
        const s = el('span');
        s.textContent = w.word[i];
        d.appendChild(s);
        d.dataset.r = String(r);
        d.dataset.c = String(c);
        this.root.appendChild(d);
        this.cells.set(k, d);
      });
    }
  }

  /** Fit the grid inside a box. */
  layout(maxW: number, maxH: number) {
    const { rows, cols } = this.level;
    const gap = 0.12;
    const tile = Math.floor(Math.min(maxW / (cols + (cols - 1) * gap), maxH / (rows + (rows - 1) * gap), 78));
    this.tile = Math.max(tile, 20);
    const step = this.tile * (1 + gap);
    this.root.style.setProperty('--tile', `${this.tile}px`);
    this.root.style.width = `${cols * step - this.tile * gap}px`;
    this.root.style.height = `${rows * step - this.tile * gap}px`;
    for (const d of this.cells.values()) {
      d.style.left = `${Number(d.dataset.c) * step}px`;
      d.style.top = `${Number(d.dataset.r) * step}px`;
    }
  }

  cell(r: number, c: number) {
    return this.cells.get(cellKey(r, c))!;
  }

  cellsOfWord(w: PlacedWord) {
    return cellsOf(w).map(([r, c]) => this.cell(r, c));
  }

  fill(r: number, c: number, animate: boolean) {
    const d = this.cell(r, c);
    d.classList.remove('hinted');
    if (d.classList.contains('filled')) return;
    d.classList.add('filled');
    if (animate) {
      d.classList.remove('pop');
      void d.offsetWidth;
      d.classList.add('pop');
    }
  }

  hint(r: number, c: number) {
    const d = this.cell(r, c);
    if (!d.classList.contains('filled')) d.classList.add('hinted');
  }

  flash(w: PlacedWord) {
    for (const d of this.cellsOfWord(w)) {
      d.classList.remove('flash');
      void d.offsetWidth;
      d.classList.add('flash');
    }
  }
}
