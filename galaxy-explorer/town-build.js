// Hand-builders' buildings and street furniture, drawn from a town plan's lots and props
// (town-plan.mjs). Every building is made the same way wherever it stands; far away only
// its mass is drawn (walls, roof, the windows painted on), near you the street level too:
// doors and steps, shopfronts with awnings and signs, balconies, cornices, porches,
// chimneys, rooftop clutter. Upper-floor windows are painted on the walls by the town's
// material (aWin, structures-mesh.js), lit at random at night, so a street of four-storey
// rows costs a few hundred vertices a house. The look follows the culture and the tier:
// timber frames and pitched roofs, or plastered walls and flat roof terraces; brick and
// stone rows with shopfronts for cities; concrete, glass and steel from the planet-shapers
// up, with towers on their podiums.
//
//   buildLot(kit, lot, detail, add)   detail: 'near' | 'far'
//   buildProp(kit, prop, add)
//   kit: { THREE, C, U, level, culture, r }  add(geometry, localMatrix, colour, bright?)
//   Local frame: origin on the ground at the lot's centre, +z toward its street, y up.
import { floorH } from './town-plan.mjs';

const mix = (THREE, a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

export function makeKit(THREE, { C, u, level, culture, rng }) {
  const U = Math.max(.75, u), V = (x, y, z) => new THREE.Vector3(x, y, z), q = new THREE.Quaternion(), e = new THREE.Euler();
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(1, 1, 1));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s, 1).translate(0, h / 2, 0);
  const modern = level >= 5, cityTier = level >= 3, timber = ['timber', 'stilts', 'tents'].includes(culture) && level <= 4;
  // A wall's palette: the house picks one of a few related tones, as a street does.
  const walls = modern ? [mix(THREE, C.concrete || '#8b8f91', C.wall, .25), mix(THREE, C.wall, '#e9e6df', .45), mix(THREE, C.metal2 || '#d7dde1', C.wall, .2), mix(THREE, C.wall2, '#5c6670', .3)]
    : cityTier && !timber ? [C.wall, mix(THREE, C.wall, '#b5653f', .35), mix(THREE, C.wall, '#e6dccb', .4), C.wall2, mix(THREE, C.wall, C.accent, .15)]
    : [C.wall, mix(THREE, C.wall, C.wood, .35), mix(THREE, C.wall, '#ece3cf', .3), C.wall2];
  // A facade: a wall face with its windows painted on (aWin: metres along, metres up, bay width, floor height).
  function facade(w, h, y0, bay, fh, seed, ground = 0) {
    const g = new THREE.PlaneGeometry(w, h), P = g.attributes.position, a = [];
    for (let i = 0; i < P.count; i++) a.push(P.getX(i) + w / 2 + (seed % 997) * 7.3, P.getY(i) + h / 2 + y0 - ground, bay, fh);
    g.setAttribute('aWin', new THREE.Float32BufferAttribute(a, 4));
    return g.translate(0, h / 2, 0);
  }
  return { THREE, C, U, level, culture, modern, cityTier, timber, walls, L, box, cyl, facade, rng, mix: (a, b, t) => mix(THREE, a, b, t) };
}

// --- Buildings -------------------------------------------------------------------------------
export function buildLot(kit, lot, detail, add) {
  const { r0 } = { r0: null };
  const r = kit.rng(lot.seed), near = detail === 'near';
  switch (lot.kind) {
    case 'tower': return tower(kit, lot, near, add, r);
    case 'hall': return hall(kit, lot, near, add, r);
    case 'workshop': return workshop(kit, lot, near, add, r);
    default: return house(kit, lot, near, add, r);
  }
}

