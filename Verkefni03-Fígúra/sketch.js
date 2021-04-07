// Hér kemur kóðinn þinn:

var bukur = 100;

function setup() {
  createCanvas(350,550);
  rectMode(CENTER);
}
function draw() {
  background(255,200,0);
  // Teiknum búkinn
  fill(236,36,94);
  rect(mouseX,mouseY,40,bukur);
  // Teiknum hausinn
  fill(255);
  ellipse(mouseX,mouseY - bukur/2, 80,80);
  // Teiknum augun
  fill(100);
  ellipse (mouseX - 25,mouseY - bukur/2, 20,40);
  ellipse (mouseX + 25,mouseY - bukur/2, 20,40);
  // Teiknum fæturna
  line (mouseX - 20, mouseY + bukur/2, mouseX - 20, mouseY + bukur/2 + 50);
  line (mouseX + 20, mouseY + bukur/2, mouseX + 20, mouseY + bukur/2 + 50);
}

function mousePressed() {
	bukur = random (50,150);
}
