let player;
let gameMap;
let inventory;
let mapLoaded = false;
let level = 1;
let levelCompleted = false;
let resetting = false;
let tileSize = 32;
let debugMode = false; // Toggle with 'D' key to show hitboxes

// Text display system
let displayMessage = "";

// Shooting system
let bullets = [];
let lastShotTime = 0; // Prevent rapid firing

class Bullet {
    constructor(x, y, targetX, targetY) {
        this.x = x;
        this.y = y;
        
        // Calculate direction vector to target
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate angle for rotation
        this.angle = Math.atan2(dy, dx);
        
        // Normalize direction and set speed
        this.speed = 16;
        this.velX = (dx / distance) * this.speed;
        this.velY = (dy / distance) * this.speed;
        
        this.size = 8;
        this.active = true;
    }
    
    update() {
        if (!this.active) return;
        
        // Move bullet using velocity
        this.x += this.velX;
        this.y += this.velY;
        
        // Check for wall collision
        const tileX = Math.floor(this.x / tileSize);
        const tileY = Math.floor(this.y / tileSize);
        
        if (gameMap && gameMap.isBlocked(tileX, tileY, inventory)) {
            this.active = false;
        }
        
        // Check for enemy collision
        if (gameMap && gameMap.enemies) {
            for (let i = gameMap.enemies.length - 1; i >= 0; i--) {
                const enemy = gameMap.enemies[i];
                if (enemy.isAlive()) {
                    let hit = false;
                    if (enemy.name === 'Zombie') {
                        // Use zombie's actual scaled sprite rectangle for hitbox
                        const tileSize = window.tileSize || 32;
                        const enemyScale = (typeof getEnemyScale === 'function' ? getEnemyScale() : 1) * 2; // double size
                        const zw = tileSize * 1.75 * enemyScale;
                        const zh = tileSize * 1.75 * enemyScale;
                        const zx = enemy.position.x * tileSize + tileSize * 0.875 * enemyScale - zw / 2;
                        const zy = enemy.position.y * tileSize + tileSize * 0.875 * enemyScale - zh / 2;
                        if (
                            this.x >= zx && this.x <= zx + zw &&
                            this.y >= zy && this.y <= zy + zh
                        ) hit = true;
                    } else {
                        const enemyX = enemy.position.x * tileSize + tileSize / 2;
                        const enemyY = enemy.position.y * tileSize + tileSize / 2;
                        const distance = Math.sqrt((this.x - enemyX) ** 2 + (this.y - enemyY) ** 2);
                        if (distance < tileSize / 2) hit = true;
                    }
                    if (hit) {
                        if (enemy.name === 'Zombie') {
                            enemy.health = 0;
                            gameMap.enemies.splice(i, 1);
                            console.log('Zombie killed!');
                            // If this was the last zombie, spawn halfKey in center of level 4
                            if (level === 4 && !gameMap.enemies.some(e => e.name === 'Zombie')) {
                                // Center of level 4 (use map width/height)
                                const centerX = Math.floor(gameMap.width / 2);
                                const centerY = Math.floor(gameMap.height / 2);
                                if (!gameMap.items) gameMap.items = [];
                                // Use the Item class for halfKey so it works with inventory and doors
                                if (typeof Item !== 'undefined') {
                                    const specialKey = new Item('specialHalfKey', centerX, centerY);
                                    gameMap.items.push(specialKey);
                                    if (gameMap.mapData && Array.isArray(gameMap.mapData.items)) {
                                        gameMap.mapData.items.push({ type: 'specialHalfKey', x: centerX, y: centerY });
                                    }
                                }
                                console.log('HalfKey spawned in center of level 4!');
                            }
                        } else {
                            enemy.health -= 10; // Damage to other enemies
                        }
                        this.active = false; // Bullet disappears
                    }
                }
            }
        }
        
        // Remove bullet if it goes off screen
        if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
            this.active = false;
        }
    }
    4
    render() {
        if (!this.active) return;
        
        push();
        fill(255, 0, 0); // Red color
        noStroke();
        
        // Move to bullet position and rotate
        translate(this.x, this.y);
        rotate(this.angle);
        
        // Draw rotated rectangle (pointing right by default) - thinner bullet
        rect(-this.size, -this.size/4, this.size * 2, this.size/2);
        
        pop();
    }
}

