class Enemy {
    constructor(name, health, damage, position) {
        this.name = name;
        this.health = health;
        this.damage = damage;
        this.position = position; // { x: number, y: number }
    }

    move(newPosition) {
        this.position = newPosition;
    }

    attack(target) {
        if (target.health > 0) {
            target.health -= this.damage;
            console.log(`${this.name} attacks ${target.name} for ${this.damage} damage!`);
        } else {
            console.log(`${target.name} has already been defeated.`);
        }
    }

    isAlive() {
        return this.health > 0;
    }
}


class Snake extends Enemy {
    constructor(position, level = 1) {
        super("Snake", 30, 5, position);
        
        // Movement properties - different ranges for different levels
        if (level === 4) {
            // Level 4: Wider movement range for the bigger level
            this.minX = 1;
            this.maxX = 5;
            this.moveSpeed = 0.06; // How fast the snake moves (tiles per frame)
        } else if (level === 2) {
            // Level 2: Original movement range
            this.minX = 8;
            this.maxX = 16;
            this.moveSpeed = 0.08; // How fast the snake moves (tiles per frame)
        } else {
            // Default range for other levels
            this.minX = 8;
            this.maxX = 16;
            this.moveSpeed = 0.08; // How fast the snake moves (tiles per frame)
        }
        
        this.direction = 1; // 1 for moving right, -1 for moving left
        
        // Rectangular Hitbox properties - CHANGE THESE VALUES TO ADJUST HITBOX
        this.hitboxWidth = 67;    // Width of hitbox in pixels
        this.hitboxHeight = 42;   // Height of hitbox in pixels
        this.hitboxOffsetX = 18;   // X offset from snake center (-16 to +16)
        this.hitboxOffsetY = 20;   // Y offset from snake center (-16 to +16)
        
        // Load snake image if not already loaded
        if (!Snake.snakeImage) {
            Snake.snakeImage = loadImage('images/snake.png');
        }
    }

    getHitboxRadius() {
        return this.hitboxRadius;
    }

    getHitboxBounds() {
        const centerX = this.position.x * 32 + 16;
        const centerY = this.position.y * 32 + 16;
        
        // Adjust hitbox offset based on direction (snake head position)
        let directionOffsetX = this.hitboxOffsetX;
        
        if (this.direction === 1) {
            // Moving right - hitbox towards the right (head position)
            directionOffsetX -= 15;
        } else {
            // Moving left - hitbox towards the left (head position) 
            directionOffsetX += 15;
        }
        
        return {
            left: centerX - this.hitboxWidth/2 + directionOffsetX,
            right: centerX + this.hitboxWidth/2 + directionOffsetX,
            top: centerY - this.hitboxHeight/2 + this.hitboxOffsetY,
            bottom: centerY + this.hitboxHeight/2 + this.hitboxOffsetY
        };
    }

    drawSnake() {
        // Draw the snake PNG image
        if (Snake.snakeImage && Snake.snakeImage.width > 0) {
            const x = this.position.x * 32;
            const y = this.position.y * 32;
            
            // Calculate aspect ratio and fit within tile while maintaining proportions
            const imageRatio = Snake.snakeImage.width / Snake.snakeImage.height;
            let drawWidth, drawHeight;
            
            if (imageRatio > 1) {
                // Image is wider than tall - fit to width
                drawWidth = 32;
                drawHeight = 32 / imageRatio;
            } else {
                // Image is taller than wide - fit to height
                drawHeight = 32;
                drawWidth = 32 * imageRatio;
            }
            
            // Center the image within the tile
            const offsetX = (32 - drawWidth) / 2;
            const offsetY = (32 - drawHeight) / 2;
            
            // Save the current transformation matrix
            push();
            
            // If moving left (direction = -1), flip the image horizontally
            if (this.direction === 1) {
                // Translate to the center of where we want to draw
                translate(x + offsetX + (drawWidth * 2.5) / 2, y + offsetY + (drawHeight * 2.5) / 2);
                // Scale horizontally by -1 to flip
                scale(-1, 1);
                // Draw centered at origin (0, 0) since we translated
                image(Snake.snakeImage, -(drawWidth * 2.5) / 2, -(drawHeight * 2.5) / 2, drawWidth * 3, drawHeight * 3);
            } else {
                // Moving right (direction = 1), draw normally
                image(Snake.snakeImage, x + offsetX, y + offsetY, drawWidth * 3, drawHeight * 3);
            }
            
            // Restore the transformation matrix
            pop();
        } else {
            // Fallback: simple green circle if image fails to load
            fill(0, 200, 0);
            noStroke();
            ellipse(this.position.x * 32 + 16, this.position.y * 32 + 16, 32, 32);
        }
    }

