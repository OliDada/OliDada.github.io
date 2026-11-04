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
  // Life on other chemistry (see exoticChemistry in physics.mjs). Only grows on its own kind of world.
  crystal:   { chem: 'silicon', height: [.8, 3], sway: 0, noun: 'shard', fit: e => .7 },
  glasstree: { chem: 'silicon', height: [3, 8], sway: .05, noun: 'glasswood', fit: e => e.complex * .8 },
  chimney:   { chem: 'sulfur', height: [1, 4], sway: 0, noun: 'chimney', fit: e => .7 },
  plume:     { chem: 'sulfur', height: [.6, 2], sway: .7, noun: 'plume', fit: e => .55 * (.3 + e.complex) },
  bulb:      { chem: 'ammonia', height: [.6, 2.4], sway: .2, noun: 'bulb', fit: e => .7 },
  sheet:     { chem: 'ammonia', height: [2, 7], sway: .5, noun: 'sail', fit: e => .3 + e.complex * .6 },
  filament:  { chem: 'methane', height: [4, 16], sway: .35, noun: 'thread', fit: e => .6 },
  crust:     { chem: 'methane', height: [.3, 1.2], sway: 0, noun: 'crust', fit: e => .7 },
};
// Colours of non-carbon life: [hue, saturation, lightness] ranges.
export const CHEM_COLORS = {
  silicon: { hue: [160, 290], sat: [.15, .45], light: [.55, .78] },   // glassy, pale, cool
  sulfur: { hue: [35, 62], sat: [.6, .9], light: [.4, .58] },        // yellow, amber, orange
  ammonia: { hue: [200, 290], sat: [.12, .35], light: [.6, .8] },     // pale waxy blue and lilac
  methane: { hue: [-10, 30], sat: [.35, .6], light: [.18, .34] },    // dark red-brown, like tar
};
export const CHEM_TEXT = {
  silicon: 'Silicon-based: its chemistry needs the heat that would cook carbon life.',
  sulfur: 'Sulfur-based: it lives off volcanic sulfur rather than sunlight and water.',
  ammonia: 'Ammonia-based: it uses liquid ammonia where we would use water.',
  methane: 'Methane-based: liquid methane is its water, and at this cold everything about it is slow.',
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
    chem: p.biochemistry || 'carbon',
  };
}

export function floraFor(body) {
  const p = body.physics;
  if (!p || p.life === 'none' || p.subsurfaceOcean && p.waterState === 'ice' && p.biochemistry === 'carbon') return { species: [], environment: null };
  const e = environment(body), r = rng(body.seed, 'flora');
  // Which forms can live here, weighted by fit.
  // Microbial worlds only grow microbial forms; multicellular forms need simple or complex life.
  const microbialForm = (form) => form === 'mat' || form === 'mound';
  // Each chemistry grows its own forms; microbial mats and mounds grow on any of them.
  const chemOk = (form, f) => microbialForm(form) || (f.chem || 'carbon') === e.chem;
  const candidates = Object.entries(FORMS).map(([form, f]) => ({ form, w: chemOk(form, f) ? f.fit(e) * (microbialForm(form) ? 1 : 1 - e.microbial) : 0 })).filter(c => c.w > .04);
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
    const cc = CHEM_COLORS[e.chem];
    const hue = cc ? r.range(...cc.hue) : baseHue + r.range(-35, 35), sat = cc ? r.range(...cc.sat) : r.range(.3, .65), light = cc ? r.range(...cc.light) : baseLight + r.range(-.1, .1);
    const glow = (form === 'fungus' || form === 'stalk' || form === 'mat') && r() < glowChance ? r.range(.5, 1) : r() < glowChance * .3 ? r.range(.3, .7) : 0;
    const accentHue = hue + r.pick([150, 180, 210, -60, 60]);
    const height = r.range(...f.height) * (form === 'mat' ? 1 : gravityScale);
    let name = '';
    for (let k = r.int(2, 3); k > 0; k--) name += r.pick(SYLLABLES);
    name = name[0].toUpperCase() + name.slice(1);
    // Preferred habitat (from the climate at a point): temperature, moisture and altitude bands.
    const habitat = {
      T: e.chem !== 'carbon' ? e.T + r.range(-8, 8) : form === 'conifer' ? 270 : form === 'palm' || form === 'succulent' ? 300 : 285 + r.range(-8, 8),
      Tw: r.range(14, 26) * (e.chem !== 'carbon' ? 1.6 : 1),
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
        stem: form === 'mat' ? hsl(hue, sat, light - .1) : cc ? hsl(hue + 18, sat * .7, light - .14) : hsl(r.range(15, 45) + (veg.hue < -60 ? -30 : 0), r.range(.2, .45), r.range(.18, .32)),
        leaf: hsl(hue, sat, light), leaf2: hsl(hue + r.range(-20, 20), sat * .9, light - .08),
        accent: hsl(accentHue, r.range(.5, .85), r.range(.5, .68)),
      },
      glow, abundance: r.range(.5, 1.5) * (form === 'grass' ? 1.8 : form === 'tree' || form === 'conifer' ? 1.2 : 1), habitat,
      seed: r.int(0, 2 ** 31),
    });
  }
  // Character traits, from their own random stream so adding them changed no existing species.
  for (const s of species) Object.assign(s, traitsFor(body, s, e));
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

