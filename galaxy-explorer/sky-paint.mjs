// The Milky Way as seen from where you are: the galaxy's own disc (galaxy.mjs) painted onto
// the sky by marching rays out through it. Bright toward the core and along the arms, warm
// in the bulge, blue where young stars burn, and cut by dark rifts of dust lying in the
// plane. Pure; returns RGBA bytes (equirectangular, laid out for a three.js SphereGeometry
// seen from inside, row 0 at the bottom). sky-paint-worker.js runs it off the main thread.
import { GALAXY, armStrength } from './galaxy.mjs';

const h3 = (x, y, z) => { let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
           l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm = (x, y, z) => .55 * vnoise(x, y, z) + .3 * vnoise(x * 2.1, y * 2.1, z * 2.1) + .15 * vnoise(x * 4.3, y * 4.3, z * 4.3);

export function paintSky(P, W = 512, H = 256) {
  const G = GALAXY, R = G.radius, B = G.bulgeRadius, out = new Uint8ClampedArray(W * H * 4), N = 44, LMAX = 46000;
  for (let j = 0; j < H; j++) {
    const theta = Math.PI * (1 - (j + .5) / H), st = Math.sin(theta), ct = Math.cos(theta);
    for (let i = 0; i < W; i++) {
      const phi = (i + .5) / W * Math.PI * 2;
      // Scene direction on the sphere, then into galaxy coordinates (deep-space.js: galaxy = (x, -z, y)).
      const sx = -Math.cos(phi) * st, sy = ct, sz = Math.sin(phi) * st, dx = sx, dy = -sz, dz = sy;
      let r = 0, g = 0, b = 0, tau = 0;
      for (let k = 0; k < N; k++) {
        const t = LMAX * ((k + .5) / N) ** 2, dt = LMAX * 2 * (k + .5) / (N * N);
        const x = P[0] + dx * t, y = P[1] + dy * t, z = P[2] + dz * t, rr = Math.hypot(x, y), az = Math.abs(z);
        if (rr > R * 1.4 && az > 3000) break;
        const edge = rr > R ? Math.exp(-(((rr - R) / 2600) ** 2)) : 1;
        const arm = armStrength(x, y), disc = Math.exp(-rr / (.42 * R)) * edge;
        const thin = Math.exp(-az / 420), thick = Math.exp(-az / 1400), clump = .35 + 1.3 * fbm(x / 1400 + 9, y / 1400, z / 500) ** 2;
        const young = disc * arm * thin * 1.7 * clump, old = disc * (.012 * thick + .14 * thin * clump);
        const bulge = .5 * Math.exp(-(rr * rr + (2.4 * z) ** 2) / (B * B));
        const vis = Math.exp(-tau) * dt;
        r += vis * (young * .55 + old * 1.0 + bulge * 1.05);
        g += vis * (young * .72 + old * .82 + bulge * .85);
        b += vis * (young * 1.15 + old * .6 + bulge * .55);
        // Dust: thin, clumpy, strongest where the arms are; it hides what lies behind it.
        const dust = (disc + 2.2 * Math.exp(-rr * rr / (B * B * 2.2))) * (.3 + arm * 1.4) * Math.exp(-az / 170) * Math.max(0, fbm(x / 2600, y / 2600, z / 420) * 2.2 - .85) * (.4 + 1.2 * vnoise(x / 700, y / 700, z / 200));
        tau += dust * dt * .0022;
        if (tau > 6) break;
      }
      const o = (j * W + i) * 4, e = .00038;
      const tm = (v) => 255 * (1 - Math.exp(-v * e)) ** 1.35; // a darker floor between the bright parts
      out[o] = tm(r); out[o + 1] = tm(g); out[o + 2] = tm(b); out[o + 3] = 255;
    }
  }
  return out;
}
