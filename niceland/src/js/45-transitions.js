/**
 * Transitions
 *
 * Cross-fades when rotating the view or jumping to a place.
 *
 * Functions: startTR, drawTR, drawRotImg
 * State and constants: TR
 */

let TR = null;
function startTR(type, o) {
  const c = document.createElement('canvas');
  c.width = VW;
  c.height = VH;
  c.getContext('2d').drawImage(cv, 0, 0);
  TR = Object.assign(
    { type, t0: performance.now(), dur: type === 'fade' ? 420 : type === 'rot' ? 260 : 200, img: c, f: 1 },
    o || {}
  );
}

function drawTR(missing) {
  const now = performance.now();
  if (TR.type === 'fade') {
    const u = Math.min(1, (now - TR.t0) / TR.dur),
      e = 1 - Math.pow(1 - u, 3);
    if (u >= 1) {
      TR = null;
      return;
    }
    ctx.save();
    ctx.globalAlpha = 1 - e;
    ctx.drawImage(TR.img, 0, 0);
    ctx.restore();
    return;
  }
  if (TR.type === 'rot') {
    if (TR.phase === 'prep') {
      const tp = now - TR.t0;
      const e = 1 - Math.pow(1 - Math.min(1, tp / 500), 2);
      TR.ap = TR.A * 0.22 * e;
      if ((!missing && tp > 80) || tp > 900) {
        TR.phase = 'swap';
        TR.ts = now;
      } else {
        drawRotImg(TR.ap, 1, 1 + Math.abs(TR.ap) * 1.3);
        return;
      }
    }
    const u = Math.min(1, (now - TR.ts) / 320),
      e = 1 - Math.pow(1 - u, 3);
    if (u >= 1) {
      TR = null;
      return;
    }
    TR.cssRot = -(TR.A - TR.ap) * (1 - e);
    const scr = TR.ap + (TR.A - TR.ap) * e;
    drawRotImg(TR.A, 1 - e, (1 + Math.abs(scr) * 1.3) / (1 + Math.abs(TR.cssRot) * 1.3));
    return;
  }
  TR = null;
}
function drawRotImg(a, alpha, sc) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const cx = VW / 2,
    cy = VH / 2;
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.scale(sc, sc);
  ctx.translate(-cx, -cy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(TR.img, 0, 0);
  ctx.restore();
}

/* while a level's ground is still rendering, show cached ground from neighbouring zoom levels, scaled */
