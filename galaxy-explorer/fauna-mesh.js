// Builds, animates and moves the animals on the world you are on. Each species is
// one low-poly model drawn with instancing (one draw call), and its legs, wings,
// tails and tentacles are animated in the vertex shader from a per-animal gait
// cycle, so dozens of animals cost almost nothing. A small behaviour model moves
// each animal across the sphere: herds wander and graze, skittish animals bolt
// from you, curious ones come closer, flyers and floaters drift overhead. THREE is passed in.
import { rng } from './rng.mjs';
import { faunaFor, habitatFit } from './fauna.mjs';

// Vertex roles for animation.
const BODY = 0, LEG = 1, WING = 2, SWAY = 3, SLITHER = 4;
const RANGE = 230; // metres from the site that animals roam

export function buildFauna(THREE, { body, terrain, radius, signalNormal, budget = 90 }) {
  const { species } = faunaFor(body);
  const group = new THREE.Group();
  const creatures = [];
  const time = { value: 0 };
  if (!species.length) return { group, species, creatures, update() {} };
  const Y = new THREE.Vector3(0, 1, 0), toSite = new THREE.Quaternion().setFromUnitVectors(Y, signalNormal);
  const scale = Math.min(1, budget / species.reduce((n, s) => n + s.group * s.herds, 0));
  const meshes = [];
  for (const sp of species) {
    const r = rng(body.seed, 'animals', sp.id);
    const geometry = buildGeometry(THREE, sp, r);
    const count = Math.max(1, Math.round(sp.group * sp.herds * scale));
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    anim.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('iAnim', anim);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 });
    addAnimation(material, sp);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    group.add(mesh);
    meshes.push({ sp, mesh, anim });
    // Herds start at places that suit the species, near the site.
    const herdCount = Math.max(1, Math.round(sp.herds * Math.min(1, scale * 1.5)));
    const centres = [];
    for (let h = 0; h < herdCount; h++) {
      let best = null, bestFit = -1;
      for (let t = 0; t < 30; t++) {
        const n = randomNear(THREE, r, RANGE * .8 / radius).applyQuaternion(toSite);
        if (n.angleTo(signalNormal) < 25 / radius) continue;
        const c = terrain.climate(n), f = habitatFit(sp, c) + r() * .15;
        if (!c.submerged && f > bestFit) { bestFit = f; best = n; }
      }
      centres.push(best || signalNormal.clone());
    }
    for (let i = 0; i < count; i++) {
      const centre = centres[i % centres.length];
      const n = centre.clone().add(randomNear(THREE, r, 12 / radius).sub(Y)).normalize();
      if (terrain.isLiquid(n)) n.copy(centre);
      const heading = tangent(new THREE.Vector3(r() - .5, r() - .5, r() - .5), n);
      creatures.push({ sp, mesh, index: i, herd: centre, n, heading, speed: 0, target: 0, cycle: r() * 6.28, timer: r() * 3, state: 'idle',
        alt: sp.altitude[0] + r() * (sp.altitude[1] - sp.altitude[0]), altPhase: r() * 6.28, r });
    }
  }
  const tmpQ = new THREE.Quaternion(), basis = new THREE.Matrix4(), m = new THREE.Matrix4(), pos = new THREE.Vector3(), right = new THREE.Vector3();

  // player: { position: Vector3 (planet-local), onFoot: boolean } or null
  function update(dt, t, player) {
    time.value = t;
    for (const c of creatures) step(c, dt, t, player);
    for (const { mesh, anim } of meshes) { mesh.instanceMatrix.needsUpdate = true; anim.needsUpdate = true; }
  }
  function step(c, dt, t, player) {
    const sp = c.sp, flying = sp.altitude[1] > 0;
    c.timer -= dt;
    // Reactions to the player take priority over wandering.
    let reacting = false;
    if (player) {
      const toPlayer = player.position.clone().normalize().sub(c.n).multiplyScalar(radius), dist = toPlayer.length();
      const fear = 6 + sp.size * 5 + (player.onFoot ? 0 : 10);
      if (sp.behavior === 'skittish' && dist < fear) {
        c.heading.lerp(tangent(toPlayer.clone().negate(), c.n), Math.min(1, dt * 6)); c.target = sp.speed.run; c.state = 'flee'; reacting = true;
      } else if (sp.behavior === 'curious' && player.onFoot && dist < 35) {
        c.heading.lerp(tangent(toPlayer, c.n), Math.min(1, dt * 2)); c.target = dist > 4 + sp.size * 2 ? sp.speed.walk : 0; c.state = 'approach'; reacting = true;
      }
    }
    if (!reacting && c.timer <= 0) {
      c.timer = 2 + c.r() * 5;
      const roll = c.r();
      c.state = flying ? 'drift' : roll < .35 ? 'graze' : 'wander';
      c.target = flying ? sp.speed.walk * 2.2 : c.state === 'graze' ? 0 : sp.speed.walk * (.6 + c.r() * .6);
      c.heading.applyAxisAngle(c.n, (c.r() - .5) * 2.2);
    }
    if (!reacting) {
      // Herd cohesion and a leash keep animals near their herd and the explorable area.
      const fromHerd = c.n.angleTo(c.herd) * radius;
      if (fromHerd > 14 + sp.group * 2) c.heading.lerp(tangent(c.herd.clone().sub(c.n), c.n), Math.min(1, dt * .8));
      if (c.n.angleTo(signalNormal) * radius > RANGE) c.heading.lerp(tangent(signalNormal.clone().sub(c.n), c.n), Math.min(1, dt));
      if (flying) c.heading.applyAxisAngle(c.n, dt * .25); // lazy circles
    }
    c.speed += (c.target - c.speed) * Math.min(1, dt * 3);
    c.heading = tangent(c.heading, c.n);
    if (c.speed > .01) {
      const angle = c.speed * dt / radius, axis = c.n.clone().cross(c.heading).normalize();
      tmpQ.setFromAxisAngle(axis, angle);
      const next = c.n.clone().applyQuaternion(tmpQ);
      // Ground animals turn back at water's edge; nothing leaves the sky.
      if (!flying && terrain.isLiquid(next)) { c.heading.negate(); c.speed *= .3; c.timer = 1; }
      else { c.n.copy(next).normalize(); c.heading.applyQuaternion(tmpQ); }
    }
    // Gait: legs cycle with distance travelled; wings and floaters keep moving in place.
    const stride = Math.max(.3, sp.legLength * 1.6 || sp.size);
    c.cycle += flying ? dt * (sp.plan === 'floater' ? 1.2 : 5) : c.speed * dt / stride * Math.PI;
    const amp = flying ? 1 : Math.min(1, c.speed / Math.max(.2, sp.speed.walk));
    const ground = radius + terrain.surface(c.n) + (sp.plan === 'floater' || flying ? c.alt + Math.sin(t * .6 + c.altPhase) * 1.5 : 0);
    pos.copy(c.n).multiplyScalar(ground);
    right.copy(c.n).cross(c.heading).normalize();
    basis.makeBasis(right, c.n, c.heading); // local +Y up, +Z forward
    m.copy(basis).setPosition(pos);
    c.mesh.setMatrixAt(c.index, m);
    c.mesh.geometry.attributes.iAnim.setXY(c.index, c.cycle, amp);
  }
  return {
    group, species, creatures, update,
    // Planet-local positions of every animal of a species (for cataloguing).
    positionsOf(sp) { return creatures.filter(c => c.sp === sp).map(c => c.n.clone().multiplyScalar(radius + terrain.surface(c.n))); },
  };
}

