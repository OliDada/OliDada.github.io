// Quality tiers, and the switches used when surveying how the game looks and runs.
//
// One tier is chosen when the page loads, and every system that can trade looks for
// speed reads its numbers from Q instead of deciding for itself:
//   low     phones and tablets (a coarse pointer): the lighter path the game already
//           had for them (short view distances, small shadow map, simpler shaders)
//   medium  laptops (the default elsewhere): the full look with a tighter plant budget,
//           tuned to hold 60 frames a second in the densest forest on a MacBook Air
//   high    the widest views and the biggest budgets, for strong graphics cards
//
// URL switches, in the style of look.js (remembered in this browser until switched back):
//   ?quality=low | medium | high   force a tier       ?quality=auto   choose automatically
// Survey switches (not remembered: they apply only while they are in the address):
//   ?time=noon | dawn | morning | golden | dusk | night, or an hour from 0 to 24
//                the time of day at the landing site when the page loads (see solarShift
//                in game.js); screenshots of one spot can then be compared like for like
//   ?hud=0       hide the HUD, the header and the hints, for clean screenshots
//   ?spot        begin on foot beside the ship, parked on the world's landing pad and
//                facing the signal; ?spot=40 stands 40 m on toward the signal. The same
//                place and view every time, so numbers and screenshots can be compared.
const params = new URLSearchParams((globalThis.location?.search ?? '').replace(/(?!^)\?/g, '&'));
function setting(name, key, fallback) {
  const v = params.get(name);
  try {
    if (!globalThis.localStorage) return v ?? fallback;
    if (v !== null) localStorage.setItem(key, v);
    return localStorage.getItem(key) ?? fallback;
  } catch { return v ?? fallback; }
}
const coarsePointer = !!globalThis.matchMedia?.('(pointer: coarse)').matches;
const asked = setting('quality', 'elsewhere-quality', 'auto');
// ?ground=0: no broad light and dark patches on the land (planet-lod.js); ?ground=1 brings them back.
export const GROUND_PATCHES = setting('ground', 'elsewhere-ground', '1') !== '0';
export const TIER = ['low', 'medium', 'high'].includes(asked) ? asked : coarsePointer ? 'low' : 'medium';
export const TIER_AUTO = !['low', 'medium', 'high'].includes(asked);

// What each tier changes. Shares are of the full (high) budget.
//   lite        take the phone path wherever the code asks "coarse?" (shaders, reach, caps)
//   plants      share of the small plants' triangle budget and count (flora-mesh.js)
//   trees       share of the trees' triangle budget (flora-mesh.js)
//   plantReach  metres out to which small plants are filled and drawn (thinning with distance)
//   treeReach   metres out to which trees are filled and drawn
//   nearTree    metres within which a tree uses its full model (and casts a shadow)
//   leafEvery   the distant tree model keeps every n-th leaf card, grown to cover the gaps
//   cover       share of the grass, fern, moss and pebble counts (groundcover.js)
//   coverReach  metres of ground cover around you
//   shadowMap   shadow map size in texels; shadowHalf: half the width of the shadow box, metres
//   shadowEvery the shadow map is redrawn once in this many frames
//   shadowHeight plants shorter than this many metres cast no shadow (flora-mesh.js)
//   ratio       the most device pixels drawn per CSS pixel
const TIERS = {
  low: { lite: true, plants: 1, trees: 1, plantReach: 220, treeReach: 420, nearTree: 30, leafEvery: 3, cover: 1, coverReach: 32, shadowMap: 1024, shadowHalf: 42, shadowEvery: 2, shadowHeight: 1.2, ratio: 1.8 },
  medium: { lite: false, plants: .65, trees: .6, plantReach: 430, treeReach: 720, nearTree: 38, leafEvery: 4, cover: .75, coverReach: 50, shadowMap: 2048, shadowHalf: 60, shadowEvery: 3, shadowHeight: 2.5, ratio: 1.8 },
  high: { lite: false, plants: 1, trees: 1, plantReach: 480, treeReach: 720, nearTree: 45, leafEvery: 3, cover: 1, coverReach: 58, shadowMap: 2048, shadowHalf: 70, shadowEvery: 2, shadowHeight: 1.2, ratio: 1.8 },
};
export const Q = TIERS[TIER];

// ?time= as an hour of the local day (12 is the star at its highest), or null.
const HOURS = { night: 0, midnight: 0, dawn: 6.2, sunrise: 6.2, morning: 8.5, noon: 12, day: 12, afternoon: 15, golden: 17.2, dusk: 18, sunset: 18, evening: 18.6 };
const t = params.get('time');
export const TIME_OF_DAY = t === null || t === '' ? null : t in HOURS ? HOURS[t] : Number.isFinite(Number(t)) ? ((Number(t) % 24) + 24) % 24 : null;
export const HIDE_HUD = params.get('hud') === '0';
const spot = params.get('spot');
export const SPOT = spot === null ? null : Math.max(0, Math.min(400, Number(spot) || 0));
