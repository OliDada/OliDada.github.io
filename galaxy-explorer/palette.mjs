// A world's colour key: a few hues that its life shares, so the plants, animals and
// (through the animals, structures-mesh.js colours()) the buildings of one world look
// like they belong together, and different worlds look different from each other.
//
// The key is anchored on the world's own ground and vegetation colour (biomes.mjs
// palette) and built with one colour-harmony scheme picked per world: analogous
// (neighbouring hues), complementary, split-complementary or triadic. Generators still
// roll their hues as before (no extra random numbers are drawn from their streams, so
// nothing else about a species changes); harmonize() then pulls each rolled hue part
// of the way toward the nearest hue of the key. A bit of the original roll is always
// kept, so species still differ from each other.
import { rng } from './rng.mjs';

const SCHEMES = {
  analogous: [0, 35],
  complementary: [0, 180],
  split: [0, 150, 210],
  triadic: [0, 120, 240],
};

export const hueOf = (hex) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 30;
  return (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
};

const keys = new Map();
// body: needs seed and palette (biomes.mjs worldLook). Returns { scheme, hues }.
export function worldKey(body) {
  const id = `${body.seed}`;
  if (keys.has(id)) return keys.get(id);
  const r = rng(body.seed, 'colour-key'); // a stream of its own
  const anchor = hueOf(body.palette?.[1] || body.palette?.[0] || '#6b8a4a');
  const scheme = r.pick(['analogous', 'analogous', 'complementary', 'complementary', 'split', 'triadic']); // tighter schemes more often
  const turn = r.range(-25, 25); // the scheme is turned a little, so not every key starts on the ground's hue
  const key = {
    scheme, hues: SCHEMES[scheme].map((o, i) => (((anchor + turn * (i ? 1 : .3) + o + r.range(-6, 6)) % 360) + 360) % 360),
    vivid: r.range(.42, .74), // the most saturated any colour of its life gets: some worlds are muted, some bold
  };
  keys.set(id, key);
  return key;
}

const wrap = (d) => ((d % 360) + 540) % 360 - 180; // signed hue difference, -180..180
// Pulls a hue toward the nearest hue of the key. pull: 0 leaves it, 1 snaps it.
// Returns the result in 0..360.
export function harmonize(hue, key, pull = .65) {
  if (!key) return hue;
  let bd = 1e9;
  for (const h of key.hues) { const d = wrap(h - hue); if (Math.abs(d) < Math.abs(bd)) bd = d; }
  return (((hue + bd * pull) % 360) + 360) % 360;
}

// The world's saturation ceiling for a colour (hex in, hex out); hue and lightness kept.
// extra: allowance above the ceiling (warning colours get some).
export function tame(hex, key, extra = 0) {
  const vivid = key ? Math.min(1, key.vivid + extra) : 1;
  if (!key || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return hex;
  const s = d / (1 - Math.abs(2 * l - 1));
  if (s <= vivid) return hex;
  // Scale each channel's distance from grey: same hue and lightness, lower saturation.
  const k = vivid / s;
  return '#' + [r, g, b].map(v => Math.round(Math.min(1, Math.max(0, l + (v - l) * k)) * 255).toString(16).padStart(2, '0')).join('');
}

// A colour with its saturation and lightness scaled (hue kept): hex in, hex out.
export function muted(hex, sat = 1, light = 1) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const L = Math.min(1, l * light);
  if (!d) return '#' + [L, L, L].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  const S = Math.min(1, d / (1 - Math.abs(2 * l - 1)) * sat), h = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = L - c / 2;
  const [R, G, B] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [R, G, B].map(v => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0')).join('');
}
