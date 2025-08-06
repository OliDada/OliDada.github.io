class Ship {

  constructor(x) {
    this.x = x;
    this.score = 0;
    this.respawn();
    this.r = 10;
  }

  respawn() {
    this.y = height - 20;
    this.isUp = false;
    this.isDown = false;
  }

  update() {
    if (this.isUp &amp;&amp; this.y &gt; 0) {
      this.up();
    } else if (this.isDown &amp;&amp; this.y &lt; height - 20) {
      this.down();
    }

    if (this.hasPlayerScoredAPoint()) {
      this.score ++;
      this.respawn();
    }
  }

  display() {
    ellipse(this.x, this.y, this.r * 2, this.r * 2);
  }


  up() {
    this.y--;
  }

  down() {
   this.y++;
  }

  hasPlayerScoredAPoint() {
    if (this.y &lt;= 0) {
      return true;
    }
    return false;
  }
}
