/**
 * Lighting and building drawing
 *
 * Light colour for the time of day (LR/LG/LB) and drawing buildings, including the per-building sprite
 * cache.
 *
 * Functions: C_, N_, wallShade, LITW, FR, perfStep, bsprKey, drawBldC, drawBld, gable, pyramid, harpaFace,
 *     prism, ngon, area2, drawPerlan, drawVoyager, drawRubble, scaffold, flames, drawTree
 * State and constants: LR, LG, LB, dayL, night, nightK, gameMin, DAY0, DOY0, BAKE, col, DOX, DOY, DK, SXA, SYB,
 *     SYT, VIS, faces, SKS, SKA, BSPR, bsprPx, LOWEND, BSPR_MAX, PERF, perfN, perfS, bsprBudget, FIREC
 */

let LR = 1,
  LG = 1,
  LB = 1,
  dayL = 1,
  night = false,
  nightK = 0,
  gameMin = 15 * 60,
  // The game starts at 15:00 on Monday 15 June
  DAY0 = 1, // weekday of game day 0, Sunday = 0
  DOY0 = 165; // day of year of game day 0 (1 January = 0)

function C_(c, m) {
  return 'rgb(' + ((c[0] * m * LR) | 0) + ',' + ((c[1] * m * LG) | 0) + ',' + ((c[2] * m * LB) | 0) + ')';
}
function N_(c, m) {
  return 'rgb(' + ((c[0] * m) | 0) + ',' + ((c[1] * m) | 0) + ',' + ((c[2] * m) | 0) + ')';
}
let BAKE = true;
const col = (c, m) => (BAKE ? C_(c, m) : N_(c, m));

/* ================= drawing primitives ================= */
let DOX = 0,
  DOY = 0,
  DK = 1;
const SXA = new Float32Array(8192),
  SYB = new Float32Array(8192),
  SYT = new Float32Array(8192),
  VIS = [];
function wallShade(nx, ny) {
  const l = Math.hypot(nx, ny) || 1;
  return 0.84 + 0.12 * ((nx * SXx + ny * SXy) / (1.4142 * l));
}
const faces = (nx, ny) => nx * SYx + ny * SYy;
function LITW(b, e, f, c) {
  return h32(b.id * 31 + e, f * 17 + c, 9) < 0.48;
}
let SKS = 0,
  SKA = 0; // windows follow the slope of the wall they sit in
function FR(c, x, y, w, h) {
  const d = SKS * w;
  if (d < 0.6 && d > -0.6) {
    c.fillRect(x, y, w, h);
    return;
  }
  const y0 = y + (x - SKA) * SKS,
    y1 = y + (x + w - SKA) * SKS;
  c.beginPath();
  c.moveTo(x, y0);
  c.lineTo(x + w, y1);
  c.lineTo(x + w, y1 + h);
  c.lineTo(x, y0 + h);
  c.closePath();
  c.fill();
}
/* close-up view: every building is drawn once into its own little image and reused each frame until something about it changes
   (the view, the light, snow, damage). Animated or changing buildings are still drawn directly. */
const BSPR = new Map();
let bsprPx = 0;
const LOWEND = innerWidth <= 760 || (navigator.hardwareConcurrency || 8) <= 4;
const BSPR_MAX = LOWEND ? 20e6 : 40e6;
/* crowd density adapts to the device: if frames get slow, fewer people and cars are spawned; it creeps back up when there is room */
let PERF = LOWEND ? 0.7 : 1,
  perfN = 0,
  perfS = 0;
