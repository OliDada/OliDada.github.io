import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { generateSystem } from './system.mjs';
import { civilizationOf } from './civilizations.mjs';
import { terrainFor } from './terrain.mjs';
import { buildSurface } from './surface.js';
import { buildInterior, canEnter } from './interior.js';

// Worlds with builders of different families, with homes near the site.
const found = new Map();
for (let s = 0; s < 4000 && found.size < 5; s++) for (const body of generateSystem(s * 7919 + 13).bodies) {
  const civ = civilizationOf(body);
  if (!civ || body.giant || civ.spaceborne || !['village builders', 'metalworkers', 'city builders'].includes(civ.tier) || civ.species.aquatic) continue;
  const key = civ.species.plan + civ.tier; if (found.has(key)) continue;
  found.set(key, body);
}

test('homes can be gone into, sized to their builders, furnished their own way, with the household at home', () => {
  let entered = 0, small = 0;
  const families = new Set();
  for (const body of found.values()) {
    const t = terrainFor(body), R = body.radius;
    const site = buildSurface({ body, radius: R, signalNormal: new THREE.Vector3(...t.site), landingNormal: new THREE.Vector3(...t.landing), surfacePoint: (n, o = 0) => n.clone().multiplyScalar(R + t.surface(n) + o), coarse: true });
    const s = site.structures;
    if (!s.dwellings?.length) continue;
    for (const d of s.dwellings.slice(0, 6)) {
      const ok = canEnter(d, s.civ);
      if (!ok.ok) { small++; continue; }
      const room = buildInterior(THREE, { dwelling: d, civ: s.civ, palette: s.palette, stance: 'welcome', seed: 'x' });
      entered++; families.add(s.civ.family);
      assert.ok(room.height >= 2.2 && room.radius >= 1.5, 'you fit');
      assert.ok(room.group.children.length > 6, 'furnished');
      // You can't walk through the wall, and the household doesn't stand in the doorway.
      let x = room.start.x, z = room.start.z;
      for (let i = 0; i < 200; i++) [x, z] = room.resolve(x, z, x - .05, z - .05, .35);
      assert.ok(Math.hypot(x, z) < room.radius, 'inside the walls');
      for (const c of room.crew()) assert.ok(Math.hypot(c.x - room.start.x, c.z - room.start.z) > c.r + .3, 'not in your way as you come in');
      for (let i = 0; i < 100; i++) room.update(.05, i * .05, { x: room.start.x, z: room.start.z });
      for (const c of room.crew()) assert.ok(Math.hypot(c.x - room.start.x, c.z - room.start.z) > c.r + .3, 'and never on top of you');
      room.dispose();
    }
  }
  assert.ok(entered >= 3, `entered some (${entered}, ${small} too small)`);
  assert.ok(families.size >= 2, [...families].join());
});

test('a big species builds homes too low for you to go into only when it is small', () => {
  const d = { foot: 1.1, h: 2, base: new THREE.Matrix4() };
  assert.equal(canEnter(d, { family: 'hands' }).ok, false);
  assert.equal(canEnter({ ...d, foot: 4, h: 7 }, { family: 'hands' }).ok, true);
});
