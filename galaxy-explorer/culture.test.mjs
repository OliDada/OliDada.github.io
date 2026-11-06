import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { faunaFor } from './fauna.mjs';
import { buildFauna } from './fauna-mesh.js';
import { cultureOf, MANIP_WORDS } from './fauna-culture.mjs';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';

const worlds = [];
for (let s = 0; s < 2500 && worlds.length < 900; s++) worlds.push(...generateSystem(s).bodies);
const living = worlds.filter(b => faunaFor(b).species.length);

test('civilized species get manipulators and culture; others none', () => {
  for (const b of living) for (const s of faunaFor(b).species) {
    const c = cultureOf(s);
    if (!s.civilization) { assert.equal(c, null); continue; }
    assert.ok(MANIP_WORDS[c.manip], `${s.plan}: no manipulators`);
    assert.equal(s.manipulators.kind, MANIP_WORDS[c.manip]);
    assert.deepEqual(cultureOf(s), c); // deterministic
  }
});

test('higher civilization levels wear and carry more, and stay on the ground', () => {
  const b = living.find(x => faunaFor(x).species.some(s => s.plan === 'quadruped' || s.plan === 'biped'));
  const base = faunaFor(b).species.find(s => s.plan === 'quadruped' || s.plan === 'biped');
  // stages: none, tool users, village builders, city builders, spacefarers
  const list = [0, 1, 2, 4, 8].map(L => ({ ...base, civilization: L, id: `${base.id}-${L}` }));
  const terrain = terrainFor(b);
  const fauna = buildFauna(THREE, { body: b, terrain, radius: b.radius, signalNormal: new THREE.Vector3(...terrain.site), budget: 20, species: list });
  const counts = fauna.group.children.filter(m => m.geometry.attributes.aPart).map(m => m.geometry.attributes.position.count);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] > counts[i - 1], `level ${[0, 1, 2, 3, 5][i]} adds nothing: ${counts}`);
  const glow = fauna.group.children.filter(m => m.geometry.attributes.aPart).map(m => m.geometry.attributes.aGlow.array.some(v => v > 0));
  assert.ok(glow[4], 'spacefarers carry glowing tech');
});

test('cultures differ in how they present themselves: not all dress, not all have hands', () => {
  const styles = {}, arms = new Set(), bodies = new Set();
  for (const b of living) for (const s of faunaFor(b).species) if (s.civilization) {
    const c = cultureOf(s); styles[c.style] = (styles[c.style] || 0) + 1; arms.add(c.armStyle); bodies.add(`${s.build}/${s.alien || s.form}`);
    assert.equal(s.culture.style, c.style);
  }
  const total = Object.values(styles).reduce((a, v) => a + v, 0);
  assert.ok(Object.keys(styles).length >= 4, `only ${Object.keys(styles)} styles`);
  assert.ok((styles.clothed || 0) < total * .6, 'nearly everyone wears clothes');
  assert.ok(arms.size >= 3 && bodies.size >= 8);
});
