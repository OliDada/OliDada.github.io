// Geology to find and record on any world with a surface, so worlds without life
// still have something to discover. Pure data; geology-mesh.js builds and places it.
//
//   Rocks (ROCKS): every world has 2–3 rock types, chosen from its physics: basalt
//   and obsidian where there is volcanism, pale anorthosite and impact breccia on
//   airless worlds, sandstone, shale and limestone where water once lay, and so on.
//   They look like natural outcrops and boulders.
//   Formations (FORMATIONS): bigger landforms (basalt columns, hoodoos, sea stacks,
//   cryovolcanoes…). Only some worlds have one (about 2 in 5), and a few (geodes,
//   iron meteorites) are rare anywhere.
//
// Both are recorded as codex kind 'formation' (type 'rock' or 'formation'), by name.
// Draws come from their own key paths, so nothing else changes.
import { rng } from './rng.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// fit(e) -> weight; shape is drawn by geology-mesh.js; near: 'shore' | 'high' | 'any'.
// Rock types. kind: what sort of rock it is (shown on its card); shape: how
// geology-mesh.js draws it (boulder, slab, rubble or ice); colors: [main, dark].
export const ROCKS = {
  basalt:      { name: 'basalt', kind: 'Igneous: volcanic', shape: 'boulder', colors: ['#45434a', '#2b2a30'], fit: e => .35 + e.volc * 1.4 + (e.biome === 'Volcanic' ? 1 : 0),
                 text: () => 'Dark, fine-grained rock: cooled lava, the most common rock on rocky worlds.' },
  obsidian:    { name: 'obsidian', kind: 'Igneous: volcanic glass', shape: 'boulder', glassy: true, colors: ['#1b1920', '#2f2b36'], fit: e => e.volc * 1.1 + (e.biome === 'Volcanic' ? .5 : 0),
                 text: () => 'Black volcanic glass, formed where lava cooled too fast to crystallise.' },
  granite:     { name: 'granite', kind: 'Igneous: deep-cooled', shape: 'boulder', colors: ['#b3a8a1', '#857b76'], fit: e => (e.air > .05 ? .6 : .15) * (e.ice ? .3 : 1),
                 text: () => 'Coarse, speckled rock that cooled slowly deep underground before erosion laid it bare.' },
  olivine:     { name: 'olivine rock', kind: 'Igneous: from the mantle', shape: 'boulder', colors: ['#6e7840', '#4b5330'], fit: e => (e.air < .05 ? .5 : .1) + e.volc * .4,
                 text: () => 'Green rock rich in olivine, brought up from deep in the mantle by ancient eruptions.' },
  anorthosite: { name: 'anorthosite', kind: 'Igneous: highland crust', shape: 'boulder', colors: ['#d2d0ca', '#a6a49f'], fit: e => (e.air < .05 ? 1 : .05) * (e.ice ? .3 : 1),
                 text: () => 'Pale highland rock that floated to the top of this world\'s ancient magma ocean.' },
  breccia:     { name: 'impact breccia', kind: 'Impact rock', shape: 'rubble', colors: ['#8a817a', '#57524d'], fit: e => (e.air < .05 ? 1.2 : .12) + (e.biome === 'Barren' ? .5 : 0),
                 text: e => `Broken rock welded back together by the heat and shock of impacts${e.air < .05 ? '; with no air, nothing has worn it down' : ''}.` },
  sandstone:   { name: 'sandstone', kind: 'Sedimentary', shape: 'slab', colors: ['#c4965f', '#9b6a3e'], fit: e => (e.biome === 'Desert' ? 1.3 : 0) + e.dry * e.windy * .6 + (e.wet ? .25 : 0),
                 text: e => `Layers of sand grains cemented into stone, laid down by ${e.wet ? 'ancient rivers and seas' : 'wind over long ages'}.` },
  shale:       { name: 'shale', kind: 'Sedimentary', shape: 'slab', colors: ['#5c5f63', '#3e4145'], fit: e => e.wet ? .9 : 0,
                 text: () => 'Thin, crumbly layers of mud pressed into stone at the bottom of still water.' },
  limestone:   { name: 'limestone', kind: 'Sedimentary', shape: 'slab', colors: ['#d6cdb6', '#b3a88f'], fit: e => e.wet && e.T > 250 && e.T < 340 ? .9 : 0,
                 text: e => e.life ? 'Pale rock built from the shells and skeletons of sea life, settled over ages.' : 'Pale carbonate rock that settled out of warm, mineral-rich water.' },
  ironstone:   { name: 'ironstone', kind: 'Sedimentary', shape: 'boulder', colors: ['#8c4a33', '#663324'], fit: e => (e.biome === 'Desert' ? .9 : 0) + e.dry * (e.air > .05 ? .3 : 0),
                 text: () => 'Rust-red rock stained by iron oxides, left by water that is long gone.' },
  gypsum:      { name: 'gypsum', kind: 'Mineral crust', shape: 'slab', low: true, colors: ['#ebe5d8', '#cbc2b0'], fit: e => (e.biome === 'Desert' || e.biome === 'Toxic' ? .7 : 0),
                 text: () => 'Soft white mineral left behind when salty water dried away.' },
  ice:         { name: 'water ice', kind: 'Ice', shape: 'ice', colors: ['#e2f2fb', '#a9d2ea'], fit: e => e.ice ? 1.8 : 0,
                 text: e => `Water ice${e.T < 120 ? ', so cold it is as hard as rock' : ''}, the most common solid in the outer system.` },
  sulfur:      { name: 'sulfur crust', kind: 'Mineral crust', shape: 'rubble', low: true, colors: ['#d4bd47', '#9b7a2a'], fit: e => (e.chem === 'sulfur' ? 1.4 : 0) + (e.biome === 'Toxic' ? 1 : 0) + (e.air > .05 ? e.volc * .3 : 0),
                 text: () => 'Yellow crusts of sulfur, deposited where volcanic gases cooled.' },
};

