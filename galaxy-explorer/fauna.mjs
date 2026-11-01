// Animal life. Worlds with simple or complex life get their own species,
// derived from the environment like the plants: gravity shapes legs and size,
// air density decides whether anything flies or floats, temperature and water
// pick habitats, and colouring borrows from the local vegetation and rock so
// animals blend into their world. Plain data; fauna-mesh.js builds and animates them.
import { rng } from './rng.mjs';
import { environment } from './flora.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const bell = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));

// Body plans and how well each suits an environment (see flora.environment).
export const PLANS = {
  quadruped: { legs: 4, noun: 'grazer', fit: e => e.complex * (1 - e.lowG * .4) },
  hexapod:   { legs: 6, noun: 'crawler', fit: e => .55 + e.dry * .3 },
  biped:     { legs: 2, noun: 'strider', fit: e => e.complex * (.35 + e.lowG * .8) },
  serpent:   { legs: 0, noun: 'coil', fit: e => .3 + e.dry * .5 },
  flyer:     { legs: 2, noun: 'glider', fit: e => e.complex * clamp(e.pressure / .6, 0, 1.5) * (.5 + e.lowG * .6) },
  floater:   { legs: 0, noun: 'drifter', fit: e => e.complex * (clamp((e.pressure - 1.5) / 3, 0, 1) + e.lowG * .6) },
};
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

export function faunaFor(body) {
  const p = body.physics;
  if (!p || (p.life !== 'simple' && p.life !== 'complex')) return { species: [], environment: null };
  const e = environment(body), r = rng(body.seed, 'fauna');
  // Thin air can't hold up wings; flight needs at least ~0.15 bar.
  const fits = Object.entries(PLANS).map(([plan, d]) => ({ plan, w: d.fit(e) * (plan === 'flyer' && e.pressure < .15 ? 0 : 1) })).filter(c => c.w > .05);
  if (!fits.length) return { species: [], environment: e };
  const count = p.life === 'complex' ? r.int(3, 6) : r.int(1, 2);
  // Simple-life worlds only host small creatures: crawlers and coils.
  const allowed = p.life === 'complex' ? fits : fits.filter(f => f.plan === 'hexapod' || f.plan === 'serpent');
  if (!allowed.length) return { species: [], environment: e };
  const gScale = clamp(1 / Math.sqrt(Math.max(e.gravity, .1)), .7, 1.7);
  const camo = [body.palette[1], body.palette[2], body.rock].map(hueOf);
  const used = new Set(), species = [];
  for (let i = 0; i < count; i++) {
    const total = allowed.reduce((s, c) => s + c.w * (used.has(c.plan) ? .3 : 1), 0);
    let roll = r() * total, plan = allowed[0].plan;
    for (const c of allowed) { roll -= c.w * (used.has(c.plan) ? .3 : 1); if (roll <= 0) { plan = c.plan; break; } }
    used.add(plan);
    const big = p.life === 'complex' && r() < .35;
    const baseSize = { quadruped: [.6, 2.4], hexapod: [.2, .9], biped: [.8, 2.6], serpent: [.6, 2.2], flyer: [.4, 1.6], floater: [1, 3.5] }[plan];
    const size = r.log(...baseSize) * (big ? 1.6 : 1) * (p.life === 'simple' ? .6 : 1) * (plan === 'floater' ? gScale : Math.sqrt(gScale));
    // Strong gravity: short, thick legs; weak gravity: long, thin ones.
    const legLength = size * r.range(.35, .75) * clamp(1 / Math.sqrt(e.gravity), .7, 1.5) * (plan === 'biped' ? 1.4 : 1);
    const diet = plan === 'flyer' || plan === 'floater' ? 'drifter' : r() < (big ? .25 : .2) ? 'predator' : plan === 'quadruped' || plan === 'biped' ? 'grazer' : 'forager';
    const hue = r() < .7 ? r.pick(camo) + r.range(-20, 20) : r.range(0, 360);
    const light = .32 + r.range(-.1, .14) + (e.light > 1.2 ? .06 : 0);
    let name = '';
    for (let k = r.int(2, 3); k > 0; k--) name += r.pick(SYLLABLES);
    name = name[0].toUpperCase() + name.slice(1);
    species.push({
      id: `an-${i}`, name: `${name} ${PLANS[plan].noun}`, plan, legs: PLANS[plan].legs, size, legLength,
      body: { length: size * r.range(.7, 1.2), width: size * r.range(.35, .6) * (e.gravity > 1.3 ? 1.2 : 1), height: size * r.range(.3, .5) },
      neck: plan === 'quadruped' || plan === 'biped' ? size * r.range(0, .55) : 0, head: size * r.range(.18, .3), tail: r() < .7 ? size * r.range(.3, .9) : 0,
      eyes: r.pick([2, 2, 2, 3, 4, 6]), segments: r.int(5, 8), wingSpan: plan === 'flyer' ? size * r.range(1.6, 2.6) : 0, tentacles: r.int(4, 8),
      colors: { base: hsl(hue, r.range(.18, .5), light), belly: hsl(hue + r.range(-15, 15), r.range(.1, .3), light + .16), accent: hsl(hue + r.pick([150, 180, 40, -40]), r.range(.5, .8), r.range(.45, .62)),
        eye: e.dim > .4 ? hsl(r.range(140, 200), .9, .7) : '#151515' },
      diet, behavior: diet === 'grazer' ? 'skittish' : diet === 'predator' ? 'curious' : diet === 'forager' ? (r() < .5 ? 'skittish' : 'indifferent') : 'indifferent',
      group: diet === 'grazer' ? r.int(3, 7) : diet === 'drifter' ? r.int(2, 5) : r.int(1, 3),
      herds: diet === 'grazer' ? r.int(2, 4) : r.int(2, 5),
      speed: { walk: (plan === 'serpent' ? .6 : 1) * (1 + size * .6) * clamp(Math.sqrt(1 / e.gravity), .7, 1.4), run: (plan === 'serpent' ? .6 : 1) * (3 + size * 2.2) },
      altitude: plan === 'flyer' ? [6, 28] : plan === 'floater' ? [5, 22] : [0, 0],
      habitat: { T: 288 + r.range(-12, 12), Tw: r.range(18, 30), moist: plan === 'serpent' ? r.range(.2, .45) : r.range(.4, .8), moistW: r.range(.25, .4) },
      seed: r.int(0, 2 ** 31),
    });
  }
  for (const s of species) s.description = describeAnimal(s, e);
  return { species, environment: e };
}

