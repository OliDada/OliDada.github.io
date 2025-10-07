let barAngle = 0;
let barPosX = 0;
let barPosY = 100;
let barVelX = 0; // horizontal velocity for smooth movement
let ballX = 0;
let gravity = 0.3;
let ballY = -60;
let ballVelX = 0;
let ballVelY = 0;
let gameOver = false;
let score = 0;
let obstacles = [];
let highScore = 0;
let baseSpawnInterval = 120; // lower = more frequent
let lastSpawnFrame = 0;
let obstacleBaseSpeed = 2;
let shakeTimer = 0;
let shakeDuration = 20;
let shakeStrength = 8;
let flashAlpha = 0;
let particles = [];
let paused = false;
// power-up system
let powerUps = [];
let powerUpSpawnInterval = 600; // frames between power-up spawns (~10s at 60fps)
let lastPowerUpFrame = 0;
let baseBarLength = 200;
let widenTimer = 0;
let widenMultiplier = 1.5;
let currentWidenFactor = 1; // smoothed factor used for drawing and pickup sizing
let slowTimer = 0;
let shieldTimer = 0;
let originalGravity = gravity;
// occasional gusts/wind to nudge the ball and make tilting meaningful
let lastGustFrame = 0;
let gustIntervalBase = 600; // frames between gusts (~10s)
let gustDuration = 24; // frames the gust is active
let gustTimer = 0;
let gustForce = 0;
let gustStrengthBase = 1.5;
// indicator hold so arrow stays visible a bit after gust starts/ends
let indicatorHoldTimer = 0;
let indicatorHoldDuration = 60; // frames to keep the indicator visible (~1s)
// visual wind streaks
let windStreaks = [];
let windSpawnRate = 3; // frames between spawning streaks while gusting

// simple scene state: 'menu' or 'playing'
let gameState = "menu";

// menu button layout (computed from canvas size in draw)
const menuButton = {
  w: 160,
  h: 44,
};

// runtime menu layout + interaction state (populated each frame when drawing menu)
let menuLayout = {};
// visual press timers for keys: A, LEFT, RIGHT, D
let keyPressTimers = { A: 0, LEFT: 0, RIGHT: 0, D: 0 };
const keyPressDuration = 12; // frames for pressed animation

// small particle helpers
function spawnHitParticles(x, y, count = 12) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: random(-3, 3),
      vy: random(-4, 0),
      life: random(30, 70),
      age: 0,
      size: random(2, 6),
      col: [255, 100, 50],
    });
  }
}

// helper to end the game cleanly: update high score, stop draw loop
function endGame() {
  if (!gameOver) {
    gameOver = true;
    if (score > highScore) highScore = score;
    noLoop(); // stop p5 draw updates
  }
}

function startGame() {
  // reset gameplay state for a fresh run
  gameState = "playing";
  gameOver = false;
  obstacles = [];
  powerUps = [];
  particles = [];
  windStreaks = [];

  ballX = 0;
  ballY = -60;
  ballVelX = random(-0.8, 0.8);
  ballVelY = 0;
  score = 0;
  barAngle = 0;

  widenTimer = 0;
  slowTimer = 0;
  shieldTimer = 0;
  gravity = originalGravity;

  gustTimer = 0;
  gustForce = 0;
  indicatorHoldTimer = 0;
  lastGustFrame = frameCount;

  lastPowerUpFrame = frameCount;
  lastSpawnFrame = frameCount;

  loop();
}

function setup() {
  createCanvas(400, 400);
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  // give the ball a small initial nudge so it doesn't sit perfectly still
  ballVelX = random(-0.8, 0.8);
  ballVelY = 0;
  ballX = random(-5, 5);
}

