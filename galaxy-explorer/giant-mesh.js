// Gas and ice giants. No terrain: a smooth sphere wrapped in a generated cloud
// map (turbulent bands, streaks and an optional storm), a haze at the limb and,
// for ringed giants, rings with gaps. The cloud map is sampled on the sphere,
// so it has no seam; the planet turns slowly.
//
// Alive, not painted (switch ?giants=0 for the still picture): belts and zones drift past
// each other in opposite jets, leaving any great storm whole; haze gathers at the limb; the
// rings cast their shadow on the clouds and the planet casts its own across the rings;
// lightning flickers in the storms of the night side and auroras ring the poles; and close
// to the cloud tops a thin higher deck drifts over the one below. All of it is drawn in the
// shader from the cloud map already made, so it costs no more memory and no extra passes.
// The low tier keeps the jets, the haze and the shadows and leaves out the rest.
import { makeNoise, fbm } from './terrain.mjs';
import { GIANTS } from './quality.mjs';

const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// RGBA cloud map, W × H, equirectangular; row 0 is the south pole.
// Rows from j0 to j1 are written into out, so a map can be filled in slices.
export function giantPixels(body, W, H, out = new Uint8Array(W * H * 4), j0 = 0, j1 = H) {
  const noise = makeNoise(body.seed, 'clouds'), streaks = makeNoise(body.seed, 'streaks');
  const pal = body.palette.map(rgb), storm = rgb(body.rock), haze = rgb(body.atmosphere);
  const bands = body.bands, turb = body.turbulence, phase = (body.seed % 1000) / 159;
  for (let j = j0; j < j1; j++) {
    const lat = -Math.PI / 2 + (j + .5) / H * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = (i + .5) / W * Math.PI * 2, x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      // Turbulence bends the band edges; stronger at mid-latitudes, where the jets shear.
      const warp = turb * (.035 * fbm(noise, x * 2.2, y * 2.2, z * 2.2, 4) + .012 * noise(x * 9, y * 9, z * 9));
      const l = lat + warp * (.5 + cl);
      // Belts and zones: a base rhythm with each band's own brightness.
      let v = .5 + .3 * Math.sin(l * bands * 2 + phase) + .3 * noise(1.7, l * bands * 1.3, 4.1);
      // Fine streaks stretched along the bands.
      v += .08 * streaks(x * 1.4, y * 45, z * 1.4) + .05 * streaks(x * 4, y * 120, z * 4);
      if (body.physics.kind === 'ice') v = .5 + (v - .5) * .55; // ice giants are calmer, with softer bands
      v = Math.min(1, Math.max(0, v));
      const k = v * 2.999, a = Math.floor(k), t = k - a;
      let r = mix(pal[a][0], pal[a + 1][0], t), g = mix(pal[a][1], pal[a + 1][1], t), b = mix(pal[a][2], pal[a + 1][2], t);
      // Storm: an oval vortex with a bright rim and swirled core.
      if (body.storm) {
        let dl = lon - body.storm.lon; dl -= Math.round(dl / (Math.PI * 2)) * Math.PI * 2;
        const s = body.storm.size, d = Math.hypot(dl * cl / (s * 1.8), (lat - body.storm.lat) / s);
        if (d < 1.25) {
          const swirl = .5 + .5 * Math.sin(d * 14 - Math.atan2(lat - body.storm.lat, dl * cl) * 2);
          const core = (1 - smooth(.55, 1, d)) * (.75 + .25 * swirl), rim = smooth(.8, 1, d) * (1 - smooth(1, 1.25, d)) * .35;
          r = mix(r, storm[0], core) + rim * 60; g = mix(g, storm[1], core) + rim * 60; b = mix(b, storm[2], core) + rim * 60;
        }
      }
      // Polar haze softens the bands toward the poles.
      const p = smooth(1.05, 1.45, Math.abs(lat)) * .6;
      const o = (j * W + i) * 4;
      out[o] = Math.min(255, mix(r, haze[0] * .8, p)); out[o + 1] = Math.min(255, mix(g, haze[1] * .8, p)); out[o + 2] = Math.min(255, mix(b, haze[2] * .8, p)); out[o + 3] = 255;
    }
  }
  return out;
}

