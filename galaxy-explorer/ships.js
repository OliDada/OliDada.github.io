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
    hullColour: civ.material === 'shell' ? '#efe3d0' : civ.material === 'wax' ? '#d9a441' : civ.material === 'silk' ? '#f1efe8' : civ.material === 'grown' || civ.material === 'living' ? sp.base || '#9a6a50' : r() < .55 ? '#e3e6e8' : sp.belly || '#c9c2b5',
    trim: sp.accent || '#c0503a', second: sp.base || '#556677',
    glow: civ.species.glow ? sp.glow || GLOWS[0] : GLOWS[Math.floor(r() * GLOWS.length)],
    stripes: r() < .6, windows: r() < .7,
  };
}

// add(geometry, matrix, colour, glowing): the caller's merger. scale: metres per unit.
export function buildShip(THREE, d, add, base = new THREE.Matrix4(), scale = 1) {
  const q = new THREE.Quaternion(), e = new THREE.Euler(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => base.clone().multiply(new THREE.Matrix4().compose(V(x * scale, y * scale, z * scale), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(sx * scale, sy * scale, sz * scale)));
  const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0);
  const cone = (rad, h, seg = 12) => new THREE.ConeGeometry(rad, h, seg, 1).translate(0, h / 2, 0);
  const ball = (rad, det = 1) => new THREE.IcosahedronGeometry(rad, det);
  const len = d.length, rad = len * d.girth, H = d.hullColour, T = d.trim, S = d.second, G = d.glow;
  // Upright hulls are built along +Y; level hulls along +Z (nose forward).
  const engineRing = (y, rr, n, upright = true) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, x = n > 1 ? Math.cos(a) * rr : 0, z = n > 1 ? Math.sin(a) * rr : 0;
      if (upright) { add(cone(rad * .32, rad * .7, 10).rotateX(Math.PI).translate(0, rad * .7, 0), L(x, y - rad * .7, z), S); add(new THREE.CircleGeometry(rad * .26, 10).rotateX(Math.PI / 2), L(x, y - rad * .72, z), G, true); }
      else { add(cyl(rad * .28, rad * .34, rad * .8, 10).rotateX(-Math.PI / 2), L(x, z, -len / 2), S); add(new THREE.CircleGeometry(rad * .24, 10).rotateY(Math.PI), L(x, z, -len / 2 - rad * .8), G, true); }
    }
  };
  const fins = (y, rr, h, n, upright = true) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const g = new THREE.BoxGeometry(rad * .08, h, rad * 1.3).translate(0, h / 2, rr + rad * .55); add(upright ? g : g.rotateX(-Math.PI / 2), upright ? L(0, y, 0, 0, a, 0) : L(0, 0, -len / 2 + h, 0, 0, a), T); } };
  switch (d.hull) {
    case 'needle': { // a classic staged rocket
      let y = 0;
      for (let s = 0; s < d.segments; s++) { const h = len * (.55 - s * .12) / Math.max(1, d.segments * .6), w = rad * (1 - s * .18); add(cyl(w * .96, w, h), L(0, y, 0), H); if (d.stripes) add(cyl(w * 1.01, w * 1.01, h * .08), L(0, y + h * .8, 0), T); y += h; }
      add(cone(rad * (1 - (d.segments - 1) * .18), len * .22), L(0, y, 0), d.stripes ? T : H);
      if (d.windows) for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(rad * .25, rad * .25, .05), L(Math.cos(i * 1.57) * rad * .82, y * .82, Math.sin(i * 1.57) * rad * .82, 0, -i * 1.57 + Math.PI / 2), G, true);
      fins(0, rad, len * .2, Math.max(3, d.fins)); engineRing(0, rad * .45, d.engines);
      break;
    }
    case 'lifter': { // a winged body with a high tail, flies level
      add(ball(rad, 2), L(0, 0, 0, 0, 0, 0, 1, .7, len / rad / 2), H);
      add(cone(rad * .7, len * .25, 12).rotateX(Math.PI / 2), L(0, 0, len * .48), T);
      add(new THREE.BoxGeometry(len * .9, rad * .12, len * .3), L(0, -rad * .2, -len * .05, 0, 0, 0), S);
      add(new THREE.BoxGeometry(rad * .1, len * .22, len * .18), L(0, len * .1, -len * .38), T);
      if (d.windows) add(new THREE.BoxGeometry(rad * .9, rad * .25, rad * .5), L(0, rad * .5, len * .3), G, true);
      engineRing(0, rad * .55, Math.max(2, d.engines), false);
      break;
    }
    case 'saucer': {
      add(new THREE.SphereGeometry(len * .5, 24, 8).scale(1, .16, 1), L(0, len * .1, 0), H);
      add(new THREE.SphereGeometry(len * .17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), L(0, len * .16, 0), T);
      add(new THREE.TorusGeometry(len * .47, len * .02, 4, 32).rotateX(Math.PI / 2), L(0, len * .1, 0), G, true);
      for (let i = 0; i < 3; i++) { const a = i * 2.09; add(cyl(len * .015, len * .02, len * .12, 5), L(Math.cos(a) * len * .25, 0, Math.sin(a) * len * .25), S); }
      break;
    }
    case 'seed': { // grown: an ovoid seed with ribs and a tendril crown
      add(ball(rad * 1.2, 2), L(0, len * .45, 0, 0, 0, 0, 1, len / rad / 2.4, 1), H);
      for (let i = 0; i < 6; i++) add(new THREE.TorusGeometry(rad * 1.18, rad * .07, 4, 18, Math.PI), L(0, len * .45, 0, Math.PI / 2, i * Math.PI / 6, 0, 1, len / rad / 2.4, 1), T);
      for (let i = 0; i < 5; i++) { const a = i * 1.26; add(cone(rad * .12, len * .25, 5), L(Math.cos(a) * rad * .5, len * .88, Math.sin(a) * rad * .5, Math.sin(a) * .5, 0, -Math.cos(a) * .5), S); }
      add(ball(rad * .5, 1), L(0, 0, 0, 0, 0, 0, 1, .5, 1), G, true);
      break;
    }
    case 'spiral': { // a coiled shell standing on its point
      let y = 0, rr = rad * 1.2;
      for (let i = 0; i < 6 + d.segments * 2; i++) { add(new THREE.TorusGeometry(rr, rr * .38, 6, 16).rotateX(Math.PI / 2), L(i * .02 * len, y, 0, 0, i * .5, 0), i % 2 ? H : S); y += rr * .62; rr *= .86; }
      add(cone(rr, len * .12, 12), L(0, y, 0), T); add(ball(rad * .45, 1), L(0, -rad * .2, 0), G, true);
      break;
    }
    case 'lander': { // a pod on three long legs
      const h = len * .45;
      for (let i = 0; i < 3; i++) { const a = i * 2.09; add(cyl(rad * .07, rad * .07, h * 1.1, 5), L(Math.cos(a) * rad * 1.1, 0, Math.sin(a) * rad * 1.1, Math.sin(a) * .35, 0, -Math.cos(a) * .35), S); }
      add(ball(rad * 1.3, 2), L(0, h + rad * .6, 0, 0, 0, 0, 1, .75, 1), H);
      add(new THREE.TorusGeometry(rad * 1.3, rad * .1, 4, 18).rotateX(Math.PI / 2), L(0, h + rad * .6, 0), T);
      add(cone(rad * .8, len * .3), L(0, h + rad * 1.4, 0), H); engineRing(h, rad * .5, d.engines);
      break;
    }
    case 'bladder': case 'lantern': { // a gas-bag above a gondola
      const bag = d.hull === 'bladder' ? new THREE.SphereGeometry(len * .32, 16, 10).scale(1, .7, 1.5) : new THREE.CylinderGeometry(len * .25, len * .28, len * .5, 8, 1);
      add(bag, L(0, len * .55, 0), H);
      for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(len * .01, len * .3, len * .01), L(Math.cos(i * 1.05) * len * .18, len * .24, Math.sin(i * 1.05) * len * .18 * 1.4), S);
      add(new THREE.BoxGeometry(len * .22, len * .12, len * .45), L(0, len * .06, 0), T);
      if (d.windows) add(new THREE.BoxGeometry(len * .23, len * .03, len * .35), L(0, len * .09, 0), G, true);
      add(ball(len * .05, 1), L(0, len * .55 + len * .25, 0), G, true);
      break;
    }
    case 'comb': { // stacked hexagonal cells
      for (let ring = 0; ring < 2; ring++) for (let i = 0; i < (ring ? 6 : 1); i++) {
        const a = i * Math.PI / 3, dd = ring * rad * 1.5, h = len * (ring ? .55 : .8);
        add(cyl(rad * .78, rad * .78, h, 6).rotateX(Math.PI / 2), L(Math.cos(a) * dd, Math.sin(a) * dd + rad * 1.6, 0, 0, 0, Math.PI / 6), ring ? H : T);
        add(new THREE.CircleGeometry(rad * .6, 6).rotateY(Math.PI), L(Math.cos(a) * dd, Math.sin(a) * dd + rad * 1.6, -h / 2 - .02), G, true);
      }
      break;
    }
    case 'beetle': { // a segmented carapace with wing cases
      for (let s = 0; s < 2 + d.segments; s++) add(ball(rad * (1.15 - s * .12), 2), L(0, rad, -s * rad * 1.3, 0, 0, 0, 1.1, .7, 1.1), s % 2 ? H : S);
      for (const x of [-1, 1]) add(new THREE.SphereGeometry(rad * 1.2, 12, 6, 0, Math.PI).scale(.55, .5, 1.4), L(x * rad * .45, rad * 1.25, -rad, 0, x > 0 ? 0 : Math.PI, 0), T);
      engineRing(rad, rad * .6, Math.max(2, d.engines), false);
      break;
    }
    case 'spindle': { // a lattice spindle under silk sails
      add(cyl(rad * .3, rad * .3, len, 6), L(), S);
      for (let s = 0; s < 4; s++) add(new THREE.OctahedronGeometry(rad * (1 - Math.abs(s - 1.5) * .25)).scale(1, 1.4, 1), L(0, len * (.18 + s * .2), 0, 0, s * .4, 0), H);
      for (let i = 0; i < 3; i++) add(new THREE.PlaneGeometry(len * .5, len * .7).translate(len * .3, len * .5, 0), L(0, 0, 0, 0, i * 2.09, 0), T);
      engineRing(0, rad * .4, d.engines);
      break;
    }
    case 'eggsac': {
      for (let i = 0; i < 5; i++) add(ball(rad * (1.2 - i * .1), 1), L(Math.cos(i * 2.4) * rad * .7, len * (.2 + i * .14), Math.sin(i * 2.4) * rad * .7), i % 2 ? H : T);
      add(cyl(rad * .2, rad * .4, len * .25, 6), L(), S); add(ball(rad * .4, 1), L(0, 0, 0), G, true);
      break;
    }
    case 'bore': { // drill-nosed, ridged
      add(cyl(rad, rad, len * .55, 10), L(0, len * .1, 0), H);
      for (let i = 0; i < 6; i++) add(new THREE.TorusGeometry(rad * 1.02, rad * .08, 4, 14).rotateX(Math.PI / 2), L(0, len * (.15 + i * .08), 0, 0, 0, .25), T);
      add(cone(rad, len * .35, 10), L(0, len * .65, 0, 0, .4, 0), S);
      engineRing(len * .1, rad * .5, d.engines);
      break;
    }
    case 'delta': { // a flier's swept delta wing
      add(new THREE.ConeGeometry(len * .5, len, 3).rotateX(Math.PI / 2).scale(1, .12, 1), L(0, rad * .4, 0), H);
      // a raised fuselage, canopy hump, tail fin and drooping wingtips so it reads as a craft, not a plate
      add(ball(rad * .55, 2), L(0, rad * .6, -len * .02, 0, 0, 0, 1, .8, len / rad / 1.5), S);
      add(cone(rad * .5, len * .3, 8).rotateX(Math.PI / 2), L(0, rad * .62, len * .32), T);
      add(ball(rad * .32, 1), L(0, rad * .95, len * .1, 0, 0, 0, 1, .7, 1.8), G, true);
      add(new THREE.BoxGeometry(len * .02, len * .18, len * .22).translate(0, len * .09, 0), L(0, rad * .7, -len * .32, -.35, 0, 0), T);
      for (const sx of [-1, 1]) {
        add(new THREE.BoxGeometry(len * .02, len * .1, len * .16), L(sx * len * .36, rad * .3, -len * .36, 0, 0, sx * .5), T);
        add(cyl(rad * .06, rad * .06, rad * .5, 4), L(sx * len * .16, 0, -len * .1), S);
      }
      add(cyl(rad * .06, rad * .06, rad * .5, 4), L(0, 0, len * .28), S);
      if (d.stripes) add(new THREE.ConeGeometry(len * .3, len * .6, 3).rotateX(Math.PI / 2).scale(1, .13, 1), L(0, rad * .41, -len * .1), T);
      engineRing(rad * .4, len * .15, Math.max(2, d.engines), false);
      break;
    }
    case 'feather': { // a slim body with fanned vanes
      add(ball(rad * .7, 2), L(0, rad, 0, 0, 0, 0, 1, 1, len / rad / 1.6), H);
      for (let i = 0; i < 5 + d.fins; i++) { const a = (i / (4 + d.fins) - .5) * 1.6; add(new THREE.BoxGeometry(len * .04, len * .02, len * .55).translate(0, 0, -len * .28), L(0, rad, -len * .1, 0, a, 0), i % 2 ? T : S); }
      engineRing(rad, rad * .3, 1, false);
      break;
    }
    case 'ring': { // a ring around a central hub
      add(new THREE.TorusGeometry(len * .42, len * .06, 8, 28).rotateX(Math.PI / 2), L(0, len * .1, 0), H);
      add(cyl(len * .1, len * .1, len * .25, 10), L(0, 0, 0), S);
      for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(len * .42, len * .02, len * .03).translate(len * .21, 0, 0), L(0, len * .12, 0, 0, i * Math.PI / 2, 0), T);
      add(new THREE.TorusGeometry(len * .42, len * .015, 4, 28).rotateX(Math.PI / 2), L(0, len * .16, 0), G, true);
      break;
    }
    case 'barrow': { // a long arched hull, like a vaulted hall
      add(new THREE.CylinderGeometry(rad, rad, len, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), L(0, 0, 0), H);
      add(new THREE.BoxGeometry(rad * 2, rad * .15, len), L(0, 0, 0), S);
      for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(rad * 1.02, rad * .06, 4, 12, Math.PI), L(0, 0, (i / 3 - .5) * len * .8), T);
      engineRing(rad * .3, rad * .5, Math.max(2, d.engines), false);
      break;
    }
    case 'wheel': {
      add(new THREE.TorusGeometry(len * .38, len * .1, 8, 24), L(0, len * .48, 0), H);
      add(cyl(len * .12, len * .12, len * .3, 12).rotateX(Math.PI / 2), L(0, len * .48, 0), S);
      for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(len * .03, len * .36, len * .03).translate(0, len * .18, 0), L(0, len * .48, 0, 0, 0, i * Math.PI / 3), T);
      add(new THREE.CircleGeometry(len * .1, 12), L(0, len * .48, len * .151), G, true);
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
