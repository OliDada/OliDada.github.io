class Debris {


  constructor() {
    this.r = 5;
    this.resetDebris();
  }

  resetDebris() {

    this.y = random(height - 70);

    let spawnLeftSide = random(1) &lt; 0.5;

    if (spawnLeftSide) {
        this.x = random(-width, 0);
        this.isGoingLeft = false;
    } else {
        this.x = random(width, width * 2);
      this.isGoingLeft = true;
    }


  }

  update() {
    if (this.isGoingLeft) {
        this.x --;
    } else {
        this.x ++;
    }

    if (this.isOffScreen()) {
        this.resetDebris();
    }
  }


  isOffScreen() {
    if (this.isGoingLeft &amp;&amp; this.x &lt; -5) {
        return true;
    } else if(!this.isGoingLeft &amp;&amp; this.x &gt; width + 5) {
        return true;
    }
    return false;
  }

  display() {
    ellipse(this.x, this.y, this.r * 2, this.r * 2);
  }

  hasHitShip(ship) {
    if (dist(this.x, this.y, ship.x, ship.y) &lt; this.r + ship.r) {
        return true;
    }
    return false
  }

}
