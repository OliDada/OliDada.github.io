class Item {
    constructor(type, x, y) {
    this.type = type; // 'gold', 'key', 'halfKey', 'specialHalfKey', or 'gun'
        this.x = x;
        this.y = y;
        this.collected = false;
        this.size = (window.tileSize || 32) * 1.5; // Scale with tile size

        if (!Item.goldImage) {
            Item.goldImage = loadImage('images/gold.png');
        }
        if (!Item.keyImage) {
            Item.keyImage = loadImage('images/key.svg');
        }
        if (!Item.halfKeyImage) {
            Item.halfKeyImage = loadImage('images/halfKey.svg');
        }
        if (!Item.specialHalfKeyImage) {
            Item.specialHalfKeyImage = Item.halfKeyImage; // Use same image for now
        }
        if (!Item.gunImage) {
            Item.gunImage = loadImage('images/gun.svg');
        }
    }

    render() {
        if (this.collected) return;
        
        // Save drawing state
        push();
        
        const tileSize = window.tileSize || 32;
        const centerX = this.x * tileSize + tileSize/2;
        const centerY = this.y * tileSize + tileSize/2;
        
        if (this.type === 'gold') {
            // Render gold image
            if (Item.goldImage && Item.goldImage.width > 0) {
                // Center the image and scale to fit nicely in the tile
                // Make gold bigger in level 4 to compensate for smaller tiles
                const goldScale = tileSize === 16 ? 2.5 : 1.25; // 2.5x for level 4, 1.25x for other levels
                const imageSize = tileSize * goldScale;
                image(Item.goldImage, centerX - imageSize/2, centerY - imageSize/2, imageSize, imageSize);
            }

        } else if (this.type === 'key') {
            // Render key image
            if (Item.keyImage && Item.keyImage.width > 0) {
                // Calculate aspect ratio and fit within tile while maintaining proportions
                const imageRatio = Item.keyImage.width / Item.keyImage.height;
                let drawWidth, drawHeight;
                
                // Fit to a maximum size while maintaining aspect ratio
                // Make keys bigger in level 4 to compensate for smaller tiles
                const keyScale = tileSize === 16 ? 3.5 : 1.8; // 3.5x for level 4, 1.8x for other levels
                const maxSize = tileSize * keyScale;
                if (imageRatio > 1) {
                    // Image is wider than tall - fit to width
                    drawWidth = maxSize;
                    drawHeight = maxSize / imageRatio;
                } else {
                    // Image is taller than wide - fit to height
                    drawHeight = maxSize;
                    drawWidth = maxSize * imageRatio;
                }
                
                image(Item.keyImage, centerX - drawWidth/2, centerY - drawHeight/2, drawWidth, drawHeight);
            }

        } else if (this.type === 'halfKey' || this.type === 'specialHalfKey') {
            // Render half key or special half key image
            let img = this.type === 'specialHalfKey' ? Item.specialHalfKeyImage : Item.halfKeyImage;
            if (img && img.width > 0) {
                // Calculate aspect ratio and fit within tile while maintaining proportions
                const imageRatio = img.width / img.height;
                let drawWidth, drawHeight;
                // Fit to a maximum size while maintaining aspect ratio
                // Make half keys bigger in level 4 to compensate for smaller tiles
                const halfKeyScale = tileSize === 16 ? 3.5 : 1.8; // 3.5x for level 4, 1.8x for other levels
                const maxSize = tileSize * halfKeyScale;
                if (imageRatio > 1) {
                    // Image is wider than tall - fit to width
                    drawWidth = maxSize;
                    drawHeight = maxSize / imageRatio;
                } else {
                    // Image is taller than wide - fit to height
                    drawHeight = maxSize;
                    drawWidth = maxSize * imageRatio;
                }
                image(img, centerX - drawWidth/2, centerY - drawHeight/2, drawWidth, drawHeight);
            }
        } else if (this.type === 'gun') {
            // Render gun image
            if (Item.gunImage && Item.gunImage.width > 0) {
                // Calculate aspect ratio and fit within tile while maintaining proportions
                const imageRatio = Item.gunImage.width / Item.gunImage.height;
                let drawWidth, drawHeight;

                // Fit to a maximum size while maintaining aspect ratio
                const maxSize = tileSize * 10; // Scale with tile size
                if (imageRatio > 1) {
                    // Image is wider than tall - fit to width
                    drawWidth = maxSize;
                    drawHeight = maxSize / imageRatio;
                } else {
                    // Image is taller than wide - fit to height
                    drawHeight = maxSize;
                    drawWidth = maxSize * imageRatio;
                }

                image(Item.gunImage, centerX - drawWidth/2, centerY - drawHeight/2, drawWidth, drawHeight);
            }
        }

        // Restore drawing state
        pop();
    }

    checkCollision(player) {
        if (this.collected) return false;
        
        const tileSize = window.tileSize || 32;
        
        // Convert item position to pixel coordinates
        const itemPixelX = this.x * tileSize;
        const itemPixelY = this.y * tileSize;
        
        // Calculate player center - player visual size is now size * 3
        const playerCenterX = player.position.x + (player.size * 3) / 2;
        const playerCenterY = player.position.y + (player.size * 3) / 2;

    if (this.type === 'key' || this.type === 'halfKey' || this.type === 'specialHalfKey') {
            // Use rectangular hitbox for keys - scale with tile size
            const keyLeft = itemPixelX - (15 * tileSize / 32);
            const keyRight = itemPixelX + (75 * tileSize / 32); // Key extends far to the right
            const keyTop = itemPixelY - (45 * tileSize / 32);
            const keyBottom = itemPixelY + (5 * tileSize / 32);
            
            const collision = playerCenterX >= keyLeft && playerCenterX <= keyRight && 
                            playerCenterY >= keyTop && playerCenterY <= keyBottom;
            
            
            return collision;
        } else if (this.type === 'gun') {
            // Use larger circular hitbox for guns
            const itemCenterX = itemPixelX + tileSize/2;
            const itemCenterY = itemPixelY + tileSize/2;
            
            const distance = Math.sqrt(
                Math.pow(playerCenterX - itemCenterX, 2) + 
                Math.pow(playerCenterY - itemCenterY, 2)
            );
            
            const collectionRadius = 50 * (tileSize / 32); // Much larger radius for guns
            const collision = distance < collectionRadius;
            
            return collision;
        } else {
            // Use circular hitbox for other items (gold)
            const itemCenterX = itemPixelX + tileSize/2;
            const itemCenterY = itemPixelY + tileSize/2;
            
            const distance = Math.sqrt(
                Math.pow(playerCenterX - itemCenterX, 2) + 
                Math.pow(playerCenterY - itemCenterY, 2)
            );
            
            const collectionRadius = 28 * (tileSize / 32); // Scale with tile size
            const collision = distance < collectionRadius;
            
            
            return collision;
        }
    }
    
    drawHitbox() {
        if (this.collected) return;
        
        const tileSize = window.tileSize || 32;
        
        // Convert item position to pixel coordinates
        const itemPixelX = this.x * tileSize;
        const itemPixelY = this.y * tileSize;
        
        push();
        noFill();
        stroke(255, 0, 0); // Red color for hitboxes
        strokeWeight(2);
        
        if (this.type === 'key' || this.type === 'halfKey') {
            // Use the same center and size as in render()
            const centerX = this.x * tileSize + tileSize/2;
            const centerY = this.y * tileSize + tileSize/2;
            let imageRatio, drawWidth, drawHeight, maxSize;
            if (this.type === 'key') {
                imageRatio = Item.keyImage.width / Item.keyImage.height;
                maxSize = tileSize * (tileSize === 16 ? 3.5 : 1.8);
            } else {
                imageRatio = Item.halfKeyImage.width / Item.halfKeyImage.height;
                maxSize = tileSize * (tileSize === 16 ? 3.5 : 1.8);
            }
            if (imageRatio > 1) {
                drawWidth = maxSize;
                drawHeight = maxSize / imageRatio;
            } else {
                drawHeight = maxSize;
                drawWidth = maxSize * imageRatio;
            }
            rect(centerX - drawWidth/2, centerY - drawHeight/2, drawWidth, drawHeight);
        } else if (this.type === 'gun') {
            // Draw circular hitbox for guns
            const itemCenterX = itemPixelX + tileSize/2;
            const itemCenterY = itemPixelY + tileSize/2;
            const collectionRadius = 50 * (tileSize / 32);
            
            ellipse(itemCenterX, itemCenterY, collectionRadius * 2, collectionRadius * 2);
        } else {
            // Draw circular hitbox for other items (gold)
            const itemCenterX = itemPixelX + tileSize/2;
            const itemCenterY = itemPixelY + tileSize/2;
            const collectionRadius = 28 * (tileSize / 32);
            
            ellipse(itemCenterX, itemCenterY, collectionRadius * 2, collectionRadius * 2);
        }
        
        pop();
    }
    
    collect() {
        this.collected = true;
    }
}

