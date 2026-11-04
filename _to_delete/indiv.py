import sys
p = sys.argv[1]
s = open(p).read()
def R(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)

# ---- buildFlora: variants per species, individual plants differ ----
i = s.index("  for (const sp of species) {\n    const r = rng(body.seed, 'plants', sp.id);")
j = s.index("  return { group, species, placed, update(t) { time.value = t; } };")
s = s[:i] + '''  for (const sp of species) {
    const r = rng(body.seed, 'plants', sp.id), rv = rng(body.seed, 'plants', sp.id, 'individual');
    // Several models per species (different branching, lean and twist), one of them in
    // bloom or fruit if the species blooms; each plant picks one.
    const flat = sp.form === 'mat' || sp.form === 'crust';
    const V = flat ? 1 : ['grass', 'mound', 'plume', 'crystal'].includes(sp.form) ? 2 : 3;
    const blooming = V > 1 && sp.bloom && !['none', 'seeds'].includes(sp.bloom);
    const geos = [buildGeometry(THREE, sp, r, { bloom: false })];
    for (let v = 1; v < V; v++) geos.push(buildGeometry(THREE, sp, rng(body.seed, 'plants', sp.id, 'v' + v), { bloom: blooming && v === V - 1 }));
    const materials = [false, true].map((foliage) => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: foliage ? .75 : .95 });
      if (foliage && sp.glow > 0) { m.emissive = new THREE.Color(sp.colors.accent).lerp(new THREE.Color(sp.colors.leaf), .4); m.emissiveIntensity = sp.glow * .55; }
      if (sp.sway > 0) addSway(m, time, sp);
      return m;
    });
    const count = Math.max(8, Math.round(budget * sp.abundance / totalAbundance));
    const positions = [], scales = [], n = new THREE.Vector3(), dummy = new THREE.Object3D(), tint = new THREE.Color();
    const chosen = [], matrices = [], tints = [];
    const nearAngle = 160 / radius, minAngle = 10 / radius; // dense within ~160 m of the site
    let tries = 0;
    while (positions.length / 3 < count && tries++ < count * 40) {
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
      dummy.quaternion.setFromUnitVectors(Y, flat ? slopeNormal(THREE, terrain, radius, n) : n);
      dummy.rotateY(r() * Math.PI * 2);
      dummy.rotateX((r() - .5) * .12);
      // Each plant its own: young or old, broader or slimmer, a little warmer or cooler in colour.
      let s = flat ? .6 + r() * 1.2 : .7 + r() * .6;
      const age = rv();
      if (!flat) s *= age < .12 ? .4 + rv() * .25 : age > .94 ? 1.25 + rv() * .2 : 1;
      const wide = flat ? 1 : .82 + rv() * .36;
      dummy.scale.set(s * wide, s, s * (flat ? 1 : wide * (.9 + rv() * .2)));
      dummy.updateMatrix();
      const b = .88 + r() * .24, d = (rv() - .5) * .12, e = (rv() - .5) * .06;
      const v = blooming && age >= .12 && rv() < sp.bloomShare ? V - 1 : Math.floor(rv() * (blooming ? V - 1 : V));
      chosen.push(v); matrices.push(dummy.matrix.clone()); tints.push(tint.setRGB(b * (1 + d), b * (1 + e), b * (1 - d)).clone());
      positions.push(dummy.position.x, dummy.position.y, dummy.position.z);
      scales.push(s);
    }
    // One instanced mesh per model; `mesh` addresses plants by their index in `positions`.
    const where = [], meshes = geos.map((g, v) => {
      const m = new THREE.InstancedMesh(g, materials, Math.max(1, chosen.filter(x => x === v).length));
      m.count = 0; m.frustumCulled = false; // instances cover the whole globe
      return m;
    });
    chosen.forEach((v, i) => { const m = meshes[v], k = m.count++; m.setMatrixAt(k, matrices[i]); m.setColorAt(k, tints[i]); where.push([v, k]); });
    for (const m of meshes) if (m.count) group.add(m);
    const mesh = {
      meshes,
      setMatrixAt(i, matrix) { const [v, k] = where[i]; meshes[v].setMatrixAt(k, matrix); },
      instanceMatrix: { set needsUpdate(x) { for (const m of meshes) m.instanceMatrix.needsUpdate = x; } },
    };
    placed.push({ species: sp, positions: new Float32Array(positions), scales: new Float32Array(scales), mesh, meshes });
  }
''' + s[j:]

