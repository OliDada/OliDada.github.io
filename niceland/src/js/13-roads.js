/**
 * Roads
 *
 * Bridges, tunnels, lanes, traffic lights, signs and barriers; road drawing and building chunks.
 *
 * Functions: fetchRoadX, applyRoadX, roadxIndices, deckAt, sigPhase, drawRoadMarks, drawBarriers,
 *     drawDecks, junc, RWW, laneOffs, drawRails, drawPortal, drawSignals, drawRoads, liveDecks, eachB2,
 *     cellInF, landTAt, cAt, renderCoarseSmooth, chunkContents, renderBld, lodBld, getChunk, putChunk,
 *     dropKey, dirtyCell, dirtyWorld, dirtyB
 * State and constants: NDEGD, NDZ, NTUN, NRB, RPTS, RBARS, SIGN, RPB, BARB, RDM, RXRAW, CACHE, cachePx,
 *     CACHE_MAX, frameNo, RS, ckey
 */

let NDEGD = null,
  NDZ = null,
  NTUN = null,
  NRB = null,
  RPTS = [],
  RBARS = [],
  SIGN = new Map(),
  RPB = new Map(),
  BARB = new Map(),
  RDM = null,
  RXRAW = null;
async function fetchRoadX() {
  try {
    const r = await fetch('roadx.txt');
    if (!r.ok) return;
    const b = atob((await r.text()).trim());
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    RXRAW = await new Response(
      new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).arrayBuffer();
  } catch (e) {
    console.warn('roadx', e);
  }
}
function applyRoadX() {
  if (!RXRAW) return;
  const bf = RXRAW,
    dv = new DataView(bf);
  if (dv.getUint32(0, true) !== 0x58524d53) return;
  const nw = dv.getUint32(4, true),
    nn = dv.getUint32(8, true),
    np = dv.getUint32(12, true);
  if (nw !== WAYS.length || nn !== NODE_N) {
    console.warn('roadx size mismatch', nw, WAYS.length, nn, NODE_N);
    return;
  }
  let o = 16;
  const u8 = n => {
      const a = new Uint8Array(bf.slice(o, o + n));
      o += n;
      return a;
    },
    i8 = n => {
      const a = new Int8Array(bf.slice(o, o + n));
      o += n;
      return a;
    },
    i16 = n => {
      const a = new Int16Array(bf.slice(o, o + 2 * n));
      o += 2 * n;
      return a;
    },
    u32 = n => {
      const a = new Uint32Array(bf.slice(o, o + 4 * n));
      o += 4 * n;
      return a;
    };
  const tu = u8(nw),
    ly = i8(nw),
    ow = u8(nw),
    rb = u8(nw);
  for (let w = 0; w < nw; w++) {
    const W = WAYS[w];
    W.tu = tu[w];
    W.ly = ly[w];
    W.ow = ow[w];
    W.rb = rb[w];
  }
  const dz = i16(nn);
  NDZ = new Float32Array(nn);
  for (let i = 0; i < nn; i++) NDZ[i] = dz[i] / 10;
  NTUN = u8(nn);
  NRB = new Uint8Array(nn);
  for (let w = 0; w < nw; w++) if (rb[w]) for (const n of WAYS[w].nodes) NRB[n] = 1;
  const pn = u32(np),
    pt = u8(np),
    pa = i16(np),
    pw = u32(np),
    pz = u8(np);
  for (let i = 0; i < np; i++) {
    const n = pn[i],
      p = {
        n,
        x: NX[n],
        y: NY[n],
        t: pt[i],
        ang: pa[i] / 1000,
        w: pw[i],
        zeb: pz[i],
        cl: WAYS[pw[i]] ? WAYS[pw[i]].cl : 5
      };
    p.off = (h32(Math.round(p.x / 70), Math.round(p.y / 70), 9) * 40) | 0;
    RPTS.push(p);
    if (p.t === 1) SIGN.set(n, p);
  }
  const nb = dv.getUint32(o, true);
  o += 4;
  for (let i = 0; i < nb; i++) {
    const k = dv.getUint8(o),
      n = dv.getUint16(o + 1, true);
    o += 3;
    const c = new Int32Array(bf.slice(o, o + 8 * n));
    o += 8 * n;
    const p = new Float32Array(2 * n);
    for (let q = 0; q < 2 * n; q++) p[q] = c[q] * 0.5;
    RBARS.push({ k, p });
  }
  if (o + 4 <= bf.byteLength && dv.getUint32(o, true) === 0x534d4e4c) {
    o += 4;
    const ln = u8(nw),
      ms = u8(nw);
    for (let w = 0; w < nw; w++) {
      WAYS[w].ln = ln[w];
      WAYS[w].ms = ms[w];
      WAYS[w].wd = undefined;
    }
  }
  if (o + 4 <= bf.byteLength && dv.getUint32(o, true) === 0x4c464653) {
    o += 4;
    const sf = u8(nw),
      fl = u8(nw);
    for (let w = 0; w < nw; w++) {
      WAYS[w].sf = sf[w];
      WAYS[w].fl = fl[w];
    }
  }
  if (o + 8 <= bf.byteLength && dv.getUint32(o, true) === 0x44524f46) {
    o += 4;
    const nf = dv.getUint32(o, true);
    o += 4;
    const fn = u32(nf);
    NFORD = new Uint8Array(nn);
    FORDL = [];
    for (const n of fn) {
      NFORD[n] = 1;
      FORDL.push(n);
    }
    for (let w = 0; w < nw; w++)
      if (WAYS[w].fl & 2)
        for (const n of WAYS[w].nodes)
          if (!NFORD[n]) {
            NFORD[n] = 1;
            FORDL.push(n);
          }
  }
}
function roadxIndices() {
  try {
    initRoadExtras();
  } catch (e) {
    console.warn('roads', e);
  }
  for (let i = 0; i < RPTS.length; i++) {
    const p = RPTS[i];
    badd(RPB, bkey(p.x, p.y), i);
  }
  for (let i = 0; i < RBARS.length; i++) {
    const p = RBARS[i].p,
      seen = new Set();
    for (let q = 0; q < p.length; q += 2) {
      const k = bkey(p[q], p[q + 1]);
      if (!seen.has(k)) {
        seen.add(k);
        badd(BARB, k, i);
      }
    }
  }
  // keep trees off the carriageway: a 10 m mask of cells a road runs through, and drop single trees standing on a road
  if (typeof F !== 'undefined' && F) {
    RDM = new Uint8Array(F.W * F.H);
    for (const wy of WAYS) {
      if (wy.cl > 7 || wy.tu) continue;
      const ns = wy.nodes,
        hw = RWW(wy) / 2 + 1.5;
      for (let j = 0; j + 1 < ns.length; j++) {
        const a = ns[j],
          b = ns[j + 1];
        if (!inF(NX[a], NY[a]) && !inF(NX[b], NY[b])) continue;
        const L = Math.hypot(NX[b] - NX[a], NY[b] - NY[a]),
          st = Math.max(1, Math.ceil(L / 3));
        for (let s = 0; s <= st; s++) {
          const x = NX[a] + ((NX[b] - NX[a]) * s) / st,
            y = NY[a] + ((NY[b] - NY[a]) * s) / st;
          for (const [ox, oy] of [
            [0, 0],
            [hw, 0],
            [-hw, 0],
            [0, hw],
            [0, -hw]
          ]) {
            const i = Math.floor((x + ox - F.OX) / F.CS),
              jj = Math.floor((y + oy - F.OY) / F.CS);
            if (i >= 0 && jj >= 0 && i < F.W && jj < F.H) RDM[i + jj * F.W] = 1;
          }
        }
      }
    }
  }
  RBARS = RBARS.filter(b => {
    if (b.k === 1 || b.k === 3) return true;
    const p = b.p;
    for (let q = 0; q < p.length; q += 2) {
      let on = false;
      eachB2(SBUCK, p[q] - 12, p[q + 1] - 12, p[q] + 12, p[q + 1] + 12, (w, j) => {
        if (on) return;
        const wy = WAYS[w];
        if (wy.cl > 5) return;
        const a = wy.nodes[j],
          b2 = wy.nodes[j + 1];
        if (segD(p[q], p[q + 1], NX[a], NY[a], NX[b2], NY[b2]) < RWW(wy) / 2 + 2) on = true;
      });
      if (on) return false;
    }
    return true;
  });
  BARB = new Map();
  for (let i = 0; i < RBARS.length; i++) {
    const p = RBARS[i].p,
      seen = new Set();
    for (let q = 0; q < p.length; q += 2) {
      const k = bkey(p[q], p[q + 1]);
      if (!seen.has(k)) {
        seen.add(k);
        badd(BARB, k, i);
      }
    }
  }
  let removed = 0;
  for (let t = 0; t < NT; t++) {
    const x = TREES.x[t],
      y = TREES.y[t];
    let on = false;
    eachB2(SBUCK, x - 12, y - 12, x + 12, y + 12, (w, j) => {
      if (on) return;
      const wy = WAYS[w];
      if (wy.cl > 7 || wy.tu) return;
      const a = wy.nodes[j],
        b = wy.nodes[j + 1];
      if (segD(x, y, NX[a], NY[a], NX[b], NY[b]) < RWW(wy) / 2 + 1) on = true;
    });
    if (on) {
      TREES.s[t] = 3;
      removed++;
    }
  }
  if (removed) console.log('trees off roads', removed);
}
/* height of the road surface over the terrain at a point, keeping to the deck we are already on */
function deckAt(x, y, prev, maxCl) {
  if (!NDZ) return 0;
  let best = 0,
    bd = 1e9;
  eachB2(SBUCK, x - 10, y - 10, x + 10, y + 10, (w, j) => {
    const wy = WAYS[w];
    if (wy.cl > (maxCl || 7)) return;
    const a = wy.nodes[j],
      b = wy.nodes[j + 1];
    const za = NDZ[a],
      zb = NDZ[b];
    if (Math.abs(za) < 0.3 && Math.abs(zb) < 0.3) return;
    const ex = NX[b] - NX[a],
      ey = NY[b] - NY[a],
      L2 = ex * ex + ey * ey || 1;
    let t = ((x - NX[a]) * ex + (y - NY[a]) * ey) / L2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(NX[a] + ex * t - x, NY[a] + ey * t - y);
    if (d > RWW(wy) / 2 + 1.2) return;
    const z = za + (zb - za) * t,
      dd = Math.abs(z - (prev || 0));
    if (dd < bd && dd < 3.2) {
      bd = dd;
      best = z;
    }
  });
  return best;
}
/* ---- traffic lights: two phases per junction, 40 s cycle ---- */
function sigPhase(p, hx, hy) {
  const along = Math.abs(Math.cos(p.ang) * hx + Math.sin(p.ang) * hy) > 0.7071;
  const t = (time + p.off) % 40;
  const tt = along ? t : (t + 20) % 40;
  return tt < 17 ? 'g' : tt < 20 ? 'a' : 'r';
}
/* ---- drawing on the road surface: crosswalks and stop lines ---- */
function drawRoadMarks(c, k, x0, y0, x1, y1, ox, oy) {
  if (k < 0.85 || !RPTS.length) return;
  const P = (x, y, z) => [PXw(x, y) * k - ox, (PYw(x, y) - z) * k - oy];
  eachB(RPB, x0 - 20, y0 - 20, x1 + 20, y1 + 20, i => {
    const p = RPTS[i];
    if (!p.zeb || p.t !== 2 || (NTUN && NTUN[p.n])) return;
    const wy = WAYS[p.w];
    if (!wy || wy.cl > 5) return;
    const w = RWW(wy),
      z = hAt(p.x, p.y) + (NDZ ? NDZ[p.n] : 0) + 0.18;
    const ux = Math.cos(p.ang),
      uy = Math.sin(p.ang),
      vx = -uy,
      vy = ux,
      ns = Math.max(3, Math.floor(w / 0.9));
    c.fillStyle = N_([236, 236, 230], 1);
    for (let s = 0; s < ns; s++) {
      const v0 = -w / 2 + ((s + 0.15) * w) / ns,
        v1 = -w / 2 + ((s + 0.62) * w) / ns;
      const A = P(p.x - ux * 1.5 + vx * v0, p.y - uy * 1.5 + vy * v0, z),
        B2 = P(p.x + ux * 1.5 + vx * v0, p.y + uy * 1.5 + vy * v0, z),
        C2 = P(p.x + ux * 1.5 + vx * v1, p.y + uy * 1.5 + vy * v1, z),
        D = P(p.x - ux * 1.5 + vx * v1, p.y - uy * 1.5 + vy * v1, z);
      c.beginPath();
      c.moveTo(A[0], A[1]);
      c.lineTo(B2[0], B2[1]);
      c.lineTo(C2[0], C2[1]);
      c.lineTo(D[0], D[1]);
      c.closePath();
      c.fill();
    }
  });
}
/* ---- fences, walls and guard rails from the map ---- */
function drawBarriers(c, k, x0, y0, x1, y1, ox, oy) {
  if (k < 0.85 || !RBARS.length) return;
  const seen = new Set();
  eachB(BARB, x0 - 10, y0 - 10, x1 + 10, y1 + 10, i => {
    if (seen.has(i)) return;
    seen.add(i);
    const b = RBARS[i],
      p = b.p,
      h = b.k === 3 ? 1.6 : b.k === 1 ? 0.75 : b.k === 4 ? 0.15 : b.k === 5 ? 1.3 : b.k === 6 ? 1.1 : 1.2;
    const col =
      b.k === 1
        ? [196, 198, 200]
        : b.k === 3
          ? [150, 142, 132]
          : b.k === 4
            ? [176, 176, 170]
            : b.k === 5
              ? [58, 96, 50]
              : b.k === 6
                ? [140, 112, 80]
                : [120, 104, 86];
    if (b.k === 5) {
      c.strokeStyle = N_(col, 0.8);
      c.lineWidth = Math.max(1, k * 1.1);
      c.lineCap = 'round';
      c.beginPath();
      for (let q = 0; q < p.length; q += 2) {
        const z = hAt(p[q], p[q + 1]) + 0.6,
          s = [PXw(p[q], p[q + 1]) * k - ox, (PYw(p[q], p[q + 1]) - z) * k - oy];
        q ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
      }
      c.stroke();
    }
    c.strokeStyle = N_(col, 1);
    c.lineWidth = Math.max(1, k * (b.k === 3 ? 0.5 : b.k === 5 ? 0.9 : 0.18));
    c.beginPath();
    for (let q = 0; q < p.length; q += 2) {
      const z = hAt(p[q], p[q + 1]) + h,
        s = [PXw(p[q], p[q + 1]) * k - ox, (PYw(p[q], p[q + 1]) - z) * k - oy];
      q ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
    }
    c.stroke();
    if (b.k !== 4 && k >= 1.3) {
      c.fillStyle = N_(col, 0.8);
      for (let q = 0; q + 2 < p.length; q += 2) {
        const L = Math.hypot(p[q + 2] - p[q], p[q + 3] - p[q + 1]),
          n = Math.floor(L / 2.5);
        for (let s = 0; s <= n; s++) {
          const x = p[q] + ((p[q + 2] - p[q]) * s) / Math.max(1, n),
            y = p[q + 1] + ((p[q + 3] - p[q + 1]) * s) / Math.max(1, n),
            z = hAt(x, y);
          const sx = PXw(x, y) * k - ox,
            sy = (PYw(x, y) - z) * k - oy;
          c.fillRect(Math.round(sx), Math.round(sy - h * k), 1, Math.max(1, Math.round(h * k)));
        }
      }
    }
  });
}
/* ---- bridges: shadow, piers, deck edge, deck, railings ---- */
function drawDecks(c, k, list, ox, oy) {
  if (!list.length) return;
  list.sort((p, q) => p[3] - q[3]);
  const P = (x, y, z) => [PXw(x, y) * k - ox, (PYw(x, y) - z) * k - oy];
  for (const [wy, a, b] of list) {
    const za = hAt(NX[a], NY[a]),
      zb = hAt(NX[b], NY[b]),
      da = NDZ[a],
      db = NDZ[b];
    const w = RWW(wy);
    const ex = NX[b] - NX[a],
      ey = NY[b] - NY[a],
      L = Math.hypot(ex, ey) || 1,
      vx = ((-ey / L) * w) / 2,
      vy = ((ex / L) * w) / 2;
    if (!wy.br && wy.cl <= 6) {
      // retaining wall under a ramp, straight down to the ground
      const nx = -ey / L,
        ny = ex / L;
      for (const off of [-1, 1]) {
        const fv = faces(nx * off, ny * off);
        if (fv <= 0) continue;
        const o = w / 2 + 0.15;
        const A = P(NX[a] + nx * off * o, NY[a] + ny * off * o, za + da + 0.1),
          B2 = P(NX[b] + nx * off * o, NY[b] + ny * off * o, zb + db + 0.1),
          C2 = P(NX[b] + nx * off * o, NY[b] + ny * off * o, hAt(NX[b] + nx * off * o, NY[b] + ny * off * o)),
          D = P(NX[a] + nx * off * o, NY[a] + ny * off * o, hAt(NX[a] + nx * off * o, NY[a] + ny * off * o));
        c.fillStyle = N_([158, 156, 150], 0.78 + 0.3 * Math.max(0, (nx * off * SXx + ny * off * SXy) / 1.42));
        c.beginPath();
        c.moveTo(A[0], A[1]);
        c.lineTo(B2[0], B2[1]);
        c.lineTo(C2[0], C2[1]);
        c.lineTo(D[0], D[1]);
        c.closePath();
        c.fill();
      }
    }
    // shadow on the ground
    if (Math.max(da, db) > 1.5 && wy.br) {
      c.strokeStyle = 'rgba(0,0,0,.22)';
      c.lineCap = 'butt';
      c.lineWidth = Math.max(1, w * k * 0.9);
      c.beginPath();
      let s = P(NX[a], NY[a], za + 0.1);
      c.moveTo(s[0], s[1]);
      s = P(NX[b], NY[b], zb + 0.1);
      c.lineTo(s[0], s[1]);
      c.stroke();
      c.lineCap = 'round';
    }
    // piers every ~18 m where the deck is high enough
    if (k >= 0.3) {
      const n = Math.max(1, Math.round(L / 18));
      c.fillStyle = N_([150, 150, 146], 1);
      for (let q = 0; q <= n; q++) {
        const t = q / n,
          x = NX[a] + ex * t,
          y = NY[a] + ey * t,
          dz = da + (db - da) * t;
        if (dz < 2.2) continue;
        const g = hAt(x, y);
        const top = P(x, y, g + dz - 0.9),
          bot = P(x, y, g);
        const pw = Math.max(1, Math.round(k * 1.1));
        c.fillRect(
          Math.round(top[0] - pw / 2),
          Math.round(top[1]),
          pw,
          Math.max(1, Math.round(bot[1] - top[1]))
        );
      }
    }
    const quad = (z0a, z0b, z1a, z1b, off, cl) => {
      const A = P(NX[a] + vx * off, NY[a] + vy * off, za + z0a),
        B2 = P(NX[b] + vx * off, NY[b] + vy * off, zb + z0b),
        C2 = P(NX[b] + vx * off, NY[b] + vy * off, zb + z1b),
        D = P(NX[a] + vx * off, NY[a] + vy * off, za + z1a);
      c.fillStyle = cl;
      c.beginPath();
      c.moveTo(A[0], A[1]);
      c.lineTo(B2[0], B2[1]);
      c.lineTo(C2[0], C2[1]);
      c.lineTo(D[0], D[1]);
      c.closePath();
      c.fill();
    };
    // deck thickness on both sides, then the surface, then the railings
    if (wy.br || wy.cl > 6)
      for (const off of [-1, 1])
        if (faces(vx * off, vy * off) > 0)
          quad(
            da - 1.25,
            db - 1.25,
            da + 0.15,
            db + 0.15,
            off,
            N_(
              [150, 150, 146],
              0.78 + 0.3 * Math.max(0, (vx * off * SXx + vy * off * SXy) / (Math.hypot(vx, vy) * 1.42))
            )
          );
    c.strokeStyle = N_(RCOL[wy.cl], 1);
    c.lineWidth = Math.max(1, w * k);
    c.lineCap = 'butt';
    c.beginPath();
    const ux = (ex / L) * 0.6,
      uy = (ey / L) * 0.6;
    let s2 = P(NX[a] - ux, NY[a] - uy, za + da + 0.15);
    c.moveTo(s2[0], s2[1]);
    s2 = P(NX[b] + ux, NY[b] + uy, zb + db + 0.15);
    c.lineTo(s2[0], s2[1]);
    c.stroke();
    c.lineCap = 'round';
    if (wy.cl <= 3 && k >= 0.85) {
      c.setLineDash([3 * k, 4 * k]);
      c.lineWidth = Math.max(1, k * 0.3);
      c.strokeStyle = N_([224, 220, 196], 1);
      c.stroke();
      c.setLineDash([]);
    }
    if (k >= 0.6) {
      c.strokeStyle = N_([206, 208, 210], 1);
      c.lineWidth = Math.max(1, k * 0.22);
      for (const off of [-1, 1]) {
        c.beginPath();
        let r = P(NX[a] + vx * off, NY[a] + vy * off, za + da + 1.05);
        c.moveTo(r[0], r[1]);
        r = P(NX[b] + vx * off, NY[b] + vy * off, zb + db + 1.05);
        c.lineTo(r[0], r[1]);
        c.stroke();
      }
    }
  }
}
/* a node where drivable roads meet */
function junc(n) {
  return NDEGD ? NDEGD[n] > 2 : NDEG[n] > 2;
}
/* lane dividers across a carriageway (offsets from its centre line, metres) */
function RWW(wy) {
  if (wy.wd !== undefined) return wy.wd;
  return (wy.wd = wy.ln && wy.cl <= 6 ? Math.max(3.5, Math.min(18, wy.ln * 3.25 + 0.6)) : RW[wy.cl]);
}
function laneOffs(wy) {
  const w = RWW(wy);
  if (wy.ln && wy.cl <= 6) {
    const n = wy.ln;
    if (n < 2) return [];
    const o = [];
    for (let i = 1; i < n; i++) o.push(-w / 2 + (i * w) / n);
    return o;
  }
  if (wy.ow) {
    if (wy.cl === 1) return [-w / 6, w / 6];
    if (wy.cl <= 2) return [0];
    if (wy.cl <= 3 && w >= 10) return [0];
    return [];
  }
  if (wy.cl === 1) return [-w / 4, 0, w / 4];
  if (wy.cl <= 3) return [0];
  if (wy.cl === 4) return [0];
  return [];
}
/* guard rails along motorways, and a concrete barrier down the middle of dual carriageways */
function drawRails(c, k, list, ox, oy) {
  if (!list.length) return;
  const P = (x, y, z) => [PXw(x, y) * k - ox, (PYw(x, y) - z) * k - oy];
  for (const [wy, a, b] of list) {
    const w = RWW(wy),
      ex = NX[b] - NX[a],
      ey = NY[b] - NY[a],
      L = Math.hypot(ex, ey) || 1,
      nx = -ey / L,
      ny = ex / L;
    const ta = junc(a) ? Math.min(0.5, 16 / L) : 0,
      tb = junc(b) ? Math.min(0.5, 16 / L) : 0;
    if (ta + tb >= 0.98) continue;
    const sides = wy.ow ? [-1] : wy.cl === 1 ? [-1, 1] : [];
    for (const sd of sides) {
      const o = sd * (w / 2 + (wy.ow ? 0.25 : 0.4)),
        h = wy.ow ? 0.8 : 0.7;
      c.strokeStyle = N_(wy.ow ? [178, 176, 170] : [200, 202, 206], 1);
      c.lineWidth = Math.max(1, k * (wy.ow ? 0.45 : 0.2));
      c.beginPath();
      const xa = NX[a] + ex * ta,
        ya = NY[a] + ey * ta,
        xb = NX[a] + ex * (1 - tb),
        yb = NY[a] + ey * (1 - tb);
      let s = P(xa + nx * o, ya + ny * o, hAt(xa, ya) + h);
      c.moveTo(s[0], s[1]);
      s = P(xb + nx * o, yb + ny * o, hAt(xb, yb) + h);
      c.lineTo(s[0], s[1]);
      c.stroke();
    }
  }
}
/* ---- tunnel mouths ---- */
function drawPortal(c, k, n, dirx, diry, cl, ox, oy) {
  const w = RW[cl] + 1.2,
    z = hAt(NX[n], NY[n]) + (NDZ ? NDZ[n] : 0);
  const L = Math.hypot(dirx, diry) || 1,
    ux = dirx / L,
    uy = diry / L,
    vx = -uy,
    vy = ux;
  const P = (x, y, zz) => [PXw(x, y) * k - ox, (PYw(x, y) - zz) * k - oy];
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI * i) / 8,
      v = (Math.cos(a) * w) / 2,
      hh = Math.sin(a) * Math.min(5.5, w * 0.55);
    pts.push(P(NX[n] + vx * v, NY[n] + vy * v, z + hh));
  }
  c.fillStyle = N_([150, 150, 146], 1);
  c.beginPath();
  pts.forEach((s, i) => (i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1])));
  c.closePath();
  c.fill();
  const inner = [];
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI * i) / 8,
      v = Math.cos(a) * (w / 2 - 0.7),
      hh = Math.sin(a) * (Math.min(5.5, w * 0.55) - 0.6);
    inner.push(P(NX[n] + vx * v + ux * 0.3, NY[n] + vy * v + uy * 0.3, z + hh));
  }
  c.fillStyle = '#14161a';
  c.beginPath();
  inner.forEach((s, i) => (i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1])));
  c.closePath();
  c.fill();
}
/* ---- traffic lights and signs (drawn live, like street lamps) ---- */
function drawSignals() {
  if (K < 0.6 || !RPTS.length) return;
  const k = K,
    vr = viewRect(10);
  eachB(RPB, vr[0], vr[1], vr[2], vr[3], i => {
    const p = RPTS[i];
    if (p.t === 2 || p.t === 5 || p.t === 7) return;
    if (NTUN && NTUN[p.n]) return;
    const wy = WAYS[p.w];
    if (!wy) return;
    const w = RWW(wy);
    const ux = Math.cos(p.ang),
      uy = Math.sin(p.ang);
    const side = w / 2 + 1.3;
    const x = p.x - uy * side,
      y = p.y + ux * side;
    const z = hAt(x, y) + (NDZ ? NDZ[p.n] : 0);
    const s = sp_(x, y, z);
    if (s[0] < -20 || s[0] > VW + 20 || s[1] < -40 || s[1] > VH + 40) return;
    const ph = Math.max(1, Math.round(k * (p.t === 1 ? 3.4 : 2.2)));
    ctx.fillStyle = C_([62, 64, 68], 1);
    ctx.fillRect(Math.round(s[0]), Math.round(s[1] - ph), Math.max(1, Math.round(k * 0.18)), ph);
    if (p.t === 1) {
      const hw = Math.max(2, Math.round(k * 0.55)),
        hh = Math.max(3, Math.round(k * 1.5)),
        X = Math.round(s[0] - hw / 2),
        Y = Math.round(s[1] - ph - hh);
      ctx.fillStyle = C_([34, 36, 40], 1);
      ctx.fillRect(X, Y, hw, hh);
      const st = sigPhase(p, ux, uy),
        r = Math.max(1, Math.round(hw * 0.7)),
        cy = [Y + hh * 0.18, Y + hh * 0.5, Y + hh * 0.82];
      const on = ['#ff3a2e', '#ffb020', '#38e070'],
        off = '#3a2a28';
      for (let q = 0; q < 3; q++) {
        const lit = (st === 'r' && q === 0) || (st === 'a' && q === 1) || (st === 'g' && q === 2);
        ctx.fillStyle = lit ? on[q] : off;
        ctx.fillRect(Math.round(s[0] - r / 2), Math.round(cy[q] - r / 2), r, r);
        if (lit && nightK > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = on[q] + '40';
          ctx.beginPath();
          ctx.arc(s[0], cy[q], k * 1.6, 0, 7);
          ctx.fill();
          ctx.restore();
        }
      }
    } else if (p.t === 3 || p.t === 4 || p.t === 6) {
      const r = Math.max(2, Math.round(k * 0.42));
      const cx = s[0],
        cy = s[1] - ph - r;
      if (p.t === 3) {
        ctx.fillStyle = '#c8202a';
        ctx.beginPath();
        for (let q = 0; q < 8; q++) {
          const a = Math.PI / 8 + (q * Math.PI) / 4;
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        if (r >= 4) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(Math.round(cx - r * 0.6), Math.round(cy - 0.5), Math.round(r * 1.2), 1);
        }
      } else if (p.t === 4) {
        ctx.fillStyle = '#d42a2a';
        ctx.beginPath();
        ctx.moveTo(cx - r, cy - r * 0.6);
        ctx.lineTo(cx + r, cy - r * 0.6);
        ctx.lineTo(cx, cy + r);
        ctx.closePath();
        ctx.fill();
        if (r >= 3) {
          ctx.fillStyle = '#f4f4f0';
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.55, cy - r * 0.35);
          ctx.lineTo(cx + r * 0.55, cy - r * 0.35);
          ctx.lineTo(cx, cy + r * 0.5);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#8a8e94';
        ctx.fillRect(Math.round(cx - r * 0.6), Math.round(cy - r * 0.5), Math.round(r * 1.2), Math.round(r));
      }
    }
  });
}

