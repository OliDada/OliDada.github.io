// Builds and places a world's rocks and formations (geology.mjs) all over the world:
// a couple of each rock type and one of each landform near the landing site, so every
// landing has something to scan, and the rest spread thinly across the whole surface
// (more on bigger worlds). Rocks are lumpy, natural outcrops, boulders, rubble and ice.
// Each formation kind is one instanced mesh (plus one for its glowing parts, if
// any), so a world's geology costs a few draw calls. Shapes reach into the ground
// so they never float on a slope. THREE is passed in.
import { rng } from './rng.mjs';
import { geologyFor } from './geology.mjs';
import { addSurfaceDetail } from './planet-lod.js';

const SINK = 1.2;
const RANGE = 150; // metres from the site for the formations placed near it
const NEAR = { rock: 2, formation: 1 }; // of each kind near the site (rare ones: none)
const DENSITY = 0.25; // across the world, relative to the old packing of f.count within 210 m
// How many of a formation a world gets: scaled by its surface area.
function worldCount(f, radius) {
  const n = Math.round(f.count * DENSITY * (4 * Math.PI * radius * radius) / (Math.PI * 210 * 210));
  return f.rare ? Math.min(6, Math.max(1, n)) : f.type === 'rock' ? Math.min(60, Math.max(4, n)) : Math.min(24, Math.max(2, n));
}

export function buildGeology(THREE, { body, terrain, radius, signalNormal, landingNormal, coarse = false }) {
  const { formations } = geologyFor(body);
  const group = new THREE.Group(), placed = [];
  if (!formations.length) return { group, formations, placed };
  const Y = new THREE.Vector3(0, 1, 0), toSite = new THREE.Quaternion().setFromUnitVectors(Y, signalNormal);
  const C = palette(THREE, body, terrain);
  const taken = [];
  for (const f of formations) {
    const r = rng(body.seed, 'geology-place', f.key), want = worldCount(f, radius), nearWant = f.rare ? 0 : NEAR[f.type] ?? 1;
    const { lit, glow, foot, height } = shapeOf(THREE, f, C, r);
    const litMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: f.glassy || f.shape === 'meteorite' ? .3 : .95, metalness: f.shape === 'meteorite' ? .6 : f.glassy ? .15 : 0 });
    // Stone formations get the same close-up grain and cracks as the bare ground around them.
    if (!f.glassy && f.shape !== 'meteorite') addSurfaceDetail(litMaterial, { ground: terrain.ground, airless: terrain.airless, lite: coarse, objects: true });
    const meshes = [new THREE.InstancedMesh(lit, litMaterial, want)];
    if (glow) meshes.push(new THREE.InstancedMesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true }), want));
    const positions = [], scales = [], dummy = new THREE.Object3D(), n = new THREE.Vector3(), probe = new THREE.Vector3();
    const wet = terrain.liquid === 'water' || terrain.liquid === 'lava';
    // Second pass, only if nothing fitted: any dry spot, closer together, a bit farther out.
    for (let tries = 0, relax = false; positions.length / 3 < want && tries < want * 90; tries++) {
      if (tries === want * 60) { if (positions.length) break; relax = true; }
      const near = positions.length / 3 < nearWant && tries < want * 30; // the first few near the site
      // A few candidates; 'high' formations take the highest, 'shore' ones need a coast nearby.
      let best = null, bestH = -Infinity;
      for (let c = 0; c < (f.near === 'high' ? 4 : 1); c++) {
        // Near the site: within RANGE of it. Elsewhere: uniformly over the whole sphere.
        const a = near ? Math.acos(1 - r() * (1 - Math.cos(RANGE * (relax ? 1.25 : 1) / radius))) : Math.acos(1 - 2 * r()), b = r() * Math.PI * 2;
        const m = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)).applyQuaternion(toSite);
        const h = terrain.surface(m);
        if (h > bestH) { bestH = h; best = m; }
      }
      n.copy(best);
      const s = (.75 + r() * .55) * f.size, span = foot * s;
      if (n.angleTo(signalNormal) * radius < 12 + span || n.angleTo(landingNormal) * radius < 14 + span) continue;
      if (taken.some(t => t.n.angleTo(n) * radius < (relax ? .5 : 1) * (t.r + span + 3))) continue;
      const east = Y.clone().cross(n).normalize(), north = n.clone().cross(east);
      let lo = terrain.surface(n), dry = true, coast = false;
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3, dir = east.clone().multiplyScalar(Math.cos(a)).addScaledVector(north, Math.sin(a));
        probe.copy(n).addScaledVector(dir, span / radius).normalize();
        if (terrain.isLiquid(probe)) dry = false; else lo = Math.min(lo, terrain.surface(probe));
        if (wet && f.near === 'shore' && terrain.isLiquid(probe.copy(n).addScaledVector(dir, (span + 7) / radius).normalize())) coast = true;
      }
      if (!dry || terrain.isLiquid(n)) continue;
      if (f.near === 'shore' && wet && !coast && !relax && tries < want * 45) continue; // fall back to anywhere if there is no coast to find
      dummy.position.copy(n).multiplyScalar(radius + lo - .05);
      dummy.quaternion.setFromUnitVectors(Y, n);
      dummy.rotateY(r() * Math.PI * 2);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      const i = positions.length / 3;
      for (const mesh of meshes) mesh.setMatrixAt(i, dummy.matrix);
      positions.push(dummy.position.x, dummy.position.y, dummy.position.z); scales.push(s);
      taken.push({ n: n.clone(), r: span });
    }
    for (const mesh of meshes) { mesh.count = positions.length / 3; mesh.frustumCulled = false; group.add(mesh); }
    placed.push({ formation: f, positions: new Float32Array(positions), scales: new Float32Array(scales), meshes, foot, height });
  }
  return { group, formations, placed };
}

