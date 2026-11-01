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
    assert.ok(Math.abs(wet / n - t.coverage) < .1, `${b.name}: ${(wet / n).toFixed(2)} wet vs ${t.coverage.toFixed(2)}`);
    checked++;
  }
  assert.ok(checked >= 5, `only ${checked} water worlds`);
});

test('the signal site is dry, fairly level ground near the generated point', () => {
  let level = 0;
  for (const b of worlds) {
    const t = terrainFor(b), s = { x: t.site[0], y: t.site[1], z: t.site[2] };
    assert.ok(Math.abs(Math.hypot(s.x, s.y, s.z) - 1) < 1e-9);
    assert.ok(!t.isLiquid(s), `${b.name} site is under ${t.liquid}`);
    const away = Math.acos(Math.min(1, s.x * b.signal[0] + s.y * b.signal[1] + s.z * b.signal[2])) * b.radius;
    assert.ok(away < 300, `${b.name} site ${away.toFixed(0)} m from the signal point`);
    // Level enough to land: the ground rises at most ~1 m per metre around it, on most worlds.
    const e = 4 / b.radius, h = t.height(s);
    const n2 = { x: s.x + e, y: s.y, z: s.z }, l = Math.hypot(n2.x, n2.y, n2.z);
    if (Math.abs(t.height({ x: n2.x / l, y: n2.y / l, z: n2.z / l }) - h) / 4 < 1) level++;
  }
  assert.ok(level > worlds.length * .9, `${level} of ${worlds.length} sites level`);
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
