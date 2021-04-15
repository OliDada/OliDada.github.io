// Hér kemur kóðinn þinn:
var i;

function setup() {
  createCanvas(500,500);
  background(255, 215, 0);
  colorMode(HSB);
  frameRate(2);
  strokeWeight(2);
}

function draw() {
  for(var x = 10; x < width; x = x + 10){
  for(var y = 10; y < heigth; y = y + 10){
    i = int(random(0,10))
    rect(i,x,y)
