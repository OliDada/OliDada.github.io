import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';
import { discCover, eclipseAt, phenomenaOf, forecast, stormChances, starElevation } from './phenomena.mjs';

const worlds = (n = 150) => { const out = []; for (let s = 1; s <= n; s++) { const sys = generateSystem(s); for (const b of sys.bodies) if (!b.giant) out.push({ sys, b }); } return out; };

test('disc cover: none apart, all when a bigger disc sits on top, partial in between', () => {
  assert.equal(discCover(1, 1, 3), 0);
  assert.equal(discCover(1, 2, 0.5), 1);
  assert.ok(Math.abs(discCover(1, 0.5, 0) - 0.25) < 1e-9);
  const half = discCover(1, 1, 1);
  assert.ok(half > 0.3 && half < 0.5, `${half}`);
  let last = 1;
  for (let d = 0; d <= 2; d += 0.1) { const c = discCover(1, 1, d); assert.ok(c <= last + 1e-9); last = c; }
});

test('eclipses follow the orbits: only worlds with moons, or moons, and they come and go', () => {
  let withEclipse = 0;
  for (const { sys, b } of worlds(80)) {
    const can = phenomenaOf(sys, b).includes('eclipse');
    const hasOccluder = sys.bodies.some((o) => o.parent === b.id || o.id === b.parent);
    if (can) { withEclipse++; assert.ok(hasOccluder, `${b.name} has nothing to cast an eclipse`); }
    if (!hasOccluder) assert.equal(eclipseAt(sys, b, 12345).cover, 0);
  }
  assert.ok(withEclipse > 20, `eclipses somewhere: ${withEclipse}`);
  // Over an hour an eclipse starts and ends: never permanent.
  const { sys, b } = worlds(80).find(({ sys, b }) => phenomenaOf(sys, b).includes('eclipse'));
  const covers = []; for (let t = 1e6; t < 1e6 + 3600; t += 5) covers.push(eclipseAt(sys, b, t).cover);
  assert.ok(Math.max(...covers) >= 0.5 && Math.min(...covers) === 0);
});

test('aurorae and meteor showers need air; none on airless worlds', () => {
  let aurora = 0, meteors = 0;
  for (const { sys, b } of worlds()) {
    const c = stormChances(sys, b), p = b.physics?.pressure ?? 0;
    if (p < 0.01) assert.deepEqual(c, { aurora: 0, meteors: 0 }, b.name);
    if (c.aurora) { aurora++; assert.ok(p >= 0.05); }
    if (c.meteors) meteors++;
  }
  assert.ok(aurora > 10 && meteors > 10, `${aurora} ${meteors}`);
});

test('the forecast only lists what can be seen from the place: eclipses by day, storms at night', () => {
  let seen = 0;
  for (const { sys, b } of worlds(60)) {
    const n = terrainFor(b).site, list = forecast(sys, b, n, 2e6, 3600);
    for (const e of list) {
      seen++;
      assert.ok(e.end > e.start && e.start >= 2e6 - 1);
      const el = starElevation(sys, b, n, (e.start + e.end) / 2);
      if (e.type === 'eclipse') assert.ok(el > 0, `${e.type} by day (${el})`);
      else assert.ok(el < 0, `${e.type} at night (${el})`);
    }
    // Sorted, soonest first, and the same for everyone at the same moment.
    assert.deepEqual(list.map((e) => e.start), [...list.map((e) => e.start)].sort((x, y) => x - y));
    assert.deepEqual(forecast(sys, b, n, 2e6, 3600), list);
  }
  assert.ok(seen > 20, `events seen: ${seen}`);
});
