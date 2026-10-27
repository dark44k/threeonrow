// Мир игры. Поведение фишек задаётся данными и одинаково на всех уровнях:
//   eats   — после хода «съедает» одну соседнюю фишку из списка; та превращается в такого же (плодится)
//   leaves — едок не плодится: съеденная фишка превращается в это
//   verb   — как это назвать в ленте событий
//   ages   — если фишку не убрать за turns ходов, она превращается в into
//   grows  — едок, сработавший eaten раз, превращается в into
//   crafts — совпадение из таких фишек оставляет на своём месте новую фишку
//   heat   — насколько фишка накаляет обстановку: из суммы складывается уровень хаоса на поле (анимации)
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

  // рынок: овощи с ярмарки становятся деньгами или поводом для злости
  reseller: { emoji: '🧔', name: 'Перекупщик', eats: ['tomato', 'cucumber', 'carrot', 'potato'], leaves: 'money', verb: 'перепродал' },
  inflation: { emoji: '📈', name: 'Инфляция', heat: 0.2, eats: ['tomato', 'cucumber', 'carrot'], leaves: 'angry', verb: 'подняла цены на' },

  // власть
  official: { emoji: '🧑‍💼', name: 'Чиновник', eats: ['money', 'ballot'], verb: 'освоил' },
  ballot: { emoji: '🗳️', name: 'Бюллетень', crafts: 'president' },
  president: { emoji: '🤵', name: 'Президент', ages: { turns: 6, into: 'dictator' } },
  dictator: { emoji: '🤵', name: 'Диктатор', crown: true },

  // улица
  citizen: { emoji: '🧑', name: 'Горожанин' },
  news: { emoji: '📰', name: 'Газета', heat: 0.2, eats: ['citizen'], leaves: 'angry', verb: 'разозлила' },
  angry: { emoji: '😠', name: 'Недовольный', heat: 0.3, ages: { turns: 4, into: 'protester' } },
  protester: { emoji: '🪧', name: 'Митингующий', heat: 1, eats: ['angry'], verb: 'сагитировал', grows: { eaten: 2, into: 'leader' } },
  leader: { emoji: '📢', name: 'Лидер протеста', heat: 1.5 },

  // силовые структуры и хаос
  police: { emoji: '👮', name: 'Полиция', heat: 0.2, eats: ['protester'], leaves: 'citizen', verb: 'разогнал' },
  riot: { emoji: '🛡️', name: 'ОМОН', heat: 1.5, eats: ['protester'], verb: 'задержал' },
  army: { emoji: '🪖', name: 'Армия', heat: 4, eats: ['protester', 'police'], leaves: 'fire', verb: 'столкнулась с', crafts: 'dictator' },
  fire: { emoji: '🔥', name: 'Беспорядки', heat: 3, eats: [...PRODUCE, 'citizen', 'money', 'ballot'], verb: 'спалил' },
};

// Новая фишка или фишка после превращения: сбрасываем «возраст» и счётчики.
export function prepareTile(tile) {
  const ages = TILES[tile.type].ages;
  tile.eaten = 0;
  tile.age = 0;
  tile.tag = ages ? ages.turns : null;
  return tile;
}
