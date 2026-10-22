/**
 * Terrain rendering
 *
 * Ground colours and the terrain renderer that bakes the ground into cached chunks.
 *
 * Functions: loopOrder, chunkBounds, maxH, fetchF, zcT, hayTh, hayP, surfZ, seaDepth, seaBase, sCol,
 *     sCol0, renderSmooth, renderFine, chunkInF, dAcc, renderDetail, hSmoothF, hSmoothD, treeAt
 * State and constants: RW, RCOL, BLD, GWL, NAT, HU, HV, SR, SG, SB, SM, DRYV, VEG, AT, AH, AC, AB
 */

const RW = [0, 16, 12, 10, 8, 6.5, 4, 5, 1.8, 1.8, 18],
  RCOL = [
    [0, 0, 0],
    [70, 72, 78],
    [78, 80, 86],
    [84, 86, 92],
    [88, 90, 96],
    [92, 94, 100],
    [104, 104, 108],
    [176, 168, 156],
    [178, 170, 152],
    [160, 150, 136],
    [80, 140, 176]
  ];
function loopOrder(i0, i1, j0, j1, fn) {
  // calls fn(outerIsJ, list of cells in depth order) row by row
  const outerJ = Math.abs(SYy) >= Math.abs(SYx),
    di = SYx >= 0 ? 1 : -1,
    dj = SYy >= 0 ? 1 : -1;
  if (outerJ) {
    for (let a = 0; a < j1 - j0; a++) {
      const j = dj > 0 ? j0 + a : j1 - 1 - a;
      fn(true, j, di > 0 ? i0 : i1 - 1, di);
    }
  } else {
    for (let a = 0; a < i1 - i0; a++) {
      const i = di > 0 ? i0 + a : i1 - 1 - a;
      fn(false, i, dj > 0 ? j0 : j1 - 1, dj);
    }
  }
}

function chunkBounds(g, i0, j0, i1, j1, k, zmax) {
  let a0 = 1e12,
    a1 = -1e12,
    b0 = 1e12,
    b1 = -1e12;
  const xa = g.OX + i0 * g.CS,
    ya = g.OY + j0 * g.CS,
    xb = g.OX + i1 * g.CS,
    yb = g.OY + j1 * g.CS;
  for (const [x, y] of [
    [xa, ya],
    [xb, ya],
    [xa, yb],
    [xb, yb]
  ]) {
    const a = PXw(x, y) * k,
      b = PYw(x, y) * k;
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
    b0 = Math.min(b0, b);
    b1 = Math.max(b1, b);
  }
  return [Math.floor(a0) - 3, Math.floor(b0 - zmax * k) - 3, Math.ceil(a1) + 3, Math.ceil(b1 + 2 * k) + 3];
}
function maxH(g, i0, j0, i1, j1) {
  let m = 0;
  for (let j = j0; j < j1; j++) {
    const r = j * g.W;
    for (let i = i0; i < i1; i++) {
      const h = g.HT[r + i];
      if (h > m) m = h;
    }
  }
  return m;
}
/* ================= smooth terrain renderer: per-sample heightfield splatting with a depth buffer ================= */
const BLD = new Uint8Array(32);
for (const t of [2, 3, 4, 5, 6, 7, 8, 12, 13, 16, 17, 18, 19, 21]) BLD[t] = 1;
const GWL = new Float32Array(64);
for (let i = 0; i < 64; i++) GWL[i] = Math.exp(-(i / 8) / (2 * 0.8 * 0.8));
const NAT = new Uint8Array(32);
for (const t of [0, 1, 2, 4, 5, 6, 7, 8, 15, 16, 17, 18, 19, 21]) NAT[t] = 1;
function fetchF(i, j) {
  if (i < 0) i = 0;
  if (j < 0) j = 0;
  if (i >= F.W) i = F.W - 1;
  if (j >= F.H) j = F.H - 1;
  const c = i + j * F.W;
  return c;
}
function zcT(t, h) {
  return t === SEA ? 0 : t === LAKE || t === RIVER ? Math.max(0, h - 0.6) : Math.max(1, h);
}
// rural field layout: one orientation per 3 km block
function hayTh(x, y) {
  return h32(Math.floor(x / 3000), Math.floor(y / 3000), 81) * Math.PI;
}
let HU = 0,
  HV = 0;