// A house, a row house or a shop: walls, floors of windows, a roof, and at street level its door.
function house(kit, lot, near, add, r) {
  const { THREE, C, U, level, L, box, cyl, facade, modern, timber } = kit;
  const w = lot.w, d = lot.d, fh = floorH(U), floors = Math.max(1, lot.floors), H = floors * fh, wall = kit.walls[Math.floor(r() * kit.walls.length)];
  const shop = lot.kind === 'shop', row = lot.kind === 'row' || shop, gable = timber || (level <= 2), bay = (modern ? 2.2 : 2.6) * U;
  // The body, a little inset at the ends so neighbours in a row read as separate houses.
  const inset = row ? .04 * U : 0;
  add(box(w - inset * 2, H, d), L(0, -1.2, 0), wall);
  add(box(w - inset * 2 + .1, 1.2, d + .1), L(0, -1.2 - .02, 0), C.plinth || C.stone2); // the footing
  // Windows painted on the front and back (the ground floor of a shop is its shopfront instead).
  const y0 = shop ? fh : 0;
  if (H - y0 > .5) {
    add(facade(w - inset * 2 - .02, H - y0, y0, bay, fh, lot.seed), L(0, y0, d / 2 + .015), wall);
    add(facade(w - inset * 2 - .02, H - y0, y0, bay, fh, lot.seed + 1), L(0, y0, -d / 2 - .015, 0, Math.PI, 0), wall);
  }
  // The roof.
  if (gable) {
    const rh = Math.min(w, d) * .38, roof = new THREE.CylinderGeometry(.01, Math.SQRT1_2 * 1, 1, 4, 1).rotateY(Math.PI / 4);
    const span = new THREE.BufferGeometry().copy(roof); span.scale(w * 1.12, rh, d * 1.15).translate(0, rh / 2, 0);
    add(span, L(0, H, 0), r() < .5 ? C.roof : C.roof2);
    if (near && r() < .7) add(box(.5 * U, rh * .9, .5 * U), L(w * (r() - .5) * .5, H + rh * .35, -d * .15), C.stone2); // a chimney
  } else {
    add(box(w - inset * 2 + .15, .35 * U, d + .15), L(0, H, 0), modern ? C.metal || '#9aa5ad' : C.trim); // parapet cap
    if (near) { // on the roof: a terrace, water tank, vents or panels
      const k = r();
      if (modern && k < .45) for (let i = 0; i < 3; i++) add(box(w * .25, .08, d * .3).rotateX(-.35), L((i - 1) * w * .3, H + .6 * U, 0), '#1d2a3a');
      else if (k < .7) add(cyl(.7 * U, .7 * U, 1.4 * U, 8), L(w * .25, H + .35 * U, -d * .2), C.metal || C.trim);
      else add(box(1.2 * U, .9 * U, 1 * U), L(-w * .2, H + .35 * U, d * .1), C.wall2);
    }
  }
  // Cornices between the floors (cities), and the floor line of a timber frame.
  if (near && kit.cityTier && floors > 1) for (let f = 1; f < floors; f++) add(box(w - inset * 2 + .12, .14 * U, .18 * U), L(0, f * fh - .07 * U, d / 2 + .05), modern ? C.metal2 || C.trim : C.trim);
  if (near && timber) {
    for (const x of [-1, 1]) add(box(.2 * U, H, .2 * U), L(x * (w / 2 - .1 * U), 0, d / 2 + .02), C.wood);
    for (let f = 1; f <= floors; f++) add(box(w, .18 * U, .2 * U), L(0, f * fh - .2 * U, d / 2 + .03), C.wood);
  }
  if (!near) return { w, d, h: H };
  // Street level.
  const doorX = shop ? 0 : (r() < .5 ? -1 : 1) * Math.min(w * .28, 1.2 * U), dw = 1.1 * U, dh = 2.2 * U;
  if (shop) {
    // A shopfront: big lit windows either side of the door, an awning and a sign.
    const sw = (w - dw - .6 * U) / 2;
    for (const x of [-1, 1]) {
      add(new THREE.PlaneGeometry(sw, fh * .62), L(x * (dw / 2 + sw / 2 + .15 * U), fh * .48, d / 2 + .03), C.window, true);
      add(box(sw + .1, .12 * U, .3 * U), L(x * (dw / 2 + sw / 2 + .15 * U), fh * .15, d / 2 + .1), C.trim); // the sill
    }
    add(new THREE.PlaneGeometry(dw, dh), L(0, dh / 2, d / 2 + .03), modern ? C.glass || '#7aa' : C.door);
    const awn = r() < .5 ? C.accent : C.accent2 || C.accent;
    if (!modern || r() < .5) add(box(w * .92, .1 * U, 1.6 * U).rotateX(.28), L(0, fh * .86, d / 2 + .75 * U), awn);
    else add(box(w * .96, .18 * U, 2 * U), L(0, fh * .9, d / 2 + 1 * U), C.metal || '#9aa5ad'); // a canopy
    add(box(Math.min(w * .7, 4 * U), .55 * U, .1), L(0, fh * .97 + .35 * U, d / 2 + .08), r() < .5 ? C.accent : C.trim, kit.level >= 4); // the sign (lit in cities)
  } else {
    add(new THREE.PlaneGeometry(dw, dh), L(doorX, dh / 2, d / 2 + .03), C.door);
    add(box(dw + .35 * U, .2 * U, .25 * U), L(doorX, dh, d / 2 + .1), C.trim); // the lintel
    // Ground-floor windows, with shutters in villages.
    for (const x of [doorX > 0 ? -1 : 1]) {
      const wx = x * Math.min(w * .28, 1.4 * U);
      add(new THREE.PlaneGeometry(1 * U, 1.1 * U), L(wx, 1.5 * U, d / 2 + .025), C.window, r() < .5);
      if (level <= 3) for (const s of [-1, 1]) add(box(.45 * U, 1.15 * U, .06), L(wx + s * .75 * U, .95 * U, d / 2 + .05), C.accent2 || C.accent);
    }
  }
  add(box(dw + .6 * U, .18 * U, .9 * U), L(doorX, 0, d / 2 + .45 * U), C.stone2 || C.plinth); // the step
  // A porch for village houses; balconies on city rows.
  if (lot.kind === 'house' && level <= 2) {
    add(box(w * .9, .12 * U, 1.8 * U), L(0, dh + .25 * U, d / 2 + .9 * U).multiply(L(0, 0, 0, .18, 0, 0)), C.roof2 || C.wood);
    for (const x of [-1, 1]) add(box(.15 * U, dh + .25 * U, .15 * U), L(x * w * .4, 0, d / 2 + 1.7 * U), C.wood);
  } else if (kit.cityTier && floors > 2 && r() < .55) {
    for (let f = 1; f < floors; f += 1 + Math.floor(r() * 2)) {
      const bx = (r() - .5) * w * .4, bw = Math.min(w * .45, 2.6 * U);
      add(box(bw, .14 * U, .9 * U), L(bx, f * fh, d / 2 + .45 * U), modern ? C.metal2 || C.trim : C.trim);
      add(box(bw, .8 * U, .06), L(bx, f * fh + .14 * U, d / 2 + .88 * U), modern ? C.glass || '#9cc' : C.metal || C.wood);
    }
  }
  return { w, d, h: H };
}

