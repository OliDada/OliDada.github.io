/**
 * Frame rendering
 *
 * Which chunks are visible, prefetching, the chunk cache and draw(), which paints one frame.
 *
 * Functions: drawFallback, chunkLists, prefetchPan, prefetchLevel, chunkList, ensure, ensure0, draw,
 *     tintCol, litLayer, drawTownGlow, drawPoolSteam, drawLamps, lavaQuad, drawLava, drawFlood,
 *     drawLabels, drawCompass, drawCursor, itemHill
 * State and constants: pfLast, pfVel, pending, RT
 */

function drawFallback(k) {
  const sv = [li, K, camX, camY];
  oA.imageSmoothingEnabled = false;
  try {
    {
      const L2 = Math.max(0, li - 3),
        k2 = LEVELS[L2],
        f = k / k2;
      if (L2 < li) {
        li = L2;
        K = k2;
        camX = sv[2] / f;
        camY = sv[3] / f;
        const { cch, dch, fch } = chunkLists(k2);
        const dl = performance.now() + (ZM ? 9 : 5);
        for (const [lst, t] of [
          [cch, 3],
          [dch, 4],
          [fch, 0]
        ])
          for (const [i, j] of lst) {
            const e = ensure(L2, t, i, j, dl);
            if (e && !e.empty)
              oA.drawImage(
                e.cv,
                Math.round(e.ox * f - cx0),
                Math.round(e.oy * f - cy0),
                Math.ceil(e.w * f),
                Math.ceil(e.h * f)
              );
          }
        li = sv[0];
        K = sv[1];
        camX = sv[2];
        camY = sv[3];
      }
    }
    for (const L2 of [li + 1, li - 1, li + 2, li - 2, li + 3]) {
      if (L2 < 0 || L2 >= LEVELS.length) continue;
      const k2 = LEVELS[L2],
        f = k / k2;
      li = L2;
      K = k2;
      camX = sv[2] / f;
      camY = sv[3] / f;
      const { cch, dch, fch } = chunkLists(k2);
      let n = 0;
      for (const [lst, t] of [
        [cch, 3],
        [dch, 4],
        [fch, 0]
      ])
        for (const [i, j] of lst) {
          const e = getChunk(L2, t, i, j);
          if (e && !e.empty) {
            oA.drawImage(
              e.cv,
              Math.round(e.ox * f - cx0),
              Math.round(e.oy * f - cy0),
              Math.ceil(e.w * f),
              Math.ceil(e.h * f)
            );
            n++;
          }
        }
      li = sv[0];
      K = sv[1];
      camX = sv[2];
      camY = sv[3];
      if (n > (cch.length + dch.length + fch.length) * 0.85) break;
    }
  } finally {
    li = sv[0];
    K = sv[1];
    camX = sv[2];
    camY = sv[3];
  }
}
function chunkLists(k) {
  const vrBig = viewRect(0, 2100),
    vr0 = viewRect(0, 150);
  const useD = k >= DKMIN;
  const dch = useD
    ? chunkList(
        Math.max(C.OX, vrBig[0]),
        Math.max(C.OY, vrBig[1]),
        Math.min(C.x1, vrBig[2]),
        Math.min(C.y1, vrBig[3]),
        CCF(k) * DCS,
        C.OX,
        C.OY,
        2100,
        k
      ).filter(([i, j]) => !chunkInF(i, j, CCF(k)))
    : [];
  const cch = !useD
    ? chunkList(
        Math.max(C.OX, vrBig[0]),
        Math.max(C.OY, vrBig[1]),
        Math.min(C.x1, vrBig[2]),
        Math.min(C.y1, vrBig[3]),
        CCC(k) * C.CS,
        C.OX,
        C.OY,
        2100,
        k
      )
    : [];
  const fch =
    k >= FMIN
      ? chunkList(
          Math.max(F.OX, vr0[0]),
          Math.max(F.OY, vr0[1]),
          Math.min(F.x1 - 1, vr0[2]),
          Math.min(F.y1 - 1, vr0[3]),
          CCF(k) * F.CS,
          F.OX,
          F.OY,
          150,
          k
        )
      : [];
  const bch =
    k >= BMIN && k < DIRECT ? chunkList(vr0[0], vr0[1], vr0[2], vr0[3], CCF(k) * 10, GOX, GOY, 150, k) : [];
  const pch = k >= 0.4 ? chunkList(vr0[0], vr0[1], vr0[2], vr0[3], CCF(k) * 10, GOX, GOY, 150, k) : [];
  return { cch, dch, fch, bch, pch };
}
/* while zooming in, render the next level's chunks ahead of time (camera as it will be when that level takes over) */
let pfLast = [0, 0],
  pfVel = [0, 0];
