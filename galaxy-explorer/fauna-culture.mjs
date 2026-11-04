// What a species that has reached civilization looks like: the evolved means to
// shape things, and visible culture that grows with its level. Real animals only
// become builders if they have something to build with, so every civilized species
// gets manipulators suited to its body plan (not human hands by default):
//   hands on arms, a second pair of small arms on the chest, a prehensile trunk,
//   rings of fingered tendrils round the mouth, raised fingered forelimbs, clawed
//   hands on the wing, or fingered tentacles hanging from a drifter.
// Then culture, by level (CIVILIZATION in fauna.mjs):
//   1 tool users       paint and a carried tool (stone-tipped spear or staff)
//   2 village builders harness, pouch, beads, limb bands, a headdress or crest ornament
//   3 city builders    woven garments over the body, metal bands and a circlet
//   4 planet-shapers   glowing seams and implants, a wrist device, metal tools
//   5 spacefarers      a fitted suit, collar ring, life-support pack, visor, glowing rod
// All of it is drawn from the species' own seed, so it is stable and varied.
import { rng } from './rng.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hsl = (h, s, l) => {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};

// Evolved manipulators each body plan can carry, weighted.
const MANIP_OPTIONS = {
  biped: [['arms', 1]],
  quadruped: [['chest-arms', 3], ['trunk', 2], ['tendrils', 1]],
  hexapod: [['palp-hands', 3], ['chest-arms', 1]],
  arachnid: [['palp-hands', 3], ['tendrils', 1]],
  serpent: [['tendrils', 3], ['chest-arms', 2]],
  slug: [['tendrils', 3], ['trunk', 1]],
  flyer: [['wing-hands', 2], ['chest-arms', 1]],
  floater: [['tentacle-hands', 1]],
  radial: [['tendrils', 2], ['arms', 1]],
  roller: [['arms', 1]],
};
export const MANIP_WORDS = {
  arms: 'jointed arms with fingered hands', 'chest-arms': 'a second, smaller pair of arms on its chest', trunk: 'a prehensile trunk ending in fingers',
  tendrils: 'a ring of fine fingered tendrils', 'palp-hands': 'raised forelimbs ending in fingers', 'wing-hands': 'clawed hands at its wing joints',
  'tentacle-hands': 'long tentacles that end in fingers',
};

export function cultureOf(sp) {
  const level = sp.civilization || 0;
  if (!level) return null;
  const r = rng(sp.seed, 'culture');
  const opts = MANIP_OPTIONS[sp.plan] || [['tendrils', 1]];
  let roll = r() * opts.reduce((a, o) => a + o[1], 0), manip = opts[0][0];
  for (const [k, w] of opts) { roll -= w; if (roll <= 0) { manip = k; break; } }
  if (sp.plan === 'biped' && sp.arms) manip = 'arms'; // already has them
  const clothHue = r.range(0, 360);
  const metal = r.pick(['#b8864a', '#c9a24a', '#a9b4bd', '#8a5a3c', '#d8d2c0']);
  return {
    level, manip, hasArms: sp.plan === 'biped' && sp.arms,
    paint: { color: r.pick(['#f1ece0', '#d9a441', '#b8322a', '#1c1c1e', '#3f7fc0']), style: r.pick(['chevrons', 'dots', 'stripes', 'rings']) },
    cloth: hsl(clothHue, r.range(.35, .7), r.range(.3, .55)), trim: hsl(clothHue + r.pick([150, 180, 40, -40]), r.range(.5, .8), r.range(.45, .65)),
    metal,
    suit: r() < .5 ? hsl(r.range(190, 230), r.range(.05, .2), r.range(.75, .88)) : hsl(r.range(0, 360), r.range(.05, .25), r.range(.16, .26)),
    tech: hsl(r.pick([185, 170, 35, 300, 130, 210]) + r.range(-10, 10), 1, .6),
    tool: r.pick(['spear', 'staff', 'hammer']),
    ornament: r.pick(['plumes', 'crest', 'beads', 'horns']),
    seed: r.int(0, 1e6),
  };
}

