import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { generateSystem } from './system.mjs';
import { civilizationsIn, colonistOf } from './civilizations.mjs';
import { buildMegastructures } from './megastructures.js';

const find = (tier) => { for (let s = 0; s < 20000; s++) { const sys = generateSystem(s); const c = civilizationsIn(sys).find(c => c.tier === tier && c.extent === 'system'); if (c) return { sys, c }; } };
const worldsOf = (sys) => new Map(sys.bodies.map(b => { const g = new THREE.Group(); g.position.set(...b.position); return [b.id, { body: b, group: g }]; }));

test('system-shapers settle every rocky world and build a ring, elevators, habitats and a star swarm', () => {
  const { sys, c } = find('system-shapers');
  const free = sys.bodies.filter(b => !b.giant && b.id !== c.home && !civilizationsIn(sys).some(x => x.home === b.id));
  for (const b of free) assert.equal(colonistOf(sys, b)?.id, c.id, `${b.id} not settled`);
  assert.match(c.description, /ring circles their world/);
  const worlds = worldsOf(sys), group = new THREE.Group(), mega = buildMegastructures(THREE, sys, worlds, group);
  const home = worlds.get(c.home).group;
  assert.ok(home.children.length >= 3, 'no ring or elevators on the home world');
  // The ring stays clear of the ground and below the moons.
  const ring = home.children[0]; ring.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(ring, true), size = box.getSize(new THREE.Vector3());
  const R = sys.bodies.find(b => b.id === c.home).radius;
  assert.ok(Math.max(size.x, size.y, size.z) > 2.4 * R && Math.max(size.x, size.y, size.z) < 2.8 * R, 'ring the wrong size');
  for (const t of [0, 50, 500]) mega.update(t, new THREE.Vector3());
  const traffic = group.children.find(o => o.isPoints);
  assert.ok(traffic, 'no traffic between worlds');
  const pos = traffic.geometry.attributes.position.array;
  for (const v of pos) assert.ok(Number.isFinite(v));
  mega.dispose();
});

test('spacefarers with colonies fly between worlds but build no ring', () => {
  const { sys, c } = find('spacefarers');
  const worlds = worldsOf(sys), group = new THREE.Group(), mega = buildMegastructures(THREE, sys, worlds, group);
  assert.equal(worlds.get(c.home).group.children.length, 0);
  mega.update(10);
  assert.ok(group.children.some(o => o.isPoints));
});

test('colonists on a lifeless world can be found and scanned, and the codex marks the world as settled', async () => {
  const { buildSurface } = await import('./surface.js');
  const { findScanTarget } = await import('./scanning.js');
  const { worldTraits } = await import('./codex.mjs');
  const { terrainFor } = await import('./terrain.mjs');
  const sys = generateSystem(38), body = sys.bodies.find(b => colonistOf(sys, b) && b.physics.life === 'none');
  const t = terrainFor(body), R = body.radius;
  const site = buildSurface({ body, radius: R, signalNormal: new THREE.Vector3(...t.site), landingNormal: new THREE.Vector3(...t.landing), surfacePoint: (n, o = 0) => n.clone().multiplyScalar(R + t.surface(n) + o), coarse: false, colonist: colonistOf(sys, body) });
  const colonist = site.fauna.species.find(s => s.id.endsWith('-colonist'));
  assert.ok(colonist, 'colonists are not among the world\'s animals');
  const [one] = site.fauna.individualsOf(colonist);
  assert.ok(one, 'no colonist to find');
  const eye = one.position.clone().addScaledVector(one.position.clone().normalize(), 1.6).addScaledVector(new THREE.Vector3(1, 0, 0), 4);
  const forward = one.position.clone().sub(eye).normalize();
  const target = findScanTarget({ site, here: eye, eye, forward, known: { fauna: [], flora: [], formation: [] } });
  assert.equal(target?.ref?.id, colonist.id);
  assert.equal(worldTraits(sys, body).colonists, true);
});

