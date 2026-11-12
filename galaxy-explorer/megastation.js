// An ark: where a spaceborne civilization lives, having left its world (civilizations.mjs).
// It is huge (one to two and a half kilometres), parked sixty degrees ahead of their
// world along its orbit (arkPosition), lit along its length so it can be seen from across
// the system, and shown on the system map. Its form follows its builders:
//
//   Every ark is wrapped round one great hall: a hollow drum, kilometres long, open at one end
//   behind a shimmering field. Fly in through the gate and set down on the deck on its floor;
//   round the deck are spiral ramps and catwalks to climb, tier upon tier of lit galleries up
//   the walls and the glowing core at the far end. Outside, each kind looks its own:
//
//   drum       the hall alone, a citadel: towers stepping along its back, sponsons, engines
//   cylinders  the hall between two long habitat drums turning on trusses
//   torus      the hall as the axle of two great wheels turning against each other
//   spindle    the hall threaded with turning discs, a long needle behind
//   sphere     a ball with the hall bored through it, farm rings turning round it
//   bloom      the hall grown as a trunk, pods hanging round it on stalks
//
// On the hall's floor is a landing deck far larger than any
// station's (station-deck.js, mega): many pads, several landmarks, hangars and a big crew.
// collide(p, rad) keeps a ship out of the hull. THREE is passed in.
import { addHullFeel } from './hull-feel.js';
import { rng } from './rng.mjs';
import { buildStationDeck } from './station-deck.js';
import { shipDesign } from './ships.js';

// Each family builds its own kinds; every one of them is wrapped round a great hall you can fly into.
const FORMS = { hands: ['cylinders', 'torus', 'drum'], grazers: ['cylinders', 'sphere', 'torus'], rollers: ['torus', 'cylinders', 'drum'], tripods: ['torus', 'spindle'], nests: ['spindle', 'torus', 'drum'], hive: ['spindle', 'sphere'], web: ['torus', 'spindle'], burrowers: ['sphere', 'bloom', 'drum'], tentacles: ['bloom', 'sphere'], drifters: ['bloom', 'sphere'] };
const GROWN = ['grown', 'shell', 'wax', 'living', 'silk', 'membrane'];

