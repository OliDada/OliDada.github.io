var bird;
var pipes = [];
var score = 0;
let birdImg, pipeImg;

function preload() {
  birdImg = loadImage('bird.png');
  pipeImg = loadImage('pipe.png');
  backgroundImg = loadImage('flappybirdbackground.png');
  groundImg = loadImage('ground.png');
}

function setup() {
    createCanvas(400, 400);
    bird = new Bird();
    pipes.push(new Pipe());
}

function draw() {
    background(backgroundImg);
    bird.show();
    bird.update();

    // Add a new pipe every 75 frames
    if (frameCount % 75 === 0) {
        pipes.push(new Pipe());
    }

    for (var i = 0; i < pipes.length; i++) {
        pipes[i].show();
        pipes[i].update();

        // Check for collision
        if (pipes[i].hits(bird)) {
            console.log("HIT!");
            textSize(32);
            fill(255);
            text("Game Over", width / 2 - 75, height / 2 - 75);
            noLoop(); // Stop the game if bird hits a pipe
        }

        // Check if bird passed the pipe
        if (!pipes[i].passed && pipes[i].x + pipes[i].w < bird.x) {
            pipes[i].passed = true;
            score++;
        }

        // Remove offscreen pipes
        if (pipes[i].offscreen()) {
            pipes.splice(i, 1);
            i--;
        }
    }

    // Display score
    fill(255);
    textSize(32);
    textAlign(LEFT, TOP);
    text('Score: ' + score, 10, 10);
}

function keyPressed() {
    if (key === ' ') {
        bird.up();
    }
}