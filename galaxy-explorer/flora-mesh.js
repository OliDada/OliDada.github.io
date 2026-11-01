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
      dummy.quaternion.setFromUnitVectors(Y, n);
      dummy.rotateY(r() * Math.PI * 2);
      dummy.rotateX((r() - .5) * .12);
      const s = sp.form === 'mat' ? .6 + r() * 1.2 : .7 + r() * .6;
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
function buildGeometry(THREE, sp, r) {
  const parts = [], H = sp.height, c = sp.colors;
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
  const add = (geo, matrix, color, foliage) => parts.push({ geo, matrix, color: new THREE.Color(color), foliage });
  const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0);
  const blob = (rad, detail = 0) => new THREE.IcosahedronGeometry(rad, detail);
  const leafScale = { round: [1, .85, 1], umbrella: [1.45, .45, 1.45], column: [.7, 1.6, .7], cluster: [.8, .8, .8] }[sp.leafShape];
  const leaf = (i) => (i % 2 ? c.leaf2 : c.leaf);

  if (sp.form === 'tree') {
    const trunkH = H * .55, tr = H * sp.trunkRatio;
    add(cyl(tr * .65, tr, trunkH), M(), c.stem, false);
    const tips = [[0, trunkH + H * .12, 0]];
    for (let k = 0; k < sp.branches; k++) {
      const a = k / sp.branches * Math.PI * 2 + r() * .6, tilt = .55 + r() * .4, len = H * (.22 + r() * .14), y0 = trunkH * (.6 + r() * .35);
      add(cyl(tr * .3, tr * .5, len, 5), M(0, y0, 0, 0, a, -tilt), c.stem, false);
      tips.push([Math.cos(-a) * Math.sin(tilt) * len, y0 + Math.cos(tilt) * len, Math.sin(-a) * Math.sin(tilt) * len]);
    }
    tips.forEach(([x, y, z], i) => {
      const rad = H * (i ? .16 : .24) * sp.leafSize, blobs = sp.leafShape === 'cluster' ? 3 : 1;
      for (let b = 0; b < blobs; b++) add(blob(rad * (blobs > 1 ? .7 : 1), 1), M(x + (r() - .5) * rad * (blobs > 1 ? 1 : 0), y + (r() - .5) * rad * .5, z + (r() - .5) * rad * (blobs > 1 ? 1 : 0), 0, r() * 6, 0, ...leafScale), leaf(i + b), true);
    });
  } else if (sp.form === 'conifer') {
    const tr = H * sp.trunkRatio * .8, tiers = sp.segments + 1;
    add(cyl(tr * .5, tr, H * .9), M(), c.stem, false);
    for (let i = 0; i < tiers; i++) {
      const f = i / tiers, rad = H * .27 * (1 - f * .72) * sp.leafSize;
      add(new THREE.ConeGeometry(rad, H * .3, 7).translate(0, H * .15, 0), M(0, H * (.2 + .68 * f), 0, 0, r() * 6), leaf(i), true);
    }
  } else if (sp.form === 'palm') {
    const tr = H * sp.trunkRatio * .7, seg = 4, lean = (r() - .5) * .5;
    let x = 0, y = 0;
    for (let i = 0; i < seg; i++) { const l = H / seg; add(cyl(tr * (1 - i * .12), tr * (1.05 - i * .12), l * 1.05), M(x, y, 0, 0, 0, -lean * i * .35), c.stem, false); x += Math.sin(lean * i * .35) * l; y += Math.cos(lean * i * .35) * l; }
    const fronds = 6 + (sp.seed % 4), len = H * .42 * sp.leafSize;
    for (let i = 0; i < fronds; i++) {
      const a = i / fronds * Math.PI * 2 + r() * .3, droop = .25 + r() * .45;
      const g = new THREE.BoxGeometry(len, .05, len * .2).translate(len / 2, 0, 0);
      add(g, new THREE.Matrix4().makeTranslation(x, y, 0).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(-droop)), leaf(i), true);
    }
    for (let i = 0; i < 3; i++) add(blob(H * .035), M(x + (r() - .5) * .4, y - .2, (r() - .5) * .4), c.accent, true);
  } else if (sp.form === 'shrub') {
    add(cyl(H * .04, H * .06, H * .35, 5), M(), c.stem, false);
    const blobs = 4 + (sp.seed % 3);
    for (let i = 0; i < blobs; i++) { const a = i / blobs * Math.PI * 2, d = H * .28; add(blob(H * .32 * sp.leafSize, 1), M(Math.cos(a) * d, H * (.4 + r() * .2), Math.sin(a) * d, 0, r() * 6, 0, ...leafScale), leaf(i), true); }
    add(blob(H * .34 * sp.leafSize, 1), M(0, H * .7, 0, 0, 0, 0, ...leafScale), c.leaf, true);
    if (sp.arms > 1) for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = H * .4; add(blob(H * .06), M(Math.cos(a) * d, H * (.55 + r() * .3), Math.sin(a) * d), c.accent, true); }
  } else if (sp.form === 'grass') {
    const blades = 6 + (sp.seed % 4);
    for (let i = 0; i < blades; i++) {
      const a = i / blades * Math.PI * 2 + r(), tilt = .12 + r() * .35, h = H * (.7 + r() * .4);
      add(new THREE.ConeGeometry(H * .055, h, 4).translate(0, h / 2, 0), M(Math.cos(a) * H * .08, 0, Math.sin(a) * H * .08, 0, a, tilt), leaf(i), true);
    }
    add(cyl(H * .08, H * .1, H * .05, 5), M(), c.stem, false);
  } else if (sp.form === 'succulent') {
    const R = H * .12;
    add(cyl(R, R * 1.05, H * .85, 8), M(), c.leaf, true);
    add(blob(R, 1), M(0, H * .85, 0, 0, 0, 0, 1, .7, 1), c.leaf, true);
    for (let i = 0; i < sp.arms; i++) {
      const a = i / Math.max(1, sp.arms) * Math.PI * 2 + r(), y0 = H * (.3 + r() * .25), out = R * 2.4, up = H * (.2 + r() * .15), ar = R * .7;
      add(cyl(ar, ar, out, 7), M(0, y0, 0, 0, a, -Math.PI / 2), c.leaf2, true);
      add(cyl(ar, ar, up, 7), M(Math.cos(-a) * out, y0 - ar * .2, Math.sin(-a) * out), c.leaf2, true);
      add(blob(ar * .9), M(Math.cos(-a) * out, y0 + up, Math.sin(-a) * out, 0, 0, 0, 1, .7, 1), c.leaf2, true);
    }
    add(blob(R * .45), M(0, H * .85 + R * .55, 0), c.accent, true);
    add(cyl(R * 1.1, R * 1.1, .05, 8), M(), c.stem, false);
  } else if (sp.form === 'fungus') {
    const caps = 1 + (sp.seed % 3);
    for (let i = 0; i < caps; i++) {
      const h = H * (i ? .45 + r() * .3 : 1), sr = h * .07, cr = h * (.32 + r() * .12) * sp.leafSize, x = i ? (r() - .5) * H * .7 : 0, z = i ? (r() - .5) * H * .7 : 0;
      add(cyl(sr * .8, sr * 1.3, h, 6), M(x, 0, z), c.stem, false);
      add(blob(cr, 1), M(x, h, z, 0, 0, 0, 1, sp.leafShape === 'column' ? .8 : .42, 1), i % 2 ? c.accent : c.leaf, true);
    }
  } else if (sp.form === 'stalk') {
    add(cyl(H * .018, H * .03, H, 5), M(), c.stem, false);
    const pods = 2 + sp.segments % 4;
    for (let i = 0; i < pods; i++) {
      const y = H * (.55 + .45 * i / pods), a = r() * 6.28, d = i === pods - 1 ? 0 : H * .06;
      add(blob(H * (.05 + r() * .05), 1), M(Math.cos(a) * d, y, Math.sin(a) * d, 0, 0, 0, 1, 1.3, 1), c.accent, true);
    }
    add(new THREE.ConeGeometry(H * .1, H * .25, 5).translate(0, H * .125, 0), M(), c.leaf, true);
  } else if (sp.form === 'mat') {
    for (let i = 0; i < 6; i++) { const rad = .5 + r() * 1.3; add(cyl(rad, rad * 1.05, H, 9), M((r() - .5) * 3, 0, (r() - .5) * 3, 0, r() * 6), leaf(i), true); }
    add(cyl(.2, .2, .01, 5), M(), c.stem, false);
  } else if (sp.form === 'mound') {
    const layers = 2 + sp.segments % 3;
    for (let i = 0; i < layers; i++) { const rad = H * (.75 - i * .15); add(blob(rad, 1), M((r() - .5) * .2, H * .25 * i, (r() - .5) * .2, 0, r() * 6, 0, 1, .55, 1), c.leaf2, false); }
    add(blob(H * .3, 1), M(0, H * .25 * layers + H * .05, 0, 0, 0, 0, 1, .5, 1), c.leaf, true);
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
