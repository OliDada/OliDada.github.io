let terrainGrid;
let waterGrid;    // stores water depth (>0 means water present)
let properties; // grid to store cell properties
let cols, rows;
let resolution = 5; // size of each cell in pixels

let burnTime = 5; // time for a cell to burn before turning to ash

// Cell types
const EMPTY = 0;
const TREE = 1;
const WATER = 8; 
const GRASS = 9;
const SAND = 10; 
const ROCK = 11;
const SNOW = 12; 
const ASH = -1;

const MAX_TREE_RATIO = 0.3; // 30% max tree density for the grid

let noiseScale = 0.05; // Global so we can reuse in draw()

let isFireMode = true; // Toggle for fire simulation mode
let isWaterMode = false; // Toggle for water simulation mode
let isErosionMode = false; // Toggle for erosion simulation mode

function make2Darray(cols, rows) {
    let arr = new Array(cols);
    for (let i = 0; i < cols; i++) {
        arr[i] = new Array(rows);
    }
    return arr;
}

function setup() {
    let canvas = createCanvas(1200, 800);
    canvas.parent('physics-canvas');
    frameRate(60);

    cols = floor(width / resolution);
    rows = floor(height / resolution);
    
    terrainGrid = make2Darray(cols, rows);
    waterGrid = make2Darray(cols, rows);
    properties = make2Darray(cols, rows);

    // Initialize grid with noise-based terrain generation
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let n = noise(i * noiseScale, j * noiseScale);

            if (n < 0.35) {
                terrainGrid[i][j] = SAND; // or another terrain for low areas
                properties[i][j] = { baseNoise: n };
                waterGrid[i][j] = random(0.3, 0.7); // initial water in low areas
            } else if (n < 0.39) {
                terrainGrid[i][j] = SAND; // sand
                properties[i][j] = { baseNoise: n };
            } else if (n < 0.50) {
                terrainGrid[i][j] = GRASS; // grassland
                properties[i][j] = { baseNoise: n, grassShade: random(180, 210), ashNoise: noise(i * 0.2, j * 0.2) };
            } else if (n < 0.65) {
                terrainGrid[i][j] = TREE; // forest
                properties[i][j] = { baseNoise: n, treeShade: random(120, 160), ashNoise: noise(i * 0.2, j * 0.2) };
            } else if (n < 0.75) {
                terrainGrid[i][j] = ROCK; // rock
                properties[i][j] = { baseNoise: n, rockShade: random(100, 150) };
            } else if (n < 0.85 && n >= 0.75) {
                terrainGrid[i][j] = SNOW; // snow
                properties[i][j] = { baseNoise: n, snowShade: random(200, 255) };
            } else {
                properties[i][j] = { baseNoise: n };
            }
        }
    }
}

