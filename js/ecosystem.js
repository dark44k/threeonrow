import { TILES } from './tiles.js';
import { DIRS } from './board.js';

const shuffled = (arr) => [...arr].sort(() => Math.random() - 0.5);

// Кто кого ест после хода. Каждый едок ест не больше одной соседней фишки, каждую жертву съедают один раз.
// Центральная цель (fixed) не ест, не стареет и не может быть съедена.
export function findMeals(board) {
  const eaters = [];
  board.forEach((t, r, c) => {
    if (TILES[t.type].eats && !t.fixed) eaters.push([t, r, c]);
  });
  const taken = new Set();
  const meals = [];
  for (const [eater, r, c] of shuffled(eaters)) {
    if (taken.has(eater.id)) continue;
    const def = TILES[eater.type];
    for (const [dr, dc] of shuffled(DIRS)) {
      const victim = board.get(r + dr, c + dc);
      if (!victim || victim.fixed || taken.has(victim.id) || !def.eats.includes(victim.type)) continue;
      taken.add(victim.id);
      taken.add(eater.id);
      meals.push({ eater, victim, into: def.leaves || eater.type });
      break;
    }
  }
  return meals;
}

// Старение: фишки с ages, которые слишком долго лежат на поле, превращаются.
export function ageTiles(board) {
  const changes = [];
  board.forEach((t) => {
    const ages = TILES[t.type].ages;
    if (!ages || t.fixed) return;
    t.age++;
    t.tag = ages.turns - t.age;
    if (t.age >= ages.turns) changes.push({ tile: t, into: ages.into });
  });
  return changes;
}
