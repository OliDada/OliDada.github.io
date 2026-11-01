// Plant life. Each living world gets its own set of species, derived from its
// environment: temperature and water decide which forms thrive, gravity decides
// how tall they grow, the star's light decides leaf colour, and dim light makes
// bioluminescence common. Everything here is plain data; flora-mesh.js builds
// the 3D models and game.js places them.
import { rng } from './rng.mjs';
import { vegetationShift } from './biomes.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const bell = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));

// Each form: base height range (m), sway, and how well it suits an environment.
// e = { T (K), wet (0..1 water), dry, cold, hot, dim (0..1 low light), lowG, complex }
export const FORMS = {
  tree:      { height: [6, 12], sway: .6, noun: 'tree',   fit: e => e.complex * bell(e.T, 293, 22) * (.3 + e.wet) },
  conifer:   { height: [6, 14], sway: .4, noun: 'spire',  fit: e => e.complex * bell(e.T, 272, 16) * (.4 + e.wet * .6) },
  palm:      { height: [6, 11], sway: .9, noun: 'frond',  fit: e => e.complex * bell(e.T, 305, 14) * e.wet },
  shrub:     { height: [1, 2.6], sway: .5, noun: 'bush',  fit: e => .55 * bell(e.T, 285, 30) },
  grass:     { height: [.5, 1.3], sway: 1.4, noun: 'grass', fit: e => .7 * bell(e.T, 288, 26) * (.4 + e.wet * .6) },
  succulent: { height: [1.4, 5], sway: .05, noun: 'pillar', fit: e => bell(e.T, 306, 18) * (.2 + e.dry) },
  fungus:    { height: [.6, 3.5], sway: .1, noun: 'cap',  fit: e => .45 * (.3 + e.dim) * (.4 + e.wet) * bell(e.T, 283, 26) },
  stalk:     { height: [2, 7], sway: 1.1, noun: 'pod-stalk', fit: e => .4 * (.4 + e.lowG) * bell(e.T, 290, 28) },
  mat:       { height: [.08, .16], sway: 0, noun: 'mat',  fit: e => e.microbial },
  mound:     { height: [.5, 1.6], sway: 0, noun: 'mound', fit: e => e.microbial * .8 },
};

const SYLLABLES = ['thal', 've', 'oru', 'kesh', 'mir', 'lan', 'sef', 'ira', 'qo', 'bryn', 'tess', 'ul', 'vak', 'ny', 'pel', 'dro', 'saa', 'cor', 'fen', 'ilu', 'mae', 'zor', 'eth', 'ri'];
const hsl = (h, s, l) => {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};

export function environment(body) {
  const p = body.physics, starT = body.starTemperature || 5600;
  // Light reaching the surface, relative to Earth: dim red stars and thick air both darken it.
  const irradiance = p.equilibrium ? (p.equilibrium / (1 - p.albedo) ** .25 / 278) ** 4 : 1;
  const light = clamp(irradiance * (starT < 4000 ? .55 : 1) / Math.max(1, p.pressure / 3), 0, 2);
  return {
    T: p.temperature, wet: clamp(p.waterCoverage * 1.2, 0, 1), dry: clamp(1 - p.waterCoverage * 1.6, 0, 1),
    dim: clamp(1 - light, 0, 1) * .8 + (p.tidallyLocked ? .25 : 0), lowG: clamp(1 - p.gravity, 0, 1),
    complex: p.life === 'complex' ? 1 : p.life === 'simple' ? .35 : 0,
    microbial: p.life === 'microbial' ? 1 : 0, gravity: p.gravity, pressure: p.pressure, starT, light,
  };
}

