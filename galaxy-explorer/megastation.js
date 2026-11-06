// An ark: where a spaceborne civilization lives, having left its world (civilizations.mjs).
// It is huge (one to two and a half kilometres), parked sixty degrees ahead of their
// world along its orbit (arkPosition), lit along its length so it can be seen from across
// the system, and shown on the system map. Its form follows its builders:
//
//   cylinders  two long habitat drums side by side on a spine, turning, with window strips
//   torus      a great wheel on spokes round a hub, turning
//   spindle    a needle with stacked discs along it, ringed with lights
//   sphere     a ball with a lit equator and farm rings either side, spires at the poles
//   bloom      a cluster of grown pods on branching stalks round a core
//
// On top of its hub, the part that does not turn, is a landing deck far larger than any
// station's (station-deck.js, mega): many pads, several landmarks, hangars and a big crew.
// collide(p, rad) keeps a ship out of the hull. THREE is passed in.
import { rng } from './rng.mjs';
import { buildStationDeck } from './station-deck.js';
import { shipDesign } from './ships.js';

const FORMS = { hands: ['cylinders', 'torus', 'spindle'], grazers: ['cylinders', 'sphere', 'torus'], rollers: ['torus', 'torus', 'cylinders'], tripods: ['torus', 'spindle'], nests: ['spindle', 'spindle', 'torus'], hive: ['spindle', 'sphere'], web: ['torus', 'spindle'], burrowers: ['sphere', 'sphere', 'bloom'], tentacles: ['bloom', 'sphere'], drifters: ['bloom', 'bloom', 'sphere'] };
const GROWN = ['grown', 'shell', 'wax', 'living', 'silk', 'membrane'];

