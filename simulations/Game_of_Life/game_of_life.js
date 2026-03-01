function make2DArray(rows, cols) {
    let arr = new Array(cols); // top-level = cols (x)
    for (let i = 0; i < cols; i++) {
        arr[i] = new Array(rows); // inner = rows (y)
    }
    return arr;
}

let grid;
let cols;
let rows;
let resolution = 10;

let originalWidth = 800;
let originalHeight = 400;

function setup() {
    let canvas = createCanvas(originalWidth, originalHeight);
        const _gofParent = document.getElementById('gameoflife-canvas');
        if (_gofParent) canvas.parent(_gofParent); else canvas.parent(document.body);
    frameRate(20);
    cols = Math.floor(width / resolution);
    rows = Math.floor(height / resolution);
    grid = make2DArray(rows, cols);
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            grid[i][j] = Math.floor(Math.random() * 2);
        }
    }
}

function draw() {
    background(0);
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            fill(grid[i][j] === 1 ? 255 : 0);
            stroke(50);
            rect(i * resolution, j * resolution, resolution, resolution);
        }
    }

    let nextGrid = make2DArray(rows, cols);
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let state = grid[i][j];
            let neighbors = countNeighbors(i, j);

            // Conway's rules
            if (state === 1 && (neighbors < 2 || neighbors > 3)) {
                nextGrid[i][j] = 0;
            } else if (state === 0 && neighbors === 3) {
                nextGrid[i][j] = 1;
            } else {
                nextGrid[i][j] = state;
            }
        }
    }
    grid = nextGrid;
}

function countNeighbors(x, y) {
    let sum = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            let col = (x + i + cols) % cols;
            let row = (y + j + rows) % rows;
            sum += grid[col][row];
        }
    }
    return sum;
}

function clickToCreateLife() {
    let x = Math.floor(mouseX / resolution);
    let y = Math.floor(mouseY / resolution);
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
        grid[x][y] = (grid[x][y] + 1) % 2;
    }
}

function mousePressed() {
    if (mouseButton === LEFT) clickToCreateLife();
}

function mouseDragged() {
    if (mouseButton === LEFT) clickToCreateLife();
}

function keyPressed(event) {
    if (key === ' ') {
        if (event) event.preventDefault();
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                grid[i][j] = Math.floor(Math.random() * 2);
            }
        }
    }
}

function windowResized() {
    const navbar = document.querySelector('.navbar');
    let w = fullscreen() ? windowWidth : originalWidth;
    let h = fullscreen() ? windowHeight : originalHeight;

    resizeCanvas(w, h);
    if (fullscreen() && navbar) navbar.style.display = 'none';
    else if (navbar) navbar.style.display = '';

    cols = Math.floor(width / resolution);
    rows = Math.floor(height / resolution);

    // Resize grid while preserving state
    let newGrid = make2DArray(rows, cols);
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            newGrid[i][j] = (grid && grid[i] && grid[i][j] !== undefined) 
                ? grid[i][j] 
                : Math.floor(Math.random() * 2);
        }
    }
    grid = newGrid;
}

function toggleFullScreen() {
    fullscreen(!fullscreen());
}

function fillBrowser() {
    const header = document.querySelector('.header');
    const navbar = document.querySelector('.navbar');
    const backBtn = document.getElementById('back-btn');
    if (header) header.style.display = 'none';
    if (navbar) navbar.style.display = 'none';
    if (backBtn) backBtn.style.display = '';

    resizeCanvas(window.innerWidth, window.innerHeight);
    cols = Math.floor(width / resolution);
    rows = Math.floor(height / resolution);

    let newGrid = make2DArray(rows, cols);
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            newGrid[i][j] = (grid && grid[i] && grid[i][j] !== undefined)
                ? grid[i][j]
                : Math.floor(Math.random() * 2);
        }
    }
    grid = newGrid;
}

function restoreLayout() {
    const header = document.querySelector('.header');
    const navbar = document.querySelector('.navbar');
    const backBtn = document.getElementById('back-btn');
    if (header) header.style.display = '';
    if (navbar) navbar.style.display = '';
    if (backBtn) backBtn.style.display = 'none';
    cols = Math.floor(width / resolution);
    rows = Math.floor(height / resolution);
    resizeCanvas(width, rows * resolution);
}

function clearGrid() {
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            grid[i][j] = 0;
        }
    }
}

function goBack() {
    window.location.href = "index.html";
}
