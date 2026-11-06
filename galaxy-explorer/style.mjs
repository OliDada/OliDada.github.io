// Which generation of the world's look to use, for comparing the new with the old.
// Each switch is remembered in this browser until switched back, like look.js's.
//   ?land=classic    the original, gentler terrain and ocean coverage   ?land=new    (default)
//   ?plants=classic  the original plant models and spacing              ?plants=new  (default)
// Safe outside a browser (tests, workers): there the defaults apply. Terrain is built in
// background threads too, so the land style travels with each body (system.mjs sets
// body.landStyle) rather than being read again there.
const params = new URLSearchParams((globalThis.location?.search ?? '').replace(/(?!^)\?/g, '&'));
function setting(name, key, fallback) {
  const v = params.get(name);
  try {
    if (!globalThis.localStorage) return v ?? fallback;
    if (v !== null) localStorage.setItem(key, v);
    return localStorage.getItem(key) ?? fallback;
  } catch { return v ?? fallback; }
}
// (Outside a browser, ELSEWHERE_LAND=classic / ELSEWHERE_PLANTS=classic do the same, for tests.)
const env = globalThis.process?.env ?? {};
export const LAND_STYLE = (env.ELSEWHERE_LAND || setting('land', 'elsewhere-land', 'new')) === 'classic' ? 'classic' : 'new';
export const PLANT_STYLE = (env.ELSEWHERE_PLANTS || setting('plants', 'elsewhere-plants', 'new')) === 'classic' ? 'classic' : 'new';