export function habitatFit(s, c) {
  if (c.submerged) return 0;
  return bell(c.localT, s.habitat.T, s.habitat.Tw) * bell(c.moist, s.habitat.moist, s.habitat.moistW);
}

const PLAN_TEXT = {
  quadruped: 'four-legged', hexapod: 'six-legged', biped: 'long-legged two-legged', serpent: 'legless, coiling', flyer: 'winged', floater: 'gas-filled, drifting',
};
const DIET_TEXT = {
  grazer: 'It grazes in small herds and bolts if you come too close.', predator: 'A hunter, it tends to come and look at you.',
  forager: 'It forages alone or in pairs.', drifter: 'It drifts overhead, unbothered by you.',
};
function describeAnimal(s, e) {
  const size = s.size > 2.5 ? 'Large' : s.size > 1.1 ? 'Mid-sized' : s.size > .5 ? 'Small' : 'Tiny';
  const why = s.plan === 'floater' ? ' Thick air or weak gravity keeps it aloft.' : e.gravity < .6 && s.legLength > s.size * .6 && ['quadruped', 'hexapod', 'biped'].includes(s.plan) ? ' Weak gravity lets it walk on stilt-like legs.' : e.gravity > 1.4 ? ' Strong gravity keeps it low and heavy-set.' : '';
  return `${size}, ${PLAN_TEXT[s.plan]} animal. ${DIET_TEXT[s.diet]}${why}`;
}
