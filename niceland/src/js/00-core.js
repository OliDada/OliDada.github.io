/**
 * Core helpers
 *
 * The canvas, the random helpers and the hash used for every deterministic "random" choice (h32).
 *
 * Functions: h32
 * State and constants: $, cv, ctx, R, RM, PX, VW, VH, pickA
 */

const $ = s => document.querySelector(s);
const cv = $('#cv'),
  ctx = cv.getContext('2d', { alpha: false });
const R = Math.random,
  RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PX = 2;
let VW = 0,
  VH = 0;
function h32(a, b, c) {
  let h = (a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 1442695041;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const pickA = a => a[(R() * a.length) | 0];
