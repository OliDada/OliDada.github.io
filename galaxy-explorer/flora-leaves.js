// Leafy foliage (new plant style): instead of solid faceted blobs, crowns and bushes are
// made of leaf cards, small crossed quads drawn with a leaf texture whose gaps are cut
// out (alpha test, so no sorting and no blending cost), lit as if the crown were a round
// mass so it shades like foliage, not like flat paper. Each species gets its own texture,
// drawn here from its traits (leaf shape, size, needles or broad leaves) with its own
// random numbers, so every world's leaves look like its own.
//
// leafTexture(THREE, sp): a CanvasTexture, greyscale leaves (tinted by the vertex colours)
//   on a transparent ground, plus an opaque strip at the right edge (OPAQUE_U) for the
//   foliage parts that stay solid (needle skirts, fronds, caps). null without a canvas
//   (tests run in node): the plant then keeps solid foliage.
// leafCards(THREE, radius, r, k): k cards filling a sphere of `radius`, with uvs and
//   outward normals, in place of an IcosahedronGeometry blob.
// leafSurface(THREE, geo, r, k, s): k cards over the surface of any shape (fir skirts,
//   cone- and bowl-shaped crowns, boughs), so no foliage is left as a solid shell.
// Both carry a per-vertex shade (userData.shade): leaves inside and under a crown darker.
import { rng } from './rng.mjs';

export const OPAQUE_U = .97;
const SIZE = 256, LEAF_W = 232; // the leaf cluster fills the left 232 px; the rest is the opaque strip

const canvasFor = () => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(SIZE, SIZE);
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = c.height = SIZE; return c; }
  return null;
};
export const leavesAvailable = () => !!canvasFor();

