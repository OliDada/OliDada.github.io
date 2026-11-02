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
    if (b.physics.life === 'simple') for (const s of species) assert.ok(['hexapod', 'serpent', 'arachnid', 'slug'].includes(s.plan));
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
    const terrain = terrainFor(body), signal = new THREE.Vector3(...terrain.site); // the dry site the game uses
    const fauna = buildFauna(THREE, { body, terrain, radius: body.radius, signalNormal: signal, budget: 60 });
    assert.ok(fauna.creatures.length > 3);
    for (const m of fauna.group.children) for (const a of ['aPart', 'aPivot', 'aPhase', 'iAnim', 'color']) assert.ok(m.geometry.attributes[a], `missing ${a}`);
    for (let i = 0; i < 1200; i++) fauna.update(.05, i * .05, null); // one minute
    for (const c of fauna.creatures) {
      if (c.hidden) continue; // caught; back at its herd later
      if (c.sp.altitude[1] === 0) assert.ok(!terrain.isLiquid(c.n), `${c.sp.name} walked into the sea`);
      assert.ok(c.n.angleTo(signal) * body.radius < 330, `${c.sp.name} wandered off`);
      const m = new THREE.Matrix4(), p = new THREE.Vector3();
      c.mesh.getMatrixAt(c.index, m); p.setFromMatrixPosition(m);
      assert.ok(Number.isFinite(p.x) && p.length() >= body.radius + terrain.surface(c.n) - c.sink - 1e-3); // sleepers settle onto folded legs
    }
    const prey = fauna.creatures.find(c => c.sp.behavior === 'skittish' && !c.hidden && !c.eco.predators.length); // a hunter, if near, takes priority over you
    if (prey) {
      const player = { position: prey.n.clone().multiplyScalar(body.radius + terrain.surface(prey.n)).add(prey.heading.clone().multiplyScalar(2)), onFoot: true };
      const before = prey.n.angleTo(player.position.clone().normalize());
      for (let i = 0; i < 40; i++) fauna.update(.05, i * .05, player);
      assert.ok(prey.n.angleTo(player.position.clone().normalize()) > before, 'skittish animal did not flee');
    }
  }
});

test('traits drive behaviour, and civilizations are rare', () => {
  let species = 0, builders = 0, spacefaring = 0;
  for (const b of living) for (const s of faunaFor(b).species) {
    species++;
    for (const k of ['intelligence', 'sociality', 'aggression', 'caution', 'metabolism', 'perception']) assert.ok(s.traits[k] >= 0 && s.traits[k] <= 1, k);
    if (s.altitude[1] === 0 && s.traits.caution > .55) assert.equal(s.behavior, 'skittish');
    if (s.civilization >= 1) assert.ok(s.traits.intelligence > .4, 'civilization without intelligence');
    if (s.arms) assert.equal(s.plan, 'biped');
    assert.ok(s.civilization >= 0 && s.civilization <= 5 && typeof s.mind === 'string' && s.description.includes(`Mind: ${s.mind}`));
    if (s.civilization >= 3) assert.ok(s.manipulators.score >= .45, `${s.plan} city builders with only ${s.manipulators.kind}`);
    builders += s.civilization >= 2; spacefaring += s.civilization >= 5;
  }
  // Small samples are noisy; galaxy-wide villages are in ~1 system in 39, spacefarers ~1 in 471.
  assert.ok(builders / species < .06 && spacefaring / species < .02, `${builders} builders, ${spacefaring} spacefaring of ${species}`);
});

test('animal models face outward and stay connected to the ground', () => {
  for (const b of living.slice(0, 25)) {
    const fauna = buildFauna(THREE, { body: b, terrain: terrainFor(b), radius: b.radius, signalNormal: new THREE.Vector3(...terrainFor(b).site), budget: 20 });
    for (const m of fauna.group.children) {
      const P = m.geometry.attributes.position.array, N = m.geometry.attributes.normal.array, part = m.geometry.attributes.aPart.array;
      let cx = 0, cy = 0, cz = 0, n = 0, out = 0, minY = Infinity;
      for (let i = 0; i < P.length; i += 3) { cx += P[i]; cy += P[i + 1]; cz += P[i + 2]; n++; minY = Math.min(minY, P[i + 1]); }
      cx /= n; cy /= n; cz /= n;
      for (let i = 0; i < P.length; i += 3) if (part[i / 3] === 0 || part[i / 3] === 4) out += Math.sign((P[i] - cx) * N[i] + (P[i + 1] - cy) * N[i + 1] + (P[i + 2] - cz) * N[i + 2]);
      assert.ok(out > 0, `${m.geometry.uuid}: body normals point inward`);
      const sp = fauna.species[fauna.group.children.indexOf(m)];
      if (sp.altitude[1] === 0 && !['serpent', 'slug'].includes(sp.plan)) assert.ok(Math.abs(minY) < sp.size * .15, `${sp.name}: feet are ${minY.toFixed(2)} m from the ground`);
    }
  }
});

test('species vary: distant worlds rarely share a look', () => {
  const keys = new Set(); let n = 0;
  for (const b of living) for (const s of faunaFor(b).species) { n++; keys.add([s.plan, s.form, s.headShape, s.back, s.tailType, s.pattern, s.scheme, s.ears, s.horns].join('|')); }
  assert.ok(n > 50 && keys.size / n > .8, `${keys.size} looks for ${n} species`);
});

test('life on other chemistry: own plants, own palette, slower animals; alien body plans exist', async () => {
  const { floraFor, FORMS } = await import('./flora.mjs');
  const exotic = worlds.filter(b => b.physics.biochemistry && b.physics.biochemistry !== 'carbon');
  assert.ok(exotic.length > 5, `only ${exotic.length} exotic worlds`);
  for (const b of worlds.filter(b => b.physics.biochemistry)) {
    const chem = b.physics.biochemistry, p = b.physics;
    if (chem === 'methane') assert.ok(p.temperature < 130);
    if (chem === 'silicon') assert.ok(p.temperature > 550);
    for (const s of floraFor(b).species) assert.ok(['mat', 'mound'].includes(s.form) || (FORMS[s.form].chem || 'carbon') === chem, `${s.form} on a ${chem} world`);
    for (const s of faunaFor(b).species) assert.equal(s.chemistry, chem);
  }
  const all = living.flatMap(b => faunaFor(b).species);
  assert.ok(all.some(s => s.plan === 'radial') && all.some(s => s.plan === 'roller'), 'no radial walkers or rollers in the sample');
  const meth = all.filter(s => s.chemistry === 'methane'), carb = all.filter(s => s.chemistry === 'carbon');
  if (meth.length > 2) assert.ok(meth.reduce((a, s) => a + s.speed.walk / s.size, 0) / meth.length < carb.reduce((a, s) => a + s.speed.walk / s.size, 0) / carb.length);
});