// Ring opacity and brightness across the ring (inner edge to outer edge), with gaps.
export function ringProfile(body, N) {
  const noise = makeNoise(body.seed, 'rings'), out = new Float32Array(N * 2);
  const gap = .45 + (body.seed % 97) / 97 * .25;
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    let a = .55 + .3 * noise(x * 6, 0, 0) + .25 * noise(x * 31, 2, 0) + .12 * noise(x * 90, 4, 0);
    a *= smooth(0, .06, x) * (1 - smooth(.9, 1, x)); // soft edges
    a *= smooth(.012, .03, Math.abs(x - gap)); // one clear main gap
    out[i * 2] = Math.min(1, Math.max(0, a)) * (body.physics.kind === 'ice' ? .5 : 1);
    out[i * 2 + 1] = .75 + .25 * noise(x * 14, 6, 0);
  }
  return out;
}

// The cloud map is ~9 m per texel, which looks soft up close. This adds fine
// streaks and eddies on the GPU from the point's position on the sphere, so
// detail stays sharp at any distance. It fades out far away, where the map
// alone is enough (and the noise would shimmer).
const NOISE_GLSL = `
float cHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float cNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cHash(i), cHash(i + vec3(1,0,0)), f.x), mix(cHash(i + vec3(0,1,0)), cHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(cHash(i + vec3(0,0,1)), cHash(i + vec3(1,0,1)), f.x), mix(cHash(i + vec3(0,1,1)), cHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;
const AURORAS = ['#6dffb0', '#ff7ad9', '#7fb0ff'];
// live: { THREE, sun, time, ring: { tex, inner, outer } | null, fx } or null for the still picture.
function addCloudDetail(material, R, body, live = null) {
  const seed = (body.seed % 997) / 97;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailRadius = { value: R };
    shader.uniforms.detailSeed = { value: seed };
    if (live) {
      const T = live.THREE, gas = body.physics.kind === 'gas';
      Object.assign(shader.uniforms, {
        uSun: live.sun, uGTime: live.time, uRingTex: { value: live.ring?.tex ?? null },
        uRing: { value: new T.Vector3(live.ring?.inner ?? 0, live.ring?.outer ?? 1, live.ring ? 1 : 0) },
        uJet: { value: new T.Vector3(body.bands, (body.seed % 1000) / 159, 1 / (gas ? 900 : 2000)) },
        uStorm: { value: new T.Vector3(body.storm?.lat ?? 0, body.storm?.size ?? 0, body.storm ? 1 : 0) },
        uHaze: { value: new T.Color(body.atmosphere) }, uAurora: { value: new T.Color(AURORAS[body.seed % 3]) },
        uFx: { value: new T.Vector2(Math.min(1.5, Math.max(.3, body.turbulence ?? 1)) * (gas ? 1 : .4), 0) },
      });
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCloud;\nvarying float vCloudDist;\nvarying vec3 vGW; varying vec3 vGC; varying vec3 vGN; varying float vGS;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloud = normalize(position);')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCloudDist = -mvPosition.z;\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGC = modelMatrix[3].xyz; vGN = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); vGS = length(modelMatrix[0].xyz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vCloud;
varying float vCloudDist;
varying vec3 vGW; varying vec3 vGC; varying vec3 vGN; varying float vGS;
uniform float detailRadius;
uniform float detailSeed;
${live ? 'uniform vec3 uSun; uniform float uGTime; uniform sampler2D uRingTex; uniform vec3 uRing; uniform vec3 uJet; uniform vec3 uStorm; uniform vec3 uHaze; uniform vec3 uAurora; uniform vec2 uFx;' : ''}
${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `${live ? `
  // Belts and zones drift opposite ways; a great storm's own latitudes move as one.
  float glat = asin(clamp(vCloud.y, -1.0, 1.0));
  float jl = mix(glat, uStorm.x, uStorm.z * smoothstep(uStorm.y * 1.7, uStorm.y * 1.15, abs(glat - uStorm.x)));
  vec2 guv = vMapUv; guv.x += uGTime * uJet.z * clamp(sin(jl * uJet.x * 2.0 + uJet.y) * 2.5, -1.0, 1.0);
  diffuseColor *= texture2D(map, guv);
  vec3 gSun = normalize(uSun - vGC), gUp = normalize(vGW - vGC);
  float gNight = smoothstep(0.1, -0.25, dot(gUp, gSun));
  // Haze at the limb.
  diffuseColor.rgb = mix(diffuseColor.rgb, uHaze, pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.2) * .6);
  // The rings' shadow on the clouds.
  if (uRing.z > 0.5) {
    vec3 gp = vGW - vGC; float dn = dot(gSun, vGN), gt = -dot(gp, vGN) / (abs(dn) < 1e-4 ? 1e-4 : dn);
    if (gt > 0.0) { float gu = (length(gp + gSun * gt) / vGS - uRing.x) / (uRing.y - uRing.x); if (gu > 0.0 && gu < 1.0) diffuseColor.rgb *= 1.0 - .72 * texture2D(uRingTex, vec2(gu, .5)).a; }
  }` : '#include <map_fragment>'}
{
  // Stretched along the bands (y is latitude): long thin streaks with eddies between.
  vec3 q = vCloud * detailRadius / 34.0 + vec3(detailSeed);
  float warp = cNoise(q * vec3(1.0, 3.0, 1.0)) * 1.6;
  float d = 0.0, amp = 0.5, total = 0.0;
  vec3 s = vec3(q.x + warp, q.y * 7.0, q.z + warp);
  for (int o = 0; o < 5; o++) { d += amp * cNoise(s); total += amp; amp *= 0.5; s *= vec3(2.1, 2.3, 2.1); }
  d = d / total - 0.5;
  float near = 1.0 - smoothstep(detailRadius * 0.6, detailRadius * 3.0, vCloudDist);
  diffuseColor.rgb *= 1.0 + d * 0.5 * near;
}`)
      // The scene's sky light is tuned for planet surfaces; on a giant it would
      // tint the clouds. Mostly starlight here, with a dim night side.
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.3;')
      .replace('#include <emissivemap_fragment>', live ? `
  #ifdef USE_EMISSIVEMAP
  totalEmissiveRadiance *= texture2D(emissiveMap, guv).rgb;
  #endif
  ${live.fx ? `{
    // Lightning in the storms of the night side, and auroras round the poles.
    vec3 lc = vCloud * 11.0, ci = floor(lc);
    float tt = uGTime * 1.3 + cHash(ci) * 50.0;
    float strike = step(1.0 - .006 * uFx.x, cHash(ci + floor(tt) * .37));
    float fl = strike * (1.0 - fract(tt)) * (.6 + .4 * sin(uGTime * 60.0 + cHash(ci) * 6.0));
    totalEmissiveRadiance += vec3(.75, .85, 1.0) * fl * (1.0 - smoothstep(0.0, .5, length(fract(lc) - .5))) * gNight * 1.6;
    float au = exp(-pow((abs(glat) - 1.2) / .05, 2.0)) * (.35 + .65 * cNoise(vec3(vCloud.x * 6.0, uGTime * .15, vCloud.z * 6.0)));
    totalEmissiveRadiance += uAurora * au * (.2 + .8 * gNight) * .7;
  }` : ''}` : '#include <emissivemap_fragment>');
  };
  material.customProgramCacheKey = () => 'giant-cloud-detail' + (live ? (live.fx ? '-live-fx' : '-live') : '');
}

// Banded rings with gaps, lying in the local XZ plane. Shared by gas giants and
// ringed rocky worlds, so every ring in the game looks and renders the same way.
// sun ({ value: the star's position in the world }) and planetR: the planet then casts its shadow across the ring.
export function createRing(THREE, body, inner, outer, { segments = 192, opacity = 1, sun = null, planetR = 0 } = {}) {
  const N = 512, profile = ringProfile(body, N), ringColor = rgb(body.crystal), data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) data[i * 4 + c] = ringColor[c] * profile[i * 2 + 1];
  for (let i = 0; i < N; i++) data[i * 4 + 3] = profile[i * 2] * 235 * opacity;
  const tex = new THREE.DataTexture(data, N, 1);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const geo = new THREE.RingGeometry(inner, outer, segments, 1);
  // Map u across the ring (inner to outer edge) instead of the default planar layout.
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), .5);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  if (sun && planetR && GIANTS) {
    mesh.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uSun: sun, uPlanetR: { value: planetR } });
      sh.vertexShader = 'varying vec3 vRW; varying vec3 vRC; varying float vRS;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvRW = (modelMatrix * vec4(transformed, 1.0)).xyz; vRC = modelMatrix[3].xyz; vRS = length(modelMatrix[0].xyz);');
      sh.fragmentShader = 'varying vec3 vRW; varying vec3 vRC; varying float vRS; uniform vec3 uSun; uniform float uPlanetR;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 s = normalize(uSun - vRC), p = vRW - vRC; float along = dot(p, s), rr = uPlanetR * vRS;
    if (along < 0.0) diffuseColor.rgb *= 1.0 - .9 * (1.0 - smoothstep(rr * .96, rr * 1.03, length(p - s * along))); }`);
    };
    mesh.material.customProgramCacheKey = () => 'ring-shadow';
  }
  return { mesh, tex, disposables: [tex, geo, mesh.material] };
}

