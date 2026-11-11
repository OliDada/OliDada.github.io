// Spaceships: every spacefaring civilization designs its own. shipDesign() picks a
// hull type from the builders' body family and culture (rockets are only one of many)
// and rolls its proportions, segments, fins, engines, colours and engine glow from the
// civilization's seed. buildShip() turns a design into geometry pieces (lit and
// glowing) in a local frame: +Y is "up" for ships that stand to launch, and +Z the nose
// for ships that fly level. Used on spaceports, in flight over capitals and in orbit.
import { rng } from './rng.mjs';

const HULLS = {
  hands: ['needle', 'lifter', 'saucer'],
  tentacles: ['seed', 'spiral'],
  tripods: ['lander', 'seed'],
  drifters: ['bladder', 'lantern'],
  hive: ['comb', 'beetle'],
  web: ['spindle', 'eggsac'],
  burrowers: ['bore', 'spiral'],
  nests: ['delta', 'feather'],
  grazers: ['ring', 'barrow', 'saucer'],
  rollers: ['wheel', 'ring'],
};
// Species with hands can build anything; their culture leans them toward some hulls.
const HANDS_BY_CULTURE = {
  timber: ['lifter', 'barrow', 'needle', 'lifter'], terraced: ['needle', 'saucer', 'ring', 'needle'],
  tents: ['saucer', 'delta', 'ring', 'saucer'], stilts: ['delta', 'wheel', 'lifter', 'delta'],
};
// Hull types that stand on their tails to launch; the rest take off level.
export const STANDS = new Set(['needle', 'seed', 'spiral', 'bore', 'spindle', 'lander', 'eggsac']);
const GLOWS = ['#7fd4ff', '#ffb35c', '#9dff8a', '#d08bff', '#ff6f7d', '#fff1a8'];

export function shipDesign(civ) {
  const r = rng(civ.seed ?? 1, 'ship', civ.id || ''), options = (civ.family === 'hands' && HANDS_BY_CULTURE[civ.culture]) || HULLS[civ.family] || ['needle'];
  const hull = options[Math.floor(r() * options.length)];
  const sp = civ.species.colors || {};
  return {
    hull, stands: STANDS.has(hull),
    length: 8 + r() * 8,                     // metres before the builders' scale
    girth: .14 + r() * .12,                  // radius as a fraction of length
    segments: 1 + Math.floor(r() * 3),
    fins: [0, 2, 3, 4, 6][Math.floor(r() * 5)],
    engines: 1 + Math.floor(r() * 4),
    hullColour: civ.material === 'shell' ? '#c9b392' : civ.material === 'wax' ? '#b98a3a' : civ.material === 'silk' ? '#d6cfbd' : civ.material === 'grown' || civ.material === 'living' ? sp.base || '#9a6a50' : r() < .55 ? '#cfd3d2' : sp.belly || '#c9c2b5',
    trim: sp.accent || '#c0503a', second: sp.base || '#556677',
    glow: civ.species.glow ? sp.glow || GLOWS[0] : GLOWS[Math.floor(r() * GLOWS.length)],
    stripes: r() < .6, windows: r() < .7,
  };
}

