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
let baseBarLength = 150;
let widenTimer = 0;
let widenMultiplier = 1.5;
let currentWidenFactor = 1; // smoothed factor used for drawing and pickup sizing
let slowTimer = 0;
let shieldTimer = 0;
let originalGravity = gravity;

// small particle helpers
function spawnHitParticles(x,y,count=12){
  for(let i=0;i<count;i++){
    particles.push({
      x, y,
      vx: random(-3,3),
      vy: random(-4,0),
      life: random(30,70),
      age: 0,
      size: random(2,6),
      col: [255,100,50]
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
    let bgColor = lerpColor(color(100,180,255), color(200,60,80), constrain(score/100,0,1));
    background(bgColor);
    noStroke();

    // global camera shake offset
    let shakeX = 0, shakeY = 0;
    if (shakeTimer > 0) {
      const t = shakeTimer / shakeDuration;
      const s = t * (1 - t); // ease out
      shakeX = random(-1,1) * shakeStrength * s;
      shakeY = random(-1,1) * shakeStrength * s;
      shakeTimer--;
    }
    
    push();
    translate(shakeX, shakeY);

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
  const targetWidenEarly = (widenTimer > 0) ? widenMultiplier : 1;
  currentWidenFactor = lerp(currentWidenFactor, targetWidenEarly, 0.08);
  const maxX = width / 2 - (baseBarLength * currentWidenFactor) / 2;
    barPosX = constrain(barPosX, -maxX, maxX);

    // difficulty scaling: reduce spawn interval and increase obstacle speed with score
    // Spawn obstacles in global coordinates (not relative to the bar)
    if (!gameOver && frameCount % 120 === 0) {
        obstacles.push(fallingObstacles());
    }

    const difficultyFactor = 1 + score * 0.01; // gentle ramp
    const spawnInterval = max(20, floor(baseSpawnInterval / sqrt(difficultyFactor)));
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
            fill(255, 0, 0);
            // draw using global coordinates
            rect(obs.x, obs.y, obs.width, obs.height);
            obs.y += obs.speed || 2; // move obstacle down (uses speed if set)
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
    // simple visual: colored rectangle depending on type
    noStroke();
    if (p.type === 'widen') fill(100,200,255);
    else if (p.type === 'slow') fill(180,255,150);
    else if (p.type === 'shield') fill(255,220,80);
    else if (p.type === 'score') fill(255,120,200);
    rect(p.x, p.y, p.size, p.size);
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
    if (dx * dx + dy * dy <= (pickRadius * pickRadius)) {
      applyPowerUp(p.type);
      spawnHitParticles(globalBallX, globalBallY, 10);
      powerUps.splice(i, 1);
    }
  }

    // update & draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += 0.12; // gravity
      p.x += p.vx; p.y += p.vy;
      p.age++;
      noStroke();
      fill(p.col[0], p.col[1], p.col[2], map(p.age,0,p.life,255,0));
      ellipse(p.x, p.y, p.size);
      if (p.age > p.life) particles.splice(i,1);
    }

    // isolate transformations so push/pop calls match
    push();
    translate(width / 2 + barPosX, height / 2 + 100);
    // Update game state when running
    if (!gameOver) {
        if (paused) {
          // show paused overlay but skip physics updates
        } else {
          if (keyIsDown(LEFT_ARROW)) barAngle -= 0.05;
          if (keyIsDown(RIGHT_ARROW)) barAngle += 0.05;

          // Integrate velocities (vertical gravity applied; horizontal moves with current velocities)
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
          let p1 = createVector(-barLength / 2 * cos(barAngle), -barLength / 2 * sin(barAngle));
          let p2 = createVector(barLength / 2 * cos(barAngle), barLength / 2 * sin(barAngle));

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
              let penetration = (ballRadius + halfThickness) - dist;
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
              if (dx * dx + dy * dy <= (ballRadius * ballRadius)) {
                if (shieldTimer > 0) {
                  // consume shield and destroy obstacle
                  shieldTimer = 0;
                  obstacles.splice(i,1);
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

  // (smoothing already applied earlier so physics and visuals match)
      }

  // Draw the bar (rotated). Respect widen power-up.
  push();
  rotate(barAngle);
  fill(200);
  const currentBarWidth = baseBarLength * (widenTimer > 0 ? widenMultiplier : 1);
  rect(0, 0, currentBarWidth, 20);
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
    ellipse(ballX, ballY, 30, 30);

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

    
    pop();
    
}


function fallingObstacles() {
    // Placeholder for future obstacle implementation
    let obstacle = {
        x: random(width),
        y: -400,
        width: random(20, 80),
        height: 20
    };
    return obstacle;
}

// power-up factory
function spawnPowerUp() {
  const types = ['widen','slow','shield','score'];
  return {
    type: random(types),
    x: random(50, width - 50),
    y: -40,
    size: 18,
    speed: 1.2 + random(0,0.8)
  };
}

function applyPowerUp(type) {
  // durations in frames
  if (type === 'widen') {
    widenTimer = 60 * 6; // 6 seconds
  } else if (type === 'slow') {
    slowTimer = 60 * 6;
    gravity = originalGravity * 0.6;
  } else if (type === 'shield') {
    shieldTimer = 60 * 6;
  } else if (type === 'score') {
    score += 10;
  }
}


function keyPressed() {
    if (key === 'r' || key === 'R') {
        // restart: reset state and resume draw loop
        gameOver = false;
        obstacles = [];
        ballX = 0;
        ballY = -60;
        ballVelX = random(-0.8, 0.8);
        ballVelY = 0;
        score = 0;
        barAngle = 0;
        loop(); // resume p5 draw updates
    }
}

function touchMoved() {
  if (touches.length > 0) {
    let touchXPos = touches[0].x;
    barVelX += (touchXPos - width / 2) * 0.0005;
  }
  return false;
}