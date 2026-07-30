'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris acero)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const THEME_COLORS = {
  dark: { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)' },
  light: { grid: '#c5c9dc', highlight: 'rgba(255,255,255,0.4)' },
};

function clampChannel(v) {
  return Math.max(0, Math.min(255, v));
}

// Simple RGB-based lighten/darken helper for hex colors (no external libs).
// amount is in [0,1]: lighten mixes toward white, darken mixes toward black.
function lighten(hex, amount) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const nr = clampChannel(Math.round(r + (255 - r) * amount));
  const ng = clampChannel(Math.round(g + (255 - g) * amount));
  const nb = clampChannel(Math.round(b + (255 - b) * amount));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function darken(hex, amount) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const nr = clampChannel(Math.round(r * (1 - amount)));
  const ng = clampChannel(Math.round(g * (1 - amount)));
  const nb = clampChannel(Math.round(b * (1 - amount)));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

const SKINS = {
  retro: {
    colors: COLORS,
    background: null,
    grid: null, // uses THEME_COLORS[theme].grid
    highlight: null, // uses THEME_COLORS[theme].highlight
  },
  neon: {
    colors: [
      null,
      '#00f0ff', // I - electric cyan
      '#faff00', // O - electric yellow
      '#e100ff', // T - magenta
      '#39ff14', // S - neon green
      '#ff073a', // Z - neon red
      '#1b8bff', // J - electric blue
      '#ff9500', // L - neon orange
      '#e0e0e0', // N - bright silver
    ],
    background: '#000000',
    grid: 'rgba(255,255,255,0.06)',
    highlight: 'rgba(255,255,255,0.5)',
  },
  pastel: {
    colors: [
      null,
      '#a8e0e6', // I
      '#f6e5a3', // O
      '#d8b6e0', // T
      '#b6dfb2', // S
      '#f2b3ae', // Z
      '#b6cdf2', // J
      '#f3cfa3', // L
      '#d6d9e0', // N
    ],
    background: null,
    grid: THEME_COLORS.light.grid,
    highlight: 'rgba(255,255,255,0.6)',
  },
  pixel: {
    colors: COLORS,
    background: null,
    grid: null, // uses THEME_COLORS[theme].grid
    highlight: null, // uses THEME_COLORS[theme].highlight
  },
};

const SKIN_KEYS = Object.keys(SKINS);

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeSwitch = document.getElementById('theme-switch');
const startScreen = document.getElementById('start-screen');
const startRecordsPanel = document.getElementById('start-records-panel');
const playBtn = document.getElementById('play-btn');
const recordsPanel = document.getElementById('records-panel');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const skinSelect = document.getElementById('skin-select');
const gameoverActions = document.getElementById('gameover-actions');
const pauseMenu = document.getElementById('pause-menu');
const pauseViewMain = document.getElementById('pause-view-main');
const pauseViewControls = document.getElementById('pause-view-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level-select');

const START_LEVEL_KEY = 'tetris-start-level';
const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 15;

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // ignore (e.g. private browsing / storage disabled)
  }
}

function getStartLevel() {
  const stored = parseInt(safeGetItem(START_LEVEL_KEY), 10);
  if (Number.isInteger(stored) && stored >= MIN_START_LEVEL && stored <= MAX_START_LEVEL) {
    return stored;
  }
  return MIN_START_LEVEL;
}

function setStartLevel(value) {
  const n = Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, parseInt(value, 10) || MIN_START_LEVEL));
  safeSetItem(START_LEVEL_KEY, String(n));
  return n;
}

