// The sky and the light of the world you are on: one smooth lighting model with soft
// sun shadows, and an atmosphere that sets each world's mood from its star and its air.
//
//   createSkyDome(THREE)   a dome drawn behind everything: a gradient from a pale, hazy
//                          horizon up to a deeper zenith, with a glow around the star.
//                          game.js sets its colours each frame (updateAtmosphere).
//   setupShadows(...)      soft shadows from the star, in a box that follows you about
//                          the ground; switched off far from the ground, where they would
//                          only cost time (?shadows=0 turns them off; phones get a smaller
//                          map). Plants (flora-mesh.js), rocks, formations, buildings and
//                          the ship cast them; everything on the ground receives them.
//
// Test switch, remembered in the browser: ?shadows=0 off, ?shadows=1 on (default).
const params = new URLSearchParams((globalThis.location?.search ?? '').replace(/(?!^)\?/g, '&'));
function setting(name, key, fallback) {
  const v = params.get(name);
  try {
    if (!globalThis.localStorage) return v ?? fallback;
    if (v !== null) localStorage.setItem(key, v);
    return localStorage.getItem(key) ?? fallback;
  } catch { return v ?? fallback; }
}
export const SHADOWS = setting('shadows', 'elsewhere-shadows', '1') !== '0';

export function createSkyDome(THREE) {
  const uniforms = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
    uSpace: { value: new THREE.Color() }, uSunColor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uUp: { value: new THREE.Vector3(0, 1, 0) }, uAir: { value: 0 }, uGlow: { value: 0 },
    uBack: { value: new THREE.Color() }, uOver: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uZenith, uHorizon, uGround, uSpace, uSunColor, uSunDir, uUp, uBack; uniform float uAir, uGlow, uOver;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = dot(d, uUp);
  // Horizon to zenith: the haze is thickest low down, so the sky pales towards the horizon.
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.75, h), 0.65));
  col = mix(col, uGround, smoothstep(0.0, -0.25, h)); // below the horizon (mostly hidden by the ground)
  // The star's glow: a broad halo, a tighter bright one, and the horizon brightened on its side.
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * uGlow * (0.22 * pow(s, 6.0) + 0.45 * pow(s, 48.0) + 0.18 * pow(s, 2.0) * (1.0 - smoothstep(0.0, 0.5, abs(h))));
  col = mix(uSpace, col, uAir);
  col = mix(col, uBack, uOver); // clouds, storms and the local haze take the sky over
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
    side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), material);
  mesh.renderOrder = -1000; // first of all, behind everything (it does not test or write depth)
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, uniforms };
}

// sun: the DirectionalLight (its position is the star, far away); coarse: phones.
export function setupShadows(THREE, renderer, scene, sun, { coarse = false } = {}) {
  if (!SHADOWS) return { update() {}, enabled: false };
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = true;
  const size = coarse ? 1024 : 2048, half = coarse ? 42 : 70;
  sun.shadow.mapSize.set(size, size);
  const cam = sun.shadow.camera;
  cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 3;
  scene.add(sun.target);
  const texel = (half * 2) / size, tmp = new THREE.Vector3(), lightSpace = new THREE.Matrix4(), inv = new THREE.Matrix4();
  return {
    enabled: true,
    // focus: the point on the ground to centre the shadows on (world space); on: whether
    // shadows are worth drawing now (near the ground, on a world, in daylight).
    update(focus, on) {
      renderer.shadowMap.autoUpdate = on;
      if (!on) return;
      // The box is moved in whole shadow-map texels (in the light's own frame), so the
      // shadows do not crawl as you walk.
      const dir = tmp.copy(sun.position).sub(focus).normalize();
      lightSpace.lookAt(dir, new THREE.Vector3(0, 0, 0), Math.abs(dir.y) < .99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0));
      inv.copy(lightSpace).invert();
      const p = focus.clone().applyMatrix4(inv);
      p.x = Math.round(p.x / texel) * texel; p.y = Math.round(p.y / texel) * texel;
      const snapped = p.applyMatrix4(lightSpace);
      sun.target.position.copy(snapped);
      sun.target.updateMatrixWorld();
      const d = sun.position.distanceTo(snapped);
      cam.near = Math.max(1, d - 600); cam.far = d + 250;
      cam.updateProjectionMatrix();
    },
  };
}
