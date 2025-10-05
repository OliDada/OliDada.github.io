let cols, rows;
let scale = 30;
let w = 2000;
let h = 3000;  // Increased height for more depth

let flying = 0; // Controls the speed of terrain and obstacles
let speedFactor = 0.05; // Unified speed factor for terrain
let terrain = [];
let obstacles = [];

// Speed ramping: start slower and increase over time
let baseObstacleSpeed = 15; // base obstacle forward movement per frame
let speedMultiplier = 0.5; // starts at 20% speed
let maxSpeedMultiplier = 1.0; // cap at full speed
let speedRampRate = 0.00003; // increase per millisecond (~0.00003 * 1000 = 0.03 per second)
let lastMillis = 0;
let gameOver = false;
let particles = [];
let gameOverTimer = 0;

let fogColor = [0];
let fogDensity = 0.4; // Adjust density (0-1)
let fogStart = 0; // Distance where fog starts
let fogEnd = -1000; // Distance where fog is completely opaque



let ball = {
	x: w / 2,
	y: 2000,  // Start at ground level
	z: 2200,
	radius: 20,
	velocity: 0,
	gravity: 0.5,
	bounce: -0.5,
	jumping: false,
	jumpStrength: -12
};

function setup() {
    // Determine canvas size: when embedded (in an iframe) size to the parent container
    let canvasWidth = 800;
    let canvasHeight = 600;
    try {
        const inIframe = window.self !== window.top;
        if (inIframe) {
            const container = document.getElementById('gravity-dash-canvas') || document.body;
            canvasWidth = Math.max(300, container.clientWidth || window.innerWidth);
            canvasHeight = Math.max(200, container.clientHeight || window.innerHeight);
        }
    } catch (e) {
        // fallback to defaults
    }

    let canvas = createCanvas(canvasWidth, canvasHeight, WEBGL);
    const _gdParent = document.getElementById('gravity-dash-canvas');
    if (_gdParent) canvas.parent(_gdParent); else canvas.parent(document.body);
    // Ensure the canvas scales to fill the container visually
    canvas.style('width', '100%');
    canvas.style('height', '100%');
    frameRate(60); // Set to 60 FPS for smooth gameplay

    cols = floor(w / scale);
    rows = floor(h / scale * 3);  // Triple the rows for more distant terrain

    // Initialize terrain
    terrain = new Array(cols);
    for (let x = 0; x < cols; x++) {
        terrain[x] = new Array(rows).fill(0);
    }

    // Initial obstacles
    for (let i = 0; i < 50; i++) {
        addObstacle();
    }
}

function windowResized() {
    // Resize the canvas to match container when embedded, otherwise keep default
    try {
        const inIframe = window.self !== window.top;
        if (inIframe) {
            const container = document.getElementById('gravity-dash-canvas') || document.body;
            const newW = Math.max(300, container.clientWidth || window.innerWidth);
            const newH = Math.max(200, container.clientHeight || window.innerHeight);
            resizeCanvas(newW, newH);
            // keep canvas CSS filling container
            const canv = document.querySelector('#gravity-dash-canvas canvas');
            if (canv) {
                canv.style.width = '100%';
                canv.style.height = '100%';
            }
        }
    } catch (e) {
        // ignore
    }
}

function drawFog() {
    drawingContext.depthMask(false);
    blendMode(ADD);
    
    let distance = ball.z;
    let fogAmount = map(distance, fogStart, fogEnd, 0, fogDensity);
    fogAmount = constrain(fogAmount, 0, fogDensity);  

    if (distance > fogEnd) {
        fogAmount = 0;
    }

    push();
    noStroke();
    fill(fogColor[0], fogColor[1], fogColor[2], fogAmount * 255);  
    translate(0, fogEnd / 2, 0);
    rotateX(HALF_PI);  
    plane(w * 3, h * 3);  
    pop();
    
    blendMode(BLEND);
    drawingContext.depthMask(true);  
}

function addObstacle() {
	let spawnZ = random(1) < 0.6 ? random(-3000, -1000) : random(-800, -100);
	let baseHeight = random(100, 200); 
	let protrusion = random(20, 60); 

	obstacles.push({
		x: floor(random(2, cols - 2)),
		z: spawnZ,
		height: baseHeight + protrusion, 
		size: random(40, 80), 
		protrusion: protrusion, 
		baseHeight: baseHeight 
	});
}