function populateStartLevelSelect() {
  startLevelSelect.innerHTML = '';
  for (let i = MIN_START_LEVEL; i <= MAX_START_LEVEL; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    startLevelSelect.appendChild(opt);
  }
  startLevelSelect.value = String(getStartLevel());
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = safeGetItem('tetris-theme') === 'light' ? 'light' : 'dark';
let started = false;

function loadStoredSkin() {
  const stored = safeGetItem('tetris-skin');
  return SKIN_KEYS.includes(stored) ? stored : 'retro';
}

let skin = loadStoredSkin();

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function currentSkin() {
  return SKINS[skin] || SKINS.retro;
}

function skinGridColor() {
  return currentSkin().grid || THEME_COLORS[theme].grid;
}

function skinHighlightColor() {
  return currentSkin().highlight || THEME_COLORS[theme].highlight;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const activeSkin = currentSkin();
  const color = activeSkin.colors[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;

  context.globalAlpha = alpha ?? 1;

  if (skin === 'neon') {
    context.shadowBlur = 12;
    context.shadowColor = color;
    context.fillStyle = color;
    context.fillRect(px, py, w, h);
    // reset immediately so the glow doesn't bleed into later draw calls
    // (grid lines, text, other canvases) in this frame.
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
    context.fillStyle = skinHighlightColor();
    context.fillRect(px, py, w, 4);
  } else if (skin === 'pastel') {
    const radius = 5;
    context.fillStyle = color;
    if (typeof context.roundRect === 'function') {
      context.beginPath();
      context.roundRect(px, py, w, h, radius);
      context.fill();
    } else {
      // fallback: fake rounding by insetting corners slightly
      context.fillRect(px + 1, py, w - 2, h);
      context.fillRect(px, py + 1, w, h - 2);
    }
    // softer/thinner highlight strip
    context.fillStyle = skinHighlightColor();
    context.fillRect(px + 2, py + 1, w - 4, 2);
  } else if (skin === 'pixel') {
    context.fillStyle = color;
    context.fillRect(px, py, w, h);
    // cheap dithered pixel-art texture: alternating lighter/darker sub-rects
    const light = lighten(color, 0.25);
    const dark = darken(color, 0.25);
    const halfW = w / 2;
    const halfH = h / 2;
    context.fillStyle = light;
    context.fillRect(px, py, halfW, halfH);
    context.fillRect(px + halfW, py + halfH, w - halfW, h - halfH);
    context.fillStyle = dark;
    context.fillRect(px + halfW, py, w - halfW, halfH);
    context.fillRect(px, py + halfH, halfW, h - halfH);
    // highlight strip on top
    context.fillStyle = skinHighlightColor();
    context.fillRect(px, py, w, 4);
  } else {
    // retro (default / fallback)
    context.fillStyle = color;
    context.fillRect(px, py, w, h);
    context.fillStyle = skinHighlightColor();
    context.fillRect(px, py, w, 4);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = skinGridColor();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  const bg = currentSkin().background;
  if (bg) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  const bg = currentSkin().background;
  if (bg) {
    nextCtx.globalAlpha = 1;
    nextCtx.fillStyle = bg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  } else {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

// ---- Records ----

const RECORDS_KEY = 'tetris-highscores';
const LAST_NAME_KEY = 'tetris-last-name';
const MAX_RECORDS = 5;

function defaultRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function isValidRecords(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.scores) &&
    typeof data.bestCombo === 'number' &&
    typeof data.maxLines === 'number' &&
    data.scores.every(s =>
      s &&
      typeof s === 'object' &&
      typeof s.name === 'string' &&
      typeof s.score === 'number' &&
      typeof s.lines === 'number' &&
      typeof s.level === 'number' &&
      typeof s.date === 'string'
    )
  );
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return defaultRecords();
    const parsed = JSON.parse(raw);
    if (!isValidRecords(parsed)) return defaultRecords();
    return parsed;
  } catch (e) {
    return defaultRecords();
  }
}

function saveRecord(entry) {
  const records = loadRecords();
  records.scores.push({
    name: entry.name || '---',
    score: entry.score || 0,
    lines: entry.lines || 0,
    level: entry.level || 1,
    date: entry.date || new Date().toISOString(),
  });
  records.scores.sort((a, b) => b.score - a.score);
  records.scores = records.scores.slice(0, MAX_RECORDS);
  records.bestCombo = Math.max(records.bestCombo, entry.combo || 0);
  records.maxLines = Math.max(records.maxLines, entry.linesAtOnce || 0);
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    // localStorage no disponible (modo privado, cuota, etc.) - fallo silencioso
  }
  return records;
}

function resetRecords() {
  if (!window.confirm('¿Borrar todos los records?')) return;
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(defaultRecords()));
  } catch (e) {
    // fallo silencioso
  }
}

function qualifiesForTop5(score) {
  const records = loadRecords();
  if (records.scores.length < MAX_RECORDS) return true;
  const worst = records.scores[records.scores.length - 1];
  return score > worst.score;
}

