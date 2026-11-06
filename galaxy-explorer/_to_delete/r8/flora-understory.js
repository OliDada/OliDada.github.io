// The smaller plants of the new plant style, grown to the plan their species has
// (understory-plans.mjs): shrubs, succulents, fungi, stalks, bulbs, sheets, filaments,
// chimneys and plumes. Each builder adds parts through flora-mesh.js's helpers, so the
// plants are merged, coloured, leafed (round leafy clumps become leaf cards on leafy
// forms), softened, swayed and simplified for distance like every other plant.
// UNDERSTORY(g) returns false for the 'classic' plan: flora-mesh.js then builds the
// original model. g: { THREE, add, M, cyl, blob, blade, spear, r, H, c, sp, leaf }.
import { planFor } from './understory-plans.mjs';

export function UNDERSTORY(g) {
  const plan = planFor(g.sp), build = plan && BUILD[g.sp.form]?.[plan];
  if (!build) return false;
  build(g, tools(g));
  return true;
}

function tools({ THREE }) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0);
  // A tapering segment from a to b (radii ra at a, rb at b).
  const segM = (a, b) => {
    const d = b.clone().sub(a), len = Math.max(1e-4, d.length());
    return { len, m: new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(UP, d.multiplyScalar(1 / len)), V(1, 1, 1)) };
  };
  const out = (a) => V(Math.cos(a), 0, Math.sin(a));
  // Pushes a geometry's corners in and out a little (lumpy, natural shapes).
  const lumpy = (geo, amt, k = 0) => {
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), j = Math.sin(x * 37.1 + y * 53.7 + z * 21.3 + k * 9.1) * 43758.5; const s = 1 + ((j - Math.floor(j)) - .5) * 2 * amt; P.setXYZ(i, x * s, y * s, z * s); }
    geo.computeVertexNormals(); return geo;
  };
  return { V, UP, segM, out, lumpy };
}

// Adds a curved stem as a chain of segments through pts; returns the last point.
function stem(g, T, pts, r0, r1, color, foliage = false, sides = 4) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], f0 = i / (pts.length - 1), f1 = (i + 1) / (pts.length - 1);
    const { len, m } = T.segM(a, b);
    g.add(g.cyl(r0 + (r1 - r0) * f1, r0 + (r1 - r0) * f0, len * 1.04, sides), m, color, foliage);
  }
  return pts[pts.length - 1];
}
// Points of an arch: from base, rising and bending outward along direction a.
const arch = (T, base, a, rise, reach, droop, n = 5) => {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(base.clone().addScaledVector(T.out(a), reach * t).add(T.V(0, rise * Math.sin(t * Math.PI * (.5 + droop * .5)) * (1 - droop * .3 * t * t), 0))); }
  return pts;
};

