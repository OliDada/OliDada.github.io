// Builds what an intelligent species has made (structures.mjs) around its herds'
// homes near the site: cairns, standing-stone trails, shelters and hearths for tool
// users; whole settlements for builders (dwellings around a monument, walls, fields);
// lit towers, radio dishes, a launch site and satellites for spacefarers.
// Every piece is merged into two meshes (one lit, one glowing), so a town costs two
// draw calls. Footings reach into the ground so nothing floats on a slope. THREE is passed in.
import { rng } from './rng.mjs';
import { civilizationFor } from './structures.mjs';

const SINK = 1.6; // metres every footing reaches below the lowest ground it stands on

export function buildStructures(THREE, { body, terrain, radius, signalNormal, landingNormal, fauna }) {
  const group = new THREE.Group(), obstacles = [], sites = [];
  const civ = fauna ? civilizationFor(body, fauna.species) : null;
  const homes = civ ? fauna.homes?.get(civ.species.id) || [] : [];
  const none = { group, civ: null, obstacles, sites, update() {} };
  if (!civ || !homes.length) return none;

  const r = rng(body.seed, 'structures', civ.species.id), u = civ.unit, tall = civ.tall;
  const C = colours(THREE, body, civ, r);
  const lit = merger(THREE), glow = merger(THREE);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(sx, sy, sz));
  // Geometry helpers, base at y = 0 (footings go below).
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0);
  const cone = (rad, h, seg = 8) => new THREE.ConeGeometry(rad, h, seg, 1).translate(0, h / 2, 0);
  const ball = (rad, d = 0) => new THREE.IcosahedronGeometry(rad, d);
  const dome = (rad, seg = 10) => new THREE.SphereGeometry(rad, seg, Math.max(4, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2);
  const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

  // --- Placement -------------------------------------------------------------
  // place(home, distance m, angle, footprint radius, height, build): finds the ground,
  // stands the piece upright facing the home's centre, and lets build() add parts in
  // local coordinates. Returns false (and builds nothing) on water, steep ground, or
  // too close to the signal or the landing pad.
  const placed = [];
  function frameAt(home) {
    const east = new THREE.Vector3(0, 1, 0).cross(home); if (east.lengthSq() < 1e-6) east.set(1, 0, 0).cross(home);
    east.normalize(); return { home, east, north: home.clone().cross(east).normalize() };
  }
  function pointAt(f, dist, angle) {
    const dir = f.east.clone().multiplyScalar(Math.cos(angle)).addScaledVector(f.north, Math.sin(angle)), a = dist / radius;
    return f.home.clone().multiplyScalar(Math.cos(a)).addScaledVector(dir, Math.sin(a)).normalize();
  }
  function place(f, dist, angle, foot, height, build, { face = true, spacing = 1 } = {}) {
    const n = pointAt(f, dist, angle);
    if (n.angleTo(signalNormal) * radius < 14 + foot || n.angleTo(landingNormal) * radius < 16 + foot) return false;
    for (const p of placed) if (p.n.angleTo(n) * radius < (p.foot + foot) * spacing) return false;
    const fr = frameAt(n);
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < 5; k++) {
      const m = k ? pointAt(fr, foot, k * Math.PI / 2) : n;
      if (terrain.isLiquid(m)) return false;
      const h = terrain.surface(m); lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    if (hi - lo > SINK * .9 + foot * .5) return false; // too steep: the footing would show
    const up = n, fwd = face && dist > .5 ? f.home.clone().sub(n).addScaledVector(n, -f.home.clone().sub(n).dot(n)).normalize() : fr.north;
    const right = up.clone().cross(fwd).normalize();
    const base = new THREE.Matrix4().makeBasis(right, up, fwd).setPosition(n.clone().multiplyScalar(radius + lo));
    const add = (g, local, colour, bright = false) => (bright ? glow : lit).add(g, mat4.multiplyMatrices(base, local), colour);
    build(add);
    placed.push({ n, foot });
    if (height > .35) obstacles.push({ p: n.clone().multiplyScalar(radius + lo), r: foot * .8, h: height }); // fields and hearths are walked over
    return true;
  }
  // Tries a few angles around the intended one, so a crowded or wet spot shifts rather than vanishing.
  const settle = (f, dist, angle, foot, height, build, opts) => { for (let k = 0; k < 6; k++) if (place(f, dist + (k >> 1) * foot * .6, angle + (k % 2 ? 1 : -1) * k * .17, foot, height, build, opts)) return true; return false; };

  // --- Pieces ----------------------------------------------------------------
  const footing = (add, w, colour) => add(cyl(w, w * 1.05, SINK, 8).translate(0, -SINK, 0), L(), colour);
  const P = {
    cairn(add) {
      let y = 0; const k = 3 + Math.floor(r() * 3);
      add(cyl(.55 * u, .6 * u, SINK).translate(0, -SINK, 0), L(), C.stone);
      for (let i = 0; i < k; i++) { const s = .5 * u * (1 - i * .16); add(ball(s), L((r() - .5) * .1 * u, y + s * .45, 0, 0, r() * 6, 0, 1, .55, 1), i % 2 ? C.stone : C.stone2); y += s * .8; }
      if (r() < .5) add(box(.12 * u, .5 * u, .12 * u), L(0, y, 0), C.accent);
    },
    marker(add) {
      add(box(.4 * u, 1.5 * u * tall + SINK, .28 * u).translate(0, -SINK, 0), L(0, 0, 0, (r() - .5) * .1, 0, (r() - .5) * .1), C.stone);
      add(box(.42 * u, .16 * u, .3 * u), L(0, 1.05 * u * tall, 0), C.accent);
    },
    standing(add) { add(box(.6 * u, 2.2 * u * tall + SINK, .4 * u).translate(0, -SINK, 0), L(0, 0, 0, (r() - .5) * .08, r() * .3, 0), C.stone); },
    hearth(add) {
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(ball(.22 * u), L(Math.cos(a) * .7 * u, .08 * u, Math.sin(a) * .7 * u, 0, a, 0, 1, .6, 1), C.stone2); }
      add(cyl(.45 * u, .5 * u, .06 * u, 8), L(0, .02 * u, 0), C.ember, true);
      for (let i = 0; i < 3; i++) add(cone(.12 * u, .5 * u, 4), L((r() - .5) * .3 * u, .05 * u, (r() - .5) * .3 * u, (r() - .5) * .3, 0, (r() - .5) * .3), C.flame, true);
    },
    shelter(add) { // lean-to of poles and a slanted roof
      for (const x of [-.9, .9]) add(cyl(.06 * u, .07 * u, 1.7 * u * tall + SINK, 5).translate(0, -SINK, 0), L(x * u, 0, -.5 * u), C.wood);
      add(box(2.1 * u, .08 * u, 1.9 * u), L(0, .85 * u * tall, .05 * u, -.75, 0, 0), C.roof);
    },
    hut(add) {
      const h = 1.6 * u * tall, rad = 1.25 * u;
      footing(add, rad, C.wall); add(cyl(rad, rad * 1.04, h, 9), L(), C.wall);
      add(cone(rad * 1.3, 1.3 * u * tall, 9), L(0, h, 0), C.roof);
      add(box(.55 * u, h * .62, .14 * u), L(0, 0, rad * .98), C.door);
    },
    house(add) { // spacefarers: rectangular, gable roof, lit windows
      const w = 2.8 * u, d = 2.2 * u, h = 2.3 * u * tall;
      add(box(w, h + SINK, d).translate(0, -SINK, 0), L(), C.wall);
      add(new THREE.CylinderGeometry(d * .62, d * .62, w * 1.04, 3), L(0, h + d * .3, 0, 0, 0, Math.PI / 2, 1, 1, 1).multiply(L(0, 0, 0, 0, Math.PI / 2)), C.roof);
      for (const x of [-.28, .28]) add(box(.5 * u, .45 * u, .05 * u), L(x * w, h * .5, d / 2 + .02), C.window, true);
      add(box(.6 * u, h * .55, .08 * u), L(0, 0, d / 2 + .02), C.door);
    },
    tower(add) {
      const h = (6 + r() * 4) * u * tall, rad = 1.1 * u;
      footing(add, rad * 1.1, C.metal); add(cyl(rad * .85, rad, h, 8), L(), C.wall);
      add(cone(rad * .9, 1.6 * u, 8), L(0, h, 0), C.metal);
      for (let y = 1.4 * u; y < h - u; y += 1.1 * u * tall) add(cyl(rad * .87 * (1 - y / h * .15) + .03, rad * .87 * (1 - y / h * .15) + .03, .22 * u, 8), L(0, y, 0), C.window, true);
      add(ball(.18 * u), L(0, h + 1.7 * u, 0), C.beacon, true);
    },
    dome(add, k = 1) {
      const rad = 1.5 * u * k;
      footing(add, rad, C.wall); add(cyl(rad, rad, .35 * u, 12), L(), C.wall2);
      add(dome(rad, 12), L(0, .35 * u, 0, 0, 0, 0, 1, tall, 1), C.wall);
      add(box(.65 * u * k, .95 * u * k, .5 * u), L(0, 0, rad * .85), C.door);
      add(ball(.12 * u), L(0, .35 * u + rad * tall, 0), C.accent);
    },
    tripod(add) { // radial walkers: a dome raised on three legs
      const h = 2.6 * u * tall, rad = 1.3 * u;
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(cyl(.12 * u, .16 * u, h + .4 * u + SINK, 6).translate(0, -SINK, 0), L(Math.cos(a) * rad * .8, 0, Math.sin(a) * rad * .8, Math.sin(a) * .18, 0, -Math.cos(a) * .18), C.wood); }
      add(dome(rad, 10), L(0, h, 0, Math.PI, 0, 0, 1, .5, 1), C.wall2); add(dome(rad, 10), L(0, h, 0, 0, 0, 0, 1, .8, 1), C.wall);
      add(box(.5 * u, .1 * u, .5 * u), L(0, h + .05, rad * .7), C.door);
    },
    mound(add, k = 1) {
      const h = 3.4 * u * tall * k, rad = 2 * u * k; // broad and lumpy, so they never pass for trees
      add(cone(rad, h + SINK, 7).translate(0, -SINK, 0), L(0, 0, 0, 0, r() * 6), C.wall);
      for (let i = 0; i < 3; i++) { const a = r() * 6.28, s = .4 + r() * .35; add(cone(rad * s, h * s + SINK, 6).translate(0, -SINK, 0), L(Math.cos(a) * rad * .7, 0, Math.sin(a) * rad * .7), C.wall2); }
      add(dome(.55 * u * k, 8), L(0, 0, rad * .72, Math.PI / 2, 0, 0, 1, 1, .5), C.door);
      add(cyl(rad * .32, rad * .36, .25 * u, 7), L(0, h * .55, 0), C.accent); // a painted band
    },
    spire(add) {
      let y = 0, rad = 1.8 * u;
      footing(add, rad, C.wall);
      add(cyl(rad * 1.25, rad * 1.45, .9 * u, 7), L(), C.wall2); // a buttressed base
      for (let i = 0; i < 4; i++) {
        const h = (2.9 - i * .35) * u * tall;
        add(cyl(rad * .74, rad, h, 7), L(0, y, 0, 0, i * .4), i % 2 ? C.wall2 : C.wall);
        add(cyl(rad * .76, rad * .78, .18 * u, 7), L(0, y + h * .92, 0, 0, i * .4), C.accent);
        y += h; rad *= .74;
      }
      add(cone(rad, 1.2 * u * tall, 7), L(0, y, 0), C.accent);
      for (let i = 0; i < 5; i++) { const y0 = .9 * u + i * 1.5 * u * tall, rr = 1.8 * u * Math.pow(.74, Math.floor(y0 / (2.6 * u * tall))) * .9; add(dome(.28 * u, 6), L(Math.cos(i * 1.9) * rr, y0, Math.sin(i * 1.9) * rr, Math.PI / 2, -i * 1.9 + Math.PI / 2, 0, 1, 1, .4), C.door); }
    },
    perch(add, k = 1) {
      const h = (4.5 + r() * 3) * u * tall * k;
      add(cyl(.16 * u, .3 * u, h + SINK, 6).translate(0, -SINK, 0), L(0, 0, 0, (r() - .5) * .08, 0, (r() - .5) * .08), C.wood);
      for (const a of [0, 2.1, 4.2]) add(cyl(.05 * u, .05 * u, 1.2 * u, 4), L(0, h * .55, 0, 0, a, .9), C.wood);
      add(new THREE.TorusGeometry(.75 * u, .22 * u, 5, 10).rotateX(Math.PI / 2), L(0, h, 0), C.roof);
      add(cyl(.7 * u, .6 * u, .12 * u, 8), L(0, h - .15 * u, 0), C.wood);
    },
    mast(add, k = 1) {
      const h = (6 + r() * 3) * u * tall * k;
      add(cyl(.12 * u, .22 * u, h + SINK, 6).translate(0, -SINK, 0), L(), C.wood);
      const pods = 3 + Math.floor(r() * 3);
      for (let i = 0; i < pods; i++) {
        const a = i / pods * Math.PI * 2 + r(), y = h * (.45 + .5 * i / pods), arm = .9 * u;
        add(cyl(.04 * u, .04 * u, arm, 4), L(Math.cos(a) * arm / 2, y, Math.sin(a) * arm / 2, 0, -a, Math.PI / 2), C.wood);
        add(ball(.55 * u, 1), L(Math.cos(a) * arm, y - .7 * u, Math.sin(a) * arm, 0, 0, 0, 1, 1.35, 1), i % 2 ? C.wall : C.accent);
        add(cyl(.02 * u, .02 * u, .6 * u, 3), L(Math.cos(a) * arm, y - .6 * u, Math.sin(a) * arm), C.wood);
      }
      add(ball(.2 * u), L(0, h + .2 * u, 0), C.accent);
    },
    monument(add) {
      const h = { hands: 4.5, domes: 3.5, mounds: 6, perches: 7, masts: 7 }[civ.style] * u * tall;
      add(cyl(1.2 * u, 1.3 * u, .35 * u, 8), L(), C.stone2);
      if (civ.style === 'perches' || civ.style === 'masts') { // a totem: stacked rings on a pole
        add(cyl(.25 * u, .35 * u, h + SINK, 6).translate(0, -SINK, 0), L(), C.wood);
        for (let i = 1; i < 5; i++) add(new THREE.TorusGeometry(.42 * u, .12 * u, 5, 9).rotateX(Math.PI / 2), L(0, h * i / 5, 0), i % 2 ? C.accent : C.stone);
      } else {
        add(cyl(.35 * u, .7 * u, h + SINK, 4).translate(0, -SINK, 0), L(0, .35 * u, 0, 0, Math.PI / 4), C.stone);
        add(cone(.45 * u, .8 * u, 4), L(0, h + .35 * u, 0, 0, Math.PI / 4), C.accent);
      }
    },
    wall(add, len) { add(box(len, 1.1 * u * tall + SINK, .4 * u).translate(0, -SINK, 0), L(), C.wall2); },
    field(add, w, d) {
      add(box(w, .1 + SINK, d).translate(0, -SINK, 0), L(), C.soil);
      for (let z = -d / 2 + .5; z < d / 2; z += .9) for (let x = -w / 2 + .4; x < w / 2; x += .7) add(cone(.17, .5 + r() * .25, 4), L(x + (r() - .5) * .1, .1, z), C.crop);
    },
    dish(add) {
      const h = 2.2 * u;
      footing(add, .7 * u, C.metal); add(cyl(.25 * u, .4 * u, h, 6), L(), C.metal);
      add(new THREE.SphereGeometry(1.6 * u, 12, 4, 0, Math.PI * 2, 0, .7), L(0, h + 1.2 * u, 0, Math.PI - .7, 0, 0), C.metal2);
      add(cyl(.05 * u, .05 * u, 1.3 * u, 4), L(0, h + .9 * u, .35 * u, .7, 0, 0), C.metal);
      add(ball(.1 * u), L(0, h + 2 * u, .7 * u), C.beacon, true);
    },
    launch(add) {
      const pad = 5 * u, h = 9 * u * tall;
      add(cyl(pad, pad * 1.02, .5 + SINK, 16).translate(0, -SINK, 0), L(), C.concrete);
      add(cyl(pad * .3, pad * .3, .52, 12), L(), C.scorch);
      // gantry
      add(box(1 * u, h * 1.1 + SINK, 1 * u).translate(0, -SINK, 0), L(pad * .55, 0, 0), C.metal);
      for (let y = 1.5 * u; y < h; y += 2 * u) add(box(1.8 * u, .15 * u, .3 * u), L(pad * .38, y, 0), C.metal2);
      // rocket
      const rr = .75 * u;
      add(cyl(rr, rr, h * .75, 12), L(0, .5, 0), C.hull);
      add(cyl(rr * 1.01, rr * 1.01, h * .08, 12), L(0, .5 + h * .45, 0), C.accent);
      add(cone(rr, h * .25, 12), L(0, .5 + h * .75, 0), C.hull);
      for (let i = 0; i < 3; i++) add(box(.12 * u, 1.8 * u, 1.2 * u).translate(0, 0, rr + .5 * u), L(0, .5, 0, 0, i * Math.PI * 2 / 3, 0), C.accent);
      for (const x of [-.5, .5]) add(box(.5 * u, .35 * u, .05), L(x * 3 * u, 1.2 * u, pad * .6), C.window, true);
    },
  };
  const dwelling = (add) => ({ hands: civ.level >= 3 ? (r() < .7 ? P.house : P.hut) : P.hut, domes: civ.species.plan === 'radial' && r() < .6 ? P.tripod : P.dome, mounds: r() < .4 ? P.spire : P.mound, perches: P.perch, masts: P.mast }[civ.style])(add);
  const smallShelter = (add) => ({ hands: P.shelter, domes: (a) => P.dome(a, .55), mounds: (a) => P.mound(a, .5), perches: (a) => P.perch(a, .5), masts: (a) => P.mast(a, .55) }[civ.style])(add);
  const footOf = { hands: 1.8, domes: 1.9, mounds: 2.4, perches: 1.2, masts: 1.4 }[civ.style] * u;

  // --- Where to build -------------------------------------------------------
  // Each home moves to the nearest open, dry, fairly level ground well clear of the
  // signal and the pad. The herd's centre moves with it, so the builders live there.
  const groundOk = (n, span) => {
    let lo = Infinity, hi = -Infinity; const f = frameAt(n);
    for (let k = 0; k < 9; k++) { const m = k ? pointAt(f, span * (k > 4 ? 1 : .5), k * Math.PI / 4) : n; if (terrain.isLiquid(m)) return Infinity; const h = terrain.surface(m); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return hi - lo;
  };
  const full = (civ.level === 1 ? 10 : 18) * u, chosen = [];
  // On crowded coasts and small moons a smaller clearing will do.
  for (const k of [1, .6, .35, .18]) {
    const span = full * k;
    for (const home of homes.slice(0, 4)) {
      if (chosen.includes(home)) continue;
      const f = frameAt(home); let best = null, bestScore = Infinity;
      for (let d = 0; d <= 120; d += 8) for (let j = 0; j < 12; j++) {
        const n = pointAt(f, d, j / 12 * Math.PI * 2 + d * .1), fromSignal = n.angleTo(signalNormal) * radius;
        if (fromSignal < span + 26 || fromSignal > 220 || n.angleTo(landingNormal) * radius < span + 26) continue;
        if (chosen.some(c => c.angleTo(n) * radius < (span + full) * 1.1)) continue;
        const score = groundOk(n, span) + d * .015;
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
  if (civ.level === 1) {
    for (const f of frames.slice(0, 3)) {
      if (civ.hearths) settle(f, 2 * u, r() * 6, 1.1 * u, .3, P.hearth);
      for (let i = 0, n = 1 + Math.floor(r() * 2); i < n; i++) settle(f, (4 + r() * 4) * u, r() * 6.28, 1.3 * u, 2 * u, smallShelter);
      for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) settle(f, (7 + r() * 9) * u, r() * 6.28, .7 * u, 2 * u, P.cairn, { face: false });
    }
  } else {
    // The main settlement: a monument at the centre, dwellings in one or two rings.
    settle(main, 0, 0, 1.5 * u, 6 * u, P.monument, { face: false });
    if (civ.hearths) settle(main, 3.2 * u, r() * 6, 1.1 * u, .3, P.hearth);
    const count = civ.level >= 3 ? 12 + Math.floor(r() * 5) : 6 + Math.floor(r() * 6);
    for (let i = 0; i < count; i++) {
      const ring = i < 8 ? 0 : 1, a = (i / Math.min(count, 8)) * Math.PI * 2 + ring * .4 + (r() - .5) * .25;
      settle(main, (ring ? 15 : 8.5) * u + r() * 2 * u, a, footOf, 4 * u, dwelling);
    }
    if (civ.style === 'hands' || civ.style === 'domes') { // a low wall ring with gateways
      const wr = 21 * u, seg = 3.2 * u;
      for (let a = 0; a < Math.PI * 2; a += seg / wr) if (Math.sin(a * 2) < .85) place(main, wr, a, seg * .45, 1.2 * u, (add) => P.wall(add, seg * 1.05), { face: true, spacing: .2 });
    }
    if (civ.fields) for (let i = 0; i < 3; i++) settle(main, 28 * u + i * 3, r() * 6.28, 4, .2, (add) => P.field(add, 6, 5), { face: true });
    if (civ.level >= 3) {
      for (let i = 0; i < 4; i++) settle(main, (11 + r() * 6) * u, r() * 6.28, 1.4 * u, 10 * u, P.tower, { face: false });
      for (let i = 0; i < 3; i++) settle(main, (24 + r() * 6) * u, r() * 6.28, 1.8 * u, 4 * u, P.dish);
      settle(main, 40 * u, r() * 6.28, 5.5 * u, 10 * u, P.launch);
    }
    // Hamlets at the other homes.
    for (const f of frames.slice(1)) {
      settle(f, 0, 0, 1.5 * u, 4 * u, P.monument, { face: false });
      for (let i = 0; i < 3; i++) settle(f, 6 * u, i * 2.1 + r(), footOf, 4 * u, dwelling);
    }
  }
  // Trails of standing stones between homes.
  for (const f of frames.slice(1)) {
    const d = main.home.angleTo(f.home) * radius;
    if (d > 260) continue;
    const toward = f.home.clone().sub(main.home); const a0 = Math.atan2(toward.dot(main.north), toward.dot(main.east));
    for (let s = 14 * u; s < d - 10 * u; s += 11 * u) {
      // walk the great circle from the main home toward the other
      const t = s / d, n = main.home.clone().lerp(f.home, t).normalize(), g = frameAt(n);
      place({ ...g, home: n }, 1.6 * u, a0 + Math.PI / 2, .5 * u, 2 * u, civ.level === 1 ? P.marker : P.standing, { face: false });
    }
  }

  // Satellites: spacefarers keep a few in orbit, seen from the ground at night and from space.
  let sats = null;
  if (civ.level >= 3) {
    const g = merger(THREE);
    g.add(new THREE.BoxGeometry(1.2, 1.2, 2), new THREE.Matrix4(), C.metal2);
    g.add(new THREE.BoxGeometry(5, .08, 1.4), new THREE.Matrix4(), '#2a3f6b');
    const count = 9;
    sats = new THREE.InstancedMesh(g.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .5, flatShading: true }), count);
    sats.orbits = Array.from({ length: count }, () => ({ axis: V(r() - .5, r() - .5, r() - .5).normalize(), start: V(r() - .5, r() - .5, r() - .5).normalize(), rad: radius * (1.25 + r() * .6), speed: (.02 + r() * .03) * (r() < .5 ? -1 : 1) }));
    for (const o of sats.orbits) o.start.addScaledVector(o.axis, -o.start.dot(o.axis)).normalize();
    sats.frustumCulled = false;
    group.add(sats);
  }
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  function update(t) {
    if (!sats) return;
    sats.orbits.forEach((o, i) => {
      p.copy(o.start).applyAxisAngle(o.axis, t * o.speed).multiplyScalar(o.rad);
      m.makeRotationAxis(o.axis, t * o.speed).setPosition(p); sats.setMatrixAt(i, m);
    });
    sats.instanceMatrix.needsUpdate = true;
  }
  update(0);

  if (!placed.length) return none;
  const litMesh = new THREE.Mesh(lit.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .92 }));
  const glowMesh = new THREE.Mesh(glow.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  for (const mesh of [litMesh, glowMesh]) { mesh.frustumCulled = false; group.add(mesh); }
  return { group, civ, obstacles, sites, pieces: placed.length, update };
}

