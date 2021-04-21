// Hér kemur kóðinn þinn:
var boltiX = 100;
var boltiY = 100;
var hradiX = 5;
var hradiY = -6;
var boltiStaerd = 20;
var stig = 0;
var spadiBreidd = 150;
var spadiThykkt = 25;
var spadiY;

function setup() {
	createCanvas(400,500);
	spadiY = height - 45;
	rectMode(CENTER);
	textFont("Courier New",16);
	textStyle(BOLD);
	colorMode(HSB);
}

function draw() {
  background(255,200,0);
	// Reikna ný hnit út frá hraða boltans:
  boltiX = boltiX + hradiX;
  boltiY = boltiY + hradiY;
	// Athuga hvort boltinn snertir vegginn:
  if ((boltiX > width-boltiStaerd/2)||(boltiX < 0))  {
    hradiX = hradiX * -1;
  }
  	// Athuga hvort boltinn snertir þakið
  if ((boltiY < boltiStaerd)) {
    hradiY = hradiY * -1;
  }
  if((boltiY > spadiY - boltiStaerd/2)&&
     (boltiY < spadiY + boltiStaerd/2)&&
     (boltiX + boltiStaerd/2 > mouseX - spadiBreidd/2)&&
     (boltiX - boltiStaerd/2 < mouseX + spadiBreidd/2)) {
    hradiY = hradiY * -1;
    stig = stig + 1
  }
	for(var x = 25; x < width; kassiBreidd = x+45) {
		for(var y = 25; y < width/3; y = y+45) {
			fill(100,75,100)
			rect(x,y)
	// Teikna boltann
  fill(10,100,94);
  rect(boltiX, boltiY, boltiStaerd, boltiStaerd);
	// Teikna spaðann
  fill(3,123,227);
  rect(mouseX,spadiY ,spadiBreidd,spadiThykkt);
  fill (0);
  ellipse(mouseX, spadiY, 10,10);
	// Teikna stigin
  fill(0);
  text("Stig: " + stig,10,20);
  }
 }
}