class Inventory {
    constructor() {
    this.gold = 0;
    this.keys = 0;
    this.halfKeys = 0;
    this.specialHalfKeys = 0;
    this.hasGun = false;
    }

    addItem(type) {
        if (type === 'gold') {
            this.gold++;
        } else if (type === 'key') {
            this.keys++;
        } else if (type === 'halfKey') {
            this.halfKeys++;
        } else if (type === 'specialHalfKey') {
            this.specialHalfKeys++;
        } else if (type === 'gun') {
            this.hasGun = true;
        }
    }

    useSpecialHalfKey() {
        if (this.specialHalfKeys > 0) {
            this.specialHalfKeys--;
            return true;
        }
        return false;
    }

    useKey() {
        if (this.keys > 0) {
            this.keys--;
            return true;
        }
        return false;
    }

    useHalfKey() {
        if (this.halfKeys > 0) {
            this.halfKeys--;
            return true;
        }
        return false;
    }

    // Method to preserve gold amount when creating new inventory
    preserveGold(goldAmount) {
        this.gold = goldAmount;
    }

    render(currentLevel) {
        
        // Make text more visible with background
        push();
        
        // Calculate text position
        let textX = (currentLevel === 3) ? width - 280 : width - 120;
        let textY = 40;
                
        // Display inventory in top right
        fill(255); // Bright green text
        stroke(0); // Black outline
        strokeWeight(1);
        textFont("Pixelify Sans");
        textSize(32);
        textAlign(LEFT);
        text(`Gold: ${this.gold}`, textX, textY);
        
        pop();
    }
}

// Static properties to store loaded images
Item.goldImage = null;
Item.keyImage = null;
Item.halfKeyImage = null;