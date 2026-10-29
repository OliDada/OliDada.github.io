import assert from 'node:assert/strict';
import {createRun,step,position,route,gapFor,ensureRoute,hazardsFor,isFork,areaFor,newRoute,groundAt,seed} from '../harbor-study/motion.mjs';
import {clearOfPier,protectWalkingLane,railIsClear} from '../harbor-study/clearance.mjs';
const dt=1/120;

// An autopilot that reads the route the way a player would.
function pilot(run){
  const s=route[run.segment],hole=gapFor(run.segment),p=run.progress;
  const jump=!!hole&&p>hole.start-1.7&&p<hole.start&&run.jumpHeight===0;
  const beam=hazardsFor(run.segment).find(h=>h.type==='beam'&&h.at-p<2.5&&h.at-p>-1);
  const cargo=hazardsFor(run.segment).find(h=>h.type==='cargo'&&h.at-p<9&&h.at-p>-1);
  let turn=0;
  if(p>s.length-10)turn=s.turn;
  else if(cargo){const want=[0,-.9,.9].find(l=>Math.abs(l-cargo.lane)>.8);if(Math.abs(run.laneTarget-want)>.1)turn=Math.sign(want-run.laneTarget);}
  return {jump,duck:!!beam&&!jump,turn};
}

// Different seeds produce different runs.
const layouts=new Set();
for(let k=1;k<=12;k++){newRoute(k*7919);ensureRoute(20);
  layouts.add(route.slice(0,12).map(s=>`${s.dx},${s.length},${s.rise},${s.narrow?1:0},${s.cover?.type??'-'}`).join('|'));}
assert.equal(layouts.size,12,'every seed yields a distinct route');
console.log('Seeded variety passed: 12 seeds, 12 distinct routes.');

// Every seed stays traversable for 100 stretches, with variety present.
const seen={narrow:0,rise:0,house:0,arches:0,fork:0,gap:0,beam:0,cargo:0};
for(let k=1;k<=25;k++){
  newRoute(k*104729+3);
  const run=createRun();let steps=0;
  while(run.segment<100&&steps++<200000){
    step(run,dt,pilot(run));
    assert.equal(run.state,'running',`seed ${seed}: stretch ${run.segment} at ${run.progress.toFixed(1)} stays traversable (${run.failure})`);
  }
  assert.ok(run.segment>=100);assert.ok(run.distance>2500);assert.ok(run.speed>8.5);
  for(let i=0;i<100;i++){
    const s=route[i],next=route[i+1];
    assert.equal(s.x+s.dx*s.length,next.x);assert.equal(s.z+s.dz*s.length,next.z);
    assert.ok(Math.abs(s.dx*next.dx+s.dz*next.dz)===0,'right-angle joins');
    assert.ok(s.dz<=0,'never heads back south');
    assert.ok(Math.abs(groundAt(i,s.length)-groundAt(i+1,0))<1e-9,'elevation is continuous across joins');
    assert.ok(groundAt(i,s.length)>=-.2&&groundAt(i,s.length)<=3.6,'decks stay above the water and below the eaves');
    if(s.narrow){seen.narrow++;assert.ok(!s.hazards.some(h=>h.type==='cargo'),'no cargo on beams');}
    if(s.rise)seen.rise++;if(s.cover)seen[s.cover.type]++;if(s.fork)seen.fork++;if(s.gap)seen.gap++;
    for(const h of s.hazards)seen[h.type]++;
  }
}
for(const [k,v] of Object.entries(seen))assert.ok(v>10,`variety: ${k} appears (${v})`);
console.log('Traversal passed for 25 seeds × 100 stretches:',JSON.stringify(seen));

