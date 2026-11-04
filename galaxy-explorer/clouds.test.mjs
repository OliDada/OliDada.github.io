import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSystem } from './system.mjs';
import { cloudsFor, cloudDensity, cloudAngles, cloudValue, OCTAVES_LITE, airOf } from './clouds.mjs';

const worlds = (n = 120) => { const out = []; for (let s = 1; s <= n; s++) for (const b of generateSystem(s).bodies) out.push(b); return out; };
const fib = (n) => Array.from({ length: n }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / n, s = Math.sqrt(1 - y * y), a = i * 2.399963; return [Math.cos(a) * s, y, Math.sin(a) * s]; });

test('only worlds with air have clouds; giants keep their own', () => {
  let some = 0;
  for (const b of worlds()) {
    const c = cloudsFor(b);
    if (b.giant || airOf(b.physics.pressure) < 0.05) assert.equal(c, null, b.id);
    else { assert.ok(c, b.id); some++; }
  }
  assert.ok(some > 50, `${some}`);
});

test('the kind of cloud follows the air and the world', () => {
  const kinds = new Set();
  for (const b of worlds()) {
    const c = cloudsFor(b);
    if (!c) continue;
    kinds.add(c.kind);
    if (b.biome === 'Toxic') assert.equal(c.kind, 'sulfur');
    if (c.kind === 'water') assert.equal(b.physics.waterState, 'liquid');
    assert.ok(c.height >= 55 && c.height <= 130);
    assert.match(c.color, /^#[0-9a-f]{6}$/);
  }
  for (const k of ['water', 'ice', 'ash', 'dust']) assert.ok(kinds.has(k), k);
});

test('clouds cover about as much of the sky as intended, and are deterministic', () => {
  const dirs = fib(1500);
  let checked = 0;
  for (const b of worlds(40)) {
    const c = cloudsFor(b);
    if (!c) continue;
    assert.deepEqual(c, cloudsFor(b));
    const covered = dirs.reduce((s, d) => s + cloudDensity(c, d, [0, 0.37]), 0) / dirs.length;
    assert.ok(Math.abs(covered - c.cover) < 0.08, `${b.id} cover ${c.cover} got ${covered.toFixed(3)}`);
    // Phones skip the finest detail but keep the same overall cover.
    const lite = dirs.reduce((s, d) => s + cloudDensity(c, d, [0, 0.37], OCTAVES_LITE), 0) / dirs.length;
    assert.ok(Math.abs(lite - c.cover) < 0.12, `${b.id} lite ${lite.toFixed(3)}`);
    checked++;
  }
  assert.ok(checked > 10);
});

test('clouds drift a few metres a second and change smoothly', () => {
  for (const b of worlds(30)) {
    const c = cloudsFor(b);
    if (!c) continue;
    const speed = Math.abs(c.drift) * (b.radius + c.height);
    assert.ok(speed > 1 && speed < 6, `${speed}`);
    const dir = [0.3, 0.5, Math.sqrt(1 - 0.34)];
    const t = 1e8; // far from the epoch: angles stay small numbers
    const a = cloudAngles(c, t), b2 = cloudAngles(c, t + 1 / 60); // one frame
    assert.ok(Math.abs(a[0]) < 7 && Math.abs(a[1]) < 7);
    assert.ok(Math.abs(cloudValue(c, dir, a) - cloudValue(c, dir, b2)) < 0.01);
  }
});
