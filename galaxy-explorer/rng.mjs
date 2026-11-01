// Hash-based randomness: any object can be generated from its own key path
// (e.g. rng(seed, 'planet', 3)) without generating anything else first.
// Adding a new trait to one object never reshuffles other objects.
function stringHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
export function hash32(...keys) {
  let h = 0x9e3779b9;
  for (const key of keys) {
    const k = typeof key === 'string' ? stringHash(key) : Math.floor(key) >>> 0;
    h = Math.imul(h ^ k, 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  }
  return h >>> 0;
}
// mulberry32 stream seeded from a key path, with a few convenience helpers.
export function rng(...keys) {
  let state = hash32(...keys);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (min, max) => min + (max - min) * next();
  next.log = (min, max) => min * Math.pow(max / min, next()); // log-uniform: small values as common as large
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.chance = (p) => next() < p;
  return next;
}
