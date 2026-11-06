// Alien buildings: one building drawn in its people's own architecture (alien-arch.mjs).
// A building is a body (one of the masses, turned on a lathe from its profile, with as many
// sides as their walls have), raised on legs or a stalk, or held over the ground, or set
// on a plinth; a roof or crown in their way; openings in their way (round ports, slits,
// glowing seams, honeycomb, membrane panes, light bands), lit at night; a door shaped and
// sized for their bodies, facing the street; their ornaments (ribs, scales, fins, rings,
// tendrils, sails, spines, drapes, vanes); and, as the language says, an annex joined by
// a tube, a wall round the yard. Shops spread a canopy over goods, workshops vent and
// open wide, halls are grander, towers rise in tiers and carry beacons.
//
//   buildAlien(ctx, A, lot, add)   lot: { w, d, floors, kind, seed }   (+z faces the street)
//   ctx: { THREE, C, U, fh, lights, fill }   add(geometry, localMatrix, colour, bright?)
//   farShape(THREE, A, mass) -> a unit-sized geometry (footprint 1 by 1, height 1) for far-off instancing
import { variantOf } from './alien-arch.mjs';

const TAU = Math.PI * 2;
const mixHex = (THREE, a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

// Profiles: radius (0..1 of the base) at height t (0..1).
const PROFILES = {
  taper: (t) => 1 - .38 * t, bulge: (t) => .78 + .3 * Math.sin(Math.PI * t), waist: (t) => 1 - .3 * Math.sin(Math.PI * t),
  flare: (t) => .72 + .38 * t, onion: (t) => (t < .72 ? .8 + .32 * Math.sin(Math.PI * t / .72) : .8 * (1 - (t - .72) / .28) + .06), straight: () => 1,
};

export function buildAlien(ctx, A, lot, add) {
  const { THREE, C, U, fh, lights } = ctx;
  const kind = lot.kind || 'home', tower = kind === 'tower', hall = kind === 'hall';
  const v = variantOf(A, lot.seed, tower ? 'tower' : 'home'), r = v.r;
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const V2 = (x, y) => new THREE.Vector2(Math.max(.001, x), y);
  const sides = A.sides, phi0 = -Math.PI / sides; // a flat face (or a seam) toward the street
  const low = !!ctx.low; // far off: the same building, simpler (farProtos)
  const lathe = (pts, n = sides) => { n = Math.min(n, low ? 8 : 14); return new THREE.LatheGeometry(pts.map(([x, y]) => V2(x, y)), n, n <= 12 ? -Math.PI / n : 0); };
  const cyl = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n, 1).translate(0, h / 2, 0);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const ball = (rad, det = 0) => new THREE.IcosahedronGeometry(rad, det);
  const torus = (R, t, rs, ts, arc = TAU) => new THREE.TorusGeometry(R, t, Math.min(rs, 3), Math.min(ts, arc < TAU ? 6 : 10), arc);
  const rod = (a, b, rad, colour, n = 4, bright = false) => { const A3 = new THREE.Vector3(...a), B3 = new THREE.Vector3(...b), len = A3.distanceTo(B3); if (len < 1e-4) return; const m = new THREE.Matrix4().compose(A3.clone().add(B3).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B3.clone().sub(A3).normalize()), new THREE.Vector3(1, 1, 1)); add(new THREE.CylinderGeometry(rad, rad, len, n, 1, true), m, colour, bright); };

  // Colours: the world's walls with the species' own colours worked in, one of a few tones a house.
  const acc = A.accent || C.accent, sh = A.shimmer || C.accent2 || acc;
  const tones = [C.wall, mixHex(THREE, C.wall, acc, .22), mixHex(THREE, C.wall2 || C.wall, '#ffffff', .15), mixHex(THREE, C.wall, sh, .3)];
  const shell = A.sleek ? mixHex(THREE, tones[v.tone], '#e8eef2', .35) : tones[v.tone];
  const shell2 = mixHex(THREE, shell, '#000000', .18), trim = A.sleek ? mixHex(THREE, C.metal2 || '#c9d2d8', acc, .25) : mixHex(THREE, C.trim || C.wood || shell2, acc, .3);
  const glowC = A.glowColour ? mixHex(THREE, C.window, A.glowColour, .6) : C.window, dark = mixHex(THREE, shell, '#10141a', .7);
  const pane = (b) => (lights && b ? glowC : dark), lit = lights;

  // Size: the lot's footprint (less the ground left round it), and height from its floors.
  const fill = ctx.fill ?? .75, R0 = Math.max(1.2 * U, Math.min(lot.w, lot.d) * fill / 2) * (hall ? 1 : 1);
  const floors = Math.max(1, lot.floors || 1), H0 = tower ? floors * fh : Math.max(1.25, floors) * fh * A.squat * v.stretch * (hall ? 1.5 : 1);
  // Raised, hovering or grounded.
  let y0 = 0;
  const raisedH = A.raised > .45 && !tower ? (1.2 + A.raised * 1.6) * U : 0;
  if (raisedH) { // legs, or one stalk
    const n = A.sides === 3 ? 3 : 4 + (r() < .4 ? 2 : 0);
    if (v.mass === 'mushroom' || r() < .25) add(cyl(R0 * .22, R0 * .32, raisedH + .2 * U, 8), L(), shell2);
    else for (let i = 0; i < n; i++) { const a = i / n * TAU + .3, x = Math.sin(a) * R0 * .78, z = Math.cos(a) * R0 * .78; rod([x * 1.25, 0, z * 1.25], [x * .85, raisedH + .1 * U, z * .85], .11 * U, trim, 5); }
    y0 = raisedH;
    // A ramp up to the door.
    const room = Math.max(0, lot.d / 2 - R0 * .9 - .3 * U), len = Math.min(raisedH * 1.8, room);
    if (len > raisedH * .9) { const run = Math.sqrt(Math.max(0, len * len - raisedH * raisedH)) || len * .5, ang = Math.atan2(raisedH, run); add(box(1.1 * U, .12 * U, len), L(0, raisedH / 2 - .06 * U, R0 * .9 + run / 2, ang).multiply(L(0, 0, -len / 2 + len / 2)), trim); }
    else for (const x of [-.35, .35]) rod([x * U, 0, R0 * .95 + .3 * U], [x * U, raisedH, R0 * .85], .05 * U, trim, 4); // a ladder
  } else if (A.hover && (tower || r() < .5)) {
    y0 = .9 * U; add(cyl(R0 * .35, R0 * .45, y0 + .1, 10), L(), shell2); // the core it rises from
    add(torus(R0 * .82, .09 * U, 4, 24).rotateX(Math.PI / 2), L(0, y0 * .55, 0), glowC, true); // the field that holds it
  } else if (A.sunk && !tower) { // half under the ground, in a ring of banked earth
    y0 = -H0 * A.sunk;
    add(lathe([[R0 * 1.45, -.2], [R0 * 1.15, .55 * U], [R0 * .98, .5 * U]], Math.max(sides, 10)), L(), C.soil || mixHex(THREE, shell2, '#3a2f22', .5));
  } else {
    add(lathe([[R0 * 1.08, -1.4], [R0 * 1.1, .18 * U], [R0 * 1.02, .3 * U]]), L(), A.world.volcanic > .4 ? mixHex(THREE, C.stone2 || shell2, '#202020', .4) : (C.plinth || shell2)); // a plinth, reaching below the ground
    y0 = .3 * U;
  }

  // The body.
  const prof = PROFILES[A.profile] || PROFILES.straight;
  const top = { y: y0 + H0, r: R0 * prof(1) }; // where the roof goes
  const body = (mass, R, H, yb, colour = shell) => {
    switch (mass) {
      case 'dome': {
        const wall = H * .18, pts = [[R, 0], [R, wall]]; for (let i = 1; i <= 7; i++) { const a = i / 7 * Math.PI / 2; pts.push([R * Math.cos(a), wall + (H - wall) * Math.sin(a)]); }
        add(lathe(pts, Math.max(sides, 8)), L(0, yb), colour); return { y: yb + H, r: R * .25, closed: true };
      }
      case 'pod': {
        const pts = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI; pts.push([R * Math.cos(a) * (.85 + .15 * prof(i / 8)), H / 2 + H / 2 * Math.sin(a)]); }
        add(lathe(pts, Math.max(sides, 8)), L(0, yb), colour); return { y: yb + H, r: R * .2, closed: true };
      }
      case 'spire': {
        const pts = [[R, 0]]; for (let i = 1; i <= 6; i++) { const t = i / 6; pts.push([R * prof(t) * (1 - t * .78), H * t]); }
        add(lathe(pts), L(0, yb), colour); return { y: yb + H, r: R * .22 * prof(1), closed: false };
      }
      case 'stack': {
        const n = Math.max(2, Math.min(7, Math.round(H / (fh * 1.1)))), h = H / n; let rr = R, x = 0, z = 0;
        for (let i = 0; i < n; i++) {
          add(lathe([[rr, 0], [rr * 1.04, h * .82], [rr * .96, h * .82], [rr * .9, h]]), L(x, yb + i * h, z, 0, i * A.twist, 0), i % 2 ? shell2 : colour);
          add(torus(rr * 1.02, .07 * U, 3, Math.max(sides, 8)).rotateX(Math.PI / 2), L(x, yb + i * h + h * .82, z, 0, i * A.twist, 0), trim);
          if (A.cantilever && i) { x += (r() - .5) * rr * .3; z += (r() - .5) * rr * .2; }
          rr *= .86 + r() * .08;
        }
        return { y: yb + H, r: rr, closed: false, x, z };
      }
      case 'shell': { // a spiral of swelling chambers
        const n = 6; let ang = v.turn;
        for (let i = 0; i < n; i++) { const t = i / (n - 1), s = R * (1 - t * .62), d = R * .48 * (1 - t); add(ball(s, 1), L(Math.sin(ang) * d, yb + s * .7 + H * .62 * t, Math.cos(ang) * d, 0, 0, 0, 1, .85, 1), i % 2 ? shell2 : colour); ang += 1.25; }
        return { y: yb + H * .62 + R * .38 * .7 + R * .3, r: R * .2, closed: true };
      }
      case 'mushroom': {
        add(lathe([[R * .52, 0], [R * .42, H * .5], [R * .38, H * .72]]), L(0, yb), shell2);
        add(lathe([[R * .3, H * .66], [R * 1.25, H * .74], [R * 1.12, H * .86], [R * .55, H * .98], [R * .05, H]], Math.max(sides, 10)), L(0, yb), colour);
        return { y: yb + H, r: R * .08, closed: true, cap: R * 1.25, capY: yb + H * .74 };
      }
      case 'cluster': {
        const n = 3 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) { const a = v.turn + i * TAU / n, d = i ? R * .55 : 0, s = R * (i ? .52 + r() * .15 : .78); add(ball(s, 1), L(Math.sin(a) * d, yb + s * .55, Math.cos(a) * d, 0, 0, 0, 1, H / (R * 1.5), 1), i % 2 ? shell2 : colour); }
        return { y: yb + R * .78 * .55 + R * .78 * H / (R * 1.5), r: R * .2, closed: true };
      }
      case 'arch': { // a vault of ribs over a skin
        const len = R * 1.7, n = 5;
        add(new THREE.CylinderGeometry(R * .95, R * .95, len, 12, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, H / R, 1), L(0, yb, 0), colour);
        for (let i = 0; i < n; i++) add(torus(R, .12 * U, 4, 12, Math.PI).scale(1, H / R, 1), L(0, yb, -len / 2 + i * len / (n - 1)), trim);
        add(new THREE.CircleGeometry(R * .95, 12, 0, Math.PI).scale(1, H / R, 1), L(0, yb, len / 2), shell2);
        add(new THREE.CircleGeometry(R * .95, 12, 0, Math.PI).scale(1, H / R, 1), L(0, yb, -len / 2, 0, Math.PI, 0), shell2);
        return { y: yb + H, r: R * .1, closed: true, long: len };
      }
      case 'crystal': {
        const n = 3 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) { const a = v.turn + i * TAU / n, d = i ? R * .5 : 0, h = H * (i ? .5 + r() * .35 : 1), w = R * (i ? .38 : .55); const g = new THREE.CylinderGeometry(0, w, h * .25, 5).translate(0, h * .875, 0); add(cyl(w * .9, w, h * .75, 5), L(Math.sin(a) * d, yb, Math.cos(a) * d, (r() - .5) * .15, a, (r() - .5) * .15), i % 2 ? shell2 : colour); add(g, L(Math.sin(a) * d, yb, Math.cos(a) * d, 0, a, 0), mixHex(THREE, colour, '#ffffff', .2)); }
        return { y: yb + H, r: R * .1, closed: true };
      }
      case 'ring': {
        add(lathe([[R * .55, 0], [R * .5, H]]), L(0, yb), colour);
        for (const t of [.3, .7]) add(torus(R * .95, R * .14, 6, Math.max(sides, 12)).rotateX(Math.PI / 2), L(0, yb + H * t, 0), shell2);
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4; rod([0, yb + H * .3, 0], [Math.sin(a) * R * .9, yb + H * .3, Math.cos(a) * R * .9], .1 * U, trim); rod([0, yb + H * .7, 0], [Math.sin(a) * R * .9, yb + H * .7, Math.cos(a) * R * .9], .1 * U, trim); }
        return { y: yb + H, r: R * .5, closed: false };
      }
      case 'tensile': { // a membrane stretched from a mast to the ground
        const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([R * (1 - t) ** 1.8 + R * .04, H * t]); }
        add(lathe(pts, Math.max(4, Math.min(sides, 8))), L(0, yb), colour);
        add(cyl(.09 * U, .12 * U, H * 1.25, 5), L(0, yb), trim);
        for (let i = 0; i < Math.max(4, Math.min(sides, 8)); i++) { const a = phi0 + (i + .5) / Math.max(4, Math.min(sides, 8)) * TAU; rod([Math.sin(a) * R * 1.05, yb, Math.cos(a) * R * 1.05], [Math.sin(a) * R * 1.05, yb + H * .22, Math.cos(a) * R * 1.05], .06 * U, trim); }
        return { y: yb + H * 1.25, r: .1, closed: true };
      }
      default: { // drum
        const pts = [[R, 0]]; for (let i = 1; i <= 4; i++) { const t = i / 4; pts.push([R * prof(t), H * t]); }
        add(lathe(pts), L(0, yb), colour); return { y: yb + H, r: R * prof(1), closed: false };
      }
    }
  };
  const mass = v.mass;
  const B = body(mass, R0, H0, y0);
  const rAt = (t) => { // the body's radius at height fraction t, for openings and ornaments
    if (mass === 'dome') return t < .18 ? R0 : R0 * Math.cos(Math.asin(Math.min(1, (t - .18) / .82)));
    if (mass === 'pod') return R0 * Math.sin(Math.PI * Math.max(.05, Math.min(.95, t)));
    if (mass === 'spire') return R0 * prof(t) * (1 - t * .78);
    if (mass === 'stack') return R0 * (1 - t * .45);
    if (mass === 'mushroom') return R0 * .45;
    if (mass === 'ring' || mass === 'crystal') return R0 * .52;
    if (mass === 'tensile') return R0 * (1 - t) ** 1.8 + R0 * .04;
    if (mass === 'cluster' || mass === 'shell') return R0 * .7;
    return R0 * prof(t);
  };

  // Openings, floor by floor, round the body (not across the door).
  const perRow = low ? 4 : Math.max(3, Math.min(tower ? 8 : 6, Math.round(sides <= 6 ? sides : 6 + R0 / (3 * U))));
  const rows = Math.max(1, Math.min(tower ? (low ? 6 : 10) : 3, Math.floor(H0 / fh)));
  let made = 0;
  if (mass !== 'arch' && mass !== 'tensile') for (let row = 0; row < rows; row++) {
    const t = (row + .55) / (rows + .2), y = y0 + H0 * t, rr = rAt(t);
    if (rr < .6 * U) continue;
    for (let i = 0; i < perRow; i++) {
      const a = (i + .5) / perRow * TAU; if (Math.abs(((a + Math.PI) % TAU) - Math.PI) < .55 && row === 0) continue; // the door's side
      const on = (row * 7 + i * 3 + lot.seed) % 5 < 3, m = L(Math.sin(a) * (rr + .03), y, Math.cos(a) * (rr + .03), 0, a, 0);
      switch (A.openings) {
        case 'ports': add(new THREE.CircleGeometry(.32 * U, 7), m, pane(on), on && lit); add(new THREE.RingGeometry(.32 * U, .42 * U, 7, 1), m.clone().multiply(L(0, 0, .01)), trim); break;
        case 'slits': add(new THREE.PlaneGeometry(.16 * U, Math.min(fh * .6, 1.3 * U)), m, pane(on), on && lit); break;
        case 'comb': for (const [dx, dy] of [[-.3, 0], [.3, 0], [0, .45]]) add(new THREE.CircleGeometry(.24 * U, 6), m.clone().multiply(L(dx * U, dy * U, 0)), pane(on), on && lit); break;
        case 'membrane': add(new THREE.PlaneGeometry(Math.min(rr * .9, 1.6 * U), Math.min(fh * .6, 1.5 * U)), m, on && lit ? mixHex(THREE, glowC, shell, .4) : mixHex(THREE, shell, acc, .4), on && lit); break;
        case 'seams': case 'bands': break;
        default: add(new THREE.PlaneGeometry(.6 * U, .5 * U), m, pane(on), on && lit);
      }
      if (++made > 64) break;
    }
  }
  if (A.openings === 'seams' && mass !== 'tensile') for (let i = 0; i < perRow; i++) { const a = (i + .5) / perRow * TAU, rr = rAt(.5); add(new THREE.PlaneGeometry(.12 * U, H0 * .8), L(Math.sin(a) * (rr + .04), y0 + H0 * .1, Math.cos(a) * (rr + .04), 0, a, 0).multiply(L(0, H0 * .4)), lit ? glowC : dark, lit); }
  if (A.openings === 'bands' || (tower && A.sleek)) for (let row = 0; row < rows; row++) { const t = (row + .5) / rows, rr = rAt(t); if (rr > .5 * U) add(new THREE.CylinderGeometry(rr * 1.01, rr * 1.01, .22 * U, Math.max(sides, 8), 1, true), L(0, y0 + H0 * t, 0, 0, phi0, 0), lit && (row + lot.seed) % 3 ? glowC : dark, lit && (row + lot.seed) % 3 > 0); }

  // The door, facing the street, sized to its people.
  const dh = Math.min(H0 * .7, 2.3 * U * (A.squat > 1.1 ? 1.2 : 1)), dw = Math.min(R0, (A.doorShape === 'slot' ? .6 : 1.05) * U), dz = (mass === 'arch' ? R0 * .85 : mass === 'tensile' ? R0 * .55 : Math.max(rAt(Math.max(0, -y0 / H0) + dh / H0 * .5), R0 * .4)) + .05;
  const doorY = Math.max(0, y0);
  switch (A.doorShape) {
    case 'round': case 'iris': add(new THREE.CircleGeometry(dw * .7, A.doorShape === 'iris' ? 8 : 14), L(0, doorY + dw * .7, dz + (mass === 'arch' ? R0 * .85 : 0)), A.doorShape === 'iris' && lit ? glowC : (C.door || dark), A.doorShape === 'iris' && lit); add(torus(dw * .74, .08 * U, 4, 14), L(0, doorY + dw * .7, dz + .02 + (mass === 'arch' ? R0 * .85 : 0)), trim); break;
    case 'tri': add(new THREE.CircleGeometry(dw * .9, 3).rotateZ(Math.PI / 2), L(0, doorY + dw * .55, dz + (mass === 'arch' ? R0 * .85 : 0)), C.door || dark); break;
    default: { const zz = dz + (mass === 'arch' ? R0 * .85 : 0); add(new THREE.PlaneGeometry(dw, dh - dw / 2).translate(0, (dh - dw / 2) / 2, 0), L(0, doorY, zz), C.door || dark); add(new THREE.CircleGeometry(dw / 2, 10, 0, Math.PI), L(0, doorY + dh - dw / 2, zz), C.door || dark); add(torus(dw / 2 + .06 * U, .07 * U, 3, 10, Math.PI), L(0, doorY + dh - dw / 2, zz + .02), trim); }
  }
  if (!raisedH) add(cyl(dw * .9, dw, .14 * U, 8), L(0, 0, dz + dw * .5), C.stone2 || trim); // a doorstep

  // The roof, crown or cap.
  const cx = B.x || 0, cz = B.z || 0, tr = Math.max(B.r, .5 * U);
  if (!B.closed || tower) switch (A.roof) {
    case 'cap': add(lathe([[tr * 1.08, 0], [tr * .9, tr * .35], [tr * .45, tr * .62], [.01, tr * .7]], Math.max(sides, 8)), L(cx, B.y, cz), shell2); break;
    case 'spike': add(lathe([[tr * 1.1, 0], [tr * .4, tr * 1.1], [.01, tr * 2.2]]), L(cx, B.y, cz), trim); break;
    case 'parasol': add(cyl(.1 * U, .1 * U, 1.1 * U, 5), L(cx, B.y, cz), trim); add(lathe([[.01, .1 * U], [tr * 1.7, 0], [tr * 1.6, .12 * U], [.01, .5 * U]], Math.max(sides, 10)), L(cx, B.y + 1.1 * U, cz), mixHex(THREE, acc, shell, .5)); break;
    case 'fins': for (let i = 0; i < 5; i++) add(new THREE.CircleGeometry(tr * 1.1, 6, 0, Math.PI / 2).rotateY(i / 5 * TAU), L(cx, B.y, cz), i % 2 ? acc : trim); add(lathe([[tr, 0], [tr * .7, .3 * U]]), L(cx, B.y, cz), shell2); break;
    case 'dish': add(cyl(.12 * U, .16 * U, .8 * U, 6), L(cx, B.y, cz), trim); add(lathe([[.05, 0], [tr * .6, tr * .1], [tr * 1.05, tr * .4]], 12), L(cx, B.y + .8 * U, cz, -.35, 0, 0), C.metal2 || trim); break;
    case 'garden': add(cyl(tr, tr, .2 * U, Math.max(sides, 8)), L(cx, B.y, cz), C.soil || shell2); for (let i = 0; i < 4; i++) { const a = i * 1.57 + r(), d = tr * .5; add(ball((.3 + r() * .25) * U, 0), L(cx + Math.sin(a) * d, B.y + .4 * U, cz + Math.cos(a) * d, 0, 0, 0, 1, .8, 1), C.leaf || acc); } break;
    case 'crown': for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; add(new THREE.ConeGeometry(.16 * U, 1.3 * U, 4).translate(0, .65 * U, 0), L(cx + Math.sin(a) * tr * .85, B.y, cz + Math.cos(a) * tr * .85, Math.cos(a) * .25, 0, -Math.sin(a) * .25), trim); } add(ball(tr * .35, 1), L(cx, B.y + tr * .3, cz), lit ? glowC : acc, lit); break;
    default: add(new THREE.CylinderGeometry(tr * 1.02, tr * 1.02, .45 * U, Math.max(sides, 8), 1, true).translate(0, .22 * U, 0), L(cx, B.y, cz, 0, phi0), trim); // a flat roof with a parapet
  }
  if (mass === 'mushroom' && B.cap && A.ornaments.includes('tendrils')) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; rod([Math.sin(a) * B.cap * .92, B.capY, Math.cos(a) * B.cap * .92], [Math.sin(a) * B.cap * .95, B.capY - (.8 + r()) * U, Math.cos(a) * B.cap * .95], .04 * U, acc, 3, lit && i % 2 === 0); }

  // Ornaments.
  const H1 = H0 * (mass === 'tensile' ? .4 : 1);
  for (const o of low ? A.ornaments.filter((k) => k === 'rings' || k === 'fins') : A.ornaments) {
    if (made > 140) break;
    switch (o) {
      case 'ribs': if (['dome', 'pod', 'drum', 'spire', 'stack'].includes(mass)) for (let i = 0; i < Math.min(sides, 6); i++) { const a = (i / Math.min(sides, 6)) * TAU + .2; let prev = null; for (let k = 0; k <= 3; k++) { const t = k / 3, rr = rAt(Math.min(.97, t)) + .1 * U, p = [Math.sin(a) * rr, y0 + H0 * Math.min(.97, t), Math.cos(a) * rr]; if (prev) rod(prev, p, .08 * U, trim, 4); prev = p; } made += 4; } break;
      case 'rings': for (const t of [.15, .5, .85]) { const rr = rAt(t); if (rr > .4 * U && mass !== 'tensile') add(torus(rr + .06 * U, .08 * U, 3, Math.max(sides, 10)).rotateX(Math.PI / 2), L(0, y0 + H1 * t, 0), acc); } break;
      case 'fins': for (let i = 0; i < 3; i++) { const a = Math.PI * .6 + i * .55, rr = rAt(.4); add(new THREE.PlaneGeometry(.9 * U, H1 * .5), L(Math.sin(a) * (rr + .45 * U), y0 + H1 * .45, Math.cos(a) * (rr + .45 * U), 0, a + Math.PI / 2, 0), trim); } break;
      case 'spines': for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + .3, t = .3 + (i % 3) * .2, rr = rAt(t); add(new THREE.ConeGeometry(.12 * U, .8 * U, 4).rotateX(Math.PI / 2), L(Math.sin(a) * (rr + .35 * U), y0 + H1 * t, Math.cos(a) * (rr + .35 * U), 0, a, 0), trim); } break;
      case 'scales': for (let row = 0; row < 3; row++) for (let i = 0; i < 8; i++) { const a = (i + row * .5) / 8 * TAU, t = .25 + row * .2, rr = rAt(t); if (Math.abs(((a + Math.PI) % TAU) - Math.PI) < .5) continue; add(new THREE.CircleGeometry(.4 * U, 5), L(Math.sin(a) * (rr + .05), y0 + H1 * t, Math.cos(a) * (rr + .05), -.35, a, 0), row % 2 ? sh : acc); } break;
      case 'sails': for (let i = 0; i < 2; i++) { const a = Math.PI + (i - .5) * 1.2; add(new THREE.PlaneGeometry(1.4 * U, 2 * U), L(Math.sin(a) * (R0 + .8 * U), y0 + H1 * .7, Math.cos(a) * (R0 + .8 * U), -.6, a, 0), '#1d2c55'); rod([Math.sin(a) * R0, y0 + H1 * .5, Math.cos(a) * R0], [Math.sin(a) * (R0 + .8 * U), y0 + H1 * .7, Math.cos(a) * (R0 + .8 * U)], .05 * U, trim); } break;
      case 'drapes': for (let i = 0; i < 4; i++) { const a = Math.PI * .5 + i * .7, rr = rAt(.75); add(new THREE.PlaneGeometry(.7 * U, H1 * .55), L(Math.sin(a) * (rr + .06), y0 + H1 * .25, Math.cos(a) * (rr + .06), 0, a, 0).multiply(L(0, H1 * .27)), i % 2 ? acc : sh); } break;
      case 'vanes': for (let i = 0; i < 3; i++) add(box(.1 * U, 1.6 * U, .9 * U), L(cx + (i - 1) * .5 * U, B.y, cz, 0, .3, 0), trim); break;
      case 'tendrils': if (mass !== 'mushroom') for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + .5, rr = rAt(.8); rod([Math.sin(a) * rr, y0 + H1 * .8, Math.cos(a) * rr], [Math.sin(a) * (rr + .7 * U), y0 + H1 * .3, Math.cos(a) * (rr + .7 * U)], .05 * U, acc, 3); } break;
    }
  }

  // Fliers' ledges to land on, high up round the body, and a landing ring on top.
  if (A.perch) {
    for (let i = 0; i < 3; i++) { const t = .45 + i * .2, a = v.turn + i * 2.3, rr = rAt(t); add(cyl(1.1 * U, .9 * U, .18 * U, 8), L(Math.sin(a) * (rr + .7 * U), y0 + H0 * t, Math.cos(a) * (rr + .7 * U)), trim); rod([Math.sin(a) * rr, y0 + H0 * t - .9 * U, Math.cos(a) * rr], [Math.sin(a) * (rr + .9 * U), y0 + H0 * t, Math.cos(a) * (rr + .9 * U)], .07 * U, trim); }
    add(torus(Math.max(B.r, .8 * U) + .9 * U, .16 * U, 3, 12).rotateX(Math.PI / 2), L(cx, B.y - .2 * U, cz), trim);
  }
  // Their trade at the door.
  if (low) {} else if (kind === 'shop') { // a canopy over goods
    const z = Math.min(lot.d / 2 - .3 * U, R0 + 1.4 * U);
    add(lathe([[.01, .3 * U], [1.6 * U, 0], [1.55 * U, .08 * U], [.01, .4 * U]], Math.max(5, Math.min(sides, 8))), L(0, 2.2 * U, z), mixHex(THREE, acc, '#ffffff', .2));
    add(cyl(.06 * U, .06 * U, 2.2 * U, 5), L(0, 0, z), trim);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; add(ball((.18 + r() * .1) * U, 0), L(Math.sin(a) * .8 * U, .75 * U, z + Math.cos(a) * .6 * U), [acc, sh, C.crop, C.pot, C.leaf][i] || acc); }
    add(cyl(1.1 * U, 1.1 * U, .7 * U, Math.max(sides, 8)), L(0, 0, z), shell2);
    if (lit) add(ball(.25 * U, 1), L(0, 2.1 * U, z), glowC, true);
  } else if (kind === 'workshop') { // vents and stacks, and stores outside
    for (let i = 0; i < 2; i++) add(cyl(.28 * U, .35 * U, H0 * .5 + 1.4 * U, 6), L((i ? -1 : 1) * R0 * .45, B.y - H0 * .4, -R0 * .3), C.metal || trim);
    for (let i = 0; i < 3; i++) add(lathe([[.5 * U, 0], [.55 * U, .8 * U], [.4 * U, 1 * U]], 6), L(R0 * .9 + .4 * U, 0, (i - 1) * 1.1 * U), i % 2 ? shell2 : acc);
  } else if (hall || tower) { // a beacon on top
    rod([cx, B.y, cz], [cx, B.y + 3 * U, cz], .07 * U, trim); add(ball(.25 * U, 1), L(cx, B.y + 3.1 * U, cz), C.beacon || glowC, 'blink');
  }
  // An annex, joined by a tube; a wall round the yard for wary peoples.
  if (v.annex && !tower && lot.w > R0 * 3 && !low) {
    const side = v.extra < .5 ? -1 : 1, ax = side * (R0 + R0 * .55), ar = R0 * .5;
    const keep = add; add = (g, m, c, b) => keep(g, L(ax, 0, -R0 * .2).multiply(m), c, b);
    body(['dome', 'pod', 'drum'][lot.seed % 3], ar, Math.min(H0 * .6, 2.6 * U), y0 > .5 * U && !raisedH ? 0 : y0, shell2);
    add = keep;
    rod([side * R0 * .7, y0 + .8 * U, -R0 * .2], [ax - side * ar * .7, y0 + .8 * U, -R0 * .2], .55 * U, shell2, 8);
  }
  if (A.tubes && !tower && v.extra > .55 && !low) { const a = v.extra * TAU; rod([Math.sin(a) * R0 * .8, y0 + H0 * .3, Math.cos(a) * R0 * .8], [Math.sin(a) * (lot.w / 2 - .3 * U), y0 + H0 * .3, Math.cos(a) * (lot.d / 2 - .3 * U)], .45 * U, mixHex(THREE, trim, '#ffffff', .2), 8); }
  if (A.walled && !tower && !hall && !low) { const n = 10, rr = Math.min(lot.w, lot.d) / 2 * .96; for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; if (i === 0 || i === n - 1) continue; rod([Math.sin(a0) * rr, .45 * U, Math.cos(a0) * rr], [Math.sin(a1) * rr, .45 * U, Math.cos(a1) * rr], .25 * U, shell2, 4); } }
  return { height: (B.y || H0) + (tower || hall ? 3 * U : 0), radius: R0 };
}

