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
import { wind, WIND_GLSL } from './wind.mjs';
import { STRESS } from './look.js';
import { PLANT_STYLE } from './style.mjs';
import { FOREST_FORMS, forestDecor } from './flora-forest.js';
import { leafTexture, leafCards, leafSurface, leavesAvailable, OPAQUE_U } from './flora-leaves.js';
import { softenNormals } from './soften.js';
import { UNDERSTORY } from './flora-understory.js';

const CELL = 12, SLOTS = 7 * STRESS; // metres per cell; places a plant may take root in each cell (STRESS: test multiplier, look.js)
const NEW = PLANT_STYLE !== 'classic';
let THREE_CHUNKS = null; // three.js's shader chunks (set by buildFlora), for the leaf cards' shading
// New plant style: how thickly trees stand in each plant biome (share of the nine tree
// spots in a cell, 4 m apart, that hold a tree). The dark heart of a forest is a tree
// every 25-30 m², shoulder to shoulder; glades open where the stand thins.
const WOODS = { darkwood: .97, forest: .7, wetland: .25, highland: .16, grassland: .07, dryland: .03, barren: 0 };
// Treeless worlds: how thickly their biggest plants stand instead (same spots as trees).
const BUSHES = { darkwood: 1, forest: .95, wetland: .6, highland: .45, grassland: .55, dryland: .25, barren: .02 };
const TALL = 4; // metres: plants at least this tall take the tree spots (and get a distant model)
const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// budget: at most twice this many plants are drawn at once (nearest first), and
// never more than about a million triangles (under half that on coarse devices).
// coarse: phones and weak laptops (shorter view distance).
export function buildFlora(THREE, { body, terrain, radius, signalNormal, landingNormal = signalNormal, budget = 1500, coarse = budget < 1200 }) {
  THREE_CHUNKS = THREE.ShaderChunk;
  const { species, environment: env } = floraFor(body);
  const group = new THREE.Group();
  const time = { value: 0 }, center = { value: new THREE.Vector3(1e9, 0, 0) };
  const placed = [];
  if (!species.length) return { group, species, placed, update() {}, nearbyObstacles: (p, out = []) => out, setBlocked() {}, biomeAt: () => null, busy: 0 };

  const FAR = coarse ? 45 : 75; // metres: beyond this plants use their lighter model
  // Between models, plants dissolve from one into the other over a band this wide (no
  // popping): both are drawn there, each covering the share of pixels the other leaves.
  const BAND = coarse ? 6 : 10, DIST_BAND = coarse ? 14 : 24;
  // New plant style: beyond DISTANT, trees use a third, very light model (a few dozen
  // triangles), which is what lets a whole forest stand around you.
  const DISTANT = coarse ? 90 : 120, FAR_TREE = coarse ? 30 : 45; // forest trees switch to their lighter model sooner
  const reach = coarse ? 220 : 320, cap = Math.round(budget * 2 * STRESS), triangles = (coarse ? 4.5e5 : NEW ? .75e6 : 1.1e6) * STRESS;
  // New plant style: trees are filled and drawn much farther out (treeReach, their own grid
  // of cells, filled nearest first like the rest), thinning out towards the horizon, so the
  // country is wooded as far as you can see and from the air too.
  const treeReach = NEW ? (coarse ? 420 : 720) : reach, treeCap = Math.round(budget * (coarse ? 3 : 6) * STRESS), treeTriangles = (coarse ? 3e5 : 1.1e6) * STRESS;
  const Y = new THREE.Vector3(0, 1, 0);
  const groves = makeNoise(body.seed, 'flora-groves');
  // Worlds without trees (simple life: shrubs, caps, pillars...): their biggest land plants
  // take the trees' place, so hills are covered as far as you can see from the air too.
  const hasTrees = species.some((sp) => !sp.aquatic && sp.height >= TALL);
  const standsIn = (sp) => NEW && !sp.aquatic && !['mat', 'crust', 'grass'].includes(sp.form) && (sp.height >= TALL || (!hasTrees && sp.height >= .3));
  const kinds = species.map((sp, si) => {
    const r = rng(body.seed, 'plants', sp.id);
    // Several models per species (different branching, lean and twist), one of them in
    // bloom or fruit if the species blooms; each plant picks one.
    const flat = sp.form === 'mat' || sp.form === 'crust';
    const V = flat ? 1 : ['grass', 'mound', 'plume', 'crystal'].includes(sp.form) ? 2 : 3;
    const blooming = V > 1 && sp.bloom && !['none', 'seeds'].includes(sp.bloom);
    const variantRng = (v) => v ? rng(body.seed, 'plants', sp.id, 'v' + v) : rng(body.seed, 'plants', sp.id);
    const geos = [], farGeos = [];
    for (let v = 0; v < V; v++) {
      geos.push(buildGeometry(THREE, sp, variantRng(v), { bloom: blooming && v === V - 1, leaves: leafyForm(sp) && leavesAvailable() }));
      // Plants beyond FAR metres use a lighter model, built from the same random numbers.
      farGeos.push(buildGeometry(THREE, sp, variantRng(v), { bloom: blooming && v === V - 1, far: true, leaves: leafyForm(sp) && leavesAvailable() }));
    }
    const view = standsIn(sp) ? treeReach : sp.height < 1.6 ? reach * .45 : sp.height < 4 ? reach * .75 : reach;
    const fade = { value: new THREE.Vector2(view * (view > reach ? .82 : .7), view) };
    // One material, so each model is one draw call; only glowing species need a second
    // one for their glowing foliage (the geometry keeps its two groups: stems, foliage).
    // Each level of detail (near, far, distant) has its own materials, which say over which
    // distances that model fades in and out (uLod: in from x to y, out from z to w).
    const tallK = standsIn(sp), nearOut = tallK ? FAR_TREE : FAR, distantK = tallK && !flat;
    // (Distance bands in the shader are switched off, all levels always shown: the models are
    // chosen when the plants are re-sorted, a few times a second, and a band judged by the
    // shader's live distance hid plants whose other model had not been added yet, so trees
    // blinked out as you flew toward them. Kept as uniforms for a later, per-plant fade.)
    const ALWAYS = [-2, -1, 1e9, 2e9], LODS = [ALWAYS, ALWAYS, ALWAYS, ALWAYS];
    const material = (foliage, level = 0) => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: !NEW, roughness: foliage === null ? .88 : foliage ? .75 : .95 }); // (new style: softened facets, soften.js)
      if (foliage && sp.glow > 0) { m.emissive = new THREE.Color(sp.colors.accent).lerp(new THREE.Color(sp.colors.leaf), .4); m.emissiveIntensity = sp.glow * .55; }
      if (NEW) m.defines = { PLANT_SURFACE: 1, ...(foliage === false ? { PLANT_BARK: 1 } : {}) }; // surface texture (addPlantShader)
      addPlantShader(m, { time, center, fade, lod: { value: new THREE.Vector4(...LODS[level]) } }, sp);
      return m;
    };
    // New plant style: leafy forms get leaf cards (flora-leaves.js) on a foliage material of
    // their own, cut out by the leaf texture and lit softly on both sides.
    const leafy = leafyForm(sp) && leavesAvailable();
    const leafMaterial = (level = 0) => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, map: leafTexture(THREE, sp, body.seed), alphaTest: .42, side: THREE.DoubleSide });
      m.defines = { ...(m.defines || {}), LEAF_TRANSLUCENT: '' }; // the sun glows through leaves seen against it (look.js)
      if (sp.glow > 0) { m.emissive = new THREE.Color(sp.colors.accent).lerp(new THREE.Color(sp.colors.leaf), .4); m.emissiveIntensity = sp.glow * .55; }
      m.userData.cards = true;
      addPlantShader(m, { time, center, fade, lod: { value: new THREE.Vector4(...LODS[level]) } }, sp);
      return m;
    };
    const matsAt = (l) => leafy ? [material(false, l), leafMaterial(l)] : sp.glow > 0 ? [material(false, l), material(true, l)] : material(null, l);
    const materials = [matsAt(0), matsAt(1), matsAt(2), matsAt(3)]; // per level of detail
    // Its shadow (atmosphere.js): drawn with the same sway, and cut out by the leaves.
    const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, ...(leafy ? { map: leafTexture(THREE, sp, body.seed), alphaTest: .42 } : {}) });
    addPlantShader(depthMaterial, { time, center, fade }, sp);
    // Tall plants also get a distant model (new plant style); for the others it is the far one.
    const hasDistant = standsIn(sp) && !flat;
    // (Where the far model is lighter anyway, it serves as the distant one too.)
    const distantGeos = hasDistant ? geos.map((_, v) => { const g = buildGeometry(THREE, sp, variantRng(v), { bloom: blooming && v === V - 1, distant: true, leaves: leafyForm(sp) && leavesAvailable() }); if (triCount(g) < triCount(farGeos[v])) return g; g.dispose(); return farGeos[v]; }) : [];
    const meshes = geos.map((g) => newMesh(THREE, g, materials[0], 32)), farMeshes = farGeos.map((g) => newMesh(THREE, g, materials[1], 32)), distantMeshes = distantGeos.map((g) => newMesh(THREE, g, materials[2], 32)), standMeshes = distantGeos.map((g) => newMesh(THREE, g, materials[3], 32));
    for (const m of [...meshes, ...farMeshes, ...distantMeshes, ...standMeshes]) group.add(m);
    return {
      sp, fade, geos, farGeos, distantGeos, materials, depthMaterial, meshes, farMeshes, distantMeshes, standMeshes, V, flat, blooming, view, foot: plantFootprint(sp), tris: geos.map(triCount), farTris: farGeos.map(triCount), distantTris: distantGeos.map(triCount),
      tall: standsIn(sp),
      spacing: clamp(2.2 / Math.max(sp.height, .5), .22, 1), // big plants stand further apart
      grove: si * 31.7 + 5, groveFloor: sp.form === 'grass' || flat ? .35 : .06,
    };
  });
  // All of a kind's models, in slot order: near 0..V-1, far V..2V-1, distant 2V..
  // Slots: near 0..V-1, far V..2V-1, distant 2V..3V-1, and 3V..: distant models standing
  // in for near or far ones when the budget is short (always shown, no dissolve).
  const modelsOf = (k) => [...k.meshes, ...k.farMeshes, ...k.distantMeshes, ...k.standMeshes];
  const geoOf = (k, slotV) => slotV < k.V ? k.geos[slotV] : slotV < 2 * k.V ? k.farGeos[slotV - k.V] : k.distantGeos[(slotV - 2 * k.V) % k.V];
  const setModel = (k, slotV, m) => { if (slotV < k.V) k.meshes[slotV] = m; else if (slotV < 2 * k.V) k.farMeshes[slotV - k.V] = m; else if (slotV < 3 * k.V) k.distantMeshes[slotV - 2 * k.V] = m; else k.standMeshes[slotV - 3 * k.V] = m; };
  const trisOf = (k, slotV) => slotV < k.V ? k.tris[slotV] : slotV < 2 * k.V ? k.farTris[slotV - k.V] : k.distantTris[(slotV - 2 * k.V) % k.V];
  for (const k of kinds) placed.push({ species: k.sp, positions: new Float32Array(0), scales: new Float32Array(0), get meshes() { return modelsOf(k); } });
  // Deadwood and stones on the forest floor (new plant style): fallen trunks, stumps and
  // mossy boulders, in the bark of the world's own trees and the colour of its rock.
  const treeSp = kinds.find((k) => k.tall && ['tree', 'conifer'].includes(k.sp.form))?.sp;
  const decor = NEW && treeSp && (env?.chem || 'carbon') === 'carbon' ? forestDecor(THREE, {
    bark: treeSp.colors.stem, moss: '#' + new THREE.Color().setRGB(...(terrain.vegetation || [.3, .45, .2])).multiplyScalar(.6).getHexString(),
    rock: '#' + new THREE.Color().setRGB(...(terrain.rockColor || [.45, .43, .4])).getHexString(),
  }).map((d) => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: .95 });
    material.defines = { PLANT_SURFACE: 1 }; // mottled, like the plants' solid parts
    addPlantShader(material, { time, center, fade: { value: new THREE.Vector2(reach * .45, reach * .6) } }, { sway: 0, height: 1 });
    const mesh = newMesh(THREE, d.geo, material, 64);
    mesh.castShadow = true;
    group.add(mesh);
    return { ...d, material, mesh, tris: triCount(d.geo) };
  }) : [];
  // Groves: each species thick in some patches (tens of metres across) and thin in others.
  const groveAt = (k, n) => k.groveFloor + (1 - k.groveFloor) * smooth(-.25, .35, groves(n.x * radius / 70 + k.grove, n.y * radius / 70, n.z * radius / 70));

  let blocked = () => false; // settlements clear their ground (setBlocked)
  const n = new THREE.Vector3(), mid = new THREE.Vector3(), dummy = new THREE.Object3D(), tint = new THREE.Color();
  const weight = new Float64Array(kinds.length), quality = new Float64Array(kinds.length);
  function fill(f, i, j, cell, part = 'all') {
    // The climate is read once per cell (it changes over hundreds of metres, not a dozen).
    if (!cell.point(.5, .5, mid)) return null;
    const c = terrain.climate(mid), sea = c.submerged && terrain.liquid === 'water', biome = sea ? null : plantBiome(c, env);
    if (!biome && !sea) return null;
    let W = 0;
    for (let s = 0; s < kinds.length; s++) {
      const k = kinds[s];
      // Under water only sea plants grow (by depth); on land only land plants.
      quality[s] = sea ? (k.sp.aquatic ? suitability(k.sp, c) * groveAt(k, mid) : 0)
        : k.sp.aquatic ? 0 : biomeAffinity(biome, k.sp.form) * (.15 + .85 * suitability(k.sp, c)) * groveAt(k, mid);
      W += weight[s] = k.sp.abundance * quality[s];
    }
    if (W <= 0) return null;
    // Sea life crowds the sunlit shallows and thins out with depth.
    const density = sea ? .15 + .75 * Math.exp(c.above / 14) : PLANT_BIOMES[biome].density, items = [];
    if (NEW && !sea) return fillWoods(f, i, j, cell, c, biome, density, W, items, part);
    if (NEW && part === 'tall') return items; // sea plants live on the near grid
    for (let slot = 0; slot < SLOTS; slot++) {
      const h = (q) => cell.hash(slot * 16 + q), u = h(1), v = h(2);
      if (h(3) > cell.area(u, v)) continue; // cells near a cube corner cover less ground
      let roll = h(4) * W, s = 0;
      while (s < kinds.length - 1 && (roll -= weight[s]) > 0) s++;
      const k = kinds[s];
      if (h(5) > density * k.spacing * (.3 + .7 * quality[s])) continue;
      placeAt(f, i, j, slot, cell, s, u, v, items);
    }
    return items;
  }
  // New plant style. Trees take a jittered grid of spots (so they stand close but never
  // inside each other) as thick as the biome's woods; where a forest's stand thins (the
  // climate's stand field) it opens into glades. Smaller plants fill in between, fewer
  // under a closed canopy. Old giants are commoner in old forest, saplings at its edges.
  const tallW = new Float64Array(kinds.length), smallW = new Float64Array(kinds.length);
  function fillWoods(f, i, j, cell, c, biome, density, W, items, part) {
    let TW = 0, SW = 0;
    for (let s = 0; s < kinds.length; s++) { const w = weight[s]; tallW[s] = kinds[s].tall ? w : 0; smallW[s] = kinds[s].tall ? 0 : w; TW += tallW[s]; SW += smallW[s]; }
    const glade = biome === 'darkwood' || biome === 'forest' ? smooth(-.75, .05, c.stand) : 1;
    const woods = ((hasTrees ? WOODS : BUSHES)[biome] ?? .05) * glade * STRESS;
    // Four tree spots per 12 m cell, 6 m apart and jittered only so far that trees always
    // stand at least about 3 m apart: thick woods you can still walk through.
    if (part !== 'small' && TW > 0 && woods > 0) for (let gx = 0; gx < 2; gx++) for (let gz = 0; gz < 2; gz++) {
      const slot = 100 + gx * 3 + gz, h = (q) => cell.hash(slot * 16 + q);
      const u = (gx + .25 + .5 * h(1)) / 2, v = (gz + .25 + .5 * h(2)) / 2;
      if (h(3) > cell.area(u, v)) continue;
      let roll = h(4) * TW, s = 0;
      while (s < kinds.length - 1 && (roll -= tallW[s]) > 0) s++;
      if (h(5) > woods * (.45 + .55 * Math.min(1, quality[s] * 1.6))) continue;
      const before = items.length;
      placeAt(f, i, j, slot, cell, s, u, v, items, biome === 'darkwood' ? .2 : biome === 'forest' ? .1 : 0, glade);
      if (items.length > before) items[before].thin = h(10); // which trees are left out far away
    }
    if (part === 'tall') return items;
    // Deadwood and boulders: where trees stand, some have fallen.
    if (decor.length && (biome === 'darkwood' || biome === 'forest') && woods > .2) {
      const h = (q) => cell.hash(900 + q), roll = h(1);
      const which = roll < .2 * woods ? 0 : roll < .3 * woods ? 1 : roll > 1 - .07 * woods ? 2 : -1;
      if (which >= 0 && cell.point(h(2), h(3), n) && n.angleTo(signalNormal) > 14 / radius && n.angleTo(landingNormal) > 16 / radius && !blocked(n)) {
        const ht = terrain.height(n);
        if (!terrain.isLiquid(n) && !(terrain.liquid === 'ice' && ht <= terrain.sea + .01)) {
          const d = decor[which], sc = which === 2 ? .6 + h(4) * 1.1 : .75 + h(4) * .6;
          dummy.position.copy(n).multiplyScalar(radius + ht - (which === 2 ? .3 * sc : .08));
          dummy.quaternion.setFromUnitVectors(Y, which === 0 ? slopeNormal(THREE, terrain, radius, n) : n);
          dummy.rotateY(h(5) * Math.PI * 2);
          dummy.scale.setScalar(sc); dummy.updateMatrix();
          // What you bump into: a row of circles along a log, one for a stump or boulder.
          const foot = [], axis = new THREE.Vector3(1, 0, 0).applyQuaternion(dummy.quaternion);
          if (d.foot.along) for (let a = -d.foot.along; a <= d.foot.along + 1e-6; a += 1) foot.push(dummy.position.clone().addScaledVector(axis, a * sc));
          else foot.push(dummy.position.clone());
          items.push({ decor: which, m: Float32Array.from(dummy.matrix.elements), c: [1, 1, 1], p: dummy.position.toArray(), sc, view: reach * .6, keep: false, foot: foot.map((p) => ({ p, r: d.foot.r * sc, h: d.foot.h * sc })) });
        }
      }
    }
    if (SW <= 0) return items;
    const shade = biome === 'darkwood' ? .55 : biome === 'forest' ? .8 : 1; // a closed canopy shades out the undergrowth
    for (let slot = 0; slot < SLOTS + 3; slot++) {
      const h = (q) => cell.hash(slot * 16 + q), u = h(1), v = h(2);
      if (h(3) > cell.area(u, v)) continue;
      let roll = h(4) * SW, s = 0;
      while (s < kinds.length - 1 && (roll -= smallW[s]) > 0) s++;
      const k = kinds[s];
      if (h(5) > density * shade * k.spacing * (.3 + .7 * quality[s])) continue;
      placeAt(f, i, j, slot, cell, s, u, v, items);
    }
    return items;
  }
  // Places one plant of kind s at (u, v) in the cell, if the ground there allows it.
  // old: extra chance of an old giant (new plant style); edge: 0 at a glade's edge.
  function placeAt(f, i, j, slot, cell, s, u, v, items, old = 0, edge = 1) {
      const k = kinds[s], h = (q) => cell.hash(slot * 16 + q);
      if (!cell.point(u, v, n)) return;
      if (n.angleTo(signalNormal) < 9 / radius || n.angleTo(landingNormal) < 10 / radius) return; // keep the site and landing pad clear
      const keep = h(6) <= 1 / 7; // builders clear their ground, but keep a few plants
      if (!keep && blocked(n)) return;
      const ht = terrain.height(n);
      if (k.sp.aquatic) { if (!(ht < terrain.sea - .15)) return; } // sea plants stay under water
      else if (terrain.liquid === 'ice' ? ht <= terrain.sea + .01 : (terrain.liquid === 'water' || terrain.liquid === 'lava') && ht < terrain.sea) return;
      const r = rng(body.seed, 'plant', f, i, j, slot);
      dummy.position.copy(n).multiplyScalar(radius + ht - .05);
      // Flat growths (mats, crusts) lie along the slope; everything else grows upright.
      dummy.quaternion.setFromUnitVectors(Y, k.flat ? slopeNormal(THREE, terrain, radius, n) : n);
      dummy.rotateY(r() * Math.PI * 2);
      dummy.rotateX((r() - .5) * .12);
      // Each plant its own: young or old, broader or slimmer, a little warmer or cooler in colour.
      let sc = k.flat ? .6 + r() * 1.2 : .7 + r() * .6;
      const age = r();
      if (k.tall && !hasTrees) sc = (1.6 + 1.6 * h(9)) * (h(7) < .2 ? .6 : 1); // treeless worlds: their biggest plants grow into thickets you can see from the air
      else if (k.tall) { // forest trees: mostly grown, saplings where the stand thins, old giants in old forest
        const g = h(7);
        sc = .82 + .36 * h(9);
        if (g < .06 + .3 * (1 - edge)) sc *= .4 + .3 * h(8);
        else if (g > 1 - old - .04) sc *= 1.25 + .3 * h(8);
      } else if (!k.flat) sc *= age < .12 ? .4 + r() * .25 : age > .94 ? 1.25 + r() * .2 : 1;
      const wide = k.flat ? 1 : .82 + r() * .36;
      dummy.scale.set(sc * wide, sc, sc * (k.flat ? 1 : wide * (.9 + r() * .2)));
      dummy.updateMatrix();
      const b = .88 + r() * .24, d = (r() - .5) * .12, e = (r() - .5) * .06;
      const variant = k.blooming && age >= .12 && r() < k.sp.bloomShare ? k.V - 1 : Math.floor(r() * (k.blooming ? k.V - 1 : k.V));
      tint.setRGB(b * (1 + d), b * (1 + e), b * (1 - d));
      items.push({ s, variant, m: Float32Array.from(dummy.matrix.elements), c: [tint.r, tint.g, tint.b], p: dummy.position.toArray(), sc, view: k.view, keep });
  }
  const scatter = createScatter({ radius, cell: CELL, reach, fill: NEW ? (f, i, j, cell) => fill(f, i, j, cell, 'small') : fill });
  const treeScatter = NEW ? createScatter({ radius, cell: CELL, reach: treeReach, fill: (f, i, j, cell) => fill(f, i, j, cell, 'tall') }) : null;

  // Draws the filled cells, nearest first, up to the cap; also lists every plant
  // (placed: what the scanner, sonar and grazing animals look at) and the obstacles.
  let grid = obstacleGrid([]), budgetEdge = Infinity;
  function rebuild() {
    // Slot v of a species is its near model v; slot V + v is its far model v.
    const counts = kinds.map(k => modelsOf(k).map(() => 0)), chosen = [], decorChosen = [], decorCount = decor.map(() => 0);
    let tris = 0;
    const lists = treeScatter ? [[scatter.active, cap, triangles, false], [treeScatter.active, treeCap, treeTriangles, true]] : [[scatter.active, cap, triangles, false]];
    for (const [active, capN, triN, tallList] of lists) { let count = 0, edge = Infinity; tris = 0;
    for (const rec of active) {
      if (!rec.ready) continue;
      if (count >= capN || tris >= triN) { edge = rec.d; break; }
      // Trees: once most of the budget is spent, the rest get their distant model whatever
      // their distance, so the woods carry on to the horizon instead of ending.
      const thrifty = tallList && tris > triN * .6;
      // Far trees thin out towards the horizon (fewer and fewer of them drawn).
      const keepShare = rec.d > reach ? 1 - .6 * smooth(reach, treeReach, rec.d) : 1;
      const far = rec.d > FAR, nearTree = rec.d <= FAR_TREE, distant = rec.d > DISTANT;
      for (const it of rec.items) if (rec.d <= it.view && !(it.thin > keepShare)) {
        if (it.decor !== undefined) { decorChosen.push(it); decorCount[it.decor]++; tris += decor[it.decor].tris; continue; }
        count++; it.d = rec.d;
        const k = kinds[it.s], v = it.variant, hasD = k.distantGeos.length > 0;
        // One model per plant, by distance (the stand-in distant model when the budget is short).
        const nearOut = k.tall ? FAR_TREE : FAR, slots = [thrifty && hasD ? 3 * k.V + v : hasD && rec.d > DISTANT ? 2 * k.V + v : rec.d > nearOut ? k.V + v : v];
        for (const slotV of slots) { chosen.push([it, slotV]); counts[it.s][slotV]++; tris += trisOf(k, slotV); }
      }
    }
    // Where the budget ran out, plants fade out a little before it rather than stop dead.
    // (Small plants only, and the edge eased so it does not jitter as you move: on trees the
    // jitter made them blink in and out.)
    if (!tallList) { budgetEdge = Number.isFinite(edge) ? (Number.isFinite(budgetEdge) ? budgetEdge * .7 + edge * .3 : edge) : Infinity;
      for (const k of kinds) if (!k.tall) k.fade.value.set(Math.min(k.view * .7, budgetEdge * .85), Math.min(k.view, budgetEdge)); }
    }
    kinds.forEach((k, s) => modelsOf(k).forEach((m, slotV) => {
      if (counts[s][slotV] <= m.instanceMatrix.count) return;
      const grown = newMesh(THREE, geoOf(k, slotV), k.materials[Math.min(3, Math.floor(slotV / k.V))], Math.ceil(counts[s][slotV] * 1.5));
      group.remove(m); m.dispose(); group.add(grown);
      setModel(k, slotV, grown);
    }));
    const at = kinds.map(k => modelsOf(k).map(() => 0)), pos = kinds.map(() => []), scl = kinds.map(() => []), obstacles = [];
    for (const [it, slotV] of chosen) {
      const k = kinds[it.s], mesh = modelsOf(k)[slotV], slot = at[it.s][slotV]++;
      mesh.instanceMatrix.array.set(it.m, slot * 16);
      mesh.instanceColor.array.set(it.c, slot * 3);
      pos[it.s].push(it.p[0], it.p[1], it.p[2]); scl[it.s].push(it.sc);
      if (k.foot && !(it.d > 90)) obstacles.push({ p: new THREE.Vector3(it.p[0], it.p[1], it.p[2]), r: k.foot.r * it.sc, h: k.foot.h * it.sc }); // grasses and mats are walked over
    }
    kinds.forEach((k, s) => {
      modelsOf(k).forEach((m, slotV) => { m.castShadow = slotV < k.V && !k.flat && k.sp.height >= 1.2; /* small plants' shadows are not missed, and cost a lot */ m.customDepthMaterial = k.depthMaterial; m.count = at[s][slotV]; m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
      placed[s].positions = new Float32Array(pos[s]); placed[s].scales = new Float32Array(scl[s]);
    });
    decor.forEach((d, q) => {
      if (decorCount[q] > d.mesh.instanceMatrix.count) { const grown = newMesh(THREE, d.geo, d.material, Math.ceil(decorCount[q] * 1.5)); grown.castShadow = true; group.remove(d.mesh); d.mesh.dispose(); group.add(grown); d.mesh = grown; }
      d.mesh.count = 0;
    });
    for (const it of decorChosen) {
      const d = decor[it.decor], slot = d.mesh.count++;
      d.mesh.instanceMatrix.array.set(it.m, slot * 16); d.mesh.instanceColor.array.set(it.c, slot * 3);
      for (const o of it.foot) obstacles.push(o);
    }
    for (const d of decor) { d.mesh.visible = d.mesh.count > 0; d.mesh.instanceMatrix.needsUpdate = true; d.mesh.instanceColor.needsUpdate = true; }
    grid = obstacleGrid(obstacles);
  }

  // Fill around the landing pad at once, so you never land in an empty field.
  scatter.prime(landingNormal, coarse ? 140 : 190);
  treeScatter?.prime(landingNormal, coarse ? 160 : 240);
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
      group.visible = altitude < treeReach;
      if (!group.visible) return;
      center.value.copy(camera);
      if (altitude < reach && scatter.update(dir, coarse ? 2 : 4)) dirty = true;
      if (treeScatter?.update(dir, coarse ? 2 : 3)) dirty = true;
      if (dirty && (--wait <= 0 || !(scatter.busy || treeScatter?.busy))) { rebuild(); dirty = false; wait = 8; }
    },
    // Plants you can bump into near a point (grasses and mats are walked over).
    nearbyObstacles: (p, out) => grid.near(p, out),
    // blocked(n): true where builders have cleared the ground; plants there are removed (a few are kept).
    setBlocked(fn) {
      blocked = fn;
      const at = new THREE.Vector3();
      for (const sc of [scatter, treeScatter]) if (sc) for (const rec of sc.active) if (rec.ready) rec.items = rec.items.filter(it => it.keep || !fn(at.fromArray(it.p).normalize()));
      rebuild();
    },
    // The plant biome at a surface direction (for the HUD or scanner).
    biomeAt(dirAt) { return plantBiome(terrain.climate(dirAt), env); },
    get busy() { return scatter.busy + (treeScatter?.busy || 0); },
  };
}

