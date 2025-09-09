var snake;
var scl = 20;
var food;
let foodColor;
let hiscore = 0;


function setup() {
  let canvas = createCanvas(600, 600);
  canvas.parent('snake-canvas');
  snake = new Snake();
  frameRate(10);
  pickLocation();

  // Load hiscore from localStorage
  if (localStorage.getItem('snakeHiscore')) {
    hiscore = parseInt(localStorage.getItem('snakeHiscore'));
  }
}

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

  snake.death();
  snake.update();
  snake.show();

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
}

function keyPressed() {
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