    snakeMovement() {
        // Move the snake back and forth between minX and maxX
        this.position.x += this.direction * this.moveSpeed;
        
        // Check boundaries and reverse direction if needed
        if (this.position.x >= this.maxX) {
            this.position.x = this.maxX;
            this.direction = -1; // Start moving left
        } else if (this.position.x <= this.minX) {
            this.position.x = this.minX;
            this.direction = 1; // Start moving right
        }
    }

    drawHitbox() {
        if (debugMode) {
            push();
            stroke(255, 0, 0);
            strokeWeight(2);
            noFill();
            
            // Draw rectangular hitbox that matches the actual collision detection
            const bounds = this.getHitboxBounds();
            rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
            
            pop();
        }
    }
}

class Ghost extends Enemy {
    constructor(startPosition, endPosition) {
        super("Ghost", 20, 8, startPosition);
        
        // Simple path properties
        this.startPosition = { ...startPosition };
        this.endPosition = endPosition;
        this.moveSpeed1 = 0.08; // Slow speed
        this.moveSpeed2 = 0.10; // Medium speed
        this.moveSpeed3 = 0.2 // Fast speed
        this.moveSpeed4 = 0.4 // Very fast speed
        this.hasDisappeared = false;
        
        // Movement state tracking - start with idle
        this.movementState = 'idle';
        this.idleTimer = 0;
        this.idleDuration = 60; // 2 seconds at 60fps (120 frames)
        
        // Circular Hitbox properties
        this.hitboxRadius = 58; // Radius of hitbox in pixels
        
        // Load ghost image if not already loaded
        if (!Ghost.ghostImage) {
            Ghost.ghostImage = loadImage('images/ghostIdle.svg');
        }
    }

    getHitboxRadius() {
        return this.hitboxRadius;
    }

    // Override isAlive to use hasDisappeared instead of health
    isAlive() {
        return !this.hasDisappeared;
    }

    ghostMovement() {
        if (this.hasDisappeared) return;

        switch (this.movementState) {
            case 'idle':
                this.idleTimer++;
                if (this.idleTimer >= this.idleDuration) {
                    this.movementState = 'movingUp';
                }
                break;
                
            case 'movingUp':
                if (this.position.y > 3.1) {
                    this.position.y -= this.moveSpeed2; // Medium speed
                } else {
                    this.movementState = 'movingLeft';
                }
                break;
                
            case 'movingLeft':
                if (this.position.x > 1.4) {
                    this.position.x -= this.moveSpeed2; // Medium speed
                } else {
                    this.movementState = 'movingRight';
                }
                break;
                
            case 'movingRight':
                if (this.position.x < 10.8) {
                    this.position.x += this.moveSpeed3; // Medium speed
                } else {
                    this.movementState = 'movingDown';
                }
                break;

            case 'movingDown':
                if (this.position.y < 6.9) {
                    this.position.y += this.moveSpeed3; // Slow again
                } else {
                    this.movementState = 'movingRight2';
                }
                break;
                
            case 'movingRight2':
                if (this.position.x < 17) {
                    this.position.x += this.moveSpeed3; // Fast speed
                } else {
                    this.movementState = 'movingDown2';
                }
                break;

            case 'movingDown2':
                if (this.position.y < 11) {
                    this.position.y += this.moveSpeed3; // Medium speed
                } else {
                    this.movementState = 'movingLeft2';
                }
                break;

            case 'movingLeft2':
                if (this.position.x > 6) {
                    this.position.x -= this.moveSpeed3; // Medium speed
                } else {
                    this.movementState = 'movingUp2';
                }
                break;

            case 'movingUp2':
                if (this.position.y > 7.3) {
                    this.position.y -= this.moveSpeed3; // Slow speed
                } else {
                    this.movementState = 'movingLeft3';
                }
                break;

            case 'movingLeft3':
                if (this.position.x > 2) {
                    this.position.x -= this.moveSpeed3; // Fast speed
                } else {
                    this.movementState = 'movingDown3';
                }
                break;

            case 'movingDown3':
                if (this.position.y < 15.8) {
                    this.position.y += this.moveSpeed3; // Fast speed
                } else {
                    this.movementState = 'movingRight3';
                }
                break;

            case 'movingRight3':
                if (this.position.x < 30) {
                    this.position.x += this.moveSpeed4; // Fast final escape
                } else {
                    this.hasDisappeared = true;
                }
                break;
        }
    }

