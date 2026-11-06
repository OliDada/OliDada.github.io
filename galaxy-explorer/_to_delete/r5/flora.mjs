// Plant life. Each living world gets its own set of species, derived from its
// environment: temperature and water decide which forms thrive, gravity decides
// how tall they grow, the star's light decides leaf colour, and dim light makes
// bioluminescence common. Everything here is plain data; flora-mesh.js builds
// the 3D models and game.js places them.
import { worldKey, harmonize, tame } from './palette.mjs';
import { rng } from './rng.mjs';
import { vegetationShift } from './biomes.mjs';
import { PLANT_STYLE } from './style.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// A colour with its saturation and lightness scaled (sat, light: factors), as hex.
// key, pull (optional): the hue is also drawn toward the world's colour key (palette.mjs)
// and the saturation kept under its ceiling, so one world's foliage shares a few hues.
function mute(hex, sat, light, key = null, pull = 0) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, sl = 0;
  if (d) { sl = d / (1 - Math.abs(2 * l - 1)); h = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; }
  if (key && d) { h = harmonize(h, key, pull); sl = Math.min(sl * sat, Math.max(.18, key.vivid * .8)) / sat; }
  return hsl(h, sl * sat, l * light);
}
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
  // Under water (seaFloraFor below): never picked for dry land. depth: metres of water it grows in.
  kelp:      { sea: true, height: [3, 14], sway: .9, noun: 'kelp', depth: [2, 26], fit: () => 0 },
  seagrass:  { sea: true, height: [.4, 1.2], sway: 1.2, noun: 'seagrass', depth: [.2, 6], fit: () => 0 },
  coral:     { sea: true, height: [.5, 2.4], sway: 0, noun: 'coral', depth: [.4, 14], fit: () => 0 },
  fan:       { sea: true, height: [.8, 2.6], sway: .35, noun: 'fan', depth: [2, 30], fit: () => 0 },
  anemone:   { sea: true, height: [.3, 1.2], sway: .6, noun: 'anemone', depth: [.5, 22], fit: () => 0 },
  bladder:   { sea: true, height: [1, 5], sway: .5, noun: 'bladderweed', depth: [1, 20], fit: () => 0 },
  reefmound: { sea: true, height: [.4, 1.3], sway: 0, noun: 'reef mound', depth: [.2, 8], fit: () => 0 },
};
// How much taller each form grows in the new plant style (style.mjs). Applied after the
// height is rolled, so nothing else about a species changes.
const TALL = { conifer: 1.75, tree: 1.45, glasstree: 1.4, filament: 1.2, palm: 1.15, sheet: 1.2 };
// Which sea forms grow where: by life level (microbial seas only get reef mounds) and warmth.
const SEA_FORMS = {
  complex: { kelp: 1.4, seagrass: 1.3, coral: 1, fan: .9, anemone: 1, bladder: .8 },
  simple: { seagrass: 1.3, anemone: 1, bladder: .7, reefmound: .6, coral: .5 },
  microbial: { reefmound: 1 },
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
    const accentHue = cc ? hue + r.pick([150, 180, 210, -60, 60]) : harmonize(hue + r.pick([150, 180, 210, -60, 60]), worldKey(body), .85); // toward the world's colour key (palette.mjs)
    // New plant style: trees and spires stand far taller, so a forest towers over you.
    const height = Math.min(28, r.range(...f.height) * (form === 'mat' ? 1 : gravityScale) * (PLANT_STYLE !== 'classic' ? TALL[form] ?? 1 : 1));
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
  // New plant style: the shape of each world's trees, from its own stream (see SHAPES).
  if (PLANT_STYLE !== 'classic') for (const s of species) if (s.form === 'tree' || s.form === 'conifer') {
    s.shape = shapeFor(body, s, e);
    if (!s.shape.earthlike) s.description += ` ${SHAPE_TEXT.trunk[s.shape.trunk]}, ${SHAPE_TEXT.crown[s.shape.crown]}.`;
  }
  species.push(...seaFloraFor(body, e, veg));
  // Flowers, fruit and accents stay within the world's saturation (palette.mjs); leaves keep theirs.
  if (!CHEM_COLORS[e.chem]) for (const s of species) for (const k of ['accent', 'bloom']) if (s.colors[k]) s.colors[k] = tame(s.colors[k], worldKey(body));
  // New plant style: foliage a little less saturated and less bright, so plants sit with
  // the ground they grow on rather than looking painted on (flowers and fruit keep theirs).
  // Restraint in colour (step 4 of the look): leaves and bark are also drawn toward the
  // world's colour key, so ground, plants and sky read as one small palette.
  if (PLANT_STYLE !== 'classic') for (const s of species) for (const k of ['leaf', 'leaf2', 'stem']) if (s.colors[k]) s.colors[k] = mute(s.colors[k], k === 'stem' ? .85 : .72, k === 'stem' ? .95 : .9, CHEM_COLORS[e.chem] ? null : worldKey(body), k === 'stem' ? 0 : k === 'leaf' ? .4 : .3); // (bark keeps its hue, only its saturation is capped)
  return { species, environment: e };
}

