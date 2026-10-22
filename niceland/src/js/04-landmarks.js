/**
 * Landmarks
 *
 * Hand-set heights and materials for landmarks such as Hallgrímskirkja, Harpa and Perlan.
 *
 * Functions: fitCircle, setupPerlan
 * State and constants: LANDMARKS, PERLAN_TANK_H, PERLAN_TOP
 */

// w wall colour, r roof colour (only used where no aerial colour), h height, rs roof shape, tw tower {at:'N'|'S'|'E'|'W', s:size, h:height, sp:spire height}
const LANDMARKS = {
  'Alþingishúsið': { w: [104, 102, 98], r: [52, 54, 58], h: 11, rs: 'hip', rp: 0.45 },
  'Dómkirkjan': {
    w: [238, 236, 228],
    r: [56, 58, 62],
    h: 8,
    rs: 'gable',
    rp: 0.8,
    tw: { at: 'W', s: 4.2, h: 12, sp: 6 }
  },
  'Fríkirkjan í Reykjavík': {
    w: [244, 242, 236],
    h: 9,
    rs: 'gable',
    rp: 0.9,
    tw: { at: 'W', s: 4.6, h: 15, sp: 10 }
  },
  'Landakotskirkja': {
    w: [178, 178, 172],
    r: [96, 100, 106],
    h: 15,
    rs: 'gable',
    rp: 0.9,
    tw: { at: 'N', s: 8, h: 31 }
  },
  'Stjórnarráð Íslands': { w: [240, 238, 232], r: [46, 48, 52], h: 8, rs: 'gable', rp: 0.75 },
  'Menntaskólinn í Reykjavík': { w: [244, 242, 234], r: [52, 54, 58], h: 10, rs: 'gable', rp: 0.7 },
  'Kvennaskólinn í Reykjavík (Aðalbygging)': { w: [236, 224, 196], h: 10 },
  'Þjóðleikhúsið': { w: [84, 86, 88], r: [70, 72, 76], h: 18, rs: 'hip', rp: 0.35, glassless: 1 },
  'Safnahúsið': { w: [236, 232, 222], r: [52, 54, 58], h: 13, rs: 'hip', rp: 0.4 },
  'Ráðhús Reykjavíkur': { w: [206, 206, 202], r: [104, 112, 96], h: 11, rs: 'flat', glass: 1 },
  'Hótel Borg': { w: [236, 230, 212], h: 20, rs: 'flat' },
  'Iðnó': { w: [242, 240, 234], h: 8 },
  'Hafnarhúsið': { w: [224, 222, 216], rs: 'flat' },
  'Listasafn Íslands': { w: [236, 234, 228] },
  'Sundhöll Reykjavíkur': { w: [238, 236, 230], h: 12, rs: 'flat' },
  'Listasafn Einars Jónssonar': { w: [210, 206, 196], h: 11, rs: 'flat' },
  'Norræna húsið': { w: [244, 244, 240], r: [52, 86, 138], rs: 'mono', h: 7 },
  'Kjarvalsstaðir': { w: [196, 194, 188], rs: 'flat', h: 7, glass: 1 },
  'Laugardalshöll': { w: [236, 236, 232], rs: 'flat', h: 15 },
  'Háteigskirkja': { w: [246, 246, 242], h: 9, tw: { at: 'W', s: 5, h: 14, sp: 12 } },
  'Neskirkja': { w: [214, 214, 208], rs: 'mono', h: 10 },
  'Langholtskirkja': { w: [222, 222, 218], h: 12 },
  'Seltjarnarneskirkja': { w: [232, 232, 228], h: 9 },
  'Kópavogskirkja': { w: [238, 238, 234], h: 14, rs: 'gable', rp: 1.2 },
  'Gróttuviti': { w: [246, 246, 242], r: [176, 52, 44] },
  'Bessastaðir': { w: [244, 242, 236], r: [170, 48, 40], h: 9, rs: 'gable', rp: 0.8 },
  'Bessastaðakirkja': {
    w: [244, 242, 236],
    r: [170, 48, 40],
    h: 8,
    rs: 'gable',
    rp: 0.9,
    tw: { at: 'W', s: 4.5, h: 13, sp: 5 }
  },
  'Turninn': { w: [72, 92, 112], glass: 1, rs: 'flat', onlyTall: 1 },
  'Akureyrarkirkja': { w: [226, 226, 220], r: [70, 74, 80], h: 16, rs: 'gable', rp: 0.8 },
  'Menningarhúsið Hof': { w: [66, 66, 66], rs: 'flat' },
  'Ráðhús Akureyrar': { w: [232, 230, 224], rs: 'flat' },
  'Viðeyjarstofa': { w: [236, 232, 222], r: [52, 54, 58], h: 8, rs: 'gable', rp: 0.8 },
  'Viðeyjarkirkja': { w: [236, 232, 222], r: [52, 54, 58], h: 6, rs: 'gable', rp: 0.9 },
  'Höfði': { w: [244, 242, 236], r: [70, 74, 82], h: 9, rs: 'gable', rp: 0.8 }
};

