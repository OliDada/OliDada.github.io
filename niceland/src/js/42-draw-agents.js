/**
 * Drawing people and vehicles
 *
 * How people, cars, ploughs and speech bubbles are drawn.
 *
 * Functions: drawAgent, drawAgent0, drawBubbles, drawPlough, drawCar, headBeam, behindBld
 * State and constants: BUBBLES, sp_
 */

/* Below the close-up zoom the buildings are baked into cached chunks and everything that moves is drawn on top,
   so a person walking behind a house would show through it. behindBld says whether a building stands between a
   point and the camera: follow the line of sight from the point towards the viewer (screen x fixed, depth rising
   one metre per metre of height) and see whether it passes through a building's walls on the way up.
   Results are kept on the agent for a few frames, since this runs for every person, car and animal on screen. */
const OCC_HMAX = 80; // the tallest buildings (Hallgrímskirkja, Smáratorg) are under this
let occRot = -1,
  occDX = 0,
  occDY = 1;
function behindBld(o, x, y, z) {
  if (occRot !== ROT) {
    // world step that keeps screen x and adds one metre of depth
    const det = SXx * SYy - SXy * SYx || 1;
    occDX = -SXy / det;
    occDY = SXx / det;
    occRot = ROT;
  }
  if (o.ocR === ROT && frameNo - o.ocF < 10 && Math.abs(o.ocX - x) + Math.abs(o.ocY - y) < 1.5) return o.oc;
  o.ocR = ROT;
  o.ocF = frameNo - ((Math.random() * 4) | 0); // stagger the re-checks
  o.ocX = x;
  o.ocY = y;
  const ex = x + occDX * OCC_HMAX,
    ey = y + occDY * OCC_HMAX,
    pad = 40;
  let hit = false;
  eachB(
    BBUCK,
    Math.min(x, ex) - pad,
    Math.min(y, ey) - pad,
    Math.max(x, ex) + pad,
    Math.max(y, ey) + pad,
    b => {
      if (hit || b.state === 2 || b.state === 9 || b.hide) return;
      const top = b.z + b.base + b.h * (b.prog === undefined ? 1 : b.prog);
      // heights along the sight line at which it is inside this building's walls
      const t0 = Math.max(0.3, b.z + b.base - z),
        t1 = Math.min(OCC_HMAX, top - z);
      if (t1 <= t0) return;
      const ax = x + occDX * t0,
        ay = y + occDY * t0,
        bx = x + occDX * t1,
        by = y + occDY * t1;
      if (
        Math.max(ax, bx) < b.minx ||
        Math.min(ax, bx) > b.maxx ||
        Math.max(ay, by) < b.miny ||
        Math.min(ay, by) > b.maxy
      )
        return;
      if (pip(b.poly, ax, ay) || pip(b.poly, bx, by) || segHitsPoly(b.poly, ax, ay, bx, by)) hit = true;
    }
  );
  return (o.oc = hit);
}
function segHitsPoly(P, ax, ay, bx, by) {
  const n = P.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const cx = P[2 * j],
      cy = P[2 * j + 1],
      dx = P[2 * i],
      dy = P[2 * i + 1];
    const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax),
      d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax),
      d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx),
      d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  }
  return false;
}
function drawAgent(a) {
  drawAgent0(a);
  if (a.plough && !a.dead) drawPlough(a);
  if ((a.balloon || a.carry || a.horn || a.float) && !a.hidden && K >= 0.8) carried(a);
}
function drawAgent0(a) {
  if (a.hidden || (a.intun && a !== follow)) return;
  const k = K,
    z = hAt(a.x, a.y) + (a.dz || 0);
  const sx = PXw(a.x, a.y) * k - cx0,
    sy = (PYw(a.x, a.y) - z) * k - cy0;
  if (sx < -40 || sx > VW + 40 || sy < -60 || sy > VH + 40) return;
  if (a.car) {
    drawCar(a, z);
    return;
  }
  if (a.entering && a.entering < 0.6) ctx.globalAlpha = Math.max(0, a.entering / 0.6);
  const moving = a.state === 'walk' && !a.entering,
    Hh = Math.max(3, k * 3.8 * a.scale);
  if (a.down > 0) {
    drawLying(a, Math.round(sx), Math.round(sy), Hh);
    ctx.globalAlpha = 1;
    return;
  }
  let svx = a.vx * SXx + a.vy * SXy,
    svy = a.vx * SYx + a.vy * SYy;
  if (a.state === 'idle' && a.face) svx = a.face;
  const fr = svx >= 0 ? 1 : -1,
    away = svy < -0.15 && a.state === 'walk';
  if (a.zk === 'swim' || a.zk === 'soak') {
    drawSwimmer(a, Math.round(sx), Math.round(sy), k);
    if (a === follow || a === selected) {
      ctx.strokeStyle = '#c6b3ff';
      ctx.strokeRect(Math.round(sx) - 6.5, Math.round(sy) - 9.5, 13, 11);
    }
    return;
  }
  const X = Math.round(sx);
  let Y = Math.round(sy);
  const frame = moving && !a.scooter && !a.bike ? (Math.sin(a.phase) > 0 ? 1 : 0) : 2;
  if (Hh < 5) {
    if (a.bike || a.scooter) {
      ctx.fillStyle = C_([30, 30, 30], 1);
      ctx.fillRect(X - 1, Y, 3, 1);
    }
    if (a.pram) {
      ctx.fillStyle = C_(a.pram, 1);
      ctx.fillRect(X + 1, Y - 1, 2, 1);
    }
    ctx.fillStyle = C_(a.shirt, 1);
    ctx.fillRect(X, Y - 2, 1, 2);
    ctx.fillStyle = C_(a.hat || a.skin, 1);
    ctx.fillRect(X, Y - 3, 1, 1);
    if (a.kind === 'dog') {
      ctx.fillStyle = C_(a.dog, 1);
      ctx.fillRect(X + 2 * fr, Y - 1, 2, 1);
    }
    ctx.globalAlpha = 1;
    return;
  }
  const big = Hh >= 11,
    p = big ? Math.max(1, Math.round(Hh / 14)) : 1;
  // r(x,y,w,h): x in sprite columns (facing right), y rows from the ground up
  const r = (gx, gy, w, h, c) => {
    ctx.fillStyle = c;
    const x = fr > 0 ? gx : -(gx + w - 1);
    ctx.fillRect(X + x * p, Y - (gy + h) * p, w * p, h * p);
  };
  if (big && (a.scooter || a.bike)) {
    drawRide(a, X, Y, p, fr);
    Y -= p * (a.bike ? 4 : 1);
  }
  if (
    (a.crowd === 'concert' || a.crowd === 'party' || a.crowd === 'wedding') &&
    Math.sin(time * 7 + a.id * 1.7) > 0.55
  )
    Y -= p * 2;
  const shirt = C_(a.vest ? [240, 200, 30] : a.shirt, 1),
    shirtD = C_(a.vest ? [200, 160, 20] : a.shirt, 0.72),
    skin = C_(a.skin, 1),
    hair = C_(a.hair, 1),
    pants = C_(a.pants, 1),
    pantsD = C_(a.pants, 0.8),
    shoe = C_([34, 30, 30], 1);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(X - (big ? 3 : 2) * p, Y - p, (big ? 7 : 5) * p, p);
  if (!big) {
    // 3 x 7 sprite
    if (frame === 1) {
      r(-1, 0, 1, 1, shoe);
      r(1, 1, 1, 1, shoe);
      r(-1, 1, 1, 2, pants);
      r(1, 2, 1, 1, pantsD);
    } else if (frame === 0) {
      r(1, 0, 1, 1, shoe);
      r(-1, 1, 1, 1, shoe);
      r(1, 1, 1, 2, pants);
      r(-1, 2, 1, 1, pantsD);
    } else {
      r(-1, 0, 1, 1, shoe);
      r(1, 0, 1, 1, shoe);
      r(-1, 1, 1, 2, pants);
      r(1, 1, 1, 2, pantsD);
    }
    r(-1, 3, 3, 3, shirt);
    r(-1, 3, 1, 3, shirtD);
    r(0, 6, 1, 1, skin);
    r(0, 7, 1, 1, a.hat ? C_(a.hat, 1) : hair);
    if (a.bag) r(-2, 4, 1, 2, C_(a.bag, 1));
    if (rainT > 0 && a.id % 3 !== 0 && !a.helmet && a.kind !== 'jogger') {
      r(
        -1,
        8,
        4,
        1,
        C_(
          [
            [40, 40, 48],
            [200, 40, 40],
            [40, 90, 170],
            [230, 190, 40]
          ][a.id % 4],
          1
        )
      );
      r(1, 6, 1, 2, C_([60, 60, 60], 1));
    }
    if (a.kind === 'dog') r(3, 0, 2, 1, C_(a.dog, 1));
  } else {
    // 7 x 14 sprite on an integer grid: columns -3..3
    const lA = frame === 0 ? -1 : frame === 1 ? 1 : 0;
    r(-2 + (frame === 2 ? 0 : lA < 0 ? -1 : 0), 0, 2, 1, shoe);
    r(1 + (frame === 2 ? 0 : lA > 0 ? 1 : 0), 0, 2, 1, shoe);
    r(-2 + (frame === 0 ? -1 : 0), 1, 2, 4, pants);
    r(1 + (frame === 1 ? 1 : 0), 1, 2, 4, pantsD);
    if (a.shorts) {
      r(-2 + (frame === 0 ? -1 : 0), 1, 2, 2, skin);
      r(1 + (frame === 1 ? 1 : 0), 1, 2, 2, C_(a.skin, 0.85));
    }
    if (frame !== 2) r(-1, 4, 3, 1, pants);
    r(-2, 5, 5, 5, shirt);
    r(-2, 5, 1, 5, shirtD);
    if (a.vest) r(-2, 7, 5, 1, C_([210, 210, 210], 1));
    if (a.lopi) {
      r(-2, 9, 5, 1, C_([236, 228, 210], 1));
      for (let i = 0; i < 5; i++) if ((i + a.id) % 2) r(-2 + i, 9, 1, 1, C_([60, 50, 44], 1));
    }
    const swA = frame === 0 ? 1 : frame === 1 ? -1 : 0; // arm swing in rows
    r(-3, 6 + Math.max(0, swA), 1, 4 - Math.abs(swA), shirtD);
    r(-3, 5 + Math.max(0, swA), 1, 1, skin);
    r(3, 6 + Math.max(0, -swA), 1, 4 - Math.abs(swA), shirt);
    r(3, 5 + Math.max(0, -swA), 1, 1, skin);
    if (a.bag) r(away ? 2 : -4, 6, 2, 3, C_(a.bag, 1));
    r(-1, 10, 3, 3, skin);
    if (!away) r(1, 11, 1, 1, C_([30, 26, 26], 1));
    else r(-1, 10, 3, 3, hair);
    if (a.long) r(-2, 8, 1, 5, hair);
    if (a.helmet) {
      r(-2, 13, 5, 1, C_(a.hat, 1));
      r(-1, 14, 3, 1, C_(a.hat, 1));
    } else if (a.hat) {
      r(-1, 13, 3, 1, C_(a.hat, 1));
      r(-2, 12, 1, 1, C_(a.hat, 0.85));
      r(0, 14, 1, 1, C_(a.hat, 1.2));
    } else {
      r(-1, 13, 3, 1, hair);
      r(-1, 12, 1, 1, hair);
    }
    lookExtras(a, r, away, frame, p, X, Y, fr);
    if (a.pram) drawPram(a, r, p);
    if (a.cam && !away) r(3, 7, 1, 1, C_([30, 30, 34], 1));
    if (a.flash > 0) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(X + (fr > 0 ? 4 : -5) * p, Y - 9 * p, 2 * p, 2 * p);
    }
    if (night && !a.cam && a.id % 4 === 0 && a.state !== 'walk') r(3, 6, 1, 1, '#bfe0ff');
    if (rainT > 0 && a.id % 3 !== 0 && !a.helmet && a.kind !== 'jogger') {
      const uc = C_(
        [
          [40, 40, 48],
          [200, 40, 40],
          [40, 90, 170],
          [230, 190, 40]
        ][a.id % 4],
        1
      );
      r(3, 7, 1, 9, C_([60, 60, 60], 1));
      r(0, 16, 7, 1, uc);
      r(1, 17, 5, 1, uc);
      r(2, 18, 3, 1, uc);
    }
    if (a.kind === 'dog') {
      const dc = C_(a.dog, 1);
      r(5, 1, 4, 2, dc);
      r(9, 2, 2, 2, dc);
      r(5, 0, 1, 1, dc);
      r(8, 0, 1, 1, dc);
      if (moving) r(4, 3, 1, 1, dc);
      ctx.strokeStyle = C_([40, 40, 40], 1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X + 3.5 * p * fr, Y - 5.5 * p);
      ctx.lineTo(X + 9.5 * p * fr, Y - 3.5 * p);
      ctx.stroke();
    }
    if (a.kind === 'fire' && a.state === 'spray') r(4, 6, 3, 1, C_([200, 40, 40], 1));
  }
  if (a === follow || a === selected) {
    ctx.strokeStyle = '#c6b3ff';
    ctx.lineWidth = 1;
    const hh = (big ? 16 : 9) * p;
    ctx.strokeRect(X - 5 * p - 0.5, Y - hh - 0.5, 10 * p + 1, hh + 1);
  }
  ctx.globalAlpha = 1;
  if (a.bubble && k >= 0.85) BUBBLES.push([X, Y - (big ? 17 : 10) * p, a.bubble, a.flee]);
}
const BUBBLES = [];
function drawBubbles() {
  ctx.font = '8px "Pixelify Sans", monospace';
  ctx.textBaseline = 'middle';
  BUBBLES.sort((a, b) => Math.hypot(a[0] - VW / 2, a[1] - VH / 2) - Math.hypot(b[0] - VW / 2, b[1] - VH / 2));
  const placed = [];
  for (const [x, y, t, p] of BUBBLES) {
    const w = Math.ceil(ctx.measureText(t).width) + 6;
    const bx = Math.round(x - w / 2),
      by = y - 10;
    if (placed.length >= (p ? 12 : 7)) break;
    if (placed.some(q => bx < q[0] + q[2] + 2 && bx + w + 2 > q[0] && by < q[1] + 12 && by + 12 > q[1]))
      continue;
    placed.push([bx, by, w]);
    ctx.fillStyle = p ? '#ffe0cf' : '#f4f7fa';
    ctx.fillRect(bx, by, w, 10);
    ctx.fillRect(x - 1, by + 10, 2, 2);
    ctx.fillStyle = '#0d1822';
    ctx.fillRect(bx, by, w, 1);
    ctx.fillRect(bx, by + 9, w, 1);
    ctx.fillRect(bx, by, 1, 10);
    ctx.fillRect(bx + w - 1, by, 1, 10);
    ctx.fillStyle = p ? '#a3260f' : '#13202c';
    ctx.fillText(t, bx + 3, by + 5.5);
  }
  BUBBLES.length = 0;
}
const sp_ = (x, y, z) => [PXw(x, y) * K - cx0, (PYw(x, y) - z) * K - cy0];
function drawPlough(a) {
  const k = K;
  if (k < 0.5) return;
  const z = hAt(a.x, a.y) + (a.dz || 0);
  let dx = a.vx,
    dy = a.vy,
    L = Math.hypot(dx, dy) || 1;
  dx /= L;
  dy /= L;
  const hl = a.len / 2;
  const b1 = sp_(a.x + dx * (hl + 0.9) - dy * 1.9, a.y + dy * (hl + 0.9) + dx * 1.9, z + 0.3),
    b2 = sp_(a.x + dx * (hl + 1.4) + dy * 1.9, a.y + dy * (hl + 1.4) - dx * 1.9, z + 0.3); // angled blade
  ctx.strokeStyle = C_([250, 200, 40], 1);
  ctx.lineWidth = Math.max(2, k * 0.9);
  ctx.beginPath();
  ctx.moveTo(b1[0], b1[1]);
  ctx.lineTo(b2[0], b2[1]);
  ctx.stroke();
  const bc = sp_(a.x, a.y, z + 3.8);
  if ((time * 3 + a.id) % 1 < 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,170,30,.9)';
    ctx.fillRect(
      Math.round(bc[0] - k * 0.4),
      Math.round(bc[1]),
      Math.max(2, (k * 0.8) | 0),
      Math.max(2, (k * 0.6) | 0)
    );
    ctx.fillStyle = 'rgba(255,170,30,.18)';
    ctx.beginPath();
    ctx.arc(bc[0], bc[1], k * 3, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  if (a.wait <= 0 && R() < 0.5)
    addP({
      t: 1,
      x: a.x + dx * (hl + 1.6) + dy * 2.4,
      y: a.y + dy * (hl + 1.6) - dx * 2.4,
      z: z + 0.6,
      vx: dy * 4,
      vy: -dx * 4,
      vz: 2,
      life: 0.8,
      max: 0.8,
      c: [244, 246, 250],
      s: 1.6,
      a: 0.8
    });
}
function drawCar(a, z) {
  const k = K;
  let dx = a.vx,
    dy = a.vy,
    L = Math.hypot(dx, dy);
  if (L < 0.01) {
    dx = 1;
    dy = 0;
    L = 1;
  }
  dx /= L;
  dy /= L;
  const hl = a.len / 2,
    hw = a.wid / 2;
  const pts = [
    a.x - dx * hl + dy * hw,
    a.y - dy * hl - dx * hw,
    a.x + dx * hl + dy * hw,
    a.y + dy * hl - dx * hw,
    a.x + dx * hl - dy * hw,
    a.y + dy * hl + dx * hw,
    a.x - dx * hl - dy * hw,
    a.y - dy * hl + dx * hw
  ];
  const o = area2(pts) < 0 ? [pts[6], pts[7], pts[4], pts[5], pts[2], pts[3], pts[0], pts[1]] : pts;
  DOX = cx0;
  DOY = cy0;
  DK = k;
  BAKE = true;
  if (night) headBeam(a, dx, dy, hl, hw, z);
  if (a.vt) {
    drawVeh(a, z);
    return;
  }
  if (k * a.len < 3) {
    const s = sp_(a.x, a.y, z + 1);
    ctx.fillStyle = C_(a.c, 1);
    ctx.fillRect(Math.round(s[0]), Math.round(s[1]), Math.max(1, Math.round(k * a.len * 0.6)), 1);
    if (night) {
      const f = sp_(a.x + dx * hl, a.y + dy * hl, z + 1);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(Math.round(f[0]), Math.round(f[1]), 1, 1);
    }
    return;
  }
  const base = z + 0.35;
  prism(
    ctx,
    o,
    base,
    base + (a.kind === 'car' ? a.hgt * 0.55 : a.hgt),
    a.c,
    a.kind === 'car' ? null : [a.c[0] * 0.9, a.c[1] * 0.9, a.c[2] * 0.9]
  );
  if (a.kind === 'car') {
    const cab = [];
    for (let i = 0; i < 4; i++)
      cab.push(a.x + (o[2 * i] - a.x) * 0.62 - dx * 0.3, a.y + (o[2 * i + 1] - a.y) * 0.62 - dy * 0.3);
    prism(ctx, cab, base + a.hgt * 0.55, base + a.hgt, [60, 80, 100], a.c, 1);
  } else {
    ctx.fillStyle = C_([50, 66, 86], 1);
    const wz = base + a.hgt * 0.6;
    for (let i = -4; i <= 4; i++) {
      const t = i / 9,
        sd = faces(-dy, dx) > 0 ? 1 : -1;
      const x = a.x + dx * a.len * t - dy * hw * sd,
        y = a.y + dy * a.len * t + dx * hw * sd;
      const s = sp_(x, y, wz);
      ctx.fillRect(
        Math.round(s[0]),
        Math.round(s[1]),
        Math.max(1, Math.round(k * 0.9)),
        Math.max(1, Math.round(k * 0.9))
      );
    }
  }
  if (a.siren) {
    const on = ((time * 6) | 0) % 2;
    const s = sp_(a.x, a.y, base + a.hgt + 0.3);
    ctx.fillStyle = on ? '#ff3030' : '#3070ff';
    ctx.fillRect(
      Math.round(s[0] - k),
      Math.round(s[1]),
      Math.max(2, Math.round(k * 1.4)),
      Math.max(1, Math.round(k * 0.8))
    );
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = on ? 'rgba(255,40,40,.18)' : 'rgba(40,90,255,.18)';
    ctx.beginPath();
    ctx.arc(s[0], s[1], k * 8, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  // lamps: two headlights, two tail lights
  const lz = base + 0.6,
    ls = Math.max(1, Math.round(k * 0.55));
  for (const sd of [-1, 1]) {
    const fx = a.x + dx * hl - dy * hw * 0.7 * sd,
      fy = a.y + dy * hl + dx * hw * 0.7 * sd,
      rx = a.x - dx * hl - dy * hw * 0.7 * sd,
      ry = a.y - dy * hl + dx * hw * 0.7 * sd;
    const f = sp_(fx, fy, lz),
      rr = sp_(rx, ry, lz);
    if (night || faces(dx, dy) > 0) {
      ctx.fillStyle = night ? '#fff6cc' : C_([230, 230, 220], 1);
      ctx.fillRect(Math.round(f[0]), Math.round(f[1]), ls, ls);
    }
    ctx.fillStyle = night ? '#ff3b30' : C_([170, 30, 30], 1);
    ctx.fillRect(Math.round(rr[0]), Math.round(rr[1]), ls, ls);
  }
}
function headBeam(a, dx, dy, hl, hw, z) {
  // a soft cone of light on the road ahead
  const L = a.kind === 'bus' ? 20 : 16,
    spread = 4.5,
    x0 = a.x + dx * hl,
    y0 = a.y + dy * hl,
    zz = z + 0.2;
  const p1 = sp_(x0 - dy * hw, y0 + dx * hw, zz),
    p2 = sp_(x0 + dy * hw, y0 - dx * hw, zz),
    p3 = sp_(x0 + dx * L + dy * spread, y0 + dy * L - dx * spread, zz),
    p4 = sp_(x0 + dx * L - dy * spread, y0 + dy * L + dx * spread, zz),
    pe = sp_(x0 + dx * L, y0 + dy * L, zz);
  const g = ctx.createLinearGradient(p1[0] / 2 + p2[0] / 2, p1[1] / 2 + p2[1] / 2, pe[0], pe[1]);
  g.addColorStop(0, 'rgba(255,236,170,' + 0.42 * nightK + ')');
  g.addColorStop(0.6, 'rgba(255,230,160,' + 0.14 * nightK + ')');
  g.addColorStop(1, 'rgba(255,230,160,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p4[0], p4[1]);
  ctx.lineTo(p3[0], p3[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.closePath();
  ctx.fill();
  const rear = sp_(a.x - dx * hl, a.y - dy * hl, zz);
  ctx.fillStyle = 'rgba(255,40,30,' + 0.12 * nightK + ')';
  ctx.beginPath();
  ctx.ellipse(rear[0], rear[1], Math.max(1.5, K * 2.2), Math.max(1, K * 1.1), 0, 0, 7);
  ctx.fill();
  ctx.restore();
}
