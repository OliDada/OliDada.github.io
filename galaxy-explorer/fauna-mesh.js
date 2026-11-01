// Builds, animates and moves the animals on the world you are on. Each species is
// one model drawn with instancing (one draw call). Bodies are a single smooth tube
// swept along a spine (tail, hips, belly, shoulders, neck, skull, snout), and limbs
// are jointed tubes rooted inside the body, so everything connects. Legs (with
// knees), arms, wings, tails and tentacles are animated in the vertex shader from a
// per-animal gait cycle, so dozens of animals cost almost nothing. A small behaviour model moves
// each animal across the sphere: herds wander and graze, skittish animals bolt
// from you, curious ones come closer, flyers and floaters drift overhead. THREE is passed in.
import { rng } from './rng.mjs';
import { faunaFor, habitatFit } from './fauna.mjs';

// Vertex roles for animation.
const BODY = 0, LEG = 1, WING = 2, SWAY = 3, SLITHER = 4, SHIN = 5, ARM = 6, FOREARM = 7;
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
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 });
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

// Pose in the vertex shader. Legs swing at the hip and fold at the knee (lifting
// the foot on the forward swing); arms swing opposite to the legs; wings flap about
// the body axis; tails and tentacles curl progressively toward the tip; serpents
// ripple. Normals get the same rotations so the lighting moves with the limbs.
function addAnimation(material, sp) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSize = { value: sp.size };
    shader.vertexShader = `attribute float aPart; attribute vec3 aPivot; attribute vec3 aKnee; attribute float aPhase; attribute float aBend; attribute vec2 iAnim; uniform float uSize;
mat3 rX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
void creaturePose(inout vec3 p, inout vec3 n) {
  float cyc = iAnim.x, amp = iAnim.y;
  if (aPart == 1. || aPart == 5. || aPart == 6. || aPart == 7.) {
    bool arm = aPart >= 6.;
    float ph = cyc + aPhase + (arm ? 3.14159 : 0.);
    float swing = sin(ph) * (arm ? .35 : .5) * amp;
    if (aPart == 5. || aPart == 7.) {
      float bend = (arm ? .5 : max(0., sin(ph + 1.5708)) * .9 * amp) * aBend;
      mat3 k = rX(bend); p = k * (p - aKnee) + aKnee; n = k * n;
    }
    mat3 h = rX(swing); p = h * (p - aPivot) + aPivot; n = h * n;
  } else if (aPart == 2.) {
    mat3 w = rZ(sin(cyc) * .75 * aPhase); p = w * (p - aPivot) + aPivot; n = w * n;
  } else if (aPart == 3.) {
    mat3 t = rY(sin(cyc * .5 + aPhase) * .4 * aBend); p = t * (p - aPivot) + aPivot; n = t * n;
  } else if (aPart == 4.) {
    p.x += sin(cyc * 1.5 - p.z * 6. / uSize) * uSize * .1 * (.3 + amp);
  }
  if (aPart != 2.) p.y += abs(sin(cyc)) * amp * uSize * .025;
}
` + shader.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 cP = position; vec3 cN = objectNormal; creaturePose(cP, cN); objectNormal = cN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = cP;');
  };
  material.customProgramCacheKey = () => 'fauna-v2';
}

// --- Geometry ---------------------------------------------------------------
// A part is an indexed mesh with per-vertex colour and animation attributes.
function catmull(pts, sub) {
  // Smooth a list of control points ({ p:[x,y,z], rx, ry, ...extra }) with Catmull-Rom.
  const out = [];
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ ...p1, p: [0, 1, 2].map(j => cr(p0.p[j], p1.p[j], p2.p[j], p3.p[j])), rx: lerp(p1.rx, p2.rx, t2 * (3 - 2 * t)), ry: lerp(p1.ry, p2.ry, t2 * (3 - 2 * t)), t: (i + t) / (pts.length - 1) });
    }
  }
  out.push({ ...pts[pts.length - 1], t: 1 });
  return out;
}

