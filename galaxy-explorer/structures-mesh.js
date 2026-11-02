// Builds what an intelligent species has made (structures.mjs) around its herds'
// homes near the site, in its own culture's architecture:
//   tool users      cairns, trails of marked stones, simple shelters in their style, hearths
//   village builders  a village of dwellings around a gathering place, fields if they farm
//   city builders   a dense city in rings around a great structure, with paths and outlying towns
//   planet-shapers  a bigger city, roads running to the horizon and towns with lights all over the world
//   spacefarers     all that, a launch site of their own kind, satellites and a station in orbit
// Everything is merged into two meshes (one lit, one glowing): two draw calls however
// big the city. Footings reach into the ground so nothing floats on a slope. THREE is passed in.
import { rng } from './rng.mjs';
import { civilizationFor } from './structures.mjs';

const SINK = 1.6; // metres every footing reaches below the lowest ground it stands on
const BUDGET = 160000; // vertices; far-off towns stop here so phones stay smooth
const WALKERS = ['hands', 'grazers', 'rollers', 'tripods', 'tentacles'];

export function buildStructures(THREE, { body, terrain, radius, signalNormal, landingNormal, fauna }) {
  const group = new THREE.Group(), obstacles = [], sites = [];
  const civ = fauna ? civilizationFor(body, fauna.species) : null;
  const homes = civ ? fauna.homes?.get(civ.species.id) || [] : [];
  const none = { group, civ: null, obstacles, sites, clearings: [], pieces: 0, update() {} };
  if (!civ || !homes.length) return none;

  const r = rng(body.seed, 'structures', civ.species.id), u = civ.unit, tall = civ.tall, level = civ.level;
  const C = colours(THREE, body, civ);
  const lit = merger(THREE), glow = merger(THREE);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), world = new THREE.Matrix4();
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(sx, sy, sz));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0);
  const cone = (rad, h, seg = 8) => new THREE.ConeGeometry(rad, h, seg, 1).translate(0, h / 2, 0);
  const ball = (rad, d = 0) => new THREE.IcosahedronGeometry(rad, d);
  const dome = (rad, seg = 10) => new THREE.SphereGeometry(rad, seg, Math.max(4, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2);
  const ring = (rad, tube, seg = 12) => new THREE.TorusGeometry(rad, tube, 4, seg).rotateX(Math.PI / 2);
  const sunk = (g) => g.translate(0, -SINK, 0);
  const pick = (...a) => a[Math.floor(r() * a.length)];
  // A pole or line from a to b (local points).
  const rod = (add, a, b, rad, colour, bright) => {
    const d = V(...b).sub(V(...a)), len = d.length(), m = new THREE.Matrix4().compose(V(...a), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1));
    add(cyl(rad, rad, len, 5), m, colour, bright);
  };
  const lights = level >= 4; // planet-shapers light their buildings

  // --- Placement -------------------------------------------------------------
  const placed = [];
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
  function place(f, dist, angle, foot, height, build, { face = true, spacing = 1, aloft = false, road = false } = {}) {
    const n = pointAt(f, dist, angle);
    if (n.angleTo(signalNormal) * radius < 14 + foot || n.angleTo(landingNormal) * radius < 16 + foot) return false;
    for (const p of placed) if ((!road || !p.road) && p.n.angleTo(n) * radius < (p.foot + foot) * (road ? .7 : spacing)) return false;
    if (road) for (const p of placed) if (p.road && p.n.angleTo(n) * radius < foot * 1.2) return false;
    const fr = frameAt(n);
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < 5; k++) {
      const m = k ? pointAt(fr, aloft ? foot * .3 : foot, k * Math.PI / 2) : n;
      if (terrain.isLiquid(m)) return false;
      const h = terrain.surface(m); lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    if (hi - lo > SINK * .9 + (aloft ? foot : foot * .5)) return false;
    const to = f.home.clone().sub(n), up = n;
    const fwd = face && dist > .5 ? to.addScaledVector(n, -to.dot(n)).normalize() : fr.north;
    const right = up.clone().cross(fwd).normalize();
    const base = new THREE.Matrix4().makeBasis(right, up, fwd).setPosition(n.clone().multiplyScalar(radius + lo));
    build((g, local, colour, bright = false) => (bright ? glow : lit).add(g, world.multiplyMatrices(base, local), colour));
    placed.push({ n, foot, road });
    if (height > .35) obstacles.push({ p: n.clone().multiplyScalar(radius + lo), r: (aloft ? .3 : foot * .8), h: aloft ? 1 : height });
    return true;
  }
  const settle = (f, dist, angle, foot, height, build, opts) => { for (let k = 0; k < 7; k++) if (place(f, dist + (k >> 1) * foot * .6, angle + (k % 2 ? 1 : -1) * k * .17, foot, height, build, opts)) return true; return false; };

  // --- Shared pieces ---------------------------------------------------------
  const footing = (add, w, colour) => add(sunk(cyl(w, w * 1.05, SINK, 8)), L(), colour);
  const windows = (add, w, y, d, n = 2) => { if (lights) for (let i = 0; i < n; i++) add(box(.4 * u, .35 * u, .05), L((i - (n - 1) / 2) * w / n, y, d), C.window, true); };
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
    hearth(add) {
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(ball(.22 * u), L(Math.cos(a) * .7 * u, .08 * u, Math.sin(a) * .7 * u, 0, a, 0, 1, .6, 1), C.stone2); }
      add(cyl(.45 * u, .5 * u, .06 * u, 8), L(0, .02 * u, 0), C.ember, true);
      for (let i = 0; i < 3; i++) add(cone(.12 * u, .5 * u, 4), L((r() - .5) * .3 * u, .05 * u, (r() - .5) * .3 * u, (r() - .5) * .3, 0, (r() - .5) * .3), C.flame, true);
    },
    field(add) {
      const w = 6, d = 5;
      add(sunk(box(w, .1 + SINK, d)), L(), C.soil);
      for (let z = -d / 2 + .5; z < d / 2; z += .9) for (let x = -w / 2 + .4; x < w / 2; x += .7) add(cone(.17, .5 + r() * .25, 4), L(x + (r() - .5) * .1, .1, z), C.crop);
    },
    slab(add) { add(sunk(box(1.8 * u, .14 + SINK, 1.8 * u)), L(0, 0, 0, 0, r() * .2), C.road); },
    light(add) { add(ball(.35 * u), L(0, 2.5 * u, 0), C.window, true); add(sunk(cyl(.08 * u, .1 * u, 2.4 * u + SINK, 4)), L(), C.metal); },
  };

  // --- Cultures --------------------------------------------------------------
  // home(add, k): a dwelling at scale k; great(add, k): the centrepiece; small(add): a far-off town.
  const roofCone = (add, rad, h, y, seg = 8) => add(cone(rad, h, seg), L(0, y, 0), C.roof);
  const gable = (add, w, d, y) => add(new THREE.CylinderGeometry(d * .6, d * .6, w * 1.04, 3).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).rotateY(Math.PI / 2), L(0, y + d * .28, 0, 0, Math.PI / 2, 0), C.roof);
  const K = {
    timber: {
      home(add, k) {
        if (r() < .5) { const rad = 1.25 * u * k, h = 1.6 * u * k * tall; footing(add, rad, C.wall); add(cyl(rad, rad * 1.04, h, 9), L(), C.wall); roofCone(add, rad * 1.3, 1.3 * u * k * tall, h, 9); add(box(.55 * u, h * .62, .14 * u), L(0, 0, rad * .98), C.door); windows(add, rad, h * .55, rad, 2); }
        else {
          const w = 3.2 * u * k, d = 1.9 * u * k, h = 1.5 * u * k * tall;
          add(sunk(box(d, h + SINK, w)), L(), C.wall); gable(add, w, d, h); add(box(.6 * u, h * .7, .1), L(0, 0, w / 2 + .02), C.door);
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
        for (let i = 0; i < n; i++) { const h = 1.5 * u * tall; add(i ? box(w, h, w * .9) : sunk(box(w, h + SINK, w * .9)), L(i * .25 * w, y, -i * .15 * w), i % 2 ? C.wall2 : C.wall); add(box(.55 * u, .9 * u, .06), L(i * .25 * w, y, w * .45 + .02 - i * .15 * w), C.door); windows(add, w, y + h * .6, w * .45 + .04 - i * .15 * w, 1); y += h; w *= .75; }
        add(box(.08 * u, 2 * u, .08 * u), L(w * .7, 0, w * .6, -.3), C.wood);
      },
      great(add, k) { // stepped pyramid with a stair and a shrine
        let y = 0, w = 9 * u * k; const steps = 4 + Math.round(k * 2), h = 1.4 * u * tall;
        for (let i = 0; i < steps; i++) { add(i ? box(w, h, w) : sunk(box(w, h + SINK, w)), L(0, y, 0), i % 2 ? C.wall2 : C.wall); y += h; w *= .8; }
        add(box(1.6 * u, steps * h * 1.12, 9 * u * k * .55), L(0, 0, 9 * u * k * .3, -Math.atan2(steps * h, 9 * u * k * .5) + Math.PI / 2 - Math.PI / 2 + .62), C.stone2);
        add(box(w, 1.6 * u, w), L(0, y, 0), C.accent); windows(add, w, y + .6 * u, w / 2 + .03, 1);
      },
      small(add) { add(sunk(box(2.4 * u, 1.4 * u + SINK, 2.4 * u)), L(), C.wall); add(box(1.6 * u, 1.2 * u, 1.6 * u), L(.3 * u, 1.4 * u, 0), C.wall2); },
    },
    tents: {
      home(add, k) {
        if (r() < .55) { const rad = 1.4 * u * k, h = 2.6 * u * k * tall; add(sunk(cyl(rad * .95, rad, SINK, 7)), L(), C.wall); add(cone(rad, h, 7), L(), C.wall); for (let i = 0; i < 4; i++) { const a = i * 1.6; rod(add, [Math.cos(a) * rad * .6, h * .5, Math.sin(a) * rad * .6], [Math.cos(a) * rad * .15, h * 1.15, Math.sin(a) * rad * .15], .04 * u, C.wood); } add(box(.5 * u, .9 * u, .1), L(0, 0, rad * .75, -.4), C.door); }
        else { const rad = 1.6 * u * k, h = 1.2 * u * k; footing(add, rad, C.wall); add(cyl(rad, rad, h, 10), L(), C.wall); add(cone(rad * 1.08, .9 * u * k, 10), L(0, h, 0), C.roof); add(box(.55 * u, h * .8, .1), L(0, 0, rad), C.door); add(ring(.25 * u, .06 * u, 8), L(0, h + .85 * u * k, 0), C.wood); }
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
        const h = 2.2 * u * k, w = 2.4 * u * k, d = 2 * u * k;
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(sunk(cyl(.1 * u, .12 * u, h + SINK, 5)), L(x * w * .42, 0, z * d * .42), C.wood);
        add(box(w * 1.1, .15 * u, d * 1.3), L(0, h, 0), C.wood);
        add(box(w, 1.4 * u * tall, d), L(0, h + .15 * u, 0), C.wall); gable(add, d, w, h + .15 * u + 1.4 * u * tall);
        add(box(.8 * u, .1 * u, 3 * u * k), L(0, h, d * .5 + 1.5 * u * k), C.wood); // walkway toward the centre
        add(box(.5 * u, .9 * u, .08), L(0, h + .15 * u, d / 2 + .02), C.door); windows(add, w, h + .9 * u, d / 2 + .03, 2);
      },
      great(add, k) {
        const h = 2.6 * u, w = 7 * u * k, d = 3.4 * u * k;
        for (let x = -1; x <= 1; x += .5) for (const z of [-1, 1]) add(sunk(cyl(.14 * u, .16 * u, h + SINK, 5)), L(x * w * .45, 0, z * d * .45), C.wood);
        add(box(w * 1.1, .2 * u, d * 1.2), L(0, h, 0), C.wood); add(box(w, 2.2 * u * tall, d), L(0, h + .2 * u, 0), C.wall);
        add(new THREE.CylinderGeometry(d * .65, d * .65, w * 1.05, 3).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), L(0, h + .2 * u + 2.2 * u * tall + d * .3, 0), C.roof);
        windows(add, w, h + 1.4 * u, d / 2 + .03, 4);
      },
      small(add) { for (const x of [-1, 1]) add(sunk(cyl(.1 * u, .1 * u, 2 * u + SINK, 4)), L(x * u, 0, 0), C.wood); add(box(2.6 * u, 1.3 * u, 1.8 * u), L(0, 2 * u, 0), C.wall); },
    },
    coral: {
      home(add, k) {
        add(sunk(ball(1.3 * u * k, 1)), L(0, .3 * u, 0, 0, 0, 0, 1, .7, 1), C.wall2);
        const n = 4 + Math.floor(r() * 4);
        for (let i = 0; i < n; i++) {
          const a = r() * 6.28, lean = .2 + r() * .5, h = (1.5 + r() * 2.5) * u * k * tall, rad = (.2 + r() * .2) * u * k;
          const m = L(Math.cos(a) * .5 * u * k, 0, Math.sin(a) * .5 * u * k, Math.sin(a) * lean, 0, -Math.cos(a) * lean);
          add(cyl(rad * .6, rad, h, 6), m, i % 2 ? C.wall : C.accent);
          add(ball(rad * 1.1, 0), m.clone().multiply(L(0, h, 0)), i % 2 ? C.wall : C.accent, lights && i === 0);
        }
        add(dome(.55 * u * k, 8), L(0, 0, 1.05 * u * k, Math.PI / 2, 0, 0, 1, 1, .5), C.door);
      },
      great(add, k) { // a great fan, ringed with branches
        add(sunk(cyl(.7 * u, 1 * u, 3 * u * tall * k + SINK, 6)), L(), C.wall2);
        add(ball(4 * u * k, 1), L(0, 3 * u * tall * k + 4 * u * k, 0, 0, 0, 0, 1.15, 1.1, .1), C.accent); add(ring(3.2 * u * k, .2 * u, 16).rotateX(Math.PI / 2), L(0, 3 * u * tall * k + 4 * u * k, .45 * u), C.wall);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, h = (3 + r() * 3) * u * k; add(cyl(.2 * u, .45 * u, h, 6), L(Math.cos(a) * 3 * u * k, 0, Math.sin(a) * 3 * u * k, Math.sin(a) * .25, 0, -Math.cos(a) * .25), C.wall); add(ball(.5 * u, 0), L(Math.cos(a) * 3 * u * k + Math.cos(a) * h * .25, h * .97, Math.sin(a) * 3 * u * k + Math.sin(a) * h * .25), C.wall, lights); }
      },
      small(add) { add(sunk(ball(1.2 * u, 1)), L(0, .4 * u, 0), C.wall); add(cyl(.2 * u, .3 * u, 2 * u, 5), L(), C.accent); },
    },
    shells: {
      home(add, k) {
        let y = 0, rad = 1.3 * u * k, tube = .55 * u * k;
        add(sunk(cyl(rad + tube, rad + tube, SINK, 10)), L(), C.wall2);
        for (let i = 0; i < 4 + Math.round(Math.min(k, 2.6) * 1.5); i++) { add(ring(rad, tube, 10), L(i * .12 * u, y + tube * .7, 0, 0, i * .5), i % 2 ? C.wall : C.wall2); y += tube * 1.15; rad *= .84; tube *= .9; }
        add(cone(rad + tube, 1.2 * u * k, 10), L(0, y + tube * .5, 0), C.accent);
        add(dome(.5 * u * k, 8), L(0, 0, 1.6 * u * k, Math.PI / 2, 0, 0, 1, 1.3, .5), C.door);
        if (lights) add(ball(.25 * u), L(0, y * .6, rad + tube + .1), C.window, true);
      },
      great(add, k) { this.home(add, k * 2.6); },
      small(add) { add(sunk(cyl(1.6 * u, 1.6 * u, SINK)), L(), C.wall2); for (let i = 0; i < 3; i++) add(ring(1.2 * u * (1 - i * .2), .45 * u, 10), L(0, .4 * u + i * .55 * u, 0), C.wall); },
    },
    stiltpods: {
      home(add, k) {
        const h = 2.8 * u * k * tall, rad = 1.3 * u * k;
        for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; rod(add, [Math.cos(a) * rad * 1.2, -SINK, Math.sin(a) * rad * 1.2], [Math.cos(a) * rad * .4, h + .3 * u, Math.sin(a) * rad * .4], .13 * u, C.wood); }
        add(dome(rad, 10), L(0, h, 0, Math.PI, 0, 0, 1, .5, 1), C.wall2); add(dome(rad, 10), L(0, h, 0, 0, 0, 0, 1, .8, 1), C.wall);
        add(cyl(.3 * u, .3 * u, .8 * u, 6), L(0, h - .8 * u, 0), C.door);
        if (lights) add(ring(rad * 1.01, .06 * u, 14), L(0, h + .2 * u, 0), C.window, true);
      },
      great(add, k) { this.home(add, k * 2.4); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 1; add(dome(1.1 * u, 8), L(Math.cos(a) * 3 * u * k, 4 * u * k * tall, Math.sin(a) * 3 * u * k, Math.PI, 0, 0, 1, .6, 1), C.accent); } },
      small(add) { for (let i = 0; i < 3; i++) { const a = i * 2.09; rod(add, [Math.cos(a) * 1.4 * u, -SINK, Math.sin(a) * 1.4 * u], [0, 2.4 * u, 0], .1 * u, C.wood); } add(dome(1.1 * u, 8), L(0, 2.3 * u, 0), C.wall); },
    },
    rings: {
      home(add, k) {
        add(sunk(cyl(2.4 * u * k, 2.4 * u * k, SINK, 14)), L(), C.wall2);
        add(ring(2 * u * k, .5 * u * k, 16), L(0, .45 * u * k, 0, 0, 0, 0, 1, 1.6, 1), C.wall);
        add(cyl(.35 * u, .5 * u, 3 * u * k * tall, 6), L(), C.stone); add(ball(.45 * u), L(0, 3 * u * k * tall, 0), C.accent, lights);
      },
      great(add, k) { for (let i = 0; i < 3; i++) add(ring((3 + i * 3) * u * k, .55 * u, 24), L(0, .5 * u, 0, 0, 0, 0, 1, 1.8, 1), i % 2 ? C.wall2 : C.wall); add(sunk(cyl(.9 * u, 1.3 * u, 10 * u * k * tall + SINK, 6)), L(), C.stone); add(ball(1.1 * u), L(0, 10 * u * k * tall, 0), C.accent, lights); },
      small(add) { add(sunk(cyl(1.8 * u, 1.8 * u, SINK, 12)), L(), C.wall2); add(ring(1.5 * u, .4 * u, 12), L(0, .4 * u, 0), C.wall); },
    },
    tethered: { // drifters: platforms held aloft under gas-bags, tethered to anchors
      home(add, k) {
        const H = (8 + r() * 6) * u * k * tall;
        add(sunk(cyl(.6 * u, .8 * u, .5 * u + SINK, 6)), L(), C.stone);
        rod(add, [0, .4 * u, 0], [0, H, 0], .05 * u, C.line);
        add(cyl(2 * u * k, 1.4 * u * k, .35 * u, 10), L(0, H, 0), C.wall2);
        add(dome(1.2 * u * k, 10), L(0, H + .35 * u, 0, 0, 0, 0, 1, .8, 1), C.wall);
        add(ball(2 * u * k, 1), L(0, H + 3.3 * u * k, 0, 0, 0, 0, 1.25, .75, 1.25), C.bag);
        for (let i = 0; i < 4; i++) { const a = i * 1.57; rod(add, [Math.cos(a) * 1.6 * u * k, H + .3 * u, Math.sin(a) * 1.6 * u * k], [Math.cos(a) * 1.4 * u * k, H + 2.6 * u * k, Math.sin(a) * 1.4 * u * k], .03 * u, C.line); }
        for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = r() * 1.3 * u * k; rod(add, [Math.cos(a) * d, H, Math.sin(a) * d], [Math.cos(a) * d, H - (1 + r() * 2) * u, Math.sin(a) * d], .03 * u, C.accent); }
        if (lights) add(ring(1.95 * u * k, .06 * u, 14), L(0, H + .2 * u, 0), C.window, true);
      },
      great(add, k) { this.home(add, k * 2.3); },
      small(add) { rod(add, [0, -SINK, 0], [0, 7 * u, 0], .06 * u, C.line); add(ball(1.4 * u, 1), L(0, 8 * u, 0, 0, 0, 0, 1.2, .8, 1.2), C.bag); },
    },
    reef: { // drifters: tall frond-stalks hung with bulb dwellings
      home(add, k) {
        const H = (9 + r() * 5) * u * k * tall;
        add(sunk(cyl(.35 * u, .7 * u, H + SINK, 6)), L(), C.wall2);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(box(.1 * u, 3.5 * u * k, .7 * u), L(Math.cos(a) * .4 * u, H * .82, Math.sin(a) * .4 * u, Math.sin(a) * .7, 0, -Math.cos(a) * .7), C.accent); }
        for (let i = 0; i < 3 + Math.round(k * 2); i++) { const a = r() * 6.28, y = H * (.3 + .45 * r()); rod(add, [0, y, 0], [Math.cos(a) * 1.2 * u, y - .6 * u, Math.sin(a) * 1.2 * u], .05 * u, C.wall2); add(ball(.8 * u * k, 1), L(Math.cos(a) * 1.3 * u, y - 1.4 * u, Math.sin(a) * 1.3 * u, 0, 0, 0, 1, 1.3, 1), C.wall, lights && i % 2 === 0); }
      },
      great(add, k) { this.home(add, k * 2.2); },
      small(add) { add(sunk(cyl(.25 * u, .5 * u, 7 * u + SINK, 5)), L(), C.wall2); add(ball(.9 * u, 1), L(0, 5 * u, .9 * u), C.wall); },
    },
    masts: {
      home(add, k) {
        const h = (6 + r() * 3) * u * tall * k;
        add(sunk(cyl(.12 * u, .22 * u, h + SINK, 6)), L(), C.wood);
        const pods = 3 + Math.floor(r() * 3);
        for (let i = 0; i < pods; i++) {
          const a = i / pods * Math.PI * 2 + r(), y = h * (.45 + .5 * i / pods), arm = .9 * u;
          rod(add, [0, y, 0], [Math.cos(a) * arm, y, Math.sin(a) * arm], .04 * u, C.wood);
          add(ball(.55 * u * k, 1), L(Math.cos(a) * arm, y - .7 * u, Math.sin(a) * arm, 0, 0, 0, 1, 1.35, 1), i % 2 ? C.wall : C.accent, lights && i === 0);
        }
      },
      great(add, k) { this.home(add, k * 2.2); },
      small(add) { add(sunk(cyl(.1 * u, .15 * u, 5 * u + SINK, 5)), L(), C.wood); add(ball(.6 * u, 1), L(.6 * u, 3.6 * u, 0), C.wall); },
    },
    hive: {
      home(add, k) {
        const cell = .6 * u * k, cells = k > 1.2 ? 7 : 4 + Math.floor(r() * 3), dirs = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3)])];
        for (let i = 0; i < cells; i++) {
          const [x, z] = dirs[i], h = (1.2 + r() * 1.6) * u * k * tall * (i ? 1 : 1.4);
          add(sunk(cyl(cell, cell, h + SINK, 6)), L(x * cell * 1.75, 0, z * cell * 1.75, 0, Math.PI / 6), i % 2 ? C.wall : C.wall2);
          add(cyl(cell * .7, cell * .7, .05, 6), L(x * cell * 1.75, h + .01, z * cell * 1.75, 0, Math.PI / 6), C.door, false);
          if (lights && i % 3 === 0) add(cyl(cell * .5, cell * .5, .06, 6), L(x * cell * 1.75, h + .03, z * cell * 1.75, 0, Math.PI / 6), C.window, true);
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
        if (k > 1.2 || r() < .4) { // banded spire
          let y = 0, rad = 1.8 * u * Math.min(k, 1.4);
          footing(add, rad, C.wall); add(cyl(rad * 1.25, rad * 1.45, .9 * u, 7), L(), C.wall2);
          for (let i = 0; i < 4; i++) { const h = (2.9 - i * .35) * u * tall * k; add(cyl(rad * .74, rad, h, 7), L(0, y, 0, 0, i * .4), i % 2 ? C.wall2 : C.wall); add(cyl(rad * .76, rad * .78, .18 * u, 7), L(0, y + h * .92, 0, 0, i * .4), C.accent); if (lights) add(dome(.25 * u, 6), L(rad * .85, y + h * .5, 0, 0, 0, -Math.PI / 2, 1, .4, 1), C.window, true); y += h; rad *= .74; }
          add(cone(rad, 1.2 * u * tall, 7), L(0, y, 0), C.accent);
        } else {
          const h = 3.4 * u * tall * k, rad = 2 * u * k;
          add(sunk(cone(rad, h + SINK, 7)), L(0, 0, 0, 0, r() * 6), C.wall);
          for (let i = 0; i < 3; i++) { const a = r() * 6.28, s = .4 + r() * .35; add(sunk(cone(rad * s, h * s + SINK, 6)), L(Math.cos(a) * rad * .7, 0, Math.sin(a) * rad * .7), C.wall2); }
          add(dome(.55 * u * k, 8), L(0, 0, rad * .72, Math.PI / 2, 0, 0, 1, 1, .5), C.door);
          add(cyl(rad * .32, rad * .36, .25 * u, 7), L(0, h * .55, 0), C.accent);
        }
      },
      great(add, k) { this.home(add, k * 2.2); },
      small(add) { add(sunk(cone(1.6 * u, 3 * u + SINK, 6)), L(), C.wall); },
    },
    silk: {
      home(add, k) {
        const rad = 1.6 * u * k, h = 2.8 * u * k * tall;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; rod(add, [Math.cos(a) * rad, -SINK, Math.sin(a) * rad], [Math.cos(a) * rad * .2, h * 1.2, Math.sin(a) * rad * .2], .05 * u, C.wood); rod(add, [Math.cos(a) * rad * .3, h * 1.1, Math.sin(a) * rad * .3], [Math.cos(a) * rad * 2, 0, Math.sin(a) * rad * 2], .015 * u, C.wall); }
        add(sunk(cyl(rad * .9, rad * .9, SINK, 8)), L(), C.wall2);
        add(cone(rad, h, 8), L(), C.wall, lights);
        add(box(.5 * u, .7 * u, .05), L(0, 0, rad * .62, -.5), C.door);
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
      home(add, k) {
        const rad = 1.1 * u * k;
        add(sunk(cyl(rad * 1.6, rad * 1.8, .25 * u + SINK, 10)), L(), C.wall2); add(ring(rad * 1.3, .3 * u * k, 12), L(0, .25 * u, 0), C.wall);
        add(cyl(rad, rad, .04, 12), L(0, .27 * u, 0), C.door, false);
        add(cyl(rad * 1.05, rad * 1.05, .1 * u, 12), L(0, .3 * u, -rad, -1.1, 0, 0).multiply(L(0, 0, rad)), C.wall);
        add(cone(.3 * u, 1.6 * u * k, 6), L(rad * 1.3, 0, -rad), C.wall2);
        if (lights) add(cyl(rad * .6, rad * .6, .06, 10), L(0, .29 * u, 0), C.window, true);
      },
      great(add, k) { add(sunk(cyl(6 * u * k, 6.5 * u * k, .4 * u + SINK, 20)), L(), C.wall2); add(ring(5 * u * k, .8 * u, 22), L(0, .5 * u, 0), C.wall); add(ring(3 * u * k, .5 * u, 18), L(0, .4 * u, 0), C.wall); add(sunk(cyl(.8 * u, 1.2 * u, 9 * u * k * tall + SINK, 7)), L(), C.wall2); for (let y = 2; y < 9 * k * tall; y += 1.8) add(ring(.95 * u, .12 * u, 8), L(0, y * u, 0), lights ? C.window : C.door, lights); },
      small(add) { add(sunk(cyl(1.5 * u, 1.6 * u, .3 * u + SINK, 10)), L(), C.wall2); add(cyl(1 * u, 1 * u, .05, 10), L(0, .3 * u, 0), C.door); },
    },
    burrows: {
      home(add, k) {
        const rad = 1.8 * u * k;
        add(sunk(dome(rad, 10).scale(1, .55, 1)), L(0, SINK * .4, 0), C.wall);
        add(box(1 * u * k, .1 * u, 2.4 * u * k), L(0, .25 * u, rad * .9, .35, 0, 0), C.wall2);
        add(dome(.6 * u * k, 8), L(0, .1 * u, rad * .7, Math.PI / 2, 0, 0, 1, 1, .4), C.door);
        add(cyl(.35 * u * k, .35 * u * k, .1, 8), L(0, rad * .55, 0), lights ? C.window : C.wall2, lights);
        add(cone(.25 * u, 1 * u * k, 6), L(-rad * .5, rad * .3, -rad * .3), C.wall2);
      },
      great(add, k) { // terraced amphitheatre bowl
        for (let i = 0; i < 4; i++) add(ring((2.5 + i * 1.8) * u * k, .8 * u, 22), L(0, i * .9 * u * tall, 0, 0, 0, 0, 1, 1.2, 1), i % 2 ? C.wall2 : C.wall);
        add(sunk(cyl(9.5 * u * k, 9.5 * u * k, SINK, 22)), L(), C.wall2); add(cyl(2 * u * k, 2 * u * k, .1, 14), L(0, .05, 0), C.door);
        if (lights) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(ball(.3 * u), L(Math.cos(a) * 8.6 * u * k, 3.2 * u, Math.sin(a) * 8.6 * u * k), C.window, true); }
      },
      small(add) { add(sunk(dome(1.5 * u, 8).scale(1, .5, 1)), L(0, SINK * .4, 0), C.wall); },
    },
    perches: {
      home(add, k) {
        const h = (4.5 + r() * 3) * u * tall * k, nests = k > 1.2 ? 3 : 1;
        add(sunk(cyl(.16 * u * k, .3 * u * k, h + SINK, 6)), L(0, 0, 0, (r() - .5) * .08, 0, (r() - .5) * .08), C.wood);
        for (let i = 0; i < nests; i++) {
          const y = h * (1 - i * .28), a = i * 2.2, off = i ? 1.1 * u : 0;
          if (i) rod(add, [0, y - .5 * u, 0], [Math.cos(a) * off, y, Math.sin(a) * off], .06 * u, C.wood);
          add(ring(.75 * u, .22 * u, 10), L(Math.cos(a) * off, y, Math.sin(a) * off), C.roof);
          add(cyl(.7 * u, .6 * u, .12 * u, 8), L(Math.cos(a) * off, y - .15 * u, Math.sin(a) * off), C.wood);
          if (lights) add(ball(.2 * u), L(Math.cos(a) * off, y + .2 * u, Math.sin(a) * off), C.window, true);
        }
      },
      great(add, k) { // a perch-tree: thick trunk, nests at every height
        const h = 14 * u * k * tall;
        add(sunk(cyl(.6 * u, 1.2 * u, h + SINK, 7)), L(), C.wood);
        for (let i = 0; i < 7; i++) { const a = i * 2.4, y = h * (.35 + i * .1), off = 2 * u; rod(add, [0, y - u, 0], [Math.cos(a) * off, y, Math.sin(a) * off], .12 * u, C.wood); add(ring(.9 * u, .26 * u, 10), L(Math.cos(a) * off, y, Math.sin(a) * off), C.roof); }
      },
      small(add) { add(sunk(cyl(.12 * u, .2 * u, 4 * u + SINK, 5)), L(), C.wood); add(ring(.6 * u, .2 * u, 8), L(0, 4 * u, 0), C.roof); },
    },
    rookery: {
      home(add, k) {
        const h = (5 + r() * 3) * u * tall * k, rad = 1.3 * u * k;
        add(sunk(cyl(rad * .7, rad, h + SINK, 7)), L(0, 0, 0, 0, r() * 6), C.wall);
        for (let y = 1.2 * u; y < h - .5 * u; y += 1.1 * u) { const a = r() * 6.28, rr = rad * (1 - y / h * .3); add(box(1.1 * u, .12 * u, .6 * u), L(Math.cos(a) * rr, y, Math.sin(a) * rr, 0, -a + Math.PI / 2), C.wall2); add(dome(.28 * u, 6), L(Math.cos(a + .5) * rr * .98, y + .4 * u, Math.sin(a + .5) * rr * .98, 0, -a - .5, -Math.PI / 2, 1, .5, 1), lights ? C.window : C.door, lights); }
        add(ring(rad * .7, .2 * u, 10), L(0, h, 0), C.roof);
      },
      great(add, k) { this.home(add, k * 2.4); },
      small(add) { add(sunk(cyl(.8 * u, 1 * u, 4 * u + SINK, 6)), L(), C.wall); },
    },
    hanging: {
      home(add, k) {
        const w = 2.4 * u * k, h = 4.5 * u * k * tall;
        for (const x of [-1, 1]) add(sunk(cyl(.14 * u, .2 * u, h + SINK, 5)), L(x * w, 0, 0, 0, 0, x * .06), C.wood);
        add(box(w * 2.3, .22 * u, .3 * u), L(0, h, 0), C.wood);
        for (let i = 0; i < 3; i++) { const x = (i - 1) * w * .65, drop = (1.2 + r()) * u; rod(add, [x, h, 0], [x, h - drop, 0], .03 * u, C.line); add(ball(.55 * u * k, 1), L(x, h - drop - .8 * u * k, 0, 0, 0, 0, 1, 1.5, 1), i % 2 ? C.roof : C.wall); add(dome(.15 * u, 6), L(x, h - drop - 1.3 * u * k, .45 * u * k, Math.PI / 2, 0, 0, 1, 1, .4), lights ? C.window : C.door, lights); }
      },
      great(add, k) { this.home(add, k * 2.3); },
      small(add) { add(sunk(cyl(.12 * u, .15 * u, 3.5 * u + SINK, 5)), L(), C.wood); add(ball(.6 * u, 1), L(.5 * u, 2.4 * u, 0, 0, 0, 0, 1, 1.5, 1), C.roof); },
    },
    earthworks: {
      home(add, k) { // turf-roofed barrow with a stone doorway
        const len = 4 * u * k, rad = 1.4 * u * k;
        add(new THREE.CylinderGeometry(rad, rad, len, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 0, 0), L(0, -.1 * u, 0, 0, 0, 0, 1, .85 * tall, 1), C.turf);
        add(sunk(box(rad * 2, SINK, len)), L(), C.turf);
        add(box(1 * u, 1.3 * u * k, .3 * u), L(0, 0, len / 2), C.stone); add(box(.6 * u, .9 * u * k, .06), L(0, 0, len / 2 + .16 * u), C.door);
        for (const x of [-1, 1]) add(box(.4 * u, .8 * u, .4 * u), L(x * .75 * u, 0, len / 2 + .15 * u), C.stone2);
        windows(add, u, .7 * u, len / 2 + .2 * u, 1);
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
      home(add, k) {
        const rad = 1.6 * u * k, h = 2.6 * u * k * tall;
        for (let i = 0; i < 7; i++) { if (i === 0) continue; const a = i / 7 * Math.PI * 2 + Math.PI / 2; rod(add, [Math.cos(a) * rad, -SINK, Math.sin(a) * rad], [Math.cos(a) * rad * .2, h, Math.sin(a) * rad * .2], .16 * u * k, C.wood); }
        for (let i = 0; i < 5; i++) add(ball((.9 + r() * .5) * u * k, 1), L((r() - .5) * rad, h + (r() - .2) * .8 * u, (r() - .5) * rad), C.leaf);
        if (lights) add(ball(.3 * u), L(0, h * .4, 0), C.window, true);
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
        const rad = 1.5 * u * k;
        footing(add, rad, C.wall); add(cyl(rad, rad, .35 * u, 12), L(), C.wall2);
        add(dome(rad, 12), L(0, .35 * u, 0, 0, 0, 0, 1, tall, 1), C.wall);
        add(box(.65 * u * k, .95 * u * k, .5 * u), L(0, 0, rad * .85), C.door);
        if (lights) add(ring(rad * .5, .05 * u, 12), L(0, .35 * u + rad * tall * .85, 0), C.window, true);
      },
      great(add, k) { this.home(add, k * 2.5); for (let i = 0; i < 4; i++) { const a = i * 1.57 + .7, d = 3.6 * u * k; add(dome(1.4 * u * k, 10), L(Math.cos(a) * d, 0, Math.sin(a) * d), C.wall2); } },
      small(add) { add(sunk(cyl(1.3 * u, 1.3 * u, SINK, 10)), L(), C.wall2); add(dome(1.3 * u, 10), L(), C.wall); },
    },
    tracks: { // rollers: wheel-shaped houses
      home(add, k) {
        const rad = 1.7 * u * k;
        add(sunk(box(rad * 1.4, .4 * u + SINK, 1.2 * u * k)), L(), C.wall2);
        add(new THREE.TorusGeometry(rad, .5 * u * k, 6, 16), L(0, rad + .3 * u, 0), C.wall);
        add(cyl(.6 * u * k, .6 * u * k, 1.1 * u * k, 10).rotateX(Math.PI / 2).translate(0, 0, -.55 * u * k), L(0, rad + .3 * u, 0), lights ? C.window : C.wall2, lights);
        for (let i = 0; i < 6; i++) rod(add, [0, rad + .3 * u, 0], [Math.cos(i * 1.05) * rad, rad + .3 * u + Math.sin(i * 1.05) * rad, 0], .08 * u, C.wall2);
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
    rail(add) { // a launch rail climbing a tall tower
      const h = 26 * u * tall, run = 26 * u;
      add(sunk(cyl(1.5 * u, 2.2 * u, h + SINK, 7)), L(-run, 0, 0), C.wall);
      const ang = Math.atan2(h, run), len = Math.hypot(h, run);
      add(box(.6 * u, .5 * u, len).translate(0, 0, len / 2), L(0, .3 * u, 0, -ang, -Math.PI / 2, 0), C.metal);
      for (let i = 1; i < 6; i++) add(sunk(cyl(.2 * u, .3 * u, h * i / 6 + SINK, 5)), L(-run * i / 6, 0, 0), C.metal2);
      add(cone(.8 * u, 3 * u, 8), L(-run * .3, h * .3 + 1.2 * u, 0, 0, 0, Math.PI / 2 - ang), C.hull);
      add(ball(.5 * u), L(-run, h + .6 * u, 0), C.beacon, true);
    },
    track(add) { // a long ramp that throws craft upward
      const run = 60 * u, h = 16 * u * tall, ang = Math.atan2(h, run), len = Math.hypot(run, h);
      add(box(2.2 * u, .7 * u, len).translate(0, 0, len / 2), L(0, .2 * u, 0, -ang, 0, 0), C.metal);
      for (let i = 1; i < 8; i++) add(sunk(box(.6 * u, h * i / 8 + SINK, .6 * u)), L(0, 0, run * i / 8), C.metal2);
      add(box(1.6 * u, 1.2 * u, 4 * u), L(0, .9 * u, 4 * u, -ang, 0, 0), C.hull);
      for (let i = 0; i < 12; i++) add(box(2.4 * u, .1 * u, .3 * u), L(0, .95 * u + (len * i / 12) * Math.sin(ang), (len * i / 12) * Math.cos(ang)), C.window, true);
    },
  }[{ hands: 'rocket', tentacles: 'grown', tripods: 'cradle', drifters: 'tether', hive: 'silo', web: 'silo', burrowers: 'silo', nests: 'rail', grazers: 'track', rollers: 'track' }[civ.family]];
  const launchFoot = { rocket: 5.5, grown: 3.5, cradle: 7.5, tether: 5.5, silo: 6.5, rail: 4, track: 4 }[{ hands: 'rocket', tentacles: 'grown', tripods: 'cradle', drifters: 'tether', hive: 'silo', web: 'silo', burrowers: 'silo', nests: 'rail', grazers: 'track', rollers: 'track' }[civ.family]] * u;

  // --- Where to build -------------------------------------------------------
  const aloft = civ.family === 'drifters';
  const groundOk = (n, span) => {
    let lo = Infinity, hi = -Infinity; const f = frameAt(n);
    for (let k = 0; k < 9; k++) { const m = k ? pointAt(f, span * (k > 4 ? 1 : .5), k * Math.PI / 4) : n; if (terrain.isLiquid(m)) return Infinity; const h = terrain.surface(m); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return hi - lo;
  };
  const full = ([0, 10, 16, 26, 32, 32][level]) * u, chosen = [];
  for (const k of [1, .6, .35, .18]) {
    const span = full * k;
    for (const home of homes.slice(0, 4)) {
      if (chosen.includes(home)) continue;
      const f = frameAt(home); let best = null, bestScore = Infinity;
      for (let d = 0; d <= 120; d += 8) for (let j = 0; j < 12; j++) {
        const n = pointAt(f, d, j / 12 * Math.PI * 2 + d * .1), fromSignal = n.angleTo(signalNormal) * radius;
        if (fromSignal < Math.min(span, 40) + 26 || fromSignal > 220 || n.angleTo(landingNormal) * radius < Math.min(span, 40) + 26) continue;
        if (chosen.some(c => c.angleTo(n) * radius < (span + full) * 1.1)) continue;
        const score = groundOk(n, span) * (aloft ? .4 : 1) + d * .015;
        if (score < bestScore) { bestScore = score; best = n; }
      }
      if (best && bestScore < 2 + span * .25) { home.copy(best); chosen.push(home); }
    }
    if (chosen.length) break;
  }
  if (!chosen.length) return none;

  // --- Layout ----------------------------------------------------------------
  const frames = chosen.map(frameAt), main = frames[0];
  for (const f of frames) sites.push(f.home.clone());
  const foot = (k) => 2 * u * k * (civ.culture === 'terraced' ? 1.2 : 1);
  const home = (k) => (add) => style.home(add, k), great = (k) => (add) => style.great(add, k);
  if (level === 1) {
    for (const f of frames.slice(0, 3)) {
      if (civ.hearths) settle(f, 2 * u, r() * 6, 1.1 * u, .3, common.hearth);
      for (let i = 0, n = 1 + Math.floor(r() * 2); i < n; i++) settle(f, (4 + r() * 4) * u, r() * 6.28, foot(.5), 2 * u, home(.5), { aloft });
      for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) settle(f, (7 + r() * 9) * u, r() * 6.28, .7 * u, 2 * u, common.cairn, { face: false });
    }
  } else {
    // Rings of dwellings around the centrepiece; cities are denser and bigger.
    const rings = level === 2 ? [[8.5, 7]] : level === 3 ? [[10, 8], [17, 11], [24, 7]] : [[11, 9], [18, 13], [25, 16], [32, 12]];
    const gk = [0, 0, .6, 1.2, 1.7, 1.9][level];
    settle(main, 0, 0, Math.max(2, 5 * u * gk), 6 * u, great(gk), { face: false, aloft });
    if (civ.hearths) settle(main, (level === 2 ? 3.4 : 6) * u, r() * 6, 1.1 * u, .3, common.hearth);
    rings.forEach(([d, n], ri) => {
      const k = level === 2 ? .9 + r() * .2 : 1.45 - ri * .12;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + ri * .37 + (r() - .5) * .2; settle(main, d * u + r() * 1.5 * u, a, foot(k), 4 * u, home(k), { aloft }); }
    });
    if (civ.fields) for (let i = 0; i < (level === 2 ? 2 : 5); i++) settle(main, (rings.at(-1)[0] + 7) * u + i * 2, r() * 6.28, 4, .2, common.field);
    // Smaller towns at the other homes.
    for (const f of frames.slice(1)) {
      settle(f, 0, 0, Math.max(2, 4 * u * gk * .6), 4 * u, great(gk * .6), { face: false, aloft });
      for (let i = 0, n = level === 2 ? 3 : 6; i < n; i++) settle(f, (level === 2 ? 6 : 9) * u, i / n * 6.28 + r(), foot(1), 4 * u, home(1), { aloft });
    }
    if (level >= 5 && launch) settle(main, (rings.at(-1)[0] + 16) * u, r() * 6.28, launchFoot, 12 * u, launch, { face: false });
  }
  // Paths and roads: walkers pave, others mark their way with stones.
  const paves = WALKERS.includes(civ.family) && level >= 3;
  const trail = (from, to, step) => {
    const d = from.angleTo(to) * radius;
    if (d > 260) return;
    for (let s = (level >= 3 ? 6 : 14) * u; s < d - 6 * u; s += step) {
      const n = from.clone().lerp(to, s / d).normalize(), g = frameAt(n);
      if (paves) place({ ...g, home: n }, 0, 0, .9 * u, .1, common.slab, { face: false, road: true });
      else place({ ...g, home: n }, 1.6 * u, 0, .5 * u, 2 * u, common.marker, { face: false });
    }
  };
  for (const f of frames.slice(1)) trail(main.home, f.home, paves ? 1.6 * u : 11 * u);
  if (paves) { // avenues from the centre, and for planet-shapers roads to the horizon
    const len = level >= 4 ? 230 : 30 * u;
    for (let i = 0; i < (level >= 4 ? 6 : 4); i++) { const a = i / (level >= 4 ? 6 : 4) * Math.PI * 2 + .3, n = pointAt(main, len, a); trail(main.home, n, 1.6 * u); }
    if (level >= 4) for (let i = 0; i < 10; i++) place(main, (12 + r() * 25) * u, r() * 6.28, .5 * u, 2.4 * u, common.light, { face: false });
  }
  // Planet-shapers: towns all over the world, lit at night.
  if (level >= 4) {
    const wr = rng(body.seed, 'structures-world');
    let towns = 0;
    for (let i = 0; i < 1400 && towns < 260 && lit.count() < BUDGET; i++) {
      const y = wr() * 2 - 1, b = wr() * Math.PI * 2, s = Math.sqrt(1 - y * y), n = V(Math.cos(b) * s, y, Math.sin(b) * s);
      if (n.angleTo(signalNormal) * radius < 260 || terrain.isLiquid(n)) continue;
      const f = frameAt(n);
      if (place({ ...f, home: n }, 0, 0, 2.5 * u, 0, (add) => { style.small(add); add(ball(.9 * u), L(2 * u, 1.2 * u, 0), C.window, true); }, { face: false, spacing: .5 })) towns++;
    }
  }

  // Spacefarers: satellites and a station in orbit.
  let sats = null, station = null;
  if (level >= 5) {
    const g = merger(THREE);
    g.add(new THREE.BoxGeometry(1.2, 1.2, 2), new THREE.Matrix4(), C.metal2);
    g.add(new THREE.BoxGeometry(5, .08, 1.4), new THREE.Matrix4(), '#2a3f6b');
    const count = 12;
    sats = new THREE.InstancedMesh(g.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .5, flatShading: true }), count);
    sats.orbits = Array.from({ length: count }, () => ({ axis: V(r() - .5, r() - .5, r() - .5).normalize(), start: V(r() - .5, r() - .5, r() - .5).normalize(), rad: radius * (1.25 + r() * .6), speed: (.02 + r() * .03) * (r() < .5 ? -1 : 1) }));
    for (const o of sats.orbits) o.start.addScaledVector(o.axis, -o.start.dot(o.axis)).normalize();
    sats.frustumCulled = false; group.add(sats);
    const sg = merger(THREE);
    sg.add(new THREE.TorusGeometry(12, 1.6, 6, 24), new THREE.Matrix4(), C.metal2);
    for (let i = 0; i < 4; i++) sg.add(new THREE.CylinderGeometry(.4, .4, 12, 5), new THREE.Matrix4().makeRotationZ(i * Math.PI / 4 + Math.PI / 2).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0)), C.metal);
    sg.add(new THREE.CylinderGeometry(2.4, 2.4, 5, 10).rotateX(Math.PI / 2), new THREE.Matrix4(), C.hull);
    sg.add(new THREE.TorusGeometry(12, .3, 4, 24), new THREE.Matrix4().makeTranslation(0, 0, 1.7), C.window);
    station = new THREE.Mesh(sg.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .4, flatShading: true, emissive: 0x332200 }));
    station.orbit = { axis: V(r() - .5, 1, r() - .5).normalize(), start: V(1, 0, 0), rad: radius * 1.7 };
    station.orbit.start.addScaledVector(station.orbit.axis, -station.orbit.start.dot(station.orbit.axis)).normalize();
    station.frustumCulled = false; group.add(station);
  }
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  function update(t) {
    if (sats) {
      sats.orbits.forEach((o, i) => { p.copy(o.start).applyAxisAngle(o.axis, t * o.speed).multiplyScalar(o.rad); m.makeRotationAxis(o.axis, t * o.speed).setPosition(p); sats.setMatrixAt(i, m); });
      sats.instanceMatrix.needsUpdate = true;
    }
    if (station) { const o = station.orbit; station.position.copy(o.start).applyAxisAngle(o.axis, t * .012).multiplyScalar(o.rad); station.quaternion.setFromUnitVectors(V(0, 0, 1), o.axis); station.rotateZ(t * .1); }
  }
  update(0);

  if (!placed.length) return none;
  const litMesh = new THREE.Mesh(lit.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9 }));
  const glowMesh = new THREE.Mesh(glow.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  for (const mesh of [litMesh, glowMesh]) { mesh.frustumCulled = false; group.add(mesh); }
  // Ground the builders have cleared: their settlements and each piece's footprint.
  const clearings = [...placed.filter(p => !p.road || level >= 3).map(p => ({ n: p.n, r: p.foot + 1.5 })), ...sites.map((n, i) => ({ n, r: (i ? .5 : 1) * ([0, 6, 12, 26, 34, 34][level]) * u }))];
  return { group, civ, obstacles, sites, clearings, pieces: placed.length, update };
}

