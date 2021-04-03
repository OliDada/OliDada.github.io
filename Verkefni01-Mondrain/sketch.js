// Hér kemur kóðinn þinn:

function setup() {
  createCanvas(600, 600);
  background(245);
  frameRate(4);
}

function draw() {
  strokeWeight(15)
  line(250, 0, 250, 700)
  line(0, 325, 600, 325)
  line(250, 575, 550, 575)
  line(420, 580, 420, 600)
  line(550, 335, 550, 600)
  strokeWeight(20)
  line(560, 450, 600, 450)
  fill(200, 0, 0) //rauður
  strokeWeight(0)
  rect(0, 320, 245, -325)
  fill(255, 210, 0) //gulur
  rect(258, 600, 155, -17)
  fill(25) //dökkgrár
  rect(425, 600, 120, -17)
  fill(0, 0, 165) //blár
  rect(558, 440, 45, -108)

}
