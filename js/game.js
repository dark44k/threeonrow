import { Board } from './board.js';
import { TILES, prepareTile } from './tiles.js';
import { findMeals, ageTiles } from './ecosystem.js';
import { createSpawner } from './spawner.js';

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const T = { swap: 170, pop: 230, fall: 260, eat: 380, appear: 450 };

const key = (r, c) => `${r},${c}`;
const emoji = (type) => TILES[type].emoji;

// Один раунд. В центре — закреплённая цель, которой больше нет на поле.
// Ход: совпадения → (время идёт) → кто-то кого-то ест → что-то стареет → приходят новые виды.
// Цель уровня — собрать центральную фишку в три в ряд.
export class Game {
  constructor(level, view, hooks) {
    this.level = level;
    this.view = view;
    this.hooks = hooks; // onChange, onToast, onEnd
    this.spawner = createSpawner(level);
    this.board = new Board(level.size, this.spawner);
    this.moves = level.moves;
    this.score = 0;
    this.combo = 0;
    this.turn = 0;
    this.busy = false;
    this.over = false;
    this.night = false;
    this.nightClock = 0;
    this.seen = new Set(); // какие виды уже появлялись на поле — по ним светится цепочка
    this.flags = new Set(); // особые звенья цепочки, например «наступила ночь»
    this.fired = new Set(); // сработавшие разовые триггеры
    this.targetUnlocked = false;
    this.targetCleared = false;

    const center = Math.floor(level.size / 2);
    this.board.fill();
    this.target = this.board.makeTile(level.target);
    this.target.fixed = true;
    this.board.set(center, center, this.target);
    if (!this.board.hasMoves()) this.board.shuffle();

    view.reset(level.size);
    view.render(this.board);
    this.noteSeen();
  }

  get won() {
    return this.targetCleared;
  }

  async trySwap(a, b) {
    if (this.busy || this.over) return;
    if (!this.board.canSwap(this.board.get(...a)) || !this.board.canSwap(this.board.get(...b))) return;

    this.busy = true;
    this.board.swap(a, b);
    this.view.render(this.board);
    await wait(T.swap);

    const valid = this.board.findMatches().length > 0;
    this.hooks.onSwap?.(valid);
    if (!valid) {
      this.board.swap(a, b);
      this.view.render(this.board);
      await wait(T.swap);
      this.busy = false;
      return;
    }

    this.moves--;
    this.combo = 0;
    this.hooks.onChange();
    await this.resolve();
    if (!this.won) {
      this.tick();
      await this.ecosystem();
    }
    this.spawner.endTurn();
    this.hooks.onChange();
    this.checkEnd();

    if (!this.over && !this.board.hasMoves()) {
      this.hooks.onToast('🔀 Ходов нет — перемешиваем');
      await wait(400);
      this.board.shuffle();
      this.view.render(this.board);
      await wait(T.fall);
      await this.resolve();
    }
    this.busy = false;
  }

  // Каскады совпадений, пока поле не успокоится.
  async resolve() {
    for (;;) {
      const groups = this.board.findMatches();
      if (!groups.length) break;
      this.combo++;

      const cleared = new Map();
      groups.forEach((g) => g.cells.forEach(([r, c]) => cleared.set(key(r, c), [r, c])));
      const positions = [...cleared.values()];
      const tiles = positions.map(([r, c]) => this.board.get(r, c));
      await this.view.pop(tiles, 'pop', T.pop);

      positions.forEach(([r, c]) => this.board.set(r, c, null));
      const byType = {};
      tiles.forEach((t) => (byType[t.type] = (byType[t.type] || 0) + 1));
      for (const [type, count] of Object.entries(byType)) this.spawner.onMatched(type, count);
      const points = tiles.length * 10 * this.combo;
      this.score += points;
      this.view.float(positions[Math.floor(positions.length / 2)], `+${points}`);

      if (tiles.includes(this.target)) {
        this.targetCleared = true;
        this.hooks.onToast(`🏆 ${TILES[this.target.type].name} собран!`);
      }
      this.craft(groups);
      this.hooks.onChange();

      this.board.applyGravity();
      this.view.render(this.board);
      await wait(T.fall);
      this.noteSeen();
    }
  }

  // Совпадение из «сырья» оставляет на своём месте новую фишку (молоко → сыр).
  craft(groups) {
    for (const g of groups) {
      const into = TILES[g.type].crafts;
      if (!into) continue;
      const [r, c] = g.cells[Math.floor(g.cells.length / 2)];
      if (this.board.get(r, c)) continue;
      const tile = this.board.makeTile(into);
      this.board.set(r, c, tile);
      this.view.render(this.board);
      this.view.mark(tile, 'appear', T.appear);
      this.hooks.onToast(`${emoji(g.type)}×${g.cells.length} → ${emoji(into)}`);
    }
  }

