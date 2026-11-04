// What a civilization builds beyond its own world, drawn for the whole system so it is
// seen from the surface, from orbit and from the other worlds alike (system-view.js):
//
//   traffic        any civilization with colonies (extent 'system'): ship lights crossing
//                  between its home world and each colony, slowing as they arrive
//   system-shapers an orbital ring around the home world, passing over the capital, joined
//                  to the ground by elevators with climbers riding up and down; habitats
//                  (spinning cylinders with lit window bands) circling every giant; and a
//                  swarm of mirrors circling the star in a few tilted rings
//
// Everything is cheap: a handful of meshes, the mirror rings turn as whole groups, and
// the traffic is one Points object. THREE is passed in.
import { civilizationsIn, colonistOf } from './civilizations.mjs';
import { networkFor } from './settlements.mjs';
import { terrainFor } from './terrain.mjs';
import { shipDesign } from './ships.js';
import { rng } from './rng.mjs';

const ease = (x) => x * x * (3 - 2 * x);

export function buildMegastructures(THREE, system, worlds, group) {
  const parts = [], updates = [], disposables = [];
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const track = (o) => { o.traverse?.(c => { if (c.geometry) disposables.push(c.geometry); if (c.material) disposables.push(c.material); c.frustumCulled = false; }); return o; };
  const lit = (opts = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .5, metalness: .2, ...opts });
  const glowing = () => new THREE.MeshBasicMaterial({ vertexColors: true });
  // Merges geometry pieces with a colour each into one geometry.
  const merged = () => {
    const pos = [], nor = [], col = [], c = new THREE.Color();
    return {
      add(g, m, colour) {
        const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(m || new THREE.Matrix4()); c.set(colour);
        const P = geo.attributes.position, N = geo.attributes.normal;
        for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
        geo.dispose(); if (geo !== g) g.dispose();
      },
      count: () => pos.length,
      geometry() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        return geo;
      },
    };
  };
  const M = (pos, quat, s = 1) => new THREE.Matrix4().compose(pos || V(), quat || new THREE.Quaternion(), V(s, s, s));
  const lanes = [];

  for (const civ of civilizationsIn(system)) {
    if (civ.extent !== 'system') continue;
    const home = system.bodies.find(b => b.id === civ.home), homeWorld = worlds.get(home.id);
    const design = shipDesign(civ), r = rng(civ.seed ?? 1, 'megastructures');
    const glowC = design.glow, hullC = design.hullColour, trimC = design.trim;
    const colonies = system.bodies.filter(b => colonistOf(system, b)?.id === civ.id);
    const giants = civ.tier === 'system-shapers' ? system.bodies.filter(b => b.giant) : [];
    for (const b of [...colonies, ...giants]) lanes.push({ a: home.id, b: b.id, ships: civ.tier === 'system-shapers' ? 3 : 2, colour: glowC, phase: r() });
    if (civ.tier !== 'system-shapers' || !homeWorld) continue;

    // --- The orbital ring and its elevators ---------------------------------
    const R = home.radius, terrain = terrainFor(home), net = networkFor(home, civ, terrain, {});
    const cap = net.capital ? V(...net.settlements[0].n) : V(0, 0, 1);
    // Its plane passes over the capital and is as near the equator as that allows.
    const axis = V(0, 1, 0).addScaledVector(cap, -cap.y); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0).addScaledVector(cap, -cap.x); axis.normalize();
    const RR = R * 1.3, width = Math.max(12, R * .035), tilt = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), axis);
    const ring = merged(), ringGlow = merged();
    ring.add(new THREE.CylinderGeometry(RR, RR, width, 192, 1, true), null, hullC);
    ring.add(new THREE.CylinderGeometry(RR - 3, RR - 3, width * .8, 192, 1, true), null, trimC);
    for (const y of [-1, 1]) ring.add(new THREE.TorusGeometry(RR - 1.5, 1.6, 4, 192).rotateX(Math.PI / 2), M(V(0, y * width / 2, 0)), trimC);
    for (const y of [-.22, .22]) for (const rr of [RR + .3, RR - 3.3]) ringGlow.add(new THREE.TorusGeometry(rr, .45, 3, 192).rotateX(Math.PI / 2), M(V(0, y * width, 0)), '#ffd98a'); // windows, outside and in
    // Stations along it, a lit one where each elevator arrives.
    const stops = [0, 1, 2].map(i => cap.clone().applyAxisAngle(axis, (i - 1) * 2.094 + (net.capital ? net.settlements[0].radius * 1.4 / R : 0)));
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, p = V(Math.cos(a) * RR, 0, Math.sin(a) * RR), q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(Math.cos(a), 0, Math.sin(a)));
      ring.add(new THREE.BoxGeometry(width * 1.8, width * 1.5, width * 1.3), M(p, q), i % 3 ? hullC : trimC);
      ringGlow.add(new THREE.BoxGeometry(width * 1.85, width * .18, width * 1.35), M(p, q), glowC);
    }
    const ringGroup = new THREE.Group(); ringGroup.quaternion.copy(tilt);
    ringGroup.add(new THREE.Mesh(ring.geometry(), lit({ side: THREE.DoubleSide, emissive: new THREE.Color(hullC).multiplyScalar(.22) })), new THREE.Mesh(ringGlow.geometry(), glowing()));
    homeWorld.group.add(track(ringGroup)); parts.push(ringGroup);

    // Elevators: a tether from an anchor tower up to the ring, two climbers on each.
    const lift = merged(), liftGlow = merged(), climbers = [];
    for (const n of stops) {
      const ground = R + terrain.surface(n) - 2, q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n), len = RR - ground;
      lift.add(new THREE.CylinderGeometry(9, 15, 26, 8).translate(0, 13, 0), M(n.clone().multiplyScalar(ground), q), hullC);
      lift.add(new THREE.CylinderGeometry(4, 9, 14, 8).translate(0, 33, 0), M(n.clone().multiplyScalar(ground), q), trimC);
      lift.add(new THREE.CylinderGeometry(.9, .9, len, 6).translate(0, len / 2, 0), M(n.clone().multiplyScalar(ground), q), '#c9ced2');
      for (let y = 60; y < len - 20; y += 45) liftGlow.add(new THREE.SphereGeometry(1.4, 6, 4), M(n.clone().multiplyScalar(ground + y), q), '#ff5a5a');
      liftGlow.add(new THREE.TorusGeometry(10, .8, 3, 16).rotateX(Math.PI / 2), M(n.clone().multiplyScalar(ground + 24), q), glowC);
      for (let k = 0; k < 2; k++) climbers.push({ n, q, from: ground + 40, to: RR - width, phase: k * .5 + r() * .2, period: 70 + r() * 20 });
    }
    homeWorld.group.add(track(new THREE.Mesh(lift.geometry(), lit())), track(new THREE.Mesh(liftGlow.geometry(), glowing())));
    const cg = merged();
    cg.add(new THREE.CylinderGeometry(4, 4, 9, 8), null, hullC);
    cg.add(new THREE.CylinderGeometry(4.15, 4.15, 1.4, 8), null, glowC);
    const cars = track(new THREE.InstancedMesh(cg.geometry(), lit({ emissive: new THREE.Color(glowC).multiplyScalar(.15) }), climbers.length));
    homeWorld.group.add(cars);
    const cm = new THREE.Matrix4();
    updates.push((t) => {
      climbers.forEach((c, i) => {
        const x = ((t / c.period + c.phase) % 1), e = ease(x < .5 ? x * 2 : 2 - x * 2); // up, pause-free, back down
        cars.setMatrixAt(i, cm.compose(c.n.clone().multiplyScalar(c.from + (c.to - c.from) * e), c.q, V(1, 1, 1)));
      });
      cars.instanceMatrix.needsUpdate = true;
    });

    // --- Habitats around the giants ------------------------------------------
    for (const g of giants) {
      const world = worlds.get(g.id); if (!world) continue;
      const hab = merged(), habGlow = merged(), L = 150, Rh = 34;
      hab.add(new THREE.CylinderGeometry(Rh, Rh, L, 16), null, hullC);
      for (const y of [-1, 1]) {
        hab.add(new THREE.CylinderGeometry(Rh * .5, Rh * 1.02, 10, 16).translate(0, y * (L / 2 + 5), 0), null, trimC);
        hab.add(new THREE.BoxGeometry(Rh * 4.4, 1.2, 18), M(V(0, y * (L / 2 - 20), 0)), '#1b2a52');
      }
      for (let i = 0; i < 3; i++) { const a = i * 2.094; habGlow.add(new THREE.BoxGeometry(8, L * .86, .6), M(V(Math.cos(a) * (Rh + .2), 0, Math.sin(a) * (Rh + .2)), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2 - a)), '#ffd98a'); }
      const geo = hab.geometry(), glowGeo = habGlow.geometry();
      for (let k = 0; k < 2; k++) {
        const o = new THREE.Group(); o.add(new THREE.Mesh(geo, lit()), new THREE.Mesh(glowGeo, glowing()));
        const orbitAxis = V(r() - .5, 1.6, r() - .5).normalize(), start = V(1, 0, 0).addScaledVector(orbitAxis, -orbitAxis.x).normalize(), rad = g.radius * (1.5 + k * .22), speed = .01 / (1 + k * .3), ph = k * Math.PI + r();
        world.group.add(track(o));
        updates.push((t) => {
          o.position.copy(start).applyAxisAngle(orbitAxis, t * speed + ph).multiplyScalar(rad);
          o.quaternion.setFromUnitVectors(V(0, 1, 0), orbitAxis); o.rotateY(t * .05);
        });
      }
    }

    // --- Mirrors circling the star ----------------------------------------------
    // A swarm of hexagonal collectors in a few tilted bands, each band a thick, uneven
    // ribbon rather than a single file. Each mirror is angled to throw starlight toward
    // the home world, so seen from there (or along a beam) the swarm glitters; from
    // elsewhere it shows its dark, lit-windowed backs. Larger focus stations gather the
    // light and send it home as faint beams. Bands turn as whole groups: no per-mirror work.
    const star = system.star.radius, inner = Math.min(...system.bodies.filter(b => !b.parent).map(b => b.orbit - b.radius * 2));
    const swarm = new THREE.Group(), homeAt = new THREE.Vector3(), starAt = new THREE.Vector3();
    const hex = new THREE.CircleGeometry(1, 6), seedAttr = (n) => new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: n }, () => r())), 1);
    const mirrorMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { starPos: { value: starAt }, homePos: { value: homeAt }, time: { value: 0 }, gold: { value: new THREE.Color('#ffd27a') }, back: { value: new THREE.Color(hullC).lerp(new THREE.Color('#8a94a0'), .5).multiplyScalar(.5) }, glow: { value: new THREE.Color(glowC) } },
      vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute float seed; varying vec3 vWorld; varying vec3 vNormal; varying float vSeed; varying vec2 vUv;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = w.xyz; vNormal = normalize(mat3(modelMatrix * instanceMatrix) * vec3(0.0, 0.0, 1.0)); vSeed = seed; vUv = position.xy;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`,
      fragmentShader: `#include <logdepthbuf_pars_fragment>
