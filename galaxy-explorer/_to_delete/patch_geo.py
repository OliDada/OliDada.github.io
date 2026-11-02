import sys
p = sys.argv[1] + "/geology.mjs"
s = open(p).read()

def cut(start, end_marker):
    global s
    i = s.index(start); j = s.index(end_marker, i) + len(end_marker)
    s = s[:i] + s[j:]

# Natural rock now covers what these did (obsidian, boulders, layered outcrops).
cut("  obsidian:   {", "},\n")
cut("  boulders:   {", "},\n")
cut("  strata:     {", "},\n")

s = s.replace("""// Geology: rock and ice formations to find and record on any world with a surface,
// so worlds without life still have something to discover. Pure data; geology-mesh.js
// builds and places them. Each world gets 2–4 kinds, chosen from its physics:
// volcanism, temperature, air, water, chemistry and biome. A few (iron meteorites,
// geodes) are rare anywhere. Draws come from their own key path, so nothing else changes.""",
"""// Geology to find and record on any world with a surface, so worlds without life
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
// Draws come from their own key paths, so nothing else changes.""")

s = s.replace("export const FORMATIONS = {", """// Rock types. kind: what sort of rock it is (shown on its card); shape: how
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
                 text: () => 'Pale highland rock that floated to the top of this world\\'s ancient magma ocean.' },
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

export const FORMATIONS = {""")

s = s.replace("chem: p.biochemistry || p.solvent || 'carbon',\n  };",
              "chem: p.biochemistry || p.solvent || 'carbon', life: !!p.life && p.life !== 'none',\n  };")

start = s.index("const cache = new Map();\nexport function geologyFor(body) {")
s = s[:start] + """// Weighted picks without repeats, by fit.
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
"""
open(p, "w").write(s)
print("ok")