function drawRoads(c, k, x0, y0, x1, y1, ox, oy, fineOnly) {
  const minCl =
    k < 0.004 ? 1 : k < 0.01 ? 2 : k < 0.03 ? 3 : k < 0.06 ? 4 : k < 0.12 ? 5 : k < 0.2 ? 5 : k < 0.4 ? 6 : 9;
  const live = k >= DIRECT;
  const segs = new Map();
  eachB2(SBUCK, x0 - 40, y0 - 40, x1 + 40, y1 + 40, (w, j) => {
    const wy = WAYS[w];
    if (wy.cl === 10) {
      if (k < 0.0019 || fineOnly) return;
    } else if (wy.cl > minCl) return;
    let s = segs.get(w);
    if (!s) {
      s = new Set();
      segs.set(w, s);
    }
    s.add(j);
  });
  const order = [...segs.keys()].sort((a, b) => WAYS[b].cl - WAYS[a].cl);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const P = (x, y, z, f) => {
    const sx = PXw(x, y) * k - ox,
      sy = (PYw(x, y) - z) * k - oy;
    f ? c.moveTo(sx, sy) : c.lineTo(sx, sy);
  };
  const zN = NDZ
    ? n => hAt(NX[n], NY[n]) + NDZ[n] + 0.15
    : n => (NODE_WATER[n] ? Math.max(4, hAt(NX[n], NY[n]) + 3) : hAt(NX[n], NY[n])) + 0.15;
  const decks = [],
    portals = [],
    rails = [];
  const ground = new Map(); // per way: the segments drawn on the ground
  for (const w of order) {
    const wy = WAYS[w],
      list = segs.get(w),
      g = [];
    for (const j of list) {
      const a = wy.nodes[j],
        b = wy.nodes[j + 1];
      if (NDZ && wy.cl !== 10) {
        if (NTUN[a] || NTUN[b]) {
          if (k >= 0.3 && NTUN[a] !== NTUN[b])
            portals.push(
              NTUN[a] ? [b, NX[a] - NX[b], NY[a] - NY[b], wy.cl] : [a, NX[b] - NX[a], NY[b] - NY[a], wy.cl]
            );
          continue;
        }
        if (NDZ[a] > 0.6 || NDZ[b] > 0.6) {
          if (k >= 0.12) {
            if (!live) decks.push([wy, a, b, Math.min(NDZ[a], NDZ[b])]);
            continue;
          }
        }
        if (wy.cl <= 2 && k >= 0.6) rails.push([wy, a, b]);
      }
      g.push(j);
    }
    ground.set(w, g);
  }
  const stroke = (wy, g, width, col) => {
    c.lineWidth = width;
    c.strokeStyle = col;
    c.beginPath();
    for (const j of g) {
      const a = wy.nodes[j],
        b = wy.nodes[j + 1];
      const fs = wy.fs && wy.fs.get(j);
      if (fs) {
        const G = fs.g,
          up = fs.up,
          dn = up === a ? b : a,
          lx = fs.cx - G.dx * 10,
          ly = fs.cy - G.dy * 10,
          bx = fs.cx + G.dx * 10,
          by = fs.cy + G.dy * 10;
        P(NX[up], NY[up], zN(up), 1);
        P(lx, ly, hAt(lx, ly) + 0.15);
        P(bx, by, hAt(bx, by) + 0.15, 1);
        P(NX[dn], NY[dn], zN(dn));
        continue;
      }
      P(NX[a], NY[a], zN(a), 1);
      P(NX[b], NY[b], zN(b));
    }
    c.stroke();
  };
  // 1) kerbs for every road, 2) every surface, 3) markings — so junctions are one clean piece of asphalt
  for (const w of order) {
    const wy = WAYS[w],
      width = RWW(wy) * k;
    if (wy.cl > 6 || width < 2.5 || wy.sf === 2) continue;
    stroke(wy, ground.get(w), Math.max(1, width + Math.max(1, k * 3)), N_([150, 148, 144], 1));
  }
  for (const w of order) {
    const wy = WAYS[w];
    const width = RWW(wy) * k * (wy.cl === 10 ? Math.max(1, 0.012 / k) : 1);
    stroke(
      wy,
      ground.get(w),
      Math.max(1, width),
      N_(k < 0.03 ? [110, 100, 90] : roadCol(wy), wy.br ? 0.9 : 1)
    );
  }
  if (k >= 0.85) {
    c.setLineDash([3 * k, 4 * k]);
    c.lineWidth = Math.max(1, k * 0.3);
    c.strokeStyle = N_([224, 220, 196], 1);
    c.lineCap = 'butt';
    for (const w of order) {
      const wy = WAYS[w];
      if ((wy.cl > 4 && !(wy.cl <= 6 && wy.ln >= 3)) || wy.sf === 2) continue;
      const offs = laneOffs(wy);
      if (!offs.length) continue;
      c.beginPath();
      for (const j of ground.get(w)) {
        const a = wy.nodes[j],
          b = wy.nodes[j + 1];
        const ex = NX[b] - NX[a],
          ey = NY[b] - NY[a],
          L = Math.hypot(ex, ey);
        if (L < 2) continue;
        const ta = junc(a) ? Math.min(0.45, 11 / L) : 0,
          tb = junc(b) ? Math.min(0.45, 11 / L) : 0;
        if (ta + tb >= 0.9) continue;
        const nx = -ey / L,
          ny = ex / L,
          za = zN(a),
          zb = zN(b);
        for (const o of offs) {
          const x0 = NX[a] + ex * ta + nx * o,
            y0 = NY[a] + ey * ta + ny * o,
            x1 = NX[a] + ex * (1 - tb) + nx * o,
            y1 = NY[a] + ey * (1 - tb) + ny * o;
          P(x0, y0, za + (zb - za) * ta, 1);
          P(x1, y1, za + (zb - za) * (1 - tb));
        }
      }
      c.stroke();
    }
    c.setLineDash([]);
    c.lineCap = 'round';
  }
  if (NDZ) {
    drawFords(c, k, x0, y0, x1, y1, ox, oy);
    drawRails(c, k, rails, ox, oy);
    drawRoadMarks(c, k, x0, y0, x1, y1, ox, oy);
    drawBarriers(c, k, x0, y0, x1, y1, ox, oy);
    for (const q of portals) drawPortal(c, k, q[0], q[1], q[2], q[3], ox, oy);
    if (!live) drawDecks(c, k, decks, ox, oy);
  }
}
/* bridges and ramps drawn live over the ground layer when zoomed in, so traffic underneath goes under them */
function liveDecks() {
  if (!NDZ) return;
  const k = K,
    vr = viewRect(40),
    list = [],
    seen = new Set();
  eachB2(SBUCK, vr[0], vr[1], vr[2], vr[3], (w, j) => {
    const key = w * 65536 + j;
    if (seen.has(key)) return;
    seen.add(key);
    const wy = WAYS[w];
    if (wy.cl > 9 || wy.cl === 10) return;
    const a = wy.nodes[j],
      b = wy.nodes[j + 1];
    if (NTUN[a] || NTUN[b]) return;
    if (NDZ[a] > 0.6 || NDZ[b] > 0.6) list.push([wy, a, b, Math.min(NDZ[a], NDZ[b])]);
  });
  if (!list.length) return;
  const ox = DOX,
    oy = DOY;
  DOX = cx0;
  DOY = cy0;
  DK = k;
  // drawn on the offscreen layer and lit like the ground, so decks darken at night with everything else
  const lit = !(LR > 0.985 && LG > 0.985 && LB > 0.985);
  if (lit) {
    oA.clearRect(0, 0, VW, VH);
    drawDecks(oA, k, list, cx0, cy0);
    litLayer();
    ctx.drawImage(offA, 0, 0);
  } else drawDecks(ctx, k, list, cx0, cy0);
  DOX = ox;
  DOY = oy;
}
function eachB2(m, x0, y0, x1, y1, fn) {
  const i0 = Math.max(0, Math.floor((x0 - GOX) / BG)),
    i1 = Math.min(BGW - 1, Math.floor((x1 - GOX) / BG)),
    j0 = Math.max(0, Math.floor((y0 - GOY) / BG)),
    j1 = Math.min(BGH - 1, Math.floor((y1 - GOY) / BG));
  const visit = a => {
    for (let q = 0; q < a.length; q += 2) fn(a[q], a[q + 1]);
  };
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > m.size * 2) {
    for (const [kk, a] of m) {
      const i = kk % BGW,
        j = (kk / BGW) | 0;
      if (i >= i0 && i <= i1 && j >= j0 && j <= j1) visit(a);
    }
    return;
  }
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const a = m.get(i + j * BGW);
      if (a) visit(a);
    }
}
function cellInF(i, j) {
  const x0 = C.OX + i * C.CS,
    y0 = C.OY + j * C.CS;
  return x0 >= F.OX && y0 >= F.OY && x0 + C.CS <= F.x1 && y0 + C.CS <= F.y1;
}

