// The wind where you are, shared by everything that sways (flora-mesh.js,
// groundcover.js); game.js sets it every frame from the weather (weather.mjs).
//   strength: 0 still air .. 1 a storm gale
//   dir: the direction it blows, a unit vector in scene coordinates
export const wind = { strength: { value: 0 }, dir: { value: [1, 0, 0] } };

// GLSL: how far the wind pushes a vertex, in the instance's own coordinates.
// k: how much this vertex bends (0 at the root); phase: per-plant offset.
// Needs uniforms uWind, uWindDir and uTime; works on instanced meshes.
export const WIND_GLSL = /* glsl */ `
vec3 windPush(float k, float phase) {
  mat4 m = modelMatrix * instanceMatrix;
  float s2 = max(dot(m[0].xyz, m[0].xyz), 1e-6);
  vec3 local = vec3(dot(m[0].xyz, uWindDir), dot(m[1].xyz, uWindDir), dot(m[2].xyz, uWindDir)) / s2; // world direction, in the instance's units
  local.y = 0.0;
  // A steady lean that grows with the wind, and gusts that grow faster.
  float gust = 0.55 + 0.45 * sin(uTime * (1.6 + 2.2 * uWind) + phase) * sin(uTime * 0.37 + phase * 0.5);
  return local * k * uWind * (0.6 + 1.4 * uWind) * gust;
}
`;