// A civic hall on the square: a tall ground floor behind columns, steps up to it, a pediment or dome.
function hall(kit, lot, near, add, r) {
  const { THREE, C, U, L, box, cyl, facade, modern } = kit;
  const w = lot.w, d = lot.d, fh = floorH(U) * 1.4, floors = Math.max(2, Math.min(lot.floors, 4)), H = floors * fh, wall = modern ? kit.walls[1] : kit.mix(C.wall, '#ece6da', .45);
  add(box(w, H, d), L(0, -1.2, 0), wall);
  add(facade(w * .9, H - fh, fh, 3 * U, fh, lot.seed), L(0, fh, d / 2 + .015), wall);
  if (modern) { add(box(w + .4, .5 * U, d + .4), L(0, H, 0), C.metal || C.trim); add(new THREE.PlaneGeometry(w * .8, fh * .8), L(0, fh * .45, d / 2 + .03), C.window, true); }
  else { const ped = new THREE.CylinderGeometry(.01, 1, 1, 3, 1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(w * 1.05, 1.6 * U, d * .5); add(ped.translate(0, .8 * U, d * .25), L(0, H, 0), C.trim); add(box(w + .3, .4 * U, d + .3), L(0, H - .4 * U, 0), C.trim); }
  if (r() < .4) add(new THREE.SphereGeometry(Math.min(w, d) * .3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), L(0, H + (modern ? .5 * U : 0), -d * .1), modern ? C.glass || C.window : C.roof2);
  if (!near) return { w, d, h: H };
  const cols = Math.max(4, Math.round(w / (2.2 * U)));
  for (let i = 0; i < cols; i++) add(cyl(.32 * U, .38 * U, fh * 1.1, 10), L(-w * .42 + i * (w * .84 / (cols - 1)), .6 * U, d / 2 + 1.4 * U), modern ? C.metal2 || '#ddd' : kit.mix(C.wall, '#f2eee6', .6));
  add(box(w * .95, .25 * U, 2.4 * U), L(0, fh * 1.1 + .6 * U, d / 2 + 1.3 * U), modern ? C.metal2 || C.trim : C.trim);
  for (let s = 0; s < 3; s++) add(box(w * .9 - s * .3, .2 * U, 3.6 * U - s * .9 * U), L(0, s * .2 * U, d / 2 + 1.8 * U - s * .45 * U), C.stone || C.plinth); // steps
  add(new THREE.PlaneGeometry(1.8 * U, 2.8 * U), L(0, 1.4 * U + .6 * U, d / 2 + .03), C.door);
  if (r() < .6) add(box(2.6 * U, .7 * U, .1), L(0, fh * 1.2, d / 2 + 2.6 * U), C.accent, true); // a banner sign
  return { w, d, h: H };
}

// A workshop or warehouse: a wide door, a roof light or a sawtooth roof, a vent.
function workshop(kit, lot, near, add, r) {
  const { THREE, C, U, L, box, cyl, facade, modern } = kit;
  const w = lot.w, d = lot.d, fh = floorH(U) * 1.5, H = Math.max(1, Math.min(lot.floors, 2)) * fh, wall = r() < .5 ? C.wall2 : kit.walls[0];
  add(box(w, H, d), L(0, -1.2, 0), wall);
  add(facade(w, H * .4, H * .55, 3 * U, H * .4, lot.seed), L(0, H * .55, d / 2 + .015), wall);
  const teeth = Math.max(2, Math.round(d / (4 * U)));
  for (let i = 0; i < teeth; i++) { const g = new THREE.CylinderGeometry(.01, 1, 1, 3, 1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(w, 1.4 * U, d / teeth); add(g.translate(0, .7 * U, -d / 2 + (i + .5) * d / teeth), L(0, H, 0), i % 2 ? C.roof2 : C.metal || C.roof); }
  if (!near) return { w, d, h: H };
  add(box(Math.min(w * .5, 4 * U), 3.2 * U, .12), L(-w * .15, 0, d / 2 + .05), modern ? C.metal || '#888' : C.wood); // the big door
  add(new THREE.PlaneGeometry(1 * U, 2.1 * U), L(w * .3, 1.05 * U, d / 2 + .03), C.door);
  add(cyl(.35 * U, .35 * U, 3 * U, 8), L(w * .3, H, -d * .2), C.metal || C.stone2); // a vent stack
  add(box(Math.min(w * .5, 3 * U), .5 * U, .1), L(w * .25, H * .45, d / 2 + .06), C.accent);
  return { w, d, h: H };
}

// A tower over the core blocks: set back as it rises, its glass banded by floor, a crown.
function tower(kit, lot, near, add, r) {
  const { THREE, C, U, L, box, cyl, facade } = kit;
  const fh = floorH(U), floors = Math.max(6, lot.floors), H = floors * fh;
  let w = lot.w, d = lot.d, y = 0;
  const steps = floors > 16 ? 3 : 2, glass = r() < .5 ? C.glass || '#7fb0c4' : kit.mix(C.glass || '#7fb0c4', C.wall, .35), frame = r() < .5 ? C.metal2 || '#d7dde1' : C.wall2;
  for (let s = 0; s < steps; s++) {
    const h = s === 0 ? H * .55 : H * .45 / (steps - 1);
    add(box(w, h, d), L(0, y + (s === 0 ? -1.2 : 0), 0), frame);
    for (const [ry, len, off] of [[0, w, d / 2], [Math.PI, w, d / 2], [Math.PI / 2, d, w / 2], [-Math.PI / 2, d, w / 2]]) add(facade(len * .96, h - .4, y + .2, 1.8 * U, fh, lot.seed + s * 4 + ry), L(Math.sin(ry) * (off + .015), y + .2, Math.cos(ry) * (off + .015), 0, ry, 0), glass);
    if (near) for (const yy of [y + h - .3 * U]) add(box(w + .3, .3 * U, d + .3), L(0, yy, 0), frame);
    y += h; w *= .72; d *= .72;
  }
  add(box(w * .6, 2 * fh, d * .6), L(0, y, 0), frame);
  add(cyl(.12 * U, .2 * U, 8 * U, 6), L(0, y + 2 * fh, 0), C.metal || '#aaa');
  add(new THREE.IcosahedronGeometry(.35 * U, 0), L(0, y + 2 * fh + 8 * U, 0), C.beacon || '#ff4a4a', 'blink');
  return { w: lot.w, d: lot.d, h: y };
}

// --- Street furniture ---------------------------------------------------------------------
export function buildProp(kit, p, add) {
  const { THREE, C, U, L, box, cyl, level } = kit;
  switch (p.kind) {
    case 'lamp': add(cyl(.06 * U, .09 * U, 3.4 * U, 6), L(), C.metal || '#333'); add(box(.36 * U, .45 * U, .36 * U), L(0, 3.4 * U, 0), C.window, true); add(box(.5 * U, .08 * U, .5 * U), L(0, 3.85 * U, 0), C.metal || '#333'); return;
    case 'lamp-tall': add(cyl(.07 * U, .12 * U, 6 * U, 6), L(), C.metal2 || '#ccc'); add(box(1.6 * U, .12 * U, .3 * U), L(.7 * U, 6 * U, 0), C.metal2 || '#ccc'); add(box(.8 * U, .06 * U, .26 * U), L(1.1 * U, 5.95 * U, 0), C.window, true); return;
    case 'tree': { const h = (3 + (p.x * 13.7 % 1 + 1) % 1 * 2) * U; add(cyl(.12 * U, .2 * U, h * .55, 6), L(), C.wood); add(new THREE.IcosahedronGeometry(h * .32, 0), L(0, h * .72, 0), C.leaf || '#4f7a3a'); add(new THREE.IcosahedronGeometry(h * .22, 0), L(h * .12, h * .92, -h * .05), kit.mix(C.leaf || '#4f7a3a', '#a8c060', .2)); if (level >= 3) add(box(1.2 * U, .2 * U, 1.2 * U), L(0, 0, 0), C.stone2); return; }
    case 'bench': add(box(1.8 * U, .1 * U, .5 * U), L(0, .45 * U, 0), C.wood); add(box(1.8 * U, .5 * U, .08 * U), L(0, .5 * U, -.24 * U), C.wood); for (const x of [-1, 1]) add(box(.1 * U, .45 * U, .45 * U), L(x * .75 * U, 0, 0), C.metal || '#444'); return;
    case 'log': add(cyl(.25 * U, .25 * U, 1.8 * U, 7).rotateZ(Math.PI / 2).translate(-.9 * U, .25 * U, 0), L(), C.wood); return;
    case 'stall': add(box(2 * U, .9 * U, 1.1 * U), L(), C.wood); for (const x of [-1, 1]) for (const z of [-1, 1]) add(box(.08 * U, 2.2 * U, .08 * U), L(x * .95 * U, 0, z * .5 * U), C.wood); add(box(2.3 * U, .08 * U, 1.5 * U).rotateX(.15), L(0, 2.25 * U, 0), C.accent); for (let i = 0; i < 4; i++) add(box(.32 * U, .25 * U, .32 * U), L(-.7 * U + i * .45 * U, .9 * U, .1 * U), [C.pot, C.leaf, C.accent2, C.bag][i] || C.pot); return;
    case 'cart': add(box(1.8 * U, .5 * U, 1 * U), L(0, .5 * U, 0), C.wood); for (const x of [-1, 1]) add(cyl(.4 * U, .4 * U, .1 * U, 10).rotateZ(Math.PI / 2), L(x * .2 * U, .4 * U, 0).multiply(L(0, 0, 0, 0, 0, 0)).setPosition(-.4 * U, .4 * U, x * .55 * U), C.wood); add(box(.6 * U, .4 * U, .6 * U), L(.3 * U, 1 * U, 0), C.bag || C.pot); return;
    case 'crates': for (let i = 0; i < 4; i++) add(box(.8 * U, .8 * U, .8 * U), L((i % 2) * .85 * U, Math.floor(i / 3) * .8 * U, Math.floor(i / 2) % 2 * .85 * U, 0, i * .3, 0), i % 2 ? C.wood : C.metal || C.wood); return;
    case 'garden': { const w = (p.w || 6) * .9; add(box(w, .05, 3.5 * U), L(0, 0, 0), C.turf || '#55703a'); for (let i = 0; i < 4; i++) add(box(w * .8, .3 * U, .25 * U), L(0, 0, -1.2 * U + i * .8 * U), C.leaf || '#4f7a3a'); for (const z of [-1.75 * U]) add(box(w, .9 * U, .06), L(0, 0, z), C.wood); return; }
    case 'well': add(cyl(.9 * U, .9 * U, .8 * U, 10), L(), C.stone); for (const x of [-1, 1]) add(box(.12 * U, 2 * U, .12 * U), L(x * .8 * U, 0, 0), C.wood); add(box(2 * U, .1 * U, 1 * U).rotateX(.0), L(0, 2 * U, 0), C.roof2); return;
    case 'fountain': add(cyl(3 * U, 3.2 * U, .6 * U, 18), L(), C.stone); add(cyl(2.7 * U, 2.7 * U, .05, 18), L(0, .55 * U, 0), '#5aa0c0', true); add(cyl(.4 * U, .6 * U, 2.2 * U, 10), L(), C.stone2); add(cyl(1.1 * U, .3 * U, .35 * U, 12), L(0, 2.2 * U, 0), C.stone); return;
    case 'monument': add(box(4 * U, 1 * U, 4 * U), L(), C.stone2); add(cyl(.2 * U, 1.1 * U, 12 * U, 4), L(0, 1 * U, 0, 0, Math.PI / 4, 0), C.metal2 || C.stone); add(new THREE.IcosahedronGeometry(.6 * U, 0), L(0, 13.4 * U, 0), C.window, true); return;
    case 'pond': add(cyl(4 * U, 4 * U, .05, 16), L(0, .05, 0), '#4f8fae'); add(new THREE.TorusGeometry(4 * U, .25 * U, 4, 20).rotateX(Math.PI / 2), L(0, .1, 0), C.stone); return;
    case 'stop': add(box(3 * U, .12 * U, 1.4 * U), L(0, 2.5 * U, 0), C.metal2 || '#ccc'); for (const x of [-1, 1]) add(box(.1 * U, 2.5 * U, .1 * U), L(x * 1.4 * U, 0, -.6 * U), C.metal || '#555'); add(box(2.6 * U, 1.6 * U, .05), L(0, .6 * U, -.65 * U), C.glass || '#9cc'); add(box(1 * U, 1.6 * U, .1), L(1.7 * U, .6 * U, 0), C.accent, true); return;
    default: return;
  }
}

// --- Far away: the masses only --------------------------------------------------------------
// A planned block's row of houses along one side becomes one long mass (the same height
// and colour as its houses), towers and halls their own; villages keep a mass per house.
// Instanced (one draw call a unit), its windows painted from each mass's real size.
export function farMasses(plan, U) {
  const fh = floorH(U), out = [], rows = new Map();
  for (const l of plan.lots) {
    const h = l.kind === 'tower' ? Math.max(6, l.floors) * fh * 1.05 : Math.max(1, l.floors) * fh * (l.kind === 'hall' ? 1.4 : l.kind === 'workshop' ? 1.5 : 1);
    if (l.block === undefined || l.kind === 'tower' || l.kind === 'hall') { out.push({ x: l.x, z: l.z, ang: l.ang, w: l.w, d: l.d, h, kind: l.kind, seed: l.seed }); continue; }
    const key = `${l.block}:${l.ang.toFixed(2)}`;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ ...l, h });
  }
  for (const list of rows.values()) {
    const c = Math.cos(list[0].ang), s = Math.sin(list[0].ang), ax = -s, az = c; // along the row
    const t = list.map((l) => l.x * ax + l.z * az), t0 = Math.min(...list.map((l, i) => t[i] - l.w / 2)), t1 = Math.max(...list.map((l, i) => t[i] + l.w / 2));
    const n = list.length, mx = list.reduce((a, l) => a + l.x, 0) / n, mz = list.reduce((a, l) => a + l.z, 0) / n, tm = mx * ax + mz * az;
    const h = list.reduce((a, l) => a + l.h, 0) / n;
    out.push({ x: mx + ax * ((t0 + t1) / 2 - tm), z: mz + az * ((t0 + t1) / 2 - tm), ang: list[0].ang, w: t1 - t0, d: list[0].d, h, kind: 'row', seed: list[0].seed });
  }
  return out;
}
// One instanced mesh of boxes with painted windows. items: [{ matrix (world, at the foot), w, h, d, colour }].
export function farMesh(THREE, items, { windowColour, night, U, geometry = null, windows = true }) {
  const g = geometry || new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), size = new THREE.InstancedBufferAttribute(new Float32Array(items.length * 4), 4);
  items.forEach((it, i) => size.setXYZW(i, it.w, it.h, it.d, (it.seed % 997) * 7.3));
  g.setAttribute('iSize', size);
  const material = new THREE.MeshStandardMaterial({ roughness: .8, flatShading: true });
  material.userData.surfaceDetail = true;
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = night; sh.uniforms.uWin = { value: new THREE.Color(windowColour) }; sh.uniforms.uFloor = { value: floorH(U) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 iSize; varying vec2 vWin; varying float vSide;').replace('#include <begin_vertex>', `#include <begin_vertex>
vSide = 1. - step(.5, abs(normal.y));
vWin = vec2(uv.x * (abs(normal.x) > .5 ? iSize.z : iSize.x) + iSize.w, uv.y * iSize.y);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; uniform vec3 uWin; uniform float uFloor; varying vec2 vWin; varying float vSide;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec2 cell = vWin / vec2(uFloor * .85, uFloor), f = fract(cell), id = floor(cell);
  float win = step(.22, f.x) * step(f.x, .78) * step(.24, f.y) * step(f.y, .78) * vSide * step(1.2, vWin.y) * ${windows ? '1.' : '0.'};
  float on = step(.62 - .3 * uNight, fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * .25 + vec3(.06, .08, .1), win);
  totalEmissiveRadiance += uWin * win * on * (.05 + 1.1 * uNight); }`);
  };
  const mesh = new THREE.InstancedMesh(g, material, items.length), sc = new THREE.Vector3(), m = new THREE.Matrix4(), c = new THREE.Color();
  items.forEach((it, i) => { mesh.setMatrixAt(i, m.copy(it.matrix).multiply(new THREE.Matrix4().makeScale(it.w, it.h, it.d))); mesh.setColorAt(i, c.set(it.colour)); });
  mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false;
  return mesh;
}
