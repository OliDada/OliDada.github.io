// Builds and places plant models for the world you are on. Each species is one
// low-poly model drawn many times with instancing (one draw call per part), and
// a few lines of vertex shader make plants sway. THREE is passed in so this
// module works with whichever copy of three.js the page loads.
//
// Plants grow all over the world, not just at the landing site: the world is
// divided into cells (scatter.js) and each cell works out, from its own hash and
// its climate, what grows in it. Only cells near you are filled and drawn, so you
// find the same plants in the same places wherever you walk or fly, and the cost
// stays the same however big the world is. What grows where comes from the plant
// biome at that spot (flora.mjs plantBiome: forest, grassland, wetland, dry scrub,
// highland, barren), which sets how thick the growth is and which forms are at
// home there, and from each species' own habitat. Species also grow in groves
// and patches rather than evenly mixed. Small plants are only drawn nearby; big
// ones further out, thinning out smoothly at the edge so nothing pops in.
import { rng } from './rng.mjs';
import { floraFor, suitability, plantBiome, PLANT_BIOMES, biomeAffinity } from './flora.mjs';
import { makeNoise } from './terrain.mjs';
import { createScatter, obstacleGrid } from './scatter.js';

const CELL = 12, SLOTS = 7; // metres per cell; places a plant may take root in each cell
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// budget: at most twice this many plants are drawn at once (nearest first), and
// never more than about a million triangles (under half that on coarse devices).
// coarse: phones and weak laptops (shorter view distance).
export function buildFlora(THREE, { body, terrain, radius, signalNormal, landingNormal = signalNormal, budget = 1500, coarse = budget < 1200 }) {
  const { species, environment: env } = floraFor(body);
  const group = new THREE.Group();
  const time = { value: 0 }, center = { value: new THREE.Vector3(1e9, 0, 0) };
  const placed = [];
  if (!species.length) return { group, species, placed, update() {}, nearbyObstacles: (p, out = []) => out, setBlocked() {}, biomeAt: () => null, busy: 0 };

  const reach = coarse ? 220 : 320, cap = Math.round(budget * 2), triangles = coarse ? 4.5e5 : 1.1e6;
  const Y = new THREE.Vector3(0, 1, 0);
  const groves = makeNoise(body.seed, 'flora-groves');
  const kinds = species.map((sp, si) => {
    const r = rng(body.seed, 'plants', sp.id);
    // Several models per species (different branching, lean and twist), one of them in
    // bloom or fruit if the species blooms; each plant picks one.
    const flat = sp.form === 'mat' || sp.form === 'crust';
    const V = flat ? 1 : ['grass', 'mound', 'plume', 'crystal'].includes(sp.form) ? 2 : 3;
    const blooming = V > 1 && sp.bloom && !['none', 'seeds'].includes(sp.bloom);
    const geos = [buildGeometry(THREE, sp, r, { bloom: false })];
    for (let v = 1; v < V; v++) geos.push(buildGeometry(THREE, sp, rng(body.seed, 'plants', sp.id, 'v' + v), { bloom: blooming && v === V - 1 }));
    const view = sp.height < 1.6 ? reach * .45 : sp.height < 4 ? reach * .75 : reach;
    const fade = { value: new THREE.Vector2(view * .7, view) };
    const materials = [false, true].map((foliage) => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: foliage ? .75 : .95 });
      if (foliage && sp.glow > 0) { m.emissive = new THREE.Color(sp.colors.accent).lerp(new THREE.Color(sp.colors.leaf), .4); m.emissiveIntensity = sp.glow * .55; }
      addPlantShader(m, { time, center, fade }, sp);
      return m;
    });
    const meshes = geos.map((g) => newMesh(THREE, g, materials, 32));
    for (const m of meshes) group.add(m);
    return {
      sp, geos, materials, meshes, V, flat, blooming, view, foot: plantFootprint(sp), tris: geos.map(g => (g.index ? g.index.count : g.attributes.position.count) / 3),
      spacing: clamp(2.2 / Math.max(sp.height, .5), .22, 1), // big plants stand further apart
      grove: si * 31.7 + 5, groveFloor: sp.form === 'grass' || flat ? .35 : .06,
    };
  });
  for (const k of kinds) placed.push({ species: k.sp, positions: new Float32Array(0), scales: new Float32Array(0), meshes: k.meshes });
  // Groves: each species thick in some patches (tens of metres across) and thin in others.
  const groveAt = (k, n) => k.groveFloor + (1 - k.groveFloor) * smooth(-.25, .35, groves(n.x * radius / 70 + k.grove, n.y * radius / 70, n.z * radius / 70));

  let blocked = () => false; // settlements clear their ground (setBlocked)
  const n = new THREE.Vector3(), mid = new THREE.Vector3(), dummy = new THREE.Object3D(), tint = new THREE.Color();
  const weight = new Float64Array(kinds.length), quality = new Float64Array(kinds.length);
  function fill(f, i, j, cell) {
    // The climate is read once per cell (it changes over hundreds of metres, not a dozen).
    if (!cell.point(.5, .5, mid)) return null;
    const c = terrain.climate(mid), biome = plantBiome(c, env);
    if (!biome) return null;
    let W = 0;
    for (let s = 0; s < kinds.length; s++) {
      const k = kinds[s];
      quality[s] = biomeAffinity(biome, k.sp.form) * (.15 + .85 * suitability(k.sp, c)) * groveAt(k, mid);
      W += weight[s] = k.sp.abundance * quality[s];
    }
    if (W <= 0) return null;
    const density = PLANT_BIOMES[biome].density, items = [];
    for (let slot = 0; slot < SLOTS; slot++) {
      const h = (q) => cell.hash(slot * 16 + q), u = h(1), v = h(2);
      if (h(3) > cell.area(u, v)) continue; // cells near a cube corner cover less ground
      let roll = h(4) * W, s = 0;
      while (s < kinds.length - 1 && (roll -= weight[s]) > 0) s++;
      const k = kinds[s];
      if (h(5) > density * k.spacing * (.3 + .7 * quality[s])) continue;
      if (!cell.point(u, v, n)) continue;
      if (n.angleTo(signalNormal) < 9 / radius || n.angleTo(landingNormal) < 10 / radius) continue; // keep the site and landing pad clear
      const keep = h(6) <= 1 / 7; // builders clear their ground, but keep a few plants
      if (!keep && blocked(n)) continue;
      const ht = terrain.height(n);
      if (terrain.liquid === 'ice' ? ht <= terrain.sea + .01 : (terrain.liquid === 'water' || terrain.liquid === 'lava') && ht < terrain.sea) continue;
      const r = rng(body.seed, 'plant', f, i, j, slot);
      dummy.position.copy(n).multiplyScalar(radius + ht - .05);
      // Flat growths (mats, crusts) lie along the slope; everything else grows upright.
      dummy.quaternion.setFromUnitVectors(Y, k.flat ? slopeNormal(THREE, terrain, radius, n) : n);
      dummy.rotateY(r() * Math.PI * 2);
      dummy.rotateX((r() - .5) * .12);
      // Each plant its own: young or old, broader or slimmer, a little warmer or cooler in colour.
      let sc = k.flat ? .6 + r() * 1.2 : .7 + r() * .6;
      const age = r();
      if (!k.flat) sc *= age < .12 ? .4 + r() * .25 : age > .94 ? 1.25 + r() * .2 : 1;
      const wide = k.flat ? 1 : .82 + r() * .36;
      dummy.scale.set(sc * wide, sc, sc * (k.flat ? 1 : wide * (.9 + r() * .2)));
      dummy.updateMatrix();
      const b = .88 + r() * .24, d = (r() - .5) * .12, e = (r() - .5) * .06;
      const variant = k.blooming && age >= .12 && r() < k.sp.bloomShare ? k.V - 1 : Math.floor(r() * (k.blooming ? k.V - 1 : k.V));
      tint.setRGB(b * (1 + d), b * (1 + e), b * (1 - d));
      items.push({ s, variant, m: Float32Array.from(dummy.matrix.elements), c: [tint.r, tint.g, tint.b], p: dummy.position.toArray(), sc, view: k.view, keep });
    }
    return items;
  }
  const scatter = createScatter({ radius, cell: CELL, reach, fill });

  // Draws the filled cells, nearest first, up to the cap; also lists every plant
  // (placed: what the scanner, sonar and grazing animals look at) and the obstacles.
  let grid = obstacleGrid([]);
  function rebuild() {
    const counts = kinds.map(k => k.meshes.map(() => 0)), chosen = [];
    let tris = 0;
    for (const rec of scatter.active) {
      if (!rec.ready) continue;
      if (chosen.length >= cap || tris >= triangles) break;
      for (const it of rec.items) if (rec.d <= it.view) { chosen.push(it); counts[it.s][it.variant]++; tris += kinds[it.s].tris[it.variant]; }
    }
    kinds.forEach((k, s) => k.meshes.forEach((m, v) => {
      if (counts[s][v] <= m.instanceMatrix.count) return;
      const grown = newMesh(THREE, k.geos[v], k.materials, Math.ceil(counts[s][v] * 1.5));
      group.remove(m); m.dispose(); group.add(grown);
      k.meshes[v] = placed[s].meshes[v] = grown;
    }));
    const at = kinds.map(k => k.meshes.map(() => 0)), pos = kinds.map(() => []), scl = kinds.map(() => []), obstacles = [];
    for (const it of chosen) {
      const k = kinds[it.s], mesh = k.meshes[it.variant], slot = at[it.s][it.variant]++;
      mesh.instanceMatrix.array.set(it.m, slot * 16);
      mesh.instanceColor.array.set(it.c, slot * 3);
      pos[it.s].push(it.p[0], it.p[1], it.p[2]); scl[it.s].push(it.sc);
      if (k.foot) obstacles.push({ p: new THREE.Vector3(it.p[0], it.p[1], it.p[2]), r: k.foot.r * it.sc, h: k.foot.h * it.sc }); // grasses and mats are walked over
    }
    kinds.forEach((k, s) => {
      k.meshes.forEach((m, v) => { m.count = at[s][v]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
      placed[s].positions = new Float32Array(pos[s]); placed[s].scales = new Float32Array(scl[s]);
    });
    grid = obstacleGrid(obstacles);
  }

  // Fill around the landing pad at once, so you never land in an empty field.
  scatter.prime(landingNormal, coarse ? 140 : 190);
  rebuild();

  let dirty = false, wait = 0;
  const dir = new THREE.Vector3();
  return {
    group, species, placed,
    // t: animation time; camera: camera position relative to the world's centre.
    update(t, camera) {
      time.value = t;
      if (!camera) return;
      dir.copy(camera).normalize();
      const altitude = camera.length() - radius - terrain.surface(dir);
      group.visible = altitude < reach;
      if (!group.visible) return;
      center.value.copy(camera);
      if (scatter.update(dir, coarse ? 2 : 3)) dirty = true;
      if (dirty && (--wait <= 0 || !scatter.busy)) { rebuild(); dirty = false; wait = 8; }
    },
    // Plants you can bump into near a point (grasses and mats are walked over).
    nearbyObstacles: (p, out) => grid.near(p, out),
    // blocked(n): true where builders have cleared the ground; plants there are removed (a few are kept).
    setBlocked(fn) {
      blocked = fn;
      const at = new THREE.Vector3();
      for (const rec of scatter.active) if (rec.ready) rec.items = rec.items.filter(it => it.keep || !fn(at.fromArray(it.p).normalize()));
      rebuild();
    },
    // The plant biome at a surface direction (for the HUD or scanner).
    biomeAt(dirAt) { return plantBiome(terrain.climate(dirAt), env); },
    get busy() { return scatter.busy; },
  };
}

function newMesh(THREE, geometry, materials, capacity) {
  const m = new THREE.InstancedMesh(geometry, materials, capacity);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  m.count = 0; m.frustumCulled = false; // instances are spread around you
  return m;
}

// What you bump into when walking: trunk or body radius and height of one plant
// of this species at scale 1 (grasses and microbial mats are walked over).
export function plantFootprint(sp) {
  const H = sp.height;
  switch (sp.form) {
    case 'tree': case 'conifer': return { r: H * sp.trunkRatio + .25, h: H };
    case 'palm': return { r: H * sp.trunkRatio * .7 + .25, h: H };
    case 'succulent': return { r: H * .12 + .15, h: H };
    case 'fungus': return { r: H * .07 + .2, h: H };
    case 'stalk': return { r: H * .03 + .15, h: H };
    case 'shrub': return { r: H * .45, h: H * .8 };
    case 'mound': return { r: H * .65, h: H * .6 };
    case 'crystal': return { r: H * .25, h: H };
    case 'glasstree': return { r: H * .06 + .25, h: H };
    case 'chimney': return { r: H * .22, h: H };
    case 'plume': return { r: H * .05 + .15, h: H };
    case 'bulb': return { r: H * .4, h: H * .9 };
    case 'sheet': return { r: H * .12 + .15, h: H };
    case 'filament': return { r: .15, h: H };
    default: return null;
  }
}

// Wind: vertices sway more the higher they are on the plant. Plants also thin out
// towards the edge of their view distance (fade: from, to in metres from the
// camera): each has its own cut-off and shrinks away smoothly, so there is no edge.
function addPlantShader(material, { time, center, fade }, sp) {
  const sway = sp.sway > 0;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uTime: time, uCenter: center, uFade: fade, uAmp: { value: sp.sway * .045 * sp.height }, uInvH: { value: 1 / sp.height } });
    shader.vertexShader = 'uniform float uTime; uniform vec3 uCenter; uniform vec2 uFade; uniform float uAmp; uniform float uInvH;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 plantAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float plantT = 1.0 - smoothstep(uFade.x, uFade.y, distance(plantAt, uCenter));
      float plantR = fract(sin(dot(plantAt, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      transformed *= smoothstep(plantR * .8, plantR * .8 + .2, plantT);` + (sway ? `
      float swayK = pow(max(transformed.y * uInvH, 0.0), 2.0) * uAmp;
      float swayPhase = instanceMatrix[3].x * .37 + instanceMatrix[3].z * .23;
      transformed.x += sin(uTime * 1.7 + swayPhase) * swayK;
      transformed.z += cos(uTime * 1.3 + swayPhase * 1.3) * swayK * .6;` : ''));
  };
  material.customProgramCacheKey = () => (sway ? 'plant-sway' : 'plant');
}

// --- Geometry: each form assembled from a few primitives, merged into one mesh
// with two groups (0: stems and trunks, 1: foliage, caps and pods). ---
export function buildGeometry(THREE, sp, r, { bloom = false } = {}) { // exported for previews
  const parts = [], H = sp.height, c = sp.colors;
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
  const add = (geo, matrix, color, foliage) => parts.push({ geo, matrix, color: new THREE.Color(color), foliage });
  const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0);
  const blob = (rad, detail = 0) => new THREE.IcosahedronGeometry(rad, detail);
  const leafScale = { round: [1, .85, 1], umbrella: [1.45, .45, 1.45], column: [.7, 1.6, .7], cluster: [.8, .8, .8] }[sp.leafShape];
  const leaf = (i) => (i % 2 ? c.leaf2 : c.leaf);
  // A leaf or frond: a thin, segmented blade along +x that tapers to a point, droops
  // toward its tip and folds into a shallow V along its midrib.
  const blade = (len, wid, droop, fold = .35, segs = 4) => {
    const g = new THREE.BoxGeometry(len, Math.max(.01, len * .012), wid, segs, 1, 2).translate(len / 2, 0, 0), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const t = P.getX(i) / len, taper = Math.pow(Math.sin(Math.PI * Math.min(1, t * .85 + .15)), .7);
      const z = P.getZ(i) * taper; P.setZ(i, z); P.setY(i, P.getY(i) - droop * len * t * t + Math.abs(z) * fold);
    }
    g.computeVertexNormals(); return g;
  };
  // A grass-like blade standing up along +y, narrowing to a tip and arching over.
  const spear = (len, wid, bend, segs = 3) => {
    const g = new THREE.BoxGeometry(wid, len, Math.max(.008, wid * .15), 1, segs, 1).translate(0, len / 2, 0), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const t = P.getY(i) / len; P.setX(i, P.getX(i) * Math.pow(Math.max(0, 1 - t), .8)); P.setZ(i, P.getZ(i) + bend * len * t * t); P.setY(i, P.getY(i) * (1 - bend * .25 * t)); }
    g.computeVertexNormals(); return g;
  };

  const grow = () => {
  if (sp.form === 'tree') {
    // A trunk in two bent sections with root flares and bark rings, branches with
    // twigs, crowns broken up by smaller clumps, and fruit or blossom on some.
    const trunkH = H * .55, tr = H * sp.trunkRatio, bend = (r() - .5) * .18;
    add(cyl(tr * .82, tr, trunkH * .5, 7), M(), c.stem, false);
    add(cyl(tr * .62, tr * .82, trunkH * .55, 7), M(0, trunkH * .48, 0, 0, 0, bend), c.stem, false);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + r() * .5; add(new THREE.ConeGeometry(tr * .45, tr * 2.2, 4).translate(0, tr * 1.1, 0), new THREE.Matrix4().makeTranslation(Math.cos(a) * tr * .75, -tr * .2, Math.sin(a) * tr * .75).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -.9)), c.stem, false); }
    for (let k = 1; k < 3; k++) add(cyl(tr * (1.02 - k * .1), tr * (1.04 - k * .1), tr * .15, 7), M(0, trunkH * k * .22, 0), c.leaf2, false);
    const topX = Math.sin(-bend) * trunkH * .55, tips = [[topX, trunkH + H * .12, 0]];
    for (let k = 0; k < sp.branches; k++) {
      const a = k / sp.branches * Math.PI * 2 + r() * .6, tilt = .55 + r() * .4, len = H * (.22 + r() * .14), y0 = trunkH * (.6 + r() * .35);
      add(cyl(tr * .3, tr * .5, len, 5), M(0, y0, 0, 0, a, -tilt), c.stem, false);
      const tx = Math.cos(-a) * Math.sin(tilt) * len, ty = y0 + Math.cos(tilt) * len, tz = Math.sin(-a) * Math.sin(tilt) * len;
      add(cyl(tr * .12, tr * .2, len * .5, 4), M(tx * .6, y0 + (ty - y0) * .6, tz * .6, 0, a + 1.2, -tilt * .6), c.stem, false);
      tips.push([tx, ty, tz]);
    }
    tips.forEach(([x, y, z], i) => {
      const rad = H * (i ? .16 : .24) * sp.leafSize, blobs = sp.leafShape === 'cluster' ? 3 : 1;
      for (let b = 0; b < blobs; b++) add(blob(rad * (blobs > 1 ? .7 : 1), 1), M(x + (r() - .5) * rad * (blobs > 1 ? 1 : 0), y + (r() - .5) * rad * .5, z + (r() - .5) * rad * (blobs > 1 ? 1 : 0), 0, r() * 6, 0, ...leafScale), leaf(i + b), true);
      for (let b = 0; b < 2; b++) { const a = r() * 6.28, d = rad * (.75 + r() * .25); add(blob(rad * (.3 + r() * .15), 0), M(x + Math.cos(a) * d * leafScale[0], y + (r() - .3) * rad * leafScale[1], z + Math.sin(a) * d * leafScale[2], 0, r() * 6, 0, ...leafScale), leaf(i + b + 1), true); }
      if (sp.arms > 1 || i === 0) for (let b = 0; b < 2; b++) { const a = r() * 6.28; add(blob(H * .025, 0), M(x + Math.cos(a) * rad * .9 * leafScale[0], y - rad * .2, z + Math.sin(a) * rad * .9 * leafScale[2]), c.accent, true); }
    });
  } else if (sp.form === 'conifer') {
    // Root flares, a tapering trunk, and tiers of drooping boughs that thin toward a spire.
    const tr = H * sp.trunkRatio * .8, tiers = sp.segments + 1;
    add(cyl(tr * .4, tr, H * .92, 6), M(), c.stem, false);
    for (let k = 0; k < 3; k++) { const a = k * 2.09 + r(); add(new THREE.ConeGeometry(tr * .45, tr * 2, 4).translate(0, tr, 0), new THREE.Matrix4().makeTranslation(Math.cos(a) * tr * .6, -tr * .2, Math.sin(a) * tr * .6).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -1)), c.stem, false); }
    for (let i = 0; i < tiers; i++) {
      const f = i / tiers, rad = H * .27 * (1 - f * .72) * sp.leafSize, y = H * (.2 + .68 * f);
      add(new THREE.ConeGeometry(rad, H * .3, 8).translate(0, H * .15, 0), M(0, y, 0, 0, r() * 6), leaf(i), true);
      add(new THREE.CylinderGeometry(rad * .92, rad * 1.08, H * .06, 8, 1, true).translate(0, H * .03, 0), M(0, y - H * .045, 0, 0, r() * 6), leaf(i + 1), true);
    }
    add(new THREE.ConeGeometry(H * .03, H * .14, 5).translate(0, H * .07, 0), M(0, H * .94, 0), c.leaf, true);
  } else if (sp.form === 'palm') {
    // A ringed, leaning trunk; long fronds that droop and fold along the midrib; a fruit cluster.
    const tr = H * sp.trunkRatio * .7, seg = 5, lean = (r() - .5) * .5;
    let x = 0, y = 0;
    for (let i = 0; i < seg; i++) {
      const l = H / seg, m = M(x, y, 0, 0, 0, -lean * i * .3);
      add(cyl(tr * (1 - i * .1), tr * (1.05 - i * .1), l * 1.05, 7), m, c.stem, false);
      add(cyl(tr * (1.12 - i * .1), tr * (1.12 - i * .1), l * .12, 7), m, c.leaf2, false);
      x += Math.sin(lean * i * .3) * l; y += Math.cos(lean * i * .3) * l;
    }
    add(cyl(tr * 1.4, tr * .9, H * .06, 7), M(x, y - H * .05, 0), c.stem, false);
    const fronds = 7 + (sp.seed % 4), len = H * .45 * sp.leafSize;
    for (let i = 0; i < fronds; i++) {
      const a = i / fronds * Math.PI * 2 + r() * .3, rise = .25 - r() * .5;
      add(blade(len, len * .26, .35 + r() * .35, .45, 4), new THREE.Matrix4().makeTranslation(x, y, 0).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(rise)), leaf(i), true);
    }
    for (let i = 0; i < 2; i++) { const a = i * 3 + r(); add(blade(len * .5, len * .18, -.2, .4, 3), new THREE.Matrix4().makeTranslation(x, y + H * .02, 0).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(1.1)), c.leaf, true); }
    for (let i = 0; i < 5; i++) add(blob(H * .035), M(x + (r() - .5) * tr * 3, y - H * .04 - r() * H * .03, (r() - .5) * tr * 3), c.accent, true);
  } else if (sp.form === 'shrub') {
    // Several stems, a mounded crown broken into clumps, twigs poking out, and blossom or berries.
    for (let i = 0; i < 3; i++) { const a = i * 2.09 + r(); add(cyl(H * .025, H * .045, H * .45, 4), M(Math.cos(a) * H * .06, 0, Math.sin(a) * H * .06, 0, -a, .25), c.stem, false); }
    const blobs = 4 + (sp.seed % 3);
    for (let i = 0; i < blobs; i++) { const a = i / blobs * Math.PI * 2, d = H * .3; add(blob(H * .27 * sp.leafSize, 1), M(Math.cos(a) * d, H * (.4 + r() * .2), Math.sin(a) * d, 0, r() * 6, 0, ...leafScale), leaf(i), true); }
    add(blob(H * .34 * sp.leafSize, 1), M(0, H * .7, 0, 0, 0, 0, ...leafScale), c.leaf, true);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + r() * .5, d = H * (.45 + r() * .12); add(blob(H * (.1 + r() * .06) * sp.leafSize, 0), M(Math.cos(a) * d, H * (.3 + r() * .55), Math.sin(a) * d, 0, r() * 6, 0), leaf(i + 1), true); }
    for (let i = 0; i < 5; i++) { const a = r() * 6.28, m = M(Math.cos(a) * H * .3, H * (.5 + r() * .3), Math.sin(a) * H * .3, 0, -a, -1 - r() * .4); add(cyl(H * .006, H * .012, H * .3, 3), m, c.stem, false); }
    const n = sp.arms > 1 ? 9 : 4;
    for (let i = 0; i < n; i++) { const a = r() * 6.28, d = H * (.42 + r() * .12), y = H * (.45 + r() * .4); add(blob(H * (sp.arms > 1 ? .055 : .035), 0), M(Math.cos(a) * d, y, Math.sin(a) * d), c.accent, true); }
  } else if (sp.form === 'grass') {
    // Arching flat blades in a clump, a few bearing seed heads.
    const blades = 7 + (sp.seed % 4);
    for (let i = 0; i < blades; i++) {
      const a = i / blades * Math.PI * 2 + r(), h = H * (.7 + r() * .4), bend = .15 + r() * .35;
      add(spear(h, H * .09, bend, 2), M(Math.cos(a) * H * .07, 0, Math.sin(a) * H * .07, 0, a + Math.PI / 2, 0), leaf(i), true);
    }
    for (let i = 0; i < 2; i++) { const a = r() * 6.28, h = H * (1 + r() * .3), tilt = .1 + r() * .2; const m = M(Math.cos(a) * H * .05, 0, Math.sin(a) * H * .05, 0, a, tilt); add(cyl(H * .008, H * .012, h, 3), m, c.leaf2, true); add(blob(H * .04, 0), m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, h, 0), new THREE.Quaternion(), new THREE.Vector3(1, 2.4, 1))), c.accent, true); }
    add(cyl(H * .08, H * .1, H * .05, 5), M(), c.stem, false);
  } else if (sp.form === 'succulent') {
    // A ribbed column with spines in rows, ribbed arms, and a flower crowning the top.
    const R = H * .12, ribs = 8;
    add(cyl(R, R * 1.05, H * .85, ribs), M(), c.leaf, true);
    add(blob(R, 1), M(0, H * .85, 0, 0, 0, 0, 1, .7, 1), c.leaf, true);
    for (let i = 0; i < ribs; i++) { const a = (i + .5) / ribs * Math.PI * 2; add(new THREE.BoxGeometry(R * .22, H * .8, R * .22).translate(0, H * .4, 0), M(Math.cos(a) * R * .95, 0, Math.sin(a) * R * .95, 0, -a + Math.PI / 4), c.leaf2, true);
      for (let j = 1; j < 5; j++) add(new THREE.ConeGeometry(R * .05, R * .45, 3).rotateZ(-Math.PI / 2), M(Math.cos(a) * R * 1.12, H * j * .17, Math.sin(a) * R * 1.12, 0, -a, .3), c.stem, true); }
    for (let i = 0; i < sp.arms; i++) {
      const a = i / Math.max(1, sp.arms) * Math.PI * 2 + r(), y0 = H * (.3 + r() * .25), out = R * 2.4, up = H * (.2 + r() * .15), ar = R * .7;
      add(cyl(ar, ar, out, 7), M(0, y0, 0, 0, a, -Math.PI / 2), c.leaf2, true);
      add(cyl(ar, ar, up, 7), M(Math.cos(-a) * out, y0 - ar * .2, Math.sin(-a) * out), c.leaf2, true);
      add(blob(ar * .9), M(Math.cos(-a) * out, y0 + up, Math.sin(-a) * out, 0, 0, 0, 1, .7, 1), c.leaf2, true);
      for (let j = 0; j < 4; j++) { const b = j * 1.57; add(new THREE.BoxGeometry(ar * .18, up * .9, ar * .18).translate(0, up * .45, 0), M(Math.cos(-a) * out + Math.cos(b) * ar * .95, y0, Math.sin(-a) * out + Math.sin(b) * ar * .95, 0, -b + Math.PI / 4), c.leaf, true); }
    }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.ConeGeometry(R * .22, R * .7, 3).translate(0, R * .35, 0), M(0, H * .85 + R * .45, 0, 0, a, .7), c.accent, true); }
    add(blob(R * .25), M(0, H * .85 + R * .6, 0), c.leaf2, true);
    add(cyl(R * 1.2, R * 1.3, .05, 8), M(), c.stem, false);
  } else if (sp.form === 'fungus') {
    // Caps with gills beneath and spots on top, a ring on the stem and a bulbous foot.
    const caps = 1 + (sp.seed % 3);
    for (let i = 0; i < caps; i++) {
      const h = H * (i ? .45 + r() * .3 : 1), sr = h * .07, cr = h * (.32 + r() * .12) * sp.leafSize, x = i ? (r() - .5) * H * .7 : 0, z = i ? (r() - .5) * H * .7 : 0, flat = sp.leafShape === 'column' ? .8 : .42;
      add(blob(sr * 1.8, 0), M(x, sr * .6, z, 0, 0, 0, 1, .7, 1), c.stem, false);
      add(cyl(sr * .8, sr * 1.3, h, 7), M(x, 0, z), c.stem, false);
      add(new THREE.CylinderGeometry(sr * 1.6, sr * 1.05, h * .04, 8, 1, true), M(x, h * .72, z), c.leaf2, false);
      add(new THREE.ConeGeometry(cr * .95, cr * flat * .9, 12, 1, true).rotateX(Math.PI).translate(0, cr * flat * .45, 0), M(x, h - cr * flat * .5, z), c.stem, false);
      add(blob(cr, 1), M(x, h, z, 0, 0, 0, 1, flat, 1), i % 2 ? c.accent : c.leaf, true);
      for (let j = 0; j < 6; j++) { const a = r() * 6.28, d = cr * (.2 + r() * .55); add(blob(cr * (.07 + r() * .06), 0), M(x + Math.cos(a) * d, h + cr * flat * Math.sqrt(Math.max(0, 1 - (d / cr) ** 2)) * .97, z + Math.sin(a) * d, 0, 0, 0, 1, .4, 1), i % 2 ? c.leaf : c.accent, true); }
    }
  } else if (sp.form === 'stalk') {
    // A jointed stalk with leaves at the nodes, a basal rosette and a crown of pods.
    add(cyl(H * .018, H * .03, H, 5), M(), c.stem, false);
    for (let j = 1; j < 4; j++) { const y = H * j * .2; add(cyl(H * .026, H * .026, H * .02, 5), M(0, y, 0), c.leaf2, false); add(blade(H * .2, H * .05, .4, .3, 3), M(0, y, 0, 0, j * 2.3, .5), c.leaf, true); }
    const pods = 2 + sp.segments % 4;
    for (let i = 0; i < pods; i++) {
      const y = H * (.55 + .45 * i / pods), a = r() * 6.28, d = i === pods - 1 ? 0 : H * .06;
      add(blob(H * (.05 + r() * .05), 1), M(Math.cos(a) * d, y, Math.sin(a) * d, 0, 0, 0, 1, 1.3, 1), c.accent, true);
    }
    for (let i = 0; i < 6; i++) add(blade(H * .18, H * .06, .5, .3, 3), M(0, H * .01, 0, 0, i * 1.05 + r() * .3, .2), leaf(i), true);
  } else if (sp.form === 'mat') {
    // Overlapping patches, each a little thicker than the last so no two tops are
    // level (level tops flicker against each other), and each reaching down into the
    // ground so uneven terrain never shows beneath or pokes through a gap.
    const sink = .6;
    for (let i = 0; i < 6; i++) { const rad = .5 + r() * 1.3, h = H * (1 + i * .35); add(cyl(rad, rad * 1.05, h + sink, 9), M((r() - .5) * 3, -sink, (r() - .5) * 3, 0, r() * 6), leaf(i), true); }
    add(cyl(.2, .2, .01, 5), M(), c.stem, false);
  } else if (sp.form === 'mound') {
    // A layered cushion studded with smaller buds and a few flowers.
    const layers = 2 + sp.segments % 3;
    for (let i = 0; i < layers; i++) { const rad = H * (.75 - i * .15); add(blob(rad, 1), M((r() - .5) * .2, H * .25 * i, (r() - .5) * .2, 0, r() * 6, 0, 1, .55, 1), c.leaf2, false); }
    add(blob(H * .3, 1), M(0, H * .25 * layers + H * .05, 0, 0, 0, 0, 1, .5, 1), c.leaf, true);
    for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = H * (.3 + r() * .4); add(blob(H * (.08 + r() * .06), 0), M(Math.cos(a) * d, H * (.15 + r() * .3), Math.sin(a) * d, 0, r() * 6, 0, 1, .7, 1), i % 3 ? c.leaf : c.accent, true); }
  } else if (sp.form === 'crystal') {
    // A cluster of hexagonal prisms with pointed tips, leaning outward.
    const n = 5 + sp.seed % 5;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r(), tilt = i ? .25 + r() * .5 : 0, h = H * (i ? .4 + r() * .5 : 1), w = H * (.06 + r() * .05);
      const m = M(Math.cos(a) * H * .08, 0, Math.sin(a) * H * .08, 0, a, tilt);
      add(cyl(w, w, h * .8, 6), m, leaf(i), true);
      add(new THREE.ConeGeometry(w, h * .2, 6).translate(0, h * .9, 0), m, i % 3 ? c.leaf : c.accent, true);
    }
    add(cyl(H * .2, H * .25, H * .06, 6), M(), c.stem, false);
  } else if (sp.form === 'glasstree') {
    // A faceted glass trunk that splits into angled crystal branches.
    const tr = H * .06;
    add(cyl(tr * .7, tr, H * .5, 5), M(), c.stem, false);
    const n = 3 + sp.seed % 3;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r() * .5, tilt = .45 + r() * .4, len = H * (.35 + r() * .2), y0 = H * (.4 + r() * .1);
      add(cyl(tr * .25, tr * .5, len, 5), M(0, y0, 0, 0, a, -tilt), c.stem, false);
      const tx = Math.cos(-a) * Math.sin(tilt) * len, ty = y0 + Math.cos(tilt) * len, tz = Math.sin(-a) * Math.sin(tilt) * len;
      for (let k = 0; k < 3; k++) add(new THREE.ConeGeometry(H * .04, H * (.15 + r() * .12), 5).translate(0, H * .08, 0), M(tx, ty, tz, (r() - .5) * .9, r() * 6, (r() - .5) * .9), k ? leaf(i + k) : c.accent, true);
    }
    add(new THREE.ConeGeometry(H * .05, H * .3, 5).translate(0, H * .15, 0), M(0, H * .5, 0), c.accent, true);
  } else if (sp.form === 'chimney') {
    // A rough mineral chimney; tube-feeders crowd its rim.
    const tiers = 3 + sp.segments % 3;
    for (let i = 0; i < tiers; i++) { const f = i / tiers, rad = H * (.22 - f * .1); add(cyl(rad * .85, rad, H / tiers * 1.05, 7), M((r() - .5) * H * .03, H * f, (r() - .5) * H * .03, 0, r() * 6), i % 2 ? c.stem : c.leaf2, false); }
    const tubes = 6 + sp.seed % 6;
    for (let i = 0; i < tubes; i++) {
      const a = r() * 6.28, d = H * (.05 + r() * .08), h = H * (.2 + r() * .2), m = M(Math.cos(a) * d, H * .95, Math.sin(a) * d, (r() - .5) * .5, 0, (r() - .5) * .5);
      add(cyl(H * .015, H * .015, h, 4), m, c.leaf, true);
      add(blob(H * .03), new THREE.Matrix4().copy(m).multiply(new THREE.Matrix4().makeTranslation(0, h, 0)), c.accent, true);
    }
  } else if (sp.form === 'plume') {
    // Feathery fans on a short stalk, like a sea pen.
    add(cyl(H * .03, H * .05, H * .45, 5), M(), c.stem, false);
    const n = 5 + sp.seed % 4;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, tilt = .3 + r() * .5;
      add(new THREE.ConeGeometry(H * .09, H * .6, 3).scale(1, 1, .2).translate(0, H * .3, 0), M(0, H * .4, 0, 0, a, tilt), leaf(i), true);
    }
    add(blob(H * .07), M(0, H * .45, 0), c.accent, true);
  } else if (sp.form === 'bulb') {
    // Waxy swollen bulbs on short necks, in a clump.
    const n = 3 + sp.seed % 4;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r(), d = i ? H * .3 : 0, h = H * (i ? .35 + r() * .3 : .7), rad = H * (.18 + r() * .12) * sp.leafSize;
      add(cyl(rad * .2, rad * .3, h, 6), M(Math.cos(a) * d, 0, Math.sin(a) * d), c.stem, false);
      add(blob(rad, 1), M(Math.cos(a) * d, h + rad * .6, Math.sin(a) * d, 0, r() * 6, 0, 1, 1.25, 1), leaf(i), true);
      if (i % 2 === 0) add(blob(rad * .3), M(Math.cos(a) * d, h + rad * 1.75, Math.sin(a) * d), c.accent, true);
    }
  } else if (sp.form === 'sheet') {
    // Thin upright sails, slightly curled, catching the faint light.
    const n = 2 + sp.seed % 3;
    add(cyl(H * .06, H * .08, H * .08, 6), M(), c.stem, false);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI + r() * .4, w = H * (.25 + r() * .15), h = H * (.7 + r() * .3);
      const g = new THREE.BoxGeometry(w, h, .04, 4, 6, 1).translate(0, h / 2, 0), P = g.attributes.position;
      for (let k = 0; k < P.count; k++) {
        const f = P.getY(k) / h, taper = Math.sin(Math.min(1, f * 1.15 + .12) * Math.PI) * .9 + .1; // narrow base, broad middle, pointed tip
        P.setX(k, P.getX(k) * taper); P.setZ(k, P.getZ(k) + (P.getX(k) / w) ** 2 * w * 1.2 + Math.sin(f * 3) * w * .12 + f * f * w * .5);
      }
      add(g, M(0, H * .05, 0, 0, a, (r() - .5) * .25), leaf(i), true);
    }
  } else if (sp.form === 'filament') {
    // A towering thin thread, beaded with pods; only possible in deep cold and weak winds.
    add(cyl(H * .006, H * .012, H, 4), M(), c.stem, false);
    const beads = 4 + sp.segments;
    for (let i = 1; i <= beads; i++) add(blob(H * (.012 + .014 * (i % 3 === 0)), 0), M(0, H * i / (beads + 1), 0, 0, 0, 0, 1, 1.6, 1), i % 3 === 0 ? c.accent : c.leaf, true);
    for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(H * .01, H * .08, 3).translate(0, H * .04, 0), M(0, H, 0, 0, i * 1.57, .7), c.leaf2, true);
  } else if (sp.form === 'crust') {
    // Overlapping plates of dark growth, built up in layers.
    for (let i = 0; i < 7; i++) { const rad = .4 + r() * 1.1, h = H * (.3 + r() * .7) * (1 + i * .04); add(cyl(rad * .8, rad, h + .5, 7), M((r() - .5) * 2.6, -.5, (r() - .5) * 2.6, (r() - .5) * .2, r() * 6, (r() - .5) * .2), leaf(i), true); }
    add(cyl(.2, .2, .01, 5), M(), c.stem, false);
  }

  };

  // Growth habit: several stems from one root, or one.
  if (sp.growth === 'multi' && !['mat', 'crust', 'grass'].includes(sp.form)) {
    const stems = 2 + (r() < .4 ? 1 : 0);
    for (let k = 0; k < stems; k++) {
      const from = parts.length; grow();
      if (!k) continue;
      const a = k / stems * Math.PI * 2 + r() * .8, d = H * (.06 + r() * .06) + H * sp.trunkRatio * 1.5, sc = .6 + r() * .25;
      const T = new THREE.Matrix4().makeTranslation(Math.cos(a) * d, 0, Math.sin(a) * d).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -(.1 + r() * .15))).multiply(new THREE.Matrix4().makeScale(sc, sc, sc));
      for (let q = from; q < parts.length; q++) parts[q].matrix.premultiply(T);
    }
  } else grow();

  // Where the foliage is (crowns, clumps, caps, bulbs) and the top of the stems, for the
  // traits below.
  // Each as an ellipsoid from its bounding box: centre and semi-axes.
  const shapeOf = (p) => { const g = p.geo.clone().applyMatrix4(p.matrix); g.computeBoundingBox(); const bb = g.boundingBox; g.dispose(); const size = bb.getSize(new THREE.Vector3()).multiplyScalar(.5); return { center: bb.getCenter(new THREE.Vector3()), axes: size, radius: Math.max(size.x, size.z) }; };
  const crowns = parts.filter(p => p.foliage).map(shapeOf).filter(q => q.radius > H * .05).sort((a, b) => b.radius - a.radius).slice(0, 10);
  // A point on a crown's surface: on its upper half (blossom) or underside (fruit, vines).
  const tip = (q, up) => { const a = r() * Math.PI * 2, el = up ? r() * 1.2 : -.3 - r() * 1.1, k = .92; return new THREE.Vector3(q.center.x + Math.cos(a) * Math.cos(el) * q.axes.x * k, q.center.y + Math.sin(el) * q.axes.y * k, q.center.z + Math.sin(a) * Math.cos(el) * q.axes.z * k); };
  // Weeping crowns: strands hanging from the rim of each crown.
  if (sp.weeping) for (const q of crowns.slice(0, 6)) for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + r() * .5, L0 = q.radius * (1.1 + r() * .9), x = q.center.x + Math.cos(a) * q.axes.x * .8, z = q.center.z + Math.sin(a) * q.axes.z * .8;
    add(cyl(q.radius * .07, q.radius * .03, L0, 3).rotateX(Math.PI), M(x, q.center.y - q.axes.y * .2, z, 0, 0, 0), k % 2 ? c.leaf : c.leaf2, true);
  }
  // Trailing vines from the crowns and moss on the trunk.
  if (sp.vines) {
    for (const q of crowns.slice(0, 4)) for (let k = 0; k < 3; k++) {
      // An ivy-like strand: a chain of small overlapping leaf clumps, thinning toward its end.
      const p0 = tip(q, false), n = 4 + Math.floor(r() * 4), st = H * .03;
      for (let j = 0; j < n; j++) add(blob(H * .024 * (1 - j / n * .5), 0), M(p0.x + Math.sin(j * 1.7) * st * .3, p0.y - j * st, p0.z + Math.cos(j * 1.3) * st * .3, 0, r() * 6, 0, 1, 1.3, 1), j % 2 ? c.leaf : c.leaf2, true);
    }
    const tr = H * (sp.trunkRatio || .05);
    for (let k = 0; k < 4; k++) { const a = r() * 6.28; add(blob(tr * (.5 + r() * .4), 0), M(Math.cos(a) * tr * .9, H * (.1 + r() * .35), Math.sin(a) * tr * .9, 0, 0, 0, 1, 1.6, 1), c.leaf2, false); }
  }
  // In bloom: blossom, fruit, berries, a flower, or spores, in the species' bloom colour.
  if (bloom && crowns.length) {
    const col = c.bloom || c.accent;
    if (sp.bloom === 'blossom') for (const q of crowns.slice(0, 6)) for (let k = 0; k < 9; k++) { const p0 = tip(q, true); add(blob(Math.max(H * .02, q.radius * .09), 0), M(p0.x, p0.y, p0.z, 0, r() * 6, 0, 1, .6, 1), col, true); }
    if (sp.bloom === 'fruit') for (const q of crowns.slice(0, 5)) for (let k = 0; k < 4; k++) { const p0 = tip(q, false), fr = Math.max(H * .03, q.radius * .12); add(cyl(fr * .08, fr * .08, fr * .9, 3).rotateX(Math.PI), M(p0.x, p0.y, p0.z), c.stem, true); add(blob(fr, 1), M(p0.x, p0.y - fr * 1.6, p0.z, 0, 0, 0, 1, 1.25, 1), col, true); }
    if (sp.bloom === 'berries') for (const q of crowns.slice(0, 6)) for (let k = 0; k < 4; k++) { const p0 = tip(q, r() < .5), br = Math.max(H * .018, q.radius * .07); for (let j = 0; j < 3; j++) add(blob(br, 0), M(p0.x + (j - 1) * br * 1.4, p0.y - (j % 2) * br, p0.z), col, true); }
    if (sp.bloom === 'flower' || sp.bloom === 'spores') {
      const q = crowns.reduce((a, b) => (b.center.y + b.axes.y > a.center.y + a.axes.y ? b : a)), top = q.center.y + q.axes.y * .9, fr = Math.max(q.radius * 1.1, H * .08);
      if (sp.bloom === 'flower') { for (let k = 0; k < 7; k++) add(new THREE.ConeGeometry(fr * .28, fr, 3).translate(0, fr * .5, 0), M(q.center.x, top, q.center.z, 0, k / 7 * Math.PI * 2, .75), col, true); add(blob(fr * .3, 0), M(q.center.x, top + fr * .1, q.center.z), c.accent, true); }
      else for (const q2 of crowns.slice(0, 3)) for (let k = 0; k < 6; k++) add(blob(H * .012, 0), M(q2.center.x + (r() - .5) * q2.radius * 1.6, q2.center.y + q2.axes.y + q2.radius * (.15 + r() * .5), q2.center.z + (r() - .5) * q2.radius * 1.6), col, true);
    }
  }
  // Growth habit: a lean for the whole plant.
  if (sp.growth === 'leaning') { const lean = new THREE.Matrix4().makeRotationZ(.1 + r() * .18); for (const p of parts) p.matrix.premultiply(lean); }
  const twist = sp.growth === 'twisted' ? (.7 + r() * .6) * (r() < .5 ? -1 : 1) : 0, bend = (r() - .5) * .12;
  const PALE = new THREE.Color('#ddd6c8'), tmp = new THREE.Color();

  // Merge: stems first, then foliage, each part non-indexed with its colour baked in.
  const ordered = [...parts.filter(p => !p.foliage), ...parts.filter(p => p.foliage)];
  const pos = [], nor = [], col = [];
  let stemVerts = 0;
  for (const p of ordered) {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo).applyMatrix4(p.matrix);
    // A twisted habit turns the plant about its axis more the higher it goes, with an S-bend.
    if (twist) { const A = g.attributes.position; for (let i = 0; i < A.count; i++) { const y = A.getY(i), t = Math.max(0, y / H), a = twist * t, x = A.getX(i), z = A.getZ(i); A.setXYZ(i, x * Math.cos(a) - z * Math.sin(a) + Math.sin(t * Math.PI) * H * bend, y, x * Math.sin(a) + z * Math.cos(a)); } }
    g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    // Bark: banded, pale with dark marks, or mottled; colour is set per face so it stays crisp.
    const barked = !p.foliage && sp.bark && sp.bark !== 'plain';
    for (let i = 0; i < P.length; i += 9) {
      tmp.copy(p.color);
      if (barked) {
        const cy = (P[i + 1] + P[i + 4] + P[i + 7]) / 3, hsh = ((((i / 9) | 0) * 2654435761 + pos.length) >>> 0) % 1000 / 1000;
        if (sp.bark === 'banded') tmp.multiplyScalar(Math.floor(cy / (H * .05)) % 2 ? .8 : 1.08);
        else if (sp.bark === 'pale') { tmp.lerp(PALE, .7); if (hsh < .18) tmp.multiplyScalar(.45); }
        else tmp.multiplyScalar(.78 + hsh * .38);
      }
      for (let k = i; k < i + 9 && k < P.length; k += 3) { pos.push(P[k], P[k + 1], P[k + 2]); nor.push(N[k], N[k + 1], N[k + 2]); col.push(tmp.r, tmp.g, tmp.b); }
    }
    if (!p.foliage) stemVerts += P.length / 3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.addGroup(0, stemVerts, 0);
  geometry.addGroup(stemVerts, pos.length / 3 - stemVerts, 1);
  geometry.computeBoundingSphere();
  return geometry;
}

// The ground's own normal at n, from heights 1.5 m away in two directions.
function slopeNormal(THREE, terrain, radius, n) {
  const a = new THREE.Vector3(0, 1, 0).cross(n);
  if (a.lengthSq() < 1e-6) a.set(1, 0, 0).cross(n);
  a.normalize();
  const b = n.clone().cross(a), at = (d) => { const m = n.clone().addScaledVector(d, 1.5 / radius).normalize(); return m.multiplyScalar(radius + terrain.height(m)); };
  const p0 = n.clone().multiplyScalar(radius + terrain.height(n)), g = at(b).sub(p0).cross(at(a).sub(p0)).normalize();
  return g.dot(n) < 0 ? g.negate() : g;
}
