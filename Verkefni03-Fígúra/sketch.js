// Hér kemur kóðinn þinn:

var bukur = 100;
var augu = 25;
var augubreidd = 10;
var hendur = 40;
var munnur = 20;
var fætur = 50;
var litur = 200;
var andlitslitur = 100;
var fæturhalli = 20;
function setup() {
  createCanvas(350,550);
  rectMode(CENTER);
}
function draw() {
  background(200,100,0);
  // Teiknum búkinn
  colorMode(HSB)
  fill(litur,150,100);
  rect(mouseX,mouseY,50,bukur,10);
  // Teiknum hendurnar
  line (mouseX + hendur, mouseY + bukur/3 + 20, mouseX + 20, mouseY + bukur/2 - 50);
  line (mouseX - hendur, mouseY + bukur/3 + 20, mouseX - 20, mouseY + bukur/2 - 50);
  // Teiknum hausinn
  fill(40,50,andlitslitur);
  ellipse(mouseX,mouseY - bukur/2, 80,80);
  // Teiknum munn
  noFill();
  arc(mouseX, mouseY - bukur/2 + 20, munnur + 20, munnur, 0, PI);
  // Teiknum augun
  fill(230);
  ellipse (mouseX - 25,mouseY - bukur/2, augubreidd,augu);
  ellipse (mouseX + 25,mouseY - bukur/2, augubreidd,augu);
  fill(40);
  ellipse (mouseX - 25,mouseY - bukur/2, 5, 5);
  ellipse (mouseX + 25,mouseY - bukur/2, 5, 5);
  // Teiknum fæturna
  line (mouseX - 20, mouseY + bukur/2, mouseX - fæturhalli, mouseY + bukur/2 + fætur);
  line (mouseX + 20, mouseY + bukur/2, mouseX + fæturhalli, mouseY + bukur/2 + fætur);


}

function mousePressed() {
	bukur = random (50,150);
  augu = random (10,35);
  augubreidd = random (5,30);
  hendur = random (-30,50);
  munnur = random (-30,35);
  fætur = random (30,60);
  fæturhalli = (15,30);
  litur = random (1,360);
  andlitslitur = random (40,100);
}
