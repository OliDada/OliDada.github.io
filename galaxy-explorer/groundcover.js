// Ground cover: grass tufts, flowers, pebbles, ice and crystal shards in a circle
// around the player. Everything sits on a fixed grid laid over the world (a grid on
// each cube face), so a tuft is always in the same spot: walk away and back and
// nothing has moved. Only cells near you are filled; as you move, cells behind you
// are dropped and cells ahead are worked out a few hundred per frame, nearest
// first, so it never stalls. What grows in a cell comes from the ground there
// (terrain.mjs color(): grass, bare rock, snow) and the world's ground type.
// Each kind of item is one instanced mesh, so the whole layer is four draw calls.
// THREE is passed in.
import { wind, WIND_GLSL } from './wind.mjs';
import { terrainFor } from './terrain.mjs';
import { FACES } from './chunk-build.mjs';
import { PLANT_STYLE } from './style.mjs';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash(f, i, j, k) {
  let h = Math.imul(f + 1, 2246822519) ^ Math.imul(i, 3266489917) ^ Math.imul(j, 668265263) ^ Math.imul(k, 374761393);
  h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Per ground type: how common each item is on bare ground (grass follows the grass on the ground).
const BARE = {
  soft: { pebble: .06, shard: 0, dry: .02 },
  rocky: { pebble: .3, shard: .015, dry: 0 },
  volcanic: { pebble: .32, shard: .01, dry: 0 },
  sand: { pebble: .05, shard: 0, dry: .035 },
  ice: { pebble: .03, shard: .05, dry: 0 },
  toxic: { pebble: .12, shard: .04, dry: .02 },
};

export function createGroundCover(THREE, { body, radius: R, coarse = false, blocked = () => false }) {
  const t = terrainFor(body);
  // New plant style: a thicker, wider carpet (grass in clumps of several tufts, gravel and
  // flat stones on bare ground) out to a wider circle.
  const DENSE = PLANT_STYLE !== 'classic';
  const reach = coarse ? (DENSE ? 32 : 26) : DENSE ? 58 : 42, cell = coarse ? 1.25 : .95; // metres
  const caps = coarse ? (DENSE ? { tuft: 6000, head: 500, pebble: 2600, shard: 300 } : { tuft: 2600, head: 300, pebble: 1300, shard: 250 })
    : DENSE ? { tuft: 34000, head: 2600, pebble: 10000, shard: 1400 } : { tuft: 11000, head: 1400, pebble: 5000, shard: 900 };
  // New plant style: the woods get their own floor (terrain.mjs color() info.wood): ferns,
  // cushions of moss, fallen twigs and branches and small mushrooms, instead of meadow grass.
  const woods = PLANT_STYLE !== 'classic' && ['simple', 'complex'].includes(body.physics?.life) && (body.physics?.biochemistry || 'carbon') === 'carbon';
  if (woods) Object.assign(caps, coarse ? { fern: 900, moss: 900, twig: 220 } : { fern: 3600, moss: 3800, twig: 900 });
  const bare = BARE[t.ground] || (t.airless ? BARE.rocky : BARE.soft);
  const flowers = body.physics?.life === 'complex' ? 1 : body.physics?.life === 'simple' ? .4 : 0;
  const mossTint = [.24, .36, .16], twigTint = [.33, .25, .17];
  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const group = new THREE.Group();
  const time = { value: 0 }, center = { value: new THREE.Vector3() }, fadeR = { value: new THREE.Vector2(reach * .3, reach) };

  // --- Models ---
  function tuftGeometry() {
    const pos = [], col = [];
    for (let b = 0; b < 5; b++) {
      const a = b * 2.4 + .3, lean = .25 + (b % 3) * .12, w = .05, h = .75 + (b % 2) * .3;
      const cx = Math.cos(a), cz = Math.sin(a), px = -cz * w, pz = cx * w;
      const ox = cx * .05, oz = cz * .05, tx = ox + cx * lean * h, tz = oz + cz * lean * h;
      pos.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, tx, h, tz);
      col.push(.7, .7, .7, .7, .7, .7, 1.15, 1.15, 1.15); // darker at the base, light at the tip
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  // A thin stem with a small round head; the instance colour tints the head (and darkens the stem).
  function flowerGeometry() {
    const head = new THREE.IcosahedronGeometry(.09, 0).scale(1, .6, 1).translate(0, 1, 0);
    const stem = new THREE.CylinderGeometry(.008, .012, 1, 3, 1).translate(0, .5, 0).toNonIndexed();
    const pos = [...stem.attributes.position.array, ...head.attributes.position.array], col = [];
    for (let i = 0; i < stem.attributes.position.count; i++) col.push(.35, .55, .3);
    for (let i = 0; i < head.attributes.position.count; i++) col.push(1, 1, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  function pebbleGeometry() {
    const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + .25 * Math.sin(x * 4.1 + z * 2.3) * Math.cos(y * 3.7);
      p.setXYZ(i, x * k, y * k * .55, z * k);
    }
    g.computeVertexNormals();
    return g;
  }
  // A fern: fronds arching out and down from the centre, each a tapering strip with a
  // zig-zag edge of leaflets. Darker at the heart.
  function fernGeometry() {
    const pos = [], col = [], fronds = 7;
    for (let f = 0; f < fronds; f++) {
      const a = f / fronds * Math.PI * 2 + (f % 2) * .3, ca = Math.cos(a), sa = Math.sin(a), len = .8 + (f % 3) * .15, seg = 3;
      const at = (t, side) => { const w = .16 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (side ? 1 : -1) * (1 + .35 * ((Math.round(t * seg * 2) % 2))); const d = len * t, y = .55 * Math.sin(t * Math.PI * .75) - .1 * t; return [ca * d - sa * w, y, sa * d + ca * w]; };
      for (let i = 0; i < seg; i++) {
        const t0 = i / seg, t1 = (i + 1) / seg, m0 = at(t0, 0).map((v, k) => (v + at(t0, 1)[k]) / 2), m1 = at(t1, 0).map((v, k) => (v + at(t1, 1)[k]) / 2);
        for (const side of [0, 1]) { pos.push(...m0, ...at(t0, side), ...m1, ...at(t0, side), ...at(t1, side), ...m1); const k0 = .6 + .5 * t0, k1 = .6 + .5 * t1; col.push(k0, k0, k0, k0, k0, k0, k1, k1, k1, k0, k0, k0, k1, k1, k1, k1, k1, k1); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  // A fallen twig or small branch, lying along the ground with a side shoot.
  function twigGeometry() {
    const a = new THREE.CylinderGeometry(.025, .04, 1, 4, 1).rotateZ(Math.PI / 2).translate(0, .03, 0).toNonIndexed();
    const b = new THREE.CylinderGeometry(.012, .022, .4, 3, 1).rotateZ(Math.PI / 2).rotateY(.7).translate(.1, .03, .12).toNonIndexed();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a.attributes.position.array, ...b.attributes.position.array], 3));
    g.computeVertexNormals();
    return g;
  }
  const geometries = {
    tuft: tuftGeometry(),
    fern: woods ? fernGeometry() : null,
    moss: woods ? pebbleGeometry() : null,
    twig: woods ? twigGeometry() : null,
    head: flowerGeometry(),
    pebble: pebbleGeometry(),
    shard: new THREE.ConeGeometry(.12, 1, 4, 1).translate(0, .5, 0),
  };
  // Plants sway in the wind; items thin out towards the edge of the circle so
  // nothing pops in or out as you walk.
  function material(kind) {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: kind === 'tuft' || kind === 'head' || kind === 'fern', flatShading: kind !== 'tuft' && kind !== 'fern', side: kind === 'tuft' || kind === 'fern' ? THREE.DoubleSide : THREE.FrontSide,
      roughness: kind === 'shard' ? .3 : .95, metalness: kind === 'shard' ? .1 : 0,
    });
    const sway = kind === 'tuft' || kind === 'head' || kind === 'fern';
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { uTime: time, uCenter: center, uFade: fadeR, uWind: wind.strength, uWindDir: wind.dir });
      shader.vertexShader = 'uniform float uTime; uniform vec3 uCenter; uniform vec2 uFade; uniform float uWind; uniform vec3 uWindDir;\n' + WIND_GLSL + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 coverAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        // Thins out gradually with distance: each item has its own random cut-off, and
        // shrinks away smoothly as you pass it, so there is no edge to the circle.
        float coverT = 1.0 - smoothstep(uFade.x, uFade.y, distance(coverAt, uCenter));
        float coverR = fract(sin(dot(coverAt, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        transformed *= smoothstep(coverR * .8, coverR * .8 + .2, coverT);` + (sway ? `
        float coverPhase = coverAt.x * .41 + coverAt.z * .27 + coverAt.y * .19;
        float coverK = max(transformed.y, 0.0);
        transformed.x += sin(uTime * 1.9 + coverPhase) * .13 * coverK;
        transformed.z += cos(uTime * 1.4 + coverPhase * 1.3) * .08 * coverK;
        transformed += windPush(coverK * .4, coverPhase); // the weather's wind (wind.mjs)` : ''));
    };
    m.customProgramCacheKey = () => 'cover-' + (sway ? 'sway' : 'still');
    return m;
  }
  const meshes = {};
  for (const kind of Object.keys(caps)) {
    const mesh = new THREE.InstancedMesh(geometries[kind], material(kind), caps[kind]);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(caps[kind] * 3), 3);
    mesh.count = 0; mesh.frustumCulled = false; // always around the player
    meshes[kind] = mesh; group.add(mesh);
  }

  // --- The grid: gnomonic coordinates (a, b) on each cube face, cells of `cell` metres. ---
  const step = cell / R;
  const faceOf = (n, f) => { const [N, U, V] = FACES[f], d = n.x * N[0] + n.y * N[1] + n.z * N[2]; return d > .2 ? [(n.x * U[0] + n.y * U[1] + n.z * U[2]) / d, (n.x * V[0] + n.y * V[1] + n.z * V[2]) / d] : null; };
  const cells = new Map(); // key -> { items: [...], dir, ready }
  let pending = [], active = [], lastAnchor = null, dirty = false;

  const dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), tint = new THREE.Color();
  const info = {}, shape = { slope: 0, hollow: 0 }, n = { x: 0, y: 0, z: 0 }, m2 = { x: 0, y: 0, z: 0 };
  function heightAt(dx, dy, dz) { const l = Math.hypot(dx, dy, dz); m2.x = dx / l; m2.y = dy / l; m2.z = dz / l; return t.meshHeight(m2); }

  // Works out what grows in one cell (or nothing).
  function fill(rec) {
    const { f, i, j } = rec, [N, U, V] = FACES[f];
    const a = (i + .15 + .7 * hash(f, i, j, 1)) * step, b = (j + .15 + .7 * hash(f, i, j, 2)) * step;
    rec.ready = true; rec.items = [];
    if (Math.abs(a) > 1 || Math.abs(b) > 1) return; // belongs to the next face
    let x = N[0] + U[0] * a + V[0] * b, y = N[1] + U[1] * a + V[1] * b, z = N[2] + U[2] * a + V[2] * b;
    const l = Math.hypot(x, y, z); n.x = x / l; n.y = y / l; n.z = z / l;
    if (t.isLiquid(n) || blocked(n)) return;
    const h = t.meshHeight(n);
    // Slope from two nearby samples, about a metre away along the face axes.
    const e = 1 / R, hu = heightAt(n.x + U[0] * e, n.y + U[1] * e, n.z + U[2] * e), hv = heightAt(n.x + V[0] * e, n.y + V[1] * e, n.z + V[2] * e);
    const g = Math.hypot(hu - h, hv - h); shape.slope = 1 - 1 / Math.sqrt(1 + g * g);
    const ground = t.color(n, h, shape, info);
    const r = (k) => hash(f, i, j, k);
    // du, dv: offset in metres along the face axes (for a second item in the same cell).
    let salt = 0; // each item in a cell turned its own way
    const place = (kind, scale, sink, tilt, colour, du = 0, dv = 0, flat = 1) => {
      const s = scale, o = salt++ * 7;
      let px = n.x, py = n.y, pz = n.z, ph = h;
      if (du || dv) { ph = heightAt(px + (U[0] * du + V[0] * dv) / R, py + (U[1] * du + V[1] * dv) / R, pz + (U[2] * du + V[2] * dv) / R); px = m2.x; py = m2.y; pz = m2.z; }
      const rr = R + ph - sink * s;
      dummy.position.set(px * rr, py * rr, pz * rr);
      q.setFromUnitVectors(up, dummy.position.clone().normalize());
      dummy.quaternion.copy(q); dummy.rotateY(r(9 + o) * 6.283); if (tilt) { dummy.rotateX((r(10 + o) - .5) * tilt); dummy.rotateZ((r(11 + o) - .5) * tilt); }
      dummy.scale.set(s, s * flat, s); dummy.updateMatrix();
      rec.items.push({ kind, m: dummy.matrix.toArray(), c: colour });
    };
    const lin = (rgb, k = 1) => { tint.setRGB(rgb[0] * k, rgb[1] * k, rgb[2] * k, THREE.SRGBColorSpace); return [tint.r, tint.g, tint.b]; };
    const roll = r(3);
    const wood = woods ? info.wood : 0;
    const grass = info.veg * Math.max(0, 1 - info.snow * 2.5) * (1 - wood * .88); // frost and snow thin out the grass, and so does a forest's shade
    if (wood > .15 && info.snow < .4) {
      // The forest floor: ferns in drifts, moss cushions, fallen twigs, the odd mushroom.
      const drift = smooth(-.2, .5, Math.sin(n.x * R / 7.3 + 1.3 * Math.sin(n.z * R / 5.1)) * Math.cos(n.y * R / 6.7 + n.x * R / 9.1));
      const fernK = wood * (.08 + .3 * drift), mossK = wood * .22, twigK = wood * .05;
      const w = r(15);
      if (w < fernK) place('fern', .45 + .6 * r(4) * (.5 + drift * .7), .03, .35, lin(t.vegetation || ground, .7 + .45 * r(5)), (r(12) - .5) * cell * .5, (r(13) - .5) * cell * .5);
      else if (w < fernK + mossK) place('moss', .12 + .3 * r(4) ** 1.5, .42, .5, lin(mossTint, .75 + .4 * r(5)));
      else if (w < fernK + mossK + twigK) place('twig', .5 + .9 * r(4), .01, .15, lin(twigTint, .7 + .4 * r(5)));
      else if (w > 1 - .012 * wood) place('head', .1 + .12 * r(4), .02, .3, lin([[.85, .78, .6], [.75, .25, .18], [.92, .9, .85], [.55, .4, .28]][Math.floor(r(14) * 4)]));
    }
    if (info.snow > .4) { // snow covers whatever grows here
      if (roll < .1) place('pebble', .08 + .2 * r(4) ** 2, .3, 1, lin(ground, 1.05)); // snow clumps
      else if (t.ground === 'ice' && roll > 1 - bare.shard) place('shard', .2 + .6 * r(4) ** 2, .1, .8, lin([.75, .9, 1]));
      return;
    }
    if (grass > (DENSE ? .06 : .12)) {
      // Grassland: tufts thick where the ground is green, a few flowers, the odd pebble.
      const k = 1.15 + .25 * r(5);
      if (roll < (DENSE ? Math.min(1, .15 + grass * 1.7) : grass * .95)) {
        place('tuft', .28 + .35 * r(4) * (.6 + grass * .6), .02, .3, lin(ground, k));
        if (r(6) < grass * .6) // a second, smaller tuft beside it
          place('tuft', .2 + .2 * r(7), .02, .5, lin(ground, k * .95), (r(12) - .5) * cell * .6, (r(13) - .5) * cell * .6);
        if (DENSE) { // a clump: more tufts, some taller, some drier, so the meadow is a carpet
          const extra = Math.floor(grass * 3.2 * r(40));
          for (let e = 0; e < extra; e++) { const dry = r(41 + e) < .22; place('tuft', (.22 + .4 * r(44 + e)) * (r(47 + e) < .12 ? 1.7 : 1), .02, .45, dry ? lin(mix3(ground, [.72, .64, .4], .5), k) : lin(ground, k * (.9 + .25 * r(50 + e))), (r(53 + e) - .5) * cell, (r(56 + e) - .5) * cell); }
        }
        if (r(8) < .1 * flowers * grass) {
          const hue = [[.95, .85, .3], [.9, .45, .6], [.85, .9, 1], [.7, .5, .95]][Math.floor(r(14) * 4)];
          place('head', .3 + .25 * r(4), .02, .25, lin(hue));
        }
      } else if (roll > .985) place('pebble', .06 + .12 * r(4) ** 2, .35, 1, lin(ground, .7));
      return;
    }
    // Bare ground: pebbles and stones (more where it is steep), dry tufts, shards.
    const pebbles = bare.pebble * (1 + info.bare * 1.5) * (info.shore ? .6 : 1);
    if (roll < pebbles) {
      place('pebble', .05 + .3 * r(4) ** 2.5, .35, 1, lin(ground, .62 + .2 * r(5)));
      if (DENSE) { // gravel round it, and now and then a flat stone half sunk in the ground
        const g = 1 + Math.floor(r(60) * 3);
        for (let e = 0; e < g; e++) place('pebble', .03 + .07 * r(61 + e), .3, 1, lin(ground, .55 + .3 * r(64 + e)), (r(67 + e) - .5) * cell, (r(70 + e) - .5) * cell);
        if (r(73) < .25) place('pebble', .25 + .45 * r(74), .25, .3, lin(ground, .6 + .2 * r(75)), (r(76) - .5) * cell * .5, (r(77) - .5) * cell * .5, .35);
      }
    } else if (DENSE && roll < pebbles * 1.6) place('pebble', .025 + .05 * r(4), .3, 1, lin(ground, .6 + .25 * r(5))); // scattered grit
    else if (roll < pebbles + bare.dry) place('tuft', .18 + .25 * r(4), .02, .4, lin([.62, .53, .34], .8 + .3 * r(5)));
    else if (roll > 1 - bare.shard) {
      const crystal = t.ground === 'ice' ? [.75, .9, 1] : (body.crystal ? [1, 3, 5].map(o => parseInt(body.crystal.slice(o, o + 2), 16) / 255) : [.8, .7, .9]);
      place('shard', .15 + .5 * r(4) ** 2, .1, .9, lin(crystal));
    }
  }

  // Which cells should be filled around a point; queue the new ones, nearest first.
  function enumerate(p) {
    const l = p.length(), dir = { x: p.x / l, y: p.y / l, z: p.z / l };
    const want = new Set(), near = [];
    for (let f = 0; f < 6; f++) {
      const ab = faceOf(dir, f); if (!ab) continue;
      const scale = R / (1 + ab[0] * ab[0] + ab[1] * ab[1]); // metres per unit of a, b (smallest)
      const span = Math.ceil(reach / (scale * step)) + 1, ci = Math.floor(ab[0] / step), cj = Math.floor(ab[1] / step);
      const [N, U, V] = FACES[f];
      for (let i = ci - span; i <= ci + span; i++) for (let j = cj - span; j <= cj + span; j++) {
        const a = (i + .5) * step, b = (j + .5) * step;
        if (Math.abs(a) > 1 + step || Math.abs(b) > 1 + step) continue;
        const x = N[0] + U[0] * a + V[0] * b, y = N[1] + U[1] * a + V[1] * b, z = N[2] + U[2] * a + V[2] * b, k = Math.hypot(x, y, z);
        const d = Math.acos(Math.min(1, (x * dir.x + y * dir.y + z * dir.z) / k)) * R;
        if (d > reach + cell) continue;
        const key = f * 1e8 + (i + 5000) * 1e4 + (j + 5000);
        want.add(key);
        let rec = cells.get(key);
        if (!rec) { rec = { f, i, j, ready: false, items: null }; cells.set(key, rec); }
        near.push([d, rec]);
      }
    }
    // Forget cells well out of range, so memory stays small however far you walk.
    if (cells.size > want.size * 2.5) for (const [key, rec] of cells) if (!want.has(key)) cells.delete(key);
    // Nearest first, both for filling and for which items are kept if a kind runs out of room.
    active = near.sort((x, y) => x[0] - y[0]).map(x => x[1]);
    pending = active.filter(rec => !rec.ready);
    dirty = true;
  }

  function rebuild() {
    const counts = Object.fromEntries(Object.keys(caps).map((k) => [k, 0]));
    for (const rec of active) {
      if (!rec.ready) continue;
      for (const it of rec.items) {
        const mesh = meshes[it.kind], c = counts[it.kind];
        if (c >= caps[it.kind]) continue;
        mesh.instanceMatrix.array.set(it.m, c * 16);
        mesh.instanceColor.array.set(it.c, c * 3);
        counts[it.kind] = c + 1;
      }
    }
    for (const kind in meshes) {
      const mesh = meshes[kind];
      mesh.count = counts[kind];
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    }
    dirty = false;
  }

  let rebuildTimer = 0;
  return {
    group,
    // p: camera position relative to the world's centre; call every frame.
    update(p, animationTime, budgetMs = coarse ? 2 : 3) {
      time.value = animationTime;
      const ground = R + t.surface({ x: p.x / p.length(), y: p.y / p.length(), z: p.z / p.length() });
      const near = p.length() - ground < 90;
      group.visible = near;
      if (!near) return;
      center.value.copy(p);
      if (!lastAnchor || lastAnchor.distanceTo(p) > cell * 2) { lastAnchor = p.clone(); enumerate(p); }
      const t0 = performance.now();
      while (pending.length && performance.now() - t0 < budgetMs) { const rec = pending.shift(); if (!rec.ready) { fill(rec); dirty = true; } }
      rebuildTimer -= 1;
      if (dirty && (rebuildTimer <= 0 || !pending.length)) { rebuild(); rebuildTimer = 6; }
    },
    get busy() { return pending.length; },
    dispose() { for (const kind in meshes) { meshes[kind].geometry.dispose(); meshes[kind].material.dispose(); meshes[kind].dispose(); } },
  };
}
