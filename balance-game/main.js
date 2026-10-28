let meadow;
let cameraTravel = 0;
let altitude = 0;
let bestAltitude = 0;
let zoneIndex = 0;
const HEIGHT_KEY = 'balance-ball-height-v1';
const zones = [
  { name: 'Meadow', from: 0, hazard: 'leaf' },
  { name: 'Treetops', from: 60, hazard: 'kite' },
  { name: 'Cloudbanks', from: 180, hazard: 'plane' },
  { name: 'Sunset', from: 320, hazard: 'balloon' },
  { name: 'Thunderclouds', from: 500, hazard: 'storm' },
  { name: 'Aurora', from: 700, hazard: 'crystal' },
  { name: 'Orbit', from: 950, hazard: 'satellite' },
  { name: 'Meteor Field', from: 1250, hazard: 'asteroid' },
  { name: 'Deep Space', from: 1600, hazard: 'comet' },
];
function zoneAt(height) {
  for(let i=zones.length-1;i>=0;i--) if(height>=zones[i].from) return i;
  return 0;
}
function baseClimbPerTick() { return 1.2 + Math.min(altitude / 600, .6); }
function climbPerTick() { return baseClimbPerTick() * (boostTimer > 0 ? 2.5 : slowTimer > 0 ? .75 : 1); }
function hazardTimeScale() { return boostTimer > 0 ? 1 : slowTimer > 0 ? .55 : 1; }
function obstacleInterval() {
  const density=Math.min(1.7,Math.sqrt(Math.max(1,width/400)));
  return Math.max(42,120/Math.sqrt(1+altitude/350)/density);
}
function spawnNearBeam(radius) { return constrain(width/2+barPosX+random(-radius,radius),45,width-45); }
function lightningActive(o) { return o.kind==='storm' && o.age>=90 && o.age<108; }
function obstacleHitsBall(o,x,y) {
  return circleHitsShard(x,y,15,o) || (lightningActive(o) && Math.abs(x-o.x)<23 && y>=o.y+15);
}
function readAltitudeBest() {
  try { const n = Number(localStorage.getItem(HEIGHT_KEY)); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0; } catch { return 0; }
}
let barAngle = 0;
let barPosX = 0;
let barPosY = 100;
let barVelX = 0; // horizontal velocity for smooth movement
let ballX = 0;
let gravity = 0.42;
let ballSpin = 0;
let ballRotation = 0;
let ballY = -60;
let ballVelX = 0;
let ballVelY = 0;
let gameOver = false;
let obstacles = [];
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
let widenMultiplier = 1.6;
let currentWidenFactor = 1; // smoothed factor used for drawing and pickup sizing
let slowTimer = 0;
let shieldTimer = 0;
let boostTimer = 0;
const BOOST_DURATION = 180;
const WIDE_DURATION = 480, SLOW_DURATION = 480, SHIELD_DURATION = 720;
let shieldGraceTimer = 0;
let hazardSpawnTicks = 0;
let originalGravity = gravity;
// simple scene state: 'menu' or 'playing'
let gameState = "menu";

// menu button layout (computed from canvas size in draw)
const menuButton = {
  w: 160,
  h: 44,
};