function draw() {
  let bgColor = lerpColor(
    color(100, 180, 255),
    color(200, 60, 80),
    constrain(score / 100, 0, 1)
  );
  background(bgColor);
  noStroke();

  // If we're in the menu scene, draw menu and exit early
  if (gameState === "menu") {
    push();
    // dim background
    fill(12, 18, 24, 200);
    rectMode(CORNER);
    rect(0, 0, width, height);

    // layout positions (responsive)
    const titleY = height * 0.14;
    const previewY = height * 0.26;
    const controlsY = height * 0.46; // move controls up a bit
    const captionY = controlsY + 56; // give caption more space below
    const playY = height * 0.82; // push Play a bit lower

    // title
    textAlign(CENTER, CENTER);
    fill(255);
    textSize(30);
    text("Balance Ball", width / 2, titleY);

    // small gameplay preview (bar + ball) centered above the controls; add subtle animation
    push();
    const previewX = width / 2;
    const previewScale = 0.7;
    // animation: slow bob for the ball and small sway for the bar
    const bob = sin(frameCount * 0.08) * 3;
    const sway = sin(frameCount * 0.02) * 0.04; // radians
    translate(previewX, previewY);
    rotate(sway);
    // draw bar (scaled down)
  push();
  // ensure rects are drawn centered for the preview
  rectMode(CENTER);
    const prevBarWidth =
      baseBarLength * previewScale * (widenTimer > 0 ? widenMultiplier : 1);
    // shadow
    noStroke();
    fill(0, 0, 0, 30);
    rect(
      6 * previewScale,
      8 * previewScale,
      prevBarWidth,
      18 * previewScale,
      6 * previewScale
    );
    // main bar
    stroke(28);
    strokeWeight(1.2);
    fill(240);
    rect(0, 0, prevBarWidth, 20 * previewScale, 8 * previewScale);
    // scoring band
    noStroke();
    fill(255, 180, 60);
    rect(0, 0, 20 * previewScale, 12 * previewScale, 4 * previewScale);
    // ball sitting near center of bar (with bob)
    push();
    translate(0, -12 * previewScale + bob);
    noStroke();
    fill(0, 120, 255);
    ellipse(0, 0, 30 * previewScale, 30 * previewScale);
    // highlight
    fill(255, 255, 255, 180);
    ellipse(
      -6 * previewScale,
      -6 * previewScale,
      6 * previewScale,
      6 * previewScale
    );
    pop();
    pop();
    pop();

  // stylized controls row: A / ← / → / D keycaps with a mini-bar graphic
  const cx = width / 2;
  const ctrlY = controlsY;
  push();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  // keycaps: A, left arrow, right arrow, D
  fill(36);
  // sizes
  const kw = 52;
  const kh = 36;
  // mini-bar width (narrower) and spacing from inner keys
  const miniBarW = 160;
  const innerPad = 12; // space between mini-bar and inner keycaps
  // center the mini-bar at canvas center
  const innerCenter = cx;
  const kx2 = innerCenter - (miniBarW / 2 + innerPad + kw / 2);
  const kx3 = innerCenter + (miniBarW / 2 + innerPad + kw / 2);
  // outer keys placed further out with extra gap
  const outerGap = 48;
  const kx1 = kx2 - (kw + outerGap);
  const kx4 = kx3 + (kw + outerGap);
  const ky = ctrlY;
    // detect hover for visual feedback
    const mx = mouseX;
    const my = mouseY;
    const hover1 =
      mx > kx1 - kw / 2 &&
      mx < kx1 + kw / 2 &&
      my > ky - kh / 2 &&
      my < ky + kh / 2;
    const hover2 =
      mx > kx2 - kw / 2 &&
      mx < kx2 + kw / 2 &&
      my > ky - kh / 2 &&
      my < ky + kh / 2;
    const hover3 =
      mx > kx3 - kw / 2 &&
      mx < kx3 + kw / 2 &&
      my > ky - kh / 2 &&
      my < ky + kh / 2;
    const hover4 =
      mx > kx4 - kw / 2 &&
      mx < kx4 + kw / 2 &&
      my > ky - kh / 2 &&
      my < ky + kh / 2;
    // visual fill when hovered or pressed
    rect(kx1, ky, kw, kh, 8);
    rect(kx2, ky, kw, kh, 8);
    rect(kx3, ky, kw, kh, 8);
    rect(kx4, ky, kw, kh, 8);
    // labels
    fill(255);
    textSize(16);
    // pressed scale (small shrink) when key timer active
    const sA = 1 - 0.06 * constrain(keyPressTimers.A / keyPressDuration, 0, 1);
    push();
    translate(kx1, ky);
    scale(sA);
    text("A", 0, 0);
    pop();
    // left arrow glyph in keycap 2 (use text glyph for consistent centering)
    push();
    fill(255);
    noStroke();
    translate(kx2, ky);
    const sL = 1 - 0.06 * constrain(keyPressTimers.LEFT / keyPressDuration, 0, 1);
    push();
    scale(sL);
    textSize(20);
    text('←', 0, 0);
    pop();
    pop();
    // right arrow glyph in keycap 3 (use text glyph for consistent centering)
    push();
    fill(255);
    noStroke();
    translate(kx3, ky);
    const sR = 1 - 0.06 * constrain(keyPressTimers.RIGHT / keyPressDuration, 0, 1);
    push();
    scale(sR);
    textSize(20);
    text('→', 0, 0);
    pop();
    pop();
    const sD = 1 - 0.06 * constrain(keyPressTimers.D / keyPressDuration, 0, 1);
    push();
    translate(kx4, ky);
    scale(sD);
    text("D", 0, 0);
    pop();

    // mini bar between the inner keys (centered at innerCenter)
    noStroke();
    fill(240);
    rect(innerCenter, ctrlY, miniBarW, 14, 10);
    // 2x scoring band (center)
    fill(255, 180, 60);
    rect(innerCenter, ctrlY, 52, 12, 8);

    // store layout for input handlers
    menuLayout = {
      kx1,
      kx2,
      kx3,
      kx4,
      ky,
      kw,
      kh,
      innerCenter,
      ctrlY,
      playX: width / 2 - menuButton.w / 2,
      playY,
      playW: menuButton.w,
      playH: menuButton.h,
    };
    pop();

    // caption under controls (centered with mini-bar)
    fill(200);
    textSize(12);
    text("A  /  ←   (bar)   →  /  D", innerCenter, captionY);

    // decrement key press timers
    for (let k of Object.keys(keyPressTimers)) {
      if (keyPressTimers[k] > 0) keyPressTimers[k]--;
    }

    // Play button (use CORNER coordinates for hit testing)
    const bx = width / 2 - menuButton.w / 2;
    const by = playY - menuButton.h / 2;
    fill(255, 200, 60);
    rect(bx, by, menuButton.w, menuButton.h, 8);
    fill(30);
    textSize(18);
    text("Play", width / 2, by + menuButton.h / 2);
    pop();
    return;
  }

  push();

  // smooth horizontal input: use velocity + damping instead of instant jumps
  // tune these for responsiveness vs smoothness
  const accel = 0.6;
  const maxSpeed = 6;
  if (keyIsDown(65)) barVelX -= accel; // A
  if (keyIsDown(68)) barVelX += accel; // D
  // friction / damping
  barVelX *= 0.85;
  barVelX = constrain(barVelX, -maxSpeed, maxSpeed);
  barPosX += barVelX;
  // keep bar inside visible area (bar length can change when widened)
  // smooth widen factor early so physics uses the visual size
  const targetWidenEarly = widenTimer > 0 ? widenMultiplier : 1;
  currentWidenFactor = lerp(currentWidenFactor, targetWidenEarly, 0.08);
  const maxX = width / 2 - (baseBarLength * currentWidenFactor) / 2;
  barPosX = constrain(barPosX, -maxX, maxX);

  // difficulty scaling: reduce spawn interval and increase obstacle speed with score
  // Spawn obstacles in global coordinates (not relative to the bar)
  if (!gameOver && frameCount % 120 === 0) {
    obstacles.push(fallingObstacles());
  }

  const difficultyFactor = 1 + score * 0.01; // gentle ramp
  const spawnInterval = max(
    20,
    floor(baseSpawnInterval / sqrt(difficultyFactor))
  );
  if (!gameOver && frameCount - lastSpawnFrame >= spawnInterval) {
    lastSpawnFrame = frameCount;
    const o = fallingObstacles();
    // increase fall speed based on difficulty
    o.speed = obstacleBaseSpeed * (0.8 + difficultyFactor * 0.6);
    obstacles.push(o);
  }

  // Update and draw obstacles in global canvas space so they don't move with the bar
  if (obstacles.length > 0) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      // improved obstacle look: shadow + rounded rect + slight wobble
      push();
      const wobble = sin((frameCount + obs.x) * 0.03) * 3;
      translate(obs.x, obs.y + wobble);
      // main body
      stroke(40, 10, 10);
      strokeWeight(1.2);
      fill(220, 60, 60);
      // rounded rectangle for nicer look
      rect(0, 0, obs.width, obs.height, 8);
      // subtle top highlight
      pop();
      // move obstacle down; if slow power-up active, slow their fall
      const _speedFactor = slowTimer > 0 ? 0.45 : 1;
      obs.y += (obs.speed || 2) * _speedFactor; // move obstacle down (uses speed if set)
      if (obs.y > height + 200) obstacles.splice(i, 1);
    }
  }

  // power-up spawn
  if (!gameOver && frameCount - lastPowerUpFrame >= powerUpSpawnInterval) {
    lastPowerUpFrame = frameCount;
    powerUps.push(spawnPowerUp());
  }

  // compute ball global position for pickup checks (works even before we translate)
  const globalBallX = ballX + (width / 2 + barPosX);
  const globalBallY = ballY + (height / 2 + 100);

  // update & draw power-ups (global coords)
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    // choose base color per type
    let baseCol = [200, 200, 200];
    if (p.type === "widen") baseCol = [100, 200, 255];
    else if (p.type === "slow") baseCol = [180, 255, 150];
    else if (p.type === "shield") baseCol = [255, 220, 80];
    else if (p.type === "score") baseCol = [255, 120, 200];
    // draw circular power-up with an icon
    push();
    translate(p.x, p.y);
    noStroke();
    // outer circle / pill (with alpha)
    fill(baseCol[0], baseCol[1], baseCol[2], 220);
    ellipse(0, 0, p.size * 1.15, p.size * 1.15);
    // inner rim for depth
    fill(255, 255, 255, 18);
    ellipse(-p.size * 0.06, -p.size * 0.06, p.size * 0.9, p.size * 0.9);

    // draw symbol in center depending on type
    noStroke();
    if (p.type === "widen") {
      // double arrow left-right
      fill(255);
      beginShape();
      vertex(-p.size * 0.28, -p.size * 0.08);
      vertex(-p.size * 0.05, -p.size * 0.08);
      vertex(-p.size * 0.05, -p.size * 0.18);
      vertex(p.size * 0.18, 0);
      vertex(-p.size * 0.05, p.size * 0.18);
      vertex(-p.size * 0.05, p.size * 0.08);
      vertex(-p.size * 0.28, p.size * 0.08);
      endShape(CLOSE);
      beginShape();
      vertex(p.size * 0.28, -p.size * 0.08);
      vertex(p.size * 0.05, -p.size * 0.08);
      vertex(p.size * 0.05, -p.size * 0.18);
      vertex(-p.size * 0.18, 0);
      vertex(p.size * 0.05, p.size * 0.18);
      vertex(p.size * 0.05, p.size * 0.08);
      vertex(p.size * 0.28, p.size * 0.08);
      endShape(CLOSE);
    } else if (p.type === "slow") {
      // simple clock icon
      fill(255);
      ellipse(0, 0, p.size * 0.5, p.size * 0.5);
      stroke(40);
      strokeWeight(2);
      // hands
      line(0, 0, 0, -p.size * 0.18);
      line(0, 0, p.size * 0.12, 0);
      noStroke();
    } else if (p.type === "shield") {
      // shield shape
      fill(255);
      beginShape();
      vertex(-p.size * 0.18, -p.size * 0.22);
      vertex(p.size * 0.18, -p.size * 0.22);
      vertex(p.size * 0.26, -p.size * 0.02);
      vertex(0, p.size * 0.26);
      vertex(-p.size * 0.26, -p.size * 0.02);
      endShape(CLOSE);
    } else if (p.type === "score") {
      // star-like shape
      fill(255, 220, 40);
      push();
      rotate(frameCount * 0.005);
      beginShape();
      for (let a = 0; a < TWO_PI; a += TWO_PI / 5) {
        const r1 = p.size * 0.18;
        const r2 = p.size * 0.08;
        vertex(cos(a) * r1, sin(a) * r1);
        vertex(cos(a + TWO_PI / 10) * r2, sin(a + TWO_PI / 10) * r2);
      }
      endShape(CLOSE);
      pop();
    }

    pop();
    p.y += p.speed;
    if (p.y > height + 50) powerUps.splice(i, 1);

    // pickup test: circle vs AABB
    const rx1 = p.x - p.size / 2;
    const ry1 = p.y - p.size / 2;
    const rx2 = p.x + p.size / 2;
    const ry2 = p.y + p.size / 2;
    const nearestX = constrain(globalBallX, rx1, rx2);
    const nearestY = constrain(globalBallY, ry1, ry2);
    const dx = globalBallX - nearestX;
    const dy = globalBallY - nearestY;
    const pickRadius = 12 * currentWidenFactor;
    if (dx * dx + dy * dy <= pickRadius * pickRadius) {
      applyPowerUp(p.type);
      spawnHitParticles(globalBallX, globalBallY, 10);
      powerUps.splice(i, 1);
    }
  }

  // update & draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 0.12; // gravity
    p.x += p.vx;
    p.y += p.vy;
    p.age++;
    noStroke();
    fill(p.col[0], p.col[1], p.col[2], map(p.age, 0, p.life, 255, 0));
    ellipse(p.x, p.y, p.size);
    if (p.age > p.life) particles.splice(i, 1);
  }

  // isolate transformations so push/pop calls match
  push();
  translate(width / 2 + barPosX, height / 2 + 100);
  // Update game state when running
  if (!gameOver) {
    if (paused) {
      // show paused overlay but skip physics updates
    } else {
      if (keyIsDown(LEFT_ARROW)) barAngle -= 0.02;
      if (keyIsDown(RIGHT_ARROW)) barAngle += 0.02;

      // Integrate velocities (vertical gravity applied; horizontal moves with current velocities)
      // occasional gusts: spawn every so often with some randomness
      if (frameCount - lastGustFrame > gustIntervalBase + random(-180, 180)) {
        lastGustFrame = frameCount;
        gustTimer = gustDuration + floor(random(-4, 6));
        indicatorHoldTimer = indicatorHoldDuration; // keep arrow visible when gust starts
        // gust direction: -1 left, 1 right
        const dir = random() < 0.5 ? -1 : 1;
        gustForce = dir * (gustStrengthBase + random(-0.6, 1.2));
        // seed a few wind streaks immediately
        for (let s = 0; s < 6; s++) {
          windStreaks.push({
            x: random(width),
            y: random(height * 0.2, height * 0.8),
            length: random(40, 140),
            age: 0,
            life: random(40, 90),
            speed: gustForce * random(0.6, 1.2),
            alpha: 180,
          });
        }
      }

      // apply gust while active (adds directly to horizontal acceleration)
      if (gustTimer > 0) {
        // gust fades over its lifetime
        const gFrac = gustTimer / gustDuration;
        ballVelX += gustForce * 0.06 * gFrac; // tweak multiplier for feel
        // occasionally spawn streaks during gust
        if (frameCount % windSpawnRate === 0) {
          windStreaks.push({
            x: gustForce > 0 ? -40 : width + 40,
            y: random(height * 0.15, height * 0.85),
            length: random(40, 120),
            age: 0,
            life: random(40, 100),
            speed: gustForce * random(0.6, 1.4),
            alpha: 200,
          });
        }
        gustTimer--;
      }

      // We'll always apply gravity to vertical velocity; when colliding we'll convert it to tangential motion
      ballVelY += gravity;
      ballX += ballVelX;
      ballY += ballVelY;

      // collision: compute bar geometry and find closest point on bar segment to ball
      // define bar geometry local to this block (respect the smoothed widen factor)
      let barLength = baseBarLength * currentWidenFactor;
      let halfThickness = 10; // half of bar height
      let ballRadius = 15;
      // unit tangent vector along the bar
      let tangent = createVector(cos(barAngle), sin(barAngle));
      // endpoints of the bar in local coordinates (centered at origin)
      let p1 = createVector(
        (-barLength / 2) * cos(barAngle),
        (-barLength / 2) * sin(barAngle)
      );
      let p2 = createVector(
        (barLength / 2) * cos(barAngle),
        (barLength / 2) * sin(barAngle)
      );

      let ballPos = createVector(ballX, ballY);
      let seg = p5.Vector.sub(p2, p1);
      let len2 = seg.magSq();
      let t = 0;
      if (len2 > 0) {
        t = p5.Vector.dot(p5.Vector.sub(ballPos, p1), seg) / len2;
        t = constrain(t, 0, 1);
      }
      let closest = p5.Vector.add(p1, p5.Vector.mult(seg, t));
      let diff = p5.Vector.sub(ballPos, closest);
      let dist = diff.mag();

      if (dist < ballRadius + halfThickness) {
        // collision detected
        let normal;
        if (dist === 0) {
          // fallback normal: bar's normal
          normal = createVector(-tangent.y, tangent.x);
        } else {
          normal = diff.copy().normalize();
        }

        // push ball out of penetration
        let penetration = ballRadius + halfThickness - dist;
        ballPos.add(p5.Vector.mult(normal, penetration));
        ballX = ballPos.x;
        ballY = ballPos.y;

        // resolve velocity: separate into normal and tangent components
        let vel = createVector(ballVelX, ballVelY);
        let vn = p5.Vector.dot(vel, normal);
        let velNormal = p5.Vector.mult(normal, vn);
        let velTangent = p5.Vector.sub(vel, velNormal);

        // remove inward normal component (no penetration velocity)
        if (vn < 0) {
          // bounce factor (0 = no bounce)
          let restitution = 0.0;
          velNormal.mult(-restitution);
        } else {
          // if moving away, keep normal component
          velNormal.mult(0);
        }

        // apply friction on tangent
        velTangent.mult(0.995);

        // convert gravity into tangential acceleration along the bar
        let gravityVec = createVector(0, gravity);
        let at = p5.Vector.dot(gravityVec, tangent); // scalar
        velTangent.add(p5.Vector.mult(tangent, at * 0.6));

        let newVel = p5.Vector.add(velTangent, velNormal);
        ballVelX = newVel.x;
        ballVelY = newVel.y;
      } else {
        // when not colliding, apply air damping to horizontal velocity
        ballVelX *= 0.995;
      }

      if (obstacles.length > 0) {
        // convert ball position (local) to global canvas coordinates
        const globalBallX = ballX + (width / 2 + barPosX);
        const globalBallY = ballY + (height / 2 + 100);
        for (let i = obstacles.length - 1; i >= 0; i--) {
          const obs = obstacles[i];
          // circle vs AABB (rectangle) collision test
          const rx1 = obs.x - obs.width / 2;
          const ry1 = obs.y - obs.height / 2;
          const rx2 = obs.x + obs.width / 2;
          const ry2 = obs.y + obs.height / 2;
          const nearestX = constrain(globalBallX, rx1, rx2);
          const nearestY = constrain(globalBallY, ry1, ry2);
          const dx = globalBallX - nearestX;
          const dy = globalBallY - nearestY;
          if (dx * dx + dy * dy <= ballRadius * ballRadius) {
            if (shieldTimer > 0) {
              // consume shield and destroy obstacle
              shieldTimer = 0;
              obstacles.splice(i, 1);
            } else {
              endGame();
              break;
            }
          }
        }
      }

      // Increment score over time
      if (frameCount % 30 === 0) {
        if (abs(ballX) < 10 && frameCount % 15 === 0) score += 2;
        else score++;
      }

      // If ball falls off the platform, end the game
      if (abs(ballY) > 80) {
        endGame();
      }
    }

    // decrement power-up timers and expire effects
    if (widenTimer > 0) widenTimer--;
    if (slowTimer > 0) {
      slowTimer--;
      if (slowTimer === 0) gravity = originalGravity;
    }
    if (shieldTimer > 0) shieldTimer--;

    if (indicatorHoldTimer > 0) indicatorHoldTimer--;

    // (smoothing already applied earlier so physics and visuals match)
  }

  // Draw the bar (rotated). Respect widen power-up.
  push();
  rotate(barAngle);
  // rounded bar with stroke and highlight
  const currentBarWidth =
    baseBarLength * (widenTimer > 0 ? widenMultiplier : 1);
  // scoring indicator: show the 2x zone (matches scoring check abs(ballX) < 10)
  const scoreZoneHalf = 10;

  // shadow slightly below the bar
  push();
  noStroke();
  fill(0, 0, 0, 20);
  rect(2, 6, currentBarWidth, 18, 10);
  pop();

  // main bar body
  stroke(28);
  strokeWeight(1.4);
  fill(240);
  rect(0, 0, currentBarWidth, 20, 10);

  // scoring band overlay (drawn after main bar so it's visible)
  push();
  // steady band (no pulse)
  const bandAlpha = 180;
  noStroke();
  fill(255, 180, 60, bandAlpha);
  rect(0, 0, scoreZoneHalf * 2, 16, 6);
  // subtle outline for contrast
  stroke(30, 20);
  strokeWeight(0.8);
  noFill();
  rect(0, 0, scoreZoneHalf * 2 + 4, 18, 6);
  pop();

  pop();

  // Draw the ball
  // If shield active, draw a slightly larger translucent circle that fades with time
  if (shieldTimer > 0) {
    const shieldDuration = 60 * 6; // should match applyPowerUp duration
    const frac = constrain(shieldTimer / shieldDuration, 0, 1);
    const shieldDiam = 30 * 1.6; // slightly larger than ball
    push();
    noFill();
    stroke(255, 255, 200, 160 * frac); // pale warm glow with alpha
    strokeWeight(3);
    ellipse(ballX, ballY, shieldDiam, shieldDiam);
    pop();
  }
  fill(0, 120, 255);
  // drop shadow (in local coordinates)

  // ball body with radial-like shading (approx)
  push();
  translate(ballX, ballY);
  noStroke();
  // base
  fill(0, 120, 255);
  ellipse(0, 0, 30, 30);
  // rim light
  fill(120, 200, 255, 30);
  ellipse(-6, -6, 18, 10);
  // specular highlight
  fill(255, 255, 255, 200);
  ellipse(-8, -8, 6, 6);
  pop();

  // restore world transforms so UI is drawn in screen space
  pop();

  // Draw UI in screen space so it doesn't move with the bar
  push();
  // draw top-centered UI in screen coordinates
  textAlign(CENTER, TOP);
  fill(255);
  textSize(16);
  // high score at very top center
  text("High Score: " + highScore, width / 2, 8);
  // status / score below the high score
  if (gameOver) {
    textSize(24);
    text("Game Over", width / 2, 40);
    textSize(14);
    text("Press 'R' to Restart", width / 2, 72);
  } else {
    textSize(20);
    text("Score: " + score, width / 2, 40);
  }

  // 2x indicator: show a pulsing badge near the score when ball is within the 2x zone
  const inTwoZone = abs(ballX) < 10;
  if (!gameOver && inTwoZone) {
    const badgeX = width / 2 + 90;
    const badgeY = 40;
    const pulse = (sin(frameCount * 0.22) + 1) * 0.5; // 0..1
    push();
    translate(badgeX, badgeY);
    noStroke();
    // glowing background
    fill(255, 190, 50, 120 + 80 * pulse);
    ellipse(0, 0, 28 + 8 * pulse, 20 + 6 * pulse);
    // bright core
    fill(255, 200, 80, 220);
    ellipse(0, 0, 18 + 6 * pulse, 14 + 4 * pulse);
    // text
    fill(30);
    textSize(12 + 2 * pulse);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text("2x", 0, 0);
    textStyle(NORMAL);
    pop();
  }

  pop();

  // draw wind streaks (screen space, behind the indicator)
  push();
  // subtle additive-ish look
  for (let i = windStreaks.length - 1; i >= 0; i--) {
    const s = windStreaks[i];
    s.age++;
    // move based on speed (screen-space movement)
    s.x += s.speed * 1.2;
    // fade and shrink a bit
    const lifeFrac = 1 - s.age / s.life;
    const a = s.alpha * constrain(lifeFrac, 0, 1);
    stroke(255, 240, 200, a * 0.85);
    strokeWeight(2.2);
    // draw a tapered line in direction of movement
    push();
    translate(s.x, s.y);
    const dir = s.speed < 0 ? -1 : 1;
    for (let k = 0; k < 4; k++) {
      const t = k / 3;
      stroke(255, 240, 200, a * (1 - t) * 0.8);
      line(
        -dir * (s.length * t),
        -k * 0.6,
        -dir * (s.length * (t + 0.05)),
        k * 0.6
      );
    }
    pop();
    if (s.age > s.life || s.x < -200 || s.x > width + 200)
      windStreaks.splice(i, 1);
  }
  pop();
}

