/**
 * View rotation
 *
 * The eight view directions and the isometric projection: PXw/PYw turn world metres into screen x and
 * depth.
 *
 * Functions: setRot
 * State and constants: ROT, SXx, SXy, SYx, SYy, PXw, PYw
 */

// world: x east, y south (metres). Rotate by TH, then project isometrically.
let ROT = 7,
  SXx = 1,
  SXy = -1,
  SYx = 0.5,
  SYy = 0.5;
function setRot(r) {
  ROT = ((r % 8) + 8) % 8;
  const t = (ROT * Math.PI) / 4,
    c = Math.cos(t),
    s = Math.sin(t);
  SXx = c - s;
  SXy = -(s + c);
  SYx = (c + s) / 2;
  SYy = (c - s) / 2;
  if (Math.abs(SXx) < 1e-9) SXx = 0;
  if (Math.abs(SXy) < 1e-9) SXy = 0;
  if (Math.abs(SYx) < 1e-9) SYx = 0;
  if (Math.abs(SYy) < 1e-9) SYy = 0;
}
setRot(7);
const PXw = (x, y) => SXx * x + SXy * y,
  PYw = (x, y) => SYx * x + SYy * y; // depth == PYw
