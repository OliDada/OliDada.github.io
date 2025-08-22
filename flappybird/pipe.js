

function Pipe() {
    var minGap = 90;
    var maxGap = 160;
    var gap = random(minGap, maxGap);
    var gapY = random(40, height - 40 - gap); // Ensure gap is not too close to top/bottom
    this.top = gapY;
    this.bottom = height - gapY - gap;
    this.x = width;
    this.w = 30;
    this.speed = 2.5;
    this.passed = false; // Track if bird has passed this pipe

    this.hits = function(bird) {
        if (bird.y < this.top || bird.y > height - this.bottom) {
            if (bird.x > this.x - bird.radius && bird.x < this.x + this.w) {
                return true;
            }
        }
        return false;
    }

    this.show = function() {
        // Draw top pipe (flipped vertically)
        push();
        translate(this.x, this.top);
        scale(1, -1);
        image(pipeImg, 0, 0, this.w, this.top);
        pop();

        // Draw bottom pipe (normal)
        image(pipeImg,  this.x, height - this.bottom, this.w, this.bottom);
    }

    this.update = function() {
        this.x -= this.speed;
    }

    this.offscreen = function() {
        return this.x < -this.w;
    }
}