function tangent(v, n) { return v.clone().addScaledVector(n, -v.dot(n)).normalize(); }
function randomNear(THREE, r, maxAngle) {
  const a = Math.acos(1 - r() * (1 - Math.cos(maxAngle))), b = r() * Math.PI * 2;
  return new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b));
}

// Legs swing about their hips, wings flap about the body axis, tails and tentacles
// sway, and serpents ripple; all driven by the per-animal gait cycle (iAnim.x) and
// amplitude (iAnim.y, 0 when standing still).
function addAnimation(material, sp) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSize = { value: sp.size };
    shader.vertexShader = 'attribute float aPart; attribute vec3 aPivot; attribute float aPhase; attribute vec2 iAnim; uniform float uSize;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float cyc = iAnim.x, amp = iAnim.y;
        vec3 rel = transformed - aPivot;
        if (aPart == 1.0) {            // leg: swing forward/back around the hip (x axis)
          float a = sin(cyc + aPhase) * .55 * amp;
          rel = vec3(rel.x, rel.y * cos(a) - rel.z * sin(a), rel.y * sin(a) + rel.z * cos(a));
          transformed = aPivot + rel;
        } else if (aPart == 2.0) {     // wing: flap around the body's long axis (z)
          float a = sin(cyc) * .7 * aPhase;
          rel = vec3(rel.x * cos(a) - rel.y * sin(a), rel.x * sin(a) + rel.y * cos(a), rel.z);
          transformed = aPivot + rel;
        } else if (aPart == 3.0) {     // tail or tentacle: gentle sway around the vertical
          float a = sin(cyc * .5 + aPhase) * .35;
          rel = vec3(rel.x * cos(a) + rel.z * sin(a), rel.y, -rel.x * sin(a) + rel.z * cos(a));
          transformed = aPivot + rel;
        } else if (aPart == 4.0) {     // serpent: travelling ripple along the body
          transformed.x += sin(cyc * 1.5 - transformed.z * 6.0 / uSize) * uSize * .12 * (.3 + amp);
        }
        if (aPart != 2.0) transformed.y += abs(sin(cyc)) * amp * uSize * .03; // bob while walking`);
  };
  material.customProgramCacheKey = () => 'fauna';
}

