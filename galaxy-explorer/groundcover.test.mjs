import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';
import { createGroundCover } from './groundcover.js';

const world = (seed, id) => generateSystem(seed).bodies.find(b => b.id === id);
const at = (body, t, n, up) => n.clone().multiplyScalar(body.radius + t.surface(n) + up);
const snapshot = (gc) => gc.group.children.map(m => [m.count, Array.from(m.instanceMatrix.array.slice(0, m.count * 16))]);

test('ground cover fills a grassy landing site and stays put when you walk away and back', () => {
  const body = world(76, 'planet-1'), t = terrainFor(body), n = new THREE.Vector3(...t.site).normalize();
  const gc = createGroundCover(THREE, { body, radius: body.radius });
  gc.update(at(body, t, n, 1.7), 0, 1e9);
  assert.equal(gc.busy, 0);
  // A meadow's tufts, or (new plant style) a forest floor's ferns and moss.
  const tufts = gc.group.children.reduce((s, m) => s + m.count, 0);
  assert.ok(tufts > 1000, `expected a meadow or forest floor, got ${tufts} items`);
  const first = snapshot(gc);
  const side = new THREE.Vector3(1, 0, 0).cross(n).normalize();
  gc.update(at(body, t, n.clone().addScaledVector(side, 60 / body.radius).normalize(), 1.7), 0, 1e9);
  gc.update(at(body, t, n, 1.7), 0, 1e9);
  assert.deepEqual(snapshot(gc), first);
});

test('ground cover hides itself high above the ground and on phones uses less', () => {
  const body = world(76, 'planet-1'), t = terrainFor(body), n = new THREE.Vector3(...t.site).normalize();
  const laptop = createGroundCover(THREE, { body, radius: body.radius });
  const phone = createGroundCover(THREE, { body, radius: body.radius, coarse: true });
  laptop.update(at(body, t, n, 1.7), 0, 1e9); phone.update(at(body, t, n, 1.7), 0, 1e9);
  const total = (gc) => gc.group.children.reduce((s, m) => s + m.count, 0);
  assert.ok(total(phone) < total(laptop) / 2);
  laptop.update(at(body, t, n, 400), 0, 1e9);
  assert.equal(laptop.group.visible, false);
});

test('ground cover never grows on water', () => {
  const body = world(42, 'planet-3'), t = terrainFor(body), n = new THREE.Vector3(...t.site).normalize();
  const gc = createGroundCover(THREE, { body, radius: body.radius });
  gc.update(at(body, t, n, 1.7), 0, 1e9);
  const p = new THREE.Vector3(), m = new THREE.Matrix4();
  for (const mesh of gc.group.children) for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m).normalize();
    assert.equal(t.isLiquid(p), false);
  }
});
