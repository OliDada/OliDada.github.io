// Softened facets: the one surface style shared by rocks, formations, trunks and solid
// plant parts. A low-poly shape keeps its facets (you can still see the planes), but the
// light runs smoothly across them, the way Valheim's rocks and logs look: each normal is
// a blend of its own face's normal and the smooth normal averaged over every face that
// meets at that corner. k: 0 fully faceted, 1 fully smooth.
//
// softenNormals(THREE, geometry, k) works on indexed or non-indexed geometry, in place,
// and returns it. Corners are matched by position, so seams in the geometry (cylinder
// caps, icosahedron faces, which three.js builds unshared) are smoothed over too, while
// corners sharper than `crease` degrees (a cylinder's rim) stay crisp.
export function softenNormals(THREE, g, k = .55, crease = 70) {
  if (!g.attributes.normal) g.computeVertexNormals();
  const P = g.attributes.position, idx = g.index, n = idx ? idx.count : P.count;
  if (!n) return g;
  // Face normals (area weighted), per triangle.
  const at = (i) => (idx ? idx.getX(i) : i);
  const faces = new Float32Array(n), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < n; t += 3) {
    a.fromBufferAttribute(P, at(t)); b.fromBufferAttribute(P, at(t + 1)); c.fromBufferAttribute(P, at(t + 2));
    c.sub(b); b.sub(a); c.cross(b).negate(); // (b - a) x (c - b), the same winding three.js uses
    faces[t] = c.x; faces[t + 1] = c.y; faces[t + 2] = c.z;
  }
  // Sum them at each position.
  const q = (v) => Math.round(v * 1e4);
  const key = (i) => `${q(P.getX(i))},${q(P.getY(i))},${q(P.getZ(i))}`;
  const sums = new Map();
  for (let t = 0; t < n; t += 3) for (let j = 0; j < 3; j++) {
    const kk = key(at(t + j));
    let s = sums.get(kk);
    if (!s) sums.set(kk, s = []);
    s.push(t);
  }
  const cosCrease = Math.cos(crease * Math.PI / 180), out = new Float32Array(P.count * 3), fn = new THREE.Vector3(), sm = new THREE.Vector3(), o = new THREE.Vector3();
  for (let t = 0; t < n; t += 3) {
    fn.set(faces[t], faces[t + 1], faces[t + 2]);
    const len = fn.length();
    if (len < 1e-12) continue;
    fn.divideScalar(len);
    for (let j = 0; j < 3; j++) {
      const v = at(t + j);
      sm.set(0, 0, 0);
      for (const f of sums.get(key(v))) {
        o.set(faces[f], faces[f + 1], faces[f + 2]);
        const l = o.length();
        if (l < 1e-12 || o.dot(fn) / l < cosCrease) continue; // across a crease: not smoothed over
        sm.add(o);
      }
      sm.normalize();
      o.copy(fn).lerp(sm, k).normalize();
      out[v * 3] = o.x; out[v * 3 + 1] = o.y; out[v * 3 + 2] = o.z;
    }
  }
  // (Indexed geometry: a corner shared by several faces takes the last face's blend, close
  // enough since they all lean toward the same smooth normal; non-indexed is exact.)
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out, 3));
  return g;
}
