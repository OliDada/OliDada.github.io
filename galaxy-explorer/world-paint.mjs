// A world's surface map for the star map's world view: rows y0..y1 of a W x H
// equirectangular map, as RGB (0..1) with relief shading baked in (lit from the
// north-west), or a giant's bands. Used on the main thread for the coarse map and by
// world-bake-worker.js for the sharp one.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hexRgb = (hx) => [1, 3, 5].map((i) => parseInt(String(hx || '#888888').slice(i, i + 2), 16) / 255);

export function paintBand(t, body, W, H, y0, y1) {
  const col = new Float32Array((y1 - y0) * W * 3);
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
  for (let y = ya; y < yb; y++) for (let x = 0; x < W; x++) {
    const p = point(x, y), h = t.meshHeight(p), i = (y - ya) * W + x, wet = t.isLiquid(p);
    hgt[i] = wet ? (t.sea ?? h) : h;
    if (y < y0 || y >= y1) continue;
    let c = t.color(p, h);
    if (wet) c = t.waterColor.map((v, k) => v * .85 + c[k] * .15);
    const o = ((y - y0) * W + x) * 3;
    col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2];
  }
  const R = body.radius || 500, dx = Math.PI * 2 * R / W, dy = Math.PI * R / H;
  for (let y = y0; y < y1; y++) {
    const cl = Math.max(.15, Math.cos((.5 - (y + .5) / H) * Math.PI)), r = y - ya, rn = Math.max(0, r - 1), rs = Math.min(yb - ya - 1, r + 1);
    for (let x = 0; x < W; x++) {
      const hw = hgt[r * W + (x + W - 1) % W], he = hgt[r * W + (x + 1) % W], hn = hgt[rn * W + x], hs = hgt[rs * W + x];
      const s = 1 + clamp(((hw - he) / (2 * dx * cl) + (hn - hs) / (2 * dy)) * 1.6, -.5, .5);
      const o = ((y - y0) * W + x) * 3;
      col[o] *= s; col[o + 1] *= s; col[o + 2] *= s;
    }
  }
  return col;
}
