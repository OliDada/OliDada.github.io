// Builds, animates and moves the animals on the world you are on. Each species is
// one model drawn with instancing (one draw call). Bodies are a single smooth tube
// swept along a spine (tail, hips, belly, shoulders, neck, skull, snout) and limbs
// are jointed tubes rooted inside the body, so everything connects. On top of that
// each species carries its own features (head shape, jaws, beaks, ears, antennae,
// frills, shells, spines, sails, tail clubs and fans, claws or hooves), colour
// scheme and pattern, and optional glowing markings. Legs (with
// knees), arms, wings, tails and tentacles are animated in the vertex shader from a
// per-animal gait cycle, so dozens of animals cost almost nothing. A small behaviour model moves
// each animal across the sphere: herds wander and graze, skittish animals bolt
// from you, curious ones come closer, flyers and floaters drift overhead. THREE is passed in.
import { rng } from './rng.mjs';
import { faunaFor, habitatFit } from './fauna.mjs';

// Vertex roles for animation.
const BODY = 0, LEG = 1, WING = 2, SWAY = 3, SLITHER = 4, SHIN = 5, ARM = 6, FOREARM = 7, RLEG = 9, ROLL = 10;
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
        const away = tangent(toPlayer.clone().negate(), c.n);
        if (c.heading.dot(away) < -.5) away.addScaledVector(c.n.clone().cross(c.heading), 1.2); // wheel round rather than freeze when you are dead ahead
        c.heading.lerp(away, Math.min(1, dt * 6)); c.target = sp.speed.run; c.state = 'flee'; reacting = true;
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
    // Rollers turn once per circumference travelled, so they really roll.
    const stride = sp.plan === 'roller' ? sp.size * .5 : Math.max(.3, sp.legLength * 1.6 || sp.size);
    c.cycle += flying ? dt * (sp.plan === 'floater' ? 1.2 : 5) : c.speed * dt / stride * (sp.plan === 'roller' ? 1 : Math.PI);
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
// the foot on the forward swing); arms swing opposite to the legs; wings and fins
// flap about the body axis; tails, antennae and tentacles curl toward the tip;
// coils ripple. Normals get the same rotations so the lighting moves with the
// limbs. Glowing markings (aGlow) add their own light in the fragment shader.
function addAnimation(material, sp) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSize = { value: sp.size };
    shader.vertexShader = `attribute float aPart; attribute vec3 aPivot; attribute vec3 aKnee; attribute float aPhase; attribute float aBend; attribute float aGlow; attribute vec2 iAnim; uniform float uSize; varying float vGlow;
mat3 rX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
vec3 rotK(vec3 v, vec3 k, float a) { return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1. - cos(a)); }
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
    mat3 t = rY(sin(cyc * .5 + aPhase) * .4 * aBend) * rX(sin(cyc * .37 + aPhase) * .12 * aBend); p = t * (p - aPivot) + aPivot; n = t * n;
  } else if (aPart == 4.) {
    p.x += sin(cyc * 1.5 - p.z * 6. / uSize) * uSize * .1 * (.3 + amp);
  } else if (aPart == 9.) {
    // Radial legs (aKnee holds the leg's outward direction): lift the foot, then swing it round.
    float ph = cyc + aPhase; vec3 k = normalize(cross(aKnee, vec3(0., 1., 0.)));
    float lift = max(0., sin(ph)) * .45 * amp * aBend, yaw = cos(ph) * .22 * amp;
    p = rotK(p - aPivot, k, lift) + aPivot; n = rotK(n, k, lift);
    mat3 y = rY(yaw); p = y * (p - aPivot) + aPivot; n = y * n;
  } else if (aPart == 10.) {
    mat3 r = rX(cyc); p = r * (p - aPivot) + aPivot; n = r * n;
  }
  if (aPart != 2. && aPart != 10. && aPivot.y >= 0.) p.y += abs(sin(cyc)) * amp * uSize * .025;
}
` + shader.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 cP = position; vec3 cN = objectNormal; creaturePose(cP, cN); objectNormal = cN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = cP; vGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * vGlow * 1.4;\n#endif');
  };
  material.customProgramCacheKey = () => 'fauna-v4';
}

// --- Geometry ---------------------------------------------------------------
function catmull(pts, sub) {
  // Smooth control points ({ p:[x,y,z], rx, ry, ...extra }) with Catmull-Rom.
  const out = [];
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t, e = t2 * (3 - 2 * t);
      const cr = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ ...p1, p: [0, 1, 2].map(j => cr(p0.p[j], p1.p[j], p2.p[j], p3.p[j])), rx: lerp(p1.rx, p2.rx, e), ry: lerp(p1.ry, p2.ry, e),
        tail: lerp(p1.tail ?? 0, p2.tail ?? 0, t), t: (i + t) / (pts.length - 1) });
    }
  }
  out.push({ ...pts[pts.length - 1], t: 1 });
  return out;
}