function fallingObstacles() {
  // Placeholder for future obstacle implementation
  let obstacle = {
    x: random(width),
    y: -400,
    width: random(20, 80),
    height: 20,
  };
  return obstacle;
}

// power-up factory
function spawnPowerUp() {
  const types = ["widen", "slow", "shield", "score"];
  return {
    type: random(types),
    x: random(50, width - 50),
    y: -40,
    size: 18,
    speed: 1.2 + random(0, 0.8),
  };
}

function applyPowerUp(type) {
  // durations in frames
  if (type === "widen") {
    widenTimer = 60 * 6; // 6 seconds
  } else if (type === "slow") {
    slowTimer = 60 * 6;
    gravity = originalGravity * 0.4; // stronger slow effect
  } else if (type === "shield") {
    shieldTimer = 60 * 6;
  } else if (type === "score") {
    score += 10;
  }
}

function keyPressed() {
  // If we're in the menu, allow Enter/Space or 'P' to start and show key press visuals
  if (gameState === "menu") {
    if (key === " " || key === "Enter" || key === "p" || key === "P") {
      startGame();
    }
    // visual feedback for keys
    if (key === "a" || key === "A") keyPressTimers.A = keyPressDuration;
    if (keyCode === LEFT_ARROW) keyPressTimers.LEFT = keyPressDuration;
    if (keyCode === RIGHT_ARROW) keyPressTimers.RIGHT = keyPressDuration;
    if (key === "d" || key === "D") keyPressTimers.D = keyPressDuration;
    return;
  }

  // when playing, allow restart on R only if gameOver
  if (gameOver) {
    if (key === "r" || key === "R") {
      startGame();
    }
  }
}

