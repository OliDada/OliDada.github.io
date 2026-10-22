/**
 * Geothermal and waterfalls
 *
 * Geysers, hot springs, steam plumes and waterfalls carved into the terrain (geo.txt).
 *
 * Functions: fetchGeo, initGeo, geoIn, gz, stepGeo, fallBase, drawGeo, fallGeom, carveFalls, placeFall,
 *     recarveLoadedTiles, drawFall, geoCard
 * State and constants: GEO, GEOB, GEO_BASE, GEOFACT, ss01
 */

let GEO = [],
  GEOB = new Map(),
  GEO_BASE = 0;
async function fetchGeo() {
  try {
    const r = await fetch('geo.txt');
    if (!r.ok) return null;
    const b = atob((await r.text()).trim());
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return JSON.parse(
      await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    );
  } catch (e) {
    console.warn('geo', e);
    return null;
  }
}
const GEOFACT = {
  'Strokkur':
    'Erupts every few minutes, usually 15–20 m high and sometimes up to 40 m. A blue dome of water bulges up just before it bursts.',
  'Stóri Geysir':
    'The geyser that gave all geysers their name. It is mostly quiet now and erupts only rarely, often after earthquakes; in its prime it reached about 70 m.',
  'Hverasvæði': 'The hot-spring park in Hveragerði, where the ground steams in the middle of town.',
  'Hellisheiðarvirkjun':
    "One of the world's largest geothermal power plants, giving Reykjavík electricity and hot water.",
  'Nesjavellir': 'Geothermal power plant by Þingvallavatn; its hot water is piped 27 km to Reykjavík.',
  'Svartsengisvirkjun': 'The geothermal plant beside the Blue Lagoon, whose milky-blue water comes from it.',
  'Reykjanesvirkjun': 'Geothermal plant at the tip of the Reykjanes peninsula.',
  'Kröflustöð': 'Geothermal plant at the Krafla volcano in the north.',
  'Þeistareykjavirkjun': 'Geothermal plant in the highlands of the north-east.'
};
function initGeo(raw) {
  if (!raw) return;
  GEO = [];
  for (const r of raw) {
    const g = { x: r[0], y: r[1], k: r[2], name: r[3] || '', geo: 1, id: GEO.length };
    if (g.k === 'fall') {
      g.H = r[4];
      g.W = r[5];
      g.dx = r[6];
      g.dy = r[7];
      if (!g.dx && !g.dy) {
        g.dx = 0;
        g.dy = 1;
      }
    }
    if (g.k === 'geyser') {
      g.pool = g.name === 'Stóri Geysir' ? 9 : g.name === 'Strokkur' ? 6 : 3;
      g.next = 10 + R() * 30;
      g.rare = g.name === 'Stóri Geysir';
    }
    if (g.k === 'hot') {
      g.pool = /Blesi|Bláhver|Konungshver/.test(g.name) ? 3.5 : 1.8 + h32(r[0] | 0, r[1] | 0, 3) * 1.5;
      g.blue = /Blesi|Bláhver|Grænihver/.test(g.name);
    }
    g.z = null;
    GEO.push(g);
    badd(GEOB, bkey(g.x, g.y), g);
  }
  console.log('geo features', GEO.length);
  GEO_BASE = GEO.length;
  recarveLoadedTiles();
  // river lines that cross a waterfall are drawn in two pieces: down to the lip, and on from the plunge pool
  let ns = 0;
  for (const g of GEO) {
    if (g.k !== 'fall' || g.H < 4 || inF(g.x, g.y)) continue;
    fallGeom(g);
    const nx = -g.dy,
      ny = g.dx;
    eachB2(SBUCK, g.x - 150, g.y - 150, g.x + 150, g.y + 150, (w, j) => {
      const wy = WAYS[w];
      if (wy.cl !== 10) return;
      const a = wy.nodes[j],
        b = wy.nodes[j + 1];
      const ua = (NX[a] - g.x) * g.dx + (NY[a] - g.y) * g.dy,
        ub = (NX[b] - g.x) * g.dx + (NY[b] - g.y) * g.dy;
      if (ua * ub >= 0) return;
      const t = ua / (ua - ub),
        cx = NX[a] + (NX[b] - NX[a]) * t,
        cy = NY[a] + (NY[b] - NY[a]) * t;
      if (Math.abs((cx - g.x) * nx + (cy - g.y) * ny) > g.Lc) return;
      if (!wy.fs) wy.fs = new Map();
      wy.fs.set(j, { g, up: ua < 0 ? a : b, cx, cy });
      ns++;
    });
  }
  if (ns) console.log('river lines split at falls', ns);
}
function geoIn(x0, y0, x1, y1, fn) {
  for (const g of GEO) if (g.x >= x0 && g.x <= x1 && g.y >= y0 && g.y <= y1) fn(g);
}
function gz(g) {
  if (g.z === null) g.z = hAt(g.x, g.y);
  return g.z;
}
function stepGeo(dt) {
  if (!GEO.length || !dt) return;
  const vr = viewRect(300),
    wx = WIND[0] * windS * 0.5,
    wy = WIND[1] * windS * 0.5,
    cold = Math.max(0.4, Math.min(1.5, (12 - TEMP) / 10));
  geoIn(vr[0], vr[1], vr[2], vr[3], g => {
    const z = gz(g);
    if (g.k === 'geyser') {
      g.next -= dt;
      if (g.dome > 0) {
        g.dome -= dt;
        if (g.dome <= 0) g.erupt = g.big ? 4 : 2.4;
      } else if (g.erupt > 0) {
        g.erupt -= dt;
        const big = g.big,
          n = big ? 26 : 18;
        for (let q = 0; q < n; q++) {
          const v = (big ? 28 : 16) + R() * (big ? 8 : 7) * (g.h40 ? 1.6 : 1);
          addP({
            t: 6,
            x: g.x + (R() - 0.5) * 2,
            y: g.y + (R() - 0.5) * 2,
            z: z + 0.5,
            vx: (R() - 0.5) * 2.2 + wx * 0.4,
            vy: (R() - 0.5) * 2.2 + wy * 0.4,
            vz: v,
            life: (v / 9.8) * 2,
            max: (v / 9.8) * 2,
            c: [230, 240, 250],
            s: 1.4
          });
        }
        for (let q = 0; q < 3; q++)
          addP({
            t: 1,
            x: g.x + (R() - 0.5) * 4,
            y: g.y + (R() - 0.5) * 4,
            z: z + R() * (big ? 50 : 18),
            vx: wx,
            vy: wy,
            vz: 3 + R() * 3,
            life: 6,
            max: 6,
            c: [244, 246, 250],
            s: big ? 9 : 6,
            a: 0.65
          });
      } else {
        if (R() < dt * (g.rare ? 3 : 1.5) * cold)
          addP({
            t: 1,
            x: g.x + (R() - 0.5) * g.pool,
            y: g.y + (R() - 0.5) * g.pool,
            z: z + 0.3,
            vx: wx,
            vy: wy,
            vz: 1.5 + R() * 1.5,
            life: 4,
            max: 4,
            c: [238, 242, 246],
            s: g.rare ? 5 : 3,
            a: 0.5
          });
        if (g.next <= 0) {
          if (g.rare) {
            g.next = 60 + R() * 120;
            if (h32(Math.floor(gameMin / 1440), g.id, 9) < 0.04 && (gameMin % 1440) / 60 > 12 && !g.done) {
              g.done = Math.floor(gameMin / 1440);
              g.big = 1;
              g.dome = 0.8;
              toast('Geysir is erupting!');
            }
          } else {
            g.next = 25 + R() * 45;
            g.big = 0;
            g.h40 = R() < 0.12;
            g.dome = 0.7;
          }
        }
      }
    } else if (g.k === 'hot') {
      if (R() < dt * (g.pool > 3 ? 3 : 1.2) * cold)
        addP({
          t: 1,
          x: g.x + (R() - 0.5) * g.pool,
          y: g.y + (R() - 0.5) * g.pool,
          z: z + 0.2,
          vx: wx,
          vy: wy,
          vz: 1.2 + R(),
          life: 3.5,
          max: 3.5,
          c: [238, 242, 246],
          s: 3,
          a: 0.45
        });
    } else if (g.k === 'fum') {
      if (R() < dt * 3 * cold)
        addP({
          t: 1,
          x: g.x + (R() - 0.5) * 2,
          y: g.y + (R() - 0.5) * 2,
          z: z + 0.3,
          vx: wx + (R() - 0.5),
          vy: wy + (R() - 0.5),
          vz: 4 + R() * 3,
          life: 4,
          max: 4,
          c: [240, 242, 244],
          s: 3.5,
          a: 0.55
        });
    } else if (g.k === 'plant') {
      for (let s = 0; s < 4; s++)
        if (R() < dt * 2.2) {
          const ox = (h32(g.id, s, 1) - 0.5) * 240,
            oy = (h32(g.id, s, 2) - 0.5) * 240;
          addP({
            t: 1,
            x: g.x + ox,
            y: g.y + oy,
            z: hAt(g.x + ox, g.y + oy) + 12,
            vx: wx * 1.4,
            vy: wy * 1.4,
            vz: 5 + R() * 4,
            life: 14,
            max: 14,
            c: [246, 248, 250],
            s: 30,
            a: 0.55
          });
        }
    } else if (g.k === 'fall' && K >= 0.25) {
      const rate = Math.min(10, (g.W * g.H) / 120 + 0.6);
      if (R() < dt * rate) {
        const s = (R() - 0.5) * g.W;
        addP({
          t: 1,
          x: g.x + g.dx * (2 + R() * 3) - g.dy * s,
          y: g.y + g.dy * (2 + R() * 3) + g.dx * s,
          z: fallBase(g) + 0.5,
          vx: wx * 0.5 + g.dx * 1.5,
          vy: wy * 0.5 + g.dy * 1.5,
          vz: 1.5 + R() * 2,
          life: 3,
          max: 3,
          c: [236, 242, 248],
          s: Math.min(8, 2 + g.H / 12),
          a: 0.5
        });
      }
    }
  });
}
function fallBase(g) {
  if (inF(g.x, g.y)) return hAt(g.x + g.dx * 6, g.y + g.dy * 6);
  fallGeom(g);
  return g.zb;
}
function drawGeo() {
  if (!GEO.length || K < 0.12) return;
  const vr = viewRect(200),
    k = K;
  const P = (x, y, z) => [PXw(x, y) * k - cx0, (PYw(x, y) - z) * k - cy0];
  const disc = (x, y, z, r, col, sq) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * 6.283;
      const p = P(x + Math.cos(a) * r, y + Math.sin(a) * r * (sq || 1), z);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.fill();
  };
  const quad = (pts, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    pts.forEach((q, i) => {
      const p = P(q[0], q[1], q[2]);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fill();
  };
  geoIn(vr[0], vr[1], vr[2], vr[3], g => {
    const z = gz(g);
    if (g.k === 'geyser' || g.k === 'hot') {
      const r = g.pool;
      if (g.k === 'geyser') {
        disc(g.x, g.y, z + 0.02, r * 2.4, C_([196, 190, 170], 1));
        disc(g.x + r * 0.3, g.y - r * 0.2, z + 0.03, r * 1.5, C_([214, 206, 184], 1));
      } else disc(g.x, g.y, z + 0.02, r * 1.5, C_([200, 180, 140], 1));
      disc(g.x, g.y, z + 0.04, r, C_(g.k === 'geyser' || g.blue ? [54, 170, 200] : [120, 150, 140], 1));
      disc(g.x, g.y, z + 0.05, r * 0.45, C_(g.k === 'geyser' || g.blue ? [30, 120, 170] : [90, 120, 110], 1));
      if (g.dome > 0) {
        const h = (1 - g.dome / 0.8) * 2.2;
        disc(g.x, g.y, z + 0.05 + h, r * 0.8, 'rgba(70,170,220,.85)');
      }
      if (g.k === 'geyser' && g.erupt > 0 && k >= 0.4) {
        const hh = (g.big ? 50 : 16) * Math.min(1, (g.big ? 4 : 2.4) - g.erupt + 0.3);
        const a = P(g.x, g.y, z),
          b = P(g.x, g.y, z + hh);
        ctx.strokeStyle = 'rgba(236,244,250,.8)';
        ctx.lineWidth = Math.max(2, k * r * 0.6);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
    } else if (g.k === 'fall') {
      if (g.H * k < 3 && g.W * k < 3) return;
      drawFall(g, P, quad, disc);
    }
  });
}
/* waterfalls are cut into the terrain itself: the ground upstream is lifted to the lip, the ground below is dropped to the
   plunge pool, and the step between them becomes a rock face — so the falls sit in real cliffs instead of on props */
function fallGeom(g) {
  if (g.zt !== undefined) return;
  {
    const a = hInterp(g.x - g.dx * 120, g.y - g.dy * 120),
      b = hInterp(g.x + g.dx * 120, g.y + g.dy * 120);
    if (b > a + 3) {
      g.dx = -g.dx;
      g.dy = -g.dy;
    }
  } // rivers run downhill
  const up = hInterp(g.x - g.dx * 40, g.y - g.dy * 40),
    dn = hInterp(g.x + g.dx * 40, g.y + g.dy * 40);
  g.zb = Math.max(1, Math.min(dn, up - g.H * 0.3));
  g.zt = Math.max(g.zb + g.H, up > g.zb + g.H * 1.4 ? g.zb + g.H : g.zb + g.H);
  g.Lc = g.W / 2 + g.H * 1.1 + 20;
  g.Lp = g.H * 1.2 + 25;
  g.Lt = g.H * 2.2 + 40;
  g.Ld = Math.max(30, g.W * 0.6 + g.H * 0.4);
  g.R = Math.hypot(g.Lc + g.Lt, g.Lp + g.Lt);
}
const ss01 = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
function carveFalls(t) {
  if (!GEO.length) return;
  const x0 = t.ox,
    y0 = t.oy,
    x1 = x0 + DT * DCS,
    y1 = y0 + DT * DCS;
  let any = false;
  for (const g of GEO) {
    if (g.k !== 'fall' || g.H < 4) continue;
    if (inF(g.x, g.y)) continue;
    fallGeom(g);
    if (g.x + g.R < x0 || g.x - g.R > x1 || g.y + g.R < y0 || g.y - g.R > y1) continue;
    const nx = -g.dy,
      ny = g.dx;
    const a0 = Math.max(0, Math.floor((g.x - g.R - x0) / DCS)),
      a1 = Math.min(DT - 1, Math.floor((g.x + g.R - x0) / DCS)),
      b0 = Math.max(0, Math.floor((g.y - g.R - y0) / DCS)),
      b1 = Math.min(DT - 1, Math.floor((g.y + g.R - y0) / DCS));
    for (let b = b0; b <= b1; b++)
      for (let a = a0; a <= a1; a++) {
        const i = a + b * DT;
        if (t.GT[i] === SEA || t.GT[i] === GLACIER) continue;
        const x = x0 + (a + 0.5) * DCS,
          y = y0 + (b + 0.5) * DCS;
        const u = (x - g.x) * g.dx + (y - g.y) * g.dy,
          v = Math.abs((x - g.x) * nx + (y - g.y) * ny);
        const side = 1 - ss01((v - g.Lc) / g.Lt);
        if (side <= 0) continue;
        if (u < 0) {
          const f = side * (1 - ss01((-u - g.Lp) / g.Lt));
          if (f <= 0) continue;
          const want = g.zb + g.H * f;
          if (t.HT[i] < want) {
            t.HT[i] = Math.round(want);
            any = true;
          }
          if (-u < 10 && v < g.Lc) t.GT[i] = ROCK;
        } else {
          const f = side * (1 - ss01((u - g.Ld) / (g.Ld + 20)));
          if (f <= 0) continue;
          const want = g.zb + (t.HT[i] - g.zb) * (1 - f);
          if (t.HT[i] > want) {
            t.HT[i] = Math.round(Math.max(g.zb, want));
            any = true;
          }
          if (u < 10 && v < g.Lc) t.GT[i] = ROCK;
        }
      }
  }
  return any;
}
function placeFall(x, y) {
  if (inF(x, y)) {
    toast('Waterfalls can go anywhere outside the capital area');
    return;
  }
  let dx = hAt(x - 20, y) - hAt(x + 20, y),
    dy = hAt(x, y - 20) - hAt(x, y + 20);
  let L = Math.hypot(dx, dy);
  if (L < 0.5) {
    const a = R() * 6.283;
    dx = Math.cos(a);
    dy = Math.sin(a);
    L = 1;
  }
  const g = {
    x,
    y,
    k: 'fall',
    name: '',
    geo: 1,
    id: GEO.length,
    H: 25,
    W: 12,
    dx: dx / L,
    dy: dy / L,
    z: null
  };
  GEO.push(g);
  fallGeom(g);
  for (const t of TILES.values()) {
    if (carveFalls(t)) t.mod = true;
  }
  CACHE.clear();
  cachePx = 0;
  nearB(x, y, g.R + 60, b => {
    const nz = hAt(b.cx, b.cy);
    if (nz !== b.z) {
      b.z = nz;
      dirtyB(b);
    }
  });
  toast('Foss · a new waterfall');
}
function recarveLoadedTiles() {
  let n = 0;
  for (const t of TILES.values())
    if (carveFalls(t)) {
      n++;
      eachB(BBUCK, t.ox, t.oy, t.ox + DT * DCS, t.oy + DT * DCS, b => {
        if (!inF(b.cx, b.cy)) {
          b.z = dz(t, b.cx, b.cy);
          dirtyB(b);
        }
      });
    }
  if (n) {
    CACHE.clear();
    cachePx = 0;
  }
}
function drawFall(g, P, quad, disc) {
  const k = K;
  fallGeom(g);
  const dx = g.dx,
    dy = g.dy,
    nx = -dy,
    ny = dx,
    hw = g.W / 2;
  let zt, zb;
  if (inF(g.x, g.y)) {
    zb = hAt(g.x + dx * 6, g.y + dy * 6);
    zt = zb + g.H;
  } else {
    zt = hAt(g.x - dx * 9, g.y - dy * 9);
    zb = Math.min(hAt(g.x + dx * 9, g.y + dy * 9), zt - 1);
  }
  const L = (s, o, z) => [g.x + nx * s + dx * o, g.y + ny * s + dy * o, z];
  const faceVis = faces(dx, dy) > 0;
  // plunge pool and foam
  disc(g.x + dx * (hw * 0.5 + 10), g.y + dy * (hw * 0.5 + 10), zb + 0.3, hw + 4, 'rgba(80,140,165,.9)', 0.7);
  disc(g.x + dx * 9, g.y + dy * 9, zb + 0.5, hw * 0.9 + 2, 'rgba(240,246,250,.85)', 0.6);
  // the falling water, hugging the rock face from the lip down to the pool
  const oT = -8,
    oB = 8;
  quad(
    [L(-hw, oB, zb), L(hw, oB, zb), L(hw * 0.9, oT, zt), L(-hw * 0.9, oT, zt)],
    faceVis ? 'rgba(222,238,246,.93)' : 'rgba(222,238,246,.8)'
  );
  const ns = Math.max(2, Math.min(30, Math.round((g.W * k) / 3)));
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  ctx.lineWidth = Math.max(1, k * 0.4);
  for (let i = 0; i < ns; i++) {
    const s = -hw + ((i + 0.5) * g.W) / ns,
      ph = h32(g.id, i, 5),
      sp = 1.2 + ph * 0.6;
    for (let j = 0; j < 2; j++) {
      const t1 = (time * sp + ph + j * 0.5) % 1,
        t2 = Math.min(1, t1 + 0.18);
      const a = P(...L(s * (1 - 0.1 * (1 - t1)), oT + (oB - oT) * t1, zt - (zt - zb) * t1)),
        b = P(...L(s * (1 - 0.1 * (1 - t2)), oT + (oB - oT) * t2, zt - (zt - zb) * t2));
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }
  quad(
    [
      L(-hw * 0.9, oT - 1, zt + 0.3),
      L(hw * 0.9, oT - 1, zt + 0.3),
      L(hw * 0.9, oT, zt - 0.4),
      L(-hw * 0.9, oT, zt - 0.4)
    ],
    'rgba(255,255,255,.9)'
  );
}
function geoCard(g) {
  const T = {
    geyser: ['Goshver', 'Geyser'],
    hot: ['Hver', 'Hot spring'],
    fum: ['Gufuhver', 'Fumarole'],
    plant: ['Jarðvarmavirkjun', 'Geothermal power plant'],
    fall: ['Foss', 'Waterfall']
  }[g.k];
  const act =
    g.k === 'geyser'
      ? g.erupt > 0
        ? 'Erupting!'
        : g.dome > 0
          ? 'The water is bulging up…'
          : g.rare
            ? 'Steaming quietly'
            : 'Building up pressure'
      : g.k === 'fall'
        ? 'Falling ' + Math.round(g.H) + ' m'
        : g.k === 'plant'
          ? 'Making power and hot water'
          : 'Steaming';
  return {
    h:
      '<h3>' +
      (g.name || T[0]) +
      '</h3><div class="sub">' +
      T[0] +
      ' · ' +
      T[1] +
      '</div><div class="act">' +
      act +
      '</div>' +
      (g.k === 'fall'
        ? '<div class="row"><span>Height</span><span>' +
          Math.round(g.H) +
          ' m</span></div><div class="row"><span>Width</span><span>about ' +
          Math.round(g.W) +
          ' m</span></div>'
        : '') +
      '<div class="row"><span>Area</span><span>' +
      placeName(g.x, g.y) +
      '</span></div>' +
      (GEOFACT[g.name]
        ? '<p class="fact" style="margin:.5em 0 0;font-size:12px;opacity:.85">' + GEOFACT[g.name] + '</p>'
        : '') +
      (follow === g ? '' : '<button class="btn" id="dofollow">Look here</button>'),
    m: (g.name || T[1]) + ' · ' + act
  };
}
