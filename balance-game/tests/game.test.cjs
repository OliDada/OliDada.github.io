const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {stepBalanceBall,circleHitsShard}=require('../physics.js');
function game(storage=new Map()) {
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,classList:{remove(){}}});return nodes.get(id);};
  const context=vm.createContext({document:{getElementById:node,querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},Math,width:400,height:400,random:(a,b)=>Array.isArray(a)?a[0]:b===undefined?(a===undefined?.5:a/2):(a+b)/2,constrain:(n,a,b)=>Math.max(a,Math.min(b,n)),lerp:(a,b,t)=>a+(b-a)*t,abs:Math.abs,loop(){},stepBalanceBall,circleHitsShard,TWO_PI:Math.PI*2});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),context);
  return source=>vm.runInContext(source,context);
}
test('30, 60 and 120 Hz rendering produce identical simulation and height',()=>{
  const results=[30,60,120].map(fps=>{const run=game();run('startGame(); advanceGame(0)');for(let i=0;i<fps*4;i++)run(`advanceGame(${1000/fps})`);return run('JSON.stringify({simulationTick,altitude,cameraTravel,zoneIndex,ballX,ballY,obstacles,powerUps})');});
  assert.equal(results[0],results[1]);assert.equal(results[1],results[2]);
});
test('pause freezes physics, particles, effects, spawns and feedback; resume discards stale elapsed time',()=>{
  const run=game();run("startGame(); applyPowerUp('slow'); spawnHitParticles(0,0); advanceGame(0); advanceGame(100); setPaused(true)");
  const snapshot=()=>run('JSON.stringify({simulationTick,altitude,cameraTravel,zoneIndex,ballX,ballY,particles,obstacles,powerUps,slowTimer,feedbackTimer,animationTick})');
  const before=snapshot();for(let i=0;i<100;i++)run('advanceGame(100)');assert.equal(snapshot(),before);
  run('setPaused(false); advanceGame(100000)');assert.equal(snapshot(),before);
  run('advanceGame(1000/60)');assert.equal(run('slowTimer'),353);
});
test('each timed pickup expires after six simulation seconds',()=>{
  const run=game();run("startGame(); applyPowerUp('widen'); applyPowerUp('slow'); applyPowerUp('shield'); advanceGame(0)");
  for(let i=0;i<360;i++)run('advanceGame(1000/60)');
  assert.equal(run('widenTimer+slowTimer+shieldTimer'),0);assert.equal(run('gravity'),.42);
});
test('best survives a new game instance and malformed storage is ignored',()=>{
  const storage=new Map();const run=game(storage);run('startGame(); altitude=47; endGame()');
  assert.equal(game(storage)('readAltitudeBest()'),47);
  storage.set('balance-ball-height-v1','NaN');assert.equal(game(storage)('readAltitudeBest()'),0);
});
test('simultaneous touch move and tilt work and pause releases both',()=>{
  const run=game();run("startGame(); heldPointers.set(1,'KeyD'); heldPointers.set(2,'ArrowLeft'); updateGame()");
  assert.ok(run('barPosX')>0);assert.ok(run('barAngle')<0);
  run('setPaused(true)');assert.equal(run('heldPointers.size'),0);
});
test('blocked storage cannot prevent ending a run',()=>{
  const run=game();run("localStorage.setItem=()=>{throw Error('blocked')}; startGame(); altitude=12; endGame()");assert.equal(run('bestAltitude'),12);assert.equal(run('gameOver'),true);
});
test('altitude selects distinct hazards at the meadow, treetops and clouds',()=>{
  const run=game();
  assert.equal(run('zoneAt(59.9)'),0);assert.equal(run('zoneAt(60)'),1);assert.equal(run('zoneAt(180)'),2);
  assert.equal(run('zoneIndex=0; skyObstacle().kind'),'leaf');
  assert.equal(run('zoneIndex=1; skyObstacle().kind'),'kite');
  assert.equal(run('zoneIndex=2; skyObstacle().kind'),'plane');
});
test('world objects and pickups pass downward by the exact camera ascent',()=>{
  const run=game();run("startGame(); obstacles=[skyObstacle()]; obstacles[0].y=0; powerUps=[spawnPowerUp()]; powerUps[0].y=0; updateGame()");
  assert.equal(run('obstacles[0].y'),run('cameraTravel'));assert.equal(run('powerUps[0].y'),run('cameraTravel'));
  assert.equal(run('altitude'),run('cameraTravel/10'));
});
test('slow pickup slows ascent without changing ball gravity',()=>{
  const run=game();run('startGame()');const speed=run('climbPerTick()');run("applyPowerUp('slow')");
  assert.equal(run('climbPerTick()'),speed*.45);assert.equal(run('gravity'),.42);
});
test('best altitude persists and restart resets ascent',()=>{
  const storage=new Map(),run=game(storage);run('startGame(); altitude=213.9; cameraTravel=2139;  endGame()');
  const next=game(storage);assert.equal(next('readAltitudeBest()'),213);
  run('startGame()');assert.equal(run('cameraTravel+altitude+zoneIndex'),0);
});
test('crossing a zone announces the new height and resets correctly',()=>{
  const run=game();run('startGame(); cameraTravel=599.5; altitude=59.95; updateGame()');
  assert.equal(run('zoneIndex'),1);assert.match(run('feedback'),/Treetops/);
});
test('six stages progress to space and remain there for endless climbing',()=>{
  const run=game();
  assert.equal(run('zones.length'),6);
  for(const [h,index,kind] of [[320,3,'balloon'],[500,4,'satellite'],[750,5,'asteroid'],[10000,5,'asteroid']]){
    assert.equal(run(`zoneAt(${h})`),index);
    assert.equal(run(`zoneIndex=zoneAt(${h});skyObstacle().kind`),kind);
    assert.ok(run('skyObstacle().points.length')>=4);
  }
});
test('thin air and space do not start new wind gusts',()=>{
  const run=game();run('startGame(); altitude=800;cameraTravel=8000;nextGustTick=0;updateGame()');assert.equal(run('gustTimer'),0);
});