// A building's footprint radius and height (without its crown), as buildAlien makes it.
export function sizeOf(A, lot, { U, fh, fill = .75 }) {
  const v = variantOf(A, lot.seed, lot.kind === 'tower' ? 'tower' : 'home'), floors = Math.max(1, lot.floors || 1);
  const R = Math.max(1.2 * U, Math.min(lot.w, lot.d) * fill / 2), H = lot.kind === 'tower' ? floors * fh : Math.max(1.25, floors) * fh * A.squat * v.stretch * (lot.kind === 'hall' ? 1.5 : 1);
  return { R, H: H + (A.raised > .45 && lot.kind !== 'tower' ? (1.2 + A.raised * 1.6) * U : .3 * U), mass: v.mass };
}

// Far off: one simple shape per mass, a unit footprint and a unit height (instanced with each building's size).
export function farShape(THREE, A, mass) {
  const P = PROFILES[A.profile] || PROFILES.straight, n = Math.max(5, Math.min(A.sides, 10)), V2 = (x, y) => new THREE.Vector2(Math.max(.001, x), y);
  const lathe = (pts) => new THREE.LatheGeometry(pts.map(([x, y]) => V2(x, y)), n);
  switch (mass) {
    case 'dome': case 'pod': case 'cluster': case 'shell': { const pts = [[.5, 0], [.5, .15]]; for (let i = 1; i <= 4; i++) { const a = i / 4 * Math.PI / 2; pts.push([.5 * Math.cos(a), .15 + .85 * Math.sin(a)]); } return lathe(pts); }
    case 'spire': case 'crystal': return lathe([[.5, 0], [.5 * P(.4) * .7, .5], [.06, 1]]);
    case 'mushroom': return lathe([[.22, 0], [.18, .7], [.62, .76], [.4, .95], [.02, 1]]);
    case 'tensile': return lathe([[.5, 0], [.18, .35], [.04, 1]]);
    case 'stack': return lathe([[.5, 0], [.5, .33], [.42, .33], [.42, .66], [.33, .66], [.33, 1], [.02, 1]]);
    default: return lathe([[.5, 0], [.5 * P(.5), .5], [.5 * P(1), .95], [.02, 1]]);
  }
}

