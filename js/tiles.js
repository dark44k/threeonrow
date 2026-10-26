// Мир игры. Поведение фишек задаётся данными и одинаково на всех уровнях:
//   eats   — после хода «съедает» одну соседнюю фишку из списка; та превращается в такого же (плодится)
//   leaves — едок не плодится: съеденная фишка превращается в это
//   verb   — как это назвать в ленте событий
//   ages   — если фишку не убрать за turns ходов, она превращается в into
//   grows  — едок, сработавший eaten раз, превращается в into
//   crafts — совпадение из таких фишек оставляет на своём месте новую фишку
const PRODUCE = ['tomato', 'cucumber', 'carrot', 'potato', 'corn'];

export const TILES = {
  // мирная ярмарка
  tomato: { emoji: '🍅', name: 'Помидор' },
  cucumber: { emoji: '🥒', name: 'Огурец' },
  carrot: { emoji: '🥕', name: 'Морковь' },
  potato: { emoji: '🥔', name: 'Картошка' },
  seed: { emoji: '🌱', name: 'Росток', ages: { turns: 3, into: 'corn' } },
  corn: { emoji: '🌽', name: 'Кукуруза' },
  money: { emoji: '💰', name: 'Бюджет' },

  // власть
  official: { emoji: '🧑‍💼', name: 'Чиновник', eats: ['money'], verb: 'освоил' },
  ballot: { emoji: '🗳️', name: 'Бюллетень', crafts: 'president' },
  president: { emoji: '🤵', name: 'Президент', ages: { turns: 6, into: 'dictator' } },
  dictator: { emoji: '🤵', name: 'Диктатор', crown: true },

  // улица
  citizen: { emoji: '🧑', name: 'Горожанин' },
  phone: { emoji: '📱', name: 'Соцсети', eats: ['citizen'], leaves: 'angry', verb: 'разозлили' },
  angry: { emoji: '😠', name: 'Недовольный', ages: { turns: 4, into: 'protester' } },
  protester: { emoji: '🪧', name: 'Митингующий', eats: ['angry'], verb: 'сагитировал', grows: { eaten: 2, into: 'leader' } },
  leader: { emoji: '📢', name: 'Лидер протеста' },

  // силовые структуры и хаос
  police: { emoji: '👮', name: 'Полиция', eats: ['protester'], leaves: 'citizen', verb: 'разогнал' },
  riot: { emoji: '🛡️', name: 'ОМОН', eats: ['protester'], verb: 'задержал' },
  army: { emoji: '🪖', name: 'Армия', eats: ['protester', 'police'], leaves: 'fire', verb: 'столкнулась с' },
  fire: { emoji: '🔥', name: 'Беспорядки', eats: [...PRODUCE, 'citizen', 'money', 'ballot'], verb: 'спалил' },
};

// Новая фишка или фишка после превращения: сбрасываем «возраст» и счётчики.
export function prepareTile(tile) {
  const ages = TILES[tile.type].ages;
  tile.eaten = 0;
  tile.age = 0;
  tile.tag = ages ? ages.turns : null;
  return tile;
}