test('city lights seen from space come from the lights really built', async () => {
  const { buildCityLights } = await import('./city-lights.js');
  const { urbanOf } = await import('./urban.mjs');
  const sys = generateSystem(38), body = sys.bodies.find(b => b.id === 'planet-3');
  const points = [new THREE.Vector3(1, 2, 3), new THREE.Vector3(4, 5, 6)];
  const { networkFor } = await import('./settlements.mjs');
  const { terrainFor } = await import('./terrain.mjs');
  const { civilizationOf } = await import('./civilizations.mjs');
  const net = networkFor(body, civilizationOf(body), terrainFor(body), {});
  const all = new Set(net.settlements.map(s => s.id));
  const lights = buildCityLights(THREE, sys, body, { value: new THREE.Vector3() }, { points, places: all, colour: '#ffd98a' });
  const real = [...lights.geometry.attributes.real.array];
  assert.equal(real.filter((v) => v === 1).length, 2, 'the lights really built');
  if (!urbanOf(body)) assert.equal(real.length, 2, 'built places still get made-up lights'); // (a city world is lit all over its city as well)
});

test('a system-shaper home world is built over: towers on dry land, clear of the places built in detail', async () => {
  const { terrainFor } = await import('./terrain.mjs');
  const { sys, c } = find('system-shapers');
  const home = sys.bodies.find(b => b.id === c.home), terrain = terrainFor(home), site = new THREE.Vector3(...terrain.site);
  const worlds = worldsOf(sys), group = new THREE.Group();
  buildMegastructures(THREE, sys, worlds, group, { value: new THREE.Vector3() });
  const city = worlds.get(c.home).group.children.filter(o => o.name === 'world-city');
  const towers = city.reduce((a, m) => a + m.count, 0);
  assert.ok(towers > 1500, `only ${towers} towers`);
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  for (const mesh of city) for (let i = 0; i < mesh.count; i += 7) {
    mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m); const n = p.clone().normalize();
    assert.ok(!terrain.isLiquid(n), 'a tower in the sea');
    assert.ok(n.angleTo(site) * home.radius > 250, 'a tower on the landing site');
  }
  assert.ok(worlds.get(c.home).group.children.some(o => o.name === 'world-city-lights'), 'no night lights for the world-city');
});

test('civilizations follow a path that shows in their description', async () => {
  const { PATHS } = await import('./civilizations.mjs');
  const seen = new Set();
  for (let s = 0; s < 3000; s++) for (const c of civilizationsIn(generateSystem(s))) {
    assert.ok(PATHS.includes(c.path));
    seen.add(c.path);
    if (c.level >= 2) assert.ok(c.description.length > 40);
  }
  assert.ok(seen.size >= 5, `only ${[...seen].join(', ')}`);
});

test('the in-between steps: metalworkers forge, industrial worlds smoke, orbital worlds launch satellites but fly no ships', async () => {
  const { buildStructures } = await import('./structures-mesh.js');
  const { buildFauna } = await import('./fauna-mesh.js');
  const { terrainFor } = await import('./terrain.mjs');
  const { civilizationOf, DISPOSITIONS } = await import('./civilizations.mjs');
  const want = new Map([['metalworkers', null], ['industrial', null], ['orbital', null]]);
  for (let s = 0; s < 6000 && [...want.values()].some(v => !v); s++) for (const b of generateSystem(s).bodies) { const c = civilizationOf(b); if (c && want.has(c.tier) && !want.get(c.tier)) want.set(c.tier, b); }
  for (const [tier, b] of want) {
    assert.ok(b, `no ${tier} world found`);
    const c = civilizationOf(b);
    assert.ok(DISPOSITIONS.includes(c.disposition) && c.offers.tier && c.offers.path, `${tier}: no disposition or offers`);
    const terrain = terrainFor(b), signal = new THREE.Vector3(...terrain.site), fauna = buildFauna(THREE, { body: b, terrain, radius: b.radius, signalNormal: signal, budget: 40 });
    const s = buildStructures(THREE, { body: b, terrain, radius: b.radius, signalNormal: signal, landingNormal: new THREE.Vector3(...terrain.landing), fauna });
    if (!s.civ) continue;
    if (tier === 'orbital') { assert.ok(s.station, 'no station'); assert.equal(s.flights.length, 0, 'orbital worlds have no ships yet'); assert.equal(s.ship, null); }
    if (tier !== 'orbital') assert.ok(s.group.children.some(m => m.isInstancedMesh && m.material.transparent), `${tier}: no smoke`);
  }
});
