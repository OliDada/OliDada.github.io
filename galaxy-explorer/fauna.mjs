// Animal life. Each species is generated in three layers:
//   1. Body plan, chosen by the environment (gravity, air, climate).
//   2. Traits: diet, intelligence, sociality, aggression, caution, metabolism,
//      perception. These are the species' "stats".
//   3. Everything else is derived from plan + traits + environment:
//      proportions and features (eye placement, horns, head size, arms),
//      colours and patterns, behaviour, herd size, speed, and a civilization
//      level for species intelligent and social enough to build or travel.
// Plain data, deterministic per world. fauna-mesh.js builds and animates it.
import { rng } from './rng.mjs';
import { environment, CHEM_COLORS, CHEM_TEXT } from './flora.mjs';
import { ecologyFor, describeEcology } from './ecology.mjs';
import { cultureOf, MANIP_WORDS } from './fauna-culture.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const bell = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));

export const PLANS = {
  quadruped: { legs: 4, noun: 'grazer', fit: e => e.complex * (1 - e.lowG * .4) },
  hexapod:   { legs: 6, noun: 'crawler', fit: e => .55 + e.dry * .3 },
  biped:     { legs: 2, noun: 'strider', fit: e => e.complex * (.35 + e.lowG * .8) },
  serpent:   { legs: 0, noun: 'coil', fit: e => .3 + e.dry * .5 },
  flyer:     { legs: 2, noun: 'glider', fit: e => e.complex * clamp(e.pressure / .6, 0, 1.5) * (.5 + e.lowG * .6) },
  floater:   { legs: 0, noun: 'drifter', fit: e => e.complex * (clamp((e.pressure - 1.5) / 3, 0, 1) + e.lowG * .6) },
  arachnid:  { legs: 8, noun: 'skitter', fit: e => .35 + e.dry * .3 },
  slug:      { legs: 0, noun: 'creeper', fit: e => .3 + e.wet * .45 },
  // Body plans with no Earth counterpart on land: radially symmetric walkers with
  // no front or back (and no head), and animals that roll instead of walking.
  radial:    { legs: 5, noun: 'spoke', fit: e => e.complex * .55 },
  roller:    { legs: 0, noun: 'roller', fit: e => e.complex * (.15 + e.dry * .45) * (e.gravity < 1.6 ? 1 : .4) },
};
// Which body plans each chemistry favours. Cold methane and ammonia worlds are slow
// and soupy (drifters, creepers, coils); hot silicon worlds favour armoured walkers
// and rollers; sulfur vents are crowded with crawlers.
const CHEM_FIT = {
  methane: { floater: 1.8, slug: 1.6, serpent: 1.4, radial: 1.4, roller: .3, quadruped: .5, biped: .35, flyer: .7, hexapod: .6, arachnid: .6 },
  ammonia: { floater: 1.3, slug: 1.4, serpent: 1.2, radial: 1.3, quadruped: .9, biped: .7 },
  sulfur: { hexapod: 1.4, arachnid: 1.4, slug: 1.3, roller: 1.2, radial: 1.1, flyer: .5, floater: .5 },
  silicon: { hexapod: 1.2, arachnid: 1.2, roller: 2, radial: 1.3, slug: .4, flyer: .2, floater: .2, biped: .6 },
};
const CHEM_SPEED = { methane: .35, ammonia: .65, silicon: .5, sulfur: .9 };
// Each plan comes in several forms; together with the features below this gives
// thousands of distinct animals rather than one shape per plan in new colours.
export const FORMS = {
  quadruped: ['runner', 'tank', 'browser', 'prowler', 'hopper'],
  biped: ['strider', 'raptor', 'waddler', 'upright'],
  hexapod: ['beetle', 'mantis', 'ant', 'roach'],
  arachnid: ['spider', 'harvestman', 'scorpion'],
  serpent: ['worm', 'eel', 'segmented'],
  slug: ['slug', 'snail'],
  flyer: ['bat', 'insect', 'bird'],
  floater: ['bell', 'balloon', 'manta', 'cluster'],
  radial: ['tripod', 'star', 'octo'],
  roller: ['wheel', 'ball'],
};
const RADIAL_LEGS = { tripod: 3, star: 5, octo: 8 };
// What a species is called follows from how it lives, not only its shape.
const NOUNS = {
  quadruped: { herbivore: 'grazer', omnivore: 'rooter', carnivore: 'stalker' },
  biped: { herbivore: 'strider', omnivore: 'forager', carnivore: 'raptor' },
  hexapod: { herbivore: 'crawler', omnivore: 'scuttler', carnivore: 'hunter' },
  serpent: { herbivore: 'coil', omnivore: 'coil', carnivore: 'viper' },
  flyer: { herbivore: 'glider', omnivore: 'glider', carnivore: 'hawk' },
  floater: { filter: 'drifter' },
  arachnid: { herbivore: 'skitter', omnivore: 'weaver', carnivore: 'spinner' },
  slug: { herbivore: 'creeper', omnivore: 'creeper', carnivore: 'gulper' },
  radial: { herbivore: 'spoke', omnivore: 'treader', carnivore: 'grasper' },
  roller: { herbivore: 'roller', omnivore: 'tumbler', carnivore: 'tumbler' },
};
const FORM_NOUNS = { tank: 'shellback', browser: 'browser', hopper: 'hopper', beetle: 'beetle', mantis: 'mantid', scorpion: 'stinger', harvestman: 'longlegs',
  eel: 'eel', snail: 'snail', insect: 'flitter', bird: 'wing', bell: 'bell', balloon: 'balloon', manta: 'manta', cluster: 'cluster', waddler: 'waddler', tripod: 'tripod', star: 'starwalker', octo: 'tentacler', wheel: 'wheel', ball: 'tumbler' };