function buildGeometry(THREE, sp, r) {
  const parts = [], s = sp.size, b = sp.body, c = sp.colors, tr = sp.traits;
  const col = (hex) => new THREE.Color(hex);
  const base = col(c.base), belly = col(c.belly), accent = col(c.accent), shimmer = col(c.shimmer || c.accent), eyeC = col(c.eye), horn = col(c.horn), glowC = col(c.glow || c.accent);
  const dark = new THREE.Color(.04, .04, .045), white = new THREE.Color(.94, .92, .86);
  const A = (part = BODY, pivot = [0, 0, 0], knee = [0, 0, 0], phase = 0, bend = 0) => ({ part, pivot, knee, phase, bend });
  const V3 = (a) => new THREE.Vector3(...a);
  const add3 = (a, b2, k = 1) => [a[0] + b2[0] * k, a[1] + b2[1] * k, a[2] + b2[2] * k];
  const glowLevel = sp.glow || 0;

  // Sweep rings along a path. pt.mod(ang) can reshape a ring (ribs, scallops, flat bellies).
  function tube(path, seg, colorAt, animAt, { capStart = true, capEnd = true, glowAt = null, ref: fixedRef = null } = {}) {
    if (sp.facets) seg = Math.max(4, Math.round(seg * .45)); // silicon life: faceted, crystalline
    const pos = [], colr = [], an = [], idx = [], gl = [];
    const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(), u2 = new THREE.Vector3(), tng = new THREE.Vector3();
    path.forEach((pt, i) => {
      const prev = path[Math.max(0, i - 1)].p, next = path[Math.min(path.length - 1, i + 1)].p;
      tng.copy(V3(next).sub(V3(prev))).normalize();
      const ref = fixedRef ? V3(fixedRef) : Math.abs(tng.y) > .9 ? new THREE.Vector3(1, 0, 0) : up;
      right.crossVectors(ref, tng).normalize(); u2.crossVectors(tng, right).normalize();
      for (let k = 0; k < seg; k++) {
        const ang = k / seg * Math.PI * 2, cx = Math.cos(ang), sy = Math.sin(ang), m = pt.mod ? pt.mod(ang) : 1;
        const ry = pt.ry * (pt.flatBelly && sy < 0 ? .45 : 1);
        pos.push(pt.p[0] + (right.x * cx * pt.rx + u2.x * sy * ry) * m, pt.p[1] + (right.y * cx * pt.rx + u2.y * sy * ry) * m, pt.p[2] + (right.z * cx * pt.rx + u2.z * sy * ry) * m);
        colr.push(colorAt(pt, ang, sy, i)); an.push(animAt(pt, i)); gl.push(glowAt ? glowAt(pt, ang, sy) : 0);
      }
    });
    for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < seg; k++) {
      const a = i * seg + k, b1 = i * seg + (k + 1) % seg, c1 = a + seg, d = b1 + seg;
      idx.push(a, b1, c1, b1, d, c1); // counter-clockwise from outside
    }
    const cap = (i, back) => {
      const pt = path[i], center = pos.length / 3;
      pos.push(...pt.p); colr.push(colorAt(pt, -Math.PI / 2, 0, i)); an.push(animAt(pt, i)); gl.push(0);
      for (let k = 0; k < seg; k++) { const a = i * seg + k, b1 = i * seg + (k + 1) % seg; back ? idx.push(center, b1, a) : idx.push(center, a, b1); }
    };
    if (capStart) cap(0, true);
    if (capEnd) cap(path.length - 1, false);
    parts.push({ pos, colr, an, idx, gl });
  }
  function ellipsoid(center, radii, color, anim, detail = 1, glow = 0) {
    const g = new THREE.IcosahedronGeometry(1, detail), P = g.attributes.position.array, pos = [], colr = [], an = [], idx = [], nor = [], gl = [];
    for (let i = 0; i < P.length; i += 3) {
      pos.push(center[0] + P[i] * radii[0], center[1] + P[i + 1] * radii[1], center[2] + P[i + 2] * radii[2]);
      const nx = P[i] / radii[0], ny = P[i + 1] / radii[1], nz = P[i + 2] / radii[2], l = Math.hypot(nx, ny, nz);
      nor.push(nx / l, ny / l, nz / l); colr.push(color); an.push(anim); idx.push(i / 3); gl.push(glow);
    }
    parts.push({ pos, colr, an, idx, nor, gl });
  }
  // A tapering horn, spike or claw from base toward tip, optionally bent.
  function spike(baseP, tipP, radius, color, anim, { bendDir = null, bend = 0, glow = 0 } = {}) {
    const path = [];
    for (let k = 0; k <= 4; k++) {
      const f = k / 4, q = baseP.map((v, j) => v + (tipP[j] - v) * f), off = bendDir ? Math.sin(f * Math.PI) * bend : 0;
      path.push({ p: bendDir ? add3(q, bendDir, off) : q, rx: radius * (1 - f * .92), ry: radius * (1 - f * .92) });
    }
    tube(path, 6, () => color, typeof anim === 'function' ? anim : () => anim, { capStart: false, glowAt: () => glow });
  }
  // Thin double-sided membrane (sails, fins, frills, wings): a strip between two edges.
  function membrane(edgeA, edgeB, colorAt, anim) {
    const pos = [], colr = [], an = [], idx = [], gl = [];
    for (let i = 0; i < edgeA.length; i++) for (const [p, w] of [[edgeA[i], 0], [edgeB[i], 1]]) {
      pos.push(...p); colr.push(colorAt(i / (edgeA.length - 1), w)); an.push(typeof anim === 'function' ? anim(i / (edgeA.length - 1), w) : anim); gl.push(0);
    }
    // Two faces with their own vertices, so each side gets a proper normal.
    const n = pos.length / 3;
    pos.push(...pos); colr.push(...colr); an.push(...an); gl.push(...gl);
    for (let i = 0; i < edgeA.length - 1; i++) { const a = i * 2, b1 = a + 1, c1 = a + 2, d = a + 3; idx.push(a, c1, b1, b1, c1, d, n + a, n + b1, n + c1, n + b1, n + d, n + c1); }
    parts.push({ pos, colr, an, idx, gl, flat: true });
  }

  // Skin colour: countershading plus the species' pattern and scheme.
  const ps = sp.patternScale || 1, seed = sp.seed % 997;
  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453; return v - Math.floor(v); };
  const skin = (pt, ang, sy) => {
    const t = pt.t ?? 0;
    let cc = belly.clone().lerp(base, Math.min(1, Math.max(0, (sy + .25) / .6)));
    if (sp.scheme === 'iridescent') cc.lerp(shimmer, .5 + .5 * Math.sin(t * 9 + ang * 2));
    const top = sy > .1, mark = (() => {
      switch (sp.pattern) {
        case 'stripes': return top && Math.sin(t * 34 * ps + seed) > .45;
        case 'bands': return Math.sin(t * 22 * ps + seed) > .35;                 // all the way round
        case 'rings': return Math.abs(Math.sin(t * 16 * ps + seed)) > .9;
        case 'spots': return top && Math.sin(t * 61 * ps + ang * 7.3) * Math.sin(t * 23 * ps - ang * 5.1) > .55;
        case 'mottled': return hash(Math.floor(t * 40 * ps), Math.floor(ang * 5)) > .62;
        case 'dapple': return top && hash(Math.floor(t * 70 * ps), Math.floor(ang * 9)) > .78;
        case 'saddle': return top && t > .32 && t < .62;
        case 'gradient': cc.lerp(accent, Math.max(0, t - .3) * .9); return false;
        default: return false;
      }
    })();
    if (mark) cc.lerp(accent, .78);
    return cc;
  };
  // Glowing markings: spots or lines along the flanks.
  const skinGlow = (pt, ang, sy) => glowLevel && Math.abs(sy) < .35 && Math.sin((pt.t ?? 0) * 40 + seed) > .55 ? glowLevel : 0;

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
  function foot(toe, thick, anim) {
    const fc = belly.clone().lerp(dark, .45);
    if (sp.feet === 'hoof') limbStub(toe, thick, dark.clone().lerp(horn, .3), anim);
    else if (sp.feet === 'claw') for (const dx of [-1, 0, 1]) spike([toe[0] + dx * thick * .6, thick * .3, toe[2]], [toe[0] + dx * thick * .9, 0, toe[2] + thick * 2.2], thick * .35, horn.clone().lerp(dark, .3), anim);
    ellipsoid([toe[0], thick * .35, toe[2] + thick * .5], [thick * 1.1, thick * .45, thick * 1.6], fc, anim, 0);
  }
  function limbStub(toe, thick, color, anim) { tube([{ p: [toe[0], thick * .9, toe[2]], rx: thick * .9, ry: thick * .9 }, { p: [toe[0], 0, toe[2]], rx: thick * 1.05, ry: thick * 1.05 }], 7, () => color, () => anim); }

  // Eyes: a pale eyeball with a dark pupil set into the head. forward: 0 = facing
  // ahead (hunters, for depth perception) ... 1+ = on the sides (grazers, wide view).
  function eyesAt(center, spread, hdSize, forward, anim = A(BODY)) {
    const n = sp.eyes?.count ?? 2, er = hdSize * (sp.eyes?.size ?? .1), eg = glowLevel > .6 ? glowLevel * .6 : 0;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 2), side = n % 2 && i === n - 1 ? 0 : i % 2 ? 1 : -1, yaw = side * (.35 + forward * .55 + row * .3), y = center[1] + row * er * .5 + (side ? 0 : er * 1.4);
      const ex = center[0] + Math.sin(yaw) * spread * (1 - row * .06), ez = center[2] + Math.cos(yaw) * spread * .55 - row * er * 2.6;
      ellipsoid([ex, y, ez], [er, er, er], eyeC.clone().lerp(white, .25), anim, 1, eg);
      ellipsoid([ex + Math.sin(yaw) * er * .55, y, ez + Math.cos(yaw) * er * .55], [er * .55, er * .62, er * .55], dark, anim, 0);
    }
  }

  const plan = sp.plan, form = sp.form;
  if (plan === 'floater') buildFloater(); else if (plan === 'radial') buildRadial(); else if (plan === 'roller') buildRoller(); else buildSpineAnimal();

  // ---- Radial walkers: no head, no front; legs all round a central body ----
  function buildRadial() {
    const n = sp.legs, ly = sp.legLength * (form === 'tripod' ? 1.9 : form === 'star' ? .7 : 1.1), R = s * (form === 'star' ? .22 : .28);
    const bodyY = form === 'tripod' ? ly * .85 : form === 'star' ? ly * .45 : ly * .7;
    // Body: a squat dome (star), a slung pod (tripod) or a tall ridged mantle (octo).
    const prof = form === 'octo' ? [[-.3, .55], [0, .9], [.5, 1], [1, .85], [1.5, .5], [1.75, .08]]
      : form === 'tripod' ? [[-.55, .2], [-.4, .75], [0, 1], [.35, .8], [.5, .2]]
      : [[-.3, .6], [0, 1], [.25, .8], [.42, .3]];
    const lobes = sp.lobes || 8, ribs = sp.ribs ?? .05;
    const path = prof.map(([y, rr], i) => ({ p: [0, bodyY + y * R, 0], rx: rr * R, ry: rr * R, t: i / (prof.length - 1), mod: (ang) => 1 + ribs * Math.cos(n * ang) }));
    tube(path, 20, (pt, ang) => skin({ t: pt.t }, ang * 3, pt.t * 2 - 1).lerp(accent, Math.cos(n * ang) > .85 ? .3 : 0), () => A(BODY), { glowAt: (pt, ang) => glowLevel && Math.cos(n * ang) > .9 ? glowLevel : 0 });
    // Legs, evenly spaced; neighbours step in alternation.
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + (form === 'tripod' ? Math.PI / 2 : 0), dir = [Math.sin(a), 0, Math.cos(a)];
      const hip = [dir[0] * R * .7, bodyY - R * .1, dir[2] * R * .7], phase = (i % 2) * Math.PI + i * .4;
      const anim = (pt) => A(RLEG, hip, dir, phase, 1);
      const pts = form === 'octo'
        ? [hip, [dir[0] * (R + ly * .45), bodyY - ly * .05, dir[2] * (R + ly * .45)], [dir[0] * (R + ly * .8), ly * .3, dir[2] * (R + ly * .8)], [dir[0] * (R + ly * .95), 0, dir[2] * (R + ly * .95)], [dir[0] * (R + ly * 1.15), ly * .05, dir[2] * (R + ly * 1.15)]]
        : form === 'tripod'
        ? [hip, [dir[0] * (R + ly * .35), bodyY + ly * .3, dir[2] * (R + ly * .35)], [dir[0] * (R + ly * .75), ly * .2, dir[2] * (R + ly * .75)], [dir[0] * (R + ly * .8), 0, dir[2] * (R + ly * .8)]]
        : [hip, [dir[0] * (R + ly * .55), bodyY + ly * .1, dir[2] * (R + ly * .55)], [dir[0] * (R + ly * 1.1), ly * .1, dir[2] * (R + ly * 1.1)], [dir[0] * (R + ly * 1.35), 0, dir[2] * (R + ly * 1.35)]];
      const thick = s * (form === 'star' ? .1 : form === 'octo' ? .07 : .045), lp = catmull(pts.map((p, k) => ({ p, rx: thick * (1 - k / pts.length * .8), ry: thick * (1 - k / pts.length * .8) })), 3);
      tube(lp, 8, (pt, ang, sy) => (form === 'star' ? skin({ t: pt.t }, ang, sy) : base.clone().lerp(belly, Math.max(0, -sy) * .5)).lerp(accent, form === 'octo' && sy < -.5 && Math.sin(pt.t * 50) > .3 ? .6 : 0), anim,
        { glowAt: (pt) => glowLevel && pt.t > .9 ? glowLevel : 0 });
      // Star walkers see from eyespots near their arm tips.
      if (form === 'star') { const tip = pts[2]; ellipsoid([tip[0], tip[1] + thick * .6, tip[2]], [thick * .4, thick * .4, thick * .4], eyeC, A(RLEG, hip, dir, phase, 1), 1, glowLevel ? .6 : 0); }
    }
    // Eyes: a ring round the body, or on a stalk on top (tripod).
    const ringY = form === 'tripod' ? bodyY + R * .6 + s * .35 : bodyY + R * .25, ringR = form === 'tripod' ? s * .08 : R * .92;
    if (form === 'tripod') {
      const stalk = [{ p: [0, bodyY + R * .4, 0], rx: s * .04, ry: s * .04 }, { p: [s * .03, ringY - s * .15, 0], rx: s * .03, ry: s * .03 }, { p: [0, ringY, 0], rx: s * .06, ry: s * .06 }];
      tube(catmull(stalk, 3), 8, () => base.clone().lerp(dark, .2), (pt) => A(SWAY, [0, bodyY + R * .4, 0], [0, 0, 0], 0, pt.t * .3));
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2, P2 = [0, bodyY - R * .5, 0], path2 = []; for (let j = 0; j <= 6; j++) { const f = j / 6; path2.push({ p: [Math.sin(a) * R * .3 + Math.sin(f * 4 + k) * s * .03, P2[1] - f * ly * .45, Math.cos(a) * R * .3], rx: s * .02 * (1 - f * .7), ry: s * .02 * (1 - f * .7), t: f }); } tube(path2, 5, () => accent, (pt) => A(SWAY, P2, [0, 0, 0], k, pt.t)); }
    }
    const ne = Math.max(4, sp.eyes.count) * (form === 'octo' ? 1 : 1);
    if (form !== 'star') for (let k = 0; k < ne; k++) {
      const a = k / ne * Math.PI * 2, er = (form === 'tripod' ? s * .035 : s * sp.eyes.size * .5), ex = Math.sin(a) * ringR, ez = Math.cos(a) * ringR;
      const anim = form === 'tripod' ? A(SWAY, [0, bodyY + R * .4, 0], [0, 0, 0], 0, .3) : A(BODY);
      ellipsoid([ex, ringY, ez], [er, er, er], eyeC.clone().lerp(white, .25), anim, 1, glowLevel > .6 ? .5 : 0);
      ellipsoid([ex * (1 + er / ringR * .6), ringY, ez * (1 + er / ringR * .6)], [er * .5, er * .6, er * .5], dark, anim, 0);
    }
    // Spines or crystals on the dome for defensive or silicon species.
    if (sp.back === 'spines' || sp.back === 'plates' || sp.facets) for (let k = 0; k < n * 2; k++) {
      const a = (k + .5) / (n * 2) * Math.PI * 2, top = prof[prof.length - 2], y0 = bodyY + top[0] * R, r0 = top[1] * R * .9;
      spike([Math.sin(a) * r0 * .8, y0, Math.cos(a) * r0 * .8], [Math.sin(a) * r0 * 1.3, y0 + s * .18, Math.cos(a) * r0 * 1.3], s * .03, sp.facets ? accent : horn, A(BODY), { glow: sp.facets ? glowLevel * .7 : 0 });
    }
  }

  // ---- Rollers: living wheels and balls ----
  function buildRoller() {
    const R = s * .5, hub = [0, R, 0];
    if (form === 'wheel') {
      // Rim: a thick ring in the y-z plane that rolls; spokes; a hub that stays upright.
      const rim = [], m = 24;
      for (let k = 0; k <= m; k++) { const a = k / m * Math.PI * 2; rim.push({ p: [0, R + Math.cos(a) * R * .82, Math.sin(a) * R * .82], rx: s * .1, ry: s * .14, t: k / m, mod: (ang) => 1 + .12 * Math.max(0, Math.cos(ang)) * (k % 2) }); }
      tube(rim, 10, (pt, ang) => skin({ t: pt.t }, ang, Math.cos(ang)).lerp(dark, Math.abs(Math.cos(ang)) > .9 ? .25 : 0), () => A(ROLL, hub), { capStart: false, capEnd: false, ref: [1, 0, 0], glowAt: (pt, ang) => glowLevel && Math.abs(Math.sin(ang)) > .9 && Math.sin(pt.t * 40) > .5 ? glowLevel : 0 });
      const spokes = 5 + (sp.seed % 4);
      for (let k = 0; k < spokes; k++) { const a = k / spokes * Math.PI * 2; tube([{ p: hub, rx: s * .06, ry: s * .04 }, { p: [0, R + Math.cos(a) * R * .8, Math.sin(a) * R * .8], rx: s * .035, ry: s * .025 }], 6, () => belly, () => A(ROLL, hub), { capStart: false }); }
      ellipsoid(hub, [s * .2, R * .26, R * .26], base.clone().lerp(dark, .15), A(BODY), 2);
      for (const side of [-1, 1]) {
        eyesAt([side * s * .14, R + R * .02, 0], R * .12, R * .5, 1, A(BODY));
        if (sp.antennae || sp.crest) spike([side * s * .16, R + R * .15, 0], [side * s * .3, R + R * .55, -R * .1], s * .02, accent, A(SWAY, hub, [0, 0, 0], side, .4));
      }
    } else {
      // Ball: overlapping armour bands round an axle; eyes at both ends of the axle.
      const bands = 7 + (sp.seed % 4);
      for (let k = 0; k < bands; k++) {
        const x = -R * .85 + k / (bands - 1) * R * 1.7, rr = Math.sqrt(Math.max(.04, 1 - (x / R) ** 2)) * R, w = R * 1.7 / bands * .7;
        tube([{ p: [x - w, R, 0], rx: rr * .92, ry: rr * .92 }, { p: [x, R, 0], rx: rr, ry: rr }, { p: [x + w, R, 0], rx: rr * .9, ry: rr * .9 }], 18,
          (pt, ang) => (k % 2 ? base : base.clone().lerp(accent, .35)).clone().lerp(dark, Math.abs(Math.sin(ang * 3)) > .97 ? .3 : 0), () => A(ROLL, hub),
          { glowAt: (pt, ang) => glowLevel && Math.sin(ang * 6) > .85 ? glowLevel : 0 });
      }
      for (const side of [-1, 1]) {
        ellipsoid([side * R * .95, R, 0], [s * .06, R * .22, R * .22], belly, A(BODY), 1);
        const n = Math.min(3, Math.max(1, Math.floor(sp.eyes.count / 2)));
        for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * .6, er = s * .05; ellipsoid([side * R * 1.02, R + Math.sin(a) * R * .12, Math.cos(a) * R * .1], [er, er, er], eyeC.clone().lerp(white, .25), A(BODY), 1, glowLevel > .6 ? .5 : 0); ellipsoid([side * (R * 1.02 + er * .6), R + Math.sin(a) * R * .12, Math.cos(a) * R * .1], [er * .5, er * .55, er * .5], dark, A(BODY), 0); }
        if (sp.back === 'spines') for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; spike([side * R * .3, R + Math.cos(a) * R * .9, Math.sin(a) * R * .9], [side * R * .35, R + Math.cos(a) * R * 1.25, Math.sin(a) * R * 1.25], s * .03, horn, A(ROLL, hub)); }
      }
    }
  }

  // ---- Floaters: bells, balloons, mantas and bladder clusters ----
  function buildFloater() {
    const R = s * .5, lobes = sp.lobes || 10, ribs = sp.ribs ?? .05, frills = sp.frills ?? .08;
    const tentacle = (x, y, z, len, i, thick = .045) => {
      const a = Math.atan2(z, x), path = [];
      for (let k = 0; k <= 9; k++) { const f = k / 9, curl = Math.sin(f * 2.6 + i) * s * .14; path.push({ p: [x * (1 + f * .4) + Math.cos(a) * curl, y - len * f, z * (1 + f * .4) + Math.sin(a) * curl], rx: s * thick * (1 - f * .85), ry: s * thick * (1 - f * .85), w: f, t: f }); }
      tube(path, 6, (pt) => accent.clone().lerp(belly, .3 + pt.w * .5), (pt) => A(SWAY, [x, y, z], [0, 0, 0], i * .9, pt.w), { glowAt: (pt) => glowLevel && pt.w > .7 ? glowLevel : 0 });
    };
    if (form === 'bell' || !form) {
      // Jellyfish bell: domed top, ribbed sides, scalloped rim; frilly mouth-arms and fine tentacles beneath.
      const flat = .55 + r() * .4, prof = [[.95, .06], [.85, .5], [.6, .82], [.3, .97], [0, 1.03], [-.18, 1.08]];
      const path = prof.map(([y, rr], i) => ({ p: [0, y * R * flat, 0], rx: rr * R, ry: rr * R, t: i / (prof.length - 1),
        mod: (ang) => 1 + ribs * Math.cos(lobes * ang) * (i > 0 ? 1 : 0) + (i === prof.length - 1 ? frills * Math.cos(lobes * 2 * ang) : 0) }));
      tube(path, 32, (pt, ang, sy) => base.clone().lerp(shimmer, sp.scheme === 'iridescent' ? .5 + .5 * Math.sin(ang * 3) : pt.t * .4).lerp(accent, Math.cos(lobes * ang) > .7 ? .35 : 0),
        () => A(BODY), { glowAt: (pt, ang) => glowLevel && pt.t > .8 && Math.cos(lobes * ang) > .6 ? glowLevel : 0 });
      const rimY = -.18 * R * flat;
      for (let i = 0; i < Math.min(5, 2 + (sp.seed % 4)); i++) {
        const a = i / 4 * Math.PI * 2, x = Math.cos(a) * R * .2, z = Math.sin(a) * R * .2, path2 = [];
        for (let k = 0; k <= 8; k++) { const f = k / 8; path2.push({ p: [x + Math.sin(f * 5 + i) * s * .06, rimY - R * .2 - f * s * .9, z + Math.cos(f * 5 + i) * s * .06], rx: s * .08 * (1 - f * .6), ry: s * .05 * (1 - f * .6), w: f, t: f, mod: (ang) => 1 + .35 * Math.sin(ang * 5 + f * 20) }); }
        tube(path2, 10, (pt) => accent.clone().lerp(belly, pt.w * .4), (pt) => A(SWAY, [x, rimY, z], [0, 0, 0], i * 1.7, pt.w));
      }
      for (let i = 0; i < sp.tentacles; i++) { const a = i / sp.tentacles * Math.PI * 2; tentacle(Math.cos(a) * R * .98, rimY, Math.sin(a) * R * .98, s * (.9 + r() * .9), i, .022); }
      for (let i = 0; i < Math.max(4, (sp.eyes.count || 2) * 2); i++) {
        const a = i / Math.max(4, sp.eyes.count * 2) * Math.PI * 2;
        ellipsoid([Math.cos(a) * R * 1.02, rimY + R * .1, Math.sin(a) * R * 1.02], [R * .05, R * .05, R * .05], eyeC, A(BODY), 1, glowLevel ? .8 : .2);
      }
    } else if (form === 'balloon') {
      // Ribbed gas balloon with a fin crest and side fins; a small body hangs beneath with eyes and tentacles.
      const prof = [[1.05, .12], [.85, .7], [.45, 1], [0, .98], [-.4, .75], [-.68, .3]];
      const path = prof.map(([y, rr], i) => ({ p: [0, y * R, 0], rx: rr * R, ry: rr * R, t: i / (prof.length - 1), mod: (ang) => 1 + (ribs + .03) * Math.abs(Math.cos(lobes * ang / 2)) }));
      tube(path, 30, (pt, ang, sy) => skin({ t: pt.t }, ang, Math.cos(lobes * ang / 2)), () => A(BODY), { glowAt: (pt, ang) => glowLevel && Math.abs(Math.cos(lobes * ang / 2)) > .97 ? glowLevel * .7 : 0 });
      const top = R * 1.02; membrane([[0, top, -R * .5], [0, top + R * .05, 0], [0, top, R * .5]], [[0, top - R * .2, -R * .7], [0, top + R * .45, -R * .1], [0, top - R * .1, R * .6]], () => accent, A(BODY));
      for (const side of [-1, 1]) membrane([[side * R * .9, 0, -R * .3], [side * R * .95, 0, 0], [side * R * .9, 0, R * .3]], [[side * R * 1.5, -R * .1, -R * .45], [side * R * 1.7, 0, 0], [side * R * 1.5, -R * .1, R * .45]], (f, w) => accent.clone().lerp(shimmer, w), A(WING, [side * R * .9, 0, 0], [0, 0, 0], side * .4));
      const gy = -R * .82;
      ellipsoid([0, gy, 0], [R * .3, R * .22, R * .38], base.clone().lerp(dark, .2), A(BODY), 2);
      eyesAt([0, gy, R * .3], R * .18, R * .5, .5);
      for (let i = 0; i < Math.min(sp.tentacles, 8); i++) { const a = i / 8 * Math.PI * 2; tentacle(Math.cos(a) * R * .2, gy, Math.sin(a) * R * .2, s * (.6 + r() * .6), i); }
    } else if (form === 'manta') {
      // Flat glider: a wide, thin body with undulating wing-fins and a whip tail.
      const L = s * 1.1, path = [];
      for (let k = 0; k <= 8; k++) { const f = k / 8, z = -L / 2 + f * L; path.push({ p: [0, 0, z], rx: R * (.25 + Math.sin(f * Math.PI) * .45), ry: R * (.08 + Math.sin(f * Math.PI) * .14), t: f }); }
      tube(path, 16, skin, () => A(BODY), { glowAt: skinGlow });
      for (const side of [-1, 1]) {
        const edge = [], root = [];
        for (let k = 0; k <= 6; k++) { const f = k / 6, z = -L * .35 + f * L * .7; root.push([side * R * .4, 0, z]); edge.push([side * (R * .4 + Math.sin(f * Math.PI) * s * 1.1), Math.sin(f * Math.PI) * s * .05, z - Math.sin(f * Math.PI) * s * .25]); }
        membrane(root, edge, (f, w) => base.clone().lerp(accent, w * .6).lerp(shimmer, sp.scheme === 'iridescent' ? f * .5 : 0), A(WING, [side * R * .4, 0, 0], [0, 0, 0], side * .55));
        spike([side * R * .3, 0, L / 2 - s * .05], [side * R * .35, -s * .05, L / 2 + s * .22], s * .04, accent, A(BODY), { bendDir: [side, 0, 0], bend: s * .05 });
      }
      const tail = []; for (let k = 0; k <= 8; k++) { const f = k / 8; tail.push({ p: [0, 0, -L / 2 - f * s * 1.4], rx: s * .05 * (1 - f * .9), ry: s * .05 * (1 - f * .9), w: f, t: f }); }
      tube(tail, 6, () => base, (pt) => A(SWAY, [0, 0, -L / 2], [0, 0, 0], 0, pt.w));
      eyesAt([0, R * .05, L / 2 - s * .08], R * .45, R, 1.0);
    } else {
      // Cluster of ribbed gas bladders around a core.
      const n = sp.bladders || 4;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, rr = R * (.45 + r() * .25), cx = Math.cos(a) * R * .45, cz = Math.sin(a) * R * .45, cy = R * (.1 + r() * .3), path = [];
        for (let k = 0; k <= 6; k++) { const f = k / 6, w = Math.sin(f * Math.PI); path.push({ p: [cx, cy + rr * (1 - 2 * f), cz], rx: rr * Math.max(.08, w), ry: rr * Math.max(.08, w), t: f, mod: (ang) => 1 + ribs * Math.cos(lobes * ang) }); }
        tube(path, 20, (pt, ang) => (i % 2 ? base : shimmer).clone().lerp(accent, Math.cos(lobes * ang) > .8 ? .4 : 0), () => A(BODY), { glowAt: (pt) => glowLevel && pt.t > .45 && pt.t < .55 ? glowLevel : 0 });
      }
      ellipsoid([0, -R * .15, 0], [R * .35, R * .3, R * .35], base.clone().lerp(dark, .25), A(BODY), 2);
      eyesAt([0, -R * .1, R * .3], R * .22, R * .55, .6);
      for (let i = 0; i < Math.min(sp.tentacles, 10); i++) { const a = i / 10 * Math.PI * 2; tentacle(Math.cos(a) * R * .25, -R * .35, Math.sin(a) * R * .25, s * (.6 + r() * .7), i); }
    }
  }

  // ---- Everything with a spine ----
  function buildSpineAnimal() {
    const hexa = plan === 'hexapod', arach = plan === 'arachnid', bug = hexa || arach, biped = plan === 'biped', flyer = plan === 'flyer';
    const serp = plan === 'serpent', slug = plan === 'slug', g = sp.girth || { hips: .5, belly: .56, shoulders: .48 };
    let legY = sp.legLength * ({ tank: .7, prowler: .78, waddler: .65, harvestman: 1.6 }[form] || 1);
    const L = b.length * ({ prowler: 1.3, tank: 1.1, harvestman: .45, ant: 1.1 }[form] || 1), W = b.width * ({ tank: 1.35, roach: 1.4, waddler: 1.3 }[form] || 1), H = b.height * ({ prowler: .8, roach: .55, tank: 1.1, waddler: 1.35 }[form] || 1);
    const bodyY = serp || slug ? 0 : bug ? legY * (form === 'harvestman' ? .9 : .7) : legY + H * .3;
    const upright = biped ? (form === 'upright' ? .9 : form === 'raptor' ? .1 : form === 'waddler' ? .7 : .35) + tr.intelligence * .3 : form === 'hopper' ? -.12 : 0;
    const lift = (z) => z * Math.sin(upright);
    const hump = sp.back === 'hump' ? (sp.hump || .15) * 2 : 0;

    // Body spine (tail tip -> neck base).
    const sp0 = [];
    if (sp.tail > 0 && !serp && !slug) {
      const tl = sp.tail * (sp.tailType === 'whip' ? 1.5 : 1), thin = sp.tailType === 'whip' ? .5 : 1;
      if (sp.tailType === 'stinger') {
        // Scorpion tail: segments arching up and forward over the back.
        for (let k = 4; k >= 1; k--) { const a = k / 4 * Math.PI * .85; sp0.push({ p: [0, bodyY + Math.sin(a) * tl * .9, -L / 2 - Math.cos(a) * tl * .45 + (k === 4 ? tl * .3 : 0)], rx: W * .12 * (1 - k * .12), ry: H * .14 * (1 - k * .12), tail: k / 4, mod: (ang) => 1 + .12 * Math.cos(ang * 2) }); }
      } else {
        sp0.push({ p: [0, bodyY + lift(-L / 2) - tl * .25, -L / 2 - tl], rx: s * .015, ry: s * .015, tail: 1 });
        sp0.push({ p: [0, bodyY + lift(-L / 2) - tl * .1, -L / 2 - tl * .55], rx: W * .13 * thin, ry: H * .13 * thin, tail: .5 });
      }
    } else if (!serp && !slug) sp0.push({ p: [0, bodyY + lift(-L / 2), -L / 2 - W * .1], rx: W * .2, ry: H * .2, tail: 0 });
    const neckBase = [0, bodyY + lift(L / 2) + H * .15, L / 2];
    const body = [];
    if (serp || slug) {
      const n = sp.segments, len = (slug ? L * 1.1 : L * 1.9), rad = W * (slug ? .45 : .32);
      for (let i = 0; i <= n; i++) {
        const z = -len / 2 + i * len / n, taper = i < 2 ? .25 + i * .35 : 1 - Math.max(0, i - n + 2) * .2;
        body.push({ p: [0, rad * (slug ? .55 : 1), z], rx: rad * taper, ry: rad * taper * (slug ? .55 : .8), flatBelly: slug,
          mod: form === 'segmented' ? (ang) => 1 + .06 * Math.cos(ang * 6) : null });
      }
    } else if (form === 'ant' || (flyer && form === 'insect')) {
      // Three segments with narrow waists.
      body.push({ p: [0, bodyY + H * .1, -L * .55], rx: W * .2, ry: H * .2 }, { p: [0, bodyY + H * .15, -L * .35], rx: W * .55, ry: H * .55 }, { p: [0, bodyY, -L * .1], rx: W * .12, ry: H * .12 },
        { p: [0, bodyY, L * .12], rx: W * .38, ry: H * .4 }, { p: [0, bodyY, L * .35], rx: W * .14, ry: H * .14 });
    } else if (arach) {
      if (form === 'harvestman') body.push({ p: [0, bodyY, -L * .4], rx: W * .3, ry: H * .3 }, { p: [0, bodyY + H * .05, 0], rx: W * .62, ry: H * .55 }, { p: [0, bodyY, L * .4], rx: W * .3, ry: H * .3 });
      else body.push({ p: [0, bodyY + H * .2, -L * .75], rx: W * .25, ry: H * .25 }, { p: [0, bodyY + H * .3, -L * .45], rx: W * (form === 'scorpion' ? .45 : .75), ry: H * (form === 'scorpion' ? .35 : .75), mod: form === 'scorpion' ? (ang) => 1 + .08 * Math.cos(ang * 2) : null },
        { p: [0, bodyY, -L * .08], rx: W * .2, ry: H * .2 }, { p: [0, bodyY, L * .2], rx: W * .45, ry: H * .4 }, { p: [0, bodyY, L * .42], rx: W * .2, ry: H * .2 });
    } else {
      body.push(
        { p: [0, bodyY + lift(-L / 2), -L / 2], rx: W * .3, ry: H * .32 },
        { p: [0, bodyY + lift(-L * .32), -L * .32], rx: W * g.hips, ry: H * g.hips },
        { p: [0, bodyY + lift(0) - H * .04, 0], rx: W * (hexa ? .32 : g.belly), ry: H * (hexa ? .36 : g.belly) },
        { p: [0, bodyY + lift(L * .3) + hump * H * .5, L * .3], rx: W * g.shoulders, ry: H * (g.shoulders + hump) },
        { p: neckBase, rx: W * .3, ry: H * .32 });
    }
    // Neck and head.
    const neckLen = (sp.neck || 0) * (form === 'browser' ? 1.7 : 1);
    const headUp = neckLen * (biped ? .9 : .75), headFwd = neckLen * (biped ? .25 : .6);
    const hd = sp.head * (form === 'browser' ? .8 : 1), snout = sp.snout || 1, shape = flyer && form === 'bird' ? 'beaked' : sp.headShape || 'round';
    const neck = serp || slug || bug ? [] : neckLen > 0 ? [{ p: [0, neckBase[1] + headUp * .55, L / 2 + headFwd * .5], rx: s * .07 + W * .1, ry: s * .07 + H * .1 }] : [];
    const front = serp || slug ? body[body.length - 1].p : bug ? body[body.length - 1].p : null;
    const hz = front ? front[2] + hd * .35 : L / 2 + headFwd + hd * .3, hy = front ? front[1] + (slug ? hd * .2 : 0) : neckBase[1] + headUp;
    // Head shapes: [forward offset, half-width, half-height, drop] for skull, mid-head, snout and tip.
    const HEADS = {
      round:  [[0, .5, .48, 0], [.45, .52, .46, -.04], [.45 + .45 * snout, .3, .27, .06], [.5 + .65 * snout, .12, .11, .1]],
      long:   [[0, .42, .38, 0], [.5, .4, .34, .02], [.5 + .7 * snout, .22, .18, .08], [.55 + 1 * snout, .07, .06, .1]],
      wedge:  [[0, .56, .36, 0], [.42, .5, .3, .02], [.42 + .5 * snout, .26, .15, .05], [.45 + .75 * snout, .05, .04, .07]],
      flat:   [[0, .62, .3, 0], [.38, .64, .28, .03], [.38 + .38 * snout, .52, .2, .06], [.42 + .5 * snout, .3, .1, .06]],
      domed:  [[-.05, .48, .62, -.15], [.38, .46, .5, .02], [.38 + .32 * snout, .26, .22, .12], [.42 + .45 * snout, .1, .08, .14]],
      beaked: [[0, .48, .46, 0], [.45, .42, .4, .02], [.62, .26, .24, .08], [.72, .14, .13, .1]],
    };
    const head = (HEADS[shape] || HEADS.round).map(([f, w, h2, d]) => ({ p: [0, hy - d * hd, hz + f * hd], rx: hd * w, ry: hd * h2 }));
    const spine = serp || slug ? [...body, ...head.slice(1)] : [...sp0, ...body, ...neck, ...head];
    const path = catmull(spine, 3);
    tube(path, 14, skin, (pt) => serp ? A(SLITHER) : pt.tail ? A(SWAY, (body[0] || sp0[0]).p, [0, 0, 0], 0, pt.tail) : A(BODY), { glowAt: skinGlow });
    const snoutTip = head[head.length - 1].p, skull = head[0].p;
    const headAnim = serp ? A(SLITHER) : A(BODY);

    // Face: eyes, brow, jaw, beak, ears, antennae, mandibles, frill, horns, crest.
    eyesAt([0, skull[1] + hd * .12, skull[2] + hd * .42], hd * (shape === 'flat' ? .58 : .5), hd, slug ? 1 : sp.eyes.forward, headAnim);
    if (sp.brow && !bug && !slug) for (const side of [-1, 1]) ellipsoid([side * hd * .28, skull[1] + hd * .32, skull[2] + hd * .42], [hd * .22, hd * .07, hd * .14], base.clone().lerp(dark, .3), headAnim, 1);
    if (shape === 'beaked') spike([0, snoutTip[1], snoutTip[2] - hd * .05], [0, snoutTip[1] - hd * .25, snoutTip[2] + hd * (.5 + .4 * snout)], hd * .16, horn, headAnim, { bendDir: [0, 1, 0], bend: hd * .12 });
    if (sp.jaw && !bug && !slug && shape !== 'beaked') {
      const j = head[1].p, k = head[2].p, jaw = [{ p: [0, j[1] - hd * .25, j[2]], rx: hd * .3, ry: hd * .12 }, { p: [0, k[1] - hd * .32, k[2] + hd * .1], rx: hd * .2, ry: hd * .08 }, { p: [0, snoutTip[1] - hd * .32, snoutTip[2] - hd * .05], rx: hd * .08, ry: hd * .04 }];
      tube(jaw, 10, () => belly.clone().lerp(base, .3), () => headAnim);
      if (tr.diet === 'carnivore') for (const side of [-1, 1]) spike([side * hd * .12, k[1] - hd * .18, k[2] + hd * .15], [side * hd * .12, k[1] - hd * .36, k[2] + hd * .2], hd * .045, white, headAnim);
    }
    if (sp.ears === 'pointed') for (const side of [-1, 1]) spike([side * hd * .3, skull[1] + hd * .3, skull[2] - hd * .05], [side * hd * .55, skull[1] + hd * .9, skull[2] - hd * .35], hd * .14, base, headAnim);
    if (sp.ears === 'fan') for (const side of [-1, 1]) membrane([[side * hd * .35, skull[1] + hd * .1, skull[2] - hd * .1], [side * hd * .4, skull[1] + hd * .3, skull[2] - hd * .2]],
      [[side * hd * 1.1, skull[1] + hd * .1, skull[2] - hd * .4], [side * hd * .9, skull[1] + hd * .7, skull[2] - hd * .5]], (f, w) => base.clone().lerp(accent, w * .6), headAnim);
    if (sp.antennae) for (let i = 0; i < sp.antennae; i++) {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), bx = side * hd * (.2 + row * .1), by = skull[1] + hd * (.35 + row * .1), bz = skull[2] + hd * .3, ap = [];
      const len = hd * (slug ? 1.1 : 2.2 + r()), bendUp = slug ? 1 : .55;
      for (let k = 0; k <= 6; k++) { const f = k / 6; ap.push({ p: [bx + side * f * len * .35, by + f * len * bendUp, bz + f * len * (slug ? .2 : .75) - f * f * len * .3], rx: hd * .035 * (1 - f * .5), ry: hd * .035 * (1 - f * .5), w: f }); }
      tube(ap, 5, () => base.clone().lerp(dark, .3), (pt) => serp ? A(SLITHER) : A(SWAY, [bx, by, bz], [0, 0, 0], i * 1.3, pt.w * .6));
      const tip = ap[ap.length - 1].p;
      if (slug) { ellipsoid(tip, [hd * .1, hd * .1, hd * .1], eyeC.clone().lerp(white, .25), A(SWAY, [bx, by, bz], [0, 0, 0], i * 1.3, .6), 1); ellipsoid([tip[0], tip[1], tip[2] + hd * .06], [hd * .05, hd * .05, hd * .05], dark, A(SWAY, [bx, by, bz], [0, 0, 0], i * 1.3, .6), 0); }
      else if (glowLevel) ellipsoid(tip, [hd * .07, hd * .07, hd * .07], glowC, A(SWAY, [bx, by, bz], [0, 0, 0], i * 1.3, .6), 1, glowLevel);
    }
    if (sp.mandibles) for (const side of [-1, 1]) spike([side * hd * .25, snoutTip[1] - hd * .05, snoutTip[2] - hd * .1], [side * hd * .05, snoutTip[1] - hd * .1, snoutTip[2] + hd * .55], hd * .09, dark.clone().lerp(horn, .4), headAnim, { bendDir: [side, 0, 0], bend: hd * .2 });
    if (sp.frill && !bug && !slug && !serp) {
      const n = 9, inner = [], outer = [];
      for (let k = 0; k < n; k++) { const a = -Math.PI * .85 + k / (n - 1) * Math.PI * 1.7, ca = Math.cos(a), sa = Math.sin(a); inner.push([sa * hd * .45, skull[1] + ca * hd * .4, skull[2] - hd * .25]); outer.push([sa * hd * 1.3, skull[1] + ca * hd * 1.15, skull[2] - hd * .55 + (k % 2) * hd * .1]); }
      membrane(inner, outer, (f, w) => accent.clone().lerp(shimmer, w * .5 + (Math.floor(f * 8) % 2) * .2), headAnim);
    }
    if (sp.horns) for (let i = 0; i < sp.horns; i++) {
      const side = sp.horns === 1 ? 0 : (i % 2 ? 1 : -1) * (1 + Math.floor(i / 2) * .5), antler = sp.horns >= 3 && tr.diet === 'herbivore';
      const baseP = [side * hd * .25, skull[1] + hd * .35, skull[2] + (sp.horns === 1 ? hd * .6 : hd * .1)];
      const tipP = sp.horns === 1 ? [0, baseP[1] + hd * .9, baseP[2] + hd * .5] : [side * hd * .9, baseP[1] + hd * 1.1, baseP[2] - hd * .6];
      spike(baseP, tipP, hd * .1, horn, headAnim, { bendDir: [0, 0, -1], bend: hd * .25 });
      if (antler) for (let k = 1; k <= 2; k++) { const m = baseP.map((v, j) => v + (tipP[j] - v) * k / 3); spike(m, [m[0] + side * hd * .2, m[1] + hd * .45, m[2] + hd * .25], hd * .05, horn, headAnim); }
    } else if (sp.crest && !bug && !slug && !serp) {
      const cp = []; for (let k = 0; k <= 4; k++) cp.push({ p: [0, skull[1] + hd * (.4 + Math.sin(k / 4 * Math.PI) * .25), skull[2] - hd * (.2 + k * .2)], rx: hd * .04, ry: hd * .12 * (1 - k / 6) });
      tube(cp, 6, () => accent, () => headAnim);
    }

    // Back: shell, spines, plates, sail or ridge, along the top of the body.
    const topAt = (z) => { let best = path[0]; for (const pt of path) if (Math.abs(pt.p[2] - z) < Math.abs(best.p[2] - z)) best = pt; return [best.p[0], best.p[1] + best.ry * (best.mod ? 1.05 : 1), best.p[2], best.rx, best.ry]; };
    if (!serp && !slug) {
      if (sp.back === 'shell') {
        const zc = hexa || arach ? -L * .3 : 0, len = hexa || arach ? L * .45 : L * .5, top = topAt(zc), path2 = [];
        for (let k = 0; k <= 6; k++) { const f = k / 6, w = Math.sin(.15 + f * (Math.PI - .3)); path2.push({ p: [0, top[1] - top[4] * .45 + w * top[4] * .25, zc - len + f * len * 2], rx: top[3] * 1.12 * w + .01, ry: top[4] * .85 * w + .01, t: f, mod: (ang) => Math.sin(ang) < -.15 ? .2 : 1 + .04 * Math.cos(ang * (hexa ? 2 : 9)) }); }
        tube(path2, 18, (pt, ang) => accent.clone().lerp(base, .35).lerp(dark, Math.abs(Math.sin(pt.t * 18)) > .92 || (hexa && Math.abs(Math.cos(ang)) < .06) ? .5 : 0).lerp(shimmer, sp.scheme === 'iridescent' ? .4 : 0), () => A(BODY));
      } else if (sp.back === 'spines' || sp.back === 'plates') {
        const n = 5 + (sp.seed % 5);
        for (let k = 0; k < n; k++) {
          const z = -L * .42 + k / (n - 1) * L * .8, t0 = topAt(z), h = s * (.1 + .12 * Math.sin(k / (n - 1) * Math.PI)) * (sp.back === 'plates' ? 1.4 : 1);
          if (sp.back === 'spines') spike([t0[0], t0[1] - h * .2, t0[2]], [t0[0], t0[1] + h, t0[2] - h * .35], s * .035, horn.clone().lerp(accent, .3), A(BODY));
          else ellipsoid([(k % 2 ? 1 : -1) * s * .025, t0[1] + h * .35, t0[2]], [s * .02, h * .55, h * .4], accent.clone().lerp(base, .4), A(BODY), 0);
        }
      } else if (sp.back === 'sail') {
        const inner = [], outer = [];
        for (let k = 0; k <= 8; k++) { const z = -L * .35 + k / 8 * L * .7, t0 = topAt(z); inner.push([0, t0[1] - s * .02, z]); outer.push([0, t0[1] + s * (.15 + .35 * Math.sin(k / 8 * Math.PI)), z - s * .05]); }
        membrane(inner, outer, (f, w) => base.clone().lerp(accent, .3 + w * .6).lerp(dark, Math.floor(f * 8) % 2 ? .15 : 0), A(BODY));
      } else if (sp.back === 'ridge') {
        const rp = []; for (let k = 0; k <= 8; k++) { const z = -L * .45 + k / 8 * L * .9, t0 = topAt(z); rp.push({ p: [0, t0[1] + s * .015, z], rx: s * .018, ry: s * .04 }); }
        tube(rp, 6, () => accent.clone().lerp(dark, .2), () => A(BODY));
      }
    }
    // Snail shell: a spiral of shrinking whorls on the back.
    if (form === 'snail') {
      const top = topAt(0), cy = top[1] + s * .1, cz = top[2], path2 = [], turns = 30;
      for (let k = 0; k <= turns; k++) {
        const a = k * .42, R = s * .2 * Math.exp(-a * .14), rr = R * .62;
        path2.push({ p: [k / turns * s * .08, cy + Math.sin(a) * R * .9, cz - Math.cos(a) * R], rx: rr, ry: rr, t: k / turns });
      }
      tube(path2.reverse(), 12, (pt, ang) => horn.clone().lerp(accent, Math.sin(pt.t * 40) > .3 ? .55 : 0).lerp(dark, Math.abs(Math.cos(ang)) > .95 ? .25 : 0), () => A(BODY));
    }
    // Eel fins along the back and belly.
    if (form === 'eel') for (const sign of [1, -1]) {
      const inner = [], outer = [];
      for (let k = 0; k <= 10; k++) { const pt = path[Math.floor(k / 10 * (path.length - 4))]; inner.push([0, pt.p[1] + sign * pt.ry * .8, pt.p[2]]); outer.push([0, pt.p[1] + sign * (pt.ry + s * .08), pt.p[2] - s * .03]); }
      membrane(inner, outer, (f, w) => accent.clone().lerp(shimmer, w), (f) => A(SLITHER));
    }

    // Tail ornaments (they follow the tail's sway).
    if (sp0.length && sp.tail > 0) {
      const tip = sp0[0].p, tailPivot = (body[0] || sp0[0]).p, ta = (w) => A(SWAY, tailPivot, [0, 0, 0], 0, w);
      if (sp.tailType === 'club') { ellipsoid(tip, [s * .12, s * .1, s * .14], horn.clone().lerp(base, .4), ta(1), 1); for (const side of [-1, 1]) spike([side * s * .08, tip[1], tip[2]], [side * s * .2, tip[1] + s * .04, tip[2] - s * .02], s * .03, horn, ta(1)); }
      else if (sp.tailType === 'fan') { const inner = [], outer = []; for (let k = 0; k <= 6; k++) { const a = -1.1 + k / 6 * 2.2; inner.push([tip[0], tip[1], tip[2] + s * .1]); outer.push([Math.sin(a) * s * .35, tip[1] + Math.cos(a) * s * .12, tip[2] - Math.cos(a) * s * .3]); } membrane(inner, outer, (f, w) => accent.clone().lerp(shimmer, w * .6), (f, w) => ta(1)); }
      else if (sp.tailType === 'spiked') for (let k = 1; k < 4; k++) { const pt = sp0.length > 1 ? sp0[1].p : tip, m = pt.map((v, j) => v + (tip[j] - v) * k / 4); spike([m[0], m[1], m[2]], [m[0], m[1] + s * .12, m[2] - s * .05], s * .025, horn, ta(.5 + k / 8)); }
      else if (sp.tailType === 'stinger') spike(tip, [tip[0], tip[1] - s * .05, tip[2] + s * .22], s * .05, dark.clone().lerp(horn, .3), ta(1), { bendDir: [0, -1, 0], bend: s * .06, glow: glowLevel * .8 });
    }

    // Legs (and the mantid's raised forelegs, the scorpion's pincers).
    if (serp || slug) return;
    const pairs = sp.legs / 2;
    for (let i = 0; i < pairs; i++) {
      let z = pairs === 1 ? -L * .12 : L * .3 - i * (L * .62) / (pairs - 1);
      if (bug && form !== 'harvestman') z = (arach ? L * .3 : L * .25) - i * (arach ? L * .5 : L * .55) / Math.max(1, pairs - 1);
      const frontPair = pairs > 1 && i === 0;
      const hopperHind = form === 'hopper' && i === pairs - 1, hopperFront = form === 'hopper' && i === 0;
      for (const side of [-1, 1]) {
        const ly = legY * (hopperHind ? 1.35 : hopperFront ? .8 : 1);
        const hipY = bodyY + lift(z) - H * .15, hipX = side * W * .3;
        const thick = s * (bug ? .03 : .06) * (biped ? 1.35 : 1) * (tr.diet === 'herbivore' ? 1.1 : .95) * (form === 'tank' ? 1.5 : form === 'harvestman' ? .5 : 1) * (hopperHind ? 1.5 : 1);
        const phase = ((i + (side > 0 ? 1 : 0)) % 2) * Math.PI;
        if (frontPair && (form === 'mantis' || form === 'scorpion')) {
          // Raised grasping forelegs / pincers, folded in front of the body.
          const sh = [side * W * .3, bodyY + H * .2, z], el = [side * W * .6, bodyY + H * (form === 'mantis' ? .9 : .1), z + ly * .3], hand = [side * W * .4, bodyY + H * (form === 'mantis' ? .3 : .05), z + ly * .7];
          limb([sh, el, hand], [thick * 1.3, thick * 1.1, thick * .8], ARM, FOREARM, sh, el, phase, 1, base);
          if (form === 'scorpion') { ellipsoid(hand, [thick * 2.2, thick * 1.5, thick * 3], accent.clone().lerp(base, .4), A(FOREARM, sh, el, phase, 1), 1); spike(hand, [hand[0] - side * thick, hand[1], hand[2] + thick * 5], thick * .9, accent, A(FOREARM, sh, el, phase, 1)); }
          else spike(hand, [hand[0], hand[1] - thick * 2, hand[2] + thick * 2], thick * .6, base, A(FOREARM, sh, el, phase, 1));
          continue;
        }
        let knee, ankle, toe;
        if (bug) { // knee up and out, foot out and down
          const spread = form === 'harvestman' ? 2.2 : arach ? 1.4 : 1, fwd = arach ? (i - 1.5) * -.35 : (i - 1) * -.25;
          knee = [side * (W * .3 + ly * .55 * spread), hipY + ly * (form === 'harvestman' ? .9 : .35), z + ly * fwd * .5];
          ankle = [side * (W * .3 + ly * 1.05 * spread), ly * .12, z + ly * fwd];
          toe = [side * (W * .3 + ly * 1.2 * spread), 0, z + ly * fwd * 1.1];
        } else {
          const kneeDir = frontPair || biped ? .14 : hopperHind ? -.35 : -.16;
          knee = [hipX * 1.05, hipY * .5, z + ly * kneeDir]; ankle = [hipX * 1.05, ly * .1, z - ly * kneeDir * .4]; toe = [hipX * 1.05, 0, z + ly * .14];
        }
        const hip = [hipX, hipY + H * .1, z];
        limb([hip, knee, ankle, toe], [thick * 1.5, thick, thick * .65, thick * .5], LEG, SHIN, hip, knee, phase, frontPair || bug ? -1 : 1, flyer ? belly : base.clone().lerp(accent, sp.pattern === 'bands' ? .3 : 0));
        if (!bug) foot(toe, thick, A(SHIN, hip, knee, phase, frontPair ? -1 : 1));
      }
    }
    // Arms with hands, for species clever enough to use them.
    if (sp.arms) for (const side of [-1, 1]) {
      const sz = L * .42, shY = bodyY + lift(sz) + H * .1, sx = side * W * .42, armL = sp.legLength * .65;
      const shoulder = [sx * .8, shY, sz], elbow = [sx * 1.15, shY - armL * .5, sz + armL * .08], hand = [sx * 1.1, shY - armL * .95, sz + armL * .25];
      limb([shoulder, elbow, hand], [s * .05, s * .035, s * .03], ARM, FOREARM, shoulder, elbow, side > 0 ? 0 : Math.PI, 1, base);
      ellipsoid(hand, [s * .045, s * .04, s * .05], belly, A(FOREARM, shoulder, elbow, side > 0 ? 0 : Math.PI, 1), 1);
      for (const f of [-1, 0, 1]) spike([hand[0] + f * s * .02, hand[1] - s * .02, hand[2] + s * .03], [hand[0] + f * s * .03, hand[1] - s * .07, hand[2] + s * .06], s * .012, belly, A(FOREARM, shoulder, elbow, side > 0 ? 0 : Math.PI, 1));
    }
    // Wings: bat membranes, four narrow insect wings, or stepped bird feathers.
    if (flyer) for (const side of [-1, 1]) {
      const span = sp.wingSpan / 2, root = [side * W * .35, bodyY + H * .2, L * .12], pivot = root;
      const wingPairs = form === 'insect' ? [[L * .15, 1], [-L * .1, .8]] : [[L * .12, 1]];
      for (const [zOff, scale] of wingPairs) {
        const sp2 = span * scale, rt = [root[0], root[1], zOff];
        if (form === 'bird') {
          const lead = [], trail = [];
          for (let k = 0; k <= 6; k++) { const f = k / 6; lead.push([side * (W * .35 + f * sp2), rt[1] + Math.sin(f * Math.PI) * s * .06, zOff + s * .1 - f * f * s * .15]); trail.push([side * (W * .35 + f * sp2 * .95), rt[1], zOff - s * (.35 - f * .15) - (k % 2) * s * .08]); }
          membrane(lead, trail, (f, w) => base.clone().lerp(accent, f * .7).lerp(dark, (Math.floor(f * 12) % 2) * w * .15), A(WING, rt, [0, 0, 0], side));
        } else {
          const narrow = form === 'insect' ? .35 : 1, edge = [rt, [side * sp2 * .45, rt[1] + s * .12, zOff + L * .1], [side * sp2, rt[1] + s * .05, zOff - L * .1 * narrow]];
          const trail = [[side * W * .35, bodyY + H * .15, zOff - L * .37 * narrow], [side * sp2 * .5, rt[1], zOff - L * .32 * narrow], [side * sp2 * .95, rt[1], zOff - L * .17 * narrow]];
          membrane(edge, trail, (f, w) => (form === 'insect' ? belly.clone().lerp(white, .35).lerp(shimmer, f * .4) : accent.clone().lerp(base, .3 + w * .2)), A(WING, rt, [0, 0, 0], side));
          tube(edge.map((p, i) => ({ p, rx: s * .025 * (1 - i * .3), ry: s * .025 * (1 - i * .3) })), 5, () => base, () => A(WING, rt, [0, 0, 0], side));
        }
      }
    }
  }

  // Merge parts. Tubes keep shared vertices (smooth normals); small rigid parts
  // get their own normals.
  const pos = [], colr = [], part = [], pivot = [], knee = [], phase = [], bend = [], normal = [], glow = [];
  for (const p of parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
    geo.setIndex(p.idx);
    if (p.nor && !sp.facets) geo.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3)); else geo.computeVertexNormals();
    const ni = geo.toNonIndexed();
    if (sp.facets) ni.computeVertexNormals(); // flat faces
    const P = ni.attributes.position.array, N = ni.attributes.normal.array;
    for (let i = 0; i < p.idx.length; i++) {
      const v = p.idx[i], a = p.an[v], cc = p.colr[v];
      pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); normal.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
      colr.push(cc.r, cc.g, cc.b); part.push(a.part); pivot.push(...a.pivot); knee.push(...a.knee); phase.push(a.phase); bend.push(a.bend); glow.push(p.gl?.[v] ?? 0);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  out.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  out.setAttribute('aPivot', new THREE.Float32BufferAttribute(pivot, 3));
  out.setAttribute('aKnee', new THREE.Float32BufferAttribute(knee, 3));
  out.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  out.setAttribute('aBend', new THREE.Float32BufferAttribute(bend, 1));
  out.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  out.computeBoundingSphere();
  return out;
}
