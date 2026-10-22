/**
 * Places
 *
 * Pools, playgrounds, schools, pitches, parks and cemeteries from props.txt and how they are drawn.
 *
 * Functions: ag2k, initProps, addPt, areasIn, ptsIn, inBld, freeSpot, hasPtIn, genPlayground, genKinder,
 *     genSchool, genPitch, areaZ, drawAreasGround, cemGrid, drawAreasTop, drawCem
 * State and constants: AREAS, PTS, PROPS_OK, AG2, PG2, AGS, ASTAMP, AK, AREA_ORDER, AU, SNOWMIX, CEMG
 */

let AREAS = [],
  PTS = [],
  PROPS_OK = false;
const AG2 = new Map(),
  PG2 = new Map(),
  AGS = 160;
let ASTAMP = 1;
const AK = {
  POOL: 1,
  PLAY: 2,
  SCHOOL: 3,
  KINDER: 4,
  PITCH: 5,
  PARK: 6,
  PARKING: 7,
  SPORT: 8,
  CEM: 9,
  DOG: 10,
  TRACK: 11,
  WPARK: 12,
  UNI: 13
};
const AREA_ORDER = { 11: 0, 7: 1, 9: 2, 2: 3, 5: 4, 1: 5, 12: 5, 3: 6, 4: 6 };
function ag2k(i, j) {
  return i * 1000003 + j;
}
function initProps(d) {
  const S = d.s;
  for (const r of d.a) {
    const c = r[0],
      sub = r[1],
      name = S[r[2]] || '',
      n = (r.length - 3) / 2;
    if (n < 3) continue;
    const poly = new Float32Array(n * 2);
    for (let i = 0; i < n * 2; i++) poly[i] = r[3 + i] * 0.5;
    let minx = 1e12,
      maxx = -1e12,
      miny = 1e12,
      maxy = -1e12,
      cx = 0,
      cy = 0,
      a = 0;
    for (let j = 0; j < n; j++) {
      const x = poly[2 * j],
        y = poly[2 * j + 1];
      cx += x;
      cy += y;
      minx = Math.min(minx, x);
      maxx = Math.max(maxx, x);
      miny = Math.min(miny, y);
      maxy = Math.max(maxy, y);
      const q = (j + 1) % n;
      a += x * poly[2 * q + 1] - poly[2 * q] * y;
    }
    cx /= n;
    cy /= n;
    a = Math.abs(a / 2);
    if (a < 4) continue;
    // principal axis -> oriented rectangle
    // smallest bounding rectangle over the polygon's own edge directions (rotating calipers): rows and pitches line up with the
    // real kerbs and fences instead of the principal axis, which runs diagonally across square or L-shaped lots
    const ext = (ux, uy) => {
      let u0 = 1e9,
        u1 = -1e9,
        v0 = 1e9,
        v1 = -1e9;
      for (let j = 0; j < n; j++) {
        const dx = poly[2 * j] - cx,
          dy = poly[2 * j + 1] - cy,
          u = dx * ux + dy * uy,
          v = -dx * uy + dy * ux;
        u0 = Math.min(u0, u);
        u1 = Math.max(u1, u);
        v0 = Math.min(v0, v);
        v1 = Math.max(v1, v);
      }
      return [u0, u1, v0, v1];
    };
    let ang = 0,
      best = 1e18;
    for (let j = 0; j < n; j++) {
      const q = (j + 1) % n,
        ex = poly[2 * q] - poly[2 * j],
        ey = poly[2 * q + 1] - poly[2 * j + 1];
      if (ex * ex + ey * ey < 1) continue;
      const an = Math.atan2(ey, ex),
        e = ext(Math.cos(an), Math.sin(an)),
        ar = (e[1] - e[0]) * (e[3] - e[2]);
      if (ar < best - 1e-6) {
        best = ar;
        ang = an;
      }
    }
    {
      const e = ext(Math.cos(ang), Math.sin(ang));
      if (e[1] - e[0] < e[3] - e[2]) ang += Math.PI / 2;
    }
    const ux = Math.cos(ang),
      uy = Math.sin(ang);
    let [u0, u1, v0, v1] = ext(ux, uy);
    const A = {
      id: AREAS.length,
      c,
      sub,
      name,
      poly,
      n,
      cx,
      cy,
      minx,
      maxx,
      miny,
      maxy,
      area: a,
      ux,
      uy,
      u0,
      u1,
      v0,
      v1,
      L: u1 - u0,
      W: v1 - v0,
      mu: (u0 + u1) / 2,
      mv: (v0 + v1) / 2,
      z: null,
      ag: 0,
      stamp: 0
    };
    AREAS.push(A);
    const i0 = Math.floor(minx / AGS),
      i1 = Math.floor(maxx / AGS),
      j0 = Math.floor(miny / AGS),
      j1 = Math.floor(maxy / AGS);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) < 4000)
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const k = ag2k(i, j);
          let l = AG2.get(k);
          if (!l) AG2.set(k, (l = []));
          l.push(A);
        }
  }
  AREAS.sort((a, b) => (AREA_ORDER[a.c] ?? 9) - (AREA_ORDER[b.c] ?? 9));
  for (const l of AG2.values()) l.sort((a, b) => (AREA_ORDER[a.c] ?? 9) - (AREA_ORDER[b.c] ?? 9));
  for (const r of d.p) addPt(r[0], r[1] * 0.5, r[2] * 0.5, h32(r[1], r[2], 7) * 6.283, S[r[3]] || '');
  // fill in equipment and markings
  for (const A of AREAS) {
    if (A.c === AK.PLAY) genPlayground(A);
    else if (A.c === AK.KINDER) genKinder(A);
    else if (A.c === AK.SCHOOL) genSchool(A);
    else if (A.c === AK.PITCH) genPitch(A);
  }
  // the capital grid marks pools as water: make them deck so the drawn pool sits on paving
  for (const A of AREAS) {
    if (A.c !== AK.POOL && A.c !== AK.WPARK) continue;
    if (!inF(A.cx, A.cy)) continue;
    for (let y = A.miny - 12; y <= A.maxy + 12; y += 5)
      for (let x = A.minx - 12; x <= A.maxx + 12; x += 5) {
        const c = cellAt(x, y);
        if (c < 0 || c >= FN) continue;
        const t = F.GT[c];
        if (t !== LAKE && t !== RIVER && t !== SEA) continue;
        F.GT[c] = PAVED;
        F.HT[c] = Math.max(1, F.HT[c]);
        if (F.OGT) F.OGT[c] = PAVED;
      }
  }
  PROPS_OK = true;
}
function addPt(c, x, y, ang, name, extra) {
  const p = Object.assign({ c, x, y, ang, name, seed: h32((x * 7) | 0, (y * 7) | 0, 3) }, extra || {});
  PTS.push(p);
  const k = ag2k(Math.floor(x / AGS), Math.floor(y / AGS));
  let l = PG2.get(k);
  if (!l) PG2.set(k, (l = []));
  l.push(p);
  return p;
}
function areasIn(x0, y0, x1, y1, fn) {
  const st = ++ASTAMP;
  for (let j = Math.floor(y0 / AGS); j <= Math.floor(y1 / AGS); j++)
    for (let i = Math.floor(x0 / AGS); i <= Math.floor(x1 / AGS); i++) {
      const l = AG2.get(ag2k(i, j));
      if (!l) continue;
      for (const A of l) {
        if (A.stamp === st) continue;
        A.stamp = st;
        if (A.maxx < x0 || A.minx > x1 || A.maxy < y0 || A.miny > y1) continue;
        fn(A);
      }
    }
}
function ptsIn(x0, y0, x1, y1, fn) {
  for (let j = Math.floor(y0 / AGS); j <= Math.floor(y1 / AGS); j++)
    for (let i = Math.floor(x0 / AGS); i <= Math.floor(x1 / AGS); i++) {
      const l = PG2.get(ag2k(i, j));
      if (!l) continue;
      for (const p of l) if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) fn(p);
    }
}
const AU = (A, u, v) => [A.cx + u * A.ux - v * A.uy, A.cy + u * A.uy + v * A.ux];
function inBld(x, y, r) {
  let hit = false;
  nearB(x, y, 40 + (r || 0), b => {
    if (hit || b.state >= 9) return;
    if (pip(b.poly, x, y)) hit = true;
    else if (r && Math.hypot(b.cx - x, b.cy - y) < r + b.r * 0.6) hit = true;
  });
  return hit;
}
function freeSpot(A, r, tries, seed) {
  for (let q = 0; q < tries; q++) {
    const u = A.mu + (h32(A.id, q, seed) - 0.5) * (A.L - 2 * r),
      v = A.mv + (h32(A.id, q, seed + 1) - 0.5) * (A.W - 2 * r);
    const [x, y] = AU(A, u, v);
    if (!pip(A.poly, x, y)) continue;
    let ok = true;
    for (const [du, dv] of [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [0, 0]
    ]) {
      const [xx, yy] = AU(A, u + du, v + dv);
      if (!pip(A.poly, xx, yy) || inBld(xx, yy)) {
        ok = false;
        break;
      }
    }
    if (ok) return { u, v, x, y };
  }
  return null;
}
function hasPtIn(A, test) {
  let f = false;
  ptsIn(A.minx, A.miny, A.maxx, A.maxy, p => {
    if (!f && test(p) && pip(A.poly, p.x, p.y)) f = true;
  });
  return f;
}
function genPlayground(A) {
  if (hasPtIn(A, p => p.c >= 20)) return;
  const set = [20, 21, 22, 24, 23, 25, 26];
  const n = Math.max(1, Math.min(6, Math.round(A.area / 90)));
  for (let i = 0; i < n; i++) {
    const s = freeSpot(A, 2, 12, 10 + i * 3);
    if (!s) continue;
    addPt(set[(i + A.id) % set.length], s.x, s.y, Math.atan2(A.uy, A.ux) + (i % 2 ? Math.PI / 2 : 0), '', {
      gen: 1,
      area: A
    });
  }
  if (n >= 2 && h32(A.id, 1, 9) < 0.6) {
    const s = freeSpot(A, 1, 8, 40);
    if (s) addPt(1, s.x, s.y, Math.atan2(A.uy, A.ux), '', { gen: 1 });
  }
}
function genKinder(A) {
  A.fence = 1;
  const set = [24, 20, 21, 22, 27, 25, 23, 26];
  const n = Math.max(2, Math.min(8, Math.round(A.area / 400)));
  for (let i = 0; i < n; i++) {
    const s = freeSpot(A, 2.2, 16, 20 + i * 3);
    if (!s) continue;
    addPt(set[i % set.length], s.x, s.y, Math.atan2(A.uy, A.ux) + (i % 2 ? Math.PI / 2 : 0), '', {
      gen: 1,
      area: A,
      small: 1
    });
  }
}
function genSchool(A) {
  const s = freeSpot(A, 15, 30, 60);
  const ang = Math.atan2(A.uy, A.ux);
  if (s) {
    A.court = { x: s.x, y: s.y, ang, L: 26, W: 14, type: 2 };
    const c = Math.cos(ang),
      sn = Math.sin(ang);
    addPt(31, s.x + c * 12, s.y + sn * 12, ang + Math.PI, '', { gen: 1 });
    addPt(31, s.x - c * 12, s.y - sn * 12, ang, '', { gen: 1 });
  }
  const g = freeSpot(A, 6, 20, 80);
  if (g) {
    for (const [i, c] of [
      [0, 20],
      [1, 21],
      [2, 22]
    ]) {
      const o = AU(A, 0, 0);
      const x = g.x + (i - 1) * 4 * Math.cos(ang + 1.57),
        y = g.y + (i - 1) * 4 * Math.sin(ang + 1.57);
      addPt(c, x, y, ang, '', { gen: 1, area: A });
    }
    A.play = { x: g.x, y: g.y };
  }
  const f = freeSpot(A, 18, 30, 120);
  if (f && (!s || Math.hypot(f.x - s.x, f.y - s.y) > 34)) {
    A.field = { x: f.x, y: f.y, ang, L: 34, W: 20 };
    const c = Math.cos(ang),
      sn = Math.sin(ang);
    addPt(30, f.x + c * 16, f.y + sn * 16, ang + Math.PI, '', { gen: 1, small: 1 });
    addPt(30, f.x - c * 16, f.y - sn * 16, ang, '', { gen: 1, small: 1 });
  }
}
function genPitch(A) {
  const s = A.sub & 15,
    ang = Math.atan2(A.uy, A.ux),
    hl = A.L / 2;
  if (s === 1 || (s === 0 && A.L > 40)) {
    const sm = A.L < 70;
    for (const d of [1, -1]) {
      const [x, y] = AU(A, A.mu + d * (hl - 0.6), A.mv);
      addPt(30, x, y, d > 0 ? ang + Math.PI : ang, '', { gen: 1, small: sm ? 1 : 0 });
    }
  } else if (s === 2) {
    for (const d of [1, -1]) {
      const [x, y] = AU(A, A.mu + d * (hl - 1.2), A.mv);
      addPt(31, x, y, d > 0 ? ang + Math.PI : ang, '', { gen: 1 });
    }
  } else if (s === 3) {
    const [x, y] = AU(A, A.mu, A.mv);
    addPt(32, x, y, ang, '', { gen: 1, w: Math.min(12.8, A.W) });
  } else if (s === 4) {
    for (const d of [1, -1]) {
      const [x, y] = AU(A, A.mu + d * (hl - 0.4), A.mv);
      addPt(33, x, y, d > 0 ? ang + Math.PI : ang, '', { gen: 1 });
    }
  } else if (s === 6) {
    const [x, y] = AU(A, A.mu, A.mv);
    addPt(32, x, y, ang, '', { gen: 1, w: Math.min(10, A.W), hi: 1 });
  }
}
function areaZ(A) {
  if (A.z === null) A.z = hAt(A.cx, A.cy);
  return A.z;
}
/* ---------- drawing (baked into the ground chunks) ---------- */
const SNOWMIX = c => {
  const m = SP.cover > 0 ? 0.55 : Math.min(0.5, snowAcc * 1.6);
  return m > 0 ? [c[0] + (224 - c[0]) * m, c[1] + (234 - c[1]) * m, c[2] + (250 - c[2]) * m] : c;
};
function drawAreasGround(c, k, X0, Y0, X1, Y1, ox, oy) {
  if (!PROPS_OK || k < 0.12) return;
  const P = (x, y, z) => [PXw(x, y) * k - ox, (PYw(x, y) - z) * k - oy];
  const poly = (A, z, col, sc, stroke) => {
    c.fillStyle = col;
    c.beginPath();
    for (let j = 0; j < A.n; j++) {
      let x = A.poly[2 * j],
        y = A.poly[2 * j + 1];
      if (sc) {
        x = A.cx + (x - A.cx) * sc;
        y = A.cy + (y - A.cy) * sc;
      }
      const p = P(x, y, z);
      j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
    }
    c.closePath();
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = Math.max(1, k * 0.3);
      c.stroke();
    }
  };
  const rect = (cx, cy, ang, L, W, z, col) => {
    const ca = Math.cos(ang),
      sa = Math.sin(ang);
    c.fillStyle = col;
    c.beginPath();
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ].forEach(([a, b], i) => {
      const p = P(
        cx + ((a * L) / 2) * ca - ((b * W) / 2) * sa,
        cy + ((a * L) / 2) * sa + ((b * W) / 2) * ca,
        z
      );
      i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
    });
    c.closePath();
    c.fill();
  };
  const line = (x1, y1, x2, y2, z, col, w) => {
    const a = P(x1, y1, z),
      b = P(x2, y2, z);
    c.strokeStyle = col;
    c.lineWidth = w || Math.max(1, k * 0.12);
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  };
  const lineU = (A, u1, v1, u2, v2, z, col, w) => {
    const a = AU(A, u1, v1),
      b = AU(A, u2, v2);
    line(a[0], a[1], b[0], b[1], z, col, w);
  };
  const W_ = N_([236, 238, 236], 1);
  // airports: aprons and runways with their markings
  for (const ap of AIRPORTS) {
    if (ap.cx < X0 - 6000 || ap.cx > X1 + 6000 || ap.cy < Y0 - 6000 || ap.cy > Y1 + 6000) continue;
    for (const A of ap.aprons) {
      let ok = false;
      for (let i = 0; i < A.poly.length; i += 2)
        if (
          A.poly[i] > X0 - 400 &&
          A.poly[i] < X1 + 400 &&
          A.poly[i + 1] > Y0 - 400 &&
          A.poly[i + 1] < Y1 + 400
        ) {
          ok = true;
          break;
        }
      if (!ok) continue;
      const z = hAt(A.cx, A.cy) + 0.05;
      c.fillStyle = N_(SNOWMIX([150, 152, 154]), 1);
      c.beginPath();
      for (let i = 0; i < A.poly.length; i += 2) {
        const p = P(A.poly[i], A.poly[i + 1], z);
        i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
      }
      c.closePath();
      c.fill();
    }
    for (const r of ap.rws) {
      const mnx = Math.min(r.x1, r.x2) - r.w,
        mxx = Math.max(r.x1, r.x2) + r.w,
        mny = Math.min(r.y1, r.y2) - r.w,
        mxy = Math.max(r.y1, r.y2) + r.w;
      if (mxx < X0 || mnx > X1 || mxy < Y0 || mny > Y1) continue;
      const z = hAt(r.cx, r.cy) + 0.08,
        nx = -r.uy,
        ny = r.ux,
        hw = r.w / 2;
      const Q = (a1, b1, a2, b2, col) => {
        const pts = [
          [r.x1 + r.ux * a1 + nx * b1, r.y1 + r.uy * a1 + ny * b1],
          [r.x1 + r.ux * a2 + nx * b1, r.y1 + r.uy * a2 + ny * b1],
          [r.x1 + r.ux * a2 + nx * b2, r.y1 + r.uy * a2 + ny * b2],
          [r.x1 + r.ux * a1 + nx * b2, r.y1 + r.uy * a1 + ny * b2]
        ];
        c.fillStyle = col;
        c.beginPath();
        pts.forEach((q, i) => {
          const p = P(q[0], q[1], z);
          i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
        });
        c.closePath();
        c.fill();
      };
      Q(-20, -hw - 6, r.L + 20, hw + 6, N_(SNOWMIX(r.paved ? [120, 124, 118] : [132, 120, 100]), 1));
      Q(0, -hw, r.L, hw, N_(SNOWMIX(r.paved ? [66, 68, 72] : [118, 104, 86]), 1));
      if (r.paved && k >= 0.12) {
        const wc = N_([232, 232, 228], 1);
        if (k >= 0.4) {
          Q(0, -hw + 0.6, r.L, -hw + 1.4, wc);
          Q(0, hw - 1.4, r.L, hw - 0.6, wc);
        }
        for (let u = 90; u < r.L - 90; u += 60) Q(u, -0.45, u + 30, 0.45, wc);
        for (const e of [0, 1]) {
          const u0 = e ? r.L - 36 : 6;
          for (let i = 0; i < 8; i++) {
            const v = -hw + 3 + (i * (r.w - 6)) / 8;
            Q(u0, v, u0 + 30, v + (r.w - 6) / 16, wc);
          }
          const u1 = e ? r.L - 350 : 300;
          Q(u1, -hw * 0.55, u1 + 60, -hw * 0.2, wc);
          Q(u1, hw * 0.2, u1 + 60, hw * 0.55, wc);
        }
      }
    }
  }
  areasIn(X0 - 30, Y0 - 30, X1 + 30, Y1 + 30, A => {
    const z = areaZ(A) + 0.04;
    switch (A.c) {
      case AK.POOL:
      case AK.WPARK: {
        const hot = A.sub === 1 || A.area < 30;
        const r = Math.sqrt(A.area / Math.PI);
        poly(A, z, N_(SNOWMIX([206, 208, 210]), 1), 1 + Math.min(0.5, 1.6 / Math.max(2, r)));
        poly(A, z, N_(hot ? [124, 204, 214] : [70, 178, 212], 1), 1, N_([46, 128, 170], 1));
        if (!hot && A.L >= 14 && k >= 0.6 && A.L * A.W < A.area * 1.6) {
          c.save();
          c.beginPath();
          for (let j = 0; j < A.n; j++) {
            const p = P(A.poly[2 * j], A.poly[2 * j + 1], z);
            j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
          }
          c.closePath();
          c.clip();
          const nl = Math.max(1, Math.floor(A.W / 2.5));
          for (let i = 1; i < nl; i++) {
            const v = A.v0 + (i * A.W) / nl;
            lineU(A, A.u0 + 1.5, v, A.u1 - 1.5, v, z, N_([52, 140, 186], 1), Math.max(1, k * 0.18));
          }
          c.restore();
        }
        if (k >= 1) {
          c.fillStyle = N_([200, 236, 246], 1);
          for (let q = 0; q < Math.min(40, A.area / 8); q++) {
            const u = A.u0 + h32(A.id, q, 1) * A.L,
              v = A.v0 + h32(A.id, q, 2) * A.W;
            const [x, y] = AU(A, u, v);
            if (!pip(A.poly, x, y)) continue;
            const p = P(x, y, z);
            c.fillRect(Math.round(p[0]), Math.round(p[1]), Math.max(1, Math.round(k * 0.5)), 1);
          }
        }
        break;
      }
      case AK.PLAY: {
        if (A.area > 700) break;
        const sand = h32(A.id, 0, 4) < 0.4;
        poly(A, z, N_(SNOWMIX(sand ? [214, 196, 152] : [170, 92, 70]), 1), 1, N_([128, 92, 60], 1));
        break;
      }
      case AK.PARKING: {
        poly(A, z, N_(SNOWMIX([94, 96, 102]), 1), 1);
        break;
      }
      case AK.TRACK: {
        poly(A, z, N_(SNOWMIX([178, 84, 64]), 1), 1);
        break;
      }
      case AK.PITCH: {
        const s = A.sub & 15,
          turf = A.sub & 16 || s === 1;
        const hl = A.L / 2,
          hw = A.W / 2,
          m = 1,
          mu = A.mu,
          mv = A.mv;
        if (s === 2 || s === 4 || s === 7)
          poly(A, z, N_(SNOWMIX(s === 4 ? [86, 112, 160] : [108, 116, 128]), 1), 1);
        else if (s === 3)
          poly(A, z, N_(SNOWMIX(h32(A.id, 0, 5) < 0.5 ? [74, 124, 98] : [176, 98, 70]), 1), 1);
        else if (s === 6) poly(A, z, N_([216, 198, 150], 1), 1);
        else if (turf && A.sub & 16) poly(A, z, N_(SNOWMIX([70, 148, 74]), 1), 1);
        if (k < 0.4) break;
        const L = (u1, v1, u2, v2) => lineU(A, mu + u1, mv + v1, mu + u2, mv + v2, z + 0.02, W_);
        L(-hl + m, -hw + m, hl - m, -hw + m);
        L(-hl + m, hw - m, hl - m, hw - m);
        L(-hl + m, -hw + m, -hl + m, hw - m);
        L(hl - m, -hw + m, hl - m, hw - m);
        if (s === 1 || s === 0 || s === 4) {
          L(0, -hw + m, 0, hw - m);
          const cr = Math.min(9.15, hw * 0.35);
          for (let q = 0; q < 16; q++) {
            const a1 = (q / 16) * 6.283,
              a2 = ((q + 1) / 16) * 6.283;
            L(Math.cos(a1) * cr, Math.sin(a1) * cr, Math.cos(a2) * cr, Math.sin(a2) * cr);
          }
          const bd = Math.min(16.5, A.L * 0.16),
            bw = Math.min(20, hw * 0.6);
          for (const d of [1, -1]) {
            L(d * (hl - m), -bw, d * (hl - m - bd), -bw);
            L(d * (hl - m - bd), -bw, d * (hl - m - bd), bw);
            L(d * (hl - m - bd), bw, d * (hl - m), bw);
          }
        } else if (s === 2) {
          L(0, -hw + m, 0, hw - m);
          for (const d of [1, -1]) {
            L(d * (hl - m), -2.4, d * (hl - m - 5.8), -2.4);
            L(d * (hl - m - 5.8), -2.4, d * (hl - m - 5.8), 2.4);
            L(d * (hl - m - 5.8), 2.4, d * (hl - m), 2.4);
          }
        } else if (s === 3) {
          L(-hl * 0.5, -hw + m, -hl * 0.5, hw - m);
          L(hl * 0.5, -hw + m, hl * 0.5, hw - m);
          L(-hl * 0.5, 0, hl * 0.5, 0);
        }
        break;
      }
      case AK.SCHOOL: {
        if (A.court && k >= 0.27) {
          const C2 = A.court;
          rect(C2.x, C2.y, C2.ang, C2.L, C2.W, z, N_(SNOWMIX([104, 108, 118]), 1));
          if (k >= 0.6) {
            const ca = Math.cos(C2.ang),
              sa = Math.sin(C2.ang);
            const Lc = (u1, v1, u2, v2) =>
              line(
                C2.x + u1 * ca - v1 * sa,
                C2.y + u1 * sa + v1 * ca,
                C2.x + u2 * ca - v2 * sa,
                C2.y + u2 * sa + v2 * ca,
                z + 0.02,
                W_
              );
            Lc(-12, -6, 12, -6);
            Lc(-12, 6, 12, 6);
            Lc(-12, -6, -12, 6);
            Lc(12, -6, 12, 6);
            Lc(0, -6, 0, 6);
            for (const d of [1, -1]) {
              Lc(d * 12, -2.4, d * 6.2, -2.4);
              Lc(d * 6.2, -2.4, d * 6.2, 2.4);
              Lc(d * 6.2, 2.4, d * 12, 2.4);
            }
            // hopscotch
            c.fillStyle = N_([240, 200, 80], 1);
            for (let q = 0; q < 6; q++) {
              const p = P(
                C2.x + (-12 - 3) * ca - (4 - q * 1.1) * sa,
                C2.y + (-12 - 3) * sa + (4 - q * 1.1) * ca,
                z
              );
              c.fillRect(
                Math.round(p[0]),
                Math.round(p[1]),
                Math.max(1, Math.round(k * 0.9)),
                Math.max(1, Math.round(k * 0.5))
              );
            }
          }
        }
        if (A.field && k >= 0.27) {
          const F2 = A.field;
          rect(F2.x, F2.y, F2.ang, F2.L, F2.W, z, N_(SNOWMIX([72, 146, 76]), 1));
        }
        if (A.play && k >= 0.27) {
          rect(A.play.x, A.play.y, Math.atan2(A.uy, A.ux), 14, 7, z, N_(SNOWMIX([176, 96, 72]), 1));
        }
        break;
      }
      case AK.CEM: {
        if (k < 0.27) break;
        poly(A, z, N_(SNOWMIX([96, 140, 80]), 1), 1);
        const g = cemGrid(A);
        c.save();
        c.beginPath();
        for (let j = 0; j < A.n; j++) {
          const p = P(A.poly[2 * j], A.poly[2 * j + 1], z);
          j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
        }
        c.closePath();
        c.clip();
        const gc = N_(SNOWMIX([196, 188, 170]), 1),
          pw = Math.max(1, k * (g.main ? 2.6 : 1.8));
        for (const u of g.us) lineU(A, u, A.v0 - 2, u, A.v1 + 2, z + 0.01, gc, pw);
        for (const v of g.vs) lineU(A, A.u0 - 2, v, A.u1 + 2, v, z + 0.01, gc, pw);
        if (g.main) {
          lineU(A, A.mu, A.v0 - 2, A.mu, A.v1 + 2, z + 0.01, gc, k * 3.6);
        }
        c.restore();
        break;
      }
      case AK.KINDER: {
        break;
      }
    }
  });
  drawZooGround(c, k, X0, Y0, X1, Y1, P);
}
const CEMG = new Map();
function cemGrid(A) {
  let g = CEMG.get(A.id);
  if (g) return g;
  const sp = A.area > 40000 ? 26 : 20;
  let us = [],
    vs = [];
  for (let u = A.u0 + sp * 0.7; u < A.u1 - sp * 0.4; u += sp) us.push(u);
  for (let v = A.v0 + sp * 0.6; v < A.v1 - sp * 0.4; v += sp * 0.85) vs.push(v);
  // real paths mapped inside? then use them instead of a made-up grid
  const CS = 1.5,
    MW = Math.ceil((A.maxx - A.minx) / CS) + 1,
    MH = Math.ceil((A.maxy - A.miny) / CS) + 1,
    M = new Uint8Array(MW * MH);
  let inside = 0;
  if (typeof SBUCK !== 'undefined')
    eachB2(SBUCK, A.minx, A.miny, A.maxx, A.maxy, (w, j) => {
      const wy = WAYS[w];
      if (wy.tu) return;
      const a = wy.nodes[j],
        b = wy.nodes[j + 1];
      const x1 = NX[a],
        y1 = NY[a],
        x2 = NX[b],
        y2 = NY[b];
      if (pip(A.poly, (x1 + x2) / 2, (y1 + y2) / 2)) inside++;
      const hw = RWW(wy) / 2 + 0.9,
        L = Math.hypot(x2 - x1, y2 - y1),
        st = Math.max(1, Math.ceil(L / 1));
      for (let q = 0; q <= st; q++) {
        const x = x1 + ((x2 - x1) * q) / st,
          y = y1 + ((y2 - y1) * q) / st;
        const i0 = Math.floor((x - hw - A.minx) / CS),
          i1 = Math.floor((x + hw - A.minx) / CS),
          j0 = Math.floor((y - hw - A.miny) / CS),
          j1 = Math.floor((y + hw - A.miny) / CS);
        for (let jj = Math.max(0, j0); jj <= Math.min(MH - 1, j1); jj++)
          for (let ii = Math.max(0, i0); ii <= Math.min(MW - 1, i1); ii++) M[ii + jj * MW] = 1;
      }
    });
  const osm = inside >= Math.max(3, A.area / 5000);
  if (osm) {
    us = [];
    vs = [];
  }
  g = {
    us,
    vs,
    sp,
    main: A.area > 40000 && !osm,
    osm,
    M,
    MW,
    MH,
    CS,
    onPath: (x, y) => {
      const i = Math.floor((x - A.minx) / CS),
        j = Math.floor((y - A.miny) / CS);
      return i >= 0 && j >= 0 && i < MW && j < MH && M[i + j * MW] === 1;
    }
  };
  CEMG.set(A.id, g);
  return g;
}
function drawAreasTop(c, k, X0, Y0, X1, Y1, ox, oy) {
  if (!PROPS_OK || k < 0.27) return;
  const P = (x, y, z) => [PXw(x, y) * k - ox, (PYw(x, y) - z) * k - oy];
  const L3 = (x1, y1, z1, x2, y2, z2, col, w) => {
    const a = P(x1, y1, z1),
      b = P(x2, y2, z2);
    c.strokeStyle = col;
    c.lineWidth = w || Math.max(1, k * 0.15);
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  };
  areasIn(X0 - 20, Y0 - 20, X1 + 20, Y1 + 20, A => {
    const z = areaZ(A);
    if (A.c === AK.KINDER && A.fence && k >= 0.6) {
      const fc = N_(
        [
          [200, 84, 62],
          [232, 190, 64],
          [84, 140, 200],
          [96, 170, 96]
        ][A.id % 4],
        1
      );
      for (let j = 0; j < A.n; j++) {
        const q = (j + 1) % A.n,
          x1 = A.poly[2 * j],
          y1 = A.poly[2 * j + 1],
          x2 = A.poly[2 * q],
          y2 = A.poly[2 * q + 1];
        const mx = (x1 + x2) / 2,
          my = (y1 + y2) / 2;
        if (mx < X0 || mx >= X1 || my < Y0 || my >= Y1) continue;
        if (inBld(mx, my)) continue;
        L3(x1, y1, z + 1, x2, y2, z + 1, fc);
        L3(x1, y1, z + 0.5, x2, y2, z + 0.5, fc);
        const d = Math.hypot(x2 - x1, y2 - y1),
          np = Math.max(1, Math.round(d / 2.5));
        if (k >= 1.2)
          for (let i = 0; i <= np; i++) {
            const t = i / np,
              x = x1 + (x2 - x1) * t,
              y = y1 + (y2 - y1) * t;
            L3(x, y, z, x, y, z + 1.1, fc);
          }
      }
    }
    if (A.c === AK.PARKING && k >= 0.4) {
      // stall lines are painted on the ground
      for (const st of lotStalls(A)) {
        if (st.x < X0 || st.x >= X1 || st.y < Y0 || st.y >= Y1) continue;
        const u = st.u,
          v = st.v;
        for (const du of [-1.3, 1.3]) {
          const [xa, ya] = AU(A, u + du, v - 2.5),
            [xb, yb] = AU(A, u + du, v + 2.5);
          L3(xa, ya, z + 0.03, xb, yb, z + 0.03, N_([214, 216, 214], 1), 1);
        }
      }
    }
  });
  ptsIn(X0, Y0, X1, Y1, p => drawPt(c, k, p, ox, oy, false));
}
function drawCem(c, k, A, z, X0, Y0, X1, Y1, P, L3) {
  const g = cemGrid(A);
  // u,v window of this chunk
  let u0 = 1e9,
    u1 = -1e9,
    v0 = 1e9,
    v1 = -1e9;
  for (const [x, y] of [
    [X0 - 12, Y0 - 12],
    [X1 + 12, Y0 - 12],
    [X1 + 12, Y1 + 12],
    [X0 - 12, Y1 + 12]
  ]) {
    const dx = x - A.cx,
      dy = y - A.cy,
      u = dx * A.ux + dy * A.uy,
      v = -dx * A.uy + dy * A.ux;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  u0 = Math.max(u0, A.u0);
  u1 = Math.min(u1, A.u1);
  v0 = Math.max(v0, A.v0);
  v1 = Math.min(v1, A.v1);
  if (u0 >= u1 || v0 >= v1) return;
  const near = (arr, t, d) => {
    for (const a of arr) if (Math.abs(a - t) < d) return true;
    return false;
  };
  const su = 2.4,
    sv = 3.2,
    items = [];
  const iu0 = Math.floor((u0 - A.u0) / su),
    iu1 = Math.ceil((u1 - A.u0) / su),
    iv0 = Math.floor((v0 - A.v0) / sv),
    iv1 = Math.ceil((v1 - A.v0) / sv);
  for (let iv = iv0; iv <= iv1; iv++) {
    const v = A.v0 + 1.6 + iv * sv;
    if (near(g.vs, v, 2.2) || (g.main && Math.abs(v - A.mv) < 0)) continue;
    for (let iu = iu0; iu <= iu1; iu++) {
      const u = A.u0 + 1.2 + iu * su;
      if (near(g.us, u, 2.2) || (g.main && Math.abs(u - A.mu) < 3)) continue;
      const hs = h32(A.id * 7 + iu, iv, 11);
      if (hs < 0.12) continue;
      const [x, y] = AU(A, u, v);
      if (x < X0 || x >= X1 || y < Y0 || y >= Y1) continue;
      if (!pip(A.poly, x, y) || g.onPath(x, y)) continue;
      // keep away from the edge (hedge) and from chapels
      const [xe, ye] = AU(A, u, v + 1.6),
        [xe2, ye2] = AU(A, u, v - 1.6);
      if (!pip(A.poly, xe, ye) || !pip(A.poly, xe2, ye2)) continue;
      items.push([PYw(x, y), x, y, hs, h32(A.id + iu, iv * 3, 12)]);
    }
  }
  // trees at the crossings of the paths
  if (k >= 0.45)
    for (const u of g.us)
      for (const v of g.vs) {
        if (h32(A.id, ((u * 3) | 0) + ((v * 7) | 0), 14) < 0.35) continue;
        const [x, y] = AU(A, u + 2.4, v + 2.4);
        if (x < X0 || x >= X1 || y < Y0 || y >= Y1 || !pip(A.poly, x, y)) continue;
        items.push([PYw(x, y), x, y, -1, h32(u | 0, v | 0, 15)]);
      }
  if (g.osm && k >= 0.45)
    for (let iu = Math.ceil(iu0 / 6) * 6; iu <= iu1; iu += 6)
      for (let iv = Math.ceil(iv0 / 5) * 5; iv <= iv1; iv += 5) {
        const u = A.u0 + iu * su,
          v = A.v0 + iv * sv;
        if (h32(A.id, iu * 31 + iv, 16) < 0.4) continue;
        const [x, y] = AU(A, u, v);
        if (x < X0 || x >= X1 || y < Y0 || y >= Y1 || !pip(A.poly, x, y) || g.onPath(x, y)) continue;
        items.push([PYw(x, y), x, y, -1, h32(iu, iv, 17)]);
      }
  items.sort((a, b) => a[0] - b[0]);
  const fk = Math.max(1, Math.round(k * 0.3));
  for (const [, x, y, hs, s2] of items) {
    const zz = hAt(x, y),
      p = P(x, y, zz);
    const px = Math.round(p[0]),
      py = Math.round(p[1]);
    if (hs < 0) {
      treeAt(c, px, py, k, s2 < 0.6 ? 1 : 0, s2);
      continue;
    }
    if (inBld(x, y)) continue;
    // plot: a low kerb or flowers in front, then the stone
    if (k >= 1.1 && s2 < 0.5) {
      c.fillStyle = N_(SNOWMIX([84, 120, 70]), 1);
      c.fillRect(px - Math.round(k * 0.7), py, Math.round(k * 1.4), Math.max(1, Math.round(k * 0.9)));
    }
    if (k >= 0.9 && s2 > 0.6) {
      const fc = [
        [214, 52, 60],
        [244, 214, 70],
        [240, 240, 240],
        [196, 90, 190]
      ][((s2 * 40) | 0) % 4];
      c.fillStyle = N_(fc, 1);
      c.fillRect(px - fk, py + Math.round(k * 0.3), fk, fk);
      if (k >= 1.6) c.fillRect(px + fk, py + Math.round(k * 0.5), fk, fk);
    }
    if (SEAS === 'winter' && s2 > 0.85 && k >= 0.9) {
      c.fillStyle = N_([255, 210, 120], 1);
      c.fillRect(px, py, fk, fk);
    } // candle light (Christmas lights on graves)
    const type = hs < 0.22 ? 'cross' : hs < 0.45 ? 'black' : hs < 0.55 ? 'tall' : 'grey';
    if (type === 'cross') {
      const h = Math.max(2, Math.round(k * 1.1)),
        w = Math.max(1, Math.round(k * 0.18));
      c.fillStyle = N_([236, 236, 232], 1);
      c.fillRect(px, py - h, w, h);
      c.fillRect(px - Math.round(k * 0.3), py - Math.round(h * 0.72), Math.round(k * 0.6) + w, w);
      continue;
    }
    const hm = type === 'tall' ? 1.4 : 0.75 + s2 * 0.25,
      wm = type === 'tall' ? 0.5 : 0.75,
      col = type === 'black' ? [44, 44, 48] : type === 'tall' ? [178, 174, 168] : [146, 146, 142];
    if (k < 1.2) {
      const h = Math.max(1, Math.round(k * hm)),
        w = Math.max(1, Math.round(k * wm * 0.9));
      c.fillStyle = N_(col, 1);
      c.fillRect(px, py - h, w, h);
      continue;
    }
    // a slab standing along the row, so it turns with the view like everything else
    const ux = A.ux,
      uy = A.uy,
      vx = -A.uy,
      vy = A.ux,
      hw = wm / 2,
      ht = 0.09;
    const Cn = [
      [-hw, -ht],
      [hw, -ht],
      [hw, ht],
      [-hw, ht]
    ].map(([u, v]) => [x + ux * u + vx * v, y + uy * u + vy * v]);
    const Q = (a, b, z0, z1, cl) => {
      const p1 = P(a[0], a[1], z0),
        p2 = P(b[0], b[1], z0),
        p3 = P(b[0], b[1], z1),
        p4 = P(a[0], a[1], z1);
      c.fillStyle = cl;
      c.beginPath();
      c.moveTo(p1[0], p1[1]);
      c.lineTo(p2[0], p2[1]);
      c.lineTo(p3[0], p3[1]);
      c.lineTo(p4[0], p4[1]);
      c.closePath();
      c.fill();
    };
    let ar = 0;
    for (let i = 0; i < 4; i++) {
      const a2 = Cn[i],
        b2 = Cn[(i + 1) % 4];
      ar += a2[0] * b2[1] - b2[0] * a2[1];
    }
    const sg = ar > 0 ? 1 : -1;
    for (let i = 0; i < 4; i++) {
      const a2 = Cn[i],
        b2 = Cn[(i + 1) % 4];
      const ex = b2[0] - a2[0],
        ey = b2[1] - a2[1];
      const nx = sg * ey,
        ny = -sg * ex;
      if (faces(nx, ny) <= 0) continue;
      Q(a2, b2, zz, zz + hm, N_(col, wallShade(nx, ny)));
    }
    c.fillStyle = N_(
      col.map(v => Math.min(255, v * 1.12)),
      1
    );
    c.beginPath();
    Cn.forEach((q, i) => {
      const pp = P(q[0], q[1], zz + hm);
      i ? c.lineTo(pp[0], pp[1]) : c.moveTo(pp[0], pp[1]);
    });
    c.closePath();
    c.fill();
  }
  // clipped hedge around the edge
  if (A.area > 1500) {
    const hc = N_(SNOWMIX([62, 98, 54]), 1),
      hc2 = N_(SNOWMIX([78, 118, 64]), 1);
    for (let j = 0; j < A.n; j++) {
      const q = (j + 1) % A.n,
        x1 = A.poly[2 * j],
        y1 = A.poly[2 * j + 1],
        x2 = A.poly[2 * q],
        y2 = A.poly[2 * q + 1];
      const mx = (x1 + x2) / 2,
        my = (y1 + y2) / 2;
      if (
        Math.max(x1, x2) < X0 - 2 ||
        Math.min(x1, x2) > X1 + 2 ||
        Math.max(y1, y2) < Y0 - 2 ||
        Math.min(y1, y2) > Y1 + 2
      )
        continue;
      if (inBld(mx, my)) continue;
      L3(x1, y1, z + 0.5, x2, y2, z + 0.5, hc, Math.max(1, k * 1.6));
      L3(x1, y1, z + 1.1, x2, y2, z + 1.1, hc2, Math.max(1, k * 0.9));
    }
  }
}
