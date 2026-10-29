import assert from 'node:assert/strict';
import {createRun,step,position,route,gapFor,ensureRoute,hazardsFor,isFork,areaFor,newRoute,groundAt,seed} from '../stillwater/motion.mjs';
import {clearOfPier,protectWalkingLane,railIsClear} from '../stillwater/clearance.mjs';
const dt=1/120;

// An autopilot that reads the route the way a player would.
function pilot(run){
  const s=route[run.segment],hole=gapFor(run.segment),p=run.progress,hs=hazardsFor(run.segment);
  const log=hs.find(h=>h.type==='log'&&h.at-p<2.2&&h.at-p>0);
  const jump=(!!hole&&p>hole.start-1.7&&p<hole.start||!!log)&&run.jumpHeight===0;
  const beam=hs.find(h=>(h.type==='beam'||h.type==='swing')&&h.at-p<2.5&&h.at-p>-1);
  const cargo=hs.find(h=>h.type==='cargo'&&h.at-p<9&&h.at-p>-1);
  const wall=hs.find(h=>h.type==='wall'&&h.at-p<9&&h.at-p>-1);
  let turn=0;
  if(p>s.length-10)turn=s.turn;
  else if(wall){if(Math.abs(run.laneTarget-wall.open)>.1)turn=Math.sign(wall.open-run.laneTarget);}
  else if(cargo){const want=[0,-.9,.9].find(l=>Math.abs(l-cargo.lane)>.8);if(Math.abs(run.laneTarget-want)>.1)turn=Math.sign(want-run.laneTarget);}
  return {jump,duck:!!beam&&run.jumpHeight===0&&!jump,turn};
}

// Different seeds produce different runs.
const layouts=new Set();
for(let k=1;k<=12;k++){newRoute(k*7919);ensureRoute(20);
  layouts.add(route.slice(0,12).map(s=>`${s.dx},${s.length},${s.rise},${s.narrow?1:0},${s.cover?.type??'-'}`).join('|'));}
assert.equal(layouts.size,12,'every seed yields a distinct route');
console.log('Seeded variety passed: 12 seeds, 12 distinct routes.');

// Every seed stays traversable for 100 stretches, with variety present.
const seen={narrow:0,rise:0,house:0,arches:0,bridge:0,ribs:0,roots:0,overhang:0,fork:0,gap:0,beam:0,cargo:0,log:0,wall:0,swing:0};
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

// Districts: long, never back-to-back, every kind appears.
{
  const {AREAS}=await import('../stillwater/motion.mjs');
  newRoute(777);ensureRoute(120);
  const runs=[];for(const s of route.slice(0,120)){if(!runs.length||runs.at(-1).area!==s.area)runs.push({area:s.area,n:0});runs.at(-1).n++;}
  for(const r of runs.slice(1,-1))assert.ok(r.n>=7,`district ${r.area} lasts ${r.n} stretches`);
  assert.equal(new Set(runs.map(r=>r.area)).size,Object.keys(AREAS).length,'every district appears within 120 stretches');
  console.log('Districts passed:',runs.map(r=>`${r.area}×${r.n}`).join(' '));
}

// Forks: both branches exist up front; choosing swaps in the other one without touching anything before it.
{
  newRoute(99);ensureRoute(60);
  const f=route.findIndex(s=>s.fork);const before=route.slice(0,f+1);const alt=route[f].alt,def=route[f+1];
  assert.ok(alt&&alt!==def&&alt.dx===-def.dx,'fork holds the opposite branch');
  const run2=createRun();run2.segment=f;run2.progress=route[f].length-5;step(run2,dt,{turn:-route[f].turn});
  assert.equal(route[f+1],alt,'chosen branch is the pre-built one');
  assert.ok(before.every((s,i)=>route[i]===s),'stretches up to the fork are unchanged');
  assert.equal(route[f].alt,def,'the abandoned branch is kept until you pass');
  console.log('Fork branch stability passed.');
}

// Scenery cleared before a fork stays clear of whichever branch is then taken.
{
  for(const sd of [11,99,1234,5555]){
    newRoute(sd);ensureRoute(40);
    const f=route.findIndex((s,i)=>i>2&&s.fork);if(f<0)continue;
    const pts=[];
    for(let k=0;k<400;k++){const s=route[f-1+(k%3)];const t=Math.random()*s.length,off=(Math.random()<.5?-1:1)*(3+Math.random()*30);
      const p=clearOfPier(s.x+s.dx*t-s.dz*off,s.z+s.dz*t+s.dx*off,1.5);pts.push(p);}
    const run3=createRun();run3.segment=f;run3.progress=route[f].length-5;step(run3,dt,{turn:-route[f].turn});
    for(const p of pts)for(const seg of route.slice(f+1,f+10)){
      const t=Math.max(0,Math.min(seg.length,(p.x-seg.x)*seg.dx+(p.z-seg.z)*seg.dz));
      assert.ok(Math.hypot(p.x-seg.x-seg.dx*t,p.z-seg.z-seg.dz*t)>=3.9-1e-6,`seed ${sd}: scenery stays off the newly chosen branch`);
    }
  }
  console.log('Fork scenery clearance passed.');
}