// Skin overlay: paint (levels 1-2) and garments or suit over the torso zone (3+).
// zone(pt) returns 0..1 for how far into the clothed zone a point on the body is.
// What each part of a creature is made of, so the shader can give skin, woven cloth,
// suit fabric, metal, wood, glossy bits (eyes, horn, beads) and stone their own surface
// (fauna-mesh.js addAnimation). A colour carries it as .kind; a clone loses it, so tag
// after cloning. Untagged parts are skin (or suit fabric on suited colonists).
export const KIND = { skin: 0, cloth: 1, suit: 2, metal: 3, wood: 4, gloss: 5, stone: 6 };
export const tag = (color, kind) => { color.kind = kind; return color; };

export function cultureSkin(c, THREE, pt, ang, sy, color, zone) {
  if (!c) return color;
  const t = pt.t ?? 0, z = zone ? zone(pt) : 0;
  if (c.level >= 3 && z > 0 && sy > -.75) {
    const k = c.level >= 5 ? KIND.suit : KIND.cloth;
    const cloth = tag(new THREE.Color(c.level >= 5 ? c.suit : c.cloth), k);
    const edge = z < .12; // trim at the hem
    if (edge) return tag(new THREE.Color(c.level >= 5 ? c.tech : c.trim), c.level >= 5 ? KIND.metal : k);
    // Panels on suits, a woven band pattern on garments.
    if (c.level >= 5 && Math.abs(Math.sin(t * 40 + ang * 2)) > .96) return tag(cloth.clone().multiplyScalar(.6), k);
    if (c.level < 5 && Math.sin(t * 60) > .85) return tag(cloth.clone().lerp(new THREE.Color(c.trim), .6), k);
    return cloth;
  }
  if (c.level <= 3 && sy > -.2) {
    const paint = new THREE.Color(c.paint.color);
    const k = c.paint.style === 'chevrons' ? ((t * 14 + Math.abs(Math.cos(ang)) * 1.4) % 1) < .12
      : c.paint.style === 'dots' ? Math.sin(t * 90) * Math.sin(ang * 9) > .82
      : c.paint.style === 'rings' ? Math.abs(Math.sin(t * 9)) > .985
      : Math.abs(Math.cos(ang)) < .07 && t > .2 && t < .8;
    if (k) return color.clone().lerp(paint, .9);
  }
  return color;
}
export function cultureGlow(c, pt, ang, sy, zone) {
  if (!c || c.level < 4 || !zone || zone(pt) <= 0) return 0;
  return Math.abs(sy) < .08 ? .9 : 0; // a glowing seam along each flank
}

