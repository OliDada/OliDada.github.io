// Builds and places plant models for the world you are on. Each species is one
// low-poly model drawn many times with instancing (one draw call per part), and
// a few lines of vertex shader make plants sway. THREE is passed in so this
// module works with whichever copy of three.js the page loads.
import { rng } from './rng.mjs';
import { floraFor, suitability } from './flora.mjs';

export function buildFlora(THREE, { body, terrain, radius, signalNormal, landingNormal, budget = 1500 }) {
  const { species } = floraFor(body);
  const group = new THREE.Group();
  const time = { value: 0 };
  const placed = [];
  if (!species.length) return { group, species, placed, update() {} };

  const Y = new THREE.Vector3(0, 1, 0);
  const totalAbundance = species.reduce((s, sp) => s + sp.abundance, 0);
  for (const sp of species) {
    const r = rng(body.seed, 'plants', sp.id);
    const geometry = buildGeometry(THREE, sp, r);
    const materials = [false, true].map((foliage) => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: foliage ? .75 : .95 });
      if (foliage && sp.glow > 0) { m.emissive = new THREE.Color(sp.colors.accent).lerp(new THREE.Color(sp.colors.leaf), .4); m.emissiveIntensity = sp.glow * .55; }
      if (sp.sway > 0) addSway(m, time, sp);
      return m;
    });
    const count = Math.max(8, Math.round(budget * sp.abundance / totalAbundance));
    const mesh = new THREE.InstancedMesh(geometry, materials, count);
    const positions = [], scales = [], n = new THREE.Vector3(), dummy = new THREE.Object3D(), tint = new THREE.Color();
    const nearAngle = 160 / radius, minAngle = 10 / radius; // dense within ~160 m of the site
    let tries = 0;
    while (positions.length < count && tries++ < count * 40) {
      // Most plants grow around the landing region you explore on foot; the rest across the world.
      if (r() < .65) {
        const a = Math.acos(1 - r() * (1 - Math.cos(nearAngle))), b = r() * Math.PI * 2;
        n.set(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, signalNormal));
      } else { const y = r() * 2 - 1, b = r() * Math.PI * 2, s = Math.sqrt(1 - y * y); n.set(Math.cos(b) * s, y, Math.sin(b) * s); }
      if (n.angleTo(signalNormal) < 9 / radius || n.angleTo(landingNormal) < minAngle) continue; // keep the monument and landing pad clear
      const h = terrain.height(n), climate = terrain.climate(n, h);
      if (climate.submerged) continue;
      // If a species finds little that suits it, it settles for marginal ground rather than vanishing.
      const fit = suitability(sp, climate), relaxed = tries > count * 25 ? Math.max(fit, .2) : fit;
      if (r() > relaxed) continue;
      dummy.position.copy(n).multiplyScalar(radius + h - .05);
      // Flat growths (mats, crusts) lie along the slope; everything else grows upright.
      dummy.quaternion.setFromUnitVectors(Y, sp.form === 'mat' || sp.form === 'crust' ? slopeNormal(THREE, terrain, radius, n) : n);
      dummy.rotateY(r() * Math.PI * 2);
      dummy.rotateX((r() - .5) * .12);
      const s = sp.form === 'mat' || sp.form === 'crust' ? .6 + r() * 1.2 : .7 + r() * .6;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      const index = positions.length / 3;
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, tint.setScalar(.88 + r() * .24));
      positions.push(dummy.position.x, dummy.position.y, dummy.position.z);
      scales.push(s);
    }
    mesh.count = positions.length / 3;
    mesh.frustumCulled = false; // instances cover the whole globe
    group.add(mesh);
    placed.push({ species: sp, positions: new Float32Array(positions), scales: new Float32Array(scales), mesh });
  }
  return { group, species, placed, update(t) { time.value = t; } };
}