function prefetchPan(budget) {
  const dx = camX - pfLast[0],
    dy = camY - pfLast[1];
  pfLast = [camX, camY];
  pfVel = [pfVel[0] * 0.8 + dx * 0.2, pfVel[1] * 0.8 + dy * 0.2];
  const sp = Math.hypot(pfVel[0], pfVel[1]);
  if (sp < 0.5 || ZM || TR) return;
  const sv = [camX, camY],
    L = li,
    k = K;
  const ux = pfVel[0] / sp,
    uy = pfVel[1] / sp;
  camX += ux * VW * 0.6;
  camY += uy * VH * 0.6;
  try {
    if (window.__nopf) return;
    const { cch, dch, fch, bch, pch } = chunkLists(k);
    for (const [lst, t] of [
      [fch, 0],
      [dch, 4],
      [cch, 3],
      [bch, 1],
      [pch, 5]
    ])
      for (const [i, j] of lst) {
        if (getChunk(L, t, i, j)) continue;
        ensure(L, t, i, j, performance.now() + budget);
        return;
      }
  } finally {
    // one chunk per spare frame
    camX = sv[0];
    camY = sv[1];
  }
}
function prefetchLevel(n, budget) {
  if (n < 0 || n >= LEVELS.length || n === li || !ZM) return;
  const sv = [li, K, camX, camY];
  const f = LEVELS[n] / K;
  // camera at the end of the zoom: the world point under the anchor stays under it
  const cxF = f * (camX + (ZM.ax - ZS.tx) / ZS.s) - ZM.ax,
    cyF = f * (camY + (ZM.ay - ZS.ty) / ZS.s) - ZM.ay;
  li = n;
  K = LEVELS[n];
  camX = cxF;
  camY = cyF;
  try {
    const L = n,
      k = K;
    const { cch, dch, fch, bch } = chunkLists(k);
    const dl = performance.now() + budget;
    for (const lst of [
      [cch, 3],
      [dch, 4],
      [fch, 0],
      [bch, 1]
    ])
      for (const [i, j] of lst[0]) {
        if (performance.now() > dl) break;
        ensure(L, lst[1], i, j, dl);
      }
  } finally {
    li = sv[0];
    K = sv[1];
    camX = sv[2];
    camY = sv[3];
  }
}
function chunkList(x0, y0, x1, y1, S, ox, oy, zmax, k) {
  // chunks of world-size S anchored at (ox,oy), visible on screen, depth-sorted
  const i0 = Math.floor((x0 - ox) / S),
    i1 = Math.floor((x1 - ox) / S),
    j0 = Math.floor((y0 - oy) / S),
    j1 = Math.floor((y1 - oy) / S),
    out = [];
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const xa = ox + i * S,
        ya = oy + j * S,
        xb = xa + S,
        yb = ya + S;
      let a0 = 1e12,
        a1 = -1e12,
        b0 = 1e12,
        b1 = -1e12;
      for (const [x, y] of [
        [xa, ya],
        [xb, ya],
        [xa, yb],
        [xb, yb]
      ]) {
        const a = PXw(x, y) * k - camX,
          b = PYw(x, y) * k - camY;
        a0 = Math.min(a0, a);
        a1 = Math.max(a1, a);
        b0 = Math.min(b0, b);
        b1 = Math.max(b1, b);
      }
      if (a1 < -10 || a0 > VW + 10 || b1 < -10 || b0 - zmax * k > VH + 10) continue;
      out.push([i, j, PYw(xa + S / 2, ya + S / 2)]);
    }
  out.sort((a, b) => a[2] - b[2]);
  return out;
}
let pending = 0;
const RT = {};
window.__rt = RT;
function ensure(L, t, i, j, deadline) {
  let e = getChunk(L, t, i, j);
  if (e) return e;
  if (performance.now() > deadline) {
    pending++;
    return null;
  }
  const _t0 = performance.now();
  try {
    return ensure0(L, t, i, j);
  } finally {
    const d = performance.now() - _t0;
    window.__ens = (window.__ens || 0) + d;
    const kk = t + '@' + LEVELS[L];
    const r = RT[kk] || (RT[kk] = { n: 0, s: 0, m: 0 });
    r.n++;
    r.s += d;
    r.m = Math.max(r.m, d);
  }
}
function ensure0(L, t, i, j) {
  const v =
    t === 0
      ? renderFine(L, i, j)
      : t === 3
        ? renderCoarseSmooth(L, i, j)
        : t === 4
          ? renderDetail(L, i, j)
          : t === 5
            ? renderProps(L, i, j)
            : renderBld(L, i, j, t === 2);
  if (!v) return null;
  putChunk(L, t, i, j, v);
  return v;
}
/* hills in front of a sorted draw item (see hillLine): 0 in view, 1 hidden, or where to clip */
function itemHill(it) {
  const t = it[1],
    o = it[2];
  if (t === 0) return hillBld(o);
  if (t === 1) {
    return hillTree(o, TREES.x[o], TREES.y[o]);
  }
  if (t === 2) {
    if (o === follow || (CTRL && CTRL.a === o) || o.hidden) return 0;
    return hillPt(o, o.x, o.y, hAt(o.x, o.y) + (o.dz || 0), o.car ? 2.5 : 1.9, 15);
  }
  if (t === 3) return hillPt(o, o.x, o.y, o.z || hAt(o.x, o.y), 1.5, 15);
  if (t === 4) return hillPt(o, o.x, o.y, hAt(o.x, o.y), 4, 600);
  if (t === 7) return hillPt(o, o.x, o.y, hAt(o.x, o.y), 12, 30);
  return 0;
}
function draw() {
  frameNo++;
  pending = 0;
  const sk = !RM && shake > 0 ? shake * 4 : 0;
  cx0 = Math.round(camX + (R() - 0.5) * sk);
  cy0 = Math.round(camY + (R() - 0.5) * sk);
  const L = li,
    k = K,
    direct = k >= DIRECT;
  const moving = Math.hypot(pfVel[0], pfVel[1]) > 0.5;
  const deadline =
    performance.now() +
    (ZM
      ? 5
      : performance.now() - zoomEndT < 1500
        ? 8
        : TR && TR.type === 'rot' && TR.phase === 'prep'
          ? 10
          : moving
            ? 9
            : snapValid
              ? 14
              : 22);
  drawOceanBG();
  const { cch, dch, fch, bch, pch } = chunkLists(k);
  let missing = false;
  for (const [i, j] of cch)
    if (!getChunk(L, 3, i, j)) {
      missing = true;
      break;
    }
  if (!missing)
    for (const [i, j] of fch)
      if (!getChunk(L, 0, i, j)) {
        missing = true;
        break;
      }
  if (!missing)
    for (const [i, j] of dch)
      if (!getChunk(L, 4, i, j)) {
        missing = true;
        break;
      }
  if (missing && snapValid) {
    const f = K / snapK;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      snapC,
      Math.round(snapCX * f - camX),
      Math.round(snapCY * f - camY),
      Math.round(VW * f),
      Math.round(VH * f)
    );
  }
  oA.clearRect(0, 0, VW, VH);
  const _tf = performance.now();
  if (missing) drawFallback(k);
  window.__tfb = (window.__tfb || 0) + performance.now() - _tf;
  for (const [i, j] of cch) {
    const e = ensure(L, 3, i, j, deadline);
    if (e && !e.empty) oA.drawImage(e.cv, e.ox - cx0, e.oy - cy0);
  }
  for (const [i, j] of dch) {
    const e = ensure(L, 4, i, j, deadline);
    if (e && !e.empty) oA.drawImage(e.cv, e.ox - cx0, e.oy - cy0);
  }
  for (const [i, j] of fch) {
    const e = ensure(L, 0, i, j, deadline);
    if (e && !e.empty) oA.drawImage(e.cv, e.ox - cx0, e.oy - cy0);
  }
  drawFlood(oA);
  litLayer();
  ctx.drawImage(offA, 0, 0);
  if (pch.length) {
    oA.clearRect(0, 0, VW, VH);
    let any = 0;
    for (const [i, j] of pch) {
      let e = ensure(L, 5, i, j, deadline);
      if (e && e.stale && performance.now() < deadline) {
        const nv = renderProps(L, i, j);
        const kk = ckey(L, 5, i, j);
        if (CACHE.get(kk) === e) {
          CACHE.delete(kk);
          cachePx -= e.px;
        }
        putChunk(L, 5, i, j, nv);
        e = nv;
      }
      if (e && !e.empty) {
        oA.drawImage(e.cv, e.ox - cx0, e.oy - cy0);
        any = 1;
      }
    }
    if (any) {
      litLayer();
      ctx.drawImage(offA, 0, 0);
    }
  }
  drawLava();
  drawBoats();
  drawGeo();
  drawLandLines();
  drawPistes();
  drawPipes();
  drawExtraGround();
  if (direct) {
    drawSignals();
    drawLamps();
    drawPoolSteam();
    const vr = viewRect(30);
    const items = [];
    eachB(BBUCK, vr[0], vr[1], vr[2], vr[3], b => {
      if (b.state === 9) return;
      if (b.rr !== ROT) rotB(b);
      const sxa = b.sMin * k - cx0,
        sxb = b.sMax * k - cx0;
      if (sxb < -5 || sxa > VW + 5) return;
      const syb = (b.dMax - b.z) * k - cy0 + 4,
        sya = (b.dMin - b.z - b.base - b.h - 30) * k - cy0;
      if (syb < -5 || sya > VH + 5) return;
      items.push([b.key + b.base * 0.01, 0, b]);
    });
    eachB(TBUCK, vr[0], vr[1], vr[2], vr[3], t => {
      if (TREES.s[t] === 3) return;
      const x = TREES.x[t],
        y = TREES.y[t];
      const sx = PXw(x, y) * k - cx0;
      if (sx < -20 || sx > VW + 20) return;
      const sy = PYw(x, y) * k - cy0;
      if (sy < -40 || sy > VH + 600) return;
      items.push([PYw(x, y), 1, t]);
    });
    const upper = [];
    for (const a of agents) {
      if (a.dead) continue;
      if ((a.dz || 0) > 1.2) {
        upper.push(a);
        continue;
      }
      items.push([PYw(a.x, a.y) + (a.car ? 0.9 : 0.35), 2, a]);
    }
    for (const a of animals) {
      if (a.dead || a.fly) continue;
      items.push([PYw(a.x, a.y) + 0.3, 3, a]);
    }
    if (PROPS_OK)
      ptsIn(vr[0], vr[1], vr[2], vr[3], p => {
        if (LIVE_PT.has(p.c)) items.push([PYw(p.x, p.y) + 0.2, 4, p]);
      });
    for (const p of planeAll())
      if (
        !p.fly &&
        p.x !== undefined &&
        p.x > vr[0] - 80 &&
        p.x < vr[2] + 80 &&
        p.y > vr[1] - 80 &&
        p.y < vr[3] + 80
      )
        items.push([PYw(p.x, p.y) + 2, 5, p]);
    if (CONCERT.on || CONCERT.fade) items.push([PYw(CONCERT.x, CONCERT.y) + 4, 6, null]);
    for (const e of ENTS) if (e.type === 'troll') items.push([PYw(e.x, e.y) + 3, 7, e]);
    pylonItems(vr, items);
    extraItems(vr, items);
    items.sort((a, b) => a[0] - b[0] || ((a[2] && a[2].base) || 0) - ((b[2] && b[2].base) || 0));
    DOX = cx0;
    DOY = cy0;
    DK = k;
    BAKE = true;
    bsprBudget = performance.now() + 6;
    hlBudget = performance.now() + 4;
    for (const it of items) {
      // hills in front: leave out what is behind one, and cut off what is half behind a ridge
      const hl = itemHill(it);
      if (hl === 1) continue;
      if (hl) {
        if (it[1] === 0) clipAboveLine(ctx, hl, k, cx0, cy0);
        else clipAboveY(ctx, hl, k, cy0);
      }
      if (it[1] === 0) drawBldC(it[2], k);
      else if (it[1] === 1) drawTree(ctx, it[2], 1);
      else if (it[1] === 3) drawAnimal(it[2]);
      else if (it[1] === 4) drawPt(ctx, k, it[2], cx0, cy0, true);
      else if (it[1] === 5) drawPlane(it[2]);
      else if (it[1] === 6) drawStage();
      else if (it[1] === 7) drawTroll(it[2]);
      else if (it[1] === 8) drawPTower(it[2][0], it[2][1]);
      else if (it[1] === 9) drawExtraTall(it[2]);
      else drawAgent(it[2]);
      if (hl) ctx.restore();
      DOX = cx0;
      DOY = cy0;
      DK = k;
    }
    liveDecks();
    upper.sort((p, q) => PYw(p.x, p.y) - PYw(q.x, q.y));
    for (const a of upper) drawAgent(a);
    DOX = cx0;
    DOY = cy0;
    DK = k;
  } else {
    oA.clearRect(0, 0, VW, VH);
    for (const [i, j] of bch) {
      const e = ensure(L, 1, i, j, deadline);
      if (e && !e.empty) oA.drawImage(e.cv, e.ox - cx0, e.oy - cy0);
    }
    litLayer();
    ctx.drawImage(offA, 0, 0);
    drawSignals();
    drawPylons();
    drawExtraTallAll();
    if (nightK > 0 && k >= BMIN) {
      ctx.save();
      ctx.globalAlpha = nightK;
      ctx.globalCompositeOperation = 'lighter';
      for (const [i, j] of bch) {
        const e = ensure(L, 2, i, j, deadline);
        if (e && !e.empty) ctx.drawImage(e.cv, e.ox - cx0, e.oy - cy0);
      }
      ctx.restore();
      drawLamps();
    }
    if (nightK > 0 && k < BMIN) drawTownGlow();
    for (const b of burning) {
      DOX = cx0;
      DOY = cy0;
      DK = k;
      flames(ctx, b, b.z + b.base + b.h);
    }
    hlBudget = performance.now() + 3;
    if (k >= 0.27)
      for (const a of agents) {
        if (a.dead || a.hidden || (a.intun && a !== follow)) continue;
        // the buildings are already drawn: leave out whoever is behind one (unless you are following them)
        const z = hAt(a.x, a.y) + (a.dz || 0),
          s = sp_(a.x, a.y, z);
        if (s[0] < -40 || s[0] > VW + 40 || s[1] < -60 || s[1] > VH + 40) continue;
        if (
          a !== follow &&
          !(CTRL && CTRL.a === a) &&
          (behindBld(a, a.x, a.y, z + (a.car ? 0.8 : 0.9)) || hillPt(a, a.x, a.y, z, 1.7, 15))
        )
          continue;
        if (a.car) drawCar(a, z);
        else {
          ctx.fillStyle = C_(a.shirt, 1);
          ctx.fillRect(Math.round(s[0]), Math.round(s[1] - 2), 1, 2);
        }
      }
    if (k >= 0.27)
      for (const a of animals) {
        if (a.dead || a.fly) continue;
        const z = a.z || hAt(a.x, a.y);
        if (behindBld(a, a.x, a.y, z + 0.3) || hillPt(a, a.x, a.y, z, 0.6, 15)) continue;
        anDot(a);
      }
  }
  drawLifts();
  drawSkiers();
  drawShut();
  drawWires();
  drawHoses();
  drawNightLights();
  if (k >= 0.27) for (const a of animals) if (!a.dead && a.fly) drawAnimal(a);
  for (const p of planeAll()) if (p.fly || !direct) drawPlane(p);
  drawParts();
  drawEnts();
  drawEventFlags();
  drawEvents();
  drawWeather();
  drawAurora();
  drawHilite();
  for (const b of bolts) {
    const s = sp_(b.x, b.y, b.z);
    ctx.strokeStyle = '#f4f8ff';
    ctx.lineWidth = Math.max(1, Math.round(k * 0.6));
    ctx.beginPath();
    let x = s[0] + (h32(b.x | 0, b.y | 0, 1) - 0.5) * 60,
      y = -4;
    ctx.moveTo(x, y);
    for (let q = 1; q <= 9; q++) {
      y = -4 + ((s[1] + 4) * q) / 9;
      x = x + (s[0] - x) / (10 - q) + (q < 9 ? (R() - 0.5) * 10 : 0);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(220,230,255,' + b.t * 0.9 + ')';
    ctx.fillRect(0, 0, VW, VH);
  }
  drawLabels();
  drawBubbles();
  drawCursor();
  drawCompass();
  if (!missing && pending === 0) snapValid = false;
  if (TR) drawTR(missing);
}