/* mid/far zoom: same splat renderer over the 300 m grid, with 10 m coast/lake/glacier masks and the same warped land cover as the 10 m tiles */
function landTAt(x, y, h) {
  let t = coarseLandT(
    x + (vn(x / 210 + 31, y / 210) - 0.5) * 280,
    y + (vn(x / 210, y / 210 + 57) - 0.5) * 280
  );
  if (t < 0) t = coarseLandT(x, y);
  if (t < 0) t = GRASS;
  const pn = vn(x / 55 + 7, y / 55 + 3);
  if (t === GRASS) {
    if (h < 140 && pn < 0.2 && HI_R < 25) t = WET;
    else if (pn > 0.78) t = SCRUB;
    else if (h > 380 && pn < 0.45) t = HIGH;
  } else if (t === HIGH) {
    if (pn < 0.13) t = SAND;
    else if (pn > 0.86) t = ROCK;
    else if (h < 260 && pn > 0.62) t = GRASS;
  } else if (t === ROCK) {
    if (pn > 0.8) t = HIGH;
  }
  return t;
}
function cAt(i, j) {
  if (i < 0) i = 0;
  if (j < 0) j = 0;
  if (i >= C.W) i = C.W - 1;
  if (j >= C.H) j = C.H - 1;
  return i + j * C.W;
}
function renderCoarseSmooth(L, cx, cy) {
  const k = LEVELS[L],
    CC = CCC(k),
    i0 = cx * CC,
    j0 = cy * CC;
  if (i0 >= C.W || j0 >= C.H || i0 < 0 || j0 < 0) return null;
  const NW = Math.min(CC, C.W - i0),
    NH = Math.min(CC, C.H - j0);
  const X0 = C.OX + i0 * 300,
    Y0 = C.OY + j0 * 300,
    Wm = NW * 300,
    Hm = NH * 300;
  const mh =
    Math.max(
      0,
      maxH(
        C,
        Math.max(0, i0 - 1),
        Math.max(0, j0 - 1),
        Math.min(C.W, i0 + NW + 1),
        Math.min(C.H, j0 + NH + 1)
      )
    ) + 8;
  const S = { OX: X0, OY: Y0, CS: 300 };
  const bb = chunkBounds(S, 0, 0, NW, NH, k, mh),
    ox = bb[0],
    oy = bb[1],
    w = bb[2] - ox,
    h = bb[3] - oy;
  if (w > 4096 || h > 4096 || w < 1 || h < 1) return { empty: 1 };
  const ax = Math.abs(SXx) + Math.abs(SXy),
    ay = Math.abs(SYx) + Math.abs(SYy);
  const step = Math.max(10, 1.3 / (ax * k));
  const nxi = Math.max(1, Math.ceil(Wm / step)),
    nyi = Math.max(1, Math.ceil(Hm / step)),
    stx = Wm / nxi,
    sty = Hm / nyi,
    M = 5,
    nx = nxi + 2 * M,
    ny = nyi + 2 * M; // M: margin samples so blur and slope shading match across chunk seams
  const N = nx * ny,
    SZ = new Float32Array(N),
    ST = new Uint8Array(N),
    SKIP = new Uint8Array(N),
    SU = new Float32Array(N),
    SD = new Float32Array(N);
  const fF = false;
  for (let b = 0; b < ny; b++) {
    const y = Y0 + (b - M + 0.5) * sty;
    for (let a = 0; a < nx; a++) {
      const x = X0 + (a - M + 0.5) * stx,
        si = a + b * nx;
      if (fF && x >= F.OX && y >= F.OY && x < F.x1 && y < F.y1) {
        SKIP[si] = 1;
        continue;
      }
      const gi = Math.floor((x - C.OX) / 10),
        gj = Math.floor((y - C.OY) / 10);
      let cl;
      if (stx > 60) {
        const tc = C.GT[cAt(Math.floor((x - C.OX) / 300), Math.floor((y - C.OY) / 300))];
        cl = tc === SEA ? 1 : tc === LAKE ? 2 : tc === GLACIER ? 3 : 0;
      } else cl = clsFast(gi, gj);
      const fx = (x - C.OX) / 300 - 0.5,
        fy = (y - C.OY) / 300 - 0.5,
        ci = Math.floor(fx),
        cj = Math.floor(fy),
        u = fx - ci,
        v = fy - cj;
      let urb = 0,
        dep = 0;
      for (let q = 0; q < 4; q++) {
        const c = cAt(ci + (q & 1), cj + (q >> 1)),
          wq = (q & 1 ? u : 1 - u) * (q >> 1 ? v : 1 - v),
          t = C.GT[c];
        if (t === URBAN) urb += wq;
        if (t === SEA) dep += C.HT[c] * wq;
      }
      SU[si] = urb;
      SD[si] = dep;
      if (cl === 1) {
        ST[si] = SEA;
        SZ[si] = 0;
        continue;
      }
      const hh = hInterp(x, y);
      if (cl === 2) {
        ST[si] = LAKE;
        SZ[si] = Math.max(1, hh);
        continue;
      }
      if (cl === 3) {
        ST[si] = GLACIER;
        SZ[si] = Math.max(1, hh);
        continue;
      }
      SZ[si] = Math.max(1, hh);
      let lt = landTAt(x, y, hh);
      if (stx > 60 && (lt === SAND || lt === WET)) lt = GRASS;
      ST[si] = lt;
    }
  }
  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  const c = cvs.getContext('2d');
  const img = c.createImageData(w, h),
    buf = new Uint32Array(img.data.buffer),
    dep = new Float32Array(w * h).fill(-1e30);
  const sa = SYx > 1e-6 ? 1 : SYx < -1e-6 ? -1 : 0,
    sb = SYy > 1e-6 ? 1 : SYy < -1e-6 ? -1 : 0;
  const pw = Math.max(1, Math.ceil(stx * ax * k + 0.6)),
    ph = Math.max(1, Math.ceil(sty * ay * k + 0.6));
  // colours first, then a small blur across land samples so land-cover borders fade instead of cutting
  const CR = new Float32Array(N),
    CG = new Float32Array(N),
    CB = new Float32Array(N);
  for (let b = 0; b < ny; b++) {
    const y = Y0 + (b - M + 0.5) * sty;
    for (let a = 0; a < nx; a++) {
      const si = a + b * nx;
      if (SKIP[si]) continue;
      const x = X0 + (a - M + 0.5) * stx,
        z = SZ[si],
        t = ST[si];
      if (t === SEA) {
        const sb = seaBase(x, y, SD[si]);
        SR = sb[0];
        SG = sb[1];
        SB = sb[2];
        const wv = h32(Math.floor(x / 40), Math.floor(y / 20), 6) > 0.97 ? 1.06 : 1;
        SR *= wv;
        SG *= wv;
        SB *= wv;
      } else {
        SM = 1;
        sCol(t, z, x, y, 0);
        SM = 0;
      }
      CR[si] = SR;
      CG[si] = SG;
      CB[si] = SB;
    }
  }
  const rad = Math.max(1, Math.min(3, Math.round(22 / stx)));
  for (let pass = 0; pass < 2; pass++) {
    const R2 = CR.slice(),
      G2 = CG.slice(),
      B2 = CB.slice();
    for (let b = 0; b < ny; b++)
      for (let a = 0; a < nx; a++) {
        const si = a + b * nx,
          t = ST[si];
        if (t === SEA || t === LAKE || SKIP[si]) continue;
        let r = 0,
          gg = 0,
          bl = 0,
          n = 0;
        for (let q = -rad; q <= rad; q++) {
          const aa = pass ? a : a + q,
            bb = pass ? b + q : b;
          if (aa < 0 || bb < 0 || aa >= nx || bb >= ny) continue;
          const sj = aa + bb * nx,
            tj = ST[sj];
          if (tj === SEA || tj === LAKE || SKIP[sj]) continue;
          r += R2[sj];
          gg += G2[sj];
          bl += B2[sj];
          n++;
        }
        CR[si] = r / n;
        CG[si] = gg / n;
        CB[si] = bl / n;
      }
  }
  for (let b = M; b < ny - M; b++) {
    const y = Y0 + (b - M + 0.5) * sty;
    for (let a = M; a < nx - M; a++) {
      const si = a + b * nx;
      if (SKIP[si]) continue;
      const x = X0 + (a - M + 0.5) * stx,
        z = SZ[si],
        t = ST[si];
      SR = CR[si];
      SG = CG[si];
      SB = CB[si];
      let sh = 1;
      if (t !== SEA && t !== LAKE) {
        const zl = SZ[Math.max(0, a - 1) + b * nx],
          zr = SZ[Math.min(nx - 1, a + 1) + b * nx],
          zu = SZ[a + Math.max(0, b - 1) * nx],
          zd = SZ[a + Math.min(ny - 1, b + 1) * nx];
        const dzx = (zr - zl) / (2 * stx),
          dzy = (zd - zu) / (2 * sty);
        sh = 1 + Math.max(-0.42, Math.min(0.42, (dzx * SXx + dzy * SXy) * 0.7071 * 2.2));
      }
      let r = SR * sh,
        gg = SG * sh,
        bl = SB * sh;
      const ub = SU[si];
      if (ub > 0 && t !== SEA && t !== LAKE) {
        const m = Math.min(0.35, ub * 0.45);
        r += (158 - r) * m;
        gg += (154 - gg) * m;
        bl += (144 - bl) * m;
      }
      const col32 =
        (255 << 24) |
        ((Math.min(255, bl) | 0) << 16) |
        ((Math.min(255, gg) | 0) << 8) |
        (Math.min(255, r) | 0);
      const PY = PYw(x, y);
      const sx = PXw(x, y) * k - ox,
        sy = (PY - z) * k - oy;
      let ext = 0;
      if (sa) {
        const aa = a + sa;
        if (aa >= 0 && aa < nx) {
          const zn = SZ[aa + b * nx];
          const d = (SYx * sa * stx - (zn - z)) * k - ph;
          if (d > ext) ext = d;
        }
      }
      if (sb) {
        const b2 = b + sb;
        if (b2 >= 0 && b2 < ny) {
          const zn = SZ[a + b2 * nx];
          const d = (SYy * sb * sty - (zn - z)) * k - ph;
          if (d > ext) ext = d;
        }
      }
      const x0 = Math.round(sx - pw * 0.5),
        y0 = Math.round(sy - ph * 0.5),
        x1 = Math.min(w, x0 + pw),
        y1 = Math.min(h, y0 + ph + Math.ceil(Math.min(ext, 80)));
      for (let yy = Math.max(0, y0); yy < y1; yy++) {
        const o = yy * w;
        for (let xx = Math.max(0, x0); xx < x1; xx++) {
          const p = o + xx;
          if (dep[p] <= PY) {
            dep[p] = PY;
            buf[p] = col32;
          }
        }
      }
    }
  }
  c.putImageData(img, 0, 0);
  DOX = ox;
  DOY = oy;
  DK = k;
  BAKE = false;
  drawRoads(c, k, X0, Y0, X0 + Wm, Y0 + Hm, ox, oy);
  BAKE = true;
  return { cv: cvs, ox, oy, w, h };
}
function chunkContents(L, cx, cy) {
  const k = LEVELS[L],
    S = CCF(k) * 10,
    x0 = GOX + cx * S,
    y0 = GOY + cy * S,
    x1 = x0 + S,
    y1 = y0 + S;
  const bs = [],
    ts = [];
  eachB(BBUCK, x0, y0, x1 - 1e-6, y1 - 1e-6, b => {
    if (b.cx >= x0 && b.cx < x1 && b.cy >= y0 && b.cy < y1 && b.state !== 9) bs.push(b);
  });
  if (k >= 0.12)
    eachB(TBUCK, x0, y0, x1 - 1e-6, y1 - 1e-6, t => {
      const x = TREES.x[t],
        y = TREES.y[t];
      if (x >= x0 && x < x1 && y >= y0 && y < y1 && TREES.s[t] !== 3) ts.push(t);
    });
  return { bs, ts };
}
function renderBld(L, cx, cy, lights) {
  const k = LEVELS[L],
    cc = chunkContents(L, cx, cy);
  for (const b of cc.bs) if (b.rr !== ROT) rotB(b);
  if (!cc.bs.length && !cc.ts.length) return { empty: 1 };
  let mnx = 1e12,
    mxx = -1e12,
    mny = 1e12,
    mxy = -1e12;
  for (const b of cc.bs) {
    const t = b.z + b.base + b.h + (b.sp === 1 ? 8 : b.sp === 3 ? 30 : 6) + (b.state === 3 ? 14 : 0);
    mnx = Math.min(mnx, b.sMin);
    mxx = Math.max(mxx, b.sMax);
    mny = Math.min(mny, b.dMin - t);
    mxy = Math.max(mxy, b.dMax - b.z + 3);
  }
  if (!lights)
    for (const t of cc.ts) {
      const x = TREES.x[t],
        y = TREES.y[t],
        z = hAt(x, y),
        s = PXw(x, y),
        d = PYw(x, y);
      mnx = Math.min(mnx, s - 4);
      mxx = Math.max(mxx, s + 4);
      mny = Math.min(mny, d - z - 14);
      mxy = Math.max(mxy, d - z + 2);
    }
  if (mnx > mxx) return { empty: 1 };
  const ox = Math.floor(mnx * k) - 2,
    oy = Math.floor(mny * k) - 2,
    w = Math.min(4096, Math.ceil(mxx * k) - ox + 3),
    h = Math.min(4096, Math.ceil(mxy * k) - oy + 3);
  const cvs = document.createElement('canvas');
  cvs.width = Math.max(1, w);
  cvs.height = Math.max(1, h);
  const c = cvs.getContext('2d');
  DOX = ox;
  DOY = oy;
  DK = k;
  BAKE = false;
  const items = [];
  for (const b of cc.bs) items.push([b.key + b.base * 0.01, 0, b]);
  if (!lights) for (const t of cc.ts) items.push([PYw(TREES.x[t], TREES.y[t]), 1, t]);
  items.sort((a, b) => a[0] - b[0] || (a[2].base || 0) - (b[2].base || 0));
  // hills in front (see hillLine): a chunk is baked once, so every check is done now, whatever the frame budget
  const hb = hlBudget,
    hills = k >= 0.18;
  hlBudget = Infinity;
  const hillOf = it =>
    !hills ? 0 : it[1] === 0 ? hillBld(it[2]) : hillTree(it[2], TREES.x[it[2]], TREES.y[it[2]]);
  for (const it of items) {
    if (lights && it[1] !== 0) continue;
    const hl = hillOf(it);
    if (hl === 1) continue;
    if (hl) {
      if (it[1] === 0) clipAboveLine(c, hl, k, ox, oy);
      else clipAboveY(c, hl, k, oy);
    }
    if (lights) drawBld(c, it[2], 2);
    else if (it[1] === 0) {
      if (k < 0.18) lodBld(c, it[2]);
      else drawBld(c, it[2], 0);
    } else drawTree(c, it[2], 0);
    if (hl) c.restore();
    DOX = ox;
    DOY = oy;
    DK = k;
  }
  hlBudget = hb;
  BAKE = true;
  return { cv: cvs, ox, oy, w: cvs.width, h: cvs.height };
}
function lodBld(c, b) {
  const k = DK;
  if (b.hide) return;
  if (b.state === 2) {
    c.fillStyle = N_([128, 116, 104], 1);
    c.fillRect(Math.round(PXw(b.cx, b.cy) * k - DOX), Math.round((PYw(b.cx, b.cy) - b.z) * k - DOY), 1, 1);
    return;
  }
  const P = b.poly,
    n = b.n,
    z1 = b.z + b.base + b.h * b.prog;
  if (k < 0.06) {
    c.fillStyle = N_(b.kind <= 1 ? b.roofC : b.wallC, 1);
    c.fillRect(
      Math.round(PXw(b.cx, b.cy) * k - DOX),
      Math.round((PYw(b.cx, b.cy) - z1) * k - DOY),
      1,
      Math.max(1, Math.round(b.h * k))
    );
    return;
  }
  c.fillStyle = N_(b.wallC, 0.8);
  c.beginPath();
  for (let j = 0; j < n; j++) {
    const x = P[2 * j],
      y = P[2 * j + 1];
    const sx = PXw(x, y) * k - DOX,
      sy = (PYw(x, y) - b.z) * k - DOY;
    j ? c.lineTo(sx, sy) : c.moveTo(sx, sy);
  }
  c.fill();
  c.fillStyle = N_(b.roof === 1 || b.kind <= 1 ? b.roofC : b.wallC, b.roof === 1 ? 1 : 1.05);
  c.beginPath();
  for (let j = 0; j < n; j++) {
    const x = P[2 * j],
      y = P[2 * j + 1];
    const sx = PXw(x, y) * k - DOX,
      sy = (PYw(x, y) - z1) * k - DOY;
    j ? c.lineTo(sx, sy) : c.moveTo(sx, sy);
  }
  c.fill();
  const h = Math.round(b.h * k);
  if (h >= 1) {
    c.fillStyle = N_(b.wallC, 0.72);
    c.fillRect(Math.round(PXw(b.cx, b.cy) * k - DOX), Math.round((PYw(b.cx, b.cy) - z1) * k - DOY), 1, h);
  }
}