function draw() {
    background(0);

    // Count current tree coverage
    let treeCount = 0;
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            if (terrainGrid[i][j] === TREE) treeCount++;
        }
    }
    let maxTrees = MAX_TREE_RATIO * cols * rows;

    // Draw cells with shadows
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let cell = terrainGrid[i][j];
            let n = properties[i][j].baseNoise; // base noise for shading

            // Map the depth using noise value for better depth-based shading
            let depth = map(n, 0, 1, 0, 255); // Depth in terms of shading (low = deep, high = shallow)

            // Shadow offset based on depth: lower terrain gets darker
            let shadowOffset = map(depth, 0, 255, 50, -50); // Larger negative values for darker shadows at lower depths

            // Define base color fill for each terrain type
            if (cell === ASH) {
                fill(properties[i][j].ashShade || 150);
            } else if (cell === GRASS) {
                let g = properties[i][j].grassShade || 200;
                fill(34, g - shadowOffset, 34); // Darker for deeper regions
            } else if (cell > TREE && cell < WATER) {
                // Burning cells: Lerp from bright yellow to dark red
                let t = map(cell, burnTime + 1, 2, 0, 1);
                fill(lerp(255, 120, t), lerp(180, 50, t), 0);
            } else if (cell === TREE) {
                let shade = properties[i][j].treeShade || 160;
                fill(34, shade - shadowOffset, 34); // Darken trees as depth increases
            } else if (cell === SAND) {
                fill(255 - shadowOffset, 220 - shadowOffset, 150);
            } else if (cell === ROCK) {
                let shade = properties[i][j].rockShade || 170;
                fill(shade - shadowOffset, shade - shadowOffset, shade - shadowOffset); // Rocks get darker at lower heights
            } else if (cell === SNOW) {
                let shade = properties[i][j].snowShade || 255;
                fill(shade - shadowOffset, shade - shadowOffset, shade - shadowOffset); // Snow gets slightly darker in deep regions
            } else {
                fill(0);
            }

            noStroke();
            rect(i * resolution, j * resolution, resolution, resolution);

            // Water overlay (light and transparent)
            if (waterGrid[i][j] > 0.1) {
                let d = waterGrid[i][j];
                let brightnessFactor = constrain(d + 0.2, 0, 1);
                fill(0, 120 * brightnessFactor, 255 * brightnessFactor, 190);
                rect(i * resolution, j * resolution, resolution, resolution);
            }
        }
    }


    // Update grid
    let nextGrid = make2Darray(cols, rows);

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let cell = terrainGrid[i][j];

            if (cell === WATER || cell === SAND) {
                nextGrid[i][j] = cell;

            } else if (cell === ASH) {
                // Preserve all existing properties including ash shade
                let currentProperties = { ...properties[i][j] };
                
                if (!currentProperties.regrowTimer) currentProperties.regrowTimer = 0;
                currentProperties.regrowTimer++;

                let n = noise(i * noiseScale, j * noiseScale);
                let isForestRegion = n > 0.5 && n < 0.75;
                let isGrassRegion = n >= 0.39 && n < 0.5;

                let numNeighboringGrass = countNeighboringGrass(i, j);
                let regrowthChance = map(numNeighboringGrass, 0, 8, 0, 0.05);

                // Check if we can regrow grass or trees based on neighboring conditions
                if (isGrassRegion &&
                    currentProperties.regrowTimer > 50 &&
                    (random() < regrowthChance || random() < 0.0002) ||
                    isForestRegion &&
                    (random() < regrowthChance || random() < 0.0001)
                ) {
                    nextGrid[i][j] = GRASS;
                    properties[i][j] = { 
                        baseNoise: properties[i][j].baseNoise,
                        grassShade: random(180, 210), 
                        growthStage: 0 };
                } else if (isForestRegion &&
                    (random() < regrowthChance || random() < 0.0005) &&
                    treeCount < maxTrees &&
                    currentProperties.regrowTimer > 50
                ) {
                    nextGrid[i][j] = TREE;
                    properties[i][j] = { 
                        baseNoise: properties[i][j].baseNoise,
                        treeShade: random(120, 160), 
                        treeAge: 0 
                    };
                } else {
                    nextGrid[i][j] = ASH;
                    properties[i][j] = currentProperties; // Keep all existing properties
                }

            } else if (cell > TREE && cell < WATER) {
                // Burning cells
                if (isNeighborWater(i, j)) {
                    // Extinguish fire - preserve existing ash shade if available
                    let existingAshShade = properties[i][j].ashShade || random(80, 160);
                    nextGrid[i][j] = ASH;
                    properties[i][j] = {
                        ...properties[i][j], // Keep existing properties
                        ashShade: existingAshShade, // Preserve shade
                        regrowTimer: 0
                    };

                    // Lightly reduce water near the fire, but keep enough for spreading
                    for (let di = -1; di <= 1; di++) {
                        for (let dj = -1; dj <= 1; dj++) {
                            let nx = i + di, ny = j + dj;
                            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                                if (waterGrid[nx][ny] > 0.05) {
                                    waterGrid[nx][ny] -= 0.05; // small reduction
                                    if (waterGrid[nx][ny] < 0) waterGrid[nx][ny] = 0;
                                }
                            }
                        }
                    }

                } else if (cell > 2) {
                    nextGrid[i][j] = cell - 1;
                } else {
                    // When burning completes naturally
                    nextGrid[i][j] = ASH;
                    properties[i][j] = {
                        ...properties[i][j], // Keep existing properties
                        ashShade: properties[i][j].ashShade || random(80, 160), // Set new random shade
                        regrowTimer: 0
                    };
                }

            } else if (cell === TREE) {
                nextGrid[i][j] = isNeighborBurning(i, j) ? burnTime + 1 : TREE;

            } else if (cell === GRASS) {
                nextGrid[i][j] = isNeighborBurning(i, j) ? burnTime + 1 : GRASS;

            } else if (cell === ROCK) {
                nextGrid[i][j] = ROCK;

            } else if (cell === SNOW) {
                nextGrid[i][j] = SNOW;

            } else {
                // Restore original terrain if possible, or default to SAND
                nextGrid[i][j] = terrainGrid[i][j] || SAND;
            }
        }
    }

    // In draw(), replace the debug text condition:
    if (keyIsDown(SHIFT)) {
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
            if (waterGrid[i][j] > 0.1) { // Match the visual threshold
                fill(255, 0, 0, 100);
                textSize(8);
                text(nf(waterGrid[i][j], 1, 2), i * resolution + 2, j * resolution + 10);
            }
            }
        }
    }

    

    waterPhysics();
    terrainGrid = nextGrid;
}




