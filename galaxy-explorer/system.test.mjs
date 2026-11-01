import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSystem, terrainHeight, distance, cruisePoint } from './system.mjs';
import { BIOMES } from './biomes.mjs';

const SEEDS = [0, 1, 7, 42, 1408, 912, 4294967295, ...Array.from({ length: 300 }, (_, i) => 1000 + i * 7919)];

test('seeds reproduce all world properties and different seeds create different worlds', () => {
  assert.deepEqual(generateSystem(1408), generateSystem(1408));
  assert.deepEqual(generateSystem('1408'), generateSystem(1408));
  assert.notDeepEqual(generateSystem(1408).bodies, generateSystem(912).bodies);
});

test('generated systems have distinct, separated, reachable solid worlds', () => {
  for (const seed of SEEDS) {
    const { bodies, star, startId } = generateSystem(seed);
    assert.ok(bodies.length >= 4 && bodies.length <= (bodies.some(b => b.giant) ? 12 + bodies.filter(b => b.giant).length : 9), `seed ${seed}: ${bodies.length} bodies`);
    assert.equal(new Set(bodies.map(b => b.id)).size, bodies.length);
    assert.equal(new Set(bodies.map(b => b.name)).size, bodies.length);
    assert.ok(bodies.some(b => b.id === startId && !b.giant), `seed ${seed}: must start above a solid world`);
    for (const b of bodies) {
      assert.ok(distance(b.position, [0, 0, 0]) > star.radius + b.radius + 200, `seed ${seed} ${b.id} too close to star`);
      assert.ok(Math.abs(Math.hypot(...b.signal) - 1) < 1e-12);
      for (const other of bodies) if (b !== other) assert.ok(distance(b.position, other.position) > b.radius + other.radius + 100, `seed ${seed}: ${b.id} overlaps ${other.id}`);
      if (!b.giant) assert.ok(Number.isFinite(terrainHeight(b, { x: b.signal[0], y: b.signal[1], z: b.signal[2] })));
      // Everything the renderer reads is present and well-formed.
      assert.ok(BIOMES[b.biome]);
      assert.equal(b.palette.length, 4);
      for (const c of [...b.palette, b.atmosphere, b.rock, b.crystal]) assert.match(c, /^#[0-9a-f]{6}$/);
      assert.ok(Number.isFinite(b.relief) && b.relief > 0);
      assert.ok(b.parent === null || bodies.some(p => p.id === b.parent));
    }
    assert.match(star.color, /^#[0-9a-f]{6}$/);
  }
});

test('cruise route starts and ends at requested coordinates and avoids the central star', () => {
  for (const seed of [1408, 7, 42]) {
    const system = generateSystem(seed);
    for (const from of system.bodies) for (const to of system.bodies) {
      const start = from.position.map((v, i) => v + from.signal[i] * (from.radius + 22));
      const departure = from.position.map((v, i) => v + from.signal[i] * (from.radius + 650));
      const end = to.position.map((v, i) => v + to.signal[i] * (to.radius + 190));
      assert.deepEqual(cruisePoint(start, departure, end, 0), start);
      assert.deepEqual(cruisePoint(start, departure, end, 1), end);
      for (let i = 0; i <= 100; i++) { const p = cruisePoint(start, departure, end, i / 100); assert.ok(p.every(Number.isFinite)); assert.ok(distance(p, [0, 0, 0]) > system.star.radius + 140); }
    }
  }
});

test('giants form mostly beyond the frost line, have no surface, and keep their moons clear', () => {
  let giants = 0, outer = 0;
  for (const seed of SEEDS) {
    const { bodies, star } = generateSystem(seed);
    for (const g of bodies.filter(b => b.giant)) {
      giants++;
      if (g.physics.au >= star.physics.frostLine * .6) outer++;
      assert.equal(g.parent, null);
      assert.equal(g.physics.life, 'none');
      assert.ok(g.radius > Math.max(...bodies.filter(b => !b.giant).map(b => b.radius)), `seed ${seed}: giant smaller than a rocky world`);
      const moons = bodies.filter(m => m.parent === g.id);
      assert.ok(moons.length >= 1, `seed ${seed}: ${g.name} has no moons`);
      // Moons orbit far enough out that flying off one (up to 600 m) never reaches the cloud tops.
      for (const m of moons) assert.ok(distance(m.position, g.position) - g.radius - m.radius > 600 + 240, `seed ${seed}: ${m.id} too close to ${g.name}`);
      // Nothing else in the system comes within the giant's moon system.
      for (const o of bodies) if (o !== g && o.parent !== g.id) assert.ok(distance(o.position, g.position) > g.radius + 1600, `seed ${seed}: ${o.id} crowds ${g.name}`);
    }
  }
  assert.ok(giants > SEEDS.length * .3, `only ${giants} giants in ${SEEDS.length} systems`);
  assert.ok(outer / giants > .8, 'most giants should be beyond the frost line');
});

test('systems without giants keep their layout', () => {
  // Seed 1408 has no giant; its planets sit on the original fixed orbit step.
  const { bodies } = generateSystem(1408);
  const planets = bodies.filter(b => !b.parent);
  if (!planets.some(b => b.giant)) planets.forEach((p, i) => assert.ok(p.orbit >= 3000 + i * 3100 && p.orbit < 3000 + i * 3100 + 150));
});
