// The Concord (council.mjs), built: at its heart a captive light in turning rings; round
// it a great plated ring, three kilometres across, on six spokes; along the ring an embassy
// tower for each member people, in their own colours and lit with their own glow, a banner
// of light above it and one of their ships berthed beside it; a spire through the middle
// with a beacon at each end; and their ships circling. THREE is passed in.
import { buildShip, shipDesign } from './ships.js';
import { addHullFeel } from './hull-feel.js';

export function buildCouncil(THREE, members) {
  const group = new THREE.Group(), V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz)).clone(), V(s, s, s));
  const lit = merged(THREE), glow = merged(THREE), plain = merged(THREE);
  const R = 1500, tube = 90, white = '#d9dde2', steel = '#8a929b', dark = '#2a3038', gold = '#ffd98a';
  // The ring, its spokes, the light at its heart.
  lit.add(new THREE.TorusGeometry(R, tube, 24, 160), null, white);
  glow.add(new THREE.TorusGeometry(R, tube * 1.004, 4, 200).scale(1, 1, .08), null, gold);
  glow.add(new THREE.TorusGeometry(R - tube * .98, 4, 3, 200), null, '#9fe3ff');
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; plain.add(new THREE.CylinderGeometry(22, 30, R - 380, 10).rotateZ(Math.PI / 2).translate((R + 380) / 2, 0, 0), L(0, 0, 0, 0, 0, a), steel); }
  plain.add(new THREE.TorusGeometry(380, 40, 12, 64), null, steel);
  // The spire through the middle, a beacon at each end.
  plain.add(new THREE.CylinderGeometry(18, 60, 3600, 12).translate(0, 1800, 0).rotateX(Math.PI / 2), null, steel);
  plain.add(new THREE.CylinderGeometry(60, 14, 2200, 12).translate(0, -1100, 0).rotateX(Math.PI / 2), null, steel);
  for (const z of [3600, -2200]) glow.add(new THREE.SphereGeometry(40, 12, 8), L(0, 0, z), gold);
  for (let z = -2000; z < 3500; z += 260) if (Math.abs(z) > 400) glow.add(new THREE.TorusGeometry(z > 0 ? 60 - z / 80 : 60 + z / 60, 3, 3, 24), L(0, 0, z), '#9fe3ff');
  // Embassies: a tower for each people, in their colours, a banner of light, their ship beside.
  const ships = [];
  members.forEach((m, i) => {
    const d = shipDesign(m.civ), a = i / Math.max(1, members.length) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const h = 260 + ((i * 97) % 5) * 90, w = 110 + ((i * 53) % 3) * 30, base = V(c * R, s * R, tube * .6);
    const m4 = new THREE.Matrix4().makeRotationZ(a), pos = (x, y, z) => V(x, y, z).applyMatrix4(m4).add(base);
    const put = (geo, p, colour, buf = lit) => { geo.applyMatrix4(m4); geo.translate(p.x, p.y, p.z); buf.add(geo, null, colour); };
    const sides = 4 + (i % 3) * 2; // each people's tower its own shape: tapering, ringed with their light
    put(new THREE.CylinderGeometry(w * .32, w * .55, h, sides).rotateX(Math.PI / 2).translate(0, 0, h / 2), base, d.hullColour);
    put(new THREE.CylinderGeometry(w * .62, w * .7, 30, sides).rotateX(Math.PI / 2).translate(0, 0, 15), base, d.trim);
    for (const f of [.3, .55, .8]) put(new THREE.CylinderGeometry(w * (.55 - f * .23) + 2, w * (.55 - f * .23) + 2, 6, sides, 1, true).rotateX(Math.PI / 2).translate(0, 0, h * f), base, d.glow, glow);
    put(new THREE.ConeGeometry(w * .32, 90, sides).rotateX(Math.PI / 2).translate(0, 0, h + 45), base, d.trim);
    put(new THREE.CylinderGeometry(3, 3, 160, 4).rotateX(Math.PI / 2).translate(0, 0, h + 170), base, '#c9ced2', plain);
    put(new THREE.SphereGeometry(9, 8, 6).translate(0, 0, h + 252), base, d.glow, glow);
    put(new THREE.PlaneGeometry(60, 140).rotateX(Math.PI / 2).translate(34, 0, h + 170), base, d.glow, glow); // the banner
    // Their ship, berthed off the outer face of the ring.
    const sg = new THREE.Group(); buildShip(THREE, d, (g, mm, colour, bright) => { const mesh = new THREE.Mesh(g, bright ? new THREE.MeshBasicMaterial({ color: colour }) : new THREE.MeshStandardMaterial({ color: colour, flatShading: true, roughness: .5, metalness: .3 })); mesh.applyMatrix4(mm); sg.add(mesh); }, new THREE.Matrix4(), 9);
    sg.position.copy(pos(R * 0 + tube + 220, 0, 60)).sub(base).add(base); sg.position.copy(V(c * (R + tube + 240), s * (R + tube + 240), 80));
    sg.lookAt(V(c * (R + 2000), s * (R + 2000), 80)); group.add(sg); ships.push({ g: sg, a, r: R + tube + 240, z: 80, i, circling: i % 3 === 0 });
  });
  // The light at the heart: a captive sun in turning rings.
  const heart = new THREE.Group(); group.add(heart);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(240, 40, 24), new THREE.MeshBasicMaterial({ color: '#fff3d6' })); heart.add(lamp);
  const rings = [];
  for (let k = 0; k < 3; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(300 + k * 45, 6, 6, 96), new THREE.MeshBasicMaterial({ color: k === 1 ? '#9fe3ff' : gold })); heart.add(ring); rings.push(ring); }
  const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 128; { const g = haloCanvas.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloCanvas), color: '#ffe8b0', transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.set(1400, 1400, 1); heart.add(halo);
  const mat = addHullFeel(THREE, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .45, metalness: .3 }), { plate: 30, windows: 1.8, window: 6 });
  for (const [buf, m] of [[lit, mat], [glow, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })], [plain, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .5, metalness: .4 })]]) {
    if (!buf.count()) continue; const mesh = new THREE.Mesh(buf.geometry(), m); group.add(mesh);
  }
  group.traverse((o) => (o.frustumCulled = false));
  const beacon = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)), new THREE.PointsMaterial({ color: gold, size: 7, sizeAttenuation: false, depthWrite: false }));
  group.add(beacon);
  // Collision: the ring, the hub, the lamp, the spire.
  const solids = [{ torus: R, r: tube + 10 }, { a: V(0, 0, -2200), b: V(0, 0, 3600), r: 70 }, { a: V(), b: V(), r: 420 }];
  return {
    group, solids, size: 3800,
    update(t) {
      rings.forEach((rg, k) => { rg.rotation.x = t * (.1 + k * .04); rg.rotation.y = t * (.07 - k * .03); });
      lamp.scale.setScalar(1 + Math.sin(t * .8) * .02);
      for (const s of ships) if (s.circling) { const a = s.a + t * .02; s.g.position.set(Math.cos(a) * (s.r + 300), Math.sin(a) * (s.r + 300), 300 + Math.sin(t * .3 + s.i) * 80); s.g.lookAt(Math.cos(a + .05) * (s.r + 300), Math.sin(a + .05) * (s.r + 300), s.g.position.z); }
    },
    dispose() { group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); },
  };
}

function merged(THREE) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  return {
    add(g, m, colour) { const geo = (g.index ? g.toNonIndexed() : g); if (m) geo.applyMatrix4(m); c.set(colour); const P = geo.attributes.position, N = geo.attributes.normal; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); } },
    count: () => pos.length,
    geometry() { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return geo; },
  };
}
