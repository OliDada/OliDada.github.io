/**
 * More OSM details
 *
 * Lighthouses and sea lights, greenhouses, masts, EV chargers, hydrants, viewpoints, cliffs, streams and
 * opening hours (extra.txt).
 *
 * Functions: fetchExtra, xAddPt, xVis, initExtra, ohOpen, ohRow, lightState, lightTop, drawExtraTall,
 *     drawMast, extraItems, drawExtraTallAll, drawExtraGround, drawLandLines, drawNightLights,
 *     nearHydrant, drawHoses, stepViewpoints, extraCard
 * State and constants: LH, MASTS, EVC, HYD, VPS, CLIFFS, STRM, XB, XSB, GHB, VPAG, vpAcc, LCOL, OHD
 */

/* ================= more from OpenStreetMap: lighthouses and sea lights, greenhouses, masts, EV chargers, fire hydrants,
   viewpoints, cliffs, streams and opening hours ================= */
let LH = [],
  MASTS = [],
  EVC = [],
  HYD = [],
  VPS = [],
  CLIFFS = [],
  STRM = [],
  XB = new Map(),
  XSB = new Map(),
  GHB = [],
  VPAG = new Map(),
  vpAcc = 0;
async function fetchExtra() {
  try {
    const r = await fetch('extra.txt');
    if (!r.ok) return null;
    const b = atob((await r.text()).trim());
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return JSON.parse(
      await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    );
  } catch (e) {
    console.warn('extra', e);
    return null;
  }
}
const LCOL = {
  white: [255, 246, 220],
  red: [255, 60, 50],
  green: [70, 255, 120],
  yellow: [255, 220, 80],
  blue: [90, 150, 255]
};
function xAddPt(o) {
  const k = Math.floor(o.x / IFC) * 100003 + Math.floor(o.y / IFC);
  let a = XB.get(k);
  if (!a) XB.set(k, (a = []));
  a.push(o);
}
function xVis(vr, fn) {
  const i0 = Math.floor(vr[0] / IFC),
    i1 = Math.floor(vr[2] / IFC),
    j0 = Math.floor(vr[1] / IFC),
    j1 = Math.floor(vr[3] / IFC);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 40000) return;
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const a = XB.get(i * 100003 + j);
      if (a) for (const o of a) fn(o);
    }
}
function initExtra(d) {
  if (!d) return;
  const bAt = (x, y) => {
    let r = null;
    nearB(x, y, 60, b => {
      if (!r && b.state < 9 && x >= b.minx && x <= b.maxx && y >= b.miny && y <= b.maxy && pip(b.poly, x, y))
        r = b;
    });
    return r;
  };
  // lights: a lighthouse sits on its building when there is one, otherwise it gets its own white tower
  const mkL = (x, y, col, ch, per, grp, rng, ht) => {
    const cols = (col || 'white').split(/[;:]/).map(c => LCOL[c] || LCOL.white);
    return {
      x,
      y,
      cols,
      ch: ch || '',
      per: per || 0,
      grp: parseInt(grp) || 1,
      rng: rng || 0,
      ht: ht || 0,
      seed: h32(x | 0, y | 0, 41)
    };
  };
  for (const r of d.lh || []) {
    const x = r[0] / 2,
      y = r[1] / 2;
    const L = mkL(x, y, r[4], r[5] || 'Fl', r[6] || 10, r[7], r[8], r[9]);
    L.kind = 'lh';
    L.name = r[3] || 'Viti';
    const b = bAt(x, y);
    if (b) {
      L.b = b;
      b.lhouse = L;
    } else L.h = r[2] > 3 && r[2] < 60 ? r[2] : 12;
    L.lh = 1;
    LH.push(L);
    xAddPt(L);
  }
  for (const r of d.sl || []) {
    const x = r[0] / 2,
      y = r[1] / 2;
    if (LH.some(L => L.lh && Math.abs(L.x - x) < 40 && Math.abs(L.y - y) < 40)) continue;
    const L = mkL(x, y, r[2], r[3], r[4], r[5], r[6], r[7]);
    L.kind = 'sl';
    L.h = Math.max(3, Math.min(12, L.ht || 5));
    const b = bAt(x, y);
    if (b) L.b = b;
    LH.push(L);
    xAddPt(L);
  }
  for (const r of d.ms || []) {
    const x = r[0] / 2,
      y = r[1] / 2;
    const m = {
      kind: 'ms',
      x,
      y,
      h: r[2] > 8 && r[2] < 500 ? r[2] : r[3] ? 36 : 60,
      tower: r[3] === 1,
      name: r[4] || '',
      tt: r[5] || '',
      seed: h32(x | 0, y | 0, 43)
    };
    if (m.tower && bAt(x, y)) continue;
    MASTS.push(m);
    xAddPt(m);
  }
  for (const r of d.ev || []) {
    const e = { kind: 'ev', x: r[0] / 2, y: r[1] / 2, n: r[2], op: r[3] };
    EVC.push(e);
    xAddPt(e);
  }
  for (const r of d.hy || []) {
    const e = { kind: 'hy', x: r[0] / 2, y: r[1] / 2 };
    HYD.push(e);
    xAddPt(e);
  }
  for (const r of d.vp || []) {
    const e = { kind: 'vp', x: r[0] / 2, y: r[1] / 2, name: r[2] || '', id: VPS.length };
    VPS.push(e);
    xAddPt(e);
  }
  // greenhouses: glass roofs by day, grow lights glowing orange through the winter dark
  for (const [land, a] of d.gh || []) {
    const n = a.length / 2;
    const P = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) P[i] = a[i] / 2;
    let cx = 0,
      cy = 0;
    for (let i = 0; i < n; i++) {
      cx += P[2 * i];
      cy += P[2 * i + 1];
    }
    cx /= n;
    cy /= n;
    if (!land) {
      let b = bAt(cx, cy);
      // greenhouses OSM has but the building set lacks are put up here, low glass halls with a pitched roof
      if (!b && n >= 4) {
        let ar = 0;
        for (let i = 0; i < n; i++) {
          const q = (i + 1) % n;
          ar += P[2 * i] * P[2 * q + 1] - P[2 * q] * P[2 * i + 1];
        }
        if (Math.abs(ar / 2) >= 20) {
          b = addInstant(P, {
            h: 3.4,
            base: 0,
            kind: 5,
            roof: 9,
            rs: 'gable',
            rp: 0.32,
            sp: 0,
            name: 'Gróðurhús',
            addr: '',
            use: 'greenhouse',
            res: 0,
            jobs: 2
          });
          b.isNew = 0;
          b.z = hAt(b.cx, b.cy);
          b.ghNew = 1;
        }
      }
      if (b && !b.gh) {
        b.gh = 1;
        GHB.push(b);
      }
    } else {
      let r = 0;
      for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(P[2 * i] - cx, P[2 * i + 1] - cy));
      nearB(cx, cy, r + 20, b => {
        if (!b.gh && b.state < 9 && pip(P, b.cx, b.cy) && b.h < 9) {
          b.gh = 1;
          GHB.push(b);
        }
      });
    }
  }
  for (const b of GHB) {
    if (!b.roofC || b.roof !== 1) {
      b.roofC = [206, 222, 222];
    }
    b.wallC = [196, 214, 214];
    b.glass = 1;
    dirtyB(b);
  }
  for (const b of GHB) {
    const e = { kind: 'gh', x: b.cx, y: b.cy, b };
    xAddPt(e);
  }
  // cliffs and streams are long lines, bucketed by segment
  const line = (a, dlt) => {
    const n = a.length / 2,
      xs = new Float32Array(n),
      ys = new Float32Array(n);
    let x = 0,
      y = 0;
    for (let i = 0; i < n; i++) {
      if (dlt && i) {
        x += a[2 * i] / 2;
        y += a[2 * i + 1] / 2;
      } else {
        x = a[2 * i] / 2;
        y = a[2 * i + 1] / 2;
      }
      xs[i] = x;
      ys[i] = y;
    }
    return { xs, ys, n };
  };
  for (const a of d.cf || []) {
    const o = line(a, 0);
    o.id = CLIFFS.length;
    CLIFFS.push(o);
    for (let i = 0; i + 1 < o.n; i++) ifAdd(o.xs[i], o.ys[i], o.xs[i + 1], o.ys[i + 1], o.id * 1e5 + i, XSB);
  }
  for (const a of d.wt || []) {
    const o = line(a, d.wtd);
    o.id = STRM.length;
    STRM.push(o);
    for (let i = 0; i + 1 < o.n; i++)
      ifAdd(o.xs[i], o.ys[i], o.xs[i + 1], o.ys[i + 1], (1e4 + o.id) * 1e5 + i, XSB);
  }
  // opening hours go to the building the shop or café is in (or the nearest one with the same name)
  for (const [x2, y2, name, oh] of d.oh || []) {
    const x = x2 / 2,
      y = y2 / 2;
    let b = bAt(x, y);
    if (!b) {
      b = nearBld(x, y, 60, o => o.name === name);
    }
    if (!b) b = nearBld(x, y, 25, () => true);
    if (b && !b.oh) {
      b.oh = oh;
      if (!b.name && name) b.ohName = name;
    }
  }
  console.log(
    'extra',
    LH.length,
    'lights',
    MASTS.length,
    'masts',
    GHB.length,
    'greenhouses',
    STRM.length,
    'streams'
  );
}
/* ---- opening hours: the common OSM forms ("Mo-Fr 08:00-18:00; Sa 10:00-16:00", "24/7", "Su off") ---- */
const OHD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function ohOpen(str, dow, min) {
  if (!str) return null;
  str = str.trim();
  if (str === '24/7') return { open: true, until: null };
  let res = null,
    known = false;
  for (let rule of str.split(';')) {
    rule = rule.trim();
    if (!rule || /^PH|^SH/.test(rule)) continue;
    let m = rule.match(/^((?:[A-Z][a-z](?:-[A-Z][a-z])?,?\s*)+)\s+(.*)$/);
    let days, times;
    if (m) {
      days = m[1];
      times = m[2];
    } else if (/^\d/.test(rule)) {
      days = 'Mo-Su';
      times = rule;
    } else continue;
    const set = new Set();
    for (const part of days.split(',')) {
      const p = part.trim();
      const r = p.split('-');
      const a = OHD.indexOf(r[0]),
        b = r[1] ? OHD.indexOf(r[1]) : a;
      if (a < 0 || b < 0) continue;
      for (let i = a; ; i = (i + 1) % 7) {
        set.add(i);
        if (i === b) break;
      }
    }
    if (!set.has(dow)) continue;
    known = true;
    if (/off|closed/.test(times)) {
      res = { open: false };
      continue;
    }
    res = { open: false };
    for (const t of times.split(',')) {
      const q = t.trim().match(/(\d{1,2}):(\d\d)\s*-\s*(\d{1,2}):(\d\d)/);
      if (!q) continue;
      const s0 = +q[1] * 60 + +q[2];
      let e = +q[3] * 60 + +q[4];
      if (e <= s0) e += 1440;
      if ((min >= s0 && min < e) || min + 1440 < e) {
        res = { open: true, until: e % 1440 };
      }
    }
  }
  return known ? res : null;
}
function ohRow(b) {
  const m = gameMin % 1440,
    r = ohOpen(b.oh, dayOfWeek(), m);
  const hh = v => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
  const now = r
    ? r.open
      ? '<b style="color:#7fd88a">Opið · open</b>' +
        (r.until !== null && r.until !== undefined ? ' until ' + hh(r.until) : '')
      : '<b style="color:#f08080">Lokað · closed</b>'
    : '—';
  return (
    '<div class="row"><span>Opening hours</span><span>' +
    b.oh.replace(/;/g, '; ').replace(/</g, '') +
    '</span></div><div class="row"><span>Now</span><span>' +
    now +
    '</span></div>'
  );
}
/* ---- light characters: Fl (flashing), LFl (long flash), Oc (occulting), Iso, Q (quick), F (fixed), Al (alternating) ---- */
function lightState(L, t) {
  const ch = L.ch,
    P = L.per || (ch.startsWith('Q') ? 1 : ch.startsWith('VQ') ? 0.5 : 5),
    g = L.grp || 1,
    ph = (((t + L.seed * P) % P) + P) % P;
  let on = true,
    ci = 0;
  if (/^F$/.test(ch)) {
    on = true;
  } else if (/Iso/.test(ch)) {
    on = ph < P / 2;
  } else if (/Oc/.test(ch)) {
    on = true;
    for (let i = 0; i < g; i++) {
      const s = P - 1.2 * (g - i);
      if (ph >= s && ph < s + 0.8) on = false;
    }
  } else if (/^V?Q/.test(ch)) {
    on = ph < P * 0.35;
  } else if (/Mo/.test(ch)) {
    on = ph < 0.4 || (ph > 0.9 && ph < 2.1);
  } else {
    const fl = /LFl/.test(ch) ? 2 : 0.5;
    on = false;
    for (let i = 0; i < g; i++) {
      const s = i * (fl + 1);
      if (ph >= s && ph < s + fl) {
        on = true;
        ci = i;
      }
    }
  }
  if (/Al/.test(ch)) ci = Math.floor((t + L.seed * P) / P) % L.cols.length;
  return on ? L.cols[Math.min(ci, L.cols.length - 1)] : null;
}
function lightTop(L) {
  return L.b ? L.b.z + L.b.base + L.b.h + (L.lh ? 0.6 : 0.3) : hAt(L.x, L.y) + L.h;
}
/* towers drawn up close: a white lighthouse with a red lantern room, harbour light posts, and red-and-white radio masts */
function drawExtraTall(it) {
  const k = K,
    o = it;
  if (o.kind === 'ms') return drawMast(o);
  if (o.b) return;
  const z = hAt(o.x, o.y),
    h = o.h,
    a = sp_(o.x, o.y, z),
    b = sp_(o.x, o.y, z + h);
  const w = Math.max(1, Math.round(k * (o.lh ? 2.6 : 0.5)));
  ctx.fillStyle = C_(o.lh ? [240, 240, 236] : [60, 64, 70], 1);
  ctx.fillRect(Math.round(a[0] - w / 2), Math.round(b[1]), w, Math.max(1, Math.round(a[1] - b[1])));
  if (o.lh && k >= 0.6) {
    ctx.fillStyle = C_([226, 226, 222], 1);
    ctx.fillRect(
      Math.round(a[0]),
      Math.round(b[1]),
      Math.max(1, Math.round(w / 2)),
      Math.max(1, Math.round(a[1] - b[1]))
    );
    ctx.fillStyle = C_([200, 40, 36], 1);
    ctx.fillRect(
      Math.round(a[0] - w / 2 - k * 0.2),
      Math.round(b[1] - k * 2.2),
      w + Math.round(k * 0.4),
      Math.max(2, Math.round(k * 2.2))
    );
    ctx.fillStyle = C_([60, 60, 64], 1);
    ctx.fillRect(
      Math.round(a[0] - w / 2 - k * 0.4),
      Math.round(b[1]),
      w + Math.round(k * 0.8),
      Math.max(1, Math.round(k * 0.3))
    );
  } else if (!o.lh && k >= 0.6) {
    const c = o.cols[0];
    ctx.fillStyle = C_(c === LCOL.white ? [240, 240, 236] : c, 1);
    ctx.fillRect(
      Math.round(a[0] - k * 0.4),
      Math.round(b[1] - k * 0.8),
      Math.max(1, Math.round(k * 0.8)),
      Math.max(1, Math.round(k * 0.8))
    );
  }
}
function drawMast(m) {
  const k = K,
    z = hAt(m.x, m.y),
    h = m.h;
  const a = sp_(m.x, m.y, z),
    b = sp_(m.x, m.y, z + h);
  if (a[1] - b[1] < 3) {
    ctx.fillStyle = C_([180, 60, 50], 1);
    ctx.fillRect(Math.round(a[0]), Math.round(b[1]), 1, Math.max(1, Math.round(a[1] - b[1])));
    return;
  }
  if (m.tower) {
    const w = Math.max(1, Math.round(k * 3));
    ctx.fillStyle = C_([200, 200, 196], 1);
    ctx.fillRect(Math.round(a[0] - w / 2), Math.round(b[1]), w, Math.round(a[1] - b[1]));
    ctx.fillStyle = C_([150, 150, 146], 1);
    ctx.fillRect(
      Math.round(a[0] + w / 4),
      Math.round(b[1]),
      Math.max(1, Math.round(w / 4)),
      Math.round(a[1] - b[1])
    );
    for (const f of [0.55, 0.8]) {
      const q = sp_(m.x, m.y, z + h * f);
      ctx.fillStyle = C_([226, 226, 222], 1);
      ctx.fillRect(Math.round(q[0] - w), Math.round(q[1]), w * 2, Math.max(1, Math.round(k * 1.2)));
    }
  } else {
    const w = Math.max(1, Math.round(k * 0.6)),
      nb = 7;
    for (let i = 0; i < nb; i++) {
      const p0 = sp_(m.x, m.y, z + (h * i) / nb),
        p1 = sp_(m.x, m.y, z + (h * (i + 1)) / nb);
      ctx.fillStyle = C_(i % 2 ? [240, 240, 236] : [200, 56, 44], 1);
      ctx.fillRect(Math.round(a[0] - w / 2), Math.round(p1[1]), w, Math.max(1, Math.round(p0[1] - p1[1])));
    }
    if (k >= 0.15) {
      ctx.strokeStyle = C_([120, 122, 128], 1);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (let g = 0; g < 3; g++) {
        const an = m.seed * 6.28 + g * 2.094,
          r = h * 0.42,
          gx = m.x + Math.cos(an) * r,
          gy = m.y + Math.sin(an) * r;
        for (const f of [0.45, 0.85]) {
          const t = sp_(m.x, m.y, z + h * f),
            gg = sp_(gx, gy, hAt(gx, gy));
          ctx.moveTo(t[0], t[1]);
          ctx.lineTo(gg[0], gg[1]);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
function extraItems(vr, items) {
  xVis(viewRect(40, 800), o => {
    if ((o.kind === 'lh' && !o.b) || (o.kind === 'sl' && !o.b) || o.kind === 'ms')
      items.push([PYw(o.x, o.y) + 0.4, 9, o]);
  });
}
function drawExtraTallAll() {
  const vr = viewRect(40, 800);
  xVis(vr, o => {
    if (((o.kind === 'lh' || o.kind === 'sl') && !o.b) || o.kind === 'ms') drawExtraTall(o);
  });
}
/* small things at street level */
function drawExtraGround() {
  const k = K;
  if (k < 0.15) return;
  const vr = viewRect(30, 800);
  xVis(vr, o => {
    const z = hAt(o.x, o.y);
    if (o.kind === 'hy' && k >= 1.1) {
      const s = sp_(o.x, o.y, z),
        w = Math.max(1, Math.round(k * 0.35)),
        h = Math.max(2, Math.round(k * 0.8));
      ctx.fillStyle = C_([236, 190, 30], 1);
      ctx.fillRect(Math.round(s[0] - w / 2), Math.round(s[1] - h), w, h);
      ctx.fillStyle = C_([200, 40, 30], 1);
      ctx.fillRect(Math.round(s[0] - w / 2), Math.round(s[1] - h), w, Math.max(1, Math.round(k * 0.2)));
    } else if (o.kind === 'ev' && k >= 0.8) {
      const s = sp_(o.x, o.y, z),
        w = Math.max(1, Math.round(k * 0.6)),
        h = Math.max(2, Math.round(k * 1.5));
      ctx.fillStyle = C_([236, 240, 240], 1);
      ctx.fillRect(Math.round(s[0] - w / 2), Math.round(s[1] - h), w, h);
      ctx.fillStyle = C_([40, 160, 90], 1);
      ctx.fillRect(Math.round(s[0] - w / 2), Math.round(s[1] - h), w, Math.max(1, Math.round(k * 0.3)));
      if (k >= 2) {
        ctx.fillStyle = C_([30, 40, 50], 1);
        ctx.fillRect(
          Math.round(s[0] - w / 2 + 1),
          Math.round(s[1] - h * 0.75),
          Math.max(1, w - 2),
          Math.max(1, Math.round(k * 0.35))
        );
      }
    } else if (o.kind === 'vp' && k >= 0.9) {
      const s = sp_(o.x, o.y, z),
        h = Math.round(k * 1.6);
      ctx.fillStyle = C_([110, 80, 52], 1);
      ctx.fillRect(Math.round(s[0]), Math.round(s[1] - h), Math.max(1, Math.round(k * 0.2)), h);
      ctx.fillStyle = C_([60, 90, 150], 1);
      ctx.fillRect(
        Math.round(s[0] - k * 0.6),
        Math.round(s[1] - h - k * 0.7),
        Math.max(2, Math.round(k * 1.4)),
        Math.max(1, Math.round(k * 0.7))
      );
    }
  });
}
/* lines on the land: streams (thin water) and cliffs (dark rock edge with hatching on the low side) */
function drawLandLines() {
  const k = K;
  if (k < 0.03 || !XSB.size) return;
  const vr = viewRect(30, 800);
  const st = [],
    cf = [];
  ifVisible(
    vr,
    v => {
      const id = (v / 1e5) | 0;
      (id >= 1e4 ? st : cf).push(v);
    },
    XSB
  );
  const seg = (o, i, dz) => {
    const a = sp_(o.xs[i], o.ys[i], hAt(o.xs[i], o.ys[i]) + dz),
      b = sp_(o.xs[i + 1], o.ys[i + 1], hAt(o.xs[i + 1], o.ys[i + 1]) + dz);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  };
  if (st.length) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = C_(SP.cover > 0 ? [150, 176, 196] : [78, 128, 160], 1);
    ctx.lineWidth = Math.max(1, k * 1.6);
    ctx.globalAlpha = k < 0.1 ? 0.6 : 0.9;
    ctx.beginPath();
    for (const v of st) {
      const o = STRM[((v / 1e5) | 0) - 1e4];
      seg(o, v % 1e5, 0.05);
    }
    ctx.stroke();
    if (k >= 1) {
      ctx.strokeStyle = C_([150, 196, 220], 1);
      ctx.lineWidth = Math.max(1, k * 0.4);
      ctx.beginPath();
      for (const v of st) {
        const o = STRM[((v / 1e5) | 0) - 1e4];
        seg(o, v % 1e5, 0.1);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }
  if (cf.length && k >= 0.08) {
    ctx.strokeStyle = C_([56, 50, 46], 1);
    ctx.lineWidth = Math.max(1.5, k * 1.2);
    ctx.beginPath();
    for (const v of cf) {
      const o = CLIFFS[(v / 1e5) | 0];
      seg(o, v % 1e5, 0);
    }
    ctx.stroke();
    if (k >= 0.4) {
      ctx.strokeStyle = C_([96, 90, 84], 1);
      ctx.lineWidth = Math.max(1, k * 0.3);
      ctx.beginPath();
      for (const v of cf) {
        const o = CLIFFS[(v / 1e5) | 0],
          i = v % 1e5,
          x0 = o.xs[i],
          y0 = o.ys[i],
          x1 = o.xs[i + 1],
          y1 = o.ys[i + 1],
          L = Math.hypot(x1 - x0, y1 - y0) || 1,
          nx = -(y1 - y0) / L,
          ny = (x1 - x0) / L;
        for (let d = 1.5; d < L; d += 3) {
          const x = x0 + ((x1 - x0) * d) / L,
            y = y0 + ((y1 - y0) * d) / L,
            a = sp_(x, y, hAt(x, y)),
            b = sp_(x - nx * 3.5, y - ny * 3.5, hAt(x - nx * 3.5, y - ny * 3.5));
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
      }
      ctx.stroke();
    }
  }
}
/* night: flashing sea lights, sweeping lighthouse beams, blinking red aviation lights, greenhouse glow */
function drawNightLights() {
  if (nightK <= 0.02) return;
  const k = K,
    t = performance.now() / 1000,
    vr = viewRect(Math.max(60, 40 / k), 800);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const h = (gameMin % 1440) / 60,
    ghOn = (h >= 5 && h < 23 && curDOY() > 270) || (h >= 5 && h < 23 && curDOY() < 110);
  xVis(vr, o => {
    if (o.kind === 'lh' || o.kind === 'sl') {
      const c = lightState(o, t);
      if (!c) return;
      const s = sp_(o.x, o.y, lightTop(o));
      const big = o.lh;
      const r = Math.max(1.2, Math.min(k * (big ? 16 : 5), big ? 2 + k * 14 : 1 + k * 4));
      const g = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], r);
      g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + 0.9 * nightK + ')');
      g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s[0], s[1], r, 0, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + nightK + ')';
      ctx.fillRect(Math.round(s[0]), Math.round(s[1]), 1, 1);
      if (big && k >= 0.02 && !/^F$|Iso|Oc/.test(o.ch)) {
        // a beam sweeping round with the light's period
        const P = o.per || 10,
          an = (((t + o.seed * P) % P) / P) * 6.283,
          len = Math.min(900, o.rng ? o.rng * 1852 * 0.05 : 500);
        for (const da of [0, Math.PI]) {
          const a1 = an + da;
          const ex = o.x + Math.cos(a1) * len,
            ey = o.y + Math.sin(a1) * len,
            e1 = sp_(ex - Math.sin(a1) * len * 0.12, ey + Math.cos(a1) * len * 0.12, lightTop(o)),
            e2 = sp_(ex + Math.sin(a1) * len * 0.12, ey - Math.cos(a1) * len * 0.12, lightTop(o));
          const gb = ctx.createLinearGradient(s[0], s[1], (e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2);
          gb.addColorStop(0, 'rgba(255,246,210,' + 0.22 * nightK + ')');
          gb.addColorStop(1, 'rgba(255,246,210,0)');
          ctx.fillStyle = gb;
          ctx.beginPath();
          ctx.moveTo(s[0], s[1]);
          ctx.lineTo(e1[0], e1[1]);
          ctx.lineTo(e2[0], e2[1]);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else if (o.kind === 'ms') {
      if ((t + o.seed * 2) % 1.5 > 1) return;
      for (const f of [1, 0.5]) {
        const s = sp_(o.x, o.y, hAt(o.x, o.y) + o.h * f);
        const r = Math.max(0.8, k * 2.5);
        if (r < 1.2) {
          ctx.fillStyle = 'rgba(255,40,30,' + 0.9 * nightK + ')';
          ctx.fillRect(Math.round(s[0]), Math.round(s[1]), 1, 1);
          continue;
        }
        ctx.fillStyle = 'rgba(255,40,30,' + 0.8 * nightK + ')';
        ctx.beginPath();
        ctx.arc(s[0], s[1], r, 0, 7);
        ctx.fill();
      }
    } else if (o.kind === 'gh' && ghOn) {
      const b = o.b;
      if (b.state >= 2) return;
      const z = b.z + b.base + b.h;
      const s = sp_(b.cx, b.cy, z);
      const r = Math.max(2, Math.sqrt(b.area) * k * 1.1);
      const g = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], r * 1.8);
      g.addColorStop(0, 'rgba(255,160,80,' + 0.5 * nightK + ')');
      g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s[0], s[1], r * 1.8, 0, 7);
      ctx.fill();
      if (k >= 0.3) {
        ctx.fillStyle = 'rgba(255,190,120,' + 0.55 * nightK + ')';
        ctx.beginPath();
        for (let j = 0; j < b.n; j++) {
          const p = sp_(b.poly[2 * j], b.poly[2 * j + 1], z);
          j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  });
  ctx.restore();
}
/* fire hoses run from the nearest hydrant to a fire engine at work */
function nearHydrant(x, y, r) {
  let best = null,
    bd = r * r;
  xVis([x - r, y - r, x + r, y + r], o => {
    if (o.kind !== 'hy') return;
    const d = (o.x - x) ** 2 + (o.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}
function drawHoses() {
  if (K < 0.6) return;
  for (const a of agents) {
    if (a.dead || a.kind !== 'truck' || a.state !== 'parked') continue;
    if (a.hyd === undefined) a.hyd = nearHydrant(a.x, a.y, 120);
    if (!a.hyd) continue;
    const h = a.hyd,
      s0 = sp_(h.x, h.y, hAt(h.x, h.y) + 0.2),
      s1 = sp_(a.x, a.y, hAt(a.x, a.y) + 0.2),
      mx = (s0[0] + s1[0]) / 2 + ((h32(a.id, 1, 1) - 0.5) * 20 * K) / 2,
      my = (s0[1] + s1[1]) / 2 + ((h32(a.id, 2, 1) - 0.5) * 10 * K) / 2;
    ctx.strokeStyle = C_([214, 196, 150], 1);
    ctx.lineWidth = Math.max(1, K * 0.25);
    ctx.beginPath();
    ctx.moveTo(s0[0], s0[1]);
    ctx.quadraticCurveTo(mx, my, s1[0], s1[1]);
    ctx.stroke();
  }
}
/* tourists stop at viewpoints in daylight to take pictures */
function stepViewpoints(dt) {
  vpAcc += dt;
  if (vpAcc < 2) return;
  vpAcc = 0;
  const want = K >= 0.6 && dayL > 0.45 && !(wxW('storm') > 0.5);
  const vr = viewRect(40, 800),
    seen = new Set();
  if (want)
    xVis(vr, o => {
      if (o.kind !== 'vp') return;
      seen.add(o.id);
      let l = VPAG.get(o.id);
      if (!l) VPAG.set(o.id, (l = []));
      for (let i = l.length - 1; i >= 0; i--) if (l[i].dead) l.splice(i, 1);
      const n = 2 + ((h32(o.id, (gameMin / 60) | 0, 9) * 4) | 0);
      while (l.length < n) {
        const an = R() * 6.283,
          r = 1.5 + R() * 4,
          a = mkAgent('tourist', o.x + Math.cos(an) * r, o.y + Math.sin(an) * r);
        a.keep = 1;
        a.state = 'idle';
        a.idle = 1e9;
        a.photo = 1;
        a.act = 'Taking in the view' + (o.name ? ' at ' + o.name : '');
        a.face = R() < 0.5 ? 1 : -1;
        a.vx = Math.cos(an + 3.14);
        a.vy = Math.sin(an + 3.14);
        if (SEAS === 'winter' || TEMP < 5) {
          a.coat = pickA(PARKA);
          a.shirt = a.coat;
        }
        agents.push(a);
        l.push(a);
      }
    });
  for (const [id, l] of VPAG) {
    if (seen.has(id)) continue;
    for (const a of l) if (a !== follow && a !== selected) a.dead = true;
    VPAG.delete(id);
  }
}
function extraCard(x, y) {
  let best = null,
    bd = 1e9;
  xVis([x - 30, y - 30, x + 30, y + 30], o => {
    if (o.kind === 'gh') return;
    const d = Math.hypot(o.x - x, o.y - y),
      lim = o.kind === 'ms' || o.kind === 'lh' ? 14 : 5;
    if (d < lim && d < bd) {
      bd = d;
      best = o;
    }
  });
  if (!best) return null;
  const o = best;
  const row = (a, b) => '<div class="row"><span>' + a + '</span><span>' + b + '</span></div>';
  const chN = c =>
    ({
      F: 'Fixed',
      Fl: 'Flashing',
      LFl: 'Long flash',
      Oc: 'Occulting',
      Iso: 'Isophase',
      Q: 'Quick flashing',
      VQ: 'Very quick',
      Mo: 'Morse',
      'Al.Fl': 'Alternating flashes'
    })[c] ||
    c ||
    '—';
  if (o.kind === 'lh' || o.kind === 'sl')
    return {
      h:
        '<h3>' +
        (o.name || (o.lh ? 'Viti' : 'Innsiglingarljós')) +
        '</h3><div class="sub">' +
        (o.lh ? 'Lighthouse' : 'Harbour / sea light') +
        '</div>' +
        row(
          'Light',
          chN(o.ch) + (o.grp > 1 ? ' (' + o.grp + ')' : '') + (o.per ? ' every ' + o.per + ' s' : '')
        ) +
        row(
          'Colour',
          o.cols
            .map(c =>
              c === LCOL.red ? 'red' : c === LCOL.green ? 'green' : c === LCOL.yellow ? 'yellow' : 'white'
            )
            .join(' / ')
        ) +
        (o.rng ? row('Range', o.rng + ' nautical miles') : ''),
      m: o.name || 'Light'
    };
  if (o.kind === 'ms')
    return {
      h:
        '<h3>' +
        (o.name || (o.tower ? 'Fjarskiptaturn' : 'Mastur')) +
        '</h3><div class="sub">' +
        (o.tower ? 'Tower' : 'Radio mast') +
        (o.tt ? ' · ' + o.tt : '') +
        '</div>' +
        row('Height', Math.round(o.h) + ' m') +
        (o.name === 'Gufuskálar'
          ? '<p style="margin:.5em 0 0;font-size:12px;opacity:.85">The longwave mast at Gufuskálar on Snæfellsnes, 412 m, is the tallest structure in Western Europe.</p>'
          : ''),
      m: o.name || 'Mast'
    };
  if (o.kind === 'ev')
    return {
      h:
        '<h3>Hleðslustöð</h3><div class="sub">EV charging station' +
        (o.op ? ' · ' + o.op : '') +
        '</div>' +
        row('Charging points', o.n),
      m: 'EV charger'
    };
  if (o.kind === 'hy')
    return { h: '<h3>Brunahani</h3><div class="sub">Fire hydrant</div>', m: 'Fire hydrant' };
  if (o.kind === 'vp') {
    const n = (VPAG.get(o.id) || []).filter(a => !a.dead).length;
    return {
      h:
        '<h3>' +
        (o.name || 'Útsýnisstaður') +
        '</h3><div class="sub">Viewpoint</div>' +
        row('Visitors now', n),
      m: o.name || 'Viewpoint'
    };
  }
  return null;
}
