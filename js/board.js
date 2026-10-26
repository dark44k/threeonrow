import { prepareTile } from './tiles.js';

export const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

let nextId = 1;

export class Board {
  constructor(size, spawner) {
    this.size = size;
    this.spawner = spawner;
    this.grid = Array.from({ length: size }, () => Array(size).fill(null));
  }

  inBounds(r, c) {
    return r >= 0 && c >= 0 && r < this.size && c < this.size;
  }

  get(r, c) {
    return this.inBounds(r, c) ? this.grid[r][c] : null;
  }

  set(r, c, tile) {
    this.grid[r][c] = tile;
  }

  makeTile(type) {
    return prepareTile({ id: nextId++, type });
  }

  forEach(fn) {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const t = this.grid[r][c];
        if (t) fn(t, r, c);
      }
    }
  }

  find(tile) {
    let pos = null;
    this.forEach((t, r, c) => {
      if (t === tile) pos = [r, c];
    });
    return pos;
  }

  counts() {
    const counts = {};
    this.forEach((t) => (counts[t.type] = (counts[t.type] || 0) + 1));
    return counts;
  }

  isFixed(t) {
    return !!t && !!t.fixed;
  }

  canSwap(t) {
    return !!t && !t.fixed;
  }

  swap([r1, c1], [r2, c2]) {
    const t = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = t;
  }

  // Возвращает группы совпадений: [{ type, cells: [[r, c], ...] }]
  findMatches() {
    const groups = [];
    const n = this.size;
    for (const horizontal of [true, false]) {
      for (let i = 0; i < n; i++) {
        let run = [];
        let runType = null;
        for (let j = 0; j <= n; j++) {
          const [r, c] = horizontal ? [i, j] : [j, i];
          const t = j < n ? this.grid[r][c] : null;
          const type = t ? t.type : null;
          if (type && type === runType) {
            run.push([r, c]);
          } else {
            if (runType && run.length >= 3) groups.push({ type: runType, cells: run });
            run = type ? [[r, c]] : [];
            runType = type;
          }
        }
      }
    }
    return groups;
  }

  hasMoves() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const a = this.get(r, c);
          const b = this.get(r + dr, c + dc);
          if (!this.canSwap(a) || !this.canSwap(b) || a.type === b.type) continue;
          this.swap([r, c], [r + dr, c + dc]);
          const ok = this.findMatches().length > 0;
          this.swap([r, c], [r + dr, c + dc]);
          if (ok) return true;
        }
      }
    }
    return false;
  }

  // Начальное заполнение без готовых совпадений, но с хотя бы одним ходом.
  fill() {
    do {
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const exclude = [];
          const l1 = this.get(r, c - 1), l2 = this.get(r, c - 2);
          if (l1 && l2 && l1.type === l2.type) exclude.push(l1.type);
          const u1 = this.get(r - 1, c), u2 = this.get(r - 2, c);
          if (u1 && u2 && u1.type === u2.type) exclude.push(u1.type);
          this.grid[r][c] = this.makeTile(this.spawner.pick(this, exclude));
        }
      }
    } while (!this.hasMoves());
  }

  // Падение вниз. Закреплённые фишки (цель в центре) не двигаются — остальные «проходят сквозь» них.
  applyGravity() {
    for (let c = 0; c < this.size; c++) {
      const open = [];
      for (let r = this.size - 1; r >= 0; r--) {
        if (!this.isFixed(this.grid[r][c])) open.push(r);
      }
      const stack = open.map((r) => this.grid[r][c]).filter(Boolean);
      const fresh = open.length - stack.length;
      open.forEach((r) => (this.grid[r][c] = null));
      open.forEach((r, i) => {
        if (i < stack.length) {
          this.grid[r][c] = stack[i];
        } else {
          const t = this.makeTile(this.spawner.pick(this));
          t.fromRow = r - fresh;
          this.grid[r][c] = t;
        }
      });
    }
  }

  shuffle() {
    const cells = [];
    const tiles = [];
    this.forEach((t, r, c) => {
      if (!t.fixed) {
        cells.push([r, c]);
        tiles.push(t);
      }
    });
    for (let tries = 0; tries < 200; tries++) {
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      cells.forEach(([r, c], i) => (this.grid[r][c] = tiles[i]));
      if (!this.findMatches().length && this.hasMoves()) return;
    }
    do {
      cells.forEach(([r, c]) => (this.grid[r][c] = this.makeTile(this.spawner.pick(this))));
    } while (!this.hasMoves());
  }
}