// Plant biomes: what kind of country a point is, from its climate. A world's
// moisture and temperature vary in broad regions (terrain.mjs climate), so walking
// or flying across it you pass from forest into grassland, dry scrub, wetland by
// the shore or bare highland. Each biome has its own density of plant life and
// favours some plant forms over others; a species' own habitat (suitability)
// still decides exactly where it grows within them.
export const PLANT_BIOMES = {
  forest:    { label: 'Forest',    density: .95 },
  grassland: { label: 'Grassland', density: .6 },
  wetland:   { label: 'Wetland',   density: .8 },
  dryland:   { label: 'Dry scrub', density: .22 },
  highland:  { label: 'Highland',  density: .32 },
  barren:    { label: 'Barren',    density: .05 },
};
// How much each biome favours a form (1 = at home, small = rare there); unlisted forms get `other`.
const AFFINITY = {
  forest:    { tree: 1, conifer: 1, glasstree: 1, filament: 1, sheet: .9, fungus: 1, palm: .6, stalk: .7, shrub: .7, grass: .3, bulb: .5, plume: .5, other: .4 },
  grassland: { grass: 1, bulb: 1, plume: 1, shrub: .8, stalk: .7, crystal: .7, mound: .7, tree: .12, conifer: .1, glasstree: .15, filament: .2, palm: .1, other: .4 },
  wetland:   { palm: 1, mat: 1, mound: 1, grass: .7, fungus: .7, sheet: .8, filament: .6, bulb: .7, tree: .35, other: .35 },
  dryland:   { succulent: 1, crystal: 1, chimney: 1, crust: 1, shrub: .55, grass: .3, plume: .4, tree: .04, conifer: .04, palm: .05, other: .2 },
  highland:  { conifer: 1, shrub: .7, grass: .6, crystal: .8, crust: .8, plume: .6, mound: .5, tree: .25, other: .25 },
  barren:    { mat: .7, crust: .7, crystal: .6, mound: .6, other: .1 },
};
export const biomeAffinity = (biome, form) => AFFINITY[biome][form] ?? AFFINITY[biome].other;

// c: climate at a point (terrain.mjs climate); e: the world's environment (above).
export function plantBiome(c, e) {
  if (c.submerged) return null;
  // Too cold or too hot for this world's life: for water-based life a band around
  // liquid water, for other chemistry a band around the world's own temperature.
  const harsh = e.chem === 'carbon' ? c.localT < 246 || c.localT > 334 : Math.abs(c.localT - e.T) > 42;
  if (harsh) return 'barren';
  if (c.altitude > .68) return 'highland';
  if (c.above < 2.5 && c.moist > .58) return 'wetland';
  if (c.moist > .62) return 'forest';
  if (c.moist > .44) return 'grassland';
  return 'dryland';
}

