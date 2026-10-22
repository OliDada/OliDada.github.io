/**
 * Store fronts, roofs and building records
 *
 * Store-front details, roof shapes on any footprint, and mkB() which creates a building record.
 *
 * Functions: frontEdge, mallEntrances, applyStoreLook, wallQuad, wallText, wallBox, drawStoreFront,
 *     drawStoreRoof, applyLandmarks, roofFromAerial, roofZ, roofH, roofGeneric, hasDormers, roofDetails,
 *     roofBox, insetRing, roofHip, mkB, rotB
 * State and constants: STORE
 */

// Bónus: grey corrugated box, a big yellow sign box standing above the roof with black letters and the pink piggy-bank, yellow-framed glass porch
// Hagkaup: dark grey panelled facade, huge orange-red 3D letters, a full-height glass front
// Krónan: white facade with a long white canopy band, black letters with a yellow smiley for the Ó, glass shop front, yellow posters
// Nettó: dark green ribbed cladding, a tall slate sign tower with white lowercase "nettó", a strip of dark timber, red tomato
const STORE = {
  'Bónus': { wall: [176, 180, 184], rib: 1, roof: [150, 154, 158] },
  'Hagkaup': { wall: [132, 136, 140], panel: 1, roof: [110, 114, 118] },
  'Krónan': { wall: [238, 238, 234], roof: [200, 202, 204] },
  'Nettó': { wall: [52, 76, 70], rib: 1, roof: [60, 72, 70] }
};
function frontEdge(b) {
  if (b.front !== undefined && b.frontOK) return b.front;
  b.frontOK = PROPS_OK;
  const P = b.poly,
    n = b.n;
  let mx = 0;
  const L = [];
  for (let j = 0; j < n; j++) {
    const q = (j + 1) % n;
    const l = Math.hypot(P[2 * q] - P[2 * j], P[2 * q + 1] - P[2 * j + 1]);
    L.push(l);
    mx = Math.max(mx, l);
  }
  let best = -1,
    bd = 1e9;
  for (let j = 0; j < n; j++) {
    if (L[j] < mx * 0.4) continue;
    const q = (j + 1) % n,
      mx_ = (P[2 * j] + P[2 * q]) / 2,
      my = (P[2 * j + 1] + P[2 * q + 1]) / 2;
    // outward normal must point toward the road / car park
    const ex = P[2 * q] - P[2 * j],
      ey = P[2 * q + 1] - P[2 * j + 1],
      l = L[j],
      ar = area2(P) > 0 ? 1 : -1,
      nx = (ar * ey) / l,
      ny = (-ar * ex) / l;
    let d = 1e9;
    eachB2(SBUCK, mx_ - 80, my - 80, mx_ + 80, my + 80, (w, k) => {
      const wy = WAYS[w];
      if (wy.cl > 6) return;
      const a = wy.nodes[k],
        c = wy.nodes[k + 1];
      const t = segD(mx_ + nx * 20, my + ny * 20, NX[a], NY[a], NX[c], NY[c]);
      if (t < d) d = t;
    });
    if (PROPS_OK) {
      const A = nearArea(mx_ + nx * 15, my + ny * 15, 30, [AK.PARKING]);
      if (A) d -= 25;
    }
    if (d < bd) {
      bd = d;
      best = j;
    }
  }
  return (b.front = best < 0 ? 0 : best);
}
function mallEntrances(b) {
  const P = b.poly,
    n = b.n,
    ar = area2(P) > 0 ? 1 : -1,
    out = [];
  for (let j = 0; j < n; j++) {
    const q = (j + 1) % n,
      ex = P[2 * q] - P[2 * j],
      ey = P[2 * q + 1] - P[2 * j + 1],
      l = Math.hypot(ex, ey);
    if (l < 28) continue;
    const nx = (ar * ey) / l,
      ny = (-ar * ex) / l,
      mx = (P[2 * j] + P[2 * q]) / 2 + nx * 20,
      my = (P[2 * j + 1] + P[2 * q + 1]) / 2 + ny * 20;
    let sc = 0;
    if (PROPS_OK && nearArea(mx, my, 25, [AK.PARKING])) sc += 2;
    let d = 1e9;
    eachB2(SBUCK, mx - 60, my - 60, mx + 60, my + 60, (w, k) => {
      const wy = WAYS[w];
      if (wy.cl > 6) return;
      const a = wy.nodes[k],
        c = wy.nodes[k + 1];
      d = Math.min(d, segD(mx, my, NX[a], NY[a], NX[c], NY[c]));
    });
    if (d < 45) sc += 1;
    let inside = false;
    nearB(mx, my, 20, o => {
      if (o !== b && o.state < 2 && pip(o.poly, mx, my)) inside = true;
    });
    if (inside) continue;
    if (sc > 0) out.push([sc * 100 + l, j]);
  }
  out.sort((a, c) => c[0] - a[0]);
  return out.slice(0, 4).map(x => x[1]);
}
function applyStoreLook(b) {
  if (b.brand && BRANDS[b.brand] && BRANDS[b.brand].mall && b.area > 3000) {
    b.mallM = 1;
    b.noWin = 1;
    b.store = 'mall';
    b.signTxt = b.brand.toUpperCase();
    b.rs = 'flat';
    b.roof = 0;
    if (!b.wtag) b.wallC = [206, 208, 210];
    return;
  }
  const T = STORE[b.brand];
  if (!T) return;
  b.wallC = T.wall.slice();
  b.roofC = T.roof.slice();
  b.rs = 'flat';
  b.roof = 0;
  b.noWin = 1;
  b.glass = false;
  b.store = b.brand;
  b.h = Math.max(b.h, 6.5);
  if (T.rib) b.style = 'barn';
}
/* quad in the plane of wall j, t along the wall (0..1), z absolute, o = metres in front of the wall */
function wallQuad(c, b, j, t0, t1, z0, z1, o, col) {
  const P = b.poly,
    q = (j + 1) % b.n,
    k = DK;
  const ex = P[2 * q] - P[2 * j],
    ey = P[2 * q + 1] - P[2 * j + 1],
    l = Math.hypot(ex, ey),
    ar = area2(P) > 0 ? 1 : -1,
    nx = (ar * ey) / l,
    ny = (-ar * ex) / l;
  const W = (t, z) => {
    const x = P[2 * j] + ex * t + nx * o,
      y = P[2 * j + 1] + ey * t + ny * o;
    return [PXw(x, y) * k - DOX, (PYw(x, y) - z) * k - DOY];
  };
  const A = W(t0, z0),
    B2 = W(t1, z0),
    C2 = W(t1, z1),
    D = W(t0, z1);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(A[0], A[1]);
  c.lineTo(B2[0], B2[1]);
  c.lineTo(C2[0], C2[1]);
  c.lineTo(D[0], D[1]);
  c.closePath();
  c.fill();
  return [A, B2, C2, D];
}
function wallText(c, quad, txt, col, font, scale) {
  const [A, B2, C2, D] = quad;
  const sw = Math.hypot(B2[0] - A[0], B2[1] - A[1]),
    ht = Math.abs(D[1] - A[1]);
  if (ht < 4 || sw < 10) return null;
  const fs = Math.min(ht * (scale || 0.78), sw / (txt.length * 0.62));
  if (fs < 4) return null;
  const fl = B2[0] < A[0] ? -1 : 1;
  c.save();
  c.setTransform(
    (fl * (B2[0] - A[0])) / sw,
    (fl * (B2[1] - A[1])) / sw,
    0,
    1,
    (A[0] + B2[0] + C2[0] + D[0]) / 4,
    (A[1] + B2[1] + C2[1] + D[1]) / 4
  );
  c.fillStyle = col;
  c.font = font.replace('#', Math.round(fs));
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(txt, 0, 0);
  const w = c.measureText(txt).width;
  c.restore();
  return {
    fs,
    w,
    fl,
    m: [
      (fl * (B2[0] - A[0])) / sw,
      (fl * (B2[1] - A[1])) / sw,
      (A[0] + B2[0] + C2[0] + D[0]) / 4,
      (A[1] + B2[1] + C2[1] + D[1]) / 4
    ]
  };
}
/* box standing out from wall j: the faces we can see */
function wallBox(c, b, j, t0, t1, z0, z1, o0, o1, col, topCol) {
  const P = b.poly,
    q = (j + 1) % b.n,
    k = DK;
  const ex = P[2 * q] - P[2 * j],
    ey = P[2 * q + 1] - P[2 * j + 1],
    l = Math.hypot(ex, ey),
    ar = area2(P) > 0 ? 1 : -1,
    nx = (ar * ey) / l,
    ny = (-ar * ex) / l;
  const G = (t, o) => [P[2 * j] + ex * t + nx * o, P[2 * j + 1] + ey * t + ny * o];
  const S = (p, z) => [PXw(p[0], p[1]) * k - DOX, (PYw(p[0], p[1]) - z) * k - DOY];
  const C = [G(t0, o0), G(t1, o0), G(t1, o1), G(t0, o1)];
  const quad = (a, bb, z, zz, cl) => {
    const A = S(a, z),
      B2 = S(bb, z),
      C2 = S(bb, zz),
      D = S(a, zz);
    c.fillStyle = cl;
    c.beginPath();
    c.moveTo(A[0], A[1]);
    c.lineTo(B2[0], B2[1]);
    c.lineTo(C2[0], C2[1]);
    c.lineTo(D[0], D[1]);
    c.closePath();
    c.fill();
  };
  const sides = [
    [C[3], C[2], nx, ny],
    [C[0], C[3], -ex / l, -ey / l],
    [C[2], C[1], ex / l, ey / l]
  ];
  for (const [a, bb, fx, fy] of sides) if (faces(fx, fy) > 0) quad(a, bb, z0, z1, col(wallShade(fx, fy)));
  if (topCol) {
    c.fillStyle = topCol;
    c.beginPath();
    C.forEach((p, i) => {
      const s = S(p, z1);
      i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
    });
    c.closePath();
    c.fill();
  }
}
function drawStoreFront(c, b, zb, z1) {
  const k = DK;
  if (k < 0.3) return;
  const j = frontEdge(b),
    P = b.poly,
    q = (j + 1) % b.n;
  const ex = P[2 * q] - P[2 * j],
    ey = P[2 * q + 1] - P[2 * j + 1],
    L = Math.hypot(ex, ey),
    ar = area2(P) > 0 ? 1 : -1;
  const vis = faces(ar * ey, -ar * ex) > 0;
  const H = z1 - zb;
  const sh = wallShade(ar * ey, -ar * ex);
  if (b.store === 'mall') {
    if (!b.entrOK) {
      b.entr = mallEntrances(b);
      b.entrOK = PROPS_OK;
    }
    const Pp = b.poly,
      arr = area2(Pp) > 0 ? 1 : -1;
    for (const e of b.entr || []) {
      const q2 = (e + 1) % b.n,
        ex2 = Pp[2 * q2] - Pp[2 * e],
        ey2 = Pp[2 * q2 + 1] - Pp[2 * e + 1],
        L2 = Math.hypot(ex2, ey2);
      const v2 = faces(arr * ey2, -arr * ex2) > 0,
        sh2 = wallShade(arr * ey2, -arr * ex2);
      // panel bands along the whole wall
      if (v2) {
        wallQuad(c, b, e, 0, 1, zb + H * 0.62, zb + H * 0.66, 0.02, N_([176, 178, 182], sh2));
        wallQuad(c, b, e, 0, 1, z1 - 0.6, z1, 0.02, N_([160, 162, 166], sh2));
      }
      const w = Math.min(0.45, 16 / L2),
        t0 = 0.5 - w / 2,
        t1 = 0.5 + w / 2,
        eh = Math.min(H * 0.85, 9);
      wallBox(c, b, e, t0, t1, zb, zb + eh, 0, 3.5, f => N_([110, 140, 160], f), N_([150, 176, 190], 1));
      wallBox(
        c,
        b,
        e,
        t0 - 0.02,
        t1 + 0.02,
        zb + eh,
        zb + eh + 0.6,
        0,
        4.5,
        f => N_([60, 64, 70], f),
        N_([84, 88, 94], 1)
      );
      if (v2 && k >= 0.6) {
        const nm = Math.max(3, Math.round((w * L2) / 2));
        c.strokeStyle = N_([200, 206, 210], 1);
        c.lineWidth = 1;
        for (let i = 0; i <= nm; i++) {
          const t = t0 + ((t1 - t0) * i) / nm;
          wallQuad(c, b, e, t, t + 0.15 / L2, zb, zb + eh, 3.51, N_([200, 206, 210], 1));
        }
        const qd = wallQuad(
          c,
          b,
          e,
          0.5 - Math.min(0.4, 24 / L2),
          0.5 + Math.min(0.4, 24 / L2),
          zb + eh + 1.2,
          Math.min(z1 - 0.8, zb + eh + 4.2),
          0.03,
          N_([48, 52, 58], 1)
        );
        wallText(c, qd, b.signTxt, N_([255, 255, 255], 1), 'bold #px "Pixelify Sans",sans-serif', 0.75);
      }
    }
    return;
  }
  if (b.store === 'Bónus') {
    if (!vis) return;
    const w = Math.min(0.5, 22 / L),
      t0 = 0.5 - w / 2 - 0.08,
      t1 = t0 + w; // glass porch with yellow frames
    wallBox(c, b, j, t0, t1, zb, zb + 3.4, 0, 3.2, f => N_([150, 176, 190], f * 0.95), N_([255, 206, 0], 1));
    if (k >= 1) {
      const nm = Math.max(3, Math.round((w * L) / 1.6));
      for (let i = 0; i <= nm; i++) {
        const t = t0 + ((t1 - t0) * i) / nm;
        wallQuad(c, b, j, t, t + (0.05 / L) * 6, zb, zb + 3.4, 3.2, N_([255, 206, 0], 1));
      }
      wallQuad(c, b, j, t0, t1, zb + 3.1, zb + 3.4, 3.2, N_([255, 206, 0], 1));
    }
  }
  if (b.store === 'Hagkaup') {
    if (!vis) return; // full-height glass
    wallQuad(c, b, j, 0.08, 0.92, zb, zb + Math.min(H * 0.45, 4), 0.05, N_([88, 112, 128], sh));
    if (k >= 1) {
      c.strokeStyle = N_([150, 154, 158], 1);
      c.lineWidth = 1;
      const nm = Math.round((L * 0.84) / 3);
      for (let i = 0; i <= nm; i++) {
        const t = 0.08 + (0.84 * i) / nm;
        const qd = wallQuad(
          c,
          b,
          j,
          t,
          t + 0.12 / L,
          zb,
          zb + Math.min(H * 0.45, 4),
          0.06,
          N_([150, 154, 158], 1)
        );
      }
    }
    const qd = wallQuad(
      c,
      b,
      j,
      0.1,
      0.9,
      zb + H * 0.55,
      zb + H * 0.92,
      0.05,
      N_(STORE.Hagkaup.wall, sh * 0.97)
    );
    wallText(c, qd, 'HAGKAUP', N_([214, 92, 44], 1), 'bold #px Georgia,serif', 0.95);
  }
  if (b.store === 'Krónan') {
    if (!vis) return; // glass shop front, canopy band, black letters
    wallQuad(c, b, j, 0.15, 0.75, zb, zb + 2.8, 0.05, N_([96, 128, 150], sh));
    wallQuad(c, b, j, 0.78, 0.92, zb + 0.3, zb + 2.8, 0.06, N_([250, 214, 20], 1));
    wallBox(
      c,
      b,
      j,
      0.04,
      0.96,
      zb + 2.9,
      zb + 3.6,
      0,
      1.6,
      f => N_([248, 248, 246], f),
      N_([236, 236, 234], 1)
    );
    const qd = wallQuad(
      c,
      b,
      j,
      0.25,
      0.75,
      zb + 3.9,
      Math.min(z1 - 0.3, zb + 6),
      0.03,
      N_([240, 240, 236], sh)
    );
    const r = wallText(c, qd, 'KRÓNAN', N_([34, 34, 36], 1), 'bold #px "Pixelify Sans",sans-serif', 0.8);
    if (r && k >= 0.8) {
      c.save();
      c.setTransform(r.m[0], r.m[1], 0, 1, r.m[2], r.m[3]);
      c.fillStyle = N_([255, 216, 0], 1);
      c.beginPath();
      c.arc(-r.w * 0.083, 0, r.fs * 0.36, 0, 7);
      c.fill();
      c.fillStyle = N_([30, 30, 30], 1);
      const e = r.fs * 0.06;
      c.fillRect(-r.w * 0.083 - r.fs * 0.12, -r.fs * 0.1, Math.max(1, e), Math.max(1, e));
      c.fillRect(-r.w * 0.083 + r.fs * 0.08, -r.fs * 0.1, Math.max(1, e), Math.max(1, e));
      c.fillRect(-r.w * 0.083 - r.fs * 0.12, r.fs * 0.1, r.fs * 0.24, Math.max(1, e));
      c.restore();
    }
  }
}
function drawStoreRoof(c, b, zb, z1) {
  if (!b.store || DK < 0.3) return;
  const j = frontEdge(b),
    P = b.poly,
    q = (j + 1) % b.n;
  const ex = P[2 * q] - P[2 * j],
    ey = P[2 * q + 1] - P[2 * j + 1],
    L = Math.hypot(ex, ey),
    ar = area2(P) > 0 ? 1 : -1,
    k = DK;
  if (b.store === 'Nettó') {
    const vis = faces(ar * ey, -ar * ex) > 0,
      sh = wallShade(ar * ey, -ar * ex); // tall slate sign tower at the corner of the front, timber strip next to it

    wallBox(c, b, j, 0, 0.22, zb, z1 + 3.5, -0.2, 0.8, f => N_([62, 76, 74], f), N_([70, 84, 82], 1));
    if (vis) {
      wallQuad(c, b, j, 0.22, 0.34, zb + 0.2, z1 - 0.2, 0.05, N_([96, 74, 56], sh));
      const qd = wallQuad(c, b, j, 0.01, 0.21, z1 - 0.2, z1 + 3, 0.81, N_([62, 76, 74], sh));
      wallText(c, qd, 'nettó', N_([240, 240, 236], 1), 'bold #px Georgia,serif', 0.6);
      wallQuad(c, b, j, 0.05, 0.18, zb, zb + 2.6, 0.82, N_([60, 52, 40], sh));
      if (k >= 1.3) {
        const qd2 = wallQuad(c, b, j, 0.17, 0.19, zb + 3.4, zb + 4.4, 0.82, N_([214, 44, 36], 1));
      }
    }
  }
  if (b.store === 'mall') {
    // glass skylight running down the spine of the mall
    const o = obbOf(b),
      S = (x, y, z) => [PXw(x, y) * k - DOX, (PYw(x, y) - z) * k - DOY],
      Wp = (u, v) => [b.cx + o.ux * u - o.uy * (v + o.vm), b.cy + o.uy * u + o.ux * (v + o.vm)];
    const hw = Math.min(4, o.hw * 0.18),
      u0 = o.u0 + o.L * 0.12,
      u1 = o.u1 - o.L * 0.12;
    const pts = [Wp(u0, -hw), Wp(u1, -hw), Wp(u1, hw), Wp(u0, hw)];
    if (pip(b.poly, ...Wp((u0 + u1) / 2, 0))) {
      c.fillStyle = N_([150, 180, 196], 1);
      c.beginPath();
      pts.forEach((p2, i) => {
        const s2 = S(p2[0], p2[1], z1 + 0.9);
        i ? c.lineTo(s2[0], s2[1]) : c.moveTo(s2[0], s2[1]);
      });
      c.closePath();
      c.fill();
      c.strokeStyle = N_([210, 220, 226], 1);
      c.lineWidth = 1;
      c.beginPath();
      for (let u = u0; u <= u1; u += 4) {
        const a2 = S(...Wp(u, -hw), z1 + 0.9),
          b2 = S(...Wp(u, hw), z1 + 0.9);
        c.moveTo(a2[0], a2[1]);
        c.lineTo(b2[0], b2[1]);
      }
      c.stroke();
    }
    return;
  }
  if (b.store !== 'Bónus') return;
  const w = Math.min(0.6, 16 / L),
    t0 = 0.5 - w / 2,
    t1 = 0.5 + w / 2;
  wallBox(c, b, j, t0, t1, z1 - 0.4, z1 + 3.4, -1.2, 0.2, f => N_([255, 214, 0], f), N_([255, 222, 40], 1));
  const fv = faces(ar * ey, -ar * ex) > 0;
  {
    const qd = wallQuad(
      c,
      b,
      j,
      fv ? t0 + 0.01 : t1 - 0.01,
      fv ? t1 - 0.01 : t0 + 0.01,
      z1,
      z1 + 3.2,
      fv ? 0.21 : -1.21,
      N_([255, 214, 0], 1)
    );
    const r = wallText(c, qd, 'B    NUS', N_([20, 20, 20], 1), 'bold #px "Pixelify Sans",sans-serif', 0.82);
    // the pink piggy bank sits in the gap where the Ó would be
    if (r) {
      c.save();
      c.setTransform(r.m[0], r.m[1], 0, 1, r.m[2], r.m[3]);
      c.font = 'bold ' + Math.round(r.fs) + 'px "Pixelify Sans",sans-serif';
      const wB = c.measureText('B').width,
        wS = c.measureText('    ').width,
        px = -r.w / 2 + wB + wS / 2,
        rx = Math.min(r.fs * 0.46, wS * 0.42),
        ry = rx * 0.8;
      c.fillStyle = N_([240, 120, 160], 1);
      c.beginPath();
      c.ellipse(px, 0, rx, ry, 0, 0, 7);
      c.fill();
      c.fillRect(px - rx * 0.55, ry * 0.6, rx * 0.25, ry * 0.55);
      c.fillRect(px + rx * 0.3, ry * 0.6, rx * 0.25, ry * 0.55);
      c.beginPath();
      c.ellipse(px + rx * 0.95, 0, rx * 0.22, ry * 0.3, 0, 0, 7);
      c.fill();
      c.fillStyle = N_([30, 30, 30], 1);
      c.beginPath();
      c.arc(px + rx * 0.45, -ry * 0.25, Math.max(0.8, r.fs * 0.05), 0, 7);
      c.fill();
      c.fillRect(px - rx * 0.15, -ry * 0.95, rx * 0.35, Math.max(1, ry * 0.12));
      c.restore();
    }
  }
}

