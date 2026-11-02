import test from 'node:test';
import assert from 'node:assert/strict';
import { radioSources, civilizationAt, HEARD, SCAN_RADIUS, candidates, scan } from './signals.mjs';
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
    assert.ok(e.level >= 4 && e.distance <= HEARD[e.level]);
    assert.equal(civilizationAt(star), e.level);
    // The civilization is really there: a world in that system has a species at that level.
    assert.ok(generateSystem(star.seed).bodies.some(b => faunaFor(b).species.some(s => s.civilization === e.level)));
  }
  // Slices give the same answer as one pass (main-thread fallback).
  const list = candidates(here), parts = [];
  for (let i = 0; i < list.length; i += 500) parts.push(...scan(list, i, i + 500));
  assert.deepEqual(parts, sources);
  assert.ok(ms < 4000, `scan took ${ms.toFixed(0)} ms`);
  assert.equal(SCAN_RADIUS, 150);
});
