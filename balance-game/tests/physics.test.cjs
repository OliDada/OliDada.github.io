const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stepBalanceBall } = require('../physics.js');
const ball = (extra = {}) => ({ x: 0, y: -25, vx: 0, vy: 0, spin: 0, rotation: 0, ...extra });
const rail = (extra = {}) => ({ x: 0, previousX: 0, angle: 0, previousAngle: 0, length: 200, ...extra });

test('gravity accelerates a free ball without horizontal drag', () => {
  const b = ball({y:-100, vx:2});
  stepBalanceBall(b, rail(), 1, .42);
  assert.equal(b.vx, 2); assert.equal(b.vy, .42); assert.equal(b.x, 2);
});
test('moving the platform does not teleport an airborne ball', () => {
  const b = ball({y:-100});
  stepBalanceBall(b, rail({x:4}), 1, .42);
  assert.equal(b.x + 4, 0); assert.equal(b.vx, 0);
});
test('a marble settles on a level rail without sinking or gaining energy', () => {
  const b = ball({y:-60});
  for(let i=0;i<300;i++) stepBalanceBall(b, rail(), 1, .42);
  assert.ok(Math.abs(b.y + 25) < .01); assert.ok(Math.abs(b.vy) < .01); assert.equal(b.x, 0);
});
test('a solid sphere rolls downhill with less acceleration than a sliding particle', () => {
  const angle=.15, b=ball({x:25*Math.sin(angle),y:-25*Math.cos(angle)});
  for(let i=0;i<20;i++) stepBalanceBall(b, rail({angle,previousAngle:angle}), 1, .42);
  const speed=b.vx*Math.cos(angle)+b.vy*Math.sin(angle);
  assert.ok(speed>.6 && speed<1.1, `rolling speed ${speed}`);
  assert.ok(b.spin>0); assert.ok(Math.abs(speed-b.spin*15)<.03);
});
test('surface friction transfers some motion while preserving relative inertia', () => {
  const b=ball(); stepBalanceBall(b,rail({x:3}),1,.42);
  assert.ok(b.vx>0 && b.vx<3); assert.ok(b.x<0);
});
test('different render frame durations produce equivalent trajectories', () => {
  const a=ball({y:-60,vx:1}), b=ball({y:-60,vx:1});
  for(let i=0;i<40;i++) stepBalanceBall(a,rail(),1,.42);
  for(let i=0;i<20;i++) stepBalanceBall(b,rail(),2,.42);
  assert.ok(Math.abs(a.x-b.x)<1e-8); assert.ok(Math.abs(a.y-b.y)<1e-8);
});

const { circleHitsShard } = require('../physics.js');
const shard = {x:50,y:60,rotation:0,points:[{x:-20,y:-20},{x:20,y:-20},{x:-20,y:20}]};
test('shards collide with their outline, not empty corners of a bounding rectangle', () => {
  assert.equal(circleHitsShard(60,70,2,shard),false);
  assert.equal(circleHitsShard(40,50,2,shard),true);
  assert.equal(circleHitsShard(50,62,2,shard),true);
  assert.equal(circleHitsShard(50,66,2,shard),false);
});
test('shard collision rotates with the rendered piece', () => {
  const rotated={...shard,rotation:Math.PI/2};
  assert.equal(circleHitsShard(60,70,2,rotated),true);
  assert.equal(circleHitsShard(40,70,2,rotated),false);
});