function applyLandmarks() {
  setupPerlan();
  const add = [];
  const seen = new Set();
  const HP = new Set();
  for (const b of B) if (b.po) HP.add(b.po - 1);
  for (const b of B) {
    const L = LANDMARKS[b.name];
    if (!L || b.sp === 1 || b.sp === 2 || b.sp === 3) continue;
    // famous ones only near their real place (names like Höfði repeat around the country)
    const far = Math.hypot(b.cx + 2400, b.cy + 2400) > 12000 && !/Akureyr|Hof$/.test(b.name);
    if (far) continue;
    if (L.onlyTall && b.h < 40) continue;
    if (seen.has(b.name) && L.tw) continue;
    seen.add(b.name);
    const isP = !!b.po,
      hasP = HP.has(b.bi);
    b.sp = 0;
    if (!b.wtag) b.wallC = L.w;
    if (L.r && !b.aerial) b.roofC = L.r;
    if (L.h && !isP && !hasP) b.h = L.h;
    if (L.glass) b.glass = true;
    if (L.style) b.style = L.style;
    b.lm = 1;
    if (L.rs && !isP && !hasP && !b.rhT) {
      b.rs = L.rs;
      b.rp = L.rp || b.rp || 0.5;
      b.roof = L.rs === 'flat' || L.rs === 'mono' ? 0 : 9;
    }
    if (L.tw && !isP && !hasP) {
      const o = obbOf(b);
      const dir = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[L.tw.at];
      const end = o.ux * dir[0] + o.uy * dir[1] >= 0 ? 1 : -1;
      const s2 = L.tw.s / 2,
        uc = end > 0 ? o.u1 - s2 : o.u0 + s2,
        vc = o.vm;
      const x = b.cx + o.ux * uc - o.uy * vc,
        y = b.cy + o.uy * uc + o.ux * vc,
        ang = Math.atan2(o.uy, o.ux);
      const t = mkB(rotPoly(x, y, ang, -s2, s2, -s2, s2), {
        h: L.tw.h,
        base: 0,
        kind: 8,
        roof: L.tw.sp ? 3 : 0,
        sp: 0,
        name: b.name,
        addr: b.addr,
        use: b.use,
        res: 0,
        jobs: 0
      });
      t.wallC = L.w;
      t.roofC = b.roofC;
      t.spire = L.tw.sp || 0;
      t.lm = 1;
      t.group = 'lm' + b.id;
      b.group = t.group;
      add.push(t);
    }
  }
  for (const t of add) B.push(t);
  for (let i = 0; i < B.length; i++) B[i].id = i;
}
function roofFromAerial(c) {
  // white-balance the 2025 photo (it has a magenta cast), restore saturation lost to haze, compress glare
  let r = c[0] * 0.96,
    gg = c[1] * 1.035,
    b = c[2] * 0.985;
  const L = r * 0.3 + gg * 0.59 + b * 0.11,
    S = 1.55;
  r = L + (r - L) * S;
  gg = L + (gg - L) * S;
  b = L + (b - L) * S;
  const L2 = Math.max(1, r * 0.3 + gg * 0.59 + b * 0.11),
    t = L2 > 190 ? (190 + (L2 - 190) * 0.35) / L2 : L2 < 50 ? 1.15 : 0.97;
  return [
    Math.max(0, Math.min(255, r * t)),
    Math.max(0, Math.min(255, gg * t)),
    Math.max(0, Math.min(255, b * t))
  ];
}
/* height of the roof surface above the eaves at a world point */
function roofZ(b, x, y) {
  const o = obbOf(b),
    dx = x - b.cx,
    dy = y - b.cy,
    v = -dx * o.uy + dy * o.ux - o.vm;
  const rh = roofH(b);
  if (b.rs === 'mono') return rh * (0.5 - v / (2 * o.hw));
  return Math.max(0, rh * (1 - Math.abs(v) / o.hw));
}
function roofH(b) {
  if (b.rhT) return b.rhT;
  const o = obbOf(b);
  if (b.rs === 'mono') return Math.min(2.2, o.hw * 0.35);
  return Math.min(b.kind === 2 ? 4.5 : 6, o.hw * (b.rp || 0.6));
}
/* draw a gable or mono-pitch roof over any footprint: walls extended up to the roof line, then the roof planes */
function roofGeneric(c, b, P, z1, rc, wc, sc) {
  const k = DK,
    n = b.n,
    o = obbOf(b);
  // split edges where they cross the ridge so each roof half is planar
  const pts = [];
  const vOf = (x, y) => -(x - b.cx) * o.uy + (y - b.cy) * o.ux - o.vm;
  for (let j = 0; j < n; j++) {
    const q = (j + 1) % n,
      x0 = P[2 * j],
      y0 = P[2 * j + 1],
      x1 = P[2 * q],
      y1 = P[2 * q + 1],
      v0 = vOf(x0, y0),
      v1 = vOf(x1, y1);
    pts.push([x0, y0, v0]);
    if (b.rs !== 'mono' && v0 < 0 !== v1 < 0 && Math.abs(v0 - v1) > 1e-6) {
      const t = v0 / (v0 - v1);
      pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0]);
    }
  }
  const S = (x, y, z) => [PXw(x, y) * k - DOX, (PYw(x, y) - z) * k - DOY];
  const zr = p => z1 + roofZ(b, p[0], p[1]);
  const fill = (arr, cl) => {
    if (arr.length < 3) return;
    c.fillStyle = cl;
    c.beginPath();
    arr.forEach((p, i) => {
      const s = S(p[0], p[1], zr(p));
      i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
    });
    c.closePath();
    c.fill();
  };
  // roof plane normals (pointing up-out): for +v half the slope descends toward +v
  const nP = [-o.uy, o.ux],
    nN = [o.uy, -o.ux];
  const fP = faces(nP[0], nP[1]) > 0,
    fN = faces(nN[0], nN[1]) > 0;
  const sh = nn => 0.98 + 0.12 * Math.sign(nn[0] * SXx + nn[1] * SXy);
  const halfP = pts.filter(p => p[2] >= -1e-6),
    halfN = pts.filter(p => p[2] <= 1e-6);
  const backFirst = b.rs === 'mono' ? [] : fP ? [[halfN, nN]] : [[halfP, nP]];
  for (const [h, nn] of backFirst) fill(h, col(rc, 0.8 * sc));
  // wall extensions (gable ends and the high side of mono roofs)
  const m = pts.length;
  for (let j = 0; j < m; j++) {
    const a = pts[j],
      q = pts[(j + 1) % m];
    const ex = q[0] - a[0],
      ey = q[1] - a[1];
    if (faces(ey, -ex) <= 0) continue;
    const za = roofZ(b, a[0], a[1]),
      zq = roofZ(b, q[0], q[1]);
    if (za < 0.05 && zq < 0.05) continue;
    const A = S(a[0], a[1], z1),
      B = S(q[0], q[1], z1),
      C2 = S(q[0], q[1], z1 + zq),
      D = S(a[0], a[1], z1 + za);
    c.fillStyle = col(wc, wallShade(ey, -ex) * sc);
    c.beginPath();
    c.moveTo(A[0], A[1]);
    c.lineTo(B[0], B[1]);
    c.lineTo(C2[0], C2[1]);
    c.lineTo(D[0], D[1]);
    c.closePath();
    c.fill();
  }
  if (b.rs === 'mono') fill(pts, col(rc, 1.02 * sc));
  else for (const [h, nn] of fP ? [[halfP, nP]] : [[halfN, nN]]) fill(h, col(rc, sh(nn) * sc));
  if (b.rs === 'gable' && k >= 1.6 && b.state !== 3) roofDetails(c, b, P, z1, rc, wc, sc, o, fP ? 1 : -1, S);
  // ridge line and eaves
  if (k >= 1.6 && b.rs !== 'mono') {
    const r0 = [b.cx + o.ux * o.u0 - o.uy * o.vm, b.cy + o.uy * o.u0 + o.ux * o.vm],
      r1 = [b.cx + o.ux * o.u1 - o.uy * o.vm, b.cy + o.uy * o.u1 + o.ux * o.vm];
    // clip the ridge to the footprint
    const segs = [];
    let inside = false,
      st = null;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const x = r0[0] + (r1[0] - r0[0]) * t,
        y = r0[1] + (r1[1] - r0[1]) * t,
        i2 = pip(P, x, y);
      if (i2 && !inside) {
        st = [x, y];
        inside = true;
      }
      if ((!i2 || t >= 1) && inside) {
        segs.push([st, [x, y]]);
        inside = false;
      }
    }
    c.strokeStyle = col(rc, 0.66 * sc);
    c.lineWidth = Math.max(1, k * 0.18);
    for (const [s0, s1] of segs) {
      const A = S(s0[0], s0[1], z1 + roofH(b)),
        B2 = S(s1[0], s1[1], z1 + roofH(b));
      c.beginPath();
      c.moveTo(A[0], A[1]);
      c.lineTo(B2[0], B2[1]);
      c.stroke();
    }
  }
  // chimney on older houses
  if (k >= 2 && b.kind <= 1 && b.yr && b.yr < 1966) {
    const x = b.cx + o.ux * o.L * 0.18,
      y = b.cy + o.uy * o.L * 0.18,
      zt = z1 + roofZ(b, x, y);
    const s = S(x, y, zt);
    c.fillStyle = col([150, 146, 140], 1);
    c.fillRect(
      Math.round(s[0]),
      Math.round(s[1] - k * 1.4),
      Math.max(1, Math.round(k * 0.8)),
      Math.max(1, Math.round(k * 1.6))
    );
  }
}
/* dormers (kvistir) on older gabled houses and a small attic window in the gable ends */
function hasDormers(b) {
  if (b.dorm !== undefined) return b.dorm;
  const o = obbOf(b),
    old = (b.yr && b.yr < 1950) || (!b.yr && b.style === 'iron');
  return (b.dorm =
    b.kind <= 1 && old && !b.lm && o.L >= 6.5 && o.hw >= 3 && roofH(b) >= 2.3 && h32(b.id, 9, 9) < 0.75
      ? o.L >= 12.5
        ? 2
        : 1
      : 0);
}
function roofDetails(c, b, P, z1, rc, wc, sc, o, sg, S) {
  const rh = roofH(b),
    k = DK;
  const W = (u, v) => [b.cx + o.ux * u - o.uy * (v + o.vm), b.cy + o.uy * u + o.ux * (v + o.vm)];
  const Sw = (u, v, z) => {
    const p = W(u, v);
    return S(p[0], p[1], z);
  };
  const poly = (pts, cl) => {
    c.fillStyle = cl;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
    c.fill();
  };
  const nd = hasDormers(b);
  if (nd) {
    const um = (o.u0 + o.u1) / 2,
      us = nd === 2 ? [um - o.L * 0.22, um + o.L * 0.22] : [um];
    const wd = Math.min(2.6, o.L * (nd === 2 ? 0.2 : 0.3)),
      hd = wd / 2;
    const vf = 0.66 * o.hw,
      zf = rh * (1 - vf / o.hw);
    let top = Math.min(zf + 1.45, rh * 0.78);
    const zr = Math.min(top + Math.min(0.9, hd * 0.7), rh * 0.95);
    if (top - zf < 0.7) return;
    const vTop = o.hw * (1 - top / rh),
      vRid = o.hw * (1 - zr / rh); // where the dormer's eaves and ridge meet the main roof
    for (const u of us) {
      const fp = W(u, sg * vf);
      if (!pip(P, fp[0], fp[1])) continue;
      const F = v => sg * v;
      // side cheeks (only the one facing the camera)
      const sideU = faces(o.ux, o.uy) > 0 ? u + hd : u - hd;
      const sn = faces(o.ux, o.uy) > 0 ? 1 : -1;
      poly(
        [Sw(sideU, F(vf), z1 + zf), Sw(sideU, F(vf), z1 + top), Sw(sideU, F(vTop), z1 + top)],
        col(wc, wallShade(o.ux * sn, o.uy * sn) * 0.92 * sc)
      );
      // front wall + its little gable
      const nF = [-o.uy * sg, o.ux * sg];
      const ws = wallShade(nF[0], nF[1]) * sc;
      poly(
        [
          Sw(u - hd, F(vf), z1 + zf),
          Sw(u + hd, F(vf), z1 + zf),
          Sw(u + hd, F(vf), z1 + top),
          Sw(u, F(vf), z1 + zr),
          Sw(u - hd, F(vf), z1 + top)
        ],
        col(wc, ws)
      );
      // window
      const a = Sw(u - hd * 0.55, F(vf), z1 + top - 0.15),
        b2 = Sw(u + hd * 0.55, F(vf), z1 + zf + 0.25);
      c.fillStyle = col([242, 242, 238], 1);
      c.fillRect(
        Math.round(Math.min(a[0], b2[0])) - 1,
        Math.round(a[1]) - 1,
        Math.round(Math.abs(b2[0] - a[0])) + 2,
        Math.round(b2[1] - a[1]) + 2
      );
      c.fillStyle = col([50, 66, 86], 1);
      c.fillRect(
        Math.round(Math.min(a[0], b2[0])),
        Math.round(a[1]),
        Math.max(1, Math.round(Math.abs(b2[0] - a[0]))),
        Math.max(1, Math.round(b2[1] - a[1]))
      );
      // dormer roof: two planes from the front gable back to the main roof

      for (const sd of sn > 0 ? [-1, 1] : [1, -1])
        poly(
          [
            Sw(u, F(vf + 0.25), z1 + zr + 0.05),
            Sw(u + sd * (hd + 0.2), F(vf + 0.25), z1 + top - 0.12),
            Sw(u + sd * (hd + 0.2), F(vTop), z1 + top - 0.12),
            Sw(u, F(vRid), z1 + zr + 0.05)
          ],
          col(rc, (sd === sn ? 1.04 : 0.86) * sc)
        );
    }
  }
  // attic window in each visible gable end of older/medium houses
  if (
    ((b.yr && b.yr < 1966) || b.style === 'iron' || b.style === 'farm') &&
    b.kind <= 1 &&
    rh >= 2.2 &&
    k >= 1.6
  ) {
    for (const end of [o.u0, o.u1]) {
      const en = end === o.u0 ? -1 : 1;
      if (faces(o.ux * en, o.uy * en) <= 0) continue;
      const p = W(end, 0);
      const p2 = W(end - en * 0.6, 0);
      if (!pip(P, p2[0], p2[1])) continue;
      const zc = z1 + rh * 0.42,
        a = S(p[0], p[1], zc + 0.55),
        ww = Math.max(1, Math.round(k * 0.8)),
        hh = Math.max(1, Math.round(k * 1.05));
      {
        const e1 = W(end, -1),
          e2 = W(end, 1),
          s1 = S(e1[0], e1[1], zc),
          s2 = S(e2[0], e2[1], zc);
        SKS =
          Math.abs(s2[0] - s1[0]) > 0.3
            ? Math.max(-2.5, Math.min(2.5, (s2[1] - s1[1]) / (s2[0] - s1[0])))
            : 0;
        SKA = a[0];
      }
      c.fillStyle = col([242, 242, 238], 1);
      FR(c, Math.round(a[0] - ww / 2) - 1, Math.round(a[1]) - 1, ww + 2, hh + 2);
      c.fillStyle = col([50, 66, 86], 1);
      FR(c, Math.round(a[0] - ww / 2), Math.round(a[1]), ww, hh);
    }
  }
}
/* a small oriented box standing on a roof (lift machine rooms, stair heads) */
function roofBox(c, x, y, z, ang, hu, hv, h, wc, rc, sc) {
  const k = DK,
    ca = Math.cos(ang),
    sa = Math.sin(ang);
  const C = [
    [-hu, -hv],
    [hu, -hv],
    [hu, hv],
    [-hu, hv]
  ].map(([u, v]) => [x + u * ca - v * sa, y + u * sa + v * ca]);
  const S = (p, zz) => [PXw(p[0], p[1]) * k - DOX, (PYw(p[0], p[1]) - zz) * k - DOY];
  const q4 = (a, b2, c2, d, cl) => {
    c.fillStyle = cl;
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b2[0], b2[1]);
    c.lineTo(c2[0], c2[1]);
    c.lineTo(d[0], d[1]);
    c.closePath();
    c.fill();
  };
  const ar = (C[1][0] - C[0][0]) * (C[2][1] - C[0][1]) - (C[1][1] - C[0][1]) * (C[2][0] - C[0][0]),
    sg = ar > 0 ? 1 : -1;
  for (let i = 0; i < 4; i++) {
    const a = C[i],
      b2 = C[(i + 1) % 4],
      ex = b2[0] - a[0],
      ey = b2[1] - a[1];
    const nx = sg * ey,
      ny = -sg * ex;
    if (faces(nx, ny) <= 0) continue;
    q4(S(a, z), S(b2, z), S(b2, z + h), S(a, z + h), col(wc, wallShade(nx, ny) * 0.95 * sc));
  }
  q4(S(C[0], z + h), S(C[1], z + h), S(C[2], z + h), S(C[3], z + h), col(rc, 0.95 * sc));
}
/* hipped roof over any footprint: rings inset from every edge, rising toward the middle */
function insetRing(P, n, d) {
  const out = new Float32Array(n * 2);
  for (let j = 0; j < n; j++) {
    const i = (j + n - 1) % n,
      q = (j + 1) % n;
    let e1x = P[2 * j] - P[2 * i],
      e1y = P[2 * j + 1] - P[2 * i + 1],
      e2x = P[2 * q] - P[2 * j],
      e2y = P[2 * q + 1] - P[2 * j + 1];
    const l1 = Math.hypot(e1x, e1y) || 1,
      l2 = Math.hypot(e2x, e2y) || 1;
    // inward normals (outward is (dy,-dx))
    const n1x = -e1y / l1,
      n1y = e1x / l1,
      n2x = -e2y / l2,
      n2y = e2x / l2;
    let bx = n1x + n2x,
      by = n1y + n2y;
    const dot = n1x * n2x + n1y * n2y;

    const L = Math.hypot(bx, by) || 1;
    bx /= L;
    by /= L;
    const s = Math.min(d * 2.6, d * Math.sqrt(2 / Math.max(0.2, 1 + dot)));
    out[2 * j] = P[2 * j] + bx * s;
    out[2 * j + 1] = P[2 * j + 1] + by * s;
  }
  return out;
}
function roofHip(c, b, P, z1, rc, wc, sc) {
  const k = DK,
    n = b.n,
    o = obbOf(b);
  const rh = roofH(b) * 0.85,
    NS = 3,
    dmax = o.hw * 0.92;
  const rings = [P];
  for (let i = 1; i <= NS; i++) rings.push(insetRing(P, n, (dmax * i) / NS));
  const S = (x, y, z) => [PXw(x, y) * k - DOX, (PYw(x, y) - z) * k - DOY];
  const quads = [];
  for (let i = 0; i < NS; i++) {
    const A = rings[i],
      Bq = rings[i + 1],
      za = z1 + (rh * i) / NS,
      zb = z1 + (rh * (i + 1)) / NS;
    for (let j = 0; j < n; j++) {
      const q = (j + 1) % n;
      const ex = P[2 * q] - P[2 * j],
        ey = P[2 * q + 1] - P[2 * j + 1];
      const fv = faces(ey, -ex);
      quads.push([
        fv,
        PYw((A[2 * j] + A[2 * q]) / 2, (A[2 * j + 1] + A[2 * q + 1]) / 2),
        [
          S(A[2 * j], A[2 * j + 1], za),
          S(A[2 * q], A[2 * q + 1], za),
          S(Bq[2 * q], Bq[2 * q + 1], zb),
          S(Bq[2 * j], Bq[2 * j + 1], zb)
        ],
        ex,
        ey
      ]);
    }
  }
  quads.sort((p, q) => (p[0] > 0) - (q[0] > 0) || p[1] - q[1]);
  for (const [fv, , pp, ex, ey] of quads) {
    const lit = 0.97 + 0.13 * Math.max(-1, Math.min(1, (ey * SXx - ex * SXy) / (Math.hypot(ex, ey) || 1)));
    c.fillStyle = col(rc, (fv > 0 ? lit : 0.8) * sc);
    c.beginPath();
    c.moveTo(pp[0][0], pp[0][1]);
    for (let i = 1; i < 4; i++) c.lineTo(pp[i][0], pp[i][1]);
    c.closePath();
    c.fill();
  }
  const T = rings[NS];
  c.fillStyle = col(rc, 1.04 * sc);
  c.beginPath();
  for (let j = 0; j < n; j++) {
    const s = S(T[2 * j], T[2 * j + 1], z1 + rh);
    j ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
  }
  c.closePath();
  c.fill();
}

