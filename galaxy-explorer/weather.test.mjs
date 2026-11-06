import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSystem } from './system.mjs';
import { cloudsFor, cloudAngles } from './clouds.mjs';
import { weatherOf, stormsAt, weatherAt, WINDOW } from './weather.mjs';

const worlds = (n = 80) => { const out = []; for (let s = 1; s <= n; s++) for (const b of generateSystem(s).bodies) { const c = cloudsFor(b); if (c) out.push({ b, c, w: weatherOf(b, c) }); } return out; };
const fib = (n) => Array.from({ length: n }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / n, s = Math.sqrt(1 - y * y), a = i * 2.399963; return [Math.cos(a) * s, y, Math.sin(a) * s]; });

test('what falls follows the clouds and the cold', () => {
  const kinds = new Set();
  for (const { b, c, w } of worlds()) {
    kinds.add(w.kind);
    if (c.kind === 'water') assert.equal(w.kind, b.physics.temperature < 272 ? 'snow' : 'rain');
    if (c.kind === 'sulfur') assert.equal(w.kind, 'acid');
    if (c.kind === 'ash') assert.equal(w.kind, 'ash');
  }
  for (const k of ['rain', 'snow', 'ash', 'dust']) assert.ok(kinds.has(k), k);
});

test('storms come and go smoothly, and are the same for everyone', () => {
  let seen = 0;
  for (const { b, c, w } of worlds(30)) {
    let last = null;
    for (let t = 1e8; t < 1e8 + 4 * WINDOW; t += 5) {
      const s = stormsAt(b, c, t, w);
      assert.deepEqual(s, stormsAt(b, c, t, w));
      assert.ok(s.length <= 3);
      const k = s.reduce((a, x) => a + x.k, 0);
      if (last !== null) assert.ok(Math.abs(k - last) < 0.12, `${b.id} jump ${last} -> ${k}`);
      last = k;
      if (k > 0.5) seen++;
    }
  }
  assert.ok(seen > 0);
});

test('rain falls under thick cloud, not in clear sky; storms bring wind and heavy rain', () => {
  let wetDry = 0, stormy = 0;
  for (const { b, c, w } of worlds(40)) {
    if (w.kind === 'dust') continue;
    const t = 1e8 + 1234, angles = cloudAngles(c, t), storms = stormsAt(b, c, t, w);
    for (const d of fib(400)) {
      const x = weatherAt(b, c, w, d, angles, storms);
      assert.ok(x.precip >= 0 && x.precip <= 1 && x.wind >= 0 && x.wind <= 1);
      if (x.thick < 0.2) assert.equal(x.precip, 0);
      if (x.precip > 0) wetDry++;
      if (x.storm > 0.6) { stormy++; assert.ok(x.wind > w.wind + 0.3, `${x.wind}`); }
    }
  }
  assert.ok(wetDry > 100, `${wetDry}`);
  assert.ok(stormy > 0, `${stormy}`);
});

test('dust is lifted by strong wind only', () => {
  for (const { b, c, w } of worlds(60)) {
    if (w.kind !== 'dust') continue;
    const t = 1e8, angles = cloudAngles(c, t), storms = stormsAt(b, c, t, w);
    for (const d of fib(200)) {
      const x = weatherAt(b, c, w, d, angles, storms);
      if (x.wind < 0.45) assert.equal(x.precip, 0);
    }
  }
});

test('the heart of a storm is thick cloud and heavy rain', () => {
  let hearts = 0;
  for (const { b, c, w } of worlds(60)) {
    if (w.kind === 'dust') continue;
    const t = 1e8 + 777, angles = cloudAngles(c, t), storms = stormsAt(b, c, t, w);
    for (const s of storms) {
      if (s.k < 0.8) continue;
      // The storm's centre, back in world directions (undo the drift of the big systems).
      const a = -angles[0], cs = Math.cos(a), sn = Math.sin(a), [x, y, z] = s.dir;
      const x2 = weatherAt(b, c, w, [x * cs - z * sn, y, x * sn + z * cs], angles, storms);
      assert.ok(x2.storm > 0.75 && x2.thick > 0.65 && x2.precip > 0.5 * w.wet, JSON.stringify(x2));
      hearts++;
    }
  }
  assert.ok(hearts > 3, `${hearts}`);
});
