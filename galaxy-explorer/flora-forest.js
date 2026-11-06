// Forest trees for the new plant style (style.mjs): models built to make a wood feel
// like a wood you can get lost in. Tall firs with bare, stub-branched lower trunks and
// a jagged skirt of drooping boughs up to a narrow spire; tall pines with a crown only
// at the very top; heavy broadleaf trees with buttress roots, a short thick bole that
// splits into great limbs under a lumpy crown; and slim pale-barked trees with airy,
// ragged crowns. The classic models in flora-mesh.js are kept and come back with
// ?plants=classic.
//
// Each builder adds parts through the same helpers flora-mesh.js uses (add, M, cyl, blob),
// so the plant is merged, coloured, bloomed, twisted and simplified for distance exactly
// like the others. g: { THREE, add, M, cyl, blob, blade, r, H, c, sp, leaf }.
import { softenNormals } from './soften.js';

// A small hash of a vertex position, so a vertex shared by two faces moves the same way.
const jitterOf = (x, y, z, k) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + k * 19.3) * 43758.5453; return v - Math.floor(v); };
// Roughen a geometry in place: every vertex pushed in or out along its offset from the
// centre (lumpy crowns) and, optionally, the lowest ring pulled down (drooping skirts).
function roughen(g, amount, k, droop = 0) {
  const P = g.attributes.position;
  g.computeBoundingBox();
  const minY = g.boundingBox.min.y, maxY = g.boundingBox.max.y, span = Math.max(1e-6, maxY - minY);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), j = jitterOf(x, y, z, k);
    const s = 1 + (j - .5) * 2 * amount;
    const low = 1 - (y - minY) / span; // 1 at the bottom
    P.setXYZ(i, x * s, y - droop * low * low * (.4 + j), z * s);
  }
  g.computeVertexNormals();
  return g;
}
// A bough: a flat, tapering plate of needles along +x, drooping toward its tip, with a
// face on each side (about a dozen triangles, far fewer than a boxed blade). Marked as
// detail, so the far model leaves it out.
function bough(THREE, len, wid, droop) {
  const pos = [], seg = 3, pt = (t, side) => [len * t, -droop * len * t * t, side * wid * .5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * .8 + .2)), .8)];
  for (let i = 0; i < seg; i++) {
    const a = i / seg, b = (i + 1) / seg, A = pt(a, -1), B = pt(a, 1), C = pt(b, -1), D = pt(b, 1);
    pos.push(...A, ...B, ...C, ...B, ...D, ...C); // top
    pos.push(...A, ...C, ...B, ...B, ...C, ...D); // underside
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.userData.detail = true;
  return g;
}
const detail = (g) => { g.userData.detail = true; return g; }; // left out of the far model
const shade = (THREE, hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
// Deep forest foliage: darker, and drawn a little toward a cool shadowy green-black.
const deep = (THREE, hex, k, toward = '#16231d', t = .35) => '#' + new THREE.Color(hex).lerp(new THREE.Color(toward), t).multiplyScalar(k).getHexString();

// Familiar trees only where flora.mjs found the world Earth-like (sp.shape.earthlike);
// everywhere else, the world's own trees (alienTree).
export const FOREST_FORMS = {
  conifer(g) { if (g.sp.shape && !g.sp.shape.earthlike) return alienTree(g); return (g.sp.seed >>> 3) % 3 === 0 ? pine(g) : fir(g); },
  tree(g) { if (g.sp.shape && !g.sp.shape.earthlike) return alienTree(g); return g.sp.bark === 'pale' ? birch(g) : oak(g); },
};

// --- Trees of other worlds ---------------------------------------------------------
// A tree is a trunk plan and a crown plan (flora.mjs SHAPES, sp.shape), with the
// species' own proportions: girth, how high the crown starts (lift), how wide it spreads,
// how many layers or arms, lean, droop and lumpiness. A trunk plan returns the tips where
// crowns grow ({ p, d: direction, s: size }); a crown plan dresses one tip.
function alienTree(g) {
  const { THREE, add, blob, r, H, c, sp, leaf } = g, S = sp.shape;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0), ONE = V(1, 1, 1);
  const qOf = (d) => new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  // A tapering limb from a to b (radii r0 at a, r1 at b).
  const limb = (a, b, r0, r1, col = c.stem, seg = r0 > H * .02 ? 8 : 5) => {
    const d = b.clone().sub(a), len = d.length();
    if (len < 1e-4) return;
    add(new THREE.CylinderGeometry(Math.max(.01, r1), Math.max(.01, r0), len, seg, 1).translate(0, len / 2, 0), new THREE.Matrix4().compose(a, qOf(d), ONE), col, false);
  };
  // A geometry at p, its +y turned to d, scaled.
  const put = (geo, p, d, sc, col, foliage = true) => add(geo, new THREE.Matrix4().compose(p, qOf(d), sc instanceof THREE.Vector3 ? sc : V(sc, sc, sc)), col, foliage);
  const fol = (i) => deep(THREE, leaf(i), .92 + .1 * (i % 2), '#16231d', .08), under = (i) => deep(THREE, leaf(i), .5, '#16231d', .3);
  const tr = Math.max(.1, H * Math.min(.06, Math.max(.035, sp.trunkRatio)) * .55 * (.75 + .45 * (S.girth - .7) / .9)), top = H * (.48 + .34 * S.lift);
  const lean = V(S.lean + (r() - .5) * .08, 0, (r() - .5) * .1);
  const n = (k) => Math.max(2, S.count + k + Math.floor(r() * 2));
  const out = (a) => V(Math.cos(a), 0, Math.sin(a));

  // --- Trunk plans ---
  const TRUNKS = {
    column() { const t = V(lean.x * H * .4, top, lean.z * H * .4); limb(V(), t.clone().multiplyScalar(.5), tr, tr * .8); limb(t.clone().multiplyScalar(.5), t, tr * .8, tr * .5); roots(4); return [{ p: t, d: UP, s: 1 }]; },
    bottle() {
      const prof = [1, 1.9, 2.5, 2.2, 1.3, .6], seg = top / (prof.length - 1);
      for (let i = 0; i < prof.length - 1; i++) limb(V(0, i * seg, 0), V(0, (i + 1) * seg, 0), tr * prof[i], tr * prof[i + 1], c.stem, 8);
      const tips = [], k = n(0);
      for (let i = 0; i < k; i++) { const a = i / k * 6.28 + r() * .5, d = out(a).multiplyScalar(.8).add(V(0, .7, 0)).normalize(), e = V(0, top, 0).addScaledVector(d, H * (.1 + r() * .08)); limb(V(0, top - seg * .3, 0), e, tr * .5, tr * .25); tips.push({ p: e, d, s: .8 }); }
      return tips;
    },
    candelabra() {
      const base = V(0, H * (.22 + .15 * S.lift), 0); limb(V(), base, tr, tr * .85); roots(3);
      const tips = [], k = Math.min(5, n(-1));
      for (let i = 0; i < k; i++) { // each arm curves out and up, like a candelabrum's
        const a = i / k * 6.28 + r() * .6, reach = H * (.11 + .06 * S.spread), rise = H * (.3 + .2 * r()) * (.6 + .5 * S.lift);
        const pts = [0, .2, .4, .6, .8, 1].map((t) => base.clone().addScaledVector(out(a), reach * Math.sin(t * Math.PI / 2)).add(V(0, rise * (1 - Math.cos(t * Math.PI / 2)) + H * .02 * t, 0)));
        for (let q = 0; q < pts.length - 1; q++) limb(pts[q], pts[q + 1], tr * (.7 - .07 * q), tr * (.7 - .07 * (q + 1)));
        const e = pts[pts.length - 1].clone().add(V(0, rise * .35, 0)); limb(pts[pts.length - 1], e, tr * .35, tr * .25); tips.push({ p: e, d: UP, s: .7 }); }
      limb(base, V(0, top, 0), tr * .8, tr * .45); tips.push({ p: V(0, top, 0), d: UP, s: .85 });
      return tips;
    },
    braided() {
      const strands = 3 + (S.count > 5 ? 1 : 0), steps = 7, turn = 1.6 + r();
      for (let k = 0; k < strands; k++) { let prev = null; for (let i = 0; i <= steps; i++) { const t = i / steps, a = k / strands * 6.28 + t * turn * 6.28, rad = tr * (1.3 - .7 * t), p = V(Math.cos(a) * rad + lean.x * H * .4 * t, t * top, Math.sin(a) * rad); if (prev) limb(prev, p, tr * .5 * (1.1 - .5 * t), tr * .5 * (1 - .5 * t), c.stem, 5); prev = p; } }
      return [{ p: V(lean.x * H * .4, top, 0), d: UP, s: 1 }];
    },
    stilt() {
      const hub = V(0, Math.min(2.6, H * (.06 + .05 * S.lift)), 0), k = n(3);
      for (let i = 0; i < k; i++) { const a = i / k * 6.28 + r() * .4, foot = out(a).multiplyScalar(tr * (1.8 + .9 * S.spread) + hub.y * .5), knee = foot.clone().multiplyScalar(.55).add(V(0, hub.y * .75, 0)); limb(foot.clone().add(V(0, -.25, 0)), knee, tr * .2, tr * .24, c.stem, 6); limb(knee, hub, tr * .24, tr * .32, c.stem, 6); }
      const t = V(lean.x * H * .3, top, 0); limb(hub, t, tr * .8, tr * .5);
      return [{ p: t, d: UP, s: 1 }];
    },
    arch() {
      const side = r() < .5 ? -1 : 1, P = (t) => V(side * H * .38 * S.spread * t * t, top * (1.15 * t - .25 * t * t * t * t), 0);
      let prev = V(); for (let i = 1; i <= 7; i++) { const p = P(i / 7); limb(prev, p, tr * (1 - .08 * (i - 1)), tr * (1 - .08 * i)); prev = p; }
      roots(4);
      const end = P(1), d = end.clone().sub(P(.85)).normalize().lerp(V(0, -1, 0), .2 * S.droop);
      return [{ p: end, d: d.lerp(UP, .5).normalize(), s: 1 }];
    },
    segmented() {
      const k = 5 + Math.floor(S.lift * 4), seg = top / k;
      for (let i = 0; i < k; i++) { const a = V(lean.x * H * .3 * i / k, i * seg, 0), b = V(lean.x * H * .3 * (i + 1) / k, (i + 1) * seg, 0); limb(a, b, tr * .85, tr * .75); limb(b.clone().add(V(0, -seg * .04, 0)), b.clone().add(V(0, seg * .04, 0)), tr * 1.05, tr * 1.05, deep(THREE, c.leaf2, .7, '#2a2a20', .3)); if (i % 2 && i < k - 1) for (let j = 0; j < 2; j++) put(bough(THREE, H * .1, H * .03, .5), b, out(j * 3.14 + i).add(V(0, .6, 0)), 1, fol(i), true); }
      return [{ p: V(lean.x * H * .3, top, 0), d: UP, s: .9 }];
    },
    forked() {
      const base = V(0, H * (.25 + .12 * S.lift), 0); limb(V(), base, tr, tr * .8); roots(4);
      const tips = [];
      const fork = (p, d, len, rad, depth) => {
        const e = p.clone().addScaledVector(d, len); limb(p, e, rad, rad * .7);
        if (!depth) { tips.push({ p: e, d: d.clone().lerp(UP, .6).normalize(), s: .62 }); return; }
        const k = depth > 1 ? 2 + (r() < .35 ? 1 : 0) : 2; // at most six crowns
        for (let i = 0; i < k; i++) { const a = i / k * 6.28 + r() * 1.2, nd = d.clone().multiplyScalar(.7).add(out(a).multiplyScalar(.55 * S.spread)).normalize(); fork(e, nd, len * .75, rad * .7, depth - 1); }
      };
      fork(base, UP, (top - base.y) * .55, tr * .8, 2);
      return tips;
    },
    spiral() {
      const steps = 10, turns = 1 + r() * .8, rad = tr * (2 + S.spread); let prev = V();
      for (let i = 1; i <= steps; i++) { const t = i / steps, a = t * turns * 6.28, p = V(Math.cos(a) * rad * Math.sin(t * Math.PI) , t * top, Math.sin(a) * rad * Math.sin(t * Math.PI)); limb(prev, p, tr * (1 - .05 * (i - 1)), tr * (1 - .05 * i)); prev = p; }
      return [{ p: prev, d: UP, s: 1 }];
    },
  };
  // Roots flaring out into the ground from the foot of the trunk.
  function roots(k) { for (let i = 0; i < k; i++) { const a = i / k * 6.28 + r() * .6, len = tr * (2 + r()); add(new THREE.ConeGeometry(tr * .5, len, 4).translate(0, len / 2, 0), new THREE.Matrix4().makeTranslation(Math.cos(a) * tr * .5, tr * .5, Math.sin(a) * tr * .5).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -1.7)), c.stem, false); } }

  // --- Crown plans: dress one tip (p, d, s) ---
  const R0 = H * .21 * S.spread;
  const CROWNS = {
    discs({ p, d, s }, i) { // tiers of leafy pads round the stem, smaller towards the top (a pagoda of foliage, not slices)
      const L = Math.max(2, Math.min(S.layers, Math.round(S.layers * s * s * 1.4))), R = R0 * s * 1.15, gap = Math.min(R * .45, H * .45 * s / L);
      limb(p, p.clone().addScaledVector(d, gap * (L - .5)), tr * .3 * s, tr * .1, c.stem, 5);
      for (let k = 0; k < L; k++) {
        const f = k / L, q = p.clone().addScaledVector(d, gap * k + R * .05), rr = R * (1 - .6 * f) * (.9 + .2 * r()), n = 4 + Math.round(3 * (1 - f));
        put(roughen(blob(rr * .45, 1), S.lumpy, k + i * 13), q, d, V(1, .38, 1), fol(i + (k % 2)));
        for (let j = 0; j < n; j++) { const a = j / n * 6.28 + r() * .6 + k; put(roughen(blob(rr * (.38 + .12 * r()), 1), S.lumpy, j + k * 7), q.clone().addScaledVector(out(a), rr * (.55 + .15 * r())).addScaledVector(d, -rr * .08 * S.droop), d, V(1, .34, 1), fol(i + j + k)); }
      } },
    globe({ p, d, s }, i) { const k = 2 + Math.floor(r() * 3), R = R0 * s; for (let j = 0; j < k; j++) put(roughen(blob(R * (.7 + .4 * r()), 1), S.lumpy, j + i * 5), p.clone().add(V((r() - .5) * R, (r() - .1) * R * .7, (r() - .5) * R)), d, V(1, .8, 1), fol(j + i)); put(detail(roughen(blob(R * .6, 0), .2, i)), p.clone().addScaledVector(d, -R * .35), d, V(1.2, .5, 1.2), under(i)); },
    umbrella({ p, d, s }, i) { // a wide flat-topped canopy, built of overlapping lumpy pads so its edge is ragged
      const R = R0 * s * 1.6, k = 6 + Math.floor(S.spread * 3);
      put(roughen(blob(R * .55, 1), S.lumpy * .6, i), p.clone().addScaledVector(UP, R * .1), UP, V(1, .32, 1), fol(i));
      for (let j = 0; j < k; j++) { const a = j / k * 6.28 + r() * .5, q = p.clone().addScaledVector(out(a), R * (.45 + .2 * r())).add(V(0, R * (.02 + .06 * r()), 0)); put(roughen(blob(R * (.38 + .14 * r()), 1), S.lumpy * .7, j + i * 9), q, UP, V(1, .3 + .1 * r(), 1), fol(j + i)); }
      put(detail(roughen(blob(R * .8, 0), .12, i + 3)), p.clone().addScaledVector(UP, -R * .04), UP, V(1, .12, 1), under(i)); },
    weeping({ p, d, s }, i) { const R = R0 * s; put(roughen(blob(R, 1), S.lumpy, i), p, d, V(1, .6, 1), fol(i)); const k = 16 + Math.floor(S.droop * 14);
      for (let j = 0; j < k; j++) { const a = j / k * 6.28 + r() * .4, q = p.clone().addScaledVector(out(a), R * .85), len = R * (1.2 + 2 * S.droop) * (.7 + .5 * r()); add(new THREE.CylinderGeometry(R * .03, R * .008, len, 3, 1).translate(0, -len / 2, 0), new THREE.Matrix4().makeTranslation(q.x + (r() - .5) * R * .3, q.y, q.z + (r() - .5) * R * .3), j % 2 ? fol(j) : under(j), true); } },
    spiral({ p, d, s }, i) { const len = Math.min(R0 * s * 3.2, H * .55 * s), tipP = p.clone().addScaledVector(d, len); limb(p, tipP, tr * .3 * s, tr * .05, c.stem, 4); const k = Math.round((10 + S.layers * 2) * Math.min(1, s * 1.2));
      for (let j = 0; j < k; j++) { const f = j / k, q = p.clone().addScaledVector(d, len * f * .95); put(bough(THREE, R0 * s * (1.3 - f) * (.8 + .4 * r()), R0 * s * .35, .2 + S.droop * .6), q, out(j * 2.4).add(V(0, .25, 0)), 1, fol(j)); } },
    bottlebrush({ p, d, s }, i) { const len = Math.min(R0 * s * 3, H * .55 * s), tipP = p.clone().addScaledVector(d, len); limb(p, tipP, tr * .25 * s, tr * .05, c.stem, 4); const k = Math.round((26 + S.layers * 3) * Math.min(1, s * 1.2));
      for (let j = 0; j < k; j++) { const f = j / k, q = p.clone().addScaledVector(d, len * (.08 + .9 * f)), bl = R0 * s * (.55 + .5 * Math.sin(f * Math.PI)) * (.8 + .4 * r()); put(new THREE.ConeGeometry(bl * .1, bl, 3).translate(0, bl / 2, 0), q, out(j * 2.4 + r()).add(V(0, .15 - S.droop * .4, 0)), 1, fol(j)); } },
    fan({ p, d, s }, i) { const k = 7 + Math.floor(S.spread * 3); for (let j = 0; j < k; j++) { const a = j / k * 6.28 + r() * .3; put(bough(THREE, R0 * s * (1.8 + .6 * r()), R0 * s * .55, .05 + S.droop * .35), p, out(a).add(V(0, 1.2 - S.droop, 0)), 1, fol(j)); } put(blob(R0 * s * .25, 0), p, d, 1, fol(i)); },
    lanterns({ p, d, s }, i) { const R = R0 * s; put(roughen(blob(R * .7, 1), S.lumpy, i), p, d, V(1.2, .55, 1.2), fol(i)); const k = 4 + Math.floor(S.droop * 5), pod = c.bloom || c.accent;
      for (let j = 0; j < k; j++) { const a = j / k * 6.28 + r() * .5, q = p.clone().addScaledVector(out(a), R * (.5 + .4 * r())), len = R * (.4 + .9 * S.droop); add(new THREE.CylinderGeometry(R * .02, R * .02, len, 3, 1).translate(0, -len / 2, 0), new THREE.Matrix4().makeTranslation(q.x, q.y, q.z), under(j), true); put(roughen(blob(R * .2, 1), .1, j), q.clone().add(V(0, -len - R * .15, 0)), UP, V(1, 1.4, 1), pod); } },
    invertedCone({ p, d, s }, i) { // a crown that widens upward (a vase of foliage), built of leafy clumps in rings, not a solid cone
      const R = R0 * s * .9, h = R * 1.7, rings = 3;
      for (let k = 0; k < rings; k++) { const f = (k + .5) / rings, rr = R * (.3 + .7 * f), n = 3 + k * 2, y = h * (f - .15);
        for (let j = 0; j < n; j++) { const a = j / n * 6.28 + r() * .5 + k; put(roughen(blob(R * (.3 + .12 * f) * (.85 + .3 * r()), 1), S.lumpy, j + k * 11 + i), p.clone().addScaledVector(d, y).addScaledVector(out(a), rr * .75), d, V(1, .7, 1), fol(i + j + k)); } }
      put(roughen(blob(R * .55, 1), S.lumpy, i + 3), p.clone().addScaledVector(d, h * .78), d, V(1.5, .4, 1.5), fol(i)); },
    puffs({ p, d, s }, i) { const k = 6 + Math.floor(S.spread * 5), R = R0 * s;
      for (let j = 0; j < k; j++) { const dir = out(j * 2.4 + r()).multiplyScalar(.9).add(V(0, .6 + r() * .6, 0)).normalize(), len = R * (1 + .8 * r()), e = p.clone().addScaledVector(dir, len); limb(p, e, tr * .12 * s, tr * .05, c.stem, 3); put(roughen(blob(R * (.28 + .15 * r()), 1), S.lumpy, j), e, dir, 1, fol(j)); } },
    shelves({ p, d, s }, i) { const k = S.layers, R = R0 * s; // leafy brackets stepping up the trunk, each on its own side
      for (let j = 0; j < k; j++) { const f = .3 + .65 * j / k, q = p.clone().multiplyScalar(f), a = j * 2.2 + r(), rr = R * (1.05 - .5 * f), c0 = q.clone().addScaledVector(out(a), rr * .6);
        for (let m = 0; m < 3; m++) put(roughen(blob(rr * (.42 + .1 * r()), 1), S.lumpy, j * 5 + m), c0.clone().addScaledVector(out(a + (m - 1) * .7), rr * .3), UP, V(1, .32, .8), fol(j + m)); }
      put(roughen(blob(R * .6, 1), S.lumpy, i), p, d, V(1, .7, 1), fol(i)); },
    ribbons({ p, d, s }, i) { const k = 10 + Math.floor(S.droop * 8), R = R0 * s; put(blob(R * .25, 0), p, d, 1, fol(i));
      for (let j = 0; j < k; j++) put(bough(THREE, R * (1.6 + 1.6 * S.droop) * (.7 + .5 * r()), R * .18, 1 + S.droop * 2), p, out(j * 2.4 + r()).add(V(0, .8, 0)), 1, fol(j)); },
  };
  const tips = TRUNKS[S.trunk]();
  tips.forEach((t, i) => CROWNS[S.crown](t, i));
  // Extras: thorns up the trunk, and seed pods hanging near the tips.
  if (S.thorns) for (let k = 0; k < 10; k++) { const y = top * (.1 + .7 * r()), a = r() * 6.28; put(new THREE.ConeGeometry(tr * .12, tr * .9, 3).translate(0, tr * .45, 0), V(Math.cos(a) * tr * .7, y, Math.sin(a) * tr * .7), out(a).add(V(0, .3, 0)), 1, deep(THREE, c.stem, .6, '#000000', .2), false); }
  if (S.pods && S.crown !== 'lanterns') for (const t of tips.slice(0, 4)) for (let k = 0; k < 2; k++) { const a = r() * 6.28; put(blob(R0 * t.s * .14, 0), t.p.clone().addScaledVector(out(a), R0 * t.s * .5).add(V(0, -R0 * t.s * .35, 0)), UP, V(1, 1.4, 1), c.bloom || c.accent); }
}

