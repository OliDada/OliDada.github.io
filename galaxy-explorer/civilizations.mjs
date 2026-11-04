// Civilizations as things in their own right. A civilization is a species that has
// climbed the ladder, with a home world and a reach. Everything that shows or uses
// one (settlements, radio signals, the star map, and later contact and trade)
// reads it from here, so new kinds can be added without reworking the rest.
//
//   id      stable: `${worldSeed}:${worldId}:${speciesId}`
//   tier    a name from TIERS, never an index: saves store names, so the ladder can
//           grow (a new step between two others, or above spacefarers) without
//           changing what old saves mean
//   reach   how far it extends: 'local' (tool users to city builders), 'world'
//           (planet-shapers), 'orbit' (spacefarers), 'system' (system-shapers, who
//           have made a whole solar system theirs). Future kinds extend this list:
//           'interstellar', and civilizations that live only in space would have
//           reach but no home settlement.
import { faunaFor, CIVILIZATION } from './fauna.mjs';
import { civilizationFor, SYSTEM_TEXT } from './structures.mjs';
import { rng } from './rng.mjs';
import { shipDesign, HULL_WORDS } from './ships.js';

// Temperament: what a civilization does with what it can build. Tier says what it
// *can* build; temperament says how far it spreads and how it treats its land.
//   ambition  how far it expands (aggression, metabolism, sociality, plus a culture roll)
//   cohesion  a few great dense cities (high) or many scattered villages (low)
//   harmony   blends in and grows its world (high) or paves and clears it (low)
// Together with tier they give an extent, from one camp to a whole solar system:
export const EXTENT = ['local', 'regional', 'continental', 'planetary', 'system']; // future: 'interstellar'
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GROWN_CULTURES = ['coral', 'shells', 'silk', 'hive', 'living', 'reef', 'tethered'];
function temperamentOf(body, c) {
  const t = c.species.traits, r = rng(body.seed, 'temperament', c.species.id);
  const ambition = clamp(.35 * t.aggression + .25 * t.metabolism + .2 * t.sociality + .55 * (r() - .35), 0, 1);
  const cohesion = clamp(.8 * t.sociality + .4 * (r() - .5), 0, 1);
  const harmony = clamp((t.diet === 'herbivore' ? .4 : t.diet === 'omnivore' ? .2 : 0) + .3 * t.caution + (GROWN_CULTURES.includes(c.culture) ? .3 : 0) + .3 * (r() - .5), 0, 1);
  return { ambition, cohesion, harmony };
}
const EXTENT_WORDS = { local: 'stay close to home', regional: 'have settled the land around them', continental: 'have spread across a continent', planetary: 'have spread across their whole world', system: 'have spread beyond their world to others in this system' };
function describeTemperament(c) {
  const drive = c.ambition > .66 ? 'Ambitious' : c.ambition > .33 ? 'Steady' : 'Unhurried';
  const live = c.cohesion > .6 ? 'in a few great, crowded places' : c.cohesion < .35 ? 'in many scattered places' : '';
  const land = c.harmony > .6 ? 'living lightly on the land' : c.harmony < .3 ? 'clearing and paving the land as they go' : '';
  return `${drive}, they ${EXTENT_WORDS[c.extent]}${live ? `, ${live}` : ''}${land ? `, ${land}` : ''}.`;
}
function extentOf(tier, ambition) {
  switch (tier) {
    case 'tool users': return 'local';
    case 'village builders': return ambition > .6 ? 'regional' : 'local';
    case 'city builders': return ambition > .75 ? 'continental' : ambition > .35 ? 'regional' : 'local';
    case 'planet-shapers': return ambition > .4 ? 'planetary' : 'continental';
    case 'spacefarers': return ambition > .55 ? 'system' : 'planetary';
    case 'system-shapers': return 'system';
  }
  return 'local';
}

