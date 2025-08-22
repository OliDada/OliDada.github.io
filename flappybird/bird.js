function Bird() {
    this.y = height/2;
    this.x = 64;
    this.radius = 16;

    this.lift = -15;
    this.gravity = 0.6;
    this.velocity = 0;

    this.show = function() {
        image(birdImg, this.x, this.y, this.radius * 2, this.radius * 2);
    }

    this.up = function() {
        this.velocity += this.lift;
    }

    this.update = function() {
        this.velocity += this.gravity;
        this.velocity *= 0.9; // Damping
        this.y += this.velocity;

        if (this.y > height - this.radius) {
            this.y = height - this.radius;
            this.velocity = 0;
        }
    }
}