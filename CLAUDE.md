# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris implemented in vanilla JavaScript (ES6+), HTML5 Canvas, and CSS. No dependencies, no build system, no package.json, no test suite.

## Running the game

There is no build/lint/test tooling. To run:

```bash
# Just open the file directly
start index.html      # Windows

# Or serve it statically (recommended, avoids potential file:// issues)
python3 -m http.server 8000
npx serve .
```

Then open `http://localhost:8000`. Changes to `game.js`/`style.css`/`index.html` take effect on browser refresh — no compilation step exists or should be introduced.

## Architecture

Three files, all at the repo root, that cooperate directly (no modules/bundler):

- **`index.html`** — DOM structure: a `300×600` `<canvas id="board">` for the playfield, a `120×120` `<canvas id="next-canvas">` for the next-piece preview, HUD spans (`score`, `lines`, `level`), and an `overlay` div reused for both PAUSE and GAME OVER states.
- **`style.css`** — dark/retro arcade visual theme.
- **`game.js`** — all game logic, in one flat file with module-level `let` state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.). No classes, no state management library.

### Core model

- **Board**: `ROWS × COLS` (20×10) matrix; each cell is `0` (empty) or a color index `1–7` identifying the locked piece type.
- **Pieces**: `PIECES` array of square matrices (index 0 unused so type IDs 1–7 map directly to `COLORS`). Rotation is `rotateCW` (transpose + reverse), not precomputed rotation states.
- **Collision** (`collide`): checks board bounds and overlap with locked cells.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns until one doesn't collide.
- **Locking/line clear**: `lockPiece` → `merge` (writes piece into `board`) → `clearLines` (scans bottom-up, splices full rows, unshifts empty rows at top, recalculates level/dropInterval) → `spawn` (promotes `next` to `current`, generates new `next`; if the new piece immediately collides, calls `endGame`).
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates delta time in `dropAccum` and advances the piece one row once it exceeds `dropInterval`.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × current `level`; hard drop adds 2 pts/row dropped, soft drop adds 1 pt/row.
- **Leveling/speed**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece**: `ghostY()` projects `current` straight down until collision; drawn at `globalAlpha = 0.2` before the real piece each frame.

### Rendering

Two independent canvases, each drawn with `drawBlock` (per-cell fill + a light highlight strip). `draw()` redraws the whole board canvas every frame (grid → locked cells → ghost → current piece); `drawNext()` redraws the preview canvas whenever `next` changes.

### Input

A single `keydown` listener switches on `e.code` (arrows, `Space`, `KeyX`, `KeyP`). `P` toggles pause independent of `gameOver`; all other keys are ignored while `paused || gameOver`.

## Tunable constants (all in `game.js`)

`COLS`, `ROWS`, `BLOCK` (px per cell), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, the `width`/`height` attributes of `<canvas id="board">` in `index.html` must be updated to match (`COLS × BLOCK` and `ROWS × BLOCK`).