export const TIERS = CIVILIZATION.slice(1); // 'tool users' … 'system-shapers'
export const REACH = ['local', 'world', 'orbit', 'system']; // future: 'interstellar'
const reachOf = (tier) => tier === 'system-shapers' ? 'system' : tier === 'spacefarers' ? 'orbit' : tier === 'planet-shapers' ? 'world' : 'local';

// tierAtLeast('city builders', 'village builders') -> true. Unknown names count as none.
export const tierAtLeast = (tier, min) => TIERS.includes(tier) && TIERS.indexOf(tier) >= TIERS.indexOf(min);
// Older saves stored the level number from a shorter ladder; read them as names.
export const tierName = (saved) => typeof saved === 'string' ? saved : ({ 1: 'tool users', 2: 'village builders', 3: 'spacefarers' })[saved] || null;

const cache = new Map();
export function civilizationOf(body) {
  const key = `${body.seed}:${body.id}`;
  if (cache.has(key)) return cache.get(key);
  let civ = null;
  if (body.physics?.life === 'complex') {
    const c = civilizationFor(body, faunaFor(body).species);
    if (c) {
      const tier = CIVILIZATION[c.level], temperament = temperamentOf(body, c);
      const extent = extentOf(tier, temperament.ambition);
      civ = { ...c, id: `${body.seed}:${body.id}:${c.species.id}`, home: body.id, tier, reach: reachOf(tier), ...temperament, extent };
      civ.temperamentText = describeTemperament(civ);
      let text = c.description;
      if (tierAtLeast(tier, 'spacefarers')) {
        civ.ship = shipDesign(civ).hull;
        const space = tier === 'spacefarers' ? 'satellites and a station circle the world.' : `${SYSTEM_TEXT.replace(/^They have made/, 'they have made')}`;
        text = text.replace(/They have reached space: .*$/, `They have reached space: their ${HULL_WORDS[civ.ship]} rise from a spaceport beside their capital, and ${space}`);
      }
      civ.description = `${text} ${civ.temperamentText}`;
    }
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, civ);
  return civ;
}
export const civilizationsIn = (system) => system.bodies.map(civilizationOf).filter(Boolean);

// Colonists wear pressure suits where the air, warmth or chemistry is too different
// from their home world (which, on lifeless worlds, is nearly always).
export function needsSuit(home, world) {
  const a = home.physics, b = world.physics;
  if (!a || !b) return true;
  const ratio = (b.pressure + 1e-3) / (a.pressure + 1e-3);
  return ratio < .5 || ratio > 2 || Math.abs(b.temperature - a.temperature) > 35 || (b.biochemistry || 'carbon') !== (a.biochemistry || 'carbon') || b.waterState !== a.waterState;
}

// Spacefarers whose extent is the whole system settle other worlds and moons: the
// nearest rocky ones (by orbit), more the more ambitious they are; system-shapers
// settle every one. Returns the colonising civilization for a body, or null.
export function colonistOf(system, body) {
  if (body.giant || civilizationOf(body)) return null;
  for (const civ of civilizationsIn(system)) {
    if (civ.extent !== 'system') continue;
    const home = system.bodies.find(b => b.id === civ.home), homeOrbit = home.parent ? system.bodies.find(b => b.id === home.parent).orbit : home.orbit;
    const orbitOf = (b) => b.parent ? system.bodies.find(p => p.id === b.parent).orbit : b.orbit;
    const targets = system.bodies.filter(b => !b.giant && b.id !== home.id && !civilizationOf(b))
      .sort((a, b) => Math.abs(orbitOf(a) - homeOrbit) - Math.abs(orbitOf(b) - homeOrbit))
      .slice(0, civ.tier === 'system-shapers' ? Infinity : 1 + Math.floor(civ.ambition * 4));
    if (targets.some(b => b.id === body.id)) return { ...civ, homeName: home.name, homeBody: home.id, suits: needsSuit(home, body) };
  }
  return null;
}