// Function to show a message
function showMessage(text) {
    displayMessage = text;
}

// Function to update tile size based on level
function updateTileSize() {
    if (level === 4) {
        tileSize = 16; // 50% of normal size for level 4 to fit bigger map
    } else {
        tileSize = 32; // Normal size for other levels
    }
    window.tileSize = tileSize; // Make it globally accessible
}

async function setup() {
    updateTileSize(); // Set initial tile size

    // Clear any persistent messages (like 'CLICK TO SHOOT') on level load
    showMessage("");

    // Create canvas and attach it to the game-container
    let canvas = createCanvas(800, 600);
    canvas.parent('game-container');

    gameMap = new Map(1); // Load level 1

    // Wait for map to load properly
    await waitForMapLoad();

    // Set canvas to consistent size (based on level 1 dimensions with 32px tiles)
    resizeCanvas(832, 640); // 26 * 32 = 832, 20 * 32 = 640

    // Create player at the spawn position
    if (gameMap.playerStart) {
        player = new Player("Hero", 100, { 
            x: gameMap.playerStart.x * tileSize, 
            y: gameMap.playerStart.y * tileSize 
        });
    } else {
        player = new Player("Hero", 100, { x: 5 * tileSize, y: 5 * tileSize });
    }

    // Update player size to match tile size
    player.updateSize();

    // Set initial facing direction based on level
    if (level === 1) {
        player.lastDirection = 'right';
    } else if (level === 2 || level === 3) {
        player.lastDirection = 'down';
    }

    inventory = new Inventory();
    mapLoaded = true;
}

