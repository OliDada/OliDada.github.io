// Hér kemur kóðinn þinn:

var bukur = 100;
var augu = 25;
var augubreidd = 10;
var hendur = 40;
var munnur = 20;

function setup() {
  createCanvas(350,550);
  rectMode(CENTER);
}
function draw() {
  background(255,200,0);
  // Teiknum búkinn
  fill(36,200,120);
  rect(mouseX,mouseY,50,bukur);
  // Teiknum hendurnar
  line (mouseX + hendur, mouseY + bukur/3 + 20, mouseX + 20, mouseY + bukur/2 - 50);
  line (mouseX - hendur, mouseY + bukur/3 + 20, mouseX - 20, mouseY + bukur/2 - 50);
  // Teiknum hausinn
  fill(230,200,200);
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
  line (mouseX - 20, mouseY + bukur/2, mouseX - 20, mouseY + bukur/2 + 50);
  line (mouseX + 20, mouseY + bukur/2, mouseX + 20, mouseY + bukur/2 + 50);


}

function mousePressed() {
	bukur = random (50,150);
    augu = random (10,35);
    augubreidd = random (5,25);
    hendur = random (-40,50);
    munnur = random (-30,40);

}