function newMesh(THREE, geometry, materials, capacity) {
  const m = new THREE.InstancedMesh(geometry, materials, capacity);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  m.count = 0; m.frustumCulled = false; // instances are spread around you
  m.receiveShadow = true;
  m.visible = false; // until it has plants: an empty instanced mesh still costs a draw call
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
// How far a plant's top sways, in metres. New plant style: big trees barely move (a tall
// trunk only stirs at the top, and slowly; uRate, uPush), so a forest stands still in a breeze.
const swayAmp = (sp) => sp.sway * (sp.aquatic ? .08 : .045) * (NEW && !sp.aquatic && sp.height > 4 ? 4 * Math.sqrt(sp.height / 4) * .55 : sp.height);
function addPlantShader(material, { time, center, fade, lod = null }, sp) {
  const sway = sp.sway > 0, dissolve = !!lod && !material.isMeshDepthMaterial;
  material.onBeforeCompile = (shader) => {
    // Sea plants sway slowly with the swell, and the wind does not reach them.
    if (dissolve) shader.uniforms.uLod = lod;
    if (dissolve && material.userData.cards) {
      // Screen-door dissolve (interleaved gradient noise): two models in a band take
      // complementary pixels, so the switch is never seen as a pop.
      shader.fragmentShader = 'varying float vPlantVis; varying vec2 vPlantLod;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { float dn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (dn > vPlantLod.x || dn <= vPlantLod.y || dn >= vPlantVis) discard; }`);
    }
    Object.assign(shader.uniforms, { uTime: sp.aquatic ? { get value() { return time.value * .45; } } : time, uCenter: center, uFade: fade, uAmp: { value: swayAmp(sp) }, uRate: { value: NEW && sp.height > 4 ? .5 : 1 }, uPush: { value: NEW && sp.height > 4 ? 1.6 : 5 }, uInvH: { value: 1 / sp.height }, uWind: sp.aquatic ? { value: 0 } : wind.strength, uWindDir: wind.dir });
    // Leaves far off: their texture's smaller mipmaps average the gaps into the leaves, so
    // they would thin out and vanish under the alpha test; far leaves are made denser.
    if (material.userData.cards) shader.fragmentShader = 'varying float vPlantDist;\n' + shader.fragmentShader.replace('#include <alphatest_fragment>', 'diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + 1.3 * smoothstep(18.0, 170.0, vPlantDist)));\n#include <alphatest_fragment>');
    // Surface texture on the solid parts (new plant style): bark streaked and grained along
    // the stem, caps, bulbs and fleshy leaves softly mottled, in the plant's own colours.
    // From the rest pose (object space), so it stays on the plant as it sways.
    if (material.defines?.PLANT_SURFACE) {
      shader.vertexShader = 'varying vec3 vPlantRest; varying vec3 vPlantRestN;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n      vPlantRest = position; vPlantRestN = normal;');
      shader.fragmentShader = `varying vec3 vPlantRest; varying vec3 vPlantRestN;
float pHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float pNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(pHash(i), pHash(i + vec3(1, 0, 0)), f.x), mix(pHash(i + vec3(0, 1, 0)), pHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(pHash(i + vec3(0, 0, 1)), pHash(i + vec3(1, 0, 1)), f.x), mix(pHash(i + vec3(0, 1, 1)), pHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 q = vPlantRest;
        #ifdef PLANT_BARK
          // Bark: furrows running up the stem, broken into plates, with fine grain.
          float furrow = pNoise(vec3(q.x * 9.0, q.y * 1.1, q.z * 9.0)) * 0.7 + pNoise(vec3(q.x * 22.0, q.y * 3.0, q.z * 22.0)) * 0.3;
          float grain = pNoise(q * 31.0);
          diffuseColor.rgb *= 0.74 + 0.36 * furrow + 0.1 * (grain - 0.5);
          // A little lichen on what faces up.
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05, 1.18, 0.92), smoothstep(0.55, 0.9, vPlantRestN.y) * smoothstep(0.55, 0.75, pNoise(q * 4.0)) * 0.5);
        #else
          // Caps, bulbs, fleshy leaves: soft mottling, darker flecks, a paler bloom here and there.
          float mott = pNoise(q * 3.5) * 0.6 + pNoise(q * 9.0) * 0.4;
          float fleck = smoothstep(0.7, 0.82, pNoise(q * 26.0));
          diffuseColor.rgb *= (0.86 + 0.24 * mott) * (1.0 - 0.18 * fleck);
        #endif
      }`);
    }
    if (material.userData.cards) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE_CHUNKS.normal_fragment_begin.replaceAll('normal *= faceDirection;', '').replaceAll('normal = normal * faceDirection;', '')); // leaf cards shade the same on both sides
    shader.vertexShader = (dissolve ? 'uniform vec4 uLod; varying float vPlantVis; varying vec2 vPlantLod;\n' : '') + (material.userData.cards ? 'varying float vPlantDist;\n' : '') + 'uniform float uTime; uniform vec3 uCenter; uniform vec2 uFade; uniform float uAmp; uniform float uRate; uniform float uPush; uniform float uInvH; uniform float uWind; uniform vec3 uWindDir;\n' + WIND_GLSL + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 plantAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      // Distance along the ground from the point under the camera, the same measure the
      // plants are chosen by (flora-mesh.js rebuild), so flying over them does not fade
      // out the ones below you.
      vec3 plantUp = normalize(uCenter), plantRel = plantAt - uCenter;
      float plantG = length(plantRel - plantUp * dot(plantRel, plantUp));
      float plantT = 1.0 - smoothstep(uFade.x, uFade.y, plantG);
      float plantR = fract(sin(dot(plantAt, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      ` + (dissolve ? `
      // Fading in at the edge of view and between models: dissolved, not grown (no popping).
      float plantD = plantG;
      vPlantVis = smoothstep(plantR * .8, plantR * .8 + .2, plantT);
      vPlantLod = vec2(uLod.x < 0.0 ? 1.0 : smoothstep(uLod.x, uLod.y, plantD), smoothstep(uLod.z, uLod.w, plantD));` + (material.userData.cards ? '' : `
      // Solid parts (stems, caps) switch at the middle of the band, in the vertex shader:
      // a fragment discard would cost a lot on solid surfaces, and they change little.
      if ((uLod.x >= 0.0 && plantD < (uLod.x + uLod.y) * .5) || plantD > (uLod.z + uLod.w) * .5) transformed *= 0.0;
      transformed *= vPlantVis; vPlantVis = 1.0; vPlantLod = vec2(1.0, 0.0);`) : `
      transformed *= smoothstep(plantR * .8, plantR * .8 + .2, plantT);`) + (material.userData.cards ? `
      vPlantDist = distance(plantAt, cameraPosition);` : '') + (sway ? `
      float swayK = pow(clamp(transformed.y * uInvH, 0.0, 1.3), 2.0) * uAmp;
      float swayPhase = instanceMatrix[3].x * .37 + instanceMatrix[3].z * .23;
      transformed.x += sin(uTime * 1.7 * uRate + swayPhase) * swayK;
      transformed.z += cos(uTime * 1.3 * uRate + swayPhase * 1.3) * swayK * .6;
      transformed += windPush(swayK * uPush, swayPhase); // the weather's wind (wind.mjs)` : ''));
  };
  material.customProgramCacheKey = () => (sway ? 'plant-sway' : 'plant') + (material.userData.cards ? '-cards' : '') + (dissolve ? '-lod' : ''); // same program; uniforms differ
}

// --- Geometry: each form assembled from a few primitives, merged into one mesh
// with two groups (0: stems and trunks, 1: foliage, caps and pods). ---
// far: a lighter model for plants seen from a distance (same shape, from the same random
// numbers): small parts dropped, rounder parts with fewer facets.
// distant: a very light stand-in for trees far off (new plant style): the trunk and a few
// crown shapes, or one cone for a spire-shaped crown, in the plant's own colours.
export function buildGeometry(THREE, sp, r, { bloom = false, far = false, distant = false, leaves = false } = {}) { // exported for previews
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
  // New plant style: forest trees get their own models (flora-forest.js); the classic ones below stay for ?plants=classic.
  if (PLANT_STYLE !== 'classic' && FOREST_FORMS[sp.form]) FOREST_FORMS[sp.form]({ THREE, add, M, cyl, blob, blade, r, H, c, sp, leaf });
  // New plant style: the smaller plants grow to their species' plan (flora-understory.js; false for the classic plan).
  else if (PLANT_STYLE !== 'classic' && UNDERSTORY({ THREE, add, M, cyl, blob, blade, spear, r, H, c, sp, leaf })) { /* built */ }
  else if (sp.form === 'tree') {
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
  } else if (sp.form === 'kelp') {
    // Several long stems, each hung with alternating blades and gas floats at the joints.
    const stems = 2 + (sp.seed % 3);
    for (let k = 0; k < stems; k++) {
      const a = k / stems * 6.28 + r(), d = H * .03, h = H * (.75 + r() * .3), lean = (r() - .5) * .25;
      const m = M(Math.cos(a) * d, 0, Math.sin(a) * d, 0, a, lean);
      add(cyl(H * .006, H * .01, h, 4), m, c.stem, false);
      for (let j = 1; j < 11; j++) {
        const y = h * j / 11, mj = m.clone().multiply(M(0, y, 0, 0, j * 2.4, 0));
        add(blade(H * (.2 + r() * .1), H * .07, -.08, .05, 5), mj.clone().multiply(M(0, 0, 0, 0, 0, .7 + r() * .5)), leaf(j), true);
        if (j % 2) add(blob(H * .014, 0), mj, c.accent, true);
      }
    }
    add(blob(H * .03, 0), M(0, H * .01, 0, 0, 0, 0, 1.5, .6, 1.5), c.stem, false); // holdfast
  } else if (sp.form === 'seagrass') {
    const blades = 9 + (sp.seed % 6);
    for (let i = 0; i < blades; i++) { const a = i / blades * 6.28 + r(), h = H * (.6 + r() * .5); add(spear(h, H * .05, .1 + r() * .2, 3), M(Math.cos(a) * H * .1, 0, Math.sin(a) * H * .1, 0, a + Math.PI / 2, 0), leaf(i), true); }
  } else if (sp.form === 'coral') {
    // A branching colony: forking cylinders with rounded tips.
    const branch = (m, len, rad, depth) => {
      add(cyl(rad * .75, rad, len, 5), m, c.leaf, false);
      const tipM = m.clone().multiply(M(0, len, 0));
      if (depth >= 3 || len < H * .12) { add(blob(rad * 1.1, 0), tipM, c.accent, true); return; }
      const n = 2 + (r() < .4 ? 1 : 0);
      for (let k = 0; k < n; k++) branch(tipM.clone().multiply(M(0, 0, 0, 0, k / n * 6.28 + r(), .45 + r() * .3)), len * (.65 + r() * .2), rad * .7, depth + 1);
    };
    const trunks = 3 + (sp.seed % 3);
    for (let k = 0; k < trunks; k++) branch(M(Math.cos(k * 2.1) * H * .1, 0, Math.sin(k * 2.1) * H * .1, 0, k * 2.1, (r() - .5) * .6), H * .38, H * .06, 0);
    add(blob(H * .2, 0), M(0, 0, 0, 0, 0, 0, 1.3, .35, 1.3), c.leaf2, false);
  } else if (sp.form === 'fan') {
    // A flat lattice: radiating ribs joined by cross-bars, all in one plane, on a short stem.
    add(cyl(H * .02, H * .03, H * .2, 4), M(), c.stem, false);
    // The fan's web: a thin sector between the ribs.
    add(new THREE.CircleGeometry(H * .72, 14, Math.PI / 2 - 1.1, 2.2), M(0, H * .18, 0), c.leaf2, true);
    add(new THREE.CircleGeometry(H * .72, 14, Math.PI / 2 - 1.1, 2.2), M(0, H * .18, 0, 0, Math.PI, 0), c.leaf2, true);
    const ribs = 7 + (sp.seed % 4);
    for (let k = 0; k < ribs; k++) {
      const a = -1.1 + k / (ribs - 1) * 2.2, len = H * (.65 + r() * .2);
      add(cyl(H * .008, H * .014, len, 3), M(0, H * .18, 0, 0, 0, a), leaf(k), true);
      for (let j = 1; j < 5; j++) { const t = j / 5, l2 = len * t; add(new THREE.BoxGeometry(len * .2 * t + H * .02, H * .012, H * .012), M(-Math.sin(a) * l2, H * .18 + Math.cos(a) * l2, 0, 0, 0, a), j % 2 ? c.leaf : c.accent, true); }
    }
  } else if (sp.form === 'anemone') {
    // A soft column with a disc on top, ringed by tentacles that curl outward.
    const R = H * .22, top = H * .38;
    add(cyl(R * .85, R, top, 8), M(), c.stem, false);
    add(new THREE.CylinderGeometry(R * 1.25, R * .9, H * .07, 10).translate(0, H * .035, 0), M(0, top, 0), c.leaf2, true);
    const n = 20 + (sp.seed % 10);
    for (let i = 0; i < n; i++) { const a = i / n * 6.28, ring = i % 2 ? .6 : 1.05; add(spear(H * (.45 + r() * .2) * ring, H * .06, .55, 3), M(Math.cos(a) * R * ring, top + H * .05, Math.sin(a) * R * ring, 0, -a + Math.PI / 2, -.25), i % 2 ? c.accent : c.leaf, true); }
  } else if (sp.form === 'bladder') {
    // Thin stalks strung with clusters of round, buoyant bladders.
    const stalks = 3 + (sp.seed % 3);
    for (let k = 0; k < stalks; k++) {
      const a = k / stalks * 6.28 + r(), h = H * (.6 + r() * .4), m = M(Math.cos(a) * H * .05, 0, Math.sin(a) * H * .05, 0, a, (r() - .5) * .4);
      add(cyl(H * .008, H * .012, h, 3), m, c.stem, false);
      for (let j = 1; j <= 4; j++) for (let q = 0; q < 3; q++) { const y = h * (.3 + j * .17), b = H * (.035 + r() * .03); add(blob(b, 1), m.clone().multiply(M(Math.cos(q * 2.1 + j) * b * 1.3, y, Math.sin(q * 2.1 + j) * b * 1.3)), q ? c.leaf : c.accent, true); }
    }
  } else if (sp.form === 'reefmound') {
    // Layered stone domes built by microbial mats.
    for (let k = 0; k < 3; k++) { const a = k * 2.3, d = k ? H * .5 : 0, s2 = k ? .6 : 1; for (let j = 0; j < 4; j++) add(new THREE.CylinderGeometry(H * .5 * s2 * (1 - j * .2), H * .55 * s2 * (1 - j * .18), H * .25 * s2, 9).translate(0, H * .125 * s2, 0), M(Math.cos(a) * d, j * H * .22 * s2, Math.sin(a) * d), j % 2 ? c.leaf : c.leaf2, j === 3); }
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
    const tr = H * (sp.trunkRatio || .05) * (NEW ? .5 : 1); // (new trees have slimmer trunks)
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

  if (distant) standIn(THREE, parts, H, sp);
  // Leaf cards in place of the leafy blobs (crowns, clumps): fewer on the far model.
  // (A crown of very many small clumps gets fewer leaves on each, so a tree stays within
  // about a thousand cards.)
  const clumps = leaves ? parts.filter((p) => p.foliage && p.geo.type === 'IcosahedronGeometry').length : 0, budget = Math.min(1, (far ? 200 : 640) / Math.max(1, clumps * 6));
  if (leaves) for (const p of parts) {
    // Trees: every other piece of foliage too (fir skirts and boughs, cone- and bowl-shaped
    // crowns, brushes), as leaves over its own surface, so no crown is a solid shell.
    if (p.foliage && p.geo.type !== 'IcosahedronGeometry' && (sp.form === 'tree' || sp.form === 'conifer') && !fruitish(p.color, sp.colors)) {
      const g = p.geo; if (!g.boundingBox) g.computeBoundingBox();
      const e = p.matrix.elements, sc = Math.sqrt(Math.max(e[0] ** 2 + e[1] ** 2 + e[2] ** 2, e[4] ** 2 + e[5] ** 2 + e[6] ** 2, e[8] ** 2 + e[9] ** 2 + e[10] ** 2));
      const ext = g.boundingBox.getSize(new THREE.Vector3()), big = Math.max(ext.x, ext.y, ext.z) * sc;
      if (big < H * .045) continue; // a tiny tip stays solid
      // Card size from the shape's thinner dimensions; count from its surface area.
      const dims = [ext.x, ext.y, ext.z].sort((a, b) => a - b), thin = Math.max(dims[0], dims[1] * .35), half = Math.max(H * .012, Math.min(dims[1] * .45, thin * .9 + dims[1] * .12, H * .05 + .2));
      const area = 2 * (ext.x * ext.y + ext.y * ext.z + ext.x * ext.z) * .55;
      const lo = far || distant, k = Math.round(Math.max(lo ? 2 : 3, Math.min(distant ? 6 : far ? 14 : 56, area / (half * half * 4) * (distant ? .25 : far ? .45 : 1.1))));
      p.geo = leafSurface(THREE, g, r, k, half * 1.15);
      continue;
    }
    if ((!p.foliage && sp.form !== 'mound') || p.geo.type !== 'IcosahedronGeometry') continue; // (a mound's cushions are leafy too)
    const e = p.matrix.elements, sc = Math.sqrt(Math.max(e[0] ** 2 + e[1] ** 2 + e[2] ** 2, e[4] ** 2 + e[5] ** 2 + e[6] ** 2, e[8] ** 2 + e[9] ** 2 + e[10] ** 2));
    const rad = p.geo.parameters.radius, size = rad * sc;
    if (sp.colors.leaf && fruitish(p.color, sp.colors)) { // fruit, berries and buds: solid, but smaller and round
      if (p.foliage) p.geo = new THREE.IcosahedronGeometry(rad * .5, 1);
      continue;
    }
    if (distant) { p.foliage = true; p.geo = leafCards(THREE, rad, r, 5); continue; } // the distant model's masses: a few big leaf cards each, so far trees are leafy like near ones
    if (size < H * .025) { if (p.geo.parameters.detail > 0) p.geo = new THREE.IcosahedronGeometry(rad, 0); continue; } // a crumb of foliage: a few facets
    p.foliage = true;
    p.geo = leafCards(THREE, rad, r, Math.max(far ? 3 : 4, Math.min(far ? 10 : 32, Math.round(((far ? 4 : 8) + size * (far ? 2.4 : 5.5)) * (sp.form === 'mound' ? 1.4 : 1) * budget))));
  }
  // Merge: stems first, then foliage, each part non-indexed with its colour baked in.
  const ordered = [...parts.filter(p => !p.foliage), ...parts.filter(p => p.foliage)].map(far ? (p) => simplerPart(THREE, p, H) : (p) => p).filter(Boolean);
  const pos = [], nor = [], col = [], uvs = [];
  let stemVerts = 0, cardShade = 1;
  for (const p of ordered) {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo).applyMatrix4(p.matrix);
    // A twisted habit turns the plant about its axis more the higher it goes, with an S-bend.
    if (twist) { const A = g.attributes.position; for (let i = 0; i < A.count; i++) { const y = A.getY(i), t = Math.max(0, y / H), a = twist * t, x = A.getX(i), z = A.getZ(i); A.setXYZ(i, x * Math.cos(a) - z * Math.sin(a) + Math.sin(t * Math.PI) * H * bend, y, x * Math.sin(a) + z * Math.cos(a)); } }
    const cards = !!p.geo.userData?.cards, shadeV = p.geo.userData?.shade;
    if (!cards) { g.computeVertexNormals(); if (NEW) softenNormals(THREE, g, p.foliage ? .6 : .72); } // softened facets (soften.js)
    const P = g.attributes.position.array, N = g.attributes.normal.array, UV = cards ? g.attributes.uv.array : null;
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
      if (cards && i % 18 === 0) cardShade = 1.15 + .4 * (((i * 2654435761 + pos.length) >>> 0) % 1000 / 1000); // each card a little lighter or darker
      if (cards) tmp.multiplyScalar(cardShade);
      for (let k = i; k < i + 9 && k < P.length; k += 3) {
        const sh = shadeV ? shadeV[k / 3] : 1; // leaves inside and under the crown darker
        pos.push(P[k], P[k + 1], P[k + 2]); nor.push(N[k], N[k + 1], N[k + 2]); col.push(tmp.r * sh, tmp.g * sh, tmp.b * sh);
        if (cards) { const q = k / 3 * 2; uvs.push(UV[q], UV[q + 1]); } else uvs.push(OPAQUE_U, .5);
      }
    }
    if (!p.foliage) stemVerts += P.length / 3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.addGroup(0, stemVerts, 0);
  geometry.addGroup(stemVerts, pos.length / 3 - stemVerts, 1);
  geometry.computeBoundingSphere();
  return geometry;
}

// Which forms grow leaves (flora-leaves.js): trees, spires and bushes.
const leafyForm = (sp) => NEW && !sp.aquatic && ['tree', 'conifer', 'shrub', 'mound', 'stalk', 'plume', 'palm'].includes(sp.form) && (sp.colors?.leaf ?? null) !== null && (sp.glow || 0) < .5;
// A part in the species' own leaf colours (not its fruit, berries or flowers)?
// Fruit, berries, buds or flowers: a part in the accent or bloom colours rather than the leaves'
// (the leaves themselves may be shaded much darker, deep in a wood).
const fruitish = (c, colors) => !sameish(c, colors) && ['accent', 'bloom'].some((k) => colors[k] && near(c, colors[k], .3)) || (!sameish(c, colors) && !leafHue(c, colors));
const near = (c, hex, d) => { const o = new c.constructor(hex); return Math.abs(c.r - o.r) + Math.abs(c.g - o.g) + Math.abs(c.b - o.b) < d; };
// The same hue as the leaves (any brightness): a darker shade of foliage, not fruit.
const leafHue = (c, colors) => ['leaf', 'leaf2'].some((k) => { if (!colors[k]) return false; const a = c.getHSL({}), b = new c.constructor(colors[k]).getHSL({}); return Math.abs(((a.h - b.h + 1.5) % 1) - .5) < .09 || a.s < .12; });
const sameish = (c, colors) => ['leaf', 'leaf2'].some((k) => colors[k] && Math.abs(c.r - new c.constructor(colors[k]).r) + Math.abs(c.g - new c.constructor(colors[k]).g) + Math.abs(c.b - new c.constructor(colors[k]).b) < .35);

// The distant model: the plant itself, simplified hard, so it keeps its own silhouette
// and colours from afar. Stems under an eighth of the plant's height go and the rest get
// three sides; the foliage (except very big pieces, which are kept with few facets) is
// gathered by where it is into a few rounded masses in its own colours, so a crown of
// many small pieces still reads as that crown.
function standIn(THREE, parts, H, sp) {
  const keep = [], buckets = new Map(), cellK = H * .45, tmpB = new THREE.Box3(); // (big cells: a far crown is a few masses)
  const thickest = Math.max(0, ...parts.filter((p) => !p.foliage).map(stemThickness)); // the trunk: always kept, however slim
  for (const p of parts) {
    // Fruit, blossom and pods are left out: gathered into the crown's masses they became huge coloured blobs.
    if (p.foliage && sp?.colors?.leaf && fruitish(p.color, sp.colors)) continue;
    const g = p.geo; if (!g.boundingSphere) g.computeBoundingSphere();
    const e = p.matrix.elements, scale = Math.sqrt(Math.max(e[0] ** 2 + e[1] ** 2 + e[2] ** 2, e[4] ** 2 + e[5] ** 2 + e[6] ** 2, e[8] ** 2 + e[9] ** 2 + e[10] ** 2));
    const big = g.boundingSphere.radius * scale;
    if (p.foliage ? big >= H * .32 && !g.userData?.detail : big >= H * .12 || stemThickness(p) >= Math.min(H * .025, thickest * .45)) {
      const q = g.parameters || {};
      let lite = null;
      if (g.type === 'IcosahedronGeometry') lite = new THREE.IcosahedronGeometry(q.radius, 0);
      else if (g.type === 'CylinderGeometry') lite = new THREE.CylinderGeometry(q.radiusTop, q.radiusBottom, q.height, p.foliage ? 5 : 3, 1, q.openEnded);
      else if (g.type === 'ConeGeometry' && !p.foliage) lite = new THREE.ConeGeometry(q.radius, q.height, 3, 1, q.openEnded);
      else if (g.type === 'ConeGeometry') { // a cone of foliage: a rounded mass the same size, not a solid spike
        if (!g.boundingBox) g.computeBoundingBox();
        const sz = g.boundingBox.getSize(new THREE.Vector3()), c0 = g.boundingBox.getCenter(new THREE.Vector3());
        keep.push({ ...p, geo: new THREE.IcosahedronGeometry(.5, 0), matrix: p.matrix.clone().multiply(new THREE.Matrix4().compose(c0, new THREE.Quaternion(), sz.multiplyScalar(.92))) });
        continue;
      }
      if (lite) { if (!g.boundingBox) g.computeBoundingBox(); lite.computeBoundingBox(); const a = g.boundingBox.getCenter(new THREE.Vector3()), b = lite.boundingBox.getCenter(new THREE.Vector3()); lite.translate(a.x - b.x, a.y - b.y, a.z - b.z); keep.push({ ...p, geo: lite }); }
      else keep.push(p);
      continue;
    }
    if (!p.foliage) continue;
    // A small piece of foliage: into the bucket for where it is.
    if (!g.boundingBox) g.computeBoundingBox();
    tmpB.copy(g.boundingBox).applyMatrix4(p.matrix);
    const c = tmpB.getCenter(new THREE.Vector3()), key = `${Math.floor(c.x / cellK)},${Math.floor(c.y / cellK)},${Math.floor(c.z / cellK)}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, b = { box: tmpB.clone(), color: new THREE.Color(0, 0, 0), n: 0 });
    b.box.union(tmpB); b.color.add(p.color); b.n++;
  }
  for (const b of buckets.values()) {
    if (b.n < 2) continue; // a lone small piece is not missed
    const size = b.box.getSize(new THREE.Vector3()), c = b.box.getCenter(new THREE.Vector3());
    keep.push({ geo: new THREE.IcosahedronGeometry(.5, 0), matrix: new THREE.Matrix4().compose(c, new THREE.Quaternion(), size.multiplyScalar(.85).max(new THREE.Vector3(.2, .2, .2))), color: b.color.multiplyScalar(1 / b.n), foliage: true });
  }
  if (!keep.some((p) => p.foliage)) return; // nothing would be left of it: keep the full parts
  parts.length = 0;
  parts.push(...keep);
}

// How thick a stem part is (its widest radius, in plant metres): trunks and limbs are
// kept on the lighter models however short each piece is (a trunk built as a chain of
// short pieces must not lose the short ones and leave the rest floating); only twigs go.
const stemThickness = (p) => {
  const q = p.geo.parameters || {}, e = p.matrix.elements, sc = Math.sqrt(Math.max(e[0] ** 2 + e[1] ** 2 + e[2] ** 2, e[8] ** 2 + e[9] ** 2 + e[10] ** 2));
  return (q.radiusBottom !== undefined ? Math.max(q.radiusTop, q.radiusBottom) : q.radius ?? 0) * sc;
};
// For the far model: parts under 6% of the plant's height go (twigs, fruit, small leaves,
// bark rings), and spheres, cylinders and cones are rebuilt with fewer facets, in place.
function simplerPart(THREE, p, H) {
  const g = p.geo;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const e = p.matrix.elements, scale = Math.sqrt(Math.max(e[0] ** 2 + e[1] ** 2 + e[2] ** 2, e[4] ** 2 + e[5] ** 2 + e[6] ** 2, e[8] ** 2 + e[9] ** 2 + e[10] ** 2));
  if (g.userData?.detail) return null;
  if (g.boundingSphere.radius * scale < H * .06 && (p.foliage || stemThickness(p) < H * .006)) return null;
  const q = g.parameters || {};
  let lite = null;
  if (g.type === 'IcosahedronGeometry' && q.detail > 0) lite = new THREE.IcosahedronGeometry(q.radius, 0);
  else if (g.type === 'CylinderGeometry' && q.radialSegments > 4) lite = new THREE.CylinderGeometry(q.radiusTop, q.radiusBottom, q.height, Math.max(4, Math.ceil(q.radialSegments / 2)), 1, q.openEnded);
  else if (g.type === 'ConeGeometry' && q.radialSegments > 4) lite = new THREE.ConeGeometry(q.radius, q.height, Math.max(4, Math.ceil(q.radialSegments / 2)), 1, q.openEnded);
  if (!lite) return p;
  // The original may have been moved after it was made (cyl() stands it on its base): move the lighter one the same way.
  if (!g.boundingBox) g.computeBoundingBox();
  lite.computeBoundingBox();
  const a = g.boundingBox.getCenter(new THREE.Vector3()), b = lite.boundingBox.getCenter(new THREE.Vector3());
  lite.translate(a.x - b.x, a.y - b.y, a.z - b.z);
  return { ...p, geo: lite };
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
