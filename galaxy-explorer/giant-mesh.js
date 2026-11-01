// Gas and ice giants. No terrain: a smooth sphere wrapped in a generated cloud
// map (turbulent bands, streaks and an optional storm), a haze at the limb and,
// for ringed giants, rings with gaps. The cloud map is sampled on the sphere,
// so it has no seam; the planet turns slowly.
import { makeNoise, fbm } from './terrain.mjs';

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
function addCloudDetail(material, R, body) {
  const seed = (body.seed % 997) / 97;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailRadius = { value: R };
    shader.uniforms.detailSeed = { value: seed };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCloud;\nvarying float vCloudDist;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloud = normalize(position);')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCloudDist = -mvPosition.z;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vCloud;
varying float vCloudDist;
uniform float detailRadius;
uniform float detailSeed;
float cHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float cNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cHash(i), cHash(i + vec3(1,0,0)), f.x), mix(cHash(i + vec3(0,1,0)), cHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(cHash(i + vec3(0,0,1)), cHash(i + vec3(1,0,1)), f.x), mix(cHash(i + vec3(0,1,1)), cHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
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
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.3;');
  };
  material.customProgramCacheKey = () => 'giant-cloud-detail';
}

// Banded rings with gaps, lying in the local XZ plane. Shared by gas giants and
// ringed rocky worlds, so every ring in the game looks and renders the same way.
export function createRing(THREE, body, inner, outer, { segments = 192, opacity = 1 } = {}) {
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
  return { mesh, disposables: [tex, geo, mesh.material] };
}

export function createGiant(THREE, body, { coarse = false, gradual = false } = {}) {
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
  addCloudDetail(material, R, body);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, coarse ? 128 : 192, coarse ? 80 : 128), material);
  tilted.add(sphere);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, coarse ? 96 : 160, coarse ? 64 : 96), new THREE.MeshBasicMaterial({
    color: body.atmosphere, transparent: true, opacity: .12, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  tilted.add(halo);
  const disposables = [map, material, sphere.geometry, halo.geometry, halo.material];
  if (body.ringed) {
    const ring = createRing(THREE, body, R * (body.physics.kind === 'ice' ? 1.45 : 1.3), R * (body.physics.kind === 'ice' ? 1.95 : 2.25), { segments: coarse ? 128 : 192 });
    tilted.add(ring.mesh);
    disposables.push(...ring.disposables);
  }
  // A full turn takes a few minutes; big gas giants spin fastest.
  const spin = (Math.PI * 2) / (body.physics.kind === 'gas' ? 240 : 360);
  let last = performance.now();
  return {
    body, group, ready,
    update() { const now = performance.now(); sphere.rotation.y += spin * Math.min(.1, (now - last) / 1000); last = now; },
    dispose() { for (const d of disposables) d.dispose(); },
  };
}
