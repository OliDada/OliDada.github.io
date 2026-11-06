// Planned towns (town-plan.mjs): streets, lots along them that never overlap, props.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planTown, planDistrict, floorH } from './town-plan.mjs';

const corners = (l) => { const c = Math.cos(l.ang), s = Math.sin(l.ang); return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [l.x + c * a * l.d / 2 - s * b * l.w / 2, l.z + s * a * l.d / 2 + c * b * l.w / 2]); };
const overlap = (A, B) => { // separating axis test on two rectangles
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % 4], nx = z0 - z1, nz = x1 - x0;
    const pa = A.map(([x, z]) => x * nx + z * nz), pb = B.map(([x, z]) => x * nx + z * nz);
    if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
  }
  return true;
};

test('villages, towns and cities are laid out along streets, lots never overlapping', () => {
  for (const [level, radius, u] of [[2, 60, 1], [3, 160, 1.2], [3, 220, 3.3], [4, 300, 1], [5, 400, 9]]) {
    const plan = planTown({ seed: `t${level}:${radius}`, radius, level, u, capital: true });
    assert.ok(plan.streets.length >= 3, `no streets at level ${level}`);
    assert.ok(plan.lots.length >= 8, `only ${plan.lots.length} lots at level ${level}, u ${u}`);
    assert.ok(plan.U > 0);
    const rects = plan.lots.map(corners);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!overlap(rects[i], rects[j]), `lots ${i} and ${j} overlap`);
    for (const l of plan.lots) { assert.ok(l.floors >= 1 && l.w > 0 && l.d > 0); assert.ok(Math.hypot(l.x, l.z) < radius * 1.15, 'a lot outside the town'); }
    if (level >= 3) assert.ok(plan.props.some((p) => p.kind === 'lamp' || p.kind === 'lamp-tall'), 'no street lamps');
  }
});

test('a district is a grid of blocks, the same every time', () => {
  const a = planDistrict({ seed: 'd', x0: 0, z0: 0, x1: 400, z1: 400, level: 5, u: 1 }), b = planDistrict({ seed: 'd', x0: 0, z0: 0, x1: 400, z1: 400, level: 5, u: 1 });
  assert.deepEqual(a, b);
  assert.ok(a.lots.length > 20 && a.streets.length > 4);
  assert.ok(floorH(1) > 2.5 && floorH(3) > floorH(1));
});
