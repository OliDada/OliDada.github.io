// Builds what an intelligent species has made (structures.mjs) around its herds'
// homes near the site, in its own culture's architecture:
//   tool users      cairns, trails of marked stones, simple shelters in their style, hearths
//   village builders  a village of dwellings around a gathering place, fields if they farm
//   city builders   a dense city in rings around a great structure, with paths and outlying towns
//   planet-shapers  a bigger city, roads running to the horizon and towns with lights all over the world
//   spacefarers     all that, a launch site of their own kind, satellites and a station in orbit,
//                   and ships that fly real routes: pad to station, town to town, in from deep space
//   system-shapers  the same, busier (their ring, elevators and habitats are drawn for the whole
//                   system by megastructures.js)
// Everything is merged into a few meshes (lit, glowing, blinking beacons, the pools of
// lamplight on the ground): a handful of draw calls however big the city. Footings reach into the ground so nothing floats on a slope. THREE is passed in.
import { rng } from './rng.mjs';
import { civilizationOf } from './civilizations.mjs';
import { networkFor, seaFloorTerrain } from './settlements.mjs';
import { shipDesign, buildShip, shipSize } from './ships.js';
import { plural } from './structures.mjs';
import { buildStationDeck } from './station-deck.js';
import { urbanOf } from './urban.mjs';
import { buildPlannedCity } from './city-plan.js';
import { planTown, planDistrict, floorH } from './town-plan.mjs';
import { buildAlien, farShape, sizeOf, farProtos, farMaterial } from './alien-build.js';
import { architectureOf } from './alien-arch.mjs';
import { makeKit, buildLot, buildProp, farMasses, farMesh } from './town-build.js';

const SINK = 1.6; // metres every footing reaches below the lowest ground it stands on
const PORT_DROP = 4; // metres the spaceport apron's rim may stand above a round world (see spaceport)
// Vertex budgets: laptops and desktops get far more than phones (coarse), which keep
// the old, lighter city. Far-off towns stop at BUDGET; the places built in full near the
// site at NEAR; streets, roads and plazas at GROUND.
const BUDGETS = { full: { BUDGET: 320000, NEAR: 250000, GROUND: 90000, GLOW: 90000 }, coarse: { BUDGET: 150000, NEAR: 124000, GROUND: 48000, GLOW: 22000 } };
const WALKERS = ['hands', 'grazers', 'rollers', 'tripods', 'tentacles'];
// Cultures whose buildings have a solid floor on the ground (levelled on a foundation).
const SOLID = ['timber', 'terraced', 'tents', 'coral', 'shells', 'conch', 'polyp', 'kelpweave', 'rings', 'hive', 'mounds', 'silk', 'trapdoor', 'burrows', 'rookery', 'earthworks', 'domes', 'tracks', 'living'];

