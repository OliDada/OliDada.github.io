import sys
p = sys.argv[1] + "/geology-mesh.js"
s = open(p).read()
def rep(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)

rep("""// Builds and places a world's rock and ice formations (geology.mjs) all over the world:
// a couple of each common kind near the landing site, so every landing has something to
// scan, and the rest spread thinly across the whole surface (more on bigger worlds).""",
"""// Builds and places a world's rocks and formations (geology.mjs) all over the world:
// a couple of each rock type and one of each landform near the landing site, so every
// landing has something to scan, and the rest spread thinly across the whole surface
// (more on bigger worlds). Rocks are lumpy, natural outcrops, boulders, rubble and ice.""")
rep("const NEAR = 2; // of each common kind near the site\n", "const NEAR = { rock: 2, formation: 1 }; // of each kind near the site (rare ones: none)\n")
rep("""  return f.rare ? Math.min(8, Math.max(1, n)) : Math.min(60, Math.max(NEAR + 2, n));""",
    """  return f.rare ? Math.min(6, Math.max(1, n)) : f.type === 'rock' ? Math.min(60, Math.max(4, n)) : Math.min(24, Math.max(2, n));""")
rep("want = worldCount(f, radius), nearWant = f.rare ? 0 : NEAR;", "want = worldCount(f, radius), nearWant = f.rare ? 0 : NEAR[f.type] ?? 1;")
rep("roughness: f.shape === 'shards' || f.shape === 'meteorite' ? .35 : .95, metalness: f.shape === 'meteorite' ? .6 : 0 }), want)];",
    "roughness: f.glassy || f.shape === 'meteorite' ? .3 : .95, metalness: f.shape === 'meteorite' ? .6 : f.glassy ? .15 : 0 }), want)];")

# Natural rocks: lumpy shapes from a displaced icosahedron, in the rock type's colours.
rep("""  let foot = 1.5, height = 2;
  switch (f.shape) {""", """  // A lumpy, natural-looking stone: an icosahedron pushed in and out by smooth waves
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
        add(lump(s, 1, r() * 10), M(Math.cos(a) * d, s * .3, Math.sin(a) * d, r() * .5, r() * 6, r() * .5, 1, .65 + r() * .2, 1 + r() * .25), i % 2 ? dark : main);
      }
      foot = 1.9; height = 1.5; break;
    }
    case 'slab': { // a layered outcrop, gently tilted
      const k = f.low ? 2 : 3 + Math.floor(r() * 2), tilt = (r() - .5) * .25;
      for (let i = 0; i < k; i++) {
        const w = (f.low ? 1.9 : 1.7) - i * .28;
        add(lump(w, 1, r() * 10, .14), M((r() - .5) * .4, .15 + i * (f.low ? .22 : .36), (r() - .5) * .4, tilt, r() * .4, tilt * .6, 1, f.low ? .16 : .26, .75), i % 2 ? dark : main);
      }
      foot = 2.1; height = f.low ? .7 : 1.6; break;
    }
    case 'rubble': { // a scatter of broken stones
      const k = 8 + Math.floor(r() * 4);
      for (let i = 0; i < k; i++) {
        const s = (f.low ? .2 : .25) + r() * (f.low ? .3 : .45), a = r() * 6.28, d = Math.sqrt(r()) * 2;
        add(lump(s, 0, r() * 10, .3), M(Math.cos(a) * d, s * .3, Math.sin(a) * d, r() * 3, r() * 6, r() * 3, 1, .7, 1.1), i % 3 ? main : dark);
      }
      foot = 2.2; height = f.low ? .5 : .8; break;
    }
    case 'ice': { // angular chunks of ice, some leaning
      const k = 3 + Math.floor(r() * 3);
      for (let i = 0; i < k; i++) {
        const s = .45 + r() * .5, a = r() * 6.28, d = i ? .6 + r() * 1.1 : 0;
        add(lump(s, 0, r() * 10, .25), M(Math.cos(a) * d, s * .5, Math.sin(a) * d, (r() - .5) * .6, r() * 6, (r() - .5) * .6, 1, 1.3 + r() * 1.1, 1), i % 2 ? dark : main);
      }
      foot = 1.8; height = 2.2; break;
    }""")

# Fewer glowing parts: crystal tips, geode crystals and spring water are lit, not lamps.
rep("add(new THREE.ConeGeometry(w, h * .2, 6).translate(0, h * .82 + h * .1, 0), m, C.crystal, true);",
    "add(new THREE.ConeGeometry(w, h * .2, 6).translate(0, h * .82 + h * .1, 0), m, C.crystal);")
rep("add(new THREE.CylinderGeometry(.9, .9, .04, 12), M(0, 1.62, 0), C.water, true);",
    "add(new THREE.CylinderGeometry(.9, .9, .04, 12), M(0, 1.62, 0), C.water);")
rep("(r() - .5), 0, (r() - .5)), C.crystal, true); }", "(r() - .5), 0, (r() - .5)), C.crystal); }")
open(p, "w").write(s)
print("ok")
