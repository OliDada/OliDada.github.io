let grid;
let canvas;
let rows = 10;
let cols = 10;
let w = 40;
let totalMines = 15;
let gameOver = false;
let gameWon = false;

function make2DArray(rows, cols) {
    let arr = new Array(rows);
    for (let i = 0; i < rows; i++) {
        arr[i] = new Array(cols);
    }
    return arr;
}

class Cell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.isMine = false;
        this.isRevealed = false;
        this.isFlagged = false;
        this.neighboringMines = 0;
    }

    show() {
        stroke(0);
        noFill();
        rect(this.x * w, this.y * w, w, w);
        if (this.isRevealed) {
            if (this.isMine) {
                fill(255, 0, 0);
                ellipse(this.x * w + w / 2, this.y * w + w / 2, w / 2);
            } else {
                fill(200);
                rect(this.x * w, this.y * w, w, w);
                if (this.neighboringMines > 0) {
                    fill(0);
                    textAlign(CENTER, CENTER);
                    textSize(20);
                    text(this.neighboringMines, this.x * w + w / 2, this.y * w + w / 2);
                }
            }
        } else if (this.isFlagged) {
            fill(255, 0, 0);
            triangle(
                this.x * w + w * 0.2, this.y * w + w * 0.8,
                this.x * w + w * 0.8, this.y * w + w * 0.5,
                this.x * w + w * 0.2, this.y * w + w * 0.2
            );
        }
    }

    contains(x, y) {
        return (x > this.x * w && x < (this.x + 1) * w &&
                y > this.y * w && y < (this.y + 1) * w);
    }

    reveal() {
        if (this.isFlagged) return;
        this.isRevealed = true;
        if (this.neighboringMines === 0 && !this.isMine) {
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    let nx = this.x + j;
                    let ny = this.y + i;
                    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                        let neighbor = grid[ny][nx];
                        if (!neighbor.isRevealed) {
                            neighbor.reveal();
                        }
                    }
                }
            }
        }
    }
}

function flagCell(x, y) {
    let cell = grid[y][x];
    if (!cell.isRevealed) {
        cell.isFlagged = !cell.isFlagged;
    }
}

function resetGame() {
    gameOver = false;
    gameWon = false;
    grid = make2DArray(rows, cols);
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            grid[i][j] = new Cell(j, i);
        }
    }
    let options = [];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            options.push([i, j]);
        }
    }
    for (let n = 0; n < totalMines; n++) {
        let idx = floor(random(options.length));
        let choice = options.splice(idx, 1)[0];
        let i = choice[0];
        let j = choice[1];
        grid[i][j].isMine = true;
    }
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            let count = 0;
            for (let yoff = -1; yoff <= 1; yoff++) {
                for (let xoff = -1; xoff <= 1; xoff++) {
                    let ni = i + yoff;
                    let nj = j + xoff;
                    if (ni >= 0 && ni < rows && nj >= 0 && nj < cols) {
                        if (grid[ni][nj].isMine) count++;
                    }
                }
            }
            if (grid[i][j].isMine) {
                grid[i][j].neighboringMines = -1;
            } else {
                grid[i][j].neighboringMines = count;
            }
        }
    }
}

function setup() {
    // create the p5 canvas and attach it into the #game container when embedded
    const p5canvas = createCanvas(cols * w, rows * w);

    // If opened as an embed (parent adds ?embed=1), remove surrounding chrome and attach canvas
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('embed') === '1') {
            // attach p5 element into the #game div so it's at the top of the iframe
            try { p5canvas.parent('game'); } catch (e) {}
            // remove default document margins and hide header content so the canvas is visible immediately
            try { document.body.style.margin = '0'; } catch (e) {}
            try { const h = document.querySelector('h1'); if (h) h.style.display = 'none'; } catch (e) {}
            try { const s = document.querySelector('h3'); if (s) s.style.display = 'none'; } catch (e) {}
            try { const b = document.querySelector('button'); if (b) b.style.display = 'none'; } catch (e) {}
        }
    } catch (e) {}

    // grab underlying DOM element for direct event wiring
    try { canvas = p5canvas.elt; } catch (e) { canvas = document.querySelector('canvas'); }
    try { canvas.addEventListener('contextmenu', e => e.preventDefault()); } catch (e) {}
    resetGame();
}

function draw() {
    background(220);
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            grid[i][j].show();
        }
    }
    if (gameOver) {
        fill(255, 0, 0, 200);
        rect(0, height / 2 - 40, width, 80);
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(40);
        text("Game Over!", width / 2, height / 2);
    }
    if (gameWon) {
        fill(0, 200, 0, 200);
        rect(0, height / 2 - 40, width, 80);
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(40);
        text("You Win!", width / 2, height / 2);
    }
}

function mousePressed() {
    if (gameOver || gameWon) return;
    if (mouseButton === LEFT) {
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (grid[i][j].contains(mouseX, mouseY)) {
                    grid[i][j].reveal();
                    if (grid[i][j].isMine) {
                        // Game over: reveal all
                        for (let y = 0; y < rows; y++) {
                            for (let x = 0; x < cols; x++) {
                                grid[y][x].isRevealed = true;
                            }
                        }
                        gameOver = true;
                    } else {
                        checkWin();
                    }
                }
            }
        }
    }
    if (mouseButton === RIGHT) {
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (grid[i][j].contains(mouseX, mouseY)) {
                    flagCell(j, i);
                    checkWin();
                }
            }
        }
    }
}

function checkWin() {
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            let cell = grid[i][j];
            if (!cell.isMine && !cell.isRevealed) {
                return;
            }
        }
    }
    gameWon = true;
    // Optionally, reveal all cells
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            grid[i][j].isRevealed = true;
        }
    }
}
