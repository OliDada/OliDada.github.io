// Growth plans for the smaller plants (new plant style): each species of shrub,
// succulent, fungus, stalk, bulb, sheet, filament, chimney and plume grows to one of
// several plans, picked from its own random stream, so two worlds' shrubs (or two
// shrubs of one world) can be quite different plants: a fountain of arching stems,
// a tiered bush, a thicket of switches, a low cushion... The builders are in
// flora-understory.js; 'classic' is the original model (flora-mesh.js), kept as one
// plan among the others. Plans also add a phrase to the species' description.
import { rng } from './rng.mjs';

export const PLANS = {
  shrub: { classic: 1, spray: 1.2, tiered: 1, thicket: 1, cushion: 1, broom: 1 },
  succulent: { classic: 1, rosette: 1.3, barrel: 1, paddles: 1, pebbles: .8, tubes: 1 },
  fungus: { classic: 1, cluster: 1.2, brackets: 1, coral: 1, puffballs: 1, morel: .9 },
  stalk: { classic: 1, reeds: 1.2, giantflower: 1, horsetail: 1, bamboo: 1 },
  bulb: { classic: 1, pitchers: 1, balloons: 1, gourds: 1, lanterns: 1 },
  sheet: { classic: 1, frills: 1, fans: 1 },
  filament: { classic: 1, arches: 1, tassels: 1 },
  chimney: { classic: 1, pipes: 1, stacked: 1 },
  plume: { classic: 1, feathers: 1, pompom: 1 },
  // Under water.
  kelp: { classic: 1, ribbon: 1.2, giant: 1, bushy: 1 },
  seagrass: { classic: 1, eelgrass: 1.2, paddlegrass: 1, tufts: .8 },
  coral: { classic: 1, brain: 1, table: 1, pillar: .8, staghorn: 1, cups: .8 },
  fan: { classic: 1, plates: 1, whips: 1 },
  anemone: { classic: 1, tube: 1, carpet: 1, crowd: 1 },
  bladder: { classic: 1, grapes: 1, chains: 1 },
  reefmound: { classic: 1, columns: 1, terraces: 1 },
};

const TEXT = {
  spray: 'Its stems arch out in a fountain, leafy at the tips', tiered: 'It grows in flat tiers of leaves', thicket: 'It sends up a thicket of slender switches',
  cushion: 'It hugs the ground in a wide cushion', broom: 'Its stems fan upward like a broom',
  rosette: 'Thick pointed leaves stand in a rosette', barrel: 'A fat ribbed barrel', paddles: 'It grows in chains of flat paddles', pebbles: 'Its swollen leaves look like pebbles', tubes: 'A clump of upright tubes',
  cluster: 'It fruits in crowded clusters', brackets: 'Shelves of it grow from old wood', coral: 'It branches like coral', puffballs: 'It swells into round puffballs', morel: 'Its tall caps are pitted like honeycomb',
  reeds: 'It grows in reed beds', giantflower: 'A tall stem carries one great flower head', horsetail: 'Whorls of needles ring its jointed stem', bamboo: 'Jointed canes, leafy at the top',
  pitchers: 'Its bulbs open into pitchers', balloons: 'Its bulbs float on threads', gourds: 'Swollen segments stack up like domes', lanterns: 'Bulbs hang from arching stems like lanterns',
  frills: 'Ruffled frills, layer on layer', fans: 'Flat fans spread from the ground',
  arches: 'Its threads bow over in arches', tassels: 'Tassels hang along its thread',
  pipes: 'A cluster of pipes of different heights', stacked: 'Its column is stacked in swollen rings',
  feathers: 'Feathery fronds', pompom: 'A round pompom on a stalk',
  ribbon: 'Long wavy ribbons stream up from its holdfast', giant: 'A tall stipe spreads a canopy of blades near the surface', bushy: 'A bush of short, frilled fronds',
  eelgrass: 'Long thin ribbons sway in meadows', paddlegrass: 'Short oval paddles in pairs', tufts: 'Stiff spiky tufts',
  brain: 'A rounded dome grooved like a brain', table: 'A flat table on a short stem', pillar: 'Upright pillars', staghorn: 'Flattened branches like antlers', cups: 'Stacked cups and saucers',
  plates: 'Wavy plates, one above another', whips: 'Tall bare whips',
  tube: 'A tall tube crowned with tentacles', carpet: 'A wide carpet of short tentacles', crowd: 'They crowd together by the dozen',
  grapes: 'Bladders packed like grapes', chains: 'Chains of bladders arch over',
  columns: 'Layered stone columns', terraces: 'Stepped stone terraces',
};

// Plans that only suit small plants: big, they turn into smooth boulder-like blobs.
const MAX_H = { pebbles: 1.2, puffballs: 1.2, barrel: 2.5, gourds: 3, balloons: 4, cushion: 2.5 };
// The plan for a species (null for forms without plans).
export function planFor(sp) {
  const table = PLANS[sp.form];
  if (!table) return null;
  const fits = Object.entries(table).filter(([k]) => !(sp.height > (MAX_H[k] ?? Infinity)));
  const r = rng(sp.seed, 'understory-plan'), total = fits.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [k, w] of fits) if ((x -= w) <= 0) return k;
  return 'classic';
}
export const planText = (plan) => TEXT[plan] || '';