let simulationTick = 0;
let animationTick = 0;
let accumulator = 0;
let skipElapsed = true;
let feedback = '';
let feedbackTimer = 0;
const heldKeys = new Set();
const heldPointers = new Map();
const PHONE_CONTROLS_QUERY = '(hover: none) and (pointer: coarse) and (max-width: 700px), (hover: none) and (pointer: coarse) and (max-height: 500px)';
function isPhone() {
  // Embedded viewports can be wider than the physical phone screen.
  const screen = window.screen;
  return matchMedia(PHONE_CONTROLS_QUERY).matches ||
    ((window.navigator?.maxTouchPoints || 0) > 0 && screen && Math.min(screen.width, screen.height) <= 700);
}
const gameplayTouches = new Set();
let dragPointer = null;
let dragStartX = 0, dragStartBeam = 0, dragTarget = null;
let phoneTiltEnabled = false, phoneTiltReady = false;
let tiltNeutral = null, tiltSample = null, tiltTarget = 0;
let motionRequestPending = false;
let automaticMotionAttempted = false;
let motionStatus = '';
let motionAttempt = 0;
function showMotionStatus(message) {
  motionStatus = message;
  document.getElementById('motion-status').textContent = message;
  document.getElementById('motion-status').hidden = !message;
}
function screenRoll(beta, gamma, angle) {
  const radians = angle * Math.PI / 180;
  return gamma * Math.cos(radians) + beta * Math.sin(radians);
}
function receiveTilt(event) {
  if (!phoneTiltEnabled || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  const angle = window.screen?.orientation?.angle ?? window.orientation ?? 0;
  tiltSample = screenRoll(event.beta, event.gamma, angle);
  if (tiltNeutral === null) tiltNeutral = tiltSample;
  const degrees = tiltSample - tiltNeutral;
  tiltTarget = Math.max(-.42, Math.min(.42, (Math.abs(degrees) < 1 ? 0 : degrees) * .018));
  if (!phoneTiltReady) { phoneTiltReady = true; showMotionStatus(''); syncControls(); }
}
function recenterTilt() { tiltNeutral = tiltSample; tiltTarget = 0; }
async function requestPhoneTilt() {
  if (motionRequestPending || phoneTiltEnabled) return;
  automaticMotionAttempted = true;
  if (!window.isSecureContext) {
    showMotionStatus('Phone tilt needs HTTPS. Open the secure website, or use the tilt buttons.'); return;
  }
  const api = window.DeviceOrientationEvent;
  if (!api) { showMotionStatus('Phone tilt is unavailable in this browser. Use the tilt buttons.'); return; }
  motionRequestPending = true;
  const attempt = ++motionAttempt;
  try {
    // Invoke immediately within the user's tap, before changing the UI or awaiting anything.
    const permissionResult = typeof api.requestPermission === 'function' ? api.requestPermission() : Promise.resolve('granted');
    showMotionStatus('Allow motion access to steer by tilting your phone.');
    const permission = await permissionResult;
    if (permission !== 'granted') { showMotionStatus('Motion access was declined. You can still drag and use the tilt buttons.'); return; }
    phoneTiltEnabled = true; phoneTiltReady = false; tiltNeutral = null; tiltSample = null; tiltTarget = 0;
    showMotionStatus('Motion allowed. Hold the phone comfortably and gently tilt it to calibrate.');
    setTimeout(() => {
      if (attempt === motionAttempt && phoneTiltEnabled && !phoneTiltReady) {
        phoneTiltEnabled = false;
        showMotionStatus('No motion signal. Try opening the game in a new tab, or use the tilt buttons.'); syncControls();
      }
    }, 8000);
  } catch {
    showMotionStatus('Motion access was blocked. Try the game in a new tab, or use the tilt buttons.');
  } finally { motionRequestPending = false; syncControls(); }
}
async function enablePhoneTilt() {
  if (motionRequestPending) return;
  if (phoneTiltEnabled) { motionAttempt++; phoneTiltEnabled = false; phoneTiltReady = false; showMotionStatus(''); syncControls(); return; }
  const permission = requestPhoneTilt();
  setPaused(true);
  await permission;
}
async function startFromGesture() {
  if (motionRequestPending) return;
  const shouldRequest = isPhone() && !automaticMotionAttempted && !phoneTiltEnabled;
  // Keep permission invocation in the same synchronous user-gesture call stack.
  const permission = shouldRequest ? requestPhoneTilt() : null;
  startGame();
  if (permission) {
    setPaused(true);
    await permission;
    // A permission prompt may obscure or blur the page; resume explicitly once it closes.
    if (!document.hidden && !gameOver) setPaused(false);
  }
}
function saveBest() {
  bestAltitude = Math.max(bestAltitude, Math.floor(altitude));
  try { localStorage.setItem(HEIGHT_KEY, String(bestAltitude)); } catch {}
}
function isHeld(code) { return heldKeys.has(code) || [...heldPointers.values()].includes(code); }
function clearInput() {
  heldKeys.clear(); heldPointers.clear();
  dragPointer = null; dragTarget = null;
  document.querySelectorAll('[data-control]').forEach(button => button.classList.remove('held'));
}
function announce(message) {
  feedback = message; feedbackTimer = 120;
  document.getElementById('announcement').textContent = message;
}
function syncControls() {
  const motionActive = phoneTiltEnabled && phoneTiltReady;
  document.getElementById('touch-controls').hidden = gameState !== 'playing' || gameOver || (!paused && motionActive);
  document.getElementById('tilt-fallback').hidden = paused || motionActive;
  document.getElementById('touch-hint').textContent = paused ? 'Phone controls' : 'Drag on the game to move';
  document.getElementById('motion').disabled = motionRequestPending;
  document.getElementById('action').disabled = motionRequestPending;
  document.getElementById('motion').textContent = phoneTiltEnabled ? 'Use tilt buttons' : 'Enable phone tilt';
  document.getElementById('recenter').hidden = !paused || !phoneTiltEnabled;
  const action = document.getElementById('action');
  action.textContent = gameState === 'menu' ? 'Play →' : gameOver ? 'Play again' : paused ? 'Resume' : 'Restart';
  action.hidden = gameState !== 'menu';
  const button = document.getElementById('pause');
  button.disabled = gameState === 'menu' || gameOver;
  button.classList.toggle('is-paused', paused);
  button.ariaLabel = button.title = paused ? 'Resume' : 'Pause';
  if(button.style)button.style.color=altitude>=500?'#fff9e7':'#354f45';
  document.querySelectorAll('[data-control]').forEach(button => button.disabled = gameState !== 'playing' || gameOver || paused);
}
function setPaused(value) {
  if (gameState !== 'playing' || gameOver) return;
  paused = value; accumulator = 0; skipElapsed = true; clearInput(); syncControls();
  if (paused) saveBest();
}
function bindTap(button, action) {
  // Handle the native touch release directly; suppress its synthetic click so
  // Pause/Resume and motion toggles cannot fire twice for one tap.
  let lastTouch = -Infinity;
  button.addEventListener('touchend', event => {
    event.preventDefault(); lastTouch = Date.now();
    if (!button.disabled) action();
  }, { passive: false });
  button.addEventListener('click', event => {
    if (Date.now() - lastTouch < 700) return;
    if (!button.disabled) action();
  });
}
function installControls(canvas) {
  window.addEventListener('deviceorientation', receiveTilt);
  document.body?.classList.toggle('phone-controls', isPhone());
  window.screen?.orientation?.addEventListener?.('change', () => { tiltNeutral = null; tiltTarget = 0; clearInput(); setPaused(true); });
  bindTap(document.getElementById('motion'), enablePhoneTilt);
  bindTap(document.getElementById('recenter'), recenterTilt);
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || event.pointerType === 'mouse' || dragPointer !== null || gameState !== 'playing' || paused || gameOver) return;
    event.preventDefault();
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    gameplayTouches.add(event.pointerId);
    dragPointer = event.pointerId; dragStartX = event.clientX; dragStartBeam = barPosX; dragTarget = barPosX;
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== dragPointer) return;
    event.preventDefault();
    const logicalDelta = (event.clientX - dragStartX) * width / canvas.getBoundingClientRect().width;
    dragTarget = constrain(dragStartBeam + logicalDelta, -width/2 + baseBarLength*currentWidenFactor/2, width/2 - baseBarLength*currentWidenFactor/2);
  });
  const endDrag = event => { if(event.pointerId === dragPointer) { dragPointer = null; dragTarget = null; } };
  canvas.addEventListener('pointercancel', event => { gameplayTouches.delete(event.pointerId); endDrag(event); }); canvas.addEventListener('lostpointercapture', endDrag);
  bindTap(document.getElementById('action'), () => paused ? setPaused(false) : startFromGesture());
  bindTap(document.getElementById('pause'), () => setPaused(!paused));
  document.querySelectorAll('[data-control]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') return;
      event.preventDefault(); if (button.disabled) return;
      try { button.setPointerCapture(event.pointerId); } catch {} heldPointers.set(event.pointerId, button.dataset.control); button.classList.add('held');
    });
    button.addEventListener('touchstart', event => {
      event.preventDefault(); if (button.disabled) return;
      for (const touch of event.changedTouches) heldPointers.set('touch-' + touch.identifier, button.dataset.control);
      button.classList.add('held');
    }, { passive: false });
    const releaseTouch = event => {
      event.preventDefault();
      for (const touch of event.changedTouches) heldPointers.delete('touch-' + touch.identifier);
      button.classList.toggle('held', [...heldPointers.values()].includes(button.dataset.control));
    };
    button.addEventListener('touchend', releaseTouch, { passive: false });
    button.addEventListener('touchcancel', releaseTouch, { passive: false });
    const release = event => { heldPointers.delete(event.pointerId); button.classList.toggle('held', [...heldPointers.values()].includes(button.dataset.control)); };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  });
  window.addEventListener('keydown', event => {
    if (event.target instanceof HTMLButtonElement && ['Enter','Space'].includes(event.code)) return;
    if (!['KeyA','KeyD','ArrowLeft','ArrowRight','KeyP','Escape','Enter','Space','KeyR'].includes(event.code)) return;
    event.preventDefault(); if (event.repeat) return;
    if (['KeyP','Escape'].includes(event.code)) { setPaused(!paused); return; }
    if (['Enter','Space','KeyR'].includes(event.code) && (gameState === 'menu' || gameOver)) { startFromGesture(); return; }
    if (event.code === 'Enter' && paused) { setPaused(false); return; }
    if (!paused) heldKeys.add(event.code);
  });
  window.addEventListener('keyup', event => heldKeys.delete(event.code));
  window.addEventListener('blur', () => { clearInput(); setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  window.addEventListener('pagehide', saveBest);
  // Touch Events work in Safari without depending on pointer capture. Keep the
  // gesture on touchend so iOS can show its native motion permission dialog.
  canvas.addEventListener('touchstart', event => {
    event.preventDefault();
    if (dragPointer !== null || gameState !== 'playing' || paused || gameOver) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    dragPointer = 'touch-' + touch.identifier;
    gameplayTouches.add(dragPointer);
    dragStartX = touch.clientX; dragStartBeam = barPosX; dragTarget = barPosX;
  }, { passive: false });
  canvas.addEventListener('touchmove', event => {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      if ('touch-' + touch.identifier !== dragPointer) continue;
      const delta = (touch.clientX - dragStartX) * width / canvas.getBoundingClientRect().width;
      dragTarget = constrain(dragStartBeam + delta, -width/2 + baseBarLength*currentWidenFactor/2, width/2 - baseBarLength*currentWidenFactor/2);
    }
  }, { passive: false });
  const finishTouch = event => {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      const id = 'touch-' + touch.identifier;
      const wasPlaying = gameplayTouches.delete(id);
      endDrag({pointerId: id});
      if (!wasPlaying && event.type !== 'touchcancel') activateCanvas(touch);
    }
  };
  canvas.addEventListener('touchend', finishTouch, { passive: false });
  canvas.addEventListener('touchcancel', finishTouch, { passive: false });
  canvas.addEventListener('pointerup', event => {
    if (event.pointerType === 'touch') return;
    if (gameplayTouches.delete(event.pointerId)) { endDrag(event); return; }
    activateCanvas(event);
  });
  function activateCanvas(event) {
    if (paused) { setPaused(false); return; }
    if (gameOver) { startFromGesture(); return; }
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * width, y = (event.clientY - rect.top) / rect.height * height;
    if (gameState === 'menu' && abs(x - width/2) < 90 && abs(y - height * .82) < 30) startFromGesture();
  }
  syncControls();
}