// add(geometry, matrix, colour, glowing): the caller's merger. scale: metres per unit.
//
// Every hull is put together from one small kit, so the fleets share a hand: hulls turned
// on a lathe from a profile (lathe), flat plates cut to shape for wings, fins and sails
// (slab, flat, upright), tapering struts between two points (tube), engine bells with a
// lit throat (engineU under a standing ship, engineL behind a level one), rows of lit
// ports, and legs with foot pads. Ships stand on the ground at y = 0.
export function buildShip(THREE, d, add, base = new THREE.Matrix4(), scale = 1) {
  const q = new THREE.Quaternion(), e = new THREE.Euler(), V = (x, y, z) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0);
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => base.clone().multiply(new THREE.Matrix4().compose(V(x * scale, y * scale, z * scale), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(sx * scale, sy * scale, sz * scale)));
  const I = L(), PI = Math.PI, TAU = PI * 2;
  const tone = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  const len = d.length, rad = len * d.girth, H = d.hullColour, T = d.trim, S = d.second, G = d.glow;
  const H2 = tone(H, '#1a1612', .28), D = tone(S, '#14171a', .62), W = '#16242c'; // shaded hull, dark metal, glass
  const put = (g, colour, glow = false) => add(g, I, colour, glow);
  // The kit (all in the ship's own units).
  const lathe = (pts, seg = 14, a0 = 0, a1 = TAU) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(.001, r), y)), seg, a0, a1);
  const level = (g) => g.rotateX(PI / 2); // a shape built up +Y laid nose-forward along +Z
  const ball = (r, det = 1) => new THREE.IcosahedronGeometry(r, det);
  const tube = (a, b, r0, r1 = r0, seg = 6) => {
    const A = V(...a), B = V(...b), dir = B.clone().sub(A), h = dir.length();
    const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
    return g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  };
  const slab = (pts, t) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2); // in the XY plane
  const flat = (pts, t) => slab(pts, t).rotateX(PI / 2);     // lying flat: points are (x, z)
  const upright = (pts, t) => slab(pts, t).rotateY(-PI / 2); // standing fore and aft: points are (z, y)
  const bell = (r, h) => lathe([[0, 0], [r, 0], [r * .62, h * .5], [r * .46, h], [0, h]], 10);
  const engineU = (x, y, z, r) => { const h = r * 1.5; put(bell(r, h).translate(x, y - h, z), D); put(new THREE.CircleGeometry(r * .8, 10).rotateX(PI / 2).translate(x, y - h - .01 * len, z), G, true); };
  const engineL = (x, y, z, r) => { const h = r * 1.6; put(level(bell(r, h)).translate(x, y, z - h), D); put(new THREE.CircleGeometry(r * .8, 10).rotateY(PI).translate(x, y, z - h - .01 * len), G, true); };
  const enginesU = (y, n, r, spread) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; engineU(n > 1 ? Math.cos(a) * spread : 0, y, n > 1 ? Math.sin(a) * spread : 0, r); } };
  const enginesL = (y, z, n, r, gap) => { for (let i = 0; i < n; i++) engineL((i - (n - 1) / 2) * gap, y, z, r); };
  const ports = (r, y, n, s, a0 = 0) => { for (let i = 0; i < n; i++) put(new THREE.BoxGeometry(s * .25, s, s * .7).translate(r, y, 0).rotateY(a0 + i / n * TAU), G, true); };
  const leg = (from, to, r, pad = r * 3) => { put(tube(from, to, r, r * .7), D); put(new THREE.CylinderGeometry(pad, pad * 1.15, len * .012, 8).translate(to[0], len * .006, to[2]), D); };
  const around = (n, f, a0 = 0) => { for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; f(Math.cos(a), Math.sin(a), a, i); } };
  const mirror = (f) => { f(1); f(-1); };
  const torus = (r, t, seg = 16, sides = 5) => new THREE.TorusGeometry(r, t, sides, seg).rotateX(PI / 2); // a hoop lying flat
  switch (d.hull) {
    case 'needle': { // a staged rocket standing on its fins
      const n = d.segments, h0 = len * .12, hs = len * .62 / n, nose = len * .3, pts = [[0, h0]];
      let y = h0, w = rad;
      for (let s = 0; s < n; s++) { pts.push([w, y], [w, y + hs * .9]); y += hs; if (s < n - 1) { w *= .82; pts.push([w, y]); put(torus(w * 1.12, w * .09, 14).translate(0, y - hs * .05, 0), T); } }
      pts.push([w * .93, y + nose * .3], [w * .7, y + nose * .6], [w * .36, y + nose * .86], [0, y + nose]);
      put(lathe(pts), H);
      if (d.stripes) { put(lathe([[w * .72, y + nose * .6], [w * .37, y + nose * .86], [0, y + nose * 1.01]], 14), T); put(new THREE.CylinderGeometry(rad * 1.02, rad * 1.02, hs * .12, 14).translate(0, h0 + hs * .45, 0), T); }
      if (d.windows) ports(w * 1.0, y - hs * .25, 6, w * .28);
      const nf = Math.max(3, d.fins);
      around(nf, (c, s, a) => put(slab([[rad * .96, h0 + len * .03], [rad * 2.1, 0], [rad * 2.3, len * .1], [rad * .96, h0 + len * .3]], rad * .12).rotateY(-a), T));
      enginesU(h0, d.engines, rad * (d.engines > 1 ? .3 : .5), rad * .5);
      break;
    }
    case 'lander': { // a capsule on three jointed legs
      const h = len * .4, r = rad;
      put(lathe([[0, h], [r * 1.1, h + r * .1], [r * 1.45, h + r * .55], [r * 1.3, h + r * 1.1], [r * .75, h + r * 1.9], [r * .3, h + r * 2.3], [0, h + r * 2.36]], 12), H);
      put(lathe([[0, h - r * .12], [r * 1.16, h - r * .02], [r * 1.5, h + r * .52], [0, h + r * .52]], 12), D); // the heat shield
      put(torus(r * 1.47, r * .1).translate(0, h + r * .6, 0), T);
      if (d.windows) ports(r * 1.3, h + r * 1.05, 6, r * .3, .5);
      around(3, (c, s) => { const knee = [c * r * 2.3, h * .8, s * r * 2.3]; put(tube([c * r * 1.3, h + r * .4, s * r * 1.3], knee, r * .1), S); put(tube([c * r * 1.1, h, s * r * 1.1], knee, r * .06), S); leg(knee, [c * r * 2.7, 0, s * r * 2.7], r * .1); });
      put(tube([0, h + r * 2.3, 0], [0, h + r * 3.3, 0], r * .04, r * .02, 4), S); put(ball(r * .12).translate(0, h + r * 3.3, 0), G, true);
      enginesU(h - r * .1, d.engines, r * (d.engines > 1 ? .34 : .6), r * .55);
      break;
    }
    case 'seed': { // grown: a ribbed seed standing on its own sepals, a root bulb alight beneath
      const y0 = len * .1, prof = [[0, y0], [rad * .7, y0 + len * .08], [rad * 1.2, y0 + len * .3], [rad * 1.15, y0 + len * .5], [rad * .7, y0 + len * .75], [rad * .22, y0 + len * .92], [0, y0 + len * .97]];
      put(lathe(prof, 10), H);
      around(5, (c, s, a) => { put(lathe(prof.map(([r, y]) => [r * 1.035 + rad * .02, y]), 1, a - .09, .18), T); put(tube([c * rad * .6, y0 + len * .08, s * rad * .6], [c * rad * 1.7, 0, s * rad * 1.7], rad * .2, rad * .06), S); });
      put(ball(rad * .5).scale(1, .6, 1).translate(0, y0, 0), G, true);
      around(4, (c, s) => { const m = [c * rad * .35, y0 + len * 1.06, s * rad * .35]; put(tube([c * rad * .12, y0 + len * .93, s * rad * .12], m, rad * .07, rad * .05, 4), S); put(tube(m, [c * rad * .95, y0 + len * 1.12, s * rad * .95], rad * .05, rad * .015, 4), S); }, .4);
      break;
    }
    case 'spiral': { // a coiled shell standing on its lip
      let y = rad * .75, rr = rad * 1.25;
      put(lathe([[0, 0], [rad * 1.95, 0], [rad * 1.6, rad * .5], [0, rad * .5]], 14), S);
      put(torus(rad * 1.3, rad * .09).translate(0, rad * .5, 0), G, true);
      for (let i = 0; i < 7 + d.segments; i++) {
        const cx = Math.cos(i * .9) * rr * .12, cz = Math.sin(i * .9) * rr * .12;
        put(torus(rr, rr * .42, 16, 7).translate(cx, y, cz), i % 2 ? H : H2);
        const a = i * 1.3; put(tube([cx + Math.cos(a) * rr * 1.3, y, cz + Math.sin(a) * rr * 1.3], [cx + Math.cos(a) * rr * 1.95, y + rr * .3, cz + Math.sin(a) * rr * 1.95], rr * .14, rr * .02, 4), T);
        y += rr * .6; rr *= .84;
      }
      put(lathe([[0, y - rr * .3], [rr * .95, y - rr * .3], [0, y + len * .14]], 10), T);
      break;
    }
    case 'bore': { // a ridged cylinder with a drill for a nose
      const b = len * .1;
      put(lathe([[0, b], [rad * .8, b], [rad, b + len * .06], [rad, len * .62], [rad * .9, len * .66], [0, len * .66]], 12), H);
      for (let i = 0; i < 5; i++) put(torus(rad * 1.03, rad * .08, 14, 4).rotateZ(.12).translate(0, len * (.2 + i * .09), 0), T);
      put(lathe([[0, len * .66], [rad * .88, len * .66], [0, len * 1.1]], 10), S);
      for (let i = 0; i < 7; i++) put(torus(rad * .88 * (1 - (.015 + i * .056) / .44) + rad * .04, rad * .08, 12, 4).rotateZ(.28).rotateY(i * .9).translate(0, len * (.675 + i * .056), 0), T);
      around(3, (c, s, a) => { put(new THREE.BoxGeometry(rad * .3, len * .36, rad * .55).translate(rad * 1.06, len * .38, 0).rotateY(-a), D); leg([c * rad * .9, len * .2, s * rad * .9], [c * rad * 1.9, 0, s * rad * 1.9], rad * .1); }, .5);
      if (d.windows) ports(rad * 1.0, len * .585, 6, rad * .24);
      enginesU(b, d.engines, rad * (d.engines > 1 ? .28 : .5), rad * .45);
      break;
    }
    case 'spindle': { // a mast of knots under three silk sails
      put(tube([0, len * .12, 0], [0, len * 1.1, 0], rad * .22, rad * .08), S);
      for (let s = 0; s < 4; s++) put(new THREE.OctahedronGeometry(rad * (1.1 - Math.abs(s - 1.5) * .22)).scale(1, 1.3, 1).rotateY(s * .5).translate(0, len * (.2 + s * .22), 0), s % 2 ? H2 : H);
      around(3, (c, s, a) => {
        put(slab([[rad * .5, len * .2], [len * .42, len * .32], [rad * .35, len * 1.0]], rad * .05).rotateY(-a), T);
        put(tube([c * rad * .5, len * .2, s * rad * .5], [c * len * .43, len * .32, s * len * .43], rad * .06, rad * .04, 4), S);
        leg([c * rad * .2, len * .16, s * rad * .2], [c * rad * 1.8, 0, s * rad * 1.8], rad * .08);
      });
      put(ball(rad * .22).translate(0, len * 1.1, 0), G, true); put(ball(rad * .4).translate(0, len * .1, 0), G, true);
      break;
    }
    case 'eggsac': { // a clutch of eggs bound in thread, on a stalk
      put(tube([0, 0, 0], [0, len * .3, 0], rad * .5, rad * .25, 7), S);
      around(3, (c, s) => leg([c * rad * .3, len * .12, s * rad * .3], [c * rad * 1.6, 0, s * rad * 1.6], rad * .08));
      for (let i = 0; i < 6; i++) {
        const r = rad * (1.15 - i * .09), x = Math.cos(i * 2.4) * rad * .75, z = Math.sin(i * 2.4) * rad * .75, y = len * (.32 + i * .12);
        put(ball(r, 2).translate(x, y, z), i % 2 ? H : H2);
        if (i % 2 === 0) put(ball(r * .34).translate(x * 1.9, y + r * .15, z * 1.9), G, true);
      }
      for (let i = 0; i < 3; i++) put(torus(rad * 1.75, rad * .045, 20, 4).rotateZ(.5 - i * .5).rotateY(i * 2.1).translate(0, len * (.45 + i * .16), 0), T);
      break;
    }
    case 'lifter': { // a winged body with twin tails, flies level
      const cy = rad * 1.15;
      put(level(lathe([[0, -len * .5], [rad * .55, -len * .46], [rad * .9, -len * .3], [rad, 0], [rad * .85, len * .25], [rad * .45, len * .42], [0, len * .5]], 12)).scale(1, .8, 1).translate(0, cy, 0), H);
      put(level(lathe([[0, len * .4], [rad * .53, len * .4], [0, len * .515]], 12)).scale(1, .8, 1).translate(0, cy, 0), T);
      put(ball(rad * .5, 2).scale(1, .6, 1.8).translate(0, cy + rad * .52, len * .2), W);
      if (d.windows) mirror((sx) => { for (let k = 0; k < 4; k++) put(new THREE.BoxGeometry(rad * .06, rad * .16, len * .04).translate(sx * rad * .97, cy + rad * .12, len * (.08 - k * .08)), G, true); });
      mirror((sx) => {
        put(flat([[sx * rad * .7, len * .1], [sx * len * .5, -len * .2], [sx * len * .5, -len * .32], [sx * rad * .7, -len * .3]], rad * .14).translate(0, cy - rad * .25, 0), S);
        put(upright([[-len * .32, 0], [-len * .2, 0], [-len * .28, len * .1], [-len * .34, len * .1]], rad * .08).translate(sx * len * .49, cy - rad * .25, 0), T);
        put(upright([[-len * .5, 0], [-len * .3, 0], [-len * .43, len * .2], [-len * .53, len * .2]], rad * .1).rotateZ(-sx * .3).translate(sx * rad * .4, cy + rad * .45, 0), T);
        leg([sx * rad * .7, cy - rad * .5, -len * .2], [sx * rad * 1.1, 0, -len * .22], rad * .08);
      });
      leg([0, cy - rad * .6, len * .25], [0, 0, len * .28], rad * .08);
      enginesL(cy, -len * .44, Math.max(2, d.engines), rad * .3, rad * .72);
      break;
    }
    case 'saucer': { // a lens with a glass crown and a lit rim
      const cy = len * .14;
      put(lathe([[0, cy - len * .05], [len * .3, cy - len * .04], [len * .5, cy + len * .01], [len * .3, cy + len * .07], [len * .15, cy + len * .09], [0, cy + len * .09]], 20), H);
      put(torus(len * .32, len * .014, 24).translate(0, cy - len * .038, 0), T);
      put(lathe([[0, cy - len * .085], [len * .13, cy - len * .046], [0, cy - len * .046]], 14), G, true);
      put(lathe([[len * .16, cy + len * .085], [len * .14, cy + len * .14], [len * .07, cy + len * .19], [0, cy + len * .2]], 14), W);
      put(torus(len * .165, len * .014, 20).translate(0, cy + len * .088, 0), T);
      ports(len * .487, cy + len * .012, d.windows ? 12 : 6, len * .03);
      around(3, (c, s) => leg([c * len * .2, cy - len * .04, s * len * .2], [c * len * .3, 0, s * len * .3], len * .012), .3);
      break;
    }
    case 'bladder': case 'lantern': { // a gas-bag above a gondola
      if (d.hull === 'bladder') {
        put(level(lathe([[0, -len * .48], [len * .12, -len * .44], [len * .24, -len * .25], [len * .27, 0], [len * .22, len * .25], [len * .1, len * .42], [0, len * .47]], 10)).scale(1, .8, 1).translate(0, len * .62, 0), H);
        for (const [z, r] of [[-len * .25, len * .243], [0, len * .273], [len * .25, len * .223]]) put(new THREE.TorusGeometry(r, len * .012, 4, 16).scale(1, .8, 1).translate(0, len * .62, z), T);
        put(upright([[-len * .5, 0], [-len * .3, 0], [-len * .38, len * .15], [-len * .52, len * .17]], len * .012).translate(0, len * .68, 0), S);
        mirror((sx) => put(flat([[sx * len * .05, -len * .3], [sx * len * .05, -len * .5], [sx * len * .2, -len * .52], [sx * len * .17, -len * .38]], len * .012).translate(0, len * .62, 0), S));
      } else {
        const r = len * .24, y0 = len * .34, seg = len * .1, pts = [[0, y0]];
        for (let k = 0; k < 5; k++) { pts.push([r * .84, y0 + k * seg], [r, y0 + (k + .5) * seg]); if (k) put(torus(r * .86, len * .008, 14, 4).translate(0, y0 + k * seg, 0), G, true); }
        pts.push([r * .84, y0 + 5 * seg], [0, y0 + 5 * seg]);
        put(lathe(pts, 10), H);
        put(lathe([[0, y0 + 5 * seg], [r * .6, y0 + 5 * seg], [0, y0 + 5 * seg + len * .1]], 10), T); put(new THREE.CylinderGeometry(r * .6, r * .5, len * .03, 10).translate(0, y0 - len * .015, 0), T);
      }
      put(level(lathe([[0, -len * .2], [len * .07, -len * .17], [len * .085, 0], [len * .07, len * .15], [0, len * .22]], 8)).scale(1, .75, 1).translate(0, len * .13, 0), T);
      if (d.windows) mirror((sx) => put(new THREE.BoxGeometry(len * .01, len * .025, len * .24).translate(sx * len * .083, len * .145, 0), G, true));
      mirror((sx) => {
        for (const z of [-len * .12, 0, len * .12]) put(tube([sx * len * .06, len * .18, z], [sx * len * .15, len * .44, z * 1.6], len * .005, len * .005, 4), S);
        put(tube([sx * len * .07, len * .12, -len * .05], [sx * len * .2, len * .12, -len * .05], len * .008, len * .008, 4), S);
        put(level(lathe([[0, -len * .05], [len * .028, -len * .03], [len * .028, len * .03], [0, len * .05]], 8)).translate(sx * len * .2, len * .12, -len * .05), S);
        put(new THREE.CircleGeometry(len * .05, 10).rotateY(PI).translate(sx * len * .2, len * .12, -len * .102), G, true);
        put(tube([sx * len * .05, len * .012, -len * .15], [sx * len * .05, len * .012, len * .16], len * .01, len * .01, 4), D);
        for (const z of [-len * .1, len * .1]) put(tube([sx * len * .05, len * .08, z], [sx * len * .05, len * .012, z], len * .006, len * .006, 4), D);
      });
      put(ball(len * .03).translate(0, d.hull === 'bladder' ? len * .85 : len * .96, 0), G, true);
      break;
    }
    case 'comb': { // a bundle of six-sided cells
      const cy = rad * 2.35;
      for (let ring = 0; ring < 2; ring++) for (let i = 0; i < (ring ? 6 : 1); i++) {
        const a = i * PI / 3, dd = ring * rad * 1.42, h = len * (ring ? .5 + .12 * (i % 3) : .92), x = Math.cos(a) * dd, y = cy + Math.sin(a) * dd;
        put(new THREE.CylinderGeometry(rad * .8, rad * .8, h, 6).rotateX(PI / 2).rotateZ(PI / 6).translate(x, y, 0), ring ? (i % 2 ? H : H2) : T);
        put(new THREE.CircleGeometry(rad * .6, 6).rotateZ(PI / 6).translate(x, y, h / 2 + .005 * len), ring ? W : G, !ring);
        put(new THREE.CircleGeometry(rad * .5, 6).rotateZ(PI / 6).rotateY(PI).translate(x, y, -h / 2 - .005 * len), G, true);
      }
      mirror((sx) => { for (const z of [-len * .16, len * .16]) leg([sx * rad * 1.1, cy - rad * 1.6, z], [sx * rad * 1.9, 0, z * 1.3], rad * .1); });
      break;
    }
    case 'beetle': { // a carapace: head, thorax and wing cases over a lit seam
      const cy = rad * 1.25, zb = -len * .12;
      put(ball(rad * 1.15, 2).scale(1.1, .72, 1.55).translate(0, cy, zb), H2);
      mirror((sx) => {
        put(ball(rad, 2).scale(.74, .62, 1.7).rotateY(sx * .1).translate(sx * rad * .5, cy + rad * .34, zb), T);
        put(ball(rad * .16).translate(sx * rad * .36, cy + rad * .16, len * .44), G, true);
        put(tube([sx * rad * .3, cy - rad * .1, len * .42], [sx * rad * .1, cy - rad * .18, len * .56], rad * .1, rad * .03, 4), D);
        for (const [z, k] of [[len * .22, .2], [0, 0], [-len * .24, -.25]]) { const knee = [sx * rad * 1.9, cy + rad * .25, z]; put(tube([sx * rad * .9, cy - rad * .25, z], knee, rad * .09, rad * .07, 5), D); leg(knee, [sx * rad * 2.3, 0, z + k * rad], rad * .07, rad * .16); }
      });
      put(new THREE.BoxGeometry(rad * .1, rad * .1, rad * 2.6).translate(0, cy + rad * .93, zb), G, true);
      put(ball(rad * .95, 2).scale(1, .7, .9).translate(0, cy, len * .2), S);
      put(ball(rad * .6, 1).scale(1, .7, 1).translate(0, cy - rad * .05, len * .38), H);
      enginesL(cy - rad * .1, zb - rad * 1.55, Math.max(2, d.engines), rad * .26, rad * .6);
      break;
    }
    case 'delta': { // a flier's swept wing
      const cy = rad * .9;
      put(flat([[0, len * .5], [len * .5, -len * .38], [len * .42, -len * .46], [0, -len * .36], [-len * .42, -len * .46], [-len * .5, -len * .38]], rad * .22).translate(0, cy, 0), H);
      put(level(lathe([[0, -len * .42], [rad * .5, -len * .38], [rad * .62, -len * .1], [rad * .5, len * .2], [rad * .2, len * .42], [0, len * .52]], 10)).scale(1, .85, 1).translate(0, cy + rad * .25, 0), S);
      put(ball(rad * .36, 2).scale(.8, .6, 2).translate(0, cy + rad * .72, len * .14), W);
      if (d.windows) put(new THREE.BoxGeometry(rad * .3, rad * .05, len * .1).translate(0, cy + rad * .95, len * .14), G, true);
      if (d.stripes) put(flat([[0, len * .2], [len * .3, -len * .34], [len * .22, -len * .36], [0, -len * .05], [-len * .22, -len * .36], [-len * .3, -len * .34]], rad * .06).translate(0, cy + rad * .13, 0), T);
      mirror((sx) => {
        put(upright([[-len * .44, 0], [-len * .2, 0], [-len * .36, len * .16], [-len * .47, len * .16]], rad * .1).rotateZ(-sx * .25).translate(sx * len * .16, cy + rad * .1, 0), T);
        put(upright([[-len * .46, 0], [-len * .3, 0], [-len * .4, -len * .07], [-len * .47, -len * .07]], rad * .08).translate(sx * len * .45, cy, 0), T);
        leg([sx * len * .2, cy, -len * .25], [sx * len * .22, 0, -len * .25], rad * .07);
      });
      leg([0, cy, len * .25], [0, 0, len * .27], rad * .07);
      enginesL(cy + rad * .2, -len * .38, Math.max(2, d.engines), rad * .28, rad * .7);
      break;
    }
    case 'feather': { // a slim body, vaned like a bird
      const cy = rad * 1.3, w = len * .035;
      const vane = (l) => flat([[-w, 0], [w, 0], [w * .3, -l], [-w * .3, -l]], rad * .07);
      put(level(lathe([[0, -len * .2], [rad * .45, -len * .12], [rad * .7, len * .1], [rad * .45, len * .36], [0, len * .5]], 10)).translate(0, cy, 0), H);
      put(ball(rad * .32, 1).scale(.9, .6, 1.8).translate(0, cy + rad * .45, len * .2), W);
      const nt = 5 + d.fins;
      for (let i = 0; i < nt; i++) { const a = (i / (nt - 1) - .5) * 1.5; put(vane(len * (.5 - Math.abs(a) * .12)).rotateX(-Math.abs(a) * .25).rotateY(a).translate(0, cy, -len * .1), i % 2 ? T : S); }
      mirror((sx) => {
        for (let k = 0; k < 4; k++) put(vane(len * (.44 - k * .05)).rotateY(-sx * (1.3 - k * .26)).translate(sx * rad * .45, cy + rad * .1 - k * rad * .05, len * (.08 - k * .05)), k % 2 ? T : H2);
        leg([sx * rad * .4, cy - rad * .4, len * .1], [sx * rad * .9, 0, len * .12], rad * .06);
      });
      leg([0, cy - rad * .3, -len * .13], [0, 0, -len * .2], rad * .06);
      put(ball(rad * .12).translate(0, cy, len * .5), G, true);
      engineL(0, cy, -len * .16, rad * .34);
      break;
    }
    case 'ring': { // a ring round a hub
      const cy = len * .16;
      put(torus(len * .42, len * .065, 28, 8).translate(0, cy, 0), H);
      put(lathe([[0, cy - len * .1], [len * .09, cy - len * .08], [len * .12, cy], [len * .09, cy + len * .1], [0, cy + len * .12]], 12), S);
      put(lathe([[len * .07, cy + len * .11], [len * .05, cy + len * .15], [0, cy + len * .165]], 10), W);
      around(4, (c, s) => put(tube([c * len * .1, cy, s * len * .1], [c * len * .37, cy, s * len * .37], len * .016, len * .016, 5), T));
      ports(len * .487, cy, d.windows ? 14 : 7, len * .03);
      put(torus(len * .42, len * .012, 28, 4).translate(0, cy + len * .066, 0), G, true);
      around(3, (c, s) => leg([c * len * .42, cy - len * .06, s * len * .42], [c * len * .47, 0, s * len * .47], len * .012), .5);
      enginesU(cy - len * .09, d.engines, len * (d.engines > 1 ? .03 : .06), len * .05);
      break;
    }
    case 'barrow': { // a long vaulted hull, like a hall that flies
      const cy = rad * .55, L2 = len * .8;
      put(new THREE.CylinderGeometry(rad, rad, L2, 12, 1, false, -PI / 2, PI).rotateX(-PI / 2).translate(0, cy, 0), H);
      put(new THREE.ConeGeometry(rad, len * .22, 12, 1, false, PI / 2, PI).rotateX(PI / 2).translate(0, cy, L2 / 2 + len * .11), H2);
      put(flat([[-rad * 1.06, -L2 / 2 - len * .02], [rad * 1.06, -L2 / 2 - len * .02], [rad * 1.06, L2 / 2], [0, L2 / 2 + len * .24], [-rad * 1.06, L2 / 2]], rad * .2).translate(0, cy - rad * .08, 0), S);
      for (let i = 0; i < 5; i++) put(new THREE.TorusGeometry(rad * 1.03, rad * .07, 4, 12, PI).translate(0, cy, (i / 4 - .5) * L2 * .92), T);
      mirror((sx) => {
        if (d.windows) for (let k = 0; k < 5; k++) put(new THREE.BoxGeometry(rad * .06, rad * .22, len * .06).translate(sx * rad * .92, cy + rad * .42, (k / 4 - .5) * L2 * .7 + L2 * .06), G, true);
        put(tube([sx * rad * .8, len * .012, -L2 * .4], [sx * rad * .8, len * .012, L2 * .4], rad * .07, rad * .07, 4), D);
        for (const z of [-L2 * .3, L2 * .3]) put(tube([sx * rad * .8, cy - rad * .1, z], [sx * rad * .8, len * .012, z], rad * .05, rad * .05, 4), D);
      });
      enginesL(cy + rad * .42, -L2 / 2 + len * .02, Math.max(2, d.engines), rad * .3, rad * .68);
      break;
    }
    case 'wheel': { // a wheel on edge, held up by outriggers
      const cy = len * .5;
      put(new THREE.TorusGeometry(len * .38, len * .1, 8, 24).translate(0, cy, 0), H);
      for (let i = 0; i < 12; i++) put(new THREE.BoxGeometry(len * .07, len * .025, len * .2).translate(0, len * .487, 0).rotateZ(i / 12 * TAU).translate(0, cy, 0), i % 2 ? T : H2);
      put(new THREE.CylinderGeometry(len * .12, len * .12, len * .3, 12).rotateX(PI / 2).translate(0, cy, 0), S);
      for (let i = 0; i < 6; i++) put(tube([0, 0, 0], [0, len * .3, 0], len * .018, len * .014, 4).rotateZ(i / 6 * TAU).translate(0, cy, 0), T);
      for (const sz of [-1, 1]) {
        const cap = new THREE.CircleGeometry(len * .09, 12); if (sz < 0) cap.rotateY(PI);
        put(cap.translate(0, cy, sz * len * .152), G, true);
        mirror((sx) => leg([0, cy - len * .08, sz * len * .15], [sx * len * .12, 0, sz * len * .34], len * .014));
      }
      break;
    }
  }
}

// How each hull is described, for civilization descriptions.
export const HULL_WORDS = {
  needle: 'slender staged rockets', lifter: 'winged lifters', saucer: 'flat saucers ringed with light', seed: 'grown seed-ships', spiral: 'coiled shell-ships',
  lander: 'pods on three long legs', bladder: 'gas-bag ships', lantern: 'lantern-like gas-ships', comb: 'honeycomb ships', beetle: 'carapaced beetle-ships',
  spindle: 'spindles under silk sails', eggsac: 'clustered egg-sac ships', bore: 'drill-nosed bores', delta: 'swept delta wings', feather: 'feathered ships',
  ring: 'ring ships', barrow: 'vaulted hull-ships', wheel: 'wheel ships',
};

// How tall and wide a design stands (metres per unit of scale), for pads and spacing.
export const shipSize = (d) => ({ height: d.stands ? d.length * 1.15 : d.length * .4, radius: d.stands ? d.length * d.girth * 1.6 : d.length * .55 });
