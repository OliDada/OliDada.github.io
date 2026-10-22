/**
 * Camera and zoom
 *
 * Zoom levels, the camera, screen↔world conversion, the visible world rectangle and smooth zooming.
 *
 * Functions: CCF, CCC, resize, centerOn, screenToWorld, pickGround, viewGZ, viewRect, setLevel,
 *     zoomCommitOut, commitLevel, zoomStep, resetZoom, applyCSS, clampCam, rotate, rotA, snapScreen
 * State and constants: LEVELS, li, K, camX, camY, cx0, cy0, DIRECT, FMIN, BMIN, offA, offB, oA, oB, VGZ,
 *     vgzC, ZS, ZM, lastCSS, lastZC, zoomEndT, snapC, snapX, snapValid, snapCX, snapCY, snapK
 */

const LEVELS = [
  0.0009, 0.0013, 0.002, 0.003, 0.0045, 0.0068, 0.01, 0.015, 0.023, 0.035, 0.052, 0.078, 0.12, 0.18, 0.27,
  0.4, 0.6, 0.9, 1.35, 2, 3, 4.5, 6.5
];
let li = 18,
  K = LEVELS[li],
  camX = 0,
  camY = 0,
  cx0 = 0,
  cy0 = 0;
const DIRECT = 1.2,
  FMIN = 0.02,
  BMIN = 0.023;
function CCF(k) {
  return k < 0.05
    ? 144
    : k < 0.1
      ? 72
      : k < 0.3
        ? 48
        : k < 0.6
          ? 24
          : k < 1.2
            ? 12
            : k < 2.5
              ? 8
              : k < 4.5
                ? 5
                : 4;
}
function CCC(k) {
  let c = 2;
  while (c < 256 && 2 * k * 300 * c < 130) c *= 2;
  return c;
}
function resize() {
  VW = Math.ceil(innerWidth / PX);
  VH = Math.ceil(innerHeight / PX);
  cv.width = VW;
  cv.height = VH;
  cv.style.width = VW * PX + 'px';
  cv.style.height = VH * PX + 'px';
  ctx.imageSmoothingEnabled = false;
  for (const c of [offA, offB]) {
    c.width = VW;
    c.height = VH;
  }
}
const offA = document.createElement('canvas'),
  offB = document.createElement('canvas');
const oA = offA.getContext('2d'),
  oB = offB.getContext('2d');
function centerOn(x, y, z) {
  camX = Math.round(PXw(x, y) * K - VW / 2);
  camY = Math.round((PYw(x, y) - (z === undefined ? hAt(x, y) : z)) * K - VH / 2);
}
function screenToWorld(px, py, z) {
  const a = (px + camX) / K,
    b = (py + camY) / K + z;
  return [SYy * a - SXy * b, -SYx * a + SXx * b];
}
function pickGround(px, py) {
  let z = 0,
    p;
  for (let it = 0; it < 8; it++) {
    p = screenToWorld(px, py, z);
    const nz = hAt(p[0], p[1]);
    if (Math.abs(nz - z) < 0.5) break;
    z = z + (nz - z) * 0.7;
  }
  return p;
}
// the ground under the middle of the screen: in the highlands everything sits hundreds of metres up, so the visible
// world rectangle is taken around that height rather than around sea level
let VGZ = 0,
  vgzC = '';