// Plants of the sea floor: kelp forests, seagrass meadows, coral, fans, anemone-like
// polyps, bladderweed buoyed by gas sacs, and on microbial worlds reef mounds. Each has
// a depth range; most life crowds the sunlit shallows. Its own stream (ids sea-0, …),
// so land plants stay as they were.
function seaFloraFor(body, e, veg) {
  const p = body.physics, seas = p.waterState === 'liquid' ? p.waterCoverage || 0 : ['methane', 'ammonia', 'sulfur'].includes(p.solvent) ? p.solventCoverage || 0 : 0;
  if (seas < .05 || !['microbial', 'simple', 'complex'].includes(p.life)) return [];
  const r = rng(body.seed, 'sea-flora'), weights = Object.entries(SEA_FORMS[p.life]).map(([k, w]) => [k, w * (k === 'coral' && e.chem === 'carbon' ? clamp((e.T - 275) / 20, .1, 1.2) : 1)]);
  const count = p.life === 'complex' ? r.int(3, 5) : p.life === 'simple' ? r.int(2, 3) : 1, used = new Set(), out = [], cc = CHEM_COLORS[e.chem];
  for (let i = 0; i < count; i++) {
    let roll = r() * weights.reduce((a, [k, w]) => a + w * (used.has(k) ? .25 : 1), 0), form = weights[0][0];
    for (const [k, w] of weights) if ((roll -= w * (used.has(k) ? .25 : 1)) <= 0) { form = k; break; }
    used.add(form);
    const f = FORMS[form];
    // Sea plants: browns, greens and reds of algae; coral and polyps in bright colours of their own.
    const bright = form === 'coral' || form === 'anemone' || form === 'fan';
    const hue = cc ? r.range(...cc.hue) : bright ? harmonize(r.range(-40, 330), worldKey(body), .8) : r.pick([35, 60, 100, 130, 0, 330]) + veg.hue * .4 + r.range(-15, 15);
    const sat = cc ? r.range(...cc.sat) : bright ? r.range(.5, .85) : r.range(.3, .6), light = cc ? r.range(...cc.light) : r.range(.32, .55);
    const glow = (form === 'anemone' || form === 'fan' || form === 'bladder') && r() < .2 + e.dim * .5 ? r.range(.4, .9) : 0;
    let name = '';
    for (let k = r.int(2, 3); k > 0; k--) name += r.pick(SYLLABLES);
    const d0 = r.range(f.depth[0], f.depth[0] + (f.depth[1] - f.depth[0]) * .3), d1 = r.range(d0 + (f.depth[1] - f.depth[0]) * .3, f.depth[1]);
    const height = r.range(...f.height) * clamp(1 / Math.sqrt(Math.max(e.gravity, .1)), .7, 1.5);
    out.push({
      id: `sea-${i}`, aquatic: true, name: `${name[0].toUpperCase() + name.slice(1)} ${f.noun}`, form, height, sway: f.sway,
      trunkRatio: .03, branches: r.int(3, 6), leafShape: 'round', leafSize: r.range(.7, 1.3), arms: r.int(1, 3), segments: r.int(3, 6),
      colors: { stem: hsl(hue + 15, sat * .8, light - .12), leaf: hsl(hue, sat, light), leaf2: hsl(hue + r.range(-25, 25), sat * .9, light - .07), accent: hsl(hue + r.pick([150, 180, 60, -60]), r.range(.55, .9), r.range(.5, .7)) },
      glow, abundance: r.range(.6, 1.4) * (form === 'seagrass' ? 2 : form === 'kelp' ? 1.3 : 1),
      habitat: { depth: [d0, d1], T: (e.chem === 'carbon' ? 288 : e.T) + r.range(-10, 10), Tw: r.range(18, 30) * (e.chem === 'carbon' ? 1 : 1.6), moist: .5, moistW: 9, shore: false, highland: false },
      growth: 'straight', bark: 'plain', bloom: 'none', bloomShare: 0, weeping: false, vines: false,
      seed: r.int(0, 2 ** 31),
    });
    const sp = out[out.length - 1];
    sp.description = `${SIZE(height)[0].toUpperCase() + SIZE(height).slice(1)}, ${HUE_WORDS(sp.colors.leaf)} ${FORM_TEXT[form]}, growing under water ${d0 < 1 ? 'from the shallows' : `from ${Math.round(d0)} m`} down to ${Math.round(d1)} m.${glow > .45 ? ' It glows in the gloom.' : ''}${CHEM_TEXT[e.chem] ? ` ${CHEM_TEXT[e.chem]}` : ''}`;
  }
  return out;
}