function mkB(poly, o) {
  const n = poly.length / 2;
  let cx = 0,
    cy = 0,
    minx = 1e12,
    maxx = -1e12,
    miny = 1e12,
    maxy = -1e12,
    a = 0;
  for (let j = 0; j < n; j++) {
    const x = poly[2 * j],
      y = poly[2 * j + 1];
    cx += x;
    cy += y;
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
    const x2 = poly[2 * ((j + 1) % n)],
      y2 = poly[2 * ((j + 1) % n) + 1];
    a += x * y2 - x2 * y;
  }
  cx /= n;
  cy /= n;
  const b = Object.assign(
    {
      poly,
      n,
      cx,
      cy,
      minx,
      maxx,
      miny,
      maxy,
      area: Math.abs(a / 2),
      hp: 100,
      fire: 0,
      state: 0,
      prog: 1,
      seed: R(),
      id: B.length,
      z: 0,
      key: 0
    },
    o
  );
  b.r = Math.max(maxx - minx, maxy - miny) / 2;
  rotB(b);
  const s = b.seed,
    k = b.kind;
  const dc = Math.hypot(cx + 1700, cy + 2400);
  if (k === 0 || k === 1) {
    b.wall =
      dc < 2500 || s < 0.35 ? ((s * 1000) | 0) % WALLS.length : [0, 5, 0, 8, 2, 5][((s * 600) | 0) % 6];
    b.wallC = WALLS[b.wall];
    b.roofC = ROOFS[((s * 7777) | 0) % ROOFS.length];
  } else if (k === 2) {
    b.wallC = APTW[((s * 1000) | 0) % APTW.length];
    b.roofC = FLATR[((s * 333) | 0) % 4];
  } else if (k === 3) {
    b.wallC = [
      [196, 196, 192],
      [226, 222, 214],
      [160, 164, 168]
    ][((s * 99) | 0) % 3];
    b.roofC = [66, 70, 76];
  } else if (k === 4) {
    b.wallC = COMW[((s * 1000) | 0) % COMW.length];
    b.roofC = FLATR[((s * 333) | 0) % 4];
    b.glass = b.h > 14 && s < 0.6;
  } else if (k === 5) {
    b.wallC = INDW[((s * 1000) | 0) % INDW.length];
    b.roofC = FLATR[((s * 333) | 0) % 4];
  } else if (k === 6) {
    b.wallC = PUBW[((s * 1000) | 0) % PUBW.length];
    b.roofC = FLATR[((s * 333) | 0) % 4];
  } else if (k === 7) {
    b.wallC = [240, 238, 232];
    b.roofC = s < 0.5 ? [60, 64, 70] : [150, 50, 44];
  } else {
    b.wallC = CONC;
    b.roofC = [124, 128, 134];
  }
  if (b.sp === 2) {
    b.wallC = [40, 58, 78];
    b.roofC = [34, 44, 58];
  }
  if (b.sp === 4) {
    b.wallC = [244, 242, 236];
    b.roofC = [70, 74, 82];
  }
  houseStyle(b);
  {
    let bl = 0;
    for (let j = 0; j < n; j++) {
      const q = (j + 1) % n,
        L = Math.hypot(poly[2 * q] - poly[2 * j], poly[2 * q + 1] - poly[2 * j + 1]);
      if (L > bl) {
        bl = L;
        b.doorW = j;
      }
    }
    b.doorC = [
      [150, 40, 36],
      [40, 70, 120],
      [240, 240, 236],
      [120, 84, 56],
      [40, 40, 44],
      [60, 110, 80]
    ][((s * 55) | 0) % 6];
  }
  return b;
}
function rotB(b) {
  const P = b.poly;
  let dmn = 1e12,
    dmx = -1e12,
    smn = 1e12,
    smx = -1e12;
  for (let j = 0; j < b.n; j++) {
    const x = P[2 * j],
      y = P[2 * j + 1];
    const d = PYw(x, y),
      s = PXw(x, y);
    if (d < dmn) dmn = d;
    if (d > dmx) dmx = d;
    if (s < smn) smn = s;
    if (s > smx) smx = s;
  }
  b.dMin = dmn;
  b.dMax = dmx;
  b.sMin = smn;
  b.sMax = smx;
  b.key = (PYw(b.cx, b.cy) + dmx) / 2;
  b.rr = ROT;
  if (b.sup) {
    if (b.sup.rr !== ROT) rotB(b.sup);
    b.key = Math.max(b.key, b.sup.key + 0.05);
  }
}
