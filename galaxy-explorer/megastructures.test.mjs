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
  const sys = generateSystem(38), body = sys.bodies.find(b => b.id === 'planet-3');
  const points = [new THREE.Vector3(1, 2, 3), new THREE.Vector3(4, 5, 6)];
  const { networkFor } = await import('./settlements.mjs');
  const { terrainFor } = await import('./terrain.mjs');
  const { civilizationOf } = await import('./civilizations.mjs');
  const net = networkFor(body, civilizationOf(body), terrainFor(body), {});
  const all = new Set(net.settlements.map(s => s.id));
  const lights = buildCityLights(THREE, sys, body, { value: new THREE.Vector3() }, { points, places: all, colour: '#ffd98a' });
  assert.equal(lights.geometry.attributes.position.count, 2, 'built places still get made-up lights');
});