function touchMoved() {
  if (touches.length > 0) {
    let touchXPos = touches[0].x;
    barVelX += (touchXPos - width / 2) * 0.0005;
  }
  return false;
}

function mousePressed() {
  // if on menu and click on Play button area, start
  if (gameState === "menu") {
    const playY = height * 0.8;
    const bx = width / 2 - menuButton.w / 2;
    const by = playY - menuButton.h / 2;
    if (
      mouseX >= bx &&
      mouseX <= bx + menuButton.w &&
      mouseY >= by &&
      mouseY <= by + menuButton.h
    ) {
      startGame();
    }
  }
}

function mouseMoved() {
  // detect hover on keycaps and set a tiny timer so hover shows pressed look briefly
  if (gameState !== "menu") return;
  // compute same positions as menu draw
  const cx = width / 2;
  const ctrlY = height * 0.46;
  const kx1 = cx - 150;
  const kx2 = cx - 60;
  const kx3 = cx + 60;
  const kx4 = cx + 150;
  const kw = 52;
  const kh = 36;
  if (
    mouseX > kx1 - kw / 2 &&
    mouseX < kx1 + kw / 2 &&
    mouseY > ctrlY - kh / 2 &&
    mouseY < ctrlY + kh / 2
  )
    keyPressTimers.A = 2;
  if (
    mouseX > kx2 - kw / 2 &&
    mouseX < kx2 + kw / 2 &&
    mouseY > ctrlY - kh / 2 &&
    mouseY < ctrlY + kh / 2
  )
    keyPressTimers.LEFT = 2;
  if (
    mouseX > kx3 - kw / 2 &&
    mouseX < kx3 + kw / 2 &&
    mouseY > ctrlY - kh / 2 &&
    mouseY < ctrlY + kh / 2
  )
    keyPressTimers.RIGHT = 2;
  if (
    mouseX > kx4 - kw / 2 &&
    mouseX < kx4 + kw / 2 &&
    mouseY > ctrlY - kh / 2 &&
    mouseY < ctrlY + kh / 2
  )
    keyPressTimers.D = 2;
}

function touchStarted() {
  // treat touch like mouse press for keycap feedback
  mousePressed();
  return false;
}