/* chunk cache */
const CACHE = new Map();
let cachePx = 0;
const CACHE_MAX = 34e6;
let frameNo = 0;
const RS = 1099511627776,
  ckey = (L, t, cx, cy) => ROT * RS + ((L * 8 + t) * 8192 + cx) * 8192 + cy;
function getChunk(L, t, cx, cy) {
  const e = CACHE.get(ckey(L, t, cx, cy));
  if (e) {
    e.last = frameNo;
    return e;
  }
  return null;
}
function putChunk(L, t, cx, cy, v) {
  const key = ckey(L, t, cx, cy);
  v.last = frameNo;
  v.px = v.empty ? 0 : v.w * v.h;
  CACHE.set(key, v);
  cachePx += v.px;
  if (cachePx > CACHE_MAX) {
    const arr = [...CACHE.entries()].sort((a, b) => a[1].last - b[1].last);
    for (const [kk, vv] of arr) {
      if (cachePx < CACHE_MAX * 0.8) break;
      if (vv.last >= frameNo - 1) continue;
      CACHE.delete(kk);
      cachePx -= vv.px;
    }
  }
}
function dropKey(key) {
  const base = key - ROT * RS;
  for (let r = 0; r < 8; r++) {
    const k2 = base + r * RS,
      e = CACHE.get(k2);
    if (e) {
      CACHE.delete(k2);
      cachePx -= e.px;
    }
  }
}
function dirtyCell(c, ground, bld) {
  if (ground) {
    let gi, gj, t;
    if (c < FN) {
      gi = c % F.W;
      gj = (c / F.W) | 0;
      t = 0;
    } else if (c >= DB) {
      const l = c - DB;
      gi = l % DGW;
      gj = (l - gi) / DGW;
      t = 4;
    }
    if (t !== undefined)
      for (let L = 0; L < LEVELS.length; L++) {
        const k = LEVELS[L];
        if ((t === 0 && k < FMIN) || (t === 4 && k < DKMIN)) continue;
        const CC = CCF(k),
          cx = Math.floor(gi / CC),
          cy = Math.floor(gj / CC);
        dropKey(ckey(L, t, cx, cy));
        if (gi % CC === 0) dropKey(ckey(L, t, cx - 1, cy));
        if ((gi + 1) % CC === 0) dropKey(ckey(L, t, cx + 1, cy));
        if (gj % CC === 0) dropKey(ckey(L, t, cx, cy - 1));
        if ((gj + 1) % CC === 0) dropKey(ckey(L, t, cx, cy + 1));
      }
  }
  if (bld) {
    const [x, y] = cellCenter(c);
    dirtyWorld(x, y, false, true);
  }
}
function dirtyWorld(x, y, ground, bld) {
  if (ground) {
    const c = cellAt(x, y);
    if (c >= 0) dirtyCell(c, true, false);
  }
  if (bld)
    for (let L = 0; L < LEVELS.length; L++) {
      const k = LEVELS[L];
      if (k < BMIN) continue;
      const S = CCF(k) * 10,
        cx = Math.floor((x - GOX) / S),
        cy = Math.floor((y - GOY) / S);
      dropKey(ckey(L, 1, cx, cy));
      dropKey(ckey(L, 2, cx, cy));
    }
}
function dirtyB(b) {
  b.spr = null;
  dirtyWorld(b.cx, b.cy, false, true);
}
