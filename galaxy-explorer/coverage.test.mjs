// The terrain must be solid where you can see it: rays toward the surface near the
// camera always hit a visible tile (catches holes, inside-out triangles, bad culling).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { createTerrainStreamer, createPlanet } from './planet-lod.js';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';

test('no holes in the terrain on foot or from low flight', () => {
  const bodies = generateSystem(12345).bodies.filter(b => !b.giant); // giants have no terrain
  for (const body of [bodies[0], bodies.reduce((a, b) => (b.radius > a.radius ? b : a))]) {
    const streamer = createTerrainStreamer(), planet = createPlanet(THREE, streamer, body, { segments: 12 });
    const t = terrainFor(body), sig = new THREE.Vector3(...body.signal);
    const toSig = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sig);
    for (const [height, reach] of [[1.75, 120], [150, 400]]) {
      const cam = sig.clone().multiplyScalar(body.radius + t.surface(sig) + height);
      for (let i = 0; i < 400; i++) { planet.update(cam); streamer.pump(1000); }
      planet.update(cam);
      planet.group.updateMatrixWorld(true);
      const tiles = planet.group.children.filter(m => m.visible && m.geometry.attributes.color);
      const ray = new THREE.Raycaster();
      let miss = 0;
      for (let i = 0; i < 150; i++) {
        const a = (i / 150) * reach / body.radius, b = i * 2.39996;
        const d = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)).applyQuaternion(toSig);
        ray.set(d.clone().multiplyScalar(body.radius * 2), d.clone().negate());
        if (!ray.intersectObjects(tiles, false).length) miss++;
      }
      assert.equal(miss, 0, `${body.name}: ${miss} holes within ${reach} m seen from ${height} m`);
    }
    planet.dispose();
  }
});