function isNeighborWater(x, y) {
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;

            let col = (x + i + cols) % cols;
            let row = (y + j + rows) % rows;

            if (waterGrid[col][row] > 0) {
                // Optional: highlight lingering water cells for debugging
                // fill(255, 0, 0, 100); // semi-transparent red
                // rect(i * resolution, j * resolution, resolution, resolution);
                return true; // Found water
            }
        }
    }
    return false; // No water nearby
}

function countNeighboringGrass(x, y) {
    let grassCount = 0;

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;

            let col = (x + i + cols) % cols;
            let row = (y + j + rows) % rows;

            if (terrainGrid[col][row] === GRASS) {
                grassCount++;
            }
        }
    }
    return grassCount;
}

function isNeighborBurning(x, y) {
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;

            let col = (x + i + cols) % cols;
            let row = (y + j + rows) % rows;

            if (terrainGrid[col][row] > TREE && terrainGrid[col][row] < WATER) {
                if (abs(i) + abs(j) === 2) {
                    if (random() < 0.08) return true; // Diagonal neighbors have a lower chance
                } else {
                    if (random() < 0.12) return true; // Straight neighbors have a higher chance
                }
            }
        }
    }
    return false;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = floor(random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]; // Swap elements
    }
}


function waterPhysics() {
    let nextWater = make2Darray(cols, rows);
    
    // Copy current water state
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            nextWater[i][j] = waterGrid[i][j];
        }
    }

    // Pass 1: Spread water to neighboring lower areas with more realistic flow
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let depth = waterGrid[i][j];
            if (depth <= 0) continue;

            // Fire extinguishing logic (unchanged)
            let isTouchingFire = false;
            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    if (di === 0 && dj === 0) continue;
                    let nx = i + di, ny = j + dj;
                    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) {
                        if (terrainGrid[nx][ny] > TREE && terrainGrid[nx][ny] < WATER) {
                            isTouchingFire = true;
                            terrainGrid[nx][ny] = ASH;
                            properties[nx][ny] = {
                                ...properties[nx][ny], // Keep existing properties
                                regrowTimer: 0
                            };
                            nextWater[i][j] -= 0.1;
                        }
                    }
                }
            }

            if (terrainGrid[i][j] > TREE && terrainGrid[i][j] < WATER) {
                terrainGrid[i][j] = ASH;
                properties[i][j] = {
                    regrowTimer: 0
                };
                nextWater[i][j] -= 0.2;
            }

            if (isTouchingFire) {
                nextWater[i][j] = max(0, nextWater[i][j]);
                continue;
            }

            // If the cell is not burning, continue with water flow logic
            let n = properties[i][j].baseNoise;
            if (n > 0.35 || terrainGrid[i][j] === ASH) {
                let totalDiff = 0;
                let lowerNeighbors = [];

                // Calculate neighbors' heights and find the lowest ones
                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        if (di === 0 && dj === 0) continue;
                        let nx = i + di, ny = j + dj;
                        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) {
                            let neighborN = properties[nx][ny].baseNoise;
                            let neighborWater = waterGrid[nx][ny];
                            // Only consider lower neighbors for flow
                            if (neighborN < n) {
                                lowerNeighbors.push({ x: nx, y: ny, diff: n - neighborN });
                                totalDiff += n - neighborN;
                            } else if (neighborN === n && neighborWater < depth - 0.05) {
                                lowerNeighbors.push({ x: nx, y: ny, diff: 0.1 });
                                totalDiff += 0.1;
                            }
                        }
                    }
                }

                // Spread water to lower neighbors based on the difference in height
                if (lowerNeighbors.length > 0) {
                    shuffleArray(lowerNeighbors); // Shuffle to spread water evenly
                    for (let neighbor of lowerNeighbors) {
                        // Gradually move water to lower regions based on the height difference
                        let moved = min(depth * 0.4, depth * (neighbor.diff / totalDiff) * 0.8);
                        if (moved > 0) {
                            nextWater[i][j] -= moved;
                            nextWater[neighbor.x][neighbor.y] += moved;
                            depth -= moved;
                            if (depth <= 0) break;
                        }
                    }
                }
            }
        }
    }

    

    // Pass 2: Stronger downhill leveling for holes (focus on pushing water down into holes)
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let depth = nextWater[i][j];
            if (depth <= 0) continue;

            let currentHeight = properties[i][j].baseNoise + nextWater[i][j];
            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    if (di === 0 && dj === 0) continue;
                    let nx = i + di, ny = j + dj;
                    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;

                    let neighborHeight = properties[nx][ny].baseNoise + nextWater[nx][ny];
                    let heightDiff = currentHeight - neighborHeight;

                    // If there is a steep drop (hole), move more water to fill the hole
                    if (heightDiff > 0.02) {
                        let gravityFactor = heightDiff > 0.15 ? 1.0 : 0.6;
                        let move = min(heightDiff * gravityFactor, nextWater[i][j] * gravityFactor * 0.5);

                        nextWater[i][j] -= move;
                        nextWater[nx][ny] += move;
                        currentHeight = properties[i][j].baseNoise + nextWater[i][j];
                    }
                }
            }
        }
    }

    // Pass 3: Aggressive equalization for low areas (ensure water flows into deep regions)
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let depth = nextWater[i][j];
            if (depth <= 0) continue;

            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    if (di === 0 && dj === 0) continue;
                    let nx = i + di, ny = j + dj;
                    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;

                    let myHeight = properties[i][j].baseNoise + nextWater[i][j];
                    let neighborHeight = properties[nx][ny].baseNoise + nextWater[nx][ny];

                    // If neighbor is lower (or same level), equalize
                    if (myHeight > neighborHeight + 0.02) {
                        let diff = (myHeight - neighborHeight) / 2; // push harder
                        let move = min(diff, nextWater[i][j] * 0.6); // move more water to fill holes
                        nextWater[i][j] -= move;
                        nextWater[nx][ny] += move;
                    }
                }
            }
        }
    }

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            if (waterGrid[i][j] <= 0) continue; // Skip dry cells

            // Check all 4-directional neighbors (up, down, left, right)
            const neighbors = [
            { x: i - 1, y: j }, { x: i + 1, y: j },
            { x: i, y: j - 1 }, { x: i, y: j + 1 }
            ];

            for (const neighbor of neighbors) {
                const nx = neighbor.x, ny = neighbor.y;
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;

                // Calculate total "height" (terrain + water) for both cells
                const myHeight = properties[i][j].baseNoise + waterGrid[i][j];
                const neighborHeight = properties[nx][ny].baseNoise + waterGrid[nx][ny];

                // If neighbor is lower, aggressively transfer water
                if (myHeight > neighborHeight + 0.01) { // Small threshold to prevent jitter
                    const heightDifference = myHeight - neighborHeight;
                    const transferAmount = heightDifference * 0.7; // Move 70% of the difference

                    // Ensure we don't transfer more water than exists
                    const actualTransfer = min(transferAmount, waterGrid[i][j]);

                    waterGrid[i][j] -= actualTransfer;
                    waterGrid[nx][ny] += actualTransfer;
                }
            }

            if (waterGrid[i][j] > 0) {
                if (random() < 0.1) {
                    let nx = i + floor(random(-1, 2));
                    let ny = j + floor(random(-1, 2));
                    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) {
                        let tinyFlow = waterGrid[i][j] * 0.05;
                        waterGrid[i][j] -= tinyFlow;
                        waterGrid[nx][ny] += tinyFlow;
                    }
                }
            }
        }
    }

    

    waterGrid = nextWater;

    // Clamp negatives and small values
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            if (waterGrid[i][j] < 0.01) waterGrid[i][j] = 0; // Threshold adjusted
        }
    }
}