// Civilization ladder. Each step needs more intelligence, cooperation and the means to
// shape things, and an older biosphere; roughly 1 system in 17 has tool users, 39
// villages, 96 cities, 211 a species that has reshaped its world, 600 spacefarers, and about
// 2200 system-shapers, who have spread through their whole solar system.
export const CIVILIZATION = ['none', 'tool users', 'village builders', 'city builders', 'planet-shapers', 'spacefarers', 'system-shapers'];
// How well a body can shape things (0..1): hands best, then tentacles, raptorial
// forelegs, mandibles and pedipalps, beaks and feet, coils; rollers barely at all.
const MANIPULATORS = {
  quadruped: { _: [.3, 'mouth and forefeet'], hopper: [.35, 'mouth and forepaws'] },
  biped: { _: [.45, 'mouth and feet'] },
  hexapod: { _: [.5, 'mandibles'], mantis: [.75, 'grasping forelegs'], ant: [.7, 'mandibles'] },
  arachnid: { _: [.55, 'pedipalps'], spider: [.7, 'pedipalps and spinnerets'], scorpion: [.65, 'pincers'] },
  serpent: { _: [.4, 'coils'] }, slug: { _: [.25, 'a muscular foot'] }, flyer: { _: [.45, 'beak and feet'] },
  floater: { _: [.55, 'trailing tentacles'], bell: [.75, 'tentacles'], cluster: [.7, 'tentacles'], manta: [.35, 'fins'] },
  radial: { _: [.55, 'its feet'], octo: [.9, 'tentacles'], star: [.8, 'arm tips'] },
  roller: { _: [.15, 'its mouth'] },
};
export function manipulatorsOf(plan, form, arms) {
  if (arms) return { score: 1, kind: 'grasping hands' };
  const [score, kind] = MANIPULATORS[plan]?.[form] || MANIPULATORS[plan]?._ || [.2, 'its mouth'];
  return { score, kind };
}
// What kind of mind it has, in words: from instinct up the civilization ladder.
export function mindOf(s) {
  if (s.civilization) return CIVILIZATION[s.civilization];
  const i = s.traits.intelligence;
  return i > .55 ? 'clever, without culture' : i > .3 ? 'cunning' : i > .12 ? 'simple' : 'instinctive';
}