// small particle helpers
function spawnHitParticles(x, y, count = 12, col = [135, 192, 165]) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: random(-3, 3),
      vy: random(-4, 0),
      life: random(30, 70),
      age: 0,
      size: random(2, 6),
      col,
    });
  }
}

// helper to end the game cleanly: save best height
function endGame() {
  if (!gameOver) {
    gameOver = true;
    saveBest();
    clearInput(); syncControls();
    // Keep rendering the small impact chips after the simulation ends.
  }
}

function startGame() {
  // reset gameplay state for a fresh run
  gameState = "playing";
  gameOver = false;
  obstacles = [];
  powerUps = [];
  particles = [];

  ballX = 0;
  ballY = -60;
  ballVelX = random(-0.8, 0.8);
  ballVelY = 0;
  cameraTravel = 0; altitude = 0; zoneIndex = 0;
  barAngle = 0;
  barPosX = 0;
  barVelX = 0;
  ballSpin = 0;
  ballRotation = 0;
  currentWidenFactor = 1;
  paused = false;

  widenTimer = 0;
  slowTimer = 0;
  shieldTimer = 0;
  boostTimer = 0; shieldGraceTimer = 0; hazardSpawnTicks = 0;
  gravity = originalGravity;

  simulationTick = 0; accumulator = 0; skipElapsed = true;
  feedback = ''; feedbackTimer = 0;
  lastPowerUpFrame = 0; lastSpawnFrame = 0;
  clearInput(); recenterTilt(); syncControls();

  loop();
}

function beamY() { return height - 100; }
function fitPlayfield() {
  const host = document.getElementById('game-canvas');
  const phone = isPhone();
  const box = host.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const nextHeight = phone ? Math.max(1, Math.round(400 * box.height / box.width)) : 500;
  const nextWidth = phone ? 400 : Math.max(1, Math.round(500 * box.width / box.height));
  if (height !== nextHeight || width !== nextWidth) {
    const shiftX = (nextWidth - width) / 2;
    const shift = nextHeight - height;
    // Preserve the distance of active objects from the beam during rotation.
    obstacles.forEach(o => { o.y += shift; o.x += shiftX; });
    powerUps.forEach(p => { p.y += shift; p.x += shiftX; });
    particles.forEach(p => { p.y += shift; p.x += shiftX; });
    resizeCanvas(nextWidth, nextHeight);
  }
}
function windowResized() { fitPlayfield(); }

function setup() {
  const canvas = createCanvas(400, 500);
  canvas.parent("game-canvas");
  document.body.classList.toggle('phone-controls', isPhone());
  fitPlayfield();
  new ResizeObserver(fitPlayfield).observe(document.getElementById("game-canvas"));
  bestAltitude = readAltitudeBest();
  installControls(canvas.elt);
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  frameRate(60);
  textFont("Arial Rounded MT Bold, Trebuchet MS, sans-serif");
  meadow = createMeadow();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  // give the ball a small initial nudge so it doesn't sit perfectly still
  ballVelX = random(-0.8, 0.8);
  ballVelY = 0;
  ballX = random(-5, 5);
}

