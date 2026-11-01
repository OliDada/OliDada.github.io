import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSystem, distance } from './system.mjs';
import { bodyPosition, systemPositions, angularSpeed, orbitClock, EPOCH } from './orbits.mjs';

const SEEDS = [0, 1, 2, 4, 7, 42, 1408, ...Array.from({ length: 120 }, (_, i) => 3000 + i * 7919)];
const TIMES = [0, 37, 600, 4321, 86400 * 3.3, orbitClock(Date.UTC(2027, 5, 1))];

test('time zero is the generated snapshot', () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const s = generateSystem(seed);
    for (const b of s.bodies) assert.ok(distance(bodyPosition(s, b, 0), b.position) < 1e-6, `${seed} ${b.id}`);
  }
  assert.equal(orbitClock(EPOCH), 0);
});

test('orbits keep their radius and height, and outer planets are slower', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const s = generateSystem(seed), planets = s.bodies.filter(b => !b.parent);
    for (const t of TIMES) for (const b of s.bodies) {
      const p = bodyPosition(s, b, t);
      const centre = b.parent ? bodyPosition(s, s.bodies.find(x => x.id === b.parent), t) : [0, p[1], 0];
      assert.ok(Math.abs(Math.hypot(p[0] - centre[0], p[2] - centre[2]) - b.orbit) < 1e-6);
      assert.ok(Math.abs(p[1] - (b.parent ? centre[1] + b.position[1] - s.bodies.find(x => x.id === b.parent).position[1] : b.position[1])) < 1e-9);
    }
    for (let i = 1; i < planets.length; i++) assert.ok(angularSpeed(s, planets[i]) < angularSpeed(s, planets[i - 1]));
    // Speeds stay well below a cruising ship's, so worlds can always be caught.
    for (const b of s.bodies) assert.ok(angularSpeed(s, b) * b.orbit < 80, `${seed} ${b.id} moves ${angularSpeed(s, b) * b.orbit} m/s`);
  }
});

test('moving worlds never collide, crowd a giant, or approach the star', () => {
  for (const seed of SEEDS) {
    const s = generateSystem(seed);
    for (const t of TIMES) {
      const pos = systemPositions(s, t);
      for (const b of s.bodies) {
        const p = pos.get(b.id);
        assert.ok(Math.hypot(...p) > s.star.radius + b.radius + 200, `seed ${seed} t ${t}: ${b.id} near the star`);
        for (const o of s.bodies) {
          if (o === b) continue;
          const d = distance(p, pos.get(o.id));
          assert.ok(d > b.radius + o.radius + 100, `seed ${seed} t ${t}: ${b.id} overlaps ${o.id}`);
          if (b.giant && o.parent !== b.id) assert.ok(d > b.radius + 1600, `seed ${seed} t ${t}: ${o.id} crowds ${b.name}`);
        }
      }
    }
  }
});
