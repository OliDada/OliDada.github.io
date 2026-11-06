import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpression, express, gestureOf, startGesture, lookAngles, GESTURES } from './express.mjs';
import { generateSystem } from './system.mjs';
import { faunaFor } from './fauna.mjs';

test('every species has a greeting, the same each time, and they vary', () => {
  const seen = new Set();
  for (let s = 0; s < 60; s++) for (const b of generateSystem(s * 101 + 7).bodies) for (const sp of faunaFor(b).species) {
    const g = gestureOf(sp);
    assert.ok(GESTURES.includes(g)); assert.equal(gestureOf(sp), g);
    if (g === 'raise') assert.ok(sp.arms || sp.plan === 'flyer', 'raising arms needs arms (or wings)');
    seen.add(g);
  }
  assert.ok(seen.size >= 5, [...seen].join());
});

test('the head turns toward what it looks at, within reach; a gesture plays and ends', () => {
  const ex = createExpression(() => .5), sp = { size: 1, glow: .5 };
  let pose;
  for (let i = 0; i < 60; i++) pose = express(ex, 1 / 30, { look: { yaw: .6, pitch: .2 }, sp });
  assert.ok(Math.abs(pose.headYaw - .6) < .02 && Math.abs(pose.headPitch - .2) < .02);
  for (let i = 0; i < 60; i++) pose = express(ex, 1 / 30, { look: { yaw: 2.5, pitch: 0 }, sp });
  assert.ok(pose.headYaw <= 1.15 + 1e-9 && pose.turn > 1, 'beyond reach: the body must turn');
  startGesture(ex, 'bow');
  let most = 0, glow = 0;
  for (let i = 0; i < 90; i++) { pose = express(ex, 1 / 30, { sp }); most = Math.max(most, pose.pitch); glow = Math.max(glow, pose.glow); }
  assert.ok(most > .3, 'bows'); assert.ok(glow > .8, 'glowing markings pulse');
  assert.equal(ex.gesture, null, 'and finishes');
  const a = lookAngles(1, 0, 1, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 });
  assert.ok(Math.abs(a.yaw - Math.PI / 4) < 1e-9);
});

test('moods show in the body', () => {
  const lean = (mood) => { const ex = createExpression(() => .5); let p; for (let i = 0; i < 90; i++) p = express(ex, 1 / 30, { mood, sp: { size: 1 }, t: i / 30 }); return p; };
  assert.ok(lean('curious').pitch > .08, 'curious lean in');
  assert.ok(lean('wary').scale < .97, 'wary shrink back');
  assert.ok(lean('guarded').scale > 1.03, 'guarded stand tall');
});