const SYLLABLES = ['ka', 'rr', 'om', 'tuv', 'sel', 'ix', 'ban', 'gor', 'yl', 'aph', 'ruk', 'mo', 'zee', 'tal', 'quo', 'nim', 'oss', 'pra', 'vel', 'dun'];
const hsl = (h, s, l) => {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};
const hueOf = (hex) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 30;
  return (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
};

// Traits ("stats"), each 0..1 except diet. Future systems (ecology, building,
// civilizations) should read these rather than the derived values.
function rollTraits(plan, e, r, star, big) {
  const diet = plan === 'floater' ? 'filter'
    : (() => { const x = r(); return x < (big ? .6 : .48) ? 'herbivore' : x < (big ? .8 : .76) ? 'omnivore' : 'carnivore'; })();
  const age = clamp(((star?.age ?? 4) - 1.5) / 6, 0, 1); // older biospheres have had longer to evolve minds
  let intelligence = r() ** 4.5 * (e.complex >= 1 ? 1 : .35) + (diet === 'omnivore' ? .12 : diet === 'carnivore' ? .07 : 0) + (plan === 'biped' ? .15 : 0) + age * .12;
  intelligence = clamp(intelligence, 0, 1);
  const sociality = clamp({ herbivore: .5 + .5 * r(), omnivore: .3 + .6 * r(), carnivore: .15 + .55 * r(), filter: .6 + .4 * r() }[diet] + intelligence * .15, 0, 1);
  const aggression = clamp({ herbivore: .15 * r() + (big && r() < .4 ? .35 : 0), omnivore: .2 + .45 * r(), carnivore: .5 + .5 * r(), filter: 0 }[diet], 0, 1);
  const caution = clamp({ herbivore: .6 + .4 * r(), omnivore: .3 + .4 * r(), carnivore: .1 + .3 * r(), filter: .1 }[diet] - intelligence * .25 - (big ? .1 : 0), 0, 1);
  const metabolism = clamp(.25 + (e.T - 260) / 120 + r() * .35, 0, 1);
  const perception = clamp(.3 + .7 * r() + (diet === 'carnivore' ? .1 : 0), 0, 1);
  return { diet, intelligence, sociality, aggression, caution, metabolism, perception };
}

export function faunaFor(body) {
  const p = body.physics;
  if (!p || (p.life !== 'simple' && p.life !== 'complex')) return { species: [], environment: null };
  const e = environment(body), r = rng(body.seed, 'fauna'), star = { age: body.starAge ?? 4 };
  const chemFit = CHEM_FIT[e.chem] || {};
  const fits = Object.entries(PLANS).map(([plan, d]) => ({ plan, w: d.fit(e) * (chemFit[plan] ?? 1) * (plan === 'flyer' && e.pressure < .15 ? 0 : 1) })).filter(c => c.w > .05);
  const allowed = p.life === 'complex' ? fits : fits.filter(f => ['hexapod', 'serpent', 'arachnid', 'slug'].includes(f.plan));
  if (!allowed.length) return { species: [], environment: e };
  const count = p.life === 'complex' ? r.int(4, 8) : r.int(1, 3);
  const gScale = clamp(1 / Math.sqrt(Math.max(e.gravity, .1)), .7, 1.7);
  const camo = [body.palette[1], body.palette[2], body.rock].map(hueOf);
  const used = new Set(), species = [];
  for (let i = 0; i < count; i++) {
    const total = allowed.reduce((s, c) => s + c.w * (used.has(c.plan) ? .3 : 1), 0);
    let roll = r() * total, plan = allowed[0].plan;
    for (const c of allowed) { roll -= c.w * (used.has(c.plan) ? .3 : 1); if (roll <= 0) { plan = c.plan; break; } }
    used.add(plan);
    const big = p.life === 'complex' && r() < .35;
    const t = rollTraits(plan, e, r, star, big);
    const baseSize = { quadruped: [.6, 2.6], hexapod: [.2, .9], biped: [.8, 2.6], serpent: [.6, 2.2], flyer: [.4, 1.6], floater: [1, 3.5], arachnid: [.25, 1.1], slug: [.2, .9], radial: [.5, 2.2], roller: [.4, 1.6] }[plan];
    const size = r.log(...baseSize) * (big ? 1.6 : 1) * (p.life === 'simple' ? .6 : 1) * (plan === 'floater' ? gScale : Math.sqrt(gScale));
    // Body: strong gravity shortens and thickens legs; hunters are lean runners, grazers heavier.
    const legLength = size * r.range(.38, .7) * clamp(1 / Math.sqrt(e.gravity), .7, 1.5) * (plan === 'biped' ? 1.35 : 1) * (t.diet === 'carnivore' ? 1.12 : 1);
    const bulk = t.diet === 'herbivore' ? 1.15 : t.diet === 'carnivore' ? .85 : 1;
    const arms = plan === 'biped' && t.intelligence > .42;
    const form0 = r.pick(FORMS[plan]);
    const civilization = civilizationLevel(t, manipulatorsOf(plan, form0, arms).score, star);
    const form = form0;
    const look = rollLook(plan, form, t, e, r, camo);
    const chemSpeed = CHEM_SPEED[e.chem] ?? 1;
    let name = '';
    for (let k = r.int(2, 3); k > 0; k--) name += r.pick(SYLLABLES);
    name = name[0].toUpperCase() + name.slice(1);
    const noun = (r() < .55 && FORM_NOUNS[form]) || NOUNS[plan][t.diet] || PLANS[plan].noun;
    const s = {
      id: `an-${i}`, name: `${name} ${noun}`, plan, legs: RADIAL_LEGS[form] ?? PLANS[plan].legs, chemistry: e.chem, size, legLength, traits: t, arms, civilization, manipulators: manipulatorsOf(plan, form, arms),
      body: { length: size * r.range(.75, 1.15), width: size * r.range(.32, .5) * bulk * (e.gravity > 1.3 ? 1.15 : 1), height: size * r.range(.32, .46) * bulk },
      neck: plan === 'quadruped' ? size * (t.diet === 'herbivore' ? r.range(.25, .65) : r.range(.05, .25)) : plan === 'biped' ? size * r.range(.1, .3) : 0,
      // Bigger brains, bigger heads; hunters have long snouts and forward-facing eyes for depth perception.
      head: size * r.range(.16, .26) * (1 + t.intelligence * .55), snout: (t.diet === 'carnivore' ? r.range(1.2, 1.7) : t.diet === 'herbivore' ? r.range(.8, 1.4) : r.range(.7, 1.2)) * (look.headShape === 'long' ? 1.4 : look.headShape === 'flat' || look.headShape === 'domed' ? .7 : 1),
      eyes: { count: r.pick([2, 2, 2, 2, 3, 4, 4, 6, 8]), forward: t.diet === 'carnivore' ? .3 : t.diet === 'omnivore' ? .6 : 1.15, size: .07 + t.perception * .08 + (e.dim > .4 ? .03 : 0) },
      horns: t.diet === 'herbivore' && (big || t.aggression > .25) ? r.int(1, 4) : 0, crest: r() < .35,
      tail: plan === 'biped' ? (arms && t.intelligence > .6 ? size * r.range(0, .3) : size * r.range(.5, 1.1)) : look.tailType === 'none' ? 0 : size * r.range(.3, 1.1),
      segments: r.int(9, 16), wingSpan: plan === 'flyer' ? size * r.range(1.8, 3) : 0, tentacles: r.int(4, 14),
      form, ...look,
      group: plan === 'flyer' || plan === 'floater' ? r.int(2, 5) : Math.max(1, Math.round(1 + t.sociality * (t.diet === 'herbivore' ? 7 : 3.5))),
      herds: r.int(2, 4),
      speed: { walk: chemSpeed * (plan === 'serpent' ? .6 : plan === 'slug' ? .25 : 1) * (.7 + legLength * .9) * (.75 + t.metabolism * .5), run: chemSpeed * (plan === 'serpent' ? .6 : plan === 'slug' ? .3 : plan === 'roller' ? 1.4 : 1) * (2.2 + legLength * 3.2) * (.8 + t.metabolism * .5) },
      altitude: plan === 'flyer' ? [6, 28] : plan === 'floater' ? [5, 22] : [0, 0],
      habitat: { T: (e.chem === 'carbon' ? 288 : e.T) + r.range(-12, 12), Tw: r.range(18, 30) * (e.chem === 'carbon' ? 1 : 1.6), moist: plan === 'serpent' ? r.range(.2, .45) : r.range(.4, .8), moistW: r.range(.25, .4) },
      seed: r.int(0, 2 ** 31),
    };
    s.behavior = behaviorOf(s);
    s.diet = t.diet; // kept for older callers
    species.push(s);
  }
  // Ecology (activity cycle, food web, hunger) reads the finished species list.
  const eco = ecologyFor(species, body, e);
  for (const s of species) {
    // A species that reached civilization evolved the means to build: say what it uses (fauna-culture.mjs draws it).
    const culture = cultureOf(s);
    if (culture) s.manipulators = { ...s.manipulators, kind: MANIP_WORDS[culture.manip] || s.manipulators.kind };
    s.ecology = eco[s.id];
    const life = describeEcology(s, s.ecology, species);
    s.mind = mindOf(s);
    s.description = describeAnimal(s, e) + (life ? ` ${life}` : '');
  }
  return { species, environment: e };
}

