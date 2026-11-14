// Gravity Dash, redrawn as a forest.
// The game is the original /gravity_dash.js: the same hills, speeds, steering and jump, and obstacles that
// spawn the same way. The boxes are now tall thin trees (plus a few rocks you can jump), and the ground
// keeps the original brown, fading into the dark at the far end.
// (An earlier, different 3D attempt is kept beside this file as forest3d-attempt.js. It isn't used.)

const GC = 60;          // one ground square. The original used 30; 60 is a quarter of the drawing work.
const w = 2000;
let cols, rows;
let ground = [];        // ground[r][x]: heights, row 0 is the far edge
let groundRow0 = 0;     // which strip of the endless landscape row 0 is showing
let scroll = 0;         // how far the ground has rolled towards you, in pixels
let obstacles = [];
let particles = [];

const baseObstacleSpeed = 15;
let speedMultiplier = 0.5;
const maxSpeedMultiplier = 1.0;
const speedRampRate = 0.00003;
let lastMillis = 0;
let gameOver = false;
let gameOverTimer = 0;
let best = 0;

const DARK = [9, 14, 12];   // what the far end fades into
const OBSTACLES = 80;       // the trees are thinner than the old boxes, so there are more of them
const ROCK_SHARE = 0.2;     // one in five is a rock, low enough to jump

const ball = { x: w / 2, y: 2000, z: 2200, radius: 20, velocity: 0, gravity: 0.5, bounce: -0.5, jumping: false, jumpStrength: -12 };

const touch = { left: 0, right: 0, hop: false, ids: {} };
const el = id => document.getElementById(id);
function containerSize() {
    const c = el('gravity-dash-canvas') || document.body;
    return [Math.max(300, c.clientWidth || window.innerWidth), Math.max(200, c.clientHeight || window.innerHeight)];
}

function setup() {
    pixelDensity(Math.min(window.devicePixelRatio || 1, 1.5)); // phones don't need to draw every last pixel
    const [cw, ch] = containerSize();
    const canvas = createCanvas(cw, ch, WEBGL);
    canvas.parent(el('gravity-dash-canvas') || document.body);
    frameRate(60);
    cols = floor(w / GC) + 1;
    rows = 52;
    try { best = +localStorage.getItem('gravity-dash-best') || 0; } catch (e) {}
    startGame();

    const side = e => (e.clientX < window.innerWidth / 2 ? 'left' : 'right');
    window.addEventListener('pointerdown', e => {
        if (e.target && e.target.id === 'hop') { e.preventDefault(); if (gameOver) tryRestart(); else touch.hop = true; return; }
        if (gameOver) return tryRestart();
        if (e.pointerType === 'mouse') return;
        const s = side(e); touch.ids[e.pointerId] = s; touch[s]++;
    });
    const up = e => { const s = touch.ids[e.pointerId]; if (s) { touch[s] = Math.max(0, touch[s] - 1); delete touch.ids[e.pointerId]; } };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('message', e => { if (e.data && e.data.type === 'focus') { try { window.focus(); } catch (err) {} } });
}

// ---------- The ground ----------
// The hills are fixed in the landscape and the whole sheet slides towards you, so nothing wobbles.
// (Before, the sheet stood still and the heights were recalculated under it every frame, which is what shimmered.)
function groundStrip(n) {
    const row = new Array(cols);
    for (let x = 0; x < cols; x++) row[x] = map(noise(x * 0.2, 5000 - n * 0.2), 0, 1, -100, 100);
    return row;
}
function fillGround() {
    groundRow0 = floor(scroll / GC);
    ground = [];
    for (let r = 0; r < rows; r++) ground.push(groundStrip(groundRow0 - r));
}
function rollGround() {
    const want = floor(scroll / GC);
    while (groundRow0 < want) { groundRow0++; ground.pop(); ground.unshift(groundStrip(groundRow0)); } // one new strip at the far edge
}
const rowY = r => r * GC + (scroll - groundRow0 * GC) - GC;   // where row r is right now
function heightAt(px, pz) {
    const u = constrain(px / GC, 0, cols - 1.001), v = constrain((pz - rowY(0)) / GC, 0, rows - 1.001);
    const x0 = floor(u), r0 = floor(v), xf = u - x0, zf = v - r0;
    return ground[r0][x0] * (1 - xf) * (1 - zf) + ground[r0][x0 + 1] * xf * (1 - zf) + ground[r0 + 1][x0] * (1 - xf) * zf + ground[r0 + 1][x0 + 1] * xf * zf;
}
function dark(z) { const f = constrain(1 - z / 1000, 0, 1); return f * f; }   // 1 at the far edge, 0 near the ball
function shaded(r, g, b, f) { fill(r + (DARK[0] - r) * f, g + (DARK[1] - g) * f, b + (DARK[2] - b) * f); }

