// What a civilization builds beyond its own world, drawn for the whole system so it is
// seen from the surface, from orbit and from the other worlds alike (system-view.js):
//
//   traffic        any civilization with colonies (extent 'system'): ship lights crossing
//                  between its home world and each colony, slowing as they arrive
//   system-shapers a home world built over from coast to coast (a world-city), an orbital ring around it, passing over the capital, joined
//                  to the ground by elevators with climbers riding up and down; habitats
//                  (spinning cylinders with lit window bands) circling every giant; and a
//                  swarm of mirrors circling the star in a few tilted rings
//
// Everything is cheap: a handful of meshes, the mirror rings turn as whole groups, and
// the traffic is one Points object. THREE is passed in.
import { addHullFeel } from './hull-feel.js';
import { SIZE } from './scale.mjs';
import { civilizationsIn, colonistOf } from './civilizations.mjs';
import { networkFor } from './settlements.mjs';
import { terrainFor } from './terrain.mjs';
import { shipDesign, buildShip } from './ships.js';
import { rng } from './rng.mjs';
import { nightPoints } from './city-lights.js';
import { buildMegastation } from './megastation.js';
import { colours } from './structures-mesh.js';
import { architectureOf } from './alien-arch.mjs';
import { farProtos, sizeOf } from './alien-build.js';
import { floorH } from './town-plan.mjs';

const ease = (x) => x * x * (3 - 2 * x);