# ---- buildGeometry: traits ----
R("export function buildGeometry(THREE, sp, r) { // exported for previews",
  "export function buildGeometry(THREE, sp, r, { bloom = false } = {}) { // exported for previews")
R("\n  if (sp.form === 'tree') {", "\n  const grow = () => {\n  if (sp.form === 'tree') {")
R("  // Merge: stems first, then foliage, each part non-indexed with its colour baked in.",
'''  };

  // Growth habit: several stems from one root, or one.
  if (sp.growth === 'multi' && !['mat', 'crust', 'grass'].includes(sp.form)) {
    const stems = 2 + (r() < .4 ? 1 : 0);
    for (let k = 0; k < stems; k++) {
      const from = parts.length; grow();
      if (!k) continue;
      const a = k / stems * Math.PI * 2 + r() * .8, d = H * (.06 + r() * .06) + H * sp.trunkRatio * 1.5, sc = .6 + r() * .25;
      const T = new THREE.Matrix4().makeTranslation(Math.cos(a) * d, 0, Math.sin(a) * d).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -(.1 + r() * .15))).multiply(new THREE.Matrix4().makeScale(sc, sc, sc));
      for (let q = from; q < parts.length; q++) parts[q].matrix.premultiply(T);
    }
  } else grow();

  // Where the foliage is (crowns, clumps, caps, bulbs) and the top of the stems, for the
  // traits below.
  const sphereOf = (p) => { const g = p.geo.clone().applyMatrix4(p.matrix); g.computeBoundingSphere(); const sph = g.boundingSphere.clone(); g.dispose(); return sph; };
  const crowns = parts.filter(p => p.foliage).map(sphereOf).filter(q => q.radius > H * .05).sort((a, b) => b.radius - a.radius).slice(0, 10);
  const tip = (q, up) => { const a = r() * Math.PI * 2, el = up ? r() * 1.2 : -.2 - r() * 1; return new THREE.Vector3(q.center.x + Math.cos(a) * Math.cos(el) * q.radius, q.center.y + Math.sin(el) * q.radius * .8, q.center.z + Math.sin(a) * Math.cos(el) * q.radius); };
  // Weeping crowns: strands hanging from the rim of each crown.
  if (sp.weeping) for (const q of crowns.slice(0, 6)) for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + r() * .5, L0 = q.radius * (1.1 + r() * .9), x = q.center.x + Math.cos(a) * q.radius * .85, z = q.center.z + Math.sin(a) * q.radius * .85;
    add(cyl(q.radius * .07, q.radius * .03, L0, 3).rotateX(Math.PI), M(x, q.center.y - q.radius * .1, z, 0, 0, 0), k % 2 ? c.leaf : c.leaf2, true);
  }
  // Trailing vines from the crowns and moss on the trunk.
  if (sp.vines) {
    for (const q of crowns.slice(0, 4)) for (let k = 0; k < 3; k++) {
      const p0 = tip(q, false), L0 = H * (.15 + r() * .25);
      add(cyl(H * .006, H * .004, L0, 3).rotateX(Math.PI), M(p0.x, p0.y, p0.z), c.leaf2, true);
      for (let j = 1; j < 4; j++) add(blob(H * .018, 0), M(p0.x, p0.y - L0 * j / 4, p0.z, 0, r() * 6, 0, 1.4, .6, 1.4), c.leaf, true);
    }
    const tr = H * (sp.trunkRatio || .05);
    for (let k = 0; k < 4; k++) { const a = r() * 6.28; add(blob(tr * (.5 + r() * .4), 0), M(Math.cos(a) * tr * .9, H * (.1 + r() * .35), Math.sin(a) * tr * .9, 0, 0, 0, 1, 1.6, 1), c.leaf2, false); }
  }
  // In bloom: blossom, fruit, berries, a flower, or spores, in the species' bloom colour.
  if (bloom && crowns.length) {
    const col = c.bloom || c.accent;
    if (sp.bloom === 'blossom') for (const q of crowns.slice(0, 6)) for (let k = 0; k < 9; k++) { const p0 = tip(q, true); add(blob(Math.max(H * .02, q.radius * .09), 0), M(p0.x, p0.y, p0.z, 0, r() * 6, 0, 1, .6, 1), col, true); }
    if (sp.bloom === 'fruit') for (const q of crowns.slice(0, 5)) for (let k = 0; k < 4; k++) { const p0 = tip(q, false), fr = Math.max(H * .03, q.radius * .12); add(cyl(fr * .08, fr * .08, fr * .9, 3).rotateX(Math.PI), M(p0.x, p0.y, p0.z), c.stem, true); add(blob(fr, 1), M(p0.x, p0.y - fr * 1.6, p0.z, 0, 0, 0, 1, 1.25, 1), col, true); }
    if (sp.bloom === 'berries') for (const q of crowns.slice(0, 6)) for (let k = 0; k < 4; k++) { const p0 = tip(q, r() < .5), br = Math.max(H * .018, q.radius * .07); for (let j = 0; j < 3; j++) add(blob(br, 0), M(p0.x + (j - 1) * br * 1.4, p0.y - (j % 2) * br, p0.z), col, true); }
    if (sp.bloom === 'flower' || sp.bloom === 'spores') {
      const q = crowns.reduce((a, b) => (b.center.y + b.radius > a.center.y + a.radius ? b : a)), top = q.center.y + q.radius * .9, fr = q.radius * .55;
      if (sp.bloom === 'flower') { for (let k = 0; k < 7; k++) add(new THREE.ConeGeometry(fr * .28, fr, 3).translate(0, fr * .5, 0), M(q.center.x, top, q.center.z, 0, k / 7 * Math.PI * 2, .9), col, true); add(blob(fr * .3, 0), M(q.center.x, top + fr * .1, q.center.z), c.accent, true); }
      else for (const q2 of crowns.slice(0, 3)) for (let k = 0; k < 6; k++) add(blob(H * .012, 0), M(q2.center.x + (r() - .5) * q2.radius * 1.6, q2.center.y + q2.radius * (1 + r() * 1.5), q2.center.z + (r() - .5) * q2.radius * 1.6), col, true);
    }
  }
  // Growth habit: a lean for the whole plant.
  if (sp.growth === 'leaning') { const lean = new THREE.Matrix4().makeRotationZ(.1 + r() * .18); for (const p of parts) p.matrix.premultiply(lean); }
  const twist = sp.growth === 'twisted' ? (.7 + r() * .6) * (r() < .5 ? -1 : 1) : 0, bend = (r() - .5) * .12;
  const PALE = new THREE.Color('#ddd6c8'), tmp = new THREE.Color();

  // Merge: stems first, then foliage, each part non-indexed with its colour baked in.''')
