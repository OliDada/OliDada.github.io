// What stations and arks are made of.
//
// Their hulls are huge smooth shapes of one colour, which gives no sense of size. This
// file draws, in the shader, what makes a hull read as built and big: plating in two
// sizes, each plate a little different in tone, seams between them, streaks of wear,
// and (on arks) thousands of small lit windows, in rows.
//
// It costs a few lookups per pixel of hull. Switch it off with ?hulls=0. The low
// quality tier never has it.
import { HULLS, Q } from './quality.mjs';

export const HULL_FEEL = HULLS && !Q.lite;

// material: a MeshStandardMaterial. plate: the size of one hull plate in metres.
// windows: 0 (none) to 1, and window: the size of one window bay in metres.
export function addHullFeel(THREE, material, { plate = 3, windows = 0, window = 8, colour = '#ffd9a0' } = {}) {
  if (!HULL_FEEL) return material;
  const u = { value: new THREE.Vector3(plate, windows, window) }, wc = { value: new THREE.Color(colour) };
  const before = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = (sh, renderer) => {
    before.call(material, sh, renderer);
    Object.assign(sh.uniforms, { uHull: u, uHullWin: wc });
    sh.vertexShader = 'varying vec3 vHullP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vHullP = position;');
    sh.fragmentShader = `varying vec3 vHullP; uniform vec3 uHull; uniform vec3 uHullWin;
float hullH(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float hullN(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hullH(i), hullH(i + vec3(1, 0, 0)), f.x), mix(hullH(i + vec3(0, 1, 0)), hullH(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hullH(i + vec3(0, 0, 1)), hullH(i + vec3(1, 0, 1)), f.x), mix(hullH(i + vec3(0, 1, 1)), hullH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float hullWinLight = 0.0;
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 gn = abs(normalize(cross(dFdx(vHullP), dFdy(vHullP))));
    vec3 hp = vHullP / uHull.x + .37, w = fwidth(hp);
    float small = max(w.x, max(w.y, w.z));
    vec3 e = min(fract(hp), 1.0 - fract(hp));
    vec3 l = (1.0 - smoothstep(vec3(0.0), w * 1.2 + .012, e)) * step(gn, vec3(.8));
    float seam = max(l.x, max(l.y, l.z)) * (1.0 - smoothstep(.2, .5, small));
    float tone = (hullH(floor(hp)) - .5) * .16 * (1.0 - smoothstep(.3, .8, small)) + (hullH(floor(hp * .25 + .2) + 7.0) - .5) * .14;
    float wear = hullN(vHullP / uHull.x * vec3(.35, 2.2, .35)) * .6 + hullN(vHullP / uHull.x * .6) * .4;
    diffuseColor.rgb *= (1.0 - .3 * seam) * (1.0 + tone) * (.9 + .16 * wear);
    if (uHull.y > 0.0) {
      vec3 q = vHullP / uHull.z;
      vec2 uv = gn.x > gn.y && gn.x > gn.z ? q.zy : gn.y > gn.z ? q.xz : q.xy;
      vec2 fw = fwidth(uv), f = fract(uv), id = floor(uv);
      float lit = step(.84, hullH(vec3(id, 3.0))) * step(.45, hullH(vec3(floor(id / vec2(6.0, 2.0)), 9.0)) + .25);
      float box = smoothstep(.18, .22, f.x) * smoothstep(.82, .78, f.x) * smoothstep(.34, .38, f.y) * smoothstep(.66, .62, f.y);
      float far = smoothstep(.35, 1.2, max(fw.x, fw.y));
      hullWinLight = uHull.y * lit * mix(box, .07, far);
    }
  }`).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uHullWin * hullWinLight * 1.3;');
  };
  material.customProgramCacheKey = () => key + '|hull';
  return material;
}