// sun: { value } the star's position in the world (shared with city-lights.js).
export function buildMegastructures(THREE, system, worlds, group, sun = null) {
  const parts = [], updates = [], disposables = [];
  let cityLod = null; // the world-city's level of detail, as the camera moves (below)
  const lastStar = new THREE.Vector3(); // where the star is drawn (update)
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const track = (o) => { o.traverse?.(c => { if (c.geometry) disposables.push(c.geometry); if (c.material) disposables.push(c.material); c.frustumCulled = false; }); return o; };
  const lit = (opts = {}) => addHullFeel(THREE, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .5, metalness: .2, ...opts }), { plate: 40 });
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
  // Things a ship bumps into out in the system (bump() below): each takes a world point and
  // the ship's radius and returns a push out of it, or null.
  const colliders = [], cA = new THREE.Vector3(), cB = new THREE.Vector3(), cL = new THREE.Vector3(), cS = new THREE.Vector3();
  // Shapes in an object's own frame: { a, b, r } a capsule (a sphere when a = b); { torus: R, r } a ring round its z axis.
  function solidOf(obj, shapes) {
    colliders.push((pw, rad) => {
      if (!obj.visible) return null;
      const lp = obj.worldToLocal(cL.copy(pw)), scale = obj.getWorldScale(cS).x, rl = rad / scale;
      for (const sh of shapes) {
        if (sh.torus) { const h = Math.hypot(lp.x, lp.y) || 1e-6; cA.set(lp.x / h * sh.torus, lp.y / h * sh.torus, 0); }
        else { cB.copy(sh.b).sub(sh.a); const t = Math.max(0, Math.min(1, cA.copy(lp).sub(sh.a).dot(cB) / (cB.lengthSq() || 1))); cA.copy(sh.a).addScaledVector(cB, t); }
        const off = lp.clone().sub(cA), d = off.length(), min = sh.r + rl;
        if (d < min) { const out = cA.clone().addScaledVector(d > 1e-6 ? off.divideScalar(d) : new THREE.Vector3(0, 1, 0), min); return obj.localToWorld(out).sub(pw); }
      }
      return null;
    });
  }
  // What can't be flown or walked through, by world: tall things as vertical cylinders
  // { p: base, r, h } in a coarse grid of directions, and orbital rings as bands.
  const solids = new Map(), rings = new Map();
  const solidsOf = (id, R) => { if (!solids.has(id)) solids.set(id, { R, cell: 45 / R, grid: new Map() }); return solids.get(id); };
  const keyOf = (s, n) => `${Math.floor(n.x / s.cell)},${Math.floor(n.y / s.cell)},${Math.floor(n.z / s.cell)}`;
  const addSolid = (id, R, o) => { const s = solidsOf(id, R), n = o.p.clone().normalize(), k = keyOf(s, n); if (!s.grid.has(k)) s.grid.set(k, []); s.grid.get(k).push(o); };

  for (const civ of civilizationsIn(system)) {
    if (civ.extent !== 'system') continue;
    const home = system.bodies.find(b => b.id === civ.home), homeWorld = worlds.get(home.id);
    const design = shipDesign(civ), r = rng(civ.seed ?? 1, 'megastructures');
    const glowC = design.glow, hullC = design.hullColour, trimC = design.trim;
    const colonies = system.bodies.filter(b => colonistOf(system, b)?.id === civ.id);
    const giants = civ.tier === 'system-shapers' ? system.bodies.filter(b => b.giant) : [];
    for (const b of [...colonies, ...giants]) lanes.push({ a: home.id, b: b.id, ships: civ.tier === 'system-shapers' ? 3 : 2, colour: glowC, phase: r(), design, key: civ.id });
    if (civ.tier !== 'system-shapers' || !homeWorld) continue;

    // --- The orbital ring and its elevators ---------------------------------
    const R = home.radius, terrain = terrainFor(home), net = networkFor(home, civ, terrain, {});
    const cap = net.capital ? V(...net.settlements[0].n) : V(0, 0, 1);
    // Its plane passes over the capital and is as near the equator as that allows.
    const axis = V(0, 1, 0).addScaledVector(cap, -cap.y); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0).addScaledVector(cap, -cap.x); axis.normalize();
    const RR = R * 1.3, width = Math.max(12, R * .035), tilt = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), axis);
    // A slim, flat band (its inner face toward the world, like a road round the sky), with one
    // fine glowing seam along each edge and six streamlined stations evenly round it, three of
    // them where the elevators arrive. Nothing bolted on at random.
    const ring = merged(), ringGlow = merged();
    ring.add(new THREE.CylinderGeometry(RR, RR, width, 256, 1, true), null, hullC);
    ring.add(new THREE.CylinderGeometry(RR + 1.2, RR + 1.2, width * .5, 256, 1, true), null, trimC); // a raised spine along the outside
    for (const y of [-1, 1]) ringGlow.add(new THREE.TorusGeometry(RR - .4, .5, 3, 256).rotateX(Math.PI / 2), M(V(0, y * width * .5, 0)), glowC);
    const stops = [0, 1, 2].map(i => cap.clone().applyAxisAngle(axis, (i - 1) * 2.094 + (net.capital ? net.settlements[0].radius * 1.4 / R : 0)));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + .26, p = V(Math.cos(a) * RR, 0, Math.sin(a) * RR), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(-Math.sin(a), 0, Math.cos(a)));
      ring.add(new THREE.CapsuleGeometry(width * .55, width * 3.2, 4, 10), M(p, q), i % 2 ? hullC : trimC);
      ringGlow.add(new THREE.CylinderGeometry(width * .58, width * .58, width * .25, 10), M(p, q), glowC);
    }
    rings.set(home.id, { axis: axis.clone(), radius: RR, width, thick: 4 });
    const ringGroup = new THREE.Group(); ringGroup.quaternion.copy(tilt);
    ringGroup.add(new THREE.Mesh(ring.geometry(), lit({ side: THREE.DoubleSide, emissive: new THREE.Color(hullC).multiplyScalar(.22) })), new THREE.Mesh(ringGlow.geometry(), glowing()));
    homeWorld.group.add(track(ringGroup)); parts.push(ringGroup);
    // --- A world-city -----------------------------------------------------------------
    // The whole home world is built over: every stretch of dry land away from the places
    // built in detail (structures-mesh.js) is covered by towers, denser and taller round
    // district centres, with parks left between. Three instanced tower shapes and one
    // shader: lit by the star by day, windows lighting up across the night side; and a
    // point of light on each roof so the night side glows when seen from far off.
    {
      const site = V(...terrain.site), nets = net.settlements.map(s => ({ n: V(...s.n), r: s.radius + 12 }));
      const count = Math.round(Math.min(16000, 11000 * (R / 600) ** 2)), golden = Math.PI * (3 - Math.sqrt(5));
      const shapes = [[], [], []], noise = (n) => Math.sin(n.x * 7.1 + n.y * 3.3) * Math.sin(n.y * 5.7 - n.z * 4.1) * Math.sin(n.z * 6.3 + n.x * 2.9);
      for (let i = 0; i < count; i++) {
        const y = 1 - (i + .5) / count * 2, rr = Math.sqrt(1 - y * y), th = i * golden;
        const n = V(Math.cos(th) * rr, y, Math.sin(th) * rr).add(V(r() - .5, r() - .5, r() - .5).multiplyScalar(.6 / Math.sqrt(count))).normalize();
        if (n.angleTo(site) * R < 280 || terrain.isLiquid(n) || nets.some(s => n.angleTo(s.n) * R < s.r)) continue;
        const d = noise(n); if (d < -.18) continue; // parks
        // Mostly low blocks that read as one city from orbit; towers where districts gather.
        const tall = Math.max(0, d - .05) ** 1.2, kind = tall > .1 && r() < .6 ? (r() < .5 ? 1 : 2) : 0;
        shapes[kind].push({ n, h: 5 + r() * 9 + tall * 110 * (.5 + r()), w: 9 + r() * 8, turn: r() * 6.28, tint: r(), lit: .35 + r() * .5 });
      }
      // In the builders' own idiom (the same families as structures-mesh.js towers) and the
      // world's own colours: three shapes per idiom, unit-sized, standing on y = 0.
      const style = civ.family === 'nests' ? 'roost' : civ.family === 'drifters' ? 'floating' : civ.family === 'burrowers' || ['mounds', 'trapdoor', 'burrows'].includes(civ.culture) ? 'burrow'
        : ['grown', 'living', 'shell', 'membrane'].includes(civ.material) ? 'grown' : civ.material === 'wax' || civ.family === 'hive' ? 'comb' : civ.material === 'silk' || civ.family === 'web' ? 'silk' : 'built';
      const join = (...parts) => { const g = merged(); for (const [geo, m] of parts) g.add(geo, m || null, '#fff'); return g.geometry(); };
      const T = (x, y, z, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion(), V(s, s, s));
      const bulbU = (r, y) => new THREE.SphereGeometry(r, 9, 6).translate(0, y, 0);
      const units = {
        // Those who build with stone, timber, adobe, ice or glass, in their culture's idiom.
        // Those who build with stone, glass and metal: real buildings rather than stacked blocks.
        // A mid-rise block with a parapet and rooftop plant; a tower on a podium, set back as it
        // rises to a crown and mast; a slender round tower with a domed top.
        built: () => [
          join([new THREE.BoxGeometry(1, .82, .86).translate(0, .41, 0)], [new THREE.BoxGeometry(.9, .1, .76).translate(-.04, .87, 0)], [new THREE.BoxGeometry(1.04, .04, .9).translate(0, .82, 0)],
            [new THREE.BoxGeometry(.18, .1, .16).translate(.28, .95, .2)], [new THREE.BoxGeometry(.14, .14, .12).translate(-.3, .97, -.18)], [new THREE.CylinderGeometry(.06, .06, .12, 6).translate(.3, .98, -.22)]),
          join([new THREE.BoxGeometry(1, .12, 1).translate(0, .06, 0)], [new THREE.CylinderGeometry(.36, .42, .6, 8).rotateY(Math.PI / 8).translate(0, .42, 0)],
            [new THREE.CylinderGeometry(.27, .33, .2, 8).rotateY(Math.PI / 8).translate(0, .82, 0)], [new THREE.CylinderGeometry(.34, .34, .02, 8).rotateY(Math.PI / 8).translate(0, .72, 0)],
            [new THREE.ConeGeometry(.2, .06, 8).rotateY(Math.PI / 8).translate(0, .95, 0)], [new THREE.CylinderGeometry(.012, .012, .1, 3).translate(0, 1.02, 0)]),
          join([new THREE.CylinderGeometry(.5, .58, .1, 16).translate(0, .05, 0)], [new THREE.CylinderGeometry(.34, .4, .78, 16).translate(0, .49, 0)],
            [new THREE.SphereGeometry(.34, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .5, 1).translate(0, .88, 0)], [new THREE.CylinderGeometry(.01, .01, .14, 3).translate(0, .99, 0)])],
        grown: () => [new THREE.SphereGeometry(.5, 10, 7).scale(1, 1, 1).translate(0, .5, 0), new THREE.CylinderGeometry(.18, .55, 1, 8).translate(0, .5, 0),
          join([bulbU(.5, .3)], [bulbU(.36, .68)], [bulbU(.22, .92)])],
        comb: () => [new THREE.CylinderGeometry(.55, .55, 1, 6).translate(0, .5, 0), join([new THREE.CylinderGeometry(.3, .3, 1, 6).translate(0, .5, 0)], [new THREE.CylinderGeometry(.3, .3, .7, 6).translate(.52, .35, 0)], [new THREE.CylinderGeometry(.3, .3, .8, 6).translate(-.26, .4, .45)]),
          new THREE.CylinderGeometry(.3, .38, 1, 6).translate(0, .5, 0)],
        silk: () => [new THREE.ConeGeometry(.62, 1, 9).translate(0, .5, 0), join([new THREE.ConeGeometry(.4, .5, 8).rotateX(Math.PI).translate(0, .25, 0)], [new THREE.ConeGeometry(.4, .5, 8).translate(0, .75, 0)]),
          join([new THREE.CylinderGeometry(.35, .4, .7, 8).translate(0, .35, 0)], [new THREE.ConeGeometry(.5, .3, 8).translate(0, .85, 0)])],
        roost: () => [join([new THREE.CylinderGeometry(.2, .28, 1, 8).translate(0, .5, 0)], [new THREE.CylinderGeometry(.55, .55, .04, 10).translate(.2, .45, 0)], [new THREE.CylinderGeometry(.5, .5, .04, 10).translate(-.2, .75, 0)]),
          new THREE.CylinderGeometry(.12, .4, 1, 8).translate(0, .5, 0), join([new THREE.CylinderGeometry(.25, .3, .8, 8).translate(0, .4, 0)], [new THREE.CylinderGeometry(.6, .6, .05, 12).translate(0, .82, 0)])],
        floating: () => [join([new THREE.CylinderGeometry(.03, .03, .55, 3).translate(0, .275, 0)], [new THREE.SphereGeometry(.5, 10, 7).scale(1, .8, 1).translate(0, .78, 0)]),
          join([new THREE.CylinderGeometry(.03, .03, .4, 3).translate(0, .2, 0)], [new THREE.CylinderGeometry(.3, .4, .45, 8).translate(0, .62, 0)], [new THREE.SphereGeometry(.5, 10, 7).scale(1, .6, 1).translate(0, .95, 0)]),
          join([new THREE.CylinderGeometry(.03, .03, .6, 3).translate(0, .3, 0)], [new THREE.SphereGeometry(.45, 9, 6).scale(1, .7, 1).translate(0, .8, 0)])],
        burrow: () => [new THREE.SphereGeometry(.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0, 0), new THREE.CylinderGeometry(.55, .65, .25, 12).translate(0, .125, 0),
          join([new THREE.SphereGeometry(.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)], [new THREE.CylinderGeometry(.06, .08, 1, 5).translate(.4, .5, 0)])],
      };
      const unit = units[style]();
      // How this species lights its walls (not always our rows of windows): 0 windows,
      // 1 round ports, 2 vertical seams, 3 bands, 4 scattered glows, 5 a spiral.
      const pr = rng(civ.seed ?? 1, 'light-style'), pattern = { grown: [1, 4], comb: [1, 3], silk: [3, 2], roost: [2, 1], floating: [1, 3], burrow: [1, 4] }[style]?.[Math.floor(pr() * 2)] ?? [0, 0, 2, 0, 1, 2][Math.floor(pr() * 6)]; // (rows of windows, mostly: bands and spirals read as stripes)
      const winC = civ.species.glow ? new THREE.Color('#ffd98a').lerp(new THREE.Color(civ.species.colors?.glow || '#9fe3ff'), .5) : pr() < .5 ? new THREE.Color('#ffd98a') : new THREE.Color('#ffd98a').lerp(new THREE.Color(['#9fe3ff', '#c9a0ff', '#a8ffb8'][Math.floor(pr() * 3)]), .45);
      // Colours: the world's building material (or the species' own, for those who grow theirs).
      const sp = civ.species.colors || {};
      const MAT = { wood: ['#7b5a3c', '#5a4030', '#9a7a58', '#8fb7c4'], ice: ['#cfe6f2', '#e8f3f8', '#9fc3d6', '#b8d8e6'], adobe: ['#c99a6b', '#b07850', '#e0c09a', '#d4b48a'],
        stone: ['#9a958e', '#7d7a76', '#b9b2a6', '#8fb7c4'], glass: ['#9fe3e6', '#7fc6d6', '#c9eef0', '#8fb7c4'], wax: ['#d9a441', '#c08a30', '#e8c070', '#b07a28'], silk: ['#f2f0ea', '#e4e0d6', '#d8d2c4', '#c9c2b5'] };
      const palette = (MAT[civ.material] || [sp.base || '#9a6a50', sp.belly || '#c9c2b5', sp.accent || '#c0503a', sp.shimmer || '#d8c07a'])
        .flatMap(c => [c, c, hullC]).map(c => new THREE.Color(c).lerp(new THREE.Color(home.rock || '#9aa7b0'), .15));
      const tempC = (home.physics?.temperature ?? 288) - 273.15, snow = Math.min(1, Math.max(0, (4 - tempC) / 34)), gravityK = Math.min(1.4, Math.max(.8, 1 / Math.sqrt(home.physics?.gravity || 1)));
      const flatten = style === 'burrow' ? .22 : 1;
      const cityMat = new THREE.ShaderMaterial({
        uniforms: { sun: sun || { value: V() }, windowC: { value: winC }, snow: { value: snow }, pattern: { value: pattern } },
        vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 tint; attribute float lit; varying vec3 vWorld, vNormal, vTint, vLocal, vRadial; varying float vLit, vUp;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  mat3 m = mat3(modelMatrix * instanceMatrix);
  vWorld = w.xyz; vNormal = normalize(m * normal); vTint = tint; vLit = lit;
  vLocal = position * vec3(length(m[0]), length(m[1]), length(m[2]));
  vUp = abs(normal.y);
  vRadial = normalize(w.xyz - (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`,
        fragmentShader: `#include <logdepthbuf_pars_fragment>
uniform vec3 sun, windowC; uniform float snow, pattern; varying vec3 vWorld, vNormal, vTint, vLocal, vRadial; varying float vLit, vUp;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  #include <logdepthbuf_fragment>
  vec3 up = normalize(vRadial), toSun = normalize(sun - vWorld);
  float day = dot(up, toSun), light = max(dot(normalize(vNormal), toSun), 0.0) * smoothstep(-0.1, 0.15, day);
  vec3 c = mix(vTint, vec3(0.93, 0.95, 0.97), snow * smoothstep(0.5, 0.85, dot(normalize(vNormal), up)) * 0.9) * (0.28 + 0.85 * light); // snow on what faces the sky
  // Windows: rows of panes on the walls, some lit, more of them as night deepens.
  float across = (vLocal.x + vLocal.z), hgt = vLocal.y;
  vec2 cell = vec2(floor(across * 0.45), floor(hgt / 3.2));
  float pane = step(0.25, fract(hgt / 3.2)) * step(0.2, fract(across * 0.45));                       // 0: windows
  if (pattern > 0.5 && pattern < 1.5) { vec2 g = fract(vec2(across * 0.35, hgt / 2.8)) - 0.5; pane = step(length(g), 0.2); cell = floor(vec2(across * 0.35, hgt / 2.8)); }   // round ports
  else if (pattern < 2.5 && pattern > 1.5) { pane = step(0.86, fract(across * 0.3)) * step(0.1, fract(hgt / 9.0)); cell = vec2(floor(across * 0.3), floor(hgt / 9.0)); }    // vertical seams
  else if (pattern < 3.5 && pattern > 2.5) { pane = step(0.82, fract(hgt / 4.0)); cell = vec2(0.0, floor(hgt / 4.0)); }                                                   // bands
  else if (pattern < 4.5 && pattern > 3.5) { cell = floor(vec2(across * 0.9, hgt * 0.9)); pane = step(0.9, hash(cell * 1.7)); }                                         // scattered glows
  else if (pattern > 4.5) { pane = step(0.85, fract((across * 0.25 + hgt * 0.18))); cell = vec2(floor(across * 0.25 + hgt * 0.18), 0.0); }                               // a spiral
  float on = step(1.0 - vLit, hash(cell + vTint.xy * 17.0)) * pane * (1.0 - vUp);
  float night = smoothstep(0.1, -0.15, day);
  c = mix(c, windowC * 1.15, on * night * 0.9) + windowC * on * 0.06;
  gl_FragColor = vec4(c, 1.0);
}`,
      });
      disposables.push(cityMat, ...unit);
      const lightPos = [];
      // The species' own buildings, as the capital's are seen from a little way off (alien-build.js
      // farProtos: each shape of their architecture, simplified, in their own colours and lights).
      // The city then reads as more of the capital, not as something else.
      let protos = null, A = null;
      try {
        A = architectureOf(civ, home);
        const U = Math.max(.75, civ.unit || 1), C = colours(THREE, home, civ);
        protos = farProtos({ THREE, C, U, fh: floorH(civ.unit || 1), lights: true }, A);
        if (!protos.size) protos = null;
        if (protos) {
          const fh = floorH(civ.unit || 1), byKey = new Map(), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), tq = new THREE.Quaternion();
          shapes.forEach((list, kind) => list.forEach((t, i) => {
            if (kind === 0 && ((i * 2654435761) >>> 0) % 100 < 40) return; // (their buildings are richer than the old blocks: a few less of them)
            const tower = kind > 0, lot = { w: t.w, d: t.w, floors: Math.max(1, Math.round(t.h * gravityK / fh)), kind: tower ? 'tower' : 'home', seed: Math.floor(t.tint * 9973) + i };
            const sz = sizeOf(A, lot, { U, fh, fill: .8 }), pk = tower ? 'tower' : 'home';
            let key = `${pk}:${sz.mass}:${lot.seed % 2}`; if (!protos.has(key)) key = `${pk}:${sz.mass}:0`;
            if (!protos.has(key)) key = [...protos.keys()].find(k => k.startsWith(pk + ':')) || [...protos.keys()][0];
            const ground = R + terrain.surface(t.n) - 2;
            q.setFromUnitVectors(V(0, 1, 0), t.n).multiply(tq.setFromAxisAngle(V(0, 1, 0), t.turn));
            if (!byKey.has(key)) byKey.set(key, []);
            byKey.get(key).push({ m: mm.compose(t.n.clone().multiplyScalar(ground), q, V(sz.R * 2, sz.H + 2, sz.R * 2)).clone(), tone: .86 + (t.tint * 7 % 1) * .24, n: t.n, p: t.n.clone().multiplyScalar(ground) });
            lightPos.push(t.n.clone().multiplyScalar(ground + sz.H * .7));
            addSolid(home.id, R, { p: t.n.clone().multiplyScalar(ground), r: sz.R, h: sz.H + 2 });
          }));
          // Their own colours by day, their lights coming on across the night side.
          const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, flatShading: true });
          mat.onBeforeCompile = (sh) => {
            sh.uniforms.uSun = sun || { value: V() };
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow; varying vec3 vWP; varying vec3 vCentre;')
              .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;')
              .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vCentre = modelMatrix[3].xyz;');
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSun; varying float vGlow; varying vec3 vWP; varying vec3 vCentre;')
              .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat nightK = smoothstep(0.1, -0.15, dot(normalize(vWP - vCentre), normalize(uSun - vWP)));\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * (.12 + 1.5 * nightK);');
          };
          mat.customProgramCacheKey = () => 'world-city-own';
          disposables.push(mat);
          // Drawn in detail only near you and only on the side of the world you can see; the
          // rest of the city as plain blocks in each building's own colour, and from far out
          // only the points of light below. Re-sorted as you move (lod, from update()).
          const c = new THREE.Color(), detailed = [], all = [];
          for (const [key, its] of byKey) {
            const g = protos.get(key), col = g.attributes.color, avg = new THREE.Color(0, 0, 0);
            if (col) { for (let i = 0; i < col.count; i++) avg.r += col.getX(i), avg.g += col.getY(i), avg.b += col.getZ(i); avg.multiplyScalar(1 / col.count); } else avg.set('#9aa0a6');
            const mesh = new THREE.InstancedMesh(g, mat, its.length);
            mesh.count = 0; mesh.frustumCulled = false; mesh.name = 'world-city';
            homeWorld.group.add(mesh); detailed.push({ mesh, its });
            for (const it of its) { it.avg = avg; all.push(it); }
          }
          const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
          box.setAttribute('color', new THREE.Float32BufferAttribute(new Array(box.attributes.position.count * 3).fill(1), 3));
          box.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Array(box.attributes.position.count).fill(.25), 1));
          const blocks = new THREE.InstancedMesh(box, mat, all.length); blocks.count = 0; blocks.frustumCulled = false; blocks.name = 'world-city';
          homeWorld.group.add(blocks); disposables.push(box);
          const last = V(1e12, 0, 0), cam = V(), dir = V();
          cityLod = (camWorld) => {
            homeWorld.group.updateWorldMatrix(true, false);
            cam.copy(camWorld); homeWorld.group.worldToLocal(cam);
            if (cam.distanceTo(last) < R * .02) return;
            last.copy(cam);
            const d = cam.length(); dir.copy(cam).normalize();
            const horizon = Math.min(1, R / d) - .12, nearR = Math.min(R * .8, 1400), far = d > R * 7;
            let b = 0;
            for (const { mesh, its } of detailed) {
              let k = 0;
              for (const it of its) {
                if (far || it.n.dot(dir) < horizon) continue;
                if (it.p.distanceTo(cam) < nearR) { mesh.setMatrixAt(k, it.m); mesh.setColorAt(k, c.setScalar(it.tone)); k++; }
                else { blocks.setMatrixAt(b, it.m); blocks.setColorAt(b, c.copy(it.avg).multiplyScalar(it.tone)); b++; }
              }
              mesh.count = k; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            }
            blocks.count = b; blocks.instanceMatrix.needsUpdate = true; if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
          };
          for (const g of protos.values()) disposables.push(g);
        }
      } catch (e) { console.warn('world-city: own architecture unavailable', e); protos = null; }
      if (!protos) shapes.forEach((list, kind) => {
        if (!list.length) return;
        const mesh = new THREE.InstancedMesh(unit[kind], cityMat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), tq = new THREE.Quaternion();
        const tint = new Float32Array(list.length * 3), litA = new Float32Array(list.length);
        list.forEach((t, i) => {
          const ground = R + terrain.surface(t.n) - 2;
          q.setFromUnitVectors(V(0, 1, 0), t.n).multiply(tq.setFromAxisAngle(V(0, 1, 0), t.turn));
          mesh.setMatrixAt(i, m.compose(t.n.clone().multiplyScalar(ground), q, V(t.w * (style === 'burrow' ? 1.4 : 1), (t.h * flatten * gravityK) + 2, t.w * (style === 'burrow' ? 1.4 : 1))));
          const c = palette[Math.floor(t.tint * palette.length)].clone().multiplyScalar(.85 + (t.tint * 7 % 1) * .3); tint.set([c.r, c.g, c.b], i * 3); litA[i] = t.lit;
          lightPos.push(t.n.clone().multiplyScalar(ground + t.h * flatten * gravityK * .7));
          addSolid(home.id, R, { p: t.n.clone().multiplyScalar(ground), r: t.w * (style === 'burrow' ? .8 : kind === 1 ? .55 : .62), h: t.h * flatten * gravityK + 2 });
        });
        mesh.geometry = unit[kind].clone(); mesh.geometry.setAttribute('tint', new THREE.InstancedBufferAttribute(tint, 3)); mesh.geometry.setAttribute('lit', new THREE.InstancedBufferAttribute(litA, 1));
        disposables.push(mesh.geometry); mesh.frustumCulled = false; mesh.name = 'world-city';
        homeWorld.group.add(mesh);
      });
      // From far off the towers are too small to see their windows: a point of light on each.
      if (lightPos.length && sun) {
        const lights = nightPoints(THREE, lightPos, sun, '#ffd98a'); lights.name = 'world-city-lights';
        disposables.push(lights.geometry, lights.material); homeWorld.group.add(lights);
      }
    }

    // Elevators: a tether from an anchor tower up to the ring, two climbers on each.
    const lift = merged(), liftGlow = merged(), climbers = [];
    for (const n of stops) {
      const ground = R + terrain.surface(n) - 2, q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n), len = RR - ground;
      lift.add(new THREE.CylinderGeometry(9, 15, 26, 8).translate(0, 13, 0), M(n.clone().multiplyScalar(ground), q), hullC);
      lift.add(new THREE.CylinderGeometry(4, 9, 14, 8).translate(0, 33, 0), M(n.clone().multiplyScalar(ground), q), trimC);
      lift.add(new THREE.CylinderGeometry(.9, .9, len, 6).translate(0, len / 2, 0), M(n.clone().multiplyScalar(ground), q), '#c9ced2');
      for (let y = 60; y < len - 20; y += 45) liftGlow.add(new THREE.SphereGeometry(1.4, 6, 4), M(n.clone().multiplyScalar(ground + y), q), '#ff5a5a');
      liftGlow.add(new THREE.TorusGeometry(10, .8, 3, 16).rotateX(Math.PI / 2), M(n.clone().multiplyScalar(ground + 24), q), glowC);
      addSolid(home.id, R, { p: n.clone().multiplyScalar(ground), r: 15, h: 40 }); // the anchor tower
      for (let y = 40; y < len; y += 30) addSolid(home.id, R, { p: n.clone().multiplyScalar(ground + y), r: 4, h: 32 }); // the tether, in lengths
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
        solidOf(o, [{ a: V(0, -L / 2 - 10, 0), b: V(0, L / 2 + 10, 0), r: Rh * 1.05 }, { a: V(0, -(L / 2 - 20), 0), b: V(0, -(L / 2 - 20), 0), r: Rh * 2.2 }, { a: V(0, L / 2 - 20, 0), b: V(0, L / 2 - 20, 0), r: Rh * 2.2 }]);
        updates.push((t) => {
          o.position.copy(start).applyAxisAngle(orbitAxis, t * speed + ph).multiplyScalar(rad);
          o.quaternion.setFromUnitVectors(V(0, 1, 0), orbitAxis); o.rotateY(t * .05);
        });
      }
    }

    // --- The star's rings -------------------------------------------------------
    // Three great rings round the star, set at different tilts like the hoops of an armillary
    // sphere, each turning slowly about its own axis. A ring is a ribbon of identical mirror
    // panels laid edge to edge, framed by a thin glowing seam on each side: ordered, not a
    // cloud. Each panel is angled to throw starlight toward the light harbour by the home
    // world, so from there (and from along the rings) they flash gold; from elsewhere they
    // show their dark backs.
    const star = system.star.radius, inner = Math.min(...system.bodies.filter(b => !b.parent).map(b => b.orbit - b.radius * 2));
    const swarm = new THREE.Group(), homeAt = new THREE.Vector3(), starAt = new THREE.Vector3(), aimAt = new THREE.Vector3();
    const panelGeo = new THREE.PlaneGeometry(1, 1);
    const mirrorMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { starPos: { value: starAt }, homePos: { value: aimAt }, time: { value: 0 }, gold: { value: new THREE.Color('#ffd27a') }, back: { value: new THREE.Color(hullC).lerp(new THREE.Color('#5a626c'), .6).multiplyScalar(.45) }, glow: { value: new THREE.Color(glowC) } },
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
  vec3 n = normalize(toStar + toHome);
  float facing = dot(normalize(vNormal), toCam) * sign(dot(normalize(vNormal), toStar));
  float glint = pow(max(dot(reflect(-toStar, n), toCam), 0.0), 24.0);
  float sweep = 0.5 + 0.5 * sin(time * 0.35 - vSeed * 6.2832);        // a slow wave of light running round the ring
  float frame = smoothstep(0.44, 0.49, max(abs(vUv.x), abs(vUv.y)));   // a thin dark frame round each panel
  float cell = smoothstep(0.02, 0.0, abs(fract(vUv.x * 3.0 + 0.5) - 0.5)) * 0.5; // faint cell lines across it
  vec3 mirror = gold * (0.28 + 0.25 * sweep + 1.8 * glint) * (1.0 - 0.7 * frame) * (1.0 - cell * 0.4);
  vec3 rear = back * (0.8 + 0.4 * frame) + glow * frame * 0.25;
  gl_FragColor = vec4(facing > 0.0 ? mirror : rear, 1.0);
}`,
    });
    disposables.push(panelGeo, mirrorMat);
    const seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(glowC).lerp(new THREE.Color('#ffd27a'), .4) });
    disposables.push(seamMat);
    const hoops = [];
    const tilts = [[0, 0, 0], [1.05, 0, .35], [-.9, 2.1, -.5]];
    for (let k = 0; k < 3; k++) {
      const rad = Math.min(star * (2.05 + k * .2), inner * (.5 + k * .04)), wide = rad * .07, n = 260;
      const band = new THREE.InstancedMesh(panelGeo, mirrorMat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), seeds = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, p = V(Math.cos(a) * rad, 0, Math.sin(a) * rad);
        // Panel faces the star; its long side runs along the ring.
        const inward = p.clone().normalize().negate(), along = V(-Math.sin(a), 0, Math.cos(a));
        const basis = new THREE.Matrix4().makeBasis(along, V(0, 1, 0), inward); q.setFromRotationMatrix(basis);
        band.setMatrixAt(i, m.compose(p, q, V(rad * Math.PI * 2 / n * .94, wide, 1)));
        seeds[i] = i / n;
      }
      band.geometry = panelGeo.clone(); band.geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 1)); disposables.push(band.geometry);
      band.frustumCulled = false;
      const hoop = new THREE.Group(); hoop.add(band);
      // A glowing seam along each edge, and a thin keel behind the panels holding them.
      for (const y of [-1, 1]) { const seam = new THREE.Mesh(new THREE.TorusGeometry(rad, wide * .045, 4, 240).rotateX(Math.PI / 2).translate(0, y * wide * .52, 0), seamMat); disposables.push(seam.geometry); hoop.add(seam); }
      const keel = new THREE.Mesh(new THREE.TorusGeometry(rad * 1.012, wide * .09, 4, 240).rotateX(Math.PI / 2), lit()); disposables.push(keel.geometry, keel.material); hoop.add(keel);
      const holder = new THREE.Group(); holder.rotation.set(...tilts[k]); holder.add(hoop);
      hoops.push({ hoop, spin: (.004 + k * .0015) * (k % 2 ? -1 : 1) });
      // The band: a ship keeps to one side of it or the other.
      colliders.push((pw, shipR) => {
        const lp = hoop.worldToLocal(cL.copy(pw)), sc = hoop.getWorldScale(cS).x, rl = shipR / sc, h = Math.hypot(lp.x, lp.z) || 1e-6;
        const dr = h - rad, slab = wide * .03 + rl;
        if (Math.abs(lp.y) > wide * .55 + rl || Math.abs(dr) > slab) return null;
        // Out through whichever face is nearer: in or out of the ring, or past its edge.
        const pr = slab - Math.abs(dr), py = wide * .55 + rl - Math.abs(lp.y), out = lp.clone();
        if (pr < py) { const k = (rad + Math.sign(dr || 1) * slab) / h; out.x *= k; out.z *= k; } else out.y = Math.sign(lp.y || 1) * (wide * .55 + rl);
        return hoop.localToWorld(out).sub(pw);
      });
      swarm.add(holder);
    }

    // --- The light harbour -----------------------------------------------------
    // Where the rings' light is gathered: a great station hanging sunward of the home world,
    // its dish open to the star. A deep dish on a spine, a turning habitat wheel with lit
    // windows, radiator fins, docking arms and blinking beacons. Freighters shuttle between it
    // and the world below.
    const HR = home.radius * .32, harbour = new THREE.Group(), hullG = merged(), glowG = merged(), wheelG = merged(), wheelGlow = merged();
    hullG.add(new THREE.SphereGeometry(1.6, 28, 10, 0, Math.PI * 2, 0, .9).rotateX(-Math.PI / 2).translate(0, 0, 1.25), null, '#cfd6dc'); // dish, open toward +z (the star)
    hullG.add(new THREE.CylinderGeometry(.16, .22, 3.4, 8).rotateX(Math.PI / 2).translate(0, 0, -.5), null, hullC); // spine
    hullG.add(new THREE.CylinderGeometry(.1, .1, 1.5, 6).rotateX(Math.PI / 2).translate(0, 0, 1.9), null, trimC); // feed arm
    glowG.add(new THREE.SphereGeometry(.2, 10, 8).translate(0, 0, 2.7), null, '#fff1c8'); // the receiver at the focus, glowing
    for (const sgn of [-1, 1]) for (const z of [-1.2, -1.75]) hullG.add(new THREE.BoxGeometry(2.6, .03, .42).translate(sgn * 1.55, 0, z), null, '#3d4650'); // radiator fins
    for (let k = 0; k < 4; k++) {
      const q = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), k * Math.PI / 2 + Math.PI / 4);
      hullG.add(new THREE.BoxGeometry(.09, 1.1, .09).translate(0, .75, -2.05), M(V(), q), trimC);
      glowG.add(new THREE.BoxGeometry(.16, .1, .16).translate(0, 1.32, -2.05), M(V(), q), glowC);
    }
    hullG.add(new THREE.CylinderGeometry(.42, .42, .5, 10).rotateX(Math.PI / 2).translate(0, 0, -2.05), null, hullC);
    wheelG.add(new THREE.TorusGeometry(1.05, .13, 8, 48), null, hullC);
    for (let k = 0; k < 6; k++) wheelG.add(new THREE.BoxGeometry(.05, 1.05, .05).translate(0, .52, 0).rotateZ(k * Math.PI / 3), null, trimC);
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; wheelGlow.add(new THREE.BoxGeometry(.1, .05, .02).rotateZ(a + Math.PI / 2).translate(Math.cos(a) * 1.05, Math.sin(a) * 1.05, .13), null, glowC); }
    const wheel = new THREE.Group(); wheel.add(new THREE.Mesh(wheelG.geometry(), lit()), new THREE.Mesh(wheelGlow.geometry(), glowing())); wheel.position.z = -1.45;
    harbour.add(new THREE.Mesh(hullG.geometry(), lit({ side: THREE.DoubleSide, emissive: new THREE.Color(hullC).multiplyScalar(.12) })), new THREE.Mesh(glowG.geometry(), glowing()), wheel);
    const beacons = [];
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 4), new THREE.MeshBasicMaterial({ color: k % 2 ? '#ff5a4a' : '#ffffff' })); b.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 1.95); harbour.add(b); beacons.push(b); }
    harbour.scale.setScalar(HR);
    group.add(track(harbour)); parts.push(harbour);
    solidOf(harbour, [{ a: V(0, 0, 1.55), b: V(0, 0, 1.55), r: 1.62 }, { a: V(0, 0, -2.3), b: V(0, 0, 2.8), r: .3 }, { a: V(0, 0, -2.05), b: V(0, 0, -2.05), r: .7 }, { a: V(-2.8, 0, -1.5), b: V(2.8, 0, -1.5), r: .25 }]);
    colliders.push((pw, rad) => { // the habitat wheel
      const lp = wheel.worldToLocal(cL.copy(pw)), sc = wheel.getWorldScale(cS).x, rl = rad / sc, h = Math.hypot(lp.x, lp.y) || 1e-6;
      cA.set(lp.x / h * 1.05, lp.y / h * 1.05, 0); const off = lp.clone().sub(cA), d = off.length(), min = .14 + rl;
      return d < min ? wheel.localToWorld(cA.clone().addScaledVector(d > 1e-6 ? off.divideScalar(d) : V(0, 0, 1), min)).sub(pw) : null;
    });
    lanes.push({ a: { group: harbour, body: { radius: HR * 1.2 } }, b: home.id, ships: 5, colour: glowC, phase: r(), design, key: civ.id });

    group.add(swarm); parts.push(swarm);
    swarm.userData.followStar = true;
    const sunward = V(), Y = V(0, 1, 0);
    updates.push((t) => {
      starAt.copy(swarm.position); homeAt.copy(homeWorld.group.position); mirrorMat.uniforms.time.value = t;
      for (const h of hoops) h.hoop.rotation.y = t * h.spin;
      sunward.copy(starAt).sub(homeAt).normalize();
      harbour.position.copy(homeAt).addScaledVector(sunward, home.radius * 3.2).addScaledVector(Y, home.radius * .6);
      harbour.lookAt(starAt);
      aimAt.copy(harbour.position);
      wheel.rotation.z = t * .12;
      beacons.forEach((b, k) => { b.visible = ((t * 1.3 + k * .37) % 1) < .18; });
    });
  }

  const c60 = Math.cos(Math.PI / 3), s60 = Math.sin(Math.PI / 3);
  function placeArk(a, star, t) {
    const w = a.anchor.group.position, sx = star ? star.x : 0, sz = star ? star.z : 0, dx = w.x - sx, dz = w.z - sz;
    a.group.position.set(sx + dx * c60 - dz * s60, w.y, sz + dx * s60 + dz * c60);
    if (t !== a.lastT) { a.lastT = t; a.update(t); }
  }
  // Arks (megastation.js), sixty degrees ahead of their builders' world.
  const arks = [];
  for (const civ of civilizationsIn(system)) {
    if (!civ.ark) continue;
    try {
      const home = system.bodies.find(b => b.id === civ.home), anchor = worlds.get(home.parent || home.id);
      if (!anchor) continue;
      const ark = buildMegastation(THREE, civ);
      ark.anchor = anchor;
      ark.sync = (star) => placeArk(ark, star, ark.lastT ?? 0); // place it now (game.js, before walking on it)
      group.add(ark.group); arks.push(ark);
      const ad = shipDesign(civ); // their own ships, to and from the ark
      lanes.push({ a: { group: ark.group, body: { radius: ark.size * .55 } }, b: home.parent || home.id, ships: 3, colour: ad.glow, phase: Math.random(), design: ad, key: civ.id + ':ark' });
    } catch (e) { console.warn('ark', e); }
  }

  // --- Traffic between worlds ------------------------------------------------------
  // Each ship is a bright point with a short fading trail; it leaves from just above its
  // world, arcs across and slows to arrive, then starts back.
  let traffic = null, trafficShips = [];
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
    const stop = (x) => (typeof x === 'string' ? worlds.get(x) : x); // a world, or a station ({ group, body: { radius } })
    const at = (s, x, out) => {
      const wa = stop(s.back ? s.l.b : s.l.a), wb = stop(s.back ? s.l.a : s.l.b);
      d.copy(wb.group.position).sub(wa.group.position); const dist = d.length(); d.divideScalar(dist || 1);
      const ra = wa.body.radius * 1.9, rb = wb.body.radius * 1.9;
      A.copy(wa.group.position).addScaledVector(d, ra); B.copy(wb.group.position).addScaledVector(d, -rb);
      side.set(0, 1, 0).cross(d).normalize();
      const e = ease(x), bow = Math.sin(Math.PI * e) * dist;
      out.copy(A).lerp(B, e).addScaledVector(side, bow * .07 * (s.back ? -1 : 1));
      out.y += bow * .02;
      return out;
    };
    for (const s of ships) s.place = (t, out, dir) => {
      const wa = stop(s.l.a), wb = stop(s.l.b), dist = wa.group.position.distanceTo(wb.group.position), period = 40 + dist / (180 * SIZE * 4);
      const x = (t / period + s.phase) % 1;
      at(s, x, out); at(s, Math.min(1, x + .002), dir); dir.sub(out);
      if (dir.lengthSq() < 1e-9) { at(s, Math.max(0, x - .002), dir); dir.multiplyScalar(-1).add(out); }
    };
    trafficShips = ships;
    updates.push((t) => {
      ships.forEach((s, i) => {
        const wa = stop(s.l.a), wb = stop(s.l.b), dist = wa.group.position.distanceTo(wb.group.position), period = 40 + dist / (180 * SIZE * 4); // worlds are far apart (scale.mjs): traffic flies faster
        const x = ((t / period + s.phase) % 1);
        for (let k = 0; k < TRAIL; k++) { at(s, Math.max(0, x - k * .006), p); pos.set([p.x, p.y, p.z], (i * TRAIL + k) * 3); }
      });
      g.attributes.position.needsUpdate = true;
    });
  }

  // --- Ships you can see up close -----------------------------------------------------
  // The same traffic as real hulls in their builders' designs (ships.js), big freighters
  // and liners, pointing where they go; plus ships circling the home worlds of every
  // spacefaring people, coming and going from orbit.
  const orbits = [];
  for (const civ of civilizationsIn(system)) {
    if (civ.extent !== 'orbit' && civ.extent !== 'system') continue;
    const home = system.bodies.find(b => b.id === civ.home), w = home && worlds.get(home.parent || home.id);
    if (!w) continue;
    const rr = rng(civ.seed ?? 1, 'orbit-traffic'), design = shipDesign(civ), n = civ.extent === 'system' ? 6 : 4;
    for (let i = 0; i < n; i++) orbits.push({ w, design, key: civ.id, rad: w.body.radius * (1.25 + rr() * .9), phase: rr() * Math.PI * 2, speed: (rr() < .5 ? 1 : -1) * (.012 + rr() * .02), tilt: new THREE.Quaternion().setFromEuler(new THREE.Euler((rr() - .5) * 1.2, rr() * 6.28, (rr() - .5) * 1.2)) });
  }
  const fleet = []; // { key, design, place(t, pos, dir) }
  if (traffic) for (const s of trafficShips) if (s.l.design) fleet.push({ key: s.l.key, design: s.l.design, place: s.place });
  for (const o of orbits) fleet.push({ key: o.key, design: o.design, place(t, pos, dir) {
    const a = o.phase + t * o.speed; pos.set(Math.cos(a) * o.rad, 0, Math.sin(a) * o.rad).applyQuaternion(o.tilt).add(o.w.group.position);
    dir.set(-Math.sin(a) * Math.sign(o.speed), 0, Math.cos(a) * Math.sign(o.speed)).applyQuaternion(o.tilt);
  } });
  if (fleet.length) {
    const kinds = new Map();
    for (const f of fleet) { if (!kinds.has(f.key)) kinds.set(f.key, { design: f.design, list: [] }); kinds.get(f.key).list.push(f); }
    const shipMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .5, metalness: .3 }), glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    disposables.push(shipMat, glowMat);
    const fwd = V(0, 0, 1), up = V(0, 1, 0), pos = V(), dir = V(), q = new THREE.Quaternion(), stand = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(0, 0, 1)), m = new THREE.Matrix4(), one = V(1, 1, 1);
    for (const k of kinds.values()) {
      const body = merged(), gl = merged(), scale = 6; // freighters and liners: several times your ship
      buildShip(THREE, k.design, (g, mm, colour, bright) => (bright ? gl : body).add(g, mm, colour), new THREE.Matrix4(), scale);
      for (const [mg, mat] of [[body, shipMat], [gl, glowMat]]) {
        if (!mg.count()) continue;
        const geo = mg.geometry(); disposables.push(geo);
        const mesh = new THREE.InstancedMesh(geo, mat, k.list.length); mesh.frustumCulled = false; mesh.name = 'fleet';
        group.add(mesh); parts.push(mesh); (k.meshes ||= []).push(mesh);
      }
      k.stands = k.design.stands;
    }
    updates.push((t) => {
      for (const k of kinds.values()) {
        k.list.forEach((f, i) => {
          f.place(t, pos, dir);
          q.setFromUnitVectors(fwd, dir.lengthSq() > 1e-9 ? dir.normalize() : fwd);
          if (k.stands) q.multiply(stand); // standing hulls fly nose first
          m.compose(pos, q, one);
          for (const mesh of k.meshes || []) mesh.setMatrixAt(i, m);
        });
        for (const mesh of k.meshes || []) mesh.instanceMatrix.needsUpdate = true;
      }
    });
  }

  return {
    arks,
    // starPosition: where the star is drawn (the swarm follows it).
    // Solid things near p (a point relative to that world's centre): [{ p, r, h }].
    obstaclesNear(id, p, out = []) {
      const s = solids.get(id); if (!s) return out;
      const n = p.clone().normalize(), cx = Math.floor(n.x / s.cell), cy = Math.floor(n.y / s.cell), cz = Math.floor(n.z / s.cell);
      for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (let z = cz - 1; z <= cz + 1; z++) { const c = s.grid.get(`${x},${y},${z}`); if (c) out.push(...c); }
      return out;
    },
    // Flying into a megastructure (the star's rings, the harbour, a habitat): a push out, or null.
    bump(point, rad = 9) { for (const c of colliders) { const push = c(point, rad); if (push) return { push, size: 40, what: "Hull contact. Ease off near the structure." }; } return null; },
    // A world's orbital ring: { axis, radius, width, thick } or null.
    ringOf: (id) => rings.get(id) || null,
    update(t, starPosition, camera) {
      if (starPosition) lastStar.copy(starPosition);
      if (camera && cityLod) cityLod(camera);
      for (const p of parts) if (p.userData.followStar && starPosition) p.position.copy(starPosition);
      for (const a of arks) { placeArk(a, starPosition, t); if (camera) a.lod?.(camera); }
      for (const u of updates) u(t);
    },
    dispose() { for (const d of disposables) d.dispose?.(); for (const a of arks) a.dispose(); },
  };
}
