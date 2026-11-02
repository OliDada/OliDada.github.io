import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { faunaFor } from './fauna.mjs';
import { buildFauna } from './fauna-mesh.js';
import { buildStructures } from './structures-mesh.js';
import { civilizationFor, plural, familyOf } from './structures.mjs';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';

const civWorlds = [];
for (let s = 0; s < 3000 && civWorlds.length < 60; s++) for (const b of generateSystem(s).bodies) if (faunaFor(b).species.some(x => x.civilization)) civWorlds.push(b);
const Y = new THREE.Vector3(0, 1, 0);
function site(body) {
  const terrain = terrainFor(body), signal = new THREE.Vector3(...terrain.site);
  const landing = new THREE.Vector3(0, 1, 30 / body.radius).normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, signal));
  const fauna = buildFauna(THREE, { body, terrain, radius: body.radius, signalNormal: signal, budget: 90 });
  return { terrain, signal, landing, fauna, built: buildStructures(THREE, { body, terrain, radius: body.radius, signalNormal: signal, landingNormal: landing, fauna }) };
}

test('the most advanced species builds, in a style that follows its body', () => {
  assert.ok(civWorlds.length >= 20, `only ${civWorlds.length} worlds with intelligence`);
  for (const b of civWorlds) {
    const civ = civilizationFor(b, faunaFor(b).species);
    assert.ok(civ && civ.level >= 1 && civ.level <= 5);
    assert.equal(civ.level, Math.max(...faunaFor(b).species.map(s => s.civilization)));
    assert.equal(civ.family, familyOf(civ.species));
    // Buildings fit their builders: only species with hands build houses, rockets and halls.
    if (['timber', 'terraced', 'tents', 'stilts'].includes(civ.culture)) assert.ok(civ.species.arms, `${civ.species.plan} building ${civ.culture}`);
    if (civ.species.plan === 'flyer') assert.ok(['perches', 'rookery', 'hanging'].includes(civ.culture));
    if (civ.species.plan === 'floater') assert.ok(['tethered', 'reef', 'masts'].includes(civ.culture));
    assert.ok(civ.description.startsWith(`The ${plural(civ.species.name)}`));
    assert.deepEqual(civilizationFor(b, faunaFor(b).species), civ);
  }
  assert.equal(civilizationFor(generateSystem(1).bodies[0], []), null);
});

test('settlements stand on dry ground, clear of the signal and pad, within walking range, and grow with level', () => {
  let built = 0; const byLevel = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const b of civWorlds.slice(0, 30)) {
    const { terrain, signal, landing, fauna, built: s } = site(b);
    if (!s.civ) continue; // a water world with no land near the site
    built++;
    byLevel[s.civ.level].push(s.pieces);
    for (const n of s.sites) {
      assert.ok(!terrain.isLiquid(n));
      assert.ok(n.angleTo(signal) * b.radius > 25 && n.angleTo(landing) * b.radius > 25, 'built on the landing site');
      assert.ok(n.angleTo(signal) * b.radius < 300 || s.network.capital.far, 'too far to walk to');
    }
    for (const o of s.obstacles) assert.ok(!terrain.isLiquid(o.p.clone().normalize()) && Number.isFinite(o.r) && o.h > 0);
    // Builders live where they build: their herds' homes moved onto the settlements.
    const homes = fauna.homes.get(s.civ.species.id);
    assert.ok(homes.some(h => h.angleTo(s.sites[0]) < 1e-6), 'nobody lives in the capital');
    assert.ok(s.network.capital.far || s.sites[0].angleTo(signal) * b.radius < 300, 'the capital is not beside the landing site');
    const pos = s.group.children.find(m => m.isMesh && !m.isInstancedMesh).geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) assert.ok(Number.isFinite(pos[i]) && Math.hypot(pos[i], pos[i + 1], pos[i + 2]) < b.radius + 800); // tethers reach high
  }
  assert.ok(built >= civWorlds.slice(0, 30).length * .8, `${built} of 30 worlds built anything`);
  const med = (l) => l.sort((a, c) => a - c)[l.length >> 1] || 0;
  if (byLevel[2].length && byLevel[3].length) assert.ok(med(byLevel[3]) > med(byLevel[2]));
});

