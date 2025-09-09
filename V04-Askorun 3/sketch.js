// Hér kemur kóðinn þinn:
var fjöldi = 1

function setup() {
  createCanvas(400,400);
  fill(255,0,100);
  frameRate(2);
  strokeWeight(2);
}

function draw() {
  background(255, 215, 0);
  for(var y = 20; y < height; y = y + 30){
  fjoldi = random (0,13);
  for(var i = 0; i < fjoldi; i++)
  ellipse(15 + i*30,y,10,10);

  }
}
