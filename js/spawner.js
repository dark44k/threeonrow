// Взвешенный спавн. Баланс природы: level.balance = { cat: 'mouse' } — каждая убранная кошка
// повышает шанс появления мышей (даже если сначала мышей не было совсем).
export function createSpawner(level) {
  const base = { ...level.spawn };
  const boost = {};

  function weights() {
    const w = { ...base };
    for (const [type, b] of Object.entries(boost)) w[type] = (w[type] || 0) + b;
    return Object.fromEntries(Object.entries(w).filter(([, v]) => v > 0.01));
  }

  return {
    boost,
    weights,
    add(extra) {
      for (const [type, w] of Object.entries(extra)) base[type] = (base[type] || 0) + w;
    },
    pick(board, exclude = []) {
      const entries = Object.entries(weights()).filter(([type]) => !exclude.includes(type));
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let roll = Math.random() * total;
      for (const [type, w] of entries) {
        roll -= w;
        if (roll <= 0) return type;
      }
      return entries[entries.length - 1][0];
    },
    onMatched(type, count) {
      const prey = level.balance?.[type];
      if (prey) boost[prey] = Math.min(3, (boost[prey] || 0) + 0.15 * count);
    },
    endTurn() {
      for (const type in boost) boost[type] *= 0.85;
    },
  };
}