function perfStep(ms) {
  perfS += ms;
  perfN++;
  if (perfN < 60) return;
  const avg = perfS / perfN;
  perfS = 0;
  perfN = 0;
  if (avg > 30 && PERF > 0.45) PERF = Math.max(0.45, PERF - 0.1);
  else if (avg < 19 && PERF < (LOWEND ? 0.8 : 1)) PERF = Math.min(LOWEND ? 0.8 : 1, PERF + 0.05);
}
let bsprBudget = 0;
function bsprKey(b, k) {
  return (
    ROT +
    '|' +
    k +
    '|' +
    Math.round(LR * 48) +
    ',' +
    Math.round(LG * 48) +
    ',' +
    Math.round(LB * 48) +
    '|' +
    Math.round(nightK * 16) +
    '|' +
    SEAS +
    '|' +
    Math.round(snowAcc * 16) +
    '|' +
    SP.leaf +
    '|' +
    (SP.cover > 0 ? 1 : 0) +
    '|' +
    b.hp +
    '|' +
    (b.wallC || '') +
    (b.roofC || '')
  );
}
function drawBldC(b, k) {
  if (
    b.state !== 0 ||
    b.hide ||
    b.sp === 2 ||
    b.fire > 0 ||
    b.fly ||
    b.prog < 1 ||
    (b.isNew && b.prog < 1) ||
    k < 1
  ) {
    DOX = cx0;
    DOY = cy0;
    DK = k;
    drawBld(ctx, b, 1);
    return;
  }
  const key = bsprKey(b, k);
  let e = b.spr;
  if (!e || e.key !== key) {
    if (performance.now() > bsprBudget) {
      if (e && e.k === k && e.rot === ROT) {
        ctx.drawImage(e.cv, e.ox - cx0, e.oy - cy0);
        return;
      }
      DOX = cx0;
      DOY = cy0;
      DK = k;
      drawBld(ctx, b, 1);
      return;
    } // over budget: an older image (slightly different light) is fine for a frame or two
    if (e) {
      bsprPx -= e.px;
      BSPR.delete(b);
    }
    const top = b.z + b.base + b.h + (b.sp === 1 ? 10 : b.sp === 3 ? 32 : b.spire ? b.spire + 4 : 16);
    const mnx = b.sMin - 8,
      mxx = b.sMax + 8,
      mny = b.dMin - top,
      mxy = b.dMax - b.z + 5;
    const ox = Math.floor(mnx * k),
      oy = Math.floor(mny * k),
      w = Math.ceil(mxx * k) - ox + 2,
      h = Math.ceil(mxy * k) - oy + 2;
    if (w * h > 3e6 || w <= 0 || h <= 0) {
      DOX = cx0;
      DOY = cy0;
      DK = k;
      drawBld(ctx, b, 1);
      return;
    }
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d');
    DOX = ox;
    DOY = oy;
    DK = k;
    BAKE = true;
    drawBld(c, b, 1);
    e = b.spr = { key, cv, ox, oy, px: w * h, k, rot: ROT };
    bsprPx += e.px;
  }
  BSPR.delete(b);
  BSPR.set(b, e); // most recently used last
  ctx.drawImage(e.cv, e.ox - cx0, e.oy - cy0);
  while (bsprPx > BSPR_MAX && BSPR.size) {
    const [ob, oe] = BSPR.entries().next().value;
    BSPR.delete(ob);
    bsprPx -= oe.px;
    if (ob.spr === oe) ob.spr = null;
  }
}
function drawBld(c, b, mode) {
  if (b.state === 9 || b.hide) return;
  if (b.state === 2) {
    drawRubble(c, b, mode);
    return;
  }
  const P = b.poly,
    n = b.n,
    k = DK;
  if (b.state === 3 && b.rb && b.prog < 0.12) {
    drawRubble(c, b, mode, 1 - b.prog / 0.12);
    return;
  }
  let pr = b.state === 3 && b.rb ? Math.max(0.03, (b.prog - 0.12) / 0.88) : b.prog;
  if (b.group && b.gTop === undefined) groupTop(groupOf(b));
  let hh = b.h * pr;
  if (b.state === 3 && b.gTop) {
    const cur = b.gTop * pr;
    if (cur <= b.base + 0.05) {
      if (b.base > 0) return;
    }
    hh = Math.max(0.05, Math.min(b.h, cur - b.base));
  }
  const zb = b.z + b.base,
    z0 = b.base ? zb : zb - 2,
    z1 = zb + hh;
  if (b.canopy && mode !== 2) drawCanopyUnder(c, b, zb);
  if (b.sp === 3) {
    drawPerlan(c, b, mode);
    return;
  }
  if (b.statue === 2) {
    if (mode !== 2) drawStatue(c, b, zb, hh);
    return;
  }
  if (b.sp === 5) {
    drawVoyager(c, b, mode);
    return;
  }
  for (let j = 0; j < n; j++) {
    const x = P[2 * j],
      y = P[2 * j + 1];
    SXA[j] = PXw(x, y) * k - DOX;
    const by = PYw(x, y) * k - DOY;
    SYB[j] = by - z0 * k;
    SYT[j] = by - z1 * k;
  }
  const lights = mode === 2;
  if (lights) {
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    c.beginPath();
    for (let j = 0; j < n; j++) {
      j ? c.lineTo(SXA[j], SYT[j]) : c.moveTo(SXA[j], SYT[j]);
    }
    c.fill();
    c.beginPath();
    for (let j = 0; j < n; j++) {
      const q = (j + 1) % n;
      if (faces(P[2 * q + 1] - P[2 * j + 1], -(P[2 * q] - P[2 * j])) <= 0) continue;
      c.moveTo(SXA[j], SYB[j]);
      c.lineTo(SXA[q], SYB[q]);
      c.lineTo(SXA[q], SYT[q]);
      c.lineTo(SXA[j], SYT[j]);
    }
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  const wc = b.state === 3 ? [196, 190, 180] : b.wallC,
    sc = b.hp < 50 ? 0.62 : 1;
  VIS.length = 0;
  for (let j = 0; j < n; j++) {
    const q = (j + 1) % n;
    if (faces(P[2 * q + 1] - P[2 * j + 1], -(P[2 * q] - P[2 * j])) <= 0) continue;
    VIS.push(j);
  }
  VIS.sort(
    (a, q) =>
      PYw(P[2 * a], P[2 * a + 1]) +
      PYw(P[2 * ((a + 1) % n)], P[2 * ((a + 1) % n) + 1]) -
      (PYw(P[2 * q], P[2 * q + 1]) + PYw(P[2 * ((q + 1) % n)], P[2 * ((q + 1) % n) + 1]))
  );
  const ea = eraClass(b),
    raised = ea <= 1 && b.kind <= 1 && !b.base && b.style !== 'barn' && !b.lm ? 0.6 : 0;
  const fh =
      b.fl && b.kind <= 2 && b.h > 2
        ? Math.max(2.5, Math.min(4.2, (b.h - raised) / b.fl))
        : b.kind >= 4
          ? 3.6
          : 3,
    floors = Math.max(1, Math.round((hh - raised) / fh)),
    winOK = k * fh >= 2.2 && b.kind !== 3 && b.sp !== 1 && !b.hk && !b.statue && !b.noWin;
  for (const j of VIS) {
    const q = (j + 1) % n;
    const dx = P[2 * q] - P[2 * j],
      dy = P[2 * q + 1] - P[2 * j + 1];
    if (!lights) {
      c.fillStyle = col(wc, wallShade(dy, -dx) * sc);
      c.beginPath();
      c.moveTo(SXA[j], SYB[j]);
      c.lineTo(SXA[q], SYB[q]);
      c.lineTo(SXA[q], SYT[q]);
      c.lineTo(SXA[j], SYT[j]);
      c.fill();
      if (raised && k >= 1.3) {
        const zt = (zb + raised + 0.25) * k;
        c.fillStyle = col([146, 146, 142], wallShade(dy, -dx) * sc);
        c.beginPath();
        c.moveTo(SXA[j], SYB[j]);
        c.lineTo(SXA[q], SYB[q]);
        c.lineTo(SXA[q], SYB[q] + z0 * k - zt);
        c.lineTo(SXA[j], SYB[j] + z0 * k - zt);
        c.fill();
      }
    }
    if (b.sp === 2) {
      harpaFace(c, b, j, P, z0, z1, mode);
      continue;
    }
    if (b.hk && !lights) {
      hallFace(c, b, j, P, dx, dy, zb, z1, wallShade(dy, -dx) * sc);
      continue;
    }
    if (b.kind === 3 && !lights && k >= 1.3 && b.state !== 3) {
      const L = Math.hypot(dx, dy),
        fs = Math.abs(SXA[q] - SXA[j]) / (L * k);
      if (fs > 0.3 && (j === b.doorW || (L >= 9 && b.area > 60))) {
        SKS =
          Math.abs(SXA[q] - SXA[j]) > 0.5
            ? Math.max(-2.5, Math.min(2.5, (SYB[q] - SYB[j]) / (SXA[q] - SXA[j])))
            : 0;
        const big = b.area >= 16,
          nd = big ? Math.max(1, Math.min(10, Math.floor(L / 3.3))) : 1,
          dwm = big ? 2.5 : 0.9,
          dhm = big ? 2.2 : 1.9,
          sh = wallShade(dy, -dx) * sc;
        const dcol = big
          ? ((b.seed * 13) | 0) % 3 === 0
            ? [150, 40, 36]
            : ((b.seed * 13) | 0) % 3 === 1
              ? [226, 226, 222]
              : [96, 100, 106]
          : [110, 84, 62];
        for (let i = 0; i < nd; i++) {
          const t = (i + 0.5) / nd,
            x = P[2 * j] + dx * t,
            y = P[2 * j + 1] + dy * t;
          SKA = PXw(x, y) * k - DOX;
          const w = Math.max(2, Math.round(dwm * fs * k)),
            h = Math.max(2, Math.round(dhm * k)),
            sx = Math.round(SKA - w / 2),
            sy = Math.round((PYw(x, y) - (zb + dhm)) * k - DOY);
          c.fillStyle = col(dcol, sh);
          FR(c, sx, sy, w, h);
          if (big && k >= 2.4) {
            c.fillStyle = col(dcol, sh * 0.8);
            const lw = Math.max(1, Math.round(k * 0.08));
            for (let r = 1; r < 5; r++) FR(c, sx, sy + Math.round((h * r) / 5), w, lw);
          }
        }
      }
    }
    if (!winOK && !(lights && k * fh >= 1)) continue;
    if (b.glass && !lights) {
      c.fillStyle = col([70, 96, 120], wallShade(dy, -dx));
      c.beginPath();
      c.moveTo(SXA[j], SYB[j] - k);
      c.lineTo(SXA[q], SYB[q] - k);
      c.lineTo(SXA[q], SYT[q] + k);
      c.lineTo(SXA[j], SYT[j] + k);
      c.fill();
    }
    const L = Math.hypot(dx, dy),
      st = b.style,
      mod = st === 'modern',
      sh2 = wallShade(dy, -dx) * sc;
    if (!lights && k >= 2.2 && (st === 'iron' || st === 'barn')) {
      const nl = Math.min(90, Math.floor(L / (st === 'barn' ? 0.9 : 0.7)));
      c.fillStyle = col(wc, sh2 * 0.88);
      const lw = Math.max(1, Math.round(k * 0.12));
      for (let i = 1; i < nl; i++) {
        const t = i / nl;
        const xa = SXA[j] + (SXA[q] - SXA[j]) * t,
          ya = SYB[j] + (SYB[q] - SYB[j]) * t,
          yt = SYT[j] + (SYT[q] - SYT[j]) * t;
        c.fillRect(Math.round(xa), Math.round(yt), lw, Math.max(1, Math.round(ya - yt)));
      }
    }
    const E = b.glass ? 3 : ea,
      apt = b.kind === 2;
    const nw = Math.floor(
      L /
        (st === 'barn'
          ? 6
          : apt
            ? [2.4, 2.7, 2.9, 3.2][E]
            : b.kind >= 4
              ? [3, 3.4, 3.6, 3.4][E]
              : [2.5, 3.2, 4.1, 4.4][E])
    );
    if (nw < 1) continue;
    const fsW = Math.min(1.3, Math.abs(SXA[q] - SXA[j]) / (L * k));
    if (fsW < 0.28 && !lights) continue;
    const ww = Math.max(
        1,
        Math.round(Math.max(0.45, fsW) * k * (apt ? [1, 1.25, 1.7, 1.9][E] : [0.95, 1.25, 2.2, 2.3][E]))
      ),
      wh = Math.max(1, Math.round(k * [1.65, 1.4, 1.35, 1.85][E]));
    const frm =
        !lights &&
        k >= 1.6 &&
        E <= 2 &&
        (st === 'iron' || st === 'conc' || st === 'farm' || st === 'apt' || b.kind === 7 || b.kind <= 2),
      fw = Math.max(1, Math.round(k * (E === 2 ? 0.2 : 0.26))),
      frC = E === 2 ? [96, 74, 54] : [242, 242, 238];
    const dcc = b.kind <= 1 && j === b.doorW && !b.base ? nw >> 1 : -1;
    const nx = dy / L,
      ny = -dx / L,
      ex = dx / L,
      ey = dy / L;
    // apartment blocks: balconies along the sunny long side, stairwell entrances on the other
    const AP = b.kind === 2 && !b.glass && b.h < 40 && !b.base,
      ob = AP ? obbOf(b) : null,
      slab = AP,
      longE = slab && L >= Math.max(8, 0.45 * ob.L);
    const balSide = longE && (ny > 0.2 || (Math.abs(ny) <= 0.2 && nx < 0)),
      entSide = longE && !balSide;
    let stairs = null;
    if (entSide && nw >= 3) {
      stairs = new Set();
      const ns = Math.max(1, Math.round(L / 16));
      for (let i = 0; i < ns; i++) stairs.add(Math.min(nw - 1, Math.floor(((i + 0.5) * nw) / ns)));
    }
    if (AP && !lights && k >= 1.6 && ea >= 1 && floors > 1) {
      c.fillStyle = col(wc, sh0(dy, -dx) * 0.84);
      const lw = Math.max(1, Math.round(k * 0.22));
      for (let f = 1; f < floors; f++) {
        const zz = (z0 + 2 + f * fh) * k;
        c.beginPath();
        c.moveTo(SXA[j], SYB[j] + z0 * k - zz);
        c.lineTo(SXA[q], SYB[q] + z0 * k - zz);
        c.lineTo(SXA[q], SYB[q] + z0 * k - zz + lw);
        c.lineTo(SXA[j], SYB[j] + z0 * k - zz + lw);
        c.fill();
      }
    }
    SKS =
      Math.abs(SXA[q] - SXA[j]) > 0.5
        ? Math.max(-2.5, Math.min(2.5, (SYB[q] - SYB[j]) / (SXA[q] - SXA[j])))
        : 0;
    for (let f = 0; f < floors; f++) {
      const wz = z0 + (b.base ? 0 : 2) + raised + f * fh + fh * 0.78;
      if (wz > z1 - 0.4) break;
      for (let cc = 0; cc < nw; cc++) {
        const t = (cc + 0.5) / nw,
          x = P[2 * j] + dx * t,
          y = P[2 * j + 1] + dy * t;
        const lit = LITW(b, j, f, cc);
        SKA = PXw(x, y) * k - DOX;
        const sx_ = Math.round(PXw(x, y) * k - DOX - ww / 2),
          sy_ = Math.round((PYw(x, y) - wz) * k - DOY);
        if (stairs && stairs.has(cc) && !lights) {
          if (k < 1.3) continue;
          if (f === 0) {
            const dw = Math.max(2, Math.round(k * 1.7)),
              dh = Math.max(2, Math.round(k * 2.3)),
              dzs = Math.round((PYw(x, y) - (zb + 2.3)) * k - DOY),
              dx0 = Math.round(PXw(x, y) * k - DOX - dw / 2);
            c.fillStyle = col([58, 70, 82], 1);
            FR(c, dx0, dzs, dw, dh);
            c.fillStyle = col([120, 150, 176], 1);
            FR(c, dx0, dzs, Math.max(1, dw >> 1), Math.max(1, Math.round(k * 0.3)));
            c.fillStyle = col([214, 214, 210], 1.04);
            FR(
              c,
              dx0 - Math.round(k * 0.5),
              dzs - Math.max(1, Math.round(k * 0.35)),
              dw + Math.round(k),
              Math.max(1, Math.round(k * 0.35))
            );
            continue;
          }
          const sw = Math.max(1, Math.round(k * 0.75)),
            shh = Math.max(1, Math.round(k * Math.min(2.1, fh * 0.7))),
            szs = Math.round((PYw(x, y) - (wz - fh * 0.45)) * k - DOY);
          c.fillStyle = col(b.balC || [226, 226, 222], 1);
          FR(c, Math.round(PXw(x, y) * k - DOX - sw / 2) - 1, szs - 1, sw + 2, shh + 2);
          c.fillStyle = col([50, 66, 86], 1);
          FR(c, Math.round(PXw(x, y) * k - DOX - sw / 2), szs, sw, shh);
          continue;
        }
        if (f === 0 && cc === dcc && !lights && k >= 1.3) {
          const dzs = Math.round((PYw(x, y) - (zb + raised + 2.1)) * k - DOY),
            dh = Math.max(2, Math.round(k * 2.1));
          if (raised) {
            c.fillStyle = col([172, 172, 168], 1.02);
            const sw = ww + 4 * fw;
            for (let t2 = 0; t2 < 3; t2++)
              FR(
                c,
                sx_ - 2 * fw + t2 * 0,
                dzs + dh + Math.round((t2 * raised * k) / 3),
                sw,
                Math.max(1, Math.round((raised * k) / 3) + 1)
              );
          }
          c.fillStyle = col(b.doorC, sh2);
          FR(c, sx_, dzs, ww, dh);
          if (frm) {
            c.fillStyle = col([242, 242, 238], 1);
            FR(c, sx_ - fw, dzs - fw, ww + 2 * fw, fw);
          }
          if (k >= 2.5) {
            c.fillStyle = col([220, 190, 90], 1);
            FR(c, sx_ + ww - Math.max(1, fw), dzs + (dh >> 1), 1, 1);
          }
          continue;
        }
        if (lights) {
          if (!lit) continue;
          c.fillStyle = h32(b.id, f, cc) < 0.2 ? '#bfe2ff' : '#ffd27a';
          FR(c, sx_, sy_, ww, wh);
          continue;
        }
        if (frm) {
          c.fillStyle = col(frC, sh2 > 1 ? 1 : 0.94);
          FR(c, sx_ - fw, sy_ - fw, ww + 2 * fw, wh + 2 * fw);
        }
        const litN = BAKE && lit && b.state !== 3 && nightK > 0.06 + 0.7 * h32(b.id, f, cc + 7); // windows come on one by one as it gets dark
        c.fillStyle = litN
          ? h32(b.id, f, cc) < 0.2
            ? '#c4e4ff'
            : '#ffd27a'
          : col(b.glass ? [150, 190, 214] : mod ? [40, 52, 66] : [50, 66, 86], 1);
        FR(c, sx_, sy_, ww, wh);
        if (!litN && k >= 2.5) {
          c.fillStyle = col([120, 150, 176], 1);
          FR(c, sx_, sy_, Math.max(1, ww >> 1), Math.max(1, Math.round(k * 0.2)));
          if (frm && ww >= 3) {
            c.fillStyle = col(frC, 1);
            const mb = Math.max(1, Math.round(k * 0.12));
            if (E === 0) {
              FR(c, sx_ + (ww >> 1), sy_, mb, wh);
              FR(c, sx_, sy_ + Math.round(wh * 0.36), ww, mb);
            } else if (E === 1) FR(c, sx_ + (ww >> 1), sy_, mb, wh);
            else FR(c, sx_ + Math.round(ww * 0.68), sy_, mb, wh);
          }
        }
        if (balSide && f > 0 && cc % 2 === 0 && cc + 1 < nw && k >= 1.3) {
          const t2 = (cc + 1) / nw,
            bx = P[2 * j] + dx * t2,
            by2 = P[2 * j + 1] + dy * t2,
            zf = zb + f * fh - 0.1,
            o = 1.45,
            hw2 = (L / nw) * 0.94;
          const pp = (u, v, zz) => [
            PXw(bx + ex * u + nx * v, by2 + ey * u + ny * v) * k - DOX,
            (PYw(bx + ex * u + nx * v, by2 + ey * u + ny * v) - zz) * k - DOY
          ];
          const quad = (A1, B1, C1, D1, cl) => {
            c.fillStyle = cl;
            c.beginPath();
            c.moveTo(A1[0], A1[1]);
            c.lineTo(B1[0], B1[1]);
            c.lineTo(C1[0], C1[1]);
            c.lineTo(D1[0], D1[1]);
            c.closePath();
            c.fill();
          };
          let bc = b.balC || [226, 226, 222];
          if (Math.abs(bc[0] - wc[0]) + Math.abs(bc[1] - wc[1]) + Math.abs(bc[2] - wc[2]) < 60)
            bc = wc[0] + wc[1] + wc[2] > 540 ? [150, 172, 190] : [236, 236, 232];
          quad(
            pp(-hw2, 0, zf),
            pp(hw2, 0, zf),
            pp(hw2, 0, zf + fh * 0.8),
            pp(-hw2, 0, zf + fh * 0.8),
            col(wc, sh2 * 0.74)
          );
          quad(pp(-hw2, 0, zf), pp(hw2, 0, zf), pp(hw2, o, zf), pp(-hw2, o, zf), col([196, 196, 194], 1.04));
          for (const sd of [-1, 1]) {
            const fv = faces(ex * sd, ey * sd);
            if (fv > 0)
              quad(
                pp(sd * hw2, 0, zf),
                pp(sd * hw2, o, zf),
                pp(sd * hw2, o, zf + 1.05),
                pp(sd * hw2, 0, zf + 1.05),
                col(bc, sh2 * 0.86)
              );
          }
          quad(
            pp(-hw2, o, zf),
            pp(hw2, o, zf),
            pp(hw2, o, zf + 1.05),
            pp(-hw2, o, zf + 1.05),
            col(bc, sh2 * 0.97)
          );
          quad(
            pp(-hw2, o, zf + 0.95),
            pp(hw2, o, zf + 0.95),
            pp(hw2, o, zf + 1.1),
            pp(-hw2, o, zf + 1.1),
            col([238, 238, 236], 1)
          );
          quad(
            pp(-hw2, o, zf - 0.25),
            pp(hw2, o, zf - 0.25),
            pp(hw2, o, zf),
            pp(-hw2, o, zf),
            col([168, 168, 166], sh2)
          );
        } else if (b.kind === 2 && !slab && f > 0 && cc % 2 === 0 && k >= 1.3 && b.h < 40) {
          const zf = zb + f * fh - 0.1,
            o = 1.25,
            hw2 = Math.min(1.25, (L / nw) * 0.45);
          const pp = (u, v, zz) => [
            PXw(x + ex * u + nx * v, y + ey * u + ny * v) * k - DOX,
            (PYw(x + ex * u + nx * v, y + ey * u + ny * v) - zz) * k - DOY
          ];
          const quad = (A1, B1, C1, D1, cl) => {
            c.fillStyle = cl;
            c.beginPath();
            c.moveTo(A1[0], A1[1]);
            c.lineTo(B1[0], B1[1]);
            c.lineTo(C1[0], C1[1]);
            c.lineTo(D1[0], D1[1]);
            c.closePath();
            c.fill();
          };
          quad(pp(-hw2, 0, zf), pp(hw2, 0, zf), pp(hw2, o, zf), pp(-hw2, o, zf), col([206, 206, 204], 1.04));
          quad(
            pp(-hw2, o, zf),
            pp(hw2, o, zf),
            pp(hw2, o, zf + 1),
            pp(-hw2, o, zf + 1),
            col(h32(b.id, 7, 1) < 0.5 ? [150, 172, 190] : wc, sh2 * 0.95)
          );
          quad(
            pp(-hw2, o, zf - 0.25),
            pp(hw2, o, zf - 0.25),
            pp(hw2, o, zf),
            pp(-hw2, o, zf),
            col([170, 170, 168], sh2)
          );
        }
      }
    }
  }
  if (lights) return;
  if (b.store && b.state !== 3) drawStoreFront(c, b, zb, z1);
  else if (b.brand && b.signW && b.state !== 3)
    for (const j of VIS)
      if (b.signW.has(j)) {
        const q = (j + 1) % n;
        const dx = P[2 * q] - P[2 * j],
          dy = P[2 * q + 1] - P[2 * j + 1];
        drawShopSign(c, b, j, P, dx, dy, zb, z1, wallShade(dy, -dx) * sc);
      }
  let rc = b.state === 3 ? [170, 166, 160] : b.roofC;
  const rs = SP.cover > 0 ? 0.82 : Math.min(0.85, snowAcc * 2.4);
  if (rs > 0 && b.state !== 3)
    rc = [rc[0] + (230 - rc[0]) * rs, rc[1] + (238 - rc[1]) * rs, rc[2] + (252 - rc[2]) * rs];
  if (b.rs && b.state !== 3 && (b.rs === 'gable' || b.rs === 'mono')) roofGeneric(c, b, P, z1, rc, wc, sc);
  else if (b.rs === 'hip' && b.state !== 3) roofHip(c, b, P, z1, rc, wc, sc);
  else if (b.roof === 1 && n === 4 && b.state !== 3) gable(c, b, P, z1, rc, wc, sc);
  else if ((b.roof === 2 || b.roof === 3) && b.state !== 3)
    pyramid(c, b, P, z1, rc, b.roof === 3 ? b.spire || b.h * 0.12 + 3.5 : Math.min(3.5, b.r * 0.5));
  else {
    c.fillStyle = col(rc, 1.06 * sc);
    c.beginPath();
    for (let j = 0; j < n; j++) {
      j ? c.lineTo(SXA[j], SYT[j]) : c.moveTo(SXA[j], SYT[j]);
    }
    c.fill();
    if (b.kind === 2 && b.h >= 10 && k >= 1.3 && b.state !== 3 && !b.base) {
      const o = obbOf(b),
        nb = Math.max(1, Math.round(o.L / 26));
      for (let i = 0; i < nb; i++) {
        const u = o.u0 + ((i + 0.5) * o.L) / nb,
          x = b.cx + o.ux * u - o.uy * o.vm,
          y = b.cy + o.uy * u + o.ux * o.vm;
        if (pip(P, x, y)) roofBox(c, x, y, z1, Math.atan2(o.uy, o.ux), 2.2, 1.8, 2.4, wc, rc, sc);
      }
    } else if (k >= 1.3 && b.area > 140 && b.state !== 3) {
      c.fillStyle = col(rc, 0.82);
      for (let v = 0; v < Math.min(4, b.area / 150); v++) {
        const x = b.minx + (b.maxx - b.minx) * (0.25 + 0.5 * h32(b.id, v, 3)),
          y = b.miny + (b.maxy - b.miny) * (0.25 + 0.5 * h32(b.id, v, 4));
        if (!pip(P, x, y)) continue;
        c.fillRect(
          Math.round(PXw(x, y) * k - DOX),
          Math.round((PYw(x, y) - z1 - 1) * k - DOY),
          Math.max(1, k * 1.6),
          Math.max(1, k * 1.2)
        );
      }
    }
  }
  if (b.hk && b.base + b.h >= 72 && b.state !== 3 && k >= 0.6) {
    const s0 = [PXw(b.cx, b.cy) * k - DOX, (PYw(b.cx, b.cy) - z1) * k - DOY];
    c.fillStyle = col([222, 220, 214], 1);
    const lw = Math.max(1, Math.round(k * 0.35));
    c.fillRect(Math.round(s0[0] - lw / 2), Math.round(s0[1] - k * 3.4), lw, Math.round(k * 3.4));
    c.fillRect(
      Math.round(s0[0] - k * 0.9),
      Math.round(s0[1] - k * 2.6),
      Math.max(2, Math.round(k * 1.8)),
      lw
    );
  }
  if (b.state === 3) scaffold(c, b, P, z0, z1);
  if (b.canopy && b.state !== 3) drawPylon(c, b);
  if (b.store && b.state !== 3) drawStoreRoof(c, b, zb, z1);
  if (b.fire > 0 && mode !== 0) flames(c, b, z1);
}
function gable(c, b, P, z1, rc, wc, sc) {
  const k = DK;
  const e0 = Math.hypot(P[2] - P[0], P[3] - P[1]),
    e1 = Math.hypot(P[4] - P[2], P[5] - P[3]);
  let v = [0, 1, 2, 3];
  if (e1 > e0) v = [1, 2, 3, 0];
  const X = i => P[2 * v[i]],
    Y = i => P[2 * v[i] + 1];
  const rh = Math.min(4.5, Math.min(e0, e1) * 0.42);
  const r0x = (X(3) + X(0)) / 2,
    r0y = (Y(3) + Y(0)) / 2,
    r1x = (X(1) + X(2)) / 2,
    r1y = (Y(1) + Y(2)) / 2,
    zr = z1 + rh;
  const p = (x, y, z) => [PXw(x, y) * k - DOX, (PYw(x, y) - z) * k - DOY];
  const sA = [
      [X(0), Y(0), z1],
      [X(1), Y(1), z1],
      [r1x, r1y, zr],
      [r0x, r0y, zr]
    ],
    sB = [
      [X(2), Y(2), z1],
      [X(3), Y(3), z1],
      [r0x, r0y, zr],
      [r1x, r1y, zr]
    ];
  const nA = [Y(1) - Y(0), -(X(1) - X(0))],
    nB = [Y(3) - Y(2), -(X(3) - X(2))];
  const g1 = [
      [X(1), Y(1), z1],
      [X(2), Y(2), z1],
      [r1x, r1y, zr]
    ],
    g2 = [
      [X(3), Y(3), z1],
      [X(0), Y(0), z1],
      [r0x, r0y, zr]
    ];
  const n1 = [Y(2) - Y(1), -(X(2) - X(1))],
    n2 = [Y(0) - Y(3), -(X(0) - X(3))];
  const fr = (pts, cl, m) => {
    c.fillStyle = col(cl, m);
    c.beginPath();
    pts.forEach((q, i) => {
      const s = p(q[0], q[1], q[2]);
      i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
    });
    c.fill();
  };
  const fa = faces(nA[0], nA[1]) > 0,
    fb = faces(nB[0], nB[1]) > 0;
  if (!fa) fr(sA, rc, 0.78 * sc);
  if (!fb) fr(sB, rc, 0.78 * sc);
  if (faces(n1[0], n1[1]) > 0) fr(g1, wc, wallShade(n1[0], n1[1]) * sc);
  if (faces(n2[0], n2[1]) > 0) fr(g2, wc, wallShade(n2[0], n2[1]) * sc);
  const sh = n => 0.98 + 0.1 * Math.sign(n[0] * SXx + n[1] * SXy);
  if (fa) fr(sA, rc, sh(nA) * sc);
  if (fb) fr(sB, rc, sh(nB) * sc);
  if (DK >= 2 && b.kind <= 1) {
    const s = p(r0x * 0.7 + r1x * 0.3, r0y * 0.7 + r1y * 0.3, zr + 0.2);
    c.fillStyle = col([110, 90, 80], 1);
    c.fillRect(Math.round(s[0]), Math.round(s[1] - DK * 1.2), Math.max(1, DK * 0.8), Math.max(1, DK * 1.4));
  }
}
function pyramid(c, b, P, z1, rc, rh) {
  const k = DK,
    n = b.n,
    ax = PXw(b.cx, b.cy) * k - DOX,
    ay = (PYw(b.cx, b.cy) - z1 - rh) * k - DOY;
  const fs = [];
  for (let j = 0; j < n; j++) {
    const q = (j + 1) % n;
    const nx = P[2 * q + 1] - P[2 * j + 1],
      ny = -(P[2 * q] - P[2 * j]);
    fs.push([j, q, faces(nx, ny), wallShade(nx, ny)]);
  }
  fs.sort((a, b2) => a[2] - b2[2]);
  for (const [j, q, v, s] of fs) {
    c.fillStyle = col(rc, v > 0 ? s + 0.06 : 0.76);
    c.beginPath();
    c.moveTo(SXA[j], SYT[j]);
    c.lineTo(SXA[q], SYT[q]);
    c.lineTo(ax, ay);
    c.fill();
  }
}

/* Harpa: Ólafur Elíasson's facade of glass "quasi-bricks" — a honeycomb of steel-framed cells, smoky glass that catches the sky,
   a few tinted panes, and LEDs in every cell that play slow colour waves after dark */
function harpaFace(c, b, j, P, z0, z1, mode) {
  const k = DK,
    q = (j + 1) % b.n,
    dx = P[2 * q] - P[2 * j],
    dy = P[2 * q + 1] - P[2 * j + 1],
    L = Math.hypot(dx, dy);
  if (L < 0.5) return;
  const sh = wallShade(dy, -dx),
    S = (t, z) => [
      PXw(P[2 * j] + dx * t, P[2 * j + 1] + dy * t) * k - DOX,
      (PYw(P[2 * j] + dx * t, P[2 * j + 1] + dy * t) - z) * k - DOY
    ];
  const lit = mode === 2 || (BAKE && night);
  // the steel frame behind the glass
  if (!lit) {
    const A = S(0, z0),
      B2 = S(1, z0),
      C2 = S(1, z1),
      D = S(0, z1);
    c.fillStyle = col([132, 140, 148], sh);
    c.beginPath();
    c.moveTo(A[0], A[1]);
    c.lineTo(B2[0], B2[1]);
    c.lineTo(C2[0], C2[1]);
    c.lineTo(D[0], D[1]);
    c.fill();
  }
  const cw = 3.4,
    ch = 2.6;
  if (k * ch < 2.2) {
    // far away: just the glass tone
    if (!lit) {
      const A = S(0, z0),
        B2 = S(1, z0),
        C2 = S(1, z1),
        D = S(0, z1);
      c.fillStyle = col([58, 82, 104], sh);
      c.beginPath();
      c.moveTo(A[0], A[1]);
      c.lineTo(B2[0], B2[1]);
      c.lineTo(C2[0], C2[1]);
      c.lineTo(D[0], D[1]);
      c.fill();
    }
    return;
  }
  const nu = Math.ceil(L / cw) + 1,
    nv = Math.ceil((z1 - z0) / ch),
    g = k >= 1.4 ? 0.12 : 0.06;
  for (let v = 0; v < nv; v++) {
    const za = z0 + v * ch,
      zb = Math.min(z1, za + ch),
      off = (v % 2) * 0.5;
    for (let u = -1; u < nu; u++) {
      let ta = ((u + off) * cw) / L,
        tb = ((u + off + 1) * cw) / L;
      if (tb <= 0 || ta >= 1) continue;
      ta = Math.max(0, ta);
      tb = Math.min(1, tb);
      const hs = h32(b.id * 7 + j, u * 31 + v, 77);
      let cl;
      if (lit) {
        const w =
          Math.sin(((u * cw) / L + j) * 4 + v * 0.35 - time * 0.6) +
          Math.sin(v * 0.5 + time * 0.37 + u * 0.2);
        const hue = (195 + w * 40 + (hs < 0.08 ? 110 : 0) + 360) % 360;
        cl = 'hsl(' + hue + ',58%,' + (20 + hs * 12 + (w > 1.2 ? 16 : 0)) + '%)';
      } else {
        const sky = Math.max(0, v / nv - 0.25);
        const cc =
          hs < 0.05
            ? [226, 200, 96]
            : hs < 0.09
              ? [110, 190, 150]
              : hs < 0.25 + sky * 0.35
                ? [150, 190, 214]
                : hs < 0.6
                  ? [66, 94, 118]
                  : [48, 70, 92];
        cl = col(cc, sh);
      }
      const ti = g * (tb - ta),
        zi = g * (zb - za);
      const pts = [
        S(ta + ti, (za + zb) / 2),
        S(ta + (tb - ta) * 0.27, za + zi),
        S(tb - (tb - ta) * 0.27, za + zi),
        S(tb - ti, (za + zb) / 2),
        S(tb - (tb - ta) * 0.27, zb - zi),
        S(ta + (tb - ta) * 0.27, zb - zi)
      ];
      c.fillStyle = cl;
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < 6; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.closePath();
      c.fill();
    }
  }
}
function prism(c, pts, z0, z1, wc, rc, m) {
  const k = DK,
    n = pts.length / 2;
  const sx = [],
    sb = [],
    stp = [];
  for (let j = 0; j < n; j++) {
    const x = pts[2 * j],
      y = pts[2 * j + 1];
    sx.push(PXw(x, y) * k - DOX);
    const by = PYw(x, y) * k - DOY;
    sb.push(by - z0 * k);
    stp.push(by - z1 * k);
  }
  const order = [];
  for (let j = 0; j < n; j++) {
    const q = (j + 1) % n;
    const nx = pts[2 * q + 1] - pts[2 * j + 1],
      ny = -(pts[2 * q] - pts[2 * j]);
    if (faces(nx, ny) > 0)
      order.push([j, q, wallShade(nx, ny), PYw(pts[2 * j] + pts[2 * q], pts[2 * j + 1] + pts[2 * q + 1])]);
  }
  order.sort((a, b) => a[3] - b[3]);
  for (const [j, q, s] of order) {
    c.fillStyle = col(wc, s * (m || 1));
    c.beginPath();
    c.moveTo(sx[j], sb[j]);
    c.lineTo(sx[q], sb[q]);
    c.lineTo(sx[q], stp[q]);
    c.lineTo(sx[j], stp[j]);
    c.fill();
  }
  if (rc) {
    c.fillStyle = col(rc, 1.05 * (m || 1));
    c.beginPath();
    for (let j = 0; j < n; j++) j ? c.lineTo(sx[j], stp[j]) : c.moveTo(sx[j], stp[j]);
    c.fill();
  }
}
function ngon(cx, cy, r, n) {
  const o = [];
  for (let i = 0; i < n; i++) {
    const a = (-2 * Math.PI * i) / n;
    o.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  if (area2(o) < 0) {
    const p = [];
    for (let i = n - 1; i >= 0; i--) p.push(o[2 * i], o[2 * i + 1]);
    return p;
  }
  return o;
}
function area2(o) {
  let a = 0;
  const n = o.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += o[2 * i] * o[2 * j + 1] - o[2 * j] * o[2 * i + 1];
  }
  return a;
}
/* Perlan: the six hot-water tanks (fitted to their mapped outlines in setupPerlan), the hall between them and the
   aluminium-framed glass dome that rests on the tanks. Without mapped tanks it falls back to a ring round the hall. */
function drawPerlan(c, b, mode) {
  const k = DK,
    z = b.z,
    pr = b.prog,
    tankH = PERLAN_TANK_H * pr,
    ringR = b.ringR || Math.max(14, b.r * 0.62),
    tr = b.tankR || ringR * 0.42,
    tanks =
      b.tanks ||
      [0, 1, 2, 3, 4, 5].map(i => {
        const a = (i * Math.PI) / 3 + 0.3;
        return [b.cx + Math.cos(a) * ringR, b.cy + Math.sin(a) * ringR, tr];
      }),
    Rd = ringR * 0.85 * pr, // the dome rests on the inner halves of the tanks
    Hd = Math.max(2, (PERLAN_TOP - PERLAN_TANK_H) * pr);
  const S = (x, y, h) => [PXw(x, y) * k - DOX, (PYw(x, y) - z - h) * k - DOY];
  const ctr = S(b.cx, b.cy, tankH);
  // dome outline: the silhouette of a half-ellipsoid, sampled in world space so it is right in every view
  const domePt = (a, t) =>
    S(b.cx + Rd * Math.cos(t) * Math.cos(a), b.cy + Rd * Math.cos(t) * Math.sin(a), tankH + Hd * Math.sin(t));
  const domeShape = () => {
    c.beginPath();
    // the lower rim towards the viewer, then over the top
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * 2 * Math.PI,
        p = domePt(a, 0);
      i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
    }
    c.closePath();
    // upper part: the rim is an upright ellipse on screen; over it the dome's outline is close to an ellipse of the
    // same width reaching up by the dome's height
    const rx = Rd * k * Math.hypot(SXx, SXy),
      ryBase = Rd * k * Math.hypot(SYx, SYy),
      ry = Math.sqrt(ryBase * ryBase + Hd * k * (Hd * k));
    c.ellipse(ctr[0], ctr[1], rx, ry, 0, Math.PI, 0);
  };
  if (mode === 2) {
    if (k >= 0.3) {
      c.fillStyle = 'rgba(255,214,150,.9)';
      domeShape();
      c.fill();
    }
    return;
  }
  const items = tanks.map(t => [PYw(t[0], t[1]), 0, t]);
  items.push([PYw(b.cx, b.cy), 1, null]);
  items.sort((p, q) => p[0] - q[0]);
  for (const it of items) {
    if (it[1] === 1) {
      // the hall between the tanks: dark glass behind light frames
      prism(
        c,
        b.hallPoly || ngon(b.cx, b.cy, ringR * 0.75, 20),
        z - 1,
        z + tankH - 1.5,
        [96, 112, 124],
        [150, 156, 160]
      );
      continue;
    }
    const t = it[2];
    prism(c, ngon(t[0], t[1], t[2], 28), z - 1, z + tankH, [212, 214, 216], [196, 200, 204]);
    if (k >= 0.9) {
      // the seams where the tank's steel plates meet
      c.strokeStyle = col([176, 180, 186], 1);
      c.lineWidth = Math.max(1, k * 0.15);
      c.beginPath();
      for (const f of [0.33, 0.66]) {
        let first = true;
        for (let i = 0; i <= 28; i++) {
          const a = (i / 28) * 2 * Math.PI,
            x = t[0] + t[2] * Math.cos(a),
            y = t[1] + t[2] * Math.sin(a);
          if (faces(Math.cos(a), Math.sin(a)) <= 0) {
            first = true;
            continue;
          }
          const p = S(x, y, tankH * f);
          first ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1]);
          first = false;
        }
      }
      c.stroke();
    }
  }
  // the glass dome
  const lit = BAKE && night;
  c.fillStyle = lit ? 'rgba(255,214,150,.95)' : col([128, 176, 204], 1);
  domeShape();
  c.fill();
  if (!lit) {
    // the sky catches the top and the side away from the light
    c.save();
    domeShape();
    c.clip();
    c.fillStyle = col([170, 206, 226], 1);
    c.beginPath();
    c.ellipse(ctr[0] - Rd * k * 0.35, ctr[1] - Hd * k * 0.75, Rd * k * 0.6, Hd * k * 0.55, 0, 0, 7);
    c.fill();
    c.restore();
  }
  if (k >= 0.4) {
    // the aluminium frame: parallels and meridians on the side facing the viewer
    c.strokeStyle = col(lit ? [190, 150, 90] : [86, 128, 156], 1);
    c.lineWidth = Math.max(1, k * 0.22);
    c.beginPath();
    for (const tt of [0.35, 0.7]) {
      const t = tt * (Math.PI / 2);
      let first = true;
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * 2 * Math.PI;
        if (faces(Math.cos(a), Math.sin(a)) <= 0) {
          first = true;
          continue;
        }
        const p = domePt(a, t);
        first ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1]);
        first = false;
      }
    }
    for (let m = 0; m < 12; m++) {
      const a = (m / 12) * 2 * Math.PI;
      if (faces(Math.cos(a), Math.sin(a)) <= 0.05) continue;
      for (let i = 0; i <= 8; i++) {
        const p = domePt(a, (i / 8) * (Math.PI / 2));
        i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
      }
    }
    c.stroke();
    // the viewing deck and restaurant ring at the foot of the dome
    c.strokeStyle = col([226, 230, 232], 1);
    c.lineWidth = Math.max(1, k * 0.45);
    c.beginPath();
    let first = true;
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * 2 * Math.PI;
      if (faces(Math.cos(a), Math.sin(a)) <= 0) {
        first = true;
        continue;
      }
      const p = domePt(a, 0.02);
      first ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1]);
      first = false;
    }
    c.stroke();
  }
  if (b.fire > 0 && mode !== 0) flames(c, b, z + tankH + Hd);
}
/* Sólfarið (Jón Gunnar Árnason, 1990): a dream boat of polished stainless steel on a round granite plinth by Sæbraut */
function drawVoyager(c, b, mode) {
  if (mode === 2) return;
  const k = DK,
    z = b.z;
  const o = obbOf(b),
    ca = o.ux,
    sa = o.uy;
  const W = (u, v, h) => {
    const x = b.cx + u * ca - v * sa,
      y = b.cy + u * sa + v * ca;
    return [PXw(x, y) * k - DOX, (PYw(x, y) - z - h) * k - DOY];
  };
  // granite plinth: three stepped rings
  for (const [r, h, cl] of [
    [6.6, 0.15, [128, 126, 122]],
    [6, 0.35, [148, 146, 140]],
    [5.4, 0.55, [166, 164, 158]]
  ]) {
    c.fillStyle = col(cl, 1);
    c.beginPath();
    for (let i = 0; i < 24; i++) {
      const a2 = (i / 24) * 6.283;
      const p = W(Math.cos(a2) * r, Math.sin(a2) * r * 0.55, h);
      i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
    }
    c.closePath();
    c.fill();
  }
  if (k < 0.35) return;
  const base = 0.6,
    steel = col([214, 220, 226], 1),
    dark = col([128, 136, 146], 1),
    lw = Math.max(1, k * 0.32);
  const keel = u => base + 0.35 + 0.02 * u * u; // the keel sags in the middle and sweeps up at both ends
  const line = (a, bb, cl, w) => {
    c.strokeStyle = cl;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(bb[0], bb[1]);
    c.stroke();
  };
  const ribs = [];
  for (let i = 0; i < 7; i++) ribs.push(-4.2 + i * 1.4);
  // far side first, then the keel, then the near side
  const near = faces(-sa, ca) > 0 ? 1 : -1;
  for (const side of [-near, near]) {
    if (side === near) {
      // keel and the two posts
      for (let u = -5; u < 5; u += 0.5) line(W(u, 0, keel(u)), W(u + 0.5, 0, keel(u + 0.5)), steel, lw * 1.2);
      let prev = W(5, 0, keel(5));
      for (let t = 1; t <= 6; t++) {
        const u = 5 + t * 0.35,
          h = keel(5) + t * t * 0.11;
        const p = W(u, 0, h);
        line(prev, p, steel, lw);
        prev = p;
      } // bow post
      prev = W(-5, 0, keel(-5));
      for (let t = 1; t <= 5; t++) {
        const u = -5 - t * 0.3,
          h = keel(-5) + t * t * 0.09;
        const p = W(u, 0, h);
        line(prev, p, steel, lw);
        prev = p;
      }
    } // stern post
    for (const u of ribs) {
      const k0 = W(u, 0, keel(u)),
        tip = W(u - 0.5, side * 1.5, keel(u) + 2.2 + Math.abs(u) * 0.12);
      line(k0, tip, side === near ? steel : dark, lw);
    }
  }
  // the tall mast-like rib amidships and sun glints
  line(W(0.4, 0, keel(0.4)), W(-0.2, 0, keel(0.4) + 3.1), steel, lw);
  if (k >= 1.5 && dayL > 0.5) {
    c.fillStyle = 'rgba(255,255,255,.85)';
    const g = W(0.1, 0, keel(0.4) + 2.4);
    c.fillRect(Math.round(g[0]), Math.round(g[1]), Math.max(1, (k * 0.3) | 0), Math.max(1, (k * 0.3) | 0));
  }
}
function drawRubble(c, b, mode, left) {
  if (mode === 2) return;
  const L = left === undefined ? 1 : Math.max(0, left);
  const k = DK,
    P = b.poly,
    n = b.n,
    z = b.z + 0.8 * L;
  c.fillStyle = col([128, 116, 104], 0.9);
  c.beginPath();
  for (let j = 0; j < n; j++) {
    const x = b.cx + (P[2 * j] - b.cx) * (0.5 + 0.4 * L),
      y = b.cy + (P[2 * j + 1] - b.cy) * (0.5 + 0.4 * L);
    const sx = PXw(x, y) * k - DOX,
      sy = (PYw(x, y) - z) * k - DOY;
    j ? c.lineTo(sx, sy) : c.moveTo(sx, sy);
  }
  c.fill();
  if (k >= 0.4) {
    const m = Math.round(Math.min(24, b.area / 12 + 3) * L);
    for (let i = 0; i < m; i++) {
      const x = b.minx + (b.maxx - b.minx) * h32(b.id, i, 1),
        y = b.miny + (b.maxy - b.miny) * h32(b.id, i, 2);
      if (!pip(P, x, y)) continue;
      const s = Math.max(1, Math.round(k * (0.8 + h32(b.id, i, 3) * 1.6)));
      c.fillStyle = col(h32(b.id, i, 4) < 0.5 ? b.wallC : [86, 80, 74], 0.85);
      c.fillRect(
        Math.round(PXw(x, y) * k - DOX),
        Math.round((PYw(x, y) - z - h32(b.id, i, 5) * 1.4) * k - DOY),
        s,
        s
      );
    }
  }
  if (b.fire > 0 && mode !== 0) flames(c, b, z + 1);
}
function scaffold(c, b, P, z0, z1) {
  const k = DK;
  if (k < 0.5) return;
  c.strokeStyle = col([230, 190, 40], 1);
  c.lineWidth = 1;
  c.beginPath();
  for (let j = 0; j < b.n; j++) {
    const x = P[2 * j],
      y = P[2 * j + 1];
    const sx = Math.round(PXw(x, y) * k - DOX) + 0.5,
      by = PYw(x, y) * k - DOY;
    c.moveTo(sx, by - z0 * k);
    c.lineTo(sx, by - (z1 + 1.5) * k);
  }
  c.stroke();
  if (b.area > 250) {
    let bi = 0,
      bd = -1e12;
    for (let j = 0; j < b.n; j++) {
      const v = PXw(P[2 * j], P[2 * j + 1]);
      if (v > bd) {
        bd = v;
        bi = j;
      }
    }
    const x = P[2 * bi],
      y = P[2 * bi + 1];
    const sx = Math.round(PXw(x, y) * k - DOX) + 0.5,
      base = (PYw(x, y) - z0) * k - DOY,
      top = (PYw(x, y) - b.z - b.h - 12) * k - DOY;
    c.beginPath();
    c.moveTo(sx, base);
    c.lineTo(sx, top);
    c.lineTo(sx - 24 * k, top + 3 * k);
    c.moveTo(sx, top);
    c.lineTo(sx + 8 * k, top + k);
    c.stroke();
  }
}
const FIREC = ['#ffd35a', '#ff8a2a', '#ff5a1f'];
function flames(c, b, ztop) {
  const k = DK,
    sx = PXw(b.cx, b.cy) * k - DOX,
    sy = (PYw(b.cx, b.cy) - ztop) * k - DOY,
    w = Math.min(b.r, 30) * k * 1.2;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.22;
  c.fillStyle = '#ff6a20';
  c.beginPath();
  c.arc(sx, sy, Math.max(3, w * 1.1), 0, 7);
  c.fill();
  c.restore();
  const n = Math.min(40, (6 + b.r * 1.5) | 0);
  for (let i = 0; i < n; i++) {
    const s = Math.max(1, Math.round(k * (1 + R() * 2.4)));
    c.fillStyle = FIREC[(R() * 3) | 0];
    c.fillRect(sx + (R() - 0.5) * w * 2, sy - R() * k * 6 - s, s, s * 2);
  }
}
function drawTree(c, i, mode) {
  const x = TREES.x[i],
    y = TREES.y[i],
    k = DK,
    s = TREES.s[i];
  if (s === 3 || mode === 2) return;
  const z = hAt(x, y);
  const sx = Math.round(PXw(x, y) * k - DOX),
    sy = Math.round((PYw(x, y) - z) * k - DOY);
  const sd = TREES.seed[i],
    kind = TREES.k[i];
  if (k < 0.3) {
    c.fillStyle = col(
      kind === 0 ? [40, 78, 52] : s === 2 ? [50, 46, 42] : leafCol(sd) || [98, 84, 76],
      kind === 0 ? 1 : 0.9
    );
    c.fillRect(sx, sy - 1, 1, 1);
    return;
  }
  const burnt = s === 2,
    sz = k * (0.75 + sd * 0.55);
  const sp = treeSprite(kind, sd, sz, burnt, BAKE);
  c.drawImage(sp.cv, sx - sp.ax, sy - sp.ay);
  if (s === 1) {
    c.fillStyle = FIREC[(R() * 3) | 0];
    for (let q = 0; q < 4; q++)
      c.fillRect(sx + (R() - 0.5) * 4 * sz, sy - R() * 9 * sz, Math.max(1, sz * 0.8), Math.max(1, sz * 1.6));
  }
}