export function buildMegastation(THREE, civ, { coarse = false, form: forced = null } = {}) {
  const r = rng(civ.id, 'ark');
  const forms = FORMS[civ.family] || FORMS.hands, form = forced || forms[Math.floor(r() * forms.length)];
  const group = new THREE.Group();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(sx, sy, sz));
  const sp = civ.species.colors || {}, design = shipDesign(civ);
  const hull = design.hullColour || '#e8ecef', trim = '#' + new THREE.Color(design.trim || sp.accent || '#c0503a').lerp(new THREE.Color(design.hullColour || '#e8ecef'), .45).getHexString(), glowC = design.glow || '#7fd4ff';
  const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  const windowC = mix('#ffd98a', sp.glow || trim, .3), dark = mix(hull, '#20262c', .55);
  let lit = merged(THREE), glow = merged(THREE), plain = merged(THREE); const glass = merged(THREE); // plain: machinery, no windows
  // What is inside a hall is kept apart (inside), drawn only when you are near enough to see in.
  const inLit = merged(THREE), inGlow = merged(THREE), inPlain = merged(THREE), inside = new THREE.Group();
  group.add(inside);
  const animate = [], lanes = [];
  // Parts that turn: each its own group about its own axis.
  const spinners = [];
  const spinner = (at, axis, rate) => { const s = { at, axis, rate, lit: merged(THREE), glow: merged(THREE), plain: merged(THREE), inner: merged(THREE), cloud: merged(THREE), group: new THREE.Group() }; s.group.position.copy(at); spinners.push(s); return s; };
  const solids = []; // for collide(): { type, ... } in the ark's frame
  const S = 1 + r() * .6; // size
  let deckY = 0, deckSize = 135 + r() * 40, deckAt = null;
  const fields = [], interior = []; // a drum's gate field and its hall (built below)

  const steel = mix(hull, '#7d848c', .55), steelD = mix(hull, '#3a4048', .6);
  function plainMat() { return addHullFeel(THREE, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .6, metalness: .3, fog: false }), { plate: 14 * S }); }
  const along = (g, z) => g.rotateX(Math.PI / 2).translate(0, 0, z);
  // --- The hall: every ark is built round one -------------------------------------------
  // A vast hollow drum along z, still (not turning), closed at z0 and open at z1 behind a
  // shimmering field. Inside: tier upon tier of lit galleries up the curved walls, light-strips
  // along the ceiling, a great floor with the landing deck near the gate, and at the far end the
  // glowing core. Each form then wraps its own outside round it.
  let hallInfo = null;
  function hall(R, len, z0, { skin = steel, ribs = 8, use = 'cargo' } = {}) {
    const wall = 24 * S, z1 = z0 + len, gate = R * .62, zc = z0 + len / 2;
    // Outside: plated, ribbed, a lit band round the middle, a closed end.
    lit.add(along(new THREE.CylinderGeometry(R + wall, R + wall, len, 64, 1, true), zc), L(), skin);
    for (let i = 0; i <= ribs; i++) plain.add(new THREE.TorusGeometry(R + wall + 2 * S, 5 * S, 4, 72), L(0, 0, z0 + i / ribs * len), steelD);
    glow.add(along(new THREE.CylinderGeometry(R + wall + 2, R + wall + 2, 6 * S, 64, 1, true), zc), L(), windowC);
    plain.add(new THREE.CircleGeometry(R + wall, 64).rotateY(Math.PI), L(0, 0, z0), steelD);
    // The gate: a thick rim round the opening, lit, and a faint field across it.
    plain.add(new THREE.RingGeometry(gate, R + wall, 72, 1), L(0, 0, z1), steelD);
    plain.add(new THREE.RingGeometry(gate, R + wall, 72, 1).rotateY(Math.PI), L(0, 0, z1 - 1), steelD);
    plain.add(new THREE.TorusGeometry(gate, 14 * S, 6, 96), L(0, 0, z1), steel);
    glow.add(new THREE.TorusGeometry(gate - 12 * S, 3 * S, 4, 96), L(0, 0, z1 + 4), windowC);
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; glow.add(new THREE.BoxGeometry(5 * S, 20 * S, 3 * S), L(Math.cos(a) * (gate + 30 * S), Math.sin(a) * (gate + 30 * S), z1 + 3, 0, 0, a + Math.PI / 2), k % 3 ? windowC : '#ff6a5a'); }
    fields.push({ r: gate - 14 * S, z: z1 });
    // Inside, the walls are a city: storey on storey of lived-in rooms (their windows drawn by
    // the wall's own material), with balconies running the length of the hall between them.
    interior.push({ R: R - 1, len, z: zc });
    const outer = [lit, glow, plain]; lit = inLit; glow = inGlow; plain = inPlain; // from here on, inside
    const floorY = -R * .55, half = Math.sqrt(R * R - floorY * floorY), floorW = half * 2, base = Math.asin(floorY / R);
    for (let i = 0; i < 9; i++) {
      const ang = base + (i + 1) / 10 * (Math.PI - 2 * base);
      for (const side of [-1, 1]) {
        const th = side < 0 ? Math.PI - ang : ang, x = Math.cos(th) * (R - 10 * S), y = Math.sin(th) * (R - 10 * S);
        if (y < floorY + 40 * S) continue;
        plain.add(new THREE.BoxGeometry(18 * S, 2 * S, len * .96), L(x, y, zc, 0, 0, th - Math.PI / 2), steelD);
        solids.push({ type: 'capsule', a: V(x, y, z0 + len * .02), b: V(x, y, z1 - len * .02), r: 6 * S });
        glow.add(new THREE.BoxGeometry(18.2 * S, .4 * S, len * .96), L(x, y - 1.1 * S, zc, 0, 0, th - Math.PI / 2), mix(windowC, '#000000', .35));
      }
    }
    // Daylight: long light-strips down the ceiling.
    const sky = { farm: '#ffd6ee', park: '#fff0d0', foundry: '#ffc89a', grown: '#b8ffe6' }[use] || '#e8f4ff';
    for (let k = -2; k <= 2; k++) glow.add(new THREE.BoxGeometry(8 * S, 3 * S, len * .9), L(k * 70 * S, R * .97 - Math.abs(k) * 12 * S, zc), sky);
    // Power: two great conduits from the core along the ceiling to the gate, lit at their joints.
    for (const sx of [-1, 1]) {
      const a = Math.PI / 2 + sx * .75, cx = Math.cos(a) * (R - 26 * S), cy = Math.sin(a) * (R - 26 * S), cl = len - 300 * S;
      plain.add(along(new THREE.CylinderGeometry(12 * S, 12 * S, cl, 12), z0 + 300 * S + cl / 2), L(cx, cy), dark);
      solids.push({ type: 'capsule', a: V(cx, cy, z0 + 300 * S), b: V(cx, cy, z1 - 10 * S), r: 17 * S });
      for (let z = z0 + 340 * S; z < z1 - 20 * S; z += 140 * S) { plain.add(along(new THREE.CylinderGeometry(16 * S, 16 * S, 8 * S, 12), z), L(cx, cy), steel); glow.add(along(new THREE.CylinderGeometry(16.5 * S, 16.5 * S, 1.5 * S, 12, 1, true), z), L(cx, cy), '#9fe8ff'); }
    }
    // The floor: plating with service trenches.
    plain.add(new THREE.BoxGeometry(floorW, 14 * S, len * .985), L(0, floorY - 7 * S, zc), steelD);
    for (let k = -3; k <= 3; k++) { if (!k) continue; plain.add(new THREE.BoxGeometry(10 * S, 6 * S, len * .9), L(k * floorW / 8, floorY - 2.5 * S, zc), mix(steelD, '#000000', .4)); }
    solids.push({ type: 'box', c: V(0, floorY - 7 * S, zc), h: V(half, 7 * S, len / 2) });
    const deckZ = z1 - 420 * S, portZ0 = deckZ - 330, portZ1 = deckZ + 220; // the deck and its terminals (built below)
    const keepOut = (z, d = 0) => z > portZ0 - d && z < portZ1 + d;
    // Along the walls, the town: blocks of rooms, shopfronts lit at their feet, lights on top.
    const n = Math.round(len / (160 * S));
    for (let i = 0; i < n; i++) for (const sx of [-1, 1]) {
      const z = z0 + 120 * S + i / n * (len - 300 * S), h = (40 + r() * 140) * S, w = (60 + r() * 60) * S, x = sx * (half - w * .7);
      if (keepOut(z, w)) continue;
      lit.add(new THREE.BoxGeometry(w, h, w * 1.3), L(x, floorY + h / 2, z), r() < .5 ? steel : steelD);
      glow.add(new THREE.BoxGeometry(w * 1.01, 5 * S, w * 1.31), L(x, floorY + 4 * S, z), windowC);
      glow.add(new THREE.IcosahedronGeometry(2.5 * S, 0), L(x, floorY + h + 3 * S, z), '#ff6a5a');
      solids.push({ type: 'box', c: V(x, floorY + h / 2, z), h: V(w / 2, h / 2, w * .65) });
    }
    // Between the core and the port, each kind of ark keeps what it is for (use):
    //   cargo    a trading hub: freight pods stacked in rows under gantry cranes
    //   yard     a citadel's shipyard: a warship being built in its cradle, scaffolds, welding
    //   farm     farm decks: fields in bands, glasshouse vaults, grow-lamps over the crops
    //   park     parkland: lawns, woods, a lake with a pavilion, lanterns along the paths
    //   foundry  furnaces in rows glowing at their mouths, stacks, conveyors of hot ingots
    //   grown    a grown interior: mounds, root arches across the hall, glowing pods hanging
    const ya = floorY, cz0 = z0 + 500 * S, cz1 = portZ0 - 40 * S, zl = cz1 - cz0, zm = (cz0 + cz1) / 2, edge = half - 170 * S, X0 = 50 * S;
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), Cy = (a, b, h, n = 16, open = false) => new THREE.CylinderGeometry(a, b, h, n, 1, open);
    if (zl > 120 * S) {
      if (use === 'cargo') {
        const pods = ['#a4583a', '#3f7f86', '#b8913a', '#6d747c', '#8a4f6d', '#4d6a8f'];
        for (let z = cz0; z < cz1; z += 56 * S) for (const sx of [-1, 1]) for (let x = 60 * S; x < edge; x += 34 * S) {
          if (r() < .18) continue;
          const k = 1 + Math.floor(r() * 4), c = pods[Math.floor(r() * pods.length)];
          for (let j = 0; j < k; j++) plain.add(B(28 * S, 13 * S, 48 * S), L(sx * x, ya + 6.5 * S + j * 13.4 * S, z), mix(c, '#20262c', j % 2 * .15));
          solids.push({ type: 'box', c: V(sx * x, ya + k * 6.7 * S, z), h: V(14 * S, k * 6.7 * S, 24 * S) });
        }
        for (let z = cz0 + 150 * S; z < cz1 - 60 * S; z += 420 * S) for (const sx of [-1, 1]) {
          const xa = sx * 40 * S, xb = sx * (edge + 20 * S), ht = 90 * S;
          for (const x of [xa, xb]) for (const dz of [-30 * S, 30 * S]) plain.add(B(6 * S, ht, 6 * S), L(x, ya + ht / 2, z + dz), '#c9a23a');
          plain.add(B(Math.abs(xb - xa) + 8 * S, 8 * S, 66 * S), L((xa + xb) / 2, ya + ht, z), '#c9a23a');
          const tx = xa + (xb - xa) * (.3 + r() * .5);
          plain.add(B(16 * S, 12 * S, 20 * S), L(tx, ya + ht - 10 * S, z), dark);
          plain.add(B(1 * S, 30 * S, 1 * S), L(tx, ya + ht - 31 * S, z), dark);
          glow.add(new THREE.IcosahedronGeometry(2 * S, 0), L(xb, ya + ht + 6 * S, z), '#ffb040');
          for (const x of [xa, xb]) solids.push({ type: 'box', c: V(x, ya + ht / 2, z), h: V(4 * S, ht / 2, 34 * S) });
          solids.push({ type: 'box', c: V((xa + xb) / 2, ya + ht, z), h: V(Math.abs(xb - xa) / 2 + 4 * S, 5 * S, 33 * S) });
        }
      } else if (use === 'yard') {
        const sl = zl * .86, kr = 62 * S, ky = ya + 34 * S + kr, za = zm - sl / 2, gold = '#c9a23a';
        for (let z = za + 30 * S; z < za + sl; z += 90 * S) { plain.add(B(100 * S, 34 * S, 14 * S), L(0, ya + 17 * S, z), gold); solids.push({ type: 'box', c: V(0, ya + 17 * S, z), h: V(50 * S, 17 * S, 7 * S) }); } // cradles
        plain.add(B(10 * S, 10 * S, sl), L(0, ky - kr, zm), dark); plain.add(B(8 * S, 8 * S, sl), L(0, ky + kr, zm), dark);
        for (let z = za; z <= za + sl; z += 34 * S) { const t = (z - za) / sl, rr = kr * (t < .72 ? 1 : 1 - (t - .72) / .28 * .8); plain.add(new THREE.TorusGeometry(rr, 3 * S, 4, 32), L(0, ky, z), steel); }
        const p1 = za + sl * .45;
        plain.add(along(Cy(kr + 2 * S, kr + 2 * S, p1 - za, 40, true), (za + p1) / 2), L(0, ky), hull); // plated already, the back half
        for (let i = 0; i < 46; i++) { const a = r() * Math.PI * 2, z = p1 + r() * sl * .28; plain.add(B(22 * S, 2 * S, 30 * S), L(Math.cos(a) * (kr + 1 * S), ky + Math.sin(a) * (kr + 1 * S), z, 0, 0, a + Math.PI / 2), hull); }
        for (const [x, y] of [[-32, -22], [32, -22], [0, 34]]) plain.add(along(Cy(14 * S, 24 * S, 40 * S, 16, true), za - 18 * S), L(x * S, ky + y * S), dark);
        plain.add(B(30 * S, 40 * S, 60 * S), L(0, ky + kr + 22 * S, za + sl * .25), steelD); solids.push({ type: 'box', c: V(0, ky + kr + 22 * S, za + sl * .25), h: V(15 * S, 20 * S, 30 * S) }); // its bridge
        for (let z = za + 40 * S; z < za + sl; z += 130 * S) for (const sx of [-1, 1]) { // scaffolds, lit at every level
          const x = sx * (kr + 42 * S), h = 2 * kr + 50 * S;
          for (const dx of [-8, 8]) for (const dz of [-14, 14]) plain.add(B(2 * S, h, 2 * S), L(x + dx * S, ya + h / 2, z + dz * S), gold);
          for (let y = 25 * S; y < h; y += 25 * S) { plain.add(B(20 * S, 1.5 * S, 32 * S), L(x, ya + y, z), '#8a7a3a'); glow.add(B(20.4 * S, .4 * S, 32.4 * S), L(x, ya + y - 1 * S, z), '#ffcf70'); }
          solids.push({ type: 'box', c: V(x, ya + h / 2, z), h: V(10 * S, h / 2, 16 * S) });
        }
        for (let i = 0; i < 36; i++) { const a = r() * Math.PI * 2, z = p1 + r() * sl * .5; glow.add(new THREE.IcosahedronGeometry(1.6 * S, 0), L(Math.cos(a) * kr, ky + Math.sin(a) * kr, z), r() < .5 ? '#ffffff' : '#7fd4ff'); } // welding
        solids.push({ type: 'capsule', a: V(0, ky, za), b: V(0, ky, za + sl), r: kr + 4 * S });
      } else if (use === 'farm') {
        const crops = ['#5f8f3a', '#86a83c', '#c2ad48', '#3f7a4a', '#9a8a3a'];
        for (let z = cz0; z < cz1 - 30 * S; z += 34 * S) for (const sx of [-1, 1]) {
          plain.add(B(edge - X0, 2 * S, 28 * S), L(sx * (X0 + edge) / 2, ya + 1 * S, z + 14 * S), crops[Math.floor(r() * crops.length)]);
          glow.add(B(edge - X0, .3 * S, 3 * S), L(sx * (X0 + edge) / 2, ya + .3 * S, z + 31 * S), '#3f8fc0'); // irrigation
        }
        for (let z = cz0 + 30 * S; z < cz1 - 150 * S; z += 230 * S) for (const sx of [-1, 1]) { // glasshouse vaults
          const gx = sx * (X0 + 70 * S), gl = 150 * S, gr = 34 * S;
          glass.add(along(new THREE.CylinderGeometry(gr, gr, gl, 20, 1, true, Math.PI / 2, Math.PI), z + gl / 2), L(gx, ya), '#cfe8ff');
          for (let k = 0; k <= 6; k++) plain.add(new THREE.TorusGeometry(gr, 1 * S, 3, 16, Math.PI), L(gx, ya, z + k / 6 * gl), steel);
          for (const dx of [-12, 0, 12]) glow.add(B(6 * S, 4 * S, gl * .9), L(gx + dx * S, ya + 2 * S, z + gl / 2), '#5fcf6a');
          solids.push({ type: 'box', c: V(gx, ya + gr / 2, z + gl / 2), h: V(gr, gr / 2, gl / 2) });
        }
        for (let z = cz0 + 30 * S; z < cz1; z += 70 * S) for (const sx of [-1, 1]) for (let x = X0 + 40 * S; x < edge; x += 80 * S) glow.add(B(30 * S, 1 * S, 5 * S), L(sx * x, ya + 70 * S, z), '#ff9ad8'); // grow-lamps
        if (cz1 > cz0) for (const sx of [-1, 1]) solids.push({ type: 'box', c: V(sx * (X0 + edge) / 2, ya + 70 * S, zm), h: V((edge - X0) / 2, 2 * S, zl / 2) });
        for (const z of [cz0 + 20 * S, cz1 - 30 * S]) for (const sx of [-1, 1]) { plain.add(Cy(18 * S, 18 * S, 90 * S, 16), L(sx * (edge - 10 * S), ya + 45 * S, z), steel); plain.add(new THREE.SphereGeometry(18 * S, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), L(sx * (edge - 10 * S), ya + 90 * S, z), steelD); solids.push({ type: 'capsule', a: V(sx * (edge - 10 * S), ya, z), b: V(sx * (edge - 10 * S), ya + 95 * S, z), r: 18 * S }); }
      } else if (use === 'park') {
        plain.add(B(2 * edge + 60 * S, 1.2 * S, zl), L(0, ya + .6 * S, zm), '#4f7d3c');
        const lx = edge * .35, lz = cz0 + zl * .55, lr = Math.min(edge * .45, zl * .28);
        glow.add(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2).scale(lr * 1.4, 1, lr), L(lx, ya + 1.3 * S, lz), '#2d6f9a');
        plain.add(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2).scale(lr * 1.48, 1, lr * 1.08), L(lx, ya + 1.25 * S, lz), '#b9ad8a');
        const inLake = (x, z) => ((x - lx) / (lr * 1.55)) ** 2 + ((z - lz) / (lr * 1.15)) ** 2 < 1;
        const greens = ['#3f6f35', '#527f3a', '#2f5a30', '#6d8f3f', '#7a6a3a'];
        for (let i = 0; i < 220; i++) {
          const x = (r() * 2 - 1) * edge, z = cz0 + r() * zl;
          if (inLake(x, z) || Math.abs(x) < 12 * S) continue;
          const h = (14 + r() * 26) * S, cr = h * (.35 + r() * .2);
          plain.add(Cy(1.2 * S, 2 * S, h * .5, 6), L(x, ya + h * .25, z), '#5a4430');
          plain.add(new THREE.IcosahedronGeometry(cr, 1).scale(1, 1.25, 1), L(x, ya + h * .5 + cr, z), greens[i % greens.length]);
          solids.push({ type: 'capsule', a: V(x, ya, z), b: V(x, ya + h * .5 + cr, z), r: cr });
        }
        for (let z = cz0 + 10 * S; z < cz1; z += 30 * S) { // a path down the middle, lanterns along it
          const x = Math.sin((z - cz0) / (160 * S)) * 30 * S;
          plain.add(B(10 * S, .4 * S, 31 * S), L(x, ya + 1.3 * S, z), '#cbbf9a');
          if (Math.round((z - cz0) / (30 * S)) % 2) glow.add(new THREE.IcosahedronGeometry(1.2 * S, 0), L(x + 8 * S, ya + 7 * S, z), '#ffd890');
        }
        const px = lx - lr * 1.6, pz = lz; // a pavilion by the lake
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; plain.add(Cy(1.2 * S, 1.2 * S, 16 * S, 8), L(px + Math.cos(a) * 16 * S, ya + 8 * S, pz + Math.sin(a) * 16 * S), '#e8e2d0'); }
        plain.add(Cy(4 * S, 22 * S, 8 * S, 24), L(px, ya + 20 * S, pz), trim); solids.push({ type: 'capsule', a: V(px, ya, pz), b: V(px, ya + 20 * S, pz), r: 20 * S }); glow.add(new THREE.TorusGeometry(16 * S, .5 * S, 3, 32).rotateX(Math.PI / 2), L(px, ya + 15.5 * S, pz), '#ffd890');
      } else if (use === 'foundry') {
        for (let z = cz0 + 40 * S; z < cz1 - 40 * S; z += 120 * S) for (const sx of [-1, 1]) {
          const fr = (26 + r() * 14) * S, fh = (80 + r() * 70) * S, x = sx * (X0 + 75 * S + r() * Math.max(0, edge - X0 - 150 * S));
          plain.add(Cy(fr * .85, fr, fh, 20), L(x, ya + fh / 2, z), steelD);
          plain.add(Cy(fr * 1.05, fr * 1.05, 6 * S, 20), L(x, ya + fh * .7, z), dark);
          glow.add(Cy(fr * 1.06, fr * 1.06, 2 * S, 20, true), L(x, ya + fh * .7, z), '#ff7a2a');
          glow.add(new THREE.CircleGeometry(fr * .78, 20).rotateX(-Math.PI / 2), L(x, ya + fh + .5 * S, z), '#ffb347');
          plain.add(Cy(5 * S, 6 * S, fh * 1.5, 8), L(x + sx * fr * .9, ya + fh * .75, z + fr * .7), dark);
          glow.add(new THREE.IcosahedronGeometry(2 * S, 0), L(x + sx * fr * .9, ya + fh * 1.5 + 2 * S, z + fr * .7), '#ff4030');
          glow.add(new THREE.CircleGeometry(fr * .5, 16).rotateX(-Math.PI / 2), L(x - sx * fr * 1.6, ya + .4 * S, z), '#ff6a20'); // a spill of slag
          solids.push({ type: 'capsule', a: V(x, ya, z), b: V(x, ya + fh, z), r: fr });
        }
        const belt = new THREE.Group(), ing = merged(THREE);
        for (const sx of [-1, 1]) { plain.add(B(14 * S, 6 * S, zl), L(sx * (X0 + 15 * S), ya + 3 * S, zm), dark); for (let z = cz0; z < cz1 - 18 * S; z += 18 * S) ing.add(B(6 * S, 3 * S, 9 * S), L(sx * (X0 + 15 * S), ya + 7.5 * S, z), '#ff8a30'); }
        belt.add(new THREE.Mesh(ing.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }))); belt.children[0].frustumCulled = false; inside.add(belt);
        animate.push((t) => (belt.position.z = (t * 6 * S) % (18 * S)));
      } else if (use === 'grown') {
        for (let i = 0; i < 70; i++) {
          const x = (r() * 2 - 1) * edge, z = cz0 + r() * zl, rad = (18 + r() * 40) * S;
          plain.add(new THREE.SphereGeometry(rad, 12, 8).scale(1, .5, 1.25), L(x, ya, z), mix(trim, hull, r()));
          for (let k = 0; k < 3; k++) glow.add(new THREE.IcosahedronGeometry(2 * S, 0), L(x + (r() - .5) * rad, ya + rad * .42, z + (r() - .5) * rad), mix(glowC, '#7dffd0', .5));
          solids.push({ type: 'sphere', c: V(x, ya - rad * .3, z), r: rad * .75 });
        }
        for (let z = cz0 + 60 * S; z < cz1; z += 210 * S) { // root arches
          const ar = half * .7;
          plain.add(new THREE.TorusGeometry(ar, 10 * S, 6, 30, Math.PI), L(0, ya, z, 0, (r() - .5) * .4, 0), mix(trim, '#3a2a20', .4));
          solids.push({ type: 'torusZ', R: ar, r: 10 * S, z, cy: ya });
        }
        for (let i = 0; i < 60; i++) { // glowing pods on stalks hanging from the ceiling
          const x = (r() * 2 - 1) * half * .85, z = cz0 + r() * zl, top = Math.sqrt(R * R - x * x) - 10 * S, l = (60 + r() * 120) * S, pr = (5 + r() * 7) * S;
          plain.add(Cy(1 * S, 2.5 * S, l, 5), L(x, top - l / 2, z), dark);
          solids.push({ type: 'capsule', a: V(x, top, z), b: V(x, top - l - pr, z), r: pr * 1.3 });
          glow.add(new THREE.SphereGeometry(pr, 10, 8).scale(1, 1.4, 1), L(x, top - l - pr, z), r() < .6 ? mix(glowC, '#7dffd0', .4) : '#ffd37a');
        }
        for (let i = 0; i < 12; i++) glow.add(new THREE.CircleGeometry((10 + r() * 20) * S, 20).rotateX(-Math.PI / 2), L((r() * 2 - 1) * edge, ya + .4 * S, cz0 + r() * zl), '#2fbfa0');
      }
    }
    // The tram line: up on pylons down the middle, a station at each end, two trams shuttling.
    const ty = floorY + 80 * S, ta = z0 + 520 * S, tb = z1 - 90 * S;
    if (tb - ta > 400 * S && use !== 'yard' && use !== 'grown') {
      plain.add(new THREE.BoxGeometry(22 * S, 5 * S, tb - ta), L(0, ty - 2.5 * S, (ta + tb) / 2), steelD);
      glow.add(new THREE.BoxGeometry(22.2 * S, .6 * S, tb - ta), L(0, ty - 4.5 * S, (ta + tb) / 2), windowC);
      for (let z = ta + 60 * S; z < tb; z += 150 * S) {
        if (Math.abs(z - deckZ) < 260) continue; // not through the port
        plain.add(new THREE.BoxGeometry(8 * S, ty - floorY, 8 * S), L(0, (ty + floorY) / 2, z), steelD);
        solids.push({ type: 'box', c: V(0, (ty + floorY) / 2, z), h: V(5 * S, (ty - floorY) / 2, 5 * S) });
      }
      for (const z of [ta, tb]) { solids.push({ type: 'box', c: V(0, ty, z), h: V(30 * S, 8 * S, 35 * S) }); plain.add(new THREE.BoxGeometry(60 * S, 4 * S, 70 * S), L(0, ty - 3 * S, z), steel); glow.add(new THREE.BoxGeometry(60.4 * S, 1.2 * S, 70.4 * S), L(0, ty + .2 * S, z), windowC); }
      solids.push({ type: 'box', c: V(0, ty - 2.5 * S, (ta + tb) / 2), h: V(30 * S, 4 * S, (tb - ta) / 2) });
      for (const [sx, ph] of [[-1, 0], [1, Math.PI]]) {
        const tram = new THREE.Group(), tl = merged(THREE), tg = merged(THREE);
        for (let c = 0; c < 3; c++) { tl.add(new THREE.BoxGeometry(8 * S, 7 * S, 26 * S), L(0, 3.5 * S, (c - 1) * 27.5 * S), c % 2 ? hull : trim); tg.add(new THREE.BoxGeometry(8.2 * S, 1.6 * S, 24 * S), L(0, 4.5 * S, (c - 1) * 27.5 * S), windowC); }
        tg.add(new THREE.BoxGeometry(3 * S, 2 * S, .5 * S), L(0, 3 * S, 40 * S), '#ffffff');
        tram.add(new THREE.Mesh(tl.geometry(), plainMat()), new THREE.Mesh(tg.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
        tram.traverse((o) => (o.frustumCulled = false)); inside.add(tram);
        const lo = ta + 45 * S, hi = tb - 45 * S;
        animate.push((t) => tram.position.set(sx * 5.5 * S, ty, lo + (hi - lo) * (.5 - .5 * Math.cos(t * .022 + ph))));
      }
    }
    // Traffic: shuttles flying in through the gate and out of it, to and from berths in the far wall.
    const laneX = R * .66, laneY = R * .14;
    for (const sx of [-1, 1]) { plain.add(new THREE.BoxGeometry(70 * S, 46 * S, 4 * S), L(sx * laneX, laneY, z0 + 3), '#0b0e12'); glow.add(new THREE.BoxGeometry(76 * S, 50 * S, 1 * S), L(sx * laneX, laneY, z0 + 2), windowC); }
    lanes.push({ x: laneX, y: laneY, xi: R * .42, yi: R * .12, zi0: z0 + 520 * S, zi1: z0 + 760 * S, za: z0 - 30 * S, zb: z1 + 900 * S });
    // Approach lights in two lines along the floor from the gate in to the port.
    for (let z = portZ1 + 40 * S; z < z1 - 15 * S; z += 26 * S) for (const sx of [-1, 1]) glow.add(new THREE.BoxGeometry(4 * S, 1 * S, 4 * S), L(sx * 46 * S, floorY + .5 * S, z), (Math.round((z - portZ1) / (26 * S)) % 4) ? '#9fe3ff' : '#ffffff');
    // Ships parked on the apron near the gate, on their own lit pads.
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {
      const z = portZ1 + (90 + i * 85) * S; if (z > z1 - 60 * S) break;
      const x = sx * (120 + r() * 60) * S, sc = (.8 + r() * .5) * S;
      glow.add(new THREE.RingGeometry(26 * sc, 28 * sc, 32).rotateX(-Math.PI / 2), L(x, floorY + .3, z), mix(windowC, '#ffffff', .3));
      if (r() < .25) continue;
      plain.add(new THREE.BoxGeometry(9 * sc, 7 * sc, 34 * sc), L(x, floorY + 6 * sc, z, 0, sx * .4), hull);
      plain.add(new THREE.BoxGeometry(34 * sc, 1.5 * sc, 12 * sc), L(x, floorY + 5 * sc, z, 0, sx * .4), trim);
      glow.add(new THREE.BoxGeometry(5 * sc, 4 * sc, 1 * sc), L(x - Math.sin(sx * .4) * 17 * sc, floorY + 6 * sc, z - Math.cos(sx * .4) * 17 * sc, 0, sx * .4), glowC);
      solids.push({ type: 'sphere', c: V(x, floorY + 6 * sc, z), r: 18 * sc });
    }
    const core = spinner(V(0, 0, z0 + 260 * S), 'z', .05);
    core.glow.add(new THREE.SphereGeometry(110 * S, 32, 16), L(), '#bfe9ff');
    for (let k = 0; k < 3; k++) core.plain.add(new THREE.TorusGeometry(170 * S + k * 34 * S, 7 * S, 6, 64), L(0, 0, 0, k * .9, k * .5, 0), steel);
    solids.push({ type: 'sphere', c: V(0, 0, z0 + 260 * S), r: 200 * S });
    deckAt = V(0, floorY + .01, deckZ);
    deckSize = Math.min(150, deckSize);
    const h = { type: 'drum', z0, z1, R, wall, gate };
    solids.push(h); hallInfo = h;
    [lit, glow, plain] = outer;
    for (let i = 0; i <= 8; i++) for (const y of [1, -1]) glow.add(new THREE.IcosahedronGeometry(5 * S, 0), L(0, y * (R + wall + 14 * S), z0 + i / 8 * len), i % 2 ? windowC : '#ff6a5a');
    return { R, len, z0, z1, wall, zc, out: R + wall };
  }
  // Engines on a closed end: a tapered stern block and a ring of glowing bells.
  function stern(H, n = 6) {
    const back = 160 * S, sr = H.out * .82;
    plain.add(along(new THREE.CylinderGeometry(H.out, sr, back, 48), H.z0 - back / 2), L(), steelD);
    solids.push({ type: 'capsule', a: V(0, 0, H.z0 - back * .6), b: V(0, 0, H.z0), r: sr });
    const bell = (x, y, br, bl) => {
      plain.add(along(new THREE.CylinderGeometry(br * .45, br, bl, 24, 1, true), H.z0 - back - bl / 2), L(x, y), dark);
      glow.add(new THREE.CircleGeometry(br * .9, 24).rotateY(Math.PI), L(x, y, H.z0 - back - bl * .7), mix(glowC, '#ffffff', .35));
    };
    bell(0, 0, sr * .38, 140 * S);
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + Math.PI / n; bell(Math.cos(a) * sr * .66, Math.sin(a) * sr * .66, sr * .2, 90 * S); }
  }

  if (form === 'drum') {
    // The citadel: the hall itself is the ship, crowned with a skyline of stepped towers along
    // its back, long lit sponsons down its flanks and a block of engines at its stern.
    const H = hall(430 * S, 2300 * S, -1150 * S, { use: 'yard' });
    stern(H, 8);
    for (const sx of [-1, 1]) { // sponsons
      const x = sx * (H.out + 30 * S), sl = H.len * .62, sz = H.z0 + sl / 2 + 80 * S;
      lit.add(new THREE.BoxGeometry(70 * S, 90 * S, sl), L(x, 0, sz), steelD);
      for (let k = 0; k < 4; k++) glow.add(new THREE.BoxGeometry(71 * S, 2.5 * S, sl * .96), L(x, -30 * S + k * 20 * S, sz), windowC);
      solids.push({ type: 'box', c: V(x, 0, sz), h: V(35 * S, 45 * S, sl / 2) });
    }
    // The skyline: stepped blocks rising toward a command tower near the stern.
    let z = H.z0 + 60 * S;
    while (z < H.z0 + H.len * .7) {
      const t = 1 - (z - H.z0) / (H.len * .7), w = (60 + r() * 80) * S, d = (80 + r() * 120) * S, h = (30 + t * 120 + r() * 40) * S, x = (r() - .5) * 120 * S;
      lit.add(new THREE.BoxGeometry(w, h, d), L(x, H.out + h / 2 - 10 * S, z + d / 2), r() < .5 ? steel : steelD);
      glow.add(new THREE.BoxGeometry(w * 1.01, 2 * S, d * 1.01), L(x, H.out + h * .75, z + d / 2), windowC);
      solids.push({ type: 'box', c: V(x, H.out + h / 2 - 10 * S, z + d / 2), h: V(w / 2, h / 2, d / 2) });
      z += d + (10 + r() * 40) * S;
    }
    const th = 260 * S;
    lit.add(new THREE.BoxGeometry(110 * S, th, 160 * S), L(0, H.out + th / 2, H.z0 + 220 * S), steel);
    lit.add(new THREE.BoxGeometry(200 * S, 30 * S, 120 * S), L(0, H.out + th, H.z0 + 220 * S), steelD);
    glow.add(new THREE.BoxGeometry(201 * S, 4 * S, 121 * S), L(0, H.out + th - 4 * S, H.z0 + 220 * S), windowC);
    glow.add(new THREE.IcosahedronGeometry(8 * S, 0), L(0, H.out + th + 60 * S, H.z0 + 220 * S), '#ff6a5a');
    lit.add(new THREE.CylinderGeometry(3 * S, 3 * S, 60 * S, 6), L(0, H.out + th + 30 * S, H.z0 + 220 * S), dark);
    solids.push({ type: 'box', c: V(0, H.out + th / 2, H.z0 + 220 * S), h: V(100 * S, th / 2 + 15 * S, 80 * S) });
  } else if (form === 'cylinders') {
    // A hall drum between two long habitat drums turning the other way to each other, held by trusses.
    const H = hall(400 * S, 1800 * S, -900 * S, { use: 'cargo' }), dr = 200 * S, dl = 1500 * S, gap = H.out + dr + 220 * S;
    stern(H, 5);
    for (const sx of [-1, 1]) {
      const d = spinner(V(sx * gap, 0, H.zc - 40 * S), 'z', .02 * sx);
      d.lit.add(along(new THREE.CylinderGeometry(dr, dr, dl, 40), 0), L(), hull);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; d.glow.add(new THREE.BoxGeometry(dr * .32, 2, dl * .92), L(Math.cos(a) * (dr + .5), Math.sin(a) * (dr + .5), 0, 0, 0, a + Math.PI / 2), k % 2 ? windowC : mix(windowC, '#9fe8ff', .4)); }
      for (const z of [-1, 1]) d.lit.add(new THREE.SphereGeometry(dr, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(z * Math.PI / 2), L(0, 0, z * dl / 2), trim);
      solids.push({ type: 'capsule', a: V(sx * gap, 0, H.zc - 40 * S - dl / 2), b: V(sx * gap, 0, H.zc - 40 * S + dl / 2), r: dr });
      for (let k = 0; k < 4; k++) { // trusses
        const z = H.z0 + (.15 + k * .23) * H.len, w = gap - H.out - dr + 20 * S, x = sx * (H.out + w / 2 - 10 * S);
        plain.add(new THREE.BoxGeometry(w, 30 * S, 50 * S), L(x, 0, z), dark);
        glow.add(new THREE.BoxGeometry(w, 2 * S, 51 * S), L(x, 15 * S, z), windowC);
        solids.push({ type: 'box', c: V(x, 0, z), h: V(w / 2, 15 * S, 25 * S) });
      }
    }
  } else if (form === 'torus') {
    // The hall is the axle; two great wheels turn round it, counter to each other, on spokes.
    const H = hall(390 * S, 2000 * S, -1000 * S, { use: 'farm' }), Rw = 900 * S, tube = 80 * S;
    stern(H, 6);
    for (const [f, rate] of [[.3, .012], [.72, -.012]]) {
      const z = H.z0 + f * H.len, w = spinner(V(0, 0, z), 'z', rate);
      w.lit.add(new THREE.TorusGeometry(Rw, tube, 18, 140), L(), hull);
      w.glow.add(new THREE.TorusGeometry(Rw, tube * 1.005, 4, 160).scale(1, 1, .12), L(), windowC);
      w.glow.add(new THREE.TorusGeometry(Rw - tube * .98, 3 * S, 3, 160), L(), windowC);
      const sl = Rw - H.out - tube * .5, sm = H.out + sl / 2;
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; w.plain.add(new THREE.CylinderGeometry(16 * S, 22 * S, sl, 10), L(Math.cos(a) * sm, Math.sin(a) * sm, 0, 0, 0, a - Math.PI / 2), dark); }
      plain.add(new THREE.TorusGeometry(H.out + 20 * S, 26 * S, 8, 72), L(0, 0, z), trim); // the bearing
      solids.push({ type: 'torusZ', R: Rw, r: tube, z });
    }
  } else if (form === 'spindle') {
    // The hall threaded with turning discs, a long needle behind it and a crown at its gate.
    const H = hall(400 * S, 1900 * S, -900 * S, { use: 'foundry' }), len = 1500 * S;
    plain.add(along(new THREE.CylinderGeometry(H.out * .5, 30 * S, len, 24), H.z0 - len / 2), L(), dark);
    solids.push({ type: 'capsule', a: V(0, 0, H.z0 - len * .7), b: V(0, 0, H.z0), r: H.out * .45 });
    const w = spinner(V(), 'z', .015), n = 7;
    for (let k = 0; k < n; k++) {
      const z = H.z0 + (.08 + k / n * .8) * H.len, rad = (900 - 380 * k / n + 80 * Math.sin(k * 1.7)) * S, hh = 26 * S;
      w.lit.add(along(new THREE.CylinderGeometry(rad, rad * .92, hh, 64, 1, true), z), L(), k % 2 ? hull : trim);
      w.lit.add(new THREE.RingGeometry(H.out, rad, 64, 1), L(0, 0, z + hh / 2), k % 2 ? hull : trim);
      w.lit.add(new THREE.RingGeometry(H.out, rad * .92, 64, 1).rotateY(Math.PI), L(0, 0, z - hh / 2), steelD);
      w.glow.add(along(new THREE.CylinderGeometry(rad + .5, rad + .5, 3 * S, 64, 1, true), z), L(), windowC);
      solids.push({ type: 'annulus', z, r0: H.out, r1: rad, h: hh / 2 });
    }
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; lit.add(along(new THREE.CylinderGeometry(6 * S, 12 * S, 260 * S, 6), H.z1 + 100 * S), L(Math.cos(a) * (H.out - 10 * S), Math.sin(a) * (H.out - 10 * S)), steelD); glow.add(new THREE.IcosahedronGeometry(6 * S, 0), L(Math.cos(a) * (H.out - 10 * S), Math.sin(a) * (H.out - 10 * S), H.z1 + 232 * S), '#ff6a5a'); }
  } else if (form === 'sphere') {
    // A great ball with the hall bored through it, its gate standing out of one face like a pupil,
    // farm rings turning round it either side.
    const H = hall(380 * S, 1800 * S, -1000 * S, { use: 'park' }), Rs = 950 * S, c = V(0, 0, H.z0 + 850 * S);
    lit.add(new THREE.SphereGeometry(Rs, 64, 40).rotateX(Math.PI / 2), L(c.x, c.y, c.z), hull);
    glow.add(new THREE.CylinderGeometry(Rs * 1.002, Rs * 1.002, 24 * S, 72, 1, true).rotateX(Math.PI / 2), L(c.x, c.y, c.z), windowC);
    const w = spinner(c, 'z', .012);
    for (const f of [-1, 1]) {
      const z = f * Rs * .5, rr = Math.sqrt(Rs * Rs - z * z) + 30 * S;
      w.lit.add(new THREE.TorusGeometry(rr, 40 * S, 12, 110), L(0, 0, z), trim);
      w.glow.add(new THREE.TorusGeometry(rr, 41 * S, 3, 110).scale(1, 1, .15), L(0, 0, z), mix(windowC, '#9fffb0', .5));
      solids.push({ type: 'torusZ', R: rr, r: 40 * S, z: c.z + z });
    }
    stern({ ...H, z0: c.z - Rs + 40 * S, out: 300 * S }, 5);
    solids.push({ type: 'shell', c, r: Rs, hall: hallInfo });
  } else { // bloom
    // The hall grown as a trunk, pods hanging round it on branching stalks, a bulb at its root.
    const H = hall(380 * S, 1900 * S, -950 * S, { skin: mix(hull, trim, .3), ribs: 6, use: 'grown' });
    lit.add(new THREE.SphereGeometry(H.out * 1.3, 32, 20).scale(1, 1, .8), L(0, 0, H.z0 - H.out * 1.05), trim);
    solids.push({ type: 'sphere', c: V(0, 0, H.z0 - H.out * 1.05), r: H.out * 1.15 });
    const pods = 9 + Math.floor(r() * 5);
    for (let k = 0; k < pods; k++) {
      const a = k / pods * Math.PI * 2 + r(), d = H.out + (220 + r() * 300) * S, pr = (90 + r() * 110) * S, z = H.z0 + (.1 + r() * .65) * H.len;
      const c = V(Math.cos(a) * d, Math.sin(a) * d, z), root = V(Math.cos(a) * H.out * .9, Math.sin(a) * H.out * .9, z - (100 + r() * 200) * S);
      const dir = c.clone().sub(root), sl = dir.length() - pr * .8;
      plain.add(new THREE.CylinderGeometry(12 * S, 22 * S, sl, 8).translate(0, sl / 2, 0), new THREE.Matrix4().compose(root, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize()), V(1, 1, 1)), dark);
      lit.add(new THREE.SphereGeometry(pr, 20, 14).scale(1, 1, 1.3), L(c.x, c.y, c.z), mix(hull, trim, r() * .5));
      glow.add(new THREE.TorusGeometry(pr * 1.01, 2.5 * S, 3, 40), L(c.x, c.y, c.z), mix(windowC, '#c0ffb0', .4));
      solids.push({ type: 'sphere', c, r: pr * 1.2 });
    }
  }
  // Beacons at the extremes, so its outline shows from far off.
  const box = new THREE.Box3();
  const meshes = [];
  // No fog: an ark hangs in the sky of a world with air like a moon, rather than fading into its haze.
  const mat = () => addHullFeel(THREE, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .55, metalness: .25, fog: false }), { plate: 28, windows: 1.7, window: 4.5 * S, colour: windowC });
  const parts = [[lit, group, false], [glow, group, true], [plain, group, 'plain'], [inLit, inside, false], [inGlow, inside, true], [inPlain, inside, 'plain'], [glass, inside, 'glass']];
  for (const w of spinners) { group.add(w.group); parts.push([w.lit, w.group, false], [w.glow, w.group, true], [w.plain, w.group, 'plain']); }
  // A citadel's hall: its walls seen from inside, plated and full of lit galleries; and the faint
  // field across its gate.
  for (const h of interior) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(h.R, h.R, h.len, 96, 1, true).rotateX(Math.PI / 2).translate(0, 0, h.z),
      addHullFeel(THREE, new THREE.MeshStandardMaterial({ color: mix(hull, '#5f666e', .6), emissive: new THREE.Color(mix(hull, '#2a3038', .7)), emissiveIntensity: .6, side: THREE.BackSide, roughness: .6, metalness: .3, fog: false }), { plate: 22, windows: 2, window: 3.2 * S, colour: windowC }));
    m.frustumCulled = false; inside.add(m); meshes.push(m);
    // The far wall of the hall, behind the core: plated and windowed like the rest.
    const end = new THREE.Mesh(new THREE.CircleGeometry(h.R, 96).translate(0, 0, h.z - h.len / 2 + 2), (() => { const e = m.material.clone(); e.side = THREE.FrontSide; return e; })()); end.frustumCulled = false; inside.add(end);
  }
  for (const f of fields) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(f.r, 64).translate(0, 0, f.z), new THREE.MeshBasicMaterial({ color: mix(glowC, '#9fe3ff', .5), transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.frustumCulled = false; group.add(m);
  }
  // Inside a drum: land lit by its own sun line (self-lit colours), and soft clouds.
  for (const w of spinners) {
    if (w.inner.count()) { const m = new THREE.Mesh(w.inner.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); m.frustumCulled = false; w.group.add(m); }
    if (w.cloud.count()) { const m = new THREE.Mesh(w.cloud.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .55, depthWrite: false, fog: false })); m.frustumCulled = false; w.group.add(m); }
  }
  for (const [m, parent, glowing] of parts) {
    if (!m.count()) continue;
    const mesh = new THREE.Mesh(m.geometry(), glowing === 'plain' ? plainMat() : glowing === 'glass' ? new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .25, roughness: .1, metalness: .2, depthWrite: false, side: THREE.DoubleSide, fog: false }) : glowing ? new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }) : mat());
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
  if (deckAt) deck.group.position.copy(deckAt); else deck.group.position.y = deckY + .01;
  group.add(deck.group);
  const size = box.getSize(V()).length() / 2;

  // --- The port round the deck ------------------------------------------------------
  // The deck sits on the hall floor between two terminal buildings: three storeys of offices
  // and halls with lit windows and doors, balconies along their fronts facing the deck, stairs
  // at their ends winding up level by level, and on top a roof walk joined across by a bridge.
  // All in the deck's own frame (metres, y up), so game.js walks you about them the way it
  // walks you on the deck: walk.support() gives the height you stand at, walk.blocked() what
  // you cannot pass.
  let walk = null;
  if (deckAt) {
    const E = deck.radius, LV = 6, NL = 3, TOP = LV * NL;
    const A = E + 14, B = E + 20, C = E + 70, ZB0 = -E - 40, ZB1 = E + 10; // balcony edge, facade, back; building ends
    const SZ0 = ZB1, SZM = ZB1 + 6, SZ1 = ZB1 + 12, XA = E + 8, XO = B + 14, XOE = XO + 5; // the stairs
    const flats = [], ramps = []; // flats: { x0, x1, z0, z1, y }; ramps: { xa, xb, z0, z1, ya, yb } (height runs from xa to xb)
    const flat = (sx, X0, X1, z0, z1, y) => flats.push({ x0: Math.min(sx * X0, sx * X1), x1: Math.max(sx * X0, sx * X1), z0, z1, y });
    const ramp = (sx, Xa, Xb, z0, z1, ya, yb) => ramps.push({ xa: sx * Xa, xb: sx * Xb, z0, z1, ya, yb });
    for (const sx of [-1, 1]) {
      for (let k = 1; k < NL; k++) flat(sx, A, B, ZB0, ZB1, k * LV); // balconies
      flat(sx, A, C, ZB0, ZB1, TOP); // the roof walk
      for (let k = 1; k <= NL; k++) flat(sx, XA, B, SZ0, SZ1, k * LV); // landings by the building
      for (let k = 0; k < NL; k++) {
        flat(sx, XO, XOE, SZ0, SZ1, k * LV + LV / 2); // half landings
        ramp(sx, B, XO, SZ0, SZM, k * LV, k * LV + LV / 2);
        ramp(sx, XO, B, SZM, SZ1, k * LV + LV / 2, (k + 1) * LV);
      }
    }
    flats.push({ x0: -A, x1: A, z0: ZB0, z1: ZB0 + 10, y: TOP }); // the bridge
    const heightsAt = (x, z) => {
      const out = [];
      for (const f of flats) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) out.push(f.y);
      for (const q of ramps) { const lo = Math.min(q.xa, q.xb), hi = Math.max(q.xa, q.xb); if (x >= lo && x <= hi && z >= q.z0 && z <= q.z1) out.push(q.ya + (x - q.xa) / (q.xb - q.xa) * (q.yb - q.ya)); }
      return out;
    };
    // Drawing it: the buildings with windows (a facade material at a person's scale), and the
    // floors, steps and railings plain.
    const fac = merged(THREE), pl = merged(THREE), gl = merged(THREE);
    const metal = mix(hull, '#8a9198', .6), rail = mix(trim, '#cfd6dc', .5), stone = mix(hull, '#5c636b', .5);
    const slab = (x0, x1, z0, z1, y, c = metal) => pl.add(new THREE.BoxGeometry(x1 - x0, .5, z1 - z0).translate((x0 + x1) / 2, y - .25, (z0 + z1) / 2), null, c);
    const railX = (x, z0, z1, y0, y1) => { const l = Math.hypot(z1 - z0, y1 - y0); pl.add(new THREE.BoxGeometry(.12, .12, l).rotateX(-Math.atan2(y1 - y0, z1 - z0)).translate(x, (y0 + y1) / 2 + 1.05, (z0 + z1) / 2), null, rail); };
    const railZ = (z, x0, x1, y0, y1) => { const l = Math.hypot(x1 - x0, y1 - y0); pl.add(new THREE.BoxGeometry(l, .12, .12).rotateZ(Math.atan2(y1 - y0, x1 - x0)).translate((x0 + x1) / 2, (y0 + y1) / 2 + 1.05, z), null, rail); };
    for (const sx of [-1, 1]) {
      const cx = sx * (B + C) / 2, w = C - B, d = ZB1 - ZB0, cz = (ZB0 + ZB1) / 2;
      fac.add(new THREE.BoxGeometry(w, TOP - .6, d).translate(cx, (TOP - .6) / 2, cz), null, stone);
      // Doors at every level along the front, lit from inside, and a name band along the top.
      for (let k = 0; k < NL; k++) for (let z = ZB0 + 14; z < ZB1 - 8; z += 22) gl.add(new THREE.BoxGeometry(.1, 2.6, 3.2).translate(sx * (B - .06), k * LV + 1.3, z), null, mix(windowC, '#ffffff', .45));
      gl.add(new THREE.BoxGeometry(.1, 1.2, d * .7).translate(sx * (B - .06), TOP - 1.6, cz), null, glowC);
      // Lights on the roof's corners and a mast.
      for (const z of [ZB0 + 2, ZB1 - 2]) for (const X of [A + 1, C - 1]) gl.add(new THREE.IcosahedronGeometry(.35, 0).translate(sx * X, TOP + .4, z), null, '#ff6a5a');
      pl.add(new THREE.CylinderGeometry(.25, .35, 22, 6).translate(sx * (C - 12), TOP + 11, ZB0 + 20), null, metal);
      // Balcony railings, the roof's parapet.
      for (let k = 1; k < NL; k++) railX(sx * A, ZB0, ZB1, k * LV, k * LV);
      railX(sx * A, ZB0 + 10, ZB1, TOP, TOP); railX(sx * C, ZB0, ZB1, TOP, TOP); railZ(ZB0, sx * A, sx * C, TOP, TOP);
      // The stair tower's back wall, so the stairs read as built against something.
      fac.add(new THREE.BoxGeometry(XOE - XA + 2, TOP + 3, .6).translate(sx * (XA + XOE) / 2, (TOP + 3) / 2, SZ1 + .3), null, stone);
    }
    for (const f of flats) { slab(f.x0, f.x1, f.z0, f.z1, f.y); gl.add(new THREE.BoxGeometry((f.x1 - f.x0) * .98, .08, (f.z1 - f.z0) * .98).translate((f.x0 + f.x1) / 2, f.y - .55, (f.z0 + f.z1) / 2), null, mix(windowC, '#ffffff', .3)); }
    for (const q of ramps) { // steps, 20 cm risers, with a slab beneath
      const run = q.xb - q.xa, rise = q.yb - q.ya, n = Math.round(Math.abs(rise) / .2), zc = (q.z0 + q.z1) / 2, dz = q.z1 - q.z0;
      for (let i = 0; i < n; i++) pl.add(new THREE.BoxGeometry(Math.abs(run) / n + .02, .2, dz - .2).translate(q.xa + run * (i + .5) / n, q.ya + rise * (i + 1) / n - .1, zc), null, metal);
      const len = Math.hypot(run, rise);
      pl.add(new THREE.BoxGeometry(len, .3, dz - .2).rotateZ(Math.atan2(rise, run)).translate(q.xa + run / 2, q.ya + rise / 2 - .4, zc), null, mix(metal, '#000000', .25));
      railZ(q.z0 + .1, q.xa, q.xb, q.ya, q.yb); railZ(q.z1 - .1, q.xa, q.xb, q.ya, q.yb);
    }
    railZ(ZB0 + .1, -A, A, TOP, TOP); railZ(ZB0 + 9.9, -A, A, TOP, TOP);
    const at = (x, y, z) => V(x, y, z).add(deckAt);
    for (const sx of [-1, 1]) {
      solids.push({ type: 'box', c: at(sx * (A + C) / 2, TOP / 2, (ZB0 + ZB1) / 2), h: V((C - A) / 2, TOP / 2 + .5, (ZB1 - ZB0) / 2) }); // a terminal, its balconies and roof
      solids.push({ type: 'box', c: at(sx * (XA + XOE) / 2, (TOP + 3) / 2, (SZ0 + SZ1) / 2 + .5), h: V((XOE - XA) / 2, (TOP + 3) / 2, (SZ1 - SZ0) / 2 + 1) }); // its stairs
      solids.push({ type: 'box', c: at(sx * (C - 12), TOP + 11, ZB0 + 20), h: V(1, 11, 1) });
    }
    solids.push({ type: 'box', c: at(0, TOP - .5, ZB0 + 5), h: V(A, 1.5, 5) }); // the bridge
    const walkGroup = new THREE.Group();
    walkGroup.add(new THREE.Mesh(fac.geometry(), addHullFeel(THREE, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, metalness: .2, fog: false }), { plate: 4, windows: 1.9, window: 1.7, colour: mix(windowC, '#000000', .2) })));
    walkGroup.add(new THREE.Mesh(pl.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .35, fog: false })));
    walkGroup.add(new THREE.Mesh(gl.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
    walkGroup.traverse((o) => (o.frustumCulled = false));
    walkGroup.position.copy(deckAt); inside.add(walkGroup);
    const area = { x: C + 10, z0: ZB0 - 30, z1: Math.max(E + 60, SZ1 + 20) };
    walk = {
      // The highest surface you can step up onto (from height y), else the floor.
      support(x, z, y) { let best = 0; for (const h of heightsAt(x, z)) if (h <= y + .9 && h > best) best = h; return best; },
      // Out of the port, into a building, off an edge with a drop, or into something at head height: no.
      blocked(x, z, fromY, toY) {
        if (Math.abs(x) > area.x || z < area.z0 || z > area.z1) return true;
        if (Math.abs(x) > B - .3 && Math.abs(x) < C + .3 && z > ZB0 - .3 && z < ZB1 + .3 && fromY < TOP - .5) return true;
        if (Math.abs(x) > XA - .3 && Math.abs(x) < XOE + .3 && z > SZ1 && z < SZ1 + .9) return true; // the stair wall
        for (const h of heightsAt(x, z)) if (h > fromY + .9 && h < fromY + 2.3) return true;
        return fromY - toY > 1.2;
      },
      // On the deck itself (its own shapes and obstacles count), rather than the hall floor.
      onDeck: (x, z, y, rad = .5) => y < 1 && deck.walkable(x, z, rad),
    };
  }

  // Traffic in the hall: shuttles in two lanes, one flying in, one flying out.
  if (lanes.length) {
    const c = merged(THREE), e = merged(THREE);
    c.add(new THREE.BoxGeometry(5, 3.5, 18), null, hull); c.add(new THREE.BoxGeometry(16, .8, 6), L(0, 0, -3), trim); c.add(new THREE.BoxGeometry(2.5, 1.2, 3), L(0, 1.8, 4), '#20262c');
    e.add(new THREE.BoxGeometry(4, 2.5, .4), L(0, 0, -9.2), glowC); e.add(new THREE.BoxGeometry(.6, .6, .6), L(0, 0, 9.2), '#ffffff');
    const N = 9, body = new THREE.InstancedMesh(c.geometry(), plainMat(), N * 2 * lanes.length), lights = new THREE.InstancedMesh(e.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), N * 2 * lanes.length);
    body.frustumCulled = lights.frustumCulled = false; inside.add(body, lights);
    const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), turn = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI), sc = V(), at = V();
    animate.push((t) => {
      let i = 0;
      for (const ln of lanes) for (const dir of [1, -1]) for (let k = 0; k < N; k++) {
        const u = ((t * 55 * dir / (ln.zb - ln.za) + k / N) % 1 + 1) % 1, z = ln.za + u * (ln.zb - ln.za);
        const s = Math.min(1, (z - ln.za) / (60 * S), (ln.zb - z) / (300 * S)) * S * 1.4;
        const w = Math.min(1, Math.max(0, (z - ln.zi0) / (ln.zi1 - ln.zi0))), e = w * w * (3 - 2 * w);
        at.set(dir * (ln.x + (ln.xi - ln.x) * e) + Math.sin(k * 2.3 + t * .3) * 3 * S, ln.y + (ln.yi - ln.y) * e + Math.cos(k * 1.7) * 8 * S, z);
        m.compose(at, dir > 0 ? qq.identity() : turn, sc.setScalar(Math.max(s, 1e-3)));
        body.setMatrixAt(i, m); lights.setMatrixAt(i, m); i++;
      }
      body.instanceMatrix.needsUpdate = lights.instanceMatrix.needsUpdate = true;
    });
  }

  // Keep a sphere of radius rad (a ship, in the ark's frame) out of the hull.
  const tmp = V(), tmp2 = V();
  function collide(p, rad) {
    let hit = false;
    for (const s of solids) {
      if (s.type === 'sphere') { tmp.copy(p).sub(s.c); const d = tmp.length(), min = s.r + rad; if (d < min) { p.copy(s.c).addScaledVector(tmp.normalize(), min); hit = true; } }
      else if (s.type === 'capsule') { tmp2.copy(s.b).sub(s.a); const t = Math.max(0, Math.min(1, tmp.copy(p).sub(s.a).dot(tmp2) / tmp2.lengthSq())); const c = s.a.clone().addScaledVector(tmp2, t); tmp.copy(p).sub(c); const d = tmp.length(), min = s.r + rad; if (d < min) { p.copy(c).addScaledVector(d > 1e-6 ? tmp.normalize() : V(1, 0, 0), min); hit = true; } }
      else if (s.type === 'torus') { const y = p.y - (s.y || 0), h = Math.hypot(p.x, p.z) || 1e-6, c = V(p.x / h * s.R, s.y || 0, p.z / h * s.R); tmp.copy(p).sub(c); const d = tmp.length(), min = s.r + rad; if (d < min) { p.copy(c).addScaledVector(d > 1e-6 ? tmp.normalize() : V(0, Math.sign(y) || 1, 0), min); hit = true; } }
      else if (s.type === 'disc') { const h = Math.hypot(p.x, p.z), dy = p.y - s.y; if (!s.spokes && h < s.R + rad && Math.abs(dy) < s.h + rad) { const up = s.h + rad - Math.abs(dy), out = s.R + rad - h; if (up < out) p.y = s.y + Math.sign(dy || 1) * (s.h + rad); else { p.x *= (s.R + rad) / Math.max(h, 1e-6); p.z *= (s.R + rad) / Math.max(h, 1e-6); } hit = true; } }
      else if (s.type === 'drum') {
        // A hollow drum: kept off its hull from outside and in, out of its closed end, round the gate's rim.
        const h = Math.hypot(p.x, p.y), z = p.z, inR = s.R - rad, outR = s.R + s.wall + rad;
        if (z > s.z0 - rad && z < s.z1 + rad) {
          if (z > s.z0 && z < s.z1 && h > inR && h < outR) { const k = (h < s.R + s.wall / 2 ? inR : outR) / Math.max(h, 1e-6); p.x *= k; p.y *= k; hit = true; }
          else if (h < s.R + s.wall && z < s.z0 + s.wall + rad && z > s.z0 - rad) { p.z = h < s.R ? s.z0 + s.wall + rad : s.z0 - rad; hit = true; }
          else if (h > s.gate - rad && h < s.R + s.wall && Math.abs(z - s.z1) < rad + 2) { p.z = z < s.z1 ? s.z1 - rad - 2 : s.z1 + rad + 2; hit = true; }
        }
      }
      else if (s.type === 'torusZ') { const cy = s.cy || 0, h = Math.hypot(p.x, p.y - cy) || 1e-6, c = V(p.x / h * s.R, cy + (p.y - cy) / h * s.R, s.z); tmp.copy(p).sub(c); const d = tmp.length(), min = s.r + rad; if (d < min) { p.copy(c).addScaledVector(d > 1e-6 ? tmp.normalize() : V(0, 0, 1), min); hit = true; } }
      else if (s.type === 'annulus') { const h = Math.hypot(p.x, p.y), dz = p.z - s.z; if (h > s.r0 - rad && h < s.r1 + rad && Math.abs(dz) < s.h + rad) { const up = s.h + rad - Math.abs(dz), out = s.r1 + rad - h; if (up < out) p.z = s.z + Math.sign(dz || 1) * (s.h + rad); else { const k = (s.r1 + rad) / Math.max(h, 1e-6); p.x *= k; p.y *= k; } hit = true; } }
      else if (s.type === 'shell') { // a solid ball with the hall bored through it
        const H = s.hall, inHall = Math.hypot(p.x, p.y) < H.R && p.z > H.z0 && p.z < H.z1 + 60;
        tmp.copy(p).sub(s.c); const d = tmp.length(), min = s.r + rad;
        if (!inHall && d < min) { p.copy(s.c).addScaledVector(tmp.normalize(), min); hit = true; } }
      else if (s.type === 'box') { tmp.copy(p).sub(s.c); const ox = s.h.x + rad - Math.abs(tmp.x), oy = s.h.y + rad - Math.abs(tmp.y), oz = s.h.z + rad - Math.abs(tmp.z); if (ox > 0 && oy > 0 && oz > 0) { if (oy <= ox && oy <= oz) p.y += Math.sign(tmp.y || 1) * oy; else if (ox <= oz) p.x += Math.sign(tmp.x || 1) * ox; else p.z += Math.sign(tmp.z || 1) * oz; hit = true; } }
    }
    return hit;
  }
  return {
    group, deck, form, civ, name: civ.arkName, size, walk,
    update(t) { for (const w of spinners) w.group.rotation[w.axis] = t * w.rate; if (inside.visible) for (const f of animate) f(t); },
    // Draw the inside only from near the ark (camWorld: the camera, in world space).
    lod(camWorld) {
      if (!hallInfo) return;
      group.updateWorldMatrix(true, false);
      const l = group.worldToLocal(tmp.copy(camWorld)), on = l.distanceTo(tmp2.set(0, 0, (hallInfo.z0 + hallInfo.z1) / 2)) < (hallInfo.z1 - hallInfo.z0) * 1.5 + 2500;
      if (on !== inside.visible) { inside.visible = on; deck.group.visible = on; }
    },
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