function hayP(x, y) {
  const th = hayTh(x, y),
    c = Math.cos(th),
    s = Math.sin(th);
  HU = (x * c + y * s) / 55;
  HV = (-x * s + y * c) / 150;
  return h32(Math.floor(HU), Math.floor(HV), 82);
}
// bilinear surface height from a cell-z accessor
function surfZ(x, y, ox, oy, zf) {
  const fx = (x - ox) / 10 - 0.5,
    fy = (y - oy) / 10 - 0.5,
    i = Math.floor(fx),
    j = Math.floor(fy),
    u = fx - i,
    v = fy - j;
  const a = zf(i, j),
    b = zf(i + 1, j),
    c = zf(i, j + 1),
    d = zf(i + 1, j + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
let SR = 0,
  SG = 0,
  SB = 0,
  SM = 0,
  DRYV = null;
/* one sea colour for every renderer: depth from the 300 m grid (bilinear), fading to the deep-ocean background at the grid edge */
function seaDepth(x, y) {
  const fx = (x - C.OX) / 300 - 0.5,
    fy = (y - C.OY) / 300 - 0.5,
    i = Math.floor(fx),
    j = Math.floor(fy),
    u = fx - i,
    v = fy - j;
  let d = 0;
  for (let q = 0; q < 4; q++) {
    const a = Math.max(0, Math.min(C.W - 1, i + (q & 1))),
      b = Math.max(0, Math.min(C.H - 1, j + (q >> 1))),
      c = a + b * C.W;
    if (C.GT[c] === SEA) d += C.HT[c] * (q & 1 ? u : 1 - u) * (q >> 1 ? v : 1 - v);
  }
  return d;
}
function seaBase(x, y, dd) {
  const eg = Math.min(x - C.OX, C.x1 - x, y - C.OY, C.y1 - y) / 60000;
  const d = Math.max(
    Math.min(1, -(dd === undefined ? seaDepth(x, y) : dd) / 300),
    (e2 => 1 - e2 * e2 * (3 - 2 * e2))(Math.max(0, Math.min(1, eg)))
  );
  return [38 - 14 * d, 86 - 30 * d, 120 - 30 * d];
}
const VEG = new Uint8Array(32);
for (const t of [2, 3, 4, 5, 7, 12, 13, 19, 21, 11]) VEG[t] = 1;
function sCol(t, z, x, y, L) {
  sCol0(t, z, x, y, L);
  if (t === LAKE && (SP.ice || snowAcc > 0.32)) {
    const n = SM ? 0.5 : vn(x / 5, y / 5) * 0.7 + h32(Math.floor(x), Math.floor(y), 8) * 0.3;
    const cv = snowCov(z + 300, x, y, SM);
    SR = 188 + n * 16 + cv * 30;
    SG = 206 + n * 12 + cv * 24;
    SB = 220 + n * 8 + cv * 16;
    return;
  }
  if (t === SEA || t === LAKE || t === RIVER || t === GLACIER) return;
  if (VEG[t]) {
    SR *= SP.g[0];
    SG *= SP.g[1];
    SB *= SP.g[2];
    if (SP.lup && (t === SCRUB || (t === GRASS && z < 120)) && !SM) {
      const lp = vn(x / 11 + 1, y / 11 + 5);
      if (lp > (t === SCRUB ? 0.52 : 0.78)) {
        const f =
          Math.min(1, (lp - (t === SCRUB ? 0.52 : 0.78)) * 6) *
          (h32(Math.floor(x * 1.5), Math.floor(y * 1.5), 9) > 0.35 ? 1 : 0.4);
        SR += (116 - SR) * f;
        SG += (92 - SG) * f;
        SB += (168 - SB) * f;
      }
    }
  }
  const sc = snowCov(z, x, y, SM);
  if (sc > 0) {
    const m =
      t === PAVED || t === RUNWAY || t === PIER || t === URBAN || t === PITCH
        ? sc * 0.42
        : t === ROCK || t === LAVA
          ? sc * 0.8
          : sc;
    const gr = SM ? 0.5 : h32(Math.floor(x * 2), Math.floor(y * 2), 5);
    const s = 0.95 + gr * 0.05;
    SR += (224 * s - SR) * m;
    SG += (236 * s - SG) * m;
    SB += (255 * s - SB) * m;
  }
}
function sCol0(t, z, x, y, L) {
  let r,
    g,
    b,
    gr = SM ? 0.5 : h32(Math.floor(x * 2), Math.floor(y * 2), 5);
  switch (t) {
    case SEA:
    case LAKE:
    case RIVER: {
      const base = t === SEA ? seaBase(x, y) : t === LAKE ? [58, 110, 138] : [66, 124, 152];
      const sh = t === SEA ? [64, 128, 144] : [86, 146, 160];
      const m = Math.min(1, L * 1.7);
      r = base[0] + (sh[0] - base[0]) * m;
      g = base[1] + (sh[1] - base[1]) * m;
      b = base[2] + (sh[2] - base[2]) * m;
      const w = h32(Math.floor(x / 1.6), Math.floor(y / 0.8), 6) > 0.965 ? 1.08 : 1;
      r *= w;
      g *= w;
      b *= w;
      if (t === SEA && L > 0.6 && vn(x / 1.8, y / 1.8) > 0.45) {
        r = 186;
        g = 212;
        b = 220;
      }
      break;
    }
    case GLACIER: {
      const cr = SM ? 0 : vn(x / 7 + 1, y / 28 + 3);
      const s = 0.95 + gr * 0.06;
      if (cr > 0.8) {
        r = 168;
        g = 196;
        b = 214;
      } else {
        r = 224 * s;
        g = 234 * s;
        b = 242 * s;
      }
      break;
    }
    case SAND: {
      const s = 0.9 + gr * 0.18;
      r = 74 * s;
      g = 72 * s;
      b = 72 * s;
      break;
    }
    case ROCK:
    case LAVA: {
      const m = SM ? 0.36 : vn(x / 3.2 + 5, y / 3.2 + 8) * 0.8 + gr * 0.2;
      if (m > 0.4) {
        const s = 0.9 + gr * 0.2;
        r = 96 * s;
        g = 112 * s;
        b = 76 * s;
      } else if (m > 0.3) {
        r = 82;
        g = 90;
        b = 72;
      } else {
        const s = 0.85 + gr * 0.2;
        r = 62 * s;
        g = 62 * s;
        b = 60 * s;
      }
      break;
    }
    case HAY: {
      const p = hayP(x, y);
      if (p > 0.86) {
        t = GRASS;
        return sCol0(GRASS, z, x, y, L);
      }
      const fu = HU - Math.floor(HU),
        fv = HV - Math.floor(HV);
      if (fu < 0.045 || fv < 0.016) {
        r = 74;
        g = 98;
        b = 84;
        break;
      }
      const st = Math.floor((HU * 55) / 3.5) % 2 ? 1.05 : 0.96,
        s = st * (0.94 + gr * 0.1);
      if (p < 0.22) {
        r = 168 * s;
        g = 162 * s;
        b = 88 * s;
      } else if (p < 0.4) {
        r = 132 * s;
        g = 160 * s;
        b = 70 * s;
      } else {
        r = 110 * s;
        g = 150 * s;
        b = 60 * s;
      }
      break;
    }
    case GRASS:
    case PARK:
    case GOLF:
    case CEM:
    case WET:
    case SCRUB:
    case HIGH:
    case WOOD: {
      let c;
      if (t === GRASS)
        c = z > 650 ? [146, 138, 120] : z > 420 ? [128, 122, 94] : z > 220 ? [116, 128, 80] : [112, 140, 78];
      else if (t === HIGH) c = z > 600 ? [134, 126, 110] : [124, 116, 92];
      else if (t === SCRUB) c = z > 300 ? [112, 104, 76] : [106, 114, 70];
      else if (t === WET) c = [100, 124, 86];
      else if (t === WOOD) c = [66, 98, 60];
      else c = GCOL[t];
      const dry =
        DRYV !== null
          ? DRYV
          : (vn(x / 90 + 3, y / 90 + 1) - 0.5) * 0.6 + (SM ? 0 : (vn(x / 27, y / 27 + 4) - 0.5) * 0.35);
      const cl = SM ? 0.5 : vn(x / 1.3 + 7, y / 1.3 + 3);
      const s = 0.95 + gr * 0.07 + (cl - 0.5) * 0.12;
      r = c[0] * (1 + dry * 0.24) * s;
      g = c[1] * (1 + dry * 0.08) * s;
      b = c[2] * (1 - dry * 0.16) * s;
      if (t === WET && !SM) {
        const pv = vn(x / 6, y / 6 + 2);
        if (pv > 0.8) {
          r = 84;
          g = 110;
          b = 114;
        } else if (pv > 0.74) {
          r *= 0.9;
          g *= 0.95;
        }
      }
      if (t === SCRUB && !SM) {
        const bm = vn(x / 2.2 + 9, y / 2.2 + 1);
        if (bm > 0.6) {
          r *= 0.8;
          g *= 0.84;
          b *= 0.76;
        } else if (bm < 0.2 && vn(x / 9, y / 9) > 0.6) {
          r = 104;
          g = 96;
          b = 112;
        }
      }
      break;
    }
    default: {
      const c = GCOL[t] || GCOL[2];
      const s = t === PAVED || t === RUNWAY || t === PIER ? 0.97 + gr * 0.05 : 0.94 + gr * 0.1;
      r = c[0] * s;
      g = c[1] * s;
      b = c[2] * s;
    }
  }
  SR = r;
  SG = g;
  SB = b;
}
/* render one 10 m-cell chunk: X0,Y0 = world origin, NW x NH cells; cell(i,j) -> [t,h,cover,bld] via accessor writing into CT */
function renderSmooth(k, X0, Y0, NW, NH, acc, opts) {
  const B = 4,
    MW = NW + 2 * B,
    MH = NH + 2 * B,
    N = MW * MH;
  const LT = new Uint8Array(N),
    LZ = new Float32Array(N),
    LC = new Uint8Array(N),
    LB = new Uint8Array(N),
    LW = new Float32Array(N);
  let mh = 0,
    allW = true;
  for (let j = 0; j < MH; j++)
    for (let i = 0; i < MW; i++) {
      const q = i + j * MW;
      acc(i - B, j - B);
      let t = AT;
      if (t === LAVA) t = ROCK;
      LT[q] = t;
      LZ[q] = zcT(AT, AH);
      LC[q] = AC;
      LB[q] = AB;
      if (LZ[q] > mh) mh = LZ[q];
      if (!isWaterT(t) && i >= B && j >= B && i < B + NW && j < B + NH) allW = false;
    }
  // landness (for shallow water), gradients for shading
  const GX = new Float32Array(N),
    GY = new Float32Array(N);
  const EDGE = new Uint8Array(N),
    LDRY = new Float32Array(N);
  for (let j = 0; j < MH; j++)
    for (let i = 0; i < MW; i++) {
      const q = i + j * MW,
        t = LT[q];
      const cxw = X0 + (i - B + 0.5) * 10,
        cyw = Y0 + (j - B + 0.5) * 10;
      LDRY[q] =
        (vn(cxw / 90 + 3, cyw / 90 + 1) - 0.5) * 0.6 +
        (k < 0.5 ? 0 : (vn(cxw / 27, cyw / 27 + 4) - 0.5) * 0.35);
      if (!BLD[t] || LB[q] || k < 0.3) continue;
      let e = 0;
      for (let dj = -2; dj <= 2 && !e; dj++)
        for (let di = -2; di <= 2; di++) {
          const a = i + di,
            b = j + dj;
          if (a < 0 || b < 0 || a >= MW || b >= MH) continue;
          const t2 = LT[a + b * MW];
          if (t2 !== t && BLD[t2] && !LB[a + b * MW]) {
            e = 1;
            break;
          }
        }
      EDGE[q] = e;
    }
  for (let j = 0; j < MH; j++)
    for (let i = 0; i < MW; i++) {
      const q = i + j * MW;
      let l = 0,
        n = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const a = i + di,
            b = j + dj;
          if (a < 0 || b < 0 || a >= MW || b >= MH) continue;
          n++;
          if (!isWaterT(LT[a + b * MW])) l++;
        }
      LW[q] = l / n;
      if (i > 1 && j > 1 && i < MW - 2 && j < MH - 2) {
        GX[q] = ((LZ[q + 1] - LZ[q - 1]) / 20 + (LZ[q + 2] - LZ[q - 2]) / 40) * 0.5;
        GY[q] = ((LZ[q + MW] - LZ[q - MW]) / 20 + (LZ[q + 2 * MW] - LZ[q - 2 * MW]) / 40) * 0.5;
      } else if (i > 0 && j > 0 && i < MW - 1 && j < MH - 1) {
        GX[q] = (LZ[q + 1] - LZ[q - 1]) / 20;
        GY[q] = (LZ[q + MW] - LZ[q - MW]) / 20;
      }
    }
  {
    // soften the 1 m height steps so slopes don't show contour rings
    const tx = new Float32Array(N),
      ty = new Float32Array(N);
    for (let j = 1; j < MH - 1; j++)
      for (let i = 1; i < MW - 1; i++) {
        const q = i + j * MW;
        let sx = 0,
          sy = 0;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const p = q + di + dj * MW;
            sx += GX[p];
            sy += GY[p];
          }
        tx[q] = sx / 9;
        ty[q] = sy / 9;
      }
    GX.set(tx);
    GY.set(ty);
  }
  const S = { OX: X0, OY: Y0, CS: 10 };
  const bb = chunkBounds(S, 0, 0, NW, NH, k, mh + (opts.detail ? 16 : 6)),
    ox = bb[0],
    oy = bb[1],
    w = bb[2] - ox,
    h = bb[3] - oy;
  if (w > 4096 || h > 4096 || w < 1 || h < 1) return { empty: 1 };
  const ax = Math.abs(SXx) + Math.abs(SXy),
    ay = Math.abs(SYx) + Math.abs(SYy);
  const step = Math.max(0.3, Math.min(4, 1.5 / (ax * k)));
  const nx = Math.ceil((NW * 10) / step),
    ny = Math.ceil((NH * 10) / step),
    stx = (NW * 10) / nx,
    sty = (NH * 10) / ny;
  const SZ = new Float32Array(nx * ny),
    SCc = new Uint32Array(nx * ny),
    SKIP = new Uint8Array(nx * ny);
  const fF = false,
    inFX = opts.skipF;
  // cells along a shoreline (water next to land, no buildings or piers around) get a smooth, noisy shore instead of 10 m steps
  const SHORE = new Uint8Array(N);
  for (let j = 2; j < MH - 2; j++)
    for (let i = 2; i < MW - 2; i++) {
      const q = i + j * MW,
        w0 = isWaterT(LT[q]);
      let d = 0,
        bad = 0;
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) {
          const p = q + di + dj * MW,
            t2 = LT[p];
          if (isWaterT(t2) !== w0) d = 1;
          if (LB[p] || t2 === PIER) bad = 1;
        }
      SHORE[q] = d && !bad ? 1 : 0;
    }
  for (let b = 0; b < ny; b++) {
    const y = Y0 + (b + 0.5) * sty;
    for (let a = 0; a < nx; a++) {
      const x = X0 + (a + 0.5) * stx,
        si = a + b * nx;
      if (fF && x >= F.OX && y >= F.OY && x < F.x1 && y < F.y1) {
        SKIP[si] = 1;
        continue;
      }
      const fx = (x - X0) / 10 + B,
        fy = (y - Y0) / 10 + B,
        ci = Math.floor(fx),
        cj = Math.floor(fy),
        q0 = ci + cj * MW;
      let t = LT[q0];
      if (SHORE[q0]) {
        const gx = fx - 0.5,
          gy = fy - 0.5,
          i2 = Math.floor(gx),
          j2 = Math.floor(gy),
          u2 = gx - i2,
          v2 = gy - j2,
          qa = i2 + j2 * MW;
        const qs = [qa, qa + 1, qa + MW, qa + MW + 1],
          ws = [(1 - u2) * (1 - v2), u2 * (1 - v2), (1 - u2) * v2, u2 * v2];
        let m = 0,
          mw = 0;
        {
          const pxs = fx,
            pys = fy,
            ci2 = Math.floor(pxs),
            cj2 = Math.floor(pys);
          for (let dj = -2; dj <= 2; dj++)
            for (let di = -2; di <= 2; di++) {
              const a2 = ci2 + di,
                b2 = cj2 + dj;
              if (a2 < 0 || b2 < 0 || a2 >= MW || b2 >= MH) continue;
              const ddx = a2 + 0.5 - pxs,
                ddy = b2 + 0.5 - pys,
                w = Math.exp(-(ddx * ddx + ddy * ddy) / 1.3);
              mw += w;
              if (isWaterT(LT[a2 + b2 * MW])) m += w;
            }
          m /= mw;
        }
        m += (vn(x / 9 + 2, y / 9 + 5) - 0.5) * 0.34 + (k >= 1.2 ? (vn(x / 3 + 9, y / 3) - 0.5) * 0.14 : 0);
        const wantW = m > 0.5;
        if (wantW !== isWaterT(t)) {
          let best = -1,
            bw = -1;
          for (let n2 = 0; n2 < 4; n2++) {
            const tt = LT[qs[n2]];
            if (isWaterT(tt) === wantW && !LB[qs[n2]] && tt !== PAVED && ws[n2] > bw) {
              bw = ws[n2];
              best = tt;
            }
          }
          if (best < 0)
            for (let dj = -1; dj <= 1 && best < 0; dj++)
              for (let di = -1; di <= 1; di++) {
                const tt = LT[q0 + di + dj * MW];
                if (isWaterT(tt) === wantW && tt !== PAVED) {
                  best = tt;
                  break;
                }
              }
          if (best >= 0) t = best;
        }
      }
      // organic boundaries between natural ground types
      let jx = 0,
        jy = 0,
        mix = false;
      if (EDGE[q0] && !LB[q0]) {
        jx =
          (vn(x / 7.5 + 13, y / 7.5 + 7) - 0.5) * 11 +
          (k >= 1.2 ? (vn(x / 2.4, y / 2.4 + 19) - 0.5) * 3.5 : 0);
        jy =
          (vn(x / 7.5 + 3, y / 7.5 + 29) - 0.5) * 11 +
          (k >= 1.2 ? (vn(x / 2.4 + 23, y / 2.4) - 0.5) * 3.5 : 0);
        const qj = Math.floor(fx + jx / 10) + Math.floor(fy + jy / 10) * MW;
        const t2 = LT[qj];
        if (t2 !== t && BLD[t2] && !LB[qj] && !LC[qj] && !LC[q0]) t = t2;
        mix = true;
      }
      // bilinear height & gradient between cell centres
      const gx = fx - 0.5,
        gy = fy - 0.5,
        i = Math.floor(gx),
        j = Math.floor(gy),
        u = gx - i,
        v = gy - j,
        q = i + j * MW;
      const w00 = (1 - u) * (1 - v),
        w10 = u * (1 - v),
        w01 = (1 - u) * v,
        w11 = u * v;
      let z;
      const water = isWaterT(t);
      if (LB[q0]) z = LZ[q0];
      else z = LZ[q] * w00 + LZ[q + 1] * w10 + LZ[q + MW] * w01 + LZ[q + MW + 1] * w11;
      if (water) {
        // flat water at the level of the nearest water cell
        let wl = 1e9;
        for (const qq of [q0, q, q + 1, q + MW, q + MW + 1]) if (isWaterT(LT[qq]) && LZ[qq] < wl) wl = LZ[qq];
        z = wl < 1e9 ? wl : z;
      } else {
        let wl = 1e9;
        for (const qq of [q, q + 1, q + MW, q + MW + 1]) if (isWaterT(LT[qq]) && LZ[qq] < wl) wl = LZ[qq];
        if (wl < 1e9 && z < wl + 0.35) z = wl + 0.35;
      }
      const Ls = LW[q] * w00 + LW[q + 1] * w10 + LW[q + MW] * w01 + LW[q + MW + 1] * w11;
      SM = k < 0.5 ? 1 : 0;
      DRYV = LDRY[q] * w00 + LDRY[q + 1] * w10 + LDRY[q + MW] * w01 + LDRY[q + MW + 1] * w11;
      if (mix && !water && BLD[t]) {
        // soft gaussian blend (σ≈8 m) over the ground types in a 5×5 neighbourhood; roads, water and buildings stay crisp
        const px = fx + (jx * 0.35) / 10,
          py = fy + (jy * 0.35) / 10,
          ci = Math.floor(px),
          cj = Math.floor(py);
        let ts0 = -1,
          ts1 = -1,
          ts2 = -1,
          w0 = 0,
          w1 = 0,
          w2 = 0;
        for (let dj = -2; dj <= 2; dj++)
          for (let di = -2; di <= 2; di++) {
            const a2 = ci + di,
              b2 = cj + dj;
            if (a2 < 0 || b2 < 0 || a2 >= MW || b2 >= MH) continue;
            const qq = a2 + b2 * MW,
              tt = LT[qq];
            if (!BLD[tt] || LB[qq]) continue;
            const ddx = a2 + 0.5 - px,
              ddy = b2 + 0.5 - py,
              d2 = (ddx * ddx + ddy * ddy) * 8;
            if (d2 >= 63) continue;
            const w = GWL[d2 | 0];
            if (tt === ts0) w0 += w;
            else if (tt === ts1) w1 += w;
            else if (tt === ts2) w2 += w;
            else if (ts0 < 0) {
              ts0 = tt;
              w0 = w;
            } else if (ts1 < 0) {
              ts1 = tt;
              w1 = w;
            } else if (ts2 < 0) {
              ts2 = tt;
              w2 = w;
            }
          }
        const sw = w0 + w1 + w2;
        if (ts1 < 0 || sw <= 0) sCol(t, z, x, y, Ls);
        else {
          let ar = 0,
            ag = 0,
            ab = 0;
          for (const [tt, ww] of [
            [ts0, w0],
            [ts1, w1],
            [ts2, w2]
          ]) {
            if (tt < 0 || ww / sw < 0.03) continue;
            sCol(tt, z, x, y, Ls);
            ar += SR * ww;
            ag += SG * ww;
            ab += SB * ww;
          }
          let s2 = 0;
          for (const [tt, ww] of [
            [ts0, w0],
            [ts1, w1],
            [ts2, w2]
          ])
            if (tt >= 0 && ww / sw >= 0.03) s2 += ww;
          SR = ar / s2;
          SG = ag / s2;
          SB = ab / s2;
        }
      } else sCol(t, z, x, y, Ls);
      SM = 0;
      DRYV = null;
      let sh = 1;
      if (!water) {
        const dzx = GX[q] * w00 + GX[q + 1] * w10 + GX[q + MW] * w01 + GX[q + MW + 1] * w11,
          dzy = GY[q] * w00 + GY[q + 1] * w10 + GY[q + MW] * w01 + GY[q + MW + 1] * w11;
        sh =
          1 +
          Math.max(-0.45, Math.min(0.45, (dzx * SXx + dzy * SXy) * 0.7071 * 3.6)) -
          Math.min(0.12, Math.hypot(dzx, dzy) * 0.35);
        sh *= 0.93 + 0.14 * Math.min(1, Math.max(0, z) / 110);
      }
      const r = Math.min(255, SR * sh) | 0,
        g = Math.min(255, SG * sh) | 0,
        bl = Math.min(255, SB * sh) | 0;
      SZ[si] = z;
      SCc[si] = (255 << 24) | (bl << 16) | (g << 8) | r;
    }
  }
  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  const c = cvs.getContext('2d');
  const img = c.createImageData(w, h),
    buf = new Uint32Array(img.data.buffer),
    dep = new Float32Array(w * h).fill(-1e30);
  const sa = SYx > 1e-6 ? 1 : SYx < -1e-6 ? -1 : 0,
    sb = SYy > 1e-6 ? 1 : SYy < -1e-6 ? -1 : 0;
  const pw = Math.max(1, Math.ceil(stx * ax * k + 0.6)),
    ph = Math.max(1, Math.ceil(sty * ay * k + 0.6));
  for (let b = 0; b < ny; b++) {
    const y = Y0 + (b + 0.5) * sty;
    for (let a = 0; a < nx; a++) {
      const si = a + b * nx;
      if (SKIP[si]) continue;
      const x = X0 + (a + 0.5) * stx,
        z = SZ[si],
        col = SCc[si];
      const PY = PYw(x, y);
      const sx = PXw(x, y) * k - ox,
        sy = (PY - z) * k - oy;
      // extend down to the nearer neighbour's screen row to close gaps on slopes and cliffs
      let ext = 0,
        cliff = 0;
      if (sa) {
        const aa = a + sa;
        if (aa >= 0 && aa < nx) {
          const zn = SZ[aa + b * nx];
          const d = (SYx * sa * stx - (zn - z)) * k - ph;
          if (d > ext) ext = d;
          if (z - zn > stx * 0.9) cliff = 1;
        }
      }
      if (sb) {
        const bb2 = b + sb;
        if (bb2 >= 0 && bb2 < ny) {
          const zn = SZ[a + bb2 * nx];
          const d = (SYy * sb * sty - (zn - z)) * k - ph;
          if (d > ext) ext = d;
          if (z - zn > sty * 0.9) cliff = 1;
        }
      }
      const x0 = Math.round(sx - pw * 0.5),
        y0 = Math.round(sy - ph * 0.5),
        x1 = Math.min(w, x0 + pw),
        y1b = Math.min(h, y0 + ph),
        y1 = Math.min(h, y0 + ph + Math.ceil(Math.min(ext, 60 * k)));
      const cd = cliff
        ? (255 << 24) |
          (((((col >> 16) & 255) * 0.62) | 0) << 16) |
          (((((col >> 8) & 255) * 0.6) | 0) << 8) |
          (((col & 255) * 0.6) | 0)
        : col;
      for (let yy = Math.max(0, y0); yy < y1; yy++) {
        const o = yy * w,
          cc = yy < y1b ? col : cd;
        for (let xx = Math.max(0, x0); xx < x1; xx++) {
          const p = o + xx;
          if (dep[p] <= PY) {
            dep[p] = PY;
            buf[p] = cc;
          }
        }
      }
    }
  }
  c.putImageData(img, 0, 0);
  DOX = ox;
  DOY = oy;
  DK = k;
  BAKE = false;
  const P = (x, y, z, f) => {
    const px = PXw(x, y) * k - ox,
      py = (PYw(x, y) - z) * k - oy;
    f ? c.moveTo(px, py) : c.lineTo(px, py);
  };
  drawAreasGround(c, k, X0, Y0, X0 + NW * 10, Y0 + NH * 10, ox, oy);
  drawRoads(c, k, X0, Y0, X0 + NW * 10, Y0 + NH * 10, ox, oy, !opts.detail);
  // user-edited ground covers roads: redraw those cells from the terrain image
  let anyC = false;
  for (let j = B; j < B + NH; j++)
    for (let i = B; i < B + NW; i++)
      if (LC[i + j * MW]) {
        anyC = true;
        break;
      }
  if (anyC) {
    const cp = document.createElement('canvas');
    cp.width = w;
    cp.height = h;
    cp.getContext('2d').putImageData(img, 0, 0);
    c.save();
    c.beginPath();
    for (let j = B; j < B + NH; j++)
      for (let i = B; i < B + NW; i++) {
        if (!LC[i + j * MW]) continue;
        const xa = X0 + (i - B) * 10,
          ya = Y0 + (j - B) * 10,
          z = LZ[i + j * MW];
        P(xa, ya, z, 1);
        P(xa + 10, ya, z);
        P(xa + 10, ya + 10, z);
        P(xa, ya + 10, z);
        c.closePath();
      }
    c.clip();
    c.drawImage(cp, 0, 0);
    c.restore();
  }
  drawAreasTop(c, k, X0, Y0, X0 + NW * 10, Y0 + NH * 10, ox, oy);
  // trees, hay bales and boulders (detail ground only), in depth order
  if (opts.detail && k >= 0.27) {
    const gx0 = Math.round(X0 / 10),
      gy0 = Math.round(Y0 / 10);
    loopOrder(0, NW, 0, NH, (outerJ, o, q0, dq) => {
      const n = outerJ ? NW : NH;
      for (let s = 0; s < n; s++) {
        const qq = q0 + s * dq,
          ii = outerJ ? qq : o,
          jj = outerJ ? o : qq,
          q = ii + B + (jj + B) * MW,
          tt = LT[q];
        const gx = ii + gx0,
          gy = jj + gy0;
        if (inFX && inF(X0 + (ii + 0.5) * 10, Y0 + (jj + 0.5) * 10)) continue;
        const nt =
          tt === WOOD
            ? 2
            : tt === SCRUB && h32(gx, gy, 40) < 0.12
              ? 1
              : tt === GRASS && h32(gx, gy, 41) < 0.006
                ? 1
                : 0;
        for (let q2 = 0; q2 < nt; q2++) {
          const px = X0 + (ii + h32(gx, gy, 42 + q2)) * 10,
            py = Y0 + (jj + h32(gx, gy, 44 + q2)) * 10;
          const z = surfZ(
            px,
            py,
            X0 - B * 10,
            Y0 - B * 10,
            (a, b) => LZ[Math.max(0, Math.min(MW - 1, a)) + Math.max(0, Math.min(MH - 1, b)) * MW]
          );
          if (k < 0.6) {
            c.fillStyle = N_(tt === WOOD ? [40, 78, 52] : leafCol(h32(gx, gy, 46)) || [98, 84, 76], 1);
            c.fillRect(Math.round(PXw(px, py) * k - ox), Math.round((PYw(px, py) - z) * k - oy) - 1, 1, 1);
            continue;
          }
          treeAt(
            c,
            Math.round(PXw(px, py) * k - ox),
            Math.round((PYw(px, py) - z) * k - oy),
            k,
            tt === WOOD && h32(gx, gy, 47 + q2) < 0.55 ? 0 : 1,
            h32(gx, gy, 48 + q2)
          );
        }
        if (tt === HAY && k >= 0.6 && h32(gx, gy, 50) < 0.035) {
          const px = X0 + (ii + 0.5) * 10,
            py = Y0 + (jj + 0.5) * 10;
          if (hayP(px, py) <= 0.86) {
            const z = LZ[q];
            const sx2 = Math.round(PXw(px, py) * k - ox),
              sy2 = Math.round((PYw(px, py) - z) * k - oy),
              bw = Math.max(1, Math.round(k * 0.8)),
              bh = Math.max(2, Math.round(k * 1.3));
            c.fillStyle = 'rgba(0,0,0,.22)';
            c.fillRect(
              sx2 - bw,
              sy2,
              bw * 2 + Math.max(1, Math.round(k * 0.5)),
              Math.max(1, Math.round(k * 0.4))
            );
            c.fillStyle = N_([224, 226, 220], 1);
            c.fillRect(sx2 - bw, sy2 - bh, bw * 2, bh);
            c.fillStyle = N_([250, 250, 246], 1);
            c.fillRect(sx2 - bw, sy2 - bh, bw * 2, Math.max(1, bh >> 2));
            c.fillStyle = N_([190, 192, 188], 1);
            c.fillRect(sx2 + bw - Math.max(1, bw >> 1), sy2 - bh, Math.max(1, bw >> 1), bh);
          }
        }
        if ((tt === HIGH || tt === ROCK) && k >= 1.3 && h32(gx, gy, 33) < 0.22) {
          const px = X0 + (ii + h32(gx, gy, 34)) * 10,
            py = Y0 + (jj + h32(gx, gy, 35)) * 10,
            z = LZ[q],
            r2 = (0.5 + h32(gx, gy, 36) * 0.9) * k;
          const sx2 = PXw(px, py) * k - ox,
            sy2 = (PYw(px, py) - z) * k - oy;
          c.fillStyle = N_([88, 86, 84], 1);
          c.fillRect(Math.round(sx2 - r2), Math.round(sy2 - r2), Math.round(r2 * 2), Math.round(r2 * 1.3));
          c.fillStyle = N_([122, 120, 114], 1);
          c.fillRect(
            Math.round(sx2 - r2),
            Math.round(sy2 - r2),
            Math.round(r2 * 1.6),
            Math.max(1, Math.round(r2 * 0.45))
          );
        }
      }
    });
  }
  BAKE = true;
  return { cv: cvs, ox, oy, w, h };
}
let AT = 0,
  AH = 0,
  AC = 0,
  AB = 0;
