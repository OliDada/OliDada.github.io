import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { findScanTarget, cardFor } from './scanning.js';
import { buildGeology } from './geology-mesh.js';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';
import { faunaFor } from './fauna.mjs';
import { floraFor } from './flora.mjs';

const world = (pred) => { for (let s = 1; s < 400; s++) { const b = generateSystem(s).bodies.find((x) => !x.giant && pred(x)); if (b) return b; } };
const none = { fauna: [], flora: [], formation: [] };

test('the scan target is what the crosshair is on, recorded or not', () => {
  const body = world((b) => b.physics), terrain = terrainFor(body), signal = new THREE.Vector3(...terrain.site);
  const geology = buildGeology(THREE, { body, terrain, radius: body.radius, signalNormal: signal, landingNormal: signal });
  const p = geology.placed.find((x) => x.scales.some((s) => s > 0));
  const i = [...p.scales].findIndex((s) => s > 0);
  const at = new THREE.Vector3(p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]);
  const here = at.clone().addScaledVector(new THREE.Vector3(1, 0, 0).cross(at).normalize(), 3); // 3 m away
  const eye = here.clone().addScaledVector(here.clone().normalize(), 1.7);
  const site = { geology, fauna: null, flora: null };
  const aim = (target) => target.clone().sub(eye).normalize();
  const t = findScanTarget({ site, here, eye, forward: aim(at.clone().addScaledVector(at.clone().normalize(), p.height * p.scales[i] * .45)), known: none });
  assert.ok(t, 'something under the crosshair');
  assert.equal(t.kind, 'formation');
  assert.equal(t.known, false);
  assert.ok(t.point.distanceTo(here) <= t.reach);
  const again = findScanTarget({ site, here, eye, forward: aim(t.point), known: { ...none, formation: [t.id] } });
  assert.ok(again && again.id === t.id && again.known, 'recorded things can still be looked at');
  const away = findScanTarget({ site, here, eye, forward: aim(t.point).negate(), known: none });
  assert.ok(!away || away.id !== t.id || away.point.distanceTo(t.point) > 1, 'nothing behind you');
  // Mid-scan the target is kept with a looser aim, or lost.
  const kept = findScanTarget({ site, here, eye, forward: aim(t.point), known: none, keep: t, holding: true });
  assert.equal(kept?.id, t.id);
});

test('cards are clean: a title, a one-sentence lede and labelled facts', () => {
  const body = world((b) => faunaFor(b).species.length > 2 && floraFor(b).species.length);
  const fauna = faunaFor(body), flora = floraFor(body), site = { fauna: { species: fauna.species } };
  const cards = [
    ...fauna.species.map((ref) => cardFor({ kind: 'fauna', ref }, site, body)),
    ...flora.species.map((ref) => cardFor({ kind: 'flora', ref }, site, body)),
  ];
  for (const c of cards) {
    assert.ok(c.title && c.lede, c.title);
    assert.ok(c.lede.split(/[.!?]\s/).length === 1, `one sentence: ${c.lede}`);
    for (const [k, v] of c.facts) assert.ok(k && v && !/undefined|null|NaN/.test(String(v)), `${c.title}: ${k} = ${v}`);
  }
  const animal = cards[0];
  assert.ok(animal.facts.some(([k]) => k === 'Diet') && animal.facts.some(([k]) => k === 'Active'));
});

test('field glasses reach farther, and the deep core sampler turns a recorded rock into a core target', () => {
  const body = world((b) => b.physics), terrain = terrainFor(body), signal = new THREE.Vector3(...terrain.site);
  const geology = buildGeology(THREE, { body, terrain, radius: body.radius, signalNormal: signal, landingNormal: signal });
  const p = geology.placed.find((x) => x.scales.some((s) => s > 0));
  const i = [...p.scales].findIndex((s) => s > 0);
  const at = new THREE.Vector3(p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]);
  const point = at.clone().addScaledVector(at.clone().normalize(), p.height * p.scales[i] * .45);
  const site = { geology, fauna: null, flora: null };
  const from = (metres) => {
    const here = at.clone().addScaledVector(new THREE.Vector3(1, 0, 0).cross(at).normalize(), metres);
    const eye = here.clone().addScaledVector(here.clone().normalize(), 1.7);
    return { here, eye, forward: point.clone().sub(eye).normalize() };
  };
  const far = from(p.foot * p.scales[i] + 7 + 12); // beyond plain reach
  const t = (extra) => findScanTarget({ site, ...far, known: none, ...extra });
  assert.ok(!t() || t().id !== p.formation.id, 'out of reach without the glasses');
  assert.equal(t({ reachScale: 4, aimScale: .2 })?.id, p.formation.id, 'in reach zoomed in');
  const near = from(3), known = { ...none, formation: [p.formation.id], core: [] };
  const core = findScanTarget({ site, ...near, known, cores: true });
  assert.equal(core?.kind, 'core');
  assert.equal(core.known, false);
  const done = findScanTarget({ site, ...near, known: { ...known, core: [p.formation.id] }, cores: true });
  assert.equal(done?.kind, 'formation', 'sampled once, it is a recorded rock again');
  assert.ok(cardFor({ ...core, sample: { origin: 'It formed.', ageText: 'about 2.0 billion years', depth: 12 } }, site, body).title.includes('deep core'));
});
