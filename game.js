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

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = localStorage.getItem('tetris-theme') === 'light' ? 'light' : 'dark';
let started = false;

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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = THEME_COLORS[theme].highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEME_COLORS[theme].grid;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

// ---- Records ----

const RECORDS_KEY = 'tetris-highscores';
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

function saveRecord({ name, score, lines, level, combo, linesAtOnce }) {
  const records = loadRecords();
  records.scores.push({
    name: name || '---',
    score: score || 0,
    lines: lines || 0,
    level: level || 1,
    date: new Date().toISOString(),
  });
  records.scores.sort((a, b) => b.score - a.score);
  records.scores = records.scores.slice(0, MAX_RECORDS);
  records.bestCombo = Math.max(records.bestCombo, combo || 0);
  records.maxLines = Math.max(records.maxLines, linesAtOnce || 0);
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
  overlay.classList.remove('hidden');

  const combo = typeof maxCombo !== 'undefined' ? maxCombo : 0;
  const linesAtOnce = typeof maxLinesAtOnce !== 'undefined' ? maxLinesAtOnce : 0;
  saveRecord({ name: 'Jugador', score, lines, level, combo, linesAtOnce });
  renderRecords(recordsPanel);
}

function applyTheme() {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeSwitch.checked = theme === 'light';
  if (board && current) draw();
  if (next) drawNext();
}

function toggleTheme() {
  theme = themeSwitch.checked ? 'light' : 'dark';
  localStorage.setItem('tetris-theme', theme);
  applyTheme();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  applyTheme();
  overlay.classList.add('hidden');
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
  if (e.code === 'KeyP') { togglePause(); return; }
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

restartBtn.addEventListener('click', init);
themeSwitch.addEventListener('change', toggleTheme);
playBtn.addEventListener('click', startGame);
resetRecordsBtn.addEventListener('click', () => {
  resetRecords();
  renderRecords(recordsPanel);
  renderRecords(startRecordsPanel);
});

applyTheme();
renderRecords(startRecordsPanel);