async function waitForMapLoad() {
    let attempts = 0;
    while (!gameMap.tiles && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
}

function draw() {
    background(51);

    // Only draw if everything is loaded
    if (!mapLoaded || !gameMap || !gameMap.tiles || !player || !inventory) {
        fill(255);
        textAlign(CENTER);
        textFont("Press Start 2P");
        textSize(32);
        text("Loading...", width/2, height/2);
        return;
    }

    // Update spikeball orbits before rendering
    if (gameMap.enemies) {
        gameMap.enemies.forEach(enemy => {
            if (enemy instanceof SpikeBall) {
                enemy.updateSpikeBall();
            }
        });
    }

    gameMap.render(); // Draw the map first
    // Draw enemies
    if (gameMap.enemies) {
        gameMap.enemies.forEach(enemy => {
            if (enemy instanceof Snake) {
                enemy.drawSnake();
                enemy.snakeMovement();
            } else if (enemy instanceof Zombie) {
                enemy.drawZombie();
                enemy.zombieMovement(); // Ensure zombieMovement is called
            } else if (enemy instanceof Ghost) {
                enemy.drawGhost();
                enemy.ghostMovement();
            }
        });
    }

    // Continuous movement when arrow keys are held down
    if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) { // A key
        player.move('left', gameMap, inventory);
    }
    if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) { // D key
        player.move('right', gameMap, inventory);
    }
    if (keyIsDown(UP_ARROW) || keyIsDown(87)) { // W key
        player.move('up', gameMap, inventory);
    }
    if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) { // S key
        player.move('down', gameMap, inventory);
    }

    // Check for item collection
    if (gameMap.items) {
        gameMap.items.forEach(item => {
            if (item.checkCollision(player) && !item.collected) {
                // Use the collect() method to ensure all logic is triggered
                item.collect();
                inventory.addItem(item.type);
                // Show message for specific items
                if (item.type === 'gun') {
                    showMessage("CLICK TO SHOOT");
                    document.body.style.cursor = 'crosshair';
                }
            }
        });
    }

    // Check for enemy collisions
    if (gameMap.enemies) {
        gameMap.enemies.forEach(enemy => {
            if (enemy.isAlive() && checkEnemyCollision(player, enemy)) {
                if (enemy.name === 'Zombie') {
                    // Zombies send the player to level 1 on contact
                    if (!resetting) {
                        resetting = true;
                        resetToLevel1WithGoldLoss().then(() => { resetting = false; });
                        return;
                    }
                } else if (enemy.name === 'Snake') {
                    // Reset to level 1 and lose all gold when hit by snake
                    resetToLevel1WithGoldLoss();
                    enemy.attack(player);
                    console.log(`Player health: ${player.health}`);
                    // Simple knockback - move player away from enemy
                    const dx = player.position.x - enemy.position.x * 32;
                    const dy = player.position.y - enemy.position.y * 32;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance > 0) {
                        player.position.x += (dx / distance) * 20;
                        player.position.y += (dy / distance) * 20;
                    }
                } else {
                    // Other enemies: can add logic here if needed
                }
            }
        });
    }

    // Check for level completion
    const onExitTile = playerOnExitTile(player, gameMap);
    const hasKeys = inventory.keys > 0;
    
    if (!levelCompleted && onExitTile && hasKeys) {
        levelCompleted = true;
        loadNextLevel();
    }

    // Check if player is currently moving (any movement key pressed)
    const currentlyMoving = keyIsDown(LEFT_ARROW) || keyIsDown(65) || 
                          keyIsDown(RIGHT_ARROW) || keyIsDown(68) || 
                          keyIsDown(UP_ARROW) || keyIsDown(87) || 
                          keyIsDown(DOWN_ARROW) || keyIsDown(83);
    
    if (!currentlyMoving) {
        player.stopMoving();
    }

    // Update player animation
    player.playerAnimation();
    
    // Update bullets
    bullets.forEach(bullet => bullet.update());
    // Remove inactive bullets
    bullets = bullets.filter(bullet => bullet.active);
    
    // Display the message (only on level 4, below player)
    if (level === 4) {
        push();
        fill(255, 255, 255); // White text
        textAlign(CENTER);
        textFont("Pixelify Sans", 64);
            
        // Draw text at fixed position so player can walk on top
        fill(255); // White text
        text(displayMessage, width / 2, 130);
        pop();
    }
    
    // Render bullets (before player so they appear underneath)
    bullets.forEach(bullet => bullet.render());
    
    // Draw the player with animation (pass inventory for gun sprites)
    player.render(inventory);
    
    // Draw hitboxes if debug mode is enabled
    if (debugMode) {
        player.drawHitbox();
        
        // Draw item hitboxes
        if (gameMap.items) {
            gameMap.items.forEach(item => {
                item.drawHitbox();
            });
        }
        // Draw enemy hitboxes
        if (gameMap.enemies) {
            gameMap.enemies.forEach(enemy => {
                enemy.drawHitbox();
            });
        }
    }
    
    // Draw level text and inventory - inside draw function where p5.js functions work
    push();
    
    // Level text
    fill(255); // White text
    stroke(0);
    strokeWeight(1);
    textFont("Pixelify Sans");
    textSize(14);
    textAlign(LEFT);
    
    if (level === 1) {
        textSize(32);
        text("Level 1", 30, 40);
        fill(255);
        textAlign(CENTER);
        text("W,A,S,D to move", width/2, 40);
    } else {
        textSize(32);
        text(`Level ${level}`, 30, 40);
    }
    
    pop();
    
    // Draw inventory with debug colors
    inventory.render(level);
}

