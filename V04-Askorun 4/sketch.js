// Hér kemur kóðinn þinn:
function setup() {
  createCanvas(400,400);
  background(255, 215, 0);
  colorMode(HSB);
  frameRate(2);
  strokeWeight(2);
}

function draw() {
  fill(random(0,180),75,100);
  for(var x = 100; x <= 300; x = x + 25){
    rect(x-10,190,20,20);
  }
  for(var x = 50; x <= 350; x = x + 25){
    fill(random(180,360),75,100);
    ellipse(x,150,20,20);
  }
  for(var x = 75; x <= 325; x = x + 25){
    fill(random(180,360),75,100);
    ellipse(x,250,20,20);
  }
}
