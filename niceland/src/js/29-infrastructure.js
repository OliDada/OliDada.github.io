/**
 * Power lines, pipelines and lamps
 *
 * Pylons and wires, geothermal pipelines and real street lamps (infra.txt).
 *
 * Functions: fetchInfra, ifAdd, initInfra, ifVisible, plPerp, pipeZ, drawPipes, drawPTower, wireZ,
 *     drawPylons, pylonItems, drawWires
 * State and constants: PL, PIPES, IFB, IPB, IFC
 */

// Pylon heights follow the line voltage when OSM has no height: 220 kV lattice towers about 30 m, 132 kV about 24 m, 33–66 kV about 15 m,
// and the wooden poles of local distribution lines about 8.5 m. Wires sag between supports like a real catenary (drawn as a parabola).
let PL = [],
  PIPES = [],
  IFB = new Map(),
  IPB = new Map();
const IFC = 250;
async function fetchInfra() {
  try {
    const r = await fetch('infra.txt');
    if (!r.ok) return null;
    const b = atob((await r.text()).trim());
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return JSON.parse(
      await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    );
  } catch (e) {
    console.warn('infra', e);
    return null;
  }
}
function ifAdd(x0, y0, x1, y1, v, M) {
  M = M || IFB;
  const i0 = Math.floor(Math.min(x0, x1) / IFC),
    i1 = Math.floor(Math.max(x0, x1) / IFC),
    j0 = Math.floor(Math.min(y0, y1) / IFC),
    j1 = Math.floor(Math.max(y0, y1) / IFC);
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const k = i * 100003 + j;
      let a = M.get(k);
      if (!a) M.set(k, (a = []));
      a.push(v);
    }
}
function initInfra(d) {
  if (!d) return;
  for (const r of d.lines) {
    const [minor, kv, cab, a0] = r;
    // only nodes OSM marks as towers or poles hold the wires up; a "line" with none at all is a mis-tagged cable, so it is skipped
    const keep = [];
    for (let i = 0; i < a0.length / 4; i++) if (a0[4 * i + 2]) keep.push(i);
    if (keep.length < 2) continue;
    const a = [];
    for (const i of keep) a.push(a0[4 * i], a0[4 * i + 1], a0[4 * i + 2], a0[4 * i + 3]);
    const n = a.length / 4;
    const xs = new Float32Array(n),
      ys = new Float32Array(n),
      hs = new Float32Array(n);
    const hv = !minor && kv >= 30,
      H0 = minor || kv < 30 ? 8.5 : kv >= 200 ? 30 : kv >= 100 ? 24 : 15;
    for (let i = 0; i < n; i++) {
      xs[i] = a[4 * i] / 2;
      ys[i] = a[4 * i + 1] / 2;
      const th = a[4 * i + 3] / 2;
      hs[i] = th > 3 && th < 80 ? th : H0;
    }
    const L = {
      id: PL.length,
      minor: !hv,
      kv,
      xs,
      ys,
      hs,
      n,
      arm: hv ? (kv >= 200 ? 7.5 : kv >= 100 ? 5.5 : 3.2) : 0.85,
      earth: hv && kv >= 100
    };
    PL.push(L);
    for (let i = 0; i + 1 < n; i++) ifAdd(xs[i], ys[i], xs[i + 1], ys[i + 1], L.id * 1e5 + i);
  }
  for (const r of d.pipes) {
    const [sub, over, dia, a] = r;
    const n = a.length / 2;
    if (n < 2) continue;
    const xs = new Float32Array(n),
      ys = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = a[2 * i] / 2;
      ys[i] = a[2 * i + 1] / 2;
    }
    let dm = dia > 50 ? dia / 1000 : dia > 0 && dia < 3 ? dia : 0;
    if (!dm) dm = sub === 3 ? 1 : sub === 1 ? 0.7 : 0.5;
    const P = { id: PIPES.length, sub, xs, ys, n, d: Math.min(1.6, Math.max(0.3, dm)) };
    PIPES.push(P);
    for (let i = 0; i + 1 < n; i++) ifAdd(xs[i], ys[i], xs[i + 1], ys[i + 1], P.id * 1e5 + i, IPB);
  }
  // real street lamps replace the evenly spaced ones wherever OSM has mapped them
  const LM = d.lamps;
  if (LM && LM.length) {
    const CC = 30,
      cov = new Set();
    for (let i = 0; i < LM.length; i += 2) {
      const ci = Math.floor(LM[i] / 2 / CC),
        cj = Math.floor(LM[i + 1] / 2 / CC);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) cov.add((ci + di) * 100003 + cj + dj);
    }
    // a spaced-out lamp gives way only where OSM has a real lamp close by, so streets with partly mapped lighting stay lit
    const near = (x, y) => {
      const ci = Math.floor(x / CC),
        cj = Math.floor(y / CC);
      if (!cov.has(ci * 100003 + cj)) return false;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const a = OSL.get((ci + di) * 100003 + cj + dj);
          if (a)
            for (const q of a) if ((LM[q] / 2 - x) ** 2 + (LM[q + 1] / 2 - y) ** 2 < 26 * 26) return true;
        }
      return false;
    };
    const OSL = new Map();
    for (let i = 0; i < LM.length; i += 2) {
      const k = Math.floor(LM[i] / 2 / CC) * 100003 + Math.floor(LM[i + 1] / 2 / CC);
      let a = OSL.get(k);
      if (!a) OSL.set(k, (a = []));
      a.push(i);
    }
    const ox = LAMPX,
      oy = LAMPY;
    LAMPX = [];
    LAMPY = [];
    LBUCK = new Map();
    const add = (x, y) => {
      badd(LBUCK, bkey(x, y), LAMPX.length);
      LAMPX.push(x);
      LAMPY.push(y);
    };
    for (let i = 0; i < ox.length; i++) if (!near(ox[i], oy[i])) add(ox[i], oy[i]);
    const nProc = LAMPX.length;
    for (let i = 0; i < LM.length; i += 2) add(LM[i] / 2, LM[i + 1] / 2);
    console.log('lamps: procedural kept', nProc, 'from OSM', LM.length / 2);
  }
}
function ifVisible(vr, fn, M) {
  M = M || IFB;
  const seen = new Set();
  const i0 = Math.floor(vr[0] / IFC),
    i1 = Math.floor(vr[2] / IFC),
    j0 = Math.floor(vr[1] / IFC),
    j1 = Math.floor(vr[3] / IFC);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 20000) return;
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const a = M.get(i * 100003 + j);
      if (!a) continue;
      for (const v of a) {
        if (seen.has(v)) continue;
        seen.add(v);
        fn(v);
      }
    }
}
// perpendicular to the line at support i (the cross arm points this way)
function plPerp(L, i) {
  const a = Math.max(0, i - 1),
    b = Math.min(L.n - 1, i + 1);
  let dx = L.xs[b] - L.xs[a],
    dy = L.ys[b] - L.ys[a];
  const l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}
