import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { faunaFor, PLANS } from './fauna.mjs';
import { buildFauna } from './fauna-mesh.js';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';

const worlds = [];
for (let s = 0; s < 2500 && worlds.length < 900; s++) worlds.push(...generateSystem(s).bodies);
const living = worlds.filter(b => faunaFor(b).species.length);

test('only worlds with simple or complex life have animals; simple life only small crawlers', () => {
  assert.ok(living.length > 10, `only ${living.length} worlds with animals`);
  for (const b of worlds) {
    const { species } = faunaFor(b);
    if (b.physics.life === 'none' || b.physics.life === 'microbial') assert.equal(species.length, 0);
    if (b.physics.life === 'simple') for (const s of species) assert.ok(['hexapod', 'serpent'].includes(s.plan));
    if (b.physics.pressure < .15) assert.ok(!species.some(s => s.plan === 'flyer'), `${b.name}: flyer in near-vacuum`);
  }
});

test('species are deterministic and well-formed', () => {
  for (const b of living) {
    assert.deepEqual(faunaFor(b), faunaFor(b));
    for (const s of faunaFor(b).species) {
      assert.ok(PLANS[s.plan] && s.size > 0 && s.size < 12 && s.legLength > 0);
      for (const c of Object.values(s.colors)) assert.match(c, /^#[0-9a-f]{6}$/);
      assert.ok(s.description.length > 20 && s.group >= 1 && s.herds >= 1);
    }
  }
});

test('gravity shapes bodies: weak gravity gives relatively longer legs', () => {
  const walkers = living.flatMap(b => faunaFor(b).species.filter(s => ['quadruped', 'biped', 'hexapod'].includes(s.plan)).map(s => ({ r: s.legLength / s.size, g: b.physics.gravity })));
  const low = walkers.filter(w => w.g < .6), high = walkers.filter(w => w.g > 1.2), avg = l => l.reduce((a, w) => a + w.r, 0) / l.length;
  if (low.length > 3 && high.length > 3) assert.ok(avg(low) > avg(high));
});

test('animals are built, stay out of water and near the site, and skittish ones flee', () => {
  const complex = living.filter(b => b.physics.life === 'complex').slice(0, 4);
  assert.ok(complex.length);
  for (const body of complex) {
    const terrain = terrainFor(body), signal = new THREE.Vector3(...body.signal);
    const fauna = buildFauna(THREE, { body, terrain, radius: body.radius, signalNormal: signal, budget: 60 });
    assert.ok(fauna.creatures.length > 3);
    for (const m of fauna.group.children) for (const a of ['aPart', 'aPivot', 'aPhase', 'iAnim', 'color']) assert.ok(m.geometry.attributes[a], `missing ${a}`);
    for (let i = 0; i < 1200; i++) fauna.update(.05, i * .05, null); // one minute
    for (const c of fauna.creatures) {
      if (c.sp.altitude[1] === 0) assert.ok(!terrain.isLiquid(c.n), `${c.sp.name} walked into the sea`);
      assert.ok(c.n.angleTo(signal) * body.radius < 330, `${c.sp.name} wandered off`);
      const m = new THREE.Matrix4(), p = new THREE.Vector3();
      c.mesh.getMatrixAt(c.index, m); p.setFromMatrixPosition(m);
      assert.ok(Number.isFinite(p.x) && p.length() >= body.radius + terrain.surface(c.n) - 1e-3);
    }
    const prey = fauna.creatures.find(c => c.sp.behavior === 'skittish');
    if (prey) {
      const player = { position: prey.n.clone().multiplyScalar(body.radius + terrain.surface(prey.n)).add(prey.heading.clone().multiplyScalar(2)), onFoot: true };
      const before = prey.n.angleTo(player.position.clone().normalize());
      for (let i = 0; i < 40; i++) fauna.update(.05, i * .05, player);
      assert.ok(prey.n.angleTo(player.position.clone().normalize()) > before, 'skittish animal did not flee');
    }
  }
});
