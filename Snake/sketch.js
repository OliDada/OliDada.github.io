var snake;
var scl = 20;
var food;
let foodColor;
let hiscore = 0;


function setup() {
  // Use a fixed native game size so the Snake game always runs at 600x600
  const nativeSize = 600;
  let canvas = createCanvas(nativeSize, nativeSize);
  // Safely parent the canvas: if the host page provides a container with id
  // 'snake-canvas' use it, otherwise fall back to attaching the canvas to
  // document.body. This avoids p5 trying to append to a null element which
  // throws `appendChild` errors when embedded in other pages.
  const parentEl = document.getElementById('snake-canvas');
  if (parentEl) {
    canvas.parent(parentEl);
  } else {
    canvas.parent(document.body);
  }
  snake = new Snake();
  frameRate(10);
  pickLocation();

  // Load hiscore from localStorage
  if (localStorage.getItem('snakeHiscore')) {
    hiscore = parseInt(localStorage.getItem('snakeHiscore'));
  }
}

// Keep the canvas at fixed native size; do not resize on window changes.

function pickLocation() {
  var cols = floor(width/scl);
  var rows = floor(height/scl);
  food = createVector(floor(random(cols)), floor(random(rows)));
  food.mult(scl);
  foodColor = color(random(100, 255), random(0, 50), random(50, 200));
}

function score() {
  let score = snake.tail.length;
  if (score > hiscore) {
    hiscore = score;
    localStorage.setItem('snakeHiscore', hiscore);
  }
  fill(255);
  textSize(32);
  textFont('Press Start 2P');
  textAlign(CENTER);
  if (hiscore) {
    text("Hi-Score: " + hiscore, 300, 60);
  }
  text("Score: " + score, 300, 30);
}

function draw() {
  background(51);

  if (!gameOver) {
    snake.death();
    if (!gameOver) snake.update();
  }
  if (!gameOver) snake.show();

  if (snake.eat(food)) {
    pickLocation();
  }

  fill(foodColor);
  rect(food.x, food.y, scl, scl);

  score();

  // Red flash overlay on death
  if (flashTimer > 0) {
    let alpha = map(flashTimer, 10, 0, 180, 0); // Fade out
    fill(255, 0, 0, alpha);
    noStroke();
    rect(0, 0, width, height);
    flashTimer--;
  }

  if (gameOver) drawGameOver();
}

// Game over screen: your score, and how to go again
function drawGameOver() {
  noStroke();
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  textFont('Press Start 2P');
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(30);
  text("Game over", width / 2, height / 2 - 50);
  fill(220);
  textSize(16);
  text("Score: " + lastScore, width / 2, height / 2 + 4);
  if (hiscore) { fill(150); textSize(12); text("Best: " + hiscore, width / 2, height / 2 + 32); }
  const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  fill(255, 225, 120);
  textSize(12);
  text(touch ? "Tap to play again" : "Press Space to play again", width / 2, height / 2 + 84);
}

function retry() {
  if (!gameOver) return;
  gameOver = false;
  snake.x = 0;
  snake.y = 0;
  snake.total = 0;
  snake.tail = [];
  snake.dir(1, 0);
  pickLocation();
}

function mousePressed() {
  retry();
}

// website: swipe to steer on phones, without the page scrolling under your finger
let swipeFrom = null;
function touchStarted() {
  if (gameOver) { retry(); return false; }
  if (touches.length) swipeFrom = { x: touches[0].x, y: touches[0].y };
  return false;
}
function touchMoved() {
  if (swipeFrom && touches.length) {
    const dx = touches[0].x - swipeFrom.x, dy = touches[0].y - swipeFrom.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) {
      const [x, y] = Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1];
      if (!(snake.tail.length && x === -snake.xspeed && y === -snake.yspeed)) snake.dir(x, y); // no turning back into yourself
      swipeFrom = { x: touches[0].x, y: touches[0].y };
    }
  }
  return false;
}
function touchEnded() { swipeFrom = null; return false; }

function keyPressed() {
  if (gameOver) {
    if (key === ' ' || keyCode === ENTER || keyCode === 32) retry();
    return false;
  }
  if (keyCode === UP_ARROW) {
    snake.dir(0, -1);
  } else if (keyCode === DOWN_ARROW) {
    snake.dir(0, 1);
  } else if (keyCode === RIGHT_ARROW) {
    snake.dir(1, 0);
  } else if (keyCode === LEFT_ARROW) {
    snake.dir(-1, 0);
  }
  // Prevent arrow keys from scrolling the page
  if ([UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW].includes(keyCode)) {
    return false;
  }
}