// A fir: the dark heart of a conifer wood.
function fir({ THREE, add, M, cyl, r, H, c, sp, leaf }) {
  const tr = Math.max(.12, H * sp.trunkRatio * .55), bare = H * (.4 + r() * .16); // the crown begins this high: a long bare trunk
  const dark = (i) => deep(THREE, leaf(i), .3 + (i % 3) * .05, '#14221c', .4); // fir needles are dark
  // Trunk in two sections with a slight wander, flared at the foot.
  const wob = (r() - .5) * .05;
  add(cyl(tr * .55, tr, H * .55, 7), M(), c.stem, false);
  add(cyl(tr * .12, tr * .55, H * .45, 6), M(0, H * .55, 0, 0, 0, wob), c.stem, false);
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 + r() * .6, len = tr * (2.2 + r() * 1.2);
    add(new THREE.ConeGeometry(tr * .42, len, 4).translate(0, len / 2, 0), new THREE.Matrix4().makeTranslation(Math.cos(a) * tr * .55, tr * .55, Math.sin(a) * tr * .55).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -1.74)), c.stem, false);
  }
  // Dead branch stubs on the bare lower trunk, pointing down and out.
  const stubs = 5 + Math.floor(r() * 5);
  for (let k = 0; k < stubs; k++) {
    const y = H * .08 + (bare - H * .06) * r(), a = r() * Math.PI * 2, len = H * (.03 + r() * .05);
    add(cyl(tr * .05, tr * .13, len, 3), M(Math.cos(a) * tr * .5, y, Math.sin(a) * tr * .5, 0, -a, -1.9 - r() * .4), shade(THREE, c.stem, .8), false);
  }
  // Tiers of drooping boughs, widest low down, thinning to a narrow spire.
  const tiers = 10 + Math.floor(r() * 4), top = H * .97, maxR = H * (.21 + r() * .05) * Math.sqrt(sp.leafSize);
  for (let i = 0; i < tiers; i++) {
    const f = i / tiers, y = bare + (top - bare) * f * .92, rad = maxR * Math.pow(1 - f, .85) * (.85 + r() * .3) + H * .012;
    const th = (top - bare) / tiers * 2.4;
    const skirt = roughen(new THREE.ConeGeometry(rad, th, 8, 1).translate(0, th / 2, 0), .18, i + sp.seed % 97, th * .35);
    add(skirt, M(0, y - th * .2, 0, 0, r() * 6.28, 0), dark(i), true);
    // Boughs that reach past the skirt and droop at their tips: a ragged silhouette.
    const boughs = rad > H * .05 ? 4 + Math.floor(r() * 3) : 0;
    for (let b = 0; b < boughs; b++) {
      const a = b / boughs * Math.PI * 2 + r() * .8, len = rad * (1.05 + r() * .35);
      add(bough(THREE, len, len * .6, .3 + r() * .25), M(0, y + th * .3, 0, 0, a, -.15 - r() * .2), dark(i + b + 1), true);
    }
  }
  add(new THREE.ConeGeometry(H * .018, H * .09, 5).translate(0, H * .045, 0), M(0, top - H * .02, 0), dark(0), true);
}

