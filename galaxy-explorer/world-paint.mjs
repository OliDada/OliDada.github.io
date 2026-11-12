import { giantPixels } from './giant-mesh.js';
// A world's surface map for the star map's world view: rows y0..y1 of a W x H
// equirectangular map, as RGB (0..1) with relief shading baked in (lit from the
// north-west), or a giant's bands. With grad, the relief is not baked: the slope at each
// pixel comes back instead as a 3D vector on the sphere (grad, 3 per pixel), so the globe
// can light it from its own light, with no swirl where the map's north-west turns round a pole. Used on the main thread for the coarse map and by
// world-bake-worker.js for the sharp one.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hexRgb = (hx) => [1, 3, 5].map((i) => parseInt(String(hx || '#888888').slice(i, i + 2), 16) / 255);

export function paintBand(t, body, W, H, y0, y1, grad = null) {
  const col = new Float32Array((y1 - y0) * W * 3);
  if (!t && body.physics?.giant && body.palette && body.rock) { // a giant: the same cloud map its globe wears in flight (giant-mesh.js)
    for (let y = y0; y < y1; y++) {
      const j = H - 1 - y, row = giantPixels(body, W, H, new Uint8Array(W * 4), j, j + 1, true), lat = (.5 - (y + .5) / H) * Math.PI, cl = Math.cos(lat);
      for (let x = 0; x < W; x++) { const i = ((y - y0) * W + x) * 3; for (let k = 0; k < 3; k++) col[i + k] = (row[x * 4 + k] / 255) * (.8 + .2 * cl); }
    }
    return col;
  }
  if (!t) { // a giant: its bands, wavering, paler zones and darker belts, and its storm
    const pal = (body.palette || []).map(hexRgb), seed = (body.seed % 1000) / 159;
    for (let y = y0; y < y1; y++) {
      const lat = (.5 - (y + .5) / H) * Math.PI, cl = Math.cos(lat);
      for (let x = 0; x < W; x++) {
        const lon = ((x + .5) / W - .5) * Math.PI * 2;
        const wave = Math.sin(lat * (body.bands || 8) * 2 + seed + .35 * Math.sin(lon * 3 + lat * 9) + .15 * Math.sin(lon * 11 - lat * 23) + .05 * Math.sin(lon * 37 + lat * 61));
        const a = pal[1] || [.6, .5, .4], z = pal[3] || pal[2] || [.9, .85, .7];
        let c = a.map((v, k) => v + (z[k] - v) * (.5 + .5 * wave));
        const st = body.storm;
        if (st) { const d = Math.hypot((lat - st.lat) * 2.2, (((lon - st.lon + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * cl); const k = Math.max(0, 1 - d / (st.size * 2.4)); if (k > 0) c = c.map((v, j) => v + ((pal[0] || [.6, .3, .2])[j] - v) * k * .8); }
        const i = ((y - y0) * W + x) * 3;
        for (let k = 0; k < 3; k++) col[i + k] = c[k] * (.75 + .25 * cl);
      }
    }
    return col;
  }
  // Heights for the band and a row either side (for the shading), colours for the band.
  const ya = Math.max(0, y0 - 1), yb = Math.min(H, y1 + 1), hgt = new Float32Array((yb - ya) * W);
  const point = (x, y) => { const lat = (.5 - (y + .5) / H) * Math.PI, lon = ((x + .5) / W - .5) * Math.PI * 2, cl = Math.cos(lat); return { x: cl * Math.sin(lon), y: Math.sin(lat), z: cl * Math.cos(lon) }; };
  // Toward the poles a row's pixels crowd together on the ground while the rows stay as far
  // apart: sampled at every pixel, fine grain would smear round the pole in rings (a swirl).
  // So high rows are sampled about as far apart along the row as between rows, and filled in
  // between.
  for (let y = ya; y < yb; y++) {
    const cl = Math.cos((.5 - (y + .5) / H) * Math.PI), step = Math.max(1, Math.min(W / 8, Math.floor(1 / Math.max(cl, 1e-3))));
    const xs = []; for (let x = 0; x < W; x += step) xs.push(x);
    const band = y >= y0 && y < y1, hs = [], cs = [];
    for (const x of xs) {
      const p = point(x, y), h = t.meshHeight(p), wet = t.isLiquid(p);
      hs.push(wet ? (t.sea ?? h) : h);
      if (!band) continue;
      let c = t.color(p, h);
      if (wet) c = t.waterColor.map((v, k) => v * .85 + c[k] * .15);
      cs.push(c);
    }
    for (let q = 0; q < xs.length; q++) {
      const xa = xs[q], xb = q + 1 < xs.length ? xs[q + 1] : W, qb = (q + 1) % xs.length;
      for (let x = xa; x < xb; x++) {
        const f = (x - xa) / (xb - xa);
        hgt[(y - ya) * W + x] = hs[q] + (hs[qb] - hs[q]) * f;
        if (!band) continue;
        const o = ((y - y0) * W + x) * 3, a = cs[q], b = cs[qb];
        col[o] = a[0] + (b[0] - a[0]) * f; col[o + 1] = a[1] + (b[1] - a[1]) * f; col[o + 2] = a[2] + (b[2] - a[2]) * f;
      }
    }
  }
  const R = body.radius || 500, dx = Math.PI * 2 * R / W, dy = Math.PI * R / H;
  for (let y = y0; y < y1; y++) {
    const cl = Math.max(.04, Math.cos((.5 - (y + .5) / H) * Math.PI)), r = y - ya, rn = Math.max(0, r - 1), rs = Math.min(yb - ya - 1, r + 1);
    for (let x = 0; x < W; x++) {
      const hw = hgt[r * W + (x + W - 1) % W], he = hgt[r * W + (x + 1) % W], hn = hgt[rn * W + x], hs = hgt[rs * W + x];
      const o = ((y - y0) * W + x) * 3;
      if (grad) { // east and north slopes, turned into a vector on the sphere
        const lat = (.5 - (y + .5) / H) * Math.PI, lon = ((x + .5) / W - .5) * Math.PI * 2, sl = Math.sin(lat), c = Math.cos(lat), so = Math.sin(lon), co = Math.cos(lon);
        let gE = (he - hw) / (2 * dx * cl), gN = (hn - hs) / (2 * dy); const m = Math.hypot(gE, gN); if (m > .6) { gE *= .6 / m; gN *= .6 / m; }
        grad[o] = gE * co - gN * sl * so; grad[o + 1] = gN * c; grad[o + 2] = -gE * so - gN * sl * co;
        continue;
      }
      const s = 1 + clamp(((hw - he) / (2 * dx * cl) + (hn - hs) / (2 * dy)) * 1.6, -.5, .5);
      col[o] *= s; col[o + 1] *= s; col[o + 2] *= s;
    }
  }
  return col;
}