test('spacefarers launch satellites that stay in orbit', () => {
  const b = civWorlds.find(b => civilizationFor(b, faunaFor(b).species).level === 5) || (() => { for (let s = 0; s < 1000; s++) for (const x of generateSystem(s).bodies) if (faunaFor(x).species.some(y => y.civilization === 5)) return x; })();
  const { built } = site(b);
  const sats = built.group.children.find(m => m.isInstancedMesh);
  assert.ok(sats && sats.count > 3);
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  for (const t of [0, 100, 1000]) { built.update(t); for (let i = 0; i < sats.count; i++) { sats.getMatrixAt(i, m); p.setFromMatrixPosition(m); assert.ok(p.length() > b.radius * 1.2 && p.length() < b.radius * 1.9); } }
});

test('the ladder: cities and beyond are bigger, planet-shapers spread over the world and stay within budget', () => {
  const sample = [];
  for (let s = 0; s < 3000 && sample.length < 6; s++) for (const b of generateSystem(s).bodies) if (faunaFor(b).species.some(x => x.civilization >= 4)) sample.push(b);
  assert.ok(sample.length >= 3);
  for (const b of sample) {
    const { built, signal } = site(b);
    if (!built.civ) continue;
    const pos = built.group.children.filter(m => m.isMesh && !m.isInstancedMesh).reduce((a, m) => a + m.geometry.attributes.position.count, 0);
    assert.ok(pos < 260000, `${pos} vertices`);
    // Towns well beyond the site, on the far side of the world too.
    // Planetary civilizations have towns across the world, with night lights.
    if (built.civ.extent === 'planetary' || built.civ.extent === 'system') {
      const farthest = Math.max(...built.network.settlements.map(p => new THREE.Vector3(...p.n).angleTo(signal)));
      assert.ok(farthest > 1.5, 'no towns across the world');
      assert.ok(built.group.children.some(c => c.isPoints && c.geometry.attributes.position.count > 20), 'no night lights');
    }
  }
});

test('rocks and plants are cleared from settlements on the real landing site', async () => {
  const { buildSurface } = await import('./surface.js');
  let checked = 0;
  for (const body of civWorlds.slice(0, 12)) {
    const terrain = terrainFor(body), R = body.radius, signal = new THREE.Vector3(...terrain.site);
    const landing = new THREE.Vector3(0, 1, 30 / R).normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, signal));
    const surfacePoint = (n, off = 0) => n.clone().multiplyScalar(R + terrain.surface(n) + off);
    const site = buildSurface({ body, radius: R, signalNormal: signal, landingNormal: landing, surfacePoint, coarse: false });
    if (!site.structures.civ) continue;
    checked++;
    const rocks = site.group.children.find(c => c.isInstancedMesh && c.geometry.type === 'IcosahedronGeometry');
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(), qq = new THREE.Quaternion();
    const pieces = site.structures.obstacles;
    for (let i = 0; i < rocks.count; i++) {
      rocks.getMatrixAt(i, m); m.decompose(p, qq, sc);
      if (sc.x === 0) continue; // cleared
      const rr = Math.max(sc.x, sc.z) * .8;
      for (const o of pieces) assert.ok(o.p.distanceTo(p) > o.r + rr * .5, `${body.name}: a rock stands inside a building`);
    }
    // No rock obstacles left inside buildings either.
    for (const o of site.obstacles) if (o.rock !== undefined) for (const b of pieces) assert.ok(o.p.distanceTo(b.p) > b.r + o.r * .5);
  }
  assert.ok(checked >= 5, `only ${checked} settlements checked`);
});