export const FORMATIONS = {
  columns:    { name: 'basalt columns', shape: 'columns', near: 'any', fit: e => e.volc * 1.6 + (e.biome === 'Volcanic' ? 1 : 0),
                text: e => `Six-sided columns of basalt, split as a lava flow cooled slowly.${e.volc > .5 ? ' This world is still volcanically active.' : ''}` },
  fumaroles:  { name: 'fumaroles', shape: 'vent', near: 'any', glow: true, fit: e => e.air > .05 ? e.volc * 1.4 : 0,
                text: e => `Vents breathing hot gas from below; their rims are crusted with ${e.chem === 'sulfur' ? 'sulfur' : 'minerals'}.` },
  hoodoos:    { name: 'hoodoos', shape: 'hoodoos', near: 'high', fit: e => (e.biome === 'Desert' ? 1.6 : 0) + e.dry * e.windy * .8,
                text: () => 'Pillars of soft rock under harder caps, carved by wind and grit over ages.' },
  arch:       { name: 'rock arches', shape: 'arch', near: 'high', fit: e => (e.biome === 'Desert' ? .9 : 0) + e.dry * e.windy * .5,
                text: () => 'Natural arches, worn through rock fins by wind.' },
  penitentes: { name: 'penitentes', shape: 'blades', near: 'high', fit: e => (e.ice ? 1.2 : 0) * (e.air < 2 ? 1 : .3) * (e.T < 250 ? 1 : 0),
                text: () => 'Fields of tall ice blades, sculpted where sunlight turns ice straight to vapour.' },
  pingo:      { name: 'pingos', shape: 'dome', near: 'any', fit: e => (e.ice ? .6 : 0) + (e.subsurface ? 1.2 : 0),
                text: e => `Ice-cored hills pushed up from below${e.subsurface ? ' by the ocean hidden under the crust' : ''}.` },
  cryovolcano:{ name: 'cryovolcanoes', shape: 'vent', near: 'high', glow: true, cold: true, fit: e => (e.ice || e.T < 200) && e.volc > .25 ? 1.6 : 0,
                text: () => 'Ice volcanoes: instead of lava they erupt water, ammonia or methane, which freezes as it falls.' },
  crystals:   { name: 'crystal spires', shape: 'crystals', near: 'any', glow: true, fit: e => (e.biome === 'Amethyst' ? 2 : 0) + (e.chem === 'silicon' ? 1.2 : 0),
                text: () => 'Giant mineral crystals that grew in slowly cooling fluids, now exposed by erosion.' },
  terraces:   { name: 'mineral terraces', shape: 'terraces', near: 'shore', fit: e => (e.biome === 'Toxic' ? 1.4 : 0) + (e.wet && e.volc > .3 ? .8 : 0),
                text: () => 'Stepped pools rimmed with minerals left behind by hot, saturated springs.' },
  chimneys:   { name: 'sulfur chimneys', shape: 'chimneys', near: 'any', glow: true, fit: e => (e.chem === 'sulfur' ? 1.8 : 0) + (e.biome === 'Toxic' ? .9 : 0),
                text: () => 'Hollow chimneys built up by sulfur-rich vents, still warm inside.' },
  karst:      { name: 'karst pinnacles', shape: 'pinnacles', near: 'any', fit: e => e.wet && e.T > 260 && e.T < 330 ? 1.1 : 0,
                text: () => 'Jagged pinnacles of limestone, dissolved into blades by slightly acidic rain.' },
  seastacks:  { name: 'sea stacks', shape: 'stack', near: 'shore', fit: e => e.seas > .3 ? 1.2 : 0,
                text: () => 'Pillars of rock left standing offshore as the coast was eaten back by waves.' },
  geode:      { name: 'geodes', shape: 'geode', near: 'any', glow: true, rare: true, fit: () => .3,
                text: () => 'Hollow stones lined with crystals that grew inside them over millions of years.' },
  meteorite:  { name: 'iron meteorite', shape: 'meteorite', near: 'any', rare: true, fit: e => .22 + (e.air < .05 ? .2 : 0),
                text: () => 'A lump of iron and nickel, the core of a small world shattered long ago.' },
};

