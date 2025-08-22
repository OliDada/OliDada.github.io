let grid;
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
    createCanvas(cols * w, rows * w);    if (gameWon) {
        fill(0, 200, 0, 200);
        rect(0, height / 2 - 40, width, 80);
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(40);
        text("You Win!", width / 2, height / 2);
    }
    canvas = document.querySelector('canvas');
    canvas.addEventListener('contextmenu', e => e.preventDefault());
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