function viewGZ() {
  const key = camX + '|' + camY + '|' + K + '|' + ROT;
  if (key === vgzC) return VGZ;
  vgzC = key;
  try {
    const p = pickGround(VW / 2, VH / 2);
    VGZ = Math.max(0, hAt(p[0], p[1]));
  } catch (e) {
    VGZ = 0;
  }
  return VGZ;
}
function viewRect(margin, zmax) {
  const m = margin || 0,
    zz = zmax === undefined ? 150 : zmax,
    g = viewGZ();
  let x0 = 1e12,
    x1 = -1e12,
    y0 = 1e12,
    y1 = -1e12;
  for (const z of [Math.max(0, g - Math.max(150, zz)), g + zz])
    for (const [sx, sy] of [
      [0, 0],
      [VW, 0],
      [0, VH],
      [VW, VH]
    ]) {
      const p = screenToWorld(sx, sy, z);
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
  return [x0 - m, y0 - m, x1 + m, y1 + m];
}
/* zoom: the canvas is scaled smoothly (GPU) between the cached zoom levels; the render level switches underneath without a jump */
let ZS = { s: 1, tx: 0, ty: 0 },
  ZM = null,
  lastCSS = '';
function setLevel(n, px, py) {
  const dir = Math.sign(n - li);
  if (!dir) return;
  const cur = ZM ? ZM.tgt : li;
  const tgt = Math.max(0, Math.min(LEVELS.length - 1, cur + dir));
  if (tgt === cur) return;
  const ax = (px === undefined ? VW / 2 : px) * ZS.s + ZS.tx,
    ay = (py === undefined ? VH / 2 : py) * ZS.s + ZS.ty;
  ZM = { tgt, ax, ay, dirty: ZM ? ZM.dirty : false };
  // zooming out: render the wider view once, right away, shown CSS-scaled so nothing jumps; zooming in: keep the current image and render once at the end
  if (LEVELS[tgt] < K) ZM.needC = true;
  zoomCommitOut();
}
let lastZC = 0,
  zoomEndT = 0;
function zoomCommitOut() {
  if (!ZM || !ZM.needC) return;
  const now = performance.now();
  if (now - lastZC < 160 && ZS.s > 1.02) return;
  lastZC = now;
  ZM.needC = false;
  if (LEVELS[ZM.tgt] < K) {
    commitLevel(ZM.tgt);
    ZM.dirty = true;
  }
}
function commitLevel(n) {
  const f = LEVELS[n] / K;
  if (f === 1) return;
  snapScreen();
  // render the new level at the camera where the zoom will end (anchor fixed), then CSS-scale it so the screen doesn't move
  const ax = ZM ? ZM.ax : VW / 2,
    ay = ZM ? ZM.ay : VH / 2;
  const s0 = ZS.s;
  camX = Math.round(f * (camX + (ax - ZS.tx) / s0) - ax);
  camY = Math.round(f * (camY + (ay - ZS.ty) / s0) - ay);
  li = n;
  K = LEVELS[n];
  const s1 = s0 / f;
  ZS.s = s1;
  ZS.tx = ax - ax * s1;
  ZS.ty = ay - ay * s1;
}
function zoomStep(dt) {
  if (!ZM) return;
  zoomCommitOut();
  const Kd = K * ZS.s,
    Kt = LEVELS[ZM.tgt];
  let nK = Kd * Math.exp(Math.log(Kt / Kd) * Math.min(1, dt * 13));
  if (Math.abs(Math.log(nK / Kt)) < 0.004) nK = Kt;
  const z = nK / Kd;
  ZS.tx = ZM.ax - (ZM.ax - ZS.tx) * z;
  ZS.ty = ZM.ay - (ZM.ay - ZS.ty) * z;
  ZS.s *= z;
  if (K * ZS.s < K * 0.999 && LEVELS[ZM.tgt] < K) {
    commitLevel(ZM.tgt);
    ZM.dirty = true;
    ZM.needC = false;
  } // never show the canvas smaller than the screen
  if (nK === Kt && ZM.tgt !== li) commitLevel(ZM.tgt);
  if (nK === Kt && ZM.tgt === li) {
    zoomEndT = performance.now();
    camX = Math.round(camX - ZS.tx);
    camY = Math.round(camY - ZS.ty);
    ZS = { s: 1, tx: 0, ty: 0 };
    ZM = null;
    clampCam();
  }
}
function resetZoom() {
  ZM = null;
  ZS = { s: 1, tx: 0, ty: 0 };
}
function applyCSS() {
  let r = 0,
    sc = 1;
  if (TR && TR.type === 'rot' && TR.phase === 'swap') {
    r = TR.cssRot || 0;
    sc = 1 + Math.abs(r) * 1.3;
  }
  const W2 = (VW * PX) / 2,
    H2 = (VH * PX) / 2;
  const s = r
    ? 'translate(' +
      W2 +
      'px,' +
      H2 +
      'px) rotate(' +
      r.toFixed(4) +
      'rad) scale(' +
      sc.toFixed(4) +
      ') translate(' +
      -W2 +
      'px,' +
      -H2 +
      'px) '
    : '';
  const css =
    s +
    (ZS.s !== 1 || ZS.tx || ZS.ty
      ? 'translate(' +
        (ZS.tx * PX).toFixed(2) +
        'px,' +
        (ZS.ty * PX).toFixed(2) +
        'px) scale(' +
        ZS.s.toFixed(5) +
        ')'
      : '');
  if (css !== lastCSS) {
    cv.style.transform = css;
    lastCSS = css;
  }
}
function clampCam() {
  if (!C) return;
  let a0 = 1e12,
    a1 = -1e12,
    b0 = 1e12,
    b1 = -1e12;
  for (const [x, y] of [
    [C.OX, C.OY],
    [C.x1, C.OY],
    [C.OX, C.y1],
    [C.x1, C.y1]
  ]) {
    const a = PXw(x, y) * K,
      b = PYw(x, y) * K;
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
    b0 = Math.min(b0, b);
    b1 = Math.max(b1, b);
  }
  camX = Math.max(a0 - VW * 0.6, Math.min(a1 - VW * 0.4, camX));
  camY = Math.max(b0 - VH * 0.7 - 2000 * K, Math.min(b1 - VH * 0.3, camY));
}
function rotate(d) {
  if (!F || !d) return;
  if (TR && TR.type === 'rot' && TR.phase === 'prep') {
    TR.d += d;
    TR.A = rotA(TR.d);
  } else {
    if (TR && TR.type === 'rot') {
      TR = null;
      applyCSS();
    }
    if (ZM) {
      resetZoom();
      applyCSS();
    }
    startTR('rot', { d, A: rotA(d), phase: 'prep', ap: 0 });
  }
  const p = pickGround(VW / 2, VH / 2);
  setRot(ROT + d);
  snapValid = false;
  centerOn(p[0], p[1]);
  clampCam();
  updRotBtn();
}
function rotA(d) {
  return Math.sign(d) * Math.min(0.6, 0.24 + 0.09 * Math.abs(d));
}
const snapC = document.createElement('canvas'),
  snapX = snapC.getContext('2d');
let snapValid = false,
  snapCX = 0,
  snapCY = 0,
  snapK = 1;
function snapScreen() {
  snapC.width = VW;
  snapC.height = VH;
  snapX.drawImage(cv, 0, 0);
  snapValid = true;
  snapCX = camX;
  snapCY = camY;
  snapK = K;
}
