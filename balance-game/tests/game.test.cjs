const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {stepBalanceBall,circleHitsShard}=require('../physics.js');
function game(storage=new Map()) {
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,classList:{remove(){}}});return nodes.get(id);};
  const context=vm.createContext({setTimeout:()=>0,matchMedia:()=>({matches:true}),window:{screen:{orientation:{angle:0}}},document:{getElementById:node,querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},Math,width:400,height:400,random:(a,b)=>Array.isArray(a)?a[0]:b===undefined?(a===undefined?.5:a/2):(a+b)/2,constrain:(n,a,b)=>Math.max(a,Math.min(b,n)),lerp:(a,b,t)=>a+(b-a)*t,abs:Math.abs,loop(){},stepBalanceBall,circleHitsShard,TWO_PI:Math.PI*2});
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
test('drag follows a target with capped speed and releases on pause',()=>{
  const run=game();run('startGame();dragTarget=100;updateGame()');
  assert.ok(run('barPosX')>0);assert.ok(run('barPosX')<=4.5);
  run('setPaused(true)');assert.equal(run('dragTarget'),null);
});
test('phone tilt calibrates neutral, smooths motion and can be recentered',()=>{
  const run=game();run('startGame();phoneTiltEnabled=true;receiveTilt({beta:30,gamma:10})');
  assert.equal(run('tiltTarget'),0);
  run('receiveTilt({beta:30,gamma:25});updateGame()');
  assert.ok(run('barAngle')>0);assert.ok(run('barAngle')<run('tiltTarget'));
  run('recenterTilt()');assert.equal(run('tiltTarget'),0);
  run('receiveTilt({beta:30,gamma:25})');assert.equal(run('tiltTarget'),0);
});
test('orientation mapping handles landscape and rejects missing sensor values',()=>{
  const run=game();assert.ok(Math.abs(run('screenRoll(20,0,90)')-20)<1e-8);
  assert.ok(Math.abs(run('screenRoll(20,0,270)')+20)<1e-8);
  run('phoneTiltEnabled=true;receiveTilt({beta:null,gamma:null})');assert.equal(run('phoneTiltReady'),false);
});
test('holding a phone still does not disable tilt',()=>{
  const run=game();run('startGame();phoneTiltEnabled=true;phoneTiltReady=true;updateGame()');
  assert.equal(run('phoneTiltEnabled'),true);assert.equal(run('phoneTiltReady'),true);
});
test('motion options are hidden during play and available only when paused',()=>{
  const run=game();run('startGame();phoneTiltEnabled=true;phoneTiltReady=true;syncControls()');
  assert.equal(run("document.getElementById('touch-controls').hidden"),true);
  run('setPaused(true)');
  assert.equal(run("document.getElementById('touch-controls').hidden"),false);
  assert.equal(run("document.getElementById('recenter').hidden"),false);
  assert.equal(run("document.getElementById('tilt-fallback').hidden"),true);
  run('setPaused(false)');
  assert.equal(run("document.getElementById('touch-controls').hidden"),true);
  run('phoneTiltEnabled=false;phoneTiltReady=false;syncControls()');
  assert.equal(run("document.getElementById('touch-controls').hidden"),false);
  assert.equal(run("document.getElementById('tilt-fallback').hidden"),false);
});
test('first phone Play requests permission synchronously then resumes after acceptance',async()=>{
  const run=game();run("window.isSecureContext=true; window.DeviceOrientationEvent={requestPermission(){globalThis.requestedDuring=gameState; return Promise.resolve('granted')}}");
  const pending=run('startFromGesture()');assert.equal(run('requestedDuring'),'menu');assert.equal(run('paused'),true);
  await pending;assert.equal(run('phoneTiltEnabled'),true);assert.equal(run('paused'),false);
});
test('denial gives visible feedback, keeps fallback controls and does not reprompt on retries',async()=>{
  const run=game();run("globalThis.requests=0;window.isSecureContext=true;window.DeviceOrientationEvent={requestPermission(){requests++;return Promise.resolve('denied')}}");
  await run('startFromGesture()');assert.equal(run('phoneTiltEnabled'),false);assert.equal(run('paused'),false);
  assert.match(run("document.getElementById('motion-status').textContent"),/declined/);
  await run('startFromGesture()');assert.equal(run('requests'),1);
});
test('insecure connections show why iPhone tilt cannot be requested',async()=>{
  const run=game();run('window.isSecureContext=false');await run('startFromGesture()');
  assert.match(run('motionStatus'),/HTTPS/);assert.equal(run('paused'),false);
});
test('a rejected motion request produces visible feedback and a playable fallback',async()=>{
  const run=game();run("window.isSecureContext=true;window.DeviceOrientationEvent={requestPermission(){return Promise.reject(Error('blocked'))}}");
  await run('startFromGesture()');assert.match(run('motionStatus'),/blocked/);assert.equal(run('motionRequestPending'),false);assert.equal(run('paused'),false);
});

