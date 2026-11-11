// What walls are made of.
//
// Buildings are flat-coloured shapes. This file adds, in the shader, what makes them
// read as built things rather than plastic: mottled tone, courses of stone or plank
// up every wall (by the builders' material), stains running down, weathered roofs,
// and slightly quieter colour so towns sit in the world's light.
//
// It costs a few noise lookups per pixel of building. Switch it off with ?walls=0.
// The low quality tier never has it.
import { WALLS, Q } from './quality.mjs';

export const WALL_FEEL = WALLS && !Q.lite;

// By material: [height of one course in metres (0: none), how strongly courses show, stains, mottle].
const FEEL = {
  stone: [.5, 1, .8, 1], wood: [.3, 1, .6, .9], shell: [.4, .5, 1, 1], living: [.35, .7, .8, 1.1], adobe: [0, 0, 1.2, 1.2],
  ice: [.8, .35, .3, .6], glass: [0, 0, .3, .5], grown: [.6, .3, .8, 1], silk: [0, 0, .5, .7], wax: [.25, .35, .7, .9], membrane: [0, 0, .5, .7],
};

// material: a MeshStandardMaterial. kind: the builders' material (civilizations.mjs).
// local: true where the model stands at the origin with y up (review sheet); otherwise
// positions are in the planet's frame, where up is away from its centre.
export function addWallFeel(THREE, material, kind, { local = false, radius = 1000 } = {}) {
  if (!WALL_FEEL) return material;
  const f = FEEL[kind] || FEEL.stone, feel = { value: new THREE.Vector4(f[0] || 1, f[0] ? f[1] : 0, f[2], f[3]) }, feelR = { value: radius };
  const before = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = (sh, renderer) => {
    before.call(material, sh, renderer);
    Object.assign(sh.uniforms, { uFeel: feel, uFeelR: feelR });
    sh.vertexShader = 'attribute float aPlain; varying float vFeelOn; varying vec3 vFeelP; varying vec3 vFeelUp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vFeelP = position; vFeelOn = 1.0 - aPlain;
  vFeelUp = normalize(normalMatrix * ${local ? 'vec3(0.0, 1.0, 0.0)' : 'normalize(position)'});`);
    sh.fragmentShader = `varying float vFeelOn; varying vec3 vFeelP; varying vec3 vFeelUp; uniform vec4 uFeel; uniform float uFeelR;
float feelH(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float feelN(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(feelH(i), feelH(i + vec3(1, 0, 0)), f.x), mix(feelH(i + vec3(0, 1, 0)), feelH(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(feelH(i + vec3(0, 0, 1)), feelH(i + vec3(1, 0, 1)), f.x), mix(feelH(i + vec3(0, 1, 1)), feelH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
` + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 wp = vFeelP;
    float wh = ${local ? 'wp.y' : 'length(wp)'};
    vec3 across = ${local ? 'vec3(wp.x, 0.0, wp.z)' : 'normalize(wp) * uFeelR'};
    float wall = 1.0 - smoothstep(.35, .7, abs(dot(normal, normalize(vFeelUp))));
    float m1 = feelN(wp * .9), m2 = feelN(wp * 4.3), m3 = feelN(wp * 17.0);
    float tone = ((m1 - .5) * .24 + (m2 - .5) * .16 + (m3 - .5) * .09) * uFeel.w;
    float c = wh / uFeel.x, cf = fract(c), ci = floor(c);
    float joint = 1.0 - smoothstep(0.0, .07, cf) * smoothstep(1.0, .93, cf);
    float board = feelN(across * 1.1 + ci * 7.31) - .5;
    tone += wall * uFeel.y * (board * .3 - joint * .3) * vFeelOn;
    float streak = feelN(across * 5.0) * .65 + feelN(across * 13.0) * .35;
    tone -= wall * uFeel.z * smoothstep(.5, .85, streak) * .16;
    tone += (1.0 - wall) * (m2 - .5) * .14;
    // Tops weather darker and undersides sit in their own shade, so round shapes have form.
    float facing = dot(normal, normalize(vFeelUp));
    tone -= smoothstep(.3, .9, facing) * .13 + smoothstep(.1, .8, -facing) * .3;
    float lum = dot(diffuseColor.rgb, vec3(.3, .59, .11));
    diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, .84);
    diffuseColor.rgb *= mix(vec3(1.05, 1.0, .94), vec3(.94, 1.0, 1.06), m1) * (1.0 + tone);
    roughnessFactor = clamp(roughnessFactor + tone * .6, .35, 1.0);
  }`);
  };
  material.customProgramCacheKey = () => key + '|feel' + (local ? 'L' : 'P');
  return material;
}
