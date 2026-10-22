/**
 * God tools and creatures
 *
 * Placing buildings and features, disasters, trolls, UFOs and tornadoes.
 *
 * Functions: addInstant, groupTop, rotPoly, mkArea, flatGround, buildThing, drawTroll, spawnEnt, stepEnts,
 *     entDim, drawEnts, terrainTool, disasterTool, stepHlaup, crowd, peopleTool
 * State and constants: ENTS, TROLLN, CROWD_PH, YULE
 */

const ENTS = []; // trolls, UFOs, tornadoes, geysers, steam vents, lighthouses, lightning storms…
function addInstant(poly, o) {
  const b = mkB(poly, o);
  b.id = B.length;
  b.isNew = 1;
  B.push(b);
  addB(b);
  if (inF(b.cx, b.cy)) rasterB(b);
  linkB(b);
  dirtyB(b);
  statsDirty = true;
  return b;
}
function groupTop(g) {
  let t = 0;
  for (const b of g) t = Math.max(t, b.base + b.h);
  for (const b of g) b.gTop = t;
}
function rotPoly(x, y, ang, u0, u1, v0, v1) {
  const ca = Math.cos(ang),
    sa = Math.sin(ang);
  const p = [];
  for (const [u, v] of [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1]
  ])
    p.push(x + u * ca - v * sa, y + u * sa + v * ca);
  return area2(p) < 0
    ? new Float32Array([p[6], p[7], p[4], p[5], p[2], p[3], p[0], p[1]])
    : new Float32Array(p);
}
function mkArea(c, sub, name, poly) {
  const n = poly.length / 2;
  let cx = 0,
    cy = 0,
    minx = 1e12,
    maxx = -1e12,
    miny = 1e12,
    maxy = -1e12,
    a = 0;
  for (let j = 0; j < n; j++) {
    const x = poly[2 * j],
      y = poly[2 * j + 1];
    cx += x;
    cy += y;
    minx = Math.min(minx, x);
    maxx = Math.max(maxx, x);
    miny = Math.min(miny, y);
    maxy = Math.max(maxy, y);
    const q = (j + 1) % n;
    a += x * poly[2 * q + 1] - poly[2 * q] * y;
  }
  cx /= n;
  cy /= n;
  a = Math.abs(a / 2);
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
    ux = Math.cos(ang),
    uy = Math.sin(ang);
  let u0 = 1e9,
    u1 = -1e9,
    v0 = 1e9,
    v1 = -1e9;
  for (let j = 0; j < n; j++) {
    const dx = poly[2 * j] - cx,
      dy = poly[2 * j + 1] - cy,
      u = dx * ux + dy * uy,
      v = -dx * uy + dy * ux;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  const A = {
    id: AREAS.length + 5000,
    c,
    sub,
    name,
    poly,
    n,
    cx,
    cy,
    minx,
    maxx,
    miny,
    maxy,
    area: a,
    ux,
    uy,
    u0,
    u1,
    v0,
    v1,
    L: u1 - u0,
    W: v1 - v0,
    mu: (u0 + u1) / 2,
    mv: (v0 + v1) / 2,
    z: null,
    ag: 0,
    stamp: 0
  };
  AREAS.push(A);
  for (let j = Math.floor(miny / AGS); j <= Math.floor(maxy / AGS); j++)
    for (let i = Math.floor(minx / AGS); i <= Math.floor(maxx / AGS); i++) {
      const k = ag2k(i, j);
      let l = AG2.get(k);
      if (!l) AG2.set(k, (l = []));
      l.push(A);
      l.sort((p, q) => (AREA_ORDER[p.c] ?? 9) - (AREA_ORDER[q.c] ?? 9));
    }
  if (c === AK.PLAY) genPlayground(A);
  else if (c === AK.PITCH) genPitch(A);
  else if (c === AK.KINDER) genKinder(A);
  for (let y = miny - 10; y <= maxy + 10; y += 10)
    for (let x = minx - 10; x <= maxx + 10; x += 10) dirtyWorld(x, y, true, true);
  SIDX = null;
  return A;
}
function flatGround(poly, h) {
  let mnx = 1e12,
    mxx = -1e12,
    mny = 1e12,
    mxy = -1e12;
  for (let j = 0; j < poly.length; j += 2) {
    mnx = Math.min(mnx, poly[j]);
    mxx = Math.max(mxx, poly[j]);
    mny = Math.min(mny, poly[j + 1]);
    mxy = Math.max(mxy, poly[j + 1]);
  }
  for (let x = mnx - 5; x <= mxx + 5; x += 5)
    for (let y = mny - 5; y <= mxy + 5; y += 5) {
      const c = cellAt(x, y);
      if (c < 0) continue;
      if (pip(poly, x, y)) {
        const t = gT(c);
        setCell(
          c,
          t === SEA || isWaterT(t)
            ? GRASS
            : t === HIGH || t === ROCK || t === SCRUB || t === SAND
              ? GRASS
              : t,
          Math.max(1, h),
          gCov(c)
        );
      }
    }
}
/* ---------- buildings ---------- */
function buildThing(id, x, y) {
  const ang = roadAngle(x, y),
    A = (u0, u1, v0, v1) => rotPoly(x, y, ang, u0, u1, v0, v1);
  const need = p => {
    if (!free(p)) {
      toast('No room there');
      return false;
    }
    return true;
  };
  const W = (b, w, r) => {
    b.wallC = w;
    b.roofC = r;
    b.style = null;
    return b;
  };
  switch (id) {
    case 'cabin': {
      const p = A(-4, 4, -3, 3);
      if (!need(p)) return;
      const b = addBuilding(p, {
        h: 3.4,
        base: 0,
        kind: 0,
        roof: 1,
        sp: 0,
        name: 'Sumarbústaður',
        addr: 'Nýbygging',
        use: 'cabin',
        res: 2,
        jobs: 0
      });
      W(
        b,
        pickA([
          [96, 70, 52],
          [60, 48, 40],
          [150, 60, 40],
          [200, 190, 170]
        ]),
        [52, 54, 58]
      );
      b.style = 'iron';
      const d = addBuilding(A(4, 7, -3, 3), {
        h: 0.4,
        base: 0,
        kind: 3,
        roof: 0,
        sp: 0,
        name: 'Pallur',
        addr: '',
        use: '',
        res: 0,
        jobs: 0
      });
      W(d, [150, 118, 84], [150, 118, 84]);
      break;
    }
    case 'turf': {
      const p = A(-9, 9, -5, 5);
      if (!need(p)) return;
      for (let i = 0; i < 3; i++) {
        const b = addBuilding(A(-9 + i * 6, -3.4 + i * 6, -5, 5), {
          h: 2.6,
          base: 0,
          kind: 0,
          roof: 1,
          sp: 0,
          name: 'Torfbær',
          addr: 'Nýbygging',
          use: 'museum',
          res: 0,
          jobs: 2
        });
        W(b, i % 2 ? [238, 236, 228] : [150, 40, 36], [96, 132, 66]);
        b.turf = 1;
      }
      toast('Torfbær · a turf house, as Icelanders lived for 1 000 years');
      break;
    }
    case 'church': {
      const p = A(-12, 8, -5, 5);
      if (!need(p)) return;
      const grp = 'ch' + B.length;
      const parts = [];
      const nave = addBuilding(A(-8, 8, -4, 4), {
        h: 5.5,
        base: 0,
        kind: 7,
        roof: 1,
        sp: 0,
        name: 'Kirkja',
        addr: 'Nýbygging',
        use: 'place_of_worship',
        res: 0,
        jobs: 1
      });
      W(
        nave,
        [244, 242, 236],
        pickA([
          [168, 44, 38],
          [40, 70, 120],
          [52, 96, 78]
        ])
      );
      parts.push(nave);
      const tw = addBuilding(A(-12, -8, -2, 2), {
        h: 9,
        base: 0,
        kind: 7,
        roof: 0,
        sp: 0,
        name: 'Kirkja',
        addr: 'Nýbygging',
        use: 'place_of_worship',
        res: 0,
        jobs: 0
      });
      W(tw, [244, 242, 236], nave.roofC);
      parts.push(tw);
      const sp = addBuilding(A(-11.6, -8.4, -1.6, 1.6), {
        h: 5,
        base: 9,
        kind: 7,
        roof: 3,
        sp: 0,
        name: 'Kirkja',
        addr: 'Nýbygging',
        use: 'place_of_worship',
        res: 0,
        jobs: 0
      });
      W(sp, [244, 242, 236], nave.roofC);
      sp.sup = tw;
      parts.push(sp);
      for (const b of parts) b.group = grp;
      groupTop(parts);
      break;
    }
    case 'hotel': {
      const p = A(-22, 22, -8, 8);
      if (!need(p)) return;
      const b = addBuilding(p, {
        h: 19,
        base: 0,
        kind: 4,
        roof: 0,
        sp: 0,
        name: pickA(['Hótel Norðurljós', 'Hótel Fjörður', 'Hótel Hraun', 'Hótel Jökull', 'Hótel Saga']),
        addr: 'Nýbygging',
        use: 'hotel',
        res: 0,
        jobs: 60
      });
      W(
        b,
        pickA([
          [236, 234, 228],
          [60, 62, 66],
          [214, 206, 192]
        ]),
        [60, 64, 70]
      );
      break;
    }
    case 'green': {
      const p = A(-15, 15, -5, 5);
      if (!need(p)) return;
      for (const v of [-5, 0]) {
        const b = addBuilding(A(-15, 15, v, v + 5), {
          h: 3.2,
          base: 0,
          kind: 5,
          roof: 1,
          sp: 0,
          name: 'Gróðurhús',
          addr: 'Nýbygging',
          use: 'greenhouse',
          res: 0,
          jobs: 4
        });
        W(b, [196, 226, 222], [214, 236, 232]);
        b.glass = true;
        b.green = 1;
      }
      toast('Gróðurhús · geothermal greenhouse, like in Hveragerði');
      break;
    }
    case 'lighthouse': {
      const p = A(-3, 3, -3, 3);
      if (!need(p)) return;
      const grp = 'lh' + B.length;
      const t = addBuilding(A(-2.2, 2.2, -2.2, 2.2), {
        h: 14,
        base: 0,
        kind: 8,
        roof: 0,
        sp: 0,
        name: 'Viti',
        addr: 'Nýbygging',
        use: 'lighthouse',
        res: 0,
        jobs: 0
      });
      W(t, [240, 240, 236], [200, 60, 40]);
      const l = addBuilding(A(-1.6, 1.6, -1.6, 1.6), {
        h: 3,
        base: 14,
        kind: 8,
        roof: 3,
        sp: 0,
        name: 'Viti',
        addr: 'Nýbygging',
        use: 'lighthouse',
        res: 0,
        jobs: 0
      });
      W(l, [220, 70, 50], [200, 60, 40]);
      l.sup = t;
      t.group = l.group = grp;
      groupTop([t, l]);
      ENTS.push({ type: 'light', x, y, b: l });
      break;
    }
    case 'plant': {
      const p = A(-30, 30, -14, 14);
      if (!need(p)) return;
      const h = addBuilding(A(-30, 10, -14, 14), {
        h: 14,
        base: 0,
        kind: 5,
        roof: 0,
        sp: 0,
        name: 'Jarðvarmavirkjun',
        addr: 'Nýbygging',
        use: 'power',
        res: 0,
        jobs: 40
      });
      W(h, [200, 204, 208], [110, 114, 120]);
      for (const u of [16, 26]) {
        const s = addBuilding(A(u - 3, u + 3, -3, 3), {
          h: 22,
          base: 0,
          kind: 5,
          roof: 0,
          sp: 0,
          name: 'Jarðvarmavirkjun',
          addr: 'Nýbygging',
          use: 'power',
          res: 0,
          jobs: 0
        });
        W(s, [214, 216, 218], [180, 184, 188]);
        ENTS.push({ type: 'steam', x: s.cx, y: s.cy, zo: 22, b: s, big: 1 });
      }
      toast('Jarðvarmavirkjun · geothermal power, about a quarter of Iceland’s electricity');
      break;
    }
    case 'pool':
    case 'play':
    case 'pitch':
    case 'tub': {
      const dims = id === 'pool' ? [25, 13] : id === 'pitch' ? [64, 40] : id === 'tub' ? [4, 4] : [22, 16];
      const p = A(-dims[0] / 2, dims[0] / 2, -dims[1] / 2, dims[1] / 2);
      if (!need(p)) return;
      flatGround(p, hAt(x, y));
      const A2 = mkArea(
        id === 'pool' || id === 'tub' ? AK.POOL : id === 'pitch' ? AK.PITCH : AK.PLAY,
        id === 'pitch' ? 17 : id === 'tub' ? 1 : 0,
        id === 'pool'
          ? 'Ný sundlaug'
          : id === 'pitch'
            ? 'Nýr völlur'
            : id === 'tub'
              ? 'Heitur pottur'
              : 'Nýr leikvöllur',
        p
      );
      if (id === 'pool') {
        mkArea(AK.POOL, 1, 'Heitur pottur', A(dims[0] / 2 + 2, dims[0] / 2 + 6, -2, 2));
      }
      toast(
        id === 'pool'
          ? 'A new outdoor pool, geothermally heated'
          : id === 'pitch'
            ? 'A new football pitch'
            : id === 'tub'
              ? 'A hot tub'
              : 'A new playground'
      );
      break;
    }
    case 'flag': {
      addPt(7, x, y, 0, '');
      dirtyWorld(x, y, true, false);
      break;
    }
  }
}
/* ---------- entities ---------- */
/* a troll, about 20 m tall: hunched, long-armed, a big nose, tufts of mossy hair and a birch-trunk club.
   When the sun catches it, the same figure is left standing as weathered grey rock with moss and lichen. */
function drawTroll(e) {
  const k = K,
    z = hAt(e.x, e.y),
    s = sp_(e.x, e.y, z);
  const H = k * 20;
  if (s[0] < -H - 40 || s[0] > VW + H + 40 || s[1] < -H * 1.4 - 40 || s[1] > VH + 40) return;
  if (H < 5) {
    ctx.fillStyle = C_(e.stone ? [120, 116, 108] : [104, 112, 88], 1);
    const w = Math.max(1, Math.round(H * 0.5)),
      h = Math.max(2, Math.round(H));
    ctx.fillRect(Math.round(s[0] - w / 2), Math.round(s[1] - h), w, h);
    return;
  }
  const p = H / 26,
    X = s[0],
    Y = s[1];
  const fr = Math.cos(e.hd) * SXx + Math.sin(e.hd) * SXy >= 0 ? 1 : -1;
  const st = e.stone,
    ph = st ? 0 : Math.sin(e.t * 8),
    stp = ph > 0,
    bob = st ? 0 : Math.abs(ph) * 0.6;
  const pal = st
    ? {
        sk: [124, 120, 112],
        skd: [94, 91, 86],
        skl: [150, 146, 138],
        fur: [104, 100, 94],
        furd: [84, 80, 76],
        hair: [96, 112, 70],
        nail: [110, 106, 100],
        club: [112, 108, 100],
        clubd: [90, 86, 80],
        eye: [70, 68, 64]
      }
    : {
        sk: [118, 128, 98],
        skd: [90, 100, 76],
        skl: [146, 152, 118],
        fur: [110, 84, 58],
        furd: [82, 62, 44],
        hair: [78, 92, 52],
        nail: [204, 192, 160],
        club: [214, 206, 188],
        clubd: [60, 52, 44],
        eye: [250, 214, 70]
      };
  const r = (gx, gy, w, h, c) => {
    const x = fr > 0 ? gx : -(gx + w);
    ctx.fillStyle = C_(c, 1);
    const x0 = Math.round(X + x * p),
      x1 = Math.round(X + (x + w) * p),
      y0 = Math.round(Y - (gy + h + bob) * p),
      y1 = Math.round(Y - (gy + bob) * p);
    ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  };
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(X, Y, 11 * p, 3 * p, 0, 0, 7);
  ctx.fill();
  // far arm and club behind the body
  const sw = st ? -1 : Math.round(ph * 1.5);
  r(-8, 9 + sw, 3, 9, pal.skd);
  r(-9, 6 + sw, 3, 4, pal.skd);
  r(-10, 5 + sw, 4, 2, pal.nail);
  // legs, stepping
  const l1 = stp ? -1 : 1;
  r(-5 + l1, 0, 4, 8, pal.skd);
  r(1 - l1, 0, 4, 8, pal.sk);
  r(-6 + l1, 0, 6, 2, pal.skd);
  r(0 - l1, 0, 6, 2, pal.sk);
  r(2 - l1, 1, 1, 1, pal.nail);
  // loincloth of hides
  r(-6, 7, 12, 4, pal.fur);
  r(-6, 7, 12, 1, pal.furd);
  r(-4, 6, 2, 1, pal.furd);
  r(2, 6, 2, 1, pal.fur);
  // big hunched body and belly
  r(-7, 11, 13, 8, pal.sk);
  r(-7, 11, 3, 8, pal.skd);
  r(2, 11, 4, 6, pal.skl);
  r(-6, 19, 11, 3, pal.sk);
  r(-6, 19, 3, 3, pal.skd);
  r(-1, 13, 2, 1, pal.skd);
  // hump of the back with mossy hair
  r(-8, 17, 5, 5, pal.skd);
  r(-9, 20, 4, 3, pal.hair);
  r(-7, 22, 3, 2, pal.hair);
  // head thrust forward: brow, big nose, eye, tusk, ear, wild hair
  r(1, 20, 8, 6, pal.sk);
  r(1, 20, 2, 6, pal.skd);
  r(8, 20, 4, 4, pal.skl);
  r(11, 20, 2, 2, pal.sk);
  r(9, 19, 2, 1, pal.skd);
  r(5, 25, 6, 1, pal.skd);
  r(6, 23, 2, 1, pal.eye);
  r(8, 19, 1, 2, pal.nail);
  r(1, 22, 2, 3, pal.skd);
  r(0, 26, 9, 2, pal.hair);
  r(-1, 24, 3, 3, pal.hair);
  r(3, 28, 2, 1, pal.hair);
  r(7, 27, 2, 1, pal.hair);
  // near arm swinging a birch-trunk club
  r(3, 12 - sw, 3, 8, pal.sk);
  r(4, 9 - sw, 4, 4, pal.sk);
  r(5, 8 - sw, 4, 2, pal.nail);
  r(7, 6 - sw, 3, 13, pal.club);
  r(7, 6 - sw, 1, 13, pal.clubd);
  r(8, 10 - sw, 1, 1, pal.clubd);
  r(8, 15 - sw, 1, 1, pal.clubd);
  r(6, 18 - sw, 5, 4, pal.club);
  r(6, 18 - sw, 1, 4, pal.clubd);
  if (st) {
    // moss, lichen and cracks on the rock, the same every time
    for (let q = 0; q < 26; q++) {
      const gx = -9 + Math.floor(h32(e.x | 0, q, 91) * 21),
        gy = Math.floor(h32(e.y | 0, q, 92) * 27);
      const c = q % 3 === 0 ? [196, 150, 60] : q % 3 === 1 ? [86, 104, 62] : [70, 68, 64];
      r(gx, gy, 1 + (q % 2), 1, c);
    }
    if (e.stoneT < 3) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - e.stoneT / 3) * 0.6;
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.ellipse(X, Y - 13 * p, 12 * p, 15 * p, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }
  if (e === follow || e === selected) {
    ctx.strokeStyle = '#c6b3ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(X - 12 * p) - 0.5,
      Math.round(Y - 30 * p) - 0.5,
      Math.round(24 * p),
      Math.round(31 * p)
    );
  }
}
const TROLLN = ['Gríla', 'Leppalúði', 'Bárðarbunga-tröll', 'Hrímgerður', 'Skessa', 'Jötunn'];
function spawnEnt(type, x, y) {
  const z = hAt(x, y);
  if (type === 'troll') {
    ENTS.push({ type, x, y, hd: R() * 6.3, t: 0, life: 45, name: pickA(TROLLN), step: 0 });
    toast('Tröll! A troll comes down from the mountains. Trolls turn to stone in daylight…');
    hazards.push({ x, y, r: 300, t: 45, kind: 'troll' });
  } else if (type === 'ufo') {
    ENTS.push({ type, x, y, t: 0, life: 30, z: z + 90, tgt: null, lift: 0 });
    toast('Something hovers over ' + placeName(x, y) + '…');
    hazards.push({ x, y, r: 250, t: 30, kind: 'ufo' });
  } else if (type === 'tornado') {
    ENTS.push({ type, x, y, hd: R() * 6.3, t: 0, life: 28 });
    toast('Skýstrókur! A tornado touches down');
    hazards.push({ x, y, r: 400, t: 28, kind: 'tornado' });
  } else if (type === 'geyser') {
    cellsIn(x, y, 14, c => setCell(c, SAND, gH(c), 1));
    const g = { x, y, k: 'geyser', name: '', geo: 1, id: GEO.length, pool: 6, next: 3, z: null };
    GEO.push(g);
    toast('Goshver · a new geyser, like Strokkur');
  } else if (type === 'spring') {
    const g = { x, y, k: 'hot', name: '', geo: 1, id: GEO.length, pool: 3, blue: true, z: null };
    GEO.push(g);
    toast('Hver · a hot spring');
  } else if (type === 'lstorm') {
    setWeather('storm', true);
    ENTS.push({ type, x, y, t: 0, life: 22, next: 0.5 });
    toast('Þrumuveður · a thunderstorm');
  } else if (type === 'ash') {
    ENTS.push({ type, x, y, t: 0, life: 40 });
    toast('Öskuský · volcanic ash, flights grounded');
  }
}
function stepEnts(dt) {
  if (!dt) return;
  for (let i = ENTS.length - 1; i >= 0; i--) {
    const e = ENTS[i];
    e.t += dt;
    const z = hAt(e.x, e.y);
    if (e.type === 'troll') {
      if (dayL > 0.6 && e.t > 18 && !e.stone) {
        e.stone = 1;
        e.life = e.t + 3;
        toast(e.name + ' was caught by the sun and turned to stone');
        const p = rotPoly(e.x, e.y, e.hd, -4, 4, -3, 3);
        const b = addInstant(p, {
          h: 14,
          base: 0,
          kind: 8,
          roof: 0,
          sp: 0,
          name: 'Tröllasteinn',
          addr: e.name + ' · turned to stone',
          use: 'rock',
          res: 0,
          jobs: 0
        });
        b.hide = 1;
        e.rock = b;
        e.life = 1e9;
        e.stoneT = 0;
        for (let q = 0; q < 40; q++)
          dust(e.x + (R() - 0.5) * 8, e.y + (R() - 0.5) * 8, hAt(e.x, e.y) + R() * 12, 1, 3);
      }
      if (e.stone) {
        e.stoneT = (e.stoneT || 0) + dt;
        if (e.rock && e.rock.state === 9) e.life = 0;
      }
      if (!e.stone) {
        if (R() < dt * 0.25) e.hd += (R() - 0.5) * 2;
        const sp = 3.2;
        const nx = e.x + Math.cos(e.hd) * sp * dt,
          ny = e.y + Math.sin(e.hd) * sp * dt;
        const c = cellAt(nx, ny);
        if (c < 0 || gT(c) === SEA) {
          e.hd += Math.PI * 0.7;
        } else {
          e.x = nx;
          e.y = ny;
        }
        e.step += dt;
        if (e.step > 0.75) {
          e.step = 0;
          shake = Math.max(shake, 0.5);
          dust(e.x, e.y, z, 8, 6);
          nearB(e.x, e.y, 22, b => {
            if (b.state < 2 && Math.hypot(b.cx - e.x, b.cy - e.y) < b.r * 0.5 + 7) {
              destroyB(b, false, true);
            }
          });
          killNear(e.x, e.y, 5);
          nearT(e.x, e.y, 6, killTree);
          if (R() < 0.3) {
            for (const a of agents)
              if (!a.dead && !a.car && Math.hypot(a.x - e.x, a.y - e.y) < 60 && R() < 0.3)
                say(a, ['Tröll!', 'Hlaupið!', 'Guð minn góður!', 'Grýla!'], 2);
          }
        }
      }
    } else if (e.type === 'ufo') {
      if (!e.tgt || e.tgt.state >= 2) {
        let best = null,
          bd = 1e9;
        nearB(e.x, e.y, 200, b => {
          if (b.state === 0 && !b.sp) {
            const d = Math.hypot(b.cx - e.x, b.cy - e.y);
            if (d < bd) {
              bd = d;
              best = b;
            }
          }
        });
        e.tgt = best;
        e.lift = 0;
      }
      if (e.tgt) {
        const b = e.tgt,
          d = Math.hypot(b.cx - e.x, b.cy - e.y);
        if (d > 2) {
          e.x += (b.cx - e.x) * Math.min(1, dt * 1.2);
          e.y += (b.cy - e.y) * Math.min(1, dt * 1.2);
        } else {
          e.lift += dt * 9;
          b.z += dt * 9;
          b.fly = 1;
          dirtyB(b);
          if (b.z + b.h > e.z - 2) {
            wipeB(b);
            e.tgt = null;
            statsDirty = true;
          }
        }
      } else {
        e.x += Math.cos(e.t) * dt * 20;
        e.y += Math.sin(e.t * 0.7) * dt * 20;
      }
      for (const a of agents)
        if (!a.dead && !a.car && Math.hypot(a.x - e.x, a.y - e.y) < 8 && R() < dt * 0.6) {
          a.dead = true;
          ghost(a.x, a.y, hAt(a.x, a.y));
        }
      if (e.t > e.life - 2) e.z += dt * 120;
    } else if (e.type === 'tornado') {
      if (R() < dt * 0.3) e.hd += (R() - 0.5) * 1.2;
      e.x += Math.cos(e.hd) * 11 * dt;
      e.y += Math.sin(e.hd) * 11 * dt;
      for (let q = 0; q < 5; q++) {
        const a = R() * 6.3,
          r = 2 + R() * 10,
          h = R() * 50;
        addP({
          t: 1,
          x: e.x + Math.cos(a) * r * (1 + h / 40),
          y: e.y + Math.sin(a) * r * (1 + h / 40),
          z: z + h,
          vx: -Math.sin(a) * 14,
          vy: Math.cos(a) * 14,
          vz: 4,
          life: 1.2,
          max: 1.2,
          c: [150, 146, 140],
          s: 2.6,
          a: 0.6
        });
      }
      nearB(e.x, e.y, 40, b => {
        if (b.state < 2 && Math.hypot(b.cx - e.x, b.cy - e.y) < b.r * 0.5 + 12) {
          if (R() < dt * 3) destroyB(b, false, true);
        }
      });
      nearT(e.x, e.y, 14, t => {
        if (R() < dt * 4) killTree(t);
      });
      killNear(e.x, e.y, 10);
      for (const a of agents) if (!a.dead && a.car && Math.hypot(a.x - e.x, a.y - e.y) < 14) killA(a);
      shake = Math.max(shake, 0.25);
    } else if (e.type === 'geyser') {
      e.next -= dt;
      if (e.next <= 0) {
        e.erupt = 3;
        e.next = 12 + R() * 14;
      }
      if (e.erupt > 0) {
        e.erupt -= dt;
        for (let q = 0; q < 8; q++)
          addP({
            t: 6,
            x: e.x + (R() - 0.5) * 2,
            y: e.y + (R() - 0.5) * 2,
            z: z + 1,
            vx: (R() - 0.5) * 3 + WIND[0] * 2,
            vy: (R() - 0.5) * 3 + WIND[1] * 2,
            vz: 16 + R() * 14,
            life: 3,
            max: 3,
            c: [230, 240, 250],
            s: 1.6
          });
        if (R() < 0.5)
          addP({
            t: 1,
            x: e.x,
            y: e.y,
            z: z + 8 + R() * 20,
            vx: WIND[0] * windS * 0.5,
            vy: WIND[1] * windS * 0.5,
            vz: 3,
            life: 4,
            max: 4,
            c: [240, 244, 248],
            s: 5,
            a: 0.6
          });
      } else if (R() < dt * 2)
        addP({
          t: 1,
          x: e.x,
          y: e.y,
          z: z + 0.5,
          vx: WIND[0] * 2,
          vy: WIND[1] * 2,
          vz: 1.5,
          life: 3,
          max: 3,
          c: [236, 240, 244],
          s: 2,
          a: 0.4
        });
    } else if (e.type === 'steam') {
      if (e.b && e.b.state !== 0) {
        if (e.b.state === 9) {
          ENTS.splice(i, 1);
          continue;
        }
      } else if (R() < dt * (e.big ? 6 : 2.5) && K > 0.05) {
        const zz = (e.b ? e.b.z : z) + (e.zo || 0);
        addP({
          t: 1,
          x: e.x + (R() - 0.5) * 3,
          y: e.y + (R() - 0.5) * 3,
          z: zz,
          vx: WIND[0] * windS * 0.5,
          vy: WIND[1] * windS * 0.5,
          vz: 3 + R() * 2,
          life: 4 + R() * 3,
          max: 7,
          c: [240, 244, 248],
          s: e.big ? 7 : 2.5,
          a: 0.55
        });
      }
    } else if (e.type === 'lstorm') {
      e.next -= dt;
      if (e.next <= 0) {
        e.next = 0.4 + R() * 1.6;
        const vr = viewRect(0);
        const x = vr[0] + R() * (vr[2] - vr[0]),
          y = vr[1] + R() * (vr[3] - vr[1]),
          zz = hAt(x, y);
        bolts.push({ x, y, z: zz, t: 0.25 });
        shake = Math.max(shake, 0.3);
        const c = cellAt(x, y);
        const bb = c >= 0 ? bldAtCell(c) : null;
        if (bb && R() < 0.5) ignite(bb);
        nearT(x, y, 6, t => {
          if (R() < 0.4) igniteTree(t);
        });
        killNear(x, y, 3);
      }
    } else if (e.type === 'ash') {
      const vr = viewRect(0);
      for (let q = 0; q < 6; q++) {
        const x = vr[0] + R() * (vr[2] - vr[0]),
          y = vr[1] + R() * (vr[3] - vr[1]);
        addP({
          t: 1,
          x,
          y,
          z: hAt(x, y) + 30 + R() * 30,
          vx: WIND[0] * 3,
          vy: WIND[1] * 3,
          vz: -4,
          life: 5,
          max: 5,
          c: [70, 66, 64],
          s: 1.2,
          a: 0.7
        });
      }
    }
    if (e.type === 'hlaup') stepHlaup(e, dt);
    if (e.t >= e.life) {
      if (e.type === 'stage' && e.b) wipeB(e.b);
      if (e.type === 'lstorm' && WEATHER_MODE === 'auto') wxTimer = 0;
      ENTS.splice(i, 1);
    }
  }
}
function entDim() {
  let a = 0;
  for (const e of ENTS) if (e.type === 'ash') a = Math.max(a, Math.min(1, e.t / 5, (e.life - e.t) / 5));
  return a;
}
function drawEnts() {
  const k = K;
  for (const e of ENTS) {
    const z = hAt(e.x, e.y);
    if (e.type === 'troll') {
      if (K < DIRECT) drawTroll(e);
    }
    if (e.type === 'ufo') {
      const s = sp_(e.x, e.y, e.z);
      const X = s[0],
        Y = s[1],
        R2 = Math.max(3, k * 9);
      if (X < -60 || X > VW + 60) continue;
      if (e.tgt && e.tgt.state === 0) {
        const g = sp_(e.tgt.cx, e.tgt.cy, e.tgt.z);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(170,255,190,.18)';
        ctx.beginPath();
        ctx.moveTo(X - R2 * 0.5, Y);
        ctx.lineTo(X + R2 * 0.5, Y);
        ctx.lineTo(g[0] + R2 * 1.2, g[1]);
        ctx.lineTo(g[0] - R2 * 1.2, g[1]);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      const gz = sp_(e.x, e.y, z);
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath();
      ctx.ellipse(gz[0], gz[1], R2, R2 * 0.5, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = C_([150, 156, 166], 1);
      ctx.beginPath();
      ctx.ellipse(X, Y, R2, R2 * 0.32, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = C_([110, 116, 126], 1);
      ctx.beginPath();
      ctx.ellipse(X, Y + R2 * 0.08, R2 * 0.8, R2 * 0.18, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(150,230,255,.85)';
      ctx.beginPath();
      ctx.ellipse(X, Y - R2 * 0.2, R2 * 0.38, R2 * 0.26, 0, Math.PI, 0);
      ctx.fill();
      for (let q = 0; q < 6; q++) {
        const a = (q / 6) * 6.283 + e.t * 3;
        ctx.fillStyle = (q + ((e.t * 6) | 0)) % 2 ? '#ffe060' : '#60ff90';
        ctx.fillRect(
          Math.round(X + Math.cos(a) * R2 * 0.8),
          Math.round(Y + Math.sin(a) * R2 * 0.2),
          Math.max(1, (k * 0.5) | 0),
          Math.max(1, (k * 0.5) | 0)
        );
      }
    }
    if (e.type === 'tornado') {
      const s0 = sp_(e.x, e.y, z),
        top = sp_(e.x, e.y, z + 90);
      if (s0[0] < -100 || s0[0] > VW + 100) continue;
      ctx.save();
      const NQ = 40;
      for (let q = 0; q < NQ; q++) {
        const f = q / NQ,
          w = Math.max(2, (2.5 + f * f * 30) * k),
          yy = s0[1] + (top[1] - s0[1]) * f,
          xx = s0[0] + Math.sin(e.t * 2.4 + f * 4) * k * 5 * f;
        const band = 0.5 + 0.5 * Math.sin(f * 40 - e.t * 12);
        ctx.fillStyle = C_([96 + band * 24, 92 + band * 22, 90 + band * 20], 1);
        ctx.globalAlpha = 0.92 - f * 0.25;
        ctx.fillRect(
          Math.round(xx - w / 2),
          Math.round(yy),
          Math.round(w),
          Math.max(1, Math.ceil((s0[1] - top[1]) / NQ) + 1)
        );
      }
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = C_([120, 110, 96], 1);
      ctx.beginPath();
      ctx.ellipse(s0[0], s0[1], 10 * k, 4.5 * k, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    if (e.type === 'light' && e.b.state === 0 && night) {
      const s = sp_(e.b.cx, e.b.cy, e.b.z + e.b.base + 1.5);
      const a = e.t * 0.9;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const L = Math.max(40, k * 160);
      for (const o of [0, Math.PI]) {
        const ex = Math.cos(a + o) * L,
          ey = Math.sin(a + o) * L * 0.5;
        const g = ctx.createLinearGradient(s[0], s[1], s[0] + ex, s[1] + ey);
        g.addColorStop(0, 'rgba(255,250,210,.45)');
        g.addColorStop(1, 'rgba(255,250,210,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(s[0], s[1]);
        ctx.lineTo(s[0] + ex - ey * 0.12, s[1] + ey + ex * 0.12);
        ctx.lineTo(s[0] + ex + ey * 0.12, s[1] + ey - ex * 0.12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#fff8d0';
      ctx.fillRect(Math.round(s[0]) - 1, Math.round(s[1]) - 1, 3, 3);
      ctx.restore();
    }
  }
  const ash = entDim();
  if (ash > 0) {
    ctx.fillStyle = 'rgba(60,56,54,' + ash * 0.45 + ')';
    ctx.fillRect(0, 0, VW, VH);
  }
}
/* ---------- terrain ---------- */
function terrainTool(id, x, y, r, first) {
  switch (id) {
    case 'hay':
      cellsIn(x, y, r, c => {
        const t = gT(c);
        if (!isWaterT(t) && t !== LAVA) setCell(c, HAY, undefined, 1);
      });
      break;
    case 'forest':
      cellsIn(x, y, r, c => {
        const t = gT(c);
        if (!isWaterT(t) && t !== LAVA && t !== GLACIER) setCell(c, WOOD, undefined, 1);
      });
      for (let q = 0; q < (r * r) / 18; q++) {
        const tx = x + (R() - 0.5) * 2 * r,
          ty = y + (R() - 0.5) * 2 * r;
        if (Math.hypot(tx - x, ty - y) > r) continue;
        const c = cellAt(tx, ty);
        if (c < 0 || isWaterT(gT(c))) continue;
        const bb = bldAtCell(c);
        if (bb && bb.state < 2) continue;
        addTree(tx, ty, R() < 0.55 ? 0 : 1);
      }
      break;
    case 'ice':
      cellsIn(x, y, r, c => {
        eachBldInCell(c, wipeB);
        setCell(c, GLACIER, Math.max(2, gH(c) + 1), 1);
      });
      break;
    case 'moss':
      cellsIn(x, y, r, c => {
        if (!isWaterT(gT(c))) setCell(c, ROCK, undefined, 1);
      });
      break;
    case 'scrub':
      cellsIn(x, y, r, c => {
        if (!isWaterT(gT(c))) setCell(c, SCRUB, undefined, 1);
      });
      break;
    case 'mountain':
      cellsIn(x, y, r * 3, (c, d) => {
        const t = gT(c);
        const add = Math.max(0, 1 - d / (r * 3));
        const dh = add * add * 22;
        if (t === SEA && dh < 0.5) return;
        setCell(
          c,
          t === SEA || isWaterT(t) ? SAND : dh > 4 && gH(c) > 500 ? GLACIER : t,
          gH(c) + dh,
          gCov(c)
        );
      });
      reBase(x, y, r * 3);
      break;
    case 'geyser':
    case 'spring':
      if (first) spawnEnt(id, x, y);
      break;
  }
}
/* ---------- disasters ---------- */
function disasterTool(id, x, y) {
  const z = hAt(x, y);
  switch (id) {
    case 'bigbomb':
      explode(x, y, 80, 8);
      for (let q = 0; q < 40; q++)
        addP({
          t: 1,
          x: x + (R() - 0.5) * 20,
          y: y + (R() - 0.5) * 20,
          z: z + 10 + q * 3,
          vx: (R() - 0.5) * 4,
          vy: (R() - 0.5) * 4,
          vz: 8 + R() * 6,
          life: 6,
          max: 6,
          c: [90, 80, 74],
          s: 10,
          a: 0.7
        });
      toast('A huge explosion');
      break;
    case 'sinkhole': {
      const r = 30;
      cellsIn(x, y, r, (c, d) => {
        const nh = gH(c) - 14 * (1 - d / r);
        eachBldInCell(c, b => {
          if (Math.hypot(b.cx - x, b.cy - y) < r * 0.7) wipeB(b);
          else destroyB(b, false, true);
        });
        setCell(c, d < r * 0.7 ? ROCK : RUBBLE, nh, 1);
      });
      nearT(x, y, r, killTree);
      killNear(x, y, r);
      dust(x, y, z, 30, r);
      shake = Math.max(shake, 1);
      reBase(x, y, r);
      toast('Jarðfall · the ground gives way');
      break;
    }
    case 'avalanche': {
      const r = 160;
      let n = 0;
      nearB(x, y, r, b => {
        const d = Math.hypot(b.cx - x, b.cy - y);
        if (b.state < 2 && d < r && R() < 0.8 * (1 - d / r) + 0.2) {
          destroyB(b, false, true);
          n++;
        }
      });
      killNear(x, y, r * 0.8);
      nearT(x, y, r, t => {
        if (R() < 0.7) killTree(t);
      });
      for (let q = 0; q < 160; q++) {
        const a = R() * 6.3,
          d = R() * r;
        addP({
          t: 1,
          x: x + Math.cos(a) * d,
          y: y + Math.sin(a) * d,
          z: hAt(x + Math.cos(a) * d, y + Math.sin(a) * d) + R() * 6,
          vx: (R() - 0.5) * 8,
          vy: (R() - 0.5) * 8,
          vz: 2 + R() * 3,
          life: 3 + R() * 2,
          max: 5,
          c: [240, 244, 248],
          s: 5,
          a: 0.8
        });
      }
      snowAcc = Math.min(0.5, snowAcc + 0.15);
      applySeason(true);
      hazards.push({ x, y, r: r * 2, t: 8, kind: 'snow' });
      shake = Math.max(shake, 1.2);
      toast('Snjóflóð · an avalanche');
      break;
    }
    case 'jokulhlaup':
      ENTS.push({ type: 'hlaup', x, y, t: 0, life: 16, r: 20 });
      toast('Jökulhlaup · a glacial outburst flood');
      break;
    case 'blizzard':
      setWeather('snow', true);
      snowAcc = Math.min(0.5, snowAcc + 0.3);
      windS = 20;
      applySeason(true);
      toast('Stórhríð · a blizzard. Stay home!');
      break;
    case 'lstorm':
    case 'ash':
      spawnEnt(id, x, y);
      break;
    case 'tornado':
      spawnEnt('tornado', x, y);
      break;
  }
}
function stepHlaup(e, dt) {
  e.r += dt * 22;
  const r = e.r;
  cellsIn(e.x, e.y, r, (c, d) => {
    if (d < r - 14) return;
    const t = gT(c);
    if (isWaterT(t) || t === GLACIER) return;
    setCell(c, SAND, gH(c), 1);
  });
  nearB(e.x, e.y, r, b => {
    if (b.state < 2 && Math.abs(Math.hypot(b.cx - e.x, b.cy - e.y) - r) < 16) destroyB(b, false, true);
  });
  killNear(e.x, e.y, r);
  for (let q = 0; q < 10; q++) {
    const a = R() * 6.3,
      x = e.x + Math.cos(a) * r,
      y = e.y + Math.sin(a) * r;
    addP({
      t: 6,
      x,
      y,
      z: hAt(x, y) + 0.5,
      vx: Math.cos(a) * 6,
      vy: Math.sin(a) * 6,
      vz: 4 + R() * 3,
      life: 1.2,
      max: 1.2,
      c: [120, 110, 96],
      s: 1.6
    });
  }
  hazards.push({ x: e.x, y: e.y, r: r + 120, t: 1, kind: 'flood' });
}
/* ---------- people ---------- */
const CROWD_PH = {
  concert: ['Vá!', 'Eitt lag enn!', 'Uppklapp!', 'Geggjað!', 'Ég elska þetta lag'],
  protest: [
    'Burt með spillinguna!',
    'Við viljum breytingar!',
    'Hey hey, ho ho!',
    'Lýðræði!',
    'Nýja stjórnarskrá!'
  ],
  party: ['Skál!', 'Djamm!', 'Hvar er eftirpartýið?', 'Áfram Ísland!'],
  yule: ['Gleðileg jól!', 'Ho ho ho!', 'Hvar eru bjúgun?', 'Má ég fá kerti?'],
  wedding: ['Til hamingju!', 'Skál fyrir brúðhjónunum!', 'Kossinn!']
};
const YULE = [
  'Stekkjastaur',
  'Giljagaur',
  'Stúfur',
  'Þvörusleikir',
  'Pottaskefill',
  'Askasleikir',
  'Hurðaskellir',
  'Skyrgámur',
  'Bjúgnakrækir',
  'Gluggagægir',
  'Gáttaþefur',
  'Ketkrókur',
  'Kertasníkir'
];
function crowd(kind, x, y) {
  if (!PROPS_OK) {
    toast('Still loading');
    return;
  }
  const R0 = kind === 'concert' ? 26 : kind === 'protest' ? 22 : 14,
    ang = roadAngle(x, y);
  const poly = rotPoly(x, y, ang, -R0, R0, -R0 * 0.7, R0 * 0.7);
  const A = mkArea(0, 0, '', poly);
  A.custom = 1;
  A.until = time + 70;
  A.kind = kind;
  const n =
    kind === 'concert' ? 70 : kind === 'protest' ? 45 : kind === 'yule' ? 13 : kind === 'wedding' ? 24 : 28;
  if (kind === 'concert') {
    const s = addInstant(rotPoly(x, y, ang, R0 + 1, R0 + 9, -9, 9), {
      h: 1.2,
      base: 0,
      kind: 8,
      roof: 0,
      sp: 0,
      name: 'Útisvið',
      addr: 'Tónleikar',
      use: 'stage',
      res: 0,
      jobs: 0
    });
    s.wallC = [40, 40, 44];
    s.roofC = [30, 30, 34];
    A.stage = s;
    ENTS.push({ type: 'stage', x: s.cx, y: s.cy, b: s, t: 0, life: 70, ang });
  }
  for (let i = 0; i < n; i++) {
    let px, py;
    for (let q = 0; q < 10; q++) {
      px = x + (R() - 0.5) * R0 * 1.8;
      py = y + (R() - 0.5) * R0 * 1.2;
      if (pip(poly, px, py) && !inBld(px, py)) break;
    }
    const home = randB(x, y, 2000, b => b.res > 0) || { cx: x, cy: y, kind: 0, seed: 0.5, area: 150 };
    const a = mkAgent(kind === 'party' ? 'party' : 'walk', px, py);
    applyLook(
      a,
      mkPersona(
        home,
        kind === 'yule'
          ? 40
          : kind === 'party'
            ? 20 + ((R() * 12) | 0)
            : kind === 'concert'
              ? 16 + ((R() * 30) | 0)
              : undefined
      )
    );
    a.scooter = a.bike = 0;
    a.zone = A;
    a.keep = 1;
    a.zk = 'play';
    a.state = 'zone';
    a.tx = px;
    a.ty = py;
    a.zt = R() * 3;
    A.ag++;
    ZONES.add(A);
    a.crowd = kind;
    if (kind === 'concert') {
      a.act = 'At an outdoor concert';
      a.face = 1;
    }
    if (kind === 'protest') {
      a.act = 'Protesting (mótmæli)';
      a.sign = pickA([
        [240, 240, 236],
        [250, 220, 60],
        [230, 80, 60]
      ]);
    }
    if (kind === 'party') {
      a.act = 'Djamm! Partying in the street';
    }
    if (kind === 'wedding') {
      a.act = i < 2 ? 'Getting married!' : 'Wedding guest';
      if (i === 0) {
        a.shirt = [244, 244, 240];
        a.pants = [244, 244, 240];
        a.coat = null;
        a.long = true;
        a.female = true;
        a.name = pickA(FEMALE) + ' ' + pickA(FATHER) + 'dóttir';
        a.job = 'Bride';
      } else if (i === 1) {
        a.shirt = [30, 32, 40];
        a.pants = [30, 32, 40];
        a.tie = [150, 30, 40];
        a.coat = null;
        a.job = 'Groom';
      } else {
        a.tie = R() < 0.4 ? [60, 60, 120] : null;
      }
    }
    if (kind === 'yule') {
      a.name = YULE[i % 13];
      a.job = 'Jólasveinn · Yule Lad';
      a.act = 'Up to mischief, as Yule Lads are';
      a.shirt = [190, 30, 36];
      a.pants = [190, 30, 36];
      a.coat = null;
      a.hat = [190, 30, 36];
      a.pom = [244, 244, 240];
      a.beard = true;
      a.hair = [240, 240, 236];
      a.sp = 1.2;
    }
    agents.push(a);
  }
  toast(
    kind === 'concert'
      ? 'Tónleikar · an outdoor concert'
      : kind === 'protest'
        ? 'Mótmæli · a protest gathers'
        : kind === 'party'
          ? 'Djamm · a street party'
          : kind === 'yule'
            ? 'The 13 Yule Lads are in town'
            : 'A wedding party'
  );
}
function peopleTool(id, x, y) {
  switch (id) {
    case 'concert':
    case 'protest':
    case 'party':
    case 'yule':
    case 'wedding':
      crowd(id, x, y);
      break;
    case 'marathon': {
      let n = 0;
      for (let q = 0; q < 60 && n < 30; q++) {
        const s = nearestNode(x + (R() - 0.5) * 60, y + (R() - 0.5) * 60, GW, 120),
          t = nearestNode(x + (R() - 0.5) * 1600, y + (R() - 0.5) * 1600, GW, 300);
        if (s < 0 || t < 0) continue;
        const p = astar(GW, s, t, 9000);
        if (!p || p.length < 2) continue;
        const a = mkAgent('jogger', NX[s], NY[s]);
        applyLook(a, mkPersona({ cx: x, cy: y, kind: 0, seed: R(), area: 150 }, 20 + ((R() * 45) | 0)));
        a.scooter = a.bike = 0;
        a.coat = null;
        a.shirt = pickA([
          [240, 80, 120],
          [80, 220, 140],
          [250, 220, 60],
          [60, 160, 240]
        ]);
        a.pants = [30, 30, 34];
        a.sp = 2.6 + R() * 1.4;
        a.path = p;
        a.pi = 0;
        a.loop = true;
        a.act = 'Running the Reykjavíkurmaraþon';
        a.bib = 1;
        setPos(a);
        agents.push(a);
        n++;
      }
      toast('Reykjavíkurmaraþon! ' + n + ' runners');
      break;
    }
    case 'police':
      for (let q = 0; q < 4; q++) {
        const s = nearestNode(x + (R() - 0.5) * 200, y + (R() - 0.5) * 200, GD, 300),
          t = nearestNode(x + (R() - 0.5) * 1200, y + (R() - 0.5) * 1200, GD, 400);
        if (s < 0 || t < 0) continue;
        const p = astar(GD, s, t, 16000);
        if (!p || p.length < 2) continue;
        const a = mkAgent('car', NX[s], NY[s]);
        setVT(a, q % 3 === 2 ? 'amb' : 'police');
        a.siren = 1;
        a.path = p;
        a.pi = 0;
        a.act = 'Responding to a call';
        setPos(a);
        agents.push(a);
      }
      toast('Lögreglan · emergency services on the way');
      break;
    case 'sheep':
    case 'horses': {
      const sp = id === 'sheep' ? 'sheep' : 'horse';
      let lead = null;
      for (let i = 0; i < (sp === 'sheep' ? 14 : 9); i++) {
        const ax = x + (R() - 0.5) * 20,
          ay = y + (R() - 0.5) * 20;
        const a = mkAnimal(sp, ax, ay, false, lead);
        if (lead) {
          a.offx = ax - x;
          a.offy = ay - y;
        } else lead = a;
        a.keepA = 1;
        animals.push(a);
      }
      toast(sp === 'sheep' ? 'A flock of sheep (kindur)' : 'A herd of Icelandic horses');
      break;
    }
    case 'evacuate':
      hazards.push({ x, y, r: 400, t: 10, kind: 'evac' });
      toast('Evacuation! Everyone leaves the area');
      break;
  }
}