// A pine: a tall, bare, reddish trunk with a ragged crown only near the top.
function pine({ THREE, add, M, cyl, blob, r, H, c, sp, leaf }) {
  const tr = Math.max(.12, H * sp.trunkRatio * .5), crownY = H * (.6 + r() * .1);
  const bark = '#' + new THREE.Color(c.stem).lerp(new THREE.Color('#8a5232'), .22).multiplyScalar(.92).getHexString(); // pines redden up the trunk
  const lean = (r() - .5) * .08;
  add(cyl(tr * .6, tr, H * .5, 7), M(), c.stem, false);
  add(cyl(tr * .2, tr * .6, H * .48, 6), M(0, H * .49, 0, 0, 0, lean), bark, false);
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2 + r() * .6, len = tr * (2 + r());
    add(new THREE.ConeGeometry(tr * .4, len, 4).translate(0, len / 2, 0), new THREE.Matrix4().makeTranslation(Math.cos(a) * tr * .55, tr * .5, Math.sin(a) * tr * .55).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -1.72)), c.stem, false);
  }
  for (let k = 0; k < 4; k++) { const y = H * (.2 + r() * .35), a = r() * 6.28; add(cyl(tr * .04, tr * .12, H * .04, 3), M(Math.cos(a) * tr * .5, y, Math.sin(a) * tr * .5, 0, -a, -1.8), bark, false); }
  // Branches up into the crown, each ending in a flattened clump of needles.
  const arms = 6 + Math.floor(r() * 4), clump = (x, y, z, rad, i) => {
    add(roughen(blob(rad, 1), .25, i + 3), M(x, y, z, 0, r() * 6, 0, 1.2, .75, 1.2), deep(THREE, leaf(i), .6 + .1 * (i % 2), '#16231d', .2), true);
    add(detail(roughen(blob(rad * .7, 0), .2, i + 9)), M(x + (r() - .5) * rad, y - rad * .3, z + (r() - .5) * rad, 0, r() * 6, 0, 1.3, .6, 1.3), deep(THREE, leaf(i + 1), .5, '#16231d', .25), true);
  };
  for (let i = 0; i < arms; i++) {
    const a = i / arms * Math.PI * 2 + r() * .7, y0 = crownY + (H * .93 - crownY) * (i / arms) * (.6 + r() * .4), len = H * (.08 + r() * .09) * (1.2 - i / arms * .5), tilt = .7 + r() * .5;
    add(cyl(tr * .1, tr * .25, len, 4), M(0, y0, 0, 0, a, -tilt), bark, false);
    const ex = Math.cos(-a) * Math.sin(tilt) * len, ey = y0 + Math.cos(tilt) * len, ez = Math.sin(-a) * Math.sin(tilt) * len;
    clump(ex, ey, ez, H * (.075 + r() * .04) * Math.sqrt(sp.leafSize), i);
  }
  clump(0, H * .95, 0, H * .085 * Math.sqrt(sp.leafSize), arms);
  clump(0, (crownY + H * .95) / 2, 0, H * .07, arms + 1); // fills the middle of the crown
}