const BUILD = {
  shrub: {
    // A fountain of arching stems, each with a leafy clump at its tip and one partway.
    spray(g, T) {
      const { H, r, c, sp, leaf, blob, add, M } = g, k = 7 + Math.floor(r() * 5), L = sp.leafSize;
      for (let i = 0; i < k; i++) {
        const a = i / k * 6.28 + r() * .5, pts = arch(T, T.V(), a, H * (.55 + .4 * r()), H * (.45 + .35 * r()), .3 + .5 * r());
        const tip = stem(g, T, pts, H * .02, H * .008, c.stem, false, 3);
        add(blob(H * .2 * L * (.8 + .4 * r()), 1), M(tip.x, tip.y, tip.z, 0, r() * 6, 0, 1.1, .7, 1.1), leaf(i), true);
        const mid = pts[3]; add(blob(H * .14 * L, 1), M(mid.x, mid.y, mid.z, 0, r() * 6, 0, 1, .75, 1), leaf(i + 1), true);
      }
      add(blob(H * .22 * L, 1), M(0, H * .25, 0, 0, 0, 0, 1.3, .7, 1.3), c.leaf, true);
    },
    // A short trunk with flat leafy tiers, smaller upward.
    tiered(g, T) {
      const { H, r, c, sp, leaf, blob, add, M, cyl } = g, tiers = 3 + Math.floor(r() * 2);
      add(cyl(H * .02, H * .04, H * .95, 5), M(), c.stem, false);
      for (let t = 0; t < tiers; t++) {
        const f = t / tiers, y = H * (.3 + .62 * f), R = H * (.42 - .26 * f) * sp.leafSize, n = 3 + Math.round(3 * (1 - f));
        add(blob(R * .55, 1), M(0, y, 0, 0, r() * 6, 0, 1, .4, 1), leaf(t), true);
        for (let j = 0; j < n; j++) { const a = j / n * 6.28 + t + r() * .4; add(blob(R * (.4 + .1 * r()), 1), M(Math.cos(a) * R * .6, y - R * .05, Math.sin(a) * R * .6, 0, r() * 6, 0, 1, .38, 1), leaf(t + j), true); }
      }
    },
    // Many slender upright switches of different heights, leafy in their upper half.
    thicket(g, T) {
      const { H, r, c, sp, leaf, blob, add, M } = g, k = 9 + Math.floor(r() * 7);
      for (let i = 0; i < k; i++) {
        const a = r() * 6.28, d = H * .12 * r(), h = H * (.55 + .5 * r()), lean = (r() - .5) * .35;
        const base = T.V(Math.cos(a) * d, 0, Math.sin(a) * d), top = base.clone().add(T.V(Math.cos(a) * h * lean, h, Math.sin(a) * h * lean));
        stem(g, T, [base, base.clone().lerp(top, .5).add(T.V((r() - .5) * H * .04, 0, (r() - .5) * H * .04)), top], H * .012, H * .005, c.stem, false, 3);
        for (let j = 0; j < 3; j++) { const p = base.clone().lerp(top, .55 + .2 * j); add(blob(H * (.07 + .03 * r()) * sp.leafSize, 1), M(p.x, p.y, p.z, 0, r() * 6, 0, 1, 1.2, 1), leaf(i + j), true); }
      }
    },
    // A low, wide cushion of leaves, flowering on top.
    cushion(g, T) {
      const { H, r, c, sp, leaf, blob, add, M } = g, W = H * 1.8 * sp.leafSize, k = 6 + Math.floor(r() * 4);
      add(blob(W * .45, 1), M(0, H * .35, 0, 0, r() * 6, 0, 1, .55, 1), c.leaf, true);
      for (let i = 0; i < k; i++) { const a = i / k * 6.28 + r() * .4, d = W * (.35 + .15 * r()); add(blob(W * (.25 + .08 * r()), 1), M(Math.cos(a) * d, H * .25, Math.sin(a) * d, 0, r() * 6, 0, 1, .6, 1), leaf(i), true); }
      const fl = sp.arms > 1 ? 10 : 5;
      for (let i = 0; i < fl; i++) { const a = r() * 6.28, d = W * .45 * Math.sqrt(r()); add(blob(H * .05, 0), M(Math.cos(a) * d, H * (.55 + .1 * r()) - d * .25, Math.sin(a) * d), c.bloom || c.accent, true); }
    },
    // Stems fanning up from one root into tall narrow clumps.
    broom(g, T) {
      const { H, r, c, sp, leaf, blob, add, M } = g, k = 5 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) {
        const a = i / k * 6.28 + r() * .4, tilt = .25 + .25 * r(), h = H * (.75 + .25 * r());
        const top = T.V(Math.cos(a) * Math.sin(tilt) * h, Math.cos(tilt) * h, Math.sin(a) * Math.sin(tilt) * h);
        stem(g, T, [T.V(), top.clone().multiplyScalar(.5), top], H * .022, H * .01, c.stem, false, 4);
        add(blob(H * .16 * sp.leafSize, 1), M(top.x, top.y - H * .1, top.z, 0, r() * 6, 0, .75, 1.5, .75), leaf(i), true);
      }
    },
  },
  succulent: {
    // Thick pointed leaves in a rosette, rising toward the middle, and sometimes a flower spike.
    rosette(g, T) {
      const { H, r, c, sp, leaf, blade, add, M, cyl, blob, THREE } = g, rings = 2 + Math.floor(r() * 2);
      for (let k = 0; k < rings; k++) {
        const n = 7 + k * 2, len = H * (1.1 - .3 * k) * sp.leafSize;
        for (let i = 0; i < n; i++) {
          const a = i / n * 6.28 + k * .4, b = blade(len, len * .24, .05 + r() * .15, .7, 3);
          b.scale(1, 6, 1); // fleshy: thick, not a thin blade
          add(b, M(0, H * .05, 0, 0, a, .8 + k * .3 + r() * .15), i % 2 ? c.leaf2 : c.leaf, true);
        }
      }
      if (r() < .6) { const h = H * (1.6 + r()); add(cyl(H * .02, H * .035, h, 5), M(), c.stem, false); for (let j = 0; j < 7; j++) add(blob(H * .05, 0), M(Math.cos(j * 2.4) * H * .06, h * (.65 + j * .05), Math.sin(j * 2.4) * H * .06), c.bloom || c.accent, true); }
      void THREE;
    },
    // A fat ribbed barrel, spines tufted on top, a ring of flowers.
    barrel(g, T) {
      const { H, r, c, add, M, THREE, blob } = g, R = H * .5, ribs = 14 + Math.floor(r() * 8);
      const geo = new THREE.SphereGeometry(R, ribs * 2, 8), P = geo.attributes.position;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(z, x), k = 1 + .07 * Math.cos(a * ribs); P.setXYZ(i, x * k, y * (y < 0 ? .5 : 1.05), z * k); }
      add(geo, M(0, R * .45, 0), c.leaf, true);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; add(blob(H * .05, 0), M(Math.cos(a) * R * .35, R * 1.45, Math.sin(a) * R * .35), c.bloom || c.accent, true); }
      add(blob(R * .2, 0), M(0, R * 1.48, 0, 0, 0, 0, 1, .5, 1), c.leaf2, true);
    },
    // Chains of flat oval paddles, each growing from the rim of the last.
    paddles(g, T) {
      const { H, r, c, add, M, blob } = g, P = H * .32;
      const grow = (x, y, z, a, tilt, depth) => {
        const cx = x + Math.sin(tilt) * Math.cos(a) * P, cy = y + Math.cos(tilt) * P, cz = z + Math.sin(tilt) * Math.sin(a) * P;
        add(blob(P, 1), M(cx, cy, cz, 0, -a + Math.PI / 2, -tilt, .75, 1, .22), depth % 2 ? c.leaf2 : c.leaf, true);
        if (r() < .5) add(blob(P * .12, 0), M(cx + Math.cos(a) * P * .1, cy + P * .95, cz + Math.sin(a) * P * .1), c.accent, true);
        if (depth >= 3) return;
        const k = depth === 0 ? 2 : 1 + (r() < .5 ? 1 : 0);
        for (let i = 0; i < k; i++) grow(cx + Math.sin(tilt) * Math.cos(a) * P, cy + Math.cos(tilt) * P * .85, cz + Math.sin(tilt) * Math.sin(a) * P, a + (r() - .5) * 1.6, (r() - .5) * 1.1, depth + 1);
      };
      grow(0, -P * .2, 0, r() * 6, 0, 0);
    },
    // Smooth swollen leaf pairs like pebbles, half sunk, each split across the top.
    pebbles(g, T) {
      const { H, r, c, add, M, blob, sp } = g, k = 5 + Math.floor(r() * 8);
      for (let i = 0; i < k; i++) {
        const a = r() * 6.28, d = H * 1.4 * Math.sqrt(r()), s = H * (.35 + .3 * r()) * sp.leafSize, x = Math.cos(a) * d, z = Math.sin(a) * d, ry = r() * 3;
        for (const side of [-1, 1]) add(blob(s * .55, s > H * .5 ? 1 : 0), M(x + Math.cos(ry) * side * s * .28, s * .25, z + Math.sin(ry) * side * s * .28, 0, -ry, 0, .55, .9, 1), side > 0 ? c.leaf : c.leaf2, true);
        if (r() < .3) add(blob(s * .25, 0), M(x, s * .7, z, 0, 0, 0, 1, .5, 1), c.bloom || c.accent, true);
      }
    },
    // A clump of upright tubes (organ pipes), rounded at the tips.
    tubes(g, T) {
      const { H, r, c, add, M, cyl, blob } = g, k = 5 + Math.floor(r() * 7), R = H * .09;
      for (let i = 0; i < k; i++) {
        const a = r() * 6.28, d = H * .18 * Math.sqrt(r()), h = H * (.4 + .6 * r()), rr = R * (.7 + .5 * r()), lean = (r() - .5) * .2;
        add(cyl(rr, rr * 1.1, h, 7), M(Math.cos(a) * d, 0, Math.sin(a) * d, lean, 0, lean), i % 2 ? c.leaf2 : c.leaf, true);
        add(blob(rr, 1), M(Math.cos(a) * d + Math.sin(lean) * h, h * Math.cos(lean), Math.sin(a) * d - Math.sin(lean) * h * .0, 0, 0, 0, 1, .6, 1), i % 2 ? c.leaf2 : c.leaf, true);
        if (r() < .25) add(blob(rr * .5, 0), M(Math.cos(a) * d, h + rr * .6, Math.sin(a) * d), c.bloom || c.accent, true);
      }
    },
  },
  fungus: {
    // Crowded small caps on slender stems, leaning out from one spot.
    cluster(g, T) {
      const { H, r, c, add, M, cyl, blob, sp } = g, k = 8 + Math.floor(r() * 9);
      for (let i = 0; i < k; i++) {
        const a = r() * 6.28, lean = .1 + .5 * r(), h = H * (.4 + .6 * r()), cr = h * (.18 + .1 * r()) * sp.leafSize;
        const top = T.V(Math.cos(a) * Math.sin(lean) * h, Math.cos(lean) * h, Math.sin(a) * Math.sin(lean) * h);
        stem(g, T, [T.V(Math.cos(a) * H * .03, 0, Math.sin(a) * H * .03), top.clone().multiplyScalar(.5).add(T.V(0, h * .05, 0)), top], h * .05, h * .035, c.stem, false, 5);
        add(blob(cr, 1), M(top.x, top.y, top.z, Math.cos(a) * lean * .5, 0, -Math.sin(a) * lean * .5, 1, .45, 1), i % 3 ? c.leaf : c.accent, true);
      }
    },
    // A mossy old stump with shelves of fungus stepping up its side.
    brackets(g, T) {
      const { H, r, c, add, M, cyl, blob } = g, R = H * .35;
      add(T.lumpy(new (g.THREE.CylinderGeometry)(R * .8, R, H * 1.1, 8, 2).translate(0, H * .55, 0), .12, 3), M(), c.stem, false);
      const k = 4 + Math.floor(r() * 5);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, y = H * (.2 + .8 * r()), w = R * (.6 + .5 * r()); add(blob(w, 1), M(Math.cos(a) * R * .95, y, Math.sin(a) * R * .95, 0, -a, 0, .7, .2, 1), i % 2 ? c.leaf : c.leaf2, true); }
    },
    // Branching fingers, forking twice or three times, blunt at the tips.
    coral(g, T) {
      const { H, r, c, add, M, blob } = g;
      const fork = (a, d, len, rad, depth) => {
        const b = a.clone().addScaledVector(d, len);
        stem(g, T, [a, b], rad, rad * .7, depth % 2 ? c.leaf : c.leaf2, true, 5);
        if (!depth) { add(blob(rad * .8, 0), M(b.x, b.y, b.z), c.accent, true); return; }
        for (let i = 0; i < 2 + (r() < .3 ? 1 : 0); i++) { const n = d.clone().add(T.V((r() - .5) * .9, .2, (r() - .5) * .9)).normalize(); fork(b, n, len * .72, rad * .72, depth - 1); }
      };
      for (let i = 0; i < 3; i++) fork(T.V((r() - .5) * H * .2, 0, (r() - .5) * H * .2), T.V((r() - .5) * .4, 1, (r() - .5) * .4).normalize(), H * .38, H * .07, 2);
    },
    // Round puffballs of every size, a few cracked open at the top.
    puffballs(g, T) {
      const { H, r, c, add, M, blob } = g, k = 3 + Math.floor(r() * 6);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, d = H * 1.2 * Math.sqrt(r()), s = H * (.25 + .3 * r()) * (i ? 1 : 1.4); add(T.lumpy(blob(s, 1), .06, i), M(Math.cos(a) * d, s * .8, Math.sin(a) * d, 0, 0, 0, 1, .85, 1), i % 3 ? c.leaf : c.leaf2, true); if (r() < .4) add(blob(s * .3, 0), M(Math.cos(a) * d, s * 1.55, Math.sin(a) * d, 0, 0, 0, 1, .4, 1), c.accent, true); }
    },
    // Tall caps pitted like honeycomb on thick pale stems.
    morel(g, T) {
      const { H, r, c, add, M, cyl, blob } = g, k = 1 + Math.floor(r() * 3);
      for (let i = 0; i < k; i++) { const x = i ? (r() - .5) * H * .6 : 0, z = i ? (r() - .5) * H * .6 : 0, h = H * (i ? .6 + .3 * r() : 1), sr = h * .1;
        add(cyl(sr * .9, sr * 1.15, h * .5, 7), M(x, 0, z), c.stem, false);
        add(T.lumpy(blob(h * .2, 2), .22, i * 7 + 1), M(x, h * .7, z, 0, r() * 6, 0, .8, 1.6, .8), i % 2 ? c.leaf2 : c.leaf, true); }
    },
  },
  stalk: {
    // A reed bed: thin tall stalks with long leaves, some with a velvet head.
    reeds(g, T) {
      const { H, r, c, add, M, cyl, spear, sp } = g, k = 6 + Math.floor(r() * 7);
      for (let i = 0; i < k; i++) {
        const a = r() * 6.28, d = H * .12 * Math.sqrt(r()), h = H * (.7 + .4 * r()), x = Math.cos(a) * d, z = Math.sin(a) * d, tilt = (r() - .5) * .15;
        add(cyl(H * .008, H * .012, h, 3), M(x, 0, z, tilt, 0, tilt), c.stem, false);
        if (r() < .5) add(cyl(H * .025, H * .025, h * .12, 6), M(x + Math.sin(tilt) * h * .85, h * .82, z - Math.sin(tilt) * h * .85 * 0, tilt, 0, tilt), c.accent, true);
        for (let j = 0; j < 2; j++) add(spear(h * (.6 + .3 * r()), H * .035 * sp.leafSize, .25 + .3 * r(), 3), M(x, 0, z, 0, r() * 6, 0), g.leaf(i + j), true);
      }
    },
    // One tall stem with broad leaves and a great flower head facing out.
    giantflower(g, T) {
      const { H, r, c, add, M, cyl, blade, blob, THREE } = g, R = H * .16;
      add(cyl(H * .015, H * .028, H, 5), M(), c.stem, false);
      for (let j = 0; j < 5; j++) add(blade(H * .22, H * .12, .4, .25, 4), M(0, H * (.15 + .14 * j), 0, 0, j * 2.4, .4), g.leaf(j), true);
      const head = new THREE.Matrix4().compose(new THREE.Vector3(0, H, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.1, r() * 6, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      add(new THREE.CylinderGeometry(R * .55, R * .6, R * .25, 14).translate(0, R * .1, 0), head, c.accent, true);
      const petals = 12 + Math.floor(r() * 8);
      for (let i = 0; i < petals; i++) { const a = i / petals * 6.28; add(new THREE.SphereGeometry(R * .32, 6, 3).scale(1.6, .15, .55).translate(R * .85, 0, 0), head.clone().multiply(new THREE.Matrix4().makeRotationY(a)), c.bloom || c.leaf2, true); }
    },
    // A jointed stem with whorls of fine needles at every joint.
    horsetail(g, T) {
      const { H, r, c, add, M, cyl, spear } = g, k = 1 + Math.floor(r() * 3), nodes = 5 + Math.floor(r() * 3);
      for (let s = 0; s < k; s++) { const x = s ? (r() - .5) * H * .3 : 0, z = s ? (r() - .5) * H * .3 : 0, h = H * (s ? .6 + .3 * r() : 1);
        add(cyl(H * .012, H * .02, h, 5), M(x, 0, z), c.stem, false);
        for (let j = 1; j < nodes; j++) { const y = h * j / nodes, w = 5 + (j % 2), len = H * .16 * (1 - j / nodes * .6);
          add(cyl(H * .024, H * .024, H * .012, 5), M(x, y, z), c.leaf2, false);
          for (let i = 0; i < w; i++) add(spear(len, H * .012, .3, 1), M(x, y, z, 0, i / w * 6.28, 1.2), g.leaf(i), true); } }
    },
    // Jointed canes, leafy at the top.
    bamboo(g, T) {
      const { H, r, c, add, M, cyl, blob, sp } = g, k = 3 + Math.floor(r() * 4);
      for (let s = 0; s < k; s++) { const a = r() * 6.28, d = H * .1 * r(), x = Math.cos(a) * d, z = Math.sin(a) * d, h = H * (.75 + .3 * r()), segs = 5 + Math.floor(r() * 3), lean = (r() - .5) * .12;
        for (let j = 0; j < segs; j++) { const y = h * j / segs; add(cyl(H * .022, H * .024, h / segs * .98, 5), M(x + y * lean, y, z, 0, 0, -lean), c.stem, false); if (j) add(cyl(H * .027, H * .027, H * .01, 5), M(x + y * lean, y, z), c.leaf2, false); }
        for (let j = 0; j < 3; j++) { const y = h * (.8 + .1 * j); add(blob(H * .13 * sp.leafSize, 1), M(x + y * lean + (r() - .5) * H * .1, y, z + (r() - .5) * H * .1, 0, r() * 6, 0, 1.2, .6, 1.2), g.leaf(s + j), true); } }
    },
  },
  bulb: {
    // Upright pitchers, flaring at the lip, dark inside.
    pitchers(g, T) {
      const { H, r, c, add, M, THREE } = g, k = 3 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, d = i ? H * .3 * Math.sqrt(r()) : 0, h = H * (.55 + .45 * r()), R = H * (.12 + .06 * r()), x = Math.cos(a) * d, z = Math.sin(a) * d, tilt = (r() - .5) * .3;
        const pts = [[R * .5, 0], [R, h * .25], [R * 1.05, h * .6], [R * .8, h * .85], [R * 1.25, h]].map(([px, py]) => new THREE.Vector2(px, py));
        add(new THREE.LatheGeometry(pts, 10), M(x, 0, z, tilt, 0, tilt), g.leaf(i), true);
        add(new THREE.CircleGeometry(R * .78, 10).rotateX(-Math.PI / 2).translate(0, h * .84, 0), M(x, 0, z, tilt, 0, tilt), '#' + new THREE.Color(c.leaf).multiplyScalar(.25).getHexString(), true); }
    },
    // Light round bladders floating on fine threads.
    balloons(g, T) {
      const { H, r, c, add, M, cyl, blob } = g, k = 3 + Math.floor(r() * 5);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, lean = r() * .35, h = H * (.6 + .5 * r()), s = H * (.12 + .1 * r());
        const top = T.V(Math.cos(a) * Math.sin(lean) * h, Math.cos(lean) * h, Math.sin(a) * Math.sin(lean) * h);
        stem(g, T, [T.V(), top.clone().multiplyScalar(.5).add(T.V(H * .03 * (r() - .5), 0, 0)), top], H * .006, H * .004, c.stem, false, 3);
        add(blob(s, 1), M(top.x, top.y + s * .8, top.z, 0, 0, 0, 1, 1.15, 1), g.leaf(i), true); }
      add(blob(H * .1, 0), M(0, H * .03, 0, 0, 0, 0, 1.5, .5, 1.5), c.stem, false);
    },
    // Swollen segments stacked into a dome, each narrower than the one below.
    gourds(g, T) {
      const { H, r, c, add, M, blob } = g, k = 1 + Math.floor(r() * 3);
      for (let s = 0; s < k; s++) { const x = s ? (r() - .5) * H * .8 : 0, z = s ? (r() - .5) * H * .8 : 0, n = 3 + Math.floor(r() * 3), sc = s ? .6 + .3 * r() : 1; let y = 0;
        for (let j = 0; j < n; j++) { const R = H * .22 * sc * (1 - j / n * .6); add(blob(R, 1), M(x, y + R * .6, z, 0, 0, 0, 1, .7, 1), j % 2 ? c.leaf2 : c.leaf, true); y += R * 1.05; }
        add(blob(H * .04 * sc, 0), M(x, y + H * .03, z), c.accent, true); }
    },
    // Arching stems from a crown of leaves, each with a bulb hanging from its tip.
    lanterns(g, T) {
      const { H, r, c, add, M, blob, blade } = g, k = 4 + Math.floor(r() * 4);
      for (let i = 0; i < 5; i++) add(blade(H * .35, H * .1, .5, .3, 3), M(0, H * .02, 0, 0, i * 1.26 + r() * .3, .3), g.leaf(i), true);
      for (let i = 0; i < k; i++) { const a = i / k * 6.28 + r() * .4, pts = arch(T, T.V(), a, H * (.7 + .3 * r()), H * (.35 + .25 * r()), .9, 5);
        const tip = stem(g, T, pts, H * .012, H * .006, c.stem, false, 3);
        stem(g, T, [tip, tip.clone().add(T.V(0, -H * .1, 0))], H * .004, H * .004, c.stem, false, 3);
        add(blob(H * (.07 + .04 * r()), 1), M(tip.x, tip.y - H * .16, tip.z, 0, 0, 0, 1, 1.3, 1), c.bloom || c.accent, true); }
    },
  },
  sheet: {
    // Ruffled frills, a few layers of wavy-edged discs up a short stem.
    frills(g, T) {
      const { H, r, c, add, M, cyl, THREE } = g, k = 2 + Math.floor(r() * 3);
      add(cyl(H * .04, H * .06, H * .7, 6), M(), c.stem, false);
      for (let i = 0; i < k; i++) { const R = H * (.45 - .1 * i), y = H * (.2 + .22 * i), waves = 5 + Math.floor(r() * 5);
        const geo = new THREE.CircleGeometry(R, 40, 0), P = geo.attributes.position;
        for (let j = 0; j < P.count; j++) { const x = P.getX(j), yy = P.getY(j), d = Math.hypot(x, yy) / R, a = Math.atan2(yy, x); P.setZ(j, Math.sin(a * waves + i) * R * .18 * d * d + d * d * R * .15); }
        geo.rotateX(-Math.PI / 2); geo.computeVertexNormals();
        add(geo, M(0, y, 0, 0, r() * 6, 0), g.leaf(i), true);
        add(geo.clone().rotateX(Math.PI).translate(0, -.01, 0), M(0, y, 0, 0, 0, 0), g.leaf(i + 1), true); }
    },
    // Flat fans spreading from the ground, ribbed with veins.
    fans(g, T) {
      const { H, r, c, add, M, THREE } = g, k = 3 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) { const a = i / k * 6.28 + r() * .5, R = H * (.7 + .4 * r()), spread = 1.4 + r() * .8;
        const geo = new THREE.CircleGeometry(R, 16, Math.PI / 2 - spread / 2, spread), P = geo.attributes.position;
        for (let j = 0; j < P.count; j++) { const x = P.getX(j), y = P.getY(j), ang = Math.atan2(y, x); P.setZ(j, Math.sin(ang * 14) * R * .03 + (Math.hypot(x, y) / R) ** 2 * R * .25); }
        geo.computeVertexNormals();
        const m = M(0, 0, 0, -.25 - .3 * r(), a, 0);
        add(geo, m, g.leaf(i), true); add(geo.clone().scale(1, 1, -1).translate(0, 0, -.01), m, g.leaf(i + 1), true); }
    },
  },
  filament: {
    // Fine threads that bow over in arches, beaded along their length.
    arches(g, T) {
      const { H, r, c, add, M, blob } = g, k = 3 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, pts = arch(T, T.V(), a, H * (.6 + .4 * r()), H * (.4 + .5 * r()), .95, 7);
        stem(g, T, pts, H * .008, H * .004, c.stem, false, 3);
        for (let j = 2; j < pts.length; j += 2) add(blob(H * .02, 0), M(pts[j].x, pts[j].y, pts[j].z, 0, 0, 0, 1, 1.4, 1), j % 4 ? c.leaf : c.accent, true); }
    },
    // A tall thread with tassels hanging all the way up.
    tassels(g, T) {
      const { H, r, c, add, M, cyl, blob } = g;
      add(cyl(H * .006, H * .012, H, 4), M(), c.stem, false);
      const n = 4 + Math.floor(r() * 4);
      for (let i = 1; i <= n; i++) { const y = H * i / (n + 1), a = r() * 6.28;
        for (let j = 0; j < 4; j++) { const b = a + j * 1.57, len = H * (.06 + .05 * r()); add(cyl(H * .004, H * .003, len, 3), M(Math.cos(b) * H * .015, y - len, Math.sin(b) * H * .015, 0, 0, .15), j % 2 ? c.leaf : c.leaf2, true); }
        add(blob(H * .014, 0), M(0, y, 0), c.accent, true); }
    },
  },
  chimney: {
    // A cluster of pipes of different heights, each with a feeding crown.
    pipes(g, T) {
      const { H, r, c, add, M, cyl, blob } = g, k = 4 + Math.floor(r() * 6);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, d = H * .2 * Math.sqrt(r()), h = H * (.35 + .65 * r()), R = H * (.05 + .04 * r()), x = Math.cos(a) * d, z = Math.sin(a) * d;
        add(T.lumpy(new (g.THREE.CylinderGeometry)(R * .85, R * 1.1, h, 7, 3).translate(0, h / 2, 0), .1, i), M(x, 0, z), i % 2 ? c.stem : c.leaf2, false);
        for (let j = 0; j < 5; j++) { const b = j / 5 * 6.28; add(cyl(H * .006, H * .006, H * .06, 3), M(x + Math.cos(b) * R * .7, h, z + Math.sin(b) * R * .7, Math.cos(b) * .5, 0, -Math.sin(b) * .5), c.leaf, true); }
        add(blob(R * .5, 0), M(x, h + H * .02, z), c.accent, true); }
    },
    // One column built of swollen rings stacked up, leaning a little.
    stacked(g, T) {
      const { H, r, c, add, M, blob } = g, n = 5 + Math.floor(r() * 4), lean = (r() - .5) * .2;
      for (let i = 0; i < n; i++) { const f = i / n, R = H * (.2 - .08 * f) * (.85 + .3 * r()), y = H * f; add(T.lumpy(blob(R, 1), .12, i), M(y * lean, y + R * .4, 0, 0, r() * 6, 0, 1, .55, 1), i % 2 ? c.stem : c.leaf2, false); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; add(g.cyl(H * .008, H * .008, H * .14, 3), M(H * lean + Math.cos(a) * H * .05, H, Math.sin(a) * H * .05, Math.cos(a) * .6, 0, -Math.sin(a) * .6), c.leaf, true); }
    },
  },
  plume: {
    // Feathery fronds rising in a vase, each a blade with a fine fringe.
    feathers(g, T) {
      const { H, r, c, add, M, cyl, blade, spear } = g, n = 5 + Math.floor(r() * 4);
      add(cyl(H * .03, H * .05, H * .2, 5), M(), c.stem, false);
      for (let i = 0; i < n; i++) { const a = i / n * 6.28 + r() * .3, tilt = .25 + .35 * r(), len = H * (.8 + .3 * r());
        add(spear(len, H * .02, .2, 3), M(0, H * .15, 0, tilt, a, 0), c.stem, false);
        for (let j = 1; j < 6; j++) for (const side of [-1, 1]) add(blade(len * (.22 - .03 * j), len * .05, .25, .2, 2), M(0, H * .15, 0, tilt, a, 0).multiply(new (g.THREE.Matrix4)().makeTranslation(0, len * j / 6.5, 0)).multiply(new (g.THREE.Matrix4)().makeRotationY(side > 0 ? 0 : Math.PI)).multiply(new (g.THREE.Matrix4)().makeRotationZ(.6)), g.leaf(i + j), true); }
    },
    // A round leafy pompom high on a slender stalk.
    pompom(g, T) {
      const { H, r, c, add, M, cyl, blob, sp } = g, k = 1 + Math.floor(r() * 3);
      for (let s = 0; s < k; s++) { const x = s ? (r() - .5) * H * .5 : 0, z = s ? (r() - .5) * H * .5 : 0, h = H * (s ? .55 + .3 * r() : .85), R = H * .2 * sp.leafSize * (s ? .75 : 1);
        add(cyl(H * .012, H * .02, h, 4), M(x, 0, z), c.stem, false);
        add(blob(R, 1), M(x, h + R * .6, z), g.leaf(s), true); add(blob(R * .7, 1), M(x + R * .3, h + R * .9, z - R * .2), g.leaf(s + 1), true); }
    },
  },
};