// How solid a formation is on foot, per unit of scale (radius, height).
export const footprint = (p, i) => ({ r: p.foot * p.scales[i] * .8, h: p.height * p.scales[i] });

// terrain (optional): formations use the same stone as the world's cliffs.
function palette(THREE, body, terrain) {
  const c = (h) => new THREE.Color(h), mix = (a, b, t) => '#' + c(a).lerp(c(b), t).getHexString();
  const rock = terrain?.rockColor ? '#' + new THREE.Color().setRGB(...terrain.rockColor, THREE.SRGBColorSpace).getHexString() : body.rock || '#6d6a66';
  return {
    rock, dark: mix(rock, '#1e1d22', .55), pale: mix(rock, '#e8e1d2', .45), sand: mix(body.palette?.[3] || '#c9a678', '#d9b07a', .4),
    sand2: mix(body.palette?.[3] || '#c9a678', '#8a5a3a', .4), ice: mix('#dff1fb', body.atmosphere || '#bcd', .12), ice2: '#a9d2ea',
    crystal: body.crystal || '#b58cf0', glass: '#17151c', sulfur: '#d9c34a', sulfur2: '#9b7a2a', hot: '#ff8a3a', cold: '#9fe6ff',
    metal: '#4a4744', cream: '#efe1c6', orange: '#d98a4a', water: '#5fb0c8',
  };
}

