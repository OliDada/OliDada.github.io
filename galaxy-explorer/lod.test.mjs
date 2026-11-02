import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { buildChunk, chunkIndices, faceDirection } from './chunk-build.mjs';
import { createTerrainStreamer, createPlanet } from './planet-lod.js';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';

const bodies = [];
for (let s = 0; s < 80; s++) bodies.push(...generateSystem(s * 31 + 7).bodies);
const waterWorld = bodies.find(b => terrainFor(b).liquid === 'water');
const big = bodies.reduce((a, b) => (b.radius > a.radius ? b : a));

test('cube-sphere directions are unit length and cover the sphere', () => {
  for (let f = 0; f < 6; f++) for (const a of [-1, -.3, 0, .7, 1]) for (const b of [-1, 0, .5, 1]) {
    const d = faceDirection(f, a, b); assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
  }
  // Face centres point along the six axes.
  assert.deepEqual(faceDirection(2, 0, 0).map(Math.round), [0, 1, 0]);
});

test('tiles follow the terrain exactly and carry skirts and water', () => {
  const S = 12, { indices, edge } = chunkIndices(S), t = terrainFor(waterWorld);
  const out = buildChunk(waterWorld, { face: 4, a0: -.5, b0: -.5, size: 1, segments: S });
  assert.equal(out.positions.length / 3, (S + 1) ** 2 + edge.length);
  assert.ok(Math.max(...indices) < out.positions.length / 3);
  for (let j = 0; j <= S; j += 3) for (let i = 0; i <= S; i += 3) {
    const k = (j * (S + 1) + i) * 3, p = [out.positions[k] + out.center[0], out.positions[k + 1] + out.center[1], out.positions[k + 2] + out.center[2]];
    const d = faceDirection(4, -.5 + i / S, -.5 + j / S);
    // Each tile shows the terrain with detail finer than it can draw smoothed away (meshHeight's spacing).
    const spacing = waterWorld.radius * 1 * Math.PI / 4 / S;
    assert.ok(Math.abs(Math.hypot(...p) - (waterWorld.radius + t.meshHeight({ x: d[0], y: d[1], z: d[2] }, spacing))) < 1e-3);
  }
  // Skirt vertices sit below their edge vertex.
  const e0 = edge[0] * 3, s0 = (S + 1) ** 2 * 3;
  const r = (k) => Math.hypot(out.positions[k] + out.center[0], out.positions[k + 1] + out.center[1], out.positions[k + 2] + out.center[2]);
  assert.ok(r(s0) < r(e0));
  // A water world has water on at least one of its six root tiles.
  assert.ok([0, 1, 2, 3, 4, 5].some(f => buildChunk(waterWorld, { face: f, a0: -1, b0: -1, size: 2, segments: 8 }).water));
});

test('detail rises near the camera and falls away again', () => {
  const streamer = createTerrainStreamer(), planet = createPlanet(THREE, streamer, big, { segments: 10 });
  const visibleTiles = () => planet.group.children.filter(m => m.visible && m.geometry.attributes.color);
  const step = (cam, n = 60) => { for (let i = 0; i < n; i++) { planet.update(cam, { instant: true }); streamer.pump(1000); } planet.update(cam, { instant: true }); };
  const far = new THREE.Vector3(0, 0, big.radius * 30);
  step(far, 3);
  assert.ok(visibleTiles().length <= 6); // from far away: only root tiles, far side culled
  // Stand on the surface: tiles near the camera reach the finest level.
  const ground = new THREE.Vector3(0, 0, big.radius + terrainFor(big).surface({ x: 0, y: 0, z: 1 }) + 2);
  step(ground, 400);
  const near = visibleTiles().map(m => m.geometry.boundingSphere.radius);
  assert.ok(near.length > 20, `only ${near.length} tiles near the ground`);
  const smallest = Math.min(...near), largest = Math.max(...near);
  assert.ok(smallest * 8 < largest, 'tiles should range from fine (near) to coarse (far)');
  const meshes = planet.group.children.length;
  step(far, 5);
  assert.ok(planet.group.children.length < meshes / 3, 'distant planet should drop its fine tiles');
  planet.dispose();
});

test('fully blended, a fine tile lies exactly on its parent tile (no pop, no seam)', () => {
  const S = 8, V = S + 1, body = big;
  const parent = buildChunk(body, { face: 2, a0: -.5, b0: -.5, size: .5, segments: S });
  const child = buildChunk(body, { face: 2, a0: -.5, b0: -.5, size: .25, segments: S });
  const world = (c, k, morphed) => [0, 1, 2].map(i => c.positions[k * 3 + i] + c.center[i] + (morphed ? c.lodDelta[k * 3 + i] : 0));
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const m = world(child, j * V + i, true);
    // The parent's surface at this point: its vertex, or the midpoint of the parent edge/diagonal it lies on.
    const pi = i / 2, pj = j / 2, P = (a, b) => world(parent, b * V + a, false);
    let expect;
    if (Number.isInteger(pi) && Number.isInteger(pj)) expect = P(pi, pj);
    else if (!Number.isInteger(pi) && Number.isInteger(pj)) expect = P(pi - .5, pj).map((v, c) => (v + P(pi + .5, pj)[c]) / 2);
    else if (Number.isInteger(pi)) expect = P(pi, pj - .5).map((v, c) => (v + P(pi, pj + .5)[c]) / 2);
    else expect = P(pi + .5, pj - .5).map((v, c) => (v + P(pi - .5, pj + .5)[c]) / 2);
    assert.ok(Math.hypot(...m.map((v, c) => v - expect[c])) < 1e-3, `vertex ${i},${j} is off the parent surface`);
  }
});

test('after a sudden camera jump, detail eases in instead of snapping', () => {
  const streamer = createTerrainStreamer(), planet = createPlanet(THREE, streamer, big, { segments: 10 });
  const count = () => planet.group.children.filter(m => m.visible && m.geometry.attributes.color).length;
  const far = new THREE.Vector3(0, 0, big.radius * 3), ground = new THREE.Vector3(0, 0, big.radius + terrainFor(big).surface({ x: 0, y: 0, z: 1 }) + 2);
  for (let i = 0; i < 40; i++) { planet.update(far, { instant: true }); streamer.pump(1000); }
  const before = count();
  for (let i = 0; i < 40; i++) { planet.update(ground); streamer.pump(1000); } // same instant: detail is still measured from near where the camera was
  const eased = count();
  for (let i = 0; i < 400; i++) { planet.update(ground, { instant: true }); streamer.pump(1000); }
  assert.ok(eased < count() && before <= eased + 4, `${before} -> ${eased} -> ${count()}`);
  planet.dispose();
});