export function createGiant(THREE, body, { coarse = false, gradual = false, sun = null } = {}) {
  const R = body.radius, group = new THREE.Group(), tilted = new THREE.Group();
  tilted.rotation.z = body.tilt;
  group.add(tilted);
  const W = coarse ? 512 : 1024, H = W / 2;
  // Built gradually, the map fills a slice of rows per frame; `ready` resolves when done.
  const pixels = new Uint8Array(W * H * 4);
  let ready = null;
  if (!gradual) giantPixels(body, W, H, pixels);
  else ready = (async () => {
    const rows = coarse ? 12 : 24;
    for (let j = 0; j < H; j += rows) {
      giantPixels(body, W, H, pixels, j, Math.min(H, j + rows));
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    map.needsUpdate = true;
  })();
  const map = new THREE.DataTexture(pixels, W, H);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true;
  map.anisotropy = 4; map.needsUpdate = true;
  const hot = body.physics.clouds === 'silicate' || body.physics.clouds === 'alkali';
  const material = new THREE.MeshStandardMaterial({ map, roughness: .95, metalness: 0,
    ...(hot ? { emissive: 0xffffff, emissiveMap: map, emissiveIntensity: body.physics.clouds === 'silicate' ? .45 : .15 } : {}) });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, coarse ? 128 : 192, coarse ? 80 : 128), material);
  tilted.add(sphere);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, coarse ? 96 : 160, coarse ? 64 : 96), new THREE.MeshBasicMaterial({
    color: body.atmosphere, transparent: true, opacity: .12, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  tilted.add(halo);
  const disposables = [map, material, sphere.geometry, halo.geometry, halo.material];
  const alive = GIANTS && !!sun, time = { value: 0 };
  let ringLive = null, deck = null;
  if (body.ringed) {
    const inner = R * (body.physics.kind === 'ice' ? 1.45 : 1.3), outer = R * (body.physics.kind === 'ice' ? 1.95 : 2.25);
    const ring = createRing(THREE, body, inner, outer, { segments: coarse ? 128 : 192, sun: alive ? sun : null, planetR: R });
    tilted.add(ring.mesh);
    disposables.push(...ring.disposables);
    ringLive = { tex: ring.tex, inner, outer };
  }
  addCloudDetail(material, R, body, alive ? { THREE, sun, time, ring: ringLive, fx: !coarse } : null);
  if (alive && !coarse) {
    // A thin higher deck: torn sheets of cloud drifting over the one below, seen only from near.
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(body.atmosphere).lerp(new THREE.Color(0xffffff), .55), transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide }); // (seen from beneath too, by a ship in the clouds)
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.detailRadius = { value: R }; sh.uniforms.detailSeed = { value: (body.seed % 613) / 61 };
      sh.vertexShader = 'varying vec3 vCloud; varying float vCloudDist;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloud = normalize(position);').replace('#include <project_vertex>', '#include <project_vertex>\nvCloudDist = -mvPosition.z;');
      sh.fragmentShader = 'varying vec3 vCloud; varying float vCloudDist; uniform float detailRadius; uniform float detailSeed;' + NOISE_GLSL + '\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 q = vCloud * detailRadius / 130.0 + detailSeed; q.y *= 4.0;
    float n = cNoise(q) * .55 + cNoise(q * 2.3) * .3 + cNoise(q * 5.1) * .15;
    diffuseColor.a *= smoothstep(.5, .78, n) * (1.0 - smoothstep(detailRadius * .2, detailRadius * 1.5, vCloudDist)) * .5; }`).replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.3;');
    };
    mat.customProgramCacheKey = () => 'giant-deck';
    deck = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 160, 96), mat);
    deck.renderOrder = 1;
    tilted.add(deck);
    disposables.push(deck.geometry, mat);
  }
  // A full turn takes a few minutes; big gas giants spin fastest.
  const spin = (Math.PI * 2) / (body.physics.kind === 'gas' ? 240 : 360);
  let last = performance.now();
  return {
    body, group, ready,
    update() { const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); sphere.rotation.y += spin * dt; if (deck) deck.rotation.y += spin * 1.2 * dt; time.value += dt; last = now; },
    dispose() { for (const d of disposables) d.dispose(); },
  };
}