function buildGeometry(THREE, sp, r) {
  const parts = [], s = sp.size, b = sp.body, c = sp.colors, tr = sp.traits;
  const col = (hex) => new THREE.Color(hex);
  const base = col(c.base), belly = col(c.belly), accent = col(c.accent), eyeC = col(c.eye), horn = col(c.horn), dark = new THREE.Color(.05, .05, .05), white = new THREE.Color(.92, .9, .85);
  const A = (part = BODY, pivot = [0, 0, 0], knee = [0, 0, 0], phase = 0, bend = 0) => ({ part, pivot, knee, phase, bend });
  const V = (a, b2) => new THREE.Vector3(...a).sub(new THREE.Vector3(...b2));

  // Sweep rings along a path. ring(i) decides colour and animation per vertex.
  function tube(path, seg, colorAt, animAt, { capStart = true, capEnd = true } = {}) {
    const pos = [], colr = [], an = [], idx = [];
    const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(), u2 = new THREE.Vector3(), tng = new THREE.Vector3();
    path.forEach((pt, i) => {
      const prev = path[Math.max(0, i - 1)].p, next = path[Math.min(path.length - 1, i + 1)].p;
      tng.copy(V(next, prev)).normalize();
      const ref = Math.abs(tng.y) > .9 ? new THREE.Vector3(1, 0, 0) : up;
      right.crossVectors(ref, tng).normalize(); u2.crossVectors(tng, right).normalize();
      for (let k = 0; k < seg; k++) {
        const ang = k / seg * Math.PI * 2, cx = Math.cos(ang), sy = Math.sin(ang);
        pos.push(pt.p[0] + right.x * cx * pt.rx + u2.x * sy * pt.ry, pt.p[1] + right.y * cx * pt.rx + u2.y * sy * pt.ry, pt.p[2] + right.z * cx * pt.rx + u2.z * sy * pt.ry);
        colr.push(colorAt(pt, ang, sy, i)); an.push(animAt(pt, i));
      }
    });
    for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < seg; k++) {
      const a = i * seg + k, b1 = i * seg + (k + 1) % seg, c1 = a + seg, d = b1 + seg;
      idx.push(a, b1, c1, b1, d, c1); // counter-clockwise from outside: (around) × (along) points outward
    }
    const cap = (i, flip) => {
      const pt = path[i], center = pos.length / 3;
      pos.push(...pt.p); colr.push(colorAt(pt, -Math.PI / 2, 0, i)); an.push(animAt(pt, i));
      for (let k = 0; k < seg; k++) { const a = i * seg + k, b1 = i * seg + (k + 1) % seg; flip ? idx.push(center, b1, a) : idx.push(center, a, b1); }
    };
    if (capStart) cap(0, true);   // faces backward, away from the tube
    if (capEnd) cap(path.length - 1, false); // faces forward
    parts.push({ pos, colr, an, idx });
  }
  function ellipsoid(center, radii, color, anim, detail = 1) {
    const g = new THREE.IcosahedronGeometry(1, detail), P = g.attributes.position.array, pos = [], colr = [], an = [], idx = [], nor = [];
    for (let i = 0; i < P.length; i += 3) {
      pos.push(center[0] + P[i] * radii[0], center[1] + P[i + 1] * radii[1], center[2] + P[i + 2] * radii[2]);
      const nx = P[i] / radii[0], ny = P[i + 1] / radii[1], nz = P[i + 2] / radii[2], l = Math.hypot(nx, ny, nz); // smooth ellipsoid normal
      nor.push(nx / l, ny / l, nz / l); colr.push(color); an.push(anim); idx.push(i / 3);
    }
    parts.push({ pos, colr, an, idx, nor });
  }
  // Countershading (dark back, pale belly) with a pattern on the back.
  const skin = (pt, ang, sy) => {
    let k = Math.min(1, Math.max(0, (sy + .25) / .6));
    let cc = belly.clone().lerp(base, k);
    if (sy > .15) {
      const t = pt.t ?? 0;
      const mark = sp.pattern === 'stripes' ? Math.sin(t * 34 + (sp.seed % 7)) > .45
        : sp.pattern === 'spots' ? Math.sin(t * 61 + ang * 7.3) * Math.sin(t * 23 - ang * 5.1) > .55
        : sp.pattern === 'saddle' ? t > .32 && t < .62 : false;
      if (mark) cc = cc.lerp(accent, .75);
    }
    return cc;
  };

  // Limb: hip (inside the body) -> knee -> ankle -> toe; tapering; jointed.
  function limb(points, radii, upperPart, lowerPart, pivot, knee, phase, bend, color) {
    const path = [];
    for (let i = 0; i < points.length - 1; i++) for (let k = 0; k < 3; k++) {
      const t = k / 3, q = points[i].map((v, j) => v + (points[i + 1][j] - v) * t);
      path.push({ p: q, rx: radii[i] + (radii[i + 1] - radii[i]) * t, ry: radii[i] + (radii[i + 1] - radii[i]) * t, seg: i });
    }
    path.push({ p: points[points.length - 1], rx: radii[radii.length - 1], ry: radii[radii.length - 1], seg: points.length - 2 });
    tube(path, 7, (pt, ang, sy) => color.clone().lerp(belly, Math.max(0, -sy) * .3), (pt) => A(pt.seg === 0 ? upperPart : lowerPart, pivot, knee, phase, bend));
  }

  const flyer = sp.plan === 'flyer', biped = sp.plan === 'biped', hexa = sp.plan === 'hexapod';
  if (sp.plan === 'floater') {
    const R = s * .5;
    ellipsoid([0, 0, 0], [R, R * .82, R * 1.05], base, A(BODY), 2);
    ellipsoid([0, R * .3, 0], [R * .62, R * .5, R * .7], accent, A(BODY), 2);
    for (let i = 0; i < sp.tentacles; i++) {
      const a = i / sp.tentacles * Math.PI * 2, x = Math.cos(a) * R * .5, z = Math.sin(a) * R * .5, len = s * (.8 + r() * .6), path = [];
      // Tentacles hang in a gentle curl, thick at the root and fine at the tip.
      for (let k = 0; k <= 8; k++) { const f = k / 8, curl = Math.sin(f * 2.4) * s * .12; path.push({ p: [x * (1 + f * .5) + Math.cos(a) * curl, -R * .5 - len * f, z * (1 + f * .5) + Math.sin(a) * curl], rx: s * .055 * (1 - f * .85), ry: s * .055 * (1 - f * .85), w: f }); }
      tube(path, 6, (pt) => accent.clone().lerp(belly, .4 + pt.w * .4), (pt) => A(SWAY, [x, -R * .5, z], [0, 0, 0], i * .9, pt.w));
    }
    // Eyes sit on the float's surface, around its front.
    const n = sp.eyes.count, er = R * .09;
    for (let i = 0; i < n; i++) {
      const yaw = (i - (n - 1) / 2) * .45, pitch = .15 + (i % 2) * .12, d = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch) * .82, Math.cos(yaw) * Math.cos(pitch) * 1.05];
      ellipsoid([d[0] * R * .97, d[1] * R * .97, d[2] * R * .97], [er, er, er], eyeC.clone().lerp(white, .25), A(BODY), 1);
      ellipsoid([d[0] * (R * .97 + er * .55), d[1] * (R * .97 + er * .55), d[2] * (R * .97 + er * .55)], [er * .55, er * .6, er * .55], dark, A(BODY), 0);
    }
  } else {
    // --- Spine: tail tip -> tail base -> hips -> belly -> shoulders -> neck -> skull -> snout ---
    const legY = sp.legLength, L = b.length, W = b.width, H = b.height;
    const bodyY = hexa ? legY * .75 : legY + H * .3;
    const upright = biped ? .35 + tr.intelligence * .5 : 0; // bipeds stand more upright the smarter they are
    const lift = (z) => z * Math.sin(upright); // raise the front for upright postures
    const sp0 = [];
    if (sp.tail > 0) {
      sp0.push({ p: [0, bodyY + lift(-L / 2) - sp.tail * .25, -L / 2 - sp.tail], rx: s * .015, ry: s * .015, tail: 1 });
      sp0.push({ p: [0, bodyY + lift(-L / 2) - sp.tail * .1, -L / 2 - sp.tail * .55], rx: W * .14, ry: H * .14, tail: .5 });
    } else sp0.push({ p: [0, bodyY + lift(-L / 2), -L / 2 - W * .1], rx: W * .2, ry: H * .2, tail: 0 });
    const neckBase = [0, bodyY + lift(L / 2) + H * .15, L / 2];
    const headUp = sp.neck * (biped ? .9 : .75), headFwd = sp.neck * (biped ? .25 : .6);
    const hd = sp.head, snout = sp.snout, serp = sp.plan === 'serpent';
    const body = serp ? [] : [
      { p: [0, bodyY + lift(-L / 2), -L / 2], rx: W * .3, ry: H * .32, tail: 0 },
      { p: [0, bodyY + lift(-L * .32), -L * .32], rx: W * .5, ry: H * .5 },
      { p: [0, bodyY + lift(0) - H * .04, 0], rx: W * (hexa ? .32 : .56), ry: H * (hexa ? .36 : .56) },   // insects: waist
      { p: [0, bodyY + lift(L * .3), L * .3], rx: W * .48, ry: H * .5 },
      { p: neckBase, rx: W * .3, ry: H * .32 },
    ];
    const neck = serp ? [] : sp.neck > 0 ? [{ p: [0, neckBase[1] + headUp * .55, L / 2 + headFwd * .5], rx: s * .07 + W * .1, ry: s * .07 + H * .1 }] : [];
    const hz = L / 2 + headFwd + hd * .3, hy = neckBase[1] + headUp;
    const head = serp ? [] : [
      { p: [0, hy, hz], rx: hd * .5, ry: hd * .48 },
      { p: [0, hy + hd * .04, hz + hd * .45], rx: hd * .52, ry: hd * .46 },
      { p: [0, hy - hd * .06, hz + hd * (.45 + .45 * snout)], rx: hd * .3, ry: hd * .27 },
      { p: [0, hy - hd * .1, hz + hd * (.5 + .65 * snout)], rx: hd * .12, ry: hd * .11 },
    ];
    let spine;
    if (serp) {
      const n = sp.segments, len = L * 1.9, rad = W * .32;
      spine = [];
      for (let i = 0; i <= n; i++) { const z = -len / 2 + i * len / n, taper = i < 2 ? .25 + i * .35 : 1 - Math.max(0, i - n + 2) * .2; spine.push({ p: [0, rad, z], rx: rad * taper, ry: rad * taper * .8 }); }
      spine.push({ p: [0, rad * 1.05, len / 2 + rad * 1.4], rx: rad * .65, ry: rad * .5 }, { p: [0, rad, len / 2 + rad * 2.1], rx: rad * .15, ry: rad * .12 });
    } else spine = [...sp0, ...body, ...neck, ...head];
    const path = catmull(spine, 3), tailBase = sp0[sp0.length - 1].p;
    tube(path, 12, skin, (pt) => serp ? A(SLITHER) : pt.tail ? A(SWAY, body[0].p, [0, 0, 0], 0, pt.tail) : A(BODY));
    if (!serp) {
      const H0 = head[0].p;
      eyesAt([0, hy + hd * .12, hz + hd * .42], hd * .5, hd, sp.eyes.forward);
      if (sp.horns) for (let i = 0; i < sp.horns; i++) {
        const side = sp.horns === 1 ? 0 : (i % 2 ? 1 : -1) * (1 + Math.floor(i / 2) * .5), hp = [];
        for (let k = 0; k <= 4; k++) hp.push({ p: [side * hd * (.25 + k * .08), hy + hd * (.35 + k * .22), hz + hd * (.1 - k * .12)], rx: hd * .09 * (1 - k / 5), ry: hd * .09 * (1 - k / 5) });
        tube(hp, 6, () => horn, () => A(BODY), { capStart: false });
      } else if (sp.crest) {
        const cp = []; for (let k = 0; k <= 4; k++) cp.push({ p: [0, hy + hd * (.4 + Math.sin(k / 4 * Math.PI) * .25), hz - hd * (.2 + k * .2)], rx: hd * .04, ry: hd * .12 * (1 - k / 6) });
        tube(cp, 6, () => accent, () => A(BODY));
      }
      // --- Legs ---
      const pairs = sp.legs / 2;
      for (let i = 0; i < pairs; i++) {
        const z = pairs === 1 ? -L * .12 : L * .3 - i * (L * .62) / (pairs - 1);
        const front = pairs > 1 && i === 0;
        for (const side of [-1, 1]) {
          const hipY = bodyY + lift(z) - H * .15, hipX = side * W * (hexa ? .3 : .3);
          const thick = s * (hexa ? .032 : .06) * (biped ? 1.35 : 1) * (sp.traits.diet === 'herbivore' ? 1.1 : .95);
          const phase = ((i + (side > 0 ? 1 : 0)) % 2) * Math.PI;
          let knee, ankle, toe;
          if (hexa) { // insect: knee up and out, foot out and down
            knee = [side * (W * .3 + legY * .55), hipY + legY * .35, z]; ankle = [side * (W * .3 + legY * 1.05), legY * .12, z + legY * .05]; toe = [side * (W * .3 + legY * 1.2), 0, z + legY * .08];
          } else {
            const kneeDir = front || biped ? .14 : -.16; // front knees forward, hind hocks back
            knee = [hipX * 1.05, hipY * .5, z + legY * kneeDir]; ankle = [hipX * 1.05, legY * .1, z - legY * kneeDir * .4]; toe = [hipX * 1.05, 0, z + legY * .14];
          }
          const hip = [hipX, hipY + H * .1, z]; // rooted inside the body
          limb([hip, knee, ankle, toe], [thick * 1.5, thick, thick * .65, thick * .5], LEG, SHIN, hip, knee, phase, front || hexa ? -1 : 1, flyer ? belly : base);
          ellipsoid([toe[0], thick * .35, toe[2] + thick * .5], [thick * 1.1, thick * .45, thick * 1.7], belly.clone().lerp(dark, .4), A(SHIN, hip, knee, phase, front || hexa ? -1 : 1), 0);
        }
      }
      // --- Arms with hands, for species clever enough to use them ---
      if (sp.arms) for (const side of [-1, 1]) {
        const sz = L * .42, shY = bodyY + lift(sz) + H * .1, sx = side * W * .42, armL = legY * .65;
        const shoulder = [sx * .8, shY, sz], elbow = [sx * 1.15, shY - armL * .5, sz + armL * .08], hand = [sx * 1.1, shY - armL * .95, sz + armL * .25];
        limb([shoulder, elbow, hand], [s * .05, s * .035, s * .03], ARM, FOREARM, shoulder, elbow, side > 0 ? 0 : Math.PI, 1, base);
        ellipsoid(hand, [s * .045, s * .04, s * .05], belly, A(FOREARM, shoulder, elbow, side > 0 ? 0 : Math.PI, 1), 1);
      }
      // --- Wings: a bony leading edge with a membrane back to the body ---
      if (flyer) for (const side of [-1, 1]) {
        const span = sp.wingSpan / 2, root = [side * W * .35, bodyY + H * .2, L * .12], pos = [], colr = [], an = [], idx = [];
        const pivot = root;
        const edge = [root, [side * span * .45, root[1] + s * .12, L * .22], [side * span, root[1] + s * .05, L * .02]];
        const trail = [[side * W * .35, bodyY + H * .15, -L * .25], [side * span * .5, root[1], -L * .2], [side * span * .95, root[1], -L * .05]];
        for (let i = 0; i < 3; i++) for (const p of [edge[i], trail[i]]) { pos.push(...p); colr.push(i ? accent.clone().lerp(base, .3) : base); an.push(A(WING, pivot, [0, 0, 0], side)); }
        for (let i = 0; i < 2; i++) { const a = i * 2, b1 = a + 1, c1 = a + 2, d = a + 3; side > 0 ? idx.push(a, c1, b1, b1, c1, d, a, b1, c1, b1, d, c1) : idx.push(a, b1, c1, b1, d, c1, a, c1, b1, b1, c1, d); }
        parts.push({ pos, colr, an, idx, flat: true });
        tube(edge.map((p, i) => ({ p, rx: s * .03 * (1 - i * .3), ry: s * .03 * (1 - i * .3) })), 5, () => base, () => A(WING, pivot, [0, 0, 0], side));
      }
    } else {
      const head = spine[spine.length - 2].p;
      eyesAt([0, head[1] + W * .1, head[2] + W * .1], W * .28, W * .6, 1.0);
    }
  }

  // Eyes: a pale eyeball with a dark pupil, set into the head. forward: 0 = facing
  // ahead (hunters, for depth perception) ... 1+ = on the sides (grazers, wide view).
  function eyesAt(center, spread, hdSize, forward) {
    const n = sp.eyes?.count ?? 2, er = hdSize * (sp.eyes?.size ?? .1);
    for (let i = 0; i < n; i++) {
      // Extra pairs sit further back along the sides of the head, not stacked on top.
      const row = Math.floor(i / 2), side = i % 2 ? 1 : -1, yaw = side * (.35 + forward * .55 + row * .3), y = center[1] + row * er * .5;
      const ex = center[0] + Math.sin(yaw) * spread * (1 - row * .06), ez = center[2] + Math.cos(yaw) * spread * .55 - row * er * 2.6;
      ellipsoid([ex, y, ez], [er, er, er], eyeC.clone().lerp(white, .25), A(sp.plan === 'serpent' ? SLITHER : BODY), 1);
      ellipsoid([ex + Math.sin(yaw) * er * .55, y, ez + Math.cos(yaw) * er * .55], [er * .55, er * .62, er * .55], dark, A(sp.plan === 'serpent' ? SLITHER : BODY), 0);
    }
  }

  // Merge parts. Tubes keep shared vertices (smooth normals); small rigid parts
  // (eyes, feet, wing membranes) get their own normals.
  const pos = [], colr = [], part = [], pivot = [], knee = [], phase = [], bend = [], normal = [];
  for (const p of parts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
    g.setIndex(p.idx);
    if (!p.nor) g.computeVertexNormals();
    if (p.nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3));
    const ni = g.toNonIndexed(), P = ni.attributes.position.array, N = ni.attributes.normal.array;
    for (let i = 0; i < p.idx.length; i++) {
      const v = p.idx[i], a = p.an[v], cc = p.colr[v];
      pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); normal.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
      colr.push(cc.r, cc.g, cc.b); part.push(a.part); pivot.push(...a.pivot); knee.push(...a.knee); phase.push(a.phase); bend.push(a.bend);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute('aPivot', new THREE.Float32BufferAttribute(pivot, 3));
  g.setAttribute('aKnee', new THREE.Float32BufferAttribute(knee, 3));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  g.setAttribute('aBend', new THREE.Float32BufferAttribute(bend, 1));
  g.computeBoundingSphere();
  return g;
}