function renderFine(L, cx, cy) {
  const k = LEVELS[L],
    CC = CCF(k),
    i0 = cx * CC,
    j0 = cy * CC;
  if (i0 >= F.W || j0 >= F.H || i0 < 0 || j0 < 0) return null;
  const NW = Math.min(CC, F.W - i0),
    NH = Math.min(CC, F.H - j0);
  return renderSmooth(
    k,
    F.OX + i0 * 10,
    F.OY + j0 * 10,
    NW,
    NH,
    (i, j) => {
      const c = fetchF(i0 + i, j0 + j);
      AT = F.GT[c];
      AH = F.HT[c];
      AC = F.COVER[c];
      AB = F.CBLD[c] >= 0 ? 1 : 0;
      if (AT === GRASS && F.WILD && F.WILD[c] && !AC) {
        const x = F.OX + ((c % F.W) + 0.5) * 10,
          y = F.OY + (((c / F.W) | 0) + 0.5) * 10;
        hInterp(x, y);
        AT = landTAt(x, y, AH);
      }
    },
    { detail: false, skipF: false }
  );
}
function chunkInF(cx, cy, CC) {
  const x0 = C.OX + cx * CC * DCS,
    y0 = C.OY + cy * CC * DCS,
    S = CC * DCS;
  return x0 >= F.OX && y0 >= F.OY && x0 + S <= F.x1 && y0 + S <= F.y1;
}
function dAcc(gi, gj) {
  if (gi < 0) gi = 0;
  if (gj < 0) gj = 0;
  if (gi >= DGW) gi = DGW - 1;
  if (gj >= DGH) gj = DGH - 1;
  const t = getTile((gi / DT) | 0, (gj / DT) | 0, true);
  if (!t) {
    AT = CLS_T[clsFast(gi, gj)];
    AH = 1;
    AC = 0;
    AB = 0;
    return;
  }
  const i = (gi % DT) + (gj % DT) * DT;
  AT = t.GT[i];
  AH = t.HT[i];
  AC = t.COVER[i];
  AB = 0;
}
function renderDetail(L, cx, cy) {
  const k = LEVELS[L],
    CC = CCF(k),
    gi0 = cx * CC,
    gj0 = cy * CC;
  if (chunkInF(cx, cy, CC)) return { empty: 1 };
  if (gi0 < 0 || gj0 < 0 || gi0 >= DGW || gj0 >= DGH) return { empty: 1 };
  const X0 = C.OX + gi0 * DCS,
    Y0 = C.OY + gj0 * DCS;
  const inter = X0 + CC * 10 > F.OX && Y0 + CC * 10 > F.OY && X0 < F.x1 && Y0 < F.y1;
  return renderSmooth(k, X0, Y0, CC, CC, (i, j) => dAcc(gi0 + i, gj0 + j), { detail: true, skipF: inter });
}
/* smooth ground height used by people, animals, trees and particles */