// --- Under water --------------------------------------------------------------------
Object.assign(BUILD, {
  kelp: {
    // A few long wavy ribbons streaming up from a holdfast.
    ribbon(g, T) {
      const { H, r, c, add, M, THREE, blob } = g, k = 3 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) {
        const len = H * (.7 + .35 * r()), w = H * (.05 + .04 * r()), seg = 10, geo = new THREE.PlaneGeometry(w, len, 1, seg).translate(0, len / 2, 0), P = geo.attributes.position;
        for (let j = 0; j < P.count; j++) { const y = P.getY(j), t = y / len, x = P.getX(j); P.setX(j, x * (.6 + .8 * Math.sin(Math.min(1, t * 1.1 + .1) * Math.PI)) + Math.sin(t * 9 + i) * w * .4); P.setZ(j, Math.sin(t * 6 + i * 2) * w * .6 + (x / w) * Math.sin(y * 18 / len) * w * .5); }
        geo.computeVertexNormals();
        const a = i / k * 6.28 + r(); add(geo, M(Math.cos(a) * H * .02, 0, Math.sin(a) * H * .02, (r() - .5) * .25, a, (r() - .5) * .25), g.leaf(i), true);
        add(geo.clone().scale(-1, 1, 1), M(Math.cos(a) * H * .02, 0, Math.sin(a) * H * .02, (r() - .5) * .25, a + .01, (r() - .5) * .25), g.leaf(i + 1), true);
      }
      add(blob(H * .04, 0), M(0, H * .01, 0, 0, 0, 0, 1.5, .6, 1.5), c.stem, false);
    },
    // A tall stipe with a float near the top and a spreading canopy of blades.
    giant(g, T) {
      const { H, r, c, add, M, cyl, blade, blob } = g, k = 1 + Math.floor(r() * 3);
      for (let s = 0; s < k; s++) { const x = s ? (r() - .5) * H * .15 : 0, z = s ? (r() - .5) * H * .15 : 0, h = H * (s ? .7 + .2 * r() : 1), lean = (r() - .5) * .15;
        const top = T.V(x + Math.sin(lean) * h, h, z);
        stem(g, T, [T.V(x, 0, z), T.V(x + Math.sin(lean) * h * .5 + H * .02, h * .5, z), top], H * .009, H * .006, c.stem, false, 4);
        add(blob(H * .035, 1), M(top.x, top.y - H * .03, top.z, 0, 0, 0, 1, 1.4, 1), c.accent, true);
        for (let i = 0; i < 9; i++) add(blade(H * (.22 + .1 * r()), H * .06, .5, .1, 4), M(top.x, top.y, top.z, 0, i / 9 * 6.28 + r() * .3, .1 + r() * .3), g.leaf(i), true);
        for (let j = 1; j < 6; j++) { const y = h * j / 7; add(blade(H * .12, H * .04, .2, .1, 3), M(x + Math.sin(lean) * y, y, z, 0, j * 2.4, .6), g.leaf(j), true); } }
    },
    // A low bush of short, frilled fronds.
    bushy(g, T) {
      const { H, r, c, add, M, blade } = g, k = 14 + Math.floor(r() * 10);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, len = H * (.35 + .45 * r()); add(blade(len, len * .3, -.15 + r() * .2, .35, 4), M(0, H * .02, 0, 0, a, .5 + r() * .9), g.leaf(i), true); }
    },
  },
  seagrass: {
    eelgrass(g, T) { const { H, r, add, M, spear } = g, k = 14 + Math.floor(r() * 10); for (let i = 0; i < k; i++) { const a = r() * 6.28, d = H * .2 * Math.sqrt(r()); add(spear(H * (.7 + .6 * r()), H * .025, .3 + .4 * r(), 4), M(Math.cos(a) * d, 0, Math.sin(a) * d, 0, r() * 6, 0), g.leaf(i), true); } },
    paddlegrass(g, T) { const { H, r, add, M, cyl, blob, c } = g, k = 5 + Math.floor(r() * 6); for (let i = 0; i < k; i++) { const a = r() * 6.28, d = H * .25 * Math.sqrt(r()), h = H * (.3 + .3 * r()), x = Math.cos(a) * d, z = Math.sin(a) * d; add(cyl(H * .01, H * .012, h, 3), M(x, 0, z), c.stem, false); for (const side of [-1, 1]) add(blob(H * .14, 1), M(x + side * H * .06, h + H * .05, z, 0, a, side * .6, .45, 1, .12), g.leaf(i), true); } },
    tufts(g, T) { const { H, r, add, M, spear } = g, k = 4 + Math.floor(r() * 4); for (let t = 0; t < k; t++) { const a = r() * 6.28, d = H * .5 * Math.sqrt(r()), x = Math.cos(a) * d, z = Math.sin(a) * d; for (let i = 0; i < 7; i++) add(spear(H * (.4 + .3 * r()), H * .03, .05, 2), M(x, 0, z, (r() - .5) * .7, r() * 6, (r() - .5) * .7), g.leaf(i + t), true); } },
  },
  coral: {
    // A rounded dome, its surface wound with deep grooves.
    brain(g, T) {
      const { H, r, c, add, M, THREE } = g, R = H * .6, geo = new THREE.IcosahedronGeometry(R, 4), P = geo.attributes.position, k = 6 + r() * 5;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), gr = Math.sin(x / R * k * 3.1 + Math.sin(z / R * k * 2.3) * 2 + Math.sin(y / R * k * 1.7)) * .05, s = (1 + gr) * (y < 0 ? .3 : 1); P.setXYZ(i, x * (1 + gr), y * s, z * (1 + gr)); }
      geo.computeVertexNormals(); add(geo, M(0, R * .15, 0), c.leaf, true);
    },
    // A flat table on a short stem, ragged at the rim.
    table(g, T) {
      const { H, r, c, add, M, cyl } = g, k = 1 + Math.floor(r() * 3);
      for (let i = 0; i < k; i++) { const x = i ? (r() - .5) * H * 1.6 : 0, z = i ? (r() - .5) * H * 1.6 : 0, R = H * (i ? .6 + .3 * r() : 1), h = H * (i ? .4 + .3 * r() : .7);
        add(cyl(H * .08, H * .12, h, 6), M(x, 0, z), c.leaf2, false);
        add(T.lumpy(new (g.THREE.CylinderGeometry)(R, R * .85, H * .08, 18, 1), .1, i), M(x, h, z, (r() - .5) * .15, r() * 6, (r() - .5) * .15), i % 2 ? c.leaf2 : c.leaf, true); }
    },
    // Upright pillars, round-topped.
    pillar(g, T) {
      const { H, r, c, add, M, cyl, blob } = g, k = 3 + Math.floor(r() * 6);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, d = H * .35 * Math.sqrt(r()), h = H * (.4 + .6 * r()), R = H * (.07 + .05 * r()); add(T.lumpy(new (g.THREE.CylinderGeometry)(R * .9, R * 1.1, h, 8, 4).translate(0, h / 2, 0), .08, i), M(Math.cos(a) * d, 0, Math.sin(a) * d), c.leaf, true); add(blob(R, 1), M(Math.cos(a) * d, h, Math.sin(a) * d, 0, 0, 0, 1, .6, 1), c.accent, true); }
    },
    // Flattened antlers, forking upward and outward.
    staghorn(g, T) {
      const { H, r, c, add, M, blob } = g;
      const fork = (a, d, len, w, depth) => { const b = a.clone().addScaledVector(d, len); const { len: L, m } = T.segM(a, b);
        add(new (g.THREE.BoxGeometry)(w, L, w * .3).translate(0, L / 2, 0), m, depth % 2 ? c.leaf : c.leaf2, true);
        if (!depth) { add(blob(w * .5, 0), M(b.x, b.y, b.z, 0, 0, 0, 1, 1, .4), c.accent, true); return; }
        for (let i = 0; i < 2; i++) { const n = d.clone().add(T.V((i ? 1 : -1) * (.5 + .3 * r()), .25, (r() - .5) * .3)).normalize(); fork(b, n, len * .75, w * .75, depth - 1); } };
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + r(); fork(T.V(), T.V(Math.cos(a) * .4, 1, Math.sin(a) * .4).normalize(), H * .35, H * .12, 3); }
    },
    // Cups and saucers stacked on one another.
    cups(g, T) {
      const { H, r, c, add, M, THREE } = g, n = 3 + Math.floor(r() * 4); let y = 0;
      for (let i = 0; i < n; i++) { const R = H * (.35 + .25 * r()), pts = [[R * .15, 0], [R * .6, R * .12], [R, R * .3], [R * 1.05, R * .36]].map(([x, yy]) => new THREE.Vector2(x, yy));
        const lathe = new THREE.LatheGeometry(pts, 14), m = M((r() - .5) * H * .2, y, (r() - .5) * H * .2, (r() - .5) * .3, 0, (r() - .5) * .3);
        add(lathe, m, i % 2 ? c.leaf2 : c.leaf, true); add(lathe.clone().scale(-1, 1, 1), m, i % 2 ? c.leaf2 : c.leaf, true); y += R * .32; } // (both faces: a cup is seen from above and below)
    },
  },
  fan: {
    // Wavy plates, one above another, on a short stalk.
    plates(g, T) {
      const { H, r, c, add, M, cyl, THREE } = g, n = 3 + Math.floor(r() * 3);
      add(cyl(H * .03, H * .04, H * .5, 5), M(), c.stem, false);
      for (let i = 0; i < n; i++) { const R = H * (.5 - .08 * i), geo = new THREE.CircleGeometry(R, 28), P = geo.attributes.position;
        for (let j = 0; j < P.count; j++) { const x = P.getX(j), y = P.getY(j), d = Math.hypot(x, y) / R, a = Math.atan2(y, x); P.setZ(j, Math.sin(a * 5 + i) * R * .12 * d * d); }
        geo.rotateX(-Math.PI / 2); geo.computeVertexNormals();
        add(geo, M(0, H * (.15 + .15 * i), 0, (r() - .5) * .3, r() * 6, (r() - .5) * .3), g.leaf(i), true); add(geo.clone().rotateX(Math.PI), M(0, H * (.15 + .15 * i) - .01, 0), g.leaf(i + 1), true); }
    },
    // Tall bare whips, bending a little.
    whips(g, T) {
      const { H, r, c, add, M } = g, k = 6 + Math.floor(r() * 8);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, lean = r() * .4, h = H * (.6 + .5 * r()), top = T.V(Math.cos(a) * Math.sin(lean) * h, Math.cos(lean) * h, Math.sin(a) * Math.sin(lean) * h);
        stem(g, T, [T.V(), top.clone().multiplyScalar(.35).add(T.V(0, h * .08, 0)), top.clone().multiplyScalar(.7).add(T.V(0, h * .06, 0)), top], H * .015, H * .005, i % 3 ? c.leaf : c.accent, true, 4); }
    },
  },
  anemone: {
    // A tall tube with a crown of tentacles.
    tube(g, T) {
      const { H, r, c, add, M, cyl, spear } = g, R = H * .08, h = H * .7;
      add(cyl(R, R * 1.1, h, 8), M(), c.stem, false);
      for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; add(spear(H * (.3 + .1 * r()), H * .03, .5, 3), M(Math.cos(a) * R, h, Math.sin(a) * R, 0, -a + Math.PI / 2, -.4), i % 2 ? c.accent : c.leaf, true); }
    },
    // A wide flat disc, its face a carpet of short tentacles.
    carpet(g, T) {
      const { H, r, c, add, M, cyl, spear } = g, R = H * .9;
      add(cyl(R, R * 1.05, H * .08, 16), M(), c.leaf2, true);
      for (let i = 0; i < 70; i++) { const a = r() * 6.28, d = R * Math.sqrt(r()) * .95; add(spear(H * (.12 + .08 * r()), H * .025, .2, 2), M(Math.cos(a) * d, H * .08, Math.sin(a) * d, 0, r() * 6, 0), i % 3 ? c.leaf : c.accent, true); }
    },
    // Many small anemones crowded together.
    crowd(g, T) {
      const { H, r, c, add, M, cyl, spear } = g, k = 6 + Math.floor(r() * 8);
      for (let n = 0; n < k; n++) { const a = r() * 6.28, d = H * .9 * Math.sqrt(r()), s = .3 + .3 * r(), x = Math.cos(a) * d, z = Math.sin(a) * d, R = H * .1 * s, h = H * .3 * s;
        add(cyl(R, R * 1.15, h, 6), M(x, 0, z), c.stem, false);
        for (let i = 0; i < 9; i++) { const b = i / 9 * 6.28; add(spear(H * .25 * s, H * .025 * s, .6, 2), M(x + Math.cos(b) * R, h, z + Math.sin(b) * R, 0, -b + Math.PI / 2, -.3), n % 2 ? c.accent : c.leaf, true); } }
    },
  },
  bladder: {
    // Bladders packed like a bunch of grapes on a short stalk.
    grapes(g, T) {
      const { H, r, c, add, M, cyl, blob } = g, k = 2 + Math.floor(r() * 3);
      for (let s = 0; s < k; s++) { const a = r() * 6.28, d = s ? H * .25 : 0, h = H * (.3 + .3 * r()), x = Math.cos(a) * d, z = Math.sin(a) * d;
        add(cyl(H * .012, H * .016, h, 4), M(x, 0, z), c.stem, false);
        for (let i = 0; i < 16; i++) { const t = i / 16, b = H * (.06 + .03 * r()), rr = H * .14 * Math.sin(t * Math.PI + .3); add(blob(b, 0), M(x + Math.cos(i * 2.4) * rr, h + H * .35 * t, z + Math.sin(i * 2.4) * rr), i % 4 ? c.leaf : c.accent, true); } }
    },
    // Chains of bladders strung along arching stalks.
    chains(g, T) {
      const { H, r, c, add, M, blob } = g, k = 3 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) { const pts = arch(T, T.V(), r() * 6.28, H * (.6 + .4 * r()), H * (.3 + .3 * r()), .6, 6);
        stem(g, T, pts, H * .008, H * .005, c.stem, false, 3);
        for (let j = 1; j < pts.length; j++) add(blob(H * (.045 + .02 * r()), 0), M(pts[j].x, pts[j].y, pts[j].z), j % 3 ? c.leaf : c.accent, true); }
    },
  },
  reefmound: {
    // Layered stone columns, each a stack of thin discs.
    columns(g, T) {
      const { H, r, c, add, M } = g, k = 3 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, d = H * .6 * Math.sqrt(r()), x = Math.cos(a) * d, z = Math.sin(a) * d, n = 4 + Math.floor(r() * 5), R = H * (.15 + .1 * r());
        for (let j = 0; j < n; j++) add(T.lumpy(new (g.THREE.CylinderGeometry)(R * (1.05 - .08 * (j % 2)), R, H * .12, 9, 1).translate(0, H * .06, 0), .08, i * 9 + j), M(x, j * H * .11, z), j % 2 ? c.leaf2 : c.leaf, false); }
    },
    // Stepped stone terraces.
    terraces(g, T) {
      const { H, r, c, add, M } = g, n = 3 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) { const R = H * (1 - .22 * j); add(T.lumpy(new (g.THREE.CylinderGeometry)(R * .95, R, H * .14, 14, 1).translate(0, H * .07, 0), .1, j), M((r() - .5) * H * .1, j * H * .13, (r() - .5) * H * .1), j % 2 ? c.leaf2 : c.leaf, false); }
    },
  },
});
