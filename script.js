// ---------------------------------------------------
// FULLSCREEN GAME OF LIFE (clean and modular version)
// ---------------------------------------------------

var canvas;

let w = 10;
let columns, rows;
let board;

// Resize properly
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resetBoard();
}

// Setup
function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  // place canvas fixed to viewport and behind page content
  canvas.style('position', 'fixed');
  canvas.style('top', '0px');
  canvas.style('left', '0px');
  canvas.style('z-index', '-9999');
  // let pointer events pass through so page content remains interactive
  canvas.style('pointer-events', 'none');

  // slow the simulation a bit so background is gentle
  frameRate(15);

  resetBoard();
}

// Draw loop
function draw() {
  // Update next state (skip edges)
  for (let x = 1; x < columns - 1; x++) {
    for (let y = 1; y < rows - 1; y++) {

      // If this cell was previously marked to be killed this frame, apply it now
      if (board[x][y].killNext && board[x][y].forbidden) {
        board[x][y].killNext = false;
        board[x][y].state = 0;
        // don't compute rules for this cell (it's now dead)
        continue;
      }

      // (forbidden cells are allowed to be born; they'll be killed next frame via killNext)

      let neighborSum = 0;

      // count neighbors
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          neighborSum += board[x + i][y + j].previous;
        }
      }

      neighborSum -= board[x][y].previous;

      // GAME OF LIFE RULES
      if (board[x][y].state === 1 && neighborSum < 2) board[x][y].state = 0;
      else if (board[x][y].state === 1 && neighborSum > 3) board[x][y].state = 0;
      else if (board[x][y].state === 0 && neighborSum === 3) board[x][y].state = 1;

    }
  }

  // After applying the rules, force cells that are inside forbidden regions
  // and were alive last frame to die this frame (so they show a dying flash).
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const c = board[i][j];
      if (c.forbidden && c.state === 1) {
        // mark to be killed at start of next frame so the cell gets a dying flash
        c.killNext = true;
      }
    }
  }

  // Render & update previous
  // clear to keep canvas transparent so it acts as a background
  clear();

  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      board[i][j].show();
      board[i][j].previous = board[i][j].state;
    }
  }
}

// Create/reset board when needed
function resetBoard() {
  columns = floor(width / w);
  rows = floor(height / w);
  board = create2DArray(columns, rows);

  // initialize random cells
  for (let i = 1; i < columns - 1; i++) {
    for (let j = 1; j < rows - 1; j++) {
      board[i][j] = new Cell(floor(random(2)), i * w, j * w, w);
    }
  }

  // mark cells that overlap visible text elements as forbidden
  computeForbiddenRegions();
}

// Create 2D array of cells
function create2DArray(columns, rows) {
  let arr = new Array(columns);
  for (let i = 0; i < columns; i++) {
    arr[i] = new Array(rows);
    for (let j = 0; j < rows; j++) {
      arr[i][j] = new Cell(0, i * w, j * w, w);
    }
  }
  return arr;
}

// Minimal Cell class so the CA can render
function Cell(state, x, y, w) {
  this.state = state; // 0 or 1
  this.previous = state;
  this.x = x;
  this.y = y;
  this.w = w;
  this.forbidden = false;
  this.killNext = false;
}

Cell.prototype.show = function() {
  // If this cell is forbidden (over text), still draw the grid outline
  // but don't draw any fill so text remains readable.
  if (this.forbidden) {
    // draw subtle grid outline
    stroke(0, 10);
    noFill();
    square(this.x, this.y, this.w);

    // still show brief born/dying flashes but very faint so text stays readable
    if (this.previous === 0 && this.state === 1) {
      // born this frame: faint blue
      noStroke();
      fill(0, 0, 255, 40);
      square(this.x, this.y, this.w);
    } else if (this.previous === 1 && this.state === 0) {
      // died this frame: faint red
      noStroke();
      fill(255, 0, 0, 40);
      square(this.x, this.y, this.w);
    }
    return;
  }

  // very subtle stroke for the grid
  stroke(0, 10);
  // If the cell is born this frame, color it blue with low opacity
  if (this.previous === 0 && this.state === 1) {
    fill(0, 0, 255, 50);
  } else if (this.state === 1) {
    // alive cell - very faint
    fill(0, 20);
  // If the cell dies this frame, color it red with low opacity
  } else if (this.previous === 1 && this.state === 0) {
    fill(255, 0, 0, 50);
  } else {
    // dead cell - fully transparent
    noFill();
  }
  square(this.x, this.y, this.w);
}

// Compute which board cells overlap visible text elements and mark them forbidden
function computeForbiddenRegions() {
  if (!board) return;

  // clear previous forbidden marks
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      board[i][j].forbidden = false;
    }
  }

  // Precise detection: sample the center (and optionally corners) of each cell
  // and use elementFromPoint to see if there's page text at that location.
  // This avoids coarse bbox-to-grid mapping and is more accurate for small text.
  const sampleOffsets = [
    { x: 0.5, y: 0.5 }, // center
    { x: 0.25, y: 0.25 }, // top-left quarter
    { x: 0.75, y: 0.25 }, // top-right quarter
    { x: 0.25, y: 0.75 }, // bottom-left quarter
    { x: 0.75, y: 0.75 }  // bottom-right quarter
  ];

  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const cell = board[i][j];
      const cellLeft = cell.x;
      const cellTop = cell.y;
      let forbidden = false;

      for (let s = 0; s < sampleOffsets.length; s++) {
        const off = sampleOffsets[s];
        const sx = Math.round(cellLeft + off.x * cell.w);
        const sy = Math.round(cellTop + off.y * cell.w);

        // elementFromPoint returns the topmost element at viewport coords
        const el = document.elementFromPoint(sx, sy);
        if (!el) continue;
        // if the element is inside .page and has visible text, mark forbidden
        const pageEl = el.closest && el.closest('.page');
        if (pageEl) {
          const text = (el.innerText || '').trim();
          if (text.length > 0) {
            forbidden = true;
            break;
          }
        }
      }

      cell.forbidden = forbidden;
    }
  }
}
