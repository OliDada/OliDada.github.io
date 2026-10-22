/**
 * Harbour and boats
 *
 * Whale-watching boats, trawlers and ferries; sea routes found with A* over the water.
 *
 * Functions: initBoats, seaClear, seaRoute, boatRuns, boatPos, stepBoats, drawBoats, boatCard
 * State and constants: LL, BLINES, BOATS, BOATS_OK, isSeaAt
 */

const LL = (la, lo) => [(lo + 21.89) * 111320 * Math.cos((64.124 * Math.PI) / 180), (64.124 - la) * 110574];
const BLINES = {
  whale: {
    n: 2,
    name: 'Hvalaskoðun',
    en: 'Whale-watching boat',
    L: 24,
    W: 6.5,
    hull: [236, 236, 232],
    cab: [44, 62, 86],
    v: 7,
    hours: [[9, 21]],
    sum: [[8, 22]],
    wait: 240,
    linger: 420,
    path: [
      [64.15167, -21.9421],
      [64.152, -21.9394],
      [64.15233, -21.93669],
      [64.1528, -21.933],
      [64.157, -21.933],
      [64.17, -21.965],
      [64.185, -22.025],
      [64.198, -22.085]
    ]
  },
  trawl: {
    n: 2,
    name: 'Togari',
    en: 'Fishing trawler',
    L: 58,
    W: 13,
    hull: [34, 52, 74],
    cab: [236, 236, 230],
    v: 6,
    hours: [[0, 24]],
    wait: 600,
    linger: 0,
    far: 1,
    path: [
      [64.1532, -21.9465],
      [64.15233, -21.93669],
      [64.1528, -21.933],
      [64.158, -21.934],
      [64.175, -21.99],
      [64.2, -22.09],
      [64.23, -22.22]
    ]
  },
  ferry: {
    n: 1,
    name: 'Viðeyjarferjan',
    en: 'Viðey ferry',
    L: 20,
    W: 5.5,
    hull: [236, 236, 232],
    cab: [176, 52, 44],
    v: 4.5,
    hours: [[10, 17.5]],
    win: 'wkd',
    wait: 150,
    linger: 0,
    path: [
      [64.15643, -21.86668],
      [64.1606, -21.85547],
      [64.16082, -21.85515],
      [64.16106, -21.85537]
    ]
  }
};
let BOATS = [],
  BOATS_OK = false;