uniform vec3 starPos, homePos, gold, back, glow; uniform float time;
varying vec3 vWorld; varying vec3 vNormal; varying float vSeed; varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  vec3 toStar = normalize(starPos - vWorld), toHome = normalize(homePos - vWorld), toCam = normalize(cameraPosition - vWorld);
  vec3 n = normalize(toStar + toHome);                       // tipped to send the light home
  float facing = dot(normalize(vNormal), toCam) * sign(dot(normalize(vNormal), toStar)); // > 0: we see the mirror side
  float glint = pow(max(dot(reflect(-toStar, n), toCam), 0.0), 18.0);
  float twinkle = 0.75 + 0.25 * sin(time * (0.6 + vSeed) + vSeed * 40.0);
  float r = length(vUv), frame = smoothstep(0.84, 0.9, r);    // a darker frame round each hex
  vec3 mirror = gold * (0.35 + 1.6 * glint * twinkle) * (1.0 - 0.6 * frame);
  float rim = pow(1.0 - abs(dot(normalize(vNormal), toCam)), 3.0);  // starlight catching the edges
  vec3 rear = back * (0.6 + 0.4 * frame) + gold * rim * 0.5 + glow * step(0.93, fract(vSeed * 13.0)) * smoothstep(0.25, 0.0, r);  // a few lit service lights
  gl_FragColor = vec4(facing > 0.0 ? mirror : rear, 1.0);
}`,
    });
    disposables.push(hex, mirrorMat);
    const focusGeo = merged();
    focusGeo.add(new THREE.CylinderGeometry(1, 1, .5, 6).rotateX(Math.PI / 2), null, hullC);
    focusGeo.add(new THREE.TorusGeometry(1.6, .14, 4, 18), null, trimC);
    focusGeo.add(new THREE.ConeGeometry(.6, 1.6, 6).rotateX(-Math.PI / 2).translate(0, 0, 1), null, '#d7dde1');
    const focusMesh = focusGeo.geometry(), focusMat = lit({ emissive: new THREE.Color(glowC).multiplyScalar(.35) });
    disposables.push(focusMesh, focusMat);
    const bands = [], focus = [];
    for (let k = 0; k < 4; k++) {
      const n = 520, rad = Math.min(star * (1.85 + k * .24), inner * (.48 + k * .045)), thick = rad * .035;
      const band = new THREE.InstancedMesh(hex, mirrorMat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < n; i++) {
        // Clumped along the band (shoals of mirrors with gaps), spread across it and a little above and below.
        const a = (i + (r() - .5) * 2.2) / n * Math.PI * 2 + Math.sin(i * .21 + k) * .06, rr = rad + (r() + r() - 1) * thick * 2, p = V(Math.cos(a) * rr, (r() + r() - 1) * thick * .6, Math.sin(a) * rr);
        q.setFromUnitVectors(V(0, 0, 1), p.clone().normalize().negate());
        const size = star * (.011 + r() * r() * .026);
        band.setMatrixAt(i, m.compose(p, q, V(size, size, size)));
      }
      band.geometry = hex.clone(); band.geometry.setAttribute('seed', seedAttr(n)); disposables.push(band.geometry);
      band.frustumCulled = false;
      const holder = new THREE.Group(); holder.rotation.set((r() - .5) * (k === 3 ? 2.6 : .7), r() * 6.28, (r() - .5) * .7); holder.add(band);
      const stations = new THREE.InstancedMesh(focusMesh, focusMat, 3); stations.frustumCulled = false; holder.add(stations);
      for (let j = 0; j < 3; j++) { const a = j * 2.094 + r(), p = V(Math.cos(a) * rad, 0, Math.sin(a) * rad); focus.push({ band, p, i: j, stations }); }
      bands.push({ band, stations, spin: (.003 + r() * .003) * (k % 2 ? -1 : 1), holder });
      swarm.add(holder);
    }
    // Beams: from each focus station to the home world, faint and fading out toward it.
    const beamPos = new Float32Array(focus.length * 6), beamCol = new Float32Array(focus.length * 6), bc = new THREE.Color(glowC).lerp(new THREE.Color('#ffd27a'), .5);
    focus.forEach((f, i) => { beamCol.set([bc.r * .9, bc.g * .9, bc.b * .9, bc.r * .12, bc.g * .12, bc.b * .12], i * 6); });
    const beamGeo = new THREE.BufferGeometry(); beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPos, 3)); beamGeo.setAttribute('color', new THREE.BufferAttribute(beamCol, 3));
    const beams = new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    beams.frustumCulled = false; disposables.push(beamGeo, beams.material);
    group.add(swarm, beams); parts.push(swarm);
    swarm.userData.followStar = true;
    const fm = new THREE.Matrix4(), invS = new THREE.Matrix4(), fq = new THREE.Quaternion(), fp = new THREE.Vector3(), toHome = new THREE.Vector3(), one = V(1, 1, 1);
    updates.push((t) => {
      starAt.copy(swarm.position); homeAt.copy(homeWorld.group.position); mirrorMat.uniforms.time.value = t;
      for (const b of bands) { b.band.rotation.y = b.stations.rotation.y = t * b.spin; }
      swarm.updateMatrixWorld(true);
      group.updateMatrixWorld(); const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
      focus.forEach((f, i) => {
        // Each station's dish points home; its beam runs from it to just short of the world.
        fp.copy(f.p).applyMatrix4(f.stations.matrixWorld).applyMatrix4(inv);
        toHome.copy(homeAt).sub(fp);
        const local = toHome.clone().transformDirection(group.matrixWorld).transformDirection(invS.copy(f.stations.matrixWorld).invert()); // home, as seen in the band's own frame
        fq.setFromUnitVectors(V(0, 0, 1), local);
        f.stations.setMatrixAt(f.i, fm.compose(f.p, fq, one.clone().multiplyScalar(star * .055)));
        f.stations.instanceMatrix.needsUpdate = true;
        const end = homeAt.clone().addScaledVector(toHome.normalize(), -home.radius * 1.6);
        beamPos.set([fp.x, fp.y, fp.z, end.x, end.y, end.z], i * 6);
      });
      beamGeo.attributes.position.needsUpdate = true;
    });
  }

  // --- Traffic between worlds ------------------------------------------------------
  // Each ship is a bright point with a short fading trail; it leaves from just above its
  // world, arcs across and slows to arrive, then starts back.
  let traffic = null;
  if (lanes.length) {
    const TRAIL = 4, ships = lanes.flatMap(l => Array.from({ length: l.ships }, (_, i) => ({ l, phase: (l.phase + i / l.ships) % 1, back: i % 2 === 1 })));
    const n = ships.length * TRAIL, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), c = new THREE.Color();
    ships.forEach((s, i) => { c.set(s.l.colour).lerp(new THREE.Color(1, 1, 1), .35); for (let k = 0; k < TRAIL; k++) { const j = i * TRAIL + k, f = 1 - k / TRAIL; col.set([c.r * f, c.g * f, c.b * f], j * 3); size[j] = k ? 2.4 * f : 3.6; } });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('colour', new THREE.BufferAttribute(col, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 colour; attribute float size; varying vec3 vColour;
void main() {
  vColour = colour;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size;
  #include <logdepthbuf_vertex>
}`,
      fragmentShader: `#include <logdepthbuf_pars_fragment>
varying vec3 vColour;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5; float f = smoothstep(0.5, 0.1, length(c));
  gl_FragColor = vec4(vColour * f, 1.0);
}`,
    });
    traffic = track(new THREE.Points(g, material)); traffic.name = 'interplanetary-traffic';
    group.add(traffic); parts.push(traffic);
    const A = V(), B = V(), d = V(), side = V(), p = V();
    const at = (s, x, out) => {
      const wa = worlds.get(s.back ? s.l.b : s.l.a), wb = worlds.get(s.back ? s.l.a : s.l.b);
      d.copy(wb.group.position).sub(wa.group.position); const dist = d.length(); d.divideScalar(dist || 1);
      const ra = wa.body.radius * 1.9, rb = wb.body.radius * 1.9;
      A.copy(wa.group.position).addScaledVector(d, ra); B.copy(wb.group.position).addScaledVector(d, -rb);
      side.set(0, 1, 0).cross(d).normalize();
      const e = ease(x), bow = Math.sin(Math.PI * e) * dist;
      out.copy(A).lerp(B, e).addScaledVector(side, bow * .07 * (s.back ? -1 : 1));
      out.y += bow * .02;
      return out;
    };
    updates.push((t) => {
      ships.forEach((s, i) => {
        const wa = worlds.get(s.l.a), wb = worlds.get(s.l.b), dist = wa.group.position.distanceTo(wb.group.position), period = 40 + dist / 180;
        const x = ((t / period + s.phase) % 1);
        for (let k = 0; k < TRAIL; k++) { at(s, Math.max(0, x - k * .006), p); pos.set([p.x, p.y, p.z], (i * TRAIL + k) * 3); }
      });
      g.attributes.position.needsUpdate = true;
    });
  }

  return {
    // starPosition: where the star is drawn (the swarm follows it).
    update(t, starPosition) {
      for (const p of parts) if (p.userData.followStar && starPosition) p.position.copy(starPosition);
      for (const u of updates) u(t);
    },
    dispose() { for (const d of disposables) d.dispose?.(); },
  };
}