// What you bump into when walking: trunk or body radius and height of one plant
// of this species at scale 1 (grasses and microbial mats are walked over).
export function plantFootprint(sp) {
  const H = sp.height;
  switch (sp.form) {
    case 'tree': case 'conifer': return { r: H * sp.trunkRatio + .25, h: H };
    case 'palm': return { r: H * sp.trunkRatio * .7 + .25, h: H };
    case 'succulent': return { r: H * .12 + .15, h: H };
    case 'fungus': return { r: H * .07 + .2, h: H };
    case 'stalk': return { r: H * .03 + .15, h: H };
    case 'shrub': return { r: H * .45, h: H * .8 };
    case 'mound': return { r: H * .65, h: H * .6 };
    case 'crystal': return { r: H * .25, h: H };
    case 'glasstree': return { r: H * .06 + .25, h: H };
    case 'chimney': return { r: H * .22, h: H };
    case 'plume': return { r: H * .05 + .15, h: H };
    case 'bulb': return { r: H * .4, h: H * .9 };
    case 'sheet': return { r: H * .12 + .15, h: H };
    case 'filament': return { r: .15, h: H };
    default: return null;
  }
}

// Wind: vertices sway more the higher they are on the plant.
function addSway(material, time, sp) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uAmp = { value: sp.sway * .045 * sp.height };
    shader.uniforms.uInvH = { value: 1 / sp.height };
    shader.vertexShader = 'uniform float uTime; uniform float uAmp; uniform float uInvH;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float swayK = pow(max(transformed.y * uInvH, 0.0), 2.0) * uAmp;
      float swayPhase = instanceMatrix[3].x * .37 + instanceMatrix[3].z * .23;
      transformed.x += sin(uTime * 1.7 + swayPhase) * swayK;
      transformed.z += cos(uTime * 1.3 + swayPhase * 1.3) * swayK * .6;`);
  };
  material.customProgramCacheKey = () => 'sway';
}

// --- Geometry: each form assembled from a few primitives, merged into one mesh
// with two groups (0: stems and trunks, 1: foliage, caps and pods). ---
export function buildGeometry(THREE, sp, r) { // exported for previews
  const parts = [], H = sp.height, c = sp.colors;
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
  const add = (geo, matrix, color, foliage) => parts.push({ geo, matrix, color: new THREE.Color(color), foliage });
  const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0);
  const blob = (rad, detail = 0) => new THREE.IcosahedronGeometry(rad, detail);
  const leafScale = { round: [1, .85, 1], umbrella: [1.45, .45, 1.45], column: [.7, 1.6, .7], cluster: [.8, .8, .8] }[sp.leafShape];
  const leaf = (i) => (i % 2 ? c.leaf2 : c.leaf);
  // A leaf or frond: a thin, segmented blade along +x that tapers to a point, droops
  // toward its tip and folds into a shallow V along its midrib.
  const blade = (len, wid, droop, fold = .35, segs = 4) => {
    const g = new THREE.BoxGeometry(len, Math.max(.01, len * .012), wid, segs, 1, 2).translate(len / 2, 0, 0), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const t = P.getX(i) / len, taper = Math.pow(Math.sin(Math.PI * Math.min(1, t * .85 + .15)), .7);
      const z = P.getZ(i) * taper; P.setZ(i, z); P.setY(i, P.getY(i) - droop * len * t * t + Math.abs(z) * fold);
    }
    g.computeVertexNormals(); return g;
  };
  // A grass-like blade standing up along +y, narrowing to a tip and arching over.
  const spear = (len, wid, bend, segs = 3) => {
    const g = new THREE.BoxGeometry(wid, len, Math.max(.008, wid * .15), 1, segs, 1).translate(0, len / 2, 0), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const t = P.getY(i) / len; P.setX(i, P.getX(i) * Math.pow(Math.max(0, 1 - t), .8)); P.setZ(i, P.getZ(i) + bend * len * t * t); P.setY(i, P.getY(i) * (1 - bend * .25 * t)); }
    g.computeVertexNormals(); return g;
  };

  if (sp.form === 'tree') {
    // A trunk in two bent sections with root flares and bark rings, branches with
    // twigs, crowns broken up by smaller clumps, and fruit or blossom on some.
    const trunkH = H * .55, tr = H * sp.trunkRatio, bend = (r() - .5) * .18;
    add(cyl(tr * .82, tr, trunkH * .5, 7), M(), c.stem, false);
    add(cyl(tr * .62, tr * .82, trunkH * .55, 7), M(0, trunkH * .48, 0, 0, 0, bend), c.stem, false);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + r() * .5; add(new THREE.ConeGeometry(tr * .45, tr * 2.2, 4).translate(0, tr * 1.1, 0), new THREE.Matrix4().makeTranslation(Math.cos(a) * tr * .75, -tr * .2, Math.sin(a) * tr * .75).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -.9)), c.stem, false); }
    for (let k = 1; k < 3; k++) add(cyl(tr * (1.02 - k * .1), tr * (1.04 - k * .1), tr * .15, 7), M(0, trunkH * k * .22, 0), c.leaf2, false);
    const topX = Math.sin(-bend) * trunkH * .55, tips = [[topX, trunkH + H * .12, 0]];
    for (let k = 0; k < sp.branches; k++) {
      const a = k / sp.branches * Math.PI * 2 + r() * .6, tilt = .55 + r() * .4, len = H * (.22 + r() * .14), y0 = trunkH * (.6 + r() * .35);
      add(cyl(tr * .3, tr * .5, len, 5), M(0, y0, 0, 0, a, -tilt), c.stem, false);
      const tx = Math.cos(-a) * Math.sin(tilt) * len, ty = y0 + Math.cos(tilt) * len, tz = Math.sin(-a) * Math.sin(tilt) * len;
      add(cyl(tr * .12, tr * .2, len * .5, 4), M(tx * .6, y0 + (ty - y0) * .6, tz * .6, 0, a + 1.2, -tilt * .6), c.stem, false);
      tips.push([tx, ty, tz]);
    }
    tips.forEach(([x, y, z], i) => {
      const rad = H * (i ? .16 : .24) * sp.leafSize, blobs = sp.leafShape === 'cluster' ? 3 : 1;
      for (let b = 0; b < blobs; b++) add(blob(rad * (blobs > 1 ? .7 : 1), 1), M(x + (r() - .5) * rad * (blobs > 1 ? 1 : 0), y + (r() - .5) * rad * .5, z + (r() - .5) * rad * (blobs > 1 ? 1 : 0), 0, r() * 6, 0, ...leafScale), leaf(i + b), true);
      for (let b = 0; b < 2; b++) { const a = r() * 6.28, d = rad * (.75 + r() * .25); add(blob(rad * (.3 + r() * .15), 0), M(x + Math.cos(a) * d * leafScale[0], y + (r() - .3) * rad * leafScale[1], z + Math.sin(a) * d * leafScale[2], 0, r() * 6, 0, ...leafScale), leaf(i + b + 1), true); }
      if (sp.arms > 1 || i === 0) for (let b = 0; b < 2; b++) { const a = r() * 6.28; add(blob(H * .025, 0), M(x + Math.cos(a) * rad * .9 * leafScale[0], y - rad * .2, z + Math.sin(a) * rad * .9 * leafScale[2]), c.accent, true); }
    });
  } else if (sp.form === 'conifer') {
    // Root flares, a tapering trunk, and tiers of drooping boughs that thin toward a spire.
    const tr = H * sp.trunkRatio * .8, tiers = sp.segments + 1;
    add(cyl(tr * .4, tr, H * .92, 6), M(), c.stem, false);
    for (let k = 0; k < 3; k++) { const a = k * 2.09 + r(); add(new THREE.ConeGeometry(tr * .45, tr * 2, 4).translate(0, tr, 0), new THREE.Matrix4().makeTranslation(Math.cos(a) * tr * .6, -tr * .2, Math.sin(a) * tr * .6).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -1)), c.stem, false); }
    for (let i = 0; i < tiers; i++) {
      const f = i / tiers, rad = H * .27 * (1 - f * .72) * sp.leafSize, y = H * (.2 + .68 * f);
      add(new THREE.ConeGeometry(rad, H * .3, 8).translate(0, H * .15, 0), M(0, y, 0, 0, r() * 6), leaf(i), true);
      add(new THREE.CylinderGeometry(rad * .92, rad * 1.08, H * .06, 8, 1, true).translate(0, H * .03, 0), M(0, y - H * .045, 0, 0, r() * 6), leaf(i + 1), true);
    }
    add(new THREE.ConeGeometry(H * .03, H * .14, 5).translate(0, H * .07, 0), M(0, H * .94, 0), c.leaf, true);
  } else if (sp.form === 'palm') {
    // A ringed, leaning trunk; long fronds that droop and fold along the midrib; a fruit cluster.
    const tr = H * sp.trunkRatio * .7, seg = 5, lean = (r() - .5) * .5;
    let x = 0, y = 0;
    for (let i = 0; i < seg; i++) {
      const l = H / seg, m = M(x, y, 0, 0, 0, -lean * i * .3);
      add(cyl(tr * (1 - i * .1), tr * (1.05 - i * .1), l * 1.05, 7), m, c.stem, false);
      add(cyl(tr * (1.12 - i * .1), tr * (1.12 - i * .1), l * .12, 7), m, c.leaf2, false);
      x += Math.sin(lean * i * .3) * l; y += Math.cos(lean * i * .3) * l;
    }
    add(cyl(tr * 1.4, tr * .9, H * .06, 7), M(x, y - H * .05, 0), c.stem, false);
    const fronds = 7 + (sp.seed % 4), len = H * .45 * sp.leafSize;
    for (let i = 0; i < fronds; i++) {
      const a = i / fronds * Math.PI * 2 + r() * .3, rise = .25 - r() * .5;
      add(blade(len, len * .26, .35 + r() * .35, .45, 4), new THREE.Matrix4().makeTranslation(x, y, 0).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(rise)), leaf(i), true);
    }
    for (let i = 0; i < 2; i++) { const a = i * 3 + r(); add(blade(len * .5, len * .18, -.2, .4, 3), new THREE.Matrix4().makeTranslation(x, y + H * .02, 0).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(1.1)), c.leaf, true); }
    for (let i = 0; i < 5; i++) add(blob(H * .035), M(x + (r() - .5) * tr * 3, y - H * .04 - r() * H * .03, (r() - .5) * tr * 3), c.accent, true);
  } else if (sp.form === 'shrub') {
    // Several stems, a mounded crown broken into clumps, twigs poking out, and blossom or berries.
    for (let i = 0; i < 3; i++) { const a = i * 2.09 + r(); add(cyl(H * .025, H * .045, H * .45, 4), M(Math.cos(a) * H * .06, 0, Math.sin(a) * H * .06, 0, -a, .25), c.stem, false); }
    const blobs = 4 + (sp.seed % 3);
    for (let i = 0; i < blobs; i++) { const a = i / blobs * Math.PI * 2, d = H * .3; add(blob(H * .27 * sp.leafSize, 1), M(Math.cos(a) * d, H * (.4 + r() * .2), Math.sin(a) * d, 0, r() * 6, 0, ...leafScale), leaf(i), true); }
    add(blob(H * .34 * sp.leafSize, 1), M(0, H * .7, 0, 0, 0, 0, ...leafScale), c.leaf, true);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + r() * .5, d = H * (.45 + r() * .12); add(blob(H * (.1 + r() * .06) * sp.leafSize, 0), M(Math.cos(a) * d, H * (.3 + r() * .55), Math.sin(a) * d, 0, r() * 6, 0), leaf(i + 1), true); }
    for (let i = 0; i < 5; i++) { const a = r() * 6.28, m = M(Math.cos(a) * H * .3, H * (.5 + r() * .3), Math.sin(a) * H * .3, 0, -a, -1 - r() * .4); add(cyl(H * .006, H * .012, H * .3, 3), m, c.stem, false); }
    const n = sp.arms > 1 ? 9 : 4;
    for (let i = 0; i < n; i++) { const a = r() * 6.28, d = H * (.42 + r() * .12), y = H * (.45 + r() * .4); add(blob(H * (sp.arms > 1 ? .055 : .035), 0), M(Math.cos(a) * d, y, Math.sin(a) * d), c.accent, true); }
  } else if (sp.form === 'grass') {
    // Arching flat blades in a clump, a few bearing seed heads.
    const blades = 7 + (sp.seed % 4);
    for (let i = 0; i < blades; i++) {
      const a = i / blades * Math.PI * 2 + r(), h = H * (.7 + r() * .4), bend = .15 + r() * .35;
      add(spear(h, H * .09, bend, 2), M(Math.cos(a) * H * .07, 0, Math.sin(a) * H * .07, 0, a + Math.PI / 2, 0), leaf(i), true);
    }
    for (let i = 0; i < 2; i++) { const a = r() * 6.28, h = H * (1 + r() * .3), tilt = .1 + r() * .2; const m = M(Math.cos(a) * H * .05, 0, Math.sin(a) * H * .05, 0, a, tilt); add(cyl(H * .008, H * .012, h, 3), m, c.leaf2, true); add(blob(H * .04, 0), m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, h, 0), new THREE.Quaternion(), new THREE.Vector3(1, 2.4, 1))), c.accent, true); }
    add(cyl(H * .08, H * .1, H * .05, 5), M(), c.stem, false);
  } else if (sp.form === 'succulent') {
    // A ribbed column with spines in rows, ribbed arms, and a flower crowning the top.
    const R = H * .12, ribs = 8;
    add(cyl(R, R * 1.05, H * .85, ribs), M(), c.leaf, true);
    add(blob(R, 1), M(0, H * .85, 0, 0, 0, 0, 1, .7, 1), c.leaf, true);
    for (let i = 0; i < ribs; i++) { const a = (i + .5) / ribs * Math.PI * 2; add(new THREE.BoxGeometry(R * .22, H * .8, R * .22).translate(0, H * .4, 0), M(Math.cos(a) * R * .95, 0, Math.sin(a) * R * .95, 0, -a + Math.PI / 4), c.leaf2, true);
      for (let j = 1; j < 5; j++) add(new THREE.ConeGeometry(R * .05, R * .45, 3).rotateZ(-Math.PI / 2), M(Math.cos(a) * R * 1.12, H * j * .17, Math.sin(a) * R * 1.12, 0, -a, .3), c.stem, true); }
    for (let i = 0; i < sp.arms; i++) {
      const a = i / Math.max(1, sp.arms) * Math.PI * 2 + r(), y0 = H * (.3 + r() * .25), out = R * 2.4, up = H * (.2 + r() * .15), ar = R * .7;
      add(cyl(ar, ar, out, 7), M(0, y0, 0, 0, a, -Math.PI / 2), c.leaf2, true);
      add(cyl(ar, ar, up, 7), M(Math.cos(-a) * out, y0 - ar * .2, Math.sin(-a) * out), c.leaf2, true);
      add(blob(ar * .9), M(Math.cos(-a) * out, y0 + up, Math.sin(-a) * out, 0, 0, 0, 1, .7, 1), c.leaf2, true);
      for (let j = 0; j < 4; j++) { const b = j * 1.57; add(new THREE.BoxGeometry(ar * .18, up * .9, ar * .18).translate(0, up * .45, 0), M(Math.cos(-a) * out + Math.cos(b) * ar * .95, y0, Math.sin(-a) * out + Math.sin(b) * ar * .95, 0, -b + Math.PI / 4), c.leaf, true); }
    }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.ConeGeometry(R * .22, R * .7, 3).translate(0, R * .35, 0), M(0, H * .85 + R * .45, 0, 0, a, .7), c.accent, true); }
    add(blob(R * .25), M(0, H * .85 + R * .6, 0), c.leaf2, true);
    add(cyl(R * 1.2, R * 1.3, .05, 8), M(), c.stem, false);
  } else if (sp.form === 'fungus') {
    // Caps with gills beneath and spots on top, a ring on the stem and a bulbous foot.
    const caps = 1 + (sp.seed % 3);
    for (let i = 0; i < caps; i++) {
      const h = H * (i ? .45 + r() * .3 : 1), sr = h * .07, cr = h * (.32 + r() * .12) * sp.leafSize, x = i ? (r() - .5) * H * .7 : 0, z = i ? (r() - .5) * H * .7 : 0, flat = sp.leafShape === 'column' ? .8 : .42;
      add(blob(sr * 1.8, 0), M(x, sr * .6, z, 0, 0, 0, 1, .7, 1), c.stem, false);
      add(cyl(sr * .8, sr * 1.3, h, 7), M(x, 0, z), c.stem, false);
      add(new THREE.CylinderGeometry(sr * 1.6, sr * 1.05, h * .04, 8, 1, true), M(x, h * .72, z), c.leaf2, false);
      add(new THREE.ConeGeometry(cr * .95, cr * flat * .9, 12, 1, true).rotateX(Math.PI).translate(0, cr * flat * .45, 0), M(x, h - cr * flat * .5, z), c.stem, false);
      add(blob(cr, 1), M(x, h, z, 0, 0, 0, 1, flat, 1), i % 2 ? c.accent : c.leaf, true);
      for (let j = 0; j < 6; j++) { const a = r() * 6.28, d = cr * (.2 + r() * .55); add(blob(cr * (.07 + r() * .06), 0), M(x + Math.cos(a) * d, h + cr * flat * Math.sqrt(Math.max(0, 1 - (d / cr) ** 2)) * .97, z + Math.sin(a) * d, 0, 0, 0, 1, .4, 1), i % 2 ? c.leaf : c.accent, true); }
    }
  } else if (sp.form === 'stalk') {
    // A jointed stalk with leaves at the nodes, a basal rosette and a crown of pods.
    add(cyl(H * .018, H * .03, H, 5), M(), c.stem, false);
    for (let j = 1; j < 4; j++) { const y = H * j * .2; add(cyl(H * .026, H * .026, H * .02, 5), M(0, y, 0), c.leaf2, false); add(blade(H * .2, H * .05, .4, .3, 3), M(0, y, 0, 0, j * 2.3, .5), c.leaf, true); }
    const pods = 2 + sp.segments % 4;
    for (let i = 0; i < pods; i++) {
      const y = H * (.55 + .45 * i / pods), a = r() * 6.28, d = i === pods - 1 ? 0 : H * .06;
      add(blob(H * (.05 + r() * .05), 1), M(Math.cos(a) * d, y, Math.sin(a) * d, 0, 0, 0, 1, 1.3, 1), c.accent, true);
    }
    for (let i = 0; i < 6; i++) add(blade(H * .18, H * .06, .5, .3, 3), M(0, H * .01, 0, 0, i * 1.05 + r() * .3, .2), leaf(i), true);
  } else if (sp.form === 'mat') {
    // Overlapping patches, each a little thicker than the last so no two tops are
    // level (level tops flicker against each other), and each reaching down into the
    // ground so uneven terrain never shows beneath or pokes through a gap.
    const sink = .6;
    for (let i = 0; i < 6; i++) { const rad = .5 + r() * 1.3, h = H * (1 + i * .35); add(cyl(rad, rad * 1.05, h + sink, 9), M((r() - .5) * 3, -sink, (r() - .5) * 3, 0, r() * 6), leaf(i), true); }
    add(cyl(.2, .2, .01, 5), M(), c.stem, false);
  } else if (sp.form === 'mound') {
    // A layered cushion studded with smaller buds and a few flowers.
    const layers = 2 + sp.segments % 3;
    for (let i = 0; i < layers; i++) { const rad = H * (.75 - i * .15); add(blob(rad, 1), M((r() - .5) * .2, H * .25 * i, (r() - .5) * .2, 0, r() * 6, 0, 1, .55, 1), c.leaf2, false); }
    add(blob(H * .3, 1), M(0, H * .25 * layers + H * .05, 0, 0, 0, 0, 1, .5, 1), c.leaf, true);
    for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = H * (.3 + r() * .4); add(blob(H * (.08 + r() * .06), 0), M(Math.cos(a) * d, H * (.15 + r() * .3), Math.sin(a) * d, 0, r() * 6, 0, 1, .7, 1), i % 3 ? c.leaf : c.accent, true); }
  } else if (sp.form === 'crystal') {
    // A cluster of hexagonal prisms with pointed tips, leaning outward.
    const n = 5 + sp.seed % 5;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r(), tilt = i ? .25 + r() * .5 : 0, h = H * (i ? .4 + r() * .5 : 1), w = H * (.06 + r() * .05);
      const m = M(Math.cos(a) * H * .08, 0, Math.sin(a) * H * .08, 0, a, tilt);
      add(cyl(w, w, h * .8, 6), m, leaf(i), true);
      add(new THREE.ConeGeometry(w, h * .2, 6).translate(0, h * .9, 0), m, i % 3 ? c.leaf : c.accent, true);
    }
    add(cyl(H * .2, H * .25, H * .06, 6), M(), c.stem, false);
  } else if (sp.form === 'glasstree') {
    // A faceted glass trunk that splits into angled crystal branches.
    const tr = H * .06;
    add(cyl(tr * .7, tr, H * .5, 5), M(), c.stem, false);
    const n = 3 + sp.seed % 3;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r() * .5, tilt = .45 + r() * .4, len = H * (.35 + r() * .2), y0 = H * (.4 + r() * .1);
      add(cyl(tr * .25, tr * .5, len, 5), M(0, y0, 0, 0, a, -tilt), c.stem, false);
      const tx = Math.cos(-a) * Math.sin(tilt) * len, ty = y0 + Math.cos(tilt) * len, tz = Math.sin(-a) * Math.sin(tilt) * len;
      for (let k = 0; k < 3; k++) add(new THREE.ConeGeometry(H * .04, H * (.15 + r() * .12), 5).translate(0, H * .08, 0), M(tx, ty, tz, (r() - .5) * .9, r() * 6, (r() - .5) * .9), k ? leaf(i + k) : c.accent, true);
    }
    add(new THREE.ConeGeometry(H * .05, H * .3, 5).translate(0, H * .15, 0), M(0, H * .5, 0), c.accent, true);
  } else if (sp.form === 'chimney') {
    // A rough mineral chimney; tube-feeders crowd its rim.
    const tiers = 3 + sp.segments % 3;
    for (let i = 0; i < tiers; i++) { const f = i / tiers, rad = H * (.22 - f * .1); add(cyl(rad * .85, rad, H / tiers * 1.05, 7), M((r() - .5) * H * .03, H * f, (r() - .5) * H * .03, 0, r() * 6), i % 2 ? c.stem : c.leaf2, false); }
    const tubes = 6 + sp.seed % 6;
    for (let i = 0; i < tubes; i++) {
      const a = r() * 6.28, d = H * (.05 + r() * .08), h = H * (.2 + r() * .2), m = M(Math.cos(a) * d, H * .95, Math.sin(a) * d, (r() - .5) * .5, 0, (r() - .5) * .5);
      add(cyl(H * .015, H * .015, h, 4), m, c.leaf, true);
      add(blob(H * .03), new THREE.Matrix4().copy(m).multiply(new THREE.Matrix4().makeTranslation(0, h, 0)), c.accent, true);
    }
  } else if (sp.form === 'plume') {
    // Feathery fans on a short stalk, like a sea pen.
    add(cyl(H * .03, H * .05, H * .45, 5), M(), c.stem, false);
    const n = 5 + sp.seed % 4;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, tilt = .3 + r() * .5;
      add(new THREE.ConeGeometry(H * .09, H * .6, 3).scale(1, 1, .2).translate(0, H * .3, 0), M(0, H * .4, 0, 0, a, tilt), leaf(i), true);
    }
    add(blob(H * .07), M(0, H * .45, 0), c.accent, true);
  } else if (sp.form === 'bulb') {
    // Waxy swollen bulbs on short necks, in a clump.
    const n = 3 + sp.seed % 4;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r(), d = i ? H * .3 : 0, h = H * (i ? .35 + r() * .3 : .7), rad = H * (.18 + r() * .12) * sp.leafSize;
      add(cyl(rad * .2, rad * .3, h, 6), M(Math.cos(a) * d, 0, Math.sin(a) * d), c.stem, false);
      add(blob(rad, 1), M(Math.cos(a) * d, h + rad * .6, Math.sin(a) * d, 0, r() * 6, 0, 1, 1.25, 1), leaf(i), true);
      if (i % 2 === 0) add(blob(rad * .3), M(Math.cos(a) * d, h + rad * 1.75, Math.sin(a) * d), c.accent, true);
    }
  } else if (sp.form === 'sheet') {
    // Thin upright sails, slightly curled, catching the faint light.
    const n = 2 + sp.seed % 3;
    add(cyl(H * .06, H * .08, H * .08, 6), M(), c.stem, false);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI + r() * .4, w = H * (.25 + r() * .15), h = H * (.7 + r() * .3);
      const g = new THREE.BoxGeometry(w, h, .04, 4, 6, 1).translate(0, h / 2, 0), P = g.attributes.position;
      for (let k = 0; k < P.count; k++) {
        const f = P.getY(k) / h, taper = Math.sin(Math.min(1, f * 1.15 + .12) * Math.PI) * .9 + .1; // narrow base, broad middle, pointed tip
        P.setX(k, P.getX(k) * taper); P.setZ(k, P.getZ(k) + (P.getX(k) / w) ** 2 * w * 1.2 + Math.sin(f * 3) * w * .12 + f * f * w * .5);
      }
      add(g, M(0, H * .05, 0, 0, a, (r() - .5) * .25), leaf(i), true);
    }
  } else if (sp.form === 'filament') {
    // A towering thin thread, beaded with pods; only possible in deep cold and weak winds.
    add(cyl(H * .006, H * .012, H, 4), M(), c.stem, false);
    const beads = 4 + sp.segments;
    for (let i = 1; i <= beads; i++) add(blob(H * (.012 + .014 * (i % 3 === 0)), 0), M(0, H * i / (beads + 1), 0, 0, 0, 0, 1, 1.6, 1), i % 3 === 0 ? c.accent : c.leaf, true);
    for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(H * .01, H * .08, 3).translate(0, H * .04, 0), M(0, H, 0, 0, i * 1.57, .7), c.leaf2, true);
  } else if (sp.form === 'crust') {
    // Overlapping plates of dark growth, built up in layers.
    for (let i = 0; i < 7; i++) { const rad = .4 + r() * 1.1, h = H * (.3 + r() * .7) * (1 + i * .04); add(cyl(rad * .8, rad, h + .5, 7), M((r() - .5) * 2.6, -.5, (r() - .5) * 2.6, (r() - .5) * .2, r() * 6, (r() - .5) * .2), leaf(i), true); }
    add(cyl(.2, .2, .01, 5), M(), c.stem, false);
  }

  // Merge: stems first, then foliage, each part non-indexed with its colour baked in.
  const ordered = [...parts.filter(p => !p.foliage), ...parts.filter(p => p.foliage)];
  const pos = [], nor = [], col = [];
  let stemVerts = 0;
  for (const p of ordered) {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo).applyMatrix4(p.matrix);
    g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) { pos.push(P[i], P[i + 1], P[i + 2]); nor.push(N[i], N[i + 1], N[i + 2]); col.push(p.color.r, p.color.g, p.color.b); }
    if (!p.foliage) stemVerts += P.length / 3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.addGroup(0, stemVerts, 0);
  geometry.addGroup(stemVerts, pos.length / 3 - stemVerts, 1);
  geometry.computeBoundingSphere();
  return geometry;
}

// The ground's own normal at n, from heights 1.5 m away in two directions.
function slopeNormal(THREE, terrain, radius, n) {
  const a = new THREE.Vector3(0, 1, 0).cross(n);
  if (a.lengthSq() < 1e-6) a.set(1, 0, 0).cross(n);
  a.normalize();
  const b = n.clone().cross(a), at = (d) => { const m = n.clone().addScaledVector(d, 1.5 / radius).normalize(); return m.multiplyScalar(radius + terrain.height(m)); };
  const p0 = n.clone().multiplyScalar(radius + terrain.height(n)), g = at(b).sub(p0).cross(at(a).sub(p0)).normalize();
  return g.dot(n) < 0 ? g.negate() : g;
}
