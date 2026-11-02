import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { geologyFor, FORMATIONS, ROCKS } from './geology.mjs';
import { buildGeology } from './geology-mesh.js';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';

const worlds = [];
for (let s = 0; s < 400; s++) worlds.push(...generateSystem(s).bodies.filter(b => !b.giant));

test('every world with a surface has 2-3 rock types, and some have a landform, all fitting its physics', () => {
  const seen = new Set();
  let withLandform = 0;
  for (const b of worlds) {
    const { formations, environment } = geologyFor(b);
    const rocks = formations.filter(f => f.type === 'rock'), landforms = formations.filter(f => f.type === 'formation');
    assert.ok(rocks.length >= 2 && rocks.length <= 3, `${b.name}: ${rocks.length} rock types`);
    assert.ok(landforms.length <= 2);
    if (landforms.length) withLandform++;
    assert.deepEqual(geologyFor(b), geologyFor(b));
    for (const f of formations) {
      seen.add(f.id);
      assert.ok((f.type === 'rock' ? ROCKS : FORMATIONS)[f.key].fit(environment) > .05, `${f.name} on a world it does not fit`);
      if (f.key === 'fumaroles') assert.ok(b.physics.pressure > .05);
      if (f.key === 'crystals') assert.ok(b.biome === 'Amethyst' || (b.physics.biochemistry || b.physics.solvent) === 'silicon');
      if (f.key === 'ice') assert.ok(environment.ice);
      assert.ok(f.description.length > 20 && f.count >= 2);
    }
  }
  assert.ok(withLandform > worlds.length * .25 && withLandform < worlds.length * .55, `landforms on ${withLandform} of ${worlds.length} worlds`);
  assert.ok(seen.size >= 22, `only ${seen.size} kinds appear`);
  for (const b of generateSystem(3).bodies.filter(b => b.giant)) assert.equal(geologyFor(b).formations.length, 0);
});

test('formations are placed on dry ground all over the world, a few near the site, clear of the signal and pad', () => {
  let placed = 0, far = 0, kinds = 0, nearKinds = 0;
  for (const body of worlds.slice(0, 60)) {
    const terrain = terrainFor(body), R = body.radius, signal = new THREE.Vector3(...terrain.site);
    const landing = new THREE.Vector3(0, 1, 30 / R).normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), signal));
    const g = buildGeology(THREE, { body, terrain, radius: R, signalNormal: signal, landingNormal: landing });
    for (const p of g.placed) {
      let near = false;
      for (let i = 0; i < p.scales.length; i++) {
        const n = new THREE.Vector3(p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]).normalize();
        assert.ok(!terrain.isLiquid(n), `${p.formation.name} in the sea`);
        assert.ok(n.angleTo(signal) * R > 12 && n.angleTo(landing) * R > 14, `${p.formation.name} on the site`);
        if (n.angleTo(signal) * R < 200) near = true;
        if (n.angleTo(signal) * R > 400) far++;
        placed++;
      }
      if (!p.formation.rare && p.scales.length) { kinds++; if (near) nearKinds++; }
    }
    assert.ok(g.group.children.length >= g.placed.length);
  }
  assert.ok(placed > 500);
  assert.ok(far > placed * 0.3, `spread over the world (${far} of ${placed} beyond 400 m)`);
  assert.ok(nearKinds >= kinds * 0.9, `common kinds near the site: ${nearKinds} of ${kinds}`);
});
