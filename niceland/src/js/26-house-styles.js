/**
 * House styles
 *
 * Colours and styles for houses, apartments and farms.
 *
 * Functions: houseStyle
 * State and constants: CONCW, CONCR, MODW, FARMR
 */

const CONCW = [
  [238, 236, 230],
  [226, 224, 218],
  [204, 206, 206],
  [232, 224, 206],
  [214, 206, 192],
  [190, 198, 202],
  [222, 214, 198]
];
const CONCR = [
  [60, 64, 70],
  [96, 44, 40],
  [52, 82, 72],
  [118, 122, 126],
  [40, 42, 48],
  [70, 90, 110]
];
const MODW = [
  [62, 60, 58],
  [44, 46, 50],
  [128, 100, 76],
  [214, 214, 210],
  [96, 98, 100]
];
const FARMR = [
  [168, 44, 38],
  [150, 40, 36],
  [52, 104, 74],
  [70, 76, 84]
];
function houseStyle(b) {
  const s = b.seed,
    k = b.kind,
    dc = Math.hypot(b.cx + 1700, b.cy + 2400),
    rural = typeof F !== 'undefined' && F && !inF(b.cx, b.cy);
  if (b.sp) return;
  if (k === 0 || k === 1) {
    if (rural && dc > 40000) {
      b.style = b.area > 300 ? 'conc' : 'farm';
    } else if (dc < 2600 && s < 0.85) b.style = 'iron';
    else if ((dc > 8500 && s < 0.28) || s < 0.08) b.style = 'modern';
    else b.style = 'conc';
    if (b.style === 'conc') {
      b.wallC = CONCW[((s * 1000) | 0) % CONCW.length];
      b.roofC = CONCR[((s * 7777) | 0) % CONCR.length];
    } else if (b.style === 'modern') {
      b.wallC = MODW[((s * 1000) | 0) % MODW.length];
      b.roofC = [52, 54, 58];
      b.roof = 0;
    } else if (b.style === 'farm') {
      b.wallC = s < 0.7 ? [238, 236, 230] : [226, 214, 190];
      b.roofC = FARMR[((s * 99) | 0) % FARMR.length];
    }
  } else if ((k === 5 || k === 3) && rural && b.area < 1600) {
    b.style = 'barn';
    b.wallC = s < 0.6 ? [230, 230, 226] : [200, 202, 204];
    b.roofC = FARMR[((s * 99) | 0) % FARMR.length];
    if (b.n === 4) b.roof = 1;
  } else if (k === 2) b.style = 'apt';
  if ((k === 0 || k === 1) && !b.rs && b.style !== 'modern') {
    const o = obbOf(b);
    if (b.roof === 1 || b.roof === 2 || b.style === 'farm' || h32(b.id, 3, 7) < 0.45) {
      b.rs = b.roof === 2 || o.rect < 0.78 ? 'hip' : 'gable';
      b.rp = b.style === 'iron' ? 0.9 : b.style === 'farm' ? 0.8 : 0.55;
      b.roof = 9;
    }
  }
  if ((k === 5 || k === 3) && b.style === 'barn' && !b.rs) {
    b.rs = obbOf(b).rect > 0.78 ? 'gable' : 'hip';
    b.rp = 0.5;
    b.roof = 9;
  }
}
