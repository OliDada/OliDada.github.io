// rules:
// 1. on, goes into a dying state
// 2. dying, goes into an off state
// 3. off, goes into an on state if it has exactly 2 neighbors that are on

const CELL_SIZE = 5;
const GRID_WIDTH = 160;
const GRID_HEIGHT = 80;

let grid;

function setup() {
  createCanvas(CELL_SIZE * GRID_WIDTH, CELL_SIZE * GRID_HEIGHT);
  grid = createEmptyGrid();
  // Initialize with a random state
  for (let x = 0; x < GRID_WIDTH; x++) {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      grid[x][y] = random() < 0.05 ? 'on' : 'off';
    }
  }
}

function draw() {
  background(220);
  
  // Draw the grid
  for (let x = 0; x < GRID_WIDTH; x++) {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      if (grid[x][y] === 'on') {
        fill(255, 0, 0);
      } else if (grid[x][y] === 'dying') {
        fill(255, 165, 0);
      } else {
        fill(200);
      }
      rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }
  
  // Update the grid based on the rules
  let newGrid = createEmptyGrid();
  for (let x = 0; x < GRID_WIDTH; x++) {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      let state = grid[x][y];
      let neighborsOn = countNeighbors(x, y);
      
      if (state === 'on') {
        newGrid[x][y] = 'dying';
      } else if (state === 'dying') {
        newGrid[x][y] = 'off';
      } else if (state === 'off' && neighborsOn === 2) {
        newGrid[x][y] = 'on';
      } else {
        newGrid[x][y] = state;
      }
    }
  }
  grid = newGrid;
}

function createEmptyGrid() {
  let arr = new Array(GRID_WIDTH);
  for (let i = 0; i < GRID_WIDTH; i++) {
    arr[i] = new Array(GRID_HEIGHT).fill('off');
  }
  return arr;
}

function countNeighbors(x, y) {
  let count = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue; // Skip the cell itself
      let nx = x + dx;
      let ny = y + dy;
      if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
        if (grid[nx][ny] === 'on') {
          count++;
        }
      }
    }
  }
  return count;
}

// Reset the grid to a new random state
function resetGrid() {
  grid = createEmptyGrid();
  for (let x = 0; x < GRID_WIDTH; x++) {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      grid[x][y] = random() < 0.1 ? 'on' : 'off';
    }
  }
}

// p5 key handler: press SPACE to reset the simulation
function keyPressed() {
  if (key === ' ' || keyCode === 32) {
    resetGrid();
    // prevent default browser behavior (scrolling)
    return false;
  }
}

// Also listen for native keydown in case p5 doesn't capture it inside an embed
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.keyCode === 32) {
    resetGrid();
    e.preventDefault();
  }
});