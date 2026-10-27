let meadow;
let cameraTravel = 0;
let altitude = 0;
let bestAltitude = 0;
let zoneIndex = 0;
const HEIGHT_KEY = 'balance-ball-height-v1';
const zones = [
  { name: 'Meadow', from: 0, hazard: 'leaf' },
  { name: 'Treetops', from: 60, hazard: 'kite' },
  { name: 'Above the clouds', from: 180, hazard: 'plane' },
  { name: 'Sunset', from: 320, hazard: 'balloon' },
  { name: 'Thin air', from: 500, hazard: 'satellite' },
  { name: 'Space', from: 750, hazard: 'asteroid' },
];
function zoneAt(height) {
  for(let i=zones.length-1;i>=0;i--) if(height>=zones[i].from) return i;
  return 0;
}
function climbPerTick() { return (1.2 + Math.min(altitude / 600, .6)) * (slowTimer > 0 ? .45 : 1); }
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

let simulationTick = 0;
let animationTick = 0;
let accumulator = 0;
let skipElapsed = true;
let nextGustTick = 600;
let feedback = '';
let feedbackTimer = 0;
const heldKeys = new Set();
const heldPointers = new Map();
const PHONE_CONTROLS_QUERY = '(hover: none) and (pointer: coarse) and (max-width: 700px), (hover: none) and (pointer: coarse) and (max-height: 500px)';
function saveBest() {
  bestAltitude = Math.max(bestAltitude, Math.floor(altitude));
  try { localStorage.setItem(HEIGHT_KEY, String(bestAltitude)); } catch {}
}
function isHeld(code) { return heldKeys.has(code) || [...heldPointers.values()].includes(code); }
function clearInput() {
  heldKeys.clear(); heldPointers.clear();
  document.querySelectorAll('[data-control]').forEach(button => button.classList.remove('held'));
}
function announce(message) {
  feedback = message; feedbackTimer = 120;
  document.getElementById('announcement').textContent = message;
}
function syncControls() {
  document.getElementById('touch-controls').hidden = gameState !== 'playing' || gameOver || paused;
  const action = document.getElementById('action');
  action.textContent = gameState === 'menu' ? 'Play' : gameOver ? 'Play again' : paused ? 'Resume' : 'Restart';
  action.hidden = gameState === 'playing' && !gameOver;
  const button = document.getElementById('pause');
  button.disabled = gameState === 'menu' || gameOver;
  button.textContent = paused ? 'Resume' : 'Pause';
  document.querySelectorAll('[data-control]').forEach(button => button.disabled = gameState !== 'playing' || gameOver || paused);
}
function setPaused(value) {
  if (gameState !== 'playing' || gameOver) return;
  paused = value; accumulator = 0; skipElapsed = true; clearInput(); syncControls();
  if (paused) saveBest();
}
function installControls(canvas) {
  document.getElementById('action').addEventListener('click', () => paused ? setPaused(false) : startGame());
  document.getElementById('pause').addEventListener('click', () => setPaused(!paused));
  document.querySelectorAll('[data-control]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault(); if (button.disabled) return;
      button.setPointerCapture(event.pointerId); heldPointers.set(event.pointerId, button.dataset.control); button.classList.add('held');
    });
    const release = event => { heldPointers.delete(event.pointerId); button.classList.toggle('held', [...heldPointers.values()].includes(button.dataset.control)); };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  });
  window.addEventListener('keydown', event => {
    if (event.target instanceof HTMLButtonElement && ['Enter','Space'].includes(event.code)) return;
    if (!['KeyA','KeyD','ArrowLeft','ArrowRight','KeyP','Escape','Enter','Space','KeyR'].includes(event.code)) return;
    event.preventDefault(); if (event.repeat) return;
    if (['KeyP','Escape'].includes(event.code)) { setPaused(!paused); return; }
    if (['Enter','Space','KeyR'].includes(event.code) && (gameState === 'menu' || gameOver)) { startGame(); return; }
    if (event.code === 'Enter' && paused) { setPaused(false); return; }
    if (!paused) heldKeys.add(event.code);
  });
  window.addEventListener('keyup', event => heldKeys.delete(event.code));
  window.addEventListener('blur', () => { clearInput(); setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  window.addEventListener('pagehide', saveBest);
  canvas.addEventListener('pointerup', event => {
    if (paused) { setPaused(false); return; }
    if (gameOver) { startGame(); return; }
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * width, y = (event.clientY - rect.top) / rect.height * height;
    if (gameState === 'menu' && abs(x - 200) < 90 && abs(y - height * .82) < 30) startGame();
  });
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
  windStreaks = [];

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
  gravity = originalGravity;

  gustTimer = 0;
  gustForce = 0;
  indicatorHoldTimer = 0;
  lastGustFrame = 0;

  simulationTick = 0; accumulator = 0; skipElapsed = true;
  nextGustTick = 600; feedback = ''; feedbackTimer = 0;
  lastPowerUpFrame = 0; lastSpawnFrame = 0;
  clearInput(); syncControls();

  loop();
}

function beamY() { return height - 100; }
function fitPlayfield() {
  const host = document.getElementById('game-canvas');
  const portrait = matchMedia('(max-width:700px) and (orientation:portrait)').matches;
  const box = host.getBoundingClientRect();
  const nextHeight = portrait ? Math.max(1, Math.round(400 * box.height / box.width)) : 500;
  if (height !== nextHeight) {
    const shift = nextHeight - height;
    // Preserve the distance of active objects from the beam during rotation.
    obstacles.forEach(o => o.y += shift);
    powerUps.forEach(p => p.y += shift);
    particles.forEach(p => p.y += shift);
    resizeCanvas(400, nextHeight);
  }
}
function windowResized() { fitPlayfield(); }

function setup() {
  const canvas = createCanvas(400, 500);
  canvas.parent("game-canvas");
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
  if (nextZone !== zoneIndex) { zoneIndex = nextZone; announce(zones[zoneIndex].name + ' · ' + Math.floor(altitude) + 'm'); }
  if (feedbackTimer > 0) feedbackTimer--;
  const previousBarX = barPosX, previousBarAngle = barAngle;
  barVelX += (Number(isHeld('KeyD')) - Number(isHeld('KeyA'))) * .48;
  barVelX = constrain(barVelX * .9, -4.5, 4.5);
  currentWidenFactor = lerp(currentWidenFactor, widenTimer > 0 ? widenMultiplier : 1, .08);
  const maxX = width / 2 - baseBarLength * currentWidenFactor / 2;
  barPosX = constrain(barPosX + barVelX, -maxX, maxX);
  if (abs(barPosX) >= maxX) barVelX = 0;
  barAngle = constrain(barAngle + (Number(isHeld('ArrowRight')) - Number(isHeld('ArrowLeft'))) * .014, -.42, .42);

  const difficulty = 1 + altitude / 200;
  const spawnInterval = Math.max(65, Math.floor(baseSpawnInterval / Math.sqrt(difficulty)));
  if (simulationTick - lastSpawnFrame >= spawnInterval) {
    lastSpawnFrame = simulationTick; const o = skyObstacle(); obstacles.push(o);
  }
  if (simulationTick - lastPowerUpFrame >= powerUpSpawnInterval) {
    lastPowerUpFrame = simulationTick; powerUps.push(spawnPowerUp());
  }
  if (altitude < 500 && simulationTick >= nextGustTick) {
    gustTimer = gustDuration; gustForce = (random() < .5 ? -1 : 1) * (gustStrengthBase + random(-.6,1.2));
    nextGustTick = simulationTick + gustIntervalBase + Math.floor(random(-180,180));
  }
  if (gustTimer > 0) { ballVelX += gustForce * .06 * gustTimer / gustDuration; gustTimer--; }
  const ball = stepBalanceBall(
    {x:ballX,y:ballY,vx:ballVelX,vy:ballVelY,spin:ballSpin,rotation:ballRotation},
    {x:barPosX,previousX:previousBarX,angle:barAngle,previousAngle:previousBarAngle,length:baseBarLength*currentWidenFactor}, 1, gravity);
  ballX=ball.x; ballY=ball.y; ballVelX=ball.vx; ballVelY=ball.vy; ballSpin=ball.spin; ballRotation=ball.rotation;
  const bx=width/2+barPosX+ballX, by=beamY()+ballY;
  for (let i=obstacles.length-1;i>=0;i--) {
    const o=obstacles[i], factor=slowTimer>0?.45:1;
    // Objects occupy the sky: camera ascent carries them downward on screen.
    o.y+=climb; o.x+=o.drift*factor; o.rotation+=o.spin*factor;
    if(o.x<25||o.x>width-25)o.drift*=-1;
    if (o.y>height+60) { obstacles.splice(i,1); continue; }
    if (circleHitsShard(bx,by,15,o)) {
      spawnHitParticles(o.x,o.y,14,[125,139,151]);
      if (shieldTimer>0) { shieldTimer=0; obstacles.splice(i,1); announce('Shield saved you!'); }
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
  if (slowTimer>0 && --slowTimer===0) gravity=originalGravity;
  if (shieldTimer>0) shieldTimer--;
}
function draw() {
  advanceGame(deltaTime);
  drawBackdrop(); noStroke();
  if (gameState==='menu') { drawMenu(); return; }
  if (gameOver) { drawFinishedScene(); return; }
  obstacles.forEach(drawObstacle); powerUps.forEach(drawDroplet); drawParticles();
  push();translate(width/2+barPosX,beamY());push();rotate(barAngle);drawRail(baseBarLength*currentWidenFactor);pop();
  if(shieldTimer>0){noFill();stroke(ink);strokeWeight(1);ellipse(ballX,ballY,42);}
  drawBuddy(ballX,ballY,15,ballRotation);pop();drawHeight();drawEffects();
  if(paused){push();noStroke();fill(paper);rect(200,height*.44,230,97,2);fill(ink);textAlign(CENTER,CENTER);textSize(25);text('paused',200,height*.44-18);textSize(11);text('Tap here or press P to resume',200,height*.44+20);pop();}
}
function drawEffects() {
  push();noStroke();fill(altitude>=500?paper:ink);textAlign(CENTER,TOP);textSize(10);
  const effects=[['Wide beam',widenTimer],['Slow climb',slowTimer],['Shield',shieldTimer]].filter(([,time])=>time>0);
  effects.forEach(([label,time],i)=>{const x=200+(i-(effects.length-1)/2)*100; fill(altitude>=500?paper:ink); text(label+' '+Math.ceil(time/60)+'s',x,62);fill('#9caeaa');rect(x,79,74,2);fill(ink);rect(x-37+37*time/360,79,74*time/360,2);});
  fill(altitude>=500?paper:ink);
  if(feedbackTimer>0) text(feedback,200,97);
  if(altitude<500 && nextGustTick-simulationTick<=90 && nextGustTick>simulationTick) text('Breeze in '+Math.ceil((nextGustTick-simulationTick)/60)+'s',200,125);
  else if(gustTimer>0) text(gustForce>0?'Breeze →':'← Breeze',200,125);
  pop();
}

function skyObstacle() {
  const kind=zones[zoneIndex].hazard;
  // The painted silhouette is also the collision polygon.
  const shapes={
    leaf:[[-22,0],[-10,-10],[7,-9],[22,0],[9,10],[-8,9]],
    kite:[[0,-25],[18,-3],[0,23],[-18,-3]],
    plane:[[-24,-12],[25,0],[-24,13],[-13,0]],
    balloon:[[-17,-10],[-11,-22],[9,-23],[18,-11],[15,5],[5,20],[-5,20],[-15,5]],
    satellite:[[-29,-13],[-11,-13],[-11,-6],[11,-6],[11,-13],[29,-13],[29,13],[11,13],[11,6],[-11,6],[-11,13],[-29,13]],
    asteroid:[[-22,-8],[-12,-20],[8,-22],[21,-9],[18,13],[4,20],[-16,15]],
  };
  return {kind,x:random(40,width-40),y:-42,
    points:shapes[kind].map(([x,y])=>({x,y})),
    rotation:kind==='leaf'?random(-.5,.5):random(-.15,.15),
    spin:['leaf','asteroid','satellite'].includes(kind)?random(-.009,.009):0,
    drift:kind==='plane'?random(-.6,.6):random(-.15,.15),
    tint:random()>.5,
  };
}

// power-up factory
function spawnPowerUp() {
  const types = ["widen", "slow", "shield"];
  return {
    type: random(types),
    x: random(50, width - 50),
    y: -40,
    size: 18,
    speed: 1.2 + random(0, 0.8),
  };
}

function applyPowerUp(type) {
  announce({widen:'Wider beam · 6 seconds',slow:'Slower climb · 6 seconds',shield:'Shield · blocks one hit'}[type]);
  // Durations in fixed simulation ticks.
  if (type === "widen") {
    widenTimer = 60 * 6; // 6 seconds
  } else if (type === "slow") {
    slowTimer = 60 * 6;
    // Slow the journey and passing hazards, preserving the ball’s weight.
  } else if (type === "shield") {
    shieldTimer = 60 * 6;

  }
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
function drawCloud(x,y,size) {
  push();translate(x,y);scale(size);
  const c=drawingContext;c.fillStyle=paper;c.strokeStyle=ink;c.lineWidth=1.1;
  c.beginPath();c.moveTo(-29,8);c.bezierCurveTo(-43,6,-38,-8,-27,-7);c.bezierCurveTo(-28,-25,-6,-27,0,-14);c.bezierCurveTo(10,-24,24,-13,23,-4);c.bezierCurveTo(40,-6,40,9,29,10);c.bezierCurveTo(7,13,-11,8,-29,8);c.closePath();c.fill();c.stroke();
  pop();
}
function drawBackdrop() {
  const travel=gameState==='menu'?0:cameraTravel;
  const h=gameState==='menu'?0:altitude;
  const palette=['#c7e5e8','#c7e5e8','#a9cfe3','#eab7a6','#727fa4','#242d49'];
  const stage=zoneAt(h);
  const sky=lerpColor(color(palette[Math.max(0,stage-1)]),color(palette[stage]),constrain((h-zones[stage].from)/60,0,1));
  background(sky);
  // Foreground terrain drops away faster than distant clouds.
  if(travel*.72<height) drawingContext.drawImage(meadow,0,height-400+travel*.72,width,400);
  if(gameState!=='menu') {
    drawTree(-12,height-35+travel*.85,440,.9);
    drawTree(411,height+250+travel*.5,1050,1);
    drawTree(-17,height+150+travel*.5,1000,.9);
  }
  if(h>=500) drawSpaceScenery(h,travel);
  push();stroke(ink);strokeWeight(1.2);fill('#edc754');
  const sunY=65+Math.min(travel*.014,45)+Math.max(0,h-320)*1.7;
  beginShape();for(let i=0;i<30;i++){const a=i*TWO_PI/30,r=18+sin(i*1.7)*.65;vertex(342+cos(a)*r,sunY+sin(a)*r);}endShape(CLOSE);
  for(let i=0;i<7;i++){const a=i*TWO_PI/7;line(342+cos(a)*27,sunY+sin(a)*27,342+cos(a)*33,sunY+sin(a)*33);}pop();
  push();drawingContext.globalAlpha=constrain((550-h)/180,0,1);
  for(let i=0;i<(gameState==='menu'?2:4);i++) {
    const y=gameState==='menu'?[111,186][i]:((111+i*173+travel*(.22+i*.025)+80)%(height+200))-80;
    drawCloud([59,290,143,355][i],y,[.9,.48,.65,.8][i]);
  }
  pop();
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
  const fade=constrain((h-500)/90,0,1);
  fill(255,249,231,200*fade);
  for(let i=0;i<42;i++){
    const x=(i*97+29)%400,y=((i*71+travel*.035)%(height+70))-35;
    ellipse(x,y,i%7===0?2.5:1.2);
  }
  // A distant moon, followed by the curve of the world below.
  if(h>620){fill(242,235,204,220*constrain((h-620)/80,0,1));ellipse(322,115,42);fill(193,189,177,120);ellipse(315,110,8);ellipse(330,120,5);}
  if(h>700){
    const horizon=height+10-Math.min(35,(h-700)*.1);
    fill('#a9cfe3');ellipse(200,horizon+330,1080,710);
    fill('#6e9daa');ellipse(200,horizon+336,1060,710);
    fill('#84ae92');ellipse(110,horizon+20,120,19);ellipse(290,horizon+12,75,14);
  }
  pop();
}
function drawTree(x,base,height,scaleFactor) {
  if(base-height>450||base<-100)return;
  push();translate(x,base);scale(scaleFactor);stroke(ink);strokeWeight(1);fill('#c19569');
  beginShape();vertex(-8,0);vertex(-5,-height);vertex(5,-height);vertex(11,0);endShape(CLOSE);
  for(let i=0;i<4;i++){
    const y=-height+35+i*48;
    line(0,y+35,32,y+8);line(0,y+39,-26,y+3);
    fill(i%2?'#afc984':'#84ae72');
    beginShape();vertex(-42,y+12);bezierVertex(-64,y-15,-23,y-42,2,y-27);bezierVertex(29,y-51,58,y-14,42,y+8);bezierVertex(49,y+33,-25,y+40,-42,y+12);endShape(CLOSE);
  }
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
  shardPath(obs.points);drawingContext.fillStyle=({leaf:'#b6a35f',kite:obs.tint?'#eaa395':'#9dbcb4',plane:paper,balloon:'#eaa395',satellite:'#a9cfe3',asteroid:'#b6aba0'})[obs.kind];
  drawingContext.fill();drawingContext.strokeStyle=ink;drawingContext.lineWidth=1.25;drawingContext.stroke();
  stroke(ink);strokeWeight(.8);noFill();
  if(obs.kind==='leaf'){
    line(-19,0,18,0);line(-8,0,-3,-6);line(1,0,7,6);line(9,0,13,-4);
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
function drawDroplet(p) {
  const colors={widen:'#a4cfa6',slow:'#a3c9da',shield:'#edc754'};
  push();translate(p.x,p.y);stroke(ink);strokeWeight(1);fill(colors[p.type]);
  beginShape();vertex(0,-12);bezierVertex(-2,-7,-10,0,-8,6);bezierVertex(-5,14,8,12,8,4);bezierVertex(8,-1,3,-7,0,-12);endShape(CLOSE);
  noStroke();fill(ink);textAlign(CENTER,CENTER);textSize(10);text({widen:'↔',slow:'◷',shield:'◇'}[p.type],0,4);pop();
}
function drawMenu() {
  push();textAlign(CENTER,CENTER);noStroke();textFont('Trebuchet MS, sans-serif');fill(ink);
  push();translate(200,53);rotate(-.025);textStyle(BOLD);textSize(32);text('balance ball',0,0);pop();
  textStyle(NORMAL);textSize(10);text('a little further up.',200,83);
  push();translate(200,height*.43);rotate(sin(animationTick*.018)*.04);drawRail(192);drawBuddy(0,-32,22,animationTick*.008);pop();
  fill(ink);textSize(12);if(matchMedia(PHONE_CONTROLS_QUERY).matches){text('Move + tilt buttons appear when you play',200,height*.60);}else{text('A / D  move',154,height*.60);text('← / →  tilt',257,height*.60);}
  textSize(10);text('From the meadow to space. How far can you go?',200,height*.67);
  // The start target keeps the original size, without a decorative panel.
  textStyle(BOLD);textSize(17);text('play  →',200,height*.82);
  stroke(ink);strokeWeight(1.1);line(165,height*.82+14,235,height*.82+12);
  noStroke();textStyle(NORMAL);textSize(9);text('click here or press enter',200,height*.82+35);pop();
}
function drawHeight() {
  push();noStroke();fill(altitude>=500?paper:ink);textFont('Trebuchet MS, sans-serif');
  textAlign(LEFT,TOP);textSize(9);text('height ↑',20,13);textSize(23);textStyle(BOLD);text(Math.floor(altitude)+'m',20,25);textStyle(NORMAL);
  textAlign(CENTER,TOP);textSize(9);text(zones[zoneIndex].name,200,16);
  textAlign(RIGHT,TOP);text('best '+bestAltitude+'m',380,13);
  pop();
}
function stepParticles() {
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.vy+=.12;p.x+=p.vx;p.y+=p.vy;p.age++;if(p.age>p.life)particles.splice(i,1);}
}
function drawParticles() {
  push();noStroke();for(const p of particles){fill(...p.col,map(p.age,0,p.life,210,0));push();translate(p.x,p.y);rotate(p.age*.08);triangle(-p.size/2,p.size/2,p.size/2,p.size/2,0,-p.size/2);pop();}pop();
}
function drawFinishedScene() {
  obstacles.forEach(drawObstacle);powerUps.forEach(drawDroplet);drawParticles();
  push();translate(width/2+barPosX,beamY());push();rotate(barAngle);drawRail(baseBarLength*currentWidenFactor);pop();drawBuddy(ballX,ballY,15,ballRotation);pop();drawHeight();
  push();noStroke();fill(paper);rect(200,height*.44,240,103,2);fill(ink);textAlign(CENTER,CENTER);textFont('Trebuchet MS, sans-serif');textStyle(BOLD);textSize(26);text('oops.',200,height*.44-22);textStyle(NORMAL);textSize(11);text(Math.floor(altitude)+'m climbed',200,height*.44+6);textSize(12);text('tap to retry · R to restart',200,height*.44+32);pop();
}