// Colours from the world and the builders: stone from its rock, walls from the
// culture's material, accents from the species' own colours.
function colours(THREE, body, civ) {
  const c = (hex) => new THREE.Color(hex), mix = (a, b, t) => '#' + c(a).lerp(c(b), t).getHexString();
  const rock = body.rock, sp = civ.species.colors || {}, prim = sp.primary || '#c0503a', sec = sp.secondary || sp.accent || '#d8c07a';
  const wall = {
    wood: mix('#7b5a3c', rock, .25), ice: mix('#cfe6f2', body.atmosphere, .15), adobe: mix('#c99a6b', body.palette[3], .3), glass: mix('#9fe3e6', prim, .3), stone: mix(rock, '#b9b2a6', .35),
    grown: mix(prim, '#f0b8a0', .35), shell: mix('#efe3d0', prim, .2), silk: mix('#f2f0ea', body.atmosphere, .1), wax: mix('#d9a441', prim, .2), living: mix('#6b4a2f', rock, .2), membrane: mix(prim, '#ffffff', .45),
  }[civ.material];
  const leaf = mix(body.palette[1] || '#4f7a3a', '#4fa83a', .4);
  return {
    stone: mix(rock, '#8d8a85', .3), stone2: mix(rock, '#5c5a58', .4), wall, wall2: mix(wall, '#000', .18),
    wood: mix('#6b4a2f', rock, .2), roof: civ.material === 'ice' ? mix(wall, '#ffffff', .3) : mix(body.palette[1] || '#8a7a4a', '#6b5a33', .5),
    door: '#1a1410', accent: prim, accent2: sec, soil: mix(body.palette[2] || '#5a4630', '#3a2a1a', .6), crop: mix(body.palette[1] || '#4f7a3a', '#6bd44f', .35),
    turf: mix(body.palette[1] || '#6b8a4a', '#55703a', .4), leaf, bag: mix(sec, '#ffffff', .35), line: '#3a3330', road: mix(rock, '#77736c', .5),
    ember: '#ff7a2a', flame: '#ffc46b', window: civ.species.glow ? mix('#ffd98a', sp.glow || prim, .4) : '#ffd98a', beacon: '#ff4a4a',
    metal: '#9aa5ad', metal2: '#d7dde1', concrete: '#8b8f91', scorch: '#2b2b2b', hull: '#eef1f2',
  };
}

// Collects geometry pieces (baked into world space with a colour) and merges them.
function merger(THREE) {
  const pos = [], nor = [], col = [], tmp = new THREE.Color();
  return {
    add(g, matrix, colour) {
      const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(matrix);
      const P = geo.attributes.position, N = geo.attributes.normal;
      tmp.set(colour);
      for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(tmp.r, tmp.g, tmp.b); }
      geo.dispose(); if (g !== geo) g.dispose();
    },
    count: () => pos.length / 3,
    geometry() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return geo;
    },
  };
}