// A fixed 60 Hz simulation keeps physics, effects and spawns on one clock.
// Rendering can run at any refresh rate. Returning from pause never catches up.
function advanceGame(elapsedMs) {
  if (skipElapsed) { skipElapsed = false; return; }
  if (paused) return;
  accumulator += Math.max(0, Math.min(elapsedMs, 250)) / 1000;
  while (accumulator + 1e-9 >= 1 / 60) {
    accumulator -= 1 / 60;
    animationTick++;
    if (gameState === 'playing' && !gameOver) updateGame();
    stepParticles();
  }
}
function updateGame() {
  simulationTick++;
  const climb = climbPerTick();
  cameraTravel += climb;
  altitude = cameraTravel / 10;
  const nextZone = zoneAt(altitude);
  if (nextZone !== zoneIndex) { zoneIndex = nextZone; announce(zones[zoneIndex].name + ' · ' + Math.floor(altitude) + 'm'); syncControls(); }
  if (feedbackTimer > 0) feedbackTimer--;
  const previousBarX = barPosX, previousBarAngle = barAngle;
  barVelX += (Number(isHeld('KeyD')) - Number(isHeld('KeyA'))) * .48;
  barVelX = dragTarget !== null ? constrain((dragTarget - barPosX) * .25, -4.5, 4.5) : constrain(barVelX * .9, -4.5, 4.5);
  currentWidenFactor = lerp(currentWidenFactor, widenTimer > 0 ? widenMultiplier : 1, .08);
  const maxX = width / 2 - baseBarLength * currentWidenFactor / 2;
  barPosX = constrain(barPosX + barVelX, -maxX, maxX);
  if (abs(barPosX) >= maxX) barVelX = 0;
  if (phoneTiltEnabled && phoneTiltReady) {
    // A stationary device need not emit new orientation events.
    barAngle += (tiltTarget - barAngle) * .12;
  }
  if (!phoneTiltEnabled || !phoneTiltReady) barAngle = constrain(barAngle + (Number(isHeld('ArrowRight')) - Number(isHeld('ArrowLeft'))) * .014, -.42, .42);

  hazardSpawnTicks += hazardTimeScale();
  const spawnInterval=obstacleInterval();
  if (hazardSpawnTicks >= spawnInterval) {
    hazardSpawnTicks -= spawnInterval;
    lastSpawnFrame = simulationTick; obstacles.push(skyObstacle());
  }
  if (simulationTick - lastPowerUpFrame >= powerUpSpawnInterval) {
    lastPowerUpFrame = simulationTick; powerUps.push(spawnPowerUp());
  }
  const ball = stepBalanceBall(
    {x:ballX,y:ballY,vx:ballVelX,vy:ballVelY,spin:ballSpin,rotation:ballRotation},
    {x:barPosX,previousX:previousBarX,angle:barAngle,previousAngle:previousBarAngle,length:baseBarLength*currentWidenFactor}, 1, gravity);
  ballX=ball.x; ballY=ball.y; ballVelX=ball.vx; ballVelY=ball.vy; ballSpin=ball.spin; ballRotation=ball.rotation;
  const bx=width/2+barPosX+ballX, by=beamY()+ballY;
  for (let i=obstacles.length-1;i>=0;i--) {
    const o=obstacles[i];
    moveObstacle(o,climb,hazardTimeScale());
    if (o.y>height+90 || o.x < -100 || o.x > width+100) { obstacles.splice(i,1); continue; }
    if (obstacleHitsBall(o,bx,by)) {
      spawnHitParticles(o.x,o.y,14,[125,139,151]);
      if (boostTimer>0 || shieldGraceTimer>0) { obstacles.splice(i,1); }
      else if (shieldTimer>0) { shieldTimer=0; shieldGraceTimer=60; obstacles.splice(i,1); announce('Shield saved you!'); }
      else { endGame(); return; }
    }
  }
  for (let i=powerUps.length-1;i>=0;i--) {
    const p=powerUps[i]; p.y+=climb;
    if (p.y>height+50) { powerUps.splice(i,1); continue; }
    if (Math.hypot(bx-p.x,by-p.y)<=15+p.size/2) { applyPowerUp(p.type); spawnHitParticles(bx,by,10); powerUps.splice(i,1); }
  }
  if (abs(ballY)>80) { endGame(); return; }
  if (widenTimer>0) widenTimer--;
  if (slowTimer>0 && boostTimer===0) slowTimer--;
  if (shieldTimer>0 && boostTimer===0) shieldTimer--;
  if (shieldGraceTimer>0) shieldGraceTimer--;
  if (boostTimer>0 && --boostTimer===0) announce('Boost finished · watch the obstacles');
}
function draw() {
  advanceGame(deltaTime);
  drawBackdrop(); noStroke();
  if (gameState==='menu') { drawMenu(); return; }
  if (gameOver) { drawFinishedScene(); return; }
  obstacles.forEach(drawObstacle); powerUps.forEach(drawPickup); drawParticles();
  push();translate(width/2+barPosX,beamY());push();rotate(barAngle);drawRail(baseBarLength*currentWidenFactor);pop();
  if(boostTimer>0){
    stroke('#e3974e');strokeWeight(2);noFill();ellipse(ballX,ballY,46);
    for(let i=-1;i<=1;i++){const x=i*55;line(x,15,x,30+(animationTick%12)*2);}
  }
  if(shieldTimer>0 || shieldGraceTimer>0){noFill();stroke(ink);strokeWeight(1);ellipse(ballX,ballY,42);}
  drawBuddy(ballX,ballY,15,ballRotation);pop();drawHeight();drawEffects();
  if(paused){push();noStroke();fill(paper);rect(width/2,height*.44,230,97,2);fill(ink);textAlign(CENTER,CENTER);textSize(25);text('paused',width/2,height*.44-18);textSize(11);text('Tap here or press P to resume',width/2,height*.44+20);pop();}
}
function drawEffects() {
  push();noStroke();fill(altitude>=500?paper:ink);textAlign(CENTER,TOP);textSize(10);
  const effects=[['Wide beam',widenTimer,WIDE_DURATION],['Slow motion',slowTimer,SLOW_DURATION],['Shield',shieldTimer,SHIELD_DURATION],['Boost',boostTimer,BOOST_DURATION]].filter(([,time])=>time>0);
  effects.forEach(([label,time,duration=360],i)=>{const x=width/2+(i-(effects.length-1)/2)*100; fill(altitude>=500?paper:ink); text(label+' '+Math.ceil(time/60)+'s',x,62);fill('#9caeaa');rect(x,79,74,2);fill(ink);rect(x-37+37*time/duration,79,74*time/duration,2);});
  fill(altitude>=500?paper:ink);
  if(feedbackTimer>0) text(feedback,width/2,97);
  pop();
}

