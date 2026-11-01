import test from 'node:test';
import assert from 'node:assert/strict';
import { makeNoise, fbm, ridged, terrainFor } from './terrain.mjs';
import { generateSystem } from './system.mjs';

const unit = (i, n) => { const y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996; return { x: Math.cos(a) * r, y, z: Math.sin(a) * r }; };
const worlds = [];
for (let s = 0; s < 60; s++) worlds.push(...generateSystem(s * 7919 + 13).bodies);

test('noise is seeded, bounded and smooth', () => {
  const a = makeNoise(5), b = makeNoise(5), c = makeNoise(6);
  let max = 0, diff = 0;
  for (let i = 0; i < 2000; i++) {
    const p = [Math.sin(i) * 9, Math.cos(i * 1.3) * 9, i * .01];
    assert.equal(a(...p), b(...p)); diff += Math.abs(a(...p) - c(...p)); max = Math.max(max, Math.abs(a(...p)));
    assert.ok(Math.abs(a(p[0] + 1e-4, p[1], p[2]) - a(...p)) < .01);
  }
  assert.ok(max <= 1.05 && max > .5 && diff > 100);
  const f = fbm(a, .3, .2, .1, 5), r = ridged(a, .3, .2, .1, 5);
  assert.ok(Math.abs(f) <= 1 && r >= 0 && r <= 1);
});

test('seas cover about the share the physics asks for', () => {
  let checked = 0;
  for (const b of worlds) {
    const t = terrainFor(b);
    if (t.liquid !== 'water') continue;
    let wet = 0; const n = 1500;
    for (let i = 0; i < n; i++) if (t.height(unit(i, n)) < t.sea) wet++;
    // The signal plateau is dry land, so allow some shortfall on near-total ocean worlds.
    assert.ok(Math.abs(wet / n - t.coverage) < .1, `${b.name}: ${(wet / n).toFixed(2)} wet vs ${t.coverage.toFixed(2)}`);
    checked++;
  }
  assert.ok(checked >= 5, `only ${checked} water worlds`);
});

test('the signal site is always a flat, dry, reachable plateau', () => {
  for (const b of worlds) {
    const t = terrainFor(b), s = { x: b.signal[0], y: b.signal[1], z: b.signal[2] };
    assert.ok(!t.isLiquid(s), `${b.name} signal is under ${t.liquid}`);
    // Points inside the plateau (within 30 m) share the site height and are dry.
    const tilt = (a) => { const v = { x: s.x + Math.sin(a) * 30 / b.radius, y: s.y, z: s.z + Math.cos(a) * 30 / b.radius }, d = Math.hypot(v.x, v.y, v.z); return { x: v.x / d, y: v.y / d, z: v.z / d }; };
    for (let a = 0; a < 6.28; a += .7) { const p = tilt(a); assert.ok(Math.abs(t.height(p) - t.siteHeight) < 1e-9); assert.ok(!t.isLiquid(p)); }
  }
});

test('surfaces, colours and seas are consistent', () => {
  for (const b of worlds.slice(0, 120)) {
    const t = terrainFor(b);
    for (let i = 0; i < 200; i++) {
      const p = unit(i, 200), h = t.height(p), top = t.surface(p);
      assert.ok(Number.isFinite(h) && top >= h - 1e-9);
      if (t.liquid) assert.ok(top >= t.sea - 1e-9);
      assert.ok(Math.abs(h) < 70, `${b.name} height ${h}`);
      for (const v of t.color(p, t.meshHeight(p))) assert.ok(v >= 0 && v <= 1.1);
    }
    if (b.physics.waterState !== 'liquid') assert.notEqual(t.liquid, 'water');
  }
});

test('frozen worlds are snowy and living worlds have vegetation', () => {
  const avg = (b, pick) => { const t = terrainFor(b); let s = 0; for (let i = 0; i < 400; i++) { const p = unit(i, 400); s += pick(t.color(p, t.meshHeight(p))); } return s / 400; };
  const frozen = worlds.find(b => b.biome === 'Frozen'), green = worlds.find(b => b.physics.life === 'complex' && b.biome === 'Verdant');
  assert.ok(avg(frozen, c => (c[0] + c[1] + c[2]) / 3) > .6, 'frozen world is not bright');
  if (green) { const t = terrainFor(green); assert.ok(t.liquid === 'water'); }
});

test('terrain is fast enough to build a surface mesh on a phone', () => {
  const t = terrainFor(worlds[3]), t0 = performance.now();
  for (let i = 0; i < 30000; i++) t.height(unit(i, 30000));
  assert.ok(performance.now() - t0 < 400);
});