async function loadNextLevel() {
    level++;
    updateTileSize(); // Update tile size for new level
    mapLoaded = false;
    
    // Preserve current gold amount
    const currentGold = inventory ? inventory.gold : 0;
    
    gameMap = new Map(level);
    await waitForMapLoad();
    
    // Keep canvas size consistent across all levels
    resizeCanvas(832, 640); // Same size for all levels
    
    // Create player at the spawn position for the new level
    if (gameMap.playerStart) {
        player = new Player("Hero", 100, { 
            x: gameMap.playerStart.x * tileSize, 
            y: gameMap.playerStart.y * tileSize 
        });
    } else {
        player = new Player("Hero", 100, { x: 5 * tileSize, y: 5 * tileSize });
    }
    
    // Update player size to match tile size
    player.updateSize();

    // Set initial facing direction based on level
    if (level === 1) {
        player.lastDirection = 'right';
    } else if (level === 2 || level === 3) {
        player.lastDirection = 'down';
    }

    // Create new inventory but preserve gold amount
    inventory = new Inventory();
    inventory.preserveGold(currentGold);
    levelCompleted = false; // Reset for the new level
    mapLoaded = true;
    
    // Reset cursor since gun is lost when changing levels
    document.body.style.cursor = 'default';
}

async function loadSpecificLevel(targetLevel) {
    level = targetLevel;
    updateTileSize(); // Update tile size for new level
    mapLoaded = false;
    
    // Preserve current gold amount
    const currentGold = inventory ? inventory.gold : 0;
    
    gameMap = new Map(level);
    await waitForMapLoad();
    
    // Keep canvas size consistent across all levels
    resizeCanvas(832, 640); // Same size for all levels
    
    // Create player at the spawn position for the new level
    if (gameMap.playerStart) {
        player = new Player("Hero", 100, { 
            x: gameMap.playerStart.x * tileSize, 
            y: gameMap.playerStart.y * tileSize 
        });
    } else {
        player = new Player("Hero", 100, { x: 5 * tileSize, y: 5 * tileSize });
    }
    
    // Update player size to match tile size
    player.updateSize();
    
    // Set initial facing direction based on level
    if (level === 1) {
        player.lastDirection = 'right';
    } else if (level === 2 || level === 3) {
        player.lastDirection = 'down';
    }
    
    // Create new inventory but preserve gold amount
    inventory = new Inventory();
    inventory.preserveGold(currentGold);
    levelCompleted = false; // Reset for the new level
    mapLoaded = true;
    
    // Reset cursor since gun is lost when changing levels
    document.body.style.cursor = 'default';
    
    console.log(`Development: Switched to level ${level}`);
}

async function resetToLevel1WithGoldLoss() {
    // Clear any persistent messages (like 'CLICK TO SHOOT') on reset
    showMessage("");
    level = 1;
    mapLoaded = false;
    updateTileSize();
    resizeCanvas(832, 640); // 26 * 32 = 832, 20 * 32 = 640 for level 1

    // Don't preserve gold when hit by snake - reset to 0

    gameMap = new Map(level);
    await waitForMapLoad();

    // Create player at the spawn position for level 1
    if (gameMap.playerStart) {
        player = new Player("Hero", 100, { 
            x: gameMap.playerStart.x * tileSize, 
            y: gameMap.playerStart.y * tileSize 
        });
    } else {
        player = new Player("Hero", 100, { x: 5 * tileSize, y: 5 * tileSize });
    }

    // Update player size to match tile size
    player.updateSize();

    // Set initial facing direction for level 1
    player.lastDirection = 'right';

    // Create new inventory with 0 gold (don't preserve)
    inventory = new Inventory();
    levelCompleted = false;
    mapLoaded = true;

    // Reset cursor since gun is lost when hit by snake
    document.body.style.cursor = 'default';

    console.log("Player hit by snake! Reset to level 1 with gold loss.");
}

