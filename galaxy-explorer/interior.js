// Inside a home: built only when you step through a door (structures-mesh.js records the
// dwellings and their doors), and thrown away when you leave, so towns cost nothing extra
// until you go in. The room is the size of the house it is in, and houses are built to
// the size of their builders (structures.mjs unit), so a giant's hall is vast and a small
// species' burrow too low for you to enter at all (canEnter).
//
// What is inside follows how they live, not how we do: hands-builders keep a hearth, a
// work table, shelves and a sleeping mat; nest-builders perches at different heights and
// a woven nest-bowl; burrowers low earthen alcoves and a moss bed; hive-builders walls of
// glowing wax cells and storage vats; web-builders silk hammocks and threads strung across
// the room; grazers troughs of fodder and soft mounds to lie on; rollers ramps and smooth
// resting bowls; tentacled builders pools and hanging racks; tripods tall lean-boards (no
// one sits). The more advanced, the more their homes glow: lit panels, then a floating
// light. Ruins are empty, broken and grown over.
//
// One or two of the household are at home, busy at something; how they take you coming
// in is their people's stance toward you (station-deck.js stanceOf): welcoming ones come
// over and greet you, curious ones come close to look, wary ones back away to the far
// wall, guarded ones stand tall and watch. You can talk to them (contact-ui.js) as on a
// station deck: talkWith(i) / gesture(i), as station-deck.js has them.
//
//   canEnter(dwelling, civ) -> { ok, why }
//   const room = buildInterior(THREE, { dwelling, civ, palette, stance, ruins, seed })
//   room: { group, radius, height, start: { x, z, yaw }, door: { x, z }, species,
//           resolve(x0, z0, x1, z1, rad), update(dt, t, player{ x, z } | null), crew(),
//           talkWith(i), gesture(i, kind), dispose() }
// Local frame: floor at y = 0, the door on the +z wall; the group takes dwelling.base.
import { rng } from './rng.mjs';
import { buildCrew } from './fauna-mesh.js';
import { createExpression, express, lookAngles, startGesture, gestureOf, moodOf } from './express.mjs';
import { createLook, surfaceOf, shadeWall, clutter } from './interior-look.js';

const EYE = 1.75;
const SQUARE = ['timber', 'terraced', 'stilts', 'tracks'];
const roomOf = (d) => ({ R: d.foot * .95, H: Math.min(d.h * .82, d.foot * 2.4) });

// Can you go in? (Too low, too narrow, or not on the ground.)
export function canEnter(d, civ) {
  if (!d) return { ok: false, why: '' };
  if (civ?.underwater) return { ok: false, why: 'under the sea' };
  const { R, H } = roomOf(d);
  if (H < 2.2 || R < 1.5) return { ok: false, why: 'small' };
  return { ok: true, why: '' };
}