function drawTerrain() {
    const colorFactor = sin(millis() / 1000 * 0.5) * 0.5 + 0.5;   // the original slow change of colour
    const R = 130 + colorFactor * 12, G = 100 + colorFactor * 24, B = 50;
    noStroke();
    for (let r = 0; r < rows - 1; r++) {
        const y0 = rowY(r), y1 = y0 + GC, f0 = dark(y0), f1 = dark(y1), a = ground[r], b = ground[r + 1];
        beginShape(TRIANGLE_STRIP);
        for (let x = 0; x < cols; x++) {
            let d = 0.5 + (a[x] + 100) / 400; shaded(R * d, G * d, B * d, f0); vertex(x * GC, y0, a[x]);
            d = 0.5 + (b[x] + 100) / 400; shaded(R * d, G * d, B * d, f1); vertex(x * GC, y1, b[x]);
        }
        endShape();
    }
}

// ---------- Trees and rocks ----------
function addObstacle() {
    let spawnZ = random(1) < 0.6 ? random(-3000, -1000) : random(-800, -100);   // as in the original
    const rock = random(1) < ROCK_SHARE;
    obstacles.push({
        x: floor(random(2, 64)) * 30,
        z: spawnZ,
        rock,
        size: rock ? random(40, 70) : random(22, 30),   // how wide it is to hit: a rock, or a thin trunk
        rockH: random(38, 60),
        treeH: random(380, 520),
        leafW: random(30, 40),
        tint: random()
    });
}
function drawObstacles() {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        if (!gameOver) obs.z += baseObstacleSpeed * speedMultiplier;
        const ox = obs.x, oz = obs.z;
        if (oz >= 0 && oz < (rows - 2) * GC) {      // it comes out of the dark at the far edge
            const g = heightAt(ox, oz), f = dark(oz), t = obs.tint;
            if (obs.rock) {
                push(); translate(ox, oz, g + obs.rockH * 0.3);
                shaded(84 + t * 20, 86 + t * 18, 90 + t * 16, f);
                ellipsoid(obs.size / 2, obs.size / 2, obs.rockH * 0.75, 10, 8);
                pop();
            } else {
                const th = obs.treeH;
                push(); translate(ox, oz, g + th * 0.3 - 10); rotateX(HALF_PI);
                shaded(70 + t * 18, 48 + t * 14, 32 + t * 8, f);
                cylinder(obs.size / 2 - 2, th * 0.6 + 20, 8, 1);
                pop();
                // a tree that has just gone past and stands between you and the ball pulls its leaves in, so it can't hide the ball
                const near = abs(ox - ball.x) < 150 ? constrain(1 - (oz - ball.z - 10) / 110, 0.12, 1) : 1;
                const lw = obs.leafW * near;
                push(); translate(ox, oz, g + th * 0.55); shaded(18 + t * 10, 70 + t * 16, 40 + t * 8, f); ellipsoid(lw, lw, th * 0.36, 10, 8); pop();
                push(); translate(ox, oz, g + th * 0.82); shaded(14 + t * 8, 60 + t * 14, 36 + t * 8, f); ellipsoid(lw * 0.68, lw * 0.68, th * 0.24, 10, 8); pop();
            }
        }
        if (obs.z > w * 1.5) { obstacles.splice(i, 1); addObstacle(); }
    }
}

// ---------- The game ----------
function startGame() {
    scroll = 0; speedMultiplier = 0.5; lastMillis = 0; gameOver = false;
    obstacles = []; particles = [];
    Object.assign(ball, { x: w / 2, y: 2000, z: 2200, velocity: 0, jumping: false });
    noiseSeed(floor(random(1e6)));
    fillGround();
    for (let i = 0; i < OBSTACLES; i++) addObstacle();
    el('panel').hidden = true;
    el('best').textContent = best ? 'Best ' + best : '';
}
function tryRestart() { if (gameOver && millis() - gameOverTimer > 500) startGame(); }
function windowResized() { const [cw, ch] = containerSize(); resizeCanvas(cw, ch); }

