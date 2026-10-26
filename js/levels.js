// Кампания. Правила мира общие (tiles.js), уровень задаёт только стартовые условия:
//   target    — фишка в центре; таких больше нет на поле, пока цепочка до неё не дойдёт
//   spawn     — что падает сверху с самого начала
//   balance   — { police: 'protester' }: убранная полиция повышает шанс митингующих
//   arrivals  — кто приходит на поле на определённом ходу (type/count — сразу на поле, spawn — начинает падать)
//   triggers  — кто приходит, когда выполнено условие (when: на поле не меньше atLeast фишек; night: только ночью)
//   night     — смена дня и ночи каждые period ходов
//   mood      — 0…3: насколько всё уже плохо (фон страницы)
//   chain     — подсказка-цепочка: звено загорается, когда этот вид впервые появился на поле
// У каждого уровня своё последнее звено — способ, которым цепочка доходит до цели.
const VEG = { tomato: 1, cucumber: 1, carrot: 1 };

export const LEVELS = [
  {
    name: 'Ярмарка',
    mood: 0,
    size: 7,
    moves: 12,
    target: 'corn',
    spawn: { ...VEG, potato: 1, seed: 1 },
    chain: [
      { type: 'seed', text: 'не трогай ростки' },
      { type: 'corn', text: 'через 3 хода вырастет кукуруза' },
    ],
    intro: 'Солнечный денёк на ярмарке. В центре — кукуруза, а на грядках пока только ростки. Цифра на ростке — сколько ходов до урожая.',
  },
  {
    name: 'Бюджет',
    mood: 0,
    size: 7,
    moves: 14,
    target: 'official',
    spawn: { ...VEG, money: 1.2 },
    arrivals: [{ turn: 3, type: 'official', count: 1, text: '🧑‍💼 Ярмарке назначили чиновника' }],
    chain: [
      { type: 'money', text: 'бюджет ярмарки' },
      { type: 'official', text: 'на 3-м ходу придёт чиновник — он осваивает бюджет и плодится' },
    ],
    intro: 'Новое: кто «ест» — тот плодится. Освоенный бюджет превращается в ещё одного чиновника. Не убирай деньги — пусть бюрократия разрастётся.',
  },
  {
    name: 'Выборы',
    mood: 0,
    size: 7,
    moves: 12,
    target: 'president',
    spawn: { ...VEG, ballot: 1.1 },
    chain: [
      { type: 'ballot', text: 'собирай бюллетени' },
      { type: 'president', text: 'три бюллетеня — новый президент' },
    ],
    intro: 'Праздник демократии! Совпадение из бюллетеней оставляет на своём месте президента. Подвинь его в линию с центральным. Но цифра на президенте — его срок…',
  },
  {
    name: 'Соцсети',
    mood: 1,
    size: 7,
    moves: 16,
    target: 'angry',
    spawn: { ...VEG, citizen: 1 },
    arrivals: [{ turn: 3, type: 'phone', count: 2, spawn: { phone: 0.3 }, text: '📱 Горожане завели соцсети' }],
    chain: [
      { type: 'citizen', text: 'мирные горожане' },
      { type: 'phone', text: 'на 3-м ходу появятся соцсети' },
      { type: 'angry', text: 'соцсети злят горожан' },
    ],
    intro: 'Соцсети не плодятся — они превращают соседних горожан в недовольных. Держи горожан рядом с телефонами.',
  },
  {
    name: 'Митинг',
    mood: 1,
    size: 7,
    moves: 15,
    target: 'protester',
    spawn: { ...VEG, police: 0.8 },
    balance: { police: 'protester' },
    chain: [
      { type: 'police', text: 'убирай полицию' },
      { type: 'protester', text: 'без полиции на улицы выходят митингующие' },
    ],
    intro: 'Пока полиции много, никто не выходит. Убирай полицию — и появятся митингующие. Но полицейский рядом с митингующим разгонит его.',
  },
  {
    name: 'Лидер протеста',
    mood: 2,
    size: 9,
    moves: 20,
    target: 'leader',
    spawn: { ...VEG, angry: 1, police: 0.2 },
    arrivals: [{ turn: 2, type: 'protester', count: 3, spawn: { protester: 0.3 }, text: '🪧 На площадь вышли первые митингующие' }],
    chain: [
      { type: 'protester', text: 'со 2-го хода выходят митингующие' },
      { type: 'angry', text: 'они агитируют недовольных' },
      { type: 'leader', text: 'сагитировал двоих — стал лидером' },
    ],
    intro: 'Недовольные, которых никто не успокоил за 4 хода, сами выходят на митинг. Убирай полицию и держи митингующих рядом с недовольными.',
  },
  {
    name: 'Комендантский час',
    mood: 2,
    size: 9,
    moves: 14,
    target: 'riot',
    spawn: { ...VEG, angry: 0.7, protester: 0.3 },
    night: { period: 3, on: '🌙 Комендантский час', off: '☀️ Утро, комендантский час снят' },
    triggers: [{ night: true, when: { type: 'protester', atLeast: 14 }, type: 'riot', count: 1, text: '🛡️ На ночной митинг приехал ОМОН' }],
    chain: [
      { type: 'protester', text: 'митинг растёт' },
      { flag: 'night', icon: '🌙', name: 'Комендантский час', text: 'каждые 3 хода — комендантский час' },
      { type: 'riot', text: 'ночью на большой митинг (14+) приедет ОМОН' },
    ],
    intro: 'Новое: день и ночь. ОМОН приезжает только в комендантский час и только если митинг большой.',
  },
  {
    name: 'Военное положение',
    mood: 3,
    size: 9,
    moves: 18,
    target: 'army',
    spawn: { ...VEG, citizen: 0.8, protester: 0.35 },
    arrivals: [{ turn: 2, type: 'phone', count: 2, spawn: { phone: 0.3 }, text: '📱 В соцсетях паника' }],
    triggers: [{ once: true, when: { type: 'protester', atLeast: 13 }, type: 'army', count: 1, spawn: { army: 0.3 }, text: '🪖 Объявлено военное положение!' }],
    chain: [
      { type: 'phone', text: 'соцсети злят горожан' },
      { type: 'angry', text: 'недовольные' },
      { type: 'protester', text: 'выходят на митинг' },
      { type: 'army', text: 'митингующих 13+ — вводят армию' },
    ],
    intro: 'Армию вызывает только по-настоящему большой митинг. А там, где армия сталкивается с людьми, начинается пожар.',
  },
  {
    name: 'Засиделся',
    mood: 3,
    size: 9,
    moves: 18,
    target: 'dictator',
    spawn: { ...VEG, ballot: 1, protester: 0.3, police: 0.3 },
    chain: [
      { type: 'ballot', text: 'выборы' },
      { type: 'president', text: 'три бюллетеня — президент' },
      { type: 'dictator', text: 'президент, которого не сменили за 6 ходов, становится диктатором' },
    ],
    intro: 'Цель появится сама — если ей не мешать. Выбери президента и… просто не трогай его.',
  },
  {
    name: 'Хаос',
    mood: 3,
    size: 9,
    moves: 24,
    target: 'fire',
    spawn: { ...VEG, citizen: 0.8, police: 0.7 },
    balance: { police: 'protester' },
    arrivals: [{ turn: 2, type: 'phone', count: 2, spawn: { phone: 0.3 }, text: '📱 Слухи разлетаются по соцсетям' }],
    triggers: [{ once: true, when: { type: 'protester', atLeast: 7 }, type: 'army', count: 2, spawn: { army: 0.3 }, text: '🪖 На улицы вывели армию!' }],
    chain: [
      { type: 'phone', text: 'соцсети злят горожан' },
      { type: 'angry', text: 'недовольных всё больше' },
      { type: 'protester', text: 'убираешь полицию — митинги растут' },
      { type: 'army', text: 'митингующих 7+ — армия на улицах' },
      { type: 'fire', text: 'армия + митинг = пожар, и огонь пожирает всё' },
    ],
    intro: 'А ведь всё начиналось с помидоров. Доведи город до полного хаоса.',
  },
];