function renderRecords(containerEl, highlightIndex) {
  if (!containerEl) return;
  const records = loadRecords();
  const rows = records.scores
    .map((s, i) => {
      const cls = i === highlightIndex ? ' class="highlight"' : '';
      return `<tr${cls}>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${s.score.toLocaleString()}</td>
        <td>${s.lines}</td>
        <td>${s.level}</td>
      </tr>`;
    })
    .join('');

  const table = records.scores.length
    ? `<table class="records-table">
        <thead>
          <tr><th>#</th><th>Nombre</th><th>Puntos</th><th>Líneas</th><th>Nivel</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
    : '<p class="records-empty">Sin records todavía</p>';

  containerEl.innerHTML = `
    <h3 class="records-title">Records</h3>
    ${table}
    <p class="records-stat">Mejor combo: ${records.bestCombo}</p>
    <p class="records-stat">Máx. líneas: ${records.maxLines}</p>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  pauseMenu.classList.add('hidden');
  gameoverActions.classList.remove('hidden');
  overlay.classList.remove('hidden');

  if (qualifiesForTop5(score)) {
    nameForm.classList.remove('hidden');
    let lastName = '';
    try {
      lastName = localStorage.getItem(LAST_NAME_KEY) || '';
    } catch (e) {
      lastName = '';
    }
    nameInput.value = lastName;
    saveScoreBtn.disabled = false;

    const handleSave = () => {
      const name = nameInput.value.trim() || 'AAA';
      const combo = typeof maxCombo !== 'undefined' ? maxCombo : 0;
      const linesAtOnce = typeof maxLinesAtOnce !== 'undefined' ? maxLinesAtOnce : 0;
      const entry = {
        name,
        score,
        lines,
        level,
        date: new Date().toISOString(),
        combo,
        linesAtOnce,
      };
      const data = saveRecord(entry);
      try {
        localStorage.setItem(LAST_NAME_KEY, name);
      } catch (e) {
        // ignore
      }
      const highlightIndex = data.scores.findIndex(
        e => e.date === entry.date && e.name === entry.name && e.score === entry.score
      );
      renderRecords(recordsPanel, highlightIndex >= 0 ? highlightIndex : undefined);
      nameForm.classList.add('hidden');
      saveScoreBtn.removeEventListener('click', handleSave);
    };

    saveScoreBtn.addEventListener('click', handleSave);
    renderRecords(recordsPanel);
  } else {
    nameForm.classList.add('hidden');
    renderRecords(recordsPanel);
  }
}

function applyTheme() {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeSwitch.checked = theme === 'light';
  if (board && current) draw();
  if (next) drawNext();
}

function toggleTheme() {
  theme = themeSwitch.checked ? 'light' : 'dark';
  safeSetItem('tetris-theme', theme);
  applyTheme();
}

function applySkin() {
  SKIN_KEYS.forEach(key => document.body.classList.remove(`skin-${key}`));
  document.body.classList.add(`skin-${skin}`);
  if (skinSelect) skinSelect.value = skin;
  draw();
  drawNext();
}

function changeSkin() {
  const value = skinSelect.value;
  skin = SKIN_KEYS.includes(value) ? value : 'retro';
  safeSetItem('tetris-skin', skin);
  applySkin();
}

function showPauseView(view) {
  pauseViewMain.classList.toggle('hidden', view !== 'main');
  pauseViewControls.classList.toggle('hidden', view !== 'controls');
}

function openPauseOverlay() {
  overlayTitle.textContent = 'PAUSA';
  overlayScore.textContent = '';
  gameoverActions.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
  showPauseView('main');
  overlay.classList.remove('hidden');
}

function closePauseOverlay() {
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
}

function blurActiveElement() {
  const active = document.activeElement;
  if (active && typeof active.blur === 'function' && active !== document.body) {
    active.blur();
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  cancelAnimationFrame(animId);
  if (!paused) {
    closePauseOverlay();
    blurActiveElement();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  } else {
    openPauseOverlay();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = getStartLevel();
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  applyTheme();
  applySkin();
  gameoverActions.classList.add('hidden');
  closePauseOverlay();
  overlay.classList.add('hidden');
  nameForm.classList.add('hidden');
  recordsPanel.innerHTML = '';
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function startGame() {
  if (started) return;
  started = true;
  startScreen.classList.add('hidden');
  init();
}

document.addEventListener('keydown', e => {
  if (!started) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      startGame();
    }
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

function onMenuClick(el, fn) {
  el.addEventListener('click', () => {
    fn();
    el.blur();
  });
}

onMenuClick(restartBtn, init);
onMenuClick(pauseRestartBtn, init);
onMenuClick(resumeBtn, () => {
  if (paused) togglePause();
});
onMenuClick(controlsBtn, () => showPauseView('controls'));
onMenuClick(backBtn, () => showPauseView('main'));
themeSwitch.addEventListener('change', toggleTheme);
playBtn.addEventListener('click', startGame);
resetRecordsBtn.addEventListener('click', () => {
  resetRecords();
  renderRecords(recordsPanel);
  renderRecords(startRecordsPanel);
});
skinSelect.addEventListener('change', changeSkin);
startLevelSelect.addEventListener('change', () => {
  setStartLevel(startLevelSelect.value);
});

populateStartLevelSelect();
applyTheme();
applySkin();
renderRecords(startRecordsPanel);