function draw() {
    handleControls();
    if (!gameOver) {
        let now = millis();
        if (!lastMillis) lastMillis = now;
        let dt = now - lastMillis;
        lastMillis = now;
        speedMultiplier = Math.min(maxSpeedMultiplier, speedMultiplier + speedRampRate * dt);
        scroll += baseObstacleSpeed * speedMultiplier;    // the ground and everything on it move together
        rollGround();
    }

    background(DARK[0], DARK[1], DARK[2]);
    perspective(PI / 3, width / height, 10, 12000);
    rotateX(PI / 3);
    translate(-w / 2, -3000 / 2 - 500);

    drawTerrain();
    ambientLight(130, 130, 130);
    directionalLight(190, 185, 170, 0.35, -0.45, -0.8);
    noStroke();
    drawObstacles();

    // the ball: the original physics
    ball.velocity += ball.gravity;
    ball.y += ball.velocity;
    const under = heightAt(ball.x, ball.z);
    const surfaceY = -under - ball.radius;
    if (ball.y >= surfaceY) {
        ball.y = surfaceY;
        if (ball.velocity > 0) ball.velocity *= ball.bounce;
        ball.jumping = false;
    }

    if (!gameOver) {
        const ballBottom = -ball.y - ball.radius;
        for (const obs of obstacles) {
            if (abs(ball.x - obs.x) >= obs.size / 2 + ball.radius || abs(ball.z - obs.z) >= obs.size / 2 + ball.radius) continue;
            // a tree goes all the way up; a rock you can clear with a jump
            if (!obs.rock || ballBottom < heightAt(obs.x, obs.z) + obs.rockH) { crashed(); break; }
        }
    }

    if (!gameOver) {
        // the original ball: a colour that drifts over time and with how fast it is falling
        const colorFactor = sin(millis() / 1000 * 0.8) * 0.5 + 0.5;
        const speedColorFactor = constrain(map(abs(ball.velocity), 0, 20, 0, 1), 0, 1);
        const lift = max(0, -ball.y - ball.radius - under);
        push();
        translate(ball.x, ball.z, under + 3);
        fill(0, 0, 0, 120 - min(80, lift * 0.5));
        ellipse(0, 0, ball.radius * 2, ball.radius * 2, 20);
        pop();
        push();
        translate(ball.x, ball.z, -ball.y);
        fill(lerp(100, 255, colorFactor * 0.7 + speedColorFactor * 0.3), lerp(80, 180, 1 - colorFactor), lerp(200, 255, speedColorFactor));
        sphere(ball.radius, 20, 14);
        pop();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.z += p.vz;
        p.vy -= 0.05;
        p.life -= 4;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        push();
        translate(p.x, p.z, -p.y);
        fill(255, 150 + (i % 5) * 12, 0, p.life);
        sphere(4, 6, 4);
        pop();
    }

    const m = floor(scroll / 20);
    if (m !== draw.shown) { draw.shown = m; el('dist').firstChild.nodeValue = String(m); }
}

function crashed() {
    gameOver = true;
    gameOverTimer = millis();
    createExplosion(ball.x, ball.y, ball.z);
    const m = floor(scroll / 20), isBest = m > best;
    if (isBest) { best = m; try { localStorage.setItem('gravity-dash-best', String(best)); } catch (e) {} }
    el('best').textContent = best ? 'Best ' + best : '';
    el('box').innerHTML = '<p>' + (isBest ? 'New best!' : 'Crashed') + '</p><div class="big">' + m + ' m</div><span class="go">R or tap to go again</span>';
    el('panel').hidden = false;
}
function createExplosion(x, y, z) {
    for (let i = 0; i < 90; i++) {
        particles.push({ x: x + random(-40, 40), y: y + random(-40, 40), z: z + random(-40, 40), vx: random(-2, 2), vy: random(-2, 2), vz: random(-2, 2), life: 255 });
    }
}

function handleControls() {
    if (!gameOver) {
        let moveSpeed = 5;
        if (keyIsDown(65) || keyIsDown(LEFT_ARROW) || touch.left) ball.x -= moveSpeed;
        if (keyIsDown(68) || keyIsDown(RIGHT_ARROW) || touch.right) ball.x += moveSpeed;
        ball.x = constrain(ball.x, ball.radius, w - 20 - ball.radius);   // stay on the ground
        if ((keyIsDown(32) || keyIsDown(UP_ARROW) || keyIsDown(87) || touch.hop) && !ball.jumping) {
            ball.velocity = ball.jumpStrength;
            ball.jumping = true;
        }
    }
    touch.hop = false;
}
function keyPressed() {
    if (gameOver && (key === 'r' || key === 'R' || key === ' ')) tryRestart();
    if ([32, 37, 38, 39, 40].includes(keyCode)) return false;   // don't scroll the page
}
