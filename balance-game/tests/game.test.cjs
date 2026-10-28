const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {stepBalanceBall,circleHitsShard}=require('../physics.js');
function game(storage=new Map()) {
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,classList:{remove(){},toggle(){}}});return nodes.get(id);};
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
  run('advanceGame(1000/60)');assert.equal(run('slowTimer'),473);
});
test('defensive pickups expire at their configured durations',()=>{
  const run=game();run("startGame(); applyPowerUp('widen'); applyPowerUp('slow'); applyPowerUp('shield'); hazardSpawnTicks=-10000; advanceGame(0)");
  for(let i=0;i<720;i++)run('advanceGame(1000/60)');
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
  assert.equal(run('climbPerTick()'),speed*.75);assert.equal(run('gravity'),.42);
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
test('nine stages progress to deep space and remain there for endless climbing',()=>{
  const run=game();
  assert.equal(run('zones.length'),9);
  for(const [h,index,kind] of [[320,3,'balloon'],[500,4,'storm'],[700,5,'crystal'],[950,6,'satellite'],[1250,7,'asteroid'],[1600,8,'comet'],[10000,8,'comet']]){
    assert.equal(run(`zoneAt(${h})`),index);
    assert.equal(run(`zoneIndex=zoneAt(${h});skyObstacle().kind`),kind);
    assert.ok(run('skyObstacle().points.length')>=4);
  }
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
test('boost climbs 2.5 times faster, preserves slow and pauses its duration',()=>{
  const run=game();run('startGame()');const speed=run('climbPerTick()');
  run("applyPowerUp('slow');applyPowerUp('boost')");
  assert.equal(run('climbPerTick()'),speed*2.5);assert.equal(run('slowTimer'),480);
  run('setPaused(true);advanceGame(1000);advanceGame(1000)');assert.equal(run('boostTimer'),180);
  run('startGame()');assert.equal(run('boostTimer'),0);
});
test('boost blocks repeated obstacles without consuming a shield and expires',()=>{
  const run=game();run(`startGame();ballY=-15;ballVelY=0;applyPowerUp('boost');applyPowerUp('shield');
    obstacles=[skyObstacle(),skyObstacle()];obstacles.forEach(o=>{o.x=200;o.y=beamY()-15-climbPerTick();o.drift=0});updateGame()`);
  assert.equal(run('gameOver'),false);assert.equal(run('obstacles.length'),0);assert.equal(run('shieldTimer'),720);
  run('boostTimer=1;updateGame()');assert.equal(run('boostTimer'),0);assert.match(run('feedback'),/Boost finished/);
  run(`shieldTimer=0;obstacles=[skyObstacle()];obstacles[0].x=200+barPosX+ballX;obstacles[0].y=beamY()+ballY-climbPerTick();updateGame()`);
  assert.equal(run('gameOver'),true);
});
test('new obstacles belong to their sky stages and have solid collision outlines',()=>{
  const run=game();
  for(const [kind,stage] of [['seed',0],['bird',1],['comet',8]]){
    assert.equal(run(`obstaclePools[${stage}].includes('${kind}')`),true);
    run(`globalThis.o=skyObstacle('${kind}')`);
    assert.ok(run('o.points.length')>=4);
    assert.equal(run('circleHitsShard(o.x,o.y,2,o)'),true);
  }
});
test('crossing obstacles enter above the beam and keep their direction across the screen',()=>{
  const run=game();
  for(const kind of ['plane','bird','satellite','comet']){
    for(const direction of [-1,1]){
      run(`globalThis.o=skyObstacle('${kind}');o.direction=${direction};o.drift=Math.abs(o.drift)*${direction};o.x=${direction}>0?-38:width+38`);
      assert.ok(run('beamY()-o.y')>=160);
      run('globalThis.startX=o.x;for(let i=0;i<300;i++)moveObstacle(o,1.2)');
      assert.ok(run('(o.x-startX)*o.direction')>200);
      assert.equal(run('Math.sign(o.drift)'),direction);
    }
  }
});
test('flutter stays bounded and slow scales obstacle motion as well as camera ascent',()=>{
  const run=game();
  for(const kind of ['leaf','seed','kite','balloon']){
    run(`globalThis.o=skyObstacle('${kind}');globalThis.startX=o.x;globalThis.maxDrift=0;for(let i=0;i<2000;i++){moveObstacle(o,1.2);maxDrift=Math.max(maxDrift,Math.abs(o.x-startX))}`);
    assert.ok(run('maxDrift')<=72);
  }
  run(`globalThis.a=skyObstacle('comet');globalThis.b=JSON.parse(JSON.stringify(a));globalThis.x=a.x;moveObstacle(a,1.2);moveObstacle(b,1.2*.45,.45)`);
  assert.ok(Math.abs(run('(b.x-x)/(a.x-x)')-.45)<1e-9);
  assert.equal(run('b.age'),.45);
});
test('retry uses the canvas without a duplicate button below the playfield',()=>{
  const run=wiredGame();run('startGame();endGame()');
  assert.equal(run("document.getElementById('action').hidden"),true);
  run("canvas.emit('pointerup',{pointerType:'mouse',pointerId:1,clientX:100,clientY:100})");
  assert.equal(run('gameOver'),false);assert.equal(run('gameState'),'playing');
});
test('crossing hazards reach the beam lane at the same time on narrow and wide screens',()=>{
  for(const kind of ['plane','bird','satellite','comet']){
    const arrival=[];
    for(const w of [400,800,1600]){
      const run=game();run(`width=${w};height=500;altitude=1000;globalThis.o=skyObstacle('${kind}');globalThis.ticks=0;
        while(o.y<beamY()-25 && ticks<500){moveObstacle(o,baseClimbPerTick());ticks++;}`);
      assert.ok(Math.abs(run('o.x-width/2'))<12,kind+' must cross the central beam lane at width '+w);
      arrival.push(run('ticks'));
    }
    assert.equal(arrival[0],arrival[1]);assert.equal(arrival[1],arrival[2]);
  }
});
test('hazard paths stay fixed after the player moves and wide screens increase density within a cap',()=>{
  const run=game();run("width=1200;globalThis.o=skyObstacle('satellite');globalThis.speed=o.drift;barPosX=300;moveObstacle(o,baseClimbPerTick())");
  assert.equal(run('o.drift'),run('speed'));
  const wide=run('obstacleInterval()');run('width=400');assert.ok(wide<run('obstacleInterval()'));
  run('width=10000;altitude=100000');assert.ok(run('obstacleInterval()')>=42);
});
test('lightning warns before striking and only its visible column damages the ball',()=>{
  const run=game();run("globalThis.o=skyObstacle('storm');o.x=200;o.y=50;o.age=89");
  assert.equal(run('obstacleHitsBall(o,200,275)'),false);
  run('o.age=90');assert.equal(run('obstacleHitsBall(o,200,275)'),true);
  assert.equal(run('obstacleHitsBall(o,240,275)'),false);
  run('o.age=108');assert.equal(run('obstacleHitsBall(o,200,275)'),false);
});
test('shield protects against overlapping hits for a short grace period',()=>{
  const run=game();run(`startGame();ballY=-25;applyPowerUp('shield');obstacles=[skyObstacle('leaf'),skyObstacle('leaf')];
    obstacles.forEach(o=>{o.x=200;o.y=beamY()-25-climbPerTick()});updateGame()`);
  assert.equal(run('gameOver'),false);assert.equal(run('shieldTimer'),0);
  assert.ok(run('shieldGraceTimer')>0);assert.equal(run('obstacles.length'),0);
});
test('boost preserves defensive durations and pickups avoid already active effects',()=>{
  const run=game();run("startGame();applyPowerUp('slow');applyPowerUp('shield');applyPowerUp('boost');updateGame()");
  assert.equal(run('slowTimer'),480);assert.equal(run('shieldTimer'),720);
  assert.equal(run('spawnPowerUp().type'),'widen');
  run('boostTimer=0;updateGame()');assert.equal(run('slowTimer'),479);assert.equal(run('shieldTimer'),719);
  assert.equal(run('hazardTimeScale()'),.55);
});
test('pickups enter above the screen and stay near the beam horizontally',()=>{
  const run=game();run('width=1600;barPosX=300;globalThis.p=spawnPowerUp()');
  assert.ok(Math.abs(run('p.x-(width/2+barPosX)'))<=110);
  assert.equal(run('p.y'),-40);
  assert.ok(run('p.y+p.size/2')<0);
});
test('slow motion reduces new hazard pressure instead of letting hazards pile up',()=>{
  function count(slow){
    const run=game();run(`startGame();ballY=-25;stepBalanceBall=state=>state;globalThis.spawns=0;${slow?"applyPowerUp('slow');":''}
      for(let i=0;i<300;i++){updateGame();spawns+=obstacles.length;obstacles=[];}`);
    return run('spawns');
  }
  assert.ok(count(true)<count(false));
});

test('bird and plane flight paths do not aim at the player at spawn',()=>{
  for(const kind of ['bird','plane']){
    const paths=[-250,0,250].map(position=>{
      const run=game();run(`width=1000;barPosX=${position};globalThis.o=skyObstacle('${kind}')`);
      return run('JSON.stringify({x:o.x,y:o.y,drift:o.drift,targetX:o.targetX})');
    });
    assert.equal(paths[0],paths[1]);assert.equal(paths[1],paths[2]);
  }
});