// A broadleaf giant: buttress roots, a short thick bole, great limbs, a heavy lumpy crown.
function oak({ THREE, add, M, cyl, blob, r, H, c, sp, leaf }) {
  const tr = Math.max(.18, H * sp.trunkRatio * 1.25), bole = H * (.4 + r() * .12);
  add(cyl(tr * .78, tr, bole, 8), M(), c.stem, false);
  // Buttress roots running out over the ground.
  const roots = 5 + Math.floor(r() * 3);
  for (let k = 0; k < roots; k++) {
    const a = k / roots * Math.PI * 2 + r() * .5, len = tr * (2 + r() * 1.2);
    add(new THREE.ConeGeometry(tr * .62, len, 5).translate(0, len / 2, 0), new THREE.Matrix4().makeTranslation(Math.cos(a) * tr * .45, tr * .7, Math.sin(a) * tr * .45).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -1.66 - r() * .12)), c.stem, false);
  }
  // A few knots and old broken branches on the bole.
  for (let k = 0; k < 3; k++) { const a = r() * 6.28, y = bole * (.35 + r() * .5); add(cyl(tr * .12, tr * .25, tr * 1.1, 4), M(Math.cos(a) * tr * .7, y, Math.sin(a) * tr * .7, 0, -a, -1.3), c.stem, false); }
  // Great limbs, each forking once, every fork crowned with a cluster of lumpy foliage.
  const limbs = 3 + Math.floor(r() * 3), ends = [];
  for (let i = 0; i < limbs; i++) {
    const a = i / limbs * Math.PI * 2 + r() * .8, tilt = .35 + r() * .45, len = H * (.26 + r() * .12), rr = tr * (.55 + r() * .15);
    add(cyl(rr * .6, rr, len, 6), M(0, bole * .92, 0, 0, a, -tilt), c.stem, false);
    const ex = Math.cos(-a) * Math.sin(tilt) * len, ey = bole * .92 + Math.cos(tilt) * len, ez = Math.sin(-a) * Math.sin(tilt) * len;
    for (let k = 0; k < 2; k++) {
      const a2 = a + (k ? .6 : -.6) + (r() - .5) * .4, t2 = tilt + .2 + r() * .3, l2 = len * (.45 + r() * .25);
      add(cyl(rr * .25, rr * .55, l2, 5), M(ex, ey, ez, 0, a2, -t2), c.stem, false);
      ends.push([ex + Math.cos(-a2) * Math.sin(t2) * l2, ey + Math.cos(t2) * l2, ez + Math.sin(-a2) * Math.sin(t2) * l2]);
    }
  }
  ends.push([0, H * .82, 0]);
  const big = H * .17 * sp.leafSize;
  ends.forEach(([x, y, z], i) => {
    const n = 2 + Math.floor(r() * 2);
    for (let b = 0; b < n; b++) {
      const rad = big * (.7 + r() * .45) * (i === ends.length - 1 ? 1.25 : 1);
      add(roughen(blob(rad, 1), .2, i * 7 + b), M(x + (r() - .5) * rad * .9, y + (r() - .2) * rad * .5, z + (r() - .5) * rad * .9, 0, r() * 6, 0, 1.1, .78, 1.1), shade(THREE, leaf(i + b), .78 + .12 * r()), true);
    }
    add(detail(roughen(blob(big * .5, 0), .25, i + 50)), M(x + (r() - .5) * big, y - big * .45, z + (r() - .5) * big, 0, r() * 6, 0, 1.2, .6, 1.2), shade(THREE, leaf(i + 1), .62), true); // shadowed underside
  });
  if (sp.arms > 1) for (let k = 0; k < 6; k++) { const [x, y, z] = ends[Math.floor(r() * ends.length)], a = r() * 6.28; add(blob(H * .02, 0), M(x + Math.cos(a) * big * .9, y - big * .3, z + Math.sin(a) * big * .9), c.accent, true); }
}