function initBoats() {
  BOATS = [];
  if (!BLINES.herjolfur) initFerries();
  for (const k in BLINES) {
    const Ln = BLINES[k];
    Ln.P = Ln.path.map(p => LL(p[0], p[1])); // keep waypoints on open water
    for (const p of Ln.P) {
      let ok = false;
      for (let r = 0; r < 200 && !ok; r += 10)
        for (let q = 0; q < 12 && !ok; q++) {
          const a = (q / 12) * 6.283,
            x = p[0] + Math.cos(a) * r,
            y = p[1] + Math.sin(a) * r,
            c = cellAt(x, y);
          if (c >= 0 && gTfast(c) === SEA) {
            if (r) {
              p[0] = x;
              p[1] = y;
            }
            ok = true;
          }
        }
    }
    {
      const Q = [Ln.P[0]];
      for (let i = 1; i < Ln.P.length; i++) {
        const r = seaRoute(Ln.P[i - 1], Ln.P[i]);
        for (let q = 1; q < r.length; q++) Q.push(r[q]);
      }
      Ln.P = Q;
    }
    let cum = [0];
    for (let i = 1; i < Ln.P.length; i++)
      cum.push(cum[i - 1] + Math.hypot(Ln.P[i][0] - Ln.P[i - 1][0], Ln.P[i][1] - Ln.P[i - 1][1]));
    Ln.cum = cum;
    Ln.len = cum[cum.length - 1];
    for (let i = 0; i < Ln.n; i++)
      BOATS.push({
        boat: 1,
        line: k,
        Ln,
        st: 'dock',
        t: Ln.wait * (i + 0.3),
        s: 0,
        dir: 1,
        x: Ln.P[0][0],
        y: Ln.P[0][1],
        hd: 0,
        v: 0,
        id: i,
        pax: 0,
        name: Ln.name + (Ln.n > 1 ? ' ' + (i + 1) : '')
      });
  }
  BOATS_OK = true;
}
const isSeaAt = (x, y) => {
  const c = cellAt(x, y);
  return c >= 0 && gTfast(c) === SEA;
};
function seaClear(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = Math.ceil(L / 4);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (!isSeaAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
}
/* a way across open water between two points: A* on a grid of sea cells, then pulled straight where the water allows */
function seaRoute(A, B) {
  if (seaClear(A, B)) return [A, B];
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  let cs = L > 3000 ? 12 : L > 800 ? 7 : 4;
  const pad = Math.max(300, L * 0.5);
  let cs2 = cs;
  {
    const w0 = Math.abs(B[0] - A[0]) + 2 * pad,
      h0 = Math.abs(B[1] - A[1]) + 2 * pad;
    if ((w0 * h0) / (cs * cs) > 3.5e6) cs2 = Math.sqrt((w0 * h0) / 3.5e6);
  }
  cs = cs2;
  const x0 = Math.min(A[0], B[0]) - pad,
    y0 = Math.min(A[1], B[1]) - pad,
    W = Math.ceil((Math.abs(B[0] - A[0]) + 2 * pad) / cs) + 1,
    H = Math.ceil((Math.abs(B[1] - A[1]) + 2 * pad) / cs) + 1;
  if (W * H > 4e6) return [A, B];
  const ok = new Uint8Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) ok[i + j * W] = isSeaAt(x0 + i * cs, y0 + j * cs) ? 1 : 0;
  const id = (x, y) =>
    Math.max(0, Math.min(W - 1, Math.round((x - x0) / cs))) +
    Math.max(0, Math.min(H - 1, Math.round((y - y0) / cs))) * W;
  const s = id(A[0], A[1]),
    t = id(B[0], B[1]);
  ok[s] = 1;
  ok[t] = 1;
  const g = new Float64Array(W * H).fill(1e30),
    par = new Int32Array(W * H).fill(-1),
    done = new Uint8Array(W * H),
    tx = t % W,
    ty = (t / W) | 0;
  const heap = [[0, s]];
  g[s] = 0;
  const D = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414]
  ];
  let it = 0;
  const push = e => {
    heap.push(e);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= e[0]) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = e;
  };
  const pop = () => {
    const r = heap[0],
      l = heap.pop();
    if (heap.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++;
        if (heap[c][0] >= l[0]) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = l;
    }
    return r;
  };
  while (heap.length && it++ < 2e6) {
    const [f, n] = pop();
    if (n === t) break;
    if (done[n]) continue;
    done[n] = 1;
    const x = n % W,
      y = (n / W) | 0;
    for (const [dx, dy, w] of D) {
      const X = x + dx,
        Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const m = X + Y * W;
      if (!ok[m]) continue;
      const ng = g[n] + w;
      if (ng < g[m]) {
        g[m] = ng;
        par[m] = n;
        push([ng + Math.hypot(X - tx, Y - ty), m]);
      }
    }
  }
  if (par[t] < 0) return [A, B];
  const raw = [];
  for (let n = t; n >= 0; n = par[n]) {
    raw.push([x0 + (n % W) * cs, y0 + ((n / W) | 0) * cs]);
    if (n === s) break;
  }
  raw.reverse();
  raw[0] = A;
  raw[raw.length - 1] = B;
  const out = [raw[0]];
  let i = 0;
  while (i < raw.length - 1) {
    let j = raw.length - 1;
    while (j > i + 1 && !seaClear(raw[i], raw[j])) j--;
    out.push(raw[j]);
    i = j;
  }
  return out;
}
function boatRuns(Ln) {
  const h = (gameMin % 1440) / 60,
    d = dayOfWeek(),
    sum = SEAS === 'summer';
  if (Ln.win === 'wkd' && !sum && d !== 0 && d !== 6) return false;
  const H = sum && Ln.sum ? Ln.sum : Ln.hours;
  return H.some(([a, b]) => h >= a && h < b);
}
function boatPos(Ln, s) {
  const c = Ln.cum;
  let i = 1;
  while (i < c.length - 1 && c[i] < s) i++;
  const t = Math.max(0, Math.min(1, (s - c[i - 1]) / (c[i] - c[i - 1] || 1)));
  const A = Ln.P[i - 1],
    B2 = Ln.P[i];
  return [A[0] + (B2[0] - A[0]) * t, A[1] + (B2[1] - A[1]) * t, Math.atan2(B2[1] - A[1], B2[0] - A[0])];
}
function stepBoats(dt) {
  if (!BOATS_OK) return;
  dt = Math.min(dt, 0.5);
  for (const b of BOATS) {
    const Ln = b.Ln;
    if (Ln.sched) {
      stepFerry(b, dt);
      continue;
    }
    b.t -= dt;
    if (b.st === 'dock') {
      b.v = 0;
      if (b.t <= 0) {
        if (boatRuns(Ln)) {
          b.st = 'out';
          b.s = 0;
          b.pax =
            b.line === 'trawl' ? 14 + ((R() * 6) | 0) : Math.round(20 + R() * (SEAS === 'summer' ? 90 : 40));
        } else b.t = 20;
      }
    } else if (b.st === 'out' || b.st === 'back') {
      const tv = Ln.v * (b.s < 120 || b.s > Ln.len - 120 ? 0.45 : 1);
      b.v += (tv - b.v) * Math.min(1, dt * 0.4);
      b.s += b.v * dt * (b.st === 'out' ? 1 : -1);
      if (b.st === 'out' && b.s >= Ln.len) {
        b.s = Ln.len;
        if (Ln.far) {
          b.st = 'away';
          b.t = Ln.wait * 2;
        } else if (Ln.linger) {
          b.st = 'linger';
          b.t = Ln.linger;
          b.ang = R() * 6.3;
        } else {
          b.st = 'dock2';
          b.t = Ln.wait * 0.6;
        }
      }
      if (b.st === 'back' && b.s <= 0) {
        b.s = 0;
        b.st = 'dock';
        b.t = Ln.wait;
        b.pax = 0;
      }
      const p = boatPos(Ln, b.s);
      b.x = p[0];
      b.y = p[1];
      const hd = p[2] + (b.st === 'back' ? Math.PI : 0);
      let dh = hd - b.hd;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      b.hd += dh * Math.min(1, dt * 0.8);
    } else if (b.st === 'linger') {
      // slow circles out on Faxaflói, drawn towards a minke whale if one surfaces nearby
      let wh = null,
        wd = 600;
      for (const a of animals)
        if (!a.dead && a.sp === 'whale') {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < wd) {
            wd = d;
            wh = a;
          }
        }
      const tx = wh
          ? wh.x - Math.cos(b.hd) * 60
          : Ln.P[Ln.P.length - 1][0] + Math.cos(time * 0.02 + b.id) * 250,
        ty = wh ? wh.y - Math.sin(b.hd) * 60 : Ln.P[Ln.P.length - 1][1] + Math.sin(time * 0.02 + b.id) * 250;
      const want = Math.atan2(ty - b.y, tx - b.x);
      let dh = want - b.hd;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      b.hd += Math.max(-0.12 * dt, Math.min(0.12 * dt, dh));
      b.v += ((wh && wd < 120 ? 0.8 : 2.4) - b.v) * Math.min(1, dt * 0.3);
      const nx = b.x + Math.cos(b.hd) * b.v * dt,
        ny = b.y + Math.sin(b.hd) * b.v * dt,
        c = cellAt(nx, ny);
      if (c >= 0 && gTfast(c) === SEA) {
        b.x = nx;
        b.y = ny;
      } else b.hd += 1;
      b.watch = wh && wd < 200;
      if (b.t <= 0) {
        b.st = 'return';
      }
    } else if (b.st === 'return') {
      // head back to the end of the route, then follow it home
      const E = Ln.P[Ln.P.length - 1],
        d = Math.hypot(E[0] - b.x, E[1] - b.y);
      const want = Math.atan2(E[1] - b.y, E[0] - b.x);
      let dh = want - b.hd;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      b.hd += Math.max(-0.2 * dt, Math.min(0.2 * dt, dh));
      b.v += (Ln.v - b.v) * Math.min(1, dt * 0.3);
      b.x += Math.cos(b.hd) * b.v * dt;
      b.y += Math.sin(b.hd) * b.v * dt;
      if (d < 30) {
        b.st = 'back';
        b.s = Ln.len;
      }
    } else if (b.st === 'away') {
      b.v = 0;
      b.hidden = 1;
      if (b.t <= 0) {
        b.hidden = 0;
        b.st = 'back';
        b.s = Ln.len;
        b.hd = boatPos(Ln, Ln.len)[2] + Math.PI;
      }
    } else if (b.st === 'dock2') {
      b.v = 0;
      if (b.t <= 0) {
        b.st = 'back';
        b.pax = Math.round(10 + R() * 40);
      }
    }
    if (b.st !== 'away') b.hidden = 0;
  }
}
function drawBoats() {
  if (!BOATS_OK || K < 0.12) return;
  const k = K;
  for (const b of BOATS) {
    if (b.hidden) continue;
    const Ln = b.Ln;
    const s0 = sp_(b.x, b.y, 0);
    if (s0[0] < -Ln.L * k - 30 || s0[0] > VW + Ln.L * k + 30 || s0[1] < -80 || s0[1] > VH + 80) continue;
    if (Ln.L * k < 5) {
      ctx.fillStyle = C_(Ln.hull, 1);
      ctx.fillRect(Math.round(s0[0]) - 1, Math.round(s0[1]) - 1, Math.max(2, Math.round(Ln.L * k * 0.4)), 2);
      continue;
    }
    const ca = Math.cos(b.hd),
      sa = Math.sin(b.hd),
      hl = Ln.L / 2,
      hw = Ln.W / 2;
    const P = (u, v, z) => {
      const x = b.x + u * ca - v * sa,
        y = b.y + u * sa + v * ca;
      return [PXw(x, y) * k - cx0, (PYw(x, y) - z) * k - cy0];
    };
    const F = (pts, c) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      pts.forEach((q, i) => {
        const s = P(q[0], q[1], q[2]);
        i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
      });
      ctx.closePath();
      ctx.fill();
    };
    // wake
    if (b.v > 1) {
      const w = Math.min(1, b.v / 6);
      ctx.strokeStyle = 'rgba(236,244,250,' + 0.35 * w + ')';
      ctx.lineWidth = Math.max(1, k * 0.5);
      ctx.beginPath();
      let a = P(-hl, -hw * 0.6, 0.05),
        c2 = P(-hl - Ln.L * 1.1, -hw * 2.4, 0.05);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c2[0], c2[1]);
      a = P(-hl, hw * 0.6, 0.05);
      c2 = P(-hl - Ln.L * 1.1, hw * 2.4, 0.05);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c2[0], c2[1]);
      ctx.stroke();
      ctx.fillStyle = 'rgba(240,246,250,' + 0.35 * w + ')';
      const st = P(-hl - 1.5, 0, 0.05);
      ctx.beginPath();
      ctx.ellipse(st[0], st[1], k * hw * 1.2, k * hw * 0.6, 0, 0, 7);
      ctx.fill();
    }
    const fb = b.line === 'trawl' ? 2.6 : 1.6,
      hull = Ln.hull,
      deck = [196, 194, 186];
    const hullPts = [
      [hl, 0],
      [hl * 0.6, hw],
      [-hl, hw * 0.9],
      [-hl, -hw * 0.9],
      [hl * 0.6, -hw]
    ];
    // hull sides (visible ones), then the deck
    for (let i = 0; i < hullPts.length; i++) {
      const a = hullPts[i],
        c2 = hullPts[(i + 1) % hullPts.length];
      // rotated outward normal
      const wx = c2[1] - a[1],
        wy = -(c2[0] - a[0]);
      const gx = wx * ca - wy * sa,
        gy = wx * sa + wy * ca;
      if (faces(gx, gy) <= 0) continue;
      F(
        [
          [a[0], a[1], 0],
          [c2[0], c2[1], 0],
          [c2[0], c2[1], fb],
          [a[0], a[1], fb]
        ],
        C_(hull, wallShade(gx, gy))
      );
    }
    F(
      hullPts.map(p => [p[0], p[1], fb]),
      C_(deck, 1)
    );
    if (b.line === 'trawl') {
      F(
        [
          [-hl * 0.2, -hw * 0.8, fb + 0.1],
          [-hl * 0.95, -hw * 0.8, fb + 0.1],
          [-hl * 0.95, hw * 0.8, fb + 0.1],
          [-hl * 0.2, hw * 0.8, fb + 0.1]
        ],
        C_([150, 90, 60], 1)
      ); // net deck, gantry, bridge forward
      const g1 = P(-hl * 0.9, -hw * 0.7, fb),
        g2 = P(-hl * 0.9, -hw * 0.7, fb + 7),
        g3 = P(-hl * 0.9, hw * 0.7, fb + 7),
        g4 = P(-hl * 0.9, hw * 0.7, fb);
      ctx.strokeStyle = C_([214, 120, 40], 1);
      ctx.lineWidth = Math.max(1, k * 0.4);
      ctx.beginPath();
      ctx.moveTo(g1[0], g1[1]);
      ctx.lineTo(g2[0], g2[1]);
      ctx.lineTo(g3[0], g3[1]);
      ctx.lineTo(g4[0], g4[1]);
      ctx.stroke();
    }
    const c0 = b.line === 'trawl' ? hl * 0.15 : -hl * 0.1,
      c1 = b.line === 'trawl' ? hl * 0.55 : hl * 0.4,
      cw = hw * 0.75,
      ch = b.line === 'trawl' ? 6 : 2.6;
    const box = [
      [c1, -cw],
      [c1, cw],
      [c0, cw],
      [c0, -cw]
    ];
    for (let i = 0; i < 4; i++) {
      const a = box[i],
        c2 = box[(i + 1) % 4];
      const wx = c2[1] - a[1],
        wy = -(c2[0] - a[0]);
      const gx = wx * ca - wy * sa,
        gy = wx * sa + wy * ca;
      if (faces(gx, gy) <= 0) continue;
      F(
        [
          [a[0], a[1], fb],
          [c2[0], c2[1], fb],
          [c2[0], c2[1], fb + ch],
          [a[0], a[1], fb + ch]
        ],
        C_(Ln.cab, wallShade(gx, gy))
      );
      if (k >= 1.2) {
        F(
          [
            [a[0] + (c2[0] - a[0]) * 0.1, a[1] + (c2[1] - a[1]) * 0.1, fb + ch * 0.55],
            [a[0] + (c2[0] - a[0]) * 0.9, a[1] + (c2[1] - a[1]) * 0.9, fb + ch * 0.55],
            [a[0] + (c2[0] - a[0]) * 0.9, a[1] + (c2[1] - a[1]) * 0.9, fb + ch * 0.85],
            [a[0] + (c2[0] - a[0]) * 0.1, a[1] + (c2[1] - a[1]) * 0.1, fb + ch * 0.85]
          ],
          night ? 'rgba(255,220,150,.9)' : C_([40, 60, 80], 1)
        );
      }
    }
    F(
      box.map(p => [p[0], p[1], fb + ch]),
      C_(b.line === 'trawl' ? [226, 226, 220] : [230, 230, 226], 1)
    );
    if (b.line === 'trawl') {
      const m1 = P(c0 + (c1 - c0) * 0.5, 0, fb + ch),
        m2 = P(c0 + (c1 - c0) * 0.5, 0, fb + ch + 8);
      ctx.strokeStyle = C_([60, 60, 64], 1);
      ctx.lineWidth = Math.max(1, k * 0.2);
      ctx.beginPath();
      ctx.moveTo(m1[0], m1[1]);
      ctx.lineTo(m2[0], m2[1]);
      ctx.stroke();
    }
    if (night) {
      const L1 = P(hl * 0.9, 0, fb + 1),
        L2 = P(-hl, 0, fb + 1);
      ctx.fillStyle = '#ff5040';
      ctx.fillRect(Math.round(L1[0]), Math.round(L1[1]), 2, 2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(Math.round(L2[0]), Math.round(L2[1]), 2, 2);
    }
    if (b === follow || b === selected) {
      ctx.strokeStyle = '#c6b3ff';
      ctx.lineWidth = 1;
      const r = Ln.L * k * 0.6 + 4;
      ctx.strokeRect(
        Math.round(s0[0] - r) - 0.5,
        Math.round(s0[1] - r * 0.6) - 0.5,
        Math.round(r * 2),
        Math.round(r * 1.2)
      );
    }
  }
}
function boatCard(b) {
  const Ln = b.Ln;
  if (Ln.sched) {
    const f = ferryCardTxt(b);
    return {
      h:
        '<h3>' +
        b.name +
        '</h3><div class="sub">' +
        Ln.en +
        '</div><div class="act">' +
        f.st +
        '</div>' +
        f.rows +
        (b.st === 'out' || b.st === 'back'
          ? '<div class="row"><span>Passengers</span><span>' + (b.pax || 0) + '</span></div>'
          : '') +
        (follow === b
          ? '<button class="btn" id="unfollow">Stop following</button>'
          : '<button class="btn" id="dofollow">Follow</button>'),
      m: b.name + ' · ' + f.st
    };
  }
  const st =
    b.st === 'dock'
      ? boatRuns(Ln)
        ? 'At the quay, boarding'
        : 'Tied up for the night'
      : b.st === 'out'
        ? b.line === 'trawl'
          ? 'Heading out to the fishing grounds'
          : b.line === 'ferry'
            ? 'Crossing to Viðey'
            : 'Heading out into Faxaflói'
        : b.st === 'linger'
          ? b.watch
            ? 'Whale ahead! Everyone on deck'
            : 'Looking for whales'
          : b.st === 'return' || b.st === 'back'
            ? b.line === 'trawl'
              ? 'Coming home with the catch'
              : b.line === 'ferry'
                ? 'Crossing back to Skarfabakki'
                : 'Heading back to the Old Harbour'
            : b.st === 'dock2'
              ? 'At the Viðey pier'
              : 'Out at sea';
  const home =
    b.line === 'whale' ? 'Gamla höfnin (Old Harbour)' : b.line === 'trawl' ? 'Grandi' : 'Skarfabakki · Viðey';
  return {
    h:
      '<h3>' +
      b.name +
      '</h3><div class="sub">' +
      Ln.en +
      '</div><div class="act">' +
      st +
      '</div><div class="row"><span>' +
      (b.line === 'trawl' ? 'Crew' : 'Passengers') +
      '</span><span>' +
      (b.pax || 0) +
      '</span></div><div class="row"><span>Home port</span><span>' +
      home +
      '</span></div><div class="row"><span>Speed</span><span>' +
      Math.round(b.v * 1.94) +
      ' knots</span></div>' +
      (follow === b
        ? '<button class="btn" id="unfollow">Stop following</button>'
        : '<button class="btn" id="dofollow">Follow</button>'),
    m: b.name + ' · ' + st
  };
}