function tintCol() {
  return (
    'rgb(' +
    ((255 * Math.min(1, LR)) | 0) +
    ',' +
    ((255 * Math.min(1, LG)) | 0) +
    ',' +
    ((255 * Math.min(1, LB)) | 0) +
    ')'
  );
}
function litLayer() {
  if (LR > 0.985 && LG > 0.985 && LB > 0.985) return;
  oB.clearRect(0, 0, VW, VH);
  oB.drawImage(offA, 0, 0);
  oA.globalCompositeOperation = 'multiply';
  oA.fillStyle = tintCol();
  oA.fillRect(0, 0, VW, VH);
  oA.globalCompositeOperation = 'destination-in';
  oA.drawImage(offB, 0, 0);
  oA.globalCompositeOperation = 'source-over';
}
function drawTownGlow() {
  const k = K;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of PLACES) {
    if (p[3] === 'peak' || p[3] === 'volcano') continue;
    const x = p[0] * 0.5,
      y = p[1] * 0.5;
    const s = sp_(x, y, hAt(x, y));
    if (s[0] < -30 || s[0] > VW + 30 || s[1] < -30 || s[1] > VH + 30) continue;
    const pop = +p[4] || 300;
    const r = Math.max(1.5, Math.sqrt(pop) * k * 6);
    ctx.fillStyle = 'rgba(255,200,120,' + 0.25 * nightK + ')';
    ctx.beginPath();
    ctx.arc(s[0], s[1], r, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,170,' + 0.6 * nightK + ')';
    ctx.fillRect(Math.round(s[0]), Math.round(s[1]), 1, 1);
  }
  ctx.restore();
}
/* steam off the geothermal pools and hot tubs: thicker in the cold, blown along by the wind */
function drawPoolSteam() {
  if (!PROPS_OK || K < 0.5) return;
  const vr = viewRect(20),
    cold = Math.max(0.25, Math.min(1.4, (14 - TEMP) / 12));
  let n = 0;
  areasIn(vr[0], vr[1], vr[2], vr[3], A => {
    if (A.c !== AK.POOL && A.c !== AK.WPARK) return;
    const hot = A.sub === 1 || A.area < 40;
    const m = Math.min(hot ? 26 : 44, Math.round((A.area / (hot ? 1.2 : 18)) * cold));
    const z0 = areaZ(A);
    for (let i = 0; i < m && n < 500; i++) {
      const u = A.u0 + h32(A.id, i, 31) * A.L,
        v = A.v0 + h32(A.id, i, 32) * A.W;
      const [x, y] = AU(A, u, v);
      if (!pip(A.poly, x, y)) continue;
      n++;
      const life = (time * 0.35 + h32(A.id, i, 33)) % 1,
        h = life * (hot ? 3.2 : 2.2),
        dx = WIND[0] * windS * 0.12 * life * 3,
        dy = WIND[1] * windS * 0.12 * life * 3;
      const s = sp_(x + dx, y + dy, z0 + 0.3 + h);
      const r = K * (0.7 + life * (hot ? 2.2 : 1.6));
      ctx.fillStyle = 'rgba(240,243,246,' + (1 - life) * (hot ? 0.42 : 0.26) * Math.min(1, cold) + ')';
      ctx.beginPath();
      ctx.arc(s[0], s[1], r, 0, 7);
      ctx.fill();
    }
  });
}
function drawLamps() {
  if (nightK <= 0 || K < 0.12) return;
  const k = K,
    vr = viewRect(10);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  eachB(LBUCK, vr[0], vr[1], vr[2], vr[3], l => {
    const x = LAMPX[l],
      y = LAMPY[l];
    const s = sp_(x, y, hAt(x, y));
    if (s[0] < -20 || s[0] > VW + 20 || s[1] < -20 || s[1] > VH + 40) return;
    ctx.fillStyle = 'rgba(255,170,80,' + 0.07 * nightK + ')';
    ctx.beginPath();
    ctx.ellipse(s[0], s[1], Math.max(2, k * 6), Math.max(1, k * 3), 0, 0, 7);
    ctx.fill();
    if (k >= 0.85) {
      ctx.fillStyle = 'rgba(255,230,170,' + nightK + ')';
      ctx.fillRect(
        Math.round(s[0]),
        Math.round(s[1] - 6 * k),
        Math.max(1, Math.round(k * 0.7)),
        Math.max(1, Math.round(k * 0.5))
      );
    } else {
      ctx.fillStyle = 'rgba(255,220,150,' + 0.8 * nightK + ')';
      ctx.fillRect(Math.round(s[0]), Math.round(s[1]), 1, 1);
    }
  });
  ctx.restore();
  if (K >= 0.85) {
    ctx.fillStyle = C_([70, 74, 80], 1);
    eachB(LBUCK, vr[0], vr[1], vr[2], vr[3], l => {
      const x = LAMPX[l],
        y = LAMPY[l];
      const s = sp_(x, y, hAt(x, y));
      if (s[0] < -5 || s[0] > VW + 5 || s[1] < -5 || s[1] > VH + 60) return;
      const pw = Math.max(1, Math.round(K * 0.22));
      ctx.fillRect(Math.round(s[0]), Math.round(s[1] - 6 * K), pw, Math.round(6 * K));
      if (K >= 1.6) {
        ctx.fillRect(
          Math.round(s[0] - K * 0.5),
          Math.round(s[1] - 6.1 * K),
          Math.max(2, Math.round(K * 1.1)),
          Math.max(1, Math.round(K * 0.3))
        );
      }
    });
  }
}
function lavaQuad(c, cl) {
  const [x, y] = cellCenter(c),
    z = gH(c),
    h = 5;
  const a = sp_(x - h, y - h, z),
    b = sp_(x + h, y - h, z),
    d = sp_(x + h, y + h, z),
    e = sp_(x - h, y + h, z);
  if (
    Math.max(a[0], b[0], d[0], e[0]) < 0 ||
    Math.min(a[0], b[0], d[0], e[0]) > VW ||
    Math.max(a[1], b[1], d[1], e[1]) < 0 ||
    Math.min(a[1], b[1], d[1], e[1]) > VH
  )
    return null;
  ctx.fillStyle = cl;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.lineTo(e[0], e[1]);
  ctx.fill();
  return a;
}
function drawLava() {
  if (!lavaTiles.size) return;
  const k = K;
  for (const c of lavaTiles) {
    if (c < FN && k < FMIN) continue;
    const lh = gLH(c),
      hh = Math.min(1, lh / 22),
      f = 0.85 + Math.sin(time * 5 + (c % 9973) * 1.7) * 0.1;
    const a = lavaQuad(
      c,
      'rgb(' +
        (((70 + 185 * hh) * f) | 0) +
        ',' +
        (((24 + 80 * hh * hh) * f) | 0) +
        ',' +
        ((18 + 10 * hh) | 0) +
        ')'
    );
    if (a && k * 10 >= 4 && h32(c % 100003, 7, (time * 4) | 0) < 0.25) {
      ctx.fillStyle = '#ffd35a';
      ctx.fillRect(
        Math.round(a[0]),
        Math.round(a[1] + 4 * k),
        Math.max(1, Math.round(k)),
        Math.max(1, Math.round(k))
      );
    }
  }
}
function drawFlood(c2) {
  if (flood <= 0) return;
  const k = K;
  const vr = viewRect(20);
  c2.fillStyle = 'rgba(44,96,134,.86)';
  c2.beginPath();
  const quad = (xa, xb, y, y2, z) => {
    const P = (x, yy) => [PXw(x, yy) * k - cx0, (PYw(x, yy) - z) * k - cy0];
    const a = P(xa, y),
      b = P(xb, y),
      d = P(xb, y2),
      f = P(xa, y2);
    c2.moveTo(a[0], a[1]);
    c2.lineTo(b[0], b[1]);
    c2.lineTo(d[0], d[1]);
    c2.lineTo(f[0], f[1]);
    c2.closePath();
  };
  if (k >= FMIN) {
    const g = F;
    const i0 = Math.max(0, Math.floor((vr[0] - g.OX) / g.CS)),
      i1 = Math.min(g.W - 1, Math.floor((vr[2] - g.OX) / g.CS)),
      j0 = Math.max(0, Math.floor((vr[1] - g.OY) / g.CS)),
      j1 = Math.min(g.H - 1, Math.floor((vr[3] - g.OY) / g.CS));
    if (i0 <= i1 && j0 <= j1)
      for (let j = j0; j <= j1; j++) {
        let i = i0;
        const r = j * g.W;
        while (i <= i1) {
          const wet = ii => g.GT[r + ii] !== SEA && g.HT[r + ii] < flood;
          if (!wet(i)) {
            i++;
            continue;
          }
          let e = i;
          while (e <= i1 && wet(e)) e++;
          quad(g.OX + i * g.CS, g.OX + e * g.CS, g.OY + j * g.CS, g.OY + (j + 1) * g.CS, flood);
          i = e;
        }
      }
  }
  if (k >= DKMIN) {
    const gi0 = Math.max(0, Math.floor((vr[0] - C.OX) / DCS)),
      gi1 = Math.min(DGW - 1, Math.floor((vr[2] - C.OX) / DCS)),
      gj0 = Math.max(0, Math.floor((vr[1] - C.OY) / DCS)),
      gj1 = Math.min(DGH - 1, Math.floor((vr[3] - C.OY) / DCS));
    if ((gi1 - gi0) * (gj1 - gj0) < 600000)
      for (let gj = gj0; gj <= gj1; gj++) {
        let gi = gi0;
        while (gi <= gi1) {
          const wet = q => {
            const x = C.OX + (q + 0.5) * DCS,
              y = C.OY + (gj + 0.5) * DCS;
            if (inF(x, y)) return false;
            const t = getTile((q / DT) | 0, (gj / DT) | 0, false);
            if (!t) return false;
            const l = (q % DT) + (gj % DT) * DT;
            return t.GT[l] !== SEA && t.HT[l] < flood;
          };
          if (!wet(gi)) {
            gi++;
            continue;
          }
          let e = gi;
          while (e <= gi1 && wet(e)) e++;
          quad(C.OX + gi * DCS, C.OX + e * DCS, C.OY + gj * DCS, C.OY + (gj + 1) * DCS, flood);
          gi = e;
        }
      }
  } else {
    const g = C;
    const i0 = Math.max(0, Math.floor((vr[0] - g.OX) / g.CS)),
      i1 = Math.min(g.W - 1, Math.floor((vr[2] - g.OX) / g.CS)),
      j0 = Math.max(0, Math.floor((vr[1] - g.OY) / g.CS)),
      j1 = Math.min(g.H - 1, Math.floor((vr[3] - g.OY) / g.CS));
    if (i0 <= i1 && j0 <= j1)
      for (let j = j0; j <= j1; j++) {
        let i = i0;
        const r = j * g.W;
        while (i <= i1) {
          const wet = ii => g.GT[r + ii] !== SEA && g.HT[r + ii] < flood && !(k >= FMIN && cellInF(ii, j));
          if (!wet(i)) {
            i++;
            continue;
          }
          let e = i;
          while (e <= i1 && wet(e)) e++;
          quad(g.OX + i * g.CS, g.OX + e * g.CS, g.OY + j * g.CS, g.OY + (j + 1) * g.CS, flood);
          i = e;
        }
      }
  }
  c2.fill();
}
function drawLabels() {
  const k = K;
  if (k >= 0.12) return;
  ctx.font = '8px "Pixelify Sans", monospace';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  const placed = [];
  const list = PLACES.slice().sort((a, b) => (+b[4] || 0) - (+a[4] || 0));
  for (const p of list) {
    const kind = p[3];
    const pop = +p[4] || 0;
    if (kind === 'peak' || kind === 'volcano') {
      if (k > 0.03 || (kind === 'peak' && pop < 1300 && k < 0.004)) continue;
    } else if (kind === 'village') {
      if (k < 0.0045) continue;
    } else if (kind === 'town' && k < 0.002 && pop < 5000) continue;
    const x = p[0] * 0.5,
      y = p[1] * 0.5,
      z = hAt(x, y);
    const s = sp_(x, y, z);
    if (s[0] < -40 || s[0] > VW + 40 || s[1] < -10 || s[1] > VH + 10) continue;
    const w = ctx.measureText(p[2]).width + 4;
    if (placed.some(q => Math.abs(q[0] - s[0]) < (q[2] + w) / 2 && Math.abs(q[1] - s[1]) < 11)) continue;
    placed.push([s[0], s[1], w]);
    const isP = kind === 'peak' || kind === 'volcano';
    ctx.fillStyle = isP ? (kind === 'volcano' ? '#ff8a50' : '#e6e0d8') : '#ffffff';
    if (isP) {
      ctx.beginPath();
      ctx.moveTo(s[0], s[1] - 5);
      ctx.lineTo(s[0] - 3, s[1]);
      ctx.lineTo(s[0] + 3, s[1]);
      ctx.fill();
    } else ctx.fillRect(Math.round(s[0]) - 1, Math.round(s[1]) - 1, 3, 3);
    ctx.fillStyle = 'rgba(5,11,17,.85)';
    ctx.fillText(p[2], Math.round(s[0]) + 1, Math.round(s[1]) - 5);
    ctx.fillStyle = isP ? '#f4e6d4' : '#ffffff';
    ctx.fillText(p[2], Math.round(s[0]), Math.round(s[1]) - 6);
  }
  ctx.textAlign = 'left';
}
function drawCompass() {
  const cx = VW - 24,
    cy = VH - (innerWidth <= 760 ? 150 : 118);
  const L = Math.hypot(SXy, SYy) || 1,
    dx = (-SXy / L) * 10,
    dy = (-SYy / L) * 10;
  ctx.fillStyle = 'rgba(13,24,34,.8)';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#2a3f52';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = '#ff7a3d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - dx * 0.6, cy - dy * 0.6);
  ctx.lineTo(cx + dx, cy + dy);
  ctx.stroke();
  ctx.fillStyle = '#eef3f6';
  ctx.font = '8px "Pixelify Sans", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', cx + dx * 1.25, cy + dy * 1.25);
  ctx.textAlign = 'left';
}
function drawCursor() {
  if (!hover) return;
  const def = TOOL[tool];

  if (tool === 'inspect') {
    if (hoverB) {
      ctx.strokeStyle = 'rgba(238,243,246,.9)';
      ctx.lineWidth = 1;
      const b = hoverB,
        z1 = b.z + b.base + b.h;
      ctx.beginPath();
      for (let j = 0; j < b.n; j++) {
        const s = sp_(b.poly[2 * j], b.poly[2 * j + 1], z1);
        j ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
      }
      ctx.closePath();
      ctx.stroke();
    }
    return;
  }
  const r = def.brush ? BRUSH[brush] : def.r || 6;
  const [x, y] = hover;
  ctx.strokeStyle = def.danger ? '#ff9a5a' : '#c6b3ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let q = 0; q <= 32; q++) {
    const a = (q / 32) * 6.283,
      px = x + Math.cos(a) * r,
      py = y + Math.sin(a) * r;
    const s = sp_(px, py, hAt(px, py));
    q ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
  }
  ctx.stroke();
  if (tool === 'road' && dragFrom) {
    const a = sp_(dragFrom[0], dragFrom[1], hAt(dragFrom[0], dragFrom[1])),
      b = sp_(x, y, hAt(x, y));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
}