// Geometry. kit: { THREE, sp, c, s, tube, ellipsoid, spike, A, P (part ids), col: { base, belly, dark, white, horn }, anchors }
// anchors (each optional): torso/belt/collar { c, axis, rx, ry, anim }, back { p, size, anim },
// head { p, size, anim, ring }, mouth { p, dir, size, anim }, shoulders [{ p, side, anim? }],
// limbs [{ a, b, r, anim }], hands [{ p, dir, anim }] (existing hands).
export function dress(kit) {
  const { THREE, c, s, tube, ellipsoid, spike, A, P, col, anchors } = kit;
  if (!c) return;
  const r = rng(c.seed, 'dress');
  const C = (hex) => new THREE.Color(hex);
  const cloth = tag(C(c.cloth), KIND.cloth), trim = tag(C(c.trim), KIND.cloth), metal = tag(C(c.metal), KIND.metal), tech = tag(C(c.tech), KIND.metal), suit = tag(C(c.suit), KIND.suit), paint = tag(C(c.paint.color), KIND.gloss);
  const V = (a) => new THREE.Vector3(...a);
  const hands = [...(anchors.hands || [])];

  // A closed band round an axis (belt, collar, bracelet, circlet).
  function ring(at, color, { scale = 1.12, thick = .05, glow = 0, tilt = 0 } = {}) {
    if (!at) return;
    const axis = V(at.axis).normalize(), pick = Math.abs(axis.y) > .9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(pick, axis).normalize(), v = new THREE.Vector3().crossVectors(axis, u).normalize();
    const path = [], n = 20;
    for (let k = 0; k <= n; k++) {
      const a = k / n * Math.PI * 2, cu = Math.cos(a) * at.rx * scale, sv = Math.sin(a) * at.ry * scale, off = Math.sin(a) * tilt;
      path.push({ p: [at.c[0] + u.x * cu + v.x * sv + axis.x * off, at.c[1] + u.y * cu + v.y * sv + axis.y * off, at.c[2] + u.z * cu + v.z * sv + axis.z * off], rx: s * thick, ry: s * thick });
    }
    tube(path, 6, () => color, () => at.anim, { capStart: false, capEnd: false, ref: at.axis, glowAt: () => glow });
  }
  // A hand: palm and splayed, curled fingers, pointing along dir.
  function hand(p, dir, size, color, anim, fingers = 3) {
    const d = V(dir).normalize(), side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < .01) side.set(1, 0, 0); side.normalize();
    const curl = new THREE.Vector3().crossVectors(side, d).normalize();
    ellipsoid(p, [size * .9, size * .7, size * .9], color, anim, 1);
    for (let f = 0; f < fingers; f++) {
      const o = (f - (fingers - 1) / 2) * .5, base = V(p).addScaledVector(d, size * .6).addScaledVector(side, o * size);
      const tip = base.clone().addScaledVector(d, size * 1.4).addScaledVector(side, o * size * .5).addScaledVector(curl, -size * .5);
      spike(base.toArray(), tip.toArray(), size * .3, color, anim, { bendDir: curl.toArray(), bend: -size * .3 });
    }
    // An opposable thumb.
    const tb = V(p).addScaledVector(side, size * .8);
    spike(tb.toArray(), tb.clone().addScaledVector(side, size * .6).addScaledVector(d, size * .8).toArray(), size * .28, color, anim);
  }
  // A jointed arm from a shoulder, hanging forward, with a hand.
  function arm(sh, side, len, thick, color, phase) {
    const shoulder = sh, elbow = [sh[0] + side * len * .2, sh[1] - len * .45, sh[2] + len * .12], wrist = [sh[0] + side * len * .15, sh[1] - len * .75, sh[2] + len * .42];
    const path = [];
    const pts = [shoulder, elbow, wrist], radii = [thick, thick * .8, thick * .65];
    for (let i = 0; i < 2; i++) for (let k = 0; k < 3; k++) { const t = k / 3; path.push({ p: pts[i].map((v, j) => v + (pts[i + 1][j] - v) * t), rx: radii[i] + (radii[i + 1] - radii[i]) * t, ry: radii[i] + (radii[i + 1] - radii[i]) * t, seg: i }); }
    path.push({ p: wrist, rx: radii[2], ry: radii[2], seg: 1 });
    tube(path, 7, () => color, (pt) => A(pt.seg === 0 ? P.ARM : P.FOREARM, shoulder, elbow, phase, 1));
    const anim = A(P.FOREARM, shoulder, elbow, phase, 1), dir = [side * .1, -.35, 1];
    hand(wrist, dir, thick * 1.3, col.belly, anim, 3 + (c.seed % 2));
    hands.push({ p: wrist, dir, anim, size: thick * 1.3 });
    anchors.limbs?.push({ a: shoulder, b: elbow, r: thick, anim: A(P.ARM, shoulder, elbow, phase, 1) });
  }
  // A curling tendril from a root, ending in small fingers.
  function tendril(root, dir, len, thick, color, i, pivotAnimPart = P.SWAY) {
    const d = V(dir).normalize(), path = [];
    const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)); if (side.lengthSq() < .01) side.set(1, 0, 0); side.normalize();
    for (let k = 0; k <= 7; k++) {
      const f = k / 7, q = V(root).addScaledVector(d, len * f).addScaledVector(side, Math.sin(f * 3 + i) * len * .12);
      q.y -= f * f * len * .25;
      if (kit.sp.altitude?.[1] === 0) q.y = Math.max(q.y, thick * 1.5); // ground animals' tendrils rest on the ground, not in it
      path.push({ p: q.toArray(), rx: thick * (1 - f * .55), ry: thick * (1 - f * .55), w: f });
    }
    tube(path, 6, () => color, (pt) => A(pivotAnimPart, root, [0, 0, 0], i * 1.1, pt.w * .5));
    const tip = path[path.length - 1].p, tipAnim = A(pivotAnimPart, root, [0, 0, 0], i * 1.1, .5);
    for (let f = -1; f <= 1; f++) {
      const fd = V(dir).normalize().addScaledVector(side, f * .6).normalize();
      spike(tip, V(tip).addScaledVector(fd, thick * 2.4).toArray(), thick * .35, col.belly, tipAnim);
    }
    if (i === 0) hands.push({ p: tip, dir: d.toArray(), anim: tipAnim, size: thick * 1.4 });
  }

  // --- Manipulators ---
  const m = c.manip, sh = anchors.shoulders || [];
  if (m === 'arms' && !c.hasArms) sh.forEach(({ p, side }, i) => arm(p, side, s * .55, s * .045, col.base, i ? Math.PI : 0));
  if (m === 'chest-arms') sh.forEach(({ p, side }, i) => arm(p, side, s * .38, s * .03, col.belly, i ? Math.PI : 0));
  if (m === 'palp-hands') sh.forEach(({ p, side }, i) => arm(p, side, s * .32, s * .025, col.base, i ? Math.PI : 0));
  if (m === 'wing-hands') sh.forEach(({ p, side }) => { hand(p, [side, -.2, .6], s * .04, col.horn, anchors.wingAnim?.(side) || A(P.BODY)); hands.push({ p, dir: [side, -.2, .6], anim: anchors.wingAnim?.(side) || A(P.BODY), size: s * .04 }); });
  if ((m === 'tendrils' || m === 'tentacle-hands') && anchors.mouth) {
    const mo = anchors.mouth, n = m === 'tentacle-hands' ? 3 : 4 + (c.seed % 3), d = V(mo.dir).normalize();
    const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)); if (side.lengthSq() < .01) side.set(1, 0, 0); side.normalize();
    const up2 = new THREE.Vector3().crossVectors(side, d).normalize();
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, off = side.clone().multiplyScalar(Math.cos(a) * mo.size * .5).addScaledVector(up2, Math.sin(a) * mo.size * .5);
      const root = V(mo.p).add(off), dir2 = d.clone().addScaledVector(off.clone().normalize(), .5).normalize();
      tendril(root.toArray(), dir2.toArray(), m === 'tentacle-hands' ? s * .9 : s * .32, s * (m === 'tentacle-hands' ? .03 : .018), col.base.clone().lerp(col.belly, .4), i);
    }
  }
  if (m === 'trunk' && anchors.mouth) {
    const mo = anchors.mouth, root = mo.p, path = [], len = s * .55;
    for (let k = 0; k <= 8; k++) { const f = k / 8; path.push({ p: [root[0], Math.max(s * .06, root[1] - len * f * .8 + Math.sin(f * 3) * len * .05), root[2] + len * (.25 + Math.sin(f * 2.4) * .25)], rx: s * .05 * (1 - f * .5), ry: s * .05 * (1 - f * .5), w: f }); }
    tube(path, 8, (pt) => col.base.clone().lerp(col.belly, pt.w * .4), (pt) => A(P.SWAY, root, [0, 0, 0], 0, pt.w * .4));
    const tip = path[path.length - 1].p, ta = A(P.SWAY, root, [0, 0, 0], 0, .4);
    hand(tip, [0, -.6, .6], s * .035, col.belly, ta, 4);
    hands.push({ p: tip, dir: [0, -.6, .6], anim: ta, size: s * .035 });
  }

  const L = c.level;
  // --- Level 1: a carried tool ---
  const h0 = hands[0];
  if (h0) {
    const len = s * (c.tool === 'hammer' ? .4 : .9), d = V([0, 1, .15]).normalize();
    const a = V(h0.p).addScaledVector(d, -len * .35), b = V(h0.p).addScaledVector(d, len * .65);
    const shaftC = L >= 4 ? tag(metal.clone().lerp(col.dark, .3), KIND.metal) : tag(C('#6b4a2b'), KIND.wood);
    tube([{ p: a.toArray(), rx: s * .012, ry: s * .012 }, { p: b.toArray(), rx: s * .012, ry: s * .012 }], 5, () => shaftC, () => h0.anim);
    if (L >= 5) ellipsoid(b.toArray(), [s * .03, s * .03, s * .03], tech, h0.anim, 1, 1.2);
    else if (c.tool === 'hammer') ellipsoid(b.toArray(), [s * .06, s * .035, s * .035], L >= 3 ? metal : tag(C('#7d7a72'), KIND.stone), h0.anim, 0);
    else if (c.tool === 'spear') spike(b.toArray(), b.clone().addScaledVector(d, s * .1).toArray(), s * .025, L >= 3 ? metal : tag(C('#5d5a55'), KIND.stone), h0.anim);
    else ellipsoid(b.toArray(), [s * .025, s * .025, s * .025], L >= 2 ? metal : paint, h0.anim, 0);
    // Level 4+: a glowing device on the wrist.
    if (L >= 4 && hands[1]) ellipsoid(hands[1].p, [hands[1].size * .9, hands[1].size * .5, hands[1].size * .9], tech, hands[1].anim, 1, .9);
  }

  // --- Level 2: harness, pouch, beads, limb bands, ornament ---
  if (L >= 2) {
    const strapC = tag(L >= 5 ? suit.clone().lerp(col.dark, .4) : L >= 3 ? cloth.clone().lerp(col.dark, .3) : C('#5a3e26'), L >= 5 ? KIND.suit : KIND.cloth);
    ring(anchors.belt || anchors.torso, strapC, { scale: 1.08, thick: .03, glow: L >= 4 ? .6 : 0 });
    if (anchors.torso && L < 5) ring(anchors.torso, strapC, { scale: 1.06, thick: .022, tilt: (anchors.torso.rx + anchors.torso.ry) * .6 }); // a diagonal sash
    if (anchors.torso) {
      const t = anchors.torso, side = r() < .5 ? -1 : 1, axis = V(t.axis).normalize();
      const out = Math.abs(axis.x) > .9 ? [0, 0, 1] : [1, 0, 0];
      const pp = [t.c[0] + out[0] * side * t.rx * 1.08, t.c[1] - t.ry * .25, t.c[2] + out[2] * side * t.rx * 1.08];
      ellipsoid(pp, [s * .05, s * .06, s * .07], L >= 5 ? suit : tag(strapC.clone().lerp(cloth, .5), KIND.cloth), t.anim, 1);
    }
    if (anchors.collar) {
      if (L < 5) for (let k = 0; k < 10; k++) { // beads
        const at = anchors.collar, axis = V(at.axis).normalize(), pick = Math.abs(axis.y) > .9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
        const u = new THREE.Vector3().crossVectors(pick, axis).normalize(), v = new THREE.Vector3().crossVectors(axis, u).normalize(), a = k / 10 * Math.PI * 2;
        const p = V(at.c).addScaledVector(u, Math.cos(a) * at.rx * 1.12).addScaledVector(v, Math.sin(a) * at.ry * 1.12);
        ellipsoid(p.toArray(), [s * .018, s * .018, s * .018], k % 2 ? (L >= 3 ? metal : paint) : tag(C(c.trim), KIND.gloss), at.anim, 0);
      }
      else ring(anchors.collar, metal, { scale: 1.12, thick: .035, glow: 0 });
    }
    for (const lb of (anchors.limbs || []).slice(0, 6)) {
      const mid = lb.a.map((v, j) => v + (lb.b[j] - v) * .45), axis = lb.b.map((v, j) => v - lb.a[j]);
      ring({ c: mid, axis, rx: lb.r, ry: lb.r, anim: lb.anim }, L >= 3 ? metal : strapC, { scale: 1.2, thick: .014, glow: L >= 4 ? .5 : 0 });
    }
    const hd = anchors.head;
    if (hd && !hd.ring && L < 5) {
      const top = [hd.p[0], hd.p[1] + hd.size * .42, hd.p[2] - hd.size * .1];
      if (L >= 3) ring({ c: [hd.p[0], hd.p[1] + hd.size * .25, hd.p[2]], axis: [0, 1, .15], rx: hd.size * .5, ry: hd.size * .5, anim: hd.anim }, metal, { scale: 1, thick: hd.size / s * .07 });
      if (c.ornament === 'plumes') for (let k = -1; k <= 1; k++) spike(top, [top[0] + k * hd.size * .35, top[1] + hd.size * .9, top[2] - hd.size * .5], hd.size * .08, k ? cloth : trim, hd.anim, { bendDir: [0, 0, -1], bend: hd.size * .2 });
      else if (c.ornament === 'crest') for (let k = 0; k < 5; k++) spike([top[0], top[1], top[2] + hd.size * (.25 - k * .15)], [top[0], top[1] + hd.size * (.45 - k * .05), top[2] + hd.size * (.15 - k * .18)], hd.size * .06, k % 2 ? trim : paint, hd.anim);
      else if (c.ornament === 'horns') for (const sd of [-1, 1]) ellipsoid([top[0] + sd * hd.size * .35, top[1], top[2]], [hd.size * .1, hd.size * .1, hd.size * .1], metal, hd.anim, 1);
    }
  }

  // --- Level 5: collar, life-support pack and visor ---
  if (L >= 5) {
    if (anchors.back) {
      const b = anchors.back, sz = b.size;
      ellipsoid([b.p[0], b.p[1] + sz * .35, b.p[2]], [sz * .55, sz * .32, sz * .7], tag(suit.clone().lerp(col.dark, .25), KIND.suit), b.anim, 1);
      ellipsoid([b.p[0], b.p[1] + sz * .55, b.p[2] - sz * .2], [sz * .5, sz * .06, sz * .2], tech, b.anim, 1, 1);
      spike([b.p[0] + sz * .25, b.p[1] + sz * .6, b.p[2] - sz * .3], [b.p[0] + sz * .3, b.p[1] + sz * 1.3, b.p[2] - sz * .5], s * .008, metal, b.anim);
    }
    if (anchors.collar) ring(anchors.collar, tech, { scale: 1.2, thick: .02, glow: .8 });
    const hd = anchors.head;
    if (hd) {
      // A visor across the eyes: an arc round the front of the head, or a full ring round a headless body's eyes.
      const visorC = tag(C('#0d1418').lerp(tech, .25), KIND.gloss);
      const path = [], arc = hd.ring ? Math.PI : 1.25, R = hd.size * (hd.ring ? 1.08 : .58);
      for (let k = 0; k <= 12; k++) { const a = -arc + k / 12 * arc * 2; path.push({ p: [hd.p[0] + Math.sin(a) * R, hd.p[1] + hd.size * (hd.ring ? 0 : .12), hd.p[2] + Math.cos(a) * R], rx: hd.size * .05, ry: hd.size * (hd.ring ? .12 : .16) }); }
      tube(path, 8, () => visorC, () => hd.anim, { glowAt: () => .35, ref: [0, 1, 0] });
    }
  }
}