R('''    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo).applyMatrix4(p.matrix);
    g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) { pos.push(P[i], P[i + 1], P[i + 2]); nor.push(N[i], N[i + 1], N[i + 2]); col.push(p.color.r, p.color.g, p.color.b); }''',
'''    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo).applyMatrix4(p.matrix);
    // A twisted habit turns the plant about its axis more the higher it goes, with an S-bend.
    if (twist) { const A = g.attributes.position; for (let i = 0; i < A.count; i++) { const y = A.getY(i), t = Math.max(0, y / H), a = twist * t, x = A.getX(i), z = A.getZ(i); A.setXYZ(i, x * Math.cos(a) - z * Math.sin(a) + Math.sin(t * Math.PI) * H * bend, y, x * Math.sin(a) + z * Math.cos(a)); } }
    g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    // Bark: banded, pale with dark marks, or mottled; colour is set per face so it stays crisp.
    const barked = !p.foliage && sp.bark && sp.bark !== 'plain';
    for (let i = 0; i < P.length; i += 9) {
      tmp.copy(p.color);
      if (barked) {
        const cy = (P[i + 1] + P[i + 4] + P[i + 7]) / 3, hsh = ((((i / 9) | 0) * 2654435761 + pos.length) >>> 0) % 1000 / 1000;
        if (sp.bark === 'banded') tmp.multiplyScalar(Math.floor(cy / (H * .05)) % 2 ? .8 : 1.08);
        else if (sp.bark === 'pale') { tmp.lerp(PALE, .7); if (hsh < .18) tmp.multiplyScalar(.45); }
        else tmp.multiplyScalar(.78 + hsh * .38);
      }
      for (let k = i; k < i + 9 && k < P.length; k += 3) { pos.push(P[k], P[k + 1], P[k + 2]); nor.push(N[k], N[k + 1], N[k + 2]); col.push(tmp.r, tmp.g, tmp.b); }
    }''')
open(p, 'w').write(s)
print('ok')