function placeWaterInRadius(x, y, radius) {
    for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
            if (i * i + j * j <= radius * radius) {
                let xi = x + i, yj = y + j;
                if (xi >= 0 && yj >= 0 && xi < cols && yj < rows) {
                    // Add more water with higher pressure (1.0 instead of random)
                    waterGrid[xi][yj] = 1.0; // Full water amount
                    
                    // Still extinguish fires
                    if (terrainGrid[xi][yj] > TREE && terrainGrid[xi][yj] < WATER) {
                        terrainGrid[xi][yj] = ASH;
                        properties[xi][yj] = {
                            ...properties[xi][yj], // Keep existing properties
                            regrowTimer: 0
                        };
                    }
                }
            }
        }
    }
    // After placing water, force an immediate redistribution
    for (let i = -radius - 2; i <= radius + 2; i++) {
        for (let j = -radius - 2; j <= radius + 2; j++) {
            let xi = x + i, yj = y + j;
            if (xi >= 0 && yj >= 0 && xi < cols && yj < rows && waterGrid[xi][yj] > 0) {
                // Push water outward aggressively
                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        if (di === 0 && dj === 0) continue;
                        let nx = xi + di, ny = yj + dj;
                        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) {
                            let heightDiff = (properties[xi][yj].baseNoise + waterGrid[xi][yj]) - 
                                            (properties[nx][ny].baseNoise + waterGrid[nx][ny]);
                            if (heightDiff > 0.01) {
                                let transfer = min(waterGrid[xi][yj], heightDiff * 0.8); // Move 80% of difference
                                waterGrid[xi][yj] -= transfer;
                                waterGrid[nx][ny] += transfer;
                            }
                        }
                    }
                }
            }
        }
    }
}

