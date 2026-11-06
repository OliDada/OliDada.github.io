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
// Test switches, remembered in the browser: ?shadows=0 off, ?shadows=1 on (default);
// ?mist=0 / ?beams=0 turn off the valley mist and the sunbeams in the woods.
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
export const MIST = setting('mist', 'elsewhere-mist', '1') !== '0'; // ?mist=0: no valley mist
export const BEAMS = setting('beams', 'elsewhere-beams', '1') !== '0'; // ?beams=0: no sunbeams in the woods

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
  let frame = 0;
  const texel = (half * 2) / size, tmp = new THREE.Vector3(), lightSpace = new THREE.Matrix4(), inv = new THREE.Matrix4();
  return {
    enabled: true,
    // focus: the point on the ground to centre the shadows on (world space); on: whether
    // shadows are worth drawing now (near the ground, on a world, in daylight).
    update(focus, on) {
      // The shadow map is redrawn every other frame (half the cost; the sway of a shadow at
      // 30 a second is not noticed). The box only moves on those frames, so map and box agree.
      renderer.shadowMap.autoUpdate = false;
      if (!on) return;
      if (frame++ % 2) return;
      renderer.shadowMap.needsUpdate = true;
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

// --- Valley mist -------------------------------------------------------------------
// Fog in three.js thickens only with distance. MistFog adds the land's own mist: low
// ground seen from above (valleys, a lake basin, the forest below a ridge) fills with
// pale haze, more of it the lower and farther it is, while the hill you stand on stays
// clear. It is a THREE.Fog whose two numbers mean something else (installMist rewrites
// the fog shader to read them): near holds the density of the ordinary distance fog
// (exponential, exactly as FogExp2 had it; set it as fog.density), far holds the mist's
// strength, 0..1 (fog.mist; game.js sets it from the world's water and the time of day).
// The mist needs the world's centre at the origin, which it is whenever you are on or
// near a world; out in space the mist is zero.
export function makeMistFog(THREE, color) {
  class MistFog extends THREE.Fog {
    get density() { return this.near; } set density(v) { this.near = v; }
    get mist() { return this.far; } set mist(v) { this.far = v; }
  }
  return new MistFog(color, 0, 0);
}
export function installMist(THREE) {
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogRel; // from the camera to the point, world axes
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogRel = transpose( mat3( viewMatrix ) ) * mvPosition.xyz;
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogRel;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear; // MistFog: the distance fog's density
		uniform float fogFar; // MistFog: the valley mist's strength
	#endif
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
	#else
		float fogFactor = 1.0 - exp( - fogNear * fogNear * vFogDepth * vFogDepth );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
		if ( fogFar > 0.0 ) {
			float below = - dot( vFogRel, normalize( cameraPosition ) ); // metres below your eye
			float mistK = fogFar * smoothstep( 2.0, 45.0, below ) * ( 1.0 - exp( - vFogDepth / 170.0 ) );
			vec3 mistCol = mix( fogColor, vec3( dot( fogColor, vec3( 0.3, 0.59, 0.11 ) ) ) * 1.12 + 0.03, 0.45 );
			gl_FragColor.rgb = mix( gl_FragColor.rgb, mistCol, clamp( mistK, 0.0, 0.8 ) );
		}
	#endif
#endif`;
}

// --- Shafts of sunlight in the woods ------------------------------------------------
// Pale beams slanting down through the canopy toward the ground, among the trees
// around you: each a long soft ribbon along the light's direction that turns to face
// you, brightest where you look toward the star, flickering a little as the crowns
// sway. Placed on a fixed grid over the ground (so they stay put as you walk) and only
// in woods by day (game.js sets their strength from where you are).
export function createSunShafts(THREE, { count = 18 } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
  const uniforms = { uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uColor: { value: new THREE.Color('#fff2d0') }, uStrength: { value: 0 }, uTime: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `uniform vec3 uSunDir; uniform float uTime; varying vec2 vUv; varying float vLook; varying float vPhase;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vec3 base = instanceMatrix[3].xyz; float w = length(instanceMatrix[0].xyz), L = length(instanceMatrix[1].xyz);
  vec3 axis = normalize(uSunDir), side = normalize(cross(axis, base - cameraPosition));
  vec3 p = base + side * position.x * w * (1.0 + position.y * .6) + axis * position.y * L; // widening a little toward the canopy
  vUv = uv; vPhase = fract(sin(dot(base, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2832;
  vec3 v = normalize(p - cameraPosition);
  vLook = (.25 + .75 * pow(max(dot(v, axis), 0.0), 2.0)) * smoothstep(3.0, 9.0, distance(p, cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength, uTime; varying vec2 vUv; varying float vLook; varying float vPhase;
#include <common>
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  float across = 1.0 - abs(vUv.x * 2.0 - 1.0); across = across * across * (3.0 - 2.0 * across);
  float along = smoothstep(0.0, .12, vUv.y) * (1.0 - smoothstep(.55, 1.0, vUv.y));
  float flicker = .75 + .25 * sin(uTime * .9 + vPhase) * sin(uTime * .37 + vPhase * 2.0);
  float a = across * along * flicker * vLook * uStrength;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 5;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  const hash = (x, y, z, k) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + k * 19.3) * 43758.5453; return v - Math.floor(v); };
  let last = -1, lastAt = new THREE.Vector3(1e9, 0, 0);
  const CELL = 10, REACH = 46;
  return {
    mesh, uniforms,
    // at: where you are (world space; the world's centre at the origin); surfaceAt(dir):
    // the ground's radius that way; strength 0..1; sunDir: toward the star.
    update(at, surfaceAt, strength, sunDir, time) {
      uniforms.uStrength.value = strength * .16; uniforms.uTime.value = time;
      uniforms.uSunDir.value.copy(sunDir);
      mesh.visible = strength > .01;
      if (!mesh.visible) return;
      if (time - last < .4 && at.distanceTo(lastAt) < 3) return;
      last = time; lastAt.copy(at);
      const R = at.length(), up = d.copy(at).normalize(), ground = surfaceAt(up);
      let n = 0;
      const ci = Math.floor(at.x / CELL), cj = Math.floor(at.y / CELL), ck = Math.floor(at.z / CELL), span = Math.ceil(REACH / CELL);
      for (let i = -span; i <= span && n < count; i++) for (let j = -span; j <= span && n < count; j++) for (let k = -span; k <= span && n < count; k++) {
        const x = ci + i, y = cj + j, z = ck + k;
        if (hash(x, y, z, 1) > .16) continue;
        c.set((x + hash(x, y, z, 2)) * CELL, (y + hash(x, y, z, 3)) * CELL, (z + hash(x, y, z, 4)) * CELL);
        // Only cells that straddle the ground (one layer of the grid), within reach.
        const len = c.length(); if (Math.abs(len - ground) > CELL * .5) continue;
        c.multiplyScalar(1 / len);
        const g = surfaceAt(c); c.multiplyScalar(g);
        if (c.distanceTo(at) > REACH || g - ground > 25) continue;
        s.set(1.4 + 2.2 * hash(x, y, z, 5), 26 + 16 * hash(x, y, z, 6), 1);
        m4.compose(c, q, s); mesh.setMatrixAt(n++, m4);
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
      void R;
    },
  };
}
