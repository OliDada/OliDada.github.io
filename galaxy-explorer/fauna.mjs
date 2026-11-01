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
import { environment } from './flora.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const bell = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));

export const PLANS = {
  quadruped: { legs: 4, noun: 'grazer', fit: e => e.complex * (1 - e.lowG * .4) },
  hexapod:   { legs: 6, noun: 'crawler', fit: e => .55 + e.dry * .3 },
  biped:     { legs: 2, noun: 'strider', fit: e => e.complex * (.35 + e.lowG * .8) },
  serpent:   { legs: 0, noun: 'coil', fit: e => .3 + e.dry * .5 },
  flyer:     { legs: 2, noun: 'glider', fit: e => e.complex * clamp(e.pressure / .6, 0, 1.5) * (.5 + e.lowG * .6) },
  floater:   { legs: 0, noun: 'drifter', fit: e => e.complex * (clamp((e.pressure - 1.5) / 3, 0, 1) + e.lowG * .6) },
};
// What a species is called follows from how it lives, not only its shape.
const NOUNS = {
  quadruped: { herbivore: 'grazer', omnivore: 'rooter', carnivore: 'stalker' },
  biped: { herbivore: 'strider', omnivore: 'forager', carnivore: 'raptor' },
  hexapod: { herbivore: 'crawler', omnivore: 'scuttler', carnivore: 'hunter' },
  serpent: { herbivore: 'coil', omnivore: 'coil', carnivore: 'viper' },
  flyer: { herbivore: 'glider', omnivore: 'glider', carnivore: 'hawk' },
  floater: { filter: 'drifter' },
};
export const CIVILIZATION = ['none', 'tool use', 'builders', 'spacefaring'];

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
  const fits = Object.entries(PLANS).map(([plan, d]) => ({ plan, w: d.fit(e) * (plan === 'flyer' && e.pressure < .15 ? 0 : 1) })).filter(c => c.w > .05);
  const allowed = p.life === 'complex' ? fits : fits.filter(f => f.plan === 'hexapod' || f.plan === 'serpent');
  if (!allowed.length) return { species: [], environment: e };
  const count = p.life === 'complex' ? r.int(3, 6) : r.int(1, 2);
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
    const baseSize = { quadruped: [.6, 2.4], hexapod: [.2, .9], biped: [.8, 2.6], serpent: [.6, 2.2], flyer: [.4, 1.6], floater: [1, 3.5] }[plan];
    const size = r.log(...baseSize) * (big ? 1.6 : 1) * (p.life === 'simple' ? .6 : 1) * (plan === 'floater' ? gScale : Math.sqrt(gScale));
    // Body: strong gravity shortens and thickens legs; hunters are lean runners, grazers heavier.
    const legLength = size * r.range(.38, .7) * clamp(1 / Math.sqrt(e.gravity), .7, 1.5) * (plan === 'biped' ? 1.35 : 1) * (t.diet === 'carnivore' ? 1.12 : 1);
    const bulk = t.diet === 'herbivore' ? 1.15 : t.diet === 'carnivore' ? .85 : 1;
    const arms = plan === 'biped' && t.intelligence > .42;
    const civilization = civilizationLevel(t, arms, star);
    const hue = r() < .7 ? r.pick(camo) + r.range(-20, 20) : r.range(0, 360);
    const light = .34 + r.range(-.1, .12) + (e.light > 1.2 ? .06 : 0);
    let name = '';
    for (let k = r.int(2, 3); k > 0; k--) name += r.pick(SYLLABLES);
    name = name[0].toUpperCase() + name.slice(1);
    const noun = NOUNS[plan][t.diet] || PLANS[plan].noun;
    const s = {
      id: `an-${i}`, name: `${name} ${noun}`, plan, legs: PLANS[plan].legs, size, legLength, traits: t, arms, civilization,
      body: { length: size * r.range(.75, 1.15), width: size * r.range(.32, .5) * bulk * (e.gravity > 1.3 ? 1.15 : 1), height: size * r.range(.32, .46) * bulk },
      neck: plan === 'quadruped' ? size * (t.diet === 'herbivore' ? r.range(.25, .65) : r.range(.05, .25)) : plan === 'biped' ? size * r.range(.1, .3) : 0,
      // Bigger brains, bigger heads; hunters have long snouts and forward-facing eyes for depth perception.
      head: size * r.range(.17, .24) * (1 + t.intelligence * .55), snout: t.diet === 'carnivore' ? r.range(1.2, 1.6) : t.diet === 'herbivore' ? r.range(.9, 1.3) : r.range(.8, 1.1),
      eyes: { count: r.pick([2, 2, 2, 2, 4, 6]), forward: t.diet === 'carnivore' ? .3 : t.diet === 'omnivore' ? .6 : 1.15, size: .08 + t.perception * .07 },
      horns: t.diet === 'herbivore' && (big || t.aggression > .25) ? r.int(1, 3) : 0, crest: r() < .35,
      tail: plan === 'biped' ? (arms && t.intelligence > .6 ? size * r.range(0, .3) : size * r.range(.5, 1)) : r() < .75 ? size * r.range(.3, .9) : 0,
      segments: r.int(9, 14), wingSpan: plan === 'flyer' ? size * r.range(1.8, 2.8) : 0, tentacles: r.int(5, 9),
      pattern: r.pick(t.diet === 'carnivore' ? ['stripes', 'spots', 'stripes', 'saddle'] : ['plain', 'spots', 'saddle', 'plain', 'stripes']),
      colors: {
        base: hsl(hue, r.range(.2, .5), light), belly: hsl(hue + r.range(-15, 15), r.range(.1, .3), light + .2),
        accent: hsl(hue + r.pick([150, 180, 40, -40, 0]), r.range(.4, .8), r.range(.22, .5)),
        eye: e.dim > .4 ? hsl(r.range(140, 200), .9, .65) : hsl(r.range(20, 60), .7, .45), horn: hsl(40, .2, .78),
      },
      group: plan === 'flyer' || plan === 'floater' ? r.int(2, 5) : Math.max(1, Math.round(1 + t.sociality * (t.diet === 'herbivore' ? 7 : 3.5))),
      herds: r.int(2, 4),
      speed: { walk: (plan === 'serpent' ? .6 : 1) * (.7 + legLength * .9) * (.75 + t.metabolism * .5), run: (plan === 'serpent' ? .6 : 1) * (2.2 + legLength * 3.2) * (.8 + t.metabolism * .5) },
      altitude: plan === 'flyer' ? [6, 28] : plan === 'floater' ? [5, 22] : [0, 0],
      habitat: { T: 288 + r.range(-12, 12), Tw: r.range(18, 30), moist: plan === 'serpent' ? r.range(.2, .45) : r.range(.4, .8), moistW: r.range(.25, .4) },
      seed: r.int(0, 2 ** 31),
    };
    s.behavior = behaviorOf(s);
    s.diet = t.diet; // kept for older callers
    species.push(s);
  }
  for (const s of species) s.description = describeAnimal(s, e);
  return { species, environment: e };
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
export function civilizationLevel(t, arms, star) {
  const potential = t.intelligence * .65 + t.sociality * .2 + (arms ? .15 : 0), age = star?.age ?? 4;
  return potential > .95 && age > 5 ? 3 : potential > .84 && age > 3 ? 2 : potential > .66 ? 1 : 0;
}

