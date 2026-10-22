/**
 * Input
 *
 * Mouse, touch and keyboard: panning, pinching, rotating and hovering.
 *
 * Functions: toLow, pickAt, endPtr
 * State and constants: ptrs, panning, painting, lastXY, pinch, hover, hoverB, hoverA, downXY, lastApply,
 *     hoverMove, selB, wheelAcc, keys
 */

const ptrs = new Map();
let panning = false,
  painting = false,
  lastXY = null,
  pinch = null,
  hover = null,
  hoverB = null,
  hoverA = null,
  downXY = null,
  lastApply = null,
  hoverMove = null,
  selB = null;
function toLow(e) {
  return [(e.clientX / PX - ZS.tx) / ZS.s, (e.clientY / PX - ZS.ty) / ZS.s];
}
function pickAt(px, py) {
  let bestA = null,
    ad = 1e9;
  for (const a of agents) {
    if (a.dead) continue;
    const s = sp_(a.x, a.y, hAt(a.x, a.y) + (a.car ? 1 : 1.4));
    const d = Math.hypot(s[0] - px, s[1] - py);
    if (d < Math.max(5, K * 3) && d < ad) {
      ad = d;
      bestA = a;
    }
  }
  {
    const vr = viewRect(50);
    geoIn(vr[0], vr[1], vr[2], vr[3], g => {
      const s = sp_(g.x, g.y, gz(g) + (g.k === 'fall' ? g.H * 0.5 : 1));
      const d = Math.hypot(s[0] - px, s[1] - py);
      if (
        d <
          Math.max(
            8,
            K * (g.k === 'fall' ? Math.max(g.W, g.H) * 0.5 : g.k === 'plant' ? 60 : (g.pool || 2) * 1.5)
          ) &&
        d < ad
      ) {
        ad = d;
        bestA = g;
      }
    });
  }
  for (const b of BOATS) {
    if (b.hidden) continue;
    const s = sp_(b.x, b.y, 2);
    const d = Math.hypot(s[0] - px, s[1] - py);
    if (d < Math.max(6, K * b.Ln.L * 0.45) && d < ad) {
      ad = d;
      bestA = b;
    }
  }
  for (const p of planeAll()) {
    if (p.x === undefined) continue;
    const s = sp_(p.x, p.y, p.z + 2);
    const d = Math.hypot(s[0] - px, s[1] - py);
    if (d < Math.max(6, K * PTYPE[p.t].L * 0.4) && d < ad) {
      ad = d;
      bestA = p;
    }
  }
  for (const a of animals) {
    if (a.dead) continue;
    const s = sp_(a.x, a.y, (a.fly ? a.z : hAt(a.x, a.y)) + (a.sp === 'horse' || a.sp === 'cow' ? 1 : 0.5));
    const d = Math.hypot(s[0] - px, s[1] - py);
    if (d < Math.max(5, K * (a.sp === 'whale' ? 8 : 3)) && d < ad) {
      ad = d;
      bestA = a;
    }
  }
  const g = pickGround(px, py);
  let bestB = null,
    bk = -1e18;
  if (K < BMIN) return { g, b: null, a: bestA };
  nearB(g[0], g[1], 220, b => {
    if (b.state === 9) return;
    if (b.rr !== ROT) rotB(b);
    const z1 = b.z + b.base + b.h * b.prog,
      z0 = b.z;
    const P = b.poly,
      n = b.n,
      sx = [],
      sy = [],
      sb = [];
    for (let j = 0; j < n; j++) {
      const x = P[2 * j],
        y = P[2 * j + 1];
      sx.push(PXw(x, y) * K - camX);
      const d = PYw(x, y) * K - camY;
      sy.push(d - z1 * K);
      sb.push(d - z0 * K);
    }
    const inP = ys => {
      let ins = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        if (ys[i] > py !== ys[j] > py && px < ((sx[j] - sx[i]) * (py - ys[i])) / (ys[j] - ys[i]) + sx[i])
          ins = !ins;
      }
      return ins;
    };
    let inside = inP(sy) || inP(sb);
    if (!inside) {
      for (let j = 0; j < n; j++) {
        const q = (j + 1) % n;
        if ((sx[j] - px) * (sx[q] - px) <= 0) {
          const t = (px - sx[j]) / (sx[q] - sx[j] || 1e-6);
          const yt = sy[j] + (sy[q] - sy[j]) * t,
            yb = sb[j] + (sb[q] - sb[j]) * t;
          if (py >= yt && py <= yb) {
            inside = true;
            break;
          }
        }
      }
    }
    if (inside && b.key > bk) {
      bk = b.key;
      bestB = b;
    }
  });
  return { g, b: bestB, a: bestA };
}
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  if (!READY) return;
  cv.setPointerCapture(e.pointerId);
  const p = toLow(e);
  ptrs.set(e.pointerId, p);
  if (ptrs.size === 2) {
    painting = false;
    panning = false;
    dragFrom = null;
    const [a, b] = [...ptrs.values()];
    pinch = {
      d: Math.hypot(a[0] - b[0], a[1] - b[1]),
      cx: (a[0] + b[0]) / 2,
      cy: (a[1] + b[1]) / 2,
      ang: Math.atan2(b[1] - a[1], b[0] - a[0])
    };
    return;
  }
  lastXY = p;
  downXY = p;
  if (e.button === 1 || e.button === 2 || tool === 'inspect') {
    panning = true;
    cv.style.cursor = 'grabbing';
    return;
  }
  const g = pickGround(p[0], p[1]);
  hover = g;
  painting = true;
  lastApply = g;
  apply(g[0], g[1], true);
});
cv.addEventListener('pointermove', e => {
  if (!READY) return;
  const p = toLow(e);
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]),
      cx = (a[0] + b[0]) / 2,
      cy = (a[1] + b[1]) / 2,
      ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    camX -= cx - pinch.cx;
    camY -= cy - pinch.cy;
    pinch.cx = cx;
    pinch.cy = cy;
    const r = d / pinch.d;
    if (r > 1.35) {
      setLevel(li + 1, cx, cy);
      pinch.d = d;
    } else if (r < 0.74) {
      setLevel(li - 1, cx, cy);
      pinch.d = d;
    }
    let da = ang - pinch.ang;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    if (Math.abs(da) > 0.6) {
      rotate(da > 0 ? 1 : -1);
      pinch.ang = ang;
    }
    clampCam();
    return;
  }
  if (panning && lastXY) {
    camX -= Math.round(p[0] - lastXY[0]);
    camY -= Math.round(p[1] - lastXY[1]);
    lastXY = p;
    clampCam();
    if (follow && Math.hypot(p[0] - downXY[0], p[1] - downXY[1]) > 6) follow = null;
    return;
  }
  hover = pickGround(p[0], p[1]);
  if (painting && hover && TOOL[tool].drag) {
    const r = TOOL[tool].brush ? BRUSH[brush] * 0.6 : 6;
    if (!lastApply || Math.hypot(hover[0] - lastApply[0], hover[1] - lastApply[1]) > r) {
      lastApply = hover;
      apply(hover[0], hover[1], false);
    }
  }
  hoverMove = p;
});
function endPtr(e) {
  const p = toLow(e);
  const wasPan = panning;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (!ptrs.size) {
    if (tool === 'road' && painting) {
      const g = pickGround(p[0], p[1]);
      finishRoad(g[0], g[1]);
    }
    if (wasPan && downXY && Math.hypot(p[0] - downXY[0], p[1] - downXY[1]) < 4 && e.button === 0) {
      const r = pickAt(p[0], p[1]);
      if (r.a) {
        selected = r.a;
        follow = r.a;
        toast('Following ' + (r.a.name || 'a vehicle'));
      } else {
        selected = null;
        selB = r.b;
        follow = null;
      }
    }
    panning = false;
    painting = false;
    lastXY = null;
    cv.style.cursor = tool === 'inspect' ? 'grab' : 'crosshair';
  } else if (ptrs.size === 1) {
    lastXY = [...ptrs.values()][0];
    panning = true;
  }
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', () => {
  if (!ptrs.size) {
    hover = null;
    hoverMove = null;
  }
});
let wheelAcc = 0;
cv.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    if (!READY) return;
    wheelAcc += e.deltaY;
    const p = toLow(e);
    if (Math.abs(wheelAcc) >= 60) {
      setLevel(li + (wheelAcc < 0 ? 1 : -1), p[0], p[1]);
      wheelAcc = 0;
    }
  },
  { passive: false }
);
const keys = new Set();
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea,select')) return;
  if (CTRL) {
    const k0 = e.key.toLowerCase();
    if (e.key === 'Escape') {
      stopPlay();
      return;
    }
    if (playKey(k0)) {
      e.preventDefault();
      return;
    }
    if (
      ['w', 'a', 's', 'd', ' ', 'x', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k0)
    ) {
      e.preventDefault();
      keys.add(k0);
      return;
    }
  }
  if (e.key === ' ') {
    e.preventDefault();
    setSpeed(speed ? 0 : 1);
    return;
  }
  if (e.key >= '1' && e.key <= '7') {
    selCat(CATS[+e.key - 1].id);
    return;
  }
  if (e.key === '+' || e.key === '=') {
    setLevel(li + 1, VW / 2, VH / 2);
    return;
  }
  if (e.key === '-') {
    setLevel(li - 1, VW / 2, VH / 2);
    return;
  }
  const kk = e.key.toLowerCase();
  if (kk === 'q') {
    rotate(-1);
    return;
  }
  if (kk === 'e') {
    rotate(1);
    return;
  }
  if (kk === 'n') {
    toggleNight();
    return;
  }
  if (e.key === 'Escape') {
    follow = null;
    selected = null;
    return;
  }
  keys.add(kk);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