function mousePressed() {
    // Prevent the function from running multiple times
    if (mouseButton !== LEFT) return;
    
    // Handle shooting if player has gun
    if (inventory.hasGun && millis() - lastShotTime > 200) { // 200ms cooldown
        lastShotTime = millis();
        
        // Calculate player center position on screen
        const playerScreenX = player.position.x + player.size / 2;
        const playerScreenY = player.position.y + player.size / 2;
        
        // Create bullet that shoots toward exact mouse position
        const bullet = new Bullet(playerScreenX, playerScreenY, mouseX, mouseY);
        bullets.push(bullet);
        
        console.log(`Shot fired toward mouse: (${mouseX}, ${mouseY}) from player: (${playerScreenX}, ${playerScreenY})`);
    }
    
    // Prevent default behavior
    return false;
}

function keyPressed() {
    // Prevent arrow keys from scrolling the page
    if ([UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW].includes(keyCode)) {
        return false;
    }
    
    // Toggle debug mode with 'ö' key
    if (key === 'ö' || key === 'Ö') {
        debugMode = !debugMode;
        console.log(`Debug mode: ${debugMode ? 'ON' : 'OFF'}`);
        return false;
    }
    
    // Development: Level switching with number keys
    if (key >= '1' && key <= '9') {
        const targetLevel = parseInt(key);
        console.log(`Development: Switching to level ${targetLevel}`);
        loadSpecificLevel(targetLevel);
        return false;
    }
}

function playerOnExitTile(player, map) {
    // Check all tiles overlapped by the player's collision box (not just center)
    // Use the same collision box as in player.move()
    const displaySize = player.size * 3;
    const collisionSize = 55;
    const collisionOffset = (displaySize - collisionSize) / 2;
    const left = player.position.x + collisionOffset;
    const top = player.position.y + collisionOffset;
    const right = left + collisionSize;
    const bottom = top + collisionSize;

    // Check all tiles overlapped by the collision box
    const minTileX = Math.floor(left / tileSize);
    const maxTileX = Math.floor((right - 1) / tileSize);
    const minTileY = Math.floor(top / tileSize);
    const maxTileY = Math.floor((bottom - 1) / tileSize);

    for (let tx = minTileX; tx <= maxTileX; tx++) {
        for (let ty = minTileY; ty <= maxTileY; ty++) {
            if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                const currentTile = map.tiles[ty][tx];
                if (typeof currentTile === 'string' && currentTile.includes('<')) {
                    return true;
                }
            }
        }
    }
    return false;
}

function checkEnemyCollision(player, enemy) {
    // Calculate player center - player visual size is now size * 3
    const playerCenterX = player.position.x + (player.size * 3) / 2;
    const playerCenterY = player.position.y + (player.size * 3) / 2;

    // Use custom hitbox for zombies and snakes
    if (enemy.name === 'Zombie' && typeof enemy.getHitboxBounds === 'function') {
        const bounds = enemy.getHitboxBounds();
        return playerCenterX >= bounds.left && 
               playerCenterX <= bounds.right && 
               playerCenterY >= bounds.top && 
               playerCenterY <= bounds.bottom;
    } else if (enemy.getHitboxBounds) {
        // Rectangular collision detection (e.g. Snake)
        const bounds = enemy.getHitboxBounds();
        return playerCenterX >= bounds.left && 
               playerCenterX <= bounds.right && 
               playerCenterY >= bounds.top && 
               playerCenterY <= bounds.bottom;
    } else {
        // Fallback to circular collision for other enemies
        const enemyCenterX = enemy.position.x * 32 + 16;
        const enemyCenterY = enemy.position.y * 32 + 16;
        const distance = Math.sqrt(
            Math.pow(playerCenterX - enemyCenterX, 2) + 
            Math.pow(playerCenterY - enemyCenterY, 2)
        );
        const hitboxRadius = enemy.getHitboxRadius ? enemy.getHitboxRadius() : 25;
        return distance < hitboxRadius;
    }
}