function pipeZ(x, y) {
  return hAt(x, y) + 0.9;
}
/* pipes: aluminium-clad steam and hot-water pipes on low supports, following the ground */
function drawPipes() {
  if (!PIPES.length || K < 0.05) return;
  const k = K,
    vr = viewRect(30, 600);
  const segs = [];
  ifVisible(vr, v => segs.push(v), IPB);
  if (!segs.length) return;
  const step = k >= 0.6 ? 6 : k >= 0.2 ? 18 : 60;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pass = (wf, col, dz) => {
    ctx.strokeStyle = col;
    let lastW = -1;
    for (const v of segs) {
      const P = PIPES[(v / 1e5) | 0],
        i = v % 1e5;
      const x0 = P.xs[i],
        y0 = P.ys[i],
        x1 = P.xs[i + 1],
        y1 = P.ys[i + 1];
      const w = Math.max(1, P.d * k * wf);
      if (w !== lastW) {
        ctx.lineWidth = w;
        lastW = w;
      }
      const L = Math.hypot(x1 - x0, y1 - y0),
        n = Math.max(1, Math.ceil(L / step));
      ctx.beginPath();
      for (let q = 0; q <= n; q++) {
        const t = q / n,
          x = x0 + (x1 - x0) * t,
          y = y0 + (y1 - y0) * t,
          s = sp_(x, y, pipeZ(x, y) + P.d * 0.5 + dz);
        q ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
      }
      ctx.stroke();
    }
  };
  // supports first, then the shadow side, then the bright cladding on top
  if (k >= 0.8) {
    ctx.fillStyle = C_([84, 82, 78], 1);
    for (const v of segs) {
      const P = PIPES[(v / 1e5) | 0],
        i = v % 1e5;
      const x0 = P.xs[i],
        y0 = P.ys[i],
        x1 = P.xs[i + 1],
        y1 = P.ys[i + 1],
        L = Math.hypot(x1 - x0, y1 - y0);
      for (let d = 4; d < L; d += 8) {
        const t = d / L,
          x = x0 + (x1 - x0) * t,
          y = y0 + (y1 - y0) * t,
          g = hAt(x, y),
          a = sp_(x, y, g),
          b = sp_(x, y, g + 0.9);
        ctx.fillRect(
          Math.round(a[0]),
          Math.round(b[1]),
          Math.max(1, Math.round(k * 0.3)),
          Math.max(1, Math.round(a[1] - b[1]))
        );
      }
    }
  }
  pass(1, C_([118, 122, 126], 1), -0.08);
  if (k >= 0.35) pass(0.55, C_([196, 200, 204], 1), 0.18);
  ctx.lineCap = 'butt';
}
/* a pylon or a pole, standing at support i of line L */
function drawPTower(L, i) {
  const k = K,
    x = L.xs[i],
    y = L.ys[i],
    z = hAt(x, y),
    h = L.hs[i];
  if (h * k < 2.5) {
    const a = sp_(x, y, z),
      b = sp_(x, y, z + h);
    ctx.fillStyle = C_(L.minor ? [92, 74, 56] : [140, 144, 150], 1);
    ctx.fillRect(Math.round(a[0]), Math.round(b[1]), 1, Math.max(1, Math.round(a[1] - b[1])));
    return;
  }
  const [px, py] = plPerp(L, i),
    P = (u, zz) => sp_(x + px * u, y + py * u, z + zz);
  const line = (a, b) => {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  if (L.minor) {
    // wooden pole with a cross arm
    ctx.strokeStyle = C_([92, 72, 52], 1);
    ctx.lineWidth = Math.max(1, k * 0.28);
    line(P(0, 0), P(0, h));
    ctx.lineWidth = Math.max(1, k * 0.18);
    ctx.strokeStyle = C_([110, 90, 66], 1);
    line(P(-L.arm, h - 0.4), P(L.arm, h - 0.4));
    if (k >= 2) {
      ctx.fillStyle = C_([220, 226, 232], 1);
      for (const u of [-L.arm, 0, L.arm]) {
        const s = P(u, h - 0.25);
        ctx.fillRect(Math.round(s[0]), Math.round(s[1]), 1, 1);
      }
    }
    return;
  }
  // steel lattice tower: legs tapering to a waist, a cross arm with the three phases, an earth-wire peak
  const bw = h * 0.13,
    ww = h * 0.05,
    wz = h * 0.72,
    ar = L.arm,
    az = h * 0.78;
  ctx.strokeStyle = C_([84, 88, 96], 1);
  ctx.lineWidth = Math.max(1.3, k * 0.38);
  line(P(-bw, 0), P(-ww, wz));
  line(P(bw, 0), P(ww, wz));
  line(P(-ww, wz), P(-ww * 0.6, h));
  line(P(ww, wz), P(ww * 0.6, h));
  if (k >= 0.9) {
    ctx.lineWidth = Math.max(1, k * 0.14);
    ctx.strokeStyle = C_([112, 116, 124], 1);
    const nb = 5;
    for (let q = 0; q < nb; q++) {
      const z0 = (wz * q) / nb,
        z1 = (wz * (q + 1)) / nb,
        w0 = bw + ((ww - bw) * q) / nb,
        w1 = bw + ((ww - bw) * (q + 1)) / nb;
      line(P(-w0, z0), P(w1, z1));
      line(P(w0, z0), P(-w1, z1));
      line(P(-w1, z1), P(w1, z1));
    }
  }
  ctx.lineWidth = Math.max(1.3, k * 0.45);
  ctx.strokeStyle = C_([84, 88, 96], 1);
  line(P(-ar, az), P(ar, az));
  if (k >= 0.9) {
    ctx.lineWidth = Math.max(1, k * 0.12);
    line(P(-ar, az), P(-ww, az + h * 0.1));
    line(P(ar, az), P(ww, az + h * 0.1));
  }
  if (k >= 1.4) {
    ctx.fillStyle = C_([200, 206, 214], 1);
    for (const u of [-ar, 0, ar]) {
      const s = P(u, az - 0.6);
      ctx.fillRect(
        Math.round(s[0] - k * 0.15),
        Math.round(s[1]),
        Math.max(1, Math.round(k * 0.3)),
        Math.max(1, Math.round(k * 0.9))
      );
    }
  }
}
function wireZ(L, i) {
  return L.minor ? L.hs[i] - 0.4 : L.hs[i] * 0.78 - 0.9;
}
function drawPylons() {
  if (!PL.length || K < 0.12) return;
  const vr = viewRect(40, 600),
    seen = new Set();
  ifVisible(vr, v => {
    const L = PL[(v / 1e5) | 0],
      i = v % 1e5;
    for (const q of i + 1 === L.n - 1 ? [i, i + 1] : [i]) {
      const key = L.id * 1e5 + q;
      if (seen.has(key)) continue;
      seen.add(key);
      drawPTower(L, q);
    }
  });
}
function pylonItems(vr0, items) {
  if (!PL.length) return;
  const vr = viewRect(40, 600);
  const seen = new Set();
  ifVisible(vr, v => {
    const L = PL[(v / 1e5) | 0],
      i = v % 1e5;
    for (const q of i + 1 === L.n - 1 ? [i, i + 1] : [i]) {
      const key = L.id * 1e5 + q;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push([PYw(L.xs[q], L.ys[q]) + 0.5, 8, [L, q]]);
    }
  });
}
/* the conductors, sagging between supports; drawn last since they hang above everything */
function drawWires() {
  if (!PL.length || K < 0.04) return;
  const k = K,
    vr = viewRect(40, 600);
  const lst = [];
  ifVisible(vr, v => lst.push(v));
  if (!lst.length) return;
  ctx.save();
  ctx.globalAlpha = k < 0.2 ? 0.45 : 0.7;
  ctx.lineWidth = 1;
  for (const v of lst) {
    const L = PL[(v / 1e5) | 0],
      i = v % 1e5,
      x0 = L.xs[i],
      y0 = L.ys[i],
      x1 = L.xs[i + 1],
      y1 = L.ys[i + 1],
      span = Math.hypot(x1 - x0, y1 - y0);
    ctx.strokeStyle = C_(L.minor ? [54, 52, 50] : [70, 74, 80], 1);
    const z0 = hAt(x0, y0) + wireZ(L, i),
      z1 = hAt(x1, y1) + wireZ(L, i + 1),
      sag = Math.min(Math.min(L.hs[i], L.hs[i + 1]) * 0.4, span * (L.minor ? 0.025 : 0.035));
    const offs =
      k < 0.3 ? [0] : L.minor ? [-L.arm, 0, L.arm] : L.earth ? [-L.arm, 0, L.arm, 'e'] : [-L.arm, 0, L.arm];
    const [pa, pb] = [plPerp(L, i), plPerp(L, i + 1)];
    ctx.beginPath();
    for (const o of offs) {
      let u = o,
        za = z0,
        zb = z1;
      if (o === 'e') {
        u = 0;
        za = hAt(x0, y0) + L.hs[i];
        zb = hAt(x1, y1) + L.hs[i + 1];
      }
      const ax = x0 + pa[0] * u,
        ay = y0 + pa[1] * u,
        bx = x1 + pb[0] * u,
        by = y1 + pb[1] * u,
        A = sp_(ax, ay, za),
        B = sp_(bx, by, zb),
        M = sp_((ax + bx) / 2, (ay + by) / 2, (za + zb) / 2 - sag);
      ctx.moveTo(A[0], A[1]);
      ctx.quadraticCurveTo(2 * M[0] - (A[0] + B[0]) / 2, 2 * M[1] - (A[1] + B[1]) / 2, B[0], B[1]);
    }
    ctx.stroke();
  }
  ctx.restore();
}
