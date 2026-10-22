/**
 * Props layer and zones
 *
 * The baked layer of parked cars and lamp posts, and people using places (swimming, playing).
 *
 * Functions: renderProps, parkedCar, wavingFlag, drawPt, hourNow, zoneWant, spawnZones, spawnZoneAgent,
 *     stepZoneAgent, drawSwimmer, areaAt, areaCard, stepAreaFX
 * State and constants: LIVE_PT, ZONES, AREA_INFO, SPORT, steamAcc
 */

/* props layer: parked cars, lamp posts and cemeteries, baked per chunk on a transparent canvas and laid over the finished ground.
   Each item belongs to exactly one chunk (the one its foot stands in), so nothing is cut off or drawn twice at chunk seams. */
function renderProps(L, cx, cy) {
  const k = LEVELS[L];
  if (!PROPS_OK || k < 0.4) return { empty: 1 };
  const S = CCF(k) * 10,
    X0 = GOX + cx * S,
    Y0 = GOY + cy * S,
    X1 = X0 + S,
    Y1 = Y0 + S;
  let any = false;
  areasIn(X0, Y0, X1, Y1, A => {
    if (A.c === AK.PARKING || A.c === AK.CEM) any = true;
  });
  if (!any) return { empty: 1 };
  let mnx = 1e12,
    mxx = -1e12,
    mny = 1e12,
    mxy = -1e12;
  for (const [x, y] of [
    [X0, Y0],
    [X1, Y0],
    [X1, Y1],
    [X0, Y1]
  ]) {
    const z = hAt(x, y),
      sx = PXw(x, y),
      sy = PYw(x, y);
    mnx = Math.min(mnx, sx);
    mxx = Math.max(mxx, sx);
    mny = Math.min(mny, sy - z - 16);
    mxy = Math.max(mxy, sy - z + 4);
  }
  const ox = Math.floor(mnx * k) - 12,
    oy = Math.floor(mny * k) - 12,
    w = Math.min(4096, Math.ceil(mxx * k) - ox + 24),
    h = Math.min(4096, Math.ceil(mxy * k) - oy + 24);
  const cvs = document.createElement('canvas');
  cvs.width = Math.max(1, w);
  cvs.height = Math.max(1, h);
  const c = cvs.getContext('2d');
  DOX = ox;
  DOY = oy;
  DK = k;
  BAKE = false;
  const P = (x, y, z) => [PXw(x, y) * k - ox, (PYw(x, y) - z) * k - oy];
  const L3 = (x1, y1, z1, x2, y2, z2, col, wd) => {
    const a = P(x1, y1, z1),
      b = P(x2, y2, z2);
    c.strokeStyle = col;
    c.lineWidth = wd || Math.max(1, k * 0.15);
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  };
  const items = [];
  areasIn(X0 - 60, Y0 - 60, X1 + 60, Y1 + 60, A => {
    const z = areaZ(A);
    if (A.c === AK.PARKING) {
      const R_ = parkRows(A),
        S_ = lotStalls(A);
      if (!A.st) lotInit(A);
      if (k >= 0.6 && A.area > 1500)
        for (const v of R_.lamps) {
          for (let u = A.u0 + 12; u < A.u1 - 8; u += 30) {
            const [x, y] = AU(A, u, v);
            if (x < X0 || x >= X1 || y < Y0 || y >= Y1 || !pip(A.poly, x, y)) continue;
            items.push([PYw(x, y), 1, x, y]);
          }
        }
      for (let i = 0; i < S_.length; i++) {
        const st = S_[i];
        if (st.x < X0 || st.x >= X1 || st.y < Y0 || st.y >= Y1) continue;
        const o = A.st[i];
        if (o === 1 || o === 2) items.push([PYw(st.x, st.y), 0, st.x, st.y, z, st.ang, st.sd]);
      }
    }
    if (A.c === AK.CEM && k >= 0.45) drawCem(c, k, A, z, X0, Y0, X1, Y1, P, L3);
  });
  items.sort((a, b) => a[0] - b[0]);
  for (const it of items) {
    if (it[1] === 0) parkedCar(c, k, it[2], it[3], it[4], it[5], it[6], ox, oy);
    else {
      const zz = hAt(it[2], it[3]),
        pp = P(it[2], it[3], zz),
        hh = Math.round(k * 7);
      c.fillStyle = N_([96, 100, 106], 1);
      c.fillRect(Math.round(pp[0]), Math.round(pp[1]) - hh, Math.max(1, Math.round(k * 0.2)), hh);
      c.fillStyle = N_([170, 174, 178], 1);
      c.fillRect(
        Math.round(pp[0] - k * 0.6),
        Math.round(pp[1]) - hh,
        Math.max(2, Math.round(k * 1.4)),
        Math.max(1, Math.round(k * 0.3))
      );
    }
  }
  BAKE = true;
  return { cv: cvs, ox, oy, w: cvs.width, h: cvs.height };
}
function parkedCar(c, k, x, y, z, ang, sd, ox, oy) {
  const L = 4.3,
    W = 1.8,
    H = 1.45,
    ca = Math.cos(ang),
    sa = Math.sin(ang);
  const col = CARC[(sd * CARC.length) | 0];
  const pt = (u, v, h) => [
    PXw(x + u * ca - v * sa, y + u * sa + v * ca) * k - ox,
    (PYw(x + u * ca - v * sa, y + u * sa + v * ca) - z - h) * k - oy
  ];
  const face = (pts, cl) => {
    c.fillStyle = cl;
    c.beginPath();
    pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
    c.closePath();
    c.fill();
  };
  // a solid box for the body and a smaller glass box for the cabin, each drawn from whichever sides face the camera
  const box = (u0, u1, v0, v1, h0, h1, side, top) => {
    const C = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1]
    ];
    for (let i = 0; i < 4; i++) {
      const a = C[i],
        b = C[(i + 1) % 4];
      const ex = b[0] - a[0],
        ey = b[1] - a[1];
      const nxw = ey * ca - -ex * sa,
        nyw = ey * sa + -ex * ca; // outward normal (corners go anticlockwise)
      if (faces(nxw, nyw) <= 0) continue;
      face(
        [pt(a[0], a[1], h0), pt(b[0], b[1], h0), pt(b[0], b[1], h1), pt(a[0], a[1], h1)],
        side(wallShade(nxw, nyw))
      );
    }
    face(
      C.map(q => pt(q[0], q[1], h1)),
      top
    );
  };
  box(-L / 2, L / 2, -W / 2, W / 2, 0.15, H * 0.58, m => N_(col, m * 0.92), N_(col, 1.04));
  box(-L * 0.26, L * 0.2, -W * 0.43, W * 0.43, H * 0.58, H, m => N_([64, 78, 94], m), N_(col, 0.96));
}
function wavingFlag(F, p, top, kind, fw, fh) {
  const ph = time * 3 + p.seed * 9,
    d = Math.atan2(WIND[1], WIND[0]) - p.ang;
  const cu = Math.cos(d),
    cv = Math.sin(d);
  const pt = (s, t) => {
    const off = (Math.sin(ph + s * 2.5) * 0.25 * s * fw) / 2.5;
    return [cu * s * fw - cv * off, cv * s * fw + cu * off, top - t * fh];
  };
  if (kind === 'rb') {
    for (let j = 0; j < 6; j++)
      for (let i = 0; i < 4; i++) {
        const s0 = i / 4,
          s1 = (i + 1) / 4,
          t0 = j / 6,
          t1 = (j + 1) / 6;
        F([pt(s0, t0), pt(s1, t0), pt(s1, t1), pt(s0, t1)], C_(RAINBOW[j], 1));
      }
    return;
  }
  const XS = [0, 3.5, 7, 8, 9, 10, 11, 14.5, 18, 21.5, 25],
    YS = [0, 3.5, 7, 8, 9, 10, 11, 14.5, 18];
  const colAt = (s, t) => {
    const red = (s >= 8 && s < 10) || (t >= 8 && t < 10),
      wh = (s >= 7 && s < 11) || (t >= 7 && t < 11);
    return red ? [215, 40, 40] : wh ? [245, 245, 245] : [2, 82, 156];
  };
  for (let i = 0; i < XS.length - 1; i++)
    for (let j = 0; j < YS.length - 1; j++) {
      const s0 = XS[i] / 25,
        s1 = XS[i + 1] / 25,
        t0 = YS[j] / 18,
        t1 = YS[j + 1] / 18;
      F(
        [pt(s0, t0), pt(s1, t0), pt(s1, t1), pt(s0, t1)],
        C_(colAt((XS[i] + XS[i + 1]) / 2, (YS[j] + YS[j + 1]) / 2), 1)
      );
    }
}
function drawPt(c, k, p, ox, oy, live) {
  if (k < 0.4 && p.c < 20) return;
  if (k < 0.27) return;
  const z = hAt(p.x, p.y),
    ca = Math.cos(p.ang),
    sa = Math.sin(p.ang),
    sm = p.small ? 0.75 : 1;
  const P = (u, v, h) => [
    PXw(p.x + u * ca - v * sa, p.y + u * sa + v * ca) * k - ox,
    (PYw(p.x + u * ca - v * sa, p.y + u * sa + v * ca) - z - h) * k - oy
  ];
  const L = (a, b, col, w) => {
    const A = P(a[0], a[1], a[2]),
      B = P(b[0], b[1], b[2]);
    c.strokeStyle = col;
    c.lineWidth = w || Math.max(1, k * 0.13);
    c.beginPath();
    c.moveTo(A[0], A[1]);
    c.lineTo(B[0], B[1]);
    c.stroke();
  };
  const F = (pts, col) => {
    c.fillStyle = col;
    c.beginPath();
    pts.forEach((q, i) => {
      const s = P(q[0], q[1], q[2]);
      i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
    });
    c.closePath();
    c.fill();
  };
  const pal = [
    [214, 58, 52],
    [240, 196, 48],
    [52, 120, 200],
    [60, 160, 90]
  ];
  const C1 = pal[(p.seed * 4) | 0],
    C2 = pal[((p.seed * 4) | (0 + 1)) % 4];
  const wood = col([138, 96, 60], 1),
    woodD = col([104, 72, 46], 1),
    metal = col([110, 114, 120], 1),
    white = col([240, 240, 236], 1);
  switch (p.c) {
    case 1: {
      if (live) return;
      L([-0.9, 0, 0.45], [0.9, 0, 0.45], wood, Math.max(1, k * 0.35));
      L([-0.9, 0.22, 0.85], [0.9, 0.22, 0.85], woodD, Math.max(1, k * 0.25));
      for (const u of [-0.75, 0.75]) {
        L([u, 0, 0], [u, 0, 0.45], metal);
        L([u, 0.22, 0.45], [u, 0.22, 0.85], metal);
      }
      break;
    }
    case 2: {
      if (live) return;
      F(
        [
          [-0.9, -0.4, 0.75],
          [0.9, -0.4, 0.75],
          [0.9, 0.4, 0.75],
          [-0.9, 0.4, 0.75]
        ],
        wood
      );
      for (const v of [-0.75, 0.75]) L([-0.9, v, 0.45], [0.9, v, 0.45], woodD, Math.max(1, k * 0.3));
      L([-0.6, 0, 0], [-0.6, 0, 0.75], woodD);
      L([0.6, 0, 0], [0.6, 0, 0.75], woodD);
      break;
    }
    case 5: {
      if (live) {
        if (k < 0.85) return;
        for (let q = 0; q < 3; q++) {
          const t = (time * 1.4 + q / 3) % 1;
          const s = P(0, 0, 1 + Math.sin(t * Math.PI) * 2.2);
          c.fillStyle = 'rgba(220,240,255,.8)';
          c.fillRect(
            Math.round(s[0] + (q - 1) * t * k * 0.8),
            Math.round(s[1]),
            Math.max(1, (k * 0.3) | 0),
            Math.max(1, (k * 0.3) | 0)
          );
        }
        return;
      }
      F(
        [
          [-2, -2, 0.4],
          [2, -2, 0.4],
          [2, 2, 0.4],
          [-2, 2, 0.4]
        ],
        col([160, 160, 156], 1)
      );
      F(
        [
          [-1.7, -1.7, 0.42],
          [1.7, -1.7, 0.42],
          [1.7, 1.7, 0.42],
          [-1.7, 1.7, 0.42]
        ],
        col(SP.ice ? [200, 214, 224] : [90, 160, 196], 1)
      );
      L([0, 0, 0.4], [0, 0, 1.2], col([150, 150, 146], 1), Math.max(1, k * 0.4));
      break;
    }
    case 6: {
      if (live) return;
      F(
        [
          [-0.6, -0.6, 1.2],
          [0.6, -0.6, 1.2],
          [0.6, 0.6, 1.2],
          [-0.6, 0.6, 1.2]
        ],
        col([170, 166, 160], 1)
      );
      L([0, 0, 0], [0, 0, 1.2], col([150, 146, 140], 1), Math.max(1, k * 1.1));
      L([0, 0, 1.2], [0, 0, 2.9], col([64, 72, 70], 1), Math.max(1, k * 0.55));
      const h = P(0, 0, 3.1);
      c.fillStyle = col([64, 72, 70], 1);
      c.fillRect(
        Math.round(h[0] - k * 0.3),
        Math.round(h[1]),
        Math.max(1, Math.round(k * 0.6)),
        Math.max(1, Math.round(k * 0.6))
      );
      break;
    }
    case 61:
    case 62: {
      if (!live || k < 0.6) return;
      const PH = p.ph || 7;
      L([0, 0, 0], [0, 0, PH], white, Math.max(1, k * 0.16));
      if (k < 0.85) return;
      wavingFlag(F, p, PH, p.c === 62 ? 'rb' : 'is', 2.5, 1.8);
      return;
    }
    case 7: {
      if (!live) {
        L([0, 0, 0], [0, 0, 8], white, Math.max(1, k * 0.18));
        return;
      }
      if (k < 0.85) return; // Íslenski fáninn, waving
      const fw = 2.5,
        fh = 1.8,
        ph = time * 3 + p.seed * 9,
        d = Math.atan2(WIND[1], WIND[0]) - p.ang;
      const cu = Math.cos(d),
        cv = Math.sin(d);
      const pt = (s, t) => {
        const off = Math.sin(ph + s * 2.5) * 0.25 * s;
        return [cu * s * fw - cv * off, cv * s * fw + cu * off, 8 - t * fh];
      };
      // Íslenski fáninn, 18:25 — blue field, white-edged red Nordic cross set toward the hoist (7+1+2+1+14 across, 7+1+2+1+7 down)
      const XS = [0, 3.5, 7, 8, 9, 10, 11, 14.5, 18, 21.5, 25],
        YS = [0, 3.5, 7, 8, 9, 10, 11, 14.5, 18];
      const colAt = (s, t) => {
        const red = (s >= 8 && s < 10) || (t >= 8 && t < 10),
          wh = (s >= 7 && s < 11) || (t >= 7 && t < 11);
        return red ? [215, 40, 40] : wh ? [245, 245, 245] : [2, 82, 156];
      };
      for (let i = 0; i < XS.length - 1; i++)
        for (let j = 0; j < YS.length - 1; j++) {
          const s0 = XS[i] / 25,
            s1 = XS[i + 1] / 25,
            t0 = YS[j] / 18,
            t1 = YS[j + 1] / 18;
          F(
            [pt(s0, t0), pt(s1, t0), pt(s1, t1), pt(s0, t1)],
            C_(colAt((XS[i] + XS[i + 1]) / 2, (YS[j] + YS[j + 1]) / 2), 1)
          );
        }
      return;
    }
    case 8: {
      if (live) return;
      L([0, 0, 0], [0, 0, 0.8], col([60, 110, 70], 1), Math.max(1, k * 0.45));
      break;
    }
    case 9: {
      if (live) return;
      L([-1.2, 0, 0.8], [1.2, 0, 0.8], metal);
      for (let i = 0; i < 3; i++) {
        if (h32((p.seed * 99) | 0, i, 1) < 0.5) continue;
        const u = -1 + i;
        L([u, -0.8, 0.35], [u, 0.8, 0.35], col(pal[i % 4], 1), Math.max(1, k * 0.18));
        const w1 = P(u, -0.6, 0.35),
          w2 = P(u, 0.6, 0.35);
        c.strokeStyle = col([30, 30, 30], 1);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(w1[0], w1[1], Math.max(1, k * 0.3), 0, 7);
        c.stroke();
        c.beginPath();
        c.arc(w2[0], w2[1], Math.max(1, k * 0.3), 0, 7);
        c.stroke();
      }
      break;
    }
    case 10: {
      if (live) return;
      L([-1, 0, 0], [-1, 0, 2], metal);
      L([1, 0, 0], [1, 0, 2], metal);
      L([-1, 0, 2], [1, 0, 2], metal);
      L([-1, 0, 1.2], [1, 0, 1.2], metal);
      break;
    }
    case 11:
    case 12: {
      if (live) return;
      L([0, 0, 0], [0, 0, 0.9], col([40, 40, 44], 1), Math.max(1, k * 0.4));
      break;
    }
    case 20: {
      // swing set
      const hgt = 2.3 * sm,
        hw = 1.6 * sm;
      if (!live) {
        for (const u of [-hw, hw]) {
          L([u, -0.8, 0], [u, 0, hgt], col(C1, 1));
          L([u, 0.8, 0], [u, 0, hgt], col(C1, 1));
        }
        L([-hw, 0, hgt], [hw, 0, hgt], col(C1, 0.85), Math.max(1, k * 0.2));
        return;
      }
      if (k < 0.85) return;
      for (const u of [-hw * 0.45, hw * 0.45]) {
        const sw = Math.sin(time * 2.6 + p.seed * 7 + u) * (p.busy ? 0.7 : 0.08);
        const sy = Math.sin(sw) * (hgt - 0.5),
          sz = hgt - Math.cos(sw) * (hgt - 0.5);
        L([u, 0, hgt], [u, sy, sz], col([90, 90, 90], 1), 1);
        F(
          [
            [u - 0.25, sy - 0.12, sz],
            [u + 0.25, sy - 0.12, sz],
            [u + 0.25, sy + 0.12, sz],
            [u - 0.25, sy + 0.12, sz]
          ],
          col(C2, 1)
        );
      }
      return;
    }
    case 21: {
      if (live) return;
      const h = 1.4 * sm;
      L([-1.2 * sm, -0.4, 0], [-1.2 * sm, -0.4, h], metal);
      L([-1.2 * sm, 0.4, 0], [-1.2 * sm, 0.4, h], metal);
      F(
        [
          [-1.6 * sm, -0.45, h],
          [-0.8 * sm, -0.45, h],
          [-0.8 * sm, 0.45, h],
          [-1.6 * sm, 0.45, h]
        ],
        col(C2, 1)
      );
      F(
        [
          [-0.8 * sm, -0.35, h],
          [1.8 * sm, -0.35, 0.15],
          [1.8 * sm, 0.35, 0.15],
          [-0.8 * sm, 0.35, h]
        ],
        col(C1, 1)
      );
      L([-1.6 * sm, -0.45, h], [-1.6 * sm, -0.45, h + 0.8], col(C2, 0.8));
      L([-1.6 * sm, 0.45, h], [-1.6 * sm, 0.45, h + 0.8], col(C2, 0.8));
      break;
    }
    case 22: {
      if (live) return;
      const s = 1.1 * sm,
        h = 2 * sm;
      const cl = col(C1, 1);
      for (const [u, v] of [
        [-s, -s],
        [s, -s],
        [s, s],
        [-s, s]
      ])
        L([u, v, 0], [u, v, h], cl);
      for (const hh of [h * 0.5, h]) {
        L([-s, -s, hh], [s, -s, hh], col(C2, 1));
        L([s, -s, hh], [s, s, hh], col(C2, 1));
        L([s, s, hh], [-s, s, hh], col(C2, 1));
        L([-s, s, hh], [-s, -s, hh], col(C2, 1));
      }
      break;
    }
    case 23: {
      if (live) return;
      const t = Math.sin(p.seed * 9) * 0.35;
      L([-1.5, 0, 0.45 + t], [1.5, 0, 0.45 - t], col(C1, 1), Math.max(1, k * 0.3));
      L([0, 0, 0], [0, 0, 0.45], metal, Math.max(1, k * 0.3));
      break;
    }
    case 24: {
      if (live) return;
      F(
        [
          [-1.3, -1.3, 0.12],
          [1.3, -1.3, 0.12],
          [1.3, 1.3, 0.12],
          [-1.3, 1.3, 0.12]
        ],
        col(SNOWMIX([226, 206, 150]), 1)
      );
      for (const [a, b] of [
        [
          [-1.3, -1.3],
          [1.3, -1.3]
        ],
        [
          [1.3, -1.3],
          [1.3, 1.3]
        ],
        [
          [1.3, 1.3],
          [-1.3, 1.3]
        ],
        [
          [-1.3, 1.3],
          [-1.3, -1.3]
        ]
      ])
        L([a[0], a[1], 0.2], [b[0], b[1], 0.2], wood, Math.max(1, k * 0.25));
      if (h32((p.seed * 7) | 0, 1, 2) < 0.6) {
        const s = P(0.4, 0.2, 0.2);
        c.fillStyle = col(C1, 1);
        c.fillRect(
          Math.round(s[0]),
          Math.round(s[1]) - 1,
          Math.max(1, (k * 0.4) | 0),
          Math.max(1, (k * 0.3) | 0)
        );
      }
      break;
    }
    case 25: {
      if (live) return;
      L([0, 0, 0], [0, 0, 0.5], col([60, 60, 60], 1));
      const s = P(0, 0, 0.75);
      c.fillStyle = col(C1, 1);
      c.fillRect(
        Math.round(s[0] - k * 0.35),
        Math.round(s[1] - k * 0.25),
        Math.max(2, Math.round(k * 0.7)),
        Math.max(1, Math.round(k * 0.5))
      );
      break;
    }
    case 26: {
      if (live) return;
      F(
        [
          [-1, -1, 0.3],
          [1, -1, 0.3],
          [1, 1, 0.3],
          [-1, 1, 0.3]
        ].map(q => [q[0] * 0.9, q[1] * 0.9, q[2]]),
        col(C2, 1)
      );
      L([0, 0, 0.3], [0, 0, 1], metal);
      break;
    }
    case 27: {
      if (live) return;
      const s = 0.8 * sm,
        h = 1.3 * sm;
      F(
        [
          [-s, s, 0],
          [s, s, 0],
          [s, s, h],
          [-s, s, h]
        ],
        col(C1, 0.85)
      );
      F(
        [
          [s, -s, 0],
          [s, s, 0],
          [s, s, h],
          [s, -s, h]
        ],
        col(C1, 0.7)
      );
      F(
        [
          [-s, -s, h],
          [s, -s, h],
          [s, s, h],
          [-s, s, h]
        ],
        col(C2, 1)
      );
      F(
        [
          [-s, -s, h],
          [s, -s, h],
          [0, 0, h + 0.7 * sm]
        ],
        col(C2, 0.8)
      );
      break;
    }
    case 60: {
      if (live) return; // bus stop: a glass shelter with a bench where there is one, and the stop sign on its pole
      const glass = col([150, 190, 206], 0.55),
        frame = col([60, 64, 70], 1),
        roof = col([70, 74, 80], 1);
      if (p.sh) {
        F(
          [
            [0.7, -1.9, 0],
            [0.7, 1.9, 0],
            [0.7, 1.9, 2.3],
            [0.7, -1.9, 2.3]
          ],
          glass
        );
        F(
          [
            [-0.5, -1.9, 0],
            [0.7, -1.9, 0],
            [0.7, -1.9, 2.3],
            [-0.5, -1.9, 2.3]
          ],
          glass
        );
        F(
          [
            [-0.5, 1.9, 0],
            [0.7, 1.9, 0],
            [0.7, 1.9, 2.3],
            [-0.5, 1.9, 2.3]
          ],
          glass
        );
        for (const v of [-1.9, 1.9]) L([0.7, v, 0], [0.7, v, 2.35], frame, Math.max(1, k * 0.15));
        L([-0.5, -1.9, 0], [-0.5, -1.9, 2.35], frame, Math.max(1, k * 0.12));
        L([-0.5, 1.9, 0], [-0.5, 1.9, 2.35], frame, Math.max(1, k * 0.12));
        F(
          [
            [-0.7, -2, 2.4],
            [0.8, -2, 2.4],
            [0.8, 2, 2.4],
            [-0.7, 2, 2.4]
          ],
          roof
        );
        L([0.45, -1.5, 0.45], [0.45, 1.5, 0.45], wood, Math.max(1, k * 0.3));
        if (k >= 1.4) {
          F(
            [
              [0.69, 0.4, 0.6],
              [0.69, 1.6, 0.6],
              [0.69, 1.6, 2],
              [0.69, 0.4, 2]
            ],
            col([236, 232, 220], 1)
          );
        }
      }
      L([-0.9, -2.6, 0], [-0.9, -2.6, 2.7], metal, Math.max(1, k * 0.12));
      F(
        [
          [-0.9, -2.95, 2.05],
          [-0.9, -2.25, 2.05],
          [-0.9, -2.25, 2.75],
          [-0.9, -2.95, 2.75]
        ],
        white
      );
      F(
        [
          [-0.9, -2.95, 2.55],
          [-0.9, -2.25, 2.55],
          [-0.9, -2.25, 2.75],
          [-0.9, -2.95, 2.75]
        ],
        col([40, 44, 50], 1)
      );
      break;
    }
    case 30: {
      if (live) return;
      const gw = p.small ? 2.5 : 3.66,
        gh = p.small ? 1.6 : 2.44;
      L([0, -gw, 0], [0, -gw, gh], white, Math.max(1, k * 0.2));
      L([0, gw, 0], [0, gw, gh], white, Math.max(1, k * 0.2));
      L([0, -gw, gh], [0, gw, gh], white, Math.max(1, k * 0.2));
      if (k >= 1) {
        const nc = col([210, 214, 216], 1);
        L([0, -gw, gh], [-1.2, -gw, 0], nc, 1);
        L([0, gw, gh], [-1.2, gw, 0], nc, 1);
        L([-1.2, -gw, 0], [-1.2, gw, 0], nc, 1);
        for (let i = 1; i < 6; i++) {
          const v = -gw + (i * gw) / 3;
          L([0, v, gh], [-1.2, v, 0], nc, 1);
        }
      }
      break;
    }
    case 31: {
      if (live) return;
      L([-0.6, 0, 0], [-0.6, 0, 3.1], metal, Math.max(1, k * 0.22));
      L([-0.6, 0, 3.1], [0, 0, 3.1], metal);
      F(
        [
          [0, -0.9, 2.9],
          [0, 0.9, 2.9],
          [0, 0.9, 3.95],
          [0, -0.9, 3.95]
        ],
        white
      );
      const r = P(0.35, 0, 3.05);
      c.strokeStyle = col([230, 90, 40], 1);
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(r[0], r[1], Math.max(1, k * 0.25), Math.max(1, k * 0.12), 0, 0, 7);
      c.stroke();
      break;
    }
    case 32: {
      if (live) return;
      const w = (p.w || 10) / 2,
        h = p.hi ? 2.3 : 1;
      L([0, -w, 0], [0, -w, h], metal);
      L([0, w, 0], [0, w, h], metal);
      F(
        [
          [0, -w, h],
          [0, w, h],
          [0, w, h - 0.8],
          [0, -w, h - 0.8]
        ],
        'rgba(240,240,240,.45)'
      );
      L([0, -w, h], [0, w, h], white, Math.max(1, k * 0.15));
      break;
    }
    case 33: {
      if (live) return;
      L([0, -1.5, 0], [0, -1.5, 2], col([220, 40, 40], 1), Math.max(1, k * 0.2));
      L([0, 1.5, 0], [0, 1.5, 2], col([220, 40, 40], 1), Math.max(1, k * 0.2));
      L([0, -1.5, 2], [0, 1.5, 2], white, Math.max(1, k * 0.2));
      break;
    }
  }
}
const LIVE_PT = new Set([5, 7, 20, 61, 62]);
/* ---------- life: swimmers, children at play, practice on the pitch ---------- */
function hourNow() {
  return (gameMin % 1440) / 60;
}
function zoneWant(A) {
  if (A.custom) return A.until > time ? 999 : 0;
  const h = hourNow(),
    dow = dayOfWeek(),
    wk = dow === 0 || dow === 6;
  const wet = rainT > 0 ? 0.35 : 1,
    cold = SEAS === 'winter' ? 0.55 : 1;
  switch (A.c) {
    case AK.POOL:
    case AK.WPARK: {
      if (h < 6.5 || h >= 22) return 0;
      const busy = wk
        ? h < 9
          ? 0.2
          : h < 18
            ? 0.9
            : 0.5
        : h < 8.5
          ? 0.65
          : h < 16
            ? 0.35
            : h < 20
              ? 0.95
              : 0.5;
      const hot = A.sub === 1 || A.area < 30;
      return Math.round(Math.min(hot ? 9 : 24, A.area / (hot ? 2.6 : 20)) * busy);
    }
    case AK.PLAY: {
      if (h < 9 || h >= 20) return 0;
      const busy = (wk ? 0.9 : h < 15 ? 0.35 : 0.8) * wet * cold;
      return Math.round(Math.min(10, A.area / 60) * busy);
    }
    case AK.KINDER: {
      if (wk || h < 8 || h >= 16.5) return 0;
      const out = (h >= 9.5 && h < 11) || (h >= 14 && h < 16) ? 1 : 0;
      return Math.round(Math.min(22, A.area / 90) * out * (rainT > 0 ? 0.7 : 1));
    }
    case AK.SCHOOL: {
      if (wk || (!A.court && !A.play)) return 0;
      const rec = (h >= 9.6 && h < 10) || (h >= 11.7 && h < 12.3) || (h >= 13.3 && h < 13.5) ? 1 : 0;
      return Math.round(Math.min(36, A.area / 300) * rec * (rainT > 0 ? 0.6 : 1));
    }
    case AK.PITCH: {
      const s = A.sub & 15;
      if (!(s === 1 || (s === 0 && A.L > 40) || s === 2)) return 0;
      const ev = (h >= 16.5 && h < 21.5) || (wk && h >= 10 && h < 17);
      return ev ? Math.round(Math.min(s === 2 ? 6 : 14, A.area / 400) * wet) : 0;
    }
  }
  return 0;
}
const ZONES = new Set();
function spawnZones(vr) {
  if (!PROPS_OK) return;
  const want = K >= 0.6;
  for (const A of ZONES) A.ag = 0;
  for (const a of agents)
    if (a.zone && !a.dead) {
      a.zone.ag++;
      ZONES.add(a.zone);
    }
  for (const A of ZONES) {
    if (
      !want ||
      A.maxx < vr[0] - 80 ||
      A.minx > vr[2] + 80 ||
      A.maxy < vr[1] - 80 ||
      A.miny > vr[3] + 80 ||
      zoneWant(A) < A.ag - 2 ||
      zoneWant(A) === 0
    ) {
      for (const a of agents)
        if (a.zone === A && a !== follow && (!want || zoneWant(A) === 0 || R() < 0.5)) {
          a.dead = true;
          A.ag--;
        }
      if (A.ag <= 0) {
        A.ag = 0;
        ZONES.delete(A);
      }
    }
  }
  if (!want) return;
  let budget = 10;
  areasIn(vr[0], vr[1], vr[2], vr[3], A => {
    if (budget <= 0 || A.custom) return;
    const w = zoneWant(A);
    if (w <= A.ag) return;
    for (let q = 0; q < Math.min(4, w - A.ag) && budget > 0; q++) {
      if (spawnZoneAgent(A)) budget--;
    }
  });
}
function spawnZoneAgent(A) {
  let x,
    y,
    kind = 'ped',
    r;
  const pick = () => {
    for (let q = 0; q < 10; q++) {
      const u = A.mu + (R() - 0.5) * A.L * 0.9,
        v = A.mv + (R() - 0.5) * A.W * 0.9;
      const p = AU(A, u, v);
      if (pip(A.poly, p[0], p[1]) && !inBld(p[0], p[1])) return { u, v, x: p[0], y: p[1] };
    }
    return null;
  };
  if (A.c === AK.POOL || A.c === AK.WPARK) {
    const hot = A.sub === 1 || A.area < 30;
    r = pick();
    if (!r) return false;
    const a = mkAgent('ped', r.x, r.y);
    a.zone = A;
    a.keep = 1;
    a.zk = hot ? 'soak' : 'swim';
    a.state = 'zone';
    a.lane = r.v;
    a.u = r.u;
    a.dir = R() < 0.5 ? 1 : -1;
    a.sp = 0.6 + R() * 0.5;
    a.cap =
      R() < 0.5
        ? pickA([
            [230, 60, 60],
            [40, 90, 200],
            [250, 250, 250],
            [30, 30, 30],
            [240, 200, 40]
          ])
        : null;
    a.job = hot ? 'Soaking in the hot tub' : 'Swimming lengths';
    a.act = (hot ? 'Relaxing in ' : 'Swimming at ') + (A.name || 'the pool');
    A.ag++;
    ZONES.add(A);
    agents.push(a);
    return true;
  }
  if (A.c === AK.SCHOOL) {
    const base = A.court || A.play;
    if (!base) return false;
    x = base.x + (R() - 0.5) * 20;
    y = base.y + (R() - 0.5) * 14;
    if (inBld(x, y)) return false;
    kind = 'kid';
  } else {
    r = pick();
    if (!r) return false;
    x = r.x;
    y = r.y;
    kind = A.c === AK.PITCH ? 'ped' : 'kid';
  }
  const a = mkAgent(kind, x, y);
  applyLook(
    a,
    mkPersona(
      { cx: x, cy: y, kind: 0, seed: 0.5, area: 150, wl: 0.5 },
      kind === 'kid' ? 6 + ((R() * 7) | 0) : A.c === AK.PITCH ? 16 + ((R() * 22) | 0) : undefined
    )
  );
  a.scooter = a.bike = 0;
  a.zone = A;
  a.keep = 1;
  a.zk = 'play';
  a.state = 'zone';
  a.tx = x;
  a.ty = y;
  a.zt = R() * 2;
  if (A.c === AK.KINDER) {
    a.scale = 0.55;
    a.age = 2 + ((R() * 4) | 0);
    a.job = 'Leikskólabarn';
    a.bag = null;
    a.hat = SEAS === 'winter' || rainT > 0 ? pickA(HATS) : a.hat;
    a.act = 'Playing at ' + (A.name || 'leikskóli');
    if (R() < 0.12) {
      a.scale = 1;
      a.age = 24 + ((R() * 30) | 0);
      a.vest = 1;
      a.job = 'Kindergarten teacher';
      a.act = 'Keeping an eye on the children';
      a.teacher = 1;
    }
  } else if (A.c === AK.SCHOOL) {
    a.act = 'Recess at ' + (A.name || 'school');
  } else if (A.c === AK.PITCH) {
    a.shirt = A.id % 2 ? [40, 90, 190] : [200, 40, 50];
    if (R() < 0.5) a.shirt = [240, 240, 240];
    a.pants = [30, 30, 34];
    a.hat = null;
    a.lopi = false;
    a.job = R() < 0.4 ? 'Footballer' : 'Plays for the local club';
    a.act = (A.sub & 15) === 2 ? 'Shooting hoops' : 'Football practice';
    a.sp = 2.6;
  } else {
    a.act = 'Playing at the playground';
  }
  A.ag++;
  ZONES.add(A);
  agents.push(a);
  return true;
}
function stepZoneAgent(a, dt) {
  const A = a.zone;
  if (hazards.length && R() < dt * 2)
    for (const hz of hazards)
      if (Math.hypot(a.x - hz.x, a.y - hz.y) < hz.r) {
        a.zone = null;
        a.keep = 0;
        a.zk = null;
        a.ride = null;
        a.state = 'walk';
        flee(a, hz);
        return;
      }
  if (a.zk === 'swim') {
    if (a.pause > 0) {
      a.pause -= dt;
      a.vx = a.vy = 0;
    } else {
      const nu = a.u + a.dir * a.sp * dt,
        ah = AU(A, nu + a.dir * 0.9, a.lane);
      if (!pip(A.poly, ah[0], ah[1])) {
        a.dir *= -1;
        a.pause = 0.4 + R() * 1.2;
      } else a.u = nu;
      a.vx = A.ux * a.dir * a.sp;
      a.vy = A.uy * a.dir * a.sp;
    }
    const p = AU(A, a.u, a.lane);
    a.x = p[0];
    a.y = p[1];
    a.phase += dt * 5;
    return;
  }
  if (a.zk === 'soak') {
    a.vx = a.vy = 0;
    a.phase += dt;
    return;
  }
  a.zt -= dt;
  const dx = a.tx - a.x,
    dy = a.ty - a.y,
    d = Math.hypot(dx, dy);
  if (a.ride) {
    a.ride.busy = 1;
    a.x = a.ride.x;
    a.y = a.ride.y;
    a.vx = a.vy = 0;
    if (a.zt <= 0) {
      a.ride.busy = 0;
      a.ride = null;
      a.zt = 0;
    }
    return;
  }
  if (d < 0.35) {
    a.vx = a.vy = 0;
    a.state = 'zone';
    if (a.zt <= 0) {
      // next target
      if (a.teacher) {
        a.zt = 4 + R() * 8;
      } else a.zt = 0.5 + R() * 3;
      const A2 = A;
      let eq = null;
      if (!a.teacher && A2.c !== AK.PITCH && R() < 0.35)
        ptsIn(A2.minx, A2.miny, A2.maxx, A2.maxy, p => {
          if (!eq && p.c >= 20 && R() < 0.4 && Math.hypot(p.x - a.x, p.y - a.y) < 40) eq = p;
        });
      if (eq) {
        if (eq.c === 20 && !eq.busy && R() < 0.7) {
          a.tx = eq.x;
          a.ty = eq.y;
          a.goRide = eq;
        } else {
          a.tx = eq.x + (R() - 0.5) * 2;
          a.ty = eq.y + (R() - 0.5) * 2;
        }
      } else {
        const base = A2.c === AK.SCHOOL ? A2.court || A2.play : null;
        for (let q = 0; q < 8; q++) {
          let x, y;
          if (base) {
            x = base.x + (R() - 0.5) * 24;
            y = base.y + (R() - 0.5) * 14;
          } else {
            const p = AU(A2, A2.mu + (R() - 0.5) * A2.L * 0.85, A2.mv + (R() - 0.5) * A2.W * 0.85);
            x = p[0];
            y = p[1];
            if (!pip(A2.poly, x, y)) continue;
          }
          if (inBld(x, y)) continue;
          a.tx = x;
          a.ty = y;
          break;
        }
      }
    } else if (a.goRide && Math.hypot(a.goRide.x - a.x, a.goRide.y - a.y) < 0.6) {
      a.ride = a.goRide;
      a.goRide = null;
      a.zt = 6 + R() * 10;
      a.act = 'On the swings';
    }
    a.phase += 0;
    return;
  }
  const sp =
    (a.zone.c === AK.PITCH ? 2.6 : a.scale < 0.6 ? 1.1 : 1.7) * (a.teacher ? 0.5 : 1) * (R() < 0.02 ? 0 : 1);
  const s = Math.min(d, sp * dt);
  a.vx = (dx / d) * sp;
  a.vy = (dy / d) * sp;
  a.x += (dx / d) * s;
  a.y += (dy / d) * s;
  a.phase += dt * sp * 5;
  if (a.zone.c === AK.PITCH && R() < dt * 0.3 && !a.bubble)
    say(a, ['Hér!', 'Sendu!', 'Mark!', 'Áfram!', 'Góður!'], 1.2);
  if (a.scale < 1 && R() < dt * 0.05 && !a.bubble) say(a, PH.kid, 1.4);
  if (a.crowd && R() < dt * (a.event ? 0.01 : 0.06) && !a.bubble) say(a, CROWD_PH[a.crowd], 2);
}
function drawSwimmer(a, X, Y, k) {
  const p = Math.max(1, Math.round((k * 3.8) / 14));
  const cap = a.cap ? C_(a.cap, 1) : C_(a.hair, 1),
    skin = C_(a.skin, 1);
  ctx.fillStyle = 'rgba(220,245,255,.55)';
  ctx.fillRect(X - 3 * p, Y, 7 * p, p);
  if (a.zk === 'soak') {
    ctx.fillStyle = skin;
    ctx.fillRect(X - 2 * p, Y - 2 * p, 5 * p, 2 * p);
    ctx.fillRect(X - p, Y - 5 * p, 3 * p, 3 * p);
    ctx.fillStyle = cap;
    ctx.fillRect(X - p, Y - 5 * p, 3 * p, p);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(X - p + ((Math.sin(time + a.id) * 2) | 0), Y - 9 * p - ((time * 6 + a.id) % 6) * p, p, p);
    return;
  }
  const st = Math.sin(a.phase) > 0;
  let svx = a.vx * SXx + a.vy * SXy;
  const fr = svx >= 0 ? 1 : -1;
  ctx.fillStyle = skin;
  ctx.fillRect(X - p, Y - 2 * p, 3 * p, 2 * p);
  ctx.fillStyle = cap;
  ctx.fillRect(X - p, Y - 2 * p, 3 * p, p);
  ctx.fillStyle = skin;
  if (st) ctx.fillRect(X + fr * 2 * p, Y - 3 * p, p, 2 * p);
  else ctx.fillRect(X - fr * 3 * p, Y - p, 2 * p, p);
  if ((a.phase | 0) % 2) (ctx.fillStyle = 'rgba(255,255,255,.6)'), ctx.fillRect(X - fr * 4 * p, Y, p, p);
}
/* ---------- info card ---------- */
function areaAt(x, y) {
  let best = null;
  areasIn(x - 1, y - 1, x + 1, y + 1, A => {
    if (A.custom) return;
    if (A.c === AK.PARKING && K < 0.6) return;
    if (pip(A.poly, x, y) && (!best || A.area < best.area)) best = A;
  });
  return best;
}
const AREA_INFO = {
  1: ['Sundlaug', 'Outdoor geothermal pool'],
  2: ['Leikvöllur', 'Playground'],
  3: ['Grunnskóli', 'School'],
  4: ['Leikskóli', 'Kindergarten'],
  5: ['Völlur', 'Sports pitch'],
  6: ['Almenningsgarður', 'Park'],
  7: ['Bílastæði', 'Car park'],
  8: ['Íþróttamiðstöð', 'Sports centre'],
  9: ['Kirkjugarður', 'Cemetery'],
  10: ['Hundasvæði', 'Dog park'],
  11: ['Hlaupabraut', 'Running track'],
  12: ['Vatnagarður', 'Water park'],
  13: ['Háskóli', 'University']
};
const SPORT = [
  'Sports pitch',
  'Football pitch',
  'Basketball court',
  'Tennis court',
  'Handball court',
  'Golf',
  'Volleyball court',
  'Multi-sport court'
];
function areaCard(A) {
  const inf = AREA_INFO[A.c] || ['Svæði', 'Area'];
  let sub = inf[0] + ' · ' + inf[1];
  if (A.c === AK.PITCH) {
    const s = A.sub & 15;
    sub =
      [
        'Völlur',
        'Fótboltavöllur',
        'Körfuboltavöllur',
        'Tennisvöllur',
        'Handboltavöllur',
        'Golf',
        'Blakvöllur',
        'Sparkvöllur'
      ][s] +
      ' · ' +
      SPORT[s] +
      (A.sub & 16 ? ' (artificial turf)' : '');
  }
  const hot = A.c === AK.POOL && (A.sub === 1 || A.area < 30);
  if (hot) sub = 'Heitur pottur · Hot tub';
  let rows =
    '<div class="row"><span>Place</span><span>' +
    district(A.cx, A.cy) +
    '</span></div><div class="row"><span>Size</span><span>' +
    (A.area >= 10000 ? (A.area / 10000).toFixed(1) + ' ha' : Math.round(A.area) + ' m²') +
    '</span></div>';
  const nowN = A.ag || 0;
  if (A.c === AK.POOL || A.c === AK.WPARK) {
    rows +=
      '<div class="row"><span>Water</span><span>' +
      (hot ? '38–42 °C' : '28–29 °C') +
      '</span></div><div class="row"><span>Open</span><span>6:30–22:00</span></div><div class="row"><span>' +
      (hot ? 'Soaking' : 'Swimming') +
      ' now</span><span>' +
      nowN +
      '</span></div>';
  } else if (A.c === AK.PLAY || A.c === AK.KINDER || A.c === AK.SCHOOL)
    rows += '<div class="row"><span>Children outside</span><span>' + nowN + '</span></div>';
  else if (A.c === AK.PITCH)
    rows += '<div class="row"><span>Playing now</span><span>' + nowN + '</span></div>';
  else if (A.c === AK.PARKING && A.stalls) {
    let o = 0;
    if (A.st) for (const v of A.st) if (v === 1 || v === 2) o++;
    rows +=
      '<div class="row"><span>Serves</span><span>' +
      LOTKN[lotKind(A)] +
      '</span></div><div class="row"><span>Cars parked</span><span>' +
      o +
      ' of ' +
      A.stalls.length +
      '</span></div>';
  }
  const fact =
    A.c === AK.POOL || A.c === AK.WPARK
      ? 'Heated by geothermal water all year. The rule: shower without a swimsuit before you get in.'
      : A.c === AK.KINDER
        ? 'Most Icelandic children start leikskóli between one and two years old, and they play outside in all weather.'
        : A.c === AK.SCHOOL
          ? 'Grunnskóli runs from 6 to 16; recess (frímínútur) is spent outdoors.'
          : A.c === AK.PITCH && (A.sub & 15) === 1
            ? 'Iceland has hundreds of heated artificial pitches, one reason the national team reached Euro 2016.'
            : A.c === AK.PARK
              ? ''
              : '';
  return {
    h:
      '<h3>' +
      (A.name || inf[0]) +
      '</h3><div class="sub">' +
      sub +
      '</div>' +
      rows +
      (fact ? '<p style="margin:.5em 0 0;font-size:12px;opacity:.85">' + fact + '</p>' : ''),
    m: (A.name || inf[0]) + ' · ' + inf[1]
  };
}
/* ---------- steam over the pools ---------- */
let steamAcc = 0;
function stepAreaFX(dt) {
  if (!PROPS_OK || K < 0.4) return;
  steamAcc += dt;
  if (steamAcc < 0.15) return;
  steamAcc = 0;
  const vr = viewRect(20);
  const cold = TEMP < 4 ? 1.6 : TEMP < 9 ? 1 : 0.5;
  areasIn(vr[0], vr[1], vr[2], vr[3], A => {
    if (A.c !== AK.POOL && A.c !== AK.WPARK) return;
    const hot = A.sub === 1 || A.area < 30;
    if (R() > (hot ? 0.7 : 0.35) * cold) return;
    const u = A.mu + (R() - 0.5) * A.L * 0.8,
      v = A.mv + (R() - 0.5) * A.W * 0.8;
    const [x, y] = AU(A, u, v);
    if (!pip(A.poly, x, y)) return;
    addP({
      t: 1,
      x,
      y,
      z: areaZ(A) + 0.3,
      vx: WIND[0] * windS * 0.3,
      vy: WIND[1] * windS * 0.3,
      vz: 1 + R(),
      life: 2.5 + R() * 2,
      max: 4.5,
      c: [236, 240, 244],
      s: hot ? 1.6 : 2.4,
      a: 0.35
    });
  });
}
