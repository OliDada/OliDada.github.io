// Gas and ice giants. No terrain: a smooth sphere wrapped in a generated cloud
// map (turbulent bands, streaks and an optional storm), a haze at the limb and,
// for ringed giants, rings with gaps. The cloud map is sampled on the sphere,
// so it has no seam; the planet turns slowly.
import { makeNoise, fbm } from './terrain.mjs';

const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// RGBA cloud map, W × H, equirectangular; row 0 is the south pole.
export function giantPixels(body, W, H) {
  const noise = makeNoise(body.seed, 'clouds'), streaks = makeNoise(body.seed, 'streaks');
  const pal = body.palette.map(rgb), storm = rgb(body.rock), haze = rgb(body.atmosphere);
  const bands = body.bands, turb = body.turbulence, phase = (body.seed % 1000) / 159;
  const out = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) {
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

export function createGiant(THREE, body, { coarse = false } = {}) {
  const R = body.radius, group = new THREE.Group(), tilted = new THREE.Group();
  tilted.rotation.z = body.tilt;
  group.add(tilted);
  const W = coarse ? 512 : 1024, H = W / 2;
  const map = new THREE.DataTexture(giantPixels(body, W, H), W, H);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true;
  map.anisotropy = 4; map.needsUpdate = true;
  const hot = body.physics.clouds === 'silicate' || body.physics.clouds === 'alkali';
  const material = new THREE.MeshStandardMaterial({ map, roughness: .95, metalness: 0,
    ...(hot ? { emissive: 0xffffff, emissiveMap: map, emissiveIntensity: body.physics.clouds === 'silicate' ? .45 : .15 } : {}) });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, coarse ? 64 : 96, coarse ? 40 : 64), material);
  tilted.add(sphere);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 48, 32), new THREE.MeshBasicMaterial({
    color: body.atmosphere, transparent: true, opacity: .12, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  tilted.add(halo);
  const disposables = [map, material, sphere.geometry, halo.geometry, halo.material];
  if (body.ringed) {
    const inner = R * (body.physics.kind === 'ice' ? 1.45 : 1.3), outer = R * (body.physics.kind === 'ice' ? 1.95 : 2.25), N = 512;
    const profile = ringProfile(body, N), ringColor = rgb(body.crystal), data = new Uint8Array(N * 4);
    for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) data[i * 4 + c] = ringColor[c] * profile[i * 2 + 1];
    for (let i = 0; i < N; i++) data[i * 4 + 3] = profile[i * 2] * 235;
    const tex = new THREE.DataTexture(data, N, 1);
    tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const geo = new THREE.RingGeometry(inner, outer, coarse ? 128 : 192, 1);
    // Map u across the ring (inner to outer edge) instead of the default planar layout.
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), .5);
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 2;
    tilted.add(ring);
    disposables.push(tex, geo, ring.material);
  }
  // A full turn takes a few minutes; big gas giants spin fastest.
  const spin = (Math.PI * 2) / (body.physics.kind === 'gas' ? 240 : 360);
  let last = performance.now();
  return {
    body, group,
    update() { const now = performance.now(); sphere.rotation.y += spin * Math.min(.1, (now - last) / 1000); last = now; },
    dispose() { for (const d of disposables) d.dispose(); },
  };
}
