// An architecture of their own: every civilization's way of building, read from who they
// are and where they live (pure data; alien-build.js turns it into buildings).
//
// No two species build alike. The language a people builds in is drawn from:
//   - the world: heavy gravity squats buildings and spreads their bases, light gravity
//     lets them rise thin and overhang; cold closes them into thick domes with few
//     openings, heat opens them under parasol caps, shade fins and wind-catchers; damp
//     raises them on legs under steep drip-rimmed caps; thin air seals them into pods
//     joined by tubes; volcanic ground gives heavy dark plinths;
//   - the body: tall thin builders build tall and narrow with tall doors, heavy ones low
//     and broad; a crested head becomes a finned crown, a domed head a domed cap, a
//     ridged back a ribbed spine; many eyes, many small round ports;
//   - their ways: social peoples cluster their homes round shared courts and join them,
//     solitary ones spread them out; wary ones wall them and narrow the openings, curious
//     ones open them wide; those who grow their gear grow their homes (no straight lines),
//     those with implants build sleek and early; their path adds its own (roof gardens for
//     farmers, glowing crowns for the devout, dishes and domes for scholars, banners for
//     traders, spikes and walls for warriors, masts for the restless);
//   - their culture's way of building: frames and ribs (timber), stacked massive tiers
//     (terraced), stretched membranes on poles (tents), raised on legs (stilts);
//   - how far they have come: rough and few-sided from early on, metal-banded and
//     chimneyed in industry, and from the spacefarers up smooth shells, glowing seams,
//     floating rings and caps held over their towers by nothing you can see.
//
//   architectureOf(civ, body) -> language (deterministic per civilization)
//   variantOf(language, seed) -> one building's choices within it
import { rng } from './rng.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ramp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);

// Body masses a building can take (alien-build.js draws each from a profile and a plan).
export const MASSES = ['pod', 'dome', 'spire', 'stack', 'shell', 'mushroom', 'cluster', 'arch', 'crystal', 'ring', 'drum', 'tensile'];

export function architectureOf(civ, body) {
  const s = civ.species || {}, t = s.traits || {}, ph = body.physics || {}, r = rng(civ.seed ?? 1, 'architecture');
  const tempC = (ph.temperature ?? 288) - 273.15, g = ph.gravity ?? 1;
  const world = {
    hot: ramp(22, 55, tempC), cold: ramp(5, -30, tempC), wet: body.biome === 'Verdant' || body.biome === 'Oceanic' ? .4 + (ph.waterCoverage ?? .5) * .6 : 0,
    dry: body.biome === 'Desert' || body.biome === 'Volcanic' ? 1 : 0, thin: ramp(.5, .05, ph.pressure ?? 1),
    heavy: ramp(1.1, 2.4, g), light: ramp(.8, .25, g), volcanic: clamp(ph.volcanism ?? 0, 0, 1), frozen: body.biome === 'Frozen' || ph.waterState === 'ice' ? 1 : 0,
  };
  const level = civ.level || 1, grown = s.culture?.style === 'grown' || ['grown', 'living', 'shell'].includes(civ.material);
  const sleek = level >= 5 || (s.culture?.style === 'implants' && level >= 4), lanky = s.build === 'lanky', heavyBuild = s.build === 'heavy' || s.build === 'giant';
  const social = t.sociality ?? .5, wary = Math.max(t.caution ?? .4, t.aggression ?? .2), curious = s.behavior === 'curious' ? 1 : t.curiosity ?? .4;
  const W = {}; // weights for the masses of their homes
  const w = (k, v) => { W[k] = (W[k] || 0) + Math.max(0, v); };
  for (const k of MASSES) w(k, .15 + r() * .5); // every people its own leanings
  // The world's say.
  w('dome', world.cold * 2.2 + world.thin * 1.6 + world.heavy * 1.2); w('pod', world.thin * 1.5 + world.wet * .6 + world.light * .6);
  w('mushroom', world.hot * 1.6 + world.wet * 1.1 + world.light * 1.2); w('spire', world.light * 1.8 - world.heavy * 1.2 + (lanky ? 1 : 0));
  w('drum', world.heavy * 1.2 + world.dry * 1 + world.cold * .5); w('stack', world.dry * 1.4 + world.heavy * .6); w('tensile', world.hot * 1.2 + (1 - world.cold) * .3);
  w('crystal', (civ.material === 'glass' || civ.material === 'ice' ? 2.4 : 0) + world.frozen * .8); w('arch', world.light * .7 + world.wet * .4);
  // Their own culture's say.
  ({ timber: () => { w('arch', 1.6); w('spire', .8); w('pod', .5); }, terraced: () => { w('stack', 2.2); w('drum', 1); }, tents: () => { w('tensile', 2.4); w('dome', .6); }, stilts: () => { w('pod', 1.6); w('mushroom', 1); } }[civ.culture] || (() => {}))();
  // Their kind of body's say: fliers build high and perch, burrowers half underground,
  // hive builders in six-sided cells, web builders in stretched silk, grazers low and wide,
  // rollers round, those with tentacles in shells and pools, tripods tall.
  ({
    nests: () => { w('spire', 2.2); w('ring', 1.6); w('mushroom', 1.2); w('arch', .6); W.drum *= .4; },
    burrowers: () => { w('dome', 2.4); w('cluster', 1.4); w('drum', .8); W.spire *= .2; W.stack *= .4; },
    hive: () => { w('stack', 1.8); w('cluster', 1.6); w('crystal', .8); },
    web: () => { w('tensile', 2.4); w('pod', 1.4); w('spire', .8); },
    grazers: () => { w('drum', 1.8); w('dome', 1.4); w('arch', 1.2); W.spire *= .4; },
    rollers: () => { w('ring', 2.2); w('dome', 1.4); w('drum', 1); W.stack *= .4; },
    tentacles: () => { w('shell', 2); w('pod', 1.4); w('cluster', 1); },
    tripods: () => { w('spire', 1.8); w('mushroom', 1.4); w('stack', 1); },
  }[civ.family] || (() => {}))();
  ({ domes: 'dome', mounds: 'dome', earthworks: 'drum', burrows: 'dome', trapdoor: 'dome', rookery: 'spire', perches: 'spire', hanging: 'pod', hive: 'stack', silk: 'tensile', living: 'mushroom', tracks: 'ring', rings: 'ring', coral: 'cluster', shells: 'shell', conch: 'shell', polyp: 'pod', kelpweave: 'arch', stiltpods: 'pod' })[civ.culture] && w(({ domes: 'dome', mounds: 'dome', earthworks: 'drum', burrows: 'dome', trapdoor: 'dome', rookery: 'spire', perches: 'spire', hanging: 'pod', hive: 'stack', silk: 'tensile', living: 'mushroom', tracks: 'ring', rings: 'ring', coral: 'cluster', shells: 'shell', conch: 'shell', polyp: 'pod', kelpweave: 'arch', stiltpods: 'pod' })[civ.culture], 2);
  if (grown) { w('shell', 1.8); w('pod', 1.2); w('cluster', 1.4); w('mushroom', 1); W.crystal *= .4; W.stack *= .5; }
  if (social > .7) w('cluster', 1.4); if (heavyBuild) { w('drum', .8); W.spire *= .6; }
  // Three or four masses make a people's homes; one or two more their towers.
  const ranked = Object.entries(W).sort((a, b) => b[1] * (.7 + r() * .6) - a[1] * (.7 + r() * .6)).map(([k]) => k);
  const homes = ranked.slice(0, 3 + (r() < .5 ? 1 : 0));
  const towers = [...new Set([...(level >= 5 ? ['spire', 'stack', 'crystal', 'ring'] : ['spire', 'stack']).filter((k) => W[k] > .6 || r() < .35), ranked.find((k) => ['spire', 'stack', 'crystal', 'shell', 'mushroom'].includes(k))])].filter(Boolean).slice(0, 3);
  const pick = (opts) => { let tot = 0; for (const [, v] of opts) tot += Math.max(0, v); let x = r() * tot; for (const [k, v] of opts) { x -= Math.max(0, v); if (x <= 0) return k; } return opts[0][0]; };
  // The plan: how many sides their walls have (round is many).
  const sides = grown ? pick([[10, 2], [12, 1], [7, .6]]) : pick([[3, .5 + (civ.culture === 'tents' ? 1 : 0)], [4, .25 + (civ.culture === 'terraced' ? .8 : 0)], [5, .6], [6, .9 + (civ.family === 'hive' ? 6 : 0)], [8, .8], [sleek ? 24 : 12, .9 + world.cold]]);
  const profile = pick([['taper', 1 + world.heavy * 2], ['bulge', .8 + (grown ? 1.5 : 0) + world.cold], ['waist', .6 + world.light], ['flare', .5 + world.hot], ['onion', .4 + (s.headShape === 'domed' ? 1 : 0)], ['straight', .4 + (civ.culture === 'terraced' ? 1 : 0)]]);
  const roof = pick([['cap', 1 + world.cold + (s.headShape === 'domed' ? 1 : 0)], ['spike', .5 + world.wet + (s.horns ? 1 : 0)], ['parasol', world.hot * 2.5 + world.wet * .5], ['fins', .4 + (s.crest || s.frill ? 1.5 : 0)], ['dish', .3 + (civ.path === 'scholarly' ? 1.2 : 0)], ['garden', (civ.path === 'agrarian' ? 1.6 : .2) + (1 - world.cold) * .2], ['crown', (civ.path === 'devotional' ? 1.6 : .2)], ['flat', civ.culture === 'terraced' ? 1.2 : .1]]);
  const openings = pick([['ports', .6 + ((s.eyes?.count ?? 2) > 2 ? 1.2 : 0)], ['slits', .4 + wary * 1.5 + world.cold], ['seams', sleek ? 1.6 : .2], ['comb', civ.family === 'hive' || sides === 6 ? 1 : .2], ['membrane', .3 + curious * .8 + world.hot * .4], ['bands', .5 + (sleek ? .6 : 0)]]);
  const ornaments = [];
  const orn = (k, p) => { if (r() < p) ornaments.push(k); };
  orn('ribs', (civ.culture === 'timber' ? .8 : .25) + (s.ribs ?? 0) + (s.back === 'ridge' ? .3 : 0));
  orn('scales', s.facets || s.pattern === 'scaled' ? .7 : .15); orn('fins', world.hot * .7 + (s.crest ? .3 : 0));
  orn('rings', s.culture?.style === 'ornamented' ? .8 : .25); orn('tendrils', grown ? .6 : .05); orn('sails', level >= 4 ? .3 + world.hot * .3 : 0);
  orn('spines', (s.back === 'spines' || (t.aggression ?? 0) > .6) ? .7 : .1); orn('drapes', s.culture?.style === 'clothed' || civ.culture === 'tents' ? .7 : .1);
  orn('vanes', world.dry * .5 + world.hot * .3);
  // Colours: the world's material, with the species' own colours worked in.
  const col = s.colors || {};
  return {
    seed: civ.seed ?? 1, level, sleek, grown, world, homes, towers, sides, profile, roof, openings, ornaments,
    squat: clamp(1 - world.heavy * .45 + world.light * .35 + (lanky ? .25 : 0) - (heavyBuild ? .15 : 0), .5, 1.6),
    raised: clamp(world.wet * .6 + (civ.culture === 'stilts' || civ.family === 'tripods' ? .9 : 0) - (civ.family === 'burrowers' ? 1 : 0) + world.light * .2 - world.heavy * .4 - (civ.culture === 'terraced' ? .5 : 0), 0, 1),
    hover: sleek && (level >= 6 || r() < .35 + world.light * .4),
    sunk: civ.family === 'burrowers' || ['mounds', 'burrows', 'trapdoor', 'earthworks'].includes(civ.culture) ? .35 : 0, // half under the ground
    perch: civ.family === 'nests', // ledges to land on, high up
    cluster: clamp(social, 0, 1), walled: wary > .65, open: curious > .6,
    tubes: (world.thin > .3 || sleek) && (social > .5 || world.thin > .5),
    twist: r() < (sleek ? .45 : .15) ? .12 + r() * .3 : 0, tilt: r() < .25 ? .04 + r() * .06 : 0, cantilever: world.light > .3 || (sleek && r() < .4),
    accent: col.accent || null, glowColour: s.glow ? col.glow : null, shimmer: col.shimmer || null,
    doorShape: pick([['arch', 1 + (grown ? 1 : 0)], ['round', .6 + (s.headShape === 'domed' ? .6 : 0)], ['slot', .4 + wary], ['iris', sleek ? 1.4 : 0], ['tri', sides === 3 ? 1.5 : .1]]),
  };
}

// One building's choices within the language: which mass, its proportions, its small differences.
export function variantOf(A, seed, kind = 'home') {
  const r = rng(A.seed, 'building', seed);
  const list = kind === 'tower' ? A.towers : A.homes;
  return {
    r, mass: list[Math.floor(r() * list.length)] || 'dome',
    stretch: .85 + r() * .35, lean: (r() - .5) * A.tilt * 2, annex: r() < .3 + A.cluster * .4, turn: r() * Math.PI * 2,
    tone: Math.floor(r() * 4), extra: r(),
  };
}

// In words, for the codex: "mushroom-capped halls on stalks and clusters of pods, raised on legs, ..."
const MASS_WORDS = {
  pod: 'smooth pods', dome: 'low domes', spire: 'tapering spires', stack: 'stacked drums', shell: 'spiral shell-houses', mushroom: 'houses capped like mushrooms on thick stalks',
  cluster: 'clusters of fused bubbles', arch: 'ribbed vaults', crystal: 'faceted crystal clusters', ring: 'ringed cores', drum: 'squat drums', tensile: 'membranes stretched from masts',
};
const ROOF_WORDS = { cap: 'domed caps', spike: 'spiked tops', parasol: 'parasol roofs held up for shade', fins: 'crowns of fins', dish: 'dishes turned to the sky', garden: 'gardens on their roofs', crown: 'glowing crowns', flat: 'flat roofs walled with parapets' };
const OPEN_WORDS = { ports: 'round ports', slits: 'narrow slits', seams: 'seams of light', comb: 'honeycombed openings', membrane: 'membrane panes', bands: 'bands of light' };
export function describeArchitecture(A) {
  const homes = A.homes.slice(0, 2).map((m) => MASS_WORDS[m]).join(' and ');
  const how = [A.raised > .45 ? 'raised on legs' : '', A.hover ? 'some held above the ground by fields' : '', A.tubes ? 'joined by tubes' : '', A.walled ? 'walled in' : ''].filter(Boolean).join(', ');
  return `${homes}${how ? `, ${how}` : ''}, with ${ROOF_WORDS[A.roof] || 'their own roofs'} and ${OPEN_WORDS[A.openings] || 'openings of their own'}`;
}