// --- Geometry: parts tagged with their animation role ---
function buildGeometry(THREE, sp, r) {
  const parts = [], s = sp.size, b = sp.body, c = sp.colors;
  const add = (geo, matrix, color, part = BODY, pivot = [0, 0, 0], phase = 0) => parts.push({ geo, matrix, color: new THREE.Color(color), part, pivot, phase });
  const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const blob = (d = 1) => new THREE.IcosahedronGeometry(1, d);
  const limb = (rTop, rBot, len) => new THREE.CylinderGeometry(rTop, rBot, len, 5, 1).translate(0, -len / 2, 0); // hangs down from its origin

  if (sp.plan === 'serpent') {
    const n = sp.segments, len = b.length * 1.8, rad = b.width * .35;
    for (let i = 0; i < n; i++) {
      const z = len / 2 - (i + .5) * len / n, taper = 1 - i / n * .6;
      add(blob(), M(0, rad * taper, z, 0, 0, 0, rad * taper, rad * taper * .8, len / n * .75), i % 2 ? c.base : c.belly, SLITHER);
    }
    add(blob(), M(0, rad * 1.1, len / 2 + rad * .6, 0, 0, 0, rad * 1.2, rad, rad * 1.5), c.base, SLITHER);
    eyes(len / 2 + rad * 1.6, rad * 1.4, rad * .8);
  } else if (sp.plan === 'floater') {
    const R = s * .5;
    add(blob(1), M(0, 0, 0, 0, 0, 0, R, R * .85, R), c.base);
    add(blob(1), M(0, R * .25, 0, 0, 0, 0, R * .7, R * .55, R * .7), c.accent);
    for (let i = 0; i < sp.tentacles; i++) {
      const a = i / sp.tentacles * Math.PI * 2, x = Math.cos(a) * R * .55, z = Math.sin(a) * R * .55, len = s * (.7 + r() * .6);
      add(limb(s * .03, s * .012, len), M(x, -R * .6, z), c.belly, SWAY, [x, -R * .6, z], i);
    }
    eyes(R * .9, 0, R * .35);
  } else {
    const legY = sp.legLength, bodyY = legY + b.height * .35;
    const flyer = sp.plan === 'flyer', biped = sp.plan === 'biped';
    // Body (bipeds stand more upright).
    add(blob(1), M(0, bodyY, 0, biped ? -.35 : 0, 0, 0, b.width / 2, b.height / 2, b.length / 2), c.base);
    add(blob(1), M(0, bodyY - b.height * .18, 0, biped ? -.35 : 0, 0, 0, b.width * .42, b.height * .32, b.length * .42), c.belly);
    // Neck and head.
    const front = b.length / 2;
    let hx = 0, hy = bodyY + b.height * .2, hz = front;
    if (sp.neck > 0) { add(new THREE.CylinderGeometry(s * .06, s * .09, sp.neck, 5).translate(0, sp.neck / 2, 0), M(0, hy - s * .05, front * .8, .7, 0, 0), c.base); hy += sp.neck * .75; hz += sp.neck * .65; }
    add(blob(1), M(hx, hy, hz, 0, 0, 0, sp.head * .8, sp.head * .7, sp.head), c.base);
    if (r() < .5) add(new THREE.ConeGeometry(sp.head * .2, sp.head * .9, 5).translate(0, sp.head * .45, 0), M(0, hy + sp.head * .5, hz - sp.head * .2, -.4), c.accent); // crest or horn
    eyes(hz + sp.head * .75, hy + sp.head * .25, sp.head * .45);
    // Back markings.
    if (r() < .6) for (let i = 0; i < 3; i++) add(blob(), M(0, bodyY + b.height * .42, (i - 1) * b.length * .25, 0, 0, 0, b.width * .2, b.height * .08, b.length * .09), c.accent);
    // Legs: pairs along the body; gaits alternate so diagonal (or tripod) legs move together.
    const pairs = sp.legs / 2;
    for (let i = 0; i < pairs; i++) {
      const z = pairs === 1 ? (biped ? -b.length * .05 : 0) : front * .7 - i * (front * 1.4) / (pairs - 1);
      for (const side of [-1, 1]) {
        const x = side * b.width * (sp.plan === 'hexapod' ? .5 : .32), hip = [x, legY, z];
        const thick = s * (sp.plan === 'hexapod' ? .035 : .06) * (biped ? 1.4 : 1);
        const splay = sp.plan === 'hexapod' ? side * .5 : 0;
        const phase = ((i + (side > 0 ? 1 : 0)) % 2) * Math.PI;
        add(limb(thick, thick * .6, legY * (sp.plan === 'hexapod' ? 1.15 : 1.02)), M(x, legY, z, 0, 0, splay), flyer ? c.belly : c.base, LEG, hip, phase);
        add(blob(), M(x + Math.sin(splay) * legY, .05, z + s * .04, 0, 0, 0, thick * 1.6, thick * .8, thick * 2.2), c.belly, LEG, hip, phase); // foot
      }
    }
    if (sp.tail > 0) add(new THREE.ConeGeometry(s * .07, sp.tail, 5).rotateX(-Math.PI / 2).translate(0, 0, -sp.tail / 2), M(0, bodyY, -front * .9), c.base, SWAY, [0, bodyY, -front * .9], 0);
    if (flyer) for (const side of [-1, 1]) {
      const span = sp.wingSpan / 2;
      const wing = new THREE.BoxGeometry(span, s * .03, b.length * .7).translate(side * span / 2, 0, 0);
      add(wing, M(side * b.width * .3, bodyY + b.height * .2, 0), c.accent, WING, [side * b.width * .3, bodyY + b.height * .2, 0], side);
    }
  }
  function eyes(z, y, spread) {
    const n = sp.eyes;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
      add(blob(), M(side * spread * .55, y + row * spread * .35, z - row * spread * .2, 0, 0, 0, s * .045, s * .045, s * .03), c.eye, sp.plan === 'serpent' ? SLITHER : BODY);
    }
  }
  // Merge into one geometry with per-vertex colour and animation roles.
  const pos = [], col = [], part = [], pivot = [], phase = [];
  for (const p of parts) {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo).applyMatrix4(p.matrix), P = g.attributes.position.array;
    for (let i = 0; i < P.length; i += 3) { pos.push(P[i], P[i + 1], P[i + 2]); col.push(p.color.r, p.color.g, p.color.b); part.push(p.part); pivot.push(...p.pivot); phase.push(p.phase); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute('aPivot', new THREE.Float32BufferAttribute(pivot, 3));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
