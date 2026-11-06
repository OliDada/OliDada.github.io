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
import { SIZE } from './scale.mjs';
import { civilizationsIn, colonistOf } from './civilizations.mjs';
import { networkFor } from './settlements.mjs';
import { terrainFor } from './terrain.mjs';
import { shipDesign } from './ships.js';
import { rng } from './rng.mjs';
import { nightPoints } from './city-lights.js';
import { buildMegastation } from './megastation.js';

const ease = (x) => x * x * (3 - 2 * x);

// sun: { value } the star's position in the world (shared with city-lights.js).
export function buildMegastructures(THREE, system, worlds, group, sun = null) {
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
        built: () => ({
          timber: () => [join([new THREE.CylinderGeometry(.42, .45, .3, 8).translate(0, .15, 0)], [new THREE.ConeGeometry(.75, .14, 8, 1, true).translate(0, .36, 0)], [new THREE.CylinderGeometry(.34, .37, .25, 8).translate(0, .55, 0)], [new THREE.ConeGeometry(.6, .12, 8, 1, true).translate(0, .73, 0)], [new THREE.ConeGeometry(.3, .25, 8).translate(0, .9, 0)]),
            join([new THREE.BoxGeometry(.8, .6, .8).translate(0, .3, 0)], [new THREE.ConeGeometry(.75, .4, 4).rotateY(Math.PI / 4).translate(0, .8, 0)]), new THREE.CylinderGeometry(.4, .45, 1, 8).translate(0, .5, 0)],
          terraced: () => [join([new THREE.BoxGeometry(1, .3, 1).translate(0, .15, 0)], [new THREE.BoxGeometry(.75, .3, .75).translate(0, .45, 0)], [new THREE.BoxGeometry(.5, .25, .5).translate(0, .72, 0)], [new THREE.BoxGeometry(.25, .15, .25).translate(0, .92, 0)]),
            new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), join([new THREE.BoxGeometry(1, .5, 1).translate(0, .25, 0)], [new THREE.BoxGeometry(.6, .5, .6).translate(.2, .75, .2)])],
          tents: () => [new THREE.ConeGeometry(.6, 1, 8).translate(0, .5, 0), join([new THREE.ConeGeometry(.5, .7, 7).translate(-.25, .35, 0)], [new THREE.ConeGeometry(.45, 1, 7).translate(.25, .5, .1)]),
            join([new THREE.CylinderGeometry(.04, .04, 1, 3).translate(0, .5, 0)], [new THREE.ConeGeometry(.6, .35, 9, 1, true).translate(0, .4, 0)], [new THREE.ConeGeometry(.4, .3, 9, 1, true).translate(0, .75, 0)])],
          stilts: () => [join([new THREE.CylinderGeometry(.05, .05, .5, 3).translate(.3, .25, .3)], [new THREE.CylinderGeometry(.05, .05, .5, 3).translate(-.3, .25, -.3)], [new THREE.CylinderGeometry(.05, .05, .5, 3).translate(.3, .25, -.3)], [new THREE.CylinderGeometry(.05, .05, .5, 3).translate(-.3, .25, .3)], [new THREE.BoxGeometry(.8, .3, .8).translate(0, .65, 0)], [new THREE.ConeGeometry(.65, .25, 4).rotateY(Math.PI / 4).translate(0, .92, 0)]),
            join([new THREE.CylinderGeometry(.08, .1, .35, 4).translate(0, .175, 0)], [new THREE.CylinderGeometry(.4, .4, .65, 8).translate(0, .67, 0)]), new THREE.CylinderGeometry(.35, .45, 1, 6).translate(0, .5, 0)],
        }[civ.culture] || (() => [join([new THREE.CylinderGeometry(.55, .6, .45, 12).translate(0, .225, 0)], [new THREE.SphereGeometry(.55, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .9, 1).translate(0, .45, 0)]),
            join([new THREE.CylinderGeometry(.4, .45, .7, 10).translate(0, .35, 0)], [new THREE.TorusGeometry(.5, .06, 3, 14).rotateX(Math.PI / 2).translate(0, .5, 0)], [new THREE.SphereGeometry(.4, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, .7, 0)]),
            new THREE.CylinderGeometry(.5, .55, 1, 10).translate(0, .5, 0)]))(),
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
      const pr = rng(civ.seed ?? 1, 'light-style'), pattern = { grown: [1, 4], comb: [1, 3], silk: [3, 2], roost: [2, 1], floating: [1, 3], burrow: [1, 4] }[style]?.[Math.floor(pr() * 2)] ?? [0, 1, 2, 3, 4, 5, 2, 3][Math.floor(pr() * 8)];
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
      shapes.forEach((list, kind) => {
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
        const wa = worlds.get(s.l.a), wb = worlds.get(s.l.b), dist = wa.group.position.distanceTo(wb.group.position), period = 40 + dist / (180 * SIZE * 4); // worlds are far apart (scale.mjs): traffic flies faster
        const x = ((t / period + s.phase) % 1);
        for (let k = 0; k < TRAIL; k++) { at(s, Math.max(0, x - k * .006), p); pos.set([p.x, p.y, p.z], (i * TRAIL + k) * 3); }
      });
      g.attributes.position.needsUpdate = true;
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
    } catch (e) { console.warn('ark', e); }
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
    // A world's orbital ring: { axis, radius, width, thick } or null.
    ringOf: (id) => rings.get(id) || null,
    update(t, starPosition) {
      for (const p of parts) if (p.userData.followStar && starPosition) p.position.copy(starPosition);
      for (const a of arks) placeArk(a, starPosition, t);
      for (const u of updates) u(t);
    },
    dispose() { for (const d of disposables) d.dispose?.(); for (const a of arks) a.dispose(); },
  };
}
