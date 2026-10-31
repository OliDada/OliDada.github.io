import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSystem,terrainHeight,distance,cruisePoint} from './system.mjs';
test('seeds reproduce all world properties and different seeds create different worlds',()=>{
 assert.deepEqual(generateSystem(1408),generateSystem(1408));
 assert.notDeepEqual(generateSystem(1408).bodies,generateSystem(912).bodies);
});
test('generated systems have seven distinct, separated, reachable solid worlds',()=>{
 for(const seed of [0,1,1408,912,4294967295]){
  const {bodies,star}=generateSystem(seed);
  assert.equal(bodies.length,7);assert.equal(new Set(bodies.map(b=>b.id)).size,7);
  for(const b of bodies){assert.ok(distance(b.position,[0,0,0])>star.radius+b.radius+200);assert.ok(Math.abs(Math.hypot(...b.signal)-1)<1e-12);
   for(const other of bodies)if(b!==other)assert.ok(distance(b.position,other.position)>b.radius+other.radius+100);
   assert.equal(terrainHeight(b,{x:b.signal[0],y:b.signal[1],z:b.signal[2]}),1.2);
  }
 }
});
test('cruise route starts and ends at requested coordinates and avoids the central star',()=>{
 const system=generateSystem(1408);
 for(const from of system.bodies)for(const to of system.bodies){
  const start=from.position.map((v,i)=>v+from.signal[i]*(from.radius+22));
  const departure=from.position.map((v,i)=>v+from.signal[i]*(from.radius+650));
  const end=to.position.map((v,i)=>v+to.signal[i]*(to.radius+190));
  assert.deepEqual(cruisePoint(start,departure,end,0),start);
  assert.deepEqual(cruisePoint(start,departure,end,1),end);
  for(let i=0;i<=100;i++){const p=cruisePoint(start,departure,end,i/100);assert.ok(p.every(Number.isFinite));assert.ok(distance(p,[0,0,0])>system.star.radius+140);}
 }
});
