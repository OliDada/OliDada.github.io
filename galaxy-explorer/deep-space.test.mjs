import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { toGalaxy, toScene, systemEdge, ARRIVE_LY, starGameRadius } from './deep-space.js';
import { generateSystem } from './system.mjs';
import { systemPositions } from './orbits.mjs';
import { homeStar, starsNear, starPhysics } from './galaxy.mjs';

test('system and galaxy axes match the star map, both ways', () => {
  const v = new THREE.Vector3(3, 5, -7), g = toGalaxy(v);
  assert.deepEqual(g, [3, 7, 5]); // map: x stays, galaxy y = -z, height = y
  assert.ok(toScene(g).distanceTo(v) < 1e-12);
});

test('every world stays inside its system edge as it orbits', () => {
  for (let seed = 0; seed < 300; seed++) {
    const s = generateSystem(seed), edge = systemEdge(s);
    for (const t of [0, 1234, 99999]) {
      const pos = systemPositions(s, t);
      for (const b of s.bodies) {
        const p = pos.get(b.id);
        assert.ok(Math.hypot(p[0], p[2]) + b.radius < edge - 7000, `seed ${seed}: ${b.id} reaches the edge`);
      }
    }
  }
});

test('a star seen from its system edge looks the size the deep-space approach draws', () => {
  for (const { star } of starsNear(homeStar(), 15).slice(0, 20)) {
    const s = generateSystem(star.seed), physics = starPhysics(star);
    assert.equal(starGameRadius(physics), s.star.radius);
    // Deep space draws the star at radius / (distance × metres per ly); at the edge that is radius / edge.
    const metresPerLy = systemEdge(s) / ARRIVE_LY;
    assert.ok(Math.abs(s.star.radius / (ARRIVE_LY * metresPerLy) - s.star.radius / systemEdge(s)) < 1e-12);
  }
});

test('neighbouring stars are far further apart than a system is wide', () => {
  const near = starsNear(homeStar(), 30).filter(e => e.distance > 0);
  assert.ok(near.length > 3);
  assert.ok(near[0].distance > ARRIVE_LY * 50, `nearest star only ${near[0].distance} ly away`);
});
