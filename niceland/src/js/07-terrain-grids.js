/**
 * Terrain grids
 *
 * The 10 m capital grid (F), the 300 m Iceland grid (C) and generated 10 m detail tiles for the rest of
 * the country.
 *
 * Functions: initDetail, maskOff, clsFast, vn, fbm, ccH, crm, hInterp, coarseLandT, getTile, genTile, dz,
 *     cellAt, dRef, gT, gTfast, gH, gCov, sCov, gLV, sLV, gLH, sLH, sT, gName, nb4, cellCenter, cvH, hC,
 *     hAt, hAtFast
 * State and constants: inF, DT, DCS, DKMIN, DB, DGW, DGH, DTW, DTH, MASKI, MASKB, ALLOWGEN, TILES, CLS_T,
 *     HI_R
 */

const inF = (x, y) => F && x >= F.OX && y >= F.OY && x < F.x1 && y < F.y1;
/* ---- 10 m detail terrain everywhere outside the capital grid: generated from the 300 m grid, 10 m masks and noise ---- */
const DT = 72,
  DCS = 10,
  DKMIN = 0.18;
let DB = 0,
  DGW = 0,
  DGH = 0,
  DTW = 0,
  DTH = 0,
  MASKI = null,
  MASKB = null,
  ALLOWGEN = false;
