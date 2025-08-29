class Map {
    constructor(levelNumber = 1) {
        this.levelNumber = levelNumber;
        this.mapData = null;
        this.tiles = null;
        this.width = 0;
        this.height = 0;
        this.loadMap();
    }

    async loadMap() {
        try {
            console.log(`Loading map for level ${this.levelNumber}`);
            const response = await fetch(`maps/level${this.levelNumber}.json`);
            this.mapData = await response.json();
            this.width = this.mapData.width;
            this.height = this.mapData.height;
            this.playerStart = this.mapData.playerStart || { x: 1, y: 1 };
            this.items = this.loadItems();
            this.enemies = this.loadEnemies();
            this.tiles = this.createMap();
        } catch (error) {
            console.error('Failed to load map:', error);
            // Fallback: create a minimal empty map
            this.width = 10;
            this.height = 10;
            this.playerStart = { x: 1, y: 1 };
            this.items = [];
            this.enemies = [];
            this.tiles = Array.from({ length: 10 }, () => Array(10).fill('.'));
        }
    }

    loadItems() {
        if (this.mapData && this.mapData.items) {
            return this.mapData.items.map(itemData => 
                new Item(itemData.type, itemData.x, itemData.y)
            );
        }
        return [];
    }

    loadEnemies() {
        if (this.mapData && this.mapData.enemies) {
            console.log(`Loading enemies for level ${this.levelNumber}`);
            return this.mapData.enemies.map(enemyData => {
                console.log(`Initializing enemy:`, enemyData);
                if (enemyData.type === 'snake') {
                    return new Snake({ x: enemyData.x, y: enemyData.y }, this.levelNumber);
                } else if (enemyData.type === 'ghost') {
                    const startPos = { x: enemyData.x, y: enemyData.y };
                    const endPos = { x: this.width - 1, y: enemyData.y };
                    return new Ghost(startPos, endPos);
                } else if (enemyData.type === 'zombie') {
                    return new Zombie({ x: enemyData.x, y: enemyData.y });
                } else if (enemyData.type === 'spikeBall') {
                    return new SpikeBall({ x: enemyData.x, y: enemyData.y });
                }
                // Add other enemy types here as needed
                return null;
            }).filter(enemy => enemy !== null);
        }
        return [];
    }

    createMap() {
        if (this.mapData && this.mapData.tiles) {
            return this.mapData.tiles.map(row => row.split(""));
        }
        return [];
    }

    render() {
        // Draw tiles
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.drawTile(x, y, this.tiles[y][x]);
            }
        }
        
        // Draw items
        if (this.items) {
            this.items.forEach(item => item.render());
        }
        
        // Draw enemies
        if (this.enemies) {
            this.enemies.forEach(enemy => {
                if (enemy.isAlive()) {
                    if (enemy instanceof Snake) {
                        enemy.drawSnake();
                    } else if (enemy instanceof Ghost) {
                        enemy.drawGhost();
                    } else if (enemy instanceof Zombie) {
                        enemy.drawZombie();
                    } else if (enemy instanceof SpikeBall) {
                        enemy.drawSpikeBall();
                    }
                }
            });
        }
    }

    // Check if a tile blocks movement
    isBlocked(x, y, inventory) {
        // Always use integer indices for tile access
        const ix = Math.floor(x);
        const iy = Math.floor(y);

        if (iy < 0 || iy >= this.height || ix < 0 || ix >= this.width) {
            return true; // Out of bounds
        }
        const tile = this.tiles[iy][ix];

        if (tile === '#' || tile === 'o') {
            return true; // Wall or invisible wall always blocks
        }
        if (tile === '<') {
            // Door blocks only if player has no keys
            const blocked = !inventory || inventory.keys === 0;
            return blocked;
        }
        if (tile === '=') {
            // Door blocks only if player has no halfKeys
            const blocked = !inventory || inventory.halfKeys === 0;
            return blocked;
        }
        if (tile === '-') {
            // Special door blocks only if player has no specialHalfKeys
            const blocked = !inventory || inventory.specialHalfKeys === 0;
            return blocked;
        }
        return false; // Floor and other tiles don't block
    }

    drawTile(x, y, tile) {
        const tileSize = window.tileSize || 32; // Use global tile size
        
        if (tile === '#') {
            // Wall
            if (this.levelNumber === 1) {
                fill(70, 170, 237); // Light blue for level 1
            } else if (this.levelNumber === 2) {
                fill(120, 225, 100); // Light green for level 2
            } else if (this.levelNumber === 3) {
                fill(200, 100, 200); // Purple for level 3
            } else if (this.levelNumber === 4) {
                fill(255, 225, 40); // Yellow for level 4
            }
        } else if (tile === '.') {
            // Floor
            if (this.levelNumber === 1) {
                fill(80, 149, 237, 150); // Darker blue
            } else if (this.levelNumber === 2) {
                fill(150, 255, 200, 150); // Darker green floor color for level 2
            } else if (this.levelNumber === 3) {
                fill(150, 50, 150, 150); // Darker purple for level 3
            } else if (this.levelNumber === 4) {
                fill(181, 146, 63); // Darker yellow more muted for level 4
            }
        } else if (tile == 'o') {
            // Invisible wall
            if (this.levelNumber === 1) {
                fill(80, 149, 237, 150); // Invisible wall (Floor color)
            } else if (this.levelNumber === 2) {
                fill(150, 255, 200, 150); // Invisible wall (Light green)
            } else if (this.levelNumber === 3) {
                fill(150, 50, 150, 150); // Invisible wall (Purple)
            } else if (this.levelNumber === 4) {
                fill(181, 146, 63); // Invisible wall (Darker yellow more muted for level 4)
            }
        } else if (tile === '<') {
            // Door
            if (this.items.some(item => item.type === 'key' && item.collected)) {
                if (this.levelNumber === 1) {
                    fill(80, 149, 237, 150); // Open door (Floor color)
                } else if (this.levelNumber === 2) {
                    fill(150, 255, 200, 150); // Open door (Light green)
                } else if (this.levelNumber === 3) {
                    fill(150, 50, 150, 150); // Open door (Purple)
                }
            } else {
                fill(139, 69, 19); // Door color (brown)
            }
        } else if (tile === '=') {
            // Half door
            if (this.items.some(item => item.type === 'halfKey' && item.collected)) {
                if (this.levelNumber === 1) {
                    fill(80, 149, 237, 150); // Open half door (Floor color)
                } else if (this.levelNumber === 2) {
                    fill(150, 255, 200, 150); // Open half door (Light green)
                } else if (this.levelNumber === 3) {
                    fill(150, 50, 150, 150); // Open half door (Purple)
                }
            } else {
                fill(139, 69, 19); // Door color (brown)
            }
        } else if (tile === '-') {
            // Special door
            if (this.items.some(item => item.type === 'specialHalfKey' && item.collected)) {
                if (this.levelNumber === 1) {
                    fill(80, 149, 237, 150); // Open special door (Floor color)
                } else if (this.levelNumber === 2) {
                    fill(150, 255, 200, 150); // Open special door (Light green)
                } else if (this.levelNumber === 3) {
                    fill(150, 50, 150, 150); // Open special door (Purple)
                } else if (this.levelNumber === 4) {
                    fill(181, 146, 63); // Open special door (Yellow)
                }
            } else {
                fill(139, 69, 19); // Door color (brown)
            }
        } else {
            fill(200); // Empty color
        }
        noStroke();
        rect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
}

function getText(levelNumber) {
    console.log("getText called for level:", levelNumber); // Debug log
    
    // Make text more visible with background and larger size
    fill(255, 0, 0, 200); // Bright red background for debugging
    noStroke();
    rect(20, 20, 250, 50); // Larger background rectangle
    
    fill(0, 255, 0); // Bright green text for maximum contrast
    stroke(0); // Black outline
    strokeWeight(1);
    textFont("Press Start 2P"); // Use loaded font
    textSize(14); // Good size for Press Start 2P
    textAlign(LEFT);

}