const obstaclePools = [
  ['leaf','leaf','seed'], ['kite','bird','seed'], ['plane','plane','bird'],
  ['balloon','balloon','bird'], ['storm','storm','plane'], ['crystal','crystal','comet'],
  ['satellite','satellite','asteroid'], ['asteroid','comet','asteroid'], ['comet','satellite','asteroid'],
];
function moveObstacle(o,climb,factor=1) {
  const previousAge=o.age;
  o.age+=factor;
  o.y+=climb+o.rise*factor;
  if (o.kind==='leaf' || o.kind==='seed' || o.kind==='kite' || o.kind==='balloon') {
    const amplitude={leaf:23,seed:36,kite:30,balloon:12}[o.kind];
    const rate={leaf:.025,seed:.014,kite:.018,balloon:.012}[o.kind];
    o.x+=amplitude*(Math.sin(o.phase+o.age*rate)-Math.sin(o.phase+previousAge*rate));
    o.rotation=Math.sin(o.phase+o.age*rate)*({leaf:.45,seed:.2,kite:.16,balloon:.06}[o.kind]);
  } else {
    o.x+=o.drift*factor;
    if(o.kind==='asteroid' || o.kind==='crystal')o.rotation+=o.spin*factor;
    if(o.kind==='bird')o.y+=.2*(Math.sin(o.age*.045)-Math.sin(previousAge*.045));
  }
}
function skyObstacle(kind=random(obstaclePools[zoneIndex])) {
  // The painted silhouette is also the collision polygon.
  const shapes={
    // Sample a curved, pointed leaf so its collision outline matches the art.
    leaf:Array.from({length:32},(_,i)=>{
      const t=i<=16?i/16:(32-i)/16;
      return [-22+44*t, -4*t + (i<=16?-12:10)*Math.sin(Math.PI*t)];
    }),
    kite:[[0,-25],[18,-3],[0,23],[-18,-3]],
    plane:[[-24,-12],[25,0],[-24,13],[-13,0]],
    balloon:[[-17,-10],[-11,-22],[9,-23],[18,-11],[15,5],[5,20],[-5,20],[-15,5]],
    satellite:[[-29,-13],[-11,-13],[-11,-6],[11,-6],[11,-13],[29,-13],[29,13],[11,13],[11,6],[-11,6],[-11,13],[-29,13]],
    seed:Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8)*3,Math.sin(i*Math.PI/8)*7]),
    bird:Array.from({length:24},(_,i)=>[Math.cos(i*Math.PI/12)*17,Math.sin(i*Math.PI/12)*9]),
    comet:Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8)*15,Math.sin(i*Math.PI/8)*15]),
    storm:[[-30,5],[-32,-5],[-23,-13],[-13,-11],[-7,-23],[9,-24],[20,-13],[29,-10],[34,0],[28,10],[-24,10]],
    crystal:[[0,-23],[13,-5],[9,15],[0,23],[-11,12],[-14,-5]],
    asteroid:[[-22,-8],[-12,-20],[8,-22],[21,-9],[18,13],[4,20],[-16,15]],
  };
  const direction=random()<.5?-1:1;
  const crossing=['plane','bird','satellite','comet'].includes(kind);
  const rise={balloon:-.38,seed:-.15,plane:.15,bird:0,satellite:0,comet:.75,crystal:.2}[kind] || 0;
  const x=crossing?(direction>0?-38:width+38):(random()<.7?spawnNearBeam(165):random(45,width-45));
  const y=crossing?Math.min(beamY()-160,Math.max(45,beamY()-random(210,290))):-42;
  // Birds and paper planes use open-sky lanes, independent of player position.
  const targetX=['bird','plane'].includes(kind) ? random(width*.15,width*.85) : spawnNearBeam(85);
  const travelTicks=(beamY()-25-y)/(baseClimbPerTick()+rise);
  // Choose a path once at spawn. Width changes its speed, never its destination timing.
  const drift=crossing?(targetX-x)/travelTicks:direction*random(.08,.22);
  return {kind,x,y,targetX,travelTicks,
    points:shapes[kind].map(([x,y])=>({x:kind==='bird'?x*direction:x,y})),
    rotation:['plane','comet'].includes(kind)?Math.atan2(baseClimbPerTick()+rise,drift):0,
    spin:random(-.012,.012),drift,rise,direction,age:0,phase:random(0,Math.PI*2),
    tint:random()>.5,
  };
}

// power-up factory
function spawnPowerUp() {
  const available=[['widen',widenTimer],['slow',slowTimer],['shield',shieldTimer],['boost',boostTimer]].filter(([,timer])=>timer===0).map(([type])=>type);
  const types = available.length ? available : ['widen','slow','shield','boost'];
  return {
    type: random(types),
    x: spawnNearBeam(110),
    y: -40,
    size: 32,
    speed: 1.2 + random(0, 0.8),
  };
}

function applyPowerUp(type) {
  announce({widen:'60% wider beam · 8 seconds',slow:'Slow motion · fewer hazards for 8 seconds',shield:'Shield · one hit, up to 12 seconds',boost:'Boost · protected climb for 3 seconds'}[type]);
  if (type === 'widen') widenTimer = WIDE_DURATION;
  else if (type === 'slow') slowTimer = SLOW_DURATION;
  else if (type === 'shield') shieldTimer = SHIELD_DURATION;
  else if (type === 'boost') boostTimer = BOOST_DURATION;
}

