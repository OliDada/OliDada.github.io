/**
 * Road surfaces and closures
 *
 * Gravel roads, fords, and highland roads closed in winter.
 *
 * Functions: roadCol, shutSeason, checkShut, initRoadExtras, drawShut, drawFords, carSurface
 * State and constants: GRAVC, NFORD, FORDL, FORDB, SHUT, SHUTPTS, SHUTB
 */

/* gravel roads, fords, and highland roads shut for the winter */
const GRAVC = [150, 138, 120];
let NFORD = null,
  FORDL = [],
  FORDB = new Map(),
  SHUT = false,
  SHUTPTS = [];
function roadCol(wy) {
  return wy.sf === 2 && wy.cl <= 6 ? GRAVC : RCOL[wy.cl];
}
function shutSeason() {
  const d = curDOY();
  return !(d >= 172 && d <= 258);
} // F-roads open roughly late June to mid-September
function checkShut() {
  const s = shutSeason();
  if (s === SHUT) return;
  SHUT = s;
  if (GD) {
    GD = buildGraph(true);
  }
}
function initRoadExtras() {
  FORDB = new Map();
  for (const n of FORDL) badd(FORDB, bkey(NX[n], NY[n]), n);
  const openN = new Uint8Array(NODE_N);
  for (const wy of WAYS) {
    if (wy.cl > 6 || wy.fl & 1) continue;
    for (const n of wy.nodes) openN[n] = 1;
  }
  SHUTPTS = [];
  for (const wy of WAYS) {
    if (wy.cl > 6 || !(wy.fl & 1) || wy.nodes.length < 2) continue;
    const ns = wy.nodes;
    for (const [e, f] of [
      [0, 1],
      [ns.length - 1, ns.length - 2]
    ]) {
      const n = ns[e],
        m = ns[f];
      if (!openN[n]) continue;
      const dx = NX[m] - NX[n],
        dy = NY[m] - NY[n],
        l = Math.hypot(dx, dy) || 1;
      const o = Math.min(6, l * 0.4);
      SHUTPTS.push({
        x: NX[n] + (dx / l) * o,
        y: NY[n] + (dy / l) * o,
        ux: dx / l,
        uy: dy / l,
        w: RWW(wy),
        ref: ''
      });
    }
  }
  const B2 = new Map();
  for (const p of SHUTPTS) badd(B2, bkey(p.x, p.y), p);
  SHUTB = B2;
}
let SHUTB = new Map();
function drawShut() {
  if (!SHUT || !SHUTPTS.length || K < 0.45) return;
  const k = K,
    vr = viewRect(20, 600);
  eachB(SHUTB, vr[0], vr[1], vr[2], vr[3], p => {
    const nx = -p.uy,
      ny = p.ux,
      hw = p.w / 2 + 0.3,
      z = hAt(p.x, p.y);
    const A = sp_(p.x + nx * hw, p.y + ny * hw, z),
      B = sp_(p.x - nx * hw, p.y - ny * hw, z);
    if (Math.max(A[0], B[0]) < -10 || Math.min(A[0], B[0]) > VW + 10 || A[1] < -30 || A[1] > VH + 30) return;
    const ph = 1.1;
    ctx.fillStyle = C_([80, 80, 84], 1);
    for (const P of [A, B])
      ctx.fillRect(
        Math.round(P[0]),
        Math.round(P[1] - ph * k),
        Math.max(1, Math.round(k * 0.25)),
        Math.round(ph * k)
      );
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t0 = i / n,
        t1 = (i + 1) / n,
        a = sp_(p.x + nx * hw * (1 - 2 * t0), p.y + ny * hw * (1 - 2 * t0), z + ph),
        b = sp_(p.x + nx * hw * (1 - 2 * t1), p.y + ny * hw * (1 - 2 * t1), z + ph);
      ctx.strokeStyle = C_(i % 2 ? [245, 245, 245] : [210, 40, 40], 1);
      ctx.lineWidth = Math.max(1, k * 0.3);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    if (k >= 1.2) {
      const s = sp_(p.x + nx * (hw + 0.6), p.y + ny * (hw + 0.6), z),
        w = Math.max(4, Math.round(k * 2.2)),
        h = Math.max(3, Math.round(k * 1.4)),
        top = Math.round(s[1] - k * 2.6);
      ctx.fillStyle = C_([80, 80, 84], 1);
      ctx.fillRect(Math.round(s[0]), top, 1, Math.round(k * 2.6));
      ctx.fillStyle = C_([210, 40, 40], 1);
      ctx.fillRect(Math.round(s[0] - w / 2), top - h, w, h);
      ctx.fillStyle = C_([250, 250, 250], 1);
      ctx.fillRect(Math.round(s[0] - w / 2) + 1, top - h + 1, w - 2, h - 2);
      if (k >= 2.5) {
        ctx.fillStyle = C_([200, 30, 30], 1);
        ctx.font = 'bold ' + Math.max(5, Math.round(k * 0.75)) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LOKAÐ', s[0], top - h / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }
  });
}
function drawFords(c, k, x0, y0, x1, y1, ox, oy) {
  if (!FORDL.length || k < 0.12) return;
  const P = (x, y, z) => [PXw(x, y) * k - ox, (PYw(x, y) - z) * k - oy];
  eachB(FORDB, x0 - 10, y0 - 10, x1 + 10, y1 + 10, n => {
    const x = NX[n],
      y = NY[n];
    if (x < x0 || x >= x1 || y < y0 || y >= y1) return;
    const s = P(x, y, hAt(x, y) + 0.05);
    c.fillStyle = N_(SNOWMIX([84, 124, 150]), 1);
    c.beginPath();
    c.ellipse(s[0], s[1], Math.max(1.5, k * 6), Math.max(1, k * 3), 0, 0, 7);
    c.fill();
    if (k >= 0.9) {
      c.strokeStyle = N_([200, 226, 238], 1);
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(s[0] - k, s[1], k * 2.6, k * 1.1, 0, 0, 7);
      c.stroke();
    }
  });
}
function carSurface(a, dt) {
  const wy = a.wi >= 0 ? WAYS[a.wi] : null;
  if (!wy) return;
  if (
    wy.sf === 2 &&
    K >= 0.3 &&
    R() < dt * 7 &&
    wxW('rain') + wxW('storm') + wxW('snow') < 0.5 &&
    snowAcc < 0.15 &&
    SP.cover <= 0 &&
    onScr(a.x, a.y, 30)
  ) {
    const z = hAt(a.x, a.y) + (a.dz || 0);
    addP({
      t: 1,
      x: a.x - a.vx * a.len * 0.55,
      y: a.y - a.vy * a.len * 0.55,
      z: z + 0.4,
      vx: -a.vx * 1.5 + (R() - 0.5),
      vy: -a.vy * 1.5 + (R() - 0.5),
      vz: 0.5 + R() * 0.8,
      life: 1.6 + R(),
      max: 2.6,
      c: [184, 168, 140],
      s: 3.2,
      a: 0.6
    });
  }
  if (a.fordT > 0) {
    a.fordT -= dt;
    if (K >= 0.3 && R() < dt * 40 && onScr(a.x, a.y, 30)) {
      const z = hAt(a.x, a.y);
      for (const sd of [-1, 1])
        addP({
          t: 6,
          x: a.x - a.vy * sd * a.wid * 0.5,
          y: a.y + a.vx * sd * a.wid * 0.5,
          z: z + 0.3,
          vx: -a.vy * sd * 2.5 + (R() - 0.5),
          vy: a.vx * sd * 2.5 + (R() - 0.5),
          vz: 2 + R() * 2.5,
          life: 0.7,
          max: 0.7,
          s: 1.4
        });
    }
  }
}