function wiredGame() {
  const run=game();
  run(`
    function target() {
      const handlers = {};
      return {handlers, classList:{add(){},remove(){},toggle(){}},dataset:{},
        addEventListener(type,fn){(handlers[type] ||= []).push(fn)},
        emit(type,event={}){event.type=type;event.preventDefault=()=>{};for(const fn of handlers[type]||[])fn(event)},
        getBoundingClientRect(){return {left:0,top:0,width:200,height:200}},
        setPointerCapture(){throw Error('capture unavailable')}
      };
    }
    Object.assign(window,target()); Object.assign(document,target());
    for (const id of ['motion','recenter','action','pause']) Object.assign(document.getElementById(id),target());
    globalThis.leftButton=target();leftButton.dataset.control='ArrowLeft';
    document.querySelectorAll=()=>[leftButton];
    globalThis.canvas=target();installControls(canvas);
  `);
  return run;
}
test('native touch events move the beam with simultaneous tilt and release cleanly',()=>{
  const run=wiredGame();
  run(`startGame();canvas.emit('touchstart',{changedTouches:[{identifier:1,clientX:50}]});
    leftButton.emit('touchstart',{changedTouches:[{identifier:2}]});
    canvas.emit('touchmove',{changedTouches:[{identifier:1,clientX:90}]});updateGame()`);
  assert.ok(run('barPosX')>0);assert.ok(run('barAngle')<0);
  run(`canvas.emit('touchend',{changedTouches:[{identifier:1,clientX:90}]});
    leftButton.emit('touchend',{changedTouches:[{identifier:2}]})`);
  assert.equal(run('dragTarget'),null);assert.equal(run('heldPointers.size'),0);
  assert.equal(run('paused'),false);
});
test('canvas touch Play requests permission inside touchend even in a wide iframe',async()=>{
  const run=wiredGame();
  run(`matchMedia=()=>({matches:false});window.navigator={maxTouchPoints:5};
    window.screen.width=390;window.screen.height=844;window.isSecureContext=true;
    window.DeviceOrientationEvent={requestPermission(){globalThis.requestedDuring=gameState;return Promise.resolve('granted')}};
    canvas.emit('touchstart',{changedTouches:[{identifier:1,clientX:100,clientY:164}]});
    canvas.emit('pointerup',{pointerType:'touch',pointerId:1,clientX:100,clientY:164});`);
  assert.equal(run('gameState'),'menu');
  run(`canvas.emit('touchend',{changedTouches:[{identifier:1,clientX:100,clientY:164}]})`);
  assert.equal(run('requestedDuring'),'menu');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(run('phoneTiltEnabled'),true);assert.equal(run('paused'),false);
});
test('touch cancellation and pause release drag and held buttons without restarting',()=>{
  const run=wiredGame();run(`startGame();canvas.emit('touchstart',{changedTouches:[{identifier:1,clientX:50}]});
    leftButton.emit('touchstart',{changedTouches:[{identifier:2}]});setPaused(true);
    canvas.emit('touchend',{changedTouches:[{identifier:1,clientX:90}]});
    leftButton.emit('touchcancel',{changedTouches:[{identifier:2}]})`);
  assert.equal(run('paused'),true);assert.equal(run('dragTarget'),null);assert.equal(run('heldPointers.size'),0);
});
test('pointer capture failure does not prevent fallback button input',()=>{
  const run=wiredGame();run(`startGame();leftButton.emit('pointerdown',{pointerType:'pen',pointerId:2});updateGame()`);
  assert.ok(run('barAngle')<0);
  run(`leftButton.emit('pointerup',{pointerId:2})`);assert.equal(run('heldPointers.size'),0);
});

test('native Play button requests motion and ignores the same tap synthetic click',async()=>{
  const run=wiredGame();run(`window.isSecureContext=true;globalThis.requests=0;
    window.DeviceOrientationEvent={requestPermission(){requests++;return Promise.resolve('granted')}};
    document.getElementById('action').emit('touchend')`);
  assert.equal(run('requests'),1);
  await new Promise(resolve=>setImmediate(resolve));
  run(`altitude=25;document.getElementById('action').emit('click')`);
  assert.equal(run('altitude'),25);assert.equal(run('phoneTiltEnabled'),true);
  run(`document.getElementById('pause').emit('touchend');document.getElementById('pause').emit('click')`);
  assert.equal(run('paused'),true);
});
