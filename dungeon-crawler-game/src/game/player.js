class Player {
    constructor(name, health, position) {
        this.name = name;
        this.health = health;
        this.position = position; // { x: number, y: number }
        this.inventory = [];
        this.speed = 5; // Lower speed for smoother movement
        this.size = this.calculatePlayerSize(); // Calculate size based on current level
        
        // Collision box adjustments to better match visual character
        this.collisionOffset = 8; // Pixels to shrink collision box from each edge
        this.collisionSize = this.size - (this.collisionOffset * 2); // Effective collision size
        
        // Animation properties
        this.walkCycle = [];
        this.currentFrame = 0;
        this.frameCounter = 0;
        this.frameDelay = 12; // How many game frames per animation frame
        this.isMoving = false;
        this.lastDirection = 'right'; // Default facing direction - start looking right
        this.imagesLoaded = false;
    }

    calculatePlayerSize() {
        const tileSize = window.tileSize || 32;
        if (tileSize === 16) { // Level 4
            return (tileSize - 1) * 2; // Keep current size for level 4 (30 pixels)
        } else { // Levels 1, 2, 3
            return tileSize - 1; // Normal size for other levels (31 pixels)
        }
    }

    updateSize() {
        // Update size based on current tile size and level
        this.size = this.calculatePlayerSize();
        this.collisionSize = this.size - (this.collisionOffset * 2);
    }

    loadWalkCycle() {
        // Only load images if p5.js is ready and images haven't been loaded yet
        if (typeof loadImage !== 'undefined' && !Player.walkImages) {
            Player.walkImages = [];
            Player.gunImages = [];
            
            // Load regular player sprites
            for (let i = 1; i <= 3; i++) {
                Player.walkImages.push(loadImage(`images/player${i}.png`));
            }
            
            // Load gun player sprites
            for (let i = 1; i <= 3; i++) {
                Player.gunImages.push(loadImage(`images/playerGun${i}.png`));
            }
            
            this.imagesLoaded = true;
        }
        
        if (Player.walkImages) {
            this.walkCycle = Player.walkImages;
        }
    }

    playerAnimation() {
        // Only animate when moving
        if (this.isMoving) {
            // If we just started moving and we're on the idle frame, immediately switch to walking
            if (this.currentFrame === 0) {
                this.currentFrame = 1; // Start with player2
                this.frameCounter = 0;
            } else {
                this.frameCounter++;
                
                // Change frame every frameDelay game frames
                if (this.frameCounter >= this.frameDelay) {
                    // Cycle between player2 (index 1) and player3 (index 2) for walking
                    if (this.currentFrame === 1) {
                        this.currentFrame = 2; // Switch to player3
                    } else {
                        this.currentFrame = 1; // Switch to player2
                    }
                    this.frameCounter = 0;
                }
            }
        } else {
            // When not moving, show player1.svg (index 0 - idle pose)
            this.currentFrame = 0;
            this.frameCounter = 0;
        }
    }

    render(inventory = null) {
        // Save current drawing state
        push();
        
        // Try to load images if they haven't been loaded yet
        if (!this.imagesLoaded && typeof loadImage !== 'undefined') {
            this.loadWalkCycle();
        }
        
        // Choose the appropriate sprite set based on gun possession
        let currentWalkCycle;
        if (inventory && inventory.hasGun && Player.gunImages) {
            currentWalkCycle = Player.gunImages;
        } else {
            currentWalkCycle = this.walkCycle;
        }
        
        // Draw the current animation frame
        if (currentWalkCycle && currentWalkCycle.length > 0 && currentWalkCycle[this.currentFrame]) {
            const img = currentWalkCycle[this.currentFrame];
            
            // Check if image is loaded
            if (img && img.width > 0) {
                // Force all images to display at exactly the same size
                // This ensures consistent appearance regardless of original dimensions
                const displayWidth = this.size * 2;   // 62 pixels
                const displayHeight = this.size * 2;  // 62 pixels
                
                // Handle directional facing
                push(); // Save state again for transformations
                
                if (this.lastDirection === 'left') {
                    // Flip horizontally for left movement
                    translate(this.position.x + displayWidth, this.position.y);
                    scale(-1, 1);
                    image(img, 0, 0, displayWidth, displayHeight);
                } else if (this.lastDirection === 'right') {
                    // Normal orientation for right movement
                    image(img, this.position.x, this.position.y, displayWidth, displayHeight);
                } else if (this.lastDirection === 'down') {
                    // Rotate 90 degreesa clockwise for down movement
                    translate(this.position.x + displayWidth, this.position.y);
                    rotate(HALF_PI);
                    image(img, 0, 0, displayWidth, displayHeight);
                } else if (this.lastDirection === 'up') {
                    // Rotate 90 degrees counter-clockwise for up movement
                    translate(this.position.x, this.position.y + displayHeight);
                    rotate(-HALF_PI);
                    image(img, 0, 0, displayWidth, displayHeight);
                } else {
                    // Default orientation
                    image(img, this.position.x, this.position.y, displayWidth, displayHeight);
                }

                pop(); // Restore transformation state
            } else {
                // Fallback: draw colored circle if images aren't loaded
                this.drawFallback();
            }
        } else {
            // Fallback: draw colored circle if no images
            this.drawFallback();
        }
        
        // Restore drawing state
        pop();
    }

    drawFallback() {
        fill(200, 100, 100);
        ellipseMode(CORNER);
        ellipse(this.position.x, this.position.y, this.size, this.size);
    }
    
    drawHitbox() {
        push();
        noFill();
        stroke(0, 255, 0); // Green color for player hitbox
        strokeWeight(2);
        
        // Draw the collision detection box
        const collisionSize = 50;
        const collisionOffset = (this.size * 2 - collisionSize) / 2;
        
        const collisionLeft = this.position.x + collisionOffset;
        const collisionTop = this.position.y + collisionOffset;
        
        rect(collisionLeft, collisionTop, collisionSize, collisionSize);
        
        // Draw center point
        fill(0, 255, 0);
        noStroke();
        const centerX = this.position.x + 31;
        const centerY = this.position.y + 31;
        ellipse(centerX - 2, centerY - 2, 4, 4);
        
        pop();
    }

    move(direction, map, inventory) {
        const tileSize = window.tileSize || 32; // Use dynamic tile size
        let dx = 0, dy = 0;

        // Set moving state and direction
        this.isMoving = true;
        this.lastDirection = direction;

        if (direction === 'left')  dx = -this.speed;
        if (direction === 'right') dx = this.speed;
        if (direction === 'up')    dy = -this.speed;
        if (direction === 'down')  dy = this.speed;

        let newX = this.position.x + dx;
        let newY = this.position.y + dy;

            // Use collision detection that matches the visual character size
            // Visual character is 62x62, so use a collision box that's closer to that
            const collisionSize = 50; // Slightly smaller than visual size for better feel
            const collisionOffset = (this.size * 2 - collisionSize) / 2; // Center the collision box
            
            const collisionLeft = newX + collisionOffset;                  
            const collisionRight = newX + collisionOffset + collisionSize - 1;
            const collisionTop = newY + collisionOffset;
            const collisionBottom = newY + collisionOffset + collisionSize - 1;

            // Check more points for better collision detection at wall ends
            const midX = collisionLeft + (collisionSize / 2);
            const midY = collisionTop + (collisionSize / 2);
            
            const collisionPoints = [
                // Four corners
                {x: collisionLeft, y: collisionTop},
                {x: collisionRight, y: collisionTop},
                {x: collisionLeft, y: collisionBottom},
                {x: collisionRight, y: collisionBottom},
                // Midpoints of edges
                {x: midX, y: collisionTop},        // Top middle
                {x: midX, y: collisionBottom},     // Bottom middle
                {x: collisionLeft, y: midY},       // Left middle
                {x: collisionRight, y: midY},      // Right middle
                // Center point
                {x: midX, y: midY}                 // Center
            ];

        let canMove = true;
        for (const point of collisionPoints) {
            const tileX = Math.floor(point.x / tileSize);
            const tileY = Math.floor(point.y / tileSize);

            if (map.isBlocked(tileX, tileY, inventory)) {
                canMove = false;
                break;
            }
        }

        if (canMove) {
            this.position.x = newX;
            this.position.y = newY;
        }
        
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        }
    }

    heal(amount) {
        this.health += amount;
    }

    die() {
        console.log(`${this.name} has died.`);
    }

    addItem(item) {
        this.inventory.push(item);
    }

    useItem(itemName) {
        const itemIndex = this.inventory.findIndex(item => item.name === itemName);
        if (itemIndex > -1) {
            const item = this.inventory[itemIndex];
            item.effect(this);
            this.inventory.splice(itemIndex, 1);
        } else {
            console.log(`Item ${itemName} not found in inventory.`);
        }
    }

    stopMoving() {
        this.isMoving = false;
    }
}

// Static property to store loaded walk cycle images
Player.walkImages = null;