function erodeTerrain(x, y, radius) {
    for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
            if (i*i + j*j <= radius*radius) {
                let xi = x + i, yj = y + j;
                if (xi >= 0 && xi < cols && yj >= 0 && yj < rows) {
                    // Store original values
                    let originalNoise = properties[xi][yj].baseNoise;
                    
                    // Apply erosion (more aggressive in center)
                    let falloff = 1 - (sqrt(i*i + j*j) / radius);
                    properties[xi][yj].baseNoise -= 0.05 * falloff;
                    
                    // Immediately update terrain type based on NEW noise value
                    updateTerrainType(xi, yj);
                    
                    // Force water to flow into the new depression
                    if (waterGrid[xi][yj] > 0) {
                        for (let di = -1; di <= 1; di++) {
                            for (let dj = -1; dj <= 1; dj++) {
                                let nx = xi + di, ny = yj + dj;
                                if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                                    let heightDiff = (properties[xi][yj].baseNoise + waterGrid[xi][yj]) 
                                                   - (properties[nx][ny].baseNoise + waterGrid[nx][ny]);
                                    if (heightDiff > 0) {
                                        let flow = heightDiff * 0.5;
                                        waterGrid[xi][yj] -= flow;
                                        waterGrid[nx][ny] += flow;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// NEW helper function
function updateTerrainType(i, j) {
    let n = properties[i][j].baseNoise;
    if (n < 0.35) terrainGrid[i][j] = SAND;
    else if (n < 0.5) terrainGrid[i][j] = GRASS;
    else if (n < 0.65) terrainGrid[i][j] = TREE;
    else if (n < 0.75) terrainGrid[i][j] = ROCK;
    else terrainGrid[i][j] = SNOW;
}



function mousePressed() {
    let x = floor(mouseX / resolution), y = floor(mouseY / resolution);
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
        if (isFireMode) {
            if (terrainGrid[x][y] === TREE || terrainGrid[x][y] === GRASS) {
                terrainGrid[x][y] = burnTime + 1; // Start burning
            }
        } else if (isWaterMode) {
            placeWaterInRadius(x, y, 5); // Place water in a radius
        }
    }
}

function mouseDragged() {
    let x = floor(mouseX / resolution);
    let y = floor(mouseY / resolution);

    if (x >= 0 && x < cols && y >= 0 && y < rows) {
        if (isFireMode) {
            if (terrainGrid[x][y] === TREE || terrainGrid[x][y] === GRASS) {
                terrainGrid[x][y] = burnTime + 1; // Start burning
            }
        } else if (isWaterMode) {
            placeWaterInRadius(x, y, 5); // Continue placing water as mouse moves
        } else if (isErosionMode) {
            erodeTerrain(x, y, 5); // Erode terrain in a radius
        }
    }
}

function keyPressed() {
    if (key === 'f' || key === 'F') {
        isFireMode = true;
        isWaterMode = false;
    } else if (key === 'w' || key === 'W') {
        isFireMode = false;
        isWaterMode = true;
    } else if (key === 'e' || key === 'E') {
        isErosionMode = true;
        isFireMode = false;
        isWaterMode = false;
    }
}