export function habitatFit(s, c) {
  if (c.submerged) return 0;
  return bell(c.localT, s.habitat.T, s.habitat.Tw) * bell(c.moist, s.habitat.moist, s.habitat.moistW);
}

const PLAN_TEXT = { quadruped: 'four-legged', hexapod: 'six-legged', biped: 'two-legged', serpent: 'legless, coiling', flyer: 'winged', floater: 'gas-filled, drifting' };
const level = (v) => v > .75 ? 'high' : v > .5 ? 'notable' : v > .25 ? 'modest' : 'low';
function describeAnimal(s, e) {
  const t = s.traits, size = s.size > 2.5 ? 'Large' : s.size > 1.1 ? 'Mid-sized' : s.size > .5 ? 'Small' : 'Tiny';
  const diet = t.diet === 'filter' ? 'filter-feeder' : t.diet;
  const social = s.group > 2 ? `Lives in groups of up to ${s.group}.` : 'Mostly solitary.';
  const manner = s.behavior === 'skittish' ? 'Wary; bolts if you come close.' : s.behavior === 'curious' ? (t.diet === 'carnivore' ? 'Bold; comes to size you up.' : 'Curious about you.') : 'Unbothered by you.';
  const mind = t.intelligence > .5 ? ` Intelligence ${level(t.intelligence)}${s.arms ? ', with grasping hands' : ''}.` : '';
  const civ = s.civilization ? ` ${['', 'Uses simple tools.', 'Builds shelters and structures.', 'Has reached space.'][s.civilization]}` : '';
  const why = s.plan === 'floater' ? ' Thick air or weak gravity keeps it aloft.' : e.gravity < .6 && s.legLength > s.size * .6 && ['quadruped', 'hexapod', 'biped'].includes(s.plan) ? ' Weak gravity gives it stilt-like legs.' : e.gravity > 1.4 ? ' Strong gravity keeps it low and heavy-set.' : '';
  return `${size} ${PLAN_TEXT[s.plan]} ${diet}. ${social} ${manner}${mind}${civ}${why}`;
}