/* Perlan. OpenStreetMap maps the six hot-water tanks as six buildings round the central hall, each one cut off where
   it meets the hall, so on their own they come out as low crescents. Here they become part of Perlan itself: a full
   round tank is fitted to the outer arc of each outline, and drawPerlan draws the hall, the tanks and the glass dome
   that rests on them as one landmark. The tanks hold about 4 million litres each; with the mapped footprints that
   makes them about 14 m tall, and the top of the dome is 25.7 m above the ground. */
const PERLAN_TANK_H = 14,
  PERLAN_TOP = 25.7;
// least-squares circle through points [[x, y], …]: [cx, cy, r]
function fitCircle(P) {
  let sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0,
    sxz = 0,
    syz = 0,
    sz = 0;
  const n = P.length,
    mx = P.reduce((a, p) => a + p[0], 0) / n,
    my = P.reduce((a, p) => a + p[1], 0) / n;
  for (const [x0, y0] of P) {
    const x = x0 - mx,
      y = y0 - my,
      z = x * x + y * y;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
    sxz += x * z;
    syz += y * z;
    sz += z;
  }
  // solve [sxx sxy sx; sxy syy sy; sx sy n] [D E F] = -[sxz syz sz]
  const A = [
      [sxx, sxy, sx, -sxz],
      [sxy, syy, sy, -syz],
      [sx, sy, n, -sz]
    ],
    m = 3;
  for (let i = 0; i < m; i++) {
    let p = i;
    for (let r = i + 1; r < m; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    if (Math.abs(A[i][i]) < 1e-9) return null;
    for (let r = 0; r < m; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c <= m; c++) A[r][c] -= f * A[i][c];
    }
  }
  const D = A[0][3] / A[0][0],
    E = A[1][3] / A[1][1],
    F = A[2][3] / A[2][2],
    cx = -D / 2,
    cy = -E / 2,
    r2 = cx * cx + cy * cy - F;
  return r2 > 0 ? [cx + mx, cy + my, Math.sqrt(r2)] : null;
}
function setupPerlan() {
  const b = B.find(o => o.sp === 3);
  if (!b || b.tanks) return;
  const tanks = [];
  for (const o of B) {
    if (o === b || o.sp || o.n < 12 || o.area < 120 || o.area > 700) continue;
    const d0 = Math.hypot(o.cx - b.cx, o.cy - b.cy);
    if (d0 > b.r + 25) continue;
    // the outline's far side from the hall is the tank's own wall
    const pts = [];
    for (let j = 0; j < o.n; j++) {
      const x = o.poly[2 * j],
        y = o.poly[2 * j + 1];
      if (Math.hypot(x - b.cx, y - b.cy) >= d0) pts.push([x, y]);
    }
    if (pts.length < 5) continue;
    const t = fitCircle(pts);
    if (!t || t[2] < 5 || t[2] > 16) continue;
    tanks.push(t);
    o.hide = 1;
  }
  if (tanks.length < 4) return;
  let ring = 0,
    tr = 0,
    R = 0;
  for (const t of tanks) {
    const d = Math.hypot(t[0] - b.cx, t[1] - b.cy);
    ring += d / tanks.length;
    tr += t[2] / tanks.length;
    R = Math.max(R, d + t[2]);
  }
  b.tanks = tanks;
  b.ringR = ring;
  b.tankR = tr;
  b.hallPoly = b.poly;
  // the record's footprint becomes a circle round the whole building, so bounds, picking and caches hold all of it
  const P = new Float32Array(ngon(b.cx, b.cy, R + 0.5, 36));
  let minx = 1e12,
    maxx = -1e12,
    miny = 1e12,
    maxy = -1e12;
  for (let j = 0; j < P.length; j += 2) {
    minx = Math.min(minx, P[j]);
    maxx = Math.max(maxx, P[j]);
    miny = Math.min(miny, P[j + 1]);
    maxy = Math.max(maxy, P[j + 1]);
  }
  Object.assign(b, {
    poly: P,
    n: P.length / 2,
    minx,
    maxx,
    miny,
    maxy,
    r: R + 0.5,
    h: PERLAN_TOP,
    obb: null
  });
  b.rr = -1;
  rotB(b);
}
