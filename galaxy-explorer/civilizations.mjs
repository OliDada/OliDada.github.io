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
import { terrainFor } from './terrain.mjs';
import { urbanOf, temperamentOf, pathOf } from './urban.mjs';
import { shipDesign, HULL_WORDS } from './ships.js';

// Temperament: what a civilization does with what it can build. Tier says what it
// *can* build; temperament says how far it spreads and how it treats its land.
//   ambition  how far it expands (aggression, metabolism, sociality, plus a culture roll)
//   cohesion  a few great dense cities (high) or many scattered villages (low)
//   harmony   blends in and grows its world (high) or paves and clears it (low)
// Together with tier they give an extent, from one camp to a whole solar system:
export const EXTENT = ['local', 'regional', 'continental', 'planetary', 'system']; // future: 'interstellar'
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GROWN_CULTURES = ['conch', 'polyp', 'kelpweave', 'coral', 'shells', 'silk', 'hive', 'living', 'reef', 'tethered'];
// temperamentOf: ambition, cohesion, harmony (urban.mjs, which needs it before the terrain exists).
// Path: what a civilization cares about most, from its body and temperament. Tier says
// how far it has come; path says what it spends itself on, and so what its towns are
// full of (structures-mesh.js), how it meets you (contact, later) and what it can teach.
//   agrarian      grazers and gentle omnivores who live lightly: fields, granaries, mills
//   devotional    close-knit and cautious: temples, shrines along the roads, monuments
//   scholarly     the cleverest and calmest: observatories, libraries, the first to listen
//   mercantile    sociable and restless: markets, warehouses, roads busy with trade
//   martial       aggressive and hard on their land: walls, watchtowers, garrisons
//   expansionist  ambitious above all: more towns, bigger ports; the road to system-shaping
// A name, saved as a name, so new paths can be added without changing old ones.
export const PATHS = ['agrarian', 'devotional', 'scholarly', 'mercantile', 'martial', 'expansionist'];
// pathOf: what a civilization cares about most (urban.mjs).
const PATH_WORDS = {
  agrarian: 'Their life turns on the harvest: fields reach to the horizon, with granaries and mills in every town.',
  devotional: 'Faith shapes their towns: temples rise above the homes and shrines line the roads between them.',
  scholarly: 'They are a people of learning: observatories crown the hills and every town keeps a hall of records.',
  mercantile: 'They live by trade: markets fill the squares and warehouses line the roads.',
  martial: 'They are a hard, wary people: their towns are walled and watchtowers stand on the heights.',
  expansionist: 'They are driven to spread: new towns are always being founded at the edge of their reach.',
};

// Contact (PROGRESSION.md): how a civilization first meets you, from its traits and
// path, and what knowledge it can trade, from its tier and path. Names, like tiers.
export const DISPOSITIONS = ['welcoming', 'wary', 'guarded', 'curious'];
function dispositionOf(c) {
  const t = c.species.traits;
  if (tierAtLeast(c.tier, 'orbital')) return 'curious'; // they already know you are there
  const lean = { mercantile: { welcoming: .2 }, agrarian: { welcoming: .1, wary: .1 }, devotional: { wary: .2 }, martial: { guarded: .25 }, scholarly: { curious: .25 }, expansionist: { curious: .1, guarded: .1 } }[c.path] || {};
  const score = {
    welcoming: .6 * t.sociality + .4 * (1 - t.caution) - .35,
    wary: .9 * t.caution - .1,
    guarded: .7 * t.aggression + .3 * (1 - t.sociality) - .15,
    curious: tierAtLeast(c.tier, 'city builders') ? .4 * t.intelligence : -1,
  };
  return DISPOSITIONS.reduce((best, d) => (score[d] + (lean[d] || 0)) > (score[best] + (lean[best] || 0)) ? d : best, 'welcoming');
}
// What they can give you once you are friends: one thing for their tier, one for their path.
const TIER_OFFERS = {
  'tool users': 'where the animals, water and formations of their world are',
  'village builders': 'maps of their world', metalworkers: 'maps of their world and where its ores lie',
  'city builders': 'star charts of their region', industrial: 'star charts of their region and which worlds in it hold life',
  'planet-shapers': 'ship knowledge', orbital: 'ship knowledge and an orbital survey of their system',
  spacefarers: 'drive technology', 'system-shapers': 'drive technology and the way between stars',
};
const PATH_OFFERS = {
  agrarian: 'where every plant of their world grows', devotional: 'the old places their world reveres',
  scholarly: 'what they have heard from the stars', mercantile: 'the way to the others they trade and talk with',
  martial: 'where the dangers of their world lie', expansionist: 'every world they have reached',
};
const offersOf = (c) => ({ tier: TIER_OFFERS[c.tier], path: PATH_OFFERS[c.path] });

const ARK_WORDS = ['Ark', 'Haven', 'Lantern', 'Ascent', 'Drift', 'Exodus', 'Crown', 'Hearth'];
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
    case 'metalworkers': return ambition > .5 ? 'regional' : 'local';
    case 'city builders': return ambition > .75 ? 'continental' : ambition > .35 ? 'regional' : 'local';
    case 'industrial': return ambition > .55 ? 'continental' : 'regional';
    case 'planet-shapers': return ambition > .4 ? 'planetary' : 'continental';
    case 'orbital': return ambition > .3 ? 'planetary' : 'continental';
    case 'spacefarers': return ambition > .55 ? 'system' : 'planetary';
    case 'system-shapers': return 'system';
  }
  return 'local';
}

