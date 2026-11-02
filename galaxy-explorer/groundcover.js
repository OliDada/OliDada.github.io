// Ground cover: grass tufts, flowers, pebbles, ice and crystal shards in a circle
// around the player. Everything sits on a fixed grid laid over the world (a grid on
// each cube face), so a tuft is always in the same spot: walk away and back and
// nothing has moved. Only cells near you are filled; as you move, cells behind you
// are dropped and cells ahead are worked out a few hundred per frame, nearest
// first, so it never stalls. What grows in a cell comes from the ground there
// (terrain.mjs color(): grass, bare rock, snow) and the world's ground type.
// Each kind of item is one instanced mesh, so the whole layer is four draw calls.
// THREE is passed in.
import { terrainFor } from './terrain.mjs';
import { FACES } from './chunk-build.mjs';

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
  const reach = coarse ? 26 : 42, cell = coarse ? 1.25 : .95; // metres
  const caps = coarse ? { tuft: 2600, head: 300, pebble: 1300, shard: 250 } : { tuft: 11000, head: 1400, pebble: 5000, shard: 900 };
  const bare = BARE[t.ground] || (t.airless ? BARE.rocky : BARE.soft);
  const flowers = body.physics?.life === 'complex' ? 1 : body.physics?.life === 'simple' ? .4 : 0;
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
  const geometries = {
    tuft: tuftGeometry(),
    head: flowerGeometry(),
    pebble: pebbleGeometry(),
    shard: new THREE.ConeGeometry(.12, 1, 4, 1).translate(0, .5, 0),
  };
  // Plants sway in the wind; items thin out towards the edge of the circle so
  // nothing pops in or out as you walk.
  function material(kind) {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: kind === 'tuft' || kind === 'head', flatShading: kind !== 'tuft', side: kind === 'tuft' ? THREE.DoubleSide : THREE.FrontSide,
      roughness: kind === 'shard' ? .3 : .95, metalness: kind === 'shard' ? .1 : 0,
    });
    const sway = kind === 'tuft' || kind === 'head';
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { uTime: time, uCenter: center, uFade: fadeR });
      shader.vertexShader = 'uniform float uTime; uniform vec3 uCenter; uniform vec2 uFade;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 coverAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        // Thins out gradually with distance: each item has its own random cut-off, and
        // shrinks away smoothly as you pass it, so there is no edge to the circle.
        float coverT = 1.0 - smoothstep(uFade.x, uFade.y, distance(coverAt, uCenter));
        float coverR = fract(sin(dot(coverAt, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        transformed *= smoothstep(coverR * .8, coverR * .8 + .2, coverT);` + (sway ? `
        float coverPhase = coverAt.x * .41 + coverAt.z * .27 + coverAt.y * .19;
        float coverK = max(transformed.y, 0.0);
        transformed.x += sin(uTime * 1.9 + coverPhase) * .13 * coverK;
        transformed.z += cos(uTime * 1.4 + coverPhase * 1.3) * .08 * coverK;` : ''));
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
    const place = (kind, scale, sink, tilt, colour, du = 0, dv = 0) => {
      const s = scale;
      let px = n.x, py = n.y, pz = n.z, ph = h;
      if (du || dv) { ph = heightAt(px + (U[0] * du + V[0] * dv) / R, py + (U[1] * du + V[1] * dv) / R, pz + (U[2] * du + V[2] * dv) / R); px = m2.x; py = m2.y; pz = m2.z; }
      const rr = R + ph - sink * s;
      dummy.position.set(px * rr, py * rr, pz * rr);
      q.setFromUnitVectors(up, dummy.position.clone().normalize());
      dummy.quaternion.copy(q); dummy.rotateY(r(9) * 6.283); if (tilt) { dummy.rotateX((r(10) - .5) * tilt); dummy.rotateZ((r(11) - .5) * tilt); }
      dummy.scale.set(s, s, s); dummy.updateMatrix();
      rec.items.push({ kind, m: dummy.matrix.toArray(), c: colour });
    };
    const lin = (rgb, k = 1) => { tint.setRGB(rgb[0] * k, rgb[1] * k, rgb[2] * k, THREE.SRGBColorSpace); return [tint.r, tint.g, tint.b]; };
    const roll = r(3);
    const grass = info.veg * Math.max(0, 1 - info.snow * 2.5); // frost and snow thin out the grass
    if (info.snow > .4) { // snow covers whatever grows here
      if (roll < .1) place('pebble', .08 + .2 * r(4) ** 2, .3, 1, lin(ground, 1.05)); // snow clumps
      else if (t.ground === 'ice' && roll > 1 - bare.shard) place('shard', .2 + .6 * r(4) ** 2, .1, .8, lin([.75, .9, 1]));
      return;
    }
    if (grass > .12) {
      // Grassland: tufts thick where the ground is green, a few flowers, the odd pebble.
      const k = 1.15 + .25 * r(5);
      if (roll < grass * .95) {
        place('tuft', .28 + .35 * r(4) * (.6 + grass * .6), .02, .3, lin(ground, k));
        if (r(6) < grass * .6) // a second, smaller tuft beside it
          place('tuft', .2 + .2 * r(7), .02, .5, lin(ground, k * .95), (r(12) - .5) * cell * .6, (r(13) - .5) * cell * .6);
        if (r(8) < .1 * flowers * grass) {
          const hue = [[.95, .85, .3], [.9, .45, .6], [.85, .9, 1], [.7, .5, .95]][Math.floor(r(14) * 4)];
          place('head', .3 + .25 * r(4), .02, .25, lin(hue));
        }
      } else if (roll > .985) place('pebble', .06 + .12 * r(4) ** 2, .35, 1, lin(ground, .7));
      return;
    }
    // Bare ground: pebbles and stones (more where it is steep), dry tufts, shards.
    const pebbles = bare.pebble * (1 + info.bare * 1.5) * (info.shore ? .6 : 1);
    if (roll < pebbles) place('pebble', .05 + .3 * r(4) ** 2.5, .35, 1, lin(ground, .62 + .2 * r(5)));
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
    const counts = { tuft: 0, head: 0, pebble: 0, shard: 0 };
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