export function floraFor(body) {
  const p = body.physics;
  if (!p || p.life === 'none' || p.subsurfaceOcean && p.waterState === 'ice') return { species: [], environment: null };
  const e = environment(body), r = rng(body.seed, 'flora');
  // Which forms can live here, weighted by fit.
  // Microbial worlds only grow microbial forms; multicellular forms need simple or complex life.
  const microbialForm = (form) => form === 'mat' || form === 'mound';
  const candidates = Object.entries(FORMS).map(([form, f]) => ({ form, w: f.fit(e) * (microbialForm(form) ? 1 : 1 - e.microbial) })).filter(c => c.w > .04);
  if (!candidates.length) return { species: [], environment: e };
  const count = p.life === 'complex' ? r.int(5, 8) : p.life === 'simple' ? r.int(3, 5) : r.int(1, 2);
  const veg = vegetationShift(e.starT);
  const baseHue = 105 + veg.hue + r.range(-15, 15);              // green under a Sun-like star
  const baseLight = .36 + veg.light + (e.light > 1.3 ? .08 : 0);  // pale under harsh light
  const gravityScale = clamp(1 / Math.sqrt(Math.max(e.gravity, .1)), .65, 1.8);
  const glowChance = clamp(e.dim * .9 - .1, 0, .85);
  const used = new Set(), species = [];
  for (let i = 0; i < count; i++) {
    // Weighted pick; repeats are allowed but rarer, so a world can have two kinds of tree.
    const total = candidates.reduce((s, c) => s + c.w * (used.has(c.form) ? .35 : 1), 0);
    let roll = r() * total, form = candidates[0].form;
    for (const c of candidates) { roll -= c.w * (used.has(c.form) ? .35 : 1); if (roll <= 0) { form = c.form; break; } }
    used.add(form);
    const f = FORMS[form];
    const hue = baseHue + r.range(-35, 35), sat = r.range(.3, .65), light = baseLight + r.range(-.1, .1);
    const glow = (form === 'fungus' || form === 'stalk' || form === 'mat') && r() < glowChance ? r.range(.5, 1) : r() < glowChance * .3 ? r.range(.3, .7) : 0;
    const accentHue = hue + r.pick([150, 180, 210, -60, 60]);
    const height = r.range(...f.height) * (form === 'mat' ? 1 : gravityScale);
    let name = '';
    for (let k = r.int(2, 3); k > 0; k--) name += r.pick(SYLLABLES);
    name = name[0].toUpperCase() + name.slice(1);
    // Preferred habitat (from the climate at a point): temperature, moisture and altitude bands.
    const habitat = {
      T: form === 'conifer' ? 270 : form === 'palm' || form === 'succulent' ? 300 : 285 + r.range(-8, 8),
      Tw: r.range(14, 26),
      moist: form === 'succulent' ? r.range(.15, .35) : form === 'palm' || form === 'mat' || form === 'mound' ? r.range(.7, .95) : r.range(.45, .8),
      moistW: r.range(.18, .3),
      shore: form === 'palm' || form === 'mat' || form === 'mound' || r() < .15,
      highland: form === 'conifer' || r() < .12,
    };
    species.push({
      id: `sp-${i}`, name: `${name} ${f.noun}`, form, height, sway: f.sway * clamp(Math.sqrt(e.pressure), .2, 1.6),
      trunkRatio: r.range(.035, .07) * (e.gravity > 1.4 ? 1.4 : 1), branches: r.int(form === 'tree' ? 2 : 0, form === 'tree' ? 5 : 3),
      leafShape: r.pick(['round', 'round', 'umbrella', 'column', 'cluster']), leafSize: r.range(.7, 1.3), arms: r.int(0, 3), segments: r.int(3, 5),
      colors: {
        stem: form === 'mat' ? hsl(hue, sat, light - .1) : hsl(r.range(15, 45) + (veg.hue < -60 ? -30 : 0), r.range(.2, .45), r.range(.18, .32)),
        leaf: hsl(hue, sat, light), leaf2: hsl(hue + r.range(-20, 20), sat * .9, light - .08),
        accent: hsl(accentHue, r.range(.5, .85), r.range(.5, .68)),
      },
      glow, abundance: r.range(.5, 1.5) * (form === 'grass' ? 1.8 : form === 'tree' || form === 'conifer' ? 1.2 : 1), habitat,
      seed: r.int(0, 2 ** 31),
    });
  }
  for (const s of species) s.description = describeSpecies(s, e);
  return { species, environment: e };
}

// How well a species suits the climate at one surface point (0..1).
export function suitability(s, c) {
  if (c.submerged) return 0;
  const h = s.habitat;
  let v = bell(c.localT, h.T, h.Tw) * bell(c.moist, h.moist, h.moistW);
  if (h.shore) v *= .35 + .65 * bell(c.above, 1.5, 4);
  if (h.highland) v *= .4 + .6 * clamp(c.altitude * 1.6, 0, 1); else v *= 1 - .6 * clamp((c.altitude - .7) * 3, 0, 1);
  return v;
}

const SIZE = (h) => h > 9 ? 'towering' : h > 5 ? 'tall' : h > 2.2 ? 'head-high' : h > .9 ? 'waist-high' : h > .3 ? 'knee-high' : 'ground-hugging';
const HUE_WORDS = (hex) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max < 70) return 'near-black';
  if (max - min < 25) return 'grey';
  const h = max === r ? ((g - b) / (max - min) * 60 + 360) % 360 : max === g ? (b - r) / (max - min) * 60 + 120 : (r - g) / (max - min) * 60 + 240;
  return h < 20 || h >= 340 ? 'crimson' : h < 45 ? 'rust' : h < 70 ? 'golden' : h < 160 ? 'green' : h < 200 ? 'teal' : h < 255 ? 'blue' : h < 290 ? 'violet' : 'magenta';
};
const FORM_TEXT = {
  tree: 'trees with spreading canopies', conifer: 'spired trees built from stacked tiers', palm: 'slender trunks crowned with drooping fronds',
  shrub: 'clustered bushes', grass: 'tufts of blade-like leaves', succulent: 'fleshy, water-hoarding pillars', fungus: 'stalked caps that feed on decay',
  stalk: 'thin stalks bearing swollen seed pods', mat: 'mats of colonial microbes', mound: 'layered mounds built by microbial colonies',
};
function describeSpecies(s, e) {
  const where = s.habitat.shore ? 'along shorelines' : s.habitat.highland ? 'on high ground' : s.habitat.moist > .65 ? 'in wet lowlands' : s.habitat.moist < .38 ? 'in dry ground' : 'across temperate ground';
  const glow = s.glow > .45 ? ' It glows softly, a common trait in this dim light.' : s.glow > 0 ? ' It gives off a faint glow.' : '';
  const why = e.gravity < .6 && s.height > 3 ? ' Low gravity lets it grow unusually tall.' : e.gravity > 1.4 ? ' Strong gravity keeps it squat and thick-stemmed.' : '';
  return `${SIZE(s.height)[0].toUpperCase() + SIZE(s.height).slice(1)}, ${HUE_WORDS(s.colors.leaf)} ${FORM_TEXT[s.form]}, found ${where}.${glow}${why}`;
}