export function buildInterior(THREE, { dwelling: d, civ, palette: C = {}, stance = 'welcome', ruins = false, seed = 'room', light = null }) {
  const r = rng(seed, 'interior'), { R, H } = roomOf(d), u = Math.max(.55, civ.unit || 1);
  const family = civ.family, level = civ.level || 1, culture = civ.culture, square = SQUARE.includes(culture) || !!d.blocks;
  const kind = d.kind || 'house'; // planned towns (town-plan.mjs): house, row, shop, hall, workshop, tower
  const group = new THREE.Group();
  group.matrixAutoUpdate = false; group.matrix.copy(d.base); group.matrixWorldNeedsUpdate = true;
  const col = (hex, k = 0) => new THREE.Color(hex || '#888').lerp(new THREE.Color(ruins ? '#4f6a3a' : '#000'), ruins ? .35 : k);
  const mats = new Map();
  const look = createLook(THREE, { seed, colours: C });
  const WOOD = level >= 5 ? (C.metal2 || C.trim || '#cfd5d8') : C.wood; // those who reach space furnish in metal and composite
  const mat = (hex, { glow = 0, k = 0, side = THREE.FrontSide, map = null, shaded = false, smooth = false, rough = .85, metal = 0 } = {}) => {
    const key = `${hex}|${glow}|${k}|${side}|${map?.id ?? ''}|${shaded}|${smooth}|${rough}|${metal}`;
    if (!mats.has(key)) {
      const c = col(hex, k);
      const m = new THREE.MeshStandardMaterial({ color: map ? new THREE.Color(1, 1, 1).lerp(c, ruins ? .4 : 0).multiplyScalar(1 - k) : c, map, roughness: rough, metalness: metal, emissive: glow ? c.clone().multiplyScalar(glow) : new THREE.Color(0), side, flatShading: !smooth, vertexColors: shaded });
      m.userData.surfaceDetail = true; // its own surfaces, not the ground's grain (planet-lod.js)
      mats.set(key, m);
    }
    return mats.get(key);
  };
  const solids = []; // circles you walk round: { x, z, r, h }
  const add = (geo, hex, x, y, z, opts = {}, solid = null) => {
    const m = new THREE.Mesh(geo, mat(hex, opts)); m.position.set(x, y, z); if (opts.ry) m.rotation.y = opts.ry; if (opts.rx) m.rotation.x = opts.rx; if (opts.rz) m.rotation.z = opts.rz;
    group.add(m); if (solid) solids.push({ x, z, r: solid.r, h: solid.h ?? 9 }); return m;
  };
  const wallHex = C.wall || '#8a7a66', kinds = surfaceOf(civ);
  const floorHex = kinds.floor === 'earth' ? (C.path || C.wall2) : kinds.floor === 'tiles' ? (C.plaza || C.stone) : kinds.floor === 'planks' ? (WOOD || '#6b4a2f') : (C.stone || C.wall2);

  // --- The shell: floor, wall, ceiling, the doorway's daylight, windows -------------------
  // Surfaces are painted (interior-look.js) by what the house is built of; walls darken
  // toward floor and ceiling, as rooms do.
  const segs = square ? 4 : 24, perim = square ? R * 1.414 * 4 : R * Math.PI * 2;
  const wallTex = look.surface(kinds.wall, wallHex, [Math.max(1, Math.round(perim / (2.2 * Math.max(1, u * .8)))), Math.max(1, H / (2.2 * Math.max(1, u * .8)))]);
  const wall = shadeWall(THREE, new THREE.CylinderGeometry(R, R, H, segs, 4, true), H);
  if (square) wall.rotateY(Math.PI / 4);
  add(wall, wallHex, 0, H / 2, 0, { side: THREE.BackSide, map: wallTex, shaded: true, smooth: !square });
  const floorTex = look.surface(kinds.floor, floorHex, [R / 1.6, R / 1.6]);
  add(new THREE.CircleGeometry(R * (square ? 1.42 : 1.01), segs).rotateX(-Math.PI / 2).rotateY(square ? Math.PI / 4 : 0), floorHex, 0, .01, 0, { map: floorTex, k: .1 });
  const roofShape = family === 'hive' || family === 'burrowers' || ['domes', 'shells', 'conch', 'mounds', 'coral', 'living'].includes(culture) ? 'dome' : 'flat';
  const ceilHex = C.wall2 || wallHex;
  if (roofShape === 'dome') add(new THREE.SphereGeometry(R, segs, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, Math.max(.4, (H * .45) / R), 1), ceilHex, 0, H * .99, 0, { side: THREE.BackSide, map: wallTex, k: .25, smooth: true });
  else {
    add(new THREE.CircleGeometry(R * (square ? 1.42 : 1.02), segs).rotateX(Math.PI / 2).rotateY(square ? Math.PI / 4 : 0), ceilHex, 0, H, 0, { map: look.surface(kinds.wall === 'planks' || square ? 'planks' : kinds.wall, ceilHex, [R / 2, R / 2]), k: .35 });
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(R * 2, .2 * u, .22 * u), WOOD || '#5a4030', 0, H - .12 * u, (i - 1.5) * R * .5, { k: .15 }); // beams
  }
  // A skirting band and a cornice (a lip where the wall meets the floor and the ceiling).
  for (const [y, h] of [[.08 * u, .16 * u], [H - .06 * u, .12 * u]]) add(new THREE.CylinderGeometry(R - .02, R - .02, h, segs, 1, true).rotateY(square ? Math.PI / 4 : 0), C.trim || wallHex, 0, y, 0, { side: THREE.BackSide, k: .3 });
  // The doorway: daylight (or the dark) where you came in, in a frame.
  const doorW = Math.min(1.1 * Math.max(1, u * .7), R * .6), doorH = Math.min(H * .85, 2.2 * Math.max(1, u * .6));
  const dz = square ? R * .707 : R;
  add(new THREE.PlaneGeometry(doorW, doorH), '#e9efe6', 0, doorH / 2, dz - .03, { glow: .75, ry: Math.PI });
  for (const x of [-1, 1]) add(new THREE.BoxGeometry(.16 * u, doorH, .25), WOOD || C.trim, x * (doorW / 2 + .08 * u), doorH / 2, dz - .1, { k: .1 });
  add(new THREE.BoxGeometry(doorW + .45 * u, .2 * u, .28), WOOD || C.trim, 0, doorH + .1 * u, dz - .1, { k: .1 });
  const glowSprite = (x, y, z, size0, hexc, o0 = .55) => {
    const size = Math.min(size0, 2.4), o = o0 * .35; // a hint of glow, never a fog over the room
    if (!look.glowTex) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: look.glowTex, color: new THREE.Color(hexc), transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set(x, y, z); sp.scale.set(size, size, 1); group.add(sp); sprites.push(sp);
  };
  const sprites = [];
  glowSprite(0, doorH * .5, dz - .3, doorW * 1.6, '#fff0cc', .2);
  // Windows: framed panes of daylight, with a soft shaft of it falling into the room.
  if (level >= 2 && !ruins) for (const a of [1.25, -1.25, Math.PI]) {
    const wr = (square ? R * .707 : R) - .04, wx = Math.sin(a) * wr, wz = Math.cos(a) * wr, ww = .8 * Math.max(1, u * .8), wh = .65 * Math.max(1, u * .8), wy = Math.min(H * .55, 1.7 * Math.max(1, u * .7));
    add(new THREE.PlaneGeometry(ww, wh), C.window || '#ffd98a', wx, wy, wz, { glow: 1.3, ry: a + Math.PI });
    add(new THREE.BoxGeometry(ww + .2, .1, .2), WOOD || C.trim, wx * .99, wy - wh / 2 - .04, wz * .99, { ry: a });
    add(new THREE.BoxGeometry(ww + .2, .08, .16), WOOD || C.trim, wx * .99, wy + wh / 2 + .04, wz * .99, { ry: a });
    glowSprite(wx * .93, wy, wz * .93, ww * 2.4, C.window || '#ffd98a', .3);
  }
  // In the middle (or hung from the ceiling): their lamp.
  const lampHex = level >= 3 ? (C.window || '#ffe6b0') : (C.flame || '#ffc46b'), lampY = Math.min(H - .5 * u, Math.max(2.4, H * .72));
  if (!ruins) {
    add(new THREE.CylinderGeometry(.015, .015, H - lampY), C.line || '#333', 0, (H + lampY) / 2, 0);
    if (level >= 3) add(new THREE.TorusGeometry(.35 * u, .05 * u, 6, 20).rotateX(Math.PI / 2), lampHex, 0, lampY, 0, { glow: 1.8 });
    else { add(new THREE.SphereGeometry(.16 * u, 10, 8), lampHex, 0, lampY, 0, { glow: 2, smooth: true }); add(new THREE.CylinderGeometry(.2 * u, .26 * u, .1 * u, 8, 1, true), C.metal || '#555', 0, lampY + .14 * u, 0, { side: THREE.DoubleSide }); }
    glowSprite(0, lampY, 0, 2.6 * u, lampHex, .5);
  }
  // A rug in the household's colours and pattern, and hangings on the walls.
  if (!['hive', 'rollers'].includes(family)) {
    const rugTex = look.rug();
    add(new THREE.CircleGeometry(Math.min(R * .45, 1.6 * u), 32).rotateX(-Math.PI / 2), rugTex ? '#ffffff' : (C.accent || '#a55'), 0, .025, 0, { map: rugTex, k: ruins ? .5 : .1, smooth: true });
  }
  if (!['hive', 'burrowers'].includes(family) && !ruins) for (const a of [2.1, -2.1]) {
    const wr = (square ? R * .707 : R) - .06, bw = Math.min(R * .45, .9 * Math.max(1, u * .7)), bh = Math.min(H * .5, 1.5 * Math.max(1, u * .7)), tex = look.banner();
    add(new THREE.PlaneGeometry(bw, bh, 1, 4), tex ? '#ffffff' : (C.accent || '#a55'), Math.sin(a) * wr, Math.min(H * .6, 2 * Math.max(1, u * .7)), Math.cos(a) * wr, { map: tex, ry: a + Math.PI, side: THREE.DoubleSide, k: .05 });
  }
  // Clutter on a shelf or table (interior-look.js): pots, bowls, tablets, a plant, a crystal.
  const things = (x, y, z, a = 0) => {
    if (ruins && r() < .6) return;
    for (const [geo, hexc, dx, dy, dz2, ry = 0, glows = false] of clutter(THREE, r, u, C, level)) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const m = add(geo, hexc || '#a8643f', x + dx * ca, y + dy, z - dx * sa, { glow: glows ? 1.4 : 0, smooth: true, rough: .6 });
      m.rotation.y = a + ry;
    }
  };
  // --- Furnishings, by how they live -------------------------------------------------------
  const at = (a, f) => [Math.sin(a) * R * f, Math.cos(a) * R * f]; // a = 0 is the door
  const back = Math.PI;
  const hearth = (x, z) => {
    add(new THREE.CylinderGeometry(.55 * u, .65 * u, .25 * u, 10), C.stone || '#777', x, .12 * u, z, {}, { r: .7 * u, h: .3 });
    if (!ruins) { add(new THREE.ConeGeometry(.28 * u, .55 * u, 6), C.flame || '#ffc46b', x, .5 * u, z, { glow: 2.4 }); add(new THREE.SphereGeometry(.22 * u, 6, 4), C.ember || '#ff7a2a', x, .3 * u, z, { glow: 2 }); }
  };
  const spots = []; // where the household works or rests: { x, z, face, kind }
  const spot = (x, z, kind, faceTo = [0, 0]) => spots.push({ x, z, kind, face: Math.atan2(faceTo[1] - z, faceTo[0] - x), taken: -1 });
  // Not every building is a home: what a planned town's shops, halls, workshops and
  // towers hold (town-plan.mjs lot kinds), each laid out a little differently.
  const W = square ? R * .707 : R; // half the wall's width
  const box = (w, h, dp, hex, x, y, z, ry = 0, solid = false, opts = {}) => add(new THREE.BoxGeometry(w, h, dp), hex, x, y, z, { ry, ...opts }, solid ? { r: Math.max(w, dp) * .55, h } : null);
  const goods = () => [C.accent, C.pot, C.bag, C.window, C.roof, C.wax].filter(Boolean);
  const shelfRun = (x0, x1, z, face, rows = 3) => { // shelves along a wall, stocked
    const len = Math.abs(x1 - x0), g = goods();
    for (let row = 0; row < rows; row++) {
      const y = (.45 + row * .6) * u; box(len, .05 * u, .4 * u, WOOD || '#6b4a2f', (x0 + x1) / 2, y, z, 0);
      for (let x = Math.min(x0, x1) + .2 * u; x < Math.max(x0, x1) - .15 * u; x += (.22 + r() * .25) * u) if (r() < .8) { const h = (.12 + r() * .25) * u; box(.16 * u, h, .22 * u, g[(r() * g.length) | 0] || '#a8643f', x, y + h / 2 + .03 * u, z, 0, false, { glow: level >= 4 && r() < .15 ? 1 : 0 }); }
    }
    for (const x of [x0, x1]) box(.06 * u, rows * .6 * u, .4 * u, WOOD || '#6b4a2f', x, rows * .3 * u, z);
  };
  const benchRow = (x, z, len, ry) => { box(len, .08 * u, .9 * u, WOOD || '#6b4a2f', x, .78 * u, z, ry, true); box(len, .06 * u, .3 * u, WOOD || '#6b4a2f', x + Math.cos(ry) * 0 + Math.sin(ry) * .7 * u, .45 * u, z + Math.cos(ry) * .7 * u, ry); box(len, .06 * u, .3 * u, WOOD || '#6b4a2f', x - Math.sin(ry) * .7 * u, .45 * u, z - Math.cos(ry) * .7 * u, ry); };
  const furnishKind = () => {
    const flip = r() < .5 ? -1 : 1;
    if (kind === 'shop') {
      // A counter across the room, the keeper behind it, stocked shelves on the back and side walls.
      const cz = -W * .25, cw = W * (1.1 + r() * .4);
      box(cw, .95 * u, .55 * u, WOOD || '#6b4a2f', 0, .48 * u, cz, 0, true); box(cw + .1 * u, .06 * u, .65 * u, C.trim || WOOD, 0, .98 * u, cz);
      things(-cw * .3, 1.0 * u, cz, 0); things(cw * .25, 1.0 * u, cz, 0);
      shelfRun(-W * .85, W * .85, -W + .25 * u, 0, 3 + (H > 4 * u ? 1 : 0));
      for (const sx of [-1, 1]) { const a = sx * Math.PI / 2; for (let i = 0; i < 2; i++) { const [x, z] = [sx * (W - .25 * u), W * (.1 + i * .4)]; box(.4 * u, 1.8 * u, W * .35, WOOD || '#6b4a2f', x, .9 * u, z, 0, true); for (let k = 0; k < 3; k++) things(x, (.6 + k * .55) * u, z, a); } }
      const tx = flip * W * .45; box(1 * u, .7 * u, 1 * u, WOOD || '#6b4a2f', tx, .35 * u, W * .25, .3, true); things(tx, .72 * u, W * .25, .3);
      for (let i = 0; i < 4; i++) box((.4 + r() * .3) * u, (.3 + r() * .3) * u, (.4 + r() * .3) * u, C.bag || '#d8c07a', -flip * W * (.5 + r() * .3), .25 * u, W * (.3 + r() * .4), r() * 3);
      spot(0, cz - .8 * u, 'work', [0, W]); spot(flip * W * .3, W * .1, 'tend', [tx, W * .25]);
    } else if (kind === 'workshop') {
      // Benches with work on them, a rack of tools, crates, and a forge (or, later, a machine).
      for (let i = 0; i < 2; i++) { const z = -W * (.55 - i * .7); box(W * 1.1, .1 * u, .9 * u, WOOD || '#6b4a2f', -W * .2, .85 * u, z, 0, true); for (const lx of [-.5, .5]) box(.1 * u, .85 * u, .8 * u, WOOD || '#6b4a2f', -W * .2 + lx * W, .42 * u, z); things(-W * .4, .9 * u, z, 0); things(W * .1, .9 * u, z, 0); spot(-W * .2, z + .9 * u, 'work', [-W * .2, z]); }
      for (let i = 0; i < 7; i++) box(.06 * u, (.5 + r() * .5) * u, .06 * u, C.metal || '#666', -W * .7 + i * W * .2, 1.7 * u, -W + .1 * u, (r() - .5) * .3);
      box(W * 1.5, .08 * u, .1 * u, WOOD || '#6b4a2f', 0, 2.1 * u, -W + .1 * u);
      const fx = W * .62, fz = -W * .5;
      if (level <= 4) { box(1.3 * u, .9 * u, 1.3 * u, C.stone || '#777', fx, .45 * u, fz, 0, true); add(new THREE.ConeGeometry(.35 * u, .5 * u, 6), C.flame || '#ffc46b', fx, 1.1 * u, fz, { glow: 2.4 }); box(.6 * u, H - 1 * u, .6 * u, C.stone || '#777', fx, (H + 1 * u) / 2, fz); spot(fx - 1.1 * u, fz + .6 * u, 'tend', [fx, fz]); }
      else { box(1.6 * u, 1.6 * u, 1.2 * u, C.metal2 || '#9aa', fx, .8 * u, fz, 0, true); box(1 * u, .5 * u, .05 * u, C.window || '#9fe3e6', fx, 1.1 * u, fz + .62 * u, 0, false, { glow: 1.5 }); spot(fx, fz + 1.3 * u, 'work', [fx, fz]); }
      for (let i = 0; i < 6; i++) { const s0 = (.5 + r() * .4) * u; box(s0, s0, s0, WOOD || '#6b4a2f', W * (.3 + r() * .5), s0 / 2 + (i > 3 ? s0 : 0), W * (.2 + r() * .55), r() * 1.5, i < 4); }
    } else if (kind === 'hall') {
      // Long tables with benches, a raised dais at the far end, banners, a great lamp.
      const n = W > 5 * u ? 2 : 1;
      for (let i = 0; i < n; i++) { const x = n === 1 ? 0 : (i - .5) * W; benchRow(x, W * .05, W * 1.2, Math.PI / 2); for (let k = 0; k < 3; k++) things(x, .84 * u, W * (-.4 + k * .4), Math.PI / 2); }
      box(W * 1.4, .35 * u, W * .4, C.stone || C.trim || '#888', 0, .17 * u, -W * .78, 0, true);
      box(1.2 * u, 1.6 * u, .6 * u, WOOD || '#6b4a2f', 0, .35 * u + .8 * u, -W * .82, 0, true);
      for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) add(new THREE.CylinderGeometry(.25 * u, .3 * u, H, 10), C.trim || C.stone || '#999', sx * W * .82, H / 2, W * (-.3 + i * .6), {}, { r: .35 * u, h: H });
      spot(0, -W * .6, 'work', [0, W]); spot(W * .3, W * .3, 'rest', [0, 0]);
    } else { // 'tower': a modern flat high up — a lit window wall, a low sofa, a table, plants
      box(W * 1.7, Math.min(H * .7, 2.4 * u), .05 * u, C.window || '#9fe3e6', 0, Math.min(H * .7, 2.4 * u) / 2 + .4 * u, -W + .06 * u, 0, false, { glow: 1.1 });
      for (let i = -3; i <= 3; i++) box(.06 * u, Math.min(H * .7, 2.4 * u), .1 * u, C.metal || '#555', i * W * .27, Math.min(H * .7, 2.4 * u) / 2 + .4 * u, -W + .08 * u);
      const sx = flip * W * .35; box(2.2 * u, .4 * u, .9 * u, C.accent || '#5a6a8a', sx, .2 * u, -W * .3, 0, true); box(2.2 * u, .5 * u, .2 * u, C.accent || '#5a6a8a', sx, .55 * u, -W * .3 - .45 * u);
      box(1.1 * u, .4 * u, .6 * u, C.metal2 || WOOD, sx, .2 * u, W * .05, 0, true); things(sx, .42 * u, W * .05, 0);
      for (const px of [-W * .8, W * .8]) { add(new THREE.CylinderGeometry(.25 * u, .2 * u, .45 * u, 10), C.pot || '#a8643f', px, .22 * u, -W * .75); add(new THREE.IcosahedronGeometry(.45 * u, 0), C.leaf || '#4f8a4a', px, .85 * u, -W * .75); }
      const [mx, mz] = [-flip * W * .55, W * .35]; box(1.8 * u, .45 * u, 1.3 * u, C.bag || '#d8c07a', mx, .22 * u, mz, 0, true);
      shelfRun(-flip * W * .9, -flip * W * .2, -W + .3 * u, 0, 2);
      spot(sx, -W * .3, 'rest', [0, -W]); spot(flip * W * .1, W * .4, 'work', [sx, W * .05]);
    }
  };
  switch (family) {
    case 'hands': if (d.kind && d.kind !== 'house' && d.kind !== 'row') { furnishKind(); break; } // falls through for homes
    case 'tentacles': case 'tripods': default: {
      if (level <= 3) { const [hx, hz] = at(back, .45); hearth(hx, hz); spot(hx + .9 * u, hz + .5 * u, 'tend', [hx, hz]); }
      // A work table with things on it; shelves of pots along the wall.
      const [tx, tz] = at(1.9, .45);
      if (family !== 'tripods') {
        add(new THREE.BoxGeometry(1.4 * u, .1 * u, .8 * u), WOOD || '#6b4a2f', tx, .82 * u, tz, { ry: 1.9 }, { r: .8 * u, h: .9 * u });
        for (const lx of [-.6, .6]) for (const lz of [-.3, .3]) add(new THREE.BoxGeometry(.08 * u, .8 * u, .08 * u), WOOD || '#6b4a2f', tx + lx * u * Math.cos(1.9) + lz * u * Math.sin(1.9), .4 * u, tz - lx * u * Math.sin(1.9) + lz * u * Math.cos(1.9), {});
        things(tx, .87 * u, tz, 1.9);
      } else for (let i = 0; i < 3; i++) { const [x, z] = at(1.6 + i * .4, .78); add(new THREE.BoxGeometry(.25 * u, 2.4 * u, 1 * u), WOOD || '#6b4a2f', x, 1.2 * u, z, { ry: 1.6 + i * .4, rz: .12 }, { r: .5 * u }); } // lean-boards: no one sits
      spot(tx - Math.sin(1.9) * u * .9, tz - Math.cos(1.9) * u * .9, 'work', [tx, tz]);
      for (let i = 0; i < 4; i++) { const a = -1.5 - i * .38, [x, z] = at(a, .93); for (const lvl of [0, 1]) { const y = (1 + lvl * .55) * u; add(new THREE.BoxGeometry(1 * u, .05 * u, .32 * u), WOOD || '#6b4a2f', x, y, z, { ry: a }); things(x, y + .03 * u, z, a); } }
      if (family === 'tentacles') { const [px, pz] = at(-2.3, .45); add(new THREE.CylinderGeometry(.9 * u, .9 * u, .12, 14), '#3d8fb0', px, .07, pz, { glow: .5 }, { r: .9 * u, h: .1 }); spot(px + u, pz, 'tend', [px, pz]); }
      else { const [mx, mz] = at(-2.2, .55); add(new THREE.BoxGeometry(1.8 * u, .14 * u, 1 * u), C.bag || '#d8c07a', mx, .07 * u, mz, { ry: -2.2 }); spot(mx, mz, 'rest', [0, 0]); }
      break;
    }
    case 'nests': {
      for (let i = 0; i < 5; i++) { const a = i * 1.25 + .6, [x, z] = at(a, .6 + (i % 2) * .2); add(new THREE.CylinderGeometry(.06 * u, .06 * u, R * .7), WOOD || '#6b4a2f', x, (1 + i * .45) * u, z, { rz: Math.PI / 2, ry: a }); }
      for (let i = 0; i < 3; i++) { const [x, z] = at(i * 2.1 + .6, .6); add(new THREE.CylinderGeometry(.07 * u, .07 * u, (1 + i * .9) * u, 5), WOOD || '#6b4a2f', x, (1 + i * .9) * u / 2, z, {}); }
      const [nx, nz] = at(back, .45);
      add(new THREE.TorusGeometry(.8 * u, .28 * u, 6, 14), C.roof || '#8a7a4a', nx, .3 * u, nz, { rx: Math.PI / 2 }, { r: 1.1 * u, h: .5 });
      spot(nx, nz, 'rest', [0, 0]); spot(...at(1.4, .5), 'work', [0, 0]);
      break;
    }
    case 'burrowers': {
      for (let i = 0; i < 4; i++) { const a = back + (i - 1.5) * .9, [x, z] = at(a, .98); add(new THREE.SphereGeometry(.9 * u, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.soil || '#5a4632', x, 0, z, { side: THREE.BackSide, glow: .08 }); }
      const [bx, bz] = at(-1.9, .5); add(new THREE.SphereGeometry(.9 * u, 8, 5).scale(1, .3, 1), C.turf || '#55703a', bx, .1, bz, {}, { r: .9 * u, h: .3 });
      for (let i = 0; i < 6; i++) { const [x, z] = at(1.3 + i * .25, .9); add(new THREE.SphereGeometry(.18 * u, 6, 4), C.pot || '#a8643f', x, .2 * u, z); }
      spot(bx, bz, 'rest', [0, 0]); spot(...at(1.6, .55), 'work', at(1.6, .95));
      break;
    }
    case 'hive': {
      for (let row = 0; row < 4; row++) for (let i = 0; i < 12; i++) { const a = back + (i - 5.5) * .2 + (row % 2) * .1, [x, z] = at(a, .96); add(new THREE.CylinderGeometry(.22 * u, .22 * u, .1, 6), C.wax || C.accent || '#d9a441', x, (.5 + row * .4) * u, z, { rx: Math.PI / 2, ry: a, glow: level >= 3 && (i + row) % 3 === 0 ? 1.2 : .25 }); }
      for (let i = 0; i < 3; i++) { const [x, z] = at(1.5 + i * .5, .6); add(new THREE.CylinderGeometry(.4 * u, .5 * u, .9 * u, 8), C.wax || '#d9a441', x, .45 * u, z, {}, { r: .55 * u }); }
      spot(...at(back, .65), 'work', at(back, .95)); spot(...at(2, .35), 'tend', at(2, .6));
      break;
    }
    case 'web': {
      for (let i = 0; i < 9; i++) { const a = i * .7, b = a + 2.4 + r() * .6, [x0, z0] = at(a, 1), [x1, z1] = at(b, 1), len = Math.hypot(x1 - x0, z1 - z0);
        add(new THREE.CylinderGeometry(.015, .015, len, 3), C.silk || '#f2f0ea', (x0 + x1) / 2, H * (.45 + r() * .4), (z0 + z1) / 2, { rz: Math.PI / 2, ry: -Math.atan2(z1 - z0, x1 - x0), glow: .4 }); }
      const [hx, hz] = at(back, .45); add(new THREE.SphereGeometry(.9 * u, 10, 6).scale(1.3, .35, .8), C.silk || '#f2f0ea', hx, 1.2 * u, hz, { glow: .3 });
      add(new THREE.SphereGeometry(.35 * u, 8, 6).scale(1, 1.6, 1), C.silk || '#f2f0ea', ...at(-1.6, .7).flatMap((v, i) => (i ? [1.6 * u, v] : [v])), { glow: .3 });
      spot(hx, hz + .9 * u, 'rest', [hx, hz]); spot(...at(1.7, .5), 'work', at(1.7, .9));
      break;
    }
    case 'grazers': {
      const [tx, tz] = at(1.6, .75); add(new THREE.BoxGeometry(2 * u, .45 * u, .6 * u), WOOD || '#6b4a2f', tx, .23 * u, tz, { ry: 1.6 }, { r: .9 * u, h: .5 });
      add(new THREE.BoxGeometry(1.8 * u, .1 * u, .45 * u), C.turf || '#55703a', tx, .48 * u, tz, { ry: 1.6 });
      for (const a of [back, -1.8]) { const [x, z] = at(a, .55); add(new THREE.SphereGeometry(1 * u, 10, 6).scale(1.2, .25, 1), C.bag || '#d8c07a', x, .08, z, {}); spot(x, z, 'rest', [0, 0]); }
      spot(tx - .9 * u, tz, 'graze', [tx, tz]);
      break;
    }
    case 'rollers': {
      for (const a of [back, -1.9, 1.9]) { const [x, z] = at(a, .55); add(new THREE.TorusGeometry(.8 * u, .18 * u, 6, 16), C.stone || '#888', x, .12, z, { rx: Math.PI / 2 }); spot(x, z, 'rest', [0, 0]); }
      const [rx, rz] = at(2.4, .85); add(new THREE.BoxGeometry(1.4 * u, .1, 2 * u), WOOD || '#6b4a2f', rx, .35 * u, rz, { ry: 2.4, rx: .3 });
      break;
    }
  }
  // Advanced homes glow: lit panels, then a floating light.
  if (!ruins && level >= 3) { const [x, z] = at(-1.4, .97); add(new THREE.PlaneGeometry(1.2 * u, .8 * u), C.window || '#9fe3e6', x, 1.5 * u, z, { glow: 1.6, ry: -1.4 + Math.PI }); }
  if (!ruins && level >= 4) add(new THREE.IcosahedronGeometry(.25 * u, 1), C.window || '#ffd98a', 0, H * .72, 0, { glow: 2.5 });
  if (ruins) for (let i = 0; i < 14; i++) { const [x, z] = at(r() * 6.28, .4 + r() * .6); add(new THREE.SphereGeometry((.2 + r() * .4) * u, 6, 4).scale(1, .4, 1), i % 3 ? '#4f7a3a' : C.stone || '#777', x, .05, z); }
  if (!spots.length) spot(...at(back, .5), 'rest', [0, 0]);

  // --- The household ----------------------------------------------------------------------
  const species = ruins ? null : civ.species;
  const crew = [];
  let mesh = null;
  if (species) {
    const n = Math.min(spots.length, 1 + (r() < .55 ? 1 : 0) + (R > 5 ? 1 : 0));
    mesh = buildCrew(THREE, species, n, seed);
    group.add(mesh.group);
    const rad = Math.max(.35, species.size * .55);
    // The household is at the far end, away from the door you come in by.
    spots.sort((a, b) => Math.hypot(b.x, b.z - R) - Math.hypot(a.x, a.z - R));
    for (let i = 0; i < n; i++) {
      const s = spots[i];
      s.taken = i;
      crew.push({ i, x: s.x, z: s.z, heading: s.face, speed: 0, cycle: r() * 6, phase: r() * 6, rad, size: species.size, spot: s, ex: createExpression(r), sink: 0, greeted: false, talk: false, timer: 8 + r() * 20 });
    }
  }
  const floats = (species?.altitude?.[1] ?? 0) > 0, walk = Math.min(1.2, Math.max(.5, (species?.speed?.walk ?? 1) * .6));
  const free = (x, z, rad) => Math.hypot(x, z) < (square ? R * .7 : R) - rad - .1 && solids.every((o) => Math.hypot(x - o.x, z - o.z) > o.r + rad * .8);
  function resolve(x0, z0, x1, z1, rad = .35) {
    const ok = (x, z) => free(x, z, rad) && crew.every((c) => Math.hypot(x - c.x, z - c.z) > c.rad + rad || Math.hypot(x0 - c.x, z0 - c.z) < Math.hypot(x - c.x, z - c.z));
    if (ok(x1, z1)) return [x1, z1]; if (ok(x1, z0)) return [x1, z0]; if (ok(x0, z1)) return [x0, z1]; return [x0, z0];
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), rt = new THREE.Vector3(), fw = new THREE.Vector3();
  const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const mood = moodOf(stance);
  function update(dt, t, player) {
    if (light) light.position.set(0, H * .78, 0).applyMatrix4(d.base);
    if (!mesh) return;
    for (const c of crew) {
      const pd = player ? Math.hypot(player.x - c.x, player.z - c.z) : Infinity;
      let target = null, face = c.spot?.face ?? c.heading, pose = c.spot?.kind === 'rest' ? 'rest' : 'work';
      if (c.talk && player) { target = null; face = Math.atan2(player.z - c.z, player.x - c.x); pose = 'stand'; }
      else if (player) {
        // How they take you coming in.
        const toward = (dist0) => { const dist = Math.max(dist0, c.rad + 1.1 + c.size * .4); const dx = c.x - player.x, dz = c.z - player.z, l = Math.max(.01, Math.hypot(dx, dz)); target = [player.x + dx / l * dist, player.z + dz / l * dist]; face = Math.atan2(player.z - c.z, player.x - c.x); pose = 'stand'; };
        if (stance === 'welcome') { toward(1.4 + c.rad + c.i * .8); if (pd < 2.5 + c.rad + c.i && !c.greeted) { c.greeted = true; startGesture(c.ex, gestureOf(species)); } }
        else if (stance === 'curious' && c.i === 0) toward(1.6 + c.rad);
        else if (stance === 'wary') { const a = Math.atan2(-player.z, -player.x); target = [Math.cos(a) * R * .55, Math.sin(a) * R * .55]; face = Math.atan2(player.z - c.z, player.x - c.x); pose = 'stand'; }
        else if (stance === 'guarded') { face = Math.atan2(player.z - c.z, player.x - c.x); pose = 'stand'; }
        else if (pd < 5) { face = Math.atan2(player.z - c.z, player.x - c.x); pose = 'stand'; }
      } else if ((c.timer -= dt) < 0) { // now and then, something else to do
        c.timer = 10 + r() * 25;
        const s = spots.find((x) => x.taken === -1);
        if (s) { c.spot.taken = -1; s.taken = c.i; c.spot = s; }
      }
      if (!target && !c.talk && c.spot && Math.hypot(c.spot.x - c.x, c.spot.z - c.z) > .4 && !player) target = [c.spot.x, c.spot.z];
      // Never on top of you: step back if you come too close.
      if (player && pd < c.rad + .7 && !target) { const a = Math.atan2(c.z - player.z, c.x - player.x); target = [c.x + Math.cos(a), c.z + Math.sin(a)]; }
      // Keep the target inside the room, clear of the walls.
      if (target) { const tl = Math.hypot(...target), lim = (square ? R * .68 : R * .92) - c.rad; if (tl > lim) target = [target[0] / tl * lim, target[1] / tl * lim]; }
      c.moving = false;
      if (target && Math.hypot(target[0] - c.x, target[1] - c.z) > .3) {
        // Walk there; but stepping back from you, they keep facing you (a step back, not turning away).
        const h = Math.atan2(target[1] - c.z, target[0] - c.x), facing = player && pose === 'stand' ? Math.atan2(player.z - c.z, player.x - c.x) : null;
        const backing = facing !== null && Math.cos(h - facing) < 0;
        c.heading += angleTo(c.heading, backing ? facing : h) * Math.min(1, dt * 5);
        c.speed += ((backing ? walk * .5 : walk) - c.speed) * Math.min(1, dt * 3);
        const nx = c.x + Math.cos(h) * c.speed * dt, nz = c.z + Math.sin(h) * c.speed * dt;
        if (free(nx, nz, c.rad) && (!player || Math.hypot(nx - player.x, nz - player.z) > c.rad + .45)) { c.x = nx; c.z = nz; c.moving = true; } else { c.speed *= .4; c.heading += angleTo(c.heading, face) * Math.min(1, dt * 2.5); }
      } else { c.speed += (0 - c.speed) * Math.min(1, dt * 4); c.heading += angleTo(c.heading, face) * Math.min(1, dt * 2.5); }
      let amp;
      if (c.speed > .05 && c.moving) { c.cycle += c.speed * dt / mesh.stride * Math.PI; amp = floats ? 1 : Math.min(1, c.speed / walk); }
      else if (pose === 'work') { c.cycle += dt * 3.2; amp = -1; }
      else { amp = floats ? 1 : 0; if (floats) c.cycle += dt * 1.2; }
      c.sink += ((pose === 'rest' && c.speed < .05 ? c.size * .2 : 0) - c.sink) * Math.min(1, dt * 2);
      const headY = mesh.extent.top * .8, ch = Math.cos(c.heading), sh = Math.sin(c.heading);
      rt.set(sh, 0, -ch); fw.set(ch, 0, sh);
      const look = player && (pd < 7 || c.talk) ? lookAngles(player.x - c.x, EYE - headY, player.z - c.z, rt, Y, fw) : null;
      const ep = express(c.ex, dt, { look, mood: player && pd < 6 ? mood : null, t, phase: c.phase, sp: species, still: c.speed < .15 });
      if (ep.arms !== null && species.arms) { amp = ep.arms; c.cycle += dt * 2; }
      q.setFromAxisAngle(Y, Math.PI / 2 - c.heading);
      if (ep.pitch || ep.roll || ep.yaw) q.multiply(q2.setFromEuler(e.set(ep.pitch, ep.yaw, ep.roll, 'YXZ')));
      p.set(c.x, (floats ? .6 + Math.sin(t * .8 + c.phase) * .15 : -c.sink) + ep.lift, c.z);
      mesh.set(c.i, m4.compose(p, q, sc.set(1, ep.scale, 1)), c.cycle, amp, ep.headYaw, ep.headPitch, ep.glow);
    }
    mesh.commit();
  }
  return {
    group, radius: R, height: H, species, stance, square,
    door: { x: 0, z: dz }, start: { x: 0, z: dz - .8, yaw: -Math.PI / 2 },
    resolve, update,
    crew: () => crew.map((c) => ({ i: c.i, x: c.x, z: c.z, r: c.rad, top: mesh.extent.top })),
    talkWith(i) { for (const c of crew) c.talk = c.i === i; },
    gesture(i, kind) { const c = crew[i]; if (c) startGesture(c.ex, kind || gestureOf(species)); },
    dispose() {
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of mats.values()) m.dispose();
      for (const sp of sprites) sp.material.dispose();
      look.dispose();
      if (mesh) mesh.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      group.removeFromParent();
    },
  };
}