function environment(body) {
  const p = body.physics || {};
  return {
    biome: body.biome, T: p.temperature ?? 280, air: p.pressure ?? 0, volc: clamp(p.volcanism ?? 0, 0, 1),
    ice: p.waterState === 'ice' || body.biome === 'Frozen', wet: p.waterState === 'liquid' || (p.solventCoverage ?? 0) > .1,
    seas: p.waterState === 'liquid' ? p.waterCoverage ?? 0 : p.solventCoverage ?? 0, dry: clamp(1 - (p.waterCoverage ?? 0) * 1.6, 0, 1),
    windy: clamp(Math.log10(Math.max(p.pressure ?? 0, 1e-4)) + 1.5, 0, 2) / 2, subsurface: !!p.subsurfaceOcean,
    chem: p.biochemistry || p.solvent || 'carbon', life: !!p.life && p.life !== 'none',
  };
}

// Weighted picks without repeats, by fit.
function pick(table, e, r, want, weight = () => 1) {
  const scored = Object.entries(table).map(([k, f]) => ({ k, f, w: f.fit(e) * weight(f) })).filter(x => x.w > .05), chosen = [];
  while (chosen.length < want && scored.length) {
    let roll = r() * scored.reduce((a, x) => a + x.w, 0), i = 0;
    for (; i < scored.length - 1; i++) { roll -= scored[i].w; if (roll <= 0) break; }
    chosen.push(scored.splice(i, 1)[0]);
  }
  return chosen;
}