  // Время идёт: счётчик ходов и смена дня и ночи.
  tick() {
    this.turn++;
    if (!this.level.night) return;
    this.nightClock++;
    if (this.nightClock < this.level.night.period) return;
    this.nightClock = 0;
    this.night = !this.night;
    if (this.night) this.flags.add('night');
    this.view.setNight(this.night);
    const { on = '🌙 Наступила ночь', off = '☀️ Наступило утро' } = this.level.night;
    this.hooks.onToast(this.night ? on : off);
  }

  // Фаза мира после хода игрока.
  async ecosystem() {
    const meals = findMeals(this.board);
    if (meals.length) {
      meals.forEach((m) => this.view.mark(m.eater, 'bite', T.eat));
      await wait(T.eat / 2);
      const summary = new Map();
      for (const m of meals) {
        const verb = TILES[m.eater.type].verb || 'съел';
        const label = `${emoji(m.eater.type)} ${verb} ${emoji(m.victim.type)}${m.into === m.eater.type ? '' : ` → ${emoji(m.into)}`}`;
        summary.set(label, (summary.get(label) || 0) + 1);
        this.transform(m.victim, m.into);
        m.eater.eaten++;
        const grows = TILES[m.eater.type].grows;
        if (grows && m.eater.eaten >= grows.eaten) {
          this.hooks.onToast(`${emoji(m.eater.type)} теперь ${TILES[grows.into].name}!`);
          this.transform(m.eater, grows.into);
        }
      }
      this.hooks.onToast([...summary].map(([label, n]) => (n > 1 ? `${label} ×${n}` : label)).join(' · '));
      await this.settle();
    }

    const aged = ageTiles(this.board);
    if (aged.length) {
      const summary = new Map();
      for (const { tile, into } of aged) {
        const label = `${emoji(tile.type)} → ${emoji(into)}`;
        summary.set(label, (summary.get(label) || 0) + 1);
        this.transform(tile, into);
      }
      this.hooks.onToast(`Время: ${[...summary].map(([label, n]) => `${label} ×${n}`).join(' · ')}`);
      await this.settle();
    } else {
      this.view.render(this.board); // обновить счётчики на стареющих фишках
    }

    await this.arrivals();
  }

  // Новые виды приходят по ходам (arrivals) или по условию (triggers).
  async arrivals() {
    const counts = this.board.counts();
    const incoming = (this.level.arrivals || []).filter((a) => a.turn === this.turn);
    (this.level.triggers || []).forEach((tr, i) => {
      if (tr.once && this.fired.has(i)) return;
      if (tr.night && !this.night) return;
      if (tr.when && (counts[tr.when.type] || 0) < tr.when.atLeast) return;
      this.fired.add(i);
      incoming.push(tr);
    });
    if (!incoming.length) return;
    for (const a of incoming) {
      if (a.spawn) this.spawner.add(a.spawn);
      if (a.type) this.dropIn(a.type, a.count || 1);
      if (a.text) this.hooks.onToast(a.text);
    }
    await this.settle();
  }

  // Пришедшие существа занимают место случайных «мирных» фишек.
  dropIn(type, count) {
    const cells = [];
    this.board.forEach((t) => {
      const def = TILES[t.type];
      if (!t.fixed && !def.eats && !def.ages && t.type !== this.level.target) cells.push(t);
    });
    cells.sort(() => Math.random() - 0.5);
    cells.slice(0, count).forEach((t) => this.transform(t, type));
  }

  transform(tile, into) {
    tile.type = into;
    prepareTile(tile);
    this.view.mark(tile, 'appear', T.appear);
  }

  async settle() {
    this.view.render(this.board);
    this.noteSeen();
    this.hooks.onChange();
    await wait(T.appear);
    await this.resolve();
  }

  // Запоминаем, какие виды уже были на поле. Как только цепочка дошла до цели — цель начинает падать.
  noteSeen() {
    this.board.forEach((t) => {
      if (!t.fixed) this.seen.add(t.type);
    });
    if (!this.targetUnlocked && this.seen.has(this.level.target)) {
      this.targetUnlocked = true;
      this.spawner.add({ [this.level.target]: this.level.targetWeight ?? 0.5 });
      this.hooks.onToast(`💡 Цепочка дошла до ${emoji(this.level.target)}! Собери три в ряд с центральной`);
    }
  }

  checkEnd() {
    if (this.over) return;
    if (this.won) {
      this.over = true;
      this.hooks.onEnd(true);
    } else if (this.moves <= 0) {
      this.over = true;
      this.hooks.onEnd(false);
    }
  }

  stars() {
    const left = this.moves / this.level.moves;
    return left >= 0.4 ? 3 : left >= 0.2 ? 2 : 1;
  }
}