// Far off, the same buildings simplified (fewer sides, no small parts), one prototype per
// shape this people builds in (two of each, a little different), each instanced over every
// far building of that shape. Vertex colours are the building's own; what glows at night
// (ports, seams, bands, crowns) glows far off too (aGlow).
//   farProtos(ctx, A) -> Map(key -> { geometry, R, H })   key: mass + ':' + 0|1, with 'tower:' for towers
export function farProtos(ctx, A) {
  const { THREE, U, fh } = ctx, out = new Map();
  const make = (kind, mass, k) => {
    let seed = -1;
    for (let s = 0, found = 0; s < 400; s++) if (variantOf(A, s, kind === 'tower' ? 'tower' : 'home').mass === mass && found++ === k) { seed = s; break; }
    if (seed < 0) return null;
    const lot = { w: 12 * U, d: 12 * U, floors: kind === 'tower' ? 12 : 2, kind, seed }, pos = [], col = [], glo = [], c = new THREE.Color();
    buildAlien({ ...ctx, low: true, fill: .75 }, A, lot, (g, m, colour, bright) => {
      if (!g || bright === 'blink' || bright === 'halo' || bright === 'pool' || bright === 'light') return;
      const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(m), P = geo.attributes.position; c.set(colour);
      for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); col.push(c.r, c.g, c.b); glo.push(bright ? 1 : 0); }
    });
    const size = sizeOf(A, lot, { U, fh, fill: .75 }), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(glo, 1));
    geo.scale(1 / (2 * size.R), 1 / size.H, 1 / (2 * size.R)); geo.computeVertexNormals();
    return geo;
  };
  for (const kind of ['home', 'tower']) for (const mass of new Set(kind === 'tower' ? A.towers : A.homes)) for (const k of [0, 1]) { const g = make(kind, mass, k); if (g) out.set(`${kind}:${mass}:${k}`, g); }
  return out;
}
// The material for far prototypes: their own colours, their lights coming on at night.
export function farMaterial(THREE, night) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, flatShading: true });
  m.userData.surfaceDetail = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = night;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; varying float vGlow;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * (.15 + 1.4 * uNight);');
  };
  return m;
}
