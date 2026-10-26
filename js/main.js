import { LEVELS } from './levels.js';
import { TILES } from './tiles.js';
import { Game } from './game.js';
import { View } from './view.js';

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = 'threeonroad.progress';

const view = new View($('#board'));
let game = null;
let levelIndex = 0;
let selected = null;

// ---------- прогресс ----------
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { unlocked: 0, stars: {} };
  } catch {
    return { unlocked: 0, stars: {} };
  }
}

function saveProgress(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // без сохранения — не страшно
  }
}

let progress = loadProgress();

// ---------- HUD ----------
const linkIcon = (link) => link.icon || TILES[link.type].emoji;
const linkLit = (link) => (link.flag ? game.flags.has(link.flag) : game.seen.has(link.type));

function renderChain() {
  const { chain, target } = game.level;
  const parts = chain.map((link) => {
    const isTarget = link.type === target;
    const state = isTarget && game.targetCleared ? 'done' : linkLit(link) ? 'lit' : '';
    return `<div class="link ${state} ${isTarget ? 'goal' : ''}" data-type="${link.type || ''}" data-name="${link.name || ''}"><span class="ico">${linkIcon(link)}</span><small>${link.text}</small></div>`;
  });
  $('#chain').innerHTML = parts.join('<span class="arrow">→</span>');
}

function renderDebug() {
  const el = $('#debug');
  if (el.hidden) return;
  const weights = game.spawner.weights();
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const counts = game.board.counts();
  const types = new Set([...Object.keys(weights), ...Object.keys(counts)]);
  const lines = [...types].map(
    (type) => `${TILES[type].emoji} шанс ${(((weights[type] || 0) / total) * 100).toFixed(0).padStart(3)}%   на поле ${counts[type] || 0}`,
  );
  lines.push(`ход ${game.turn}${game.level.night ? `, ${game.night ? 'ночь' : 'день'}` : ''}`);
  lines.push(`буст: ${JSON.stringify(Object.fromEntries(Object.entries(game.spawner.boost).map(([k, v]) => [k, +v.toFixed(2)])))}`);
  el.textContent = lines.join('\n');
}

function updateHud() {
  $('#levelName').textContent = `${levelIndex + 1}. ${game.level.name}${game.night ? ' 🌙' : ''}`;
  $('#moves').textContent = game.moves;
  $('#score').textContent = game.score;
  renderChain();
  renderDebug();
}

// Лента событий: последние несколько сообщений мира.
function toast(msg) {
  const log = $('#log');
  const line = document.createElement('div');
  line.textContent = msg;
  log.prepend(line);
  while (log.children.length > 3) log.lastChild.remove();
}

// ---------- модальные окна ----------
function modal(title, body, actions) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  const box = $('#modalActions');
  box.innerHTML = '';
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    if (a.primary) btn.className = 'primary';
    btn.onclick = () => {
      $('#modal').hidden = true;
      a.onClick?.();
    };
    box.appendChild(btn);
  }
  $('#modal').hidden = false;
}

function chainList(level) {
  return `<ol class="chain-list">${level.chain
    .map((link) => `<li><span>${link.icon || TILES[link.type].emoji}</span> ${link.text}</li>`)
    .join('')}</ol>`;
}

function showIntro(level) {
  const target = TILES[level.target];
  modal(
    `Уровень ${levelIndex + 1}: ${level.name}`,
    `<p class="finale"><span class="big">${target.emoji}</span><span><b>В центре: ${target.name}</b><br>Других таких на поле нет. Доведи до неё цепочку и собери три в ряд с центральной.</span></p>
     <p>${level.intro}</p>
     ${chainList(level)}
     <p class="muted">Ходов: ${level.moves}</p>`,
    [{ label: 'Играть', primary: true }],
  );
}

function showLevels() {
  const buttons = LEVELS.map((lv, i) => {
    const locked = i > progress.unlocked;
    const stars = progress.stars[i] ? '★'.repeat(progress.stars[i]) : '';
    return `<button class="lvl" data-i="${i}" ${locked ? 'disabled' : ''}><b>${TILES[lv.target].emoji}</b><span>${i + 1}. ${lv.name}</span><em>${locked ? '🔒' : stars}</em></button>`;
  }).join('');
  modal('Уровни', `<div class="levels">${buttons}</div>`, [{ label: 'Закрыть' }]);
  $('#modalBody').querySelectorAll('.lvl').forEach((btn) => {
    btn.onclick = () => {
      $('#modal').hidden = true;
      startLevel(Number(btn.dataset.i));
    };
  });
}

