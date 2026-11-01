import test from 'node:test';
import assert from 'node:assert/strict';
import { giantPixels, ringProfile } from './giant-mesh.js';
import { generateSystem } from './system.mjs';

const giants = [];
for (let s = 0; giants.length < 12 && s < 400; s++) giants.push(...generateSystem(s).bodies.filter(b => b.giant));

test('giant cloud maps are complete, deterministic and seamless', () => {
  assert.ok(giants.length >= 12);
  for (const g of giants.slice(0, 6)) {
    const W = 128, H = 64, px = giantPixels(g, W, H);
    assert.equal(px.length, W * H * 4);
    assert.deepEqual(px, giantPixels(g, W, H));
    for (let i = 3; i < px.length; i += 4) assert.equal(px[i], 255);
    // The map is sampled on the sphere, so the left and right edges meet without a seam.
    let diff = 0;
    for (let j = 0; j < H; j++) for (let c = 0; c < 3; c++) diff += Math.abs(px[(j * W) * 4 + c] - px[(j * W + W - 1) * 4 + c]);
    assert.ok(diff / (H * 3) < 12, `${g.name}: seam ${diff / (H * 3)}`);
  }
});

test('ring profiles stay in range and have a visible gap', () => {
  for (const g of giants) {
    const p = ringProfile(g, 256);
    for (const v of p) assert.ok(v >= 0 && v <= 1);
    const alpha = Array.from({ length: 256 }, (_, i) => p[i * 2]);
    assert.ok(Math.min(...alpha.slice(40, 230)) < .05, `${g.name}: no gap`);
  }
});