// How well a species suits the climate at one surface point (0..1).
export function suitability(s, c) {
  if (s.aquatic) { // by depth (most in the middle of its range) and warmth
    if (!c.submerged) return 0;
    const [d0, d1] = s.habitat.depth, d = -c.above;
    return d < d0 || d > d1 ? 0 : bell(d, (d0 + d1) / 2, (d1 - d0) * .6 + .5) * bell(c.localT, s.habitat.T, s.habitat.Tw);
  }
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
  darkwood:  { label: 'Old forest', density: 1 }, // the deep, dark heart of a forest (new plant style)
  forest:    { label: 'Forest',    density: .95 },
  grassland: { label: 'Grassland', density: .6 },
  wetland:   { label: 'Wetland',   density: .8 },
  dryland:   { label: 'Dry scrub', density: .22 },
  highland:  { label: 'Highland',  density: .32 },
  barren:    { label: 'Barren',    density: .05 },
};
// How much each biome favours a form (1 = at home, small = rare there); unlisted forms get `other`.
const AFFINITY = {
  darkwood:  { conifer: 1, tree: .75, glasstree: 1, filament: 1, sheet: .9, fungus: 1, shrub: .45, stalk: .35, palm: .15, grass: .03, bulb: .35, plume: .3, other: .25 },
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
  if (PLANT_STYLE === 'classic' || c.stand === undefined) {
    if (c.altitude > .68) return 'highland';
    if (c.above < 2.5 && c.moist > .58) return 'wetland';
    if (c.moist > .62) return 'forest';
    if (c.moist > .44) return 'grassland';
    return 'dryland';
  }
  // New plant style: forests are commoner and have ragged edges, glades and a dark,
  // old heart (darkwood) where it is wettest; the tree line sits a little lower.
  if (c.altitude > .62) return 'highland';
  if (c.above < 2.5 && c.moist > .6) return 'wetland';
  const wood = c.moist + .09 * c.stand;
  if (wood > .675 && c.stand > -.15) return 'darkwood';
  if (wood > .545) return 'forest';
  if (c.moist > .42) return 'grassland';
  return 'dryland';
}

