// Civilizations: what the most advanced species on a world has made. Pure data;
// structures-mesh.js builds it.
//
// Architecture follows the builders' bodies and lives. Each body family has several
// building cultures, picked per species from its traits and world, so two species
// of the same shape can build very differently:
//
//   hands      (bipeds with hands)         timber halls, terraced pueblos and pyramids,
//                                         hide tents and pavilions, stilt houses on walkways
//   tentacles  (octopus and star walkers)  grown coral-like branches and lumps, secreted spiral shells
//   tripods    (three-legged walkers)       pods raised on legs, ringed enclosures around pillars
//   drifters   (gas-filled floaters)        platforms tethered high under gas-bags, frond
//                                         stalks hung with bulbs, masts hung with pods
//   hive       (six-legged)                 honeycomb towers of hexagonal cells, earth spires and mounds
//   web        (eight-legged)               silk tents, canopies and funnel webs; trapdoor burrows
//   burrowers  (coils, slugs, snails)       domed burrows with ramps and skylights; spiral shell towers
//   nests      (fliers)                     nest perches, rookery stacks full of ledges, woven hanging nests
//   grazers    (four-legged, handless bipeds)  turf barrows and henges, living woven groves, domes
//   rollers    (wheels and balls)           wheel-shaped houses and banked tracks, domes
//
// The ladder (fauna.mjs CIVILIZATION): tool users leave traces; village builders
// settle; city builders raise dense cities around a great structure; planet-shapers
// spread roads and towns across the world; spacefarers launch in their own way
// (rockets, grown launch towers, tethers into orbit, silos, launch rails).
import { rng } from './rng.mjs';
import { CIVILIZATION } from './fauna.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const LEVEL_NAMES = CIVILIZATION;

export function familyOf(s) {
  if (s.arms) return 'hands';
  return { biped: 'grazers', quadruped: 'grazers', radial: s.form === 'tripod' ? 'tripods' : 'tentacles', floater: 'drifters', hexapod: 'hive', arachnid: 'web',
    serpent: 'burrowers', slug: 'burrowers', flyer: 'nests', roller: 'rollers' }[s.plan] || 'grazers';
}

// Which cultures a family can have, weighted by the species and its world.
function cultureWeights(family, s, body) {
  const t = s.traits, p = body.physics, wet = body.biome === 'Oceanic' || (p.waterCoverage ?? 0) > .55, lush = body.biome === 'Verdant';
  switch (family) {
    case 'hands': return { timber: lush ? 1.4 : .7, terraced: body.biome === 'Desert' || body.biome === 'Volcanic' ? 1.6 : .8, tents: .5 + (1 - t.sociality) * .9, stilts: wet ? 1.6 : .3 };
    case 'tentacles': return { coral: 1, shells: .8 };
    case 'tripods': return { stiltpods: 1, rings: .8 };
    case 'drifters': return { tethered: s.form === 'balloon' || s.form === 'cluster' ? 1.5 : .8, reef: s.form === 'bell' ? 1.4 : .7, masts: .7 };
    case 'hive': return { hive: (s.form === 'ant' || s.form === 'beetle' ? 1 : .5) + t.sociality, mounds: 1 };
    case 'web': return { silk: s.form === 'spider' ? 1.8 : .6, trapdoor: s.form === 'scorpion' ? 1.6 : .7 };
    case 'burrowers': return { burrows: s.form === 'snail' ? .4 : 1.2, shells: s.form === 'snail' ? 1.8 : .5 };
    case 'nests': return { perches: 1, rookery: .4 + t.sociality, hanging: s.form === 'bird' ? 1.2 : .5 };
    case 'grazers': return { earthworks: 1, living: t.diet === 'herbivore' ? (lush ? 1.6 : .8) : .3, domes: .8 };
    case 'rollers': return { tracks: 1.4, domes: .6 };
  }
  return { domes: 1 };
}

// Materials: grown cultures build from their own bodies' products; the rest use the world.
const GROWN = { coral: 'grown', shells: 'shell', silk: 'silk', hive: 'wax', living: 'living', reef: 'grown', tethered: 'membrane' };
function materialOf(culture, s, body) {
  if (GROWN[culture]) return GROWN[culture];
  if (s.chemistry === 'silicon') return 'glass';
  const p = body.physics;
  if (body.biome === 'Frozen' || p.waterState === 'ice') return 'ice';
  if (body.biome === 'Desert' || culture === 'terraced') return 'adobe';
  if ((body.biome === 'Verdant' || body.biome === 'Oceanic') && ['timber', 'stilts', 'perches', 'hanging', 'masts', 'tents', 'stiltpods'].includes(culture)) return 'wood';
  return 'stone';
}

export function civilizationFor(body, species) {
  const civ = species.filter(s => s.civilization > 0)
    .sort((a, b) => b.civilization - a.civilization || b.traits.intelligence - a.traits.intelligence)[0];
  if (!civ) return null;
  const r = rng(body.seed, 'civilization', civ.id), p = body.physics;
  const family = familyOf(civ), weights = cultureWeights(family, civ, body);
  let roll = r() * Object.values(weights).reduce((a, w) => a + w, 0), culture = Object.keys(weights)[0];
  for (const [k, w] of Object.entries(weights)) { roll -= w; if (roll <= 0) { culture = k; break; } }
  const level = civ.civilization, material = materialOf(culture, civ, body);
  return {
    species: civ, level, family, culture, material,
    // legacy name used by older callers
    style: family,
    unit: clamp(civ.size * 1.1, 1, 3),
    tall: clamp(1 / Math.sqrt(Math.max(p.gravity, .1)), .85, 1.6),
    fields: level >= 2 && (civ.traits.diet === 'herbivore' || civ.traits.diet === 'omnivore') && family !== 'drifters',
    hearths: (civ.chemistry === 'carbon' || civ.chemistry === 'sulfur') && p.pressure > .2 && ['hands', 'grazers', 'tripods', 'tentacles'].includes(family),
    seed: r.int(0, 2 ** 31),
    description: describeCivilization(civ, level, culture),
  };
}