// How a species grows, beyond its form: its habit (straight, leaning, twisted, or several
// stems from one root), bark, a weeping crown, trailing vines, and whether it blooms or
// fruits (and what share of plants are in bloom at any time). flora-mesh.js builds these.
const TRAITS = {
  growth: { tree: ['straight', 'straight', 'leaning', 'twisted', 'multi'], conifer: ['straight', 'straight', 'leaning', 'twisted', 'multi'], palm: ['leaning', 'straight', 'multi'], stalk: ['straight', 'multi', 'leaning'], succulent: ['straight', 'straight', 'multi'], glasstree: ['straight', 'twisted', 'multi'], sheet: ['straight', 'multi'], filament: ['straight', 'leaning'], fungus: ['straight', 'twisted'], chimney: ['straight', 'twisted'] },
  bark: { tree: ['plain', 'plain', 'banded', 'pale', 'mottled'], conifer: ['plain', 'plain', 'banded', 'mottled'], palm: ['plain', 'banded', 'pale'], glasstree: ['plain', 'banded'], stalk: ['plain', 'banded'], succulent: ['plain', 'mottled'] },
  bloom: { tree: ['blossom', 'fruit', 'none', 'none'], shrub: ['blossom', 'berries', 'berries', 'none'], palm: ['fruit', 'fruit', 'none'], succulent: ['flower', 'flower', 'none'], grass: ['seeds', 'none'], stalk: ['blossom', 'none'], mound: ['blossom', 'none'], bulb: ['flower', 'none'], fungus: ['spores', 'none'], plume: ['blossom', 'none'], crystal: ['none', 'none', 'blossom'] },
};
function traitsFor(body, s, e) {
  const t = rng(body.seed, 'flora-traits', s.id), pick = (k) => TRAITS[k][s.form] ? t.pick(TRAITS[k][s.form]) : (k === 'bloom' ? 'none' : 'straight');
  const growth = pick('growth'), bark = TRAITS.bark[s.form] ? t.pick(TRAITS.bark[s.form]) : 'plain', bloom = pick('bloom');
  const tall = ['tree', 'conifer', 'palm', 'glasstree'].includes(s.form);
  const cc = CHEM_COLORS[e.chem], bloomHue = cc ? t.range(...cc.hue) + 60 : t.pick([0, 30, 50, 280, 320, 340, 200]) + t.range(-12, 12);
  return {
    growth, bark, bloom, bloomShare: bloom === 'none' ? 0 : t.range(.3, .8),
    weeping: (s.form === 'tree' || s.form === 'conifer') && t() < .22,
    vines: tall && e.chem === 'carbon' && t() < .12 + e.wet * .25,
    colors: { ...s.colors, bloom: hsl(bloomHue, t.range(.55, .85), bloom === 'fruit' || bloom === 'berries' ? t.range(.38, .55) : t.range(.62, .82)) },
  };
}
const TRAIT_TEXT = {
  growth: { leaning: 'leaning', twisted: 'twisted', multi: 'in clumps of several stems' },
  bark: { banded: 'banded bark', pale: 'pale bark', mottled: 'mottled bark' },
  bloom: { blossom: 'Many are in blossom.', fruit: 'Some bear hanging fruit.', berries: 'Some carry clusters of berries.', flower: 'Some are crowned with flowers.', seeds: 'Seed heads rise above the blades.', spores: 'Some shed glittering spores.' },
};

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
  crystal: 'clusters of glassy, growing crystals', glasstree: 'branching trunks of faceted glass', chimney: 'mineral chimneys crowned with feeding tubes',
  plume: 'feathery plumes that filter sulfur from the air', bulb: 'clumps of waxy, swollen bulbs', sheet: 'thin translucent sails turned toward the light',
  filament: 'impossibly tall threads, beaded with slow-growing pods', crust: 'tar-dark crusts spreading across the ground',
};
function describeSpecies(s, e) {
  const where = s.habitat.shore ? 'along shorelines' : s.habitat.highland ? 'on high ground' : s.habitat.moist > .65 ? 'in wet lowlands' : s.habitat.moist < .38 ? 'in dry ground' : 'across temperate ground';
  const glow = s.glow > .45 ? ' It glows softly, a common trait in this dim light.' : s.glow > 0 ? ' It gives off a faint glow.' : '';
  const why = e.gravity < .6 && s.height > 3 ? ' Low gravity lets it grow unusually tall.' : e.gravity > 1.4 ? ' Strong gravity keeps it squat and thick-stemmed.' : '';
  const chem = CHEM_TEXT[e.chem] ? ` ${CHEM_TEXT[e.chem]}` : '';
  const g = TRAIT_TEXT.growth[s.growth], has = [s.weeping && 'weeping crowns', TRAIT_TEXT.bark[s.bark], s.vines && 'trailing vines'].filter(Boolean);
  const list = has.join(', ').replace(/, ([^,]*)$/, ' and $1');
  const habit = g ? ` They grow ${g}${has.length ? `, with ${list}` : ''}.` : has.length ? ` They have ${list}.` : '', bloom = TRAIT_TEXT.bloom[s.bloom] ? ` ${TRAIT_TEXT.bloom[s.bloom]}` : '';
  return `${SIZE(s.height)[0].toUpperCase() + SIZE(s.height).slice(1)}, ${HUE_WORDS(s.colors.leaf)} ${FORM_TEXT[s.form]}, found ${where}.${habit}${bloom}${glow}${why}${chem}`;
}
