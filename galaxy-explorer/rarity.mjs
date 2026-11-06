// Rarity: how unusual a recorded thing is, from the traits copied into its codex entry
// (codex.mjs), so it needs nothing regenerated and is the same everywhere it is read:
// the codex overview (codex-ui.js), the scan card, contact (rare things are worth more
// to other minds) and the upgrade line (tasks can ask for rare finds).
//
// Five grades, each roughly a fraction of everything there is to find (calibrated by
// rarity.test.mjs against the galaxy):
//   common ~65% · uncommon ~21% · rare ~11% · exceptional ~2% · legendary ~1%
// Names, never numbers: an entry's grade is a name, and tasks ask for { atLeast: 'rare' }.
export const RARITIES = ['common', 'uncommon', 'rare', 'exceptional', 'legendary'];
export const rarityAtLeast = (a, b) => RARITIES.indexOf(a) >= RARITIES.indexOf(b);
export const RARITY_COLOURS = { common: '#9bafac', uncommon: '#8fe0a4', rare: '#7fc3ff', exceptional: '#c79bff', legendary: '#ffd36b' };

const EXOTIC_FLORA = ['crystal', 'glasstree', 'chimney', 'plume', 'bulb', 'sheet', 'filament', 'crust'];
const ALIEN_FORMS = ['centipede', 'tower', 'dome', 'skywhale', 'siphon', 'leviathan', 'squid', 'wheel'];
const PLAN_SCORE = { floater: 2, roller: 2, radial: 1.5, slug: .8, serpent: .5, arachnid: .5, flyer: .4, hexapod: .3 };
const TIER_SCORE = { 'tool users': 0, 'village builders': .6, metalworkers: 1, 'city builders': 1.4, industrial: 1.8, 'planet-shapers': 2.4, orbital: 2.8, spacefarers: 3.2, 'system-shapers': 4.2 };
const chem = (w) => (w?.biochemistry === 'silicon' ? 2.4 : w?.biochemistry && !['water', 'carbon'].includes(w.biochemistry) ? 1.4 : 0);

// The score behind the grade (higher is rarer).
export function rarityScore(e) {
  const t = e.traits || {}, w = e.world || {};
  switch (e.kind) {
    case 'fauna': return (PLAN_SCORE[t.plan] || 0) + (ALIEN_FORMS.includes(t.form) ? 1.4 : 0) + (t.glow > .4 ? 1 : 0) + chem(w)
      + (t.stalksYou ? 1 : 0) + (t.mind === 'clever' ? 1.6 : t.mind === 'cunning' ? .7 : 0) + (t.air && t.land ? .3 : 0) + (t.sea ? .4 : 0);
    case 'flora': return (EXOTIC_FLORA.includes(t.form) ? 1.8 : 0) + (t.glow > .45 ? 1.2 : 0) + (t.aquatic ? .6 : 0) + chem(w) + (t.form === 'mat' || t.form === 'mound' ? -.5 : 0);
    case 'formation': return t.rare ? 4.5 : (t.type === 'rock' ? .2 : 1.3) + (w.volcanism > .6 ? .3 : 0);
    case 'core': return t.rare ? 4.5 : 1.2;
    case 'behaviour': return ({ kill: 3.2, defend: 3.4, hunt: 2.1, sleep: .4, drink: .9, graze: 0 })[t.behaviour] ?? .5;
    case 'phenomenon': return t.type === 'eclipse' ? (t.total ? 4.4 : 2.3) : t.type === 'aurora' ? 1.6 : 1.3;
    case 'settlement': return TIER_SCORE[t.tier] ?? 0;
    case 'station': return 3.2 + (t.tier === 'system-shapers' ? 1 : 0);
    case 'signal': return t.tier === 'system-shapers' ? 3.6 : t.tier === 'spacefarers' ? 2.6 : 1.6;
    case 'world': return (w.life === 'complex' ? 1.4 : w.life === 'simple' ? .6 : 0) + chem(w) + (w.biome === 'Amethyst' ? 2 : w.biome === 'Toxic' ? .4 : 0) + (w.ringed ? .8 : 0) + (w.subsurfaceOcean ? .6 : 0);
    case 'field-note': return .3;
  }
  return 0;
}
const CUTS = [1, 2, 3, 4]; // score at which each grade above common begins
export function rarityOf(e) {
  const s = rarityScore(e);
  let i = 0;
  while (i < CUTS.length && s >= CUTS[i]) i++;
  return RARITIES[i];
}
// What a grade is worth to another civilization in a trade (contact.mjs), on top of the rest.
export const RARITY_VALUE = { common: 0, uncommon: .05, rare: .15, exceptional: .25, legendary: .35 };