function hSmoothF(x, y) {
  const ci = Math.floor((x - F.OX) / 10),
    cj = Math.floor((y - F.OY) / 10),
    c = ci + cj * F.W,
    t = F.GT[c];
  const z0 = zcT(t, F.HT[c]);
  if (isWaterT(t) || F.CBLD[c] >= 0) return z0;
  const fx = (x - F.OX) / 10 - 0.5,
    fy = (y - F.OY) / 10 - 0.5,
    i = Math.floor(fx),
    j = Math.floor(fy),
    u = fx - i,
    v = fy - j;
  let s = 0,
    wsum = 0,
    wl = 1e9;
  for (let q = 0; q < 4; q++) {
    const a = i + (q & 1),
      b = j + (q >> 1),
      cc = fetchF(a, b),
      w = (q & 1 ? u : 1 - u) * (q >> 1 ? v : 1 - v);
    const tt = F.GT[cc];
    const zz = F.CBLD[cc] >= 0 ? z0 : zcT(tt, F.HT[cc]);
    if (isWaterT(tt) && zz < wl) wl = zz;
    s += zz * w;
    wsum += w;
  }
  let z = s / wsum;
  if (wl < 1e9 && z < wl + 0.35) z = wl + 0.35;
  return z;
}
function hSmoothD(x, y, gen) {
  const fx = (x - C.OX) / 10 - 0.5,
    fy = (y - C.OY) / 10 - 0.5,
    i = Math.floor(fx),
    j = Math.floor(fy),
    u = fx - i,
    v = fy - j;
  let s = 0,
    wl = 1e9;
  for (let q = 0; q < 4; q++) {
    let a = i + (q & 1),
      b = j + (q >> 1);
    if (a < 0) a = 0;
    if (b < 0) b = 0;
    const t = getTile((a / DT) | 0, (b / DT) | 0, gen);
    if (!t) return null;
    const ii = (a % DT) + (b % DT) * DT,
      tt = t.GT[ii],
      zz = zcT(tt, t.HT[ii]);
    if (isWaterT(tt) && zz < wl) wl = zz;
    s += zz * (q & 1 ? u : 1 - u) * (q >> 1 ? v : 1 - v);
  }
  if (wl < 1e9 && s < wl + 0.35) s = wl + 0.35;
  return s;
}

function treeAt(c, sx, sy, k, kind, sd) {
  const sz = k * (0.75 + sd * 0.55);
  const s = treeSprite(kind, sd, sz, false, false);
  c.drawImage(s.cv, sx - s.ax, sy - s.ay);
}
