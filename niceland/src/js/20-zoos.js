/**
 * Zoos
 *
 * Pens, pools and animals in the zoos mapped in OSM.
 *
 * Functions: zooEach, penLocal, inPen, inPool, penPt, genZoos, drawZooGround, zooSpawn
 * State and constants: ZOOPENS, ZOOPB, ZOO_BIG, ZOO_PET
 */

// Húsdýragarðurinn (Reykjavík Family Park & Zoo) keeps Iceland's farm and wild animals: seals, reindeer, arctic foxes, mink,
// horses, cattle, sheep, goats, pigs, hens, rabbits, geese and ducks. The smaller petting zoos keep farm animals.
let ZOOPENS = [];
const ZOOPB = new Map();
const ZOO_BIG = [
  ['seal', 3, 'pool'],
  ['reindeer', 3],
  ['fox', 2],
  ['mink', 2],
  ['horse', 3],
  ['cow', 3],
  ['sheep', 5],
  ['goat', 4],
  ['pig', 3],
  ['hen', 7],
  ['rabbit', 5],
  ['duck', 5, 'pond'],
  ['goose', 4],
  ['sheep', 4],
  ['goat', 3],
  ['horse', 2]
];
const ZOO_PET = [
  ['goat', 4],
  ['sheep', 4],
  ['rabbit', 5],
  ['hen', 6],
  ['pig', 2],
  ['horse', 2],
  ['cow', 2],
  ['duck', 4, 'pond']
];
function zooEach(x0, y0, x1, y1, fn) {
  const i0 = Math.max(0, Math.floor((x0 - GOX) / BG)),
    i1 = Math.min(BGW - 1, Math.floor((x1 - GOX) / BG)),
    j0 = Math.max(0, Math.floor((y0 - GOY) / BG)),
    j1 = Math.min(BGH - 1, Math.floor((y1 - GOY) / BG));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const a = ZOOPB.get(i + j * BGW);
      if (a) for (const p of a) fn(p);
    }
}
function penLocal(p, x, y) {
  const dx = x - p.x,
    dy = y - p.y;
  return [dx * p.ca + dy * p.sa, -dx * p.sa + dy * p.ca];
}
function inPen(p, x, y, m) {
  const [u, v] = penLocal(p, x, y);
  return Math.abs(u) < p.L / 2 - m && Math.abs(v) < p.W / 2 - m;
}
function inPool(p, x, y, m) {
  if (!p.pool) return false;
  const [u, v] = penLocal(p, x, y);
  const a = p.L / 2 - 2.2 - m,
    b = p.W / 2 - 2.2 - m;
  return (
    a > 0 &&
    b > 0 &&
    (p.pool === 'pond' ? (u * u) / (a * a) + (v * v) / (b * b) < 1 : Math.abs(u) < a && Math.abs(v) < b)
  );
}
function penPt(p, water) {
  for (let q = 0; q < 20; q++) {
    const u = (R() - 0.5) * (p.L - 2),
      v = (R() - 0.5) * (p.W - 2);
    const x = p.x + u * p.ca - v * p.sa,
      y = p.y + u * p.sa + v * p.ca;
    if (water ? inPool(p, x, y, 0.4) : !inPool(p, x, y, -0.3)) return [x, y];
  }
  return [p.x, p.y];
}
function genZoos() {
  if (!POI) return;
  ZOOPENS = [];
  let nf = 0;
  for (const e of POI) {
    if (e[2] !== 'zoo' || !Array.isArray(e[5]) || e[5].length < 6) continue;
    const poly = new Float32Array(e[5]),
      n = poly.length / 2;
    const big = e[3] !== 'petting_zoo';
    let cx = 0,
      cy = 0;
    for (let j = 0; j < n; j++) {
      cx += poly[2 * j];
      cy += poly[2 * j + 1];
    }
    cx /= n;
    cy /= n;
    let sxx = 0,
      syy = 0,
      sxy = 0;
    for (let j = 0; j < n; j++) {
      const dx = poly[2 * j] - cx,
        dy = poly[2 * j + 1] - cy;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy),
      ca = Math.cos(ang),
      sa = Math.sin(ang);
    let u0 = 1e9,
      u1 = -1e9,
      v0 = 1e9,
      v1 = -1e9;
    for (let j = 0; j < n; j++) {
      const dx = poly[2 * j] - cx,
        dy = poly[2 * j + 1] - cy,
        u = dx * ca + dy * sa,
        v = -dx * sa + dy * ca;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const PL = big ? 18 : 13,
      PW = big ? 13 : 10,
      G = big ? 5 : 4;
    const cells = [];
    for (let u = u0 + PL / 2 + 2; u < u1 - PL / 2; u += PL + G)
      for (let v = v0 + PW / 2 + 2; v < v1 - PW / 2; v += PW + G) {
        const x = cx + u * ca - v * sa,
          y = cy + u * sa + v * ca;
        let ok = true;
        for (const [a, b] of [
          [0, 0],
          [0.5, 0.5],
          [-0.5, 0.5],
          [0.5, -0.5],
          [-0.5, -0.5],
          [0, 0.5],
          [0, -0.5],
          [0.5, 0],
          [-0.5, 0]
        ]) {
          const xx = x + a * PL * ca - b * PW * sa,
            yy = y + a * PL * sa + b * PW * ca;
          if (!pip(poly, xx, yy) || inBld(xx, yy, 1.5)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue; // keep the footpaths through the zoo open
        let path = false;
        eachB2(SBUCK, x - PL, y - PL, x + PL, y + PL, (w, k) => {
          if (path) return;
          const wy = WAYS[w];
          const a = wy.nodes[k],
            c = wy.nodes[k + 1];
          if (segD(x, y, NX[a], NY[a], NX[c], NY[c]) < PW / 2 + 0.5) path = true;
        });
        if (path) continue;
        cells.push({ x, y, d: Math.hypot(u, v) });
      }
    cells.sort((a, b) => a.d - b.d);
    const list = big ? ZOO_BIG : ZOO_PET;
    cells.forEach((cl, i) => {
      if (i >= list.length) return;
      const [sp, cnt, pool] = list[i];
      const p = {
        x: cl.x,
        y: cl.y,
        ca,
        sa,
        ang,
        L: PL,
        W: PW,
        sp,
        cnt,
        pool: pool || null,
        zoo: e[4] || 'Zoo',
        live: false,
        id: ZOOPENS.length,
        seed: h32(cl.x | 0, cl.y | 0, 3)
      };
      ZOOPENS.push(p);
      badd(ZOOPB, bkey(p.x, p.y), p);
      const C = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
        [-1, -1]
      ].map(([a, b]) => [
        p.x + ((a * PL) / 2) * ca - ((b * PW) / 2) * sa,
        p.y + ((a * PL) / 2) * sa + ((b * PW) / 2) * ca
      ]);
      // fence with a gate gap on one long side
      const pts = [];
      for (const q of C) pts.push(q[0], q[1]);
      const gx0 = p.x + -1.2 * ca - (PW / 2) * sa,
        gy0 = p.y + -1.2 * sa + (PW / 2) * ca;
      const f1 = new Float32Array([
          pts[6],
          pts[7],
          pts[8],
          pts[9],
          pts[0],
          pts[1],
          pts[2],
          pts[3],
          pts[4],
          pts[5],
          p.x + 1.2 * ca - (PW / 2) * sa,
          p.y + 1.2 * sa + (PW / 2) * ca
        ]),
        f2 = new Float32Array([gx0, gy0, pts[6], pts[7]]);
      for (const f of [f1, f2]) {
        const ii = RBARS.length;
        RBARS.push({ k: 6, p: f });
        const seen = new Set();
        for (let q = 0; q < f.length; q += 2) {
          const kk = bkey(f[q], f[q + 1]);
          if (!seen.has(kk)) {
            seen.add(kk);
            badd(BARB, kk, ii);
          }
        }
        nf++;
      }
    });
  }
  if (ZOOPENS.length) {
    let rt = 0;
    for (let t = 0; t < NT; t++) {
      if (TREES.s[t] === 3) continue;
      const x = TREES.x[t],
        y = TREES.y[t];
      let hit = false;
      zooEach(x - 14, y - 14, x + 14, y + 14, p => {
        if (!hit && inPen(p, x, y, -1)) hit = true;
      });
      if (hit) {
        TREES.s[t] = 3;
        rt++;
      }
    }
    console.log('zoo trees cleared', rt);
  }
  if (ZOOPENS.length) {
    console.log('zoo pens', ZOOPENS.length, 'fences', nf);
    CACHE.clear();
    cachePx = 0;
  }
}
function drawZooGround(c, k, X0, Y0, X1, Y1, P) {
  if (!ZOOPENS.length || k < 0.2) return;
  zooEach(X0 - 20, Y0 - 20, X1 + 20, Y1 + 20, p => {
    const z = hAt(p.x, p.y) + 0.05;
    const quad = (L, W, col) => {
      c.fillStyle = col;
      c.beginPath();
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
      ].forEach(([a, b], i) => {
        const q = P(
          p.x + ((a * L) / 2) * p.ca - ((b * W) / 2) * p.sa,
          p.y + ((a * L) / 2) * p.sa + ((b * W) / 2) * p.ca,
          z
        );
        i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]);
      });
      c.closePath();
      c.fill();
    };
    const mud = p.sp === 'pig' || p.sp === 'hen',
      sand = p.sp === 'fox' || p.sp === 'mink' || p.sp === 'rabbit';
    quad(
      p.L,
      p.W,
      N_(
        SNOWMIX(
          mud ? [134, 108, 78] : sand ? [176, 160, 124] : p.pool === 'pool' ? [186, 186, 182] : [110, 150, 84]
        ),
        1
      )
    );
    if (!mud && !sand && !p.pool && k >= 0.6) {
      c.fillStyle = N_(SNOWMIX([138, 118, 86]), 1);
      for (let q = 0; q < 6; q++) {
        const u = (h32(p.id, q, 1) - 0.5) * (p.L - 3),
          v = (h32(p.id, q, 2) - 0.5) * (p.W - 3);
        const s = P(p.x + u * p.ca - v * p.sa, p.y + u * p.sa + v * p.ca, z);
        c.fillRect(
          Math.round(s[0]),
          Math.round(s[1]),
          Math.max(1, Math.round(k * 1.6)),
          Math.max(1, Math.round(k * 0.8))
        );
      }
    }
    if (p.pool === 'pool') {
      quad(p.L - 4.4, p.W - 4.4, N_([60, 140, 180], 1));
      if (k >= 0.8) {
        const s = P(p.x + (p.L / 2 - 3) * p.ca, p.y + (p.L / 2 - 3) * p.sa, z);
        c.fillStyle = N_([150, 146, 140], 1);
        c.fillRect(
          Math.round(s[0] - k * 1.4),
          Math.round(s[1] - k * 0.6),
          Math.round(k * 2.8),
          Math.max(1, Math.round(k * 1.2))
        );
      }
    }
    if (p.pool === 'pond') {
      const a = p.L / 2 - 2.2,
        b = p.W / 2 - 2.2;
      c.fillStyle = N_([72, 124, 150], 1);
      c.beginPath();
      for (let q = 0; q < 20; q++) {
        const t = (q / 20) * 6.283,
          u = Math.cos(t) * a,
          v = Math.sin(t) * b;
        const s = P(p.x + u * p.ca - v * p.sa, p.y + u * p.sa + v * p.ca, z);
        q ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
      }
      c.closePath();
      c.fill();
    }
    if (k >= 0.8 && !p.pool) {
      // a feed trough and a small shelter for the animals
      const tq = (u, v, L, W, zz, h, col) => {
        const pts = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1]
        ].map(([a, b]) =>
          P(
            p.x + (u + (a * L) / 2) * p.ca - (v + (b * W) / 2) * p.sa,
            p.y + (u + (a * L) / 2) * p.sa + (v + (b * W) / 2) * p.ca,
            zz + h
          )
        );
        c.fillStyle = col;
        c.beginPath();
        pts.forEach((s, i) => (i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1])));
        c.closePath();
        c.fill();
      };
      tq(p.L / 2 - 3, -p.W / 2 + 1.4, 3, 0.8, z, 0, N_([104, 78, 52], 1));
      tq(p.L / 2 - 3, -p.W / 2 + 1.4, 3, 0.8, z, 0.5, N_([150, 120, 80], 1));
      if (p.sp !== 'horse' && p.sp !== 'cow' && p.sp !== 'reindeer') {
        tq(-p.L / 2 + 2.4, -p.W / 2 + 2, 3.6, 3, z, 0, N_([90, 60, 44], 1));
        tq(-p.L / 2 + 2.4, -p.W / 2 + 2, 3.6, 3, z, 1.7, N_([160, 52, 40], 1));
      }
    }
  });
}
function zooSpawn(vr) {
  if (!ZOOPENS.length) return;
  for (const p of ZOOPENS) {
    if (p.live) continue;
    if (p.x < vr[0] - 120 || p.x > vr[2] + 120 || p.y < vr[1] - 120 || p.y > vr[3] + 120) continue;
    p.live = true;
    for (let i = 0; i < p.cnt; i++) {
      const water = p.pool && (p.sp === 'seal' || p.sp === 'duck');
      const [x, y] = penPt(p, water);
      const a = mkAnimal(p.sp, x, y, !!water, null);
      a.pen = p;
      a.hx = p.x;
      a.hy = p.y;
      a.fly = false;
      a.z = 0;
      if (SPC[p.sp].mv === 'fly' || a.state === 'swim' || a.state === 'stand') {
        a.state = 'rest';
        a.t = R() * 3;
      }
      animals.push(a);
    }
  }
}