// colonist: a spacefaring civilization from another world of this system that has
// settled this one (civilizations.mjs colonistOf); it builds a colony here.
export function buildStructures(THREE, { body, terrain, radius, signalNormal, landingNormal, fauna, colonist = null, coarse = false }) {
  const { BUDGET, NEAR: NEAR_BUDGET, GROUND: GROUND_BUDGET, GLOW: GLOW_CAP } = BUDGETS[coarse ? 'coarse' : 'full'];
  THREE_REF = THREE;
  const group = new THREE.Group(), obstacles = [], sites = [];
  const native = fauna?.species.length || civilizationOf(body)?.spaceborne ? civilizationOf(body) : null;
  // Colonists live under glass pressure domes, whatever they build at home.
  const civ = native || (colonist ? { ...colonist, colony: true, material: 'glass', culture: 'domes', hearths: false, fields: false,
    description: `A colony of the ${plural(colonist.species.name)} from ${colonist.homeName || 'another world of this system'}.${colonist.suits ? ' The air here is not theirs: they wear pressure suits outside.' : ''} At home, ${colonist.description.replace(/^The /, 'the ')}` } : null);
  // Colonies fly their home world's ships, satellites and stations, whatever they build here.
  const shipCiv = civ?.colony ? colonist : civ;
  const homes = native ? fauna.homes?.get(civ.species.id) || [] : [];
  const none = { group, civ: null, obstacles, sites, clearings: [], pieces: 0, update() {} };
  if (!civ || (native && !homes.length)) return none;

  // Sea builders build on the sea floor: open water is their ground (settlements.mjs seaFloorTerrain).
  if (civ.underwater || civ.species?.aquatic) terrain = seaFloorTerrain(terrain);
  let r = rng(body.seed, 'structures', civ.species.id); // (let: a planned town's lot builds with its own, so it looks the same each time it is built)
  const u = civ.unit, tall = civ.tall, level = civ.level;
  // The in-between steps (fauna.mjs BUILD_LEVEL) build like the step below and add their own.
  const tier = civ.tier || '', orbital = tier === 'orbital', industrial = tier === 'industrial', metalworkers = tier === 'metalworkers';
  // Ruins: a spaceborne civilization left its world (civilizations.mjs). Its towns still
  // stand, weathered and overgrown, dark at night, with nothing in its sky.
  const ruins = !!civ.spaceborne && !civ.colony;
  const C = colours(THREE, body, civ);
  if (ruins) for (const k of Object.keys(C)) if (!['window', 'beacon', 'ember', 'flame'].includes(k)) C[k] = '#' + new THREE.Color(C[k]).lerp(new THREE.Color(k === 'roof' || k === 'roof2' || k === 'turf' ? '#4f6a38' : '#6f7462'), .38).multiplyScalar(.82).getHexString();
  if (ruins) C.window = C.ember = C.flame = C.beacon = '#202420';
  // The world's conditions, read by everything built here: heat, cold, damp, thin air, gravity.
  const ph = body.physics || {}, tempC = (ph.temperature ?? 288) - 273.15, ramp = (a, b, v) => Math.min(1, Math.max(0, (v - a) / (b - a)));
  const clime = {
    hot: ramp(24, 55, tempC), cold: ramp(4, -30, tempC) * (ph.waterState === 'ice' || body.biome === 'Frozen' ? 1 : .8),
    damp: (body.biome === 'Verdant' || body.biome === 'Oceanic' ? .7 : 0) * ramp(-5, 15, tempC),
    dry: body.biome === 'Desert' || body.biome === 'Volcanic' ? 1 : 0, thin: ramp(.4, .05, ph.pressure ?? 1), heavy: ramp(1.2, 2.2, ph.gravity ?? 1),
  };
  const lit = merger(THREE, { snow: clime.cold, bleach: clime.hot * (clime.dry ? 1 : .6), damp: ruins ? 1 : clime.damp }), glow = merger(THREE), ground = merger(THREE); // ground: streets, roads and plazas
  const blink = merger(THREE), pool = merger(THREE), halos = []; // beacons that blink; lamplight on the ground and around lamps
  let unitsFollow = null; // (hand-builders' town units: see below)
  const weatherCfg = { snow: clime.cold, bleach: clime.hot * (clime.dry ? 1 : .6), damp: ruins ? 1 : clime.damp };
  // Materials shared by everything built here (and by the town units built later, near or far).
  const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9 }), glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), blinkMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), world = new THREE.Matrix4();
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(sx, sy, sz));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0);
  const cone = (rad, h, seg = 8) => new THREE.ConeGeometry(rad, h, seg, 1).translate(0, h / 2, 0);
  const ball = (rad, d = 0) => new THREE.IcosahedronGeometry(rad, d);
  // A tube through points whose radius changes along it (sea builders' spiral shells).
  const taperTube = (pts, radii, seg = 10) => {
    const pos = [], idx = [], up = V(0, 1, 0), t = V(), a = V(), b = V();
    pts.forEach((p, i) => {
      t.copy(pts[Math.min(pts.length - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
      a.crossVectors(Math.abs(t.y) > .9 ? V(1, 0, 0) : up, t).normalize(); b.crossVectors(t, a);
      for (let k = 0; k < seg; k++) { const w = k / seg * Math.PI * 2; pos.push(p.x + (a.x * Math.cos(w) + b.x * Math.sin(w)) * radii[i], p.y + (a.y * Math.cos(w) + b.y * Math.sin(w)) * radii[i], p.z + (a.z * Math.cos(w) + b.z * Math.sin(w)) * radii[i]); }
    });
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < seg; k++) { const p0 = i * seg + k, p1 = i * seg + (k + 1) % seg; idx.push(p0, p0 + seg, p1, p1, p0 + seg, p1 + seg); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const dome = (rad, seg = 10) => new THREE.SphereGeometry(rad, seg, Math.max(4, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2);
  const ring = (rad, tube, seg = 12) => new THREE.TorusGeometry(rad, tube, 4, seg).rotateX(Math.PI / 2);
  const sunk = (g) => g.translate(0, -SINK, 0);
  const pick = (...a) => a[Math.floor(r() * a.length)];
  // A pole or line from a to b (local points).
  const rod = (add, a, b, rad, colour, bright, seg = 5) => {
    const d = V(...b).sub(V(...a)), len = d.length(), m = new THREE.Matrix4().compose(V(...a), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1));
    add(cyl(rad, rad, len, seg), m, colour, bright);
  };
  const lights = level >= 3, streetLights = level >= 4; // cities glow from their windows; planet-shapers light their streets too
  // Stilt houses stand in the shallows and drifters' homes float, so both may build over water.
  const overWater = civ.culture === 'stilts' || civ.family === 'drifters';

  // --- Placement -------------------------------------------------------------
  const glows = []; let currentPlace = null;
  const nightLights = [], litPlaces = new Set(); // every lit piece's glow, and the places built (city-lights.js draws these from space)
  const placed = [], landmarks = { lamps: [], dishes: [], masts: [] };
  const dwellings = [], paths = []; // homes you can go into (interior.js), and the ways along the streets // where they stand (for previews and tests)
  let relief = 0; // how far the ground under the last wide flat piece falls below its top
  function frameAt(home) {
    const east = V(0, 1, 0).cross(home); if (east.lengthSq() < 1e-6) east.set(1, 0, 0).cross(home);
    east.normalize(); return { home, east, north: home.clone().cross(east).normalize() };
  }
  function pointAt(f, dist, angle) {
    const dir = f.east.clone().multiplyScalar(Math.cos(angle)).addScaledVector(f.north, Math.sin(angle)), a = dist / radius;
    return f.home.clone().multiplyScalar(Math.cos(a)).addScaledVector(dir, Math.sin(a)).normalize();
  }
  // place(frame, distance, angle, footprint radius, height, build, options): finds the
  // ground, stands the piece upright facing the frame's centre and lets build() add
  // parts in local coordinates. Refuses water, steep ground, crowding, and the signal and pad.
  function place(f, dist, angle, foot, height, build, { face = true, spacing = 1, aloft = false, road = false, at = null, faceTo = null, wet = false, top = false } = {}) {
    const n = at || pointAt(f, dist, angle);
    if (n.angleTo(signalNormal) * radius < 14 + foot || n.angleTo(landingNormal) * radius < 16 + foot) return false;
    for (const p of placed) if ((!road || !p.road) && p.n.angleTo(n) * radius < (p.foot + foot) * (road ? .7 : spacing)) return false;
    if (road) for (const p of placed) if (p.road && p.n.angleTo(n) * radius < foot * 1.2) return false;
    const fr = frameAt(n);
    let lo = Infinity, hi = -Infinity;
    // Wide flat pieces (a spaceport apron) sample the whole footprint and sit on its highest
    // ground, so no hill pokes through; the slab reaches down to the lowest. `top` is how
    // much the ground may fall away under it.
    // Buildings with a solid floor (build.found) are levelled: they stand on the highest
    // ground under them, on a stone foundation reaching down to the lowest, so no slope
    // pokes through the floor.
    const found = build.found && (build.found === 'always' || SOLID.includes(civ.culture)) && !aloft;
    const samples = top ? 25 : found ? 17 : 5;
    for (let k = 0; k < samples; k++) {
      const m = !k ? n : top || found ? pointAt(fr, foot * (1 + Math.floor((k - 1) / 8)) / (top ? 3 : 2.2), (k - 1) % 8 * Math.PI / 4 + Math.floor((k - 1) / 8) * .4) : pointAt(fr, aloft ? foot * .3 : foot, k * Math.PI / 2);
      if (terrain.isLiquid(m) && !(overWater && build.found) && !wet) return false; // only dwellings stand in the shallows
      const h = terrain.surface(m); lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    if (hi - lo > (top ? top : SINK * .9 + (aloft ? foot : foot * .5))) return false;
    // On steep ground a building's terrace stops at 2 m; above that it is cut into the slope.
    if (found) hi = Math.min(hi, lo + 2);
    relief = top || found ? hi - lo : 0;
    if (top || found) lo = hi;
    const to = (faceTo || f.home).clone().sub(n), up = n;
    const fwd = face && (faceTo || dist > .5) && to.lengthSq() > 1e-14 ? to.addScaledVector(n, -to.dot(n)).normalize() : fr.north;
    const right = up.clone().cross(fwd).normalize();
    const base = new THREE.Matrix4().makeBasis(right, up, fwd).setPosition(n.clone().multiplyScalar(radius + lo));
    const groundR = radius + lo;
    // gy(x, z): ground height at a local point relative to the base, or null over water (for yards).
    const gy = (x, z) => { const m = n.clone().addScaledVector(right, x / radius).addScaledVector(fwd, z / radius).normalize(); return terrain.isLiquid(m) && !overWater ? null : terrain.surface(m) - lo; };
    // bright: true glows, 'blink' blinks, 'pool' is lamplight on the ground, 'halo' a soft glow
    // around a lamp (g is null; the matrix's scale is its size).
    const addFn = (g, local, colour, bright = false) => {
      const m = world.multiplyMatrices(base, local);
      if (bright === 'light') { glows.push(new THREE.Vector3().setFromMatrixPosition(m)); return; }
      if (bright === true || bright === 'halo') glows.push(new THREE.Vector3().setFromMatrixPosition(m));
      if (bright === 'halo') return halos.push({ p: new THREE.Vector3().setFromMatrixPosition(m), size: local.getMaxScaleOnAxis(), colour });
      if (bright === 'pool') return pool.add(g, m, colour);
      if (bright === 'blink') return blink.add(g, m, colour);
      return bright ? glow.add(g, m, colour) : lit.add(g, m, colour, groundR, 1.4 * u);
    };
    if (found && relief > .1) addFn(new THREE.CylinderGeometry(foot * .86, foot * .86 + relief * .9, relief + SINK + .1, 12, 1).translate(0, -(relief + SINK) / 2 + .05, 0), new THREE.Matrix4(), C.plinth);
    glows.length = 0;
    build(addFn, gy);
    for (const sm of smokeFrom) if (!sm.at) sm.at = V(...sm.local).applyMatrix4(base); // smokestacks, now that we know where
    // Where this piece glows at night, for the lights seen from space (city-lights.js):
    // about one in three of its lit parts, up to eight, so a lit tower shows brighter than a lamp.
    if (glows.length && currentPlace) { const n = Math.min(8, Math.ceil(glows.length / 3)); for (let i = 0; i < n; i++) nightLights.push(glows[Math.floor((i + .5) * glows.length / n)]); }
    placed.push({ n, foot, road, base });
    // A dwelling, with its door on its local +z side (facing the street or the centre).
    if (build.dwelling && !aloft && currentPlace) dwellings.push({ n, base, foot, k: build.dwelling, h: build.dwellingH ?? 2.8 * u * build.dwelling * tall, ground: lo, door: V(0, 0, foot * .95).applyMatrix4(base), face: fwd.clone() });
    if (build === common.dish || build === common.mast || build === common.light) (build === common.dish ? landmarks.dishes : build === common.mast ? landmarks.masts : landmarks.lamps).push(n.clone());
    if (height > .35) obstacles.push({ p: n.clone().multiplyScalar(radius + lo), r: (aloft ? .3 : foot * .8), h: aloft ? 1 : height });
    return true;
  }
  // Tries a few spots near the one asked for; on rugged ground (the new land style is
  // hillier) then a ring of spots all round the place, a little nearer its centre.
  const settle = (f, dist, angle, foot, height, build, opts) => {
    for (let k = 0; k < 7; k++) if (place(f, dist + (k >> 1) * foot * .6, angle + (k % 2 ? 1 : -1) * k * .17, foot, height, build, opts)) return true;
    for (let k = 1; k < 9; k++) if (place(f, dist * .85, angle + k * Math.PI / 4.5, foot, height, build, opts)) return true;
    return false;
  };

  // --- Shared pieces ---------------------------------------------------------
  // Footings show as a plinth of darker stone (the colour argument is kept for callers).
  const footing = (add, w, colour) => { add(sunk(cyl(w * 1.06, w * 1.1, SINK + .25 * u, 8)), L(0, .25 * u, 0), C.stone2); };
  // Windows: lit for those that light their world; otherwise dark openings with a frame.
  const windows = (add, w, y, d, n = 2) => {
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * w / n;
      if (lights) add(box(.4 * u, .35 * u, .05), L(x, y, d), C.window, true);
      else if (level >= 2) { add(box(.5 * u, .45 * u, .04), L(x, y - .05 * u, d), C.trim); add(box(.36 * u, .32 * u, .06), L(x, y, d + .01), C.door); }
    }
  };
  // A surface draped over the ground (local w by d, a vertex about every metre), raised by lift.
  const drape = (add, gy, w, d, lift, colour, step = 1) => {
    const nx = Math.max(2, Math.ceil(w / step)), nz = Math.max(2, Math.ceil(d / step)), pos = [];
    const P = (i, j) => { const x = -w / 2 + w * i / nx, z = -d / 2 + d * j / nz; return [x, (gy?.(x, z) ?? 0) + lift, z]; };
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) pos.push(...P(i, j), ...P(i, j + 1), ...P(i + 1, j), ...P(i + 1, j), ...P(i, j + 1), ...P(i + 1, j + 1));
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    add(geo, L(), colour);
  };
  // --- Lamps -----------------------------------------------------------------
  // Street and garden lamps in the builders' own way: cultures that grow their homes grow
  // glowing bulbs on curled stalks; others hang a lantern from an arm over the street or
  // crown a post with a frosted orb. Each throws a pool of light on the ground and a soft
  // halo around itself, both brightening as night falls (update()).
  const GROWN = ['grown', 'living', 'shell', 'wax', 'silk', 'membrane'];
  const lampKind = GROWN.includes(civ.material) || civ.species.glow ? 'bulb' : civ.colony || civ.material === 'glass' ? 'orb' : rng(civ.seed ?? 1, 'lamp')() < .55 ? 'lantern' : 'orb';
  const lampPool = (add, gy, x, z, rad) => {
    const rings = 3, segs = 10, pos = [], col = [], c = new THREE.Color(C.window), P = (d, a) => { const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; return [px, (gy?.(px, pz) ?? 0) + .3, pz]; };
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
      const d0 = rad * i / rings, d1 = rad * (i + 1) / rings, a0 = j / segs * 6.283, a1 = (j + 1) / segs * 6.283, k0 = (1 - i / rings) ** 2 * .32, k1 = (1 - (i + 1) / rings) ** 2 * .32;
      pos.push(...P(d0, a0), ...P(d1, a1), ...P(d1, a0), ...P(d0, a0), ...P(d0, a1), ...P(d1, a1));
      for (const k of [k0, k1, k1, k0, k0, k1]) col.push(c.r * k, c.g * k, c.b * k);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    add(g, L(), null, 'pool');
  };
  function lamp(add, gy, s = 1) {
    const k = u * s, h = 2.7 * k;
    if (lampKind === 'lantern') { // a post with a curled arm, a lantern hanging over the street
      add(sunk(cyl(.17 * k, .22 * k, .4 * k + SINK, 5)), L(), C.stone2);
      add(cyl(.055 * k, .085 * k, h, 5), L(0, .4 * k, 0), C.metal);
      add(box(.05 * k, .05 * k, .75 * k), L(0, h + .32 * k, .36 * k), C.metal);
      rod(add, [0, h * .82, 0], [0, h + .3 * k, .34 * k], .025 * k, C.metal, false, 3);
      const y = h - .25 * k, z = .7 * k;
      add(cyl(.015 * k, .015 * k, .22 * k, 3), L(0, y + .3 * k, z), C.metal);
      add(cone(.2 * k, .16 * k, 6), L(0, y + .22 * k, z), C.metal);
      add(cyl(.12 * k, .085 * k, .24 * k, 6), L(0, y - .02 * k, z), C.window, true);
      add(null, L(0, y + .1 * k, z, 0, 0, 0, 1.9 * k, 1.9 * k, 1.9 * k), C.window, 'halo');
      lampPool(add, gy, 0, z, 3.6 * k);
    } else if (lampKind === 'orb') { // a slim post crowned with a frosted orb
      add(sunk(cyl(.16 * k, .2 * k, .25 * k + SINK, 8)), L(), C.metal);
      add(cyl(.05 * k, .09 * k, h, 8), L(0, .25 * k, 0), C.metal2);
      add(cyl(.13 * k, .07 * k, .14 * k, 8), L(0, h + .2 * k, 0), C.metal);
      add(new THREE.SphereGeometry(.2 * k, 10, 6), L(0, h + .52 * k, 0), C.window, true);
      add(new THREE.TorusGeometry(.2 * k, .025 * k, 3, 12).rotateX(Math.PI / 2), L(0, h + .52 * k, 0), C.metal);
      add(null, L(0, h + .52 * k, 0, 0, 0, 0, 2 * k, 2 * k, 2 * k), C.window, 'halo');
      lampPool(add, gy, 0, 0, 3.4 * k);
    } else { // a curled stalk bowing under a glowing bulb, capped with a leaf
      const pts = [];
      for (let i = 0; i <= 5; i++) { const t = i / 5, a = t * 1.9; pts.push([0, Math.sin(a) * h * .72 + (t < .5 ? t * h * .35 : .17 * h), (1 - Math.cos(a)) * .45 * k]); }
      add(sunk(cyl(.2 * k, .3 * k, .25 * k + SINK, 6)), L(), C.plinth);
      for (let i = 0; i < 5; i++) rod(add, pts[i], pts[i + 1], (.09 - i * .012) * k, C.accent2, false, 5);
      const [bx, by, bz] = pts[5];
      add(cone(.3 * k, .14 * k, 7).rotateX(Math.PI), L(bx, by + .08 * k, bz + .08 * k), C.leaf);
      add(new THREE.SphereGeometry(.18 * k, 10, 8).scale(1, 1.3, 1), L(bx, by - .2 * k, bz + .08 * k), C.window, true);
      add(null, L(bx, by - .2 * k, bz + .08 * k, 0, 0, 0, 1.8 * k, 1.8 * k, 1.8 * k), C.window, 'halo');
      lampPool(add, gy, bx, bz, 3.2 * k);
    }
  }
  // --- Towers (system-shapers) -------------------------------------------------
  // The cores of system-shapers' cities rise as towers in their own idiom: stepped
  // glass spires (most), grown spires of swelling bulbs (cultures that grow their homes)
  // or clusters of hexagonal shafts (hives, spiders, burrowers), banded with lit floors
  // and crowned with beacons. A tower is a few simple prisms, so a skyline of them costs
  // fewer vertices than the dwellings it replaces; the lit bands are what make it a city.
  // City worlds (urban.mjs): the whole capital is towers, and a planned city covers the land round it.
  const urban = !civ.colony && !civ.underwater ? urbanOf(body) : null;
  const megacity = (level >= 5 || !!urban) && !civ.colony; // spacefarers and up build skylines
  // Hand-builders from villages up: places planned street by street (town-plan.mjs), built near or far alike (town-build.js).
  const handsTowns = civ.family !== 'drifters' && !civ.colony && !civ.underwater && !civ.species?.aquatic && level >= 2;
  // Each family raises its own kind of tower: fliers roost towers ringed with landing ledges,
  // drifters towers that float on their tethers, burrowers domes over deep shafts.
  const towerKind = civ.family === 'nests' ? 'roost' : civ.family === 'drifters' ? 'floating' : civ.family === 'burrowers' || ['mounds', 'trapdoor', 'burrows'].includes(civ.culture) ? 'burrow'
    : GROWN.includes(civ.material) ? 'grown' : ['hive', 'web'].includes(civ.family) ? 'comb' : 'spire';
  const mixC = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  const glowFor = (c) => mixC(c, '#ffffff', .25);
  // Glass and frames take the world's own material: icy, sandstone, timber-clad, stone or glass.
  const glassC = mixC(C.wall, '#8fc9dc', { ice: .25, adobe: .18, wood: .35, stone: .45, glass: .7 }[civ.material] ?? .5), frameC = mixC(C.wall, '#e8ecef', .35);
  // How each species lights its buildings: not always rows of windows. Some band their
  // towers with light, some run it in vertical seams, some prick them with round ports,
  // some wind it up in a spiral, a few use windows much as we would. Fixed per species.
  const lr = rng(civ.seed ?? 1, 'light-style');
  const lightStyle = ({ grown: ['dots', 'spiral'], comb: ['dots', 'bands'], roost: ['strips', 'dots'], floating: ['dots', 'bands'], burrow: ['dots'] }[towerKind] || ['bands', 'strips', 'dots', 'spiral', 'strips', 'dots', 'windows'])[Math.floor(lr() * 7) % ({ grown: 2, comb: 2, roost: 2, floating: 2, burrow: 1 }[towerKind] || 7)];
  const lightC = civ.species.glow ? glowFor(mixC(C.window, civ.species.colors?.glow || C.accent, .5)) : lr() < .5 ? C.window : mixC(C.window, pick(C.accent2, '#9fe3ff', '#c9a0ff'), .45);
  function lit_(add, w, y0, y1, sides, gap = 4.2 * u) {
    const H = y1 - y0; if (H <= 0) return;
    const style = glow.count() > GLOW_CAP ? 'bands' : lightStyle; // past the cap, plain bands, wide apart
    if (style !== lightStyle) gap *= 2;
    switch (style) {
      case 'strips': for (let i = 0; i < sides; i++) { const a = (i + .5) / sides * 6.283; add(box(.22 * u, H * .9, .06 * u), L(Math.sin(a) * w * Math.cos(Math.PI / sides) * 1.01, y0 + H * .05, Math.cos(a) * w * Math.cos(Math.PI / sides) * 1.01, 0, a, 0), lightC, true); } break;
      case 'dots': { const per = Math.min(10, sides * 2); let n = 0; for (let y = y0 + gap * .5; y < y1 - gap * .3 && n < 60; y += gap * .8) for (let i = 0; i < per; i++, n++) { const a = (i + (Math.round(y / gap) % 2) * .5) / per * 6.283; add(new THREE.CircleGeometry(.28 * u, 6), L(Math.sin(a) * w * .97, y, Math.cos(a) * w * .97, 0, a, 0), lightC, true); } break; }
      case 'spiral': for (let t = 0, n = Math.max(8, Math.round(H / u * 1.2)); t < n; t++) { const y = y0 + (t + .5) / n * H, a = t * .55; add(box(.9 * u, .22 * u, .06 * u), L(Math.sin(a) * w * 1.0, y, Math.cos(a) * w * 1.0, 0, a, .3), lightC, true); } break;
      case 'windows': for (let y = y0 + gap * .6; y < y1 - gap * .3; y += gap * .6) for (let i = 0; i < sides; i++) { const a = (i + .5) / sides * 6.283; for (const dx of [-.25, .25]) add(box(.35 * u, .45 * u, .05), L(Math.sin(a) * w * .93 + Math.cos(a) * dx * w, y, Math.cos(a) * w * .93 - Math.sin(a) * dx * w, 0, a, 0), lightC, true); } break;
      default: for (let y = y0 + gap * .6; y < y1 - gap * .3; y += gap) add(new THREE.CylinderGeometry(w * 1.015, w * 1.015, .32 * u, sides, 1, true).translate(0, .16 * u, 0), L(0, y, 0, 0, Math.PI / sides, 0), lightC, true);
    }
  }
  const bands = lit_;
  // Spires come in many forms so no two blocks of a skyline look alike, each in its own
  // glass and trim, and each civilization's path adds forms of its own (farm towers for
  // the agrarian, cathedral spires for the devotional, observatory crowns for scholars,
  // bastions for the martial, billboard blades for traders).
  const GLASS = [glassC, mixC(glassC, '#2b4a5c', .45), mixC(glassC, '#c9a46a', .4), mixC(glassC, '#e9eef2', .45), mixC(glassC, C.accent, .25), mixC(glassC, '#16202a', .55)];
  // Each culture raises its skyline in its own idiom: timber builders pagodas of flared
  // roofs, terrace builders ziggurats, tent builders masts hung with fabric, stilt builders
  // towers striding on legs, and so on. Our own glass forms are only an occasional extra.
  const CULTURE_FORMS = { timber: ['pagoda', 'pagoda', 'pagoda', 'ringed'], terraced: ['ziggurat', 'ziggurat', 'ziggurat', 'bastion'], tents: ['mast', 'mast', 'mast', 'needle'], stilts: ['legs', 'legs', 'legs', 'twin'],
    stiltpods: ['legs', 'legs', 'ringed'], rings: ['ringed', 'ringed', 'domed'], earthworks: ['ziggurat', 'domed', 'bastion'], domes: ['domed', 'domed', 'ringed'], tracks: ['ringed', 'ringed', 'domed'] }[civ.culture];
  const GENERIC = ['stepped', 'twisted', 'twin', 'ringed', 'blade', 'needle', 'garden'];
  const FORMS = [...(CULTURE_FORMS || GENERIC), GENERIC[Math.floor(lr() * GENERIC.length)],
    ...(clime.hot > .4 ? ['louvred', 'louvred', 'garden'] : []), ...(clime.cold > .4 ? ['stepped', 'bastion'] : []),
    ...({ agrarian: ['farm', 'farm'], devotional: ['cathedral', 'cathedral'], scholarly: ['observatory', 'observatory'], martial: ['bastion', 'bastion'], mercantile: ['billboard', 'blade'], expansionist: ['ringed', 'needle'] }[civ.path] || [])];
  const beacon = (add, y) => { rod(add, [0, y, 0], [0, y + 4 * u, 0], .06 * u, C.metal, false, 4); add(ball(.22 * u, 1), L(0, y + 4.1 * u, 0), C.beacon, 'blink'); };
  function spire(add, k, H, form = pick(...FORMS)) {
    const glass = pick(...GLASS), trim = r() < .5 ? frameC : mixC(frameC, C.accent, .35), w0 = 2.1 * u * k, sides = pick(4, 6, 8);
    const prism = (w, y, h, twist = 0, c = glass, sd = sides, taper = .97) => { add(y ? cyl(w * taper, w, h, sd) : sunk(cyl(w * taper, w, h + SINK, sd)), L(0, y, 0, 0, Math.PI / sd + twist, 0), c); bands(add, w, y, y + h, sd); };
    switch (form) {
      case 'twisted': { // stacked slabs, each turned a little further
        const n = Math.max(5, Math.round(H / (4 * u))), h = H / n;
        for (let i = 0; i < n; i++) { add(i ? box(w0 * 1.5, h * .92, w0 * .95) : sunk(box(w0 * 1.5, h * .92 + SINK, w0 * .95)), L(0, i * h, 0, 0, i * .16, 0), i % 3 ? glass : trim); add(box(w0 * 1.53, .25 * u, w0 * .98), L(0, i * h + h * .5, 0, 0, i * .16, 0), C.window, true); }
        beacon(add, H); break;
      }
      case 'twin': { // two shafts joined by a sky bridge
        for (const x of [-1, 1]) { add(sunk(cyl(w0 * .62, w0 * .7, H * (x > 0 ? 1 : .86) + SINK, sides)), L(x * w0 * .95, 0, 0, 0, Math.PI / sides, 0), glass); bands(add, w0 * .7, 0, H * (x > 0 ? 1 : .86), sides); }
        add(box(w0 * 2, 1.4 * u, w0 * .7), L(0, H * .62, 0), trim); add(box(w0 * 2.02, .3 * u, w0 * .72), L(0, H * .62 + .55 * u, 0), C.window, true);
        add(cone(w0 * .62, H * .1, sides), L(w0 * .95, H, 0), trim); beacon(add, H * 1.08); break;
      }
      case 'ringed': { // a tall shaft wearing halo rings
        prism(w0 * .8, 0, H, 0, glass, 12, .9);
        for (let i = 1; i <= 3; i++) add(new THREE.TorusGeometry(w0 * (1.25 + i * .12), .22 * u, 3, 20).rotateX(Math.PI / 2), L(0, H * (.35 + i * .18), 0), i === 3 ? C.window : trim, i === 3);
        add(cone(w0 * .72, H * .18, 12), L(0, H, 0), trim); beacon(add, H * 1.15); break;
      }
      case 'blade': case 'billboard': { // a thin slab with fins down its edges
        add(sunk(box(w0 * 2.2, H + SINK, w0 * .7)), L(), glass);
        for (const x of [-1, 1]) add(box(.35 * u, H * 1.04, w0 * .9), L(x * w0 * 1.1, 0, 0), trim);
        for (let y = 3 * u; y < H; y += 4 * u) add(box(w0 * 2.22, .25 * u, w0 * .72), L(0, y, 0), C.window, true);
        if (form === 'billboard') for (const z of [-1, 1]) add(box(w0 * 1.6, H * .14, .1 * u), L(0, H * (.55 + r() * .25), z * w0 * .37), pick(C.accent, C.accent2, glowFor(C.window)), true);
        beacon(add, H); break;
      }
      case 'louvred': { // a hot world's tower: deep vertical fins shade the glass
        prism(w0, 0, H, 0, glass, 4, .95);
        for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, x = Math.cos(a) * w0 * .78, z = Math.sin(a) * w0 * .78; add(box(.18 * u, H * .96, w0 * .3), L(x, 0, z, 0, -a, 0), trim); }
        add(box(w0 * 1.7, .5 * u, w0 * 1.7), L(0, H, 0, 0, Math.PI / 4, 0), trim); beacon(add, H + .5 * u); break;
      }
      case 'pagoda': { // stacked storeys, each under a wide flared roof with upturned corners
        const n = Math.max(4, Math.round(H / (5 * u))), h = H / n, sd = pick(4, 8); let w = w0 * 1.1;
        for (let i = 0; i < n; i++) {
          const y = i * h; add(i ? cyl(w * .95, w, h * .72, sd) : sunk(cyl(w * .95, w, h * .72 + SINK, sd)), L(0, y, 0, 0, Math.PI / sd, 0), i % 2 ? glass : mixC(glass, C.wood, .4));
          bands(add, w * .98, y, y + h * .72, sd, h * .5);
          add(new THREE.ConeGeometry(w * 1.75, h * .32, sd, 1, true).translate(0, h * .16, 0), L(0, y + h * .7, 0, 0, Math.PI / sd, 0), i % 2 ? C.roof : trim);
          for (let j = 0; j < sd; j += sd / 4) { const a = (j / sd) * 6.283 + Math.PI / sd; add(cone(.25 * u, .9 * u, 4), L(Math.sin(a) * w * 1.7, y + h * .72, Math.cos(a) * w * 1.7, Math.cos(a) * -.6, 0, Math.sin(a) * .6), trim); }
          w *= .9;
        }
        rod(add, [0, H, 0], [0, H + 5 * u, 0], .1 * u, C.accent, false, 5); for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(.5 * u, .08 * u, 3, 8).rotateX(Math.PI / 2), L(0, H + 1 * u + i * .9 * u, 0), C.accent);
        add(ball(.22 * u, 1), L(0, H + 5.2 * u, 0), C.beacon, 'blink'); break;
      }
      case 'ziggurat': { // stepped terraces with a stair up one face and a shrine on top
        const n = 4 + Math.floor(r() * 3), h = H * .82 / n; let w = w0 * 2;
        for (let i = 0; i < n; i++) { add(i ? box(w, h, w) : sunk(box(w, h + SINK, w)), L(0, i * h, 0), i % 2 ? mixC(glass, C.wall, .5) : C.wall); bands(add, w * .62, i * h, i * h + h, 4, h * .45); add(box(w * 1.03, .3 * u, w * 1.03), L(0, (i + 1) * h - .3 * u, 0), C.turf); w *= .8; }
        const stair = Math.hypot(H * .82, w0 * .8); add(box(w0 * .5, .5 * u, stair).translate(0, 0, stair / 2), L(0, 0, w0, -Math.atan2(H * .82, w0 * .8) + Math.PI, Math.PI, 0), trim);
        add(box(w * .9, H * .14, w * .9), L(0, H * .82, 0), trim); add(box(w * .5, H * .1, .1), L(0, H * .82, w * .46), lightC, true); break;
      }
      case 'mast': { // a soaring mast hung with tiers of fabric, guyed to the ground
        add(sunk(cyl(.5 * u * k, .9 * u * k, H * 1.1 + SINK, 6)), L(), C.metal);
        for (let i = 0, n = 3 + Math.floor(r() * 2); i < n; i++) { const y = H * (.15 + i * .78 / n), w = w0 * (1.6 - i * .25); add(new THREE.ConeGeometry(w, H * .22, 9, 1, true).translate(0, H * .11, 0), L(0, y, 0, 0, i * .3, 0), i % 2 ? C.wall : C.accent); add(new THREE.TorusGeometry(w * .98, .1 * u, 3, 18).rotateX(Math.PI / 2), L(0, y + .1 * u, 0), lightC, true); add(new THREE.CircleGeometry(w * .9, 9).rotateX(Math.PI / 2), L(0, y + .05, 0, 0, i * .3, 0), mixC(C.wall, '#000000', .3)); }
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; rod(add, [0, H * 1.1, 0], [Math.cos(a) * w0 * 3, 0, Math.sin(a) * w0 * 3], .05 * u, C.line, false, 3); }
        add(ball(.25 * u, 1), L(0, H * 1.12, 0), C.beacon, 'blink'); break;
      }
      case 'legs': { // the tower strides on four great legs, a sky bridge reaching out
        const lift = H * .3, w = w0 * 1.05;
        for (let i = 0; i < 4; i++) { const a = i * 1.571 + .785; rod(add, [Math.cos(a) * w * 2.2, -SINK, Math.sin(a) * w * 2.2], [Math.cos(a) * w * .7, lift + 1 * u, Math.sin(a) * w * .7], .5 * u * k, trim, false, 6); }
        add(cyl(w, w * .6, 2 * u, 8), L(0, lift - 1.5 * u, 0), trim);
        prism(w, lift, H - lift, 0, glass, 8, .9); add(cone(w * .9, H * .1, 8), L(0, H, 0), trim);
        add(box(w * 3, 1.2 * u, w * .6), L(w * 1.5, lift + (H - lift) * .5, 0), trim); add(box(w * 3, .25 * u, w * .62), L(w * 1.5, lift + (H - lift) * .5 + .5 * u, 0), lightC, true); break;
      }
      case 'domed': { // dome on dome, narrowing as they rise
        let y = 0, w = w0 * 1.4; const n = 3 + Math.floor(r() * 3);
        add(sunk(cyl(w, w * 1.05, 1 * u + SINK, 12)), L(), trim);
        for (let i = 0; i < n; i++) { const h = H / n; add(cyl(w * .9, w, h * .55, 12), L(0, y + 1 * u, 0), glass); bands(add, w * .95, y + 1 * u, y + 1 * u + h * .55, 12, h * .4); add(new THREE.SphereGeometry(w, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .55, 1), L(0, y + 1 * u + h * .55, 0), i % 2 ? C.wall : trim); y += h * .85; w *= .72; }
        add(ball(.25 * u, 1), L(0, y + 2 * u, 0), C.beacon, 'blink'); break;
      }
      case 'needle': { // one long taper to a point
        add(sunk(cyl(w0 * .25, w0 * 1.05, H * .9 + SINK, sides)), L(0, 0, 0, 0, Math.PI / sides, 0), glass); bands(add, w0 * .8, 0, H * .6, sides);
        add(cone(w0 * .25, H * .35, sides), L(0, H * .9, 0, 0, Math.PI / sides, 0), trim); add(ball(.2 * u, 1), L(0, H * 1.25, 0), C.beacon, 'blink'); break;
      }
      case 'garden': case 'farm': { // terraces planted with trees (farm towers: green-lit growing floors)
        let y = 0, w = w0 * 1.15; const tiers = 3 + Math.floor(r() * 3), h = H / tiers;
        for (let i = 0; i < tiers; i++) {
          add(i ? box(w * 1.6, h, w * 1.6) : sunk(box(w * 1.6, h + SINK, w * 1.6)), L(0, y, 0, 0, i * .4, 0), form === 'farm' ? mixC(glass, '#6fbf6a', .25) : glass);
          for (let yy = y + 1.8 * u; yy < y + h - .5 * u; yy += 2.6 * u) add(box(w * 1.62, .22 * u, w * 1.62), L(0, yy, 0, 0, i * .4, 0), form === 'farm' ? '#b8ff8a' : C.window, true);
          y += h; add(box(w * 1.7, .4 * u, w * 1.7), L(0, y, 0, 0, i * .4, 0), C.turf);
          for (let j = 0; j < 4; j++) add(ball(.55 * u, 0), L(Math.cos(j * 1.57 + i * .4) * w * .6, y + .8 * u, Math.sin(j * 1.57 + i * .4) * w * .6, 0, 0, 0, 1, 1.3, 1), C.leaf);
          w *= .78;
        }
        beacon(add, y + .4 * u); break;
      }
      case 'cathedral': { // a pointed spire flanked by pinnacles, a rose of light high up
        prism(w0, 0, H * .62, 0, glass, 8, .92);
        add(cone(w0 * .95, H * .55, 8), L(0, H * .62, 0, 0, Math.PI / 8, 0), trim);
        for (let i = 0; i < 4; i++) { const a = i * 1.571 + .4; add(sunk(cyl(.3 * u, .45 * u, H * .55 + SINK, 6)), L(Math.cos(a) * w0 * 1.15, 0, Math.sin(a) * w0 * 1.15), trim); add(cone(.45 * u, H * .14, 6), L(Math.cos(a) * w0 * 1.15, H * .55, Math.sin(a) * w0 * 1.15), trim); }
        for (let i = 0; i < 4; i++) add(new THREE.CircleGeometry(w0 * .5, 12), L(Math.sin(i * 1.571) * w0 * .93, H * .5, Math.cos(i * 1.571) * w0 * .93, 0, i * 1.571, 0), glowFor(C.accent), true);
        add(ball(.25 * u, 1), L(0, H * 1.18, 0), C.beacon, 'blink'); break;
      }
      case 'observatory': { // a stepped tower crowned with a slotted dome
        prism(w0, 0, H * .7, 0, glass, sides); prism(w0 * .78, H * .7, H * .18, 0, trim, sides);
        add(dome(w0 * .8, 12), L(0, H * .88, 0, 0, r() * 6, 0), C.metal2);
        add(box(.5 * u, w0 * .8, w0 * 1.62), L(0, H * .88, 0, 0, r() * 6, 0), C.door);
        add(new THREE.TorusGeometry(w0 * .82, .12 * u, 3, 16).rotateX(Math.PI / 2), L(0, H * .88, 0), C.window, true); break;
      }
      case 'bastion': { // broad, battered walls and a crenellated crown
        prism(w0 * 1.25, 0, H * .7, 0, mixC(glass, C.stone, .5), 4, .8);
        for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; add(box(.8 * u, 1.2 * u, .8 * u), L(Math.cos(a) * w0, H * .7, Math.sin(a) * w0), trim); }
        prism(w0 * .55, H * .7, H * .3, 0, glass, 4); beacon(add, H); break;
      }
      default: { // stepped setbacks, each tier narrower
        const tiers = 2 + Math.floor(r() * 3); let y = 0, w = w0;
        for (let i = 0; i < tiers; i++) { const h = H * (i ? .55 : 1) / (tiers * .78); prism(w, y, h, 0, i % 2 ? trim : glass); y += h; add(cyl(w * 1.06, w * 1.06, .35 * u, sides), L(0, y, 0, 0, Math.PI / sides, 0), trim); w *= .72; }
        add(cone(w * .9, H * .12, sides), L(0, y + .35 * u, 0, 0, Math.PI / sides, 0), trim); beacon(add, y + H * .1);
      }
    }
  }

  const tower = (k, H0) => Object.assign((add) => {
    const H = H0 * Math.min(1.25, tall); // strong gravity keeps towers lower, weak gravity lets them soar
    if (towerKind === 'roost') { // a slender column spiralled with landing ledges and open arches
      const w = 1.5 * u * k; add(sunk(cyl(w * .8, w * 1.1, H + SINK, 8)), L(), pick(...GLASS));
      for (let y = 4 * u, i = 0; y < H; y += 3.4 * u, i++) { const a = i * 1.1; add(cyl(w * 1.6, w * 1.6, .25 * u, 10).translate(w * 1.2, 0, 0), L(0, y, 0, 0, a, 0), frameC); add(box(w * .9, 1.6 * u, .1), L(Math.cos(-a) * w * .82, y + .25 * u, Math.sin(-a) * w * .82, 0, a + Math.PI / 2, 0), C.window, true); }
      add(cone(w * 1.2, H * .12, 8), L(0, H, 0), frameC); for (let i = 0; i < 4; i++) rod(add, [0, H + H * .1, 0], [Math.cos(i * 1.57) * w * 2.2, H + H * .04, Math.sin(i * 1.57) * w * 2.2], .06 * u, C.metal, false, 3);
      add(ball(.22 * u, 1), L(0, H + H * .13, 0), C.beacon, 'blink');
    } else if (towerKind === 'floating') { // a tower afloat on its tether, a gas-bag crown above
      const lift = 8 * u, w = 1.8 * u * k;
      add(sunk(cyl(.6 * u, .9 * u, 1 * u + SINK, 6)), L(), C.stone2); rod(add, [0, 1 * u, 0], [0, lift, 0], .08 * u, C.line, false, 4);
      add(cone(w, 3 * u, 8).rotateX(Math.PI).translate(0, 3 * u, 0), L(0, lift - 3 * u, 0), frameC);
      add(cyl(w * .9, w, H * .6, 8), L(0, lift, 0), pick(...GLASS)); bands(add, w, lift, lift + H * .6, 8);
      add(new THREE.SphereGeometry(w * 1.7, 12, 8).scale(1, .75, 1), L(0, lift + H * .6 + w * 1.2, 0), C.bag);
      for (let i = 0; i < 3; i++) rod(add, [Math.cos(i * 2.09) * w, lift + H * .3, Math.sin(i * 2.09) * w], [Math.cos(i * 2.09) * w * 4, 0, Math.sin(i * 2.09) * w * 4], .04 * u, C.line, false, 3);
    } else if (towerKind === 'burrow') { // a broad dome over a deep shaft, lit skylights round it, vents smoking
      const R = 3 * u * k, h = Math.min(H * .3, R * 1.4);
      add(sunk(cyl(R * 1.1, R * 1.2, .6 * u + SINK, 14)), L(), C.plinth); add(new THREE.SphereGeometry(R, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / R, 1), L(0, .6 * u, 0), C.wall);
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; add(new THREE.CircleGeometry(.5 * u, 8), L(Math.cos(a) * R * .72, .6 * u + h * .62, Math.sin(a) * R * .72, -.9, -a + Math.PI / 2, 0), C.window, true); }
      add(new THREE.CircleGeometry(R * .3, 12).rotateX(-Math.PI / 2), L(0, .6 * u + h + .02, 0), C.window, true);
      add(cyl(.35 * u, .45 * u, h + 2.5 * u, 6), L(R * .9, 0, 0), C.metal); if (smokeFrom.length < 24 && r() < .3) smokeFrom.push({ local: [R * .9, h + 2.5 * u, 0], at: null, k: .7 });
    } else if (towerKind === 'spire') {
      spire(add, k, H);
    } else if (towerKind === 'grown') {
      let y = 0, w = 2.3 * u * k;
      add(sunk(cyl(w * .8, w * 1.1, SINK + 1.5 * u, 8)), L(), C.wall2);
      for (let i = 0, n = 3 + Math.floor(H / (9 * u)); i < n; i++) {
        const h = H / n * 1.05, bw = w * (1 - i / n * .55);
        add(new THREE.SphereGeometry(bw, 9, 6).scale(1, h / bw * .62, 1), L(0, y + h * .5, 0, 0, i * .7, 0), i % 2 ? C.wall : C.wall2);
        add(new THREE.TorusGeometry(bw * .92, .14 * u, 3, 12).rotateX(Math.PI / 2), L(0, y + h * .5, 0), C.window, true);
        add(cone(bw * 1.2, .5 * u, 7).rotateX(Math.PI), L(0, y + h * .98, 0), C.leaf);
        y += h * .92;
      }
      add(new THREE.SphereGeometry(.7 * u * k, 8, 6), L(0, y + .5 * u, 0), C.window, true);
    } else {
      const shafts = 3 + Math.floor(r() * 4);
      for (let i = 0; i < shafts; i++) {
        const a = i / shafts * 6.283, d = i ? 1.9 * u * k : 0, h = H * (i ? .5 + r() * .4 : 1), w = 1.15 * u * k;
        add(sunk(cyl(w, w, h + SINK, 6)), L(Math.cos(a) * d, 0, Math.sin(a) * d), i % 2 ? C.wall : C.wall2);
        add(new THREE.CircleGeometry(w * .8, 6).rotateX(-Math.PI / 2), L(Math.cos(a) * d, h + .02, Math.sin(a) * d), C.window, true);
        for (let y = 3 * u; y < h - 1.5 * u; y += 3.4 * u) add(new THREE.CylinderGeometry(w * 1.02, w * 1.02, .3 * u, 6, 1, true), L(Math.cos(a) * d, y, Math.sin(a) * d), C.window, true);
      }
      add(ball(.2 * u, 1), L(0, H + .3 * u, 0), C.beacon, 'blink');
    }
  }, { found: true, dwelling: k, dwellingH: 3.4 * u }); // its ground floor is a home you can enter (interior.js)
  // The capital's centrepiece: an arcology, a city in one tower, ringed with lit terraces.
  const arcology = (k) => Object.assign((add) => {
    const H = 70 * u * k * Math.min(1.3, tall), w0 = 7.5 * u * k * (.8 + lr() * .4), sides = towerKind === 'comb' ? 6 : [6, 8, 12, 5][Math.floor(lr() * 4)];
    if (towerKind !== 'spire' && towerKind !== 'comb') { tower(k * 2.4, H)(add); return; } // grown, roost, floating and burrow capitals: their own tower, writ large
    // Cultures with a skyline idiom of their own crown the capital with it, writ large, and
    // each species adds a crown of its own: a dome, a halo ring, an open frame or a garden.
    if (CULTURE_FORMS && towerKind === 'spire') {
      spire(add, k * 3.1, H, CULTURE_FORMS[0]);
      const crown = ['dome', 'halo', 'frame', 'garden', 'none'][Math.floor(lr() * 5)], top = H * (CULTURE_FORMS[0] === 'ziggurat' ? .98 : CULTURE_FORMS[0] === 'mast' ? 1.12 : 1.02);
      if (crown === 'dome') add(new THREE.SphereGeometry(4 * u * k, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), L(0, top, 0), frameC);
      if (crown === 'halo') for (let i = 0; i < 2; i++) add(new THREE.TorusGeometry((9 + i * 3) * u * k, .3 * u, 3, 32).rotateX(Math.PI / 2 + (i ? .3 : -.2)), L(0, top * (.86 - i * .1), 0), lightC, true);
      if (crown === 'frame') for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; rod(add, [Math.cos(a) * 5 * u * k, top * .8, Math.sin(a) * 5 * u * k], [0, top + 12 * u, 0], .2 * u, C.metal, false, 4); }
      if (crown === 'garden') for (let i = 0; i < 7; i++) add(ball(1.4 * u * k, 0), L(Math.cos(i) * 3 * u * k, top + .6 * u, Math.sin(i) * 3 * u * k, 0, 0, 0, 1, 1.3, 1), C.leaf);
      return;
    }
    add(sunk(cyl(w0 * 1.25, w0 * 1.35, 2 * u + SINK, sides)), L(), C.plinth);
    let y = 2 * u, w = w0;
    for (let i = 0; i < 4; i++) {
      const h = H * [.34, .27, .2, .13][i];
      add(cyl(w * .82, w, h, sides), L(0, y, 0), i % 2 ? frameC : glassC);
      bands(add, w * .92, y, y + h, sides, 3.6 * u);
      y += h;
      add(new THREE.CylinderGeometry(w * 1.25, w * 1.1, .7 * u, sides), L(0, y, 0), frameC); // a terrace
      add(new THREE.TorusGeometry(w * 1.22, .16 * u, 3, sides * 2).rotateX(Math.PI / 2), L(0, y + .45 * u, 0), C.window, true);
      w *= .74;
    }
    add(cone(w * 1.1, H * .14, sides), L(0, y + .7 * u, 0), frameC);
    rod(add, [0, y + H * .12, 0], [0, y + H * .12 + 9 * u, 0], .12 * u, C.metal, false, 5);
    add(ball(.4 * u, 1), L(0, y + H * .12 + 9.3 * u, 0), C.beacon, 'blink');
  }, { found: 'always' });
  let skyline = 0; // the tallest tower, so traffic in the air flies above it
  // --- Every building its own ----------------------------------------------------
  // A dwelling takes its walls, roof and trim from the culture's palette with a shift of
  // its own, and beside it something of its owners' life, by their path (flair).
  const WALLS = [C.wall, mixC(C.wall, '#ffffff', .16), mixC(C.wall, '#000000', .14), mixC(C.wall, C.accent2, .22), mixC(C.wall, body.palette?.[3] || C.stone, .25)];
  const ROOFS = [C.roof, C.roof2, mixC(C.roof, C.accent, .3), mixC(C.roof, '#000000', .22), mixC(C.roof, '#ffffff', .15)];
  const TRIMS = [C.accent, C.accent2, mixC(C.accent, '#ffffff', .3), C.trim];
  const varied = (add) => {
    const w = pick(...WALLS), map = { [C.wall]: w, [C.wall2]: mixC(w, '#000000', .18), [C.roof]: pick(...ROOFS), [C.accent]: pick(...TRIMS) };
    return (g, m, c, b) => add(g, m, !b && typeof c === 'string' && map[c] ? map[c] : c, b);
  };
  const flair = (add, gy, fp, k) => {
    if (!gy || civ.colony || level < 2 || k > 1.7 || r() > .4 || civ.family === 'nests' || civ.family === 'drifters') return;
    const a = Math.PI + (r() - .5) * 1.6, d = fp * (1.05 + r() * .2), x = Math.sin(a) * d, z = Math.cos(a) * d, y = gy(x, z);
    if (y === null) return;
    const m = (dx = 0, dy = 0, dz = 0, ry = 0) => L(x, y, z, 0, a, 0).multiply(L(dx, dy, dz, 0, ry, 0));
    // The climate first: wind towers and shade where it is hot (for those who build), a
    // banked woodpile where it is cold.
    if (idiom === 'built' && clime.hot > .5 && r() < .45) {
      if (r() < .5) { add(sunk(box(.9 * u, 3.4 * u * tall + SINK, .9 * u)), m(), C.wall); for (let i = 0; i < 4; i++) add(box(.5 * u, .9 * u, .05), m(0, 2.6 * u * tall, 0).multiply(L(0, 0, .46 * u, 0, i * 1.571, 0)), C.door); add(box(1.05 * u, .15 * u, 1.05 * u), m(0, 3.4 * u * tall), C.trim); }
      else { for (const [px, pz] of [[-1, -.7], [1, -.7], [-1, .7], [1, .7]]) add(sunk(box(.08 * u, 1.9 * u + SINK, .08 * u)), m(px * u, 0, pz * u), C.wood); add(box(2.3 * u, .06 * u, 1.7 * u), m(0, 1.95 * u), mixC(C.accent2, '#f3ead8', .4)); }
      return;
    }
    if (idiom === 'built' && clime.cold > .5 && r() < .35) { for (let i = 0; i < 6; i++) add(cyl(.12 * u, .12 * u, 1.2 * u, 6).rotateZ(Math.PI / 2).translate(.6 * u, 0, 0), m(-.6 * u, .12 * u + Math.floor(i / 3) * .24 * u, (i % 3 - 1) * .25 * u), C.wood); add(box(1.5 * u, .06 * u, .9 * u), m(0, .9 * u), C.roof); return; }
    // Those who grow, secrete or spin their homes keep small things of the same make.
    if (idiom !== 'built') {
      const c = { agrarian: C.crop, devotional: C.accent, scholarly: C.window, mercantile: C.accent2, martial: C.accent, expansionist: C.accent2 }[civ.path] || C.accent;
      if (idiom === 'wax') { for (let i = 0; i < 3; i++) cell(add, 0, 0, 0, .35 * u, (.6 + i * .3) * u, C.wall2); add(new THREE.CircleGeometry(.3 * u, 6).rotateX(-Math.PI / 2), m(0, .62 * u), c, civ.path === 'scholarly' && lights); }
      else if (idiom === 'silk') { add(sunk(cyl(.05 * u, .05 * u, 1.8 * u + SINK, 4)), m(), C.wood); add(new THREE.SphereGeometry(.3 * u, 7, 5).scale(1, 1.5, 1), m(0, 1.1 * u, .1 * u), c); }
      else { add(new THREE.SphereGeometry(.45 * u, 8, 6).scale(1, .8, 1), m(0, .3 * u), C.wall2); add(ball(.15 * u, 0), m(0, .75 * u), c, civ.path === 'scholarly' && lights); }
      return;
    }
    switch (civ.path) {
      case 'agrarian':
        if (r() < .5) for (let i = 0; i < 2 + Math.floor(r() * 2); i++) add(cyl(.42 * u, .42 * u, .8 * u, 8).rotateZ(Math.PI / 2).translate(.4 * u, .42 * u, 0), m((i - 1) * .9 * u, 0, 0, r() * .3), mixC(C.crop, '#d9c27a', .5));
        else { add(sunk(cyl(.55 * u, .55 * u, 1.8 * u + SINK, 10)), m(), level >= 3 ? C.metal2 : C.wood); add(cone(.62 * u, .6 * u, 10), m(0, 1.8 * u), C.roof); }
        break;
      case 'devotional':
        if (r() < .5) { add(sunk(box(.8 * u, .7 * u + SINK, .6 * u)), m(), C.stone); add(cone(.55 * u, .7 * u, 4), m(0, .7 * u, 0, Math.PI / 4), C.accent); if (lights) add(ball(.12 * u, 0), m(0, .5 * u, .31 * u), C.flame, true); }
        else { add(sunk(cyl(.05 * u, .05 * u, 2.4 * u + SINK, 4)), m(), C.wood); for (let i = 0; i < 3; i++) add(box(.04 * u, .9 * u, .25 * u), m(0, 1.3 * u - i * .25 * u, .15 * u, i * 1.2), i % 2 ? C.accent : C.accent2); }
        break;
      case 'scholarly':
        if (level >= 3 && r() < .6) { for (let i = 0; i < 3; i++) rod(add, [x + Math.cos(i * 2.09) * .4 * u, y, z + Math.sin(i * 2.09) * .4 * u], [x, y + 1.1 * u, z], .03 * u, C.wood, false, 3); add(cyl(.12 * u, .18 * u, 1.1 * u, 8).rotateX(-.9), m(0, 1.1 * u, 0), C.metal2); }
        else { add(sunk(cyl(.5 * u, .55 * u, .5 * u + SINK, 10)), m(), C.stone); add(box(.05 * u, .5 * u, .4 * u).translate(0, .25 * u, 0), m(0, .5 * u, 0, 0), C.metal); }
        break;
      case 'mercantile': {
        for (const [px, pz] of [[-.6, -.4], [.6, -.4], [-.6, .4], [.6, .4]]) add(sunk(box(.07 * u, 1.5 * u + SINK, .07 * u)), m(px * u, 0, pz * u), C.wood);
        for (let i = 0; i < 4; i++) add(box(.32 * u, .05 * u, 1 * u), m((i - 1.5) * .32 * u, 1.55 * u, 0), i % 2 ? '#f2ede4' : C.accent);
        add(box(1.1 * u, .5 * u, .6 * u), m(0, 0, 0), C.wood); add(box(.9 * u, .2 * u, .45 * u), m(0, .5 * u, 0), C.crop);
        break;
      }
      case 'martial':
        for (let i = 0; i < 4; i++) add(sunk(cone(.13 * u, 1.3 * u + SINK, 5)), m((i - 1.5) * .35 * u, 0, 0, 0), C.wood);
        add(sunk(cyl(.04 * u, .04 * u, 2.2 * u + SINK, 4)), m(.9 * u), C.wood); add(box(.04 * u, .5 * u, .7 * u), m(.9 * u, 1.65 * u, .35 * u), C.accent);
        break;
      default: // expansionist: a mast with a pennant (a small dish once they listen to the sky)
        add(sunk(cyl(.05 * u, .06 * u, 2.6 * u + SINK, 4)), m(), C.metal);
        if (level >= 4) add(new THREE.SphereGeometry(.45 * u, 8, 3, 0, Math.PI * 2, 0, .8), m(0, 2.2 * u, 0).multiply(L(0, 0, 0, -.9, 0, 0)), C.metal2);
        else add(box(.04 * u, .35 * u, .8 * u), m(0, 2.3 * u, .4 * u), C.accent);
    }
    if (level >= 5 && r() < .35) { add(sunk(cyl(.05 * u, .05 * u, .9 * u + SINK, 4)), m(-1 * u, 0, .4 * u), C.metal); add(box(1.3 * u, .05 * u, .8 * u), m(-1 * u, .95 * u, .4 * u).multiply(L(0, 0, 0, -.5, 0, 0)), '#1d2c55'); }
  };
  const common = {
    cairn(add) {
      let y = 0; const k = 3 + Math.floor(r() * 3);
      add(sunk(cyl(.55 * u, .6 * u, SINK)), L(), C.stone);
      for (let i = 0; i < k; i++) { const s = .5 * u * (1 - i * .16); add(ball(s), L((r() - .5) * .1 * u, y + s * .45, 0, 0, r() * 6, 0, 1, .55, 1), i % 2 ? C.stone : C.stone2); y += s * .8; }
      if (r() < .5) add(box(.12 * u, .5 * u, .12 * u), L(0, y, 0), C.accent);
    },
    marker(add) {
      add(sunk(box(.4 * u, 1.5 * u * tall + SINK, .28 * u)), L(0, 0, 0, (r() - .5) * .1, 0, (r() - .5) * .1), C.stone);
      add(box(.42 * u, .16 * u, .3 * u), L(0, 1.05 * u * tall, 0), C.accent);
    },
    hearth(add, gy) {
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = Math.cos(a) * .7 * u, z = Math.sin(a) * .7 * u; add(ball(.22 * u), L(x, (gy?.(x, z) ?? 0) + .08 * u, z, 0, a, 0, 1, .6, 1), C.stone2); }
      add(cyl(.45 * u, .5 * u, .06 * u, 8), L(0, .02 * u, 0), C.ember, true);
      for (let i = 0; i < 3; i++) add(cone(.12 * u, .5 * u, 4), L((r() - .5) * .3 * u, .05 * u, (r() - .5) * .3 * u, (r() - .5) * .3, 0, (r() - .5) * .3), C.flame, true);
    },
    // Fields lie on the ground itself: tilled soil draped over it and every plant and fence
    // post standing on the ground where it is, so no part of a field sinks into a slope.
    field(add, gy) {
      const w = 6, d = 5, g = (x, z) => (gy?.(x, z) ?? 0);
      drape(add, gy, w, d, .1, C.soil);
      for (let z = -d / 2 + .5; z < d / 2; z += .9) for (let x = -w / 2 + .4; x < w / 2; x += .7) { const cx = x + (r() - .5) * .1; add(cone(.17, .5 + r() * .25, 3), L(cx, g(cx, z) + .08, z), C.crop); }
    },
    crates(add) { for (let i = 0; i < 3; i++) add(box(.5 * u, .45 * u, .5 * u), L((i - 1) * .55 * u, (i === 1 ? .45 * u : 0), 0, 0, r() * .4), i % 2 ? C.wood : C.wall2); },
    fencedField(add, gy) {
      common.field(add, gy);
      const g = (x, z) => (gy?.(x, z) ?? 0), ring_ = [];
      for (let x = -3.2; x < 3.1; x += 6.4 / 3) ring_.push([x, 2.7]);
      for (let z = 2.7; z > -2.6; z -= 2.7) ring_.push([3.2, z]);
      for (let x = 3.2; x > -3.1; x -= 6.4 / 3) ring_.push([x, -2.7]);
      for (let z = -2.7; z < 2.6; z += 2.7) ring_.push([-3.2, z]);
      ring_.forEach(([x, z], i) => {
        const [x2, z2] = ring_[(i + 1) % ring_.length], y = g(x, z), y2 = g(x2, z2);
        add(sunk(box(.12, .8 + SINK, .12)), L(x, y, z), C.wood);
        for (const hgt of [.3, .65]) rod(add, [x, y + hgt, z], [x2, y2 + hgt, z2], .04, C.wood, false, 3);
      });
    },
    // A tracking dish: a pedestal and turntable, a yoke holding a deep parabolic dish
    // (with a back, so it reads from every side) tipped toward the sky, and a receiver
    // on three struts at its focus with a blinking light.
    dish(add) {
      const h = 2.3 * u, D = 1.9 * u, depth = .5 * u, focal = D * D / (4 * depth), az = r() * 6.28, tilt = .35 + r() * .55;
      add(sunk(cyl(1 * u, 1.1 * u, .3 * u + SINK, 10)), L(), C.concrete);
      add(cyl(.3 * u, .45 * u, h, 8), L(0, .3 * u, 0), C.metal);
      add(cyl(.8 * u, .8 * u, .25 * u, 12), L(0, h + .3 * u, 0), C.metal2);
      const turn = L(0, 0, 0, 0, az, 0), pivot = h + 1.45 * u, at = (m) => turn.clone().multiply(m);
      for (const x of [-1, 1]) add(box(.16 * u, 1.05 * u, .34 * u), at(L(x * 1.02 * u, h + .5 * u, 0)), C.metal);
      add(box(2.2 * u, .14 * u, .14 * u), at(L(0, pivot - .07 * u, 0)), C.metal);
      const dishM = at(L(0, pivot, 0, -tilt, 0, 0)), addD = (g, m, c, b) => add(g, dishM.clone().multiply(m), c, b);
      const prof = [];
      for (let i = 0; i <= 5; i++) { const x = Math.max(.001, D * i / 5); prof.push(new THREE.Vector2(x, depth * (x / D) ** 2 - .08 * u)); }
      for (let i = 5; i >= 0; i--) { const x = Math.max(.001, D * i / 5); prof.push(new THREE.Vector2(x, depth * (x / D) ** 2)); }
      addD(new THREE.LatheGeometry(prof, 16), L(0, .05 * u, 0), C.metal2);
      addD(new THREE.TorusGeometry(D, .05 * u, 3, 20).rotateX(Math.PI / 2), L(0, depth + .03 * u, 0), C.metal);
      addD(cyl(.28 * u, .42 * u, .4 * u, 8), L(0, -.35 * u, 0), C.metal);
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + .5; rod(addD, [Math.cos(a) * D * .93, depth * .9, Math.sin(a) * D * .93], [0, focal * .92, 0], .035 * u, C.metal, false, 4); }
      addD(cyl(.12 * u, .17 * u, .34 * u, 8), L(0, focal * .92 - .1 * u, 0), C.metal2);
      addD(ball(.08 * u, 1), L(0, focal * .92 + .3 * u, 0), C.beacon, 'blink');
    },
    // A radio mast: a tapering three-legged lattice with braced bays, panel antennas,
    // a whip on top and blinking warning lights.
    mast(add) {
      const H = 13 * u * tall, w0 = 1.2 * u, bay = 1.7 * u, legA = [0, 2.094, 4.189];
      const at = (i, y) => { const w = w0 * (1 - .75 * y / H); return [Math.cos(legA[i]) * w, y, Math.sin(legA[i]) * w]; };
      add(sunk(cyl(w0 * 1.5, w0 * 1.6, .35 * u + SINK, 6)), L(), C.concrete);
      for (let i = 0; i < 3; i++) rod(add, at(i, 0), at(i, H), .08 * u, C.metal, false, 4);
      for (let y = 0; y < H - bay * .5; y += bay) for (let i = 0; i < 3; i++) {
        rod(add, at(i, y), at((i + 1) % 3, Math.min(H, y + bay)), .03 * u, C.metal2, false, 3);
        rod(add, at(i, y + bay), at((i + 1) % 3, y + bay), .03 * u, C.metal2, false, 3);
      }
      for (let i = 0; i < 3; i++) { const [x, y, z] = at(i, H * .72), a = legA[i]; add(box(.45 * u, 1.3 * u, .08 * u), L(x * 1.25, y, z * 1.25, 0, Math.PI / 2 - a, 0), C.metal2); }
      rod(add, [0, H, 0], [0, H + 3 * u, 0], .05 * u, C.metal, false, 4);
      add(ball(.16 * u, 1), L(0, H + 3.05 * u, 0), C.beacon, 'blink');
      for (let i = 0; i < 3; i++) { const [x, y, z] = at(i, H * .5); add(ball(.12 * u, 1), L(x, y, z), C.beacon, 'blink'); }
    },
    slab(add, gy) { drape(add, gy, 1.8 * u, 1.8 * u, .1, C.road, .9 * u); },
    light(add, gy) { lamp(add, gy, 1); },
  };

  // Yards: the small things of daily life around a dwelling (pots, tended plants, wood
  // stacks, drying racks, stones, a lamp), on its own ground and never across the door.
  const handy = civ.family === 'hands' || civ.family === 'tentacles', grounded = WALKERS.includes(civ.family) || ['burrowers', 'web', 'hive'].includes(civ.family);
  const yard = (add, gy, fp, k) => {
    if (!gy || k > 1.6 || civ.colony || civ.underwater) return; // no pots, racks or stepping stones on the sea floor
    const at = (a, d) => { const x = Math.sin(a) * d, z = Math.cos(a) * d, y = gy(x, z); return y === null ? null : [x, y, z]; };
    if (WALKERS.includes(civ.family) && level >= 2) for (let i = 0; i < 3; i++) { // stepping stones to the door
      const p = at((r() - .5) * .3, fp * (.95 + i * .3)); if (p) add(sunk(cyl(.3 * u, .34 * u, SINK + .07, 6)), L(p[0], p[1], p[2], 0, r() * 3), level >= 3 ? C.plaza : C.stone);
    }
    const n = civ.family === 'burrowers' ? 1 : grounded ? 2 + Math.floor(r() * 3) : 1 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = (r() < .5 ? 1 : -1) * (1 + r() * 1.8), p = at(a, fp * (.78 + r() * .25)); if (!p) continue;
      const [x, y, z] = p, kind = r(), m = (dx = 0, dy = 0, dz = 0, ry = 0) => L(x, y, z, 0, a, 0).multiply(L(dx, dy, dz, 0, ry, 0));
      if (kind < .3 && grounded) { // pots, jars or gourds
        for (let j = 0, c = 1 + Math.floor(r() * 3); j < c; j++) { const sz = (.2 + r() * .14) * u, ox = (j - (c - 1) / 2) * .5 * u; add(sunk(cyl(sz * .85, sz * .6, sz * 1.5 + SINK, 7)), m(ox), j % 2 ? C.accent2 : C.pot); add(cyl(sz * .45, sz * .85, sz * .4, 7), m(ox, sz * 1.5), C.pot); }
      } else if (kind < .6) { // a tended plant
        add(ball((.35 + r() * .3) * u, 0), m(0, .25 * u, 0, r() * 6).multiply(L(0, 0, 0, 0, 0, 0, 1, .8, 1)), C.leaf);
        if (r() < .6) add(ball(.2 * u, 0), m(.35 * u, .45 * u), C.crop);
        add(sunk(cyl(.4 * u, .45 * u, SINK + .12 * u, 7)), m(), C.stone2);
      } else if (kind < .78 && handy) { // stacked wood or bundles
        for (let j = 0; j < 5; j++) add(cyl(.1 * u, .1 * u, 1.1 * u, 5).rotateZ(Math.PI / 2).translate(.55 * u, 0, 0), m(-.55 * u, .1 * u + (j > 2 ? .18 * u : 0), ((j % 3) - 1) * .2 * u + (j > 2 ? .1 * u : 0)), C.wood);
      } else if (kind < .9 && handy && level >= 2) { // a drying rack hung with cloth
        for (const sx of [-1, 1]) add(sunk(cyl(.05 * u, .05 * u, 1.4 * u + SINK, 4)), m(sx * .7 * u), C.wood);
        add(cyl(.03 * u, .03 * u, 1.5 * u, 4).rotateZ(Math.PI / 2), m(0, 1.35 * u), C.wood);
        for (let j = 0; j < 3; j++) add(box(.35 * u, .55 * u, .02 * u), m((j - 1) * .42 * u, .8 * u), j % 2 ? C.accent : C.accent2);
      } else { // a few stones
        for (let j = 0; j < 3; j++) add(ball((.15 + r() * .15) * u, 0), m((r() - .5) * .8 * u, .05 * u, (r() - .5) * .5 * u, r() * 6).multiply(L(0, 0, 0, 0, 0, 0, 1, .6, 1)), j % 2 ? C.stone : C.stone2);
      }
    }
    if (streetLights && grounded && r() < .5) { const p = at(r() < .5 ? .7 : -.7, fp * 1.05); if (p) lamp((g, m, c, b) => add(g, L(p[0], p[1], p[2]).multiply(m), c, b), (x, z) => { const y = gy(p[0] + x, p[2] + z); return y === null ? null : y - p[1]; }, .6); }
  };

  // --- Cultures --------------------------------------------------------------
  // home(add, k): a dwelling at scale k; great(add, k): the centrepiece; small(add): a far-off town.
  const roofCone = (add, rad, h, y, seg = 8) => add(cone(rad, h, seg), L(0, y, 0), C.roof);
  const gable = (add, w, d, y) => add(new THREE.CylinderGeometry(d * .6, d * .6, w * 1.04, 3).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).rotateY(Math.PI / 2), L(0, y + d * .28, 0, 0, Math.PI / 2, 0), C.roof);
  const K = {
    timber: {
      home(add, k) {
        if (r() < .5) {
          const rad = 1.25 * u * k, h = 1.6 * u * k * tall;
          footing(add, rad, C.wall); add(cyl(rad, rad * 1.04, h, 9), L(), C.wall);
          for (let i = 0; i < 9; i++) { const a = (i + .5) / 9 * Math.PI * 2; add(box(.14 * u, h, .14 * u), L(Math.cos(a) * rad * 1.01, 0, Math.sin(a) * rad * 1.01, 0, -a), C.wood); }
          add(cone(rad * 1.42, .35 * u, 9), L(0, h - .05 * u, 0), C.roof); roofCone(add, rad * 1.25, 1.3 * u * k * tall, h + .1 * u, 9);
          add(cyl(.22 * u, .26 * u, .5 * u, 6), L(0, h + 1.15 * u * k * tall, 0), C.wood);
          add(box(.75 * u, h * .7, .1 * u), L(0, 0, rad * .99), C.trim); add(box(.55 * u, h * .62, .14 * u), L(0, 0, rad * 1.0), C.door); windows(add, rad, h * .55, rad, 2);
        }
        else {
          const w = 3.2 * u * k, d = 1.9 * u * k, h = 1.5 * u * k * tall;
          add(sunk(box(d * 1.06, SINK + .25 * u, w * 1.04)), L(0, .25 * u, 0), C.stone2);
          add(sunk(box(d, h + SINK, w)), L(), C.wall); gable(add, w * 1.08, d * 1.15, h);
          for (const z of [-.5, -.17, .17, .5]) add(box(d * 1.04, .14 * u, .14 * u), L(0, h - .1 * u, z * w), C.wood);
          for (const x of [-.5, .5]) for (const z of [-.5, .5]) add(box(.18 * u, h, .18 * u), L(x * d, 0, z * w), C.wood);
          add(box(.4 * u, 1.3 * u, .4 * u), L(d * .25, h + d * .25, -w * .3), C.stone2);
          add(box(.8 * u, h * .76, .08), L(0, 0, w / 2 + .01), C.trim); add(box(.6 * u, h * .7, .1), L(0, 0, w / 2 + .02), C.door);
          if (k > 1.3) { add(box(d * .8, h * .8, w * .5), L(0, h + d * .4, -w * .1), C.wall2); roofCone(add, d * .75, h * .6, h * 1.8 + d * .4, 4); }
          windows(add, d, h * .5, w / 2 + .03, 2);
        }
      },
      great(add, k) { // a tiered pagoda-like tower
        let y = 0, w = 3.4 * u * k;
        footing(add, w * .7, C.stone);
        for (let i = 0; i < 2 + Math.round(k * 1.5); i++) { const h = 1.6 * u * tall * (1 + k * .2); add(box(w, h, w), L(0, y, 0), i % 2 ? C.wall2 : C.wall); add(cone(w * .95, .9 * u, 4), L(0, y + h, 0, 0, Math.PI / 4), C.roof); windows(add, w, y + h * .5, w / 2 + .03, 3); y += h + .5 * u; w *= .78; }
        add(cyl(.08 * u, .08 * u, 2 * u, 4), L(0, y, 0), C.accent);
      },
      small(add) { add(sunk(box(2.4 * u, 1.6 * u + SINK, 2 * u)), L(), C.wall); add(cone(1.8 * u, 1.2 * u, 4), L(0, 1.6 * u, 0, 0, Math.PI / 4), C.roof); },
    },
    terraced: {
      home(add, k) {
        const n = 1 + Math.floor(r() * (k > 1.2 ? 3 : 2)); let y = 0, w = 2.6 * u * k;
        for (let i = 0; i < n; i++) {
          const h = 1.5 * u * tall, x0 = i * .25 * w, z0 = -i * .15 * w;
          add(i ? box(w, h, w * .9) : sunk(box(w, h + SINK, w * .9)), L(x0, y, z0), i % 2 ? C.wall2 : C.wall);
          // A parapet round the roof, beam ends (vigas) poking out under it, a framed door.
          for (const [px, pz, pw, pd] of [[0, w * .43, w, .12 * u], [0, -w * .43, w, .12 * u], [w * .48, 0, .12 * u, w * .9], [-w * .48, 0, .12 * u, w * .9]]) add(box(pw, .3 * u, pd), L(x0 + px, y + h, z0 + pz), C.wall);
          for (let v = 0; v < 4; v++) add(box(.1 * u, .1 * u, .45 * u), L(x0 + (v / 3 - .5) * w * .8, y + h * .82, z0 + w * .45 + .2 * u), C.wood);
          add(box(.7 * u, 1.05 * u, .05), L(x0, y, z0 + w * .45 + .01), C.trim); add(box(.55 * u, .9 * u, .06), L(x0, y, z0 + w * .45 + .02), C.door);
          windows(add, w, y + h * .6, z0 + w * .45 + .04, 1); y += h; w *= .75;
        }
        // A ladder leaning up to the roof.
        for (const x of [-.18, .18]) add(box(.07 * u, 2.2 * u, .07 * u), L(w * .7 + x * u, 0, w * .6, -.25), C.wood);
        for (let i = 1; i < 6; i++) add(box(.42 * u, .05 * u, .05 * u), L(w * .7, i * .35 * u, w * .6 + i * .35 * u * .25), C.wood);
      },
      great(add, k) { // stepped pyramid with a stair and a shrine
        let y = 0, w = 9 * u * k, wPrev = w; const steps = 4 + Math.round(k * 2), h = 1.4 * u * tall;
        for (let i = 0; i < steps; i++) {
          add(i ? box(w, h, w) : sunk(box(w, h + SINK, w)), L(0, y, 0), i % 2 ? C.wall2 : C.wall);
          // A stair up the front of each tier, on the ledge below it, with low side walls.
          const run = i ? (wPrev - w) / 2 : 1.6 * u, n = 3;
          for (let j = 0; j < n; j++) add(i ? box(1.6 * u, h * (j + 1) / n, run / n) : sunk(box(1.6 * u, h * (j + 1) / n + SINK, run / n)), L(0, y, w / 2 + run * (n - j - .5) / n), C.stone2);
          for (const x of [-1, 1]) add(box(.25 * u, h * .6, run), L(x * .92 * u, y, w / 2 + run / 2), C.stone);
          const w2 = w * .8; wPrev = w;
          y += h; w = w2;
        }
        add(box(w, 1.6 * u, w), L(0, y, 0), C.accent); windows(add, w, y + .6 * u, w / 2 + .03, 1);
      },
      small(add) { add(sunk(box(2.4 * u, 1.4 * u + SINK, 2.4 * u)), L(), C.wall); add(box(1.6 * u, 1.2 * u, 1.6 * u), L(.3 * u, 1.4 * u, 0), C.wall2); },
    },
    tents: {
      home(add, k) {
        if (r() < .55) {
          const rad = 1.4 * u * k, h = 2.6 * u * k * tall;
          add(sunk(cyl(rad * .95, rad, SINK, 9)), L(), C.wall); add(cone(rad, h, 9), L(), C.wall);
          // Painted bands, poles crossing at the smoke hole, a door flap, guy ropes to stakes.
          for (const t of [.18, .26]) add(new THREE.CylinderGeometry(rad * (1 - t) + .02, rad * (1 - t - .06) + .02, h * .06, 9, 1, true).translate(0, h * t, 0), L(), t < .2 ? C.accent : C.accent2);
          for (let i = 0; i < 5; i++) { const a = i * 1.26; rod(add, [Math.cos(a) * rad * .7, h * .3, Math.sin(a) * rad * .7], [Math.cos(a + Math.PI) * rad * .12, h * 1.18, Math.sin(a + Math.PI) * rad * .12], .045 * u, C.wood); }
          add(new THREE.ConeGeometry(.6 * u, 1.1 * u, 3).translate(0, .55 * u, 0), L(0, 0, rad * .62, -.42, 0, 0, 1, 1, .3), C.wall2);
          for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .8; rod(add, [Math.cos(a) * rad * .45, h * .55, Math.sin(a) * rad * .45], [Math.cos(a) * rad * 1.7, .05, Math.sin(a) * rad * 1.7], .015 * u, C.line); add(box(.08 * u, .3 * u, .08 * u), L(Math.cos(a) * rad * 1.7, 0, Math.sin(a) * rad * 1.7), C.wood); }
        } else {
          const rad = 1.6 * u * k, h = 1.2 * u * k;
          footing(add, rad, C.wall); add(cyl(rad, rad, h, 12), L(), C.wall);
          add(new THREE.CylinderGeometry(rad * 1.01, rad * 1.01, h * .22, 12, 1, true).translate(0, h * .7, 0), L(), C.accent);
          add(cone(rad * 1.08, .9 * u * k, 12), L(0, h, 0), C.roof);
          for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; rod(add, [Math.cos(a) * rad * 1.05, h + .02, Math.sin(a) * rad * 1.05], [Math.cos(a) * .25 * u, h + .85 * u * k, Math.sin(a) * .25 * u], .03 * u, C.wood); }
          add(box(.75 * u, h * .9, .08), L(0, 0, rad - .02), C.accent2); add(box(.55 * u, h * .8, .1), L(0, 0, rad), C.door); add(ring(.25 * u, .06 * u, 8), L(0, h + .85 * u * k, 0), C.wood);
        }
        windows(add, u, .8 * u, 1.3 * u * k, 1);
      },
      great(add, k) { // many-peaked pavilion
        const rad = 4.5 * u * k; footing(add, rad, C.wall);
        add(cyl(rad, rad, 1.8 * u, 12), L(), C.wall);
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, d = i ? rad * .55 : 0; add(cone(rad * (i ? .45 : .7), (i ? 3 : 5) * u * tall * k, 8), L(Math.cos(a) * d, 1.8 * u, Math.sin(a) * d), i % 2 ? C.roof : C.wall); }
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(sunk(cyl(.07 * u, .07 * u, 6 * u * tall + SINK, 4)), L(Math.cos(a) * rad * 1.25, 0, Math.sin(a) * rad * 1.25), C.wood); add(box(.9 * u, .5 * u, .04), L(Math.cos(a) * rad * 1.25 + .45 * u, 5.3 * u * tall, Math.sin(a) * rad * 1.25), C.accent); }
      },
      small(add) { add(sunk(cyl(1.2 * u, 1.3 * u, SINK, 7)), L(), C.wall); add(cone(1.3 * u, 2.2 * u, 7), L(), C.wall); },
    },
    stilts: {
      home(add, k) {
        const h = 2.1 * u * k, w = 2.6 * u * k, d = 2.1 * u * k, wh = 1.45 * u * k * tall, rh = 1.5 * u * k, dk = .16 * u;
        // Piles with cross-bracing, a planked deck with a rail, weatherboard walls, a layered
        // thatched hip roof with deep eaves, shuttered windows, a ladder and a net rack.
        for (const x of [-1, 0, 1]) for (const z of [-1, 1]) add(sunk(cyl(.09 * u, .12 * u, h + SINK, 5)), L(x * w * .47, 0, z * d * .5, (r() - .5) * .06, 0, (r() - .5) * .06), C.wood);
        for (const z of [-1, 1]) for (const sx of [-1, 1]) rod(add, [sx * w * .47, h * .12, z * d * .5], [0, h * .85, z * d * .5], .035 * u, C.wood);
        for (const x of [-1, 1]) rod(add, [x * w * .47, h * .15, -d * .5], [x * w * .47, h * .85, d * .5], .035 * u, C.wood);
        add(box(w * 1.3, dk, d * 1.55), L(0, h, d * .1), C.wood);
        for (let i = 0; i < 7; i++) add(box(w * 1.31, .02 * u, .025 * u), L(0, h + dk, (i / 6 - .5) * d * 1.5 + d * .1), C.wall2);
        const rx = w * .63, rz0 = -d * .67, rz1 = d * .87;
        for (const [x, z] of [[-rx, rz0], [rx, rz0], [-rx, rz1], [rx, rz1], [-rx, d * .1], [rx, d * .1]]) add(box(.08 * u, .7 * u, .08 * u), L(x, h + dk, z), C.wood);
        for (const x of [-rx, rx]) rod(add, [x, h + dk + .62 * u, rz0], [x, h + dk + .62 * u, rz1], .03 * u, C.wood);
        rod(add, [-rx, h + dk + .62 * u, rz0], [rx, h + dk + .62 * u, rz0], .03 * u, C.wood);
        const y1 = h + dk;
        add(box(w, wh, d), L(0, y1, 0), C.wall);
        for (let i = 1; i < 5; i++) add(box(w * 1.015, .04 * u, d * 1.015), L(0, y1 + i * wh / 5, 0), C.wall2);
        for (const x of [-1, 1]) for (const z of [-1, 1]) add(box(.14 * u, wh, .14 * u), L(x * w * .5, y1, z * d * .5), C.wood);
        const y2 = y1 + wh, rr = d * 1.45 / Math.SQRT2, sx = w / d;
        add(box(w * 1.06, .12 * u, d * 1.06), L(0, y2, 0), C.wood);
        add(cone(rr, rh, 4), L(0, y2 + .1 * u, 0, 0, Math.PI / 4, 0, sx, 1, 1), C.roof);
        add(cone(rr * .78, rh * .8, 4), L(0, y2 + .1 * u + rh * .32, 0, 0, Math.PI / 4, 0, sx, 1, 1), C.roof2);
        add(cone(rr * .5, rh * .55, 4), L(0, y2 + .1 * u + rh * .66, 0, 0, Math.PI / 4, 0, sx, 1, 1), C.roof);
        add(cyl(.05 * u, .05 * u, .7 * u, 4), L(0, y2 + rh * 1.05, 0), C.wood); add(ball(.12 * u, 0), L(0, y2 + rh * 1.05 + .7 * u, 0), C.accent);
        add(box(.8 * u, 1.15 * u, .06), L(0, y1, d / 2 + .01), C.trim); add(box(.62 * u, 1.05 * u, .08), L(0, y1, d / 2 + .02), C.door);
        for (const x of [-1, 1]) {
          const wx = x * w * .3, wy = y1 + wh * .45;
          if (lights) add(box(.45 * u, .4 * u, .05), L(wx, wy, d / 2 + .02), C.window, true);
          else add(box(.45 * u, .4 * u, .06), L(wx, wy, d / 2 + .01), C.door);
          add(box(.22 * u, .46 * u, .04 * u), L(wx + x * .36 * u, wy - .03 * u, d / 2 + .04, 0, -x * .5, 0), C.accent);
          add(box(.06, .4 * u, .5 * u), L(x * (w / 2 + .01), y1 + wh * .45, 0), C.door);
        }
        // A ladder from the deck's front edge down to the ground.
        const lz0 = d * .87, lz1 = d * .87 + h * .45, lx = -w * .35;
        for (const o of [-.22, .22]) rod(add, [lx + o * u, -.2 * u, lz1], [lx + o * u, h + dk, lz0], .04 * u, C.wood);
        for (let i = 1; i < 6; i++) { const t = i / 6; add(box(.48 * u, .05 * u, .06 * u), L(lx, t * h, lz1 + (lz0 - lz1) * t), C.wood); }
        // A rack of drying nets or cloth on the deck.
        const nx = w * .45;
        rod(add, [nx, y1, d * .65], [nx, y1 + 1.1 * u, d * .65], .03 * u, C.wood); rod(add, [nx, y1 + 1.1 * u, d * .65], [nx - .9 * u, y1 + 1.1 * u, d * .65], .025 * u, C.wood);
        add(box(.7 * u, .7 * u, .02 * u), L(nx - .45 * u, y1 + .35 * u, d * .65), C.accent2);
        for (let i = 0; i < 2; i++) add(sunk(cyl(.18 * u, .14 * u, .35 * u + SINK, 6)), L(-w * .45 + i * .4 * u, y1 + SINK, d * .72), C.pot);
      },
      great(add, k) { // a long meeting house on piles, with a tall saddle roof and carved gable posts
        const h = 2.6 * u, w = 7 * u * k, d = 3.6 * u * k, wh = 2.2 * u * tall, y1 = h + .2 * u;
        for (let x = -1; x <= 1; x += .25) for (const z of [-1, 1]) add(sunk(cyl(.14 * u, .17 * u, h + SINK, 6)), L(x * w * .47, 0, z * d * .5), C.wood);
        for (let x = -1; x < 1; x += .5) for (const z of [-1, 1]) rod(add, [x * w * .47, h * .15, z * d * .5], [(x + .5) * w * .47, h * .85, z * d * .5], .05 * u, C.wood);
        add(box(w * 1.12, .2 * u, d * 1.4), L(0, h, 0), C.wood);
        add(box(w, wh, d), L(0, y1, 0), C.wall);
        for (let i = 1; i < 5; i++) add(box(w * 1.01, .05 * u, d * 1.01), L(0, y1 + i * wh / 5, 0), C.wall2);
        for (let x = -1; x <= 1; x += .25) add(box(.16 * u, wh, d * 1.04), L(x * w * .5, y1, 0), C.wood);
        const ry = y1 + wh;
        // A saddle roof: a triangular prism along the house, apex up, steep, in two thatch layers.
        const prism = (rad, len) => new THREE.CylinderGeometry(rad, rad, len, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);
        add(prism(d * .82, w * 1.18), L(0, ry + d * .82 * .5 * 1.4, 0, 0, 0, 0, 1, 1.4, 1), C.roof);
        add(prism(d * .62, w * 1.2), L(0, ry + d * 1.0, 0, 0, 0, 0, 1, 1.4, 1), C.roof2);
        for (const x of [-1, 1]) { add(box(.3 * u, wh + d * 2, .3 * u), L(x * w * .6, y1, 0), C.accent); add(ball(.35 * u, 0), L(x * w * .6, y1 + wh + d * 2, 0), C.accent2); }
        add(box(1.4 * u, 1.8 * u, .08), L(0, y1, d / 2 + .02), C.door); windows(add, w, y1 + 1.4 * u, d / 2 + .03, 4);
        for (let i = 0; i < 2; i++) { const t = i ? .35 : -.35; add(box(1.2 * u, .12 * u, 3 * u), L(t * w, h * .5, d * .7 + 1.4 * u, -.45, 0, 0), C.wood); }
      },
      small(add) { this.home(add, .85); },
    },
    coral: {
      home(add, k) { // a knobbly grown chamber, ribbed with bands, branching arms tipped with polyps
        const R0 = 1.35 * u * k, cy = .35 * u;
        add(sunk(cyl(R0 * .95, R0, SINK + .2 * u, 9)), L(), C.wall2);
        add(ball(R0, 1), L(0, cy + R0 * .45, 0, 0, r() * 6, 0, 1, .78, 1), C.wall);
        for (const [y, s] of [[.25, 1.02], [.7, .95], [1.05, .75]]) add(new THREE.TorusGeometry(R0 * s, .07 * u, 4, 14).rotateX(Math.PI / 2), L(0, cy + R0 * y * .78 + R0 * .1, 0), C.wall2);
        for (let i = 0; i < 9; i++) { const a = r() * 6.28, y = .2 + r() * .9; add(ball(.16 * u * k, 0), L(Math.cos(a) * R0 * .97 * Math.sqrt(1 - (y - .5) ** 2), cy + R0 * .45 + (y - .5) * R0 * 1.4, Math.sin(a) * R0 * .97 * Math.sqrt(1 - (y - .5) ** 2)), i % 2 ? C.accent2 : C.wall2); }
        const n = 4 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2 + r() * .4, lean = .25 + r() * .35, h = (1.4 + r() * 1.6) * u * k * tall, rad = (.16 + r() * .12) * u * k;
          const m = L(Math.cos(a) * R0 * .45, cy + R0 * .6, Math.sin(a) * R0 * .45, Math.sin(a) * lean, 0, -Math.cos(a) * lean);
          add(cyl(rad * .65, rad, h, 6), m, i % 2 ? C.wall : C.accent);
          for (const f of [-1, 1]) { // a fork near the top
            const b = m.clone().multiply(L(0, h * .62, 0, 0, a, f * .6));
            add(cyl(rad * .35, rad * .6, h * .45, 5), b, i % 2 ? C.wall : C.accent);
            add(ball(rad * .75, 0), b.clone().multiply(L(0, h * .45, 0)), C.accent2, lights && f > 0 && i === 0);
          }
          add(ball(rad * 1.05, 0), m.clone().multiply(L(0, h, 0)), C.accent2);
        }
        add(new THREE.TorusGeometry(.6 * u * k, .12 * u, 5, 10, Math.PI), L(0, cy * .5, R0 * .9), C.wall2);
        add(dome(.55 * u * k, 8), L(0, cy * .5, R0 * .86, Math.PI / 2, 0, 0, 1, 1, .45), C.door);
        for (const x of [-1, 1]) add(dome(.2 * u * k, 6), L(x * R0 * .55, cy + R0 * .55, R0 * .78, Math.PI / 2, 0, 0, 1, 1, .4), lights ? C.window : C.door, lights);
      },
      great(add, k) { // a great fan, ringed with branches
        add(sunk(cyl(.7 * u, 1 * u, 3 * u * tall * k + SINK, 6)), L(), C.wall2);
        add(ball(4 * u * k, 1), L(0, 3 * u * tall * k + 4 * u * k, 0, 0, 0, 0, 1.15, 1.1, .1), C.accent); add(ring(3.2 * u * k, .2 * u, 16).rotateX(Math.PI / 2), L(0, 3 * u * tall * k + 4 * u * k, .45 * u), C.wall);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, h = (3 + r() * 3) * u * k; add(cyl(.2 * u, .45 * u, h, 6), L(Math.cos(a) * 3 * u * k, 0, Math.sin(a) * 3 * u * k, Math.sin(a) * .25, 0, -Math.cos(a) * .25), C.wall); add(ball(.5 * u, 0), L(Math.cos(a) * 3 * u * k + Math.cos(a) * h * .25, h * .97, Math.sin(a) * 3 * u * k + Math.sin(a) * h * .25), C.wall, lights); }
      },
      small(add) { add(sunk(ball(1.2 * u, 1)), L(0, .4 * u, 0), C.wall); add(cyl(.2 * u, .3 * u, 2 * u, 5), L(), C.accent); },
    },
    shells: {
      home(add, k) { // a spiral shell, ridged and spined, with a flared lip round the door
        let y = 0, rad = 1.3 * u * k, tube = .55 * u * k;
        add(sunk(cyl(rad + tube, rad + tube * 1.1, SINK + .1 * u, 12)), L(), C.wall2);
        const turns = 4 + Math.round(Math.min(k, 2.6) * 1.5);
        for (let i = 0; i < turns; i++) {
          const off = i * .12 * u;
          add(ring(rad, tube, 12), L(off, y + tube * .7, 0, 0, i * .5), i % 2 ? C.wall : C.wall2);
          add(new THREE.TorusGeometry(rad + tube * .55, tube * .14, 3, 10).rotateX(Math.PI / 2), L(off, y + tube * 1.25, 0, 0, i * .5), C.trim);
          for (let j = 0; j < 3; j++) { const a = j / 3 * Math.PI * 2 + i; add(cone(tube * .2, tube * .8, 3), L(off + Math.cos(a) * (rad + tube * .85), y + tube * .7, Math.sin(a) * (rad + tube * .85), Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3), C.accent2); }
          y += tube * 1.15; rad *= .84; tube *= .9;
        }
        add(cone(rad + tube, 1.2 * u * k, 12), L(0, y + tube * .5, 0), C.accent);
        add(ball(.18 * u * k, 1), L(0, y + tube * .5 + 1.25 * u * k, 0), C.trim);
        // The lip: a flared half-ring round the doorway, a dark mouth, two round windows.
        add(new THREE.TorusGeometry(.75 * u * k, .2 * u * k, 6, 12, Math.PI), L(0, 0, 1.55 * u * k, 0, 0, 0, 1, 1.25, 1), C.trim);
        add(dome(.62 * u * k, 10), L(0, 0, 1.5 * u * k, Math.PI / 2, 0, 0, 1, 1.3, .5), C.door);
        for (const x of [-1, 1]) add(dome(.2 * u * k, 6), L(x * .9 * u * k, 1.1 * u * k, 1.25 * u * k, Math.PI / 2, x * .5, 0, 1, 1, .4), lights ? C.window : C.door, lights);
      },
      great(add, k) { this.home(add, k * 2.6); },
      small(add) { add(sunk(cyl(1.6 * u, 1.6 * u, SINK)), L(), C.wall2); for (let i = 0; i < 3; i++) add(ring(1.2 * u * (1 - i * .2), .45 * u, 10), L(0, .4 * u + i * .55 * u, 0), C.wall); },
    },
    // ---- Sea builders, on the sea floor (no roofs, chimneys or doors to keep weather out) ----
    conch: {
      // A real spiral shell standing on its broad last whorl: a tapering tube winding down
      // from the apex, banded, knobbed along the shoulder, its flared aperture lit from within.
      home(add, k) {
        const H = 2.6 * u * k * tall, Rm = 1.3 * u * k, turns = 2.6 + r() * .9, segs = 44, pts = [], radii = [];
        for (let i = 0; i <= segs; i++) {
          const t = i / segs, a = t * turns * Math.PI * 2, tr = Rm * (.06 + .52 * t ** 1.1);
          pts.push(new THREE.Vector3(Math.cos(a) * Rm * .7 * t, H * (1 - t) ** 1.3 + tr * .85, Math.sin(a) * Rm * .7 * t)); radii.push(tr);
        }
        // Turn the shell so its aperture faces the street (+z).
        const end = pts[segs], face = L(0, 0, 0, 0, Math.atan2(end.x, end.z) - Math.PI * .15, 0), at = (m = L()) => face.clone().multiply(m);
        add(sunk(cyl(Rm * 1.05, Rm * 1.15, SINK + .12 * u, 12)), L(), C.wall2);
        const bands = 3;
        for (let b = 0; b < bands; b++) { const i0 = Math.floor(b / bands * segs), i1 = Math.floor((b + 1) / bands * segs); add(taperTube(pts.slice(i0, i1 + 1), radii.slice(i0, i1 + 1), 12), at(), b % 2 ? C.wall2 : C.wall); }
        for (let i = 6; i < segs - 2; i += 4) { const p = pts[i], out = V(p.x, 0, p.z).normalize(); add(ball(radii[i] * .28, 0), at(L(p.x + out.x * radii[i] * .85, p.y + radii[i] * .45, p.z + out.z * radii[i] * .85)), C.accent2); }
        const tan = pts[segs].clone().sub(pts[segs - 1]).normalize(), q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), tan), lipM = new THREE.Matrix4().compose(end, q, V(1, 1, 1));
        add(new THREE.TorusGeometry(radii[segs] * 1.02, radii[segs] * .2, 6, 16), at().multiply(lipM), C.trim);
        add(new THREE.CircleGeometry(radii[segs] * .95, 14), at().multiply(lipM).multiply(L(0, 0, -.02 * u)), lights ? C.window : C.door, lights);
        if (lights) for (let i = 10; i < segs - 4; i += 7) { const p = pts[i], out = V(p.x, 0, p.z).normalize(); add(ball(.09 * u * k, 0), at(L(p.x + out.x * radii[i] * .98, p.y, p.z + out.z * radii[i] * .98)), C.window, true); }
      },
      great(add, k) { this.home(add, k * 2.6); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .3, d = 4.2 * u * k; add(ball(.5 * u * k, 1), L(Math.cos(a) * d, .3 * u, Math.sin(a) * d, 0, 0, 0, 1, .6, 1), C.accent2); } },
      small(add) { add(sunk(cyl(1.4 * u, 1.5 * u, SINK)), L(), C.wall2); add(cone(1.2 * u, 2.4 * u, 10), L(0, 0, 0, 0, 0, .12), C.wall); },
    },
    polyp: {
      // A colony of soft tubes rising from a shared mound, each open at the top, its rim
      // fringed with feeding tentacles and its throat glowing.
      home(add, k) {
        const base = 1.4 * u * k, n = 3 + Math.floor(r() * 4);
        add(sunk(ball(base * 1.15, 1)), L(0, 0, 0, 0, 0, 0, 1, .4, 1), C.wall2);
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2 + r() * .5, d = i ? base * (.5 + r() * .25) : 0, x = Math.cos(a) * d, z = Math.sin(a) * d;
          const h = (1.9 + r() * 1.6) * u * k * tall * (i ? .72 : 1), rad = (.42 + r() * .16) * u * k * (i ? .8 : 1);
          add(cyl(rad * 1.18, rad * .82, h, 12), L(x, 0, z), i % 2 ? C.wall : C.wall2);
          add(ring(rad * .95, .05 * u * k, 12), L(x, h * .55, z), C.trim);
          add(ring(rad * 1.18, .09 * u * k, 12), L(x, h, z), C.trim);
          add(new THREE.CircleGeometry(rad * 1.05, 12).rotateX(-Math.PI / 2), L(x, h - .15 * u, z), lights ? C.window : C.door, lights);
          const m = 9 + Math.floor(r() * 5);
          for (let j = 0; j < m; j++) { const b = j / m * Math.PI * 2; add(cone(.06 * u * k, (.45 + r() * .3) * u * k, 4), L(x + Math.cos(b) * rad * 1.15, h, z + Math.sin(b) * rad * 1.15, Math.sin(b) * .8, 0, -Math.cos(b) * .8), j % 2 ? C.accent : C.accent2); }
        }
        add(new THREE.TorusGeometry(.55 * u * k, .14 * u * k, 5, 10, Math.PI), L(0, 0, base * .78), C.trim);
        add(dome(.48 * u * k, 8), L(0, 0, base * .74, Math.PI / 2, 0, 0, 1, 1, .45), C.door);
      },
      great(add, k) { this.home(add, k * 2.4); },
      small(add) { for (let i = 0; i < 3; i++) add(cyl(.5 * u, .35 * u, (2 + i) * u, 8), L((i - 1) * 1.1 * u, 0, 0), i % 2 ? C.wall : C.wall2); },
    },
    kelpweave: {
      // A dome woven from crossing arches of kelp, a skin of living blades between them,
      // gas floats clustered on top and long blades streaming up from the crown.
      home(add, k) {
        const R = 1.5 * u * k, H = 2 * u * k * tall, ribs = 6;
        add(sunk(cyl(R * 1.04, R * 1.1, SINK + .1 * u, 12)), L(), C.wall2);
        add(dome(R * .95, 12), L(0, 0, 0, 0, 0, 0, 1, H / R * .95, 1), C.wall2);
        for (let i = 0; i < ribs; i++) add(new THREE.TorusGeometry(R, .11 * u * k, 5, 16, Math.PI).scale(1, H / R, 1), L(0, 0, 0, 0, i / ribs * Math.PI, 0), i % 2 ? C.wall : C.leaf);
        for (let j = 0; j < 5; j++) { const a = j / 5 * Math.PI * 2; add(ball(.3 * u * k, 1), L(Math.cos(a) * R * .3, H + .15 * u, Math.sin(a) * R * .3), C.accent2, lights && j === 0); }
        for (let j = 0; j < 4; j++) { const a = j / 4 * Math.PI * 2 + .4; add(box(.35 * u * k, 2.2 * u * k, .03 * u), L(Math.cos(a) * .3 * u, H, Math.sin(a) * .3 * u, Math.sin(a) * .35, a, -Math.cos(a) * .35), C.leaf); }
        add(new THREE.TorusGeometry(.6 * u * k, .12 * u * k, 5, 10, Math.PI), L(0, 0, R * .9), C.wall);
        add(dome(.52 * u * k, 8), L(0, 0, R * .86, Math.PI / 2, 0, 0, 1, 1, .45), C.door);
        if (lights) for (let j = 0; j < 4; j++) { const a = j / 4 * Math.PI * 2 + .8; add(ball(.1 * u * k, 0), L(Math.cos(a) * R * .8, H * .45, Math.sin(a) * R * .8), C.window, true); }
      },
      great(add, k) { this.home(add, k * 2.5); },
      small(add) { add(sunk(dome(1.4 * u, 8)), L(0, 0, 0, 0, 0, 0, 1, 1.2, 1), C.wall); },
    },
    stiltpods: {
      home(add, k) { // a pod on three braced legs, a banded rim, a rope ladder and a finial
        const h = 2.8 * u * k * tall, rad = 1.3 * u * k;
        const foot = (i) => [Math.cos(i / 3 * Math.PI * 2) * rad * 1.25, Math.sin(i / 3 * Math.PI * 2) * rad * 1.25];
        for (let i = 0; i < 3; i++) { const [x, z] = foot(i); rod(add, [x, -SINK, z], [x * .32, h + .3 * u, z * .32], .12 * u, C.wood); add(cyl(.22 * u, .26 * u, .25 * u, 6), L(x, 0, z), C.stone2); }
        for (let i = 0; i < 3; i++) { const [x0, z0] = foot(i), [x1, z1] = foot(i + 1); rod(add, [x0 * .8, h * .3, z0 * .8], [x1 * .8, h * .3, z1 * .8], .05 * u, C.wood); }
        add(dome(rad, 12), L(0, h, 0, Math.PI, 0, 0, 1, .5, 1), C.wall2); add(dome(rad, 12), L(0, h, 0, 0, 0, 0, 1, .8, 1), C.wall);
        add(ring(rad * 1.02, .09 * u, 16), L(0, h, 0), C.trim);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.TorusGeometry(rad * 1.005, .035 * u, 3, 10, Math.PI / 2), L(0, h, 0, 0, a, 0, 1, .8, 1), C.wall2); }
        for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4; add(dome(.17 * u, 6), L(Math.cos(a) * rad * .92, h + rad * .3, Math.sin(a) * rad * .92, 0, -a, -Math.PI / 2, 1, .4, 1), lights ? C.window : C.door, lights); }
        add(cyl(.06 * u, .06 * u, .9 * u, 4), L(0, h + rad * .78, 0), C.wood); add(ball(.15 * u, 0), L(0, h + rad * .78 + .9 * u, 0), C.accent);
        add(cyl(.32 * u, .32 * u, .35 * u, 8), L(0, h - .9 * u, 0), C.door); add(ring(.34 * u, .05 * u, 8), L(0, h - .55 * u, 0), C.trim);
        for (const x of [-.18, .18]) rod(add, [x * u, h - .9 * u, .1 * u], [x * u, 0, .6 * u], .02 * u, C.line);
        for (let i = 1; i < 7; i++) { const t = i / 7; add(box(.4 * u, .04 * u, .05 * u), L(0, h - .9 * u - t * (h - .9 * u), .1 * u + t * .5 * u), C.wood); }
        if (r() < .5) { rod(add, [rad * .7, h - .3 * u, 0], [rad * .7, h - 1.2 * u, 0], .015 * u, C.line); add(ball(.25 * u, 0), L(rad * .7, h - 1.45 * u, 0, 0, 0, 0, 1, 1.3, 1), C.accent2); }
      },
      great(add, k) { this.home(add, k * 2.4); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 1; add(dome(1.1 * u, 8), L(Math.cos(a) * 3 * u * k, 4 * u * k * tall, Math.sin(a) * 3 * u * k, Math.PI, 0, 0, 1, .6, 1), C.accent); } },
      small(add) { for (let i = 0; i < 3; i++) { const a = i * 2.09; rod(add, [Math.cos(a) * 1.4 * u, -SINK, Math.sin(a) * 1.4 * u], [0, 2.4 * u, 0], .1 * u, C.wood); } add(dome(1.1 * u, 8), L(0, 2.3 * u, 0), C.wall); },
    },
    rings: {
      home(add, k) { // a low round wall under a conical canopy on a carved central pillar
        const R0 = 2.2 * u * k, wh = .9 * u * k, ph = 3 * u * k * tall;
        add(sunk(cyl(R0 * 1.08, R0 * 1.1, SINK + .1 * u, 16)), L(), C.wall2);
        add(ring(R0 * .9, .45 * u * k, 18), L(0, .35 * u * k, 0, 0, 0, 0, 1, 1.6, 1), C.wall);
        add(ring(R0 * .9, .12 * u, 18), L(0, wh + .15 * u, 0), C.trim);
        add(sunk(cyl(.32 * u, .45 * u, ph + SINK, 8)), L(), C.stone);
        for (let i = 1; i < 5; i++) add(cyl(.36 * u, .4 * u, .14 * u, 8), L(0, ph * i / 5, 0), i % 2 ? C.accent : C.stone2);
        add(cone(R0 * 1.15, ph * .45, 16).translate(0, 0, 0), L(0, ph * .62, 0), C.roof);
        add(new THREE.CylinderGeometry(R0 * 1.16, R0 * 1.16, .12 * u, 16, 1, true), L(0, ph * .62, 0), C.roof2);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2; add(sunk(cyl(.07 * u, .07 * u, ph * .62 + SINK, 4)), L(Math.cos(a) * R0 * 1.02, 0, Math.sin(a) * R0 * 1.02), C.wood); }
        add(ball(.45 * u, 1), L(0, ph * 1.08, 0), C.accent, lights);
        for (const x of [-1, 1]) add(sunk(box(.25 * u, 1.5 * u + SINK, .25 * u)), L(x * .6 * u, 0, R0 * .9), C.stone2);
        add(box(1.45 * u, .2 * u, .3 * u), L(0, 1.5 * u, R0 * .9), C.stone2);
        add(cyl(.5 * u, .55 * u, .06 * u, 8), L(0, 0, R0 * .3), C.ember, level <= 3);
      },
      great(add, k) { for (let i = 0; i < 3; i++) add(ring((3 + i * 3) * u * k, .55 * u, 24), L(0, .5 * u, 0, 0, 0, 0, 1, 1.8, 1), i % 2 ? C.wall2 : C.wall); add(sunk(cyl(.9 * u, 1.3 * u, 10 * u * k * tall + SINK, 6)), L(), C.stone); add(ball(1.1 * u), L(0, 10 * u * k * tall, 0), C.accent, lights); },
      small(add) { add(sunk(cyl(1.8 * u, 1.8 * u, SINK, 12)), L(), C.wall2); add(ring(1.5 * u, .4 * u, 12), L(0, .4 * u, 0), C.wall); },
    },
    tethered: { // drifters: platforms held aloft under gas-bags, tethered to anchors
      home(add, k) { // a railed platform and gondola under a banded gas-bag, held by guy lines
        const H0 = (8 + r() * 6) * u * k * tall, P = 2 * u * k;
        add(sunk(cyl(.6 * u, .8 * u, .5 * u + SINK, 7)), L(), C.stone); add(ring(.5 * u, .08 * u, 8), L(0, .55 * u, 0), C.metal);
        rod(add, [0, .5 * u, 0], [0, H0, 0], .05 * u, C.line);
        for (let i = 0; i < 3; i++) { const a = i * 2.09 + .5; add(sunk(cyl(.25 * u, .3 * u, .3 * u + SINK, 6)), L(Math.cos(a) * 4 * u, 0, Math.sin(a) * 4 * u), C.stone2); rod(add, [Math.cos(a) * 4 * u, .3 * u, Math.sin(a) * 4 * u], [Math.cos(a) * P * .9, H0, Math.sin(a) * P * .9], .02 * u, C.line); }
        add(cyl(P, P * .7, .35 * u, 12), L(0, H0, 0), C.wall2);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(cyl(.03 * u, .03 * u, .55 * u, 3), L(Math.cos(a) * P * .97, H0 + .35 * u, Math.sin(a) * P * .97), C.wood); }
        add(new THREE.TorusGeometry(P * .97, .03 * u, 3, 10).rotateX(Math.PI / 2), L(0, H0 + .88 * u, 0), C.wood);
        add(cyl(1.1 * u * k, 1.2 * u * k, .9 * u * k, 10), L(0, H0 + .35 * u, 0), C.wall);
        add(dome(1.1 * u * k, 10), L(0, H0 + .35 * u + .9 * u * k, 0, 0, 0, 0, 1, .55, 1), C.roof);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(box(.3 * u, .3 * u, .05), L(Math.cos(a) * 1.13 * u * k, H0 + .35 * u + .35 * u * k, Math.sin(a) * 1.13 * u * k, 0, Math.PI / 2 - a, 0), lights ? C.window : C.door, lights); }
        const by = H0 + 3.4 * u * k;
        add(ball(2 * u * k, 1), L(0, by, 0, 0, 0, 0, 1.25, .75, 1.25), C.bag);
        for (let i = 0; i < 2; i++) add(new THREE.TorusGeometry(2.5 * u * k, .06 * u, 3, 12), L(0, by, 0, 0, i * Math.PI / 2, 0, 1, .6, 1), C.accent);
        add(new THREE.TorusGeometry(2.45 * u * k, .07 * u, 3, 12).rotateX(Math.PI / 2), L(0, by, 0), C.accent);
        for (let i = 0; i < 4; i++) { const a = i * 1.57; rod(add, [Math.cos(a) * P * .9, H0 + .3 * u, Math.sin(a) * P * .9], [Math.cos(a) * 2 * u * k, by - .9 * u * k, Math.sin(a) * 2 * u * k], .025 * u, C.line); }
        add(cone(.4 * u, .8 * u, 6).rotateX(Math.PI), L(0, by + 1.7 * u * k, 0), C.accent2);
        for (let i = 0; i < 4; i++) { const a = r() * 6.28, d = P * (.6 + r() * .3), L0 = (1 + r() * 2) * u; rod(add, [Math.cos(a) * d, H0, Math.sin(a) * d], [Math.cos(a) * d, H0 - L0, Math.sin(a) * d], .02 * u, C.line); add(ball(.22 * u, 0), L(Math.cos(a) * d, H0 - L0 - .2 * u, Math.sin(a) * d, 0, 0, 0, 1, 1.4, 1), C.accent2); }
      },
      great(add, k) { this.home(add, k * 2.3); },
      small(add) { rod(add, [0, -SINK, 0], [0, 7 * u, 0], .06 * u, C.line); add(ball(1.4 * u, 1), L(0, 8 * u, 0, 0, 0, 0, 1.2, .8, 1.2), C.bag); },
    },
    reef: { // drifters: tall frond-stalks hung with bulb dwellings
      home(add, k) { // a ringed frond-stalk crowned with curling fronds, hung with lit bulb dwellings
        const H0 = (9 + r() * 5) * u * k * tall;
        add(sunk(cyl(.35 * u, .75 * u, H0 + SINK, 7)), L(), C.wall2);
        for (let y = 1.2 * u; y < H0 * .9; y += 1.3 * u) add(cyl(.42 * u * (1 - y / H0 * .45), .5 * u * (1 - y / H0 * .45), .18 * u, 7), L(0, y, 0), C.wall);
        for (let i = 0; i < 4; i++) { const a = i * 1.57 + .4; rod(add, [Math.cos(a) * 1.4 * u, -SINK, Math.sin(a) * 1.4 * u], [0, 1.6 * u, 0], .12 * u, C.wall2); }
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * Math.PI * 2, base = L(0, H0 * .95, 0, 0, a, 0);
          add(box(.08 * u, 2.4 * u * k, .55 * u), base.clone().multiply(L(0, 0, 0, 0, 0, .55)), i % 2 ? C.accent : C.accent2);
          add(box(.06 * u, 1.5 * u * k, .4 * u), base.clone().multiply(L(-Math.sin(.55) * 2.4 * u * k, Math.cos(.55) * 2.4 * u * k, 0, 0, 0, 1.4)), i % 2 ? C.accent : C.accent2);
        }
        add(ball(.5 * u, 1), L(0, H0 * .97, 0), C.trim);
        for (let i = 0; i < 3 + Math.round(k * 2); i++) {
          const a = r() * 6.28, y = H0 * (.3 + .45 * r()), bx = Math.cos(a) * 1.4 * u, bz = Math.sin(a) * 1.4 * u, br = .8 * u * k;
          rod(add, [0, y, 0], [bx, y - .6 * u, bz], .06 * u, C.wall2);
          add(ball(br, 1), L(bx, y - 1.4 * u, bz, 0, 0, 0, 1, 1.3, 1), C.wall);
          add(new THREE.TorusGeometry(br * .98, .05 * u, 3, 12).rotateX(Math.PI / 2), L(bx, y - 1.4 * u, bz), C.trim);
          add(dome(.22 * u, 6), L(bx + Math.cos(a) * br * .9, y - 1.3 * u, bz + Math.sin(a) * br * .9, 0, -a, -Math.PI / 2, 1, .4, 1), lights ? C.window : C.door, lights);
          for (let j = 0; j < 3; j++) rod(add, [bx + (j - 1) * .25 * u, y - 1.4 * u - br * 1.2, bz], [bx + (j - 1) * .3 * u, y - 2.6 * u - br, bz], .025 * u, C.accent2);
        }
      },
      great(add, k) { this.home(add, k * 2.2); },
      small(add) { add(sunk(cyl(.25 * u, .5 * u, 7 * u + SINK, 5)), L(), C.wall2); add(ball(.9 * u, 1), L(0, 5 * u, .9 * u), C.wall); },
    },
    masts: {
      home(add, k) { // a rigged mast with spars, hung with banded pods
        const h = (6 + r() * 3) * u * tall * k;
        add(sunk(cyl(.12 * u, .24 * u, h + SINK, 6)), L(), C.wood);
        add(sunk(cyl(.5 * u, .6 * u, .3 * u + SINK, 7)), L(), C.stone2);
        for (let i = 0; i < 3; i++) { const a = i * 2.09 + .3, gx = Math.cos(a) * h * .45, gz = Math.sin(a) * h * .45; rod(add, [0, h * .95, 0], [gx, .1 * u, gz], .018 * u, C.line); add(sunk(box(.25 * u, .4 * u + SINK, .25 * u)), L(gx, 0, gz), C.wood); }
        for (const y of [.5, .78]) add(cyl(.035 * u, .035 * u, 2.4 * u, 4).rotateZ(Math.PI / 2).translate(0, 0, 0), L(0, h * y, 0, 0, r() * 3, 0), C.wood);
        add(cyl(.5 * u, .4 * u, .15 * u, 8), L(0, h, 0), C.wood); add(ring(.5 * u, .04 * u, 8), L(0, h + .35 * u, 0), C.wood);
        for (let i = 0; i < 4; i++) { const a = i * 1.57; add(cyl(.03 * u, .03 * u, .35 * u, 3), L(Math.cos(a) * .48 * u, h + .1 * u, Math.sin(a) * .48 * u), C.wood); }
        add(cone(.08 * u, .8 * u, 4), L(0, h + .15 * u, 0), C.wood); add(box(.6 * u, .35 * u, .02 * u).translate(.3 * u, 0, 0), L(0, h + .75 * u, 0, 0, r() * 6, 0), C.accent);
        const pods = 3 + Math.floor(r() * 3);
        for (let i = 0; i < pods; i++) {
          const a = i / pods * Math.PI * 2 + r(), y = h * (.4 + .45 * i / pods), arm = 1 * u, px = Math.cos(a) * arm, pz = Math.sin(a) * arm, pr = .55 * u * k;
          rod(add, [0, y, 0], [px, y, pz], .045 * u, C.wood); rod(add, [0, y - .6 * u, 0], [px * .8, y, pz * .8], .03 * u, C.wood);
          add(ball(pr, 1), L(px, y - .75 * u, pz, 0, 0, 0, 1, 1.35, 1), i % 2 ? C.wall : C.accent);
          for (const t of [-.35, .35]) add(new THREE.TorusGeometry(pr * .94, .035 * u, 3, 10).rotateX(Math.PI / 2), L(px, y - .75 * u + t * pr * 1.35, pz), C.trim);
          add(cyl(.12 * u, .12 * u, .08 * u, 6), L(px, y - .75 * u - pr * 1.4, pz), C.trim);
          add(dome(.16 * u, 6), L(px + Math.cos(a) * pr * .95, y - .75 * u, pz + Math.sin(a) * pr * .95, 0, -a, -Math.PI / 2, 1, .4, 1), lights && i === 0 ? C.window : C.door, lights && i === 0);
        }
      },
      great(add, k) { this.home(add, k * 2.2); },
      small(add) { add(sunk(cyl(.1 * u, .15 * u, 5 * u + SINK, 5)), L(), C.wood); add(ball(.6 * u, 1), L(.6 * u, 3.6 * u, 0), C.wall); },
    },
    hive: {
      home(add, k) { // a cluster of hexagonal cells: bevelled rims, wax caps, doors on the faces
        const cell = .6 * u * k, cells = k > 1.2 ? 7 : 4 + Math.floor(r() * 3), dirs = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3 + Math.PI / 6), Math.sin(i * Math.PI / 3 + Math.PI / 6)])];
        for (let i = 0; i < cells; i++) {
          const [dx, dz] = dirs[i], x = dx * cell * 1.75, z = dz * cell * 1.75, h = (1.2 + r() * 1.6) * u * k * tall * (i ? 1 : 1.4);
          add(sunk(cyl(cell, cell, h + SINK, 6)), L(x, 0, z, 0, Math.PI / 6), i % 2 ? C.wall : C.wall2);
          for (let y = .5 * u; y < h - .2 * u; y += .7 * u) add(cyl(cell * 1.03, cell * 1.03, .06 * u, 6), L(x, y, z, 0, Math.PI / 6), C.wall2);
          add(cyl(cell * 1.06, cell * 1.06, .14 * u, 6), L(x, h - .14 * u, z, 0, Math.PI / 6), C.trim);
          if (r() < .5) { add(cyl(cell * .92, cell * .92, .1 * u, 6), L(x, h, z, 0, Math.PI / 6), C.accent2); add(cone(cell * .9, cell * .45, 6), L(x, h + .1 * u, z, 0, Math.PI / 6), C.accent2); }
          else add(cyl(cell * .72, cell * .72, .05, 6), L(x, h + .01, z, 0, Math.PI / 6), C.door, false);
          if (lights && i % 3 === 0) add(cyl(cell * .5, cell * .5, .06, 6), L(x, h + .2 * u, z, 0, Math.PI / 6), C.window, true);
          if (i < 3) { const fa = Math.atan2(dx || .01, dz || 1); add(dome(.28 * u * k, 6), L(x + Math.sin(fa) * cell * .86, .05 * u, z + Math.cos(fa) * cell * .86, Math.PI / 2, fa, 0, 1, 1.3, .4), C.door); }
          if (r() < .4) add(cone(.06 * u, .35 * u, 4).rotateX(Math.PI), L(x + cell * .7, h - .1 * u, z), C.accent2);
        }
      },
      great(add, k) {
        const cell = .9 * u * k;
        for (let ring_ = 0; ring_ < 3; ring_++) for (let i = 0; i < Math.max(1, ring_ * 6); i++) {
          const a = i / Math.max(1, ring_ * 6) * Math.PI * 2, d = ring_ * cell * 1.75, h = (7 - ring_ * 2.2) * u * k * tall;
          add(sunk(cyl(cell, cell, h + SINK, 6)), L(Math.cos(a) * d, 0, Math.sin(a) * d, 0, Math.PI / 6), (i + ring_) % 2 ? C.wall : C.wall2);
          add(cyl(cell * .7, cell * .7, .05, 6), L(Math.cos(a) * d, h + .01, Math.sin(a) * d, 0, Math.PI / 6), C.door);
        }
      },
      small(add) { for (let i = 0; i < 3; i++) add(sunk(cyl(.6 * u, .6 * u, (1.4 + i * .5) * u + SINK, 6)), L(Math.cos(i * 2.1) * u, 0, Math.sin(i * 2.1) * u, 0, Math.PI / 6), C.wall); },
    },
    mounds: {
      home(add, k) {
        if (k > 1.2 || r() < .4) { // banded spire on a buttressed base, vents up its sides
          let y = 0, rad = 1.8 * u * Math.min(k, 1.4);
          footing(add, rad, C.wall); add(cyl(rad * 1.25, rad * 1.45, .9 * u, 7), L(), C.wall2);
          for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(sunk(cone(rad * .5, 1.4 * u * tall + SINK, 5)), L(Math.cos(a) * rad * 1.15, 0, Math.sin(a) * rad * 1.15, 0, -a, 0, .7, 1, 1), C.wall2); }
          for (let i = 0; i < 4; i++) {
            const h = (2.9 - i * .35) * u * tall * k;
            add(cyl(rad * .74, rad, h, 7), L(0, y, 0, 0, i * .4), i % 2 ? C.wall2 : C.wall);
            add(cyl(rad * .76, rad * .78, .18 * u, 7), L(0, y + h * .92, 0, 0, i * .4), C.accent);
            for (let j = 0; j < 3; j++) { const a = j * 2.1 + i, rr = rad * .86; add(dome(.22 * u, 6), L(Math.cos(a) * rr, y + h * .5, Math.sin(a) * rr, 0, -a, -Math.PI / 2, 1, .4, 1), lights && j === 0 ? C.window : C.door, lights && j === 0); }
            y += h; rad *= .74;
          }
          add(cone(rad, 1.2 * u * tall, 7), L(0, y, 0), C.accent);
          for (let i = 0; i < 3; i++) add(cyl(.1 * u, .16 * u, .9 * u, 5), L((i - 1) * rad * .5, y + .2 * u, 0, 0, 0, (i - 1) * .3), C.wall2);
        } else { // a ridged earth mound with chimneys and a framed mouth
          const h = 3.4 * u * tall * k, rad = 2 * u * k;
          add(sunk(cone(rad, h + SINK, 9)), L(0, 0, 0, 0, r() * 6), C.wall);
          for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + .2; add(sunk(cone(rad * .28, h * .8 + SINK, 4)), L(Math.cos(a) * rad * .62, 0, Math.sin(a) * rad * .62, 0, -a, 0, .45, 1, 1), C.wall2); }
          for (let i = 0; i < 3; i++) { const a = r() * 6.28, s = .4 + r() * .35; add(sunk(cone(rad * s, h * s + SINK, 7)), L(Math.cos(a) * rad * .75, 0, Math.sin(a) * rad * .75), C.wall2); add(cyl(.12 * u, .16 * u, .5 * u, 5), L(Math.cos(a) * rad * .75, h * s * .95, Math.sin(a) * rad * .75), C.door); }
          add(new THREE.TorusGeometry(.62 * u * k, .14 * u, 5, 10, Math.PI), L(0, 0, rad * .74), C.accent);
          add(dome(.55 * u * k, 8), L(0, 0, rad * .72, Math.PI / 2, 0, 0, 1, 1, .5), C.door);
          add(cyl(rad * .32, rad * .36, .25 * u, 7), L(0, h * .55, 0), C.accent);
          for (let i = 0; i < 4; i++) { const a = i * 1.57 + .8; add(dome(.15 * u, 6), L(Math.cos(a) * rad * .45, h * .45, Math.sin(a) * rad * .45, 0, -a, -Math.PI / 2 + .5, 1, .4, 1), lights ? C.window : C.door, lights); }
        }
      },
      great(add, k) { this.home(add, k * 2.2); },
      small(add) { add(sunk(cone(1.6 * u, 3 * u + SINK, 6)), L(), C.wall); },
    },
    silk: {
      home(add, k) { // a two-layer silk cone on poles, spiral threads, a funnel mouth, egg-sacs
        const rad = 1.6 * u * k, h = 2.8 * u * k * tall;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; rod(add, [Math.cos(a) * rad, -SINK, Math.sin(a) * rad], [Math.cos(a) * rad * .2, h * 1.25, Math.sin(a) * rad * .2], .05 * u, C.wood); }
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .1; rod(add, [Math.cos(a) * rad * .35, h * 1.05, Math.sin(a) * rad * .35], [Math.cos(a) * rad * 2.1, 0, Math.sin(a) * rad * 2.1], .012 * u, C.wall); add(cone(.06 * u, .2 * u, 3), L(Math.cos(a) * rad * 2.1, 0, Math.sin(a) * rad * 2.1), C.wood); }
        add(sunk(cyl(rad * .9, rad * .9, SINK, 10)), L(), C.wall2);
        add(cone(rad, h, 10), L(), C.wall, lights);
        add(cone(rad * .7, h * .62, 10), L(0, h * .45, 0), C.trim);
        for (let i = 1; i < 6; i++) { const f = i / 6; add(ring(rad * (1 - f) + .02, .015 * u, 12), L(0, h * f, 0), C.wall2); }
        add(cone(.55 * u, 1.1 * u, 8).rotateX(Math.PI / 2), L(0, .55 * u, rad * .75), C.wall);
        add(cyl(.4 * u, .4 * u, .05, 8).rotateX(Math.PI / 2), L(0, .55 * u, rad * .78), C.door);
        for (let i = 0; i < 3; i++) { const a = r() * 6.28; rod(add, [Math.cos(a) * rad * .5, h * .5, Math.sin(a) * rad * .5], [Math.cos(a) * rad * .75, h * .25, Math.sin(a) * rad * .75], .01 * u, C.wall); add(ball(.2 * u, 0), L(Math.cos(a) * rad * .75, h * .2, Math.sin(a) * rad * .75, 0, 0, 0, 1, 1.3, 1), C.bag); }
      },
      great(add, k) { // a funnel web on poles above a canopy
        const rad = 4 * u * k, h = 5 * u * k * tall;
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(sunk(cyl(.1 * u, .14 * u, h * 1.6 + SINK, 5)), L(Math.cos(a) * rad, 0, Math.sin(a) * rad), C.wood); rod(add, [Math.cos(a) * rad, h * 1.55, Math.sin(a) * rad], [Math.cos(a + 1.05) * rad, h * 1.55, Math.sin(a + 1.05) * rad], .02 * u, C.wall); }
        add(cone(rad * 1.05, h, 12).rotateX(Math.PI).translate(0, h, 0), L(0, h * .55, 0), C.wall);
        add(dome(rad * .7, 12), L(0, 0, 0, 0, 0, 0, 1, .6, 1), C.wall2, lights);
      },
      small(add) { add(sunk(cyl(1.1 * u, 1.1 * u, SINK, 7)), L(), C.wall2); add(cone(1.2 * u, 2 * u, 7), L(), C.wall); },
    },
    trapdoor: {
      home(add, k) { // a silk-rimmed burrow with a hinged lid, signal threads and a lookout
        const rad = 1.1 * u * k;
        add(sunk(cyl(rad * 1.6, rad * 1.8, .25 * u + SINK, 12)), L(), C.wall2); add(ring(rad * 1.3, .3 * u * k, 14), L(0, .25 * u, 0), C.wall);
        add(ring(rad * 1.05, .08 * u, 14), L(0, .3 * u, 0), C.trim);
        add(cyl(rad, rad, .04, 12), L(0, .27 * u, 0), C.door, false);
        const lid = L(0, .3 * u, -rad, -1.1, 0, 0).multiply(L(0, 0, rad));
        add(cyl(rad * 1.05, rad * 1.05, .12 * u, 12), lid, C.wall);
        for (let i = 0; i < 5; i++) add(ball((.12 + r() * .1) * u, 0), lid.clone().multiply(L((r() - .5) * rad, .1 * u, (r() - .5) * rad, 0, 0, 0, 1, .6, 1)), i % 2 ? C.stone : C.leaf);
        add(cyl(.1 * u, .1 * u, .3 * u, 4).rotateZ(Math.PI / 2), L(0, .3 * u, -rad), C.wood);
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .3, l = (2.5 + r() * 2) * u; rod(add, [Math.cos(a) * rad * 1.5, .1 * u, Math.sin(a) * rad * 1.5], [Math.cos(a) * (rad * 1.5 + l), .03 * u, Math.sin(a) * (rad * 1.5 + l)], .012 * u, C.trim); }
        add(cone(.3 * u, 1.6 * u * k, 6), L(rad * 1.3, 0, -rad), C.wall2); add(ring(.22 * u, .05 * u, 6), L(rad * 1.3, 1 * u * k, -rad), C.trim);
        add(ball(.2 * u, 0), L(rad * 1.3, 1.6 * u * k, -rad), C.accent);
        if (lights) add(cyl(rad * .6, rad * .6, .06, 10), L(0, .29 * u, 0), C.window, true);
      },
      great(add, k) { add(sunk(cyl(6 * u * k, 6.5 * u * k, .4 * u + SINK, 20)), L(), C.wall2); add(ring(5 * u * k, .8 * u, 22), L(0, .5 * u, 0), C.wall); add(ring(3 * u * k, .5 * u, 18), L(0, .4 * u, 0), C.wall); add(sunk(cyl(.8 * u, 1.2 * u, 9 * u * k * tall + SINK, 7)), L(), C.wall2); for (let y = 2; y < 9 * k * tall; y += 1.8) add(ring(.95 * u, .12 * u, 8), L(0, y * u, 0), lights ? C.window : C.door, lights); },
      small(add) { add(sunk(cyl(1.5 * u, 1.6 * u, .3 * u + SINK, 10)), L(), C.wall2); add(cyl(1 * u, 1 * u, .05, 10), L(0, .3 * u, 0), C.door); },
    },
    burrows: {
      home(add, k) {
        const rad = 2.3 * u * k;
        const y0 = -.1 * u; // the mound's base, just into the ground, with a skirt reaching down
        add(dome(rad, 12).scale(1, .7, 1), L(0, y0, 0), C.wall); add(sunk(cyl(rad, rad * 1.03, SINK, 12)), L(0, y0 + .02, 0), C.wall);
        add(dome(rad * .8, 10).scale(1, .78, 1), L(0, y0 + rad * .1, 0), C.turf);
        // A dug ramp to a doorway framed with stones and a lintel, tufts on the mound, a vent.
        add(box(1.1 * u * k, .1 * u, 2.4 * u * k), L(0, .2 * u, rad * .9, .35, 0, 0), C.soil);
        add(dome(.62 * u * k, 10), L(0, .1 * u, rad * .7, Math.PI / 2, 0, 0, 1, 1, .4), C.door);
        for (let i = 0; i < 7; i++) { const a = Math.PI * (i / 6); add(ball(.2 * u * k, 0), L(Math.cos(a) * .72 * u * k, .1 * u + Math.sin(a) * .72 * u * k, rad * .72, 0, i, 0, 1, .8, 1), i % 2 ? C.stone : C.stone2); }
        add(box(1.7 * u * k, .2 * u, .35 * u), L(0, .85 * u * k, rad * .7), C.stone2);
        for (let i = 0; i < 8; i++) { const a = r() * 6.28, d = rad * (.25 + r() * .55); add(cone(.12 * u, (.4 + r() * .4) * u, 3), L(Math.cos(a) * d, y0 + rad * .7 * Math.sqrt(1 - (d / rad) ** 2) - .05, Math.sin(a) * d, (r() - .5) * .4, 0, (r() - .5) * .4), C.leaf); }
        add(cyl(.35 * u * k, .35 * u * k, .1, 8), L(0, y0 + rad * .72, 0), lights ? C.window : C.wall2, lights);
        const vy = y0 + rad * .55; add(cyl(.18 * u, .24 * u, 1 * u * k, 6), L(-rad * .5, vy, -rad * .3), C.stone2); add(cyl(.22 * u, .22 * u, .1 * u, 6), L(-rad * .5, vy + 1 * u * k, -rad * .3), C.stone);
        if (r() < .5) add(sunk(dome(rad * .45, 8).scale(1, .6, 1)), L(rad * 1.05, SINK * .3, -rad * .2), C.wall2);
      },
      great(add, k) { // terraced amphitheatre bowl
        for (let i = 0; i < 4; i++) add(ring((2.5 + i * 1.8) * u * k, .8 * u, 22), L(0, i * .9 * u * tall, 0, 0, 0, 0, 1, 1.2, 1), i % 2 ? C.wall2 : C.wall);
        add(sunk(cyl(9.5 * u * k, 9.5 * u * k, SINK, 22)), L(), C.wall2); add(cyl(2 * u * k, 2 * u * k, .1, 14), L(0, .05, 0), C.door);
        if (lights) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(ball(.3 * u), L(Math.cos(a) * 8.6 * u * k, 3.2 * u, Math.sin(a) * 8.6 * u * k), C.window, true); }
      },
      small(add) { this.home(add, .8); },
    },
    perches: {
      home(add, k) { // a ringed pole with leafy side branches and woven nests under a canopy
        const h = (4.5 + r() * 3) * u * tall * k, nests = k > 1.2 ? 3 : 1 + (r() < .5 ? 1 : 0);
        add(sunk(cyl(.16 * u * k, .3 * u * k, h + SINK, 6)), L(0, 0, 0, (r() - .5) * .08, 0, (r() - .5) * .08), C.wood);
        for (let i = 0; i < 3; i++) { const a = i * 2.09; rod(add, [Math.cos(a) * .7 * u, -SINK, Math.sin(a) * .7 * u], [0, .9 * u, 0], .1 * u, C.wood); }
        for (let y = .8 * u; y < h * .9; y += .9 * u) add(cyl(.2 * u * k, .22 * u * k, .08 * u, 6), L(0, y, 0), C.roof2);
        for (let i = 0; i < 2; i++) { const a = i * 3.1 + 1, y = h * (.45 + i * .15); rod(add, [0, y, 0], [Math.cos(a) * 1.3 * u, y + .6 * u, Math.sin(a) * 1.3 * u], .05 * u, C.wood); add(ball(.45 * u, 0), L(Math.cos(a) * 1.4 * u, y + .7 * u, Math.sin(a) * 1.4 * u, 0, r() * 6, 0, 1, .7, 1), C.leaf); }
        for (let i = 0; i < nests; i++) {
          const y = h * (1 - i * .28), a = i * 2.2, off = i ? 1.1 * u : 0, x = Math.cos(a) * off, z = Math.sin(a) * off;
          if (i) rod(add, [0, y - .5 * u, 0], [x, y, z], .06 * u, C.wood);
          add(cyl(.7 * u, .55 * u, .25 * u, 9), L(x, y - .2 * u, z), C.wood);
          add(ring(.75 * u, .22 * u, 10), L(x, y, z), C.roof);
          add(ring(.8 * u, .06 * u, 10), L(x, y + .12 * u, z, .15, 0, 0), C.roof2);
          add(cyl(.55 * u, .55 * u, .04, 9), L(x, y + .05 * u, z), C.accent2);
          for (let j = 0; j < 4; j++) { const b = j * 1.57 + .5; add(cone(.05 * u, .45 * u, 3), L(x + Math.cos(b) * .85 * u, y - .1 * u, z + Math.sin(b) * .85 * u, Math.sin(b) * .8, 0, -Math.cos(b) * .8), C.roof2); }
          if (lights) add(ball(.2 * u), L(x, y + .2 * u, z), C.window, true);
        }
        add(cone(1.1 * u, .8 * u, 7), L(0, h + .9 * u, 0), C.roof); for (let i = 0; i < 3; i++) rod(add, [Math.cos(i * 2.09) * .7 * u, h + .1 * u, Math.sin(i * 2.09) * .7 * u], [0, h + 1 * u, 0], .04 * u, C.wood);
        add(box(.08 * u, .6 * u, .02 * u), L(0, h + 1.6 * u, 0), C.accent); add(cyl(.02 * u, .02 * u, .9 * u, 3), L(0, h + 1.5 * u, 0), C.wood);
      },
      great(add, k) { // a perch-tree: thick trunk, nests at every height
        const h = 14 * u * k * tall;
        add(sunk(cyl(.6 * u, 1.2 * u, h + SINK, 7)), L(), C.wood);
        for (let i = 0; i < 7; i++) { const a = i * 2.4, y = h * (.35 + i * .1), off = 2 * u; rod(add, [0, y - u, 0], [Math.cos(a) * off, y, Math.sin(a) * off], .12 * u, C.wood); add(ring(.9 * u, .26 * u, 10), L(Math.cos(a) * off, y, Math.sin(a) * off), C.roof); }
      },
      small(add) { add(sunk(cyl(.12 * u, .2 * u, 4 * u + SINK, 5)), L(), C.wood); add(ring(.6 * u, .2 * u, 8), L(0, 4 * u, 0), C.roof); },
    },
    rookery: {
      home(add, k) { // a stone tower ringed with spiral ledges, framed holes and a capped roof
        const h = (5 + r() * 3) * u * tall * k, rad = 1.3 * u * k;
        add(sunk(cyl(rad * .7, rad, h + SINK, 8)), L(0, 0, 0, 0, r() * 6), C.wall);
        for (let y = .9 * u; y < h; y += 1.4 * u) add(cyl(rad * (1 - y / h * .3) * 1.02, rad * (1 - y / h * .3) * 1.04, .12 * u, 8), L(0, y, 0), C.wall2);
        let a = r() * 6.28;
        for (let y = 1.2 * u; y < h - .5 * u; y += .9 * u) {
          a += 1.1; const rr = rad * (1 - y / h * .3);
          add(box(1.2 * u, .12 * u, .65 * u), L(Math.cos(a) * rr, y, Math.sin(a) * rr, 0, -a + Math.PI / 2), C.wall2);
          for (const s of [-1, 1]) add(box(.08 * u, .2 * u, .3 * u), L(Math.cos(a) * rr + Math.cos(a + s * .4) * .05, y - .2 * u, Math.sin(a) * rr, 0, -a + Math.PI / 2), C.wood);
          const ha = a + .5;
          add(box(.75 * u, .1 * u, .25 * u), L(Math.cos(ha) * rr, y + .72 * u, Math.sin(ha) * rr, 0, -ha + Math.PI / 2), C.trim);
          add(dome(.25 * u, 6), L(Math.cos(ha) * rr * 1.02, y + .42 * u, Math.sin(ha) * rr * 1.02, 0, -ha, -Math.PI / 2, 1, .4, 1), lights ? C.window : C.door, lights);
          add(box(.06 * u, .5 * u, .02 * u), L(Math.cos(a) * rr * 1.01, y - .5 * u, Math.sin(a) * rr * 1.01, 0, -a + Math.PI / 2), C.trim);
        }
        const tr = rad * .7;
        add(cyl(tr * 1.15, tr * 1.1, .2 * u, 8), L(0, h, 0), C.wall2);
        add(cone(tr * 1.2, 1.4 * u * k, 8), L(0, h + .2 * u, 0), C.roof);
        add(cyl(.04 * u, .04 * u, .8 * u, 3), L(0, h + .2 * u + 1.4 * u * k, 0), C.wood); add(ball(.12 * u, 0), L(0, h + 1.4 * u * k + 1 * u, 0), C.accent);
        add(dome(.5 * u * k, 8), L(0, 0, rad * .95, Math.PI / 2, 0, 0, 1, 1.2, .4), C.door);
      },
      great(add, k) { this.home(add, k * 2.4); },
      small(add) { add(sunk(cyl(.8 * u, 1 * u, 4 * u + SINK, 6)), L(), C.wall); },
    },
    hanging: {
      home(add, k) { // a braced frame with a thatched beam, woven pods hung on ropes
        const w = 2.4 * u * k, h = 4.5 * u * k * tall;
        for (const x of [-1, 1]) { add(sunk(cyl(.14 * u, .2 * u, h + SINK, 6)), L(x * w, 0, 0, 0, 0, x * .06), C.wood); for (const z of [-1, 1]) rod(add, [x * w, -SINK * .5, z * 1.1 * u], [x * w * .97, h * .55, 0], .06 * u, C.wood); }
        add(box(w * 2.3, .22 * u, .3 * u), L(0, h, 0), C.wood);
        rod(add, [-w, h * .6, 0], [-w * .4, h, 0], .05 * u, C.wood); rod(add, [w, h * .6, 0], [w * .4, h, 0], .05 * u, C.wood);
        add(new THREE.CylinderGeometry(.75 * u, .75 * u, w * 2.4, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), L(0, h + .55 * u, 0, 0, 0, 0, 1, .8, 1), C.roof);
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * w * .65, drop = (1.2 + r()) * u, py = h - drop - .8 * u * k, pr = .55 * u * k;
          rod(add, [x, h, 0], [x, h - drop, 0], .03 * u, C.line);
          add(cone(.2 * u, .3 * u, 6).rotateX(Math.PI), L(x, h - drop + .1 * u, 0), C.roof2);
          add(ball(pr, 1), L(x, py, 0, 0, 0, 0, 1, 1.5, 1), i % 2 ? C.roof : C.wall);
          for (const t of [-.5, 0, .5]) add(new THREE.TorusGeometry(pr * Math.sqrt(1 - t * t) * .99, .03 * u, 3, 10).rotateX(Math.PI / 2), L(x, py + t * pr * 1.5, 0), C.roof2);
          add(new THREE.TorusGeometry(.17 * u, .04 * u, 3, 8), L(x, py - .2 * u, pr * .9), C.trim);
          add(dome(.15 * u, 6), L(x, py - .2 * u, pr * .92, Math.PI / 2, 0, 0, 1, 1, .4), lights ? C.window : C.door, lights);
          add(cone(.12 * u, .35 * u, 5).rotateX(Math.PI), L(x, py - pr * 1.5 - .1 * u, 0), C.roof2);
        }
      },
      great(add, k) { this.home(add, k * 2.3); },
      small(add) { add(sunk(cyl(.12 * u, .15 * u, 3.5 * u + SINK, 5)), L(), C.wood); add(ball(.6 * u, 1), L(.5 * u, 2.4 * u, 0, 0, 0, 0, 1, 1.5, 1), C.roof); },
    },
    earthworks: {
      home(add, k) { // a turf barrow on a stone kerb, framed doorway, smoke hole, grass on top
        const len = 4 * u * k, rad = 1.4 * u * k;
        add(new THREE.CylinderGeometry(rad, rad, len, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), L(0, -.1 * u, 0, 0, 0, 0, 1, .85 * tall, 1), C.turf);
        add(sunk(box(rad * 2, SINK, len)), L(), C.turf);
        add(box(rad * 1.9, rad * .8 * tall, .15 * u), L(0, 0, -len / 2), C.wood);
        for (let i = 0; i < 14; i++) { const z = (i / 13 - .5) * len * .98; for (const x of [-1, 1]) add(ball(.2 * u, 0), L(x * rad * .98, .05 * u, z, 0, i, 0, 1, .7, 1.3), (i + x) % 2 ? C.stone : C.stone2); }
        for (let i = 0; i < 10; i++) { const z = (r() - .5) * len * .85, a = (r() - .5) * 2; add(cone(.1 * u, (.3 + r() * .3) * u, 3), L(Math.sin(a) * rad * .85 * .98, Math.cos(a) * rad * .85 * tall * .98 - .1 * u, z, 0, 0, -a * .6), C.leaf); }
        add(cyl(.25 * u, .3 * u, .5 * u, 6), L(0, rad * .85 * tall - .2 * u, -len * .2), C.stone2);
        add(box(1 * u, 1.3 * u * k, .3 * u), L(0, 0, len / 2), C.stone); add(box(.6 * u, .9 * u * k, .06), L(0, 0, len / 2 + .16 * u), C.door);
        add(box(1.5 * u, .25 * u, .45 * u), L(0, 1.3 * u * k, len / 2 + .05 * u), C.stone2);
        for (const x of [-1, 1]) { add(box(.4 * u, .8 * u, .4 * u), L(x * .75 * u, 0, len / 2 + .15 * u), C.stone2); add(box(.12 * u, .9 * u * k, .12 * u), L(x * .38 * u, 0, len / 2 + .2 * u), C.wood); }
        windows(add, u, .7 * u, len / 2 + .2 * u, 1);
        if (r() < .5) add(sunk(box(.4 * u, 1.6 * u * tall + SINK, .3 * u)), L(rad * 1.6, 0, len * .4, 0, .3, .05), C.stone);
      },
      great(add, k) { // a henge of standing stones with lintels
        const rad = 5 * u * k, n = 10;
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, h = 3 * u * tall * k; add(sunk(box(.8 * u, h + SINK, .5 * u)), L(Math.cos(a) * rad, 0, Math.sin(a) * rad, 0, -a), C.stone); if (i % 2 === 0) add(box(.5 * u, .45 * u, rad * .66), L(Math.cos(a + Math.PI / n) * rad, h, Math.sin(a + Math.PI / n) * rad, 0, -a - Math.PI / n), C.stone2); }
        add(box(1.6 * u, .9 * u, 1 * u), L(), C.stone2); add(ring(rad * 1.6, .7 * u, 24), L(0, .2 * u, 0, 0, 0, 0, 1, .8, 1), C.turf);
        if (lights) add(ball(.5 * u), L(0, 1.4 * u, 0), C.window, true);
      },
      small(add) { add(sunk(dome(1.6 * u, 8).scale(1, .55, 1)), L(0, SINK * .4, 0), C.turf); },
    },
    living: {
      home(add, k) { // a shaped-tree dwelling: arching root-ribs woven with walls, a layered canopy, lanterns
        const rad = 1.6 * u * k, h = 2.6 * u * k * tall;
        for (let i = 1; i < 7; i++) { const a = i / 7 * Math.PI * 2 + Math.PI / 2; rod(add, [Math.cos(a) * rad * 1.15, -SINK, Math.sin(a) * rad * 1.15], [Math.cos(a) * rad * .2, h, Math.sin(a) * rad * .2], .16 * u * k, C.wood); }
        add(cyl(rad * .78, rad * .95, h * .75, 7, 1), L(0, 0, 0), C.wall2);
        for (let y = .3; y < .75; y += .15) add(cyl(rad * (.95 - y * .2) * 1.02, rad * (.95 - y * .2) * 1.02, .05 * u, 7), L(0, h * y, 0), C.wood);
        add(box(.75 * u, 1.3 * u, .1 * u), L(0, 0, rad * .85), C.door);
        add(new THREE.TorusGeometry(.42 * u, .07 * u, 3, 8, Math.PI), L(0, 1.3 * u, rad * .87), C.wood);
        for (const x of [-1, 1]) add(dome(.18 * u, 6), L(x * rad * .55, h * .45, rad * .68, Math.PI / 2, x * .6, 0, 1, 1, .4), lights ? C.window : C.door, lights);
        for (let i = 0; i < 6; i++) add(ball((.9 + r() * .5) * u * k, 1), L((r() - .5) * rad * 1.1, h + (r() - .2) * .7 * u, (r() - .5) * rad * 1.1, 0, r() * 6, 0, 1, .75, 1), i % 2 ? C.leaf : C.roof);
        for (let i = 0; i < 2; i++) add(ball((.6 + r() * .3) * u * k, 1), L((r() - .5) * rad * .6, h + 1 * u * k + r() * .4 * u, (r() - .5) * rad * .6, 0, r() * 6, 0, 1, .8, 1), C.leaf);
        for (let i = 0; i < 4; i++) { const a = i * 1.57 + .7; rod(add, [Math.cos(a) * rad, h * .9, Math.sin(a) * rad], [Math.cos(a) * rad, h * .6, Math.sin(a) * rad], .015 * u, C.line); add(ball(.15 * u, 0), L(Math.cos(a) * rad, h * .57, Math.sin(a) * rad, 0, 0, 0, 1, 1.4, 1), lights ? C.window : C.accent, lights); }
      },
      great(add, k) { // a giant shaped tree with arching roots
        const h = 9 * u * k * tall;
        add(sunk(cyl(1 * u * k, 1.8 * u * k, h + SINK, 8)), L(), C.wood);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; rod(add, [Math.cos(a) * 4 * u * k, -SINK, Math.sin(a) * 4 * u * k], [Math.cos(a) * .8 * u, 3 * u * k, Math.sin(a) * .8 * u], .35 * u * k, C.wood); }
        for (let i = 0; i < 9; i++) add(ball((1.8 + r()) * u * k, 1), L((r() - .5) * 6 * u * k, h + (r() - .3) * 2 * u * k, (r() - .5) * 6 * u * k), C.leaf, lights && i % 3 === 0);
      },
      small(add) { add(sunk(cyl(.2 * u, .3 * u, 2 * u + SINK, 5)), L(), C.wood); add(ball(1.3 * u, 1), L(0, 2.4 * u, 0), C.leaf); },
    },
    domes: {
      home(add, k) {
        const rad = 1.5 * u * k, base = .35 * u, top = base + rad * tall;
        footing(add, rad, C.wall); add(cyl(rad, rad * 1.03, base, 14), L(), C.wall2);
        add(dome(rad, 14), L(0, base, 0, 0, 0, 0, 1, tall, 1), C.wall);
        // Ribs over the dome, an arched entry tunnel with a door, a skylight cap, vents.
        for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(rad * 1.01, .05 * u, 4, 14, Math.PI), L(0, base, 0, 0, i * Math.PI / 4, 0, 1, tall, 1), C.trim);
        add(new THREE.TorusGeometry(rad * 1.01, .06 * u, 4, 18).rotateX(Math.PI / 2), L(0, base + rad * tall * .45, 0, 0, 0, 0, .9, 1, .9), C.trim);
        const tr = .55 * u * Math.max(1, k * .8), tl = rad * .7;
        add(new THREE.CylinderGeometry(tr, tr, tl, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), L(0, 0, rad * .75 + tl * .3), C.wall2);
        add(box(tr * 2.1, tr * 1.1, .08 * u), L(0, 0, rad * .75 + tl * .8), C.trim); add(box(tr * 1.2, tr * .95, .1 * u), L(0, 0, rad * .75 + tl * .8 + .02), C.door);
        add(cyl(rad * .22, rad * .26, .2 * u, 10), L(0, top - .05 * u, 0), C.accent);
        if (lights) add(cyl(rad * .17, rad * .17, .05 * u, 10), L(0, top + .15 * u, 0), C.window, true);
        add(cyl(.07 * u, .07 * u, .8 * u, 5), L(rad * .45, base + rad * tall * .7, -rad * .3), C.metal);
        if (r() < .55) { const a = r() < .5 ? 1.6 : -1.6, ar = rad * .55; add(dome(ar, 10), L(Math.sin(a) * rad * .95, base * .5, Math.cos(a) * rad * .95, 0, 0, 0, 1, tall, 1), C.wall2); add(cyl(ar, ar, base * .5, 10), L(Math.sin(a) * rad * .95, 0, Math.cos(a) * rad * .95), C.wall2); }
        if (lights) add(new THREE.TorusGeometry(rad * 1.02, .05 * u, 4, 20).rotateX(Math.PI / 2), L(0, base * .6, 0), C.window, true);
      },
      great(add, k) { this.home(add, k * 2.5); for (let i = 0; i < 4; i++) { const a = i * 1.57 + .7, d = 3.6 * u * k; add(dome(1.4 * u * k, 12), L(Math.cos(a) * d, 0, Math.sin(a) * d), C.wall2); add(new THREE.TorusGeometry(1.42 * u * k, .06 * u, 4, 12, Math.PI), L(Math.cos(a) * d, 0, Math.sin(a) * d, 0, a, 0), C.trim); } },
      small(add) { this.home(add, .85); },
    },
    tracks: { // rollers: wheel-shaped houses
      home(add, k) { // a wheel-shaped house: treaded rim, spokes, a hub with door and window, a cradle
        const rad = 1.7 * u * k, cy = rad + .3 * u;
        add(sunk(box(rad * 1.4, .4 * u + SINK, 1.4 * u * k)), L(), C.wall2);
        for (const s of [-1, 1]) add(box(.18 * u, rad * .7, 1.3 * u * k), L(s * rad * .55, .4 * u, 0, 0, 0, s * .45), C.wall2);
        add(new THREE.TorusGeometry(rad, .5 * u * k, 7, 20), L(0, cy, 0), C.wall);
        for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; add(box(.18 * u, .14 * u, 1.06 * u * k), L(Math.cos(a) * (rad + .48 * u * k), cy + Math.sin(a) * (rad + .48 * u * k), 0, 0, 0, a), C.wall2); }
        for (const z of [-1, 1]) add(new THREE.TorusGeometry(rad - .35 * u * k, .06 * u, 3, 18), L(0, cy, z * .32 * u * k), C.trim);
        add(cyl(.65 * u * k, .65 * u * k, 1.2 * u * k, 12).rotateX(Math.PI / 2).translate(0, 0, -.6 * u * k), L(0, cy, 0), C.wall2);
        add(cyl(.5 * u * k, .5 * u * k, .05, 10).rotateX(Math.PI / 2), L(0, cy, .62 * u * k), lights ? C.window : C.door, lights);
        add(ring(.62 * u * k, .06 * u, 12).rotateX(Math.PI / 2), L(0, cy, .6 * u * k), C.trim);
        for (let i = 0; i < 8; i++) rod(add, [0, cy, 0], [Math.cos(i * .785) * rad, cy + Math.sin(i * .785) * rad, 0], .08 * u, C.wall2);
        add(box(.6 * u, .9 * u, .08), L(0, .4 * u, .6 * u * k + .04), C.door);
        for (let i = 1; i < 4; i++) add(box(.7 * u, .08 * u, .3 * u), L(0, i * .14 * u, .7 * u * k + (4 - i) * .25 * u), C.stone2);
      },
      great(add, k) { // a great loop above a banked ring track
        add(sunk(cyl(7 * u * k, 7 * u * k, SINK, 24)), L(), C.wall2);
        add(new THREE.TorusGeometry(6 * u * k, .5 * u, 5, 28).rotateX(Math.PI / 2), L(0, .6 * u, 0, .15, 0, 0), C.road);
        add(new THREE.TorusGeometry(4.5 * u * k, .5 * u, 6, 24), L(0, 4.8 * u * k, 0), C.wall);
        if (lights) add(new THREE.TorusGeometry(4.5 * u * k, .08 * u, 4, 24), L(0, 4.8 * u * k, .5 * u), C.window, true);
      },
      small(add) { add(sunk(box(1.6 * u, SINK, .9 * u)), L(), C.wall2); add(new THREE.TorusGeometry(1.3 * u, .4 * u, 5, 12), L(0, 1.4 * u, 0), C.wall); },
    },
  };
  const style = K[civ.culture] || K.domes;

  // --- Launch sites, each family its own way -----------------------------------
  const launch = {
    rocket(add) {
      const pad = 5 * u, h = 9 * u * tall;
      add(sunk(cyl(pad, pad * 1.02, .5 + SINK, 16)), L(), C.concrete); add(cyl(pad * .3, pad * .3, .52, 12), L(), C.scorch);
      add(sunk(box(1 * u, h * 1.1 + SINK, 1 * u)), L(pad * .55, 0, 0), C.metal);
      for (let y = 1.5 * u; y < h; y += 2 * u) add(box(1.8 * u, .15 * u, .3 * u), L(pad * .38, y, 0), C.metal2);
      const rr = .75 * u;
      add(cyl(rr, rr, h * .75, 12), L(0, .5, 0), C.hull); add(cyl(rr * 1.01, rr * 1.01, h * .08, 12), L(0, .5 + h * .45, 0), C.accent); add(cone(rr, h * .25, 12), L(0, .5 + h * .75, 0), C.hull);
      for (let i = 0; i < 3; i++) add(box(.12 * u, 1.8 * u, 1.2 * u).translate(0, 0, rr + .5 * u), L(0, .5, 0, 0, i * Math.PI * 2 / 3, 0), C.accent);
    },
    grown(add) { // a grown tower holding a seed-like craft at its tip
      const h = 22 * u * tall;
      add(sunk(cyl(1.3 * u, 3 * u, h + SINK, 8)), L(), C.wall2);
      for (let i = 0; i < 5; i++) add(ring(1.8 * u - i * .2 * u, .3 * u, 10), L(0, h * (.2 + i * .15), 0), C.accent);
      add(ball(1.8 * u, 1), L(0, h + 1.5 * u, 0, 0, 0, 0, 1, 1.8, 1), C.hull); add(ball(.5 * u), L(0, h + 4.5 * u, 0), C.beacon, true);
    },
    cradle(add) { // a giant tripod cradling a craft
      const h = 16 * u * tall;
      for (let i = 0; i < 3; i++) { const a = i * 2.09; rod(add, [Math.cos(a) * 7 * u, -SINK, Math.sin(a) * 7 * u], [Math.cos(a) * 1.4 * u, h, Math.sin(a) * 1.4 * u], .5 * u, C.wood); }
      add(cyl(1.1 * u, 1.1 * u, 7 * u, 10), L(0, h - 3 * u, 0), C.hull); add(cone(1.1 * u, 3 * u, 10), L(0, h + 4 * u, 0), C.accent);
    },
    tether(add) { // an anchor and a line rising out of sight into orbit
      add(sunk(cyl(4 * u, 5 * u, 1.5 * u + SINK, 12)), L(), C.concrete); add(ring(3.4 * u, .4 * u, 14), L(0, 1.5 * u, 0), C.accent);
      rod(add, [0, 1.5 * u, 0], [0, 700, 0], .3 * u, C.line);
      add(cyl(1.2 * u, 1.2 * u, 2.4 * u, 8), L(0, 60, 0), C.hull); add(ring(1.3 * u, .1 * u, 10), L(0, 61.2, 0), C.window, true);
      add(ball(4 * u, 1), L(0, 130, 0, 0, 0, 0, 1.2, .8, 1.2), C.bag);
      for (let y = 20; y < 700; y += 40) add(ball(.4 * u), L(0, y, 0), C.beacon, true);
    },
    silo(add) { // a ringed launch pit; the craft's nose rises out of it
      add(sunk(cyl(5 * u, 6 * u, .6 * u + SINK, 16)), L(), C.wall2); add(ring(4.2 * u, .7 * u, 18), L(0, .6 * u, 0), C.wall);
      add(cyl(3.2 * u, 3.2 * u, .06, 16), L(0, .62 * u, 0), C.scorch);
      add(cyl(1 * u, 1 * u, 4 * u, 12), L(0, .6 * u, 0), C.hull); add(cone(1 * u, 2.4 * u, 12), L(0, 4.6 * u, 0), C.accent);
      add(ring(4.2 * u, .12 * u, 18), L(0, 1.1 * u, 0), C.window, true);
    },
    rail(add, gy) { // a launch rail climbing a tall tower
      const h = 26 * u * tall, run = 26 * u;
      const gt = gy?.(-run, 0) ?? 0; add(sunk(cyl(1.5 * u, 2.2 * u, h - gt + SINK, 7)), L(-run, gt, 0), C.wall);
      const ang = Math.atan2(h, run), len = Math.hypot(h, run);
      add(box(.6 * u, .5 * u, len).translate(0, 0, len / 2), L(0, .3 * u, 0, -ang, -Math.PI / 2, 0), C.metal);
      for (let i = 1; i < 6; i++) { const gy0 = gy?.(-run * i / 6, 0) ?? 0; add(sunk(cyl(.2 * u, .3 * u, Math.max(.2, h * i / 6 - gy0) + SINK, 5)), L(-run * i / 6, gy0, 0), C.metal2); }
      add(cone(.8 * u, 3 * u, 8), L(-run * .3, h * .3 + 1.2 * u, 0, 0, 0, Math.PI / 2 - ang), C.hull);
      add(ball(.5 * u), L(-run, h + .6 * u, 0), C.beacon, true);
    },
    track(add, gy) { // a long ramp that throws craft upward
      const run = 60 * u, h = 16 * u * tall, ang = Math.atan2(h, run), len = Math.hypot(run, h);
      add(box(2.2 * u, .7 * u, len).translate(0, 0, len / 2), L(0, .2 * u, 0, -ang, 0, 0), C.metal);
      for (let i = 1; i < 8; i++) { const gy0 = gy?.(0, run * i / 8) ?? 0; add(sunk(box(.6 * u, Math.max(.2, h * i / 8 - gy0) + SINK, .6 * u)), L(0, gy0, run * i / 8), C.metal2); }
      add(box(1.6 * u, 1.2 * u, 4 * u), L(0, .9 * u, 4 * u, -ang, 0, 0), C.hull);
      for (let i = 0; i < 12; i++) add(box(2.4 * u, .1 * u, .3 * u), L(0, .95 * u + (len * i / 12) * Math.sin(ang), (len * i / 12) * Math.cos(ang)), C.window, true);
    },
  }[{ hands: orbital ? 'rocket' : 'none', tentacles: 'grown', tripods: 'cradle', drifters: 'tether', hive: 'silo', web: 'silo', burrowers: 'silo', nests: 'rail', grazers: 'track', rollers: 'track' }[civ.family]];

  // --- The spaceport ---------------------------------------------------------
  // Each civilization's own ship design (ships.js) on a paved apron: the main ship stands
  // in a launch tower (hulls that launch upright) or rests level beside a hangar; smaller
  // shuttles on marked pads; a control tower. Other families also keep their own
  // launcher (a tether, a silo, a rail, a ramp, a grown tower) beside it.
  const ship = level >= 5 ? shipDesign(shipCiv) : null, shipScale = u * (ship && !ship.stands ? 1.5 : .9); // level hulls are low, so build them bigger
  // The apron is flat but the world is round: its rim stands R0² / 2R above the ground.
  // On small worlds the whole spaceport (apron, ships, towers) is built smaller so the
  // rim never lifts more than PORT_DROP metres, and the apron's skirt reaches down to it.
  const portR0 = ship ? Math.max(16 * u, shipSize(ship).radius * shipScale * 4) : 0;
  const portK = ship ? Math.min(1, Math.sqrt(2 * radius * PORT_DROP) / portR0) : 1;
  // Pads [x, z, size]: the main ship stands on the first; shuttles fly from FLYING_PADS.
  const PADS = [[0, 0, 1], [portR0 * .58, portR0 * .3, .55], [-portR0 * .5, portR0 * .42, .55], [portR0 * .1, -portR0 * .62, .55]], FLYING_PADS = [1, 2, 3];
  const spaceport = (rawAdd) => {
    const k = portK, S = new THREE.Matrix4().makeScale(k, k, k);
    const add = (g, m, ...rest) => rawAdd(g, S.clone().multiply(m), ...rest);
    const sz = shipSize(ship), R0 = portR0, drop = (R0 * k) ** 2 / (2 * radius);
    rawAdd(sunk(cyl(R0 * k, R0 * k * 1.02, .3 * k + SINK + relief + drop, 28)).translate(0, -relief - drop, 0), L(), C.concrete);
    PADS.forEach(([x, z, k], i) => {
      const pr = Math.max(3.2 * u, sz.radius * shipScale * k * 1.6);
      add(cyl(pr, pr, .32, 20), L(x, 0, z), C.pad);
      add(new THREE.TorusGeometry(pr * .82, .08 * u, 3, 24).rotateX(Math.PI / 2), L(x, .36, z), C.window, true);
      if (k < 1 && !FLYING_PADS.includes(i)) buildShip(THREE, ship, add, L(x, .32, z, 0, (x + z) % 6, 0), shipScale * k); // the others are out flying (see flights)
    });
    // The main ship and what holds it.
    buildShip(THREE, ship, add, L(0, .32, 0, 0, .4, 0), shipScale);
    const H = sz.height * shipScale;
    if (ship.stands) { // a lattice launch tower with access arms
      const tx = sz.radius * shipScale * 1.4 + 1.2 * u;
      for (const [dx, dz] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) add(sunk(box(.22 * u, H * 1.05 + SINK, .22 * u)), L(tx + dx * 1.6 * u, 0, dz * 1.6 * u), C.metal);
      for (let y = 1.2 * u; y < H; y += 1.6 * u) add(box(1.9 * u, .12 * u, 1.9 * u), L(tx, y, 0), C.metal2);
      for (const y of [H * .45, H * .8]) add(box(tx - sz.radius * shipScale * .8, .2 * u, .5 * u), L(tx / 2 + sz.radius * shipScale * .4, y, 0), C.metal);
      add(ball(.25 * u), L(tx, H * 1.08, 0), C.beacon, true);
    } else { // an arched hangar beside the ship, open at one end and lit inside
      const hw = Math.max(5 * u, sz.radius * shipScale * 1.1), hl = hw * 2.2, hx = -R0 * .55, hz = -R0 * .25;
      add(new THREE.CylinderGeometry(hw, hw, hl, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), L(hx, 0, hz, 0, .5, 0), C.wall);
      add(new THREE.CylinderGeometry(hw * .985, hw * .985, hl, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).scale(-1, 1, 1), L(hx, 0, hz, 0, .5, 0), C.wall2); // its inside
      add(new THREE.CircleGeometry(hw * .98, 16, 0, Math.PI).rotateY(-Math.PI / 2), L(hx, 0, hz, 0, .5, 0).multiply(L(-hl / 2, 0, 0)), C.wall2);
      for (let i = 0; i < 5; i++) add(new THREE.TorusGeometry(hw * 1.01, .12 * u, 4, 16, Math.PI).rotateY(Math.PI / 2), L(hx, 0, hz, 0, .5, 0).multiply(L((i / 4 - .5) * hl, 0, 0)), C.metal);
      add(new THREE.CircleGeometry(hw * .9, 16, 0, Math.PI).rotateY(-Math.PI / 2), L(hx, 0, hz, 0, .5, 0).multiply(L(-hl / 2 + .3 * u, 0, 0)), C.window, true);
    }
    // Control tower: a stalk with a lit, glazed cab.
    const ct = [R0 * .75, 0, -R0 * .55], th = 11 * u * tall;
    add(sunk(cyl(.6 * u, .9 * u, th + SINK, 8)), L(ct[0], 0, ct[2]), C.wall2);
    add(cyl(1.6 * u, 1.2 * u, 1.4 * u, 10), L(ct[0], th, ct[2]), C.window, true);
    add(cyl(1.8 * u, 1.8 * u, .25 * u, 10), L(ct[0], th + 1.4 * u, ct[2]), C.wall);
    add(ball(.2 * u), L(ct[0], th + 2 * u, ct[2]), C.beacon, true);
  };
  let spaceportAt = null, spaceportBase = null;
  const fieldsAt = []; // where the fields are (for previews and tests)
  const spaceportFoot = ship ? Math.max(17 * u, shipSize(ship).radius * shipScale * 4.2) * portK : 0;
  const launchFoot = { rocket: 5.5, grown: 3.5, cradle: 7.5, tether: 5.5, silo: 6.5, rail: 4, track: 4 }[{ hands: 'rocket', tentacles: 'grown', tripods: 'cradle', drifters: 'tether', hive: 'silo', web: 'silo', burrowers: 'silo', nests: 'rail', grazers: 'track', rollers: 'track' }[civ.family]] * u;

  // --- The settlement network (settlements.mjs) -------------------------------
  // The capital stands beside the landing site; places within DETAIL metres are built
  // in full (streets, plots, landmarks), the rest of the world's towns as simple
  // clusters with night lights. Builders' herds move into the places near the site.
  const aloft = civ.family === 'drifters';
  const net = networkFor(body, civ, terrain, { colony: !!civ.colony });
  if (!net.capital) return none;
  const DETAIL = 230;
  const siteV = signalNormal.clone();
  const places = net.settlements.map(s => ({ ...s, v: V(...s.n) }));
  // The capital and up to three more places near the site are built in full.
  const near = [places[0], ...places.slice(1).filter(s => s.v.angleTo(siteV) * radius - s.radius < DETAIL).slice(0, 3)], far = places.filter(s => !near.includes(s));
  // Builders' herds move into the places within walking range (never out to a distant capital).
  // (Giants build on a larger scale, so their capital may stand a little farther out.)
  near.filter(s => s.v.angleTo(siteV) * radius < (s === places[0] ? 300 : 220)).forEach((s, i) => { if (homes[i]) homes[i].copy(s.v); });
  for (const s of near) sites.push(s.v.clone());
  const SIZE = { camp: .45, village: .7, colony: .8, town: .95, city: 1.2, metropolis: 1.55, capital: 1.75, megacity: 2.1 };

  // Ground laid along the terrain: streets, roads and plazas are strips and discs whose
  // every vertex sits on the ground (a little above it), so they follow every slope.
  const groundPoint = (n, lift) => { if (terrain.isLiquid(n)) return null; return n.clone().multiplyScalar(radius + terrain.surface(n) + lift); };
  // Streets, roads and plazas: resampled about every metre along and in three lanes
  // across, every vertex on the ground plus a lift, so the land never shows through.
  const resample = (points, step) => {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) { const a = points[i], b = points[i + 1], n = Math.max(1, Math.ceil(a.angleTo(b) * radius / step)); for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, k / n).normalize()); }
    if (points.length) out.push(points.at(-1).clone());
    return out;
  };
  const LANES = [-1, -1 / 3, 1 / 3, 1];
  const strip = (points0, width, colour, lift = .2, into = ground, step = 1.4) => {
    if (points0.length > 1 && into === ground) paths.push(resample(points0, 3).filter((n) => !terrain.isLiquid(n))); // for walking along (fauna-mesh.js)
    if (into === ground && ground.count() > GROUND_BUDGET) return;
    const points = resample(points0, step), pos = [], lanes = width > 2.2 && step < 2 ? LANES : [-1, 0, 1];
    let prev = null;
    for (let i = 0; i < points.length; i++) {
      const n = points[i], nxt = points[Math.min(i + 1, points.length - 1)], prv = points[Math.max(i - 1, 0)];
      const along = nxt.clone().sub(prv); along.addScaledVector(n, -along.dot(n));
      if (along.lengthSq() < 1e-14) { prev = null; continue; }
      const side = n.clone().cross(along.normalize()).multiplyScalar(width / 2 / radius);
      const row = lanes.map(t => groundPoint(n.clone().addScaledVector(side, t).normalize(), lift));
      const cur = row.every(Boolean) ? row : null;
      if (cur && prev) for (let j = 0; j < lanes.length - 1; j++) pos.push(...prev[j].toArray(), ...prev[j + 1].toArray(), ...cur[j].toArray(), ...prev[j + 1].toArray(), ...cur[j + 1].toArray(), ...cur[j].toArray());
      prev = cur;
    }
    if (pos.length) into.add(flatGeometry(pos), new THREE.Matrix4(), colour);
  };
  const disc = (centre, rad, colour, lift = .18, into = ground) => {
    const f = frameAt(centre), pos = [], rings = Math.min(10, Math.max(4, Math.ceil(rad / 1.2))), segs = Math.min(56, Math.max(18, Math.ceil(rad * Math.PI * 2 / 1.4))), /* (the ground under towns is levelled, so a coarse disc lies flat on it) */ pt = (d, a) => groundPoint(pointAt(f, d, a), lift);
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
      const d0 = rad * i / rings, d1 = rad * (i + 1) / rings, a0 = j / segs * Math.PI * 2, a1 = (j + 1) / segs * Math.PI * 2;
      const p00 = pt(d0, a0), p01 = pt(d0, a1), p10 = pt(d1, a0), p11 = pt(d1, a1);
      if (!p00 || !p01 || !p10 || !p11) continue;
      pos.push(...p00.toArray(), ...p11.toArray(), ...p10.toArray(), ...p00.toArray(), ...p01.toArray(), ...p11.toArray());
    }
    if (pos.length) into.add(flatGeometry(pos), new THREE.Matrix4(), colour);
  };
  const paved = level >= 3, walkers = WALKERS.includes(civ.family);
  const streetColour = paved ? C.road : C.path, streetWidth = (paved ? 2.4 : 1.5) * Math.min(u, 1.6);

  // A place near the site, grown rather than stamped: a centre (gathering place or
  // great structure on a plaza), streets winding outward, buildings on plots along
  // them that are bigger and taller toward the core, landmarks in the core of cities,
  // a ring road in big cities, fields beyond the edge, and a spaceport for capitals.
  const foot = (k) => 2 * u * k * (civ.culture === 'terraced' ? 1.2 : 1);
  // (chimneys smoke from some homes on cold worlds)
  const home = (k) => Object.assign((add, gy) => { const own = varied(add); style.home(own, k); yard(own, gy, foot(k), k); flair(own, gy, foot(k), k); if (clime.cold > .4 && civ.hearths && smokeFrom.length < 18 && r() < .3) smokeFrom.push({ local: [foot(k) * .3, 2.9 * u * k * tall, -foot(k) * .2], at: null, k: .45 }); }, { found: true, dwelling: k }), great = (k) => Object.assign((add) => style.great(add, k), { found: true });
  // --- What each path builds ----------------------------------------------------
  // Beyond homes, every town of village builders and up shows what its people care about
  // (civilizations.mjs path): granaries and mills, a temple and wayside shrines, an
  // observatory and a hall of records, a market round the square and warehouses, a wall
  // with gates where the streets run out and watchtowers, or a founders' monument.
  const smokeFrom = []; // tops of smokestacks (industrial), where smoke rises from in update()
  const P = {
    forge(add) { // a stone forge: a squat hall, a tall chimney, a furnace glowing in its mouth, an anvil outside
      const w = 3 * u, d = 2.4 * u, h = 1.9 * u * tall;
      add(sunk(box(w, h + SINK, d)), L(), C.stone); gable(add, w * 1.05, d * 1.15, h);
      add(sunk(box(.9 * u, h * 2.1 + SINK, .9 * u)), L(w * .3, 0, -d * .25), C.stone2);
      add(box(1.1 * u, .9 * u, .1), L(-w * .15, 0, d * .5 + .01), C.door); add(box(.8 * u, .55 * u, .05), L(-w * .15, .1 * u, d * .5 + .06), C.ember, true);
      add(box(.6 * u, .45 * u, .3 * u), L(w * .25, 0, d * .5 + .9 * u), C.stone2); add(box(.75 * u, .18 * u, .32 * u), L(w * .25, .45 * u, d * .5 + .9 * u), C.metal);
      smokeFrom.push({ local: [w * .3, h * 2.1, -d * .25], at: null, k: .6 });
    },
    factory: Object.assign((add) => { // a long hall under saw-tooth roofs, with banded smokestacks
      const w = 9 * u, d = 6 * u, h = 3 * u * tall, teeth = 4;
      add(sunk(box(w, h + SINK, d)), L(), C.wall2);
      for (let i = 0; i < teeth; i++) { const x = (i + .5) / teeth * w - w / 2; add(new THREE.CylinderGeometry(0, d * .5, w / teeth, 3, 1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, .9, 1), L(x, h + d * .22, 0, 0, Math.PI / 2, 0), C.roof); if (lights) add(box(.1, d * .2, d * .9), L(x - w / teeth * .45, h + d * .1, 0), C.window, true); }
      for (let i = 0; i < 2 + (r() < .5 ? 1 : 0); i++) {
        const x = (i - .5) * 2.4 * u, z = -d * .3, sh = (9 + r() * 4) * u * tall;
        add(cyl(.55 * u, .8 * u, sh, 10), L(x, 0, z), civ.material === 'wood' || civ.material === 'adobe' ? '#9b6a55' : civ.material === 'ice' ? C.metal2 : mixC(C.stone2, C.accent, .2)); // brick, steel or stone, by what this world builds with
        for (let y = sh * .7; y < sh; y += sh * .12) add(cyl(.6 * u, .6 * u, sh * .05, 10), L(x, y, z), C.trim);
        add(ball(.14 * u, 0), L(x, sh + .1 * u, z), C.beacon, 'blink');
        smokeFrom.push({ local: [x, sh, z], at: null, k: 1 });
      }
      windows(add, w, h * .55, d / 2 + .02, 6);
    }, { found: 'always' }),
    waterTower(add) { const h = 7 * u * tall; for (let i = 0; i < 4; i++) { const a = i * 1.571 + .785; rod(add, [Math.cos(a) * 1.4 * u, -SINK, Math.sin(a) * 1.4 * u], [Math.cos(a) * .9 * u, h, Math.sin(a) * .9 * u], .1 * u, C.metal, false, 4); } add(cyl(1.6 * u, 1.6 * u, 2.2 * u, 12), L(0, h, 0), C.metal2); add(cone(1.7 * u, .9 * u, 12), L(0, h + 2.2 * u, 0), C.metal); },
    granary(add) { for (let i = 0; i < 3; i++) { const x = (i - 1) * 1.5 * u, h = (3.2 + (i % 2) * .8) * u * tall; add(sunk(cyl(.7 * u, .7 * u, h + SINK, 12)), L(x, 0, 0), level >= 3 ? C.metal2 : C.wall); add(cone(.78 * u, .8 * u, 12), L(x, h, 0), C.roof); for (let y = .9 * u; y < h; y += 1.1 * u) add(cyl(.72 * u, .72 * u, .08 * u, 12), L(x, y, 0), C.wall2); } },
    windmill(add) {
      const h = 6 * u * tall; add(sunk(cyl(.9 * u, 1.4 * u, h + SINK, 8)), L(), C.wall); add(cone(1.1 * u, 1.4 * u, 8), L(0, h, 0), C.roof);
      for (let i = 0; i < 4; i++) add(box(.5 * u, 3.6 * u, .06 * u).translate(0, 1.9 * u, 0), L(0, h - .3 * u, 1.2 * u, 0, 0, i * 1.571 + .3), i % 2 ? '#efe6d4' : C.accent);
      add(box(.6 * u, 1 * u, .1), L(0, 0, 1.3 * u), C.door);
    },
    temple: (k) => Object.assign((add) => {
      const w = 4.5 * u * k, h = 3.4 * u * k * tall;
      for (let i = 0; i < 3; i++) add(sunk(box(w * (1.5 - i * .15), .5 * u * k + (i ? 0 : SINK), w * (1.9 - i * .15))), L(0, i * .5 * u * k, 0), i % 2 ? C.stone2 : C.stone);
      const y0 = 1.5 * u * k;
      for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) add(cyl(.22 * u * k, .26 * u * k, h, 8), L(sx * w * .55, y0, (i / 5 - .5) * w * 1.35), C.trim);
      add(box(w * .8, h * .95, w * 1.1), L(0, y0, -w * .05), C.wall);
      add(box(w * 1.25, .4 * u * k, w * 1.6), L(0, y0 + h, 0), C.stone);
      if (['domes', 'shells', 'coral', 'burrows', 'rings'].includes(civ.culture)) add(dome(w * .55, 14), L(0, y0 + h + .4 * u * k, 0), C.accent);
      else gable(add, w * 1.6, w * 1.3, y0 + h + .4 * u * k);
      add(box(w * .3, h * .7, .1 * u), L(0, y0, w * .51), C.door);
      for (const sx of [-1, 1]) { add(sunk(cyl(.07 * u, .07 * u, h * 1.6 + SINK, 4)), L(sx * w * .9, 0, w * 1.05), C.wood); add(box(.05 * u, h * .6, .7 * u * k), L(sx * w * .9, h * .9, w * 1.05 + .35 * u * k), C.accent); if (lights) add(ball(.25 * u, 1), L(sx * w * .55, y0 + .1, w * .95), C.flame, true); }
    }, { found: 'always' }),
    shrine(add) { add(sunk(box(1.1 * u, 1.1 * u + SINK, .9 * u)), L(), C.stone); add(cone(.85 * u, 1.1 * u, 4), L(0, 1.1 * u, 0, 0, Math.PI / 4, 0), C.accent); add(box(.4 * u, .5 * u, .05), L(0, .3 * u, .46 * u), C.door); if (lights) add(ball(.12 * u, 0), L(0, .5 * u, .5 * u), C.flame, true); },
    observatory: Object.assign((add) => {
      const rad = 2.4 * u, h = 3.2 * u * tall, az = r() * 6.28;
      add(sunk(cyl(rad, rad * 1.05, h + SINK, 14)), L(), C.wall); add(cyl(rad * 1.04, rad * 1.04, .3 * u, 14), L(0, h, 0), C.trim);
      add(dome(rad, 14), L(0, h + .3 * u, 0, 0, az, 0), level >= 3 ? C.metal2 : C.wall2);
      add(box(.7 * u, rad * 1.02, rad * 2.02).translate(0, rad * .5, 0), L(0, h + .3 * u, 0, 0, az, 0), C.door);
      add(cyl(.35 * u, .45 * u, 2.8 * u, 8).rotateX(-.75), L(0, h + .9 * u, 0, 0, az, 0), C.metal);
      add(box(.8 * u, 1.6 * u, .1), L(0, 0, rad * 1.01), C.door); if (lights) add(box(.5 * u, .4 * u, .05), L(rad * .7, h * .6, rad * .72, 0, .8, 0), C.window, true);
    }, { found: 'always' }),
    library(add) {
      const w = 5 * u, d = 3 * u, h = 2.6 * u * tall;
      add(sunk(box(w * 1.1, .4 * u + SINK, d * 1.4)), L(), C.stone); add(box(w, h, d), L(0, .4 * u, -d * .15), C.wall);
      for (let i = 0; i < 7; i++) add(cyl(.18 * u, .2 * u, h, 8), L((i / 6 - .5) * w * .95, .4 * u, d * .52), C.trim);
      add(box(w * 1.06, .35 * u, d * 1.35), L(0, .4 * u + h, 0), C.stone); gable(add, w * 1.06, d * 1.35, .75 * u + h);
      windows(add, w, h * .5 + .4 * u, d * .36 - .1, 4);
    },
    stall(add) {
      const c1 = pick(C.accent, C.accent2, '#d8a03a', '#4a8fc9');
      for (const [px, pz] of [[-1, -.6], [1, -.6], [-1, .6], [1, .6]]) add(sunk(box(.09 * u, 1.9 * u + SINK, .09 * u)), L(px * u, 0, pz * u), C.wood);
      for (let i = 0; i < 6; i++) add(box(.36 * u, .06 * u, 1.5 * u), L((i - 2.5) * .36 * u, 2 * u, 0, .12, 0, 0), i % 2 ? '#f2ede4' : c1);
      add(box(2 * u, .8 * u, .7 * u), L(0, 0, .2 * u), C.wood);
      for (let i = 0; i < 4; i++) add(ball(.18 * u, 0), L((i - 1.5) * .4 * u, .9 * u, .2 * u), pick(C.crop, C.accent2, '#d06a3a'));
      if (lights) add(ball(.1 * u, 0), L(0, 1.8 * u, .5 * u), C.window, true);
    },
    warehouse(add, gy) { const w = 4 * u, l = 7 * u, h = 2.6 * u * tall; add(sunk(box(w, h + SINK, l)), L(), C.wall2); gable(add, l * 1.04, w * 1.12, h); for (const z of [-1, 1]) add(box(1.6 * u, 1.9 * u, .08), L(0, 0, z * l * .5), C.door); },
    watchtower(add) {
      const h = 7 * u * tall, w = 1.1 * u;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(add, [x * w, -SINK, z * w], [x * w * .7, h, z * w * .7], .12 * u, level >= 3 ? C.stone2 : C.wood, false, 4);
      add(box(w * 2.2, .25 * u, w * 2.2), L(0, h, 0), C.wood); for (let i = 0; i < 4; i++) add(box(w * 2.2, .9 * u, .1 * u), L(0, h, w * 1.1, 0, i * 1.571, 0), level >= 3 ? C.stone : C.wood);
      add(cone(w * 1.8, 1.4 * u, 4), L(0, h + 1.9 * u, 0, 0, Math.PI / 4, 0), C.roof);
      add(sunk(cyl(.04 * u, .04 * u, 2 * u + SINK, 3)), L(0, h + 2.9 * u, 0), C.wood); add(box(.04 * u, .5 * u, .8 * u), L(0, h + 4.2 * u, .4 * u), C.accent);
      if (lights) add(ball(.2 * u, 1), L(0, h + .7 * u, 0), C.flame, true);
    },
    wall: (len) => Object.assign((add, gy) => {
      const gl = (x) => gy?.(x, 0) ?? 0;
      if (level === 2) { for (let x = -len / 2; x <= len / 2; x += .45 * u) add(sunk(cone(.2 * u, 2.4 * u + SINK, 5)), L(x, gl(x), 0), C.wood); return; }
      const h = (level >= 5 ? 2.6 : 2) * u * Math.min(1.25, tall), c = level >= 5 ? C.metal2 : C.stone;
      for (const x of [-len / 4, len / 4]) add(sunk(box(len / 2 + .05, h + SINK + 1.2, .9 * u)).translate(0, -1.2, 0), L(x, gl(x), 0), c);
      for (let x = -len / 2 + .4 * u; x < len / 2; x += .9 * u) add(box(.45 * u, .5 * u, .95 * u), L(x, gl(x) + h, 0), c);
      if (level >= 5) add(box(len, .14 * u, .05), L(0, gl(0) + h * .8, .47 * u), C.window, true);
    }, { found: false }),
    monument(add) {
      add(sunk(box(2.4 * u, .8 * u + SINK, 2.4 * u)), L(), C.stone);
      const h = 9 * u * tall;
      add(cone(.7 * u, h, 4), L(0, .8 * u, 0, 0, Math.PI / 4, 0), level >= 4 ? C.metal2 : C.stone2);
      for (let i = 0; i < 2; i++) add(new THREE.TorusGeometry(1.4 * u + i * .5 * u, .07 * u, 3, 20), L(0, h * (.45 + i * .15), 0, 1.2 - i * .5, i, 0), C.accent);
      add(ball(.3 * u, 1), L(0, h + 1 * u, 0), lights ? C.window : C.accent, lights);
    },
  };
  // --- The same institutions in every builder's own idiom ---------------------------
  // P above is the version for those who build with stone, timber, adobe, ice or glass.
  // Those who grow, secrete or spin their homes build the same things their own way
  // (IDIOMS), and each body family sets them on its own kind of ground (mounted): fliers
  // raise them on perches, drifters hang them under gas-bags, burrowers sink them into
  // mounds. Q(name, ...args) gives the right piece.
  const idiom = civ.material === 'wax' ? 'wax' : civ.material === 'silk' ? 'silk' : civ.material === 'membrane' ? 'membrane' : ['grown', 'living', 'shell'].includes(civ.material) ? 'grown' : 'built';
  const mountKind = civ.family === 'nests' ? 'perch' : civ.family === 'drifters' ? 'float' : civ.family === 'burrowers' || ['mounds', 'trapdoor', 'burrows'].includes(civ.culture) ? 'sunk' : 'ground';
  const bulb = (add, x, y, z, rw, rh, c, glowing = false) => add(new THREE.SphereGeometry(rw, 10, 7).scale(1, rh / rw, 1), L(x, y + rh, z), c, glowing);
  const cell = (add, x, y, z, w, h, c) => add(y ? cyl(w, w, h, 6) : sunk(cyl(w, w, h + SINK, 6)), L(x, y, z), c);
  const strand = (add, a, b) => rod(add, a, b, .025 * u, C.line === '#3a3330' ? mixC(C.wall, '#ffffff', .4) : C.line, false, 3);
  const vats = (add, n, shape) => { // a cluster of vessels joined by pipes, venting smoke: grown, secreted or spun works
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283, x = Math.cos(a) * 2.6 * u, z = Math.sin(a) * 2.6 * u, h = (2.4 + (i % 2)) * u * tall;
      if (shape === 'cell') { cell(add, x, 0, z, 1.3 * u, h, i % 2 ? C.wall : C.wall2); add(new THREE.CircleGeometry(1.05 * u, 6).rotateX(-Math.PI / 2), L(x, h + .02, z), C.ember, true); }
      else if (shape === 'cone') { add(sunk(cone(1.5 * u, h * 1.4 + SINK, 9)), L(x, 0, z), i % 2 ? C.wall : C.wall2); }
      else bulb(add, x, -.4 * u, z, 1.4 * u, h * .6, i % 2 ? C.wall : C.wall2);
      rod(add, [x, h * .5, z], [0, 1.5 * u, 0], .2 * u, C.wall2, false, 5);
    }
    add(sunk(cyl(.7 * u, .9 * u, 7 * u * tall + SINK, 8)), L(), C.wall2); add(cyl(.75 * u, .75 * u, .5 * u, 8), L(0, 6.5 * u * tall, 0), C.accent);
    smokeFrom.push({ local: [0, 7 * u * tall, 0], at: null, k: 1 });
  };
  const IDIOMS = {
    grown: {
      temple: (k) => Object.assign((add) => { // a great swelling bulb with a glowing heart, ringed by grown pillars
        for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; add(sunk(cone(.45 * u * k, 5 * u * k * tall + SINK, 6)), L(Math.cos(a) * 4.4 * u * k, 0, Math.sin(a) * 4.4 * u * k, Math.sin(a) * .15, 0, -Math.cos(a) * .15), C.accent2); }
        bulb(add, 0, -.5 * u, 0, 3.2 * u * k, 3.4 * u * k * tall, C.wall); bulb(add, 0, 5.2 * u * k * tall, 0, 1.7 * u * k, 1.9 * u * k * tall, C.wall2);
        add(new THREE.SphereGeometry(1.1 * u * k, 10, 7), L(0, 2.6 * u * k * tall, 3.1 * u * k * .82), C.window, true);
        add(new THREE.TorusGeometry(3.25 * u * k, .14 * u, 3, 20).rotateX(Math.PI / 2), L(0, 2.8 * u * k * tall, 0), C.accent, lights);
      }, { found: 'always' }),
      shrine(add) { add(sunk(cone(.25 * u, 1.6 * u + SINK, 6)), L(), C.accent2); bulb(add, 0, 1.4 * u, 0, .45 * u, .55 * u, C.wall); add(ball(.2 * u, 1), L(0, 1.95 * u, .35 * u), C.window, lights); },
      granary(add) { for (let i = 0; i < 4; i++) bulb(add, (i % 2 - .5) * 2 * u, -.3 * u, (Math.floor(i / 2) - .5) * 2 * u, 1 * u, 1.5 * u * tall, i % 2 ? C.wall : C.wall2); },
      observatory: Object.assign((add) => { // a great eye: a bulb on a stalk with a glowing lens turned to the sky
        add(sunk(cyl(.8 * u, 1.3 * u, 4 * u * tall + SINK, 8)), L(), C.wall2); bulb(add, 0, 3.4 * u * tall, 0, 2 * u, 1.7 * u, C.wall);
        add(new THREE.CircleGeometry(1.2 * u, 16), L(0, 5.4 * u * tall, .9 * u, -1.1, 0, 0), C.window, true);
      }, { found: 'always' }),
      library(add) { for (let i = 0; i < 3; i++) bulb(add, (i - 1) * 2.8 * u, -.4 * u, 0, 1.7 * u, 1.9 * u * tall, i === 1 ? C.wall : C.wall2); for (let i = 0; i < 6; i++) add(ball(.22 * u, 0), L((i - 2.5) * 1.3 * u, 1.4 * u, 1.55 * u), C.window, lights); },
      stall(add) { bulb(add, 0, -.2 * u, 0, 1.2 * u, .9 * u, C.wall); add(box(1.4 * u, .5 * u, .1), L(0, .3 * u, 1.05 * u), C.door); for (let i = 0; i < 3; i++) add(ball(.18 * u, 0), L((i - 1) * .4 * u, .2 * u, 1.3 * u), pick(C.crop, C.accent2)); },
      warehouse(add) { add(new THREE.SphereGeometry(1, 12, 7).scale(2.2 * u, 1.6 * u * tall, 4 * u), L(0, .6 * u, 0), C.wall2); },
      watchtower(add) { add(sunk(cone(1.1 * u, 9 * u * tall + SINK, 7)), L(), C.wall2); bulb(add, 0, 7 * u * tall, 0, 1.3 * u, 1.1 * u, C.wall); add(ball(.2 * u, 1), L(0, 9.4 * u * tall, 0), C.flame, lights); },
      wall: (len) => Object.assign((add, gy) => { for (let x = -len / 2; x <= len / 2; x += .55 * u) add(sunk(cone(.3 * u, (1.6 + r()) * u + SINK, 5)), L(x, gy?.(x, 0) ?? 0, (r() - .5) * .4 * u, (r() - .5) * .4, 0, (r() - .5) * .4), r() < .5 ? C.leaf : C.accent2); }, { found: false }), // a thorn hedge
      monument(add) { let y = 0, w = 1.2 * u; for (let i = 0; i < 7; i++) { add(new THREE.TorusGeometry(w, w * .35, 5, 12).rotateX(Math.PI / 2), L(i * .15 * u, y, 0, 0, i * .6, 0), i % 2 ? C.wall : C.accent2); y += w * .7; w *= .82; } add(cone(w, 1.5 * u, 8), L(0, y, 0), C.accent); },
      forge(add) { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; add(ball(.45 * u, 0), L(Math.cos(a) * 1.4 * u, .1, Math.sin(a) * 1.4 * u), C.stone2); } add(cyl(1.1 * u, 1.1 * u, .12, 10), L(0, .05, 0), C.ember, true); smokeFrom.push({ local: [0, .3 * u, 0], at: null, k: .6 }); },
      factory: Object.assign((add) => vats(add, 4, 'bulb'), { found: 'always' }),
      waterTower(add) { add(sunk(cyl(.4 * u, .7 * u, 6 * u * tall + SINK, 7)), L(), C.wall2); bulb(add, 0, 5.4 * u * tall, 0, 1.7 * u, 1.4 * u, C.wall); },
    },
    wax: {
      temple: (k) => Object.assign((add) => { // a great waxen cell crowned by a glowing royal cell, small cells round it
        cell(add, 0, 0, 0, 3 * u * k, 6 * u * k * tall, C.wall);
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + .52; cell(add, Math.cos(a) * 4.6 * u * k, 0, Math.sin(a) * 4.6 * u * k, 1.4 * u * k, 3 * u * k * tall, C.wall2); }
        add(cyl(1.6 * u * k, 1.9 * u * k, 2.6 * u * k, 6), L(0, 6 * u * k * tall, 0), C.accent); add(new THREE.CircleGeometry(1.4 * u * k, 6).rotateX(-Math.PI / 2), L(0, 8.62 * u * k * tall, 0), C.window, true);
      }, { found: 'always' }),
      shrine(add) { cell(add, 0, 0, 0, .6 * u, 1.3 * u, C.wall); add(new THREE.CircleGeometry(.45 * u, 6).rotateX(-Math.PI / 2), L(0, 1.32 * u, 0), C.window, lights); },
      granary(add) { for (let i = 0; i < 7; i++) { const a = i / 6 * 6.283, d = i ? 1.6 * u : 0; cell(add, Math.cos(a) * d, 0, Math.sin(a) * d, .9 * u, (2.4 + (i % 3) * .5) * u * tall, C.wall); add(cyl(.92 * u, .92 * u, .2 * u, 6), L(Math.cos(a) * d, (2.4 + (i % 3) * .5) * u * tall, Math.sin(a) * d), mixC(C.wall, '#ffcf6a', .4)); } },
      observatory: Object.assign((add) => { cell(add, 0, 0, 0, 1.6 * u, 6 * u * tall, C.wall2); add(new THREE.CircleGeometry(1.3 * u, 16), L(0, 6.05 * u * tall, 0, -Math.PI / 2 + .5, 0, 0), C.window, true); }, { found: 'always' }),
      library(add) { for (let i = 0; i < 9; i++) cell(add, (i % 3 - 1) * 1.7 * u, 0, (Math.floor(i / 3) - 1) * 1.5 * u, .85 * u, (1.6 + (i % 2) * .6) * u * tall, i % 2 ? C.wall : C.wall2); },
      stall(add) { cell(add, 0, 0, 0, 1 * u, 1.4 * u, C.wall2); add(box(1.2 * u, .7 * u, .1), L(0, .3 * u, .85 * u), C.door); },
      warehouse(add) { for (let i = 0; i < 6; i++) cell(add, (i % 3 - 1) * 1.8 * u, 0, (Math.floor(i / 3) - .5) * 1.6 * u, .95 * u, 2.6 * u * tall, C.wall2); },
      watchtower(add) { cell(add, 0, 0, 0, 1 * u, 8 * u * tall, C.wall2); add(cyl(1.4 * u, 1.1 * u, 1 * u, 6), L(0, 8 * u * tall, 0), C.wall); add(ball(.2 * u, 1), L(0, 9.2 * u * tall, 0), C.flame, lights); },
      wall: (len) => Object.assign((add, gy) => { for (let x = -len / 2 + .5 * u; x < len / 2; x += 1 * u) cell(add, x, gy?.(x, 0) ?? 0, 0, .55 * u, 2.2 * u * tall, C.wall2); }, { found: false }),
      monument(add) { cell(add, 0, 0, 0, .9 * u, 9 * u * tall, C.wall); add(cone(.9 * u, 1.6 * u, 6), L(0, 9 * u * tall, 0), C.accent); },
      forge(add) { add(dome(1.6 * u, 8), L(), C.wall2); add(box(.7 * u, .5 * u, .1), L(0, .2 * u, 1.55 * u), C.ember, true); smokeFrom.push({ local: [0, 1.6 * u, 0], at: null, k: .6 }); },
      factory: Object.assign((add) => vats(add, 5, 'cell'), { found: 'always' }),
      waterTower(add) { cell(add, 0, 0, 0, .5 * u, 6 * u * tall, C.wall2); add(cyl(1.5 * u, 1.5 * u, 2 * u, 6), L(0, 6 * u * tall, 0), C.wall); },
    },
    silk: {
      temple: (k) => Object.assign((add) => { // a silk cathedral: a soaring cone on poles, strands fanning to the ground, a glowing core
        const H = 9 * u * k * tall, R = 4 * u * k;
        add(new THREE.ConeGeometry(R, H, 10, 1, true).translate(0, H / 2, 0), L(0, .8 * u, 0), C.wall);
        for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; add(sunk(cyl(.08 * u, .1 * u, H * .6 + SINK, 4)), L(Math.cos(a) * R * .95, 0, Math.sin(a) * R * .95), C.wood); strand(add, [0, H + .8 * u, 0], [Math.cos(a) * R * 2, 0, Math.sin(a) * R * 2]); }
        add(new THREE.SphereGeometry(1.2 * u * k, 10, 7), L(0, H * .4, 0), C.window, true);
      }, { found: 'always' }),
      shrine(add) { add(new THREE.ConeGeometry(.8 * u, 1.8 * u, 7, 1, true).translate(0, .9 * u, 0), L(), C.wall); for (let i = 0; i < 4; i++) strand(add, [0, 1.8 * u, 0], [Math.cos(i * 1.57) * 1.6 * u, 0, Math.sin(i * 1.57) * 1.6 * u]); add(ball(.15 * u, 0), L(0, .5 * u, 0), C.window, lights); },
      granary(add) { add(box(4 * u, .15 * u, .15 * u), L(0, 3 * u * tall, 0), C.wood); for (const x of [-1.9, 1.9]) add(sunk(cyl(.08 * u, .08 * u, 3 * u * tall + SINK, 4)), L(x * u, 0, 0), C.wood); for (let i = 0; i < 5; i++) { const x = (i - 2) * .8 * u; strand(add, [x, 3 * u * tall, 0], [x, 2.2 * u * tall, 0]); add(new THREE.SphereGeometry(.4 * u, 8, 6).scale(1, 1.4, 1), L(x, 1.6 * u * tall, 0), C.wall); } },
      observatory: Object.assign((add) => { // a great web strung in a ring of poles, tilted to the sky: their radio dish
        for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; add(sunk(cyl(.1 * u, .12 * u, (3 + Math.sin(a) * 1.5) * u * tall + SINK, 4)), L(Math.cos(a) * 3 * u, 0, Math.sin(a) * 3 * u), C.wood); }
        add(new THREE.CircleGeometry(3 * u, 16), L(0, 3 * u * tall, 0, -Math.PI / 2 + .45, 0, 0), C.wall);
        for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; strand(add, [0, 3 * u * tall, 0], [Math.cos(a) * 3 * u, (3 + Math.sin(a) * 1.5) * u * tall, Math.sin(a) * 3 * u]); }
        add(ball(.25 * u, 1), L(0, 3.2 * u * tall, 0), C.window, true);
      }, { found: false }),
      library(add) { add(new THREE.CylinderGeometry(3 * u, 3 * u, 6 * u, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), L(0, 0, 0), C.wall); for (let i = 0; i < 4; i++) add(box(.15 * u, 1.4 * u, 2.4 * u), L((i - 1.5) * 1.2 * u, 0, 0), C.wood); },
      warehouse(add) { add(new THREE.ConeGeometry(3.5 * u, 3.2 * u * tall, 8, 1, true).translate(0, 1.6 * u * tall, 0), L(0, .6 * u, 0), C.wall); for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(.6 * u, 7, 5), L(Math.cos(i) * 1.6 * u, .5 * u, Math.sin(i) * 1.6 * u), C.wall2); },
      watchtower(add) { add(sunk(cyl(.15 * u, .2 * u, 8 * u * tall + SINK, 4)), L(), C.wood); add(new THREE.ConeGeometry(1.4 * u, 1.6 * u, 7, 1, true), L(0, 8 * u * tall, 0), C.wall); for (let i = 0; i < 3; i++) strand(add, [0, 8 * u * tall, 0], [Math.cos(i * 2.09) * 4 * u, 0, Math.sin(i * 2.09) * 4 * u]); },
      wall: (len) => Object.assign((add, gy) => { for (const x of [-len / 2, len / 2]) add(sunk(cyl(.07 * u, .07 * u, 2.4 * u + SINK, 4)), L(x, gy?.(x, 0) ?? 0, 0), C.wood); for (let h = .5; h < 2.4; h += .45) strand(add, [-len / 2, (gy?.(-len / 2, 0) ?? 0) + h * u, 0], [len / 2, (gy?.(len / 2, 0) ?? 0) + h * u, 0]); }, { found: false }), // a web fence
      monument(add) { add(sunk(cyl(.12 * u, .15 * u, 9 * u * tall + SINK, 4)), L(), C.wood); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; strand(add, [0, 9 * u * tall, 0], [Math.cos(a) * 3 * u, 0, Math.sin(a) * 3 * u]); add(box(.04 * u, 2.4 * u, .8 * u), L(Math.cos(a) * .5 * u, 6 * u * tall, Math.sin(a) * .5 * u, 0, -a, 0), C.accent); } },
      forge(add) { IDIOMS.wax.forge(add); for (let i = 0; i < 4; i++) strand(add, [0, 1.6 * u, 0], [Math.cos(i * 1.57) * 2.5 * u, 0, Math.sin(i * 1.57) * 2.5 * u]); },
      factory: Object.assign((add) => vats(add, 4, 'cone'), { found: 'always' }),
      waterTower(add) { IDIOMS.silk.granary(add); },
    },
  };
  IDIOMS.membrane = { ...IDIOMS.grown }; // drifters' grown gas-ships and lanterns read as grown things, hung aloft by their mount
  // Each family's ground: perches for fliers, gas-bags for drifters, mounds for burrowers.
  function mounted(build) {
    if (mountKind === 'ground') return build;
    const wrapped = (add, gy) => {
      if (mountKind === 'sunk') { // dug in: an earth bank round it, the piece set down into it
        add(new THREE.TorusGeometry(3.4 * u, 1.1 * u, 5, 16).rotateX(Math.PI / 2).scale(1, .55, 1), L(0, -.2 * u, 0), C.soil);
        const n0 = smokeFrom.length; build((g, m, c, b) => add(g, L(0, -.6 * u, 0).multiply(m), c, b), gy); for (const sm of smokeFrom.slice(n0)) sm.local[1] -= .6 * u; return;
      }
      const lift = (mountKind === 'perch' ? 5 : 7) * u * tall, R = 3.2 * u;
      if (mountKind === 'perch') { add(sunk(cyl(.45 * u, .7 * u, lift + SINK, 7)), L(), C.wood); for (let i = 0; i < 3; i++) rod(add, [0, lift * .55, 0], [Math.cos(i * 2.09) * R * .9, lift, Math.sin(i * 2.09) * R * .9], .12 * u, C.wood, false, 4); }
      else { add(sunk(cyl(.6 * u, .8 * u, .8 * u + SINK, 6)), L(), C.stone2); strand(add, [0, .8 * u, 0], [0, lift, 0]); add(new THREE.SphereGeometry(R * 1.1, 12, 8).scale(1, .7, 1), L(0, lift + 7 * u * tall, 0), C.bag); for (let i = 0; i < 4; i++) strand(add, [Math.cos(i * 1.57) * R * .9, lift, Math.sin(i * 1.57) * R * .9], [Math.cos(i * 1.57) * R * .8, lift + 5.6 * u * tall, Math.sin(i * 1.57) * R * .8]); }
      add(cyl(R, R * .95, .3 * u, 14), L(0, lift - .3 * u, 0), C.wood);
      const n0 = smokeFrom.length; build((g, m, c, b) => add(g, L(0, lift, 0).multiply(m), c, b), () => 0); for (const sm of smokeFrom.slice(n0)) sm.local[1] += lift;
    };
    return Object.assign(wrapped, { found: false });
  }
  const Q = (name, ...args) => { const own = IDIOMS[idiom]?.[name] ?? P[name]; return mounted(typeof own === 'function' && args.length ? own(...args) : own); };
  function pathPlaces(f, s, big, isCapital, plaza, Rm, lines) {
    if (level < 2 || s.kind === 'camp' || civ.colony || lit.count() > NEAR_BUDGET * 1.05) return;
    const a0 = r() * 6.28, edge = (k = 1) => Rm * (.85 + r() * .2) * k;
    switch (civ.path) {
      case 'agrarian':
        settle(f, edge(1.05), a0, 2.6 * u, 5 * u, Q('granary'), { spacing: .7 });
        if (level <= 4 && idiom === 'built' && mountKind === 'ground') settle(f, edge(1.25), a0 + 2, 1.8 * u, 8 * u, P.windmill, { face: false, spacing: .7 });
        if (!civ.fields) for (let i = 0; i < Math.round(1 + big * 3); i++) settle(f, Rm + (4 + r() * 8) * u, r() * 6.28, 4, .2, civ.family === 'hands' ? common.fencedField : common.field, { spacing: .9 });
        break;
      case 'devotional':
        settle(f, plaza + 6 * u * big, a0, 4.6 * u * Math.max(.7, big * .7), 6 * u, Q('temple', Math.max(.7, big * .7)), { spacing: .8 });
        for (const pts of lines.slice(0, 4)) { const end = pts.at(-1); if (end) settle(f, end.d + 3 * u, end.a, 1 * u, 2 * u, Q('shrine'), { spacing: .6 }); }
        break;
      case 'scholarly':
        settle(f, edge(1.1), a0, 2.8 * u, 5 * u, Q('observatory'), { face: false, spacing: .7 });
        if (level >= 3) settle(f, plaza + 5 * u, a0 + 3, 3.6 * u, 4 * u, Q('library'), { spacing: .8 });
        break;
      case 'mercantile':
        for (let i = 0, n = Math.round(4 + big * 4); i < n; i++) settle(f, plaza * .75 + 1.5 * u, i / n * 6.283, 1.3 * u, 2 * u, Q('stall'), { spacing: .55 });
        if (level >= 3) settle(f, edge(1.05), a0, 4.5 * u, 4 * u, Q('warehouse'), { spacing: .7 });
        break;
      case 'martial': {
        if (level <= 4 && (mountKind === 'ground' || mountKind === 'sunk')) { // a wall round the town, with gates where the streets run out (fliers and drifters keep watch instead)
          const Rw = Rm * 1.04 + 3 * u, seg = 3.2 * u, gate = streetWidth * .9 + 1.5 * u;
          const gates = lines.map(pts => pts.reduce((b, p) => Math.abs(p.d - Rw) < Math.abs(b.d - Rw) ? p : b, pts[0])?.a).filter(x => x !== undefined);
          let i = 0;
          for (let a = 0; a < 6.283 - seg / Rw * .5; a += seg / Rw, i++) {
            if (gates.some(g => Math.abs(((a - g + 9.42) % 6.283) - 3.14) < gate / Rw)) continue;
            if (i % 7 === 0) settle(f, Rw, a, 1.4 * u, 9 * u, Q('watchtower'), { face: false, spacing: .3 });
            else place(f, Rw, a, seg * .5, 3 * u, Q('wall', seg), { spacing: .25, faceTo: f.home });
          }
        } else settle(f, edge(1.1), a0, 1.6 * u, 9 * u, Q('watchtower'), { face: false, spacing: .7 });
        break;
      }
      default: // expansionist
        settle(f, plaza + 3 * u, a0, 1.4 * u, 10 * u, Q('monument'), { face: false, spacing: .7 });
    }
  }
  function grow(s) {
    currentPlace = s; litPlaces.add(s.id);
    const f = frameAt(s.v), big = SIZE[s.kind], Rm = s.radius, isCapital = s === places[0];
    if (level === 1 || s.kind === 'camp') { // a camp: a hearth, shelters, cairns
      if (civ.hearths) settle(f, 1.5 * u, r() * 6, 1.1 * u, .3, common.hearth);
      for (let i = 0, n = 2 + Math.floor(r() * 2); i < n; i++) settle(f, (3.5 + r() * 3) * u, i / n * 6.28 + r(), foot(.5), 2 * u, home(.5), { aloft });
      for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) settle(f, (8 + r() * 6) * u, r() * 6.28, .7 * u, 2 * u, common.cairn, { face: false });
      return;
    }
    const plaza = Math.min(Rm * .2, 9 * u);
    // Hand-builders' places are laid out and built by town-plan.mjs / town-build.js (units, below): here only what stands round them.
    let lines = [];
    if (!handsTowns) {
    if (walkers) disc(s.v, paved ? Rm * .98 : plaza + 1.5 * u, paved ? C.plaza : C.path, paved ? .3 : .18); // cities are paved right across
    if (megacity && isCapital) { settle(f, 0, 0, 9.5 * u, 80 * u, arcology(big * .5), { face: false }); skyline = Math.max(skyline, 70 * u * big * .5 * Math.min(1.3, tall) * 1.3 + 10 * u); }
    else settle(f, 0, 0, Math.max(2, 4.2 * u * big * (isCapital ? 1 : .7)), 6 * u, great(big * (isCapital ? .95 : .65)), { face: false, aloft });
    if (civ.hearths && level <= 3) settle(f, plaza * .8, r() * 6, 1.1 * u, .3, common.hearth);
    // Streets: from the plaza edge outward, wandering a little.
    const streets = Math.max(3, Math.min(8, Math.round(2.5 + civ.cohesion * 2 + big * 1.6)));
    lines = [];
    // Planet-shapers and up plan their cities: a grid of straight streets (the plots below line them).
    if (level >= 4) {
      const a0 = r() * Math.PI, pitch = Math.max(18 * u, streetWidth + 14 * u), K = Math.ceil(Rm / pitch);
      for (const axis of [0, 1]) for (let k = -K; k <= K; k++) {
        const off = k * pitch, half = Math.sqrt(Math.max(0, Rm * Rm - off * off));
        if (half < pitch * .6) continue;
        for (const dir of [-1, 1]) { // each street from the middle outward, so plots sort by distance
          const pts = [];
          for (let t = Math.max(0, Math.sqrt(Math.max(0, plaza * plaza - off * off))); t <= half; t += 3 * u) {
            const x = axis ? off : dir * t, z = axis ? dir * t : off, d = Math.hypot(x, z), a = Math.atan2(z, x) + a0;
            pts.push({ d, a, n: pointAt(f, d, a) });
          }
          if (pts.length > 2) lines.push(pts);
        }
      }
    }
    for (let i = 0; i < (level >= 4 ? 0 : streets); i++) {
      let a = i / streets * Math.PI * 2 + r() * .5, d = plaza;
      const pts = [];
      while (d < Rm) { pts.push({ d, a, n: pointAt(f, d, a) }); d += 3 * u; a += (r() - .5) * .22 * (6 * u / Math.max(d, 6 * u)); }
      lines.push(pts);
    }
    // A ring road through the middle of big places.
    if (big >= 1.15 && level < 4) { const rr = Rm * .55, pts = []; for (let a = 0; a <= Math.PI * 2 + .01; a += 2.5 * u / rr) pts.push({ d: rr, a, n: pointAt(f, rr, a), ring: true }); lines.push(pts); }
    if (walkers) for (const pts of lines) strip(pts.map(p => p.n), streetWidth * (pts[0]?.ring ? 1.1 : 1), streetColour);
    // Plots along the streets, both sides; core first so the best spots go to the biggest buildings.
    const plots = [];
    for (const pts of lines) for (let i = 1; i < pts.length; i++) for (const side of [-1, 1]) plots.push({ ...pts[i], side, ring: pts[0].ring, prev: pts[i - 1].n, next: pts[Math.min(i + 1, pts.length - 1)].n });
    plots.sort((x, y) => x.d - y.d);
    let landmarks = 0;
    for (const p of plots) {
      if (lit.count() > NEAR_BUDGET * (isCapital ? .8 : 1)) break;
      const t = p.d / Rm, core = t < .35;
      let k = (.85 + big * .45) * (1 - t * .45) * (.9 + r() * .2);
      const landmark = level >= 3 && core && landmarks < Math.round(big * 3) && r() < .35;
      if (landmark) k = big * .42;
      const fp = landmark ? Math.max(2, 4.2 * u * k) : foot(k), off = streetWidth / 2 + fp + .6 * u;
      // Stand beside the street, facing it.
      const along = p.next.clone().sub(p.prev); along.addScaledVector(p.n, -along.dot(p.n));
      if (along.lengthSq() < 1e-14) continue;
      const sideV = p.n.clone().cross(along.normalize()).multiplyScalar(p.side * off / radius);
      const n = p.n.clone().add(sideV).normalize();
      if (r() < .12 && !landmark && !core) continue; // gaps: gardens and yards
      // System-shapers: the core is a skyline, tallest at the centre.
      if (megacity && t < (isCapital ? (urban ? 1.01 : .66) : big >= 1.1 ? .42 : 0)) {
        const kt = .8 + r() * .45, H = Math.min(95 * u, (isCapital ? 52 : 30) * u * (1.05 - t) * (.55 + r() * .65) * (landmark ? 1.45 : 1)) * Math.max(.45, Math.min(1, radius / 1200)), tf = 2.35 * u * kt;
        const on = p.n.clone().add(sideV.clone().multiplyScalar((streetWidth / 2 + tf + .6 * u) / off)).normalize();
        if (place(f, 0, 0, tf, H, tower(kt, H), { at: on, faceTo: p.n })) skyline = Math.max(skyline, H * 1.25 + 6 * u);
        if (t < .5) { const H2 = H * (.45 + r() * .3), back = p.n.clone().add(sideV.clone().multiplyScalar((streetWidth / 2 + tf * 3.3 + 1.4 * u) / off)).normalize(); if (place(f, 0, 0, tf, H2, tower(kt * .9, H2), { at: back, faceTo: p.n })) skyline = Math.max(skyline, H2 * 1.25 + 6 * u); }
        continue;
      }
      // Those who reach space live in modern buildings, low towers of their own idiom, not huts.
      const modern = level >= 5 && !landmark, Hm = (7 + r() * 9) * u * (1.15 - t * .5);
      if (place(f, 0, 0, modern ? Math.max(fp, 2.6 * u * k) : fp, modern ? Hm : (landmark ? 8 : 4) * u, landmark ? great(k) : modern ? tower(k * .95, Hm) : home(k * (lights && core ? 1.2 : 1)), { aloft, at: n, faceTo: p.n }) && landmark) landmarks++;
      // Cities fill their blocks: a second row of buildings behind the first.
      if (big >= 1.1 && !landmark && t < .85) {
        const k2 = k * .85, fp2 = foot(k2), back = p.n.clone().add(sideV.clone().multiplyScalar((off + fp + fp2 + .8 * u) / off)).normalize();
        if (level >= 5) { const H2 = (6 + r() * 7) * u; place(f, 0, 0, Math.max(fp2, 2.4 * u * k2), H2, tower(k2 * .9, H2), { aloft, at: back, faceTo: p.n }); }
        else place(f, 0, 0, fp2, 4 * u, home(k2), { aloft, at: back, faceTo: p.n });
      }
    }
    pathPlaces(f, s, big, isCapital, plaza, Rm, lines);
    // Street lamps for those that light their world; small props for those with hands.
    if (walkers && streetLights) for (const pts of lines) for (let i = 2; i < pts.length - 1 && lit.count() < NEAR_BUDGET * 1.08; i += 3) {
      const p = pts[i], along = pts[i + 1].n.clone().sub(pts[i - 1].n); along.addScaledVector(p.n, -along.dot(p.n));
      if (along.lengthSq() < 1e-14) continue;
      const side = (i / 3) % 2 ? 1 : -1, n = p.n.clone().add(p.n.clone().cross(along.normalize()).multiplyScalar(side * (streetWidth / 2 + .45 * u) / radius)).normalize();
      place(f, 0, 0, .3 * u, 2.7 * u, common.light, { at: n, faceTo: p.n, spacing: .3 });
    }
    if (civ.family === 'hands') for (let i = 0; i < Math.round(big * 8) && lit.count() < NEAR_BUDGET * 1.1; i++) settle(f, (plaza + r() * (Rm - plaza)), r() * 6.28, .6 * u, .8 * u, common.crates, { spacing: .6 });
    }
    // Fields beyond the edge, fenced by those with hands.
    if (civ.fields) for (let i = 0, n = Math.round(2 + big * 4); i < n && lit.count() < NEAR_BUDGET * 1.1; i++) if (settle(f, Rm + (4 + r() * 10) * u, r() * 6.28, 4, .2, civ.family === 'hands' ? common.fencedField : common.field, { spacing: .9 })) fieldsAt.push(placed.at(-1).n.clone());
    // The capital's spaceport; radio dishes and beacons for spacefarers.
    if (isCapital && (level >= 5 || orbital)) {
      // The spaceport needs a big, fairly flat, dry apron: search all round the capital, then farther out.
      const a0 = r() * 6.28;
      search: for (const [wet, top] of [[false, SINK * 2.5], [false, SINK + spaceportFoot * .5], [true, SINK * 2.5]]) for (const extra of [4, 14, 28, 46]) for (let j = 0; j < 14; j++) {
        // Last resort on ocean worlds: an offshore platform.
        if (ship && place(f, Rm + spaceportFoot + extra * u, a0 + j / 14 * Math.PI * 2, spaceportFoot, 2 * u, spaceport, { face: true, wet, top })) { spaceportAt = placed.at(-1).n.clone(); spaceportBase = placed.at(-1).base; break search; }
      }
      if (launch) settle(f, Rm + spaceportFoot * 2 + 14 * u, r() * 6.28, launchFoot, 12 * u, Object.assign((add, gy) => launch(add, gy), { found: civ.family === 'nests' || civ.family === 'grazers' || civ.family === 'rollers' ? false : 'always' }), { face: false });
    }
    if (level >= 5 || orbital) for (let i = 0; i < Math.round(big * 2); i++) settle(f, Rm * (.6 + r() * .4), r() * 6.28, 2 * u, 5 * u, common.dish, { spacing: .8 });
    // Metalworkers' forges; industrial factories with smoking stacks and a water tower.
    if (metalworkers || (level === 3 && !industrial && r() < .4)) for (let i = 0; i < (isCapital ? 2 : 1); i++) settle(f, Rm * (.55 + r() * .4), r() * 6.28, 2.2 * u, 4 * u, Q('forge'), { spacing: .7 });
    if (industrial) { for (let i = 0, n = isCapital ? 3 : big >= 1 ? 2 : 1; i < n; i++) settle(f, Rm + (5 + r() * 8) * u, r() * 6.28, 6 * u, 14 * u, Q('factory'), { spacing: .7 }); settle(f, Rm * .9, r() * 6.28, 1.8 * u, 9 * u, Q('waterTower'), { face: false, spacing: .7 }); }
    if (level >= 4 && (isCapital || big >= 1.1)) settle(f, Rm * (.7 + r() * .3), r() * 6.28, 1.9 * u, 14 * u, common.mast, { face: false, spacing: .8 });
  }
  for (const s of urban ? [places[0]] : near) grow(s);
  currentPlace = null;

  // Roads between places: laid along the ground near the site (walkers pave theirs once
  // they build cities; before that they are earth tracks). Tool users mark trails with stones.
  const placeOf = new Map(places.map(s => [s.id, s]));
  // Planned towns (units, below) are joined by a road wherever two of them are near
  // enough: winding a little, as roads do, round water, from one town's edge to the other's.
  const ROAD_MAX = 2600, roadSeen = 3200;
  if (handsTowns && level >= 2 && (walkers || level <= 3)) for (const road of net.roads) {
    const a = placeOf.get(road.a), b = placeOf.get(road.b), d = a.v.angleTo(b.v) * radius;
    if (!a || !b || d > ROAD_MAX || Math.min(a.v.angleTo(siteV), b.v.angleTo(siteV)) * radius > roadSeen) continue;
    const rr = rng(body.seed, 'road', road.a, road.b), amp = Math.min(d * .07, 60), k1 = 1 + Math.floor(rr() * 2), ph1 = rr() * 6.28;
    const side = a.v.clone().cross(b.v).normalize(), pts = [], step = 4, near = (n) => n.angleTo(siteV) * radius < 900;
    const flush = () => { if (pts.length > 1) { const close = pts.some(near); strip(pts, (level >= 3 ? 1.1 : .8) * streetWidth, level >= 3 && paved ? streetColour : C.path, .3, ground, close ? 2 : 5); } pts.length = 0; };
    for (let s0 = a.radius * .92; s0 <= d - b.radius * .92; s0 += step) {
      const t = s0 / d, off = Math.sin(t * Math.PI * k1 + ph1) * Math.sin(t * Math.PI) * amp;
      const n = a.v.clone().lerp(b.v, t).normalize().addScaledVector(side, off / radius).normalize();
      if (terrain.isLiquid(n)) { flush(); continue; }
      pts.push(n);
    }
    flush();
  }
  for (const road of handsTowns ? [] : net.roads) {
    const a = placeOf.get(road.a), b = placeOf.get(road.b), d = a.v.angleTo(b.v) * radius;
    if (!walkers && level > 1) continue; // fliers, drifters, burrowers and hives need no roads
    const pts = [];
    for (let s = a.radius * .85; s <= d - b.radius * .85; s += (level === 1 ? 11 * u : 2.2)) {
      const n = a.v.clone().lerp(b.v, s / d).normalize();
      if (n.angleTo(siteV) * radius > DETAIL + 120) { if (pts.length > 1 && level > 1) strip(pts, streetWidth * 1.2, streetColour); pts.length = 0; continue; }
      if (level === 1) place({ ...frameAt(n), home: n }, 1.6 * u, 0, .5 * u, 2 * u, common.marker, { face: false });
      else pts.push(n);
    }
    if (pts.length > 1) strip(pts, streetWidth * 1.2, streetColour);
  }

  // The rest of the world: towns as simple clusters (their night lights are drawn
  // from space for every world by city-lights.js).
  const cluster = { camp: 2, village: 4, colony: 5, town: 7, city: 12, metropolis: 18, capital: 18, megacity: 24 };
  // Towns you can walk or fly to get full dwellings with yards; distant ones the simple form.
  const farBy = far.map(s => ({ s, dist: s.v.angleTo(siteV) * radius })).sort((a, b) => a.dist - b.dist);
  // Towns of city builders and up that you can walk or fly to are planned: paved, on a
  // grid of streets, with a building on each lot facing its street, tallest at the middle.
  const plannedTowns = [];
  function plannedTown(s) {
    const f = frameAt(s.v), Rm = s.radius, a0 = r() * Math.PI, sw = streetWidth;
    const pt = (x, z) => pointAt(f, Math.hypot(x, z), Math.atan2(z, x) + a0);
    if (walkers) disc(s.v, Rm * .98, paved ? C.plaza : C.path, .3);
    const lot = level >= 5 ? 7 * u : 5.5 * u, pitch = sw + lot * 2 + 1.2 * u, K = Math.ceil(Rm / pitch);
    // The streets: a grid through the middle.
    for (const axis of [0, 1]) for (let k = -K; k <= K; k++) {
      const pts = [], off = k * pitch, half = Math.sqrt(Math.max(0, Rm * Rm - off * off));
      if (half < pitch * .5) continue;
      for (let t = -half; t <= half; t += 2.5 * u) pts.push(axis ? pt(off, t) : pt(t, off));
      if (walkers && ground.count() < GROUND_BUDGET * .8) strip(pts, sw, streetColour); else if (pts.length > 1) paths.push(pts);
    }
    // The lots: a building in each corner of a block, facing the nearer street.
    let placedHere = 0;
    for (let i = -K; i < K; i++) for (let j = -K; j < K; j++) for (const [cx, cz] of [[.25, .25], [.75, .25], [.25, .75], [.75, .75]]) {
      if (lit.count() > BUDGET * .82) return;
      const x = (i + cx) * pitch, z = (j + cz) * pitch, d = Math.hypot(x, z);
      if (d > Rm * .92 || d < lot) continue; // the middle is a square
      const fx = cx < .5 ? i * pitch : (i + 1) * pitch, fz = cz < .5 ? j * pitch : (j + 1) * pitch;
      const face = Math.abs(x - fx) < Math.abs(z - fz) ? pt(fx, z) : pt(x, fz);
      const t = d / Rm, k = (.85 + r() * .25) * (1.1 - t * .3);
      if (level >= 5) { const H = (8 + 16 * (1 - t)) * u * (.7 + r() * .6); place(f, 0, 0, Math.min(lot * .8, 2.6 * u * k), H, tower(k, H), { at: pt(x, z), faceTo: face, spacing: .5, aloft }); }
      else place(f, 0, 0, Math.min(lot * .8, foot(k)), 4 * u, home(k), { at: pt(x, z), faceTo: face, spacing: .5, aloft });
      placedHere++;
    }
    if (placedHere) plannedTowns.push(s);
  }
  for (const { s, dist } of urban || handsTowns ? [] : farBy) { // (a city world's city is built below instead)
    const f = frameAt(s.v), full = dist < 900;
    if (lit.count() >= BUDGET) break;
    currentPlace = s; litPlaces.add(s.id);
    if (full && level >= 3 && lit.count() < BUDGET * .8) { plannedTown(s); continue; }
    for (let i = 0, n = cluster[s.kind] || 4; i < n && lit.count() < BUDGET; i++) {
      const d = i ? Math.sqrt(r()) * s.radius * .75 : 0, k = .8 + r() * .3;
      if (full && lit.count() < BUDGET * .88) { if (level >= 5) { const Hf = (6 + r() * 10) * u; place(f, d, r() * 6.28, 2.6 * u * k, Hf, tower(k, Hf), { face: true, spacing: .7, aloft }); } else place(f, d, r() * 6.28, foot(k), 4 * u, home(k), { face: true, spacing: .7, aloft }); }
      else place(f, d, r() * 6.28, 2.2 * u, 0, Object.assign((add) => { if (level >= 5) { const h = (5 + r() * 9) * u; add(sunk(box(2.4 * u, h + SINK, 2.4 * u)), L(), r() < .5 ? C.wall : C.wall2); add(box(1.4 * u, .4 * u, 1.4 * u), L(0, h, 0), C.trim); } else style.small(add); if (lights) add(null, L(0, 1.2 * u, 0, 0, 0, 0, u, u, u), C.window, 'light'); }, { found: true }), { face: true, spacing: .45, aloft }); // spacefarers' distant towns are modern too
    }
  }
  currentPlace = null;
  // Night lights for the whole world are drawn from space by city-lights.js (system-view.js).

  // --- Hand-builders' places: planned (town-plan.mjs) and built (town-build.js) -----------
  // Every town is a unit, and on a city world the city is cut into district cells on one
  // grid (so their streets meet). Each unit is built in full near you and as its masses far
  // off, from the same plan, and swapped as you come and go (follow), a unit at a time.
  const units = [], doorsteps = [];
  const NEAR_D = coarse ? 260 : 380, FAR_D = 2600, DATA_D = 1500;
  if (handsTowns) {
    const kit = makeKit(THREE, { C, u, level, culture: civ.culture, rng: (seed) => rng(body.seed, 'lot', seed) });
    const cosOf = (m) => Math.cos(m / radius);
    const frameOn = (centre, a0) => {
      const east = V(0, 1, 0).cross(centre); if (east.lengthSq() < 1e-6) east.set(1, 0, 0).cross(centre); east.normalize();
      const north = centre.clone().cross(east).normalize(), e1 = east.clone().multiplyScalar(Math.cos(a0)).addScaledVector(north, Math.sin(a0)), e2 = centre.clone().cross(e1).normalize();
      const at = (x, z) => { const d = Math.hypot(x, z); if (d < 1e-6) return centre.clone(); const a = d / radius; return centre.clone().multiplyScalar(Math.cos(a)).addScaledVector(e1, x / d * Math.sin(a)).addScaledVector(e2, z / d * Math.sin(a)).normalize(); };
      return { centre, at };
    };
    const blockedAt = (n, rr) => terrain.isLiquid(n) || (Number.isFinite(terrain.sea) && terrain.height(n) < terrain.sea + .4) || n.dot(landingNormal) > cosOf(30 + rr) || n.dot(signalNormal) > cosOf(18 + rr) || placed.some((p) => !p.road && n.dot(p.n) > cosOf(p.foot + rr));
    // Towns (outside a city world's city).
    for (const s of places) {
      if (urban && urban.mask(s.v) > .5) continue;
      const fr = frameOn(s.v, r() * Math.PI), seed = `${body.seed}:${s.id}`;
      units.push({ kind: 'town', place: s, fr, n: s.v, R: s.radius, detail: null, group: null,
        planOf: () => planTown({ seed, radius: s.radius, level, u, path: civ.path, capital: s === places[0], sw: streetWidth, avoid: (x, z, rr) => blockedAt(fr.at(x, z), rr) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => blockedAt(fr.at(x + a * rr, z + b * rr), 0)) }) });
    }
    // A city world's city: district cells on one grid round the capital.
    if (urban) {
      const fr = frameOn(places[0].v, r() * Math.PI), U = Math.max(.7, u), pitch = (level >= 5 ? 34 : 28) * U + streetWidth, CS = pitch * 4;
      const Rc = radius * Math.PI * .97, N = Math.ceil(Rc / CS);
      const inside = (x, z) => { const n = fr.at(x, z); return urban.mask(n) > .5 && !blockedAt(n, 0); };
      for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) {
        const x = (i + .5) * CS, z = (j + .5) * CS, d = Math.hypot(x, z);
        if (d > Rc) continue;
        const n = fr.at(x, z);
        if (urban.mask(n) < .45 || terrain.isLiquid(n)) continue;
        units.push({ kind: 'cell', fr, n, R: CS * .72, detail: null, group: null,
          planOf: () => planDistrict({ seed: `${body.seed}:cell:${i}:${j}`, x0: i * CS, z0: j * CS, x1: (i + 1) * CS, z1: (j + 1) * CS, level, u, path: civ.path, sw: streetWidth, inside, heart: (x, z) => Math.hypot(x, z) / (Math.min(Rc, 900)) }) });
      }
    }
    units.sort((a, b) => a.n.angleTo(siteV) - b.n.angleTo(siteV));
    // The ground frame of a lot: its centre on the world, facing its street.
    const lotFrame = (fr, x, z, ang) => {
      const n = fr.at(x, z), ax = fr.at(x + 1, z).sub(fr.at(x - 1, z)); ax.addScaledVector(n, -ax.dot(n)).normalize();
      const az = n.clone().cross(ax); // the plan's +z, on the world
      const fwd = ax.clone().multiplyScalar(Math.cos(ang)).addScaledVector(az, Math.sin(ang)).normalize(), right = n.clone().cross(fwd).normalize();
      return { n, fwd, right };
    };
    const lotBase = (unit, l) => {
      const { n, fwd, right } = lotFrame(unit.fr, l.x, l.z, l.ang);
      let hi = terrain.surface(n);
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const m = n.clone().addScaledVector(fwd, a * l.d / 2 / radius).addScaledVector(right, b * l.w / 2 / radius).normalize(); hi = Math.max(hi, terrain.surface(m)); }
      return { n, fwd, right, base: new THREE.Matrix4().makeBasis(right, n, fwd).setPosition(n.clone().multiplyScalar(radius + hi)), groundR: radius + hi };
    };
    // A few civilizations build in plain blocks (town-build.js); the rest in their own way (cultureLot).
    const blocks = civ.family === 'hands' && level >= 4 && rng(body.seed, 'blocks', civ.species.id)() < .08;
    const fillOf = (l) => blocks ? .9 : .62 + (l.seed % 89) / 89 * .18; // how much of its lot a building takes
    // Their own architecture (alien-arch.mjs): read from their bodies, their ways and their world.
    const arch = architectureOf(civ, body), archCtx = { THREE, C, U: Math.max(.75, u), fh: floorH(u), lights };
    let protos = null, farMat = null; // far prototypes and their material, made when first needed
    const alienLot = (l, add) => buildAlien({ ...archCtx, fill: fillOf(l) }, arch, { ...l, kind: l.kind === 'house' || l.kind === 'row' ? 'home' : l.kind }, add);
    // gy(x, z) on a lot's own ground: the height there above the lot's base (null over water).
    const groundOf = (b) => (x, z) => { const m = b.n.clone().addScaledVector(b.right, x / radius).addScaledVector(b.fwd, z / radius).normalize(); return terrain.isLiquid(m) ? null : radius + terrain.surface(m) - b.groundR; };
    // A unit's plan, once: lots any part of which would stand in water are let go (the
    // planner looks at a few points; here every lot is sampled corner to corner).
    const planOf = (unit) => {
      if (unit.plan) return unit.plan;
      const plan = unit.planOf();
      plan.lots = plan.lots.filter((l) => {
        const { n: n0, fwd, right } = lotFrame(unit.fr, l.x, l.z, l.ang);
        for (const a of [-.55, 0, .55]) for (const b of [-.55, 0, .55]) { const n = n0.clone().addScaledVector(fwd, a * l.d / radius).addScaledVector(right, b * l.w / radius).normalize(); if (terrain.isLiquid(n)) return false; }
        return true;
      });
      return (unit.plan = plan);
    };
    // The plan's data, for every unit near the site: what you collide with, doors, homes to enter, lights, ways to walk.
    for (const unit of units) {
      if (unit.n.angleTo(siteV) * radius - unit.R > DATA_D) continue;
      const plan = planOf(unit), fh = floorH(u);
      for (const l of plan.lots) {
        const b = lotBase(unit, l), f = fillOf(l), short = Math.min(l.w, l.d) * f, long = blocks ? Math.max(l.w, l.d) * f : short, along = l.w > l.d ? b.right : b.fwd, k = Math.max(1, Math.round(long / short));
        const h = l.kind === 'tower' ? l.floors * fh : Math.max(1, l.floors) * fh * (l.kind === 'hall' ? 1.4 : l.kind === 'workshop' ? 1.5 : 1);
        for (let i = 0; i < k; i++) { const m = b.n.clone().addScaledVector(along, (-long / 2 + (i + .5) * long / k) / radius).normalize(); if (!terrain.isLiquid(m)) obstacles.push({ p: m.multiplyScalar(b.groundR), r: short / 2 * .98, h }); } // (none over a shore's last few centimetres of water)
        if (l.kind === 'tower' || l.inner) continue;
        const door = b.n.clone().addScaledVector(b.fwd, ((blocks ? l.d : short) * f / (blocks ? 2 : 2 * f) + .3) / radius).normalize().multiplyScalar(b.groundR);
        dwellings.push({ n: b.n, base: b.base, foot: short / 2 * .92, blocks, k: 1, h: (l.kind === 'hall' ? 1.4 : 1) * fh * Math.min(2, l.floors), ground: b.groundR - radius, door, face: b.fwd.clone(), kind: l.kind });
        if (unit.n.angleTo(siteV) * radius < 300) doorsteps.push({ n: b.n.clone().addScaledVector(b.fwd, ((blocks ? l.d * f : short) / 2 + .9 * u) / radius).normalize(), face: b.fwd.clone().negate(), kind: l.kind });
        if (lights && (l.seed % 3 === 0)) nightLights.push(b.n.clone().multiplyScalar(b.groundR + fh * 1.5));
      }
      if (unit.place) litPlaces.add(unit.place.id);
      if (unit.n.angleTo(siteV) * radius < 900) {
        // Street lamps: landmarks, and a soft halo round each at night.
        if (lights) for (const p of plan.props) if (p.kind === 'lamp' || p.kind === 'lamp-tall') {
          const n = unit.fr.at(p.x, p.z), U = plan.U || 1, tall = p.kind === 'lamp-tall';
          landmarks.lamps.push(n);
          halos.push({ p: n.clone().multiplyScalar(radius + terrain.surface(n) + (tall ? 5.95 : 3.6) * U), size: (tall ? 2.6 : 1.8) * U, colour: C.window });
        }
        for (const st of plan.streets) paths.push(st.pts.map(([x, z]) => unit.fr.at(x, z)).filter((n) => !terrain.isLiquid(n)));
        for (const sq of plan.squares) if (sq.kind !== 'court') sites.push(unit.fr.at(sq.x, sq.z));
      }
    }
    // Building a unit's meshes: near, everything (a little at a time, so walking on never
    // stutters: a job runs a few milliseconds a frame); far, its masses, instanced, at once.
    const farNight = { value: 1 };
    const swap = (unit, ug, detail) => {
      if (unit.group) { unit.group.traverse((o) => { if (o.userData.shared) return o.dispose(); o.geometry?.dispose(); if (o.isInstancedMesh) { o.material.dispose(); o.dispose(); } }); /* (far prototypes and their material are shared) */ group.remove(unit.group); }
      unit.group = ug; unit.detail = detail; if (ug) group.add(ug);
    };
    // --- What stands on a lot: the builders' own architecture -----------------------------
    // The plan (town-plan.mjs) says where streets, squares and lots are; what is built on a
    // lot is the culture's own: its homes (K above: round timber halls and gabled longhouses,
    // stepped pueblos, painted tents and yurts, thatched stilt houses), its great building
    // for a hall, and for taller buildings its own skyline forms (spire(): pagodas,
    // ziggurats, fabric masts, striding towers). Each sits inside its lot with ground round
    // it, so a street is a row of buildings, not a wall. The plain block buildings
    // (town-build.js) are one style among many: a few civilizations build that way.
    const measure = (build) => { const bb = new THREE.Box3(), t = new THREE.Box3(); build((g, m) => { if (!g) return; if (!g.boundingBox) g.computeBoundingBox(); t.copy(g.boundingBox).applyMatrix4(m); bb.union(t); }); return bb; };
    // A builder fitted to a w by d footprint: built once at size 1 to measure, then at the size that fits.
    const fitted = (seed, make, w, d, kMax = 3) => {
      const keep = r; r = rng(body.seed, 'lot', seed); const bb = measure((a) => make(a, 1)); r = keep;
      const sx = Math.max(.5, bb.max.x - bb.min.x), sz = Math.max(.5, bb.max.z - bb.min.z);
      return Math.max(.45, Math.min(kMax, w / sx, d / sz));
    };
    const withSeed = (seed, fn) => { const keep = r; r = rng(body.seed, 'lot', seed); try { fn(); } finally { r = keep; } };
    const skyForm = (seed) => { const forms = CULTURE_FORMS || GENERIC; return forms[seed % forms.length]; };
    function cultureLot(l, add, gy) {
      const fill = fillOf(l), W = l.w * fill, D = l.d * fill, fh = floorH(u);
      // Halls are the culture's great building (fitted to the lot).
      if (l.kind === 'hall') { const k = fitted(l.seed, (a, k) => style.great(a, k), W, D, 2.2); withSeed(l.seed, () => style.great(add, k)); return; }
      // Taller buildings in a city (and every tower) rise in the culture's skyline forms.
      const storeys = l.kind === 'tower' ? l.floors : l.floors;
      if (level >= 4 && storeys >= 3) {
        const H = storeys * fh, form = skyForm(l.seed);
        const k = fitted(l.seed, (a, k) => spire(a, k, H, form), W, D, 4);
        withSeed(l.seed, () => spire(add, k, H, form));
        return;
      }
      // Everything else is a home in the culture's own way, with its yard and the small
      // things of its owners' lives; shops and workshops show their trade at the door.
      const k = fitted(l.seed, (a, k) => style.home(a, k), W, D, 2.4);
      withSeed(l.seed, () => {
        const own = varied(add); style.home(own, k);
        const fp = Math.min(W, D) / 2;
        yard(own, gy, fp, Math.min(k, 1.5)); flair(own, gy, fp, Math.min(k, 1.5));
        if (l.kind === 'shop') stallAt(add, gy, l, fp);
        else if (l.kind === 'workshop') common.crates((g, m, c, b) => add(g, L(fp * .7, gy(fp * .7, fp * .9) ?? 0, fp * .9).multiply(m), c, b));
      });
    }
    // A shop keeps a stall or an awning of goods out on the street side.
    function stallAt(add, gy, l, fp) {
      const x = (r() - .5) * fp * .6, z = Math.min(l.d / 2 - .4 * u, fp + 1.1 * u), y = gy(x, z) ?? 0;
      const m = (dx = 0, dy = 0, dz = 0) => L(x + dx, y + dy, z + dz);
      for (const [px, pz] of [[-.9, -.45], [.9, -.45], [-.9, .45], [.9, .45]]) add(sunk(box(.07 * u, 1.9 * u + SINK, .07 * u)), m(px * u, 0, pz * u), C.wood);
      for (let i = 0; i < 5; i++) add(box(.4 * u, .05 * u, 1.3 * u), m((i - 2) * .4 * u, 1.95 * u), i % 2 ? '#f2ede4' : C.accent);
      add(box(1.8 * u, .75 * u, .8 * u), m(), C.wood);
      for (let i = 0; i < 4; i++) add(ball((.14 + r() * .08) * u, 0), m((i - 1.5) * .4 * u, .85 * u), [C.crop, C.pot, C.accent2, C.leaf][i] || C.pot);
    }
    // Street trees from this world's own plants' colours, in one of a few alien forms per civilization.
    const treeForm = Math.floor(rng(body.seed, 'street-trees')() * 4);
    function streetTree(add, U0, seed) {
      const tr = rng(body.seed, 'tree', seed), h = (2.6 + tr() * 2.2) * U0, leaf = mixC(C.leaf, body.palette?.[2] || C.crop, tr() * .4), stem = mixC(C.wood, C.leaf, .25);
      switch (treeForm) {
        case 0: // a fan of fronds on a ringed stalk
          add(cyl(.09 * U0, .16 * U0, h, 6), L(), stem);
          for (let i = 1; i < 4; i++) add(new THREE.TorusGeometry(.17 * U0, .04 * U0, 3, 8).rotateX(Math.PI / 2), L(0, h * i / 4, 0), C.trim || stem);
          for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; add(cone(.22 * U0, h * .55, 4).rotateZ(Math.PI / 2 - .5).translate(h * .25, 0, 0), L(0, h, 0, 0, a, 0), leaf); }
          break;
        case 1: // a swollen bulb trunk crowned with a cap
          add(new THREE.SphereGeometry(.45 * U0, 8, 6).scale(1, 1.6, 1), L(0, .6 * U0, 0), stem);
          add(cyl(.08 * U0, .2 * U0, h * .7, 6), L(0, .9 * U0, 0), stem);
          add(new THREE.SphereGeometry(h * .32, 10, 6, 0, 6.283, 0, 1.6).scale(1, .55, 1), L(0, h * .85, 0), leaf);
          add(new THREE.SphereGeometry(.18 * U0, 6, 4), L(h * .18, h * .78, 0), C.accent2 || leaf, lights);
          break;
        case 2: // a spiral of stacked discs
          add(cyl(.07 * U0, .12 * U0, h, 5), L(), stem);
          for (let i = 0; i < 6; i++) add(cyl(h * (.36 - i * .05), h * (.36 - i * .05), .08 * U0, 7), L(0, h * (.35 + i * .12), 0, 0, i * .7, 0), i % 2 ? leaf : mixC(leaf, '#000000', .15));
          break;
        default: // a cluster of drooping stalks, each tipped with a pod
          for (let i = 0; i < 5; i++) { const a = i * 1.26, lean = .25 + tr() * .2; rod(add, [0, 0, 0], [Math.cos(a) * h * lean, h * (.7 + tr() * .3), Math.sin(a) * h * lean], .06 * U0, stem, false, 4); add(new THREE.SphereGeometry(.25 * U0, 6, 5).scale(1, 1.4, 1), L(Math.cos(a) * h * lean, h * (.7 + .15), Math.sin(a) * h * lean), leaf); }
      }
      add(sunk(cyl(.7 * U0, .75 * U0, SINK + .15 * U0, 8)), L(), level >= 3 ? C.stone2 : C.stone);
    }
    // Street furniture in the builders' own way (their lamps, their trees); the rest from town-build.js.
    function cultureProp(pr, add, gy, U0) {
      if (pr.kind === 'lamp' || pr.kind === 'lamp-tall') return lamp(add, gy, (pr.kind === 'lamp-tall' ? 1.6 : 1.15) * U0 / u);
      if (pr.kind === 'tree') return streetTree(add, U0, Math.round(pr.x * 31 + pr.z * 17));
      if (pr.kind === 'bench' && level <= 4) return buildProp(kit, { ...pr, kind: 'log' }, add);
      return buildProp(kit, pr, add);
    }
    function* nearJob(unit) {
      const plan = planOf(unit), L1 = merger(THREE, weatherCfg), G1 = merger(THREE), Gd = merger(THREE), B1 = merger(THREE);
      let n = 0;
      for (const l of plan.lots) {
        const b = lotBase(unit, l);
        const addL = (g, m, colour, bright = false) => { if (!g || bright === 'halo' || bright === 'light' || bright === 'pool') return; const mm = new THREE.Matrix4().multiplyMatrices(b.base, m); if (bright === 'blink') B1.add(g, mm, colour); else if (bright) G1.add(g, mm, colour); else L1.add(g, mm, colour, b.groundR, 1.4 * u); };
        if (blocks) buildLot(kit, l, 'near', addL);
        else alienLot(l, addL);
        if (++n % 6 === 0) yield;
      }
      for (const st of plan.streets) { strip(st.pts.map(([x, z]) => unit.fr.at(x, z)), st.w, streetColour, .2, Gd); yield; }
      for (const sq of plan.squares) disc(unit.fr.at(sq.x, sq.z), sq.r, sq.kind === 'park' || sq.kind === 'court' ? C.turf : paved ? C.plaza : C.path, .26, Gd);
      for (const pr of plan.props) {
        const b = lotFrame(unit.fr, pr.x, pr.z, pr.ang), gr = radius + terrain.surface(b.n);
        if (terrain.isLiquid(b.n)) continue;
        const base = new THREE.Matrix4().makeBasis(b.right, b.n, b.fwd).setPosition(b.n.clone().multiplyScalar(gr));
        const addP = (g, m, colour, bright = false) => { if (!g || bright === 'halo' || bright === 'light' || bright === 'pool') return; const mm = new THREE.Matrix4().multiplyMatrices(base, m); if (bright === 'blink') B1.add(g, mm, colour); else if (bright) G1.add(g, mm, colour); else L1.add(g, mm, colour, gr, 1.4 * u); };
        if (blocks) buildProp(kit, pr, addP); else cultureProp(pr, addP, groundOf({ n: b.n, fwd: b.fwd, right: b.right, groundR: gr }), plan.U || 1);
        if (++n % 20 === 0) yield;
      }
      const ug = new THREE.Group();
      for (const [mg, mat] of [[L1, litMat], [G1, glowMat], [Gd, groundMat], [B1, blinkMat]]) if (mg.count()) { const mesh = new THREE.Mesh(mg.geometry(), mat); mesh.frustumCulled = false; ug.add(mesh); }
      return ug;
    }
    const farGroup = (unit) => {
      const plan = planOf(unit), items = [];
      if (!blocks) { // their own buildings, simplified (alien-build.js farProtos), one instanced mesh a prototype
        protos ??= farProtos(archCtx, arch);
        const byKey = new Map(), fh = floorH(u);
        for (const l of plan.lots) {
          const k = { ...l, kind: l.kind === 'house' || l.kind === 'row' ? 'home' : l.kind }, sz = sizeOf(arch, k, { U: Math.max(.75, u), fh, fill: fillOf(l) }), b = lotBase(unit, l);
          const pk = k.kind === 'tower' ? 'tower' : 'home', key = protos.has(`${pk}:${sz.mass}:${l.seed % 2}`) ? `${pk}:${sz.mass}:${l.seed % 2}` : `${pk}:${sz.mass}:0`;
          if (!protos.has(key)) continue;
          if (!byKey.has(key)) byKey.set(key, []);
          byKey.get(key).push({ m: b.base.clone().multiply(new THREE.Matrix4().makeScale(sz.R * 2, sz.H, sz.R * 2)), tone: .88 + (l.seed % 7) / 7 * .22 });
        }
        if (!byKey.size) return null;
        farMat ??= farMaterial(THREE, farNight);
        const ug = new THREE.Group(), c = new THREE.Color();
        for (const [key, its] of byKey) {
          const mesh = new THREE.InstancedMesh(protos.get(key), farMat, its.length);
          its.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, c.setScalar(it.tone)); });
          mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.userData.shared = true; ug.add(mesh);
        }
        return ug;
      }
      for (const mss of farMasses(plan, Math.max(.75, u))) {
        const b = lotBase(unit, mss);
        items.push({ matrix: b.base.clone().multiply(new THREE.Matrix4().makeTranslation(0, -1, 0)), w: mss.w, h: mss.h + 1, d: mss.d, seed: mss.seed, colour: kit.walls[mss.seed % kit.walls.length] });
      }
      if (!items.length) return null;
      const ug = new THREE.Group(); ug.add(farMesh(THREE, items, { windowColour: C.window, night: farNight, U: Math.max(.75, u) }));
      return ug;
    };
    const buildUnit = (unit, detail) => {
      if (detail === 'near') { const job = nearJob(unit); let v; do v = job.next(); while (!v.done); swap(unit, v.value, 'near'); }
      else swap(unit, detail === 'far' ? farGroup(unit) : null, detail);
    };
    const reach = () => FAR_D; // (a city world's city to the horizon: far cells are cheap, one instanced mesh a shape)
    // At the start: full detail round the site, masses beyond.
    // (beyond 900 m the rest come in one a frame as you go: unitsFollow)
    for (const unit of units) { const d = unit.n.angleTo(siteV) * radius - unit.R; buildUnit(unit, d < NEAR_D ? 'near' : d < Math.min(900, reach(unit)) ? 'far' : null); }
    let job = null, lastHere = null, scanTick = 0; // job: { unit, gen }
    unitsFollow = (here, night) => {
      farNight.value = night;
      if (job) { // keep building, a few milliseconds a frame
        const t0 = performance.now();
        let v; do v = job.gen.next(); while (!v.done && performance.now() - t0 < 5);
        if (v.done) { swap(job.unit, v.value, 'near'); job = null; }
        return;
      }
      // Look again only once you have moved a few metres (or every half second or so).
      scanTick++;
      if (lastHere && lastHere.distanceToSquared(here) < 16 && scanTick % 30) return;
      (lastHere ??= here.clone()).copy(here);
      const hn = here.clone().normalize();
      let best = null, bestD = Infinity, want = null;
      for (const unit of units) {
        const d = Math.acos(Math.min(1, Math.max(-1, unit.n.dot(hn)))) * radius - unit.R, R2 = reach(unit);
        const w = d < NEAR_D ? 'near' : unit.detail === 'near' && d < NEAR_D * 1.4 ? 'near' : d < R2 ? 'far' : unit.detail === 'far' && d < R2 * 1.2 ? 'far' : null;
        if (w !== unit.detail && d < bestD) { bestD = d; best = unit; want = w; }
      }
      if (!best) return;
      lastHere = null; // more may be waiting: look again next frame
      if (want === 'near') job = { unit: best, gen: nearJob(best) };
      else buildUnit(best, want);
    };
  }

  // A city world: the planned city round the capital, to the horizon (city-plan.js).
  let planned = null;
  if (urban && !ruins && !handsTowns) {
    const cosOf = (m) => Math.cos(m / radius);
    const occupied = (n, rr) => n.dot(landingNormal) > cosOf(34 + rr) || n.dot(signalNormal) > cosOf(22 + rr) || (n.dot(places[0].v) > cosOf(places[0].radius + 400) && placed.some((p) => n.dot(p.n) > cosOf(p.foot + rr)));
    planned = buildPlannedCity(THREE, { radius, terrain, urban, centre: places[0].v, capitalR: places[0].radius, u, level, family: civ.family, palette: C, occupied, near: Math.min(520, radius * .6), far: Math.min(6000, radius * Math.PI * .97), coarse, seed: `${body.seed}:${body.id}` });
    group.add(planned.group);
    obstacles.push(...planned.obstacles);
    paths.push(...planned.paths);
  }

  // --- Above the world --------------------------------------------------------
  // Satellites in tidy constellations, a station, and ships with somewhere to go. All in
  // the builders' own colours and, at a colony, the home world's own designs (shipCiv).
  const tint = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  const hullC = ship?.hullColour || C.hull, trimC = ship?.trim || C.accent, glowC = ship?.glow || '#7fd4ff', panelC = tint('#1b2a52', trimC, .05);
  const organic = GROWN.includes(shipCiv.material);
  const M0 = new THREE.Matrix4(), solid = (geo, opts = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .55, metalness: .12, ...opts });
  let sats = null, station = null, deck = null;
  const DECK_Z = 9; // the deck's floor, metres above the station's centre along its axis
  const flights = [];
  if ((level >= 5 || orbital) && !ruins) {
    // Satellites: a body with a dish facing the world, and solar wings that turn to the
    // star (grown cultures: a pod with leaf-sails). Three instanced meshes in all.
    const bus = merger(THREE), wing = merger(THREE), beacon = merger(THREE);
    if (organic) {
      bus.add(new THREE.SphereGeometry(.85, 10, 8).scale(1, 1, 1.7), M0, hullC);
      for (let i = 0; i < 3; i++) bus.add(new THREE.TorusGeometry(.86, .09, 4, 12), L(0, 0, (i - 1) * .55, 0, 0, 0, 1, 1, .6), trimC);
      bus.add(cone(.12, 1.4, 5).rotateX(Math.PI / 2), L(0, 0, 1.2), C.accent2);
      for (const sx of [-1, 1]) wing.add(new THREE.SphereGeometry(1, 10, 6).scale(1.7, .05, .75).translate(sx * 2.5, 0, 0), M0, tint(trimC, '#10202a', .35));
      beacon.add(ball(.3, 1), L(0, 0, -1.35), glowC);
    } else {
      bus.add(new THREE.BoxGeometry(1.3, 1.3, 1.8), M0, hullC);
      bus.add(new THREE.BoxGeometry(1.36, .28, 1.86), M0, trimC);
      const prof = []; for (let i = 0; i <= 5; i++) { const x = Math.max(.001, .65 * i / 5); prof.push(new THREE.Vector2(x, .25 * (x / .65) ** 2)); }
      bus.add(new THREE.LatheGeometry(prof, 12).rotateX(Math.PI / 2), L(0, 0, .95), C.metal2);
      bus.add(new THREE.CylinderGeometry(.03, .03, 1.6, 4), L(.45, .9, -.4), C.metal);
      for (const sx of [-1, 1]) {
        wing.add(new THREE.CylinderGeometry(.05, .05, 1, 4).rotateZ(Math.PI / 2), L(sx * 1.15, 0, 0), C.metal);
        for (let i = 0; i < 3; i++) wing.add(new THREE.BoxGeometry(1.1, .05, 1.3), L(sx * (2.25 + i * 1.18), 0, 0), panelC);
        wing.add(new THREE.BoxGeometry(3.6, .07, .06), L(sx * 3.4, 0, 0), C.metal2);
      }
      beacon.add(ball(.13, 1), L(.68, .68, -.92), '#ff5a5a'); beacon.add(ball(.13, 1), L(-.68, .68, -.92), '#7dff8a');
    }
    // Constellations: a few orbital planes with satellites evenly spaced around each, and
    // a few on higher orbits of their own. Lower orbits go round faster.
    const orbits = [], planes = level >= 6 ? 4 : 3, per = level >= 6 ? 7 : 5;
    const plane = (rad) => { const axis = V(r() - .5, r() - .5, r() - .5).normalize(), start = V(r() - .5, r() - .5, r() - .5); start.addScaledVector(axis, -start.dot(axis)).normalize(); return { axis, start, rad, speed: .06 * (radius / rad) ** 1.5 * (r() < .25 ? -1 : 1) }; };
    for (let k = 0; k < planes; k++) { const pl = plane(radius * (1.3 + k * .11)); for (let i = 0; i < per; i++) orbits.push({ ...pl, phase: i / per * 6.283 + k * .7, blink: r() }); }
    for (let i = 0; i < 3; i++) orbits.push({ ...plane(radius * (1.62 + r() * .2)), phase: r() * 6.283, blink: r() });
    const inst = (g, mat) => { const m = new THREE.InstancedMesh(g.geometry(), mat, orbits.length); m.frustumCulled = false; group.add(m); return m; };
    sats = inst(bus, solid()); sats.orbits = orbits;
    sats.wings = inst(wing, solid(null, { roughness: .35, metalness: .25, emissive: new THREE.Color(panelC).multiplyScalar(.25) }));
    sats.lights = inst(beacon, new THREE.MeshBasicMaterial({ vertexColors: true }));
    for (let i = 0; i < orbits.length; i++) sats.lights.setColorAt(i, new THREE.Color(1, 1, 1));

    // The station: their own design (station-deck.js): a landing deck you can walk on, in
    // a shape and size of their own, on top of a core with a spinning habitat ring and a
    // far port where freighters from deep space dock. It turns with the orbit to keep
    // facing the world. Bigger stations orbit a little higher.
    deck = buildStationDeck(THREE, { seed: `${body.seed}:${shipCiv.id || civ.id}`, tier: shipCiv.tier || tier, level, civ: shipCiv, organic, coarse, lift: DECK_Z,
      colours: { hull: hullC, trim: trimC, glow: glowC, panel: panelC, window: C.window } });
    deck.lift = DECK_Z;
    group.add(deck.group);
    station = new THREE.Group();
    station.orbit = { axis: V(r() - .5, 1, r() - .5).normalize(), start: V(1, 0, 0), rad: radius * 1.7 + deck.radius * .6, speed: .012 * Math.min(1, 40 / deck.radius) };
    station.orbit.start.addScaledVector(station.orbit.axis, -station.orbit.start.dot(station.orbit.axis)).normalize();
    group.add(station);
  }
  const stationAt = (t, out = V()) => { const o = station.orbit; return out.copy(o.start).applyAxisAngle(o.axis, t * o.speed).multiplyScalar(o.rad); };
  // The deck's frame at time t: +Y the station's axis, +X toward the world, origin on the floor at its centre.
  if (deck) {
    const fc = V(), fx = V(), fz = V(), fm = new THREE.Matrix4();
    deck.frameAt = (t, out = new THREE.Matrix4()) => {
      const a = station.orbit.axis;
      stationAt(t, fc); fx.copy(fc).negate().normalize(); fz.crossVectors(fx, a);
      return out.makeBasis(fx, a, fz).setPosition(fc.addScaledVector(a, DECK_Z));
    };
    deck.place = (t) => { deck.frameAt(t, fm); fm.decompose(deck.group.position, deck.group.quaternion, deck.group.scale); deck.group.updateMatrixWorld(true); return fm; };
    deck.padAt = (t, i, out = V()) => { const p = deck.pads[i]; return out.set(p.x, 0, p.z).applyMatrix4(deck.frameAt(t, fm)); };
    deck.axis = station.orbit.axis;
    deck.place(0);
  }

  // --- Flights ------------------------------------------------------------------
  // Every ship in the air is on its way somewhere. A flight is a loop of legs, each a
  // duration and a path (position as a function of progress and time, so it can follow
  // a moving station). Shuttles lift off their pads, climb to the station, dock, and come
  // back down; a liner hops between the capital and the towns, setting down beside each;
  // freighters come in from deep space to the station and leave again.
  if (ship && station) {
    const g = merger(THREE), gl = merger(THREE);
    buildShip(THREE, ship, (geo, m, col, bright) => (bright ? gl : g).add(geo, m, col), new THREE.Matrix4(), shipScale);
    const shipGeo = g.geometry(), glowGeo = gl.geometry(); shipGeo.computeBoundingBox();
    const bb = shipGeo.boundingBox, hover = ['saucer', 'ring', 'wheel'].includes(ship.hull), gas = ['bladder', 'lantern'].includes(ship.hull);
    const shipMat = solid(null, { roughness: .45, metalness: .2 }), shipGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
    const plumeMat = new THREE.MeshBasicMaterial({ color: glowC, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false });
    // The exhaust: a cone out of the engines (down from the hull for those that hover).
    const plumeGeo = new THREE.ConeGeometry(.5, 1, 10, 1, true).rotateX(Math.PI).translate(0, -.5, 0); // apex at -1
    const make = (scale) => {
      const o = new THREE.Group();
      o.add(new THREE.Mesh(shipGeo, shipMat), new THREE.Mesh(glowGeo, shipGlow));
      const plume = new THREE.Mesh(plumeGeo, plumeMat), w = ship.length * ship.girth * shipScale, sx = bb.max.x - bb.min.x;
      if (ship.stands || hover) plume.position.set(0, bb.min.y + (hover ? w * .1 : 0), 0);
      else { plume.rotation.x = -Math.PI / 2; plume.position.set(0, (bb.min.y + bb.max.y) / 2, bb.min.z); }
      plume.userData.width = hover ? sx * .45 : w * (ship.stands ? .9 : 1.1); plume.userData.length = hover ? w * 1.2 : ship.length * shipScale * .9;
      plume.visible = !gas; o.add(plume); o.plume = plume;
      o.scale.setScalar(scale); o.traverse(c => c.frustumCulled = false); group.add(o); return o;
    };
    const ease = (x) => x * x * (3 - 2 * x), easeIn = (x) => x * x, easeOut = (x) => 1 - (1 - x) ** 2;
    const bez = (a, b, c, d, t, out) => { const v = 1 - t; return out.copy(a).multiplyScalar(v * v * v).addScaledVector(b, 3 * v * v * t).addScaledVector(c, 3 * v * t * t).addScaledVector(d, t * t * t); };
    const axis = station.orbit.axis, PORT = 5.2;
    // Where a ship of this scale rests: its lowest point on the ground, its nose at the port.
    const restLift = (k) => -bb.min.y * k + .05, noseOut = (k) => (ship.stands ? bb.max.y : bb.max.z) * k;
    // Shuttles from the ground set down on the deck's crew pads (1 and 2); freighters from deep space dock at the far port.
    const dockAt = (t, side, k, d, out, pad = 0) => deck && side === 1 && pad ? deck.padAt(t, pad, out).addScaledVector(axis, restLift(k) + d) : stationAt(t, out).addScaledVector(axis, side * (PORT + noseOut(k) + d));
    const flight = (o, k, legs, offset = 0) => { const total = legs.reduce((a, l) => a + l.dur, 0); flights.push({ o, k, legs, total, offset, lift: restLift(k), q: null, last: null, yAxis: V(0, 0, 1), heading: null }); };
    const padPoint = (i, k) => { const [x, , z] = PADS[i]; return V(x * portK, .32 * portK, z * portK).applyMatrix4(spaceportBase).addScaledVector(V().setFromMatrixColumn(spaceportBase, 1).normalize(), restLift(k)); };
    const up = (p) => p.clone().normalize();
    // Pad -> station -> pad. The climb goes straight up, then sweeps round the world at
    // the station's height to meet it, so it never cuts through the planet whatever side
    // the station is on.
    const slerpDir = (a, b, x, out) => { const d = Math.min(1, Math.max(-1, a.dot(b))), th = Math.acos(d); if (th < 1e-4) return out.copy(a); const s0 = Math.sin(th); return out.copy(a).multiplyScalar(Math.sin((1 - x) * th) / s0).addScaledVector(b, Math.sin(x * th) / s0); };
    const climb = (P, D, x, out) => {
      const rp = P.length(), rd = D.length(), dirB = tmpDir.copy(D).divideScalar(rd), alt = Math.sin(Math.PI / 2 * Math.min(1, x * 1.7));
      return slerpDir(tmpUp.copy(P).divideScalar(rp), dirB, ease(Math.max(0, (x - .12) / .88)), out).multiplyScalar(rp + (rd - rp) * alt);
    };
    const tmpDir = V(), tmpUp = V();
    const deckFace = (t) => ship.stands ? axis.clone() : deck.padAt(t, 0, V()).sub(deck.padAt(t, 1, V())).normalize(); // upright on the deck, or level along it
    const stationRun = (P, k, side, wait, pad = 0) => {
      const tmp = V(), onDeck = !!(deck && side === 1 && pad), face = onDeck ? deckFace : (t) => axis.clone().multiplyScalar(-side), H = onDeck ? 14 : 9;
      return [
        { dur: wait, pos: (x, t, out) => out.copy(P), state: 'rest' },
        { dur: 36, thrust: 1, pos: (x, t, out) => climb(P, dockAt(t, side, k, H, tmp, pad), x, out) },
        { dur: 7, thrust: .35, face, deck: onDeck, pos: (x, t, out) => dockAt(t, side, k, H * (1 - ease(x)), out, pad) },
        { dur: 18, face, deck: onDeck, pos: (x, t, out) => dockAt(t, side, k, 0, out, pad), state: 'docked' },
        { dur: 7, thrust: .35, face, deck: onDeck, pos: (x, t, out) => dockAt(t, side, k, H * ease(x), out, pad) },
        { dur: 36, thrust: .7, pos: (x, t, out) => climb(P, dockAt(t, side, k, H, tmp, pad), 1 - x, out) },
      ];
    };
    // From deep space to the station's far port, and away again.
    const freightRun = (k, side, dir) => {
      const far = (t, out) => dockAt(t, side, k, 0, out).addScaledVector(dir, radius * 9), tmp = V(), tmp2 = V(), tmp3 = V(), tmp4 = V(), face = () => axis.clone().multiplyScalar(-side);
      return [
        { dur: 30, pos: (x, t, out) => far(t, out), state: 'away' },
        { dur: 42, thrust: .6, pos: (x, t, out) => bez(far(t, tmp), dockAt(t, side, k, 0, tmp2).addScaledVector(dir, radius * 2), dockAt(t, side, k, 120, tmp3), dockAt(t, side, k, 12, tmp4), easeOut(x), out) },
        { dur: 8, thrust: .3, face, pos: (x, t, out) => dockAt(t, side, k, 12 * (1 - ease(x)), out) },
        { dur: 24, face, pos: (x, t, out) => dockAt(t, side, k, 0, out), state: 'docked' },
        { dur: 8, thrust: .3, face, pos: (x, t, out) => dockAt(t, side, k, 12 * ease(x), out) },
        { dur: 36, thrust: 1, pos: (x, t, out) => bez(dockAt(t, side, k, 12, tmp), dockAt(t, side, k, 120, tmp2), dockAt(t, side, k, 0, tmp3).addScaledVector(dir, radius * 2), far(t, tmp4), easeIn(x), out) },
      ];
    };
    // A hop over the land from a to b (points where the ship rests): it rises almost
    // straight up, cruises high enough to clear the hills and settles straight down.
    const hop = (A, B) => {
      const nA = up(A), nB = up(B), hA = A.length(), hB = B.length(), dist = nA.angleTo(nB) * radius, n = V();
      return { dur: 9 + dist / 20, thrust: .8, pos: (x, t, out) => {
        // Progress over the ground is eased but the climb is not, so it leaves and arrives near vertically.
        const e = ease(x), base = hA + (hB - hA) * e, away = Math.min(1, 6 * Math.min(x, 1 - x));
        n.copy(nA).lerp(nB, e).normalize();
        const clear = radius + terrain.surface(n) + restLift(1) + 6 + (megacity && n.angleTo(places[0].v) * radius < places[0].radius * 1.3 ? skyline : 0); // over a megacity, above its towers
        return out.copy(n).multiplyScalar(Math.max(base + Math.sin(Math.PI * x) * (35 + dist * .12), base + (clear - base) * away));
      } };
    };
    const rest = (P, dur) => ({ dur, pos: (x, t, out) => out.copy(P), state: 'rest' });
    // Somewhere flat and clear beside a town to set down.
    const spotBeside = (s, k) => {
      const fr = frameAt(s.v);
      for (let j = 0; j < 12; j++) {
        const n = pointAt(fr, s.radius + (4 + j * 2.5) * u, j * 2.4 + s.radius);
        if (terrain.isLiquid(n) || placed.some(p => p.n.angleTo(n) * radius < p.foot + 4 * u)) continue;
        const h = terrain.surface(n), side = frameAt(n);
        if ([0, 1, 2, 3].some(a => Math.abs(terrain.surface(pointAt(side, 3 * u, a * 1.57)) - h) > 1.2)) continue;
        return n.multiplyScalar(radius + h + restLift(k));
      }
      return null;
    };
    const k = .55, dir = (side) => { const d = V(r() - .5, r() - .5, r() - .5).normalize(); return d.addScaledVector(axis, -d.dot(axis)).addScaledVector(axis, side * .5).normalize(); };
    if (spaceportBase) {
      const shuttle = (i, offset) => flight(make(k), k, stationRun(padPoint(i, k), k, 1, 20, i), offset); // spaceport pad i -> deck pad i
      shuttle(1, 0); shuttle(2, 62);
      // The liner: capital to each of the nearest towns in turn and home again.
      const P = padPoint(3, k), stops = places.slice(1).map(s => ({ s, d: s.v.angleTo(places[0].v) })).filter(x => x.d * radius < 1400).sort((a, b) => a.d - b.d).slice(0, 3).map(x => spotBeside(x.s, k)).filter(Boolean);
      const legs = [];
      for (const S of stops) legs.push(rest(P, 14), hop(P, S), rest(S, 12), hop(S, P));
      if (!stops.length) { // nowhere to go but round the capital and back
        const f = frameAt(places[0].v), loop = [0, 1, 2].map(j => pointAt(f, places[0].radius * .9, j * 2.1 + .5)).map(n => n.multiplyScalar(radius + terrain.surface(n) + 40));
        legs.push(rest(P, 16), hop(P, loop[0]), hop(loop[0], loop[1]), hop(loop[1], loop[2]), hop(loop[2], P));
      }
      flight(make(k), k, legs, 7);
    }
    flight(make(1.25), 1.25, freightRun(1.25, -1, dir(-1)), 0);
    if (level >= 6) flight(make(1.25), 1.25, freightRun(1.25, -1, dir(-1)), 74); // system-shapers: busier
  }

  // Air traffic over a megacity: cars in lanes stacked above the skyline, weaving a
  // little as they go round, headlights on. Two instanced meshes, whatever the count.
  let cars = null;
  if (megacity && places[0]) {
    const body_ = merger(THREE), lights_ = merger(THREE), cu = Math.max(1, u * .8);
    body_.add(new THREE.SphereGeometry(.7 * cu, 8, 5).scale(1, .45, 1.8), M0, hullC);
    body_.add(new THREE.BoxGeometry(2.2 * cu, .08 * cu, .5 * cu), L(0, 0, -.4 * cu), trimC);
    lights_.add(new THREE.BoxGeometry(.9 * cu, .18 * cu, .1 * cu), L(0, 0, -1.28 * cu), glowC);
    lights_.add(new THREE.BoxGeometry(.7 * cu, .12 * cu, .1 * cu), L(0, .05 * cu, 1.27 * cu), '#fff6dc');
    const capF = frameAt(places[0].v), base = radius + terrain.surface(places[0].v), Rm = places[0].radius, lanes = [];
    for (let k = 0; k < 4; k++) for (let i = 0, n = 9 + k * 2; i < n; i++) lanes.push({ rad: Rm * (.3 + k * .22), alt: Math.max(skyline, 30 * u) + (4 + k * 7) * u, speed: (.05 + r() * .02) / (1 + k * .4) * (k % 2 ? -1 : 1), phase: i / n * 6.283 + r() * .3, weave: r() * 6.283 });
    cars = { lanes, base, capF, hull: new THREE.InstancedMesh(body_.geometry(), solid(null, { metalness: .25 }), lanes.length), glow: new THREE.InstancedMesh(lights_.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), lanes.length) };
    for (const m of [cars.hull, cars.glow]) { m.frustumCulled = false; group.add(m); }
  }

  // Smoke from forges and smokestacks: puffs that rise, drift and swell, then start again.
  let smoke = null;
  if (smokeFrom.length && !civ.underwater && !ruins) { // (no smoke under water)
    const PUFFS = 6, mat = new THREE.MeshStandardMaterial({ color: industrial ? '#8d8a86' : '#9a948c', roughness: 1, transparent: true, opacity: .55, depthWrite: false, flatShading: true });
    smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat, smokeFrom.length * PUFFS);
    smoke.frustumCulled = false; smoke.puffs = PUFFS; smoke.drift = V(r() - .5, r() - .5, r() - .5).normalize();
    group.add(smoke);
  }

  // Night at the site, for lamps, pools of light and halos (0 by day, 1 at night).
  let night = 1;
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q2 = new THREE.Quaternion(), basis = new THREE.Matrix4(), rot = new THREE.Matrix4();
  const nadir = V(), xa = V(), ya = V(), sp = V(), vel = V(), pA = V(), pB = V(), fwd = V(), nose = V(), rgt = V(), upv = V(), white = new THREE.Color(1, 1, 1), dim = new THREE.Color(.15, .15, .15);
  const legAt = (f, t) => { let x = ((t + f.offset) % f.total + f.total) % f.total; for (const l of f.legs) { if (x < l.dur) return [l, x / l.dur]; x -= l.dur; } return [f.legs.at(-1), 1]; };
  function fly(f, t) {
    const [leg, x] = legAt(f, t), dt = f.last === null ? 0 : Math.max(0, Math.min(.2, t - f.last)); f.last = t;
    leg.pos(x, t, pA); leg.pos(Math.min(1, x + .05 / leg.dur), t + .05, pB);
    if (!leg.state) for (const q of [pA, pB]) { const g = radius + terrain.surface(upv.copy(q).normalize()) + f.lift; if (q.length() < g) q.setLength(g); } // never through the ground
    f.o.visible = leg.state !== 'away';
    f.o.position.copy(pA);
    vel.copy(pB).sub(pA).divideScalar(.05);
    // Which way it points: docked and docking, at the port; otherwise along its motion,
    // upright hulls nose first once moving, level hulls level with the ground below.
    if (leg.deck) upv.copy(deck.axis); else upv.copy(pA).normalize(); // on a station's deck, up is off the deck
    const dir = leg.face ? leg.face(t) : null, speed = vel.length();
    if (ship.stands) {
      if (dir) nose.copy(dir); else nose.copy(upv).lerp(speed > .5 ? fwd.copy(vel).normalize() : upv, Math.min(1, Math.max(0, (speed - 2) / 10))).normalize();
      f.yAxis.addScaledVector(nose, -f.yAxis.dot(nose)); if (f.yAxis.lengthSq() < 1e-6) f.yAxis.set(1, 0, 0).addScaledVector(nose, -nose.x); f.yAxis.normalize();
      rgt.crossVectors(nose, f.yAxis); basis.makeBasis(rgt, nose, f.yAxis);
    } else {
      if (dir) fwd.copy(dir); else { fwd.copy(vel).addScaledVector(upv, -vel.dot(upv)); if (fwd.length() > 1.5) f.heading = fwd.normalize().clone(); fwd.copy(f.heading || V(1, 0, 0).cross(upv)); }
      fwd.addScaledVector(upv, -fwd.dot(upv)).normalize();
      rgt.crossVectors(upv, fwd); basis.makeBasis(rgt, upv, fwd);
    }
    q2.setFromRotationMatrix(basis);
    if (!f.q || !dt || leg.state === 'rest') f.o.quaternion.copy(q2); else f.o.quaternion.slerp(q2, 1 - Math.exp(-dt * 2.5));
    f.q = true;
    // Exhaust: full while climbing or leaving, gentler on approach, off at rest.
    const pl = f.o.plume, thrust = leg.state ? 0 : (leg.thrust ?? .5) * (.45 + .55 * Math.min(1, speed / 25));
    pl.visible = thrust > .02 && !(['bladder', 'lantern'].includes(ship.hull));
    if (pl.visible) { const w = pl.userData.width * (.6 + .4 * thrust); pl.scale.set(w, pl.userData.length * thrust * (.9 + .1 * Math.sin(t * 37 + f.offset)), w); }
  }
  function update(t, sunDir) {
    if (sunDir) night = Math.min(1, Math.max(0, (.12 - signalNormal.dot(sunDir)) / .24));
    if (winNightRef) winNightRef.value = night;
    planned?.update(night);
    if (glowMeshRef) glowMeshRef.material.color.setScalar(ruins ? 1 : .7 + .3 * night);
    if (poolMeshRef) { poolMeshRef.visible = night > .02; poolMeshRef.material.opacity = night; }
    if (haloRef) { haloRef.visible = night > .02; haloRef.material.uniforms.night.value = night; }
    if (blinkRef) blinkRef.material.color.setScalar((t * .8) % 1 < .14 ? 1 : .18);
    if (sats) {
      sats.orbits.forEach((o, i) => {
        p.copy(o.start).applyAxisAngle(o.axis, t * o.speed + o.phase);
        nadir.copy(p).negate(); xa.copy(o.axis); ya.crossVectors(nadir, xa);
        basis.makeBasis(xa, ya, nadir).setPosition(p.multiplyScalar(o.rad));
        sats.setMatrixAt(i, basis); sats.lights.setMatrixAt(i, basis);
        // Wings turn about their boom to face the star.
        let ang = 0;
        if (sunDir) { sp.copy(sunDir).addScaledVector(xa, -sunDir.dot(xa)); ang = Math.atan2(sp.dot(nadir), sp.dot(ya)); }
        sats.wings.setMatrixAt(i, m.multiplyMatrices(basis, rot.makeRotationX(ang)));
        sats.lights.setColorAt(i, (t * .7 + o.blink) % 1 < .12 ? white : dim);
      });
      for (const x of [sats, sats.wings, sats.lights]) x.instanceMatrix.needsUpdate = true;
      sats.lights.instanceColor.needsUpdate = true;
    }
    if (station) { const o = station.orbit; stationAt(t, station.position); station.quaternion.setFromUnitVectors(V(0, 0, 1), o.axis); station.rotateZ(t * .1); }
    if (deck) { deck.place(t); deck.spin(t); }
    for (const f of flights) fly(f, t);
    if (smoke) {
      smokeFrom.forEach((sm, j) => {
        if (!sm.at) return;
        const upS = upv.copy(sm.at).normalize(), side = rgt.copy(smoke.drift).addScaledVector(upS, -smoke.drift.dot(upS)).normalize();
        for (let i = 0; i < smoke.puffs; i++) {
          const ph = ((t * .09 * (1 + j % 3 * .15)) + i / smoke.puffs) % 1, size = (.5 + ph * 2.4) * u * sm.k * (1 - ph ** 4);
          pA.copy(sm.at).addScaledVector(upS, (.3 + ph * 12) * u * sm.k).addScaledVector(side, ph * ph * 6 * u * sm.k);
          smoke.setMatrixAt(j * smoke.puffs + i, basis.makeScale(size, size, size).setPosition(pA));
        }
      });
      smoke.instanceMatrix.needsUpdate = true;
    }
    if (cars) {
      cars.lanes.forEach((c, i) => {
        const a = t * c.speed + c.phase, wob = (x) => c.rad * (1 + .12 * Math.sin(x * 3 + c.weave));
        const n = pointAt(cars.capF, wob(a), a), n2 = pointAt(cars.capF, wob(a + .01 * Math.sign(c.speed)), a + .01 * Math.sign(c.speed));
        const h = cars.base + c.alt + Math.sin(a * 2 + c.weave) * 1.5 * u;
        pA.copy(n).multiplyScalar(h); fwd.copy(n2).multiplyScalar(h).sub(pA).normalize();
        rgt.crossVectors(n, fwd).normalize(); basis.makeBasis(rgt, n, fwd).setPosition(pA);
        cars.hull.setMatrixAt(i, basis); cars.glow.setMatrixAt(i, basis);
      });
      cars.hull.instanceMatrix.needsUpdate = cars.glow.instanceMatrix.needsUpdate = true;
    }
  }
  let glowMeshRef = null, poolMeshRef = null, haloRef = null, blinkRef = null, winNightRef = null;

  if (!placed.length && !units.length) return none;
  const litMesh = new THREE.Mesh(lit.geometry(), litMat);
  const glowMesh = new THREE.Mesh(glow.geometry(), glowMat);
  const groundMesh = new THREE.Mesh(ground.geometry(), groundMat);
  const extra = [];
  glowMeshRef = glowMesh;
  if (!ruins) extra.push(blinkRef = new THREE.Mesh(blink.geometry(), blinkMat)); // (town units blink with the same material)
  if (pool.count() && !ruins) extra.push(poolMeshRef = new THREE.Mesh(pool.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
  if (halos.length && !ruins) extra.push(haloRef = haloPoints(THREE, halos));
  for (const mesh of [litMesh, glowMesh, groundMesh, ...extra]) { mesh.frustumCulled = false; group.add(mesh); }
  // While you are inside a home (interior.js), its own outside (walls, roof, poles, tent
  // cone, yard things) is not drawn within its footprint: only the room is there.
  const hide = { c: { value: new THREE.Vector3() }, up: { value: new THREE.Vector3(0, 1, 0) }, r: { value: -1 }, h: { value: 0 } };
  // Painted windows (town-build.js facades: aWin), lit here and there by night.
  const winNight = winNightRef = { value: 1 }, winColour = { value: new THREE.Color(C.window) };
  {
    const before = litMat.onBeforeCompile, key = litMat.customProgramCacheKey();
    litMat.onBeforeCompile = (sh, renderer) => {
      before.call(litMat, sh, renderer);
      Object.assign(sh.uniforms, { uWinNight: winNight, uWinColour: winColour });
      sh.vertexShader = 'attribute vec4 aWin; varying vec4 vWin;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWin = aWin;');
      sh.fragmentShader = 'varying vec4 vWin; uniform float uWinNight; uniform vec3 uWinColour;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  if (vWin.z > 0.0) {
    vec2 cell = vec2(vWin.x / vWin.z, vWin.y / vWin.w), f = fract(cell), id = floor(cell);
    float win = step(.22, f.x) * step(f.x, .78) * step(.24, f.y) * step(f.y, .78);
    float on = step(.62 - .3 * uWinNight, fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * .25 + vec3(.06, .08, .1), win);
    totalEmissiveRadiance += uWinColour * win * on * (.05 + 1.1 * uWinNight);
  }`);
    };
    litMat.customProgramCacheKey = () => key + '|windows';
  }
  for (const mat of [litMat, glowMat, blinkMat, ...extra.filter((m) => m !== blinkRef && m.material).map((m) => m.material)]) {
    if (!mat.isMeshStandardMaterial && !mat.isMeshBasicMaterial) continue;
    const before = mat.onBeforeCompile, key = mat.customProgramCacheKey();
    mat.onBeforeCompile = (sh, renderer) => {
      before.call(mat, sh, renderer);
      Object.assign(sh.uniforms, { uHideC: hide.c, uHideUp: hide.up, uHideR: hide.r, uHideH: hide.h });
      sh.vertexShader = 'varying vec3 vHideW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvHideW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vHideW; uniform vec3 uHideC; uniform vec3 uHideUp; uniform float uHideR; uniform float uHideH;\n' + sh.fragmentShader.replace('void main() {', `void main() {
  if (uHideR > 0.0) { vec3 hd = vHideW - uHideC; float hu = dot(hd, uHideUp); if (hu > -0.5 && hu < uHideH && length(hd - uHideUp * hu) < uHideR) discard; }`);
    };
    mat.customProgramCacheKey = () => key + '|hide';
  }
  // inside: { centre (Vector3, the floor's centre, planet frame), up (unit), radius, height } or null.
  const hideInside = (inside) => {
    if (!inside) { hide.r.value = -1; return; }
    hide.c.value.copy(inside.centre); hide.up.value.copy(inside.up); hide.r.value = inside.radius; hide.h.value = inside.height;
  };
  update(0);
  // Ground the builders have cleared: their places near the site and each piece's footprint.
  const clearings = [...placed.filter(p => !p.road).map(p => ({ n: p.n, r: p.foot + 1.5 })), ...near.map(s => ({ n: s.v, r: s.radius + 2 * u })), ...plannedTowns.map(s => ({ n: s.v, r: s.radius + 2 * u })), ...units.filter((un) => un.n.angleTo(siteV) * radius - un.R < DATA_D).map((un) => ({ n: un.n, r: un.R + 2 * u })), ...(planned?.obstacles.map(o => ({ n: o.p.clone().normalize(), r: o.r + 1.5 })) ?? [])];
  return { group, civ, obstacles, sites, clearings, dwellings, paths, palette: C, urban, planned: planned ? { pieces: planned.pieces } : null, places: places.map(s => ({ n: s.v, r: s.radius, kind: s.kind })), pieces: placed.length, network: net, ship, spaceportAt, spaceportScale: portK, fieldsAt, landmarks, nightLights: { points: ruins ? [] : nightLights, places: litPlaces, colour: C.window }, flights, station, deck, ruins, update, hideInside, doorsteps, units: units.length, follow: (here) => unitsFollow?.(here, night) };
}

// Colours from the world and the builders: stone from its rock, walls from the
// culture's material, accents from the species' own colours.
function colours(THREE, body, civ) {
  const c = (hex) => new THREE.Color(hex), mix = (a, b, t) => '#' + c(a).lerp(c(b), t).getHexString();
  // The species' own colours (fauna.mjs: base, belly, accent, shimmer) for paint and trim.
  const rock = body.rock, sp = civ.species.colors || {}, prim = sp.accent || sp.base || '#c0503a', sec = sp.shimmer || sp.belly || '#d8c07a';
  const wall = {
    wood: mix('#7b5a3c', rock, .25), ice: mix('#cfe6f2', body.atmosphere, .15), adobe: mix('#c99a6b', body.palette[3], .3), glass: mix('#9fe3e6', prim, .3), stone: mix(rock, '#b9b2a6', .35),
    grown: mix(prim, '#f0b8a0', .35), shell: mix('#efe3d0', prim, .2), silk: mix('#f2f0ea', body.atmosphere, .1), wax: mix('#d9a441', prim, .2), living: mix('#6b4a2f', rock, .2), membrane: mix(prim, '#ffffff', .45),
  }[civ.material];
  const leaf = mix(body.palette[1] || '#4f7a3a', '#4fa83a', .4);
  return {
    stone: mix(rock, '#8d8a85', .3), stone2: mix(rock, '#5c5a58', .4), wall, wall2: mix(wall, '#000', .18),
    wood: mix('#6b4a2f', rock, .2), roof2: mix(civ.material === 'ice' ? wall : (body.palette[1] || '#8a7a4a'), '#3b3020', .55), roof: civ.material === 'ice' ? mix(wall, '#ffffff', .3) : mix(body.palette[1] || '#8a7a4a', '#6b5a33', .5),
    pot: mix('#a8643f', rock, .3), plinth: ['grown', 'shell', 'wax', 'living', 'silk', 'membrane'].includes(civ.material) ? mix(wall, '#2a2420', .35) : mix(rock, '#5c5a58', .3), door: '#1a1410', trim: mix(wall, '#f2ede4', .3), accent: prim, accent2: sec, soil: mix(body.palette[2] || '#5a4630', '#3a2a1a', .6), crop: mix(body.palette[1] || '#4f7a3a', '#6bd44f', .35),
    turf: mix(body.palette[1] || '#6b8a4a', '#55703a', .4), leaf, bag: mix(sec, '#ffffff', .35), line: '#3a3330', road: mix(rock, '#6f6b66', .55),
    path: mix(body.palette[2] || '#7a6648', '#8a7356', .45), plaza: mix(rock, '#a39d93', .45), pad: '#5d6266',
    ember: '#ff7a2a', flame: '#ffc46b', window: civ.species.glow ? mix('#ffd98a', sp.glow || prim, .4) : '#ffd98a', beacon: '#ff4a4a',
    metal: '#9aa5ad', metal2: '#d7dde1', concrete: '#8b8f91', scorch: '#2b2b2b', hull: '#eef1f2', glass: mix(wall, '#7fb0c4', .65),
  };
}

// Soft halos around lamps: one Points object, sized in metres, fading in with night.
function haloPoints(THREE, halos) {
  const pos = [], col = [], size = [], c = new THREE.Color();
  for (const h of halos) { pos.push(h.p.x, h.p.y, h.p.z); c.set(h.colour); col.push(c.r, c.g, c.b); size.push(h.size); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('colour', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { night: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 colour; attribute float size; varying vec3 vColour;
void main() {
  vColour = colour;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * projectionMatrix[1][1] * 450.0 / -mv.z, 0.0, 96.0);
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
uniform float night; varying vec3 vColour;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5; float d = dot(c, c) * 4.0;
  gl_FragColor = vec4(vColour * exp(-d * 4.5) * 0.55 * night, 1.0);
}`,
  });
  const points = new THREE.Points(g, material);
  points.name = 'lamp-halos';
  return points;
}