// A slim pale-barked tree with an airy, ragged crown of small clumps up its upper trunk.
function birch({ THREE, add, M, cyl, blob, r, H, c, sp, leaf }) {
  const tr = Math.max(.1, H * sp.trunkRatio * .55), lean = (r() - .5) * .12;
  add(cyl(tr * .6, tr, H * .55, 6), M(), c.stem, false);
  add(cyl(tr * .2, tr * .6, H * .4, 5), M(0, H * .54, 0, 0, 0, lean), c.stem, false);
  const clumps = 7 + Math.floor(r() * 5);
  for (let i = 0; i < clumps; i++) {
    const f = i / clumps, y = H * (.42 + .52 * f), a = r() * 6.28, d = H * (.05 + .12 * (1 - f) * r()), rad = H * (.07 + .05 * (1 - f)) * sp.leafSize;
    if (d > H * .06) add(cyl(tr * .05, tr * .12, d * 1.1, 3), M(0, y - rad * .4, 0, 0, a, -1.1), c.stem, false);
    add(roughen(blob(rad, 1), .25, i), M(Math.cos(-a) * d, y, Math.sin(-a) * d, 0, r() * 6, 0, 1, .85, 1), shade(THREE, leaf(i), .85 + .15 * r()), true);
  }
}

// --- Deadwood and stones of the forest floor (new plant style) ---------------------
// Fallen trunks, broken stumps and moss-grown boulders, made once per world in the
// colours of its own trees, ground and rock. Each is one model drawn with instancing;
// flora-mesh.js places them in the woods. Every model is vertex coloured (moss on what
// faces up) and has two groups like the plants. Returns [{ name, geo, foot }], where
// foot gives what you bump into: { r, h, along } (along: a log's half length).
export function forestDecor(THREE, { bark, moss, rock }) {
  const B = new THREE.Color(bark), Mo = new THREE.Color(moss), R = new THREE.Color(rock), tmp = new THREE.Color();
  // Merges parts into one non-indexed geometry with per-face colours; mossy parts get moss
  // on faces turned upward.
  const build = (parts) => {
    const pos = [], nor = [], col = [];
    for (const { geo, matrix, color, mossy } of parts) {
      const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(matrix);
      g.computeVertexNormals(); softenNormals(THREE, g, .7); // softened facets (soften.js)
      const P = g.attributes.position.array, N = g.attributes.normal.array;
      for (let i = 0; i < P.length; i += 9) {
        const ny = (N[i + 1] + N[i + 4] + N[i + 7]) / 3, j = jitterOf(P[i], P[i + 1], P[i + 2], 5);
        tmp.copy(color).multiplyScalar(.85 + .3 * j);
        if (mossy && ny > .35 - j * .3) tmp.lerp(Mo, .55 + .4 * j);
        for (let k = i; k < i + 9; k += 3) { pos.push(P[k], P[k + 1], P[k + 2]); nor.push(N[k], N[k + 1], N[k + 2]); col.push(tmp.r, tmp.g, tmp.b); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.addGroup(0, pos.length / 3, 0); g.addGroup(pos.length / 3, 0, 1);
    g.computeBoundingSphere();
    return g;
  };
  const m4 = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
  const out = [];
  // A fallen trunk, 8 m long along x, half sunk, splintered at one end, with old branch stubs.
  {
    const parts = [], L = 8, r = .42;
    parts.push({ geo: roughen(new THREE.CylinderGeometry(r * .8, r, L, 7, 3).rotateZ(Math.PI / 2), .06, 1), matrix: m4(0, r * .55, 0), color: B, mossy: true });
    for (let k = 0; k < 5; k++) parts.push({ geo: new THREE.ConeGeometry(r * .25, r * 1.3, 3).rotateZ(-Math.PI / 2), matrix: m4(L / 2 + r * .4, r * .55 + (k % 3 - 1) * r * .4, (k % 2 - .5) * r * .6, k, 0, (k - 2) * .15), color: B, mossy: false }); // splinters
    for (let k = 0; k < 3; k++) parts.push({ geo: new THREE.CylinderGeometry(.05, .1, .9, 4), matrix: m4(-L * .3 + k * L * .25, r * 1.1, (k % 2 ? 1 : -1) * r * .4, (k % 2 ? 1 : -1) * .9, 0, .3), color: B, mossy: false });
    parts.push({ geo: new THREE.CylinderGeometry(r * .82, r * .82, .08, 7).rotateZ(Math.PI / 2), matrix: m4(-L / 2, r * .55, 0), color: new THREE.Color('#b58e62').lerp(B, .4), mossy: false }); // the cut-looking end, pale wood
    out.push({ name: 'log', geo: build(parts), foot: { r, h: r * 1.3, along: L / 2 } });
  }
  // A broken stump with jagged top and roots.
  {
    const parts = [], r = .5, h = 1.1;
    parts.push({ geo: new THREE.CylinderGeometry(r * .9, r * 1.1, h, 7), matrix: m4(0, h / 2, 0), color: B, mossy: true });
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; parts.push({ geo: new THREE.ConeGeometry(r * .3, r * (.6 + (k % 3) * .35), 3), matrix: m4(Math.cos(a) * r * .55, h + r * .2, Math.sin(a) * r * .55, 0, a, 0), color: B, mossy: false }); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + .4; parts.push({ geo: new THREE.ConeGeometry(r * .35, r * 2.4, 4).translate(0, r * 1.2, 0), matrix: new THREE.Matrix4().makeTranslation(Math.cos(a) * r * .55, r * .45, Math.sin(a) * r * .55).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -1.68)), color: B, mossy: true }); }
    out.push({ name: 'stump', geo: build(parts), foot: { r: r * 1.1, h } });
  }
  // A great boulder, half buried, moss over its top.
  {
    const parts = [], r = 1.6;
    parts.push({ geo: roughen(new THREE.IcosahedronGeometry(r, 1), .22, 3), matrix: new THREE.Matrix4().compose(new THREE.Vector3(0, r * .25, 0), new THREE.Quaternion(), new THREE.Vector3(1.2, .75, 1)), color: R, mossy: true });
    parts.push({ geo: roughen(new THREE.IcosahedronGeometry(r * .55, 0), .2, 7), matrix: m4(r * 1.1, r * .05, r * .5), color: R, mossy: true });
    out.push({ name: 'boulder', geo: build(parts), foot: { r: r * 1.05, h: r } });
  }
  return out;
}
