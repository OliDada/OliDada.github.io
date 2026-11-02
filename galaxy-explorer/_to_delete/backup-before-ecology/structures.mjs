// Civilizations: what the most advanced species on a world has built. Pure data;
// structures-mesh.js turns it into buildings. Everything follows from the species:
//
//   level     its civilization level (fauna.mjs): 1 tool use, 2 builders, 3 spacefaring
//   style     from its body: hands build huts and houses, radially symmetric walkers,
//             rollers and four-legged species raise domes, insects, spiders, slugs and
//             coils pile mounds and spires, fliers build perches, drifters tether
//             pods to masts
//   material  from the world: wood where forests grow, ice on frozen worlds, sun-baked
//             adobe in deserts, glass on silicon worlds, otherwise stone
//   unit      building scale in metres, from the builders' size; weak gravity builds taller
//   fields    builders that eat plants farm them
import { rng } from './rng.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const STYLE_OF_PLAN = { biped: 'domes', quadruped: 'domes', radial: 'domes', roller: 'domes', hexapod: 'mounds', arachnid: 'mounds', slug: 'mounds', serpent: 'mounds', flyer: 'perches', floater: 'masts' };
export const LEVEL_NAMES = ['', 'tool users', 'builders', 'spacefarers'];

export function civilizationFor(body, species) {
  const civ = species.filter(s => s.civilization > 0)
    .sort((a, b) => b.civilization - a.civilization || b.traits.intelligence - a.traits.intelligence)[0];
  if (!civ) return null;
  const r = rng(body.seed, 'civilization', civ.id), p = body.physics;
  const style = civ.arms ? 'hands' : STYLE_OF_PLAN[civ.plan] || 'domes';
  const material = civ.chemistry === 'silicon' ? 'glass'
    : body.biome === 'Frozen' || p.waterState === 'ice' ? 'ice'
    : body.biome === 'Desert' ? 'adobe'
    : (body.biome === 'Verdant' || body.biome === 'Oceanic') && style !== 'mounds' ? 'wood'
    : 'stone';
  const level = civ.civilization;
  return {
    species: civ, level, style, material,
    unit: clamp(civ.size * 1.1, 1, 3),
    tall: clamp(1 / Math.sqrt(Math.max(p.gravity, .1)), .85, 1.6),
    fields: level >= 2 && (civ.traits.diet === 'herbivore' || civ.traits.diet === 'omnivore'),
    hearths: (civ.chemistry === 'carbon' || civ.chemistry === 'sulfur') && p.pressure > .2, // fire needs air
    seed: r.int(0, 2 ** 31),
    description: describeCivilization(civ, level, style, material),
  };
}

const MATERIAL_WORDS = { wood: 'timber', ice: 'blocks of ice', adobe: 'sun-baked clay', glass: 'grown glass', stone: 'fitted stone' };
const HOMES = {
  hands: 'villages of round huts around a central monument, inside low walls',
  domes: 'clusters of domed dwellings with arched doorways, around a gathering place',
  mounds: 'towns of tall spires and mounds, riddled with tunnels',
  perches: 'towering perches, each crowned with a woven nest',
  masts: 'tall masts hung with clusters of living pods',
};
// "Omquo glider" -> "Omquo gliders"
export const plural = (name) => /(s|x|sh|ch)$/.test(name) ? `${name}es` : `${name}s`;
function describeCivilization(s, level, style, material) {
  const who = `The ${plural(s.name)}`;
  if (level === 1) return `${who} use tools: they stack cairns to mark their range, set out trails of standing stones and build simple shelters.`;
  const build = `${who} build ${HOMES[style]}, made of ${MATERIAL_WORDS[material]}.`;
  const farm = s.traits.diet !== 'carnivore' ? ' They tend fields nearby.' : '';
  if (level === 2) return build + farm;
  return `${build}${farm} They have reached space: lit towers, radio dishes and a launch site, and satellites circle the world.`;
}