// Triangles given as world positions (for ground strips and discs), with normals.
function flatGeometry(pos) {
  // Every triangle faces up, away from the planet's centre (strips are laid either way along).
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2], bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    if (nx * pos[i] + ny * pos[i + 1] + nz * pos[i + 2] < 0) for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
  }
  const g = new THREE_REF.BufferGeometry();
  g.setAttribute('position', new THREE_REF.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
let THREE_REF = null;

// Collects geometry pieces (baked into world space with a colour) and merges them.
// weather (lit pieces only): { snow, bleach, damp } 0..1. Snow settles on every face that
// looks up, a hot sun bleaches every colour, and damp darkens the foot of every wall toward
// moss, so the same buildings read differently on a frozen, a baking or a dripping world.
function merger(THREE, weather = null) {
  const pos = [], nor = [], col = [], win = [], tmp = new THREE.Color(), snowC = new THREE.Color('#eef3f7'), mossC = new THREE.Color('#3d4a2c'), sunC = new THREE.Color('#f3ead8');
  return {
    // ground: distance from the planet's centre to the ground this piece stands on, and
    // shade: the height over which it darkens toward the ground (ambient shadow). Glowing
    // pieces pass no ground and stay flat. Each face also varies a little in tone, so
    // walls and roofs read as material rather than flat colour.
    add(g, matrix, colour, ground = 0, shade = 1) {
      const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(matrix);
      const P = geo.attributes.position, N = geo.attributes.normal;
      const own = colour === null ? geo.attributes.color : null; // null: the geometry carries its own colours
      const W = geo.attributes.aWin; // painted windows (town-build.js facades), if any
      if (!own) tmp.set(colour);
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        let k = 1;
        if (ground) {
          const face = Math.floor((pos.length / 3) / 3);
          k = 1 + ((((face * 2654435761) >>> 0) % 1000) / 1000 - .5) * .14;
          const h = Math.hypot(x, y, z) - ground;
          k *= .7 + .3 * Math.min(1, Math.max(0, h / shade));
        }
        if (own) tmp.setRGB(own.getX(i), own.getY(i), own.getZ(i));
        let cr = tmp.r, cg = tmp.g, cb = tmp.b;
        if (weather && ground) {
          const rl = Math.hypot(x, y, z), upness = (N.getX(i) * x + N.getY(i) * y + N.getZ(i) * z) / rl;
          if (weather.bleach) { const b = weather.bleach * .22; cr += (sunC.r - cr) * b; cg += (sunC.g - cg) * b; cb += (sunC.b - cb) * b; }
          if (weather.damp) { const d = weather.damp * .4 * Math.max(0, 1 - (rl - ground) / (shade * 1.2)); cr += (mossC.r - cr) * d; cg += (mossC.g - cg) * d; cb += (mossC.b - cb) * d; }
          if (weather.snow && upness > .5) { const sn = weather.snow * Math.min(1, (upness - .5) * 3.5) * .9; cr += (snowC.r - cr) * sn; cg += (snowC.g - cg) * sn; cb += (snowC.b - cb) * sn; }
        }
        pos.push(x, y, z); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(cr * k, cg * k, cb * k);
        if (W) win.push(W.getX(i), W.getY(i), W.getZ(i), W.getW(i)); else win.push(0, 0, 0, 0);
      }
      geo.dispose(); if (g !== geo) g.dispose();
    },
    count: () => pos.length / 3,
    geometry() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute('aWin', new THREE.Float32BufferAttribute(win, 4));
      return geo;
    },
  };
}