const cache = new Map();
// geologyFor(body) -> { formations: [...rocks, ...formations], environment }
// Each: { id ('rock-basalt' / 'geo-columns'), key, type ('rock' | 'formation'), name, description, count, size, … }
export function geologyFor(body) {
  const key = `${body.seed}:${body.id}`;
  if (cache.has(key)) return cache.get(key);
  if (body.giant || !body.physics) { cache.set(key, { formations: [] }); return cache.get(key); }
  const e = environment(body), gravityScale = clamp(1 / Math.sqrt(Math.max(body.physics.gravity, .1)), .8, 1.6);
  const rr = rng(body.seed, 'rocks');
  const rocks = pick(ROCKS, e, rr, 2 + (rr() < .45 ? 1 : 0)).map(({ k, f }) => ({
    id: `rock-${k}`, key: k, type: 'rock', shape: f.shape, near: 'any', glow: false, cold: f.shape === 'ice', rare: false, glassy: !!f.glassy, low: !!f.low,
    colors: f.colors, rockKind: f.kind,
    name: f.name[0].toUpperCase() + f.name.slice(1), description: f.text(e),
    count: 7 + Math.floor(rr() * 7), size: (.8 + rr() * .5) * gravityScale,
  }));
  // Landforms are less common: about 2 worlds in 5 have one, a few have two.
  const r = rng(body.seed, 'geology');
  const want = r() < .4 ? (r() < .25 ? 2 : 1) : 0;
  const landforms = pick(FORMATIONS, e, r, want, f => (f.rare ? .35 : 1)).map(({ k, f }) => ({
    id: `geo-${k}`, key: k, type: 'formation', shape: f.shape, near: f.near, glow: !!f.glow, cold: !!f.cold, rare: !!f.rare,
    name: f.name[0].toUpperCase() + f.name.slice(1), description: f.text(e),
    count: f.rare ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 4),
    size: (.8 + r() * .7) * gravityScale, // weak gravity, taller rock
  }));
  const out = { formations: [...rocks, ...landforms], environment: e };
  if (cache.size > 2000) cache.clear();
  cache.set(key, out);
  return out;
}

// Deep core sampler: a second, deeper reading of a rock or landform you have recorded.
// coreSample(body, formation) -> { age (billion years), ageText, depth (m), origin }
// Ages are bounded by the star's: lava, ice, crusts and active vents are young; the rest is old crust.
const YOUNG = new Set(['columns', 'fumaroles', 'cryovolcano', 'chimneys', 'terraces', 'penitentes', 'pingo']);
const ORIGIN = {
  Igneous: 'Interlocking crystals in the core show it cooled from molten rock',
  Sedimentary: 'The core is layer on layer of fine grains, each a season or an age of settling',
  'Impact rock': 'Shocked grains and melted glass in the core record the collision that made it',
  'Mineral crust': 'Banded deposits in the core show it grew a film at a time from evaporating fluids',
  Ice: 'Bubbles trapped in the ice keep samples of the air and vapour from when it froze',
};
export function coreSample(body, f) {
  const r = rng(body.seed, 'core', f.id), starAge = body.starAge ?? 4.5;
  const young = f.type === 'rock' ? /volcanic|Ice|crust/.test(f.rockKind || '') : YOUNG.has(f.key);
  const age = young ? starAge * (0.0004 + r() * 0.02) : f.key === 'meteorite' ? starAge * (0.97 + r() * 0.03) : starAge * (0.3 + r() * 0.6);
  const ageText = age < 0.001 ? `about ${Math.max(1, Math.round(age * 1e6))} thousand years` : age < 1 ? `about ${Math.round(age * 1000)} million years` : `about ${age.toFixed(1)} billion years`;
  const cat = f.type === 'rock' ? Object.keys(ORIGIN).find((k) => (f.rockKind || '').startsWith(k)) : null;
  const how = cat ? ORIGIN[cat] : f.key === 'meteorite' ? 'Its metal crystals grew over millions of years as a small world\'s core cooled, before it shattered' : 'Layers in the core trace how it formed';
  return { age, ageText, depth: Math.round(4 + r() * (f.type === 'rock' ? 30 : 60)), origin: `${how}, ${ageText} ago.` };
}