// Fixed, slightly irregular contours: the drawing stays still instead of jittering.
const ink = '#354f45';
const paper = '#fff9e7';
function createMeadow() {
  const layer=document.createElement('canvas');layer.width=layer.height=800;
  const c=layer.getContext('2d');c.scale(2,2);
  c.fillStyle='#c7e5e8';c.fillRect(0,0,400,400);
  c.fillStyle='#afc984';c.beginPath();c.moveTo(0,289);c.bezierCurveTo(50,275,91,239,146,252);c.bezierCurveTo(231,265,269,302,400,272);c.lineTo(400,400);c.lineTo(0,400);c.fill();
  c.fillStyle='#84ae72';c.beginPath();c.moveTo(0,345);c.bezierCurveTo(110,360,211,297,283,312);c.bezierCurveTo(345,322,370,330,400,317);c.lineTo(400,400);c.lineTo(0,400);c.fill();
  c.strokeStyle='#5c875b';c.lineWidth=1.2;c.lineCap='round';
  [[29,362],[80,382],[151,352],[239,381],[358,355],[381,388],[17,397]].forEach(([x,y])=>{c.beginPath();c.moveTo(x-4,y-4);c.lineTo(x,y);c.lineTo(x+2,y-6);c.stroke();});
  // Three little flowers, drawn individually rather than scattered as a pattern.
  [[48,379,-1],[322,361,1],[334,374,-1]].forEach(([x,y,lean],i)=>{
    c.strokeStyle=ink;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-2,y-8,x+lean*2,y-15);c.stroke();
    c.fillStyle=i===0?'#fff9e7':'#eaa395';
    const fx=x+lean*2,fy=y-16;
    for(let j=0;j<5;j++){const a=j*Math.PI*2/5;c.beginPath();c.ellipse(fx+Math.cos(a)*2.7,fy+Math.sin(a)*2.7,2.1,1.9,a,0,Math.PI*2);c.fill();}
    c.fillStyle='#e6bc51';c.beginPath();c.arc(fx,fy,1.5,0,Math.PI*2);c.fill();
  });
  return layer;
}
function drawCloud(x,y,size,tint=paper) {
  push();translate(x,y);scale(size);
  const c=drawingContext;c.fillStyle=tint;c.strokeStyle=ink;c.lineWidth=1.1;
  c.beginPath();c.moveTo(-29,8);c.bezierCurveTo(-43,6,-38,-8,-27,-7);c.bezierCurveTo(-28,-25,-6,-27,0,-14);c.bezierCurveTo(10,-24,24,-13,23,-4);c.bezierCurveTo(40,-6,40,9,29,10);c.bezierCurveTo(7,13,-11,8,-29,8);c.closePath();c.fill();c.stroke();
  pop();
}
function drawBackdrop() {
  const travel=gameState==='menu'?0:cameraTravel;
  const h=gameState==='menu'?0:altitude;
  const palette=['#c7e5e8','#c7e5e8','#a9cfe3','#eab7a6','#59677e','#294e62','#28364f','#302e49','#1b233c'];
  const stage=zoneAt(h);
  const sky=lerpColor(color(palette[Math.max(0,stage-1)]),color(palette[stage]),constrain((h-zones[stage].from)/60,0,1));
  background(sky);
  // Foreground terrain drops away faster than distant clouds.
  if(travel*.72<height) drawingContext.drawImage(meadow,0,height-400+travel*.72,width,400);
  if(h>=700) drawSpaceScenery(h,travel);
  if(stage===4) {
    push();drawingContext.globalAlpha=.45;
    for(let i=0;i<5;i++)drawCloud((i+.5)*width/5,90+(i%2)*55,1.7);
    pop();
  }
  if(stage===5) {
    push();noFill();
    for(let band=0;band<3;band++){
      stroke(band===1?'#79c6ae':'#859dc7');strokeWeight(5-band);
      drawingContext.globalAlpha=.35;
      beginShape();for(let x=0;x<=width;x+=8)vertex(x,100+band*28+Math.sin(x*.012+animationTick*.003+band)*32);endShape();
    }pop();
  }
  push();stroke(ink);strokeWeight(1.2);fill('#edc754');
  const sunY=65+Math.min(travel*.014,45)+Math.max(0,h-320)*1.7;
  beginShape();for(let i=0;i<30;i++){const a=i*TWO_PI/30,r=18+sin(i*1.7)*.65;vertex((width-58)+cos(a)*r,sunY+sin(a)*r);}endShape(CLOSE);
  for(let i=0;i<7;i++){const a=i*TWO_PI/7;line((width-58)+cos(a)*27,sunY+sin(a)*27,(width-58)+cos(a)*33,sunY+sin(a)*33);}pop();
  push();drawingContext.globalAlpha=constrain((550-h)/180,0,1);
  for(let i=0;i<(gameState==='menu'?2:4);i++) {
    const y=gameState==='menu'?[111,186][i]:((111+i*173+travel*(.22+i*.025)+80)%(height+200))-80;
    drawCloud([.1475,.725,.3575,.8875][i]*width,y,[.9,.48,.65,.8][i]);
  }
  pop();
  // Trees are foreground scenery, in front of the sun and distant clouds.
  if(gameState!=='menu') {
    drawTree(-12,height-35+travel*.85,440,.9);
    drawTree(width+11,height+250+travel*.5,1050,1);
    drawTree(-17,height+150+travel*.5,1000,.9);
  }
  // Altitude ticks make the ascent readable even in open sky.
  if(gameState!=='menu') {
    push();const tickInk=h>=500?paper:ink;stroke(tickInk);strokeWeight(.7);fill(tickInk);textSize(7);textAlign(LEFT,CENTER);
    const first=Math.floor(altitude/10)*10;
    for(let mark=first;mark<=altitude+beamY()/10;mark+=10){const y=beamY()-(mark-altitude)*10;if(y>65&&y<height-10){line(0,y,7,y);noStroke();text(mark+'m',10,y);stroke(tickInk);}}
    pop();
  }
}
function drawSpaceScenery(h,travel) {
  push();noStroke();
  const fade=constrain((h-700)/90,0,1);
  fill(255,249,231,200*fade);
  for(let i=0;i<42;i++){
    const x=(i*97+29)%width,y=((i*71+travel*.035)%(height+70))-35;
    ellipse(x,y,i%7===0?2.5:1.2);
  }
  // A distant moon, followed by the curve of the world below.
  if(h>950){fill(242,235,204,220*constrain((h-950)/80,0,1));ellipse(322,115,42);fill(193,189,177,120);ellipse(315,110,8);ellipse(330,120,5);}
  if(h>950){
    const horizon=height+10-Math.min(35,(h-950)*.1);
    const earthWidth=Math.max(1080,width*1.4);
    fill('#a9cfe3');ellipse(width/2,horizon+330,earthWidth,710);
    fill('#6e9daa');ellipse(width/2,horizon+336,earthWidth-20,710);
    // Land shares the planet's coordinates and cannot spill into the sky.
    const c=drawingContext;c.save();c.beginPath();
    c.ellipse(width/2,horizon+336,(earthWidth-20)/2,355,0,0,Math.PI*2);c.clip();
    fill('#84ae92');ellipse(width/2-earthWidth*.16,horizon+20,earthWidth*.16,24);
    ellipse(width/2+earthWidth*.12,horizon+12,earthWidth*.10,18);
    c.restore();
  }
  pop();
}
function drawTree(x,base,treeHeight,scaleFactor) {
  if(base-treeHeight*scaleFactor>height+160||base<-100)return;
  push();translate(x,base);scale(scaleFactor);
  const c=drawingContext;
  // One rounded crown, with a few overlapping boughs rather than stacked blobs.
  c.fillStyle='#b98d63';c.strokeStyle='#6e7950';c.lineWidth=1.1;
  c.beginPath();c.moveTo(-11,0);c.bezierCurveTo(-8,-treeHeight*.42,-12,-treeHeight*.7,-3,-treeHeight+55);
  c.lineTo(6,-treeHeight+55);c.bezierCurveTo(2,-treeHeight*.65,9,-treeHeight*.3,14,0);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#b98d63';c.lineWidth=9;c.lineCap='round';
  c.beginPath();c.moveTo(0,-treeHeight+185);c.quadraticCurveTo(-24,-treeHeight+158,-47,-treeHeight+129);
  c.moveTo(2,-treeHeight+211);c.quadraticCurveTo(37,-treeHeight+184,61,-treeHeight+150);c.stroke();
  c.translate(0,-treeHeight+75);
  c.fillStyle='#84b276';c.strokeStyle='#5c875b';c.lineWidth=1.2;
  c.beginPath();c.moveTo(-60,95);
  c.bezierCurveTo(-106,97,-123,50,-100,22);
  c.bezierCurveTo(-129,-11,-100,-57,-68,-52);
  c.bezierCurveTo(-68,-94,-21,-110,3,-85);
  c.bezierCurveTo(34,-109,76,-83,73,-52);
  c.bezierCurveTo(115,-56,137,-15,113,16);
  c.bezierCurveTo(141,49,116,90,81,88);
  c.bezierCurveTo(58,120,19,115,5,98);
  c.bezierCurveTo(-16,117,-46,115,-60,95);c.closePath();c.fill();c.stroke();
  // Broad sunlit patches share the crown's curves, with no noisy leaf texture.
  c.fillStyle='#a4c882';c.beginPath();c.moveTo(-95,-10);
  c.bezierCurveTo(-105,-34,-82,-55,-61,-46);c.bezierCurveTo(-63,-81,-27,-96,-4,-72);
  c.bezierCurveTo(28,-94,63,-71,62,-45);c.bezierCurveTo(90,-48,107,-26,99,-9);
  c.bezierCurveTo(64,-27,58,14,25,7);c.bezierCurveTo(-10,-6,-27,30,-54,11);
  c.bezierCurveTo(-70,1,-83,5,-95,-10);c.fill();
  c.strokeStyle='#6b9a65';c.lineWidth=1.2;c.beginPath();
  c.moveTo(-77,56);c.quadraticCurveTo(-55,75,-34,58);
  c.moveTo(41,61);c.quadraticCurveTo(66,77,87,57);c.stroke();
  pop();
}
function drawRail(length) {
  push();stroke(ink);strokeWeight(1.3);fill('#d6a16a');
  beginShape();vertex(-length/2,-9);vertex(length/2-2,-10);vertex(length/2,9);vertex(-length/2+1,10);endShape(CLOSE);
  stroke('#a5744e');strokeWeight(.8);line(-length/2+11,3,-27,4);line(34,1,length/2-12,0);
  noFill();ellipse(-length/2+26,1,9,3);
  stroke(ink);strokeWeight(1);line(0,-8,0,-3); // Small balance reference, not a scoring zone.
  pop();
}
function drawBuddy(x,y,radius,rotation) {
  push();translate(x,y);scale(radius/15);
  const danger=gameState==='playing'&&(gameOver||abs(ballX)>75);
  fill('#edc754');stroke(ink);strokeWeight(1.25);
  // A softly uneven outline still follows the circular physics body.
  beginShape();for(let i=0;i<36;i++){const a=i*TWO_PI/36,r=15+sin(i*.7)*.25;vertex(cos(a)*r,sin(a)*r);}endShape(CLOSE);
  push();rotate(rotation);noFill();stroke('#cba13f');strokeWeight(.8);arc(0,0,25,25,.5,1);pop();
  rotate(gameState==='menu'?sin(animationTick*.022)*.07:constrain(ballVelX*.05,-.3,.3));
  fill(ink);noStroke();
  const blink=animationTick%230>223&&!danger;
  if(blink){rect(-5,-1,3,.8);rect(5,-1,3,.8);}else{ellipse(-5,-1,2.4,3.5);ellipse(5,-2,2.6,3.6);}
  stroke(ink);strokeWeight(1.05);noFill();
  if(danger){ellipse(1,5,3.2,4.2);line(-7,-6,-3,-7);line(3,-8,7,-6);}
  else {beginShape();vertex(-3,4);quadraticVertex(0,8,4,3);endShape();}
  pop();
}
function shardPath(points) {
  drawingContext.beginPath();points.forEach((p,i)=>i?drawingContext.lineTo(p.x,p.y):drawingContext.moveTo(p.x,p.y));drawingContext.closePath();
}
function drawObstacle(obs) {
  push();translate(obs.x,obs.y);rotate(obs.rotation);
  if(obs.kind==='seed') {
    // The fine parachute is airy decoration; only the little seed is solid.
    const c=drawingContext;c.strokeStyle='#6f8b65';c.lineWidth=.8;
    c.beginPath();c.moveTo(0,-3);c.quadraticCurveTo(3,-13,0,-19);c.stroke();
    for(let i=0;i<9;i++){
      const a=Math.PI+i*Math.PI/8,x=Math.cos(a)*19,y=-21+Math.sin(a)*15;
      c.beginPath();c.moveTo(0,-19);c.quadraticCurveTo(x*.5,y+4,x,y);c.stroke();
      c.strokeStyle=paper;c.lineWidth=1.4;c.beginPath();
      c.moveTo(x-3,y-3);c.lineTo(x,y);c.lineTo(x+3,y-3);c.stroke();
      c.strokeStyle='#6f8b65';c.lineWidth=.8;
    }
    fill('#b98d63');stroke('#776346');strokeWeight(.8);ellipse(0,0,6,14);
    pop();return;
  }
  if(obs.kind==='bird') {
    // A stable body is the hitbox. The softly flapping wing is decorative.
    scale(obs.direction,1);const flap=Math.sin(obs.age*.13+obs.phase);
    stroke('#536f78');strokeWeight(1);fill('#8eafb6');
    triangle(-13,0,-25,-5,-22,5);ellipse(0,0,34,18);
    noStroke();fill('#e5e5c8');ellipse(6,4,17,6);
    fill('#d6a16a');triangle(15,-3,24,0,15,2);
    stroke('#536f78');fill('#a9c5c4');
    beginShape();vertex(-7,0);bezierVertex(-13,-8*flap-4,-10,-22*flap,-4,-23*flap);bezierVertex(3,-17*flap,7,-5*flap,5,1);endShape(CLOSE);
    fill(ink);noStroke();ellipse(11,-3,2.5,2.5);
    pop();return;
  }
  if(obs.kind==='storm') {
    const active=lightningActive(obs);
    if(obs.age<108){
      const c=drawingContext;c.strokeStyle=active?'#fff2aa':'#d9c990';c.lineWidth=active?5:1;
      c.setLineDash(active?[]:[4,7]);c.beginPath();c.moveTo(0,15);c.lineTo(0,height-obs.y);c.stroke();c.setLineDash([]);
      if(!active){noStroke();fill('#fff2aa');textAlign(CENTER,CENTER);textSize(13);text('!',0,28);}
    }
    drawCloud(0,0,.85,'#8796a7');pop();return;
  }
  if(obs.kind==='comet') {
    noStroke();fill('#e9c98b');beginShape();vertex(-9,-9);vertex(-66,0);vertex(-9,9);endShape(CLOSE);
    fill(paper);triangle(-10,-4,-45,0,-10,4);
  }
  shardPath(obs.points);drawingContext.fillStyle=({storm:'#8796a7',crystal:'#acd8dc',seed:paper,bird:'#7c9ca3',comet:'#edc754',leaf:obs.tint?'#91b765':'#bdc879',kite:obs.tint?'#eaa395':'#9dbcb4',plane:paper,balloon:'#eaa395',satellite:'#a9cfe3',asteroid:'#b6aba0'})[obs.kind];
  drawingContext.fill();drawingContext.strokeStyle=ink;drawingContext.lineWidth=1.25;drawingContext.stroke();
  stroke(ink);strokeWeight(.8);noFill();
  if(obs.kind==='leaf'){
    stroke('#597a47');strokeWeight(.9);
    // Follow the midpoint between the two sampled edges, tip to tip.
    const veinY=x=>{const t=(x+22)/44;return -4*t-Math.sin(Math.PI*t);};
    beginShape();vertex(-28,1);
    for(let i=0;i<=16;i++){const x=-22+44*i/16;vertex(x,veinY(x));}
    endShape();
    beginShape();vertex(-8,veinY(-8));quadraticVertex(-5,-6,-3,-10);endShape();
    beginShape();vertex(1,veinY(1));quadraticVertex(5,1,10,4);endShape();
  }else if(obs.kind==='comet'){
    fill('#d9ae5e');noStroke();ellipse(4,-3,5,4);ellipse(-5,5,4,3);
  }else if(obs.kind==='crystal'){
    stroke('#568eac');line(0,-23,0,23);line(-14,-5,0,2);line(13,-5,0,2);
  }else if(obs.kind==='storm'){
    stroke('#5a687c');line(-17,3,-7,3);line(8,2,19,2);
  }else if(obs.kind==='kite'){
    line(0,-25,0,23);line(-18,-3,18,-3);
    // The thin tail is decoration; the solid kite is the hazard.
    beginShape();vertex(0,23);bezierVertex(15,31,-12,39,0,48);endShape();
    line(-4,34,4,38);line(4,34,-4,38);
  }else if(obs.kind==='plane'){
    line(-24,-12,-6,0);line(-6,0,25,0);line(-6,0,-24,13);
  }else if(obs.kind==='balloon'){
    line(-6,19,-4,28);line(6,19,4,28);fill('#d6a16a');rect(0,30,9,6);
    noFill();arc(0,-2,18,39,-1.5,1.5);arc(0,-2,18,39,1.7,4.6);
  }else if(obs.kind==='satellite'){
    fill('#8299bc');rect(-20,0,17,24);rect(20,0,17,24);line(-20,-12,-20,12);line(20,-12,20,12);line(-28,0,-12,0);line(12,0,28,0);
    fill(paper);rect(0,0,14,10);line(0,-5,4,-14);ellipse(4,-14,3);
  }else if(obs.kind==='asteroid'){
    fill('#978f89');ellipse(-7,-6,9,7);ellipse(8,5,6,5);noFill();arc(-7,-6,9,7,3.3,5.8);
  }
  pop();
}
function drawPickup(p) {
  const colors={widen:'#91d6a0',slow:'#8ed2ed',shield:'#f3d46c',boost:'#ffb478'};
  const pulse=(Math.sin(animationTick*.065)+1)/2;
  push();translate(p.x,p.y);
  // A quiet halo and a consistent badge distinguish pickups from hazards.
  noStroke();fill(255,249,231,25+pulse*12);ellipse(0,0,p.size+5+pulse*2);
  stroke(paper);strokeWeight(2);fill(colors[p.type]);ellipse(0,0,p.size);
  noFill();stroke('#416653');strokeWeight(.8);ellipse(0,0,p.size-5);
  stroke(ink);strokeWeight(2);noFill();
  if(p.type==='widen') {
    line(-9,0,9,0);line(-9,0,-5,-4);line(-9,0,-5,4);line(9,0,5,-4);line(9,0,5,4);
  } else if(p.type==='slow') {
    ellipse(0,0,16);line(0,0,0,-5);line(0,0,4,2);
  } else if(p.type==='shield') {
    beginShape();vertex(0,-9);vertex(8,-6);vertex(7,2);quadraticVertex(5,7,0,10);quadraticVertex(-5,7,-7,2);vertex(-8,-6);endShape(CLOSE);
  } else {
    noStroke();fill(ink);beginShape();vertex(2,-10);vertex(-7,2);vertex(-1,2);vertex(-3,10);vertex(7,-2);vertex(1,-2);endShape(CLOSE);
  }
  pop();
}
function drawMenu() {
  push();textAlign(CENTER,CENTER);noStroke();textFont('Trebuchet MS, sans-serif');fill(ink);
  push();translate(width/2,53);rotate(-.025);textStyle(BOLD);textSize(32);text('A Little Higher',0,0);pop();
  textStyle(NORMAL);
  push();translate(width/2,height*.43);rotate(sin(animationTick*.018)*.04);drawRail(192);drawBuddy(0,-32,22,animationTick*.008);pop();
  fill(ink);textSize(12);if(matchMedia(PHONE_CONTROLS_QUERY).matches){text('Drag to move. Allow motion to tilt your phone.',width/2,height*.60);}else{text('A / D  move',width/2-46,height*.60);text('← / →  tilt',width/2+57,height*.60);}
  textSize(10);text('From the meadow to space. How far can you go?',width/2,height*.67);
  // The matching DOM Play button handles focus and touch permission gestures.
  noStroke();textStyle(NORMAL);textSize(9);text('click here or press enter',width/2,height*.82+35);pop();
}
function drawHeight() {
  push();noStroke();fill(altitude>=500?paper:ink);textFont('Trebuchet MS, sans-serif');
  textAlign(LEFT,TOP);textSize(9);text('height ↑',20,13);textSize(23);textStyle(BOLD);text(Math.floor(altitude)+'m',20,25);textStyle(NORMAL);
  textAlign(CENTER,TOP);textSize(9);text(zones[zoneIndex].name,width/2,16);
  textAlign(RIGHT,TOP);text('best '+bestAltitude+'m',width-20,13);
  pop();
}
function stepParticles() {
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.vy+=.12;p.x+=p.vx;p.y+=p.vy;p.age++;if(p.age>p.life)particles.splice(i,1);}
}
function drawParticles() {
  push();noStroke();for(const p of particles){fill(...p.col,map(p.age,0,p.life,210,0));push();translate(p.x,p.y);rotate(p.age*.08);triangle(-p.size/2,p.size/2,p.size/2,p.size/2,0,-p.size/2);pop();}pop();
}
function drawFinishedScene() {
  obstacles.forEach(drawObstacle);powerUps.forEach(drawPickup);drawParticles();
  push();translate(width/2+barPosX,beamY());push();rotate(barAngle);drawRail(baseBarLength*currentWidenFactor);pop();drawBuddy(ballX,ballY,15,ballRotation);pop();drawHeight();
  push();noStroke();fill(paper);rect(width/2,height*.44,240,103,2);fill(ink);textAlign(CENTER,CENTER);textFont('Trebuchet MS, sans-serif');textStyle(BOLD);textSize(26);text('oops.',width/2,height*.44-22);textStyle(NORMAL);textSize(11);text(Math.floor(altitude)+'m climbed',width/2,height*.44+6);textSize(12);text('tap to retry · R to restart',width/2,height*.44+32);pop();
}
