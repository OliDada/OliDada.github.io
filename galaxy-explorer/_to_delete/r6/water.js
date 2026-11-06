// Seas, lakes and rivers (new look): water you can read the land through. Its colour
// comes from how deep it is (terrain tiles carry the depth of water over each point,
// chunk-build.mjs): pale and clear over the shallows, so the shore shows through, and
// dark far out. A band of foam breathes in and out along every shore, small waves move
// over the surface (they fade with distance, so far water stays calm instead of
// glittering), and at a glancing angle the water reflects the sky's own colour.
//
// addWaterLook(THREE, material, { color, ground }) adds this to the sea's material on
// top of its terrain morphing (planet-lod.js) and returns its uniforms; game.js sets
// WATER.time and WATER.sky each frame (shared by every world's water). Lava keeps its own look.
export const WATER = { time: { value: 0 }, sky: { value: null } };
export function addWaterLook(THREE, material, { color, ground }) {
  const base = new THREE.Color(color), sand = new THREE.Color(ground || '#b8a582');
  if (!WATER.sky.value) WATER.sky.value = new THREE.Color('#9fb8c8');
  const uniforms = {
    uWTime: WATER.time,
    uWSky: WATER.sky,
    // Shallows: the water's colour, lighter, with a little of the bed showing through.
    uWShallow: { value: base.clone().multiplyScalar(1.7).addScalar(.04).lerp(sand, .22) },
    uWDeep: { value: base.clone().multiplyScalar(.38) },
    uWFoam: { value: new THREE.Color('#e9efef').lerp(base, .08) },
  };
  material.userData.water = uniforms;
  const inner = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    inner?.(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute float waterDepth;\nvarying float vWDepth;\nvarying vec3 vWPos;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vWDepth = waterDepth;`).replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = `uniform float uWTime; uniform vec3 uWSky, uWShallow, uWDeep, uWFoam;
varying float vWDepth; varying vec3 vWPos;
float wHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wHash(i), wHash(i + vec3(1, 0, 0)), f.x), mix(wHash(i + vec3(0, 1, 0)), wHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(wHash(i + vec3(0, 0, 1)), wHash(i + vec3(1, 0, 1)), f.x), mix(wHash(i + vec3(0, 1, 1)), wHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
` + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
      float wDep = max(vWDepth, 0.0);
      diffuseColor.rgb = mix(uWShallow, uWDeep, 1.0 - exp(-wDep / 7.0));
      diffuseColor.a = mix(0.42, 0.95, 1.0 - exp(-wDep / 2.2));
      // Shore foam: a band that swells and ebbs, broken up into patches.
      float wSwell = 0.5 + 0.5 * sin(uWTime * 0.8 + dot(vWPos, vec3(0.31, 0.23, 0.27)) + 2.0 * wNoise(vWPos * 0.05));
      float wEdge = 1.0 - smoothstep(0.0, 0.25 + 0.55 * wSwell, wDep);
      float wSpeck = wNoise(vWPos * 1.3 + vec3(0.0, uWTime * 0.25, 0.0)) * 0.6 + wNoise(vWPos * 3.7 - uWTime * 0.3) * 0.4;
      float wFoam = wEdge * smoothstep(0.55, 0.8, wSpeck + wEdge * 0.45);
      diffuseColor.rgb = mix(diffuseColor.rgb, uWFoam, wFoam * 0.9);
      diffuseColor.a = max(diffuseColor.a, wFoam * 0.95);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        // Small waves: a few travelling ripples, as a tilt of the normal, calmer far off.
        vec3 q = vWPos;
        float t = uWTime;
        vec3 g = vec3(cos(q.x * 0.9 + t * 1.3) * 0.9 + cos(q.x * 2.3 + q.z * 1.1 - t * 2.1) * 0.5,
                      cos(q.y * 1.1 - t * 1.1) * 0.7 + cos(q.y * 2.7 + q.x * 0.9 + t * 1.7) * 0.4,
                      cos(q.z * 1.0 + t * 1.5) * 0.9 + cos(q.z * 2.1 - q.y * 1.3 - t * 1.9) * 0.5);
        vec3 gv = (viewMatrix * vec4(g, 0.0)).xyz;
        gv -= dot(gv, normal) * normal;
        float far = 1.0 / (1.0 + length(vViewPosition) / 45.0);
        normal = normalize(normal - gv * 0.07 * far);
      }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        // The sky in the water at a glancing angle.
        float wF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 4.0);
        totalEmissiveRadiance += uWSky * wF * 0.55;
        diffuseColor.a = mix(diffuseColor.a, 1.0, wF * 0.6);
      }`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : '') + '-water';
  return uniforms;
}
