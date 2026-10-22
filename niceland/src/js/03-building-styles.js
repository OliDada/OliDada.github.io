/**
 * Building styles
 *
 * Era styles from the Reykjavík building register, roof colours from aerial photos, OSM 3D parts.
 *
 * Functions: obbOf, eraOf, applyEra, sh0, eraClass, hallFace, drawStatue, applyOSM3D, linkGroup,
 *     captureHall, linkParts, setDetRoof
 * State and constants: BX, ERA_W, ERA_R, BALC, HKF, HKT
 */

let BX = null; // {yr,fl,rgb,has}
function obbOf(b) {
  if (b.obb) return b.obb;
  const P = b.poly,
    n = b.n;
  let best = null;
  for (let j = 0; j < n; j++) {
    const q = (j + 1) % n;
    let ux = P[2 * q] - P[2 * j],
      uy = P[2 * q + 1] - P[2 * j + 1];
    const L = Math.hypot(ux, uy);
    if (L < 0.5) continue;
    ux /= L;
    uy /= L;
    let u0 = 1e9,
      u1 = -1e9,
      v0 = 1e9,
      v1 = -1e9;
    for (let i = 0; i < n; i++) {
      const dx = P[2 * i] - b.cx,
        dy = P[2 * i + 1] - b.cy,
        u = dx * ux + dy * uy,
        v = -dx * uy + dy * ux;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const a = (u1 - u0) * (v1 - v0);
    if (!best || a < best.a) best = { a, ux, uy, u0, u1, v0, v1 };
  }
  if (!best) best = { a: 1, ux: 1, uy: 0, u0: -1, u1: 1, v0: -1, v1: 1 };
  // ridge runs along the long side
  if (best.v1 - best.v0 > best.u1 - best.u0 !== !!b.rx) {
    const o = best;
    best = { a: o.a, ux: -o.uy, uy: o.ux, u0: o.v0, u1: o.v1, v0: -o.u1, v1: -o.u0 };
  }
  best.rect = b.area / Math.max(1, best.a);
  best.hw = (best.v1 - best.v0) / 2;
  best.vm = (best.v0 + best.v1) / 2;
  best.L = best.u1 - best.u0;
  return (b.obb = best);
}
const ERA_W = {
  iron: [
    [236, 232, 222],
    [226, 190, 84],
    [126, 170, 204],
    [198, 68, 58],
    [150, 178, 140],
    [190, 196, 200],
    [226, 150, 128],
    [90, 120, 150],
    [240, 214, 170],
    [176, 92, 70],
    [110, 150, 120],
    [244, 244, 240]
  ],
  classic: [
    [240, 238, 230],
    [236, 226, 200],
    [226, 226, 220],
    [214, 222, 214],
    [232, 214, 180],
    [220, 224, 228]
  ],
  postwar: [
    [236, 234, 228],
    [222, 220, 214],
    [204, 206, 206],
    [230, 222, 204],
    [214, 206, 192],
    [200, 208, 212],
    [234, 228, 212]
  ],
  seventies: [
    [232, 230, 224],
    [200, 198, 192],
    [176, 172, 166],
    [214, 204, 186],
    [120, 96, 78],
    [234, 232, 226],
    [188, 192, 196]
  ],
  late: [
    [244, 244, 240],
    [234, 232, 226],
    [214, 214, 210],
    [226, 218, 200],
    [196, 206, 214]
  ],
  modern: [
    [62, 60, 58],
    [44, 46, 50],
    [128, 100, 76],
    [234, 234, 230],
    [96, 98, 100],
    [150, 124, 96],
    [206, 206, 202]
  ]
};
const ERA_R = {
  iron: [
    [178, 52, 44],
    [52, 96, 78],
    [70, 86, 104],
    [40, 42, 48],
    [46, 128, 130],
    [150, 60, 40],
    [96, 98, 104]
  ],
  classic: [
    [168, 58, 46],
    [70, 74, 82],
    [52, 96, 78],
    [120, 58, 48]
  ],
  postwar: [
    [96, 98, 104],
    [150, 64, 48],
    [70, 76, 86],
    [52, 88, 72],
    [120, 122, 126]
  ],
  seventies: [
    [70, 72, 78],
    [96, 98, 100],
    [54, 56, 60]
  ],
  late: [
    [70, 76, 86],
    [150, 64, 48],
    [96, 98, 104],
    [52, 60, 72]
  ],
  modern: [
    [52, 54, 58],
    [70, 72, 76],
    [40, 42, 46]
  ]
};
function eraOf(y) {
  return y < 1925
    ? 'iron'
    : y < 1946
      ? 'classic'
      : y < 1966
        ? 'postwar'
        : y < 1986
          ? 'seventies'
          : y < 2006
            ? 'late'
            : 'modern';
}
function applyEra(b, i) {
  if (b.sp) return;
  const yr = (BX && BX.yr[i]) || 0,
    fl = (BX && BX.fl[i]) || 0,
    s = b.seed,
    k = b.kind;
  b.yr = yr;
  b.fl = fl;
  if (BX && BX.has[i]) {
    const r = BX.rgb[3 * i],
      g = BX.rgb[3 * i + 1],
      bl = BX.rgb[3 * i + 2];
    b.aerial = [r, g, bl];
  }
  const det = BX && BX.rs ? BX.rs[i] : 0;
  if (det && BX.rx[i]) {
    b.rx = 1;
    b.obb = null;
  }
  if (!yr) {
    if (b.aerial) b.roofC = roofFromAerial(b.aerial);
    if (det && b.kind !== 8) setDetRoof(b, det);
    return;
  }
  const era = eraOf(yr);
  const pick = (L, q) => L[((s * q) | 0) % L.length];
  if (k === 0 || k === 1) {
    b.style = era === 'iron' ? 'iron' : era === 'modern' ? 'modern' : 'conc';
    b.wallC = pick(ERA_W[era], 1000);
    b.roofC = pick(ERA_R[era], 7777);
    const r = h32(b.id, yr, 5);
    let rs;
    if (era === 'iron') rs = 'gable';
    else if (era === 'classic') rs = r < 0.55 ? 'gable' : r < 0.85 ? 'hip' : 'flat';
    else if (era === 'postwar') rs = r < 0.55 ? 'hip' : r < 0.85 ? 'gable' : 'flat';
    else if (era === 'seventies')
      rs =
        k === 1
          ? r < 0.55
            ? 'flat'
            : r < 0.85
              ? 'mono'
              : 'gable'
          : r < 0.5
            ? 'flat'
            : r < 0.75
              ? 'mono'
              : 'gable';
    else if (era === 'late') rs = r < 0.5 ? 'gable' : r < 0.85 ? 'hip' : 'flat';
    else rs = r < 0.6 ? 'flat' : 'mono';
    b.rs = rs;
    b.rp =
      era === 'iron'
        ? 0.95
        : era === 'classic'
          ? 0.75
          : era === 'postwar'
            ? 0.5
            : era === 'late'
              ? 0.55
              : 0.3;
  } else if (k === 2) {
    b.style = era === 'modern' ? 'modern' : 'apt';
    b.wallC = pick(
      era === 'modern'
        ? ERA_W.modern
        : era === 'iron' || era === 'classic'
          ? ERA_W.classic
          : era === 'postwar'
            ? ERA_W.postwar
            : ERA_W.seventies,
      1000
    );
    b.rs =
      era === 'classic' || era === 'iron'
        ? 'hip'
        : era === 'postwar' && h32(b.id, 1, 5) < 0.5
          ? 'hip'
          : 'flat';
    b.rp = 0.45;
    b.roofC = pick(ERA_R.postwar, 333);
  } else if (k === 3) {
    b.rs = 'flat';
  } else {
    b.rs = era === 'iron' && b.n <= 6 ? 'gable' : 'flat';
    b.rp = 0.6;
  }
  if (b.aerial) b.roofC = roofFromAerial(b.aerial);
  if (det && b.kind !== 8 && setDetRoof(b, det)) return;
  if (b.rs === 'flat' || b.rs === 'mono') b.roof = 0;
  else if (b.rs) b.roof = 9;
}
/* roof shape measured from the 2025 aerial photo: 1 flat, 2 gable, 3 hip, 4 mono */
const BALC = {
  1: [
    [236, 236, 232],
    [150, 172, 190],
    [210, 200, 180]
  ],
  2: [
    [230, 230, 226],
    [150, 172, 190],
    [196, 116, 72],
    [84, 128, 118],
    [224, 190, 84],
    [70, 94, 130]
  ],
  3: [
    [60, 62, 66],
    [226, 226, 222],
    [150, 160, 170]
  ]
};
function sh0(nx, ny) {
  return wallShade(nx, ny);
}
function eraClass(b) {
  if (b.ea !== undefined) return b.ea;
  const y = b.yr,
    st = b.style;
  let e;
  if (st === 'modern') e = 3;
  else if (y) e = y < 1940 ? 0 : y < 1966 ? 1 : y < 1986 ? 2 : 3;
  else e = st === 'iron' ? 0 : b.kind >= 4 ? 2 : 1;
  if (b.kind === 2 && !b.balC) {
    const L2 = BALC[Math.max(1, e)];
    b.balC = L2[((b.seed * 917) | 0) % L2.length];
  }
  return (b.ea = e);
}
/* tags mappers put on OpenStreetMap: real wall/roof colours, roof shapes and heights, and building:part pieces */
/* Hallgrímskirkja: no ordinary windows; slit windows up the tower, louvres and clocks in the belfry,
   tall narrow nave windows between the pilasters, and the great door under the tower */
let HKF = null;
function hallFace(c, b, j, P, dx, dy, zb, z1, sh) {
  const k = DK,
    L = Math.hypot(dx, dy);
  if (L < 1.6 || k < 0.9) return;
  const x0 = P[2 * j],
    y0 = P[2 * j + 1];
  if (!HKF) {
    const s = ll(64.14236, -21.92735),
      c0 = ll(64.14197, -21.92659);
    const vx = s[0] - c0[0],
      vy = s[1] - c0[1],
      l = Math.hypot(vx, vy);
    HKF = [vx / l, vy / l];
  }
  const nx = dy / L,
    ny = -dx / L;
  const S = (t, z) => {
    const x = x0 + dx * t,
      y = y0 + dy * t;
    return [PXw(x, y) * k - DOX, (PYw(x, y) - z) * k - DOY];
  };
  const quad = (t0, t1, za, zb2, cl) => {
    const A = S(t0, za),
      B2 = S(t1, za),
      C2 = S(t1, zb2),
      D = S(t0, zb2);
    c.fillStyle = cl;
    c.beginPath();
    c.moveTo(A[0], A[1]);
    c.lineTo(B2[0], B2[1]);
    c.lineTo(C2[0], C2[1]);
    c.lineTo(D[0], D[1]);
    c.closePath();
    c.fill();
  };
  const dark = col([44, 52, 62], 1),
    deep = col([60, 66, 72], sh * 0.9),
    lite = col(b.wallC, sh * 1.07);
  const top = zb + b.h,
    bot = zb;
  if (b.base >= 44) {
    // belfry tiers: clock on the first, louvres above
    if (L < 2.5) return;
    if (b.base < 46 && L >= 6) {
      // the dial lies in the wall: one axis along the wall (foreshortened and sloped on screen), one straight up
      const zc = bot + b.h * 0.55,
        ctr = S(0.5, zc),
        R = Math.max(1.5 / k, Math.min(2.4, L * 0.22)),
        e = S(0.5 + 1 / L, zc);
      let ux = e[0] - ctr[0],
        uy = e[1] - ctr[1];
      if (ux < 0) {
        // keep the wall's "right" on the right of the screen, so the hands are never mirrored
        ux = -ux;
        uy = -uy;
      }
      if (Math.abs(ux) < k * 0.25) return; // nearly edge-on: no room for a dial
      const at = (a, rr) => [ctr[0] + ux * Math.cos(a) * rr, ctr[1] + (uy * Math.cos(a) - k * Math.sin(a)) * rr];
      c.fillStyle = col([238, 236, 228], 1);
      c.beginPath();
      for (let i = 0; i < 24; i++) {
        const p = at((i / 24) * 2 * Math.PI, R);
        if (i) c.lineTo(p[0], p[1]);
        else c.moveTo(p[0], p[1]);
      }
      c.closePath();
      c.fill();
      c.strokeStyle = col([40, 44, 50], 1);
      c.lineWidth = Math.max(1, k * 0.18);
      const mh = at(Math.PI / 2, R * 0.75), // minute hand at twelve
        hh2 = at(-Math.PI / 6, R * 0.45); // hour hand at four
      c.beginPath();
      c.moveTo(ctr[0], ctr[1]);
      c.lineTo(mh[0], mh[1]);
      c.moveTo(ctr[0], ctr[1]);
      c.lineTo(hh2[0], hh2[1]);
      c.stroke();
      return;
    }
    if (b.base > 50 && b.base < 54 && L >= 4) {
      const ns = Math.max(1, Math.min(3, Math.floor(L / 2.6)));
      for (let i = 0; i < ns; i++) {
        const t = (i + 0.5) / ns,
          w = 0.32 / L;
        quad(t - w, t + w, bot + 0.3, top - 0.3, dark);
      }
    }
    return;
  }
  if (b.h >= 38 && L >= 3) {
    // tower shaft: a column of slit windows; the main door on the front
    const front = nx * HKF[0] + ny * HKF[1] > 0.75;
    if (front && L >= 7) {
      const w = Math.min(0.16, 2 / L);
      quad(0.5 - w, 0.5 + w, bot, bot + 7, dark);
      quad(0.5 - w * 1.25, 0.5 + w * 1.25, bot + 7, bot + 7.5, deep);
    }
    for (let z = bot + 12; z < top - 3; z += 6.5) quad(0.5 - 0.3 / L, 0.5 + 0.3 / L, z, z + 4.4, dark);
    return;
  }
  if (b.h >= 10 && L >= 8) {
    // nave, apse and the low side wings
    const ns = Math.max(1, Math.round(L / 4.6));
    for (let i = 0; i < ns; i++) {
      const t = (i + 0.5) / ns,
        w = 0.45 / L;
      quad(t - w, t + w, bot + 4.5, Math.min(top - 2.5, bot + 16), dark);
      if (i) quad(i / ns - 0.25 / L, i / ns + 0.25 / L, bot, top, lite);
    }
    if (nx * HKF[0] + ny * HKF[1] < -0.75 && b.h >= 12) {
    }
    return;
  }
  if (b.h >= 3 && L >= 4 && b.h < 10) {
    const ns = Math.max(1, Math.round(L / 3.2));
    for (let i = 0; i < ns; i++) {
      const t = (i + 0.5) / ns,
        w = 0.4 / L;
      quad(t - w, t + w, bot + 1.2, Math.min(top - 0.8, bot + 3.4), dark);
    }
  }
}
/* Leifur Eiríksson in bronze, axe in hand, on top of his granite plinth */
function drawStatue(c, b, zb, hh) {
  const k = DK;
  if (k < 0.5) return;
  const s = [PXw(b.cx, b.cy) * k - DOX, (PYw(b.cx, b.cy) - zb) * k - DOY],
    H = hh * k,
    br = col([66, 84, 74], 1),
    br2 = col([88, 108, 96], 1);
  c.fillStyle = br;
  c.beginPath();
  c.moveTo(s[0] - H * 0.21, s[1]);
  c.lineTo(s[0] + H * 0.21, s[1]);
  c.lineTo(s[0] + H * 0.14, s[1] - H * 0.72);
  c.lineTo(s[0] - H * 0.14, s[1] - H * 0.72);
  c.closePath();
  c.fill();
  c.fillStyle = br2;
  c.fillRect(
    Math.round(s[0] - H * 0.03),
    Math.round(s[1] - H * 0.7),
    Math.max(1, Math.round(H * 0.07)),
    Math.round(H * 0.6)
  );
  c.fillStyle = br;
  c.beginPath();
  c.arc(s[0], s[1] - H * 0.82, Math.max(1, H * 0.1), 0, 7);
  c.fill();
  c.strokeStyle = br;
  c.lineWidth = Math.max(1, H * 0.05);
  c.beginPath();
  c.moveTo(s[0] + H * 0.13, s[1] - H * 0.6);
  c.lineTo(s[0] + H * 0.22, s[1] - H * 0.05);
  c.stroke();
  c.fillStyle = br2;
  c.fillRect(
    Math.round(s[0] + H * 0.17),
    Math.round(s[1] - H * 0.66),
    Math.max(1, Math.round(H * 0.1)),
    Math.max(1, Math.round(H * 0.1))
  );
}
function applyOSM3D(b, i) {
  b.bi = i;
  if (!BX || !BX.fg) return;
  const f = BX.fg[i];
  if (f & 16) b.statue = 2;
  if (f & 64) b.statue = 1;
  if (f & 32) {
    b.hk = 1;
    b.wallC = [216, 214, 208];
    b.wtag = 1;
    if (b.aerial && b.aerial[0] < 90) b.roofC = [78, 80, 78];
    else if (b.aerial) b.roofC = [206, 204, 198];
    b.aerial = null;
  }
  if (BX.rh[i]) b.rhT = BX.rh[i] / 4;
  if (f & 8 && !b.sp) {
    const d = BX.rs[i];
    b.obb = null;
    b.rx = BX.rx[i] ? 1 : 0;
    if (d === 5) {
      b.rs = null;
      b.roof = 3;
      b.spire = b.rhT || Math.min(12, obbOf(b).hw * 1.6);
    } else if (d === 6) {
      b.rs = 'hip';
      b.rp = 1.1;
      b.roof = 9;
    } else setDetRoof(b, d, 1);
  }
  if (f & 2) {
    b.wallC = [BX.wrgb[3 * i], BX.wrgb[3 * i + 1], BX.wrgb[3 * i + 2]];
    b.wtag = 1;
  }
  if (f & 4 && b.aerial) b.roofC = b.aerial.slice();
  if (f & 1) b.hide = 1;
  if (BX.po[i]) {
    b.po = BX.po[i];
    b.group = 'pt' + b.po;
    b.jobs = 0;
    b.res = 0;
  }
}
let HKT = null; // Hallgrímskirkja as a template for the Build tool
function linkGroup(g) {
  g.sort((a, b2) => a.base - b2.base);
  for (const b of g) {
    if (b.base <= 0) continue;
    let best = null;
    for (const o of g) {
      if (o === b || o.base >= b.base - 0.01) continue;
      if (!pip(o.poly, b.cx, b.cy)) continue;
      if (!best || o.base + o.h > best.base + best.h) best = o;
    }
    if (best) {
      b.sup = best;
      b.rr = -1;
    }
  }
}
function captureHall() {
  const g = B.filter(b => b.hk && !b.hide);
  if (!g.length) return;
  let cx = 0,
    cy = 0;
  for (const b of g) {
    cx += b.cx;
    cy += b.cy;
  }
  cx /= g.length;
  cy /= g.length;
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  HKT = {
    parts: g.map(b => {
      const p = new Float32Array(b.poly.length);
      for (let i = 0; i < p.length; i += 2) {
        p[i] = b.poly[i] - cx;
        p[i + 1] = b.poly[i + 1] - cy;
        x0 = Math.min(x0, p[i]);
        x1 = Math.max(x1, p[i]);
        y0 = Math.min(y0, p[i + 1]);
        y1 = Math.max(y1, p[i + 1]);
      }
      return {
        p,
        base: b.base,
        h: b.h,
        roof: b.roof,
        rs: b.rs,
        rp: b.rp,
        rhT: b.rhT,
        rx: b.rx,
        spire: b.spire,
        wallC: b.wallC.slice(),
        roofC: b.roofC.slice()
      };
    })
  };
  HKT.box = [x0, y0, x1, y1];
}
function linkParts() {
  const G = new Map();
  for (const b of B)
    if (b.po) {
      if (!G.has(b.po)) G.set(b.po, []);
      G.get(b.po).push(b);
    }
  for (const g of G.values()) {
    g.sort((a, b2) => a.base - b2.base);
    for (const b of g) {
      if (b.base <= 0) continue;
      let best = null;
      for (const o of g) {
        if (o === b || o.base >= b.base - 0.01) continue;
        if (!pip(o.poly, b.cx, b.cy)) continue;
        if (!best || o.base + o.h > best.base + best.h) best = o;
      }
      if (best) {
        b.sup = best;
        b.rr = -1;
      }
    }
  }
}
function setDetRoof(b, d, tag) {
  // big or many-winged roofs fool the photo test: only trust 'flat' there
  if (!tag && d !== 1 && (b.area > 1400 || (b.kind >= 2 && b.n > 14))) return false;
  let o = obbOf(b);
  if (b.rx && o.L / (2 * o.hw) > 2.2) {
    b.rx = 0;
    b.obb = null;
    o = obbOf(b);
  }
  b.rs = d === 1 ? 'flat' : d === 2 ? 'gable' : d === 3 ? 'hip' : 'mono';
  if (d === 1 || d === 4) b.roof = 0;
  else {
    b.roof = 9;
    b.rp = b.kind === 2 ? 0.28 : b.kind >= 4 ? 0.3 : b.rp || (o.hw < 5 ? 0.75 : 0.55);
  }
  return true;
}