    drawGhost() {
        if (this.hasDisappeared) return;
        
        // Load ghost up images if not already loaded
        if (!Ghost.ghostUpImages) {
            Ghost.ghostUpImages = {
                up1: loadImage('images/ghostUp1.svg'),
                up2: loadImage('images/ghostUp2.svg')
            };
        }
        if (!Ghost.ghostDownImages) {
            Ghost.ghostDownImages = {
                down1: loadImage('images/ghostDown1.svg'),
                down2: loadImage('images/ghostDown2.svg')
            };
        }
        if (!Ghost.ghostLeftImages) {
            Ghost.ghostLeftImages = {
                left1: loadImage('images/ghostLeft1.svg'),
                left2: loadImage('images/ghostLeft2.svg')
            };
        }
        if (!Ghost.ghostRightImages) {
            Ghost.ghostRightImages = {
                right1: loadImage('images/ghostRight1.svg'),
                right2: loadImage('images/ghostRight2.svg')
            };
        }

        // Animate between frames based on movement direction
        const animationSpeed = 0.1;
        this.animationFrame = (this.animationFrame || 0) + animationSpeed;
        const frameIndex = Math.floor(this.animationFrame) % 2;
        
        let currentSprite;
        
        // Choose sprite based on movement state
        switch (this.movementState) {
            case 'idle':
                currentSprite = Ghost.ghostImage; // Use idle sprite
                break;
            case 'movingUp':
            case 'movingUp2':
            case 'movingUp3':
                currentSprite = frameIndex === 0 ? Ghost.ghostUpImages.up1 : Ghost.ghostUpImages.up2;
                break;
            case 'movingLeft':
            case 'movingLeft2':
            case 'movingLeft3':
                currentSprite = frameIndex === 0 ? Ghost.ghostLeftImages.left1 : Ghost.ghostLeftImages.left2;
                break;
            case 'movingRight':
            case 'movingRight2':
            case 'movingRight3':
                currentSprite = frameIndex === 0 ? Ghost.ghostRightImages.right1 : Ghost.ghostRightImages.right2;
                break;
            case 'movingDown':
            case 'movingDown2':
            case 'movingDown3':
                currentSprite = frameIndex === 0 ? Ghost.ghostDownImages.down1 : Ghost.ghostDownImages.down2;
                break;
            default:
                currentSprite = Ghost.ghostUpImages.up1; // Default fallback
        }
        
        if (currentSprite && currentSprite.width > 0) {
            // Calculate proper dimensions - adjust base size based on movement direction
            let targetWidth;
            
            // Make up/down sprites larger since they appear smaller
            if (this.movementState.includes('Up') || this.movementState.includes('Down')) {
                targetWidth = 74; // Larger for up/down movement
            } else {
                targetWidth = 48; // Normal size for left/right/idle
            }
            
            const aspectRatio = currentSprite.height / currentSprite.width;
            const drawWidth = targetWidth;
            const drawHeight = targetWidth * aspectRatio;
            
            // Center the ghost on the tile
            const offsetX = (32 - drawWidth) / 2;
            const offsetY = (32 - drawHeight) / 2;
            
            image(currentSprite, 
                  this.position.x * 32 + offsetX, 
                  this.position.y * 32 + offsetY - 8, // Slight upward offset
                  drawWidth, 
                  drawHeight);
        } else {
            // Fallback: simple white circle if image fails to load (also 2x bigger)
            fill(255, 255, 255, 200);
            noStroke();
            ellipse(this.position.x * 32 + 16, this.position.y * 32 + 16, 56, 56);
        }
    }

    drawHitbox() {
        if (this.hasDisappeared || !debugMode) return;
        
        push();
        stroke(255, 255, 0);
        strokeWeight(2);
        noFill();
        
        // Draw circular hitbox
        ellipse(this.position.x * 32 + 16, this.position.y * 32 + 16, this.hitboxRadius * 2, this.hitboxRadius * 2);
        
        pop();
    }
}

// Static properties to store the loaded images
Snake.snakeImage = null;
Ghost.ghostImage = null;
Ghost.ghostUpImages = null;
Ghost.ghostDownImages = null;
Ghost.ghostLeftImages = null;
Ghost.ghostRightImages = null;