// --- Looks ---
// Features and colouring. Colour schemes follow how the animal lives:
//   camouflage (wary prey blends in), warning (dangerous animals advertise it with
//   bold contrasts), display (social species show off crests, frills and sails),
//   iridescent (fliers and drifters shimmer between two hues), and on dim worlds,
//   glowing markings. Starlight shifts everything: dim red suns give deeper colours.
function rollLook(plan, form, t, e, r, camo) {
  const scheme = t.caution > .55 && r() < .7 ? 'camouflage'
    : (t.aggression > .6 || r() < .12) && r() < .65 ? 'warning'
    : (plan === 'flyer' || plan === 'floater') && r() < .55 ? 'iridescent'
    : t.sociality > .6 && r() < .6 ? 'display' : r.pick(['camouflage', 'display', 'iridescent', 'warning']);
  const harmony = r.pick([180, 150, -150, 120, -120, 35, -35]);
  const hue = scheme === 'camouflage' ? r.pick(camo) + r.range(-25, 25) : scheme === 'warning' ? r.pick([5, 25, 45, 55, 210, 280, 330]) + r.range(-10, 10) : r.range(0, 360);
  const dimShift = e.starT < 4000 ? -.06 : e.light > 1.2 ? .05 : 0;
  const sat = scheme === 'camouflage' ? r.range(.18, .45) : scheme === 'warning' ? r.range(.7, .95) : r.range(.35, .8);
  const light = clamp(r.range(.28, .55) + dimShift, .14, .7);
  const colors = {
    base: hsl(hue, sat, light),
    belly: hsl(hue + r.range(-20, 20), sat * .55, clamp(light + r.range(.12, .28), 0, .85)),
    accent: scheme === 'warning' ? (r() < .6 ? hsl(0, 0, .08) : hsl(hue + 180, .85, .55)) : hsl(hue + harmony, clamp(sat + r.range(.1, .3), 0, 1), clamp(light + r.range(-.12, .18), .12, .78)),
    shimmer: hsl(hue + r.pick([60, -60, 90, 140]), clamp(sat + .2, 0, 1), clamp(light + .12, 0, .8)),
    eye: e.dim > .4 ? hsl(r.range(140, 200), .9, .65) : hsl(r.pick([25, 45, 60, 0, 200, 120]) + r.range(-10, 10), r.range(.6, .9), r.range(.4, .6)),
    horn: hsl(r.range(25, 50), r.range(.1, .35), r.range(.55, .82)),
    glow: hsl(r.pick([170, 190, 120, 280, 50, 320]) + r.range(-10, 10), .9, .62),
  };
  const cc = CHEM_COLORS[e.chem];
  if (cc) {
    // Non-carbon life has its own palette: glassy silicon, sulfur yellows, waxy ammonia pastels, tar-dark methane reds.
    const h = r.range(...cc.hue), sa = r.range(...cc.sat), li = r.range(...cc.light);
    colors.base = hsl(h, sa, li); colors.belly = hsl(h + r.range(-25, 25), sa * .7, clamp(li + .15, 0, .9));
    colors.accent = scheme === 'warning' ? hsl(e.chem === 'sulfur' ? 0 : h + 180, .85, .5) : hsl(h + r.range(40, 90) * (r() < .5 ? -1 : 1), clamp(sa + .2, 0, 1), clamp(li + r.range(-.15, .15), .1, .85));
    colors.shimmer = hsl(h + r.range(60, 140), clamp(sa + .25, 0, 1), clamp(li + .1, 0, .9));
    if (e.chem === 'silicon') colors.glow = hsl(r.range(15, 45), 1, .55);                // inner heat
    if (e.chem === 'methane') colors.eye = hsl(r.range(30, 60), .9, .6);
  }
  const glow = e.chem === 'silicon' ? (r() < .6 ? r.range(.4, .9) : 0) : (e.dim > .35 || plan === 'floater') && r() < (plan === 'floater' ? .6 : .35) + e.dim * .3 ? r.range(.5, 1) : 0;
  const pattern = scheme === 'warning' ? r.pick(['bands', 'stripes', 'rings', 'spots']) : scheme === 'camouflage' ? r.pick(['mottled', 'spots', 'stripes', 'plain', 'dapple'])
    : r.pick(['plain', 'saddle', 'spots', 'stripes', 'gradient', 'rings']);
  const spiny = t.aggression > .4 || t.caution > .7;
  return {
    scheme, colors, glow, pattern, patternScale: r.range(.6, 1.8), facets: e.chem === 'silicon',
    headShape: plan === 'hexapod' || plan === 'arachnid' ? r.pick(['round', 'wedge', 'flat']) : t.intelligence > .5 && r() < .6 ? 'domed' : r.pick(['round', 'long', 'wedge', 'flat', 'domed', 'beaked']),
    jaw: t.diet !== 'herbivore' && r() < .6, brow: r() < .4, ears: plan === 'quadruped' || plan === 'biped' ? r.pick(['none', 'none', 'pointed', 'fan']) : 'none',
    antennae: plan === 'hexapod' || plan === 'slug' || (plan === 'arachnid' && r() < .3) || r() < .1 ? (plan === 'slug' ? 2 : r.int(1, 2) * 2) : 0,
    mandibles: (plan === 'hexapod' || plan === 'arachnid') && t.diet !== 'herbivore' && r() < .7, frill: (t.sociality > .55 || scheme === 'display') && r() < .45,
    back: form === 'tank' || form === 'beetle' ? 'shell' : r.pick(spiny ? ['spines', 'plates', 'spines', 'none'] : ['none', 'none', 'hump', 'sail', 'plates', 'ridge']),
    tailType: form === 'scorpion' ? 'stinger' : form === 'tank' ? 'club' : r.pick(['whip', 'plain', 'plain', 'fan', 'spiked', 'club', 'none']),
    feet: r.pick(t.diet === 'carnivore' ? ['claw', 'claw', 'pad'] : ['hoof', 'pad', 'claw', 'pad']),
    girth: { hips: r.range(.4, .6), belly: r.range(.45, .7), shoulders: r.range(.4, .6) }, hump: r.range(0, .25),
    lobes: r.int(6, 16), ribs: r.range(0, .09), frills: r.range(.03, .12), bladders: r.int(3, 6),
  };
}

