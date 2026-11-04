import sys
p = sys.argv[1]
s = open(p).read()

def between(a, b):
    i = s.index(a); j = s.index(b, i)
    return i, j

helpers = '''  const leaf = (i) => (i % 2 ? c.leaf2 : c.leaf);
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
    for (let i = 0; i < P.count; i++) { const t = P.getY(i) / len; P.setX(i, P.getX(i) * Math.pow(1 - t, .8)); P.setZ(i, P.getZ(i) + bend * len * t * t); P.setY(i, P.getY(i) * (1 - bend * .25 * t)); }
    g.computeVertexNormals(); return g;
  };
'''
a = "  const leaf = (i) => (i % 2 ? c.leaf2 : c.leaf);\n"
assert s.count(a) == 1
s = s.replace(a, helpers)

new = {}
new['tree'] = '''  if (sp.form === 'tree') {
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
      for (let b = 0; b < 3; b++) { const a = r() * 6.28, d = rad * (.75 + r() * .25); add(blob(rad * (.3 + r() * .15), 0), M(x + Math.cos(a) * d * leafScale[0], y + (r() - .3) * rad * leafScale[1], z + Math.sin(a) * d * leafScale[2], 0, r() * 6, 0, ...leafScale), leaf(i + b + 1), true); }
      if (sp.arms > 1 || i === 0) for (let b = 0; b < 2; b++) { const a = r() * 6.28; add(blob(H * .025, 0), M(x + Math.cos(a) * rad * .9 * leafScale[0], y - rad * .2, z + Math.sin(a) * rad * .9 * leafScale[2]), c.accent, true); }
    });
'''
new['conifer'] = '''  } else if (sp.form === 'conifer') {
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
'''
new['palm'] = '''  } else if (sp.form === 'palm') {
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
      add(blade(len, len * .26, .35 + r() * .35, .45, 5), new THREE.Matrix4().makeTranslation(x, y, 0).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(rise)), leaf(i), true);
    }
    for (let i = 0; i < 2; i++) { const a = i * 3 + r(); add(blade(len * .5, len * .18, -.2, .4, 3), new THREE.Matrix4().makeTranslation(x, y + H * .02, 0).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(1.1)), c.leaf, true); }
    for (let i = 0; i < 5; i++) add(blob(H * .035), M(x + (r() - .5) * tr * 3, y - H * .04 - r() * H * .03, (r() - .5) * tr * 3), c.accent, true);
'''
new['shrub'] = '''  } else if (sp.form === 'shrub') {
    // Several stems, a mounded crown broken into clumps, twigs poking out, and blossom or berries.
    for (let i = 0; i < 3; i++) { const a = i * 2.09 + r(); add(cyl(H * .025, H * .045, H * .45, 4), M(Math.cos(a) * H * .06, 0, Math.sin(a) * H * .06, 0, -a, .25), c.stem, false); }
    const blobs = 4 + (sp.seed % 3);
    for (let i = 0; i < blobs; i++) { const a = i / blobs * Math.PI * 2, d = H * .28; add(blob(H * .32 * sp.leafSize, 1), M(Math.cos(a) * d, H * (.4 + r() * .2), Math.sin(a) * d, 0, r() * 6, 0, ...leafScale), leaf(i), true); }
    add(blob(H * .34 * sp.leafSize, 1), M(0, H * .7, 0, 0, 0, 0, ...leafScale), c.leaf, true);
    for (let i = 0; i < 6; i++) { const a = r() * 6.28; add(blob(H * .13 * sp.leafSize, 0), M(Math.cos(a) * H * .5, H * (.25 + r() * .5), Math.sin(a) * H * .5, 0, r() * 6, 0), leaf(i + 1), true); }
    for (let i = 0; i < 5; i++) { const a = r() * 6.28, m = M(Math.cos(a) * H * .3, H * (.5 + r() * .3), Math.sin(a) * H * .3, 0, -a, -1 - r() * .4); add(cyl(H * .006, H * .012, H * .3, 3), m, c.stem, false); }
    const n = sp.arms > 1 ? 9 : 4;
    for (let i = 0; i < n; i++) { const a = r() * 6.28, d = H * (.42 + r() * .12), y = H * (.45 + r() * .4); add(blob(H * (sp.arms > 1 ? .055 : .035), 0), M(Math.cos(a) * d, y, Math.sin(a) * d), c.accent, true); }
'''
new['grass'] = '''  } else if (sp.form === 'grass') {
    // Arching flat blades in a clump, a few bearing seed heads.
    const blades = 8 + (sp.seed % 5);
    for (let i = 0; i < blades; i++) {
      const a = i / blades * Math.PI * 2 + r(), h = H * (.7 + r() * .4), bend = .15 + r() * .35;
      add(spear(h, H * .09, bend, 3), M(Math.cos(a) * H * .07, 0, Math.sin(a) * H * .07, 0, a + Math.PI / 2, 0), leaf(i), true);
    }
    for (let i = 0; i < 3; i++) { const a = r() * 6.28, h = H * (1 + r() * .3), tilt = .1 + r() * .2; const m = M(Math.cos(a) * H * .05, 0, Math.sin(a) * H * .05, 0, a, tilt); add(cyl(H * .008, H * .012, h, 3), m, c.leaf2, true); add(blob(H * .04, 0), m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, h, 0), new THREE.Quaternion(), new THREE.Vector3(1, 2.4, 1))), c.accent, true); }
    add(cyl(H * .08, H * .1, H * .05, 5), M(), c.stem, false);
'''
new['succulent'] = '''  } else if (sp.form === 'succulent') {
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
'''
new['fungus'] = '''  } else if (sp.form === 'fungus') {
    // Caps with gills beneath and spots on top, a ring on the stem and a bulbous foot.
    const caps = 1 + (sp.seed % 3);
    for (let i = 0; i < caps; i++) {
      const h = H * (i ? .45 + r() * .3 : 1), sr = h * .07, cr = h * (.32 + r() * .12) * sp.leafSize, x = i ? (r() - .5) * H * .7 : 0, z = i ? (r() - .5) * H * .7 : 0, flat = sp.leafShape === 'column' ? .8 : .42;
      add(blob(sr * 1.8, 0), M(x, sr * .6, z, 0, 0, 0, 1, .7, 1), c.stem, false);
      add(cyl(sr * .8, sr * 1.3, h, 7), M(x, 0, z), c.stem, false);
      add(new THREE.CylinderGeometry(sr * 2, sr * 1.1, h * .05, 8, 1, true), M(x, h * .72, z), c.stem, false);
      add(new THREE.ConeGeometry(cr * .95, cr * flat * .9, 12, 1, true).rotateX(Math.PI).translate(0, cr * flat * .45, 0), M(x, h - cr * flat * .5, z), c.stem, false);
      add(blob(cr, 1), M(x, h, z, 0, 0, 0, 1, flat, 1), i % 2 ? c.accent : c.leaf, true);
      for (let j = 0; j < 6; j++) { const a = r() * 6.28, d = cr * (.2 + r() * .55); add(blob(cr * (.07 + r() * .06), 0), M(x + Math.cos(a) * d, h + cr * flat * Math.sqrt(Math.max(0, 1 - (d / cr) ** 2)) * .97, z + Math.sin(a) * d, 0, 0, 0, 1, .4, 1), i % 2 ? c.leaf : c.accent, true); }
    }
'''
new['stalk'] = '''  } else if (sp.form === 'stalk') {
    // A jointed stalk with leaves at the nodes, a basal rosette and a crown of pods.
    add(cyl(H * .018, H * .03, H, 5), M(), c.stem, false);
    for (let j = 1; j < 4; j++) { const y = H * j * .2; add(cyl(H * .026, H * .026, H * .02, 5), M(0, y, 0), c.leaf2, false); add(blade(H * .2, H * .05, .4, .3, 3), M(0, y, 0, 0, j * 2.3, .5), c.leaf, true); }
    const pods = 2 + sp.segments % 4;
    for (let i = 0; i < pods; i++) {
      const y = H * (.55 + .45 * i / pods), a = r() * 6.28, d = i === pods - 1 ? 0 : H * .06;
      add(blob(H * (.05 + r() * .05), 1), M(Math.cos(a) * d, y, Math.sin(a) * d, 0, 0, 0, 1, 1.3, 1), c.accent, true);
    }
    for (let i = 0; i < 6; i++) add(blade(H * .18, H * .06, .5, .3, 3), M(0, H * .01, 0, 0, i * 1.05 + r() * .3, .2), leaf(i), true);
'''
new['mound'] = '''  } else if (sp.form === 'mound') {
    // A layered cushion studded with smaller buds and a few flowers.
    const layers = 2 + sp.segments % 3;
    for (let i = 0; i < layers; i++) { const rad = H * (.75 - i * .15); add(blob(rad, 1), M((r() - .5) * .2, H * .25 * i, (r() - .5) * .2, 0, r() * 6, 0, 1, .55, 1), c.leaf2, false); }
    add(blob(H * .3, 1), M(0, H * .25 * layers + H * .05, 0, 0, 0, 0, 1, .5, 1), c.leaf, true);
    for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = H * (.3 + r() * .4); add(blob(H * (.08 + r() * .06), 0), M(Math.cos(a) * d, H * (.15 + r() * .3), Math.sin(a) * d, 0, r() * 6, 0, 1, .7, 1), i % 3 ? c.leaf : c.accent, true); }
'''

order = ['tree', 'conifer', 'palm', 'shrub', 'grass', 'succulent', 'fungus', 'stalk', 'mound']
starts = {'tree': "  if (sp.form === 'tree') {", 'conifer': "  } else if (sp.form === 'conifer') {", 'palm': "  } else if (sp.form === 'palm') {", 'shrub': "  } else if (sp.form === 'shrub') {", 'grass': "  } else if (sp.form === 'grass') {", 'succulent': "  } else if (sp.form === 'succulent') {", 'fungus': "  } else if (sp.form === 'fungus') {", 'stalk': "  } else if (sp.form === 'stalk') {", 'mound': "  } else if (sp.form === 'mound') {"}
nexts = {'tree': starts['conifer'], 'conifer': starts['palm'], 'palm': starts['shrub'], 'shrub': starts['grass'], 'grass': starts['succulent'], 'succulent': starts['fungus'], 'fungus': starts['stalk'], 'stalk': "  } else if (sp.form === 'mat') {", 'mound': "  } else if (sp.form === 'crystal') {"}
for k in order:
    i = s.index(starts[k]); j = s.index(nexts[k], i)
    s = s[:i] + new[k] + s[j:]
open(p, 'w').write(s)
print('ok')
