/**
 * Shops and brands
 *
 * Chain stores, malls, petrol stations and churches recognised from OSM points (poi.txt).
 *
 * Functions: brandOf, fetchPOI, setBrand, bldAt, rectAt, applyBrands, addFuel, drawCanopyUnder, drawPylon,
 *     drawShopSign
 * State and constants: NEUTRAL, BRANDS, BRANDRE, POI
 */

// colours are approximations of each chain's house colours; signs show the name in plain lettering
const NEUTRAL = { sign: [44, 46, 50], fg: [255, 255, 255] };
const BRANDS = {
  // colours from photos of the stores and published descriptions; chains I could not verify get a plain dark name board
  'Bónus': { sign: [255, 214, 0], fg: [20, 20, 20], wall: [176, 180, 184] },
  'Hagkaup': { sign: [132, 136, 140], fg: [214, 92, 44], wall: [132, 136, 140] },
  'Krónan': { sign: [240, 240, 236], fg: [34, 34, 36], wall: [238, 238, 234] },
  'Nettó': { sign: [62, 76, 74], fg: [240, 240, 236], wall: [52, 76, 70] },
  'Kjörbúðin': NEUTRAL,
  'Krambúðin': NEUTRAL,
  '10-11': NEUTRAL,
  'Vínbúðin': NEUTRAL,
  'Iceland': NEUTRAL,
  'Prís': NEUTRAL,
  'IKEA': { sign: [255, 218, 26], fg: [0, 88, 163], wall: [0, 88, 163], roof: [70, 74, 80], big: 1 },
  'Costco': { sign: [227, 24, 55], fg: [255, 255, 255], wall: [214, 216, 218], band: [0, 93, 170], big: 1 },
  'BYKO': Object.assign({ big: 1 }, NEUTRAL),
  'Húsasmiðjan': Object.assign({ big: 1 }, NEUTRAL),
  'Bauhaus': { sign: [227, 6, 19], fg: [255, 255, 255], big: 1 },
  'Elko': NEUTRAL,
  'Rúmfatalagerinn': NEUTRAL,
  'Lindex': NEUTRAL,
  "Domino's": { sign: [0, 100, 145], fg: [255, 255, 255], band: [226, 24, 54] },
  'Subway': { sign: [0, 140, 60], fg: [255, 200, 0] },
  'Kringlan': { sign: [48, 52, 58], fg: [255, 255, 255], mall: 1, big: 1 },
  'Smáralind': { sign: [48, 52, 58], fg: [255, 255, 255], mall: 1, big: 1 },
  'Holtagarðar': Object.assign({ mall: 1 }, NEUTRAL),
  'Fjörður': Object.assign({ mall: 1 }, NEUTRAL),
  'Glerártorg': Object.assign({ mall: 1 }, NEUTRAL),
  'Hólagarður': Object.assign({ mall: 1 }, NEUTRAL),
  'Eiðistorg': Object.assign({ mall: 1 }, NEUTRAL),
  'Norðurtorg': Object.assign({ mall: 1 }, NEUTRAL),
  'N1': { sign: [218, 37, 29], fg: [255, 255, 255], fuel: 1 },
  'Orkan': { sign: [230, 0, 126], fg: [255, 255, 255], fuel: 1 },
  'Olís': { sign: [0, 132, 61], fg: [255, 210, 0], fuel: 1 },
  'ÓB': { sign: [255, 210, 0], fg: [0, 120, 60], fuel: 1 },
  'Atlantsolía': { sign: [0, 85, 165], fg: [255, 255, 255], band: [218, 37, 29], fuel: 1 },
  'Costco eldsneyti': { sign: [227, 24, 55], fg: [255, 255, 255], band: [0, 93, 170], fuel: 1 }
};
const BRANDRE = new RegExp(
  '^(' +
    Object.keys(BRANDS)
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|') +
    ')',
  'i'
);
function brandOf(str) {
  if (!str) return null;
  const m = str.match(BRANDRE);
  if (!m) return null;
  for (const k in BRANDS) if (k.toLowerCase() === m[1].toLowerCase()) return k;
  return null;
}
let POI = null;
async function fetchPOI() {
  try {
    const r = await fetch('poi.txt');
    if (!r.ok) return;
    const b = atob((await r.text()).trim());
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    POI = JSON.parse(
      await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    );
  } catch (e) {
    console.warn('poi', e);
  }
}
function setBrand(b, k, label) {
  const S = BRANDS[k];
  if (!S || b.sp || b.hk || b.lm) return;
  b.brand = k;
  b.signTxt = (label || k).toUpperCase().replace(' ELDSNEYTI', '');
  if (!S.mall && b.h < 16) b.noWin = 1;
  if (S.wall) b.wallC = S.wall.slice();
  if (S.roof) b.roofC = S.roof.slice();
  b.glass = false;
  b.style = null;
  if (b.rs === 'gable' || b.rs === 'hip') {
    if (b.area > 500) {
      b.rs = 'flat';
      b.roof = 0;
    }
  }
}
function bldAt(x, y, r, test) {
  let best = null,
    bd = 1e9;
  nearB(x, y, r + 60, b => {
    if (b.state >= 2 || (test && !test(b))) return;
    let d;
    if (x >= b.minx && x <= b.maxx && y >= b.miny && y <= b.maxy && pip(b.poly, x, y)) d = 0;
    else {
      d = Math.hypot(b.cx - x, b.cy - y) - b.r * 0.6;
      if (d > r) return;
    }
    if (d < bd || (d === bd && best && b.area < best.area)) {
      bd = d;
      best = b;
    }
  });
  return best;
}
function rectAt(x, y, ang, hu, hv) {
  const ca = Math.cos(ang),
    sa = Math.sin(ang);
  const p = [];
  for (const [u, v] of [
    [-hu, -hv],
    [hu, -hv],
    [hu, hv],
    [-hu, hv]
  ])
    p.push(x + u * ca - v * sa, y + u * sa + v * ca);
  return area2(p) < 0
    ? new Float32Array([p[6], p[7], p[4], p[5], p[2], p[3], p[0], p[1]])
    : new Float32Array(p);
}
function applyBrands() {
  // 1) buildings whose own name is a chain or mall
  for (const b of B) {
    if (b.sp || b.hk || b.lm || b.po) continue;
    const k = brandOf(b.name);
    if (k && !BRANDS[k].fuel) {
      setBrand(b, k, BRANDS[k].mall ? k : null);
      applyStoreLook(b);
    }
  }
  if (!POI) return;
  let nf = 0,
    ns = 0;
  for (const [x, y, kind, brand, name] of POI) {
    if (!inF(x, y) && Math.hypot(x + 2400, y + 2400) > 400000) continue;
    const k = brandOf(brand) || brandOf(name);
    if (!k) continue;
    const S = BRANDS[k];
    if (kind === 'fuel' || S.fuel) {
      addFuel(x, y, k);
      nf++;
      continue;
    }
    const b = bldAt(x, y, 18, b => b.kind !== 3 && b.area > 60);
    if (!b || (b.brand && BRANDS[b.brand].mall)) continue;
    if (b.area > 9000 && !S.big) {
      b.subBrands = b.subBrands || [];
      if (!b.subBrands.includes(k)) b.subBrands.push(k);
      continue;
    }
    setBrand(b, k);
    applyStoreLook(b);
    ns++;
  }
  // 2) churches: white walls, and a little tower with a spire on country churches
  const add = [];
  for (const b of B) {
    if (b.sp || b.hk || b.lm || b.po || b.brand || b.base > 0) continue;
    const ch = b.use === 'place_of_worship' || /kirkja$/i.test(b.name || '');
    if (!ch) continue;
    if (!b.wtag) b.wallC = [246, 246, 242];
    const capital = inF(b.cx, b.cy);
    if (!b.aerial) b.roofC = capital ? [70, 74, 82] : [176, 46, 40];
    if (!capital && b.area < 360 && b.area > 40) {
      const o = obbOf(b);
      if (o.L < 5) continue;
      b.rs = 'gable';
      b.rp = 1.1;
      b.roof = 9;
      b.h = Math.max(b.h, 4.5);
      const s2 = Math.min(3.4, o.hw * 1.1),
        uc = o.u0 + s2 / 2,
        x = b.cx + o.ux * uc - o.uy * o.vm,
        y = b.cy + o.uy * uc + o.ux * o.vm;
      const t = mkB(rectAt(x, y, Math.atan2(o.uy, o.ux), s2 / 2, s2 / 2), {
        h: b.h + Math.min(6, o.hw * 1.1) + 2.2,
        base: 0,
        kind: 8,
        roof: 3,
        sp: 0,
        name: b.name,
        addr: b.addr,
        use: b.use,
        res: 0,
        jobs: 0
      });
      t.wallC = b.wallC;
      t.roofC = b.roofC;
      t.spire = Math.max(3.5, s2 * 1.9);
      t.lm = 1;
      t.group = 'ch' + b.id;
      b.group = t.group;
      add.push(t);
    }
  }
  for (const t of add) {
    t.id = B.length;
    B.push(t);
    addB(t);
  }
  // every other named shop, office, hotel, restaurant or workshop gets its name on the front
  const PAL = [
    [
      [44, 46, 50],
      [255, 255, 255]
    ],
    [
      [248, 248, 246],
      [30, 32, 36]
    ],
    [
      [236, 236, 232],
      [44, 46, 50]
    ],
    [
      [30, 32, 36],
      [236, 236, 232]
    ]
  ];
  const nameIt = (b, nm) => {
    if (b.brand || b.sp || b.hk || b.lm || b.canopy || b.hide || b.base > 0) return;
    if (
      !(b.kind === 4 || b.kind === 5) &&
      !/hotel|restaurant|cafe|bank|pharmacy|cinema|shop|office|fast_food|bar|pub/.test(b.use || '')
    )
      return;
    if (b.area < 60 || !nm || nm.length > 30) return;
    if (/kirkja|skóli|leikskóli/i.test(nm) && b.kind === 6) return;
    const pc = PAL[(b.seed * PAL.length) | 0];
    b.brand = '__nm';
    b.signS = { sign: pc[0], fg: pc[1] };
    b.signTxt = nm.toUpperCase();
  };
  let nn = 0;
  for (const b of B) {
    if (b.name) {
      const before = b.brand;
      nameIt(b, b.name);
      if (b.brand === '__nm' && !before) nn++;
    }
  }
  if (POI)
    for (const [x, y, kind, brand, name] of POI) {
      if (!name || kind === 'fuel' || kind === 'zoo') continue;
      const b = bldAt(x, y, 4, b => b.area > 60 && !b.brand);
      if (b && !b.name) {
        b.name = name;
        nameIt(b, name);
        if (b.brand === '__nm') nn++;
      }
    }
  console.log('named fronts', nn);
  {
    const G = new Map();
    for (const t of add) {
      const b = B.find(o => o.group === t.group && o !== t);
      if (b) t.z = b.z = Math.min(b.z, t.z);
    }
  }
  console.log('brands: shops', ns, 'fuel', nf, 'church towers', add.length);
}
/* petrol stations: reuse the mapped canopy roof when there is one, otherwise build a canopy facing the road */
function addFuel(x, y, k) {
  let can = bldAt(
    x,
    y,
    30,
    b => (b.kind === 3 || b.use === 'fuel') && b.area > 40 && b.area < 900 && !b.canopy
  );
  if (!can) {
    const ang = roadAngle(x, y),
      hu = 9,
      hv = 4.5;
    const p = rectAt(x, y, ang, hu, hv);
    let clash = false;
    nearB(x, y, 30, o => {
      if (!clash && o.state < 2 && pip(o.poly, x, y)) clash = true;
    });
    if (clash) return;
    can = mkB(p, {
      h: 1,
      base: 4.4,
      kind: 3,
      roof: 0,
      sp: 0,
      name: k,
      addr: '',
      use: 'fuel',
      res: 0,
      jobs: 0
    });
    can.id = B.length;
    B.push(can);
    addB(can);
  } else {
    can.base = 4.4;
    can.h = 1;
  }
  can.canopy = k;
  can.brand = k;
  can.signTxt = k.replace(' eldsneyti', '').toUpperCase();
  can.rs = 'flat';
  can.roof = 0;
  can.wallC = BRANDS[k].sign.slice();
  can.roofC = [236, 238, 240];
  can.name = can.name || k;
  const shop = bldAt(
    can.cx,
    can.cy,
    35,
    b =>
      b !== can &&
      !b.canopy &&
      b.kind !== 3 &&
      b.area > 30 &&
      b.area < 450 &&
      !b.brand &&
      b.kind !== 0 &&
      b.kind !== 1 &&
      b.kind !== 2
  );
  if (shop) {
    setBrand(shop, k);
    shop.name = shop.name || k;
  }
  // the tall price sign stands at the corner nearest the road
  const o = obbOf(can);
  let best = null,
    bd = 1e9;
  for (const [su, sv] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ]) {
    const u = su * (o.L / 2 + 3),
      v = sv * (o.hw + 3),
      px = can.cx + o.ux * u - o.uy * (v + o.vm),
      py = can.cy + o.uy * u + o.ux * (v + o.vm);
    let d = 1e9;
    eachB2(SBUCK, px - 30, py - 30, px + 30, py + 30, (w, j) => {
      const wy = WAYS[w];
      if (wy.cl > 5) return;
      const a = wy.nodes[j],
        b2 = wy.nodes[j + 1];
      d = Math.min(d, segD(px, py, NX[a], NY[a], NX[b2], NY[b2]));
    });
    if (d < bd) {
      bd = d;
      best = [px, py];
    }
  }
  can.pylon = best;
}
/* pumps and pillars under the canopy (drawn before the canopy slab) */
function drawCanopyUnder(c, b, zb) {
  const k = DK;
  if (k < 0.5) return;
  const o = obbOf(b),
    S = (x, y, z) => [PXw(x, y) * k - DOX, (PYw(x, y) - z) * k - DOY];
  const W = (u, v) => [b.cx + o.ux * u - o.uy * (v + o.vm), b.cy + o.uy * u + o.ux * (v + o.vm)];
  const g = zb - b.base;
  const pil = [];
  for (const su of [-1, 1]) for (const sv of [-1, 1]) pil.push(W(su * (o.L / 2 - 1.2), sv * (o.hw - 1)));
  const box = (u, v, hu, hv, h, col) => {
    const pts = [
      [-hu, -hv],
      [hu, -hv],
      [hu, hv],
      [-hu, hv]
    ].map(([a, bb]) => W(u + a, v + bb));
    for (let i = 0; i < 4; i++) {
      const p = pts[i],
        q = pts[(i + 1) % 4],
        ex = q[0] - p[0],
        ey = q[1] - p[1];
      const ar =
        (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]);
      const sg = ar > 0 ? 1 : -1;
      if (faces(sg * ey, -sg * ex) <= 0) continue;
      const A = S(p[0], p[1], g),
        B2 = S(q[0], q[1], g),
        C2 = S(q[0], q[1], g + h),
        D = S(p[0], p[1], g + h);
      c.fillStyle = col(1);
      c.beginPath();
      c.moveTo(A[0], A[1]);
      c.lineTo(B2[0], B2[1]);
      c.lineTo(C2[0], C2[1]);
      c.lineTo(D[0], D[1]);
      c.closePath();
      c.fill();
    }
    c.fillStyle = col(1.08);
    c.beginPath();
    pts.forEach((p, i) => {
      const s = S(p[0], p[1], g + h);
      i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
    });
    c.closePath();
    c.fill();
  };
  const isl = Math.max(1, Math.min(3, Math.round(o.L / 7)));
  for (let i = 0; i < isl; i++) {
    const u = -o.L / 2 + ((i + 0.5) * o.L) / isl;
    box(u, 0, 0.6, 1.6, 0.25, f => N_([170, 170, 166], f));
    box(u, -0.7, 0.35, 0.25, 1.6, f => N_(BRANDS[b.canopy].sign, f));
    box(u, 0.7, 0.35, 0.25, 1.6, f => N_(BRANDS[b.canopy].sign, f));
  }
  for (const p of pil) {
    const s0 = S(p[0], p[1], g),
      s1 = S(p[0], p[1], zb);
    c.fillStyle = N_([200, 202, 204], 1);
    c.fillRect(
      Math.round(s0[0] - k * 0.25),
      Math.round(s1[1]),
      Math.max(1, Math.round(k * 0.5)),
      Math.max(1, Math.round(s0[1] - s1[1]))
    );
  }
}
function drawPylon(c, b) {
  const k = DK;
  if (!b.pylon || k < 0.4) return;
  const [x, y] = b.pylon,
    z = hAt(x, y),
    S = BRANDS[b.canopy];
  const s = [PXw(x, y) * k - DOX, (PYw(x, y) - z) * k - DOY];
  const w = Math.max(2, Math.round(k * 1.6)),
    h = Math.max(4, Math.round(k * 7));
  c.fillStyle = N_(S.sign, 1);
  c.fillRect(Math.round(s[0] - w / 2), Math.round(s[1] - h), w, h);
  c.fillStyle = N_([250, 250, 250], 1);
  if (k >= 1.3)
    for (let i = 0; i < 3; i++)
      c.fillRect(
        Math.round(s[0] - w / 2 + 1),
        Math.round(s[1] - h * 0.55 + i * h * 0.14),
        Math.max(1, w - 2),
        Math.max(1, Math.round(h * 0.08))
      );
  if (k >= 1.3) {
    c.fillStyle = N_(S.fg, 1);
    c.font = 'bold ' + Math.max(5, Math.round(k * 1.1)) + 'px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText(b.signTxt.slice(0, 6), s[0], s[1] - h + 1);
  }
}
/* a sign on a shop front: a coloured fascia panel with the name, lying in the plane of the wall */
function drawShopSign(c, b, j, P, dx, dy, zb, z1, sh) {
  const k = DK;
  if (k < 0.55 || b.h < 2.8) return;
  const S = b.signS || BRANDS[b.brand];
  if (!S) return;
  const q = (j + 1) % b.n,
    L = Math.hypot(dx, dy);
  if (L < 5) return;
  const sx0 = PXw(P[2 * j], P[2 * j + 1]) * k - DOX,
    sx1 = PXw(P[2 * q], P[2 * q + 1]) * k - DOX;
  if (Math.abs(sx1 - sx0) / (L * k) < 0.35) return;
  const txt = b.signTxt || b.brand.toUpperCase(),
    hb = Math.min(S.big ? 6 : b.area > 1500 ? 3.6 : 2.4, b.h * 0.45),
    zt = z1 - Math.min(0.4, b.h * 0.08),
    zbot = zt - hb;
  const pl = Math.min(L * (S.big ? 0.8 : 0.65), Math.max(3, txt.length * hb * 0.85 + 2));
  const t0 = 0.5 - pl / L / 2,
    t1 = 0.5 + pl / L / 2;
  const W = (t, z) => {
    const x = P[2 * j] + dx * t,
      y = P[2 * j + 1] + dy * t;
    return [PXw(x, y) * k - DOX, (PYw(x, y) - z) * k - DOY];
  };
  if (b.noWin) {
    const g0 = 0.5 - Math.min(0.32, (pl * 0.45) / L),
      g1 = 1 - g0,
      ze = zb + Math.min(2.8, b.h * 0.45);
    const a1 = W(g0, zb),
      b1 = W(g1, zb),
      c1 = W(g1, ze),
      d1 = W(g0, ze);
    c.fillStyle = N_([96, 124, 146], sh);
    c.beginPath();
    c.moveTo(a1[0], a1[1]);
    c.lineTo(b1[0], b1[1]);
    c.lineTo(c1[0], c1[1]);
    c.lineTo(d1[0], d1[1]);
    c.closePath();
    c.fill();
    if (k >= 1.3) {
      c.strokeStyle = N_([200, 206, 210], 1);
      c.lineWidth = 1;
      const nm = Math.max(2, Math.round(((g1 - g0) * L) / 2));
      c.beginPath();
      for (let i = 1; i < nm; i++) {
        const t = g0 + ((g1 - g0) * i) / nm,
          u0 = W(t, zb),
          u1 = W(t, ze);
        c.moveTo(u0[0], u0[1]);
        c.lineTo(u1[0], u1[1]);
      }
      c.stroke();
    }
  }
  if (S.band) {
    const A = W(0, z1 - 0.05),
      B2 = W(1, z1 - 0.05),
      C2 = W(1, z1 - hb * 0.45),
      D = W(0, z1 - hb * 0.45);
    c.fillStyle = N_(S.band, sh);
    c.beginPath();
    c.moveTo(A[0], A[1]);
    c.lineTo(B2[0], B2[1]);
    c.lineTo(C2[0], C2[1]);
    c.lineTo(D[0], D[1]);
    c.closePath();
    c.fill();
  }
  const A = W(t0, zt),
    B2 = W(t1, zt),
    C2 = W(t1, zbot),
    D = W(t0, zbot);
  c.fillStyle = N_(S.sign, Math.min(1.05, sh + 0.1));
  c.beginPath();
  c.moveTo(A[0], A[1]);
  c.lineTo(B2[0], B2[1]);
  c.lineTo(C2[0], C2[1]);
  c.lineTo(D[0], D[1]);
  c.closePath();
  c.fill();
  const sw = Math.hypot(B2[0] - A[0], B2[1] - A[1]),
    ht = Math.abs(D[1] - A[1]);
  if (ht < 4 || sw < 10) return;
  const fs = Math.min(ht * 0.78, sw / (txt.length * 0.68));
  if (fs < 4) return;
  const fl = B2[0] < A[0] ? -1 : 1;
  c.save();
  c.setTransform(
    (fl * (B2[0] - A[0])) / sw,
    (fl * (B2[1] - A[1])) / sw,
    0,
    1,
    (A[0] + B2[0] + C2[0] + D[0]) / 4,
    (A[1] + B2[1] + C2[1] + D[1]) / 4
  );
  c.fillStyle = N_(S.fg, 1);
  c.font = 'bold ' + Math.round(fs) + 'px "Silkscreen","Pixelify Sans",sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(txt, 0, 0);
  c.restore();
  if (b.subBrands && b.subBrands.length && L > 40 && k >= 1) {
    let t = 0.12;
    for (const sb of b.subBrands.slice(0, 3)) {
      const s2 = BRANDS[sb];
      if (!s2) continue;
      const a2 = W(t, zbot - 1.2),
        b2 = W(t + 0.12, zbot - 1.2),
        c2 = W(t + 0.12, zbot - 2.4),
        d2 = W(t, zbot - 2.4);
      c.fillStyle = N_(s2.sign, 1);
      c.beginPath();
      c.moveTo(a2[0], a2[1]);
      c.lineTo(b2[0], b2[1]);
      c.lineTo(c2[0], c2[1]);
      c.lineTo(d2[0], d2[1]);
      c.closePath();
      c.fill();
      t = t > 0.5 ? t + 0.14 : 1 - t - 0.12;
    }
  }
}
