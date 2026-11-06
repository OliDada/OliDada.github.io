// How big worlds are. Systems are still compressed (real distances would leave
// every world a dot), but sizes now keep realistic ratios between moons, rocky
// planets, giants and stars, and the whole set is scaled up against the ship.
//
// SIZE multiplies every world, moon, giant and star (and the orbits that make room
// for them). 1 is the original compact scale (an Earth-sized world about 580 m in
// radius); the default makes worlds four times bigger. Try ?size=10 in the URL to
// see what truly enormous worlds feel like (1 to 20). The choice is remembered (jumps
// reload the page without it) until another ?size= is given.
const DEFAULT_SIZE = 4, KEY = 'elsewhere-size';
const valid = (v) => Number.isFinite(v) && v >= 1 && v <= 20;
function chosenSize() {
  try {
    const p = new URLSearchParams((globalThis.location?.search || '').replace(/(?!^)\?/g, '&')).get('size');
    if (p !== null && valid(Number(p))) { try { globalThis.localStorage?.setItem(KEY, p); } catch {} return Number(p); }
    const saved = Number(globalThis.localStorage?.getItem(KEY));
    return valid(saved) ? saved : DEFAULT_SIZE;
  } catch { return DEFAULT_SIZE; }
}
export const SIZE = chosenSize();
// Game metres in one Earth radius. Giants and stars are measured from this, so they
// keep their real proportions to rocky worlds (a Jupiter is eleven Earths across).
export const EARTH = 580 * SIZE;
// A real Sun is 109 Earth radii across and would swallow the inner orbits, so stars
// are drawn at 40 Earth radii per square root of their real (solar) radius: a red
// dwarf is a little bigger than a Jupiter, a Sun-like star 40 Earths, an A star 54.
export const STAR_EARTHS = 40;
// A star's game radius from its radius in solar radii (deep-space.js and system.mjs agree).
export const starGameRadius = (physics) => Math.round(EARTH * STAR_EARTHS * Math.sqrt(physics.radius));
// The camera's far plane and the sky sphere: well beyond the farthest orbit.
export const VIEW_RANGE = 2.5e6 * Math.max(1, SIZE / 4);