const TILES = new Map();
function initDetail() {
  DB = FN + C.W * C.H;
  DGW = C.W * 30;
  DGH = C.H * 30;
  DTW = Math.ceil(DGW / DT);
  DTH = Math.ceil(DGH / DT);
}
function maskOff(ci, cj) {
  if (!MASKI) return -1;
  const key = ci + cj * C.W;
  let lo = 0,
    hi = MASKI.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1,
      v = MASKI[m];
    if (v === key) return m * 225;
    if (v < key) lo = m + 1;
    else hi = m - 1;
  }
  return -1;
}
function clsFast(gi, gj) {
  const ci = (gi / 30) | 0,
    cj = (gj / 30) | 0;
  if (ci < 0 || cj < 0 || ci >= C.W || cj >= C.H) return 1;
  const o = maskOff(ci, cj);
  if (o >= 0) {
    const p = (gi % 30) + (gj % 30) * 30;
    return (MASKB[o + (p >> 2)] >> ((p & 3) * 2)) & 3;
  }
  const t = C.GT[ci + cj * C.W];
  return t === SEA ? 1 : t === LAKE ? 2 : t === GLACIER ? 3 : 0;
}
const CLS_T = [GRASS, SEA, LAKE, GLACIER];
function vn(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  let u = x - xi,
    v = y - yi;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  const a = h32(xi, yi, 71),
    b = h32(xi + 1, yi, 71),
    c = h32(xi, yi + 1, 71),
    d = h32(xi + 1, yi + 1, 71);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  return (
    0.55 * vn(x / 90, y / 90) + 0.3 * vn(x / 33 + 5, y / 33 + 9) + 0.15 * vn(x / 13 + 2, y / 13 + 7) - 0.5
  );
}
function ccH(i, j) {
  if (i < 0) i = 0;
  if (j < 0) j = 0;
  if (i >= C.W) i = C.W - 1;
  if (j >= C.H) j = C.H - 1;
  const c = i + j * C.W;
  return C.GT[c] === SEA ? 0 : Math.max(1, C.HT[c]);
}
function crm(p0, p1, p2, p3, t) {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}
let HI_R = 0;
function hInterp(x, y) {
  const fx = (x - C.OX) / C.CS - 0.5,
    fy = (y - C.OY) / C.CS - 0.5,
    i = Math.floor(fx),
    j = Math.floor(fy),
    u = fx - i,
    v = fy - j;
  const a0 = ccH(i, j),
    a1 = ccH(i + 1, j),
    a2 = ccH(i, j + 1),
    a3 = ccH(i + 1, j + 1);
  HI_R = Math.max(a0, a1, a2, a3) - Math.min(a0, a1, a2, a3);
  const r0 = crm(ccH(i - 1, j - 1), ccH(i, j - 1), ccH(i + 1, j - 1), ccH(i + 2, j - 1), u),
    r1 = crm(ccH(i - 1, j), a0, a1, ccH(i + 2, j), u),
    r2 = crm(ccH(i - 1, j + 1), a2, a3, ccH(i + 2, j + 1), u),
    r3 = crm(ccH(i - 1, j + 2), ccH(i, j + 2), ccH(i + 1, j + 2), ccH(i + 2, j + 2), u);
  return crm(r0, r1, r2, r3, v);
}
function coarseLandT(x, y) {
  const i = Math.floor((x - C.OX) / C.CS),
    j = Math.floor((y - C.OY) / C.CS);
  if (i < 0 || j < 0 || i >= C.W || j >= C.H) return -1;
  const t = C.GT[i + j * C.W];
  if (t === SEA || t === LAKE || t === GLACIER) return -1;
  if (t === URBAN) return GRASS;
  if (t === LAVA) return ROCK;
  return t;
}
function getTile(ti, tj, gen) {
  if (ti < 0 || tj < 0 || ti >= DTW || tj >= DTH) return null;
  const key = ti + tj * DTW;
  let t = TILES.get(key);
  if (t) {
    t.last = frameNo;
    return t;
  }
  if (!gen || !ALLOWGEN) return null;
  t = genTile(ti, tj);
  if (TILES.size > 700) {
    const arr = [...TILES.entries()]
      .filter(e => !e[1].mod && e[1].last < frameNo - 2)
      .sort((a, b) => a[1].last - b[1].last);
    for (let q = 0; q < 150 && q < arr.length; q++) TILES.delete(arr[q][0]);
  }
  return t;
}
function genTile(ti, tj) {
  const N = DT * DT,
    GT = new Uint8Array(N),
    HT = new Int16Array(N),
    ox = C.OX + ti * DT * DCS,
    oy = C.OY + tj * DT * DCS;
  let LAVC = null;
  for (let b = 0; b < DT; b++)
    for (let a = 0; a < DT; a++) {
      const i = a + b * DT,
        gi = ti * DT + a,
        gj = tj * DT + b,
        x = ox + (a + 0.5) * DCS,
        y = oy + (b + 0.5) * DCS;
      const k = clsFast(gi, gj);
      if (k === 1) {
        GT[i] = SEA;
        HT[i] = 0;
        continue;
      }
      const h = hInterp(x, y),
        amp = 1.2 + Math.min(11, HI_R / 22) + (h > 300 ? 2 : 0),
        n = fbm(x, y);
      if (k === 3) {
        GT[i] = GLACIER;
        HT[i] = Math.round(Math.max(1, h + n * amp * 0.35));
        continue;
      }
      if (k === 2) {
        GT[i] = LAKE;
        HT[i] = Math.round(Math.max(1, h));
        continue;
      }
      let t = coarseLandT(
        x + (vn(x / 210 + 31, y / 210) - 0.5) * 280,
        y + (vn(x / 210, y / 210 + 57) - 0.5) * 280
      );
      if (t < 0) t = coarseLandT(x, y);
      const unm = t < 0;
      if (t < 0) t = GRASS;
      const pn = vn(x / 55 + 7, y / 55 + 3);
      // unmapped ground on the Reykjanes peninsula and the Hengill/Hellisheiði uplands is moss-grown lava, not meadow
      if (
        (unm || t === GRASS || t === SCRUB || t === HIGH) &&
        x > -42000 &&
        x < 34000 &&
        y > -2000 &&
        y < 36000 &&
        h > 35 &&
        pn < 0.82
      ) {
        if (!LAVC) LAVC = new Uint8Array(N);
        LAVC[i] = 1;
      }
      if (t === GRASS) {
        if (h < 140 && pn < 0.2 && HI_R < 25) t = WET;
        else if (pn > 0.78) t = SCRUB;
        else if (h > 380 && pn < 0.45) t = HIGH;
      } else if (t === HIGH) {
        if (pn < 0.13) t = SAND;
        else if (pn > 0.86) t = ROCK;
        else if (h < 260 && pn > 0.62) t = GRASS;
      } else if (t === ROCK) {
        if (pn > 0.8) t = HIGH;
      }
      GT[i] = t;
      HT[i] = Math.round(Math.max(1, h + n * amp));
    }
  if (LAVC) {
    // …but not inside villages: keep the ground round buildings as it was
    const BN = new Uint8Array(N);
    eachB(BBUCK, ox - 150, oy - 150, ox + DT * DCS + 150, oy + DT * DCS + 150, b => {
      if (b.state > 1 || b.kind >= 3 || b.area > 600) return;
      const a0 = Math.floor((b.cx - ox) / DCS),
        b0 = Math.floor((b.cy - oy) / DCS),
        R = b.area > 800 ? 6 : 12;
      for (let bb = Math.max(0, b0 - R); bb <= Math.min(DT - 1, b0 + R); bb++)
        for (let aa = Math.max(0, a0 - R); aa <= Math.min(DT - 1, a0 + R); aa++) BN[aa + bb * DT] = 1;
    });
    for (let i = 0; i < N; i++)
      if (LAVC[i] && !BN[i] && GT[i] !== SEA && GT[i] !== LAKE && GT[i] !== GLACIER) GT[i] = ROCK;
  }
  const seen = new Uint8Array(N),
    q = [];
  for (let i = 0; i < N; i++) {
    if (GT[i] !== LAKE || seen[i]) continue;
    q.length = 0;
    q.push(i);
    seen[i] = 1;
    let mn = 1e9;
    for (let hh = 0; hh < q.length; hh++) {
      const c = q[hh];
      mn = Math.min(mn, HT[c]);
      const a = c % DT,
        b = (c / DT) | 0;
      if (a + 1 < DT && GT[c + 1] === LAKE && !seen[c + 1]) {
        seen[c + 1] = 1;
        q.push(c + 1);
      }
      if (a > 0 && GT[c - 1] === LAKE && !seen[c - 1]) {
        seen[c - 1] = 1;
        q.push(c - 1);
      }
      if (b + 1 < DT && GT[c + DT] === LAKE && !seen[c + DT]) {
        seen[c + DT] = 1;
        q.push(c + DT);
      }
      if (b > 0 && GT[c - DT] === LAKE && !seen[c - DT]) {
        seen[c - DT] = 1;
        q.push(c - DT);
      }
    }
    for (const c of q) HT[c] = mn;
  }
  for (let b = 0; b < DT; b++)
    for (let a = 0; a < DT; a++) {
      const i = a + b * DT,
        t = GT[i];
      if (t === SEA || t === LAKE || t === GLACIER || t === ROCK) continue;
      const sea =
        (a + 1 < DT && GT[i + 1] === SEA) ||
        (a > 0 && GT[i - 1] === SEA) ||
        (b + 1 < DT && GT[i + DT] === SEA) ||
        (b > 0 && GT[i - DT] === SEA);
      if (sea && HT[i] < 8 && vn((ox + a * 10) / 40, (oy + b * 10) / 40) > 0.25) GT[i] = SAND;
    }
  const x1 = ox + DT * DCS,
    y1 = oy + DT * DCS;
  {
    const NEAR = new Uint8Array(N),
      DEN = new Uint8Array(N);
    let any = false;
    const stamp = (A, a0, b0, R) => {
      for (let b = Math.max(0, b0 - R); b <= Math.min(DT - 1, b0 + R); b++)
        for (let a = Math.max(0, a0 - R); a <= Math.min(DT - 1, a0 + R); a++) {
          if ((a - a0) ** 2 + (b - b0) ** 2 > R * R) continue;
          const i = a + b * DT;
          if (A[i] < 255) A[i]++;
        }
    };
    eachB(BBUCK, ox - 200, oy - 200, x1 + 200, y1 + 200, b => {
      if (b.state > 1 || inF(b.cx, b.cy)) return;
      if (b.kind >= 3 && b.style !== 'barn' && b.style !== 'farm') return;
      if (b.area > 1500 || /power|industr|plant|warehouse/.test(b.use || '')) return;
      any = true;
      /* hayfields only round farmhouses and barns */ const a0 = Math.floor((b.cx - ox) / DCS),
        b0 = Math.floor((b.cy - oy) / DCS);
      stamp(NEAR, a0, b0, 15);
      stamp(DEN, a0, b0, 8);
    });
    if (any)
      for (let b = 1; b < DT - 1; b++)
        for (let a = 1; a < DT - 1; a++) {
          const i = a + b * DT,
            t = GT[i];
          if (!NEAR[i] || DEN[i] >= 6) continue;
          if (t !== GRASS && t !== WET && t !== SCRUB && !(t === HIGH && HT[i] < 200)) continue;
          if (HT[i] > 280) continue;
          if (Math.abs(HT[i + 1] - HT[i - 1]) > 4 || Math.abs(HT[i + DT] - HT[i - DT]) > 4) continue;
          const hx = ox + (a + 0.5) * DCS,
            hy = oy + (b + 0.5) * DCS;
          if (hayP(hx, hy) > 0.86) continue;
          if (NEAR[i] === 1 && h32(Math.floor(HU), Math.floor(HV), 78) < 0.4) continue;
          if (LAVC && LAVC[i]) continue;
          GT[i] = HAY;
        }
  }
  const t = {
    ti,
    tj,
    ox,
    oy,
    GT,
    HT,
    COVER: new Uint8Array(N),
    LV: new Float32Array(N),
    LH: new Float32Array(N),
    mod: false,
    last: frameNo
  };
  if (typeof carveFalls === 'function') carveFalls(t);
  TILES.set(ti + tj * DTW, t);
  eachB(BBUCK, ox, oy, x1 - 1e-6, y1 - 1e-6, b => {
    if (b.cx < ox || b.cy < oy || b.cx >= x1 || b.cy >= y1 || inF(b.cx, b.cy)) return;
    const nz = dz(t, b.cx, b.cy);
    if (nz !== b.z) {
      b.z = nz;
      dirtyB(b);
    }
  });
  return t;
}
function dz(t, x, y) {
  const a = Math.floor((x - t.ox) / DCS),
    b = Math.floor((y - t.oy) / DCS),
    i = a + b * DT,
    g = t.GT[i];
  return g === SEA ? 0 : g === LAKE ? Math.max(0, t.HT[i] - 0.6) : Math.max(1, t.HT[i]);
}
function cellAt(x, y) {
  if (inF(x, y)) return Math.floor((x - F.OX) / F.CS) + Math.floor((y - F.OY) / F.CS) * F.W;
  const gi = Math.floor((x - C.OX) / DCS),
    gj = Math.floor((y - C.OY) / DCS);
  if (gi < 0 || gj < 0 || gi >= DGW || gj >= DGH) return -1;
  return DB + gi + gj * DGW;
}
function dRef(c, gen) {
  const l = c - DB,
    gi = l % DGW,
    gj = (l - gi) / DGW,
    t = getTile((gi / DT) | 0, (gj / DT) | 0, gen);
  return t ? [t, (gi % DT) + (gj % DT) * DT] : null;
}
function gT(c) {
  if (c < FN) return F.GT[c];
  if (c < DB) return C.GT[c - FN];
  const r = dRef(c, true);
  if (r) return r[0].GT[r[1]];
  const l = c - DB,
    gi = l % DGW;
  return CLS_T[clsFast(gi, (l - gi) / DGW)];
}
function gTfast(c) {
  if (c < FN) return F.GT[c];
  if (c < DB) return C.GT[c - FN];
  const r = dRef(c, false);
  if (r) return r[0].GT[r[1]];
  const l = c - DB,
    gi = l % DGW;
  return CLS_T[clsFast(gi, (l - gi) / DGW)];
}
function gH(c) {
  if (c < FN) return F.HT[c];
  if (c < DB) return C.HT[c - FN];
  const r = dRef(c, true);
  if (r) return r[0].HT[r[1]];
  const p = cellCenter(c);
  return Math.round(hC(p[0], p[1]));
}
function gCov(c) {
  if (c < FN) return F.COVER[c];
  const r = dRef(c, true);
  return r ? r[0].COVER[r[1]] : 0;
}
function sCov(c, v) {
  if (c < FN) {
    F.COVER[c] = v;
    return;
  }
  const r = dRef(c, true);
  if (r) {
    r[0].COVER[r[1]] = v;
    r[0].mod = true;
  }
}
function gLV(c) {
  if (c < FN) return F.LV[c];
  const r = dRef(c, true);
  return r ? r[0].LV[r[1]] : 0;
}
function sLV(c, v) {
  if (c < FN) {
    F.LV[c] = v;
    return;
  }
  const r = dRef(c, true);
  if (r) {
    r[0].LV[r[1]] = v;
    r[0].mod = true;
  }
}
function gLH(c) {
  if (c < FN) return F.LH[c];
  const r = dRef(c, true);
  return r ? r[0].LH[r[1]] : 0;
}
function sLH(c, v) {
  if (c < FN) {
    F.LH[c] = v;
    return;
  }
  const r = dRef(c, true);
  if (r) {
    r[0].LH[r[1]] = v;
    r[0].mod = true;
  }
}
function sT(c, t) {
  if (c < FN) {
    F.GT[c] = t;
    return;
  }
  const r = dRef(c, true);
  if (r) {
    r[0].GT[r[1]] = t;
    r[0].mod = true;
  }
}
function gName(c) {
  if (c < FN) return STR[F.NM[c]] || '';
  const p = cellCenter(c);
  const i = Math.floor((p[0] - C.OX) / C.CS),
    j = Math.floor((p[1] - C.OY) / C.CS);
  if (i < 0 || j < 0 || i >= C.W || j >= C.H) return '';
  return STR[C.NM[i + j * C.W]] || '';
}
function nb4(c) {
  const p = cellCenter(c);
  return [
    cellAt(p[0] + DCS, p[1]),
    cellAt(p[0] - DCS, p[1]),
    cellAt(p[0], p[1] + DCS),
    cellAt(p[0], p[1] - DCS)
  ];
}
function cellCenter(c) {
  if (c < FN) return [F.OX + ((c % F.W) + 0.5) * F.CS, F.OY + (((c / F.W) | 0) + 0.5) * F.CS];
  if (c < DB) {
    const l = c - FN;
    return [C.OX + ((l % C.W) + 0.5) * C.CS, C.OY + (((l / C.W) | 0) + 0.5) * C.CS];
  }
  const l = c - DB,
    gi = l % DGW;
  return [C.OX + (gi + 0.5) * DCS, C.OY + ((l - gi) / DGW + 0.5) * DCS];
}
function cvH(i, j) {
  // coarse vertex height (corner i,j), sea counts as 0
  let s = 0,
    n = 0;
  for (let dj = -1; dj <= 0; dj++)
    for (let di = -1; di <= 0; di++) {
      const a = i + di,
        b = j + dj;
      if (a < 0 || b < 0 || a >= C.W || b >= C.H) {
        n++;
        continue;
      }
      const c = a + b * C.W;
      const h = C.GT[c] === SEA ? 0 : Math.max(0, C.HT[c]);
      s += h;
      n++;
    }
  return s / n;
}
function hC(x, y) {
  const fx = (x - C.OX) / C.CS,
    fy = (y - C.OY) / C.CS;
  const i = Math.floor(fx),
    j = Math.floor(fy);
  if (i < 0 || j < 0 || i >= C.W || j >= C.H) return 0;
  const u = fx - i,
    v = fy - j;
  const a = cvH(i, j),
    b = cvH(i + 1, j),
    c = cvH(i, j + 1),
    d = cvH(i + 1, j + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function hAt(x, y) {
  if (inF(x, y)) return hSmoothF(x, y);
  if (!C) return 0;
  const gi = Math.floor((x - C.OX) / DCS),
    gj = Math.floor((y - C.OY) / DCS);
  const gen = K >= DKMIN;
  const t = getTile((gi / DT) | 0, (gj / DT) | 0, gen);
  if (t) {
    const z0 = dz(t, x, y),
      tt = t.GT[(gi % DT) + (gj % DT) * DT];
    if (isWaterT(tt)) return z0;
    const s = hSmoothD(x, y, gen);
    return s === null ? z0 : s;
  }
  return hC(x, y);
}
function hAtFast(x, y) {
  if (inF(x, y)) return hSmoothF(x, y);
  const gi = Math.floor((x - C.OX) / DCS),
    gj = Math.floor((y - C.OY) / DCS);
  const t = getTile((gi / DT) | 0, (gj / DT) | 0, false);
  if (t) {
    const z0 = dz(t, x, y),
      tt = t.GT[(gi % DT) + (gj % DT) * DT];
    if (isWaterT(tt)) return z0;
    const s = hSmoothD(x, y, false);
    return s === null ? z0 : s;
  }
  return hC(x, y);
}