function drawTerrain() {
    let time = millis() / 1000;  // Get the time in seconds
    let colorFactor = sin(time * 0.5) * 0.5 + 0.5;  // Smooth oscillation factor (0-1)

    for (let y = 0; y < rows - 1; y++) {
        beginShape(TRIANGLE_STRIP);

        for (let x = 0; x < cols; x++) {
            let terrainHeight = terrain[x][y];
            
            // Calculate base color based on terrain height and time factor
            let baseR = 130 + (colorFactor * 12);  // Red component oscillates with time
            let baseG = 100 + (colorFactor * 24);  // Green component oscillates with time
            let baseB = 50 + (colorFactor / 12);   // Blue component oscillates with time

            // Add depth-based shading (terrain gets darker the further away it is)
            let depthFactor = map(terrainHeight, -100, 100, 0.5, 1);  // Simulate depth effect
            baseR *= depthFactor;
            baseG *= depthFactor;
            baseB *= depthFactor;

            // Set the color based on height and time factor
            fill(baseR, baseG, baseB);
            noStroke();

            // Draw the terrain vertices
            vertex(x * scale, y * scale, terrainHeight);
            vertex(x * scale, (y + 1) * scale, terrain[x][y + 1]);
        }

        endShape();
    }
}


function drawObstacles() {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        if (!gameOver) {
            // obstacle forward movement scales with speedMultiplier
            obs.z += baseObstacleSpeed * speedMultiplier;
        }

        // Get terrain height at current position
        let terrainX = floor(obs.x);
        let terrainZ = floor(obs.z / scale);
        let tHeight = (terrainX >= 0 && terrainX < cols && terrainZ >= 0 && terrainZ < rows)
            ? terrain[terrainX][terrainZ]
            : 0;

        // Set originalY if not set
        if (obs.originalY === 0) {
            obs.originalY = -tHeight;
        }

        // Calculate shading based on the position or height of the obstacle
        let heightFactor = map(obs.height, 100, 300, 0, 1); // Normalize height for shading effect
        let r = map(heightFactor, 0, 1, 150, 255);  // Red intensity based on height
        let g = map(heightFactor, 0, 1, 50, 150);   // Green intensity based on height
        let b = map(heightFactor, 0, 1, 50, 100);   // Blue intensity based on height

        // Add shading based on the obstacle's depth (z position) in the world
        let depthFactor = map(obs.z, -3000, 0, 0.5, 1);  // Simulate depth fading
        r *= depthFactor;
        g *= depthFactor;
        b *= depthFactor;

        push();
        // Set the color with shading applied
        fill(r, g, b);
        noStroke();

        translate(
            obs.x * scale,
            obs.z,
            obs.originalY - obs.height / 2
        );
        box(obs.size, obs.size, obs.height);
        pop();

        // Remove only when well past the visible area
        if (obs.z > w * 1.5) {  // Much larger removal threshold
            obstacles.splice(i, 1);
            addObstacle();
        }
    }
}