// "Omquo glider" -> "Omquo gliders"
export const plural = (name) => /(s|x|sh|ch)$/.test(name) ? `${name}es` : `${name}s`;

const WORDS = {
  timber: { village: 'thatched roundhouses around a meeting hall', city: 'timber halls and many-roofed tiered towers', launch: 'rockets that rise from timber-clad gantries' },
  terraced: { village: 'flat-roofed clay houses stacked against each other', city: 'terraced blocks climbing toward a stepped pyramid', launch: 'rockets launched from the summit of a stepped pyramid' },
  tents: { village: 'camps of hide tents and round yurts', city: 'vast many-peaked pavilions of stretched hide', launch: 'rockets from a launch field ringed with tents' },
  stilts: { village: 'houses raised on stilts, joined by walkways', city: 'stilt towns spread across the shallows on raised walkways', launch: 'rockets from a platform on stilts' },
  coral: { village: 'branching, coral-like dwellings they grow rather than build', city: 'forests of grown towers and lumpy domes around a great fan', launch: 'a grown launch tower that throws seed-like craft into orbit' },
  shells: { village: 'spiral shells they secrete and live inside', city: 'towering spirals coiled one above another', launch: 'a spiral launch tower capped with a capsule' },
  stiltpods: { village: 'pods raised high on three legs', city: 'clusters of tall-legged pods striding over the ground', launch: 'a giant tripod that cradles a craft for launch' },
  rings: { village: 'ringed enclosures around carved pillars', city: 'concentric rings of walls around a great pillar', launch: 'a ring-walled launch tower' },
  tethered: { village: 'platforms tethered high in the air under gas-bags', city: 'floating towns held aloft by great gas-bags, anchored to the ground', launch: 'a tether that climbs from the ground into orbit' },
  reef: { village: 'tall frond-stalks hung with bulbous dwellings', city: 'towering stalks whose bulbs house thousands', launch: 'a tether that climbs from the ground into orbit' },
  masts: { village: 'tall masts hung with clusters of living pods', city: 'forests of masts heavy with pods', launch: 'a tether that climbs from the ground into orbit' },
  hive: { village: 'clusters of hexagonal wax cells', city: 'honeycomb towers around a great central comb', launch: 'launch silos sunk into the hive' },
  mounds: { village: 'packed-earth mounds riddled with tunnels', city: 'tall banded spires and mounds by the hundred', launch: 'launch silos dug beneath the spires' },
  silk: { village: 'silk tents strung between poles', city: 'great silk canopies joined by high silk bridges', launch: 'a silo whose craft climbs out through a silk funnel' },
  trapdoor: { village: 'trapdoor burrows with hinged lids', city: 'warrens of burrows breathing through tall chimneys', launch: 'launch silos hidden under trapdoors' },
  burrows: { village: 'domed burrows with ramps and glowing skylights', city: 'terraced pits and warrens of domes', launch: 'launch silos sunk into a terraced pit' },
  perches: { village: 'tall perches crowned with nests', city: 'perch-trees stacked with nests at every height', launch: 'a launch rail that climbs a towering perch' },
  rookery: { village: 'stacked rookery towers full of nesting ledges', city: 'cliffs of rookery towers', launch: 'a launch rail that climbs a towering rookery' },
  hanging: { village: 'woven nests hanging from arches', city: 'great arches hung with hundreds of woven nests', launch: 'a launch rail that climbs a towering arch' },
  earthworks: { village: 'turf-roofed barrows inside earth banks', city: 'ringed earthworks and henges of standing stones', launch: 'a launch track that sweeps up a long ramp' },
  living: { village: 'domes of living trees woven together', city: 'groves shaped into great halls', launch: 'a launch track that sweeps up a long ramp' },
  domes: { village: 'domed dwellings with arched doorways', city: 'clusters of great domes', launch: 'a launch track that sweeps up a long ramp' },
  tracks: { village: 'wheel-shaped houses linked by smooth tracks', city: 'banked tracks looping between wheel-houses', launch: 'a launch track that sweeps up a long ramp' },
};
// System-shapers (level 6): what they have built beyond their world (civilizations.mjs fills in the ships).
export const SYSTEM_TEXT = 'They have made the whole system theirs: a ring circles their world, joined to the ground by elevators, their colonies reach every rocky world and moon, habitats circle the giants and mirrors gather the starlight.';
function describeCivilization(s, level, culture) {
  const who = `The ${plural(s.name)}`, w = WORDS[culture];
  const tier = CIVILIZATION[level];
  if (level === 1) return `${who} are ${tier}: they stack cairns to mark their range, leave trails of marked stones and make simple shelters.`;
  if (level === 2) return `${who} are ${tier}: they live in ${w.village}.`;
  const city = `${who} are ${tier}: they live in ${w.city}`;
  if (level === 3) return `${city}.`;
  const spread = `${city}, and their roads and towns now reach across the world; from orbit, their lights cover the night side`;
  if (level === 4) return `${spread}. Their radio chatter can be heard from the next star.`;
  if (level === 5) return `${spread}. They have reached space: ${w.launch}, and satellites and a station circle the world.`;
  return `${spread}. They have reached space: ${w.launch}. ${SYSTEM_TEXT}`;
}