export function buildMegastation(THREE, civ, { coarse = false } = {}) {
  const r = rng(civ.id, 'ark');
  const forms = FORMS[civ.family] || FORMS.hands, form = forms[Math.floor(r() * forms.length)];
  const group = new THREE.Group();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(sx, sy, sz));
  const sp = civ.species.colors || {}, design = shipDesign(civ);
  const hull = design.hullColour || '#e8ecef', trim = design.trim || sp.accent || '#c0503a', glowC = design.glow || '#7fd4ff';
  const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  const windowC = mix('#ffd98a', sp.glow || trim, .3), dark = mix(hull, '#20262c', .55);
  const lit = merged(THREE), glow = merged(THREE);
  // Parts that turn: each its own group about its own axis.
  const spinners = [];
  const spinner = (at, axis, rate) => { const s = { at, axis, rate, lit: merged(THREE), glow: merged(THREE), group: new THREE.Group() }; s.group.position.copy(at); spinners.push(s); return s; };
  const solids = []; // for collide(): { type, ... } in the ark's frame
  const S = 1 + r() * .6; // size
  let deckY = 0, deckSize = 135 + r() * 40;

  if (form === 'cylinders') {
    const R = 170 * S, len = 1100 * S, gap = R * 1.35;
    for (const sx of [-1, 1]) {
      const d = spinner(V(sx * gap, 0, 0), 'z', .02 * sx);
      d.lit.add(new THREE.CylinderGeometry(R, R, len, 40, 1).rotateX(Math.PI / 2), L(), hull);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; d.glow.add(new THREE.BoxGeometry(R * .32, 2, len * .92), L(Math.cos(a) * (R + .5), Math.sin(a) * (R + .5), 0, 0, 0, a + Math.PI / 2), k % 2 ? windowC : mix(windowC, '#9fe8ff', .4)); }
      for (const z of [-1, 1]) d.lit.add(new THREE.SphereGeometry(R, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(z * Math.PI / 2), L(0, 0, z * len / 2), trim);
      solids.push({ type: 'capsule', a: V(sx * gap, 0, -len / 2), b: V(sx * gap, 0, len / 2), r: R });
    }
    lit.add(new THREE.BoxGeometry(gap * 2, 40 * S, 120 * S), L(0, 0, 0), dark); // the spine between them
    lit.add(new THREE.BoxGeometry(30, 30, len * 1.1), L(0, 0, 0), dark);
    for (const z of [-1, 1]) for (const sx of [-1, 1]) lit.add(new THREE.BoxGeometry(R * 1.6, 6, R * .9), L(sx * gap, 0, z * len * .62, 0, 0, sx * .5), mix(trim, '#20262c', .3)); // radiator fins off the ends
    // A tower rising between the drums, the deck on top of it, above them both.
    deckY = R * 1.15 + 20 * S;
    lit.add(new THREE.CylinderGeometry(40 * S, 60 * S, deckY - 20 * S, 16).translate(0, (deckY - 20 * S) / 2 + 20 * S, 0), L(), dark);
    solids.push({ type: 'box', c: V(0, 0, 0), h: V(gap, 20 * S + 2, 60 * S) }, { type: 'capsule', a: V(0, 20 * S, 0), b: V(0, deckY - 10, 0), r: 60 * S });
  } else if (form === 'torus') {
    const R = 620 * S, tube = 70 * S, w = spinner(V(), 'y', .01), sLit = w.lit, sGlow = w.glow;
    sLit.add(new THREE.TorusGeometry(R, tube, 18, 120).rotateX(Math.PI / 2), L(), hull);
    sGlow.add(new THREE.TorusGeometry(R + tube * .02, tube * 1.005, 4, 160, Math.PI * 2).rotateX(Math.PI / 2).scale(1, .12, 1), L(), windowC);
    sGlow.add(new THREE.TorusGeometry(R - tube * .98, 3, 3, 160).rotateX(Math.PI / 2), L(), windowC);
    const spokes = 6;
    for (let k = 0; k < spokes; k++) sLit.add(new THREE.CylinderGeometry(14 * S, 14 * S, R * 2, 10).rotateZ(Math.PI / 2), L(0, 0, 0, 0, k * Math.PI / spokes), dark);
    const hub = 150 * S;
    lit.add(new THREE.CylinderGeometry(hub, hub, 70 * S, 40), L(), trim);
    glow.add(new THREE.CylinderGeometry(hub + .5, hub + .5, 4, 40, 1, true), L(0, 10 * S, 0), windowC);
    solids.push({ type: 'torus', R, r: tube }, { type: 'disc', y: 0, R: hub, h: 35 * S }, { type: 'disc', y: 0, R: R, h: 14 * S, spokes: true });
    deckY = 35 * S; deckSize = Math.min(deckSize, hub * .95);
  } else if (form === 'spindle') {
    // A needle hanging under a crowning hub, stacked with turning discs; the deck is the crown.
    const len = 1800 * S, core = 60 * S, w = spinner(V(), 'y', .015), sLit = w.lit, sGlow = w.glow;
    lit.add(new THREE.CylinderGeometry(core, core * .25, len, 24).translate(0, -len / 2, 0), L(), dark);
    solids.push({ type: 'capsule', a: V(0, -len, 0), b: V(0, 0, 0), r: core });
    const n = 8;
    for (let k = 0; k < n; k++) {
      const y = -len * (.12 + k / n * .82), rad = (420 - 300 * k / n + 60 * Math.sin(k * 1.7)) * S, h = 28 * S;
      sLit.add(new THREE.CylinderGeometry(rad, rad * .9, h, 48), L(0, y, 0), k % 2 ? hull : trim);
      sGlow.add(new THREE.CylinderGeometry(rad + .4, rad + .4, 3, 48, 1, true), L(0, y + h * .2, 0), windowC);
      solids.push({ type: 'disc', y, R: rad, h: h / 2 });
    }
    const hub = 170 * S;
    lit.add(new THREE.CylinderGeometry(hub, hub, 40 * S, 40), L(), hull);
    solids.push({ type: 'disc', y: 0, R: hub, h: 20 * S });
    deckY = 20 * S; deckSize = Math.min(deckSize, hub * .95);
  } else if (form === 'sphere') {
    const R = 480 * S, w = spinner(V(), 'y', .012), sLit = w.lit, sGlow = w.glow;
    lit.add(new THREE.SphereGeometry(R, 48, 32), L(), hull);
    glow.add(new THREE.CylinderGeometry(R * 1.002, R * 1.002, 30 * S, 64, 1, true), L(), windowC);
    for (const y of [-1, 1]) { sLit.add(new THREE.TorusGeometry(R * .9, 40 * S, 12, 96).rotateX(Math.PI / 2), L(0, y * R * .55, 0), trim); sGlow.add(new THREE.TorusGeometry(R * .9, 41 * S, 3, 96).rotateX(Math.PI / 2).scale(1, .15, 1), L(0, y * R * .55, 0), mix(windowC, '#9fffb0', .5)); solids.push({ type: 'torus', R: R * .9, r: 40 * S, y: y * R * .55 }); }
    lit.add(new THREE.CylinderGeometry(30 * S, 60 * S, 400 * S, 16), L(0, -R - 180 * S, 0), dark);
    solids.push({ type: 'sphere', c: V(), r: R });
    // A flat top cut onto the pole for the deck.
    const top = 210 * S;
    lit.add(new THREE.CylinderGeometry(top, top * 1.1, 60 * S, 48), L(0, R * .93, 0), trim);
    solids.push({ type: 'disc', y: R * .93 + 30 * S, R: top, h: 30 * S });
    deckY = R * .93 + 60 * S; deckSize = Math.min(deckSize, top * .95);
  } else { // bloom
    const coreR = 200 * S;
    lit.add(new THREE.SphereGeometry(coreR, 32, 20).scale(1, .8, 1), L(), trim);
    // Pods hang below and round the core, never above its crown.
    solids.push({ type: 'sphere', c: V(), r: coreR * .95 });
    const pods = 8 + Math.floor(r() * 5);
    for (let k = 0; k < pods; k++) {
      const a = k / pods * Math.PI * 2 + r(), b = -.9 + r() * .95, d = coreR + (250 + r() * 400) * S, pr = (90 + r() * 110) * S;
      const c = V(Math.cos(a) * Math.cos(b) * d, Math.sin(b) * d, Math.sin(a) * Math.cos(b) * d);
      const stalk = new THREE.CylinderGeometry(12 * S, 20 * S, d - pr * .8, 8).translate(0, (d - pr * .8) / 2, 0);
      lit.add(stalk, new THREE.Matrix4().compose(V(), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().normalize()), V(1, 1, 1)), dark);
      lit.add(new THREE.SphereGeometry(pr, 20, 14).scale(1, 1.3, 1), L(c.x, c.y, c.z), mix(hull, trim, r() * .5));
      glow.add(new THREE.TorusGeometry(pr * 1.01, 2.5 * S, 3, 40).rotateX(Math.PI / 2), L(c.x, c.y, c.z), mix(windowC, '#c0ffb0', .4));
      solids.push({ type: 'sphere', c, r: pr * 1.2 });
    }
    const top = 160 * S;
    lit.add(new THREE.CylinderGeometry(top, top * 1.15, 40 * S, 40), L(0, coreR * .78, 0), hull);
    solids.push({ type: 'disc', y: coreR * .78 + 20 * S, R: top, h: 20 * S });
    deckY = coreR * .78 + 40 * S; deckSize = Math.min(deckSize, top * .95);
  }
  // Running lights and beacons round its outline, so it reads from far off.
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, rr = (form === 'torus' ? 620 : form === 'sphere' ? 480 : 260) * S * (1.05 + (k % 3) * .02); glow.add(new THREE.IcosahedronGeometry(4 * S, 0), L(Math.cos(a) * rr, form === 'spindle' ? -60 * S : 0, Math.sin(a) * rr), k % 4 ? windowC : '#ff6a5a'); }
  // Beacons at the extremes, so its outline shows from far off.
  const box = new THREE.Box3();
  const meshes = [];
  // No fog: an ark hangs in the sky of a world with air like a moon, rather than fading into its haze.
  const mat = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .55, metalness: .25, fog: false });
  const parts = [[lit, group, false], [glow, group, true]];
  for (const w of spinners) { group.add(w.group); parts.push([w.lit, w.group, false], [w.glow, w.group, true]); }
  for (const [m, parent, glowing] of parts) {
    if (!m.count()) continue;
    const mesh = new THREE.Mesh(m.geometry(), glowing ? new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }) : mat());
    mesh.frustumCulled = false; parent.add(mesh); meshes.push(mesh);
  }
  group.updateMatrixWorld(true);
  for (const m of meshes) box.expandByObject(m);
  // From across the system it is a steady point of light (a few pixels, whatever the distance).
  const beacon = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)), new THREE.PointsMaterial({ color: windowC, size: 5, sizeAttenuation: false, transparent: true, opacity: .9, depthWrite: false, fog: false }));
  beacon.frustumCulled = false; group.add(beacon);
  // The deck: as big as the hub allows.
  const deck = buildStationDeck(THREE, { seed: `${civ.id}:ark`, tier: civ.tier, level: 5, civ, organic: GROWN.includes(civ.material), coarse, mega: true, bare: true, size: Math.round(Math.min(150, Math.max(110, deckSize))),
    colours: { hull, trim, glow: glowC, panel: mix('#1b2a52', trim, .05), window: windowC } });
  deck.group.position.y = deckY + .01;
  group.add(deck.group);
  const size = box.getSize(V()).length() / 2;

  // Keep a sphere of radius rad (a ship, in the ark's frame) out of the hull.
  const tmp = V(), tmp2 = V();
  function collide(p, rad) {
    let hit = false;
    for (const s of solids) {
      if (s.type === 'sphere') { tmp.copy(p).sub(s.c); const d = tmp.length(), min = s.r + rad; if (d < min) { p.copy(s.c).addScaledVector(tmp.normalize(), min); hit = true; } }
      else if (s.type === 'capsule') { tmp2.copy(s.b).sub(s.a); const t = Math.max(0, Math.min(1, tmp.copy(p).sub(s.a).dot(tmp2) / tmp2.lengthSq())); const c = s.a.clone().addScaledVector(tmp2, t); tmp.copy(p).sub(c); const d = tmp.length(), min = s.r + rad; if (d < min) { p.copy(c).addScaledVector(d > 1e-6 ? tmp.normalize() : V(1, 0, 0), min); hit = true; } }
      else if (s.type === 'torus') { const y = p.y - (s.y || 0), h = Math.hypot(p.x, p.z) || 1e-6, c = V(p.x / h * s.R, s.y || 0, p.z / h * s.R); tmp.copy(p).sub(c); const d = tmp.length(), min = s.r + rad; if (d < min) { p.copy(c).addScaledVector(d > 1e-6 ? tmp.normalize() : V(0, Math.sign(y) || 1, 0), min); hit = true; } }
      else if (s.type === 'disc') { const h = Math.hypot(p.x, p.z), dy = p.y - s.y; if (!s.spokes && h < s.R + rad && Math.abs(dy) < s.h + rad) { const up = s.h + rad - Math.abs(dy), out = s.R + rad - h; if (up < out) p.y = s.y + Math.sign(dy || 1) * (s.h + rad); else { p.x *= (s.R + rad) / Math.max(h, 1e-6); p.z *= (s.R + rad) / Math.max(h, 1e-6); } hit = true; } }
      else if (s.type === 'box') { tmp.copy(p).sub(s.c); const ox = s.h.x + rad - Math.abs(tmp.x), oy = s.h.y + rad - Math.abs(tmp.y), oz = s.h.z + rad - Math.abs(tmp.z); if (ox > 0 && oy > 0 && oz > 0) { if (oy <= ox && oy <= oz) p.y += Math.sign(tmp.y || 1) * oy; else if (ox <= oz) p.x += Math.sign(tmp.x || 1) * ox; else p.z += Math.sign(tmp.z || 1) * oz; hit = true; } }
    }
    return hit;
  }
  return {
    group, deck, form, civ, name: civ.arkName, size,
    update(t) { for (const w of spinners) w.group.rotation[w.axis] = t * w.rate; },
    collide,
    dispose() { group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); },
  };
}

function merged(THREE) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  return {
    add(g, m, colour) {
      const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(m || new THREE.Matrix4()); c.set(colour);
      const P = geo.attributes.position, N = geo.attributes.normal;
      for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
      geo.dispose(); if (geo !== g) g.dispose();
    },
    count: () => pos.length,
    geometry() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return geo;
    },
  };
}