const cache = new Map();
export function leafTexture(THREE, sp, worldSeed = 0) {
  const key = `${worldSeed}:${sp.id}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = canvasFor();
  if (!canvas) return null;
  const g = canvas.getContext('2d'), r = rng(worldSeed, 'leaves', sp.id);
  g.clearRect(0, 0, SIZE, SIZE);
  g.fillStyle = '#fff'; g.fillRect(LEAF_W, 0, SIZE - LEAF_W, SIZE);
  const needles = sp.form === 'conifer' || sp.form === 'glasstree' || sp.shape?.crown === 'bottlebrush';
  const kind = needles ? 'needle' : { round: 'round', umbrella: 'oval', column: 'long', cluster: r() < .5 ? 'round' : 'lobed' }[sp.leafShape] || 'round';
  const cx = LEAF_W / 2, cy = SIZE / 2, R = LEAF_W * .47;
  const count = needles ? 220 : kind === 'long' ? 90 : 130 + Math.floor(r() * 50);
  const len = (needles ? .11 : kind === 'long' ? .19 : kind === 'oval' ? .1 : .12) * LEAF_W * (.8 + .4 * (sp.leafSize || 1) * .5);
  const grey = (v) => `rgb(${v},${v},${v})`;
  // Twigs first (darker), radiating from the middle, then leaves along and around them.
  g.lineCap = 'round';
  const twigs = needles ? 7 : 5;
  for (let t = 0; t < twigs; t++) {
    const a = t / twigs * Math.PI * 2 + r(), L = R * (.6 + .3 * r());
    g.strokeStyle = grey(70 + (r() * 30 | 0)); g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a + .3) * L * .5, cy + Math.sin(a + .3) * L * .5, cx + Math.cos(a) * L, cy + Math.sin(a) * L); g.stroke();
  }
  for (let i = 0; i < count; i++) {
    // Leaves gather towards the outside of the cluster, each pointing outward.
    const d = R * Math.sqrt(.08 + .92 * r()) * .88, a = r() * Math.PI * 2;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, dir = a + (r() - .5) * .9;
    const s = len * (.65 + .55 * r()) * (1 - .25 * (1 - d / R));
    const shade = 195 + (r() * 60 | 0);
    g.save(); g.translate(x, y); g.rotate(dir);
    if (kind === 'needle') {
      g.strokeStyle = grey(shade); g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(-s * .5, 0); g.lineTo(s * .5, 0); g.stroke();
    } else {
      const w = kind === 'long' ? s * .18 : kind === 'oval' ? s * .42 : kind === 'lobed' ? s * .5 : s * .55;
      g.fillStyle = grey(shade);
      g.beginPath();
      if (kind === 'lobed') { for (let k = 0; k < 3; k++) { g.ellipse(s * (k - 1) * .22, (k - 1) * w * .15, s * .28, w * .45, 0, 0, Math.PI * 2); } }
      else { g.moveTo(-s / 2, 0); g.quadraticCurveTo(0, -w, s / 2, 0); g.quadraticCurveTo(0, w, -s / 2, 0); }
      g.fill();
      g.strokeStyle = grey(Math.max(60, shade - 60)); g.lineWidth = 1; // midrib
      g.beginPath(); g.moveTo(-s * .45, 0); g.lineTo(s * .42, 0); g.stroke();
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

// k cards inside a sphere of radius `radius` (local blob space). Each card is a quad
// about 1.1 radius across, facing a random way, its uvs over the leaf cluster; normals
// point out from the sphere's centre so the mass shades round.
// every, grow: keep only every n-th card, that much bigger (the far model: the same leaves as
// the near one, in the same places, only fewer), from the same random numbers.
export function leafCards(THREE, radius, r, k, card = 0, every = 1, grow = 1) { // card: the cards' half-size (local units); 0: from the radius
  const pos = [], nor = [], uv = [], shade = [];
  const u1 = (LEAF_W - 2) / SIZE;
  for (let c = 0; c < k; c++) {
    // A random point inside the sphere (towards the outside), and a random orientation.
    const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), d = radius * (.35 + .4 * r());
    const C = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) * .8, Math.sin(ph) * Math.sin(th)).multiplyScalar(d);
    const n = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize(), t = new THREE.Vector3(0, 1, 0).cross(n);
    if (t.lengthSq() < 1e-4) t.set(1, 0, 0); t.normalize();
    const b = n.clone().cross(t).normalize(), s = (card || radius * .87) * (.83 + .35 * r()) * grow;
    if (c % every) continue;
    const corner = (a, bb) => C.clone().addScaledVector(t, a * s).addScaledVector(b, bb * s);
    const P = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], U = [[0, 0], [u1, 0], [u1, 1], [0, 1]];
    // Self-shadow: leaves deep inside the crown and on its underside get less light.
    const inner = .8 + .32 * (d / radius - .35) / .4 + .1 * C.y / radius;
    for (const q of [0, 1, 2, 0, 2, 3]) {
      pos.push(P[q].x, P[q].y, P[q].z);
      const o = P[q].clone().normalize().lerp(new THREE.Vector3(0, 1, 0), .25).normalize(); // outward, a little up
      nor.push(o.x, o.y, o.z); uv.push(U[q][0], U[q][1]); shade.push(inner);
    }
  }
  return cardGeometry(THREE, pos, nor, uv, shade);
}
function cardGeometry(THREE, pos, nor, uv, shade) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.userData.cards = true;
  g.userData.shade = shade; // per vertex, multiplies the colour (flora-mesh.js)
  return g;
}

// Leaves over any shape (a fir's skirt of boughs, a cone- or bowl-shaped crown, a flat
// bough): k cards scattered over the surface of `geo` (in its own space, after any
// roughening), each lying roughly along the surface with a random tilt, its normal the
// surface's own, so the shape keeps its outline but is made of leaves, not a solid.
// s: the cards' half-size.
export function leafSurface(THREE, geo, r, k, s, every = 1, grow = 1) {
  const src = geo.index ? geo.toNonIndexed() : geo, P = src.attributes.position;
  const tris = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  let total = 0;
  for (let i = 0; i + 2 < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    const area = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() / 2;
    if (area < 1e-9) continue;
    total += area; tris.push({ i, cum: total });
  }
  src.computeBoundingBox();
  const box = src.boundingBox, mid = box.getCenter(new THREE.Vector3()), span = Math.max(1e-6, box.max.y - box.min.y);
  const pos = [], nor = [], uv = [], shade = [], u1 = (LEAF_W - 2) / SIZE, UP = new THREE.Vector3(0, 1, 0);
  for (let n = 0; n < k && tris.length; n++) {
    const x = r() * total;
    let lo = 0, hi = tris.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (tris[m].cum < x) lo = m + 1; else hi = m; }
    const i = tris[lo].i;
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    let u = r(), v = r(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const C = a.clone().addScaledVector(e1.subVectors(b, a), u).addScaledVector(e2.subVectors(c, a), v);
    const fn = e1.subVectors(b, a).cross(e2.subVectors(c, a)).normalize();
    // Outward from the shape's middle, whichever way the face was wound.
    const out = C.clone().sub(mid); out.y *= .3;
    if (out.lengthSq() > 1e-8 && fn.dot(out) < 0) fn.negate();
    C.addScaledVector(fn, -s * .15); // a little into the shape, so its outline is ragged leaves
    // The card lies along the surface, tilted a random way.
    const n0 = fn.clone().add(new THREE.Vector3(r() - .5, r() - .5, r() - .5).multiplyScalar(1.1)).normalize();
    const t = UP.clone().cross(n0); if (t.lengthSq() < 1e-4) t.set(1, 0, 0); t.normalize();
    const bt = n0.clone().cross(t).normalize(), sz = s * (.75 + .5 * r()) * grow;
    if (n % every) continue;
    const corner = (p, q) => C.clone().addScaledVector(t, p * sz).addScaledVector(bt, q * sz);
    const Q = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], U = [[0, 0], [u1, 0], [u1, 1], [0, 1]];
    const o = fn.clone().lerp(UP, .3).normalize(), low = (C.y - box.min.y) / span;
    const inner = .78 + .3 * low; // undersides and the bottom of a skirt darker
    for (const q of [0, 1, 2, 0, 2, 3]) { pos.push(Q[q].x, Q[q].y, Q[q].z); nor.push(o.x, o.y, o.z); uv.push(U[q][0], U[q][1]); shade.push(inner); }
  }
  if (src !== geo) src.dispose();
  return cardGeometry(THREE, pos, nor, uv, shade);
}
