// A station you can land on and walk around (PROGRESSION.md, Contact). Orbital,
// spacefaring and system-shaping civilizations (and the arks of spaceborne ones,
// megastation.js) build a landing deck on top of their station. Its shape and size
// are their own (station-shape.mjs: a disc, a polygon, a ring on spokes, a cross, a
// spine, linked platforms, hexagonal cells, lobes or a web), and on it stand landing
// pads (the first kept for visitors), a control spire at the hub in their own style,
// and whatever their path and size call for: their path's landmark (an observatory,
// a market, a shrine, greenhouses, watchtowers or a module still being built),
// hangars, tanks, gardens, kiosks, dishes, cargo, benches and lamps. Underneath, a
// habitat ring spins round the station's core, with solar wings or leaf-sails.
// The frame: +Y up off the deck, the floor at y = 0, +X toward the world below.
//
// A crew of the builders works there, in suits, and is busy: each goes to a job
// (a workbench, a pad to service, cargo to carry, a garden to tend, a kiosk to keep),
// walks there round what is in the way and through the doorways between the deck's
// parts, and works at it with their hands (or bends to it), carries crates from the
// cargo to the pads, rests on benches, looks out over the rail, or stops to talk with
// another. How they take a visitor comes from their traits and path (stanceOf):
//   welcome   sociable (traders lean this way): two come across the deck to meet you
//   curious   sharp senses (scholars): they stop to look, and one circles you, scanning
//   wary      cautious (devotional): they keep their distance and watch you
//   guarded   aggressive (martial): two wardens follow you wherever you walk
// THREE is passed in. Geometry and motion only; game.js does the walking and docking.
import { rng } from './rng.mjs';
import { buildCrew, suitUp } from './fauna-mesh.js';
import { createExpression, express, lookAngles, startGesture, gestureOf, moodOf } from './express.mjs';
import { plural } from './structures.mjs';
import { designStation, PAD_RADIUS } from './station-shape.mjs';

export const STANCES = ['welcome', 'curious', 'wary', 'guarded'];

// How a civilization's crew takes a visitor, from its species' traits and its path.
// (Every species that reaches orbit is about as clever as can be, so cleverness can't
// tell them apart; how sharp-sensed, sociable, cautious and aggressive they are can.)
export function stanceOf(civ) {
  const t = civ?.species?.traits || {}, path = civ?.path;
  const score = {
    welcome: .6 * (t.sociality ?? .8) - .25 + (path === 'mercantile' ? .3 : 0),
    curious: .9 * (t.perception ?? .5) - .3 + (path === 'scholarly' ? .5 : path === 'expansionist' ? .15 : 0),
    wary: 1.5 * (t.caution ?? .3) - .55 + (path === 'devotional' ? .3 : path === 'agrarian' ? .05 : 0),
    guarded: 1.4 * (t.aggression ?? .2) - .45 + (path === 'martial' ? .5 : path === 'expansionist' ? .1 : 0),
  };
  return STANCES.reduce((best, s) => (score[s] > score[best] ? s : best), 'welcome');
}

export function greetingFor(stance, name) {
  const many = plural(name);
  return {
    welcome: `Two ${many} leave their work and come across the deck to meet you.`,
    curious: `The ${many} stop work to look at you. One comes closer and scans you, as you scanned their world.`,
    wary: `The ${many} keep their distance and watch you.`,
    guarded: `Two ${many} wardens fall in behind you. You may walk, but not out of their sight.`,
  }[stance];
}

const LANDMARKS = { scholarly: 'an observatory', mercantile: 'a market', devotional: 'a shrine facing their world', agrarian: 'greenhouses', martial: 'watchtowers', expansionist: 'a module still being built' };
const SHAPE_WORDS = { disc: 'a round deck', poly: 'a many-sided deck', ring: 'a ring of deck on spokes round a hub', cross: 'arms reaching out from a hub', spine: 'a long spine of walkway with platforms along it', cluster: 'platforms linked by bridges', comb: 'a honeycomb of hexagonal cells', petal: 'overlapping lobes like a flower', web: 'spokes and rings of walkway like a web' };