function draw() {
    handleControls();
    
    if (!gameOver) {
        // update speed multiplier based on elapsed time
        let now = millis();
        if (!lastMillis) lastMillis = now;
        let dt = now - lastMillis; // milliseconds
        lastMillis = now;
        // ramp the multiplier up to the max over time
        speedMultiplier = Math.min(maxSpeedMultiplier, speedMultiplier + speedRampRate * dt);

        // flying is affected by base speedFactor and the multiplier
        flying -= speedFactor * speedMultiplier;
    }

    let yoff = flying;
    for (let y = 0; y < rows; y++) {
        let xoff = 0;
        for (let x = 0; x < cols; x++) {
            terrain[x][y] = map(noise(xoff, yoff), 0, 1, -100, 100);
            xoff += 0.1;
        }
        yoff += 0.1;
    }

    background(0);
    stroke(200);
    noFill();

    rotateX(PI / 3);
    translate(-w / 2, -h / 2 - 500);

    drawFog();
    drawTerrain();
    drawObstacles();

    ball.velocity += ball.gravity;
    ball.y += ball.velocity;

    let terrainX = constrain(floor(ball.x / scale), 0, cols - 1);
    let terrainZ = constrain(floor(ball.z / scale), 0, rows - 1);

    if (terrainX >= 0 && terrainX < cols && terrainZ >= 0 && terrainZ < rows) {
        let h1 = terrain[terrainX][terrainZ];
        let h2 = terrain[min(terrainX + 1, cols - 1)][terrainZ];
        let h3 = terrain[terrainX][min(terrainZ + 1, rows - 1)];
        let h4 = terrain[min(terrainX + 1, cols - 1)][min(terrainZ + 1, rows - 1)];

        let xFrac = (ball.x % scale) / scale;
        let zFrac = (ball.z % scale) / scale;
        let terrainHeight = 
            h1 * (1 - xFrac) * (1 - zFrac) +
            h2 * xFrac * (1 - zFrac) +
            h3 * (1 - xFrac) * zFrac +
            h4 * xFrac * zFrac;

        let surfaceY = -terrainHeight - ball.radius;

        if (ball.y >= surfaceY) {
            ball.y = surfaceY;
            if (ball.velocity > 0) {
                ball.velocity *= ball.bounce;
            }
            ball.jumping = false;
        }
    }

    for (let obs of obstacles) {
        let ox = obs.x * scale;
        let oz = obs.z;
        let terrainZ = floor(obs.z / scale);
        let terrainX = obs.x;
        let tHeight = (terrainX >= 0 && terrainX < cols && terrainZ >= 0 && terrainZ < rows)
			? terrain[terrainX][terrainZ]
			: 0;

        let obsCenterY = -tHeight;
        let obsTopY = obsCenterY + obs.height / 2;
        let obsBottomY = obsCenterY - obs.height / 2;

        let ballTopY = -ball.y + ball.radius;
        let ballBottomY = -ball.y - ball.radius;

        let hitX = abs(ball.x - ox) < (obs.size / 2 + ball.radius);
        let hitY = ballBottomY < obsTopY && ballTopY > obsBottomY;
        let hitZ = abs(ball.z - oz) < (obs.size / 2 + ball.radius);

        if (!gameOver) {
            if (hitX && hitY && hitZ) {
                gameOver = true;
                gameOverTimer = millis();
                createExplosion(ball.x, ball.y, ball.z);
            }
        }
    }




    let time = millis() / 1000;
    let colorFactor = sin(time * 0.8) * 0.5 + 0.5;

    let speedColorFactor = map(abs(ball.velocity), 0, 20, 0, 1);
    speedColorFactor = constrain(speedColorFactor, 0, 1);

    // Base color that pulses over time and with speed
    let baseR = lerp(100, 255, colorFactor * 0.7 + speedColorFactor * 0.3);
    let baseG = lerp(80, 180, 1 - colorFactor);
    let baseB = lerp(200, 255, speedColorFactor);

    if (!gameOver) {
        // Draw glow (soft outer sphere)
        push();
        translate(ball.x, ball.z, -ball.y);
        fill(baseR, baseG, baseB, 80);
        noStroke();
        sphere(ball.radius);
        pop();

        // Draw main ball
        push();
        translate(ball.x, ball.z, -ball.y);
        fill(baseR, baseG, baseB);
        noStroke();
        sphere(ball.radius);
        pop();
    }

    // === EXPLOSION PARTICLE LOGIC ===
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];

        // Update particle position
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Gravity effect
        p.vy -= 0.05;

        // Fade out
        p.life -= 4;
        if (p.life <= 0) {
            particles.splice(i, 1); // Remove dead particles
            continue;
        }
        
        // Draw particle
        push();
        translate(p.x, p.z, -p.y);
        fill(255, random(150, 200), 0, p.life);  // fiery yellow/orange glow
        noStroke();
        sphere(4);
        pop();
    }

}

function createExplosion(x, y, z) {
    for (let i = 0; i < 500; i++) {
        let p = {
            x: x + random(-50, 50),
            y: y + random(-50, 50),
            z: z + random(-50, 50),
            vx: random(-2, 2),
            vy: random(-2, 2),
            vz: random(-2, 2),
            life: 255
        };
        particles.push(p);
    }
}

function handleControls() {
    if (!gameOver) {
        let moveSpeed = 5;
        if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) {
            ball.x -= moveSpeed;
        }
        if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) {
            ball.x += moveSpeed;
        }
        if (keyIsDown(32) && !ball.jumping) {
            ball.velocity = ball.jumpStrength;
            ball.jumping = true;
        }
    }
}

function keyPressed() {
	if (gameOver && key === 'r') {
		location.reload();  // Simple reload to reset everything
	}
}
