// Hér kemur kóðinn þinn:
var stepSize = 20

function setup() {
  createCanvas(400,400);
  background(255, 215, 0);
  colorMode(HSB);
  frameRate(2);
  strokeWeight(2);
}

function draw(){
  for(var i = 0; i < 20 ; i = i + 1) {
  fill(random(180,360),75,100);
  for(var y = 10; y < width; y = y + stepSize) {
  ellipse(10+ i*20, y , 15, 15);

    }
  }
}
  