// Tree shapes (new plant style; flora-forest.js builds them). Familiar firs, pines, oaks
// and birches only grow where a world is much like Earth (a Sun-like star, mild
// temperatures, about Earth's gravity), and not always even there. Everywhere else a
// tree is a trunk plan and a crown plan, each with its own proportions, so every world's
// forests look like their own: swollen bottle trunks under stacked discs, stilt-rooted
// arches hung with lanterns, braided columns crowned with bristles, and so on.
export const SHAPES = {
  trunk: ['column', 'bottle', 'candelabra', 'braided', 'stilt', 'arch', 'segmented', 'forked', 'spiral'],
  crown: ['discs', 'globe', 'umbrella', 'weeping', 'spiral', 'bottlebrush', 'fan', 'lanterns', 'invertedCone', 'puffs', 'shelves', 'ribbons'],
};
// Which plans each form leans to (weights): spires toward tall, narrow and many-layered.
const SHAPE_BIAS = {
  conifer: { trunk: { column: 3, segmented: 2, braided: 2, spiral: 2, stilt: 1, bottle: 1, candelabra: 1, arch: .4, forked: .4 }, crown: { discs: 3, spiral: 3, bottlebrush: 3, invertedCone: 2, shelves: 2, ribbons: 1, fan: 1, puffs: 1, weeping: 1, globe: .5, umbrella: .5, lanterns: 1 } },
  tree: { trunk: { bottle: 2, candelabra: 2, forked: 3, stilt: 2, arch: 2, column: 1, braided: 1, segmented: 1, spiral: 1 }, crown: { globe: 2, umbrella: 3, weeping: 2, lanterns: 2, fan: 2, puffs: 2, discs: 2, ribbons: 1.5, shelves: 1, spiral: 1, bottlebrush: 1, invertedCone: 1 } },
};
const SHAPE_TEXT = {
  trunk: { column: 'A straight column of a trunk', bottle: 'A swollen, bottle-shaped trunk', candelabra: 'A trunk that splits into upturned arms', braided: 'Several stems braided into one trunk', stilt: 'A trunk held up on stilt roots', arch: 'An arching trunk that bows to one side', segmented: 'A jointed trunk in ringed segments', forked: 'A trunk that forks and forks again', spiral: 'A trunk that corkscrews upward' },
  crown: { discs: 'under a crown of stacked flat discs', globe: 'under lumpy round clusters', umbrella: 'under a wide, flat-topped canopy', weeping: 'hung with long trailing strands', spiral: 'with leaves winding round it in a spiral', bottlebrush: 'bristling with stiff needles like a brush', fan: 'crowned with stiff fans of fronds', lanterns: 'hung with swollen lantern-like pods', invertedCone: 'its crown widening toward the top', puffs: 'tipped with many round puffs on thin stalks', shelves: 'with shelf-like plates stepping up it', ribbons: 'streaming long ribbon-like leaves' },
};
function shapeFor(body, s, e) {
  const t = rng(body.seed, 'flora-shape', s.id);
  const earth = e.chem === 'carbon' && e.starT > 4800 && e.starT < 6800 && e.T > 262 && e.T < 306 && e.gravity > .6 && e.gravity < 1.5;
  const earthlike = earth && t() < .55;
  const pick = (w) => { const k = Object.keys(w), sum = k.reduce((a, x) => a + w[x], 0); let v = t() * sum; for (const x of k) if ((v -= w[x]) <= 0) return x; return k[0]; };
  const bias = SHAPE_BIAS[s.form];
  return {
    // (lift: high crowns on long bare trunks, as in an old forest.)
    earthlike, trunk: pick(bias.trunk), crown: pick(bias.crown),
    girth: t.range(.7, 1.6), lift: t.range(.55, .95), spread: t.range(.55, 1.15), layers: t.int(3, 9), lean: t.range(-.25, .25),
    droop: t.range(0, 1), lumpy: t.range(.05, .3), count: t.int(3, 7), pods: t() < .45, thorns: t() < .25, bands: t() < .3,
  };
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
  const cc = CHEM_COLORS[e.chem], bloomHue = cc ? t.range(...cc.hue) + 60 : harmonize(t.pick([0, 30, 50, 280, 320, 340, 200]) + t.range(-12, 12), worldKey(body), .85);
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
  kelp: 'kelp: tall stems hung with long blades, held up by gas floats', seagrass: 'seagrass in swaying meadows', coral: 'branching coral built by colonies of polyps',
  fan: 'lattice fans held up into the current', anemone: 'polyps, each a column crowned with a ring of tentacles', bladder: 'stalks strung with clusters of gas bladders',
  reefmound: 'reef mounds: layered stone built by microbial mats',
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
