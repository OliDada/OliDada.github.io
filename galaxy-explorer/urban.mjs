// City worlds: the most advanced civilizations with the temperament for it (ambitious and
// close-knit, not ones who live lightly on their land) build over most of their home
// world: an ecumenopolis. This module decides that (urbanOf) and says where the city is
// (mask), from the body alone, so the terrain can use it: inside the city the ground is
// levelled into terraces (terrain.mjs), the land is the colour of a city from orbit,
// wild plants and animals give way to it except in its parks, the night side is lit all
// over (city-lights.js) and the ground around you is a planned city to the horizon
// (structures-mesh.js plannedCity). Pure and deterministic.
//
//   urbanOf(body) -> null | { coverage, tier, level, mask(n) -> 0..1, park(n) -> bool, step, grid }
//   temperamentOf(body, c): ambition, cohesion and harmony of a civilization (civilizations.mjs).
import { rng, hash32 } from './rng.mjs';
import { faunaFor, CIVILIZATION } from './fauna.mjs';
import { civilizationFor } from './structures.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PATHS = ['agrarian', 'devotional', 'scholarly', 'mercantile', 'martial', 'expansionist'];
// Path: what a civilization cares about most (civilizations.mjs).
export function pathOf(body, c, tier, { ambition, cohesion, harmony }) {
  const t = c.species.traits, r = rng(body.seed, 'path', c.species.id), eats = t.diet === 'herbivore' ? 1 : t.diet === 'omnivore' ? .5 : 0;
  const score = {
    agrarian: .5 * eats + .4 * harmony + .2 * (1 - t.aggression) + (c.fields ? .2 : -.4),
    devotional: .55 * cohesion + .35 * t.caution + .15 * t.sociality + .08,
    scholarly: 1.6 * (t.intelligence - .8) + .25 * (t.perception ?? .5) + .2 * (1 - t.aggression) + .05, // every civilization is clever; the cleverest study
    mercantile: .5 * t.sociality + .3 * t.metabolism + .25 * (1 - t.caution) + .1 * ambition - .2,
    martial: .8 * t.aggression + .3 * (1 - harmony) - .07,
    // the ambitious lean toward space; those who already spread through a system all but always did
    expansionist: .9 * ambition + (tier === 'system-shapers' ? .6 : tier === 'spacefarers' ? .15 : 0) + .03,
  };
  let best = 'agrarian', top = -Infinity;
  for (const p of PATHS) { const v = score[p] + .22 * r(); if (v > top) { top = v; best = p; } }
  return best;
}

const GROWN_CULTURES = ['conch', 'polyp', 'kelpweave', 'coral', 'shells', 'silk', 'hive', 'living', 'reef', 'tethered'];
export function temperamentOf(body, c) {
  const t = c.species.traits, r = rng(body.seed, 'temperament', c.species.id);
  const ambition = clamp(.35 * t.aggression + .25 * t.metabolism + .2 * t.sociality + .55 * (r() - .35), 0, 1);
  const cohesion = clamp(.8 * t.sociality + .4 * (r() - .5), 0, 1);
  const harmony = clamp((t.diet === 'herbivore' ? .4 : t.diet === 'omnivore' ? .2 : 0) + .3 * t.caution + (GROWN_CULTURES.includes(c.culture) ? .3 : 0) + .3 * (r() - .5), 0, 1);
  return { ambition, cohesion, harmony };
}

// Smooth value noise on the unit sphere (for the shape of the city).
function noise3(seed) {
  const h = (x, y, z) => (hash32(seed, x, y, z) & 0xffff) / 0xffff;
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = s(x - xi), yf = s(y - yi), zf = s(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), xf), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf), zf);
  };
}

const cache = new Map();
export function urbanOf(body) {
  const key = `${body.seed}:${body.id}`;
  if (cache.has(key)) return cache.get(key);
  let out = null;
  try { out = decide(body); } catch { out = null; }
  cache.set(key, out);
  return out;
}

function decide(body) {
  if (body.giant || body.physics?.life !== 'complex') return null;
  const c = civilizationFor(body, faunaFor(body).species);
  if (!c) return null;
  const tier = CIVILIZATION[c.stage];
  if (!['planet-shapers', 'orbital', 'spacefarers', 'system-shapers'].includes(tier)) return null;
  if (c.species.aquatic || c.family === 'drifters') return null; // sea dwellers and those who live aloft build otherwise
  if (tier === 'spacefarers' && rng(body.seed, 'exodus', c.species.id)() < .1) return null; // they left (civilizations.mjs spaceborne)
  const { ambition, cohesion, harmony } = temperamentOf(body, c);
  const score = ambition * .5 + cohesion * .45 - harmony * .6;
  const need = { 'system-shapers': -.1, spacefarers: .06, orbital: .24, 'planet-shapers': .24 }[tier];
  if (score < need || harmony > .62) return null; // those who live lightly on their land never pave it over
  if (pathOf(body, c, tier, { ambition, cohesion, harmony }) === 'agrarian') return null; // nor those whose life turns on the harvest
  const r = rng(body.seed, 'urban');
  const coverage = clamp({ 'system-shapers': .82, spacefarers: .62, orbital: .38, 'planet-shapers': .34 }[tier] + (score - need) * .4 + (r() - .5) * .08, .25, .94);
  const n1 = noise3(`${body.seed}:urban1`), n2 = noise3(`${body.seed}:urban2`), parks = noise3(`${body.seed}:parks`);
  const site = body.signal || [0, 1, 0];
  // 0..1: how much a point is city. Broad shapes with a ragged edge; the land round the
  // place you arrive is always city (that is where their capital stands).
  const mask = (n) => {
    const x = n.x ?? n[0], y = n.y ?? n[1], z = n.z ?? n[2];
    const v = n1(x * 2.2 + 11, y * 2.2 + 7, z * 2.2 + 3) * .7 + n2(x * 7 + 5, y * 7 + 1, z * 7 + 9) * .3;
    const near = x * site[0] + y * site[1] + z * site[2]; // cosine of the angle from the site
    const t = clamp((v - (1 - coverage) * .9) / .08, 0, 1);
    return Math.max(t, clamp((near - .985) / .01, 0, 1));
  };
  // Parks: green squares and strips kept in the city (plants and animals live there).
  const park = (n) => { const x = n.x ?? n[0], y = n.y ?? n[1], z = n.z ?? n[2]; return parks(x * 40 + 2, y * 40 + 8, z * 40 + 4) > .78; };
  return { coverage, tier, level: tier === 'system-shapers' ? 6 : tier === 'spacefarers' ? 5 : 4, mask, park, step: 4.5, culture: c.culture, family: c.family, species: c.species };
}