function endLevel(won) {
  if (won) {
    const stars = game.stars();
    progress.stars[levelIndex] = Math.max(progress.stars[levelIndex] || 0, stars);
    progress.unlocked = Math.max(progress.unlocked, Math.min(levelIndex + 1, LEVELS.length - 1));
    saveProgress(progress);
    const hasNext = levelIndex + 1 < LEVELS.length;
    modal(
      'Победа!',
      `<p class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p><p>Очки: ${game.score}, осталось ходов: ${game.moves}</p>${hasNext ? '' : '<p>Это последний уровень прототипа 🎉</p>'}`,
      [
        { label: 'Ещё раз', onClick: () => startLevel(levelIndex) },
        hasNext ? { label: 'Дальше', primary: true, onClick: () => startLevel(levelIndex + 1) } : { label: 'К уровням', primary: true, onClick: showLevels },
      ],
    );
  } else {
    modal('Ходы закончились', `<p>Цепочка была такой:</p>${chainList(game.level)}`, [
      { label: 'К уровням', onClick: showLevels },
      { label: 'Заново', primary: true, onClick: () => startLevel(levelIndex) },
    ]);
  }
}

function startLevel(i) {
  levelIndex = i;
  selected = null;
  $('#log').innerHTML = '';
  document.body.dataset.mood = LEVELS[i].mood ?? 0;
  setHint(false);
  hideTip();
  game = new Game(LEVELS[i], view, { onChange: updateHud, onToast: toast, onEnd: endLevel, onSwap: buzz });
  updateHud();
}

// ---------- подсказка «что это» по нажатию на фишку или звено цепочки ----------
const describe = (type) => `${TILES[type].emoji} ${TILES[type].name}`;

let tipTimer = null;

function showTip(html, rect) {
  const tip = $('#tip');
  tip.innerHTML = html;
  tip.hidden = false;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const left = Math.min(Math.max(rect.left + rect.width / 2 - w / 2, 8), window.innerWidth - w - 8);
  const top = rect.top - h - 8 >= 8 ? rect.top - h - 8 : rect.bottom + 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, 4000);
}

function hideTip() {
  clearTimeout(tipTimer);
  $('#tip').hidden = true;
}

function showTileTip(cell) {
  const tile = game.board.get(...cell);
  const rect = tile && view.rectOf(tile);
  if (rect) showTip(describe(tile.type), rect);
}

$('#chain').addEventListener('click', (e) => {
  const link = e.target.closest('.link');
  if (!link) return;
  const { type } = link.dataset;
  showTip(type ? describe(type) : `${link.querySelector('.ico').textContent} ${link.dataset.name}`, link.getBoundingClientRect());
});

window.addEventListener('scroll', hideTip, { passive: true });

// ---------- ввод: клик-клик или свайп ----------
// Короткая вибрация на телефоне: удачный ход — щелчок, неудачный — двойное «нет».
function buzz(valid) {
  try {
    navigator.vibrate?.(valid ? 12 : [25, 40, 25]);
  } catch {
    // вибрация недоступна — не страшно
  }
}

function attempt(a, b) {
  hideTip();
  selected = null;
  view.select(null);
  if (game.board.inBounds(...b)) game.trySwap(a, b);
}

function clickCell(cell) {
  if (!selected) {
    selected = cell;
    view.select(game.board.get(...cell));
    showTileTip(cell);
    return;
  }
  const dist = Math.abs(selected[0] - cell[0]) + Math.abs(selected[1] - cell[1]);
  if (dist === 1) {
    attempt(selected, cell);
  } else if (dist === 0) {
    selected = null;
    view.select(null);
    hideTip();
  } else {
    selected = cell;
    view.select(game.board.get(...cell));
    showTileTip(cell);
  }
}

let drag = null;
const boardEl = $('#board');

boardEl.addEventListener('pointerdown', (e) => {
  if (!game || game.busy || game.over) return;
  const cell = view.cellAt(e.clientX, e.clientY);
  if (!cell) return;
  drag = { cell, x: e.clientX, y: e.clientY, moved: false };
  boardEl.setPointerCapture(e.pointerId);
});

boardEl.addEventListener('pointermove', (e) => {
  if (!drag || drag.moved) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < view.cellSize * 0.35) return;
  drag.moved = true;
  const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
  attempt(drag.cell, [drag.cell[0] + dr, drag.cell[1] + dc]);
});

boardEl.addEventListener('pointerup', () => {
  if (drag && !drag.moved) clickCell(drag.cell);
  drag = null;
});

boardEl.addEventListener('pointercancel', () => (drag = null));

// ---------- кнопки ----------
// Подсказка-цепочка над полем: в начале уровня свёрнута.
function setHint(open) {
  $('#chain').hidden = !open;
  $('#btnHint').setAttribute('aria-expanded', open);
  $('#btnHint').textContent = open ? '💡 Скрыть подсказку' : '💡 Подсказка';
}

$('#btnHint').onclick = () => setHint($('#chain').hidden);
function toggleDebug() {
  $('#debug').hidden = !$('#debug').hidden;
  renderDebug();
}

$('#btnLevels').onclick = showLevels;
$('#btnRestart').onclick = () => game && !game.busy && startLevel(levelIndex);
$('#btnDebug').onclick = toggleDebug;
$('#btnRules').onclick = () => showIntro(game.level);
document.addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') toggleDebug();
});

startLevel(Math.min(progress.unlocked, LEVELS.length - 1));
