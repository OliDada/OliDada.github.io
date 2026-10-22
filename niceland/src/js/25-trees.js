/**
 * Trees
 *
 * Cached tree sprites for each kind, season and size.
 *
 * Functions: treeSprite
 * State and constants: TSPR
 */

const TSPR = new Map();
function treeSprite(kind, sd, sz, burnt, lit) {
  const vr = (sd * 8) | 0,
    szq = Math.max(0.5, Math.round(sz * 4) / 4),
    leaf = burnt ? 9 : SP.leaf,
    snow = SP.cover > 0 || snowAcc > 0.15 ? 1 : 0;
  const lk = lit ? ((LR * 20) | 0) + ',' + ((LG * 20) | 0) + ',' + ((LB * 20) | 0) : 'n';
  const key =
    kind +
    '|' +
    vr +
    '|' +
    szq +
    '|' +
    leaf +
    '|' +
    snow +
    '|' +
    lk +
    '|' +
    (kind === 1 ? ((sd * 5) | 0) % 5 : 0);
  let s = TSPR.get(key);
  if (s) return s;
  if (TSPR.size > 4000) {
    TSPR.clear();
  }
  const W = Math.ceil(12 * szq) + 6,
    H = Math.ceil(14 * szq) + 6,
    cv2 = document.createElement('canvas');
  cv2.width = W;
  cv2.height = H;
  const c = cv2.getContext('2d');
  const ax = W >> 1,
    ay = H - 3;
  const f = (col, m) => (lit ? C_(col, m) : N_(col, m));
  const rnd = q => h32(vr * 97 + kind * 13, q, (szq * 4) | 0);
  const blob = (x, y, r, col) => {
    c.fillStyle = col;
    c.beginPath();
    c.arc(ax + x, ay + y, Math.max(0.7, r), 0, 7);
    c.fill();
  };
  if (kind === 0) {
    // spruce / pine: tiers with a dark and a light side, jagged edges
    const h = (8.5 + rnd(1) * 2.5) * szq,
      w = (2.3 + rnd(2) * 0.6) * szq,
      base = -szq * 1.1,
      g = burnt ? [44, 42, 40] : [38, 78, 52];
    c.fillStyle = f([86, 62, 44], 1);
    c.fillRect(ax - Math.max(0.5, szq * 0.3), ay + base, Math.max(1, szq * 0.6), -base);
    const n = Math.max(3, Math.min(6, Math.round(h / 2.6)));
    for (let i = 0; i < n; i++) {
      const t0 = i / n,
        yb = base - (h - szq) * t0 * 0.92,
        yt = yb - ((h - szq) / n) * 1.7,
        ww = w * (1 - t0 * 0.78);
      c.fillStyle = f(g, 0.82);
      c.beginPath();
      c.moveTo(ax - ww, yb + ay);
      c.lineTo(ax, yt + ay);
      c.lineTo(ax, yb + ay + szq * 0.3);
      c.closePath();
      c.fill();
      c.fillStyle = f(g, 1.12);
      c.beginPath();
      c.moveTo(ax + ww, yb + ay);
      c.lineTo(ax, yt + ay);
      c.lineTo(ax, yb + ay + szq * 0.3);
      c.closePath();
      c.fill();
      if (szq >= 1.2) {
        c.fillStyle = f(g, 0.7);
        for (let q = 0; q < 3; q++) {
          const xx = ax + (rnd(10 + i * 5 + q) - 0.5) * ww * 1.6;
          c.fillRect(Math.round(xx), Math.round(yb + ay - 1), 1, 1);
        }
      }
      if (snow && !burnt) {
        c.fillStyle = f([236, 240, 244], 1);
        c.beginPath();
        c.moveTo(ax - ww * 0.55, yb + ay - (yb - yt) * 0.45);
        c.lineTo(ax, yt + ay);
        c.lineTo(ax + ww * 0.55, yb + ay - (yb - yt) * 0.45);
        c.closePath();
        c.fill();
      }
    }
  } else if (kind === 1) {
    // birch / rowan: several thin trunks and a clumpy, irregular crown lit from the upper left
    const rowan = sd > 0.78,
      L = burnt
        ? null
        : rowan && SP.leaf === 3
          ? [
              [180, 60, 40],
              [200, 90, 40],
              [170, 50, 40],
              [190, 120, 50],
              [160, 60, 40]
            ][((sd * 5) | 0) % 5]
          : leafCol(sd);
    const HT = (7 + rnd(1) * 2.2) * szq,
      ry = HT * (0.34 + rnd(3) * 0.06),
      cy = -HT + ry,
      rx = ry * (0.62 + rnd(2) * 0.25),
      lx = (rnd(7) - 0.5) * 1.2 * szq;
    const bark = burnt ? [50, 46, 42] : rowan ? [110, 92, 76] : [226, 222, 212];
    const nt = rowan ? 1 : 2 + (rnd(4) < 0.4 ? 1 : 0);
    c.strokeStyle = f(bark, 1);
    c.lineWidth = Math.max(1, szq * 0.45);
    for (let i = 0; i < nt; i++) {
      const lean = (i - (nt - 1) / 2) * szq * 0.9 + (rnd(5 + i) - 0.5) * szq * 0.5;
      c.beginPath();
      c.moveTo(ax + i * szq * 0.25 - (nt - 1) * szq * 0.12, ay);
      c.quadraticCurveTo(ax + lean * 0.3, ay + cy * 0.5, ax + lean, ay + cy + ry * 0.4);
      c.stroke();
      if (!rowan && szq >= 1.5 && !burnt) {
        c.fillStyle = f([40, 36, 34], 1);
        for (let q = 0; q < 3; q++)
          c.fillRect(
            Math.round(ax + lean * (0.2 + q * 0.25)),
            Math.round(ay + cy * (0.25 + q * 0.2)),
            Math.max(1, (szq * 0.4) | 0),
            1
          );
      }
    }
    if (!L) {
      c.strokeStyle = f(burnt ? [44, 40, 38] : [104, 88, 78], 1);
      c.lineWidth = 1;
      for (let q = 0; q < 9; q++) {
        const a2 = -Math.PI / 2 + (rnd(20 + q) - 0.5) * 2.4,
          ln = (1 + rnd(30 + q) * 1.4) * szq * 1.6;
        const x0 = ax + (rnd(40 + q) - 0.5) * szq,
          y0 = ay + cy + ry * 0.5;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x0 + Math.cos(a2) * ln, y0 + Math.sin(a2) * ln);
        c.stroke();
      }
      if (snow && !burnt) {
        c.fillStyle = f([236, 240, 244], 1);
        for (let q = 0; q < 6; q++)
          c.fillRect(
            Math.round(ax + (rnd(60 + q) - 0.5) * rx * 1.6),
            Math.round(ay + cy - ry * 0.3 + (rnd(70 + q) - 0.5) * ry),
            1,
            1
          );
      }
    } else {
      // clumps around 3-4 sub-centres, gaps between them, branches showing through
      c.strokeStyle = f(bark, 0.9);
      c.lineWidth = Math.max(1, szq * 0.3);
      for (let q = 0; q < 4; q++) {
        const bx = (rnd(200 + q) - 0.5) * rx * 1.4,
          by = cy + (rnd(210 + q) - 0.6) * ry * 1.2;
        c.beginPath();
        c.moveTo(ax + lx * 0.3, ay + cy + ry * 0.6);
        c.lineTo(ax + bx, ay + by);
        c.stroke();
      }
      const subs = [];
      const ns = 3 + (rnd(5) < 0.5 ? 1 : 0);
      for (let q = 0; q < ns; q++)
        subs.push([
          (rnd(300 + q) - 0.5) * rx * 1.1 + lx * (q / ns - 0.3),
          cy + (rnd(310 + q) - 0.5) * ry * 1.2,
          0.55 + rnd(320 + q) * 0.35
        ]);
      const nb = 16 + ((rnd(6) * 8) | 0),
        bl = [];
      for (let i = 0; i < nb; i++) {
        const S = subs[i % ns],
          an = rnd(100 + i) * 6.283,
          rr = Math.sqrt(rnd(120 + i));
        bl.push([
          S[0] + Math.cos(an) * rx * S[2] * rr,
          S[1] + Math.sin(an) * ry * S[2] * rr * 0.9,
          (0.5 + rnd(140 + i) * 0.45) * szq * 1.1
        ]);
      }
      bl.sort((p, q) => p[1] - q[1]);
      for (const [x, y, r] of bl) blob(x + szq * 0.15, y + szq * 0.2, r, f(L, 0.62));
      for (const [x, y, r] of bl) blob(x - r * 0.18, y - r * 0.22, r * 0.82, f(L, 0.86));
      for (const [x, y, r] of bl)
        if (y < cy + ry * 0.2) blob(x - r * 0.35, y - r * 0.42, r * 0.45, f(L, 1.1));
      if (szq >= 1.2) {
        c.fillStyle = f(L, 1.25);
        for (let q = 0; q < 5; q++) {
          const b2 = bl[q % bl.length];
          c.fillRect(Math.round(ax + b2[0] - b2[2] * 0.5), Math.round(ay + b2[1] - b2[2] * 0.6), 1, 1);
        }
      }
      if (rowan && SP.leaf >= 2) {
        c.fillStyle = f([210, 40, 30], 1);
        for (let q = 0; q < 5; q++) {
          const b2 = bl[(q * 3) % bl.length];
          c.fillRect(Math.round(ax + b2[0] + b2[2] * 0.2), Math.round(ay + b2[1] + b2[2] * 0.3), 1, 1);
        }
      }
      if (snow) {
        c.fillStyle = f([236, 240, 244], 1);
        for (const [x, y, r] of bl)
          if (y < cy)
            c.fillRect(
              Math.round(ax + x - r * 0.5),
              Math.round(ay + y - r * 0.8),
              Math.max(1, Math.round(r)),
              1
            );
      }
    }
  } else {
    // low willow / shrub
    const L = burnt
      ? [52, 48, 44]
      : SP.leaf === 0
        ? [118, 100, 80]
        : SP.leaf === 3
          ? [(110 + sd * 50) | 0, (90 + sd * 25) | 0, 56]
          : [92, 128, 66];
    const nb = 4 + ((rnd(1) * 3) | 0);
    for (let i = 0; i < nb; i++) {
      const x = (rnd(10 + i) - 0.5) * 2.6 * szq,
        y = -(0.7 + rnd(20 + i) * 0.9) * szq,
        r = (0.7 + rnd(30 + i) * 0.5) * szq;
      blob(x + 0.2, y + 0.3, r, f(L, 0.7));
      blob(x - 0.2, y - 0.2, r * 0.8, f(L, 1.02));
    }
  }
  s = { cv: cv2, ax, ay };
  TSPR.set(key, s);
  return s;
}
