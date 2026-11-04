import test from 'node:test';
import assert from 'node:assert/strict';
import { radioSources, broadcasterAt, HEARD, SCAN_RADIUS, candidates, scan } from './signals.mjs';
import { civilizationsIn, tierAtLeast, tierName, TIERS } from './civilizations.mjs';
import { homeStar, starById, starDistance, JUMP_RANGE } from './galaxy.mjs';
import { generateSystem } from './system.mjs';
import { faunaFor } from './fauna.mjs';

test('radio signals: planet-shapers and spacefarers are heard far beyond jump range', () => {
  const here = homeStar(), t0 = performance.now(), sources = radioSources(here), ms = performance.now() - t0;
  assert.ok(sources.length > 0, 'nothing heard around home');
  assert.ok(sources.some(e => e.distance > JUMP_RANGE * 2), 'every source is within a jump or two');
  for (const e of sources) {
    const star = starById(e.id);
    assert.ok(star && Math.abs(starDistance(star, here) - e.distance) < 1e-6);
    assert.ok(tierAtLeast(e.tier, 'planet-shapers') && e.distance <= HEARD[e.tier]);
    assert.equal(broadcasterAt(star).id, e.civ);
    // The civilization is really there, with a home world in that system.
    const civ = civilizationsIn(generateSystem(star.seed)).find(c => c.id === e.civ);
    assert.ok(civ && civ.tier === e.tier && generateSystem(star.seed).bodies.some(b => b.id === civ.home));
  }
  // Slices give the same answer as one pass (main-thread fallback).
  const list = candidates(here), parts = [];
  for (let i = 0; i < list.length; i += 500) parts.push(...scan(list, i, i + 500));
  assert.deepEqual(parts, sources);
  assert.ok(ms < 4000, `scan took ${ms.toFixed(0)} ms`);
  assert.equal(SCAN_RADIUS, 150);
});

test('civilizations are entities with names, not numbers', () => {
  let n = 0;
  for (let s = 0; s < 1500; s++) for (const c of civilizationsIn(generateSystem(s))) {
    n++;
    assert.ok(TIERS.includes(c.tier) && typeof c.id === 'string' && c.id.startsWith(`${generateSystem(s).bodies.find(b => b.id === c.home).seed}:${c.home}:`));
    assert.equal(c.reach, c.tier === 'system-shapers' ? 'system' : c.tier === 'spacefarers' ? 'orbit' : c.tier === 'planet-shapers' ? 'world' : 'local');
  }
  assert.ok(n > 20);
  assert.ok(tierAtLeast('city builders', 'village builders') && !tierAtLeast('tool users', 'city builders') && !tierAtLeast('unknown', 'tool users'));
  assert.equal(tierName(3), 'spacefarers'); // the old 3-step ladder's top
  assert.equal(tierName('city builders'), 'city builders');
});
