import { TILES } from './tiles.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// DOM-отрисовка поля. Каждая фишка — div, позиция через transform (анимируется CSS).
export class View {
  constructor(el) {
    this.el = el;
    this.nodes = new Map();
    this.selectedId = null;
    window.addEventListener('resize', () => this.resize());
  }

  reset(size) {
    this.size = size;
    this.nodes.clear();
    this.el.innerHTML = '';
    this.el.style.setProperty('--n', size);
    this.setNight(false);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement('div');
        cell.className = `cell ${(r + c) % 2 ? 'odd' : ''}`;
        this.place(cell, r, c);
        this.el.appendChild(cell);
      }
    }
    this.resize();
  }

  resize() {
    if (!this.size) return;
    this.cellSize = this.el.clientWidth / this.size;
    this.el.style.setProperty('--cell', `${this.cellSize}px`);
  }

  setNight(night) {
    this.el.classList.toggle('night', night);
  }

  place(node, r, c) {
    node.style.transform = `translate(${c * 100}%, ${r * 100}%)`;
  }

  render(board) {
    const seen = new Set();
    board.forEach((t, r, c) => {
      seen.add(t.id);
      let node = this.nodes.get(t.id);
      if (!node) {
        node = this.create(t);
        this.place(node, t.fromRow ?? r, c);
        delete t.fromRow;
        node.getBoundingClientRect(); // фиксируем стартовую позицию, чтобы сработал transition
      }
      if (node.dataset.type !== t.type) this.paint(node, t);
      this.place(node, r, c);
      node.classList.toggle('selected', t.id === this.selectedId);
      node.classList.toggle('target', !!t.fixed);
      const tag = node.querySelector('.tag');
      tag.textContent = t.tag ?? '';
      tag.hidden = t.tag == null || t.fixed;
    });
    for (const [id, node] of this.nodes) {
      if (!seen.has(id)) {
        node.remove();
        this.nodes.delete(id);
      }
    }
  }

  create(t) {
    const node = document.createElement('div');
    node.className = 'tile';
    this.paint(node, t);
    this.el.appendChild(node);
    this.nodes.set(t.id, node);
    return node;
  }

  paint(node, t) {
    const def = TILES[t.type];
    node.dataset.type = t.type;
    node.title = def.name;
    node.innerHTML = `<span class="face">${def.emoji}</span>${def.crown ? '<span class="crown">👑</span>' : ''}<span class="tag" hidden></span>`;
  }

  select(tile) {
    this.selectedId = tile ? tile.id : null;
    for (const [id, node] of this.nodes) node.classList.toggle('selected', id === this.selectedId);
  }

  mark(tile, cls, ms = 400) {
    const node = this.nodes.get(tile.id);
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms);
  }

  async pop(tiles, cls, ms) {
    tiles.forEach((t) => this.nodes.get(t.id)?.classList.add(cls));
    await wait(ms);
  }

  float([r, c], text, cls = '') {
    const node = document.createElement('div');
    node.className = `float ${cls}`;
    node.textContent = text;
    node.style.left = `${(c / this.size) * 100}%`;
    node.style.top = `${(r / this.size) * 100}%`;
    this.el.appendChild(node);
    setTimeout(() => node.remove(), 900);
  }

  rectOf(tile) {
    return this.nodes.get(tile.id)?.getBoundingClientRect() ?? null;
  }

  cellAt(x, y) {
    const rect = this.el.getBoundingClientRect();
    const c = Math.floor(((x - rect.left) / rect.width) * this.size);
    const r = Math.floor(((y - rect.top) / rect.height) * this.size);
    return r >= 0 && c >= 0 && r < this.size && c < this.size ? [r, c] : null;
  }
}