// How a species reacts to you, derived from its traits.
function behaviorOf(s) {
  const t = s.traits;
  if (s.altitude[1] > 0) return 'indifferent';
  if (t.caution > .55) return 'skittish';
  if ((t.diet === 'carnivore' && t.aggression > .5) || t.intelligence > .55) return 'curious';
  return 'indifferent';
}

// Civilization potential: intelligence matters most, then cooperation and
// hands to build with; the biosphere's age gates the higher levels.
// manip: manipulatorsOf(...).score. Older biospheres gate the higher steps.
const LADDER = [[.75, 0], [.845, 2.5], [.905, 3.5], [.945, 4.5], [.972, 5.5], [.995, 8]];
export function civilizationLevel(t, manip, star) {
  const potential = t.intelligence * .62 + t.sociality * .18 + manip * .2, age = star?.age ?? 4;
  let level = 0;
  for (const [need, minAge] of LADDER) { if (potential > need && age > minAge) level++; else break; }
  return level;
}

export function habitatFit(s, c) {
  if (c.submerged) return 0;
  return bell(c.localT, s.habitat.T, s.habitat.Tw) * bell(c.moist, s.habitat.moist, s.habitat.moistW);
}

const PLAN_TEXT = { quadruped: 'four-legged', hexapod: 'six-legged', biped: 'two-legged', serpent: 'legless, coiling', flyer: 'winged', floater: 'gas-filled, drifting', arachnid: 'eight-legged', slug: 'soft-bodied, gliding', radial: 'headless, radially symmetric', roller: 'rolling' };
const FORM_TEXT = {
  tripod: ' It stalks on three long legs, its body slung high between them, and sees in every direction from an eye stalk on top.',
  star: ' Five arms radiate from a central disc; any arm can lead, so it never needs to turn round.',
  octo: ' It walks on a ring of muscular tentacles under a swollen mantle.',
  wheel: ' Its body is a living wheel: it rolls on a muscular rim around a hub that holds its eyes.',
  ball: ' It curls into a segmented ball and rolls, watching the world from eyes at each end of its axle.',
};
const level = (v) => v > .75 ? 'high' : v > .5 ? 'notable' : v > .25 ? 'modest' : 'low';
function describeAnimal(s, e) {
  const t = s.traits, size = s.size > 2.5 ? 'Large' : s.size > 1.1 ? 'Mid-sized' : s.size > .5 ? 'Small' : 'Tiny';
  const diet = t.diet === 'filter' ? 'filter-feeder' : t.diet;
  const social = s.group > 2 ? `Lives in groups of up to ${s.group}.` : 'Mostly solitary.';
  const manner = s.behavior === 'skittish' ? 'Wary; bolts if you come close.' : s.behavior === 'curious' ? (t.diet === 'carnivore' ? 'Bold; comes to size you up.' : 'Curious about you.') : 'Unbothered by you.';
  const mind = ` Mind: ${mindOf(s)} (intelligence ${level(t.intelligence)}${t.intelligence > .4 ? `, shapes things with ${s.manipulators.kind}` : ''}).`;
  const civ = '';
  const why = s.plan === 'floater' ? ' Thick air or weak gravity keeps it aloft.' : e.gravity < .6 && s.legLength > s.size * .6 && ['quadruped', 'hexapod', 'biped'].includes(s.plan) ? ' Weak gravity gives it stilt-like legs.' : e.gravity > 1.4 ? ' Strong gravity keeps it low and heavy-set.' : '';
  const traits = [s.back === 'shell' ? 'armoured' : s.back === 'sail' ? 'sail-backed' : s.back === 'spines' ? 'spined' : '', s.glow ? 'bioluminescent' : '',
    s.scheme === 'warning' ? 'boldly marked as a warning' : s.scheme === 'iridescent' ? 'iridescent' : s.scheme === 'camouflage' ? 'camouflaged' : ''].filter(Boolean);
  const feature = traits.length ? ` ${traits.join(', ')[0].toUpperCase() + traits.join(', ').slice(1)}.` : '';
  const chem = CHEM_TEXT[s.chemistry] ? ` ${CHEM_TEXT[s.chemistry]}` : '';
  return `${size} ${PLAN_TEXT[s.plan]} ${diet}.${FORM_TEXT[s.form] || ''}${feature} ${social} ${manner}${mind}${civ}${why}${chem}`;
}