newRoute(424242);
let run=createRun();
for(let i=0;i<1200&&run.state==='running';i++)step(run,dt,{turn:run.progress>route[run.segment].length-10?route[run.segment].turn:0});
assert.equal(run.state,'fell','walking into the opening gap falls');assert.equal(run.failure,'gap');
run=createRun();run.progress=route[0].gap.start-1.5;step(run,dt,{jump:true});for(let i=0;i<90;i++)step(run,dt);
assert.equal(run.state,'running');assert.ok(run.progress>route[0].gap.end);assert.equal(run.jumpHeight,0);
run=createRun();run.progress=route[0].length-.01;step(run,dt,{turn:route[0].turn});assert.equal(run.segment,1);
const turnX=position(run).x;step(run,dt);assert.ok(Math.abs(position(run).x-turnX)>0,'movement continues during camera turn');
run=createRun();run.progress=route[0].length-.01;step(run,dt);assert.equal(run.state,'fell','missed turns are gameplay');

for(const s of route.slice(0,40))for(let t=0;t<=s.length;t+=.5)assert.equal(protectWalkingLane(s.x+s.dx*t,s.z+s.dz*t,2,route),-.35);
for(let i=0;i<30;i++){
  ensureRoute(i);const s=route[i];const p=clearOfPier(s.x+s.dx*5,s.z+s.dz*5,2.2);
  for(const segment of route){const t=Math.max(0,Math.min(segment.length,(p.x-segment.x)*segment.dx+(p.z-segment.z)*segment.dz));assert.ok(Math.hypot(p.x-segment.x-segment.dx*t,p.z-segment.z-segment.dz*t)>=4.6-1e-6);}
}
assert.equal(railIsClear(0,route[0].length-1,route[0].length,1),false,'rail cannot close the outgoing corner');
assert.equal(areaFor(0),'harbor');
console.log('Gap, jump, turns, clearance and rail checks passed.');

// Hazard rules.
const beamSeg=route.findIndex(s=>s.hazards.some(h=>h.type==='beam'));
const beamH=route[beamSeg].hazards.find(h=>h.type==='beam');
for(const duck of [false,true]){run=createRun();run.segment=beamSeg;run.progress=beamH.at-2;for(let i=0;i<40;i++)step(run,dt,{duck});
  assert.equal(run.state,duck?'running':'fell','low beam requires ducking');}
newRoute(99);ensureRoute(60);
const cargoSeg=route.findIndex(s=>s.hazards.some(h=>h.type==='cargo'&&h.lane===0));
const cargoH=route[cargoSeg].hazards.find(h=>h.type==='cargo'&&h.lane===0);
for(const dodge of [false,true]){run=createRun();run.segment=cargoSeg;run.progress=cargoH.at-4;step(run,dt,{turn:dodge?-1:0});
  for(let i=0;i<60;i++)step(run,dt);assert.equal(run.state,dodge?'running':'fell','cargo requires lateral avoidance');}
const narrowSeg=route.findIndex(s=>s.narrow);
run=createRun();run.segment=narrowSeg;run.progress=1;step(run,dt,{turn:1});for(let i=0;i<20;i++)step(run,dt);
assert.equal(run.lane,0,'no sidestepping on a narrow beam');
const forkSeg=route.findIndex(s=>s.fork);
for(const turn of [-1,1]){newRoute(99);ensureRoute(60);run=createRun();run.segment=forkSeg;run.progress=route[forkSeg].length-.02;
  step(run,dt,{turn});assert.equal(run.state,'running');assert.equal(run.segment,forkSeg+1);assert.equal(route[forkSeg+1].dx,turn,'both fork choices work');}
console.log('Ducking, cargo, narrow beam and fork checks passed.');

// Scoring: cleared obstacles build the combo and multiplier.
newRoute(2024);
run=createRun();
for(let i=0;i<120*60&&run.segment<12;i++){step(run,dt,pilot(run));run.events.length=0;assert.equal(run.state,'running');}
assert.ok(run.combo>10&&run.score>run.distance*1.2,'clean running builds combo and score');
const scored=run.score;run.progress=route[run.segment].length-.01;step(run,dt);
assert.equal(run.state,'fell');assert.equal(run.combo,0,'a fall resets the combo');assert.ok(run.score>=scored,'but keeps the score');
console.log(`Scoring passed: combo builds, ${Math.floor(scored)} points over 12 stretches.`);