// opts: { seed, tier, level, civ (whose station: tier, path, species, family, ambition),
//   colours: { hull, trim, glow, panel, window }, organic, coarse, mega, lift (deck floor
//   above the station's centre, m), size (deck radius, m; else from the civilization) }
// bare: no core, ring or wings underneath (an ark's deck sits on the ark itself).
export function buildStationDeck(THREE, { seed, tier, level, civ, colours, organic = false, coarse = false, mega = false, lift = 9, size = null, bare = false }) {
  const shape = designStation({ ...civ, tier: tier || civ?.tier }, seed, { mega, size });
  const r = rng(seed, 'station-deck'), E = shape.E, T = 1.4;
  const group = new THREE.Group(), spinner = new THREE.Group();
  group.add(spinner);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(sx, sy, sz));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0);
  const ball = (rad, d = 1) => new THREE.IcosahedronGeometry(rad, d);
  const flat = (g) => g.rotateX(-Math.PI / 2);
  const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  const C = {
    hull: colours.hull, trim: colours.trim, glow: colours.glow, panel: colours.panel, window: colours.window,
    floor: mix(colours.hull, '#4a5058', .55), floor2: mix(colours.hull, '#2e3238', .62), plaza: mix(colours.hull, colours.trim, .18),
    metal: '#9aa5ad', metal2: '#d7dde1', dark: '#2a2e33', pad: mix('#5d6266', colours.trim, .12), guest: '#bff3ff', leaf: '#5fd47a', glass: '#bfe9ff',
  };
  const lit = merger(THREE), floor = merger(THREE, false), glow = merger(THREE), glass = merger(THREE), spinLit = merger(THREE), spinGlow = merger(THREE);
  // Something placed on the deck at (x, z), turned to face angle a (from +X toward +Z).
  const At = (x, z, a = 0) => { const base = new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -a), V(1, 1, 1)); return (...args) => base.clone().multiply(L(...args)); };

  // --- The platform: floor, rim, underside --------------------------------------------
  shape.prims.forEach((p, i) => {
    const y = .001 * (i % 7); // overlapping pieces share one colour, so a hair's difference is invisible
    if (p.type === 'disc') { floor.add(flat(new THREE.CircleGeometry(p.r, Math.max(24, Math.round(p.r * 1.6)))), L(p.x, y, p.z), C.floor); floor.add(new THREE.CircleGeometry(p.r, Math.max(24, Math.round(p.r * 1.6))).rotateX(Math.PI / 2), L(p.x, -T, p.z), C.hull); }
    else if (p.type === 'poly') { floor.add(flat(new THREE.CircleGeometry(p.r, p.n, -p.a)), L(p.x, y, p.z), C.floor); floor.add(new THREE.CircleGeometry(p.r, p.n, p.a).rotateX(Math.PI / 2), L(p.x, -T, p.z), C.hull); }
    else { floor.add(flat(new THREE.PlaneGeometry(p.hw * 2, p.hd * 2)), L(p.x, y, p.z, 0, -p.a), C.floor); floor.add(new THREE.PlaneGeometry(p.hw * 2, p.hd * 2).rotateX(Math.PI / 2), L(p.x, -T, p.z, 0, -p.a), C.hull); }
  });
  // A lighter plaza round the hub, with lane lights.
  const plazaR = Math.min(shape.edgeDistFar(0, 0, 40) - 1, shape.spire.r + 9);
  floor.add(flat(new THREE.RingGeometry(shape.spire.r, plazaR, 48)), L(0, .02, 0), C.plaza);
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; glow.add(box(.5, .03, .14), L(Math.cos(a) * (plazaR - .3), .02, Math.sin(a) * (plazaR - .3), 0, -a), C.glow); }
  // The rim: a slab edge below, a parapet with a glowing rail above.
  for (const s of shape.segs) {
    const a = Math.atan2(s.bz - s.az, s.bx - s.ax), mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2;
    lit.add(box(s.len + .1, T, .3), L(mx + s.nx * .15, -T, mz + s.nz * .15, 0, -a), C.hull);
    lit.add(box(s.len + .1, 1.1, .32), L(mx - s.nx * .1, 0, mz - s.nz * .1, 0, -a), C.trim);
    glow.add(box(s.len + .1, .07, .1), L(mx - s.nx * .1, 1.1, mz - s.nz * .1, 0, -a), C.glow);
    glow.add(box(s.len + .1, .14, .05), L(mx + s.nx * .32, -T * .5, mz + s.nz * .32, 0, -a), C.window);
  }
  // Underneath: a keel under the hub, the core down to the station's centre and its far
  // port (freighters dock there), a habitat ring spinning round the core, and wings.
  const hubR = Math.max(6, Math.min(shape.edgeDistFar(0, 0, 40), E * .4));
  lit.add(new THREE.ConeGeometry(hubR, Math.min(lift - T - 1, hubR * .4), 32, 1, true).rotateX(Math.PI).translate(0, -Math.min(lift - T - 1, hubR * .4) / 2, 0), L(0, -T, 0), mix(C.hull, '#000', .25));
  if (!bare) {
  lit.add(cyl(2.6, 2.6, lift + 4.3 - T, 14), L(0, -(lift + 4.3), 0), C.metal);
  lit.add(cyl(1.6, 1.3, 1.6, 10), L(0, -(lift + 5.1), 0), C.metal2);
  glow.add(new THREE.TorusGeometry(1.35, .16, 4, 14).rotateX(Math.PI / 2), L(0, -(lift + 5.15), 0), C.glow);
  const RR = Math.max(12, Math.min(E * .62, 60)), tube = 1.7 + RR * .025;
  spinLit.add(new THREE.TorusGeometry(RR, tube, 8, Math.round(RR * 1.4)).rotateX(Math.PI / 2), L(), C.hull);
  spinLit.add(new THREE.TorusGeometry(RR, tube * 1.03, 3, Math.round(RR * 1.4)).rotateX(Math.PI / 2).scale(1, .25, 1), L(), C.trim);
  for (let i = 0; i < 4; i++) spinLit.add(new THREE.CylinderGeometry(.45, .45, RR * 2, 6).rotateZ(Math.PI / 2), L(0, 0, 0, 0, i * Math.PI / 4), C.metal);
  spinGlow.add(new THREE.TorusGeometry(RR + tube * .95, .2, 3, Math.round(RR * 2)).rotateX(Math.PI / 2), L(), C.window);
  spinGlow.add(new THREE.TorusGeometry(RR - tube * .95, .2, 3, Math.round(RR * 2)).rotateX(Math.PI / 2), L(), C.window);
  spinner.position.y = -lift;
  for (const side of [-1, 1]) { // wings across the deck's +Z axis, below it
    const from = E + 6, len = Math.max(20, E * .55);
    lit.add(box(.4, .4, len + 6), L(0, -lift - .2, side * (from + len / 2 - 3)), C.metal);
    if (organic) for (let k = 0; k < 3; k++) lit.add(new THREE.SphereGeometry(1, 12, 6).scale(len / 6, .06, 4), L(0, -lift, side * (from + len * (k + .5) / 3)), mix(C.trim, '#10202a', .35));
    else for (let k = 0; k < 4; k++) lit.add(box(9, .1, len / 4 - .6), L(0, -lift, side * (from + len * (k + .5) / 4)), C.panel);
  }
  }

  // --- On the deck --------------------------------------------------------------------
  const obstacles = [], spots = []; // obstacles: { x, z, r, h }; spots: places the crew work
  const block = (x, z, rad, h = 3) => obstacles.push({ x, z, r: rad, h });
  const spire = shape.spire, pads = shape.pads;
  const clear = (x, z, rad) => shape.walkable(x, z, Math.min(2.9, rad)) && obstacles.every((o) => Math.hypot(x - o.x, z - o.z) > o.r + rad + 1.3)
    && pads.every((p) => Math.hypot(x - p.x, z - p.z) > p.r + rad + 1.6) && Math.hypot(x - spire.x, z - spire.z) > spire.r + rad + 2.6
    && shape.doorways.every(([dx, dz]) => Math.hypot(x - dx, z - dz) > rad + 3.2); // keep the ways between the deck's parts open
  // The best open floor for something rad metres across, by score (higher is better).
  // (from a sample of the open floor, so a big deck costs no more than a small one)
  const sample = shape.grid.length > 700 ? shape.grid.filter((_, i) => (i * 2654435761 >>> 0) % shape.grid.length < 700) : shape.grid;
  const place = (rad, score) => { let best = null, bs = -Infinity; for (const g of sample) { if (g.edge < rad + 1.6 || !clear(g.x, g.z, rad)) continue; const s = score(g); if (s > bs) { bs = s; best = g; } } return best; };
  // A place someone of the crew can stand (and get to).
  const crewRad = Math.max(.35, (civ?.species?.size ?? 1) * .4);
  const spotFree = (x, z) => shape.walkable(x, z, crewRad + .4) && obstacles.every((o) => o.h <= 0 || Math.hypot(x - o.x, z - o.z) > o.r + crewRad + .1) && Math.hypot(x - spire.x, z - spire.z) > spire.r + crewRad + .1
    && spots.every((s) => Math.hypot(x - s.x, z - s.z) > crewRad * 2 + .3);
  // Places to work round something: about `dist` from (x, z), facing it.
  const around = (x, z, dist, kind, n = 3, a0 = 0, spread = Math.PI * 2) => {
    for (let i = 0; i < n; i++) {
      const a = a0 + (n === 1 ? 0 : (i / n - .5) * spread);
      for (let k = 0; k < 6; k++) { const d = dist + crewRad * .5 + k * .35, sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d; if (spotFree(sx, sz)) { spots.push({ x: sx, z: sz, face: Math.atan2(z - sz, x - sx), kind, taken: -1 }); break; } }
    }
  };
  const towardHub = (x, z) => Math.atan2(-z, -x);

  // Pads, with the crew's service places round each.
  for (const p of pads) {
    floor.add(flat(new THREE.CircleGeometry(p.r, 40)), L(p.x, .04, p.z), C.pad);
    lit.add(flat(new THREE.RingGeometry(p.r * .78, p.r * .86, 40)), L(p.x, .06, p.z), p.guest ? C.guest : C.trim);
    for (let i = 0; i < 4; i++) lit.add(box(p.r * .55, .02, .22), L(p.x, .06, p.z, 0, i * Math.PI / 2 + Math.PI / 4).multiply(L(0, 0, -p.r * .32)), p.guest ? C.guest : C.trim);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; glow.add(box(.22, .1, .22), L(p.x + Math.cos(a) * (p.r + .1), .04, p.z + Math.sin(a) * (p.r + .1)), p.guest ? C.guest : C.glow); }
    if (!p.guest) around(p.x, p.z, p.r + 1.1, 'service', 3, towardHub(p.x, p.z) + Math.PI, 1.6);
  }
  // The spire, in their style, with doors and a post at each.
  const SR = spire.r;
  if (organic) {
    lit.add(cyl(SR * .55, SR * .8, SR * 1.2, 14), L(), C.hull);
    lit.add(new THREE.SphereGeometry(SR * 1.0, 18, 12).scale(1, 1.25, 1), L(0, SR * 2.2, 0), C.trim);
    glow.add(new THREE.TorusGeometry(SR * .98, .12, 4, 40).rotateX(Math.PI / 2), L(0, SR * 2.2, 0), C.window);
    lit.add(new THREE.ConeGeometry(.25, SR * 1.6, 6).translate(0, SR * .8, 0), L(0, SR * 3.4, 0), C.trim);
  } else {
    let y = 0, w = SR;
    const tiers = 3 + (E > 70 ? 1 : 0) + (mega ? 2 : 0);
    for (let k = 0; k < tiers; k++) {
      const h = SR * (k === 0 ? 1.1 : .8);
      lit.add(cyl(w * .92, w, h, 14), L(0, y, 0), k % 2 ? C.trim : C.hull);
      glow.add(cyl(w * .935, w * .935, .35, 14), L(0, y + h * .55, 0), C.window);
      y += h; w *= .76;
    }
    lit.add(cyl(.12, .2, SR * 1.4, 6), L(0, y, 0), C.metal);
    glow.add(ball(.3), L(0, y + SR * 1.4, 0), '#ff5a5a');
  }
  block(0, 0, SR + .3, 40);
  for (const p of pads.filter((p) => p.guest).concat(pads.filter((p) => !p.guest).slice(0, 1))) { // doors toward the visitors' pad and the first crew pad
    const a = Math.atan2(p.z, p.x);
    for (const s of [-.3, .3]) glow.add(box(1.3, 2.2, .1), L(Math.cos(a + s) * (SR + .02), 0, Math.sin(a + s) * (SR + .02), 0, -(a + s) + Math.PI / 2), C.window);
    around(0, 0, SR + 1.2, 'post', 1, a);
  }

  // Their path's landmark, on the side facing their world (bigger stations raise more).
  const path = civ?.path || 'scholarly', landmark = LANDMARKS[path];
  const copies = Math.min(5, 1 + Math.floor(E / 60) + (mega ? 1 : 0));
  const LM = { scholarly: 4.2, mercantile: 6.5, devotional: 4.8, agrarian: 7.8, martial: 3, expansionist: 5.5 }[path] || 4;
  for (let c = 0; c < copies; c++) {
    const g = place(LM, (g) => g.x * (c ? .3 : 1) + (c ? Math.hypot(g.x, g.z) * .5 : 0) + r() * 6);
    if (!g) break;
    const a = Math.atan2(g.z, g.x), M = At(g.x, g.z, a); // local +X points away from the hub
    if (path === 'scholarly') {
      lit.add(cyl(3.2, 3.2, 2.6, 18), M(), C.hull);
      lit.add(new THREE.SphereGeometry(3.25, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0, 2.6, 0), C.metal2);
      lit.add(cyl(.55, .7, 5, 10).rotateZ(-1.05), M(.4, 3.6, 0), C.trim);
      glow.add(cyl(3.22, 3.22, .25, 18), M(0, 1.8, 0), C.window);
      block(g.x, g.z, 3.4, 6); around(g.x, g.z, 4.5, 'study', 3, a + Math.PI, 2.4);
    } else if (path === 'mercantile') {
      for (let i = 0; i < 4; i++) {
        const b = (i - 1.5) * .9, sx = Math.cos(b) * 3.6, sz = Math.sin(b) * 3.6, wx = g.x + Math.cos(a) * sx - Math.sin(a) * sz, wz = g.z + Math.sin(a) * sx + Math.cos(a) * sz, M2 = At(wx, wz, a + b);
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lit.add(cyl(.06, .06, 2.4, 5), M2(dx * .9, 0, dz * .9), C.metal);
        lit.add(new THREE.ConeGeometry(1.7, .7, 4).rotateY(Math.PI / 4).translate(0, .35, 0), M2(0, 2.4, 0), i % 2 ? C.trim : mix(C.trim, C.window, .5));
        lit.add(box(.8, .9, 1.8), M2(.3, 0, 0), mix(C.hull, '#6b4a2f', .3));
        glow.add(ball(.15, 0), M2(0, 2.2, 0), C.window);
        block(wx, wz, 1.25, 2.4);
        const bx = wx + Math.cos(a + b) * 1.9, bz = wz + Math.sin(a + b) * 1.9; // behind the counter
        if (spotFree(bx, bz)) spots.push({ x: bx, z: bz, face: Math.atan2(wz - bz, wx - bx) + Math.PI, kind: 'trade', taken: -1 });
        around(wx, wz, 2.3, 'browse', 1, a + b + Math.PI);
      }
    } else if (path === 'devotional') {
      lit.add(new THREE.TorusGeometry(3.4, .35, 6, 28, Math.PI), M(2.5, 0, 0, 0, Math.PI / 2), C.trim);
      lit.add(cyl(.9, 1.1, 1.2, 10), M(-1.2, 0, 0), C.hull);
      glow.add(ball(.7, 2), M(-1.2, 1.9, 0), C.window);
      const wx = (lx, lz) => [g.x + Math.cos(a) * lx - Math.sin(a) * lz, g.z + Math.sin(a) * lx + Math.cos(a) * lz];
      for (const lz of [-3.4, 3.4]) { const [x, z] = wx(2.5, lz); block(x, z, .45, 4); }
      { const [x, z] = wx(-1.2, 0); block(x, z, 1.2, 2.6); around(x, z, 2.4, 'pray', 3, a + Math.PI, 1.6); }
    } else if (path === 'agrarian') {
      lit.add(cyl(LM - .4, LM - .4, .5, 20), M(), C.hull);
      glass.add(new THREE.SphereGeometry(LM - .45, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0, .5, 0), C.glass);
      for (let k = 0; k < 10; k++) { const b = k * .63 + r(), rr = 1 + r() * (LM - 3); glow.add(ball(.35 + r() * .4, 0), M(Math.cos(b) * rr, .9, Math.sin(b) * rr, 0, 0, 0, 1, 1.4, 1), C.leaf); }
      block(g.x, g.z, LM - .2, 4); around(g.x, g.z, LM + .9, 'tend', 4, a + Math.PI, 3.2);
    } else if (path === 'martial') {
      lit.add(cyl(1.1, 1.4, 6, 8), M(), C.hull); lit.add(cyl(1.7, 1.5, 1.4, 8), M(0, 6, 0), C.trim);
      glow.add(cyl(1.72, 1.72, .3, 8), M(0, 6.6, 0), '#ff6a4a');
      block(g.x, g.z, 1.6, 7.4); around(g.x, g.z, 2.6, 'guard', 2, a + Math.PI, 1.8);
    } else { // expansionist: a crane over the frame of a new module
      for (const [dx, dz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) lit.add(box(.25, 5, .25), M(dx, 0, dz), C.metal);
      for (const y of [2.5, 5]) for (const [dx, dz, ry] of [[0, -2.5, 0], [0, 2.5, 0], [-2.5, 0, Math.PI / 2], [2.5, 0, Math.PI / 2]]) lit.add(box(5.2, .2, .2), M(dx, y, dz, 0, ry), C.metal);
      lit.add(box(5.2, .15, 5.2), M(), mix(C.hull, C.trim, .3));
      lit.add(box(.4, 9, .4), M(3.6, 0, 3.6), C.trim); lit.add(box(.35, .35, 6), M(3.6, 9, 1), C.trim);
      lit.add(box(.04, 3, .04), M(3.6, 6, -1.5), C.dark); lit.add(box(1.4, .8, 1.4), M(3.6, 5.2, -1.5), C.hull);
      glow.add(ball(.18, 0), M(3.6, 9.4, 4), '#ffb14a');
      block(g.x, g.z, 3.8, 9); { const mx = g.x + Math.cos(a) * 3.6 - Math.sin(a) * 3.6, mz = g.z + Math.sin(a) * 3.6 + Math.cos(a) * 3.6; block(mx, mz, .45, 9); } around(g.x, g.z, 4.8, 'build', 4, a, Math.PI * 1.6);
    }
  }
  // Hangars by the crew's pads (on bigger decks), their doors glowing.
  const hangars = E < 44 ? 0 : Math.min(4, 1 + Math.floor((E - 44) / 30) + (mega ? 2 : 0));
  for (let h = 0; h < hangars; h++) {
    const p = pads[1 + h % Math.max(1, pads.length - 1)] || pads[0];
    const g = place(5.2, (g) => -Math.hypot(g.x - p.x, g.z - p.z) + r() * 4);
    if (!g) break;
    const a = Math.atan2(p.z - g.z, p.x - g.x), M = At(g.x, g.z, a);
    lit.add(box(7, 5.2, 8.5), M(), C.hull); lit.add(box(7.3, .5, 8.8), M(0, 5.2, 0), C.trim);
    glow.add(box(.08, 3.6, 5.6), M(3.52, 0, 0), C.window);
    block(g.x, g.z, 5, 5.7); around(g.x, g.z, 6.2, 'repair', 2, a, .9);
  }
  // Cargo by every crew pad: where crates are picked up.
  const cargo = [];
  for (const p of pads.filter((p) => !p.guest)) {
    const g = place(1.8, (g) => -Math.abs(Math.hypot(g.x - p.x, g.z - p.z) - (p.r + 5)) + r());
    if (!g) continue;
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const s = 1 + r() * .4, ox = (r() - .5) * 1.6, oz = (r() - .5) * 1.6, stack = r() < .4 ? 2 : 1;
      for (let k = 0; k < stack; k++) lit.add(box(s, s, s), L(g.x + ox, k * s, g.z + oz, 0, r() * 1.5), r() < .5 ? C.trim : mix(C.hull, C.trim, .4));
    }
    block(g.x, g.z, 1.9, 2.2);
    const before = spots.length; around(g.x, g.z, 2.9, 'load', 2, Math.atan2(p.z - g.z, p.x - g.x), 1.2);
    for (const s of spots.slice(before)) cargo.push(s);
  }
  // Fillers by size: tanks, gardens, kiosks, dishes.
  const fillers = Math.min(mega ? 36 : 18, Math.max(2, Math.round(shape.area / (mega ? 260 : 420))));
  for (let f = 0; f < fillers; f++) {
    const kind = ['tank', 'garden', 'kiosk', 'dish'][(f + Math.floor(r() * 4)) % 4];
    const rad = { tank: 2, garden: 2.4, kiosk: 1.4, dish: 1.2 }[kind];
    const g = place(rad, (g) => (kind === 'dish' ? -g.edge * 3 : Math.min(g.edge, 12)) + r() * 10);
    if (!g) break;
    const a = Math.atan2(g.z, g.x), M = At(g.x, g.z, a);
    if (kind === 'tank') { lit.add(cyl(1.6, 1.6, 4.2, 14), M(), C.metal2); lit.add(new THREE.SphereGeometry(1.6, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0, 4.2, 0), C.metal2); glow.add(cyl(1.62, 1.62, .2, 14), M(0, 2.4, 0), C.glow); block(g.x, g.z, 1.8, 5.8); around(g.x, g.z, 2.8, 'tend', 2, a + Math.PI, 2); }
    else if (kind === 'garden') { lit.add(box(4.2, .6, 2.2), M(), mix(C.hull, '#3a2a1a', .5)); for (let k = 0; k < 6; k++) glow.add(ball(.3 + r() * .25, 0), M(-1.6 + k * .65, .75, (r() - .5) * 1.2, 0, 0, 0, 1, 1.5, 1), C.leaf); block(g.x, g.z, 2.3, .8); around(g.x, g.z, 2.1, 'tend', 2, a + Math.PI / 2, Math.PI); }
    else if (kind === 'kiosk') { lit.add(box(2, 2.4, 2), M(), C.hull); lit.add(box(2.4, .2, 2.4), M(0, 2.4, 0), C.trim); glow.add(box(.06, .7, 1.4), M(1.01, 1.1, 0), C.window); block(g.x, g.z, 1.5, 2.6); around(g.x, g.z, 2.3, 'trade', 1, a); }
    else { lit.add(cyl(.3, .45, 3, 8), M(), C.metal); const prof = []; for (let i = 0; i <= 6; i++) { const t = i / 6; prof.push(new THREE.Vector2(Math.max(.01, t * 2.2), t * t * .9)); } lit.add(new THREE.LatheGeometry(prof, 16).rotateZ(-.9), M(0, 3, 0), C.metal2); block(g.x, g.z, .7, 3); around(g.x, g.z, 1.8, 'repair', 1, a + Math.PI); }
  }
  // Lamps and benches along the rim; places to look out over the rail; places to talk.
  let run = 0;
  for (const s of shape.segs) {
    run += s.len;
    if (run < 11) continue;
    run = 0;
    const inset = 2.4 + crewRad, mx = (s.ax + s.bx) / 2 - s.nx * inset, mz = (s.az + s.bz) / 2 - s.nz * inset;
    if (!clear(mx, mz, .3)) continue;
    const look = Math.atan2(s.nz, s.nx);
    if (r() < .3 && clear(mx - s.nx * .3, mz - s.nz * .3, 1.2)) { // a bench facing out
      const M = At(mx, mz, look); lit.add(box(.6, .45, 2.2), M(), C.trim); block(mx, mz, 1, .45);
      const bx = mx - s.nx * (1 + crewRad), bz = mz - s.nz * (1 + crewRad); if (spotFree(bx, bz)) spots.push({ x: bx, z: bz, face: look, kind: 'rest', taken: -1 });
    } else {
      lit.add(cyl(.08, .12, 2.6, 6), L(mx, 0, mz), C.metal); glow.add(ball(.22), L(mx, 2.7, mz), C.window); block(mx, mz, .2, 2.5);
      const lx = mx + s.nx * .4 + s.nz * 1.6, lz = mz + s.nz * .4 - s.nx * 1.6;
      if (spotFree(lx, lz)) spots.push({ x: lx, z: lz, face: look, kind: 'look', taken: -1 });
    }
  }
  for (let k = 0, n = Math.min(12, Math.max(2, Math.round(shape.area / 900))); k < n; k++) { // pairs who stop to talk
    const g = place(1.6, (g) => Math.min(g.edge, 8) + r() * 8);
    if (!g) break;
    const a = r() * Math.PI;
    const half = crewRad + .5, pair = [-1, 1].map((s) => ({ x: g.x + Math.cos(a) * half * s, z: g.z + Math.sin(a) * half * s, face: a + (s > 0 ? Math.PI : 0), kind: 'chat', taken: -1, pair: g }));
    if (pair.every((p) => spotFree(p.x, p.z))) spots.push(...pair);
    block(g.x, g.z, .01, 0); // reserve the place (not solid)
  }
  // While a visitor's ship is on its pad, someone comes to look it over.
  const guest = pads[0];
  const inspect = [];
  for (let i = 0; i < 3; i++) { const a = towardHub(guest.x, guest.z) + (i - 1) * .9, x = guest.x + Math.cos(a) * (4.2 + crewRad), z = guest.z + Math.sin(a) * (4.2 + crewRad); if (spotFree(x, z)) inspect.push({ x, z, face: a + Math.PI, kind: 'inspect', taken: -1 }); }

  const mat = (opts) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .6, metalness: .18, ...opts });
  const meshes = [
    new THREE.Mesh(floor.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75, metalness: .1, side: THREE.DoubleSide })),
    new THREE.Mesh(lit.geometry(), mat({ side: THREE.DoubleSide })),
    new THREE.Mesh(glow.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true })),
  ];
  if (glass.count()) meshes.push(new THREE.Mesh(glass.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .28, roughness: .05, metalness: .3, depthWrite: false, side: THREE.DoubleSide })));
  for (const m of meshes) { m.frustumCulled = false; group.add(m); }
  for (const m of [new THREE.Mesh(spinLit.geometry(), mat()), new THREE.Mesh(spinGlow.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }))]) { m.frustumCulled = false; spinner.add(m); }

  // --- The crew ------------------------------------------------------------------------
  const species = civ?.species ? suitUp(civ.species) : null;
  const stance = stanceOf(civ);
  const crew = [];
  let crewMesh = null, crates = null;
  const RIM = .5;
  if (species) {
    const n = Math.max(4, Math.min(mega ? 30 : 22, Math.round(shape.area / 260))) * (coarse ? .65 : 1) | 0;
    crewMesh = buildCrew(THREE, species, n, seed);
    group.add(crewMesh.group);
    crates = new THREE.InstancedMesh(new THREE.BoxGeometry(.7, .55, .7), mat({ color: C.trim, vertexColors: false }), n);
    crates.frustumCulled = false; crates.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(crates);
    const walk = Math.min(1.7, Math.max(.7, (species.speed?.walk ?? 1.2) * .75));
    const floats = (species.altitude?.[1] ?? 0) > 0;
    for (let i = 0; i < n; i++) {
      const open = spots.filter((x) => x.taken === -1 && x.kind !== 'inspect'), s = open[Math.floor(r() * open.length)] || { x: spire.r + 3, z: 0 };
      // Two are given the visitor (greeters or wardens), or one comes to scan you.
      const role = (stance === 'welcome' || stance === 'guarded') && i < 2 ? stance : stance === 'curious' && i === 0 ? 'curious' : 'work';
      crew.push({ i, x: s.x + (r() - .5), z: s.z + (r() - .5), heading: r() * 6.283, speed: 0, cycle: r() * 6, role, size: species.size, rad: crewRad,
        walk, floats, hover: floats ? 1 + r() * .8 : 0, phase: r() * 6, job: s.kind ? s : null, route: [], side: r() < .5 ? 1 : -1, detour: 0, state: s.kind ? 'job' : 'idle', timer: 3 + r() * 20, carrying: false, stuck: 0, lastX: 0, lastZ: 0, sink: 0, ex: createExpression(r) });
      if (s.kind) { s.taken = i; crew[i].x = s.x; crew[i].z = s.z; crew[i].heading = s.face; }
    }
  }
  const armed = !!species?.arms;
  const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const free = (s, c) => s.taken === -1 || s.taken === c.i;
  function take(c, s) { if (c.job) c.job.taken = -1; c.job = s; if (s) s.taken = c.i; }
  // Pick the next job: a free place of work, with a bias by what is going on.
  function nextJob(c, shipHere) {
    const pool = (shipHere ? inspect.concat(spots) : spots).filter((s) => free(s, c) && s !== c.job);
    if (!pool.length) return null;
    // Crates go from the cargo to a crew pad: pick some up now and then.
    const nearest = (list) => list.filter((x) => free(x, c)).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
    if (!c.carrying && cargo.length && r() < .22) { const s = nearest(cargo); if (s && Math.hypot(s.x - c.x, s.z - c.z) < 40) return s; }
    if (c.carrying) { const s = nearest(spots.filter((x) => x.kind === 'service')); if (s) return s; }
    if (shipHere && r() < .35) { const s = inspect.find((x) => free(x, c)); if (s) return s; }
    // Mostly somewhere not too far away; sometimes across the deck.
    const near = pool.filter((s) => Math.hypot(s.x - c.x, s.z - c.z) < Math.min(22, E * .6));
    const list = near.length && r() < .9 ? near : pool;
    return list[Math.floor(r() * list.length)];
  }
  const JOB_TIME = { service: [10, 20], load: [2.5, 3.5], study: [18, 36], trade: [25, 50], browse: [8, 14], pray: [16, 30], tend: [14, 28], guard: [25, 45], build: [14, 28], repair: [14, 26], post: [25, 45], rest: [15, 30], look: [10, 20], chat: [14, 26], inspect: [10, 16] };
  const WORKING = new Set(['service', 'load', 'study', 'trade', 'tend', 'build', 'repair', 'inspect']);

  // Walk toward (tx, tz): steer round anything in the way and along the rim.
  function walkTo(c, tx, tz, want, dt, player, ship) {
    let dx = tx - c.x, dz = tz - c.z;
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    let ax = 0, az = 0; // sideways nudge round what is ahead
    const look = 2 + c.rad * 2 + c.speed;
    const avoid = (ox, oz, or) => {
      const vx = ox - c.x, vz = oz - c.z, along = vx * dx + vz * dz;
      if (along <= 0 || along > look + or) return;
      const lat = vx * -dz + vz * dx, need = or + c.rad + .35;
      if (Math.abs(lat) >= need) return;
      const push = (need - Math.abs(lat)) / need * (1 - along / (look + or + 1)), side = lat > 0 ? -1 : 1; // obstacle on the left: go right
      ax += -dz * side * push * 2.2; az += dx * side * push * 2.2;
    };
    for (const o of obstacles) if (o.h > 0 && Math.abs(o.x - c.x) < look + o.r + 2 && Math.abs(o.z - c.z) < look + o.r + 2) avoid(o.x, o.z, o.r);
    for (const o of crew) if (o !== c && Math.abs(o.x - c.x) < 6 && Math.abs(o.z - c.z) < 6) avoid(o.x, o.z, o.rad);
    if (ship) avoid(ship.x, ship.z, ship.r);
    if (player) avoid(player.x, player.z, .5);
    let hx = dx + ax, hz = dz + az;
    // The rim ahead: turn to whichever side stays on the deck.
    const probe = 1.2 + c.rad;
    if (!shape.walkable(c.x + hx / Math.hypot(hx, hz) * probe, c.z + hz / Math.hypot(hx, hz) * probe, c.rad + RIM)) {
      for (const turn of [.5, -.5, 1, -1, 1.6, -1.6]) { const a = Math.atan2(hz, hx) + turn; if (shape.walkable(c.x + Math.cos(a) * probe, c.z + Math.sin(a) * probe, c.rad + RIM)) { hx = Math.cos(a); hz = Math.sin(a); break; } }
    }
    c.heading += angleTo(c.heading, Math.atan2(hz, hx)) * Math.min(1, dt * 4);
    c.speed += (want - c.speed) * Math.min(1, dt * 3);
  }
  // Move along the heading, sliding along anything solid rather than through it.
  function stepCrew(c, dt, player, ship) {
    if (c.speed < .02) return;
    let nx = c.x + Math.cos(c.heading) * c.speed * dt, nz = c.z + Math.sin(c.heading) * c.speed * dt;
    const solid = (x, z) => {
      if (!shape.walkable(x, z, c.rad + RIM * .6)) return true;
      for (const o of obstacles) if (o.h > 0 && Math.hypot(x - o.x, z - o.z) < o.r + c.rad) return true;
      if (ship && Math.hypot(x - ship.x, z - ship.z) < ship.r + c.rad) return true;
      if (player && Math.hypot(x - player.x, z - player.z) < .45 + c.rad) return true;
      for (const o of crew) if (o !== c && Math.hypot(x - o.x, z - o.z) < (o.rad + c.rad) * .9 && Math.hypot(c.x - o.x, c.z - o.z) > Math.hypot(x - o.x, z - o.z)) return true;
      return false;
    };
    if (c.detour > 0) c.detour -= dt;
    if (!solid(nx, nz)) { c.x = nx; c.z = nz; return; }
    // Blocked: edge along it, trying a little further round each time (and keep to that side a moment).
    const step = Math.max(c.speed, .6) * dt;
    for (const turn of c.side > 0 ? [.6, -.6, 1.2, -1.2, 1.9, -1.9] : [-.6, .6, -1.2, 1.2, -1.9, 1.9]) {
      const a = c.heading + turn, x = c.x + Math.cos(a) * step, z = c.z + Math.sin(a) * step;
      if (!solid(x, z)) { c.x = x; c.z = z; c.heading += turn * .35; c.side = Math.sign(turn); c.detour = 1; return; }
    }
    c.speed *= .5;
  }

  const exR = V(), exF = V(), exQ = new THREE.Quaternion(), exE = new THREE.Euler(), exS = V(1, 1, 1);
  const m4 = new THREE.Matrix4(), pos = V(), quat = new THREE.Quaternion(), one = V(1, 1, 1), Yax = V(0, 1, 0), crateM = new THREE.Matrix4(), hiddenM = new THREE.Matrix4().makeScale(0, 0, 0);
  let events = [];
  const spin = (t) => { spinner.rotation.y = t * (mega ? .03 : .1); };
  // player: { x, z } while you are on the deck, else null. ship: your ship on its pad { x, z, r }, or null.
  function update(dt, t, player, ship = null) {
    events = [];
    spin(t);
    if (!crewMesh) return events;
    for (const c of crew) {
      const pd = player ? Math.hypot(player.x - c.x, player.z - c.z) : Infinity;
      let target = null, want = 0, face = null, pose = 'stand'; // pose: stand, work, gesture, sit
      let chasing = true; // set false below when they go about their own work
      const toward = (dist, slack = 1.2) => { // a point `dist` from you, on its own side
        const dx = c.x - player.x, dz = c.z - player.z, d = Math.max(.01, Math.hypot(dx, dz));
        target = [player.x + dx / d * dist, player.z + dz / d * dist]; want = pd > dist + slack ? c.walk * (pd > dist + 8 ? 1.7 : 1) : 0; face = Math.atan2(player.z - c.z, player.x - c.x);
      };
      // How they take a visitor comes first (they leave their work to do it).
      const drop = () => { if (c.job) { take(c, null); c.state = 'idle'; c.carrying = false; } };
      if (c.talk && player) { drop(); face = Math.atan2(player.z - c.z, player.x - c.x); chasing = false; } // talking with you: stand and attend
      else if (player && c.role === 'welcome') { drop(); toward(2.6 + c.size * (1 + c.i * .5)); if (pd < 6) { pose = 'gesture'; if (!c.greeted) { c.greeted = true; startGesture(c.ex, gestureOf(species)); } } }
      else if (player && c.role === 'guarded') { drop(); toward(6.5 + c.i * 1.4, 2.5); }
      else if (player && c.role === 'curious') {
        drop();
        const a = t * .25 + c.phase; target = [player.x + Math.cos(a) * 3.8, player.z + Math.sin(a) * 3.8]; want = c.walk * (pd > 10 ? 1.6 : .6);
        if (pd < 8) { face = Math.atan2(player.z - c.z, player.x - c.x); pose = 'work'; }
        if (pd < 6 && !c.scanned) { c.scanned = true; events.push({ type: 'scanned', i: c.i }); }
      } else if (player && stance === 'wary' && pd < 8) { // back away from you
        drop();
        const dx = c.x - player.x, dz = c.z - player.z, d = Math.max(.01, Math.hypot(dx, dz));
        target = [c.x + dx / d * 5, c.z + dz / d * 5]; want = c.walk * 1.3;
      } else if (player && ((stance === 'wary' && pd < 18) || (stance === 'curious' && pd < 9)) && c.state !== 'walk') { face = Math.atan2(player.z - c.z, player.x - c.x); }
      else {
        chasing = false;
        // Their own work: walk to a job, do it, pick the next.
        if (c.state === 'idle' || !c.job) {
          take(c, nextJob(c, !!ship));
          c.route = c.job ? shape.route(c.x, c.z, c.job.x, c.job.z) : [];
          c.state = c.job ? 'walk' : 'idle'; c.stuck = 0; c.lastX = c.x; c.lastZ = c.z;
        }
        if (c.state === 'walk' && c.job) {
          while (c.route.length > 1 && Math.hypot(c.route[0][0] - c.x, c.route[0][1] - c.z) < 1.4) c.route.shift();
          const [tx, tz] = c.route[0] || [c.job.x, c.job.z], last = c.route.length <= 1, d = Math.hypot(tx - c.x, tz - c.z);
          if (last && d < .5) { c.state = 'job'; const [a, b] = JOB_TIME[c.job.kind] || [6, 12]; c.timer = a + r() * (b - a); c.speed = 0; }
          else { target = [tx, tz]; want = c.walk * (last && d < 2 ? .5 : 1); }
          // Not getting anywhere: give up and do something else.
          if ((c.stuck += dt) > 5) { if (Math.hypot(c.x - c.lastX, c.z - c.lastZ) < 1) { c.state = 'idle'; take(c, null); } c.stuck = 0; c.lastX = c.x; c.lastZ = c.z; }
        } else if (c.state === 'job' && c.job) {
          face = c.job.face;
          const k = c.job.kind;
          pose = WORKING.has(k) ? 'work' : k === 'rest' ? 'sit' : k === 'chat' ? (crew.some((o) => o !== c && o.state === 'job' && o.job?.pair === c.job.pair) ? 'gesture' : 'stand') : k === 'browse' ? 'gesture' : 'stand';
          if (k === 'post' || k === 'guard' || k === 'look') face += Math.sin(t * .4 + c.phase) * .5; // looking about
          if (k === 'load' && (c.timer -= dt) < 0) { c.carrying = true; c.state = 'idle'; }
          else if (k === 'service' && c.carrying && c.timer < (JOB_TIME.service[0] - 2.5)) { c.carrying = false; } // set the crate down
          if ((c.timer -= dt) < 0) c.state = 'idle';
        }
      }
      if (target && want > 0 && chasing) { // a chase across the deck: through its doorways too
        if (!c.chase || Math.hypot(c.chase.x - target[0], c.chase.z - target[1]) > 3 || (c.chase.age += dt) > 2) c.chase = { x: target[0], z: target[1], age: 0, route: shape.route(c.x, c.z, target[0], target[1]) };
        while (c.chase.route.length > 1 && Math.hypot(c.chase.route[0][0] - c.x, c.chase.route[0][1] - c.z) < 1.4) c.chase.route.shift();
        target = c.chase.route[0];
      }
      if (target && want > 0) walkTo(c, target[0], target[1], want, dt, player, ship);
      else { c.speed += (0 - c.speed) * Math.min(1, dt * 4); if (face !== null) c.heading += angleTo(c.heading, face) * Math.min(1, dt * 2.5); }
      stepCrew(c, dt, player, ship);
      // Pose: walking legs; working hands (or a bow to the work); a gesture; sitting.
      let amp;
      if (c.speed > .05) { c.cycle += c.floats ? dt * (species.plan === 'floater' ? 1.2 : 5) : c.speed * dt / crewMesh.stride * (species.plan === 'roller' ? 1 : Math.PI); amp = c.floats ? 1 : Math.min(1, c.speed / Math.max(.2, c.walk)); }
      else if (pose === 'work') { c.cycle += dt * 3.2; amp = -1; }
      else if (pose === 'gesture') { c.cycle += dt * 2; amp = -(.25 + .35 * Math.max(0, Math.sin(t * .9 + c.phase))); }
      else { amp = c.floats ? 1 : 0; if (c.floats) c.cycle += dt * 1.2; }
      c.sink += ((pose === 'sit' ? c.size * .18 : 0) - c.sink) * Math.min(1, dt * 2);
      const bow = pose === 'work' && !armed ? .12 + .14 * (.5 + .5 * Math.sin(t * 2.4 + c.phase)) : 0;
      // Expression (express.mjs): who it looks at, its mood toward you, a greeting.
      let lookAt = null, mood = null;
      const headY = crewMesh.extent.top * .8;
      if (c.talk && player) { lookAt = [player.x, 1.6, player.z]; mood = moodOf(stance); }
      else if (player && (pd < 12 || c.role !== 'work') && pose !== 'work') { lookAt = [player.x, 1.6, player.z]; if (pd < 9) mood = moodOf(stance); }
      else if (c.state === 'job' && c.job?.kind === 'chat') { const o = crew.find((x) => x !== c && x.state === 'job' && x.job?.pair === c.job.pair); if (o) lookAt = [o.x, headY, o.z]; }
      const ch = Math.cos(c.heading), sh = Math.sin(c.heading);
      exR.set(sh, 0, -ch); exF.set(ch, 0, sh); // the body's right (its +X) and forward on the deck
      const look = lookAt ? lookAngles(lookAt[0] - c.x, lookAt[1] - headY - (c.hover || 0), lookAt[2] - c.z, exR, Yax, exF) : null;
      const ep = express(c.ex, dt, { look, mood, t, phase: c.phase, sp: species, still: c.speed < .15 });
      if (ep.arms !== null && armed) { amp = ep.arms; c.cycle += dt * 2; }
      quat.setFromAxisAngle(Yax, Math.PI / 2 - c.heading);
      if (bow) quat.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), bow));
      if (ep.pitch || ep.roll || ep.yaw) quat.multiply(exQ.setFromEuler(exE.set(ep.pitch, ep.yaw, ep.roll, 'YXZ')));
      pos.set(c.x, (c.hover ? c.hover + Math.sin(t * .8 + c.phase) * .25 : -c.sink) + ep.lift, c.z);
      crewMesh.set(c.i, m4.compose(pos, quat, exS.set(1, ep.scale, 1)), c.cycle, amp, ep.headYaw, ep.headPitch, ep.glow);
      if (c.carrying) {
        const top = crewMesh.extent.top, fwd = armed ? c.size * .35 : -c.size * .05;
        crates.setMatrixAt(c.i, crateM.compose(V(c.x + Math.cos(c.heading) * fwd, (armed ? top * .62 : top + .28) + pos.y, c.z + Math.sin(c.heading) * fwd), quat, one));
      } else crates.setMatrixAt(c.i, hiddenM);
    }
    crewMesh.commit(); crates.instanceMatrix.needsUpdate = true;
    return events;
  }

  // You on foot: slide along the rim and round anything solid (jump: clear low things).
  function resolve(x0, z0, x1, z1, rad, jump = 0) {
    const solid = (x, z) => {
      if (!shape.walkable(x, z, rad)) return true;
      for (const o of obstacles) if (o.h > 0 && jump < o.h && Math.hypot(x - o.x, z - o.z) < o.r + rad) return true;
      for (const c of crew) if (Math.hypot(x - c.x, z - c.z) < c.rad + rad) return Math.hypot(x0 - c.x, z0 - c.z) > Math.hypot(x - c.x, z - c.z);
      return false;
    };
    if (!solid(x1, z1)) return [x1, z1];
    if (!solid(x1, z0)) return [x1, z0];
    if (!solid(x0, z1)) return [x0, z1];
    return [x0, z0];
  }

  return {
    group, radius: E, thickness: T, pads, stance, landmark, species, crewCount: crew.length, archetype: shape.archetype, shape,
    layout: SHAPE_WORDS[shape.archetype], spots, mega,
    greeting: species ? greetingFor(stance, species.name) : '',
    resolve, update, spin, walkable: shape.walkable,
    obstacles: () => [...obstacles.filter((o) => o.h > 0), ...crew.map((c) => ({ x: c.x, z: c.z, r: c.rad, h: c.size }))],
    crew: () => crew.map((c) => ({ i: c.i, x: c.x, z: c.z, r: c.rad, top: crewMesh?.extent.top ?? 1, state: c.state, job: c.job?.kind ?? null, carrying: c.carrying, speed: c.speed })),
    // Talking with one of the crew (contact): it stops, turns to you and attends. i: crew index or null.
    talkWith(i) { for (const c of crew) c.talk = c.i === i ? { stance } : null; },
    gesture(i, kind) { const c = crew[i]; if (c) startGesture(c.ex, kind || gestureOf(species)); },
  };
}

// Collects geometry baked into the deck's frame with a colour, and merges it.
// tone: a little variation per face (off for floors, which overlap).
function merger(THREE, tone = true) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  return {
    add(g, matrix, colour) {
      const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(matrix);
      const P = geo.attributes.position, N = geo.attributes.normal;
      c.set(colour);
      for (let i = 0; i < P.count; i++) {
        const k = tone ? 1 + ((((Math.floor(pos.length / 9) * 2654435761) >>> 0) % 1000) / 1000 - .5) * .1 : 1;
        pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r * k, c.g * k, c.b * k);
      }
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
export { PAD_RADIUS };