// Colours from the world and the builders: stone from its rock, walls from its
// material, accents (paint, banners, rocket stripes) from the species' own colours.
function colours(THREE, body, civ, r) {
  const c = (hex) => new THREE.Color(hex), mix = (a, b, t) => '#' + c(a).lerp(c(b), t).getHexString();
  const rock = body.rock, sp = civ.species.colors || {};
  const wallOf = { wood: mix('#7b5a3c', rock, .25), ice: mix('#cfe6f2', body.atmosphere, .15), adobe: mix('#c99a6b', body.palette[3], .3), glass: mix('#9fe3e6', sp.primary || '#9fe3e6', .3), stone: mix(rock, '#b9b2a6', .35) }[civ.material];
  return {
    stone: mix(rock, '#8d8a85', .3), stone2: mix(rock, '#5c5a58', .4), wall: wallOf, wall2: mix(wallOf, '#000', .18),
    wood: mix('#6b4a2f', rock, .2), roof: civ.material === 'ice' ? mix(wallOf, '#ffffff', .3) : mix(body.palette[1] || '#8a7a4a', '#6b5a33', .5),
    door: '#1a1410', accent: sp.primary || '#c0503a', soil: mix(body.palette[2] || '#5a4630', '#3a2a1a', .6), crop: mix(body.palette[1] || '#4f7a3a', '#6bd44f', .35),
    ember: '#ff7a2a', flame: '#ffc46b', window: '#ffd98a', beacon: '#ff4a4a',
    metal: '#9aa5ad', metal2: '#d7dde1', concrete: '#8b8f91', scorch: '#2b2b2b', hull: '#eef1f2',
  };
}

// Collects geometry pieces (baked into world space with a colour) and merges them.
function merger(THREE) {
  const pos = [], nor = [], col = [], tmp = new THREE.Color(), nm = new THREE.Matrix3();
  return {
    add(g, matrix, colour) {
      const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(matrix);
      nm.getNormalMatrix(matrix);
      const P = geo.attributes.position, N = geo.attributes.normal;
      tmp.set(colour);
      for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(tmp.r, tmp.g, tmp.b); }
      geo.dispose(); if (g !== geo) g.dispose();
    },
    geometry() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return geo;
    },
  };
}