export const TIERS = CIVILIZATION.slice(1); // 'tool users' … 'system-shapers'
export const REACH = ['local', 'world', 'orbit', 'system', 'space']; // space: spaceborne, living off-world; future: 'interstellar'
const reachOf = (tier) => tier === 'system-shapers' ? 'system' : tier === 'spacefarers' || tier === 'orbital' ? 'orbit' : tier === 'planet-shapers' ? 'world' : 'local';

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
      const tier = CIVILIZATION[c.stage], temperament = temperamentOf(body, c);
      const urban = urbanOf(body);
      const spread = extentOf(tier, temperament.ambition), extent = urban && spread !== 'system' ? 'planetary' : spread;
      civ = { ...c, id: `${body.seed}:${body.id}:${c.species.id}`, home: body.id, tier, reach: reachOf(tier), ...temperament, extent, path: pathOf(body, c, tier, temperament), urban: urban ? { coverage: urban.coverage } : null };
      civ.temperamentText = describeTemperament(civ);
      civ.disposition = dispositionOf(civ);
      civ.offers = offersOf(civ);
      let text = c.description;
      if (tierAtLeast(tier, 'spacefarers')) {
        civ.ship = shipDesign(civ).hull;
        const space = tier === 'spacefarers' ? 'satellites and a station circle the world.' : `${SYSTEM_TEXT.replace(/^They have made/, 'they have made')}`;
        text = text.replace(/They have reached space: .*$/, `They have reached space: their ${HULL_WORDS[civ.ship]} rise from a spaceport beside their capital, and ${space}`);
      }
      // Arks: civilizations that spread beyond their world (every system-shaper, and the
      // spacefarers who settle their system) also live aboard an ark, a vast station at
      // their world's leading Lagrange point, sixty degrees ahead of it along its orbit
      // (megastation.js). A few spacefarers have gone further and left their world
      // altogether (spaceborne): their cities stand empty and overgrown.
      const rr = rng(body.seed, 'ark', c.species.id), arkName = `the ${c.species.name.split(' ')[0]} ${ARK_WORDS[Math.floor(rr() * ARK_WORDS.length)]}`;
      if (tier === 'spacefarers' && rng(body.seed, 'exodus', c.species.id)() < .1) {
        civ.spaceborne = civ.ark = true; civ.arkName = arkName; civ.extent = 'space'; civ.reach = 'space';
        text = text.replace(/They have reached space: .*$/, `Generations ago they left their world. Their cities stand empty, reclaimed by plants, and they live aboard ${arkName}, a vast station sixty degrees ahead of their world along its orbit.`);
        civ.temperamentText = '';
      } else if (tier === 'system-shapers' || (tier === 'spacefarers' && civ.extent === 'system')) {
        civ.ark = true; civ.arkName = arkName;
        text += ` Many of them live aboard ${arkName}, a vast station sixty degrees ahead of their world along its orbit.`;
      }
      if (urban && !civ.spaceborne) text += ` Their city has grown over ${urban.coverage > .75 ? 'almost all' : urban.coverage > .5 ? 'most' : 'much'} of their world: the land levelled into terraces, built over block by block, with parks kept green and the night side lit from pole to pole.`;
      civ.description = `${text}${civ.temperamentText ? ` ${civ.temperamentText}` : ''}${c.level >= 2 && !civ.spaceborne ? ` ${PATH_WORDS[civ.path]}` : ''}`;
    }
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, civ);
  return civ;
}
export const civilizationsIn = (system) => system.bodies.map(civilizationOf).filter(Boolean);
// Spaceborne civilizations of a system (they live on an ark, not on their world).
export const spaceborneIn = (system) => civilizationsIn(system).filter((c) => c.spaceborne);
// Every civilization of a system with an ark (spaceborne or not).
export const arksIn = (system) => civilizationsIn(system).filter((c) => c.ark);
// Where an ark is: its world's position (or, for a moon, its planet's) turned sixty degrees
// ahead along the orbit, about the star. positions: Map id -> [x, y, z] (system coordinates).
export function arkPosition(system, civ, positions) {
  const home = system.bodies.find((b) => b.id === civ.home), anchor = home.parent ? system.bodies.find((b) => b.id === home.parent) : home;
  const [x, y, z] = positions.get(anchor.id), c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3);
  return [x * c - z * s, y, x * s + z * c];
}

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
    // Sea builders only settle worlds with seas of their own.
    const targets = system.bodies.filter(b => !b.giant && b.id !== home.id && !civilizationOf(b) && (!civ.underwater || terrainFor(b).liquid === 'water'))
      .sort((a, b) => Math.abs(orbitOf(a) - homeOrbit) - Math.abs(orbitOf(b) - homeOrbit))
      .slice(0, civ.tier === 'system-shapers' ? Infinity : 1 + Math.floor(civ.ambition * 4));
    if (targets.some(b => b.id === body.id)) return { ...civ, homeName: home.name, homeBody: home.id, suits: needsSuit(home, body) };
  }
  return null;
}