// Each shape as merged geometry (local units, base at y = 0), with its footprint radius and height.
function shapeOf(THREE, f, C, r) {
  const lit = [], glow = [], q = new THREE.Quaternion(), e = new THREE.Euler(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(sx, sy, sz));
  const add = (g, m, col, bright = false) => (bright ? glow : lit).push({ g, m, col });
  const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0);
  const cone = (rad, h, seg = 6) => new THREE.ConeGeometry(rad, h, seg, 1).translate(0, h / 2, 0);
  const sunk = (g) => g.translate(0, -SINK, 0);
  // A lumpy, natural-looking stone: an icosahedron pushed in and out by smooth waves
  // (shared corners move together, so there are no cracks).
  const lump = (rad, detail, seed, amp = .22) => {
    const g = new THREE.IcosahedronGeometry(rad, detail), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const k = 1 + amp * (Math.sin(x * 2.3 / rad + seed) * Math.sin(y * 2.9 / rad + seed * 1.7) + .6 * Math.sin(z * 3.7 / rad + seed * 2.3) * Math.sin(x * 1.9 / rad - seed));
      P.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    return g;
  };
  const [main, dark] = f.colors || [C.rock, C.dark];
  let foot = 1.5, height = 2;
  switch (f.shape) {
    case 'boulder': { // one big stone and a few smaller ones, half buried
      const k = 2 + Math.floor(r() * 3);
      for (let i = 0; i < k; i++) {
        const s = i ? .45 + r() * .45 : 1 + r() * .35, a = r() * 6.28, d = i ? .9 + r() * .9 : 0;
        add(lump(s, 2, r() * 10), M(Math.cos(a) * d, s * .3, Math.sin(a) * d, r() * .5, r() * 6, r() * .5, 1, .65 + r() * .2, 1 + r() * .25), i % 2 ? dark : main);
      }
      foot = 1.9; height = 1.5; break;
    }
    case 'slab': { // a layered outcrop, gently tilted
      const k = f.low ? 2 : 3 + Math.floor(r() * 2), tilt = (r() - .5) * .25;
      for (let i = 0; i < k; i++) {
        const w = (f.low ? 1.9 : 1.7) - i * .28;
        add(lump(w, 2, r() * 10, .14), M((r() - .5) * .4, .15 + i * (f.low ? .22 : .36), (r() - .5) * .4, tilt, r() * .4, tilt * .6, 1, f.low ? .16 : .26, .75), i % 2 ? dark : main);
      }
      foot = 2.1; height = f.low ? .7 : 1.6; break;
    }
    case 'rubble': { // a scatter of broken stones
      const k = 8 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) {
        const s = (f.low ? .2 : .25) + r() * (f.low ? .3 : .45), a = r() * 6.28, d = Math.sqrt(r()) * 2;
        add(lump(s, 1, r() * 10, .3), M(Math.cos(a) * d, s * .3, Math.sin(a) * d, r() * 3, r() * 6, r() * 3, 1, .7, 1.1), i % 3 ? main : dark);
      }
      foot = 2.2; height = f.low ? .5 : .8; break;
    }
    case 'ice': { // angular chunks of ice, some leaning
      const k = 3 + Math.floor(r() * 3);
      for (let i = 0; i < k; i++) {
        const s = .45 + r() * .5, a = r() * 6.28, d = i ? .6 + r() * 1.1 : 0;
        add(lump(s, 1, r() * 10, .25), M(Math.cos(a) * d, s * .5, Math.sin(a) * d, (r() - .5) * .6, r() * 6, (r() - .5) * .6, 1, 1.3 + r() * 1.1, 1), i % 2 ? dark : main);
      }
      foot = 1.8; height = 2.2; break;
    }
    case 'columns': {
      const k = 6 + Math.floor(r() * 5);
      for (let i = 0; i < k; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 1.3, h = 1 + r() * 3.2; add(sunk(cyl(.42, .42, h + SINK)), M(Math.cos(a) * d, 0, Math.sin(a) * d, 0, r()), i % 3 ? C.dark : C.rock); }
      foot = 1.8; height = 3.5; break;
    }
    case 'shards':
      for (let i = 0; i < 6; i++) add(sunk(cone(.35 + r() * .2, 1.5 + r() * 2 + SINK, 3)), M((r() - .5) * 2, 0, (r() - .5) * 2, (r() - .5) * .7, r() * 6, (r() - .5) * .7, 1, 1, .45), i % 2 ? C.glass : C.dark);
      foot = 1.5; height = 2.5; break;
    case 'vent': {
      const col = f.cold ? C.ice : C.rock, gl = f.cold ? C.cold : C.hot;
      add(sunk(cone(2.2, 2.2 + SINK, 8)), M(), col);
      add(new THREE.TorusGeometry(.65, .22, 4, 10).rotateX(Math.PI / 2), M(0, 1.55, 0), f.cold ? C.ice2 : C.sulfur2);
      add(new THREE.CylinderGeometry(.55, .55, .05, 10), M(0, 1.5, 0), gl, true);
      for (let i = 0; i < 5; i++) { const a = r() * 6.28; add(new THREE.IcosahedronGeometry(.25, 0), M(Math.cos(a) * 1.1, .9, Math.sin(a) * 1.1), f.cold ? C.ice2 : C.sulfur); }
      foot = 2; height = 2; break;
    }
    case 'hoodoos':
      for (let i = 0; i < 4; i++) {
        const x = (r() - .5) * 3, z = (r() - .5) * 3, h = 2 + r() * 3; let y = 0;
        add(sunk(cyl(.55, .7, SINK)), M(x, 0, z), C.sand2);
        for (let k = 0; k < 4; k++) { const s = .55 - k * .05 + r() * .1; add(new THREE.IcosahedronGeometry(s, 0), M(x, y + h / 8, z, 0, r() * 6, 0, 1, h / 4 / s * .6, 1), k % 2 ? C.sand : C.sand2); y += h / 4; }
        add(cyl(.75, .6, .3, 7), M(x, y, z), C.dark);
      }
      foot = 2.2; height = 4.5; break;
    case 'arch':
      for (const x of [-2, 2]) add(sunk(cyl(.7, 1, 3 + SINK, 6)), M(x, 0, 0, 0, 0, -x * .03), C.sand2);
      add(new THREE.TorusGeometry(2, .7, 5, 10, Math.PI), M(0, 3, 0), C.sand);
      foot = 2.8; height = 5.5; break;
    case 'blades':
      for (let i = 0; i < 12; i++) add(sunk(cone(.25 + r() * .15, 1.4 + r() * 2.4 + SINK, 4)), M((r() - .5) * 3.5, 0, (r() - .5) * 3.5, .25, 0, 0), i % 3 ? C.ice : C.ice2);
      foot = 2.2; height = 3.4; break;
    case 'dome':
      add(sunk(new THREE.SphereGeometry(2.6, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, SINK * .2, 0)), M(0, 0, 0, 0, 0, 0, 1, .7, 1), C.ice);
      for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(.12, .2, 2.4), M(0, 1.7, 0, 0, i * .8, 0), C.rock);
      foot = 2.6; height = 1.9; break;
    case 'crystals':
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * 6.28 + r(), lean = i ? .25 + r() * .45 : 0, h = (i ? 1.4 + r() * 2 : 3.6), w = .22 + r() * .14;
        const m = M(Math.cos(a) * .3, 0, Math.sin(a) * .3, Math.sin(a) * lean, 0, -Math.cos(a) * lean);
        add(sunk(cyl(w, w, h * .82 + SINK, 6)), m, C.crystal);
        add(new THREE.ConeGeometry(w, h * .2, 6).translate(0, h * .82 + h * .1, 0), m, C.crystal);
      }
      foot = 1.6; height = 3.6; break;
    case 'terraces':
      for (let i = 0; i < 4; i++) { const rad = 2.6 - i * .55, y = i * .4; add(i ? cyl(rad, rad, .4, 12) : sunk(cyl(rad, rad, .4 + SINK, 12)), M(0, y, 0), i % 2 ? C.cream : C.orange); add(new THREE.TorusGeometry(rad, .1, 3, 14).rotateX(Math.PI / 2), M(0, y + .4, 0), C.cream); }
      add(new THREE.CylinderGeometry(.9, .9, .04, 12), M(0, 1.62, 0), C.water);
      foot = 2.6; height = 1.6; break;
    case 'chimneys':
      for (let i = 0; i < 4; i++) { const x = (r() - .5) * 2.5, z = (r() - .5) * 2.5, h = 1.5 + r() * 2.5; add(sunk(cyl(.3, .55, h + SINK, 7)), M(x, 0, z), i % 2 ? C.sulfur : C.sulfur2); add(new THREE.CylinderGeometry(.22, .22, .05, 7), M(x, h, z), C.hot, true); }
      foot = 1.8; height = 3.5; break;
    case 'pinnacles':
      for (let i = 0; i < 7; i++) add(sunk(cone(.5 + r() * .4, 1.5 + r() * 3.5 + SINK, 5)), M((r() - .5) * 3, 0, (r() - .5) * 3, (r() - .5) * .2, r() * 6, (r() - .5) * .2), i % 2 ? C.pale : C.rock);
      foot = 2; height = 4.5; break;
    case 'stack':
      add(sunk(cyl(1.3, 1.8, 7 + SINK, 7)), M(0, 0, 0, 0, r()), C.rock);
      add(cyl(1.5, 1.3, .8, 7), M(0, 6.9, 0), C.dark);
      for (let i = 0; i < 4; i++) add(new THREE.IcosahedronGeometry(.6 + r() * .4, 0), M((r() - .5) * 4, .3, (r() - .5) * 4), C.dark);
      foot = 1.9; height = 7.5; break;
    case 'boulders':
      for (let i = 0; i < 4; i++) { const s = .7 + r() * 1.1; add(lump(s, 1, r() * 10, .18), M((r() - .5) * 4, s * .4, (r() - .5) * 4, r(), r() * 6, r(), 1, .75, 1.15), i % 2 ? C.rock : C.dark); }
      foot = 2.4; height = 1.6; break;
    case 'strata':
      for (let i = 0; i < 6; i++) add(i ? new THREE.BoxGeometry(4 - i * .35, .45, 2.4 - i * .2).translate(0, .225, 0) : sunk(new THREE.BoxGeometry(4, .45 + SINK, 2.4).translate(0, (.45 + SINK) / 2, 0)), M((r() - .5) * .3, i * .45, (r() - .5) * .3, 0, 0, .06), [C.sand, C.rock, C.orange, C.pale, C.sand2, C.dark][i]);
      foot = 2.2; height = 2.7; break;
    case 'geode':
      add(new THREE.SphereGeometry(1.1, 9, 6, 0, Math.PI * 1.5), M(0, .7, 0, 0, 0, 0, 1, .85, 1), C.rock);
      for (let i = 0; i < 9; i++) { const a = Math.PI * 1.5 + r() * Math.PI * .5, d = .3 + r() * .5; add(new THREE.ConeGeometry(.12, .45, 5).translate(0, .22, 0), M(Math.cos(a) * d * .7, .45 + r() * .5, Math.sin(a) * d * .7, (r() - .5), 0, (r() - .5)), C.crystal); }
      add(sunk(cyl(1, 1.1, SINK)), M(), C.rock);
      foot = 1.2; height = 1.4; break;
    case 'meteorite':
      add(new THREE.TorusGeometry(2.4, .45, 4, 14).rotateX(Math.PI / 2), M(0, .05, 0, 0, 0, 0, 1, .6, 1), C.dark);
      add(new THREE.IcosahedronGeometry(.9, 1), M(0, .5, 0, r(), r(), r(), 1.2, .8, 1), C.metal);
      foot = 1.2; height = 1.3; break;
  }
  const merge = (list) => {
    if (!list.length) return null;
    const pos = [], nor = [], col = [], t = new THREE.Color();
    for (const { g, m, col: hex } of list) {
      const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(m); t.set(hex);
      const P = geo.attributes.position, N = geo.attributes.normal;
      for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(t.r, t.g, t.b); }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  };
  return { lit: merge(lit), glow: merge(glow), foot, height };
}
