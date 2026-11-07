// Animal life. Each species is generated in three layers:
//   1. Body plan, chosen by the environment (gravity, air, climate).
//   2. Traits: diet, intelligence, sociality, aggression, caution, metabolism,
//      perception. These are the species' "stats".
//   3. Everything else is derived from plan + traits + environment:
//      proportions and features (eye placement, horns, head size, arms),
//      colours and patterns, behaviour, herd size, speed, and a civilization
//      level for species intelligent and social enough to build or travel.
// Plain data, deterministic per world. fauna-mesh.js builds and animates it.
import { worldKey, harmonize, tame, muted } from './palette.mjs';
import { PLANT_STYLE } from './style.mjs';
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
export const CIVILIZATION = ['none', 'tool users', 'village builders', 'metalworkers', 'city builders', 'industrial', 'planet-shapers', 'orbital', 'spacefarers', 'system-shapers'];
// What each step builds on (structures-mesh.js reads this "build level", 1..6): the
// in-between steps build like the one below them and add their own pieces on top
// (metalworkers: forges; industrial: factories and smokestacks; orbital: satellites, a
// station and a launch site, but no crewed ships yet).
export const BUILD_LEVEL = [0, 1, 2, 2, 3, 3, 4, 4, 5, 6];
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
  swimmer: { _: [.25, 'its mouth and fins'], squid: [.8, 'tentacles'], jelly: [.4, 'trailing tentacles'] },
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
function rollTraits(plan, e, r, star, big, forceDiet = null) {
  const diet = forceDiet || plan === 'floater' ? forceDiet || 'filter'
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
    const look = rollLook(plan, form, t, e, r, camo, worldKey(body));
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
      speed: speedOf(plan, legLength, t, chemSpeed),
      altitude: plan === 'flyer' ? [6, 28] : plan === 'floater' ? [5, 22] : [0, 0],
      habitat: { T: (e.chem === 'carbon' ? 288 : e.T) + r.range(-12, 12), Tw: r.range(18, 30) * (e.chem === 'carbon' ? 1 : 1.6), moist: plan === 'serpent' ? r.range(.2, .45) : r.range(.4, .8), moistW: r.range(.25, .4) },
      seed: r.int(0, 2 ** 31),
    };
    // Body build (giant, heavy, tall and thin) and alien variants come from their own
    // stream, so every other draw above stays as it was.
    vary(s, e, rng(body.seed, 'fauna-variety', i), p.life === 'complex', chemSpeed);
    s.behavior = behaviorOf(s);
    s.diet = t.diet; // kept for older callers
    species.push(s);
  }
  const sea = aquaticFor(body, e, star, camo);
  species.push(...sea);
  // Where each species can go: land, water, air, or more than one (own stream).
  for (const s of species) habitatsFor(s, seasOf(p), rng(body.seed, 'fauna-habitat', s.id));
  // Ecology (activity cycle, food web, hunger) reads the finished species list. Hunters
  // only take prey that shares a place with them: fish catch fish, an amphibious hunter
  // takes prey on the shore or in the shallows, a diving flier plucks fish from the sea.
  const eco = ecologyFor(species, body, e);
  for (const s of sea) Object.assign(eco[s.id], { drinks: false, eatsPlants: false, stalksYou: false, defends: false });
  for (const s of species) {
    // A species that reached civilization evolved the means to build: say what it uses (fauna-culture.mjs draws it).
    const culture = cultureOf(s);
    if (culture) {
      s.manipulators = { ...s.manipulators, kind: MANIP_WORDS[culture.manip] || s.manipulators.kind };
      s.culture = { style: culture.style, arms: culture.armStyle };
    }
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
// key: the world's colour key (palette.mjs); rolled hues are pulled toward it afterwards,
// so the random numbers drawn here are the same as before.
function rollLook(plan, form, t, e, r, camo, key) {
  const scheme = t.caution > .55 && r() < .7 ? 'camouflage'
    : (t.aggression > .6 || r() < .12) && r() < .65 ? 'warning'
    : (plan === 'flyer' || plan === 'floater') && r() < .55 ? 'iridescent'
    : t.sociality > .6 && r() < .6 ? 'display' : r.pick(['camouflage', 'display', 'iridescent', 'warning']);
  const harmony = r.pick([180, 150, -150, 120, -120, 35, -35]);
  const rolled = scheme === 'camouflage' ? r.pick(camo) + r.range(-25, 25) : scheme === 'warning' ? r.pick([5, 25, 45, 55, 210, 280, 330]) + r.range(-10, 10) : r.range(0, 360);
  const hue = scheme === 'camouflage' ? rolled : harmonize(rolled, key, scheme === 'warning' ? .5 : .85); // warnings stay bold
  const dimShift = e.starT < 4000 ? -.06 : e.light > 1.2 ? .05 : 0;
  const sat = scheme === 'camouflage' ? r.range(.18, .45) : scheme === 'warning' ? r.range(.7, .95) : r.range(.35, .8);
  const light = clamp(r.range(.28, .55) + dimShift, .14, .7);
  const colors = {
    base: hsl(hue, sat, light),
    belly: hsl(hue + r.range(-20, 20), sat * .55, clamp(light + r.range(.12, .28), 0, .85)),
    accent: scheme === 'warning' ? (r() < .6 ? hsl(0, 0, .08) : hsl(hue + 180, .85, .55)) : hsl(harmonize(hue + harmony, key, .8), clamp(sat + r.range(.1, .3), 0, 1), clamp(light + r.range(-.12, .18), .12, .78)),
    shimmer: hsl(harmonize(hue + r.pick([60, -60, 90, 140]), key, .8), clamp(sat + .2, 0, 1), clamp(light + .12, 0, .8)),
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
  // Within the world's saturation (palette.mjs); warning colours are allowed a little more.
  if (!cc) for (const k of ['base', 'belly', 'accent', 'shimmer']) colors[k] = tame(colors[k], key, scheme === 'warning' ? .22 : 0);
  // New look (style.mjs): animals as restrained as the plants they live among, a little less
  // saturated (warning colours keep more of their bite).
  if (PLANT_STYLE !== 'classic') for (const k of ['base', 'belly', 'accent', 'shimmer']) colors[k] = muted(colors[k], scheme === 'warning' && k === 'accent' ? .85 : k === 'accent' ? .75 : .64, .96);
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

// Walking and running speed from the legs, metabolism and chemistry.
function speedOf(plan, legLength, t, chemSpeed) {
  return {
    walk: chemSpeed * (plan === 'serpent' ? .6 : plan === 'slug' ? .25 : 1) * (.7 + legLength * .9) * (.75 + t.metabolism * .5),
    run: chemSpeed * (plan === 'serpent' ? .6 : plan === 'slug' ? .3 : plan === 'roller' ? 1.4 : 1) * (2.2 + legLength * 3.2) * (.8 + t.metabolism * .5),
  };
}

// --- Builds and alien variants ---
// Every species has a build: ordinary, giant (megafauna many metres tall, in small
// herds, slow and unhurried), heavy (barrel bodies on short thick legs) or tall and
// thin (stilt legs, long necks). Weak gravity favours giants and stilts, strong
// gravity heavy builds. Some species are also stranger than any plan's usual forms:
// whole new forms (many-legged crawlers, walking towers and domes, sky whales, chains
// of drifting bells) or alien features on a familiar body (a hammer-shaped head with
// eyes at its ends, eyes on tall stalks, no head at all, a long tube of a mouth).
// Builders get them too (all but the drifting forms and the tube mouth, which would
// leave their culture nothing to hold or wear).
export const ALIEN_FORMS = { hexapod: ['centipede'], radial: ['tower', 'dome'], floater: ['skywhale', 'siphon'] };
const ALIEN = {
  quadruped: [['hammerhead', 1], ['stalkeye', 1], ['headless', .8], ['proboscis', 1]],
  biped: [['stalkeye', 1], ['hammerhead', .7], ['headless', .6], ['proboscis', .7]],
  hexapod: [['centipede', 2.2], ['stalkeye', 1], ['hammerhead', .6]],
  arachnid: [['stalkeye', 1], ['hammerhead', .5]],
  serpent: [['stalkeye', .6], ['hammerhead', .5]],
  flyer: [['stalkeye', .5], ['proboscis', .5]],
  radial: [['tower', 1.3], ['dome', 1]],
  floater: [['skywhale', 1.2], ['siphon', 1]],
};
const GIANT_OK = ['quadruped', 'hexapod', 'biped', 'serpent', 'radial', 'floater', 'arachnid', 'roller', 'slug', 'flyer'];
const LANKY_OK = ['quadruped', 'biped', 'hexapod', 'arachnid', 'radial', 'serpent', 'floater'];
const weighted = (x, opts) => { let roll = x() * opts.reduce((a, o) => a + o[1], 0); for (const [k, w] of opts) { roll -= w; if (roll <= 0) return k; } return opts[opts.length - 1][0]; };
function vary(s, e, x, complex, chemSpeed) {
  s.build = 'ordinary';
  const civ = s.civilization > 0;
  const low = clamp((1 - e.gravity) / .6, 0, 1), high = clamp((e.gravity - 1.1) / .8, 0, 1), t = s.traits;
  // Alien variants: about one species in three on complex worlds, more on exotic ones.
  const alien = ALIEN[s.plan]?.filter(([k]) => !civ || !['proboscis', 'skywhale', 'siphon'].includes(k));
  if (complex && alien?.length && x() < .32 + (e.chem !== 'carbon' ? .18 : 0)) {
    const v = weighted(x, alien);
    if (ALIEN_FORMS[s.plan]?.includes(v)) s.form = v; else s.alien = v;
    if (v === 'centipede') { s.legs = 2 * x.int(6, 11); s.legLength *= .55; s.body.length *= 1.9; s.body.width *= .8; s.back = 'none'; }
    if (v === 'tower') { s.legs = x.int(7, 11); s.legLength *= .5; }
    if (v === 'dome') { s.legs = x.int(8, 12); s.legLength *= .8; }
    if (v === 'headless' || v === 'hammerhead') { s.frill = false; s.horns = 0; s.ears = 'none'; }
  }
  // Build.
  const w = [
    ['ordinary', 1.25],
    ['giant', complex && GIANT_OK.includes(s.plan) ? (.42 + low * .6) * (1 - high * .7) * (t.diet === 'carnivore' ? .25 : 1) * (s.form === 'skywhale' ? 4 : 1) : 0],
    ['heavy', s.form === 'skywhale' || s.form === 'tower' ? 0 : .5 + high * .9 - low * .2],
    ['lanky', LANKY_OK.includes(s.plan) && s.form !== 'dome' && s.form !== 'centipede' ? .45 + low * 1.1 - high * .35 : 0],
  ];
  s.build = weighted(x, w.filter(o => o[1] > 0));
  const b = s.body;
  if (s.build === 'giant') {
    const cap = s.plan === 'floater' ? 30 : s.plan === 'flyer' ? 7 : 18;
    // A giant is big in absolute terms too (a giant ant is the size of a cart), however small its kind.
    const k = clamp(Math.max(x.range(2.4, 4.2) * (1 + low * .5), (s.plan === 'flyer' ? 2.2 : 3.2) / s.size), 2, Math.min(12, cap / s.size));
    s.size *= k; s.legLength *= k; b.length *= k; b.width *= k * 1.08; b.height *= k * 1.05;
    s.neck *= k; s.tail *= k; s.wingSpan *= k; s.head *= k * .72; // big bodies, relatively small heads
    s.group = Math.min(s.group, x.int(1, 4)); s.herds = x.int(1, 2);
    if (s.altitude[1] > 0) s.altitude = [s.size * .6 + 8, s.size * .6 + 34];
  } else if (s.build === 'heavy') {
    const f = x.range(1.4, 1.85);
    b.width *= f; b.height *= x.range(1.3, 1.55); s.legLength *= x.range(.6, .8); s.neck *= .6; s.tail *= .75; s.bulk = f;
    if (s.girth) s.girth = { hips: Math.min(.8, s.girth.hips * 1.15), belly: Math.min(.95, s.girth.belly * 1.3), shoulders: s.girth.shoulders };
  } else if (s.build === 'lanky') {
    s.legLength *= x.range(1.7, 2.4); b.width *= .65; b.height *= .78; s.head *= .85; s.stretch = x.range(1.5, 2.2);
    if (s.plan === 'quadruped' || s.plan === 'biped') s.neck = Math.max(s.neck, s.size * .3) * x.range(1.6, 2.3);
    if (s.plan === 'serpent') { b.length *= 1.5; b.width *= .8; }
  }
  if (s.build !== 'ordinary' || s.form === 'centipede' || s.form === 'tower' || s.form === 'dome') {
    s.speed = speedOf(s.plan, s.legLength, t, chemSpeed);
    if (s.build === 'giant') { s.speed.walk = Math.min(s.speed.walk, 1 + s.legLength * .2); s.speed.run = Math.min(s.speed.run, s.speed.walk * 2.3); }
    if (s.build === 'heavy') { s.speed.walk *= .8; s.speed.run *= .7; }
    if (s.form === 'centipede') s.speed.run *= 1.3; // a blur of legs
  }
}

// --- Sea life ---
// Worlds with open seas (of water, or methane, ammonia or sulfur) get animals that
// live in them, as their own body plan, the swimmer. Each form has its own sizes,
// diets, school sizes and depths: schools of darting fish, big hunters whose fins cut
// the surface, enormous filter-feeding leviathans that come up to breathe, squid,
// drifting jellies, rays, and two with no Earth counterpart: long undulating ribbons
// and spinning discs. Simple life gets only the small, simple forms. Drawn from its own
// stream, so land animals stay as they were.
export const SWIM_FORMS = {
  fish:      { size: [.25, 1.1], diet: ['herbivore', 'omnivore', 'carnivore'], group: [6, 14], depth: [.35, 2.2], w: 3, simple: true, noun: 'darter' },
  hunter:    { size: [1.3, 3.6], diet: ['carnivore'], group: [1, 3], depth: [.25, 1.6], w: 1.2, noun: 'cutter' },
  leviathan: { size: [9, 22], diet: ['filter'], group: [1, 3], depth: [2, 6], w: 1.1, noun: 'leviathan' },
  squid:     { size: [.5, 2.4], diet: ['carnivore', 'omnivore'], group: [1, 5], depth: [.8, 3], w: 1.1, noun: 'squid' },
  jelly:     { size: [.3, 1.4], diet: ['filter'], group: [4, 10], depth: [.2, 1.4], w: 1.1, simple: true, noun: 'jelly' },
  ray:       { size: [1, 4.5], diet: ['filter', 'carnivore'], group: [1, 4], depth: [.5, 2.6], w: 1, noun: 'ray' },
  ribbon:    { size: [1.5, 6], diet: ['filter', 'herbivore'], group: [1, 3], depth: [.4, 2.2], w: .9, simple: true, alien: true, noun: 'ribbon' },
  disc:      { size: [.4, 1.8], diet: ['omnivore', 'herbivore'], group: [3, 8], depth: [.3, 1.8], w: .9, simple: true, alien: true, noun: 'spinner' },
};
// Where a species can go. Every ground animal wades into shallow water; some go further:
//   swims    land animals that swim as well as they walk (coils and slugs most often)
//   perches  fliers that land to walk and feed (birds most often)
//   dives    hunting fliers that plunge into the sea for fish
//   glides   swimmers that leap and glide over the water on wing-like fins
// habitats: { land, water, air }. Drawn from its own stream.
function habitatsFor(s, seas, x) {
  const h = { land: !s.aquatic && s.altitude[1] === 0, water: !!s.aquatic, air: s.altitude[1] > 0 }, wet = clamp(seas * 1.5, 0, 1);
  if (seas >= .05) {
    const swimChance = { serpent: .45, slug: .3, quadruped: .25, radial: .25, biped: .15, hexapod: .12, arachnid: .08 }[s.plan] ?? 0;
    if (h.land && x() < swimChance * (.4 + wet)) { h.water = true; s.swims = true; }
    if (s.plan === 'flyer' && x() < (s.traits.diet === 'herbivore' ? .08 : .4) * (.3 + wet)) { h.water = true; s.dives = true; }
    if (s.aquatic && ['fish', 'squid', 'ray', 'disc'].includes(s.form) && x() < .3) { h.air = true; s.glides = true; s.leaps = true; }
  }
  if (s.plan === 'flyer' && x() < ({ bird: .75, bat: .45, insect: .6 }[s.form] ?? .5)) { h.land = true; s.perches = true; }
  s.habitats = h;
}
export function seasOf(p) {
  if (p.waterState === 'liquid') return p.waterCoverage || 0;
  return ['methane', 'ammonia', 'sulfur'].includes(p.solvent) ? p.solventCoverage || 0 : 0;
}
function aquaticFor(body, e, star, camo) {
  const p = body.physics;
  if (seasOf(p) < .05) return [];
  const r = rng(body.seed, 'aquatic'), complex = p.life === 'complex', chemSpeed = CHEM_SPEED[e.chem] ?? 1;
  const forms = Object.entries(SWIM_FORMS).filter(([, f]) => complex || f.simple).map(([k, f]) => [k, f.w * (f.alien && e.chem !== 'carbon' ? 2 : 1)]);
  const count = complex ? r.int(2, 5) : r.int(1, 2), used = new Set(), out = [];
  const seaCamo = e.chem === 'carbon' ? [195, 205, 185, ...camo.slice(0, 1)] : camo;
  // Each world's seas have evolved their own way of building a swimmer (seaStyle): its
  // swimmers share a family resemblance, and none look like another world's.
  const style = seaStyle(rng(body.seed, 'sea-style'));
  for (let i = 0; i < count; i++) {
    const form = weighted(r, forms.map(([k, w]) => [k, w * (used.has(k) ? .2 : 1)])), f = SWIM_FORMS[form];
    used.add(form);
    const size = r.log(...f.size) * (complex ? 1 : .6) * (form === 'leviathan' ? 1 : clamp(1 / Math.sqrt(Math.max(e.gravity, .1)), .8, 1.4));
    const t = rollTraits('swimmer', e, r, star, size > 3, r.pick(f.diet));
    const look = rollLook('swimmer', form, t, e, r, seaCamo, worldKey(body));
    let name = '';
    for (let k = r.int(2, 3); k > 0; k--) name += r.pick(SYLLABLES);
    const walk = chemSpeed * (form === 'leviathan' ? 1.4 : form === 'jelly' ? .35 : .5 + Math.min(size, 4) * .45) * (.75 + t.metabolism * .5);
    const s = {
      id: `aq-${i}`, name: `${name[0].toUpperCase() + name.slice(1)} ${f.noun}`, plan: 'swimmer', aquatic: true, form, legs: 0, chemistry: e.chem, size, legLength: size * .25,
      // Sea life can become intelligent too (most easily the many-armed squid), though with no fire under water
      // the ladder is harder to climb; its builders build on the sea floor.
      traits: t, arms: false, civilization: complex ? civilizationLevel(form === 'squid' ? t : { ...t, intelligence: t.intelligence - .08 }, manipulatorsOf('swimmer', form, false).score * (form === 'squid' ? 1 : .2), star) : 0, manipulators: manipulatorsOf('swimmer', form, false), build: size > 8 ? 'giant' : 'ordinary',
      body: { length: size, width: size * r.range(.16, .28), height: size * r.range(.22, .36) },
      neck: 0, head: size * r.range(.16, .24) * (1 + t.intelligence * .4), snout: r.range(.7, 1.4),
      eyes: { count: r.pick([2, 2, 2, 4, 6]), forward: t.diet === 'carnivore' ? .4 : 1.1, size: .08 + t.perception * .08 + (e.dim > .4 ? .04 : 0) },
      horns: 0, crest: false, tail: size * r.range(.25, .45), segments: r.int(6, 12), wingSpan: 0, tentacles: r.int(6, 12),
      ...look, form, ears: 'none', back: r.pick(['none', 'fin', 'fin', 'spines', 'sail']), finShape: r.pick(['fork', 'crescent', 'fan', 'lobes']),
      group: r.int(...f.group), herds: r.int(1, 3),
      speed: { walk, run: walk * (form === 'jelly' ? 1.6 : form === 'leviathan' ? 1.8 : 2.8) },
      altitude: [0, 0], depth: form === 'leviathan' ? [size * .2 + 1.5, size * .2 + 5] : f.depth,
      leaps: ['fish', 'hunter', 'disc', 'squid', 'ray'].includes(form) && r() < .6, surfaces: form === 'leviathan' || (form === 'ray' && r() < .5),
      habitat: { T: (e.chem === 'carbon' ? 288 : e.T) + r.range(-12, 12), Tw: r.range(22, 34) * (e.chem === 'carbon' ? 1 : 1.6), moist: .5, moistW: 9 },
      seed: r.int(0, 2 ** 31),
    };
    if (form === 'leviathan') s.herds = 1;
    // Its own anatomy (own stream), mostly in its world's style; the name follows what stands out.
    const ax = rng(body.seed, 'sea-anatomy', i);
    s.anatomy = seaAnatomy(form, style, ax);
    s.name = `${name[0].toUpperCase() + name.slice(1)} ${seaNoun(s, ax)}`;
    if (s.anatomy.skin === 'translucent' && !s.glow) s.glow = .6;
    s.behavior = behaviorOf(s);
    s.diet = t.diet;
    out.push(s);
  }
  return out;
}

// --- Sea anatomy ---
// Swimmers are not Earth's fish and squid in new colours. Every world's sea has a style:
// how bodies are arranged (two-sided like ours, or three or five rows of fins set evenly
// round the body), how they see (paired eyes, eyes on stalks, rows of eyes, one great eye,
// or none and glowing pits instead), their skin (smooth, armoured in rings of plates,
// spined, frilled along the flanks, or translucent with glowing organs), their mouths (jaws,
// a beard of feelers, a round sucker, a spear-like rostrum, a glowing lure), how they swim
// (a tail, many rows of rowing fins, a jet, or a rippling frill), and whether the body is
// one smooth shape or a chain of segments. Each species takes most of its traits from
// its world's style and some of its own, then a body shape, tail, back fin and trailing
// filaments. fauna-mesh.js builds it; the name and description follow from it.
const pickW = (x, w) => { let v = x() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, n] of Object.entries(w)) if ((v -= n) <= 0) return k; return Object.keys(w)[0]; };
export function seaStyle(x) {
  return {
    symmetry: pickW(x, { bilateral: 1.3, tri: .8, radial: .55 }),
    eyes: pickW(x, { paired: 1, stalked: .8, row: .8, cyclops: .6, none: .45 }),
    skin: pickW(x, { smooth: .9, plated: .8, spined: .7, frilled: .7, translucent: .6 }),
    mouth: pickW(x, { jaws: .9, beard: .8, sucker: .6, rostrum: .6, lure: .5 }),
    swim: pickW(x, { tail: 1.2, fins: .8, jet: .6, ripple: .6 }),
    finShape: pickW(x, { paddle: 1, blade: 1, frond: .7 }),
    segments: x() < .35 ? x.int(2, 4) : 1,
    filaments: x() < .4,
    hueShift: x.range(-40, 40),
  };
}
function seaAnatomy(form, ws, x) {
  const own = (k, w) => x() < .72 ? ws[k] : pickW(x, w);
  const a = {
    symmetry: own('symmetry', { bilateral: 1.3, tri: .8, radial: .55 }),
    eyes: own('eyes', { paired: 1, stalked: .8, row: .8, cyclops: .6, none: .45 }),
    skin: own('skin', { smooth: .9, plated: .8, spined: .7, frilled: .7, translucent: .6 }),
    mouth: own('mouth', { jaws: .9, beard: .8, sucker: .6, rostrum: .6, lure: .5 }),
    swim: own('swim', { tail: 1.2, fins: .8, jet: .6, ripple: .6 }),
    finShape: own('finShape', { paddle: 1, blade: 1, frond: .7 }),
    segments: x() < .75 ? ws.segments : x.int(1, 3),
    shape: pickW(x, form === 'leviathan' ? { torpedo: 1, bulb: 1, deep: .7 } : form === 'hunter' ? { torpedo: 1, long: .8, flat: .6 } : { torpedo: 1, deep: .8, long: .7, bulb: .7, flat: .6 }),
    dorsal: pickW(x, form === 'hunter' ? { blade: 2, sail: .5, spines: .5 } : { none: 1, sail: .7, spines: .7, finlets: .8, blade: .5 }),
    filaments: (ws.filaments ? x() < .75 : x() < .15) ? x.int(2, 6) : 0,
  };
  a.tail = a.swim === 'jet' ? 'jet' : a.swim === 'ripple' ? 'whip' : pickW(x, a.swim === 'fins' ? { fan: 1, paddle: 1, whip: .5 } : { fork: 1, fan: .8, paddle: .8, double: .6, whip: .4 });
  a.finRows = a.swim === 'fins' ? x.int(3, 4) : x.int(1, 2);
  if (form === 'leviathan') { a.segments = Math.min(2, a.segments); if (a.tail === 'jet' || a.tail === 'whip') a.tail = 'paddle'; }
  if (form === 'hunter' && (a.mouth === 'beard' || a.mouth === 'sucker') && x() < .5) a.mouth = 'jaws';
  if (form === 'squid') { a.arms = x.int(5, 12); a.armStyle = pickW(x, { even: 1, 'two-long': 1, webbed: .7 }); a.mantle = pickW(x, { cone: 1, round: .8, ridged: .7 }); a.fins = pickW(x, { side: 1, ring: .7, none: .4 }); }
  if (form === 'ray') { a.wingPairs = x() < .35 ? 2 : 1; }
  if (form === 'jelly') { a.bells = x() < .3 ? 2 : 1; }
  return a;
}
// What it is called, from what stands out about it.
function seaNoun(s, x) {
  const a = s.anatomy, f = s.form;
  const by = {
    squid: [a.armStyle === 'webbed' ? 'veilarm' : a.armStyle === 'two-long' ? 'lasher' : 'armcrown', 'jetarm', 'tentacler'],
    jelly: [a.bells > 1 ? 'twinbell' : 'pulsebell', 'veilbell', 'drifter'],
    ray: [a.wingPairs > 1 ? 'fourwing' : 'wingsail', 'veilwing', 'flapper'],
    leviathan: [a.mouth === 'beard' ? 'beardmaw' : 'leviathan', 'deepmaw', 'behemoth'],
  }[f];
  if (by) return x.pick(by);
  if (f === 'disc') return x.pick(['spinner', 'wheelfin', 'rimeye']);
  if (f === 'ribbon') return x.pick(['ribbon', 'rippler', 'streamer']);
  const feature = [
    a.mouth === 'lure' && 'lanternmaw', a.mouth === 'rostrum' && 'spearnose', a.mouth === 'sucker' && 'suckermouth', a.mouth === 'beard' && 'feelerfin',
    a.tail === 'jet' && 'jetter', a.symmetry === 'tri' && 'trifin', a.symmetry === 'radial' && 'starfin', a.skin === 'plated' && 'platefin',
    a.segments > 1 && 'chainfin', a.eyes === 'stalked' && 'stalkeye', a.eyes === 'row' && 'manyeye', a.eyes === 'cyclops' && 'oneeye', a.eyes === 'none' && 'blindfin',
    a.swim === 'fins' && 'rower', a.swim === 'ripple' && 'rippler',
  ].filter(Boolean);
  const kind = f === 'hunter' ? ['cutter', 'ripper', 'maw'] : ['finner', 'darter', 'glider'];
  return feature.length && x() < .8 ? x.pick(feature) : x.pick(kind);
}
const SEA_WORDS = {
  symmetry: { tri: 'three rows of fins set evenly round its body', radial: 'five rows of fins radiating round its body' },
  eyes: { stalked: 'eyes on stalks', row: 'a row of small eyes down each side', cyclops: 'one great eye', none: 'no eyes at all, only glowing pits that sense the water' },
  skin: { plated: 'armoured in rings of plates', spined: 'bristling with spines', frilled: 'frilled along its flanks', translucent: 'so translucent its glowing organs show through' },
  mouth: { beard: 'a beard of feelers', sucker: 'a round sucker of a mouth', rostrum: 'a long spear of a snout', lure: 'a glowing lure dangling before its mouth' },
  swim: { fins: 'rows of rowing fins', jet: 'jets of water from a funnel at its tail', ripple: 'a rippling frill' },
};
export function seaText(s) {
  const a = s.anatomy; if (!a) return '';
  const body = a.segments > 1 ? `Its body is a chain of ${a.segments} segments` : `Its body is ${{ torpedo: 'torpedo-shaped', deep: 'tall and narrow', long: 'long and slender', bulb: 'bulb-headed', flat: 'broad and flat' }[a.shape] || 'smooth'}`;
  const parts = [SEA_WORDS.skin[a.skin]].filter(Boolean);
  const how = SEA_WORDS.swim[a.swim] ? ` It swims by ${SEA_WORDS.swim[a.swim]}` : '';
  const sym = SEA_WORDS.symmetry[a.symmetry] ? `${how ? ', with' : ' It has'} ${SEA_WORDS.symmetry[a.symmetry]}` : '';
  const sees = [SEA_WORDS.eyes[a.eyes] && `sees with ${SEA_WORDS.eyes[a.eyes]}`, SEA_WORDS.mouth[a.mouth] && `feeds through ${SEA_WORDS.mouth[a.mouth]}`].filter(Boolean);
  return ` ${body}${parts.length ? `, ${parts.join(', ')}` : ''}.${how}${sym}${how || sym ? '.' : ''}${sees.length ? ` It ${sees.join(' and ')}.` : ''}${a.filaments ? ' Long filaments trail behind it.' : ''}`;
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
const LADDER = [[.75, 0], [.845, 2.5], [.88, 3], [.905, 3.5], [.93, 4], [.945, 4.5], [.96, 5], [.972, 5.5], [.995, 8]];
export function civilizationLevel(t, manip, star) {
  const potential = t.intelligence * .62 + t.sociality * .18 + manip * .2, age = star?.age ?? 4;
  let level = 0;
  for (const [need, minAge] of LADDER) { if (potential > need && age > minAge) level++; else break; }
  return level;
}

export function habitatFit(s, c) {
  if (!!c.submerged !== !!s.aquatic) return 0;
  return bell(c.localT, s.habitat.T, s.habitat.Tw) * bell(c.moist, s.habitat.moist, s.habitat.moistW);
}

const PLAN_TEXT = { quadruped: 'four-legged', hexapod: 'six-legged', biped: 'two-legged', serpent: 'legless, coiling', flyer: 'winged', floater: 'gas-filled, drifting', arachnid: 'eight-legged', slug: 'soft-bodied, gliding', radial: 'headless, radially symmetric', roller: 'rolling', swimmer: 'swimming' };
const FORM_TEXT = {
  tripod: ' It stalks on three long legs, its body slung high between them, and sees in every direction from an eye stalk on top.',
  star: ' Five arms radiate from a central disc; any arm can lead, so it never needs to turn round.',
  octo: ' It walks on a ring of muscular tentacles under a swollen mantle.',
  wheel: ' Its body is a living wheel: it rolls on a muscular rim around a hub that holds its eyes.',
  ball: ' It curls into a segmented ball and rolls, watching the world from eyes at each end of its axle.',
  centipede: ' A long, low body ripples forward on dozens of legs.',
  tower: ' It is a walking column: a tall, ringed body on a skirt of short legs, crowned with feeding arms and a ring of eyes.',
  dome: ' A broad, low dome on a ring of thick legs, like a small hill that walks; eyes peer out on stalks.',
  skywhale: ' A long gas-filled body like a whale of the air, steered by broad fins and trailing feeding tendrils.',
  siphon: ' Not one animal but a chain of them: bell after bell strung together, drifting as one.',
  fish: ' A fast, finned swimmer.',
  hunter: ' A big, streamlined swimmer; its tall back fin cuts the surface as it hunts.',
  leviathan: ' An enormous swimmer that strains the water for food and comes up to breathe.',
  squid: ' It jets through the water, body first, trailing a crown of arms.',
  jelly: ' A pulsing bell trailing fine tentacles, drifting with the current.',
  ray: ' A flat swimmer that flies through the water on broad, rippling fins.',
  ribbon: ' A long, flat ribbon of a body that swims by rippling from end to end.',
  disc: ' A flat disc fringed with fine paddles; it spins as it swims, watching from eyes all round its rim.',
};
const ALIEN_TEXT = {
  hammerhead: ' Its head is a broad bar with an eye at each end.',
  stalkeye: ' Its eyes sit on tall stalks that turn independently.',
  headless: ' It has no head: its eyes are set in a row across its chest above a vertical mouth.',
  proboscis: ' Its mouth is a long, flexible tube that it sweeps across the ground.',
};
// How a civilized species presents itself (fauna-culture.mjs style and armStyle).
const STYLE_TEXT = {
  clothed: ' They dress, and their clothing grows more elaborate as their skills do.',
  ornamented: ' They wear no clothes, only ornaments: beads, rings and studs, later of worked metal.',
  painted: ' They go bare but paint their bodies in bold patterns.',
  bare: ' They wear nothing at all; their skill shows only in what they carry.',
  grown: ' Their gear is grown, not made: living sacs, crests and plates fused to their bodies.',
  implants: ' They build their tools into themselves: metal plates and rings fused to limbs and head.',
};
const ARM_TEXT = { tentacle: ' Their arms are boneless and end in fine fingers.', pincer: ' Their arms end in pincers rather than hands.', twin: ' They have two pairs of arms.' };
const HABITAT_TEXT = { swims: ' It swims as readily as it walks.', perches: ' It often lands to walk and feed.', dives: ' It plunges into the sea after fish.', glides: ' It leaps from the sea and glides far over the water on wing-like fins.' };
const BUILD_TEXT = {
  giant: ' A true giant; its herd is small and moves slowly, and nothing hunts it lightly.',
  heavy: ' Heavy and barrel-bodied on short, thick legs.',
  lanky: ' Tall and thin, on long stilt-like legs.',
};
const level = (v) => v > .75 ? 'high' : v > .5 ? 'notable' : v > .25 ? 'modest' : 'low';
function describeAnimal(s, e) {
  const t = s.traits, size = s.size > 8 ? 'Enormous' : s.size > 4 ? 'Huge' : s.size > 2.5 ? 'Large' : s.size > 1.1 ? 'Mid-sized' : s.size > .5 ? 'Small' : 'Tiny';
  const diet = t.diet === 'filter' ? 'filter-feeder' : t.diet;
  const social = s.group > 2 ? `Lives in groups of up to ${s.group}.` : 'Mostly solitary.';
  const manner = s.behavior === 'skittish' ? 'Wary; bolts if you come close.' : s.behavior === 'curious' ? (t.diet === 'carnivore' ? 'Bold; comes to size you up.' : 'Curious about you.') : 'Unbothered by you.';
  const mind = ` Mind: ${mindOf(s)} (intelligence ${level(t.intelligence)}${t.intelligence > .4 ? `, shapes things with ${s.manipulators.kind}` : ''}).`;
  const civ = s.culture ? (STYLE_TEXT[s.culture.style] || '') + (ARM_TEXT[s.culture.arms] && /arms|hands/.test(s.manipulators.kind) ? ARM_TEXT[s.culture.arms] : '') : '';
  const why = s.aquatic ? (s.leaps && !s.glides ? ' Leaps clear of the water now and then.' : s.surfaces ? ' Surfaces now and then to breathe.' : '') : s.plan === 'floater' ? ' Thick air or weak gravity keeps it aloft.' : e.gravity < .6 && s.legLength > s.size * .6 && ['quadruped', 'hexapod', 'biped'].includes(s.plan) ? ' Weak gravity gives it stilt-like legs.' : e.gravity > 1.4 ? ' Strong gravity keeps it low and heavy-set.' : '';
  const traits = [s.back === 'shell' ? 'armoured' : s.back === 'sail' ? 'sail-backed' : s.back === 'spines' ? 'spined' : '', s.glow ? 'bioluminescent' : '',
    s.scheme === 'warning' ? 'boldly marked as a warning' : s.scheme === 'iridescent' ? 'iridescent' : s.scheme === 'camouflage' ? 'camouflaged' : ''].filter(Boolean);
  const feature = traits.length ? ` ${traits.join(', ')[0].toUpperCase() + traits.join(', ').slice(1)}.` : '';
  const chem = CHEM_TEXT[s.chemistry] ? ` ${CHEM_TEXT[s.chemistry]}` : '';
  const body = (s.plan === 'serpent' || s.plan === 'slug' || s.plan === 'roller') && s.build === 'lanky' ? '' : (BUILD_TEXT[s.build] || '').replace(' on short, thick legs', s.legs ? ' on short, thick legs' : '').replace(', on long stilt-like legs', s.legs ? ', on long stilt-like legs' : '');
  const where = ['swims', 'perches', 'dives', 'glides'].filter(k => s[k]).map(k => HABITAT_TEXT[k]).join('');
  // Fish-like swimmers are described from their anatomy; the others from their form, plus what of it they show.
  const finned = ['fish', 'hunter', 'leviathan'].includes(s.form), an = s.anatomy;
  const extra = !s.aquatic || finned || !an ? '' : `${an.skin === 'translucent' ? ' It is so translucent its glowing organs show through.' : ''}${s.form === 'squid' && SEA_WORDS.eyes[an.eyes] ? ` It sees with ${SEA_WORDS.eyes[an.eyes]}.` : ''}${an.filaments ? ' Long filaments trail behind it.' : ''}`;
  const formText = s.aquatic && finned ? (s.form === 'leviathan' ? ' An enormous swimmer that strains the water for food and comes up to breathe.' : s.form === 'hunter' ? ' A big hunter of the open water.' : '') + seaText(s) : (FORM_TEXT[s.form] || '') + extra;
  return `${size} ${PLAN_TEXT[s.plan]} ${diet}.${formText}${where}${ALIEN_TEXT[s.alien] || ''}${s.aquatic ? '' : body}${feature} ${social} ${manner}${mind}${civ}${why}${chem}`;
}
