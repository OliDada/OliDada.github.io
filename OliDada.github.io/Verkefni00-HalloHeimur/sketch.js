// Hér kemur kóðinn þinn:

function setup() {
  createCanvas(1000, 800);
  frameRate(4);
}

function draw() {
  fill(random(0,255));
  ellipse(400,200,100,100);
  fill(random(0,255));
  ellipse(500,600,150,250);
  fill(random(0,255));
  rect(100,300,60,50);
  fill(random(0,255));
  rect(800,500,80,100);
  textSize(40)
  text("Halló heimur!",700,200);
  textSize(20)
  text("(Ekki ætlað flogaveikum)",100,650);


  function random_bg_color() {
    frameRate(3);
    var x = Math.floor(Math.random() * 256);
    var y = Math.floor(Math.random() * 256);
    var z = Math.floor(Math.random() * 256);
    var bgColor = "rgb(" + x + "," + y + "," + z + ")";
 console.log(bgColor);

    document.body.style.background = bgColor;
}

random_bg_color();

}
