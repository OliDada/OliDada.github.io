// The planned city of a city world (urban.mjs): around the capital, as far as you can
// see, a grid of blocks laid on the levelled ground, with streets between them, parks
// left green, and on every block a podium and the towers of their own idiom (boxes with
// set-backs for hand-builders, hexagonal prisms for the hive, rounded shells, needle
// spires for nest-builders, low domes for burrowers, stepped terraces for grazers,
// stacked rings for rollers, spun lattices for web-builders). Taller toward the heart,
// lower toward the edge and at the coast. Near you each block is solid (obstacles) and
// its streets are laid on the ground (and walked by the townsfolk: paths); beyond, the
// city runs on to the horizon in a coarser skyline. Every window is drawn in the shader,
// from each piece's real size, and lights up at night. Instanced: a few draw calls in all.
import { rng } from './rng.mjs';

// geometry kinds and their window spacing (metres) and how a uv.x maps round the piece
const KINDS = ['box', 'hex', 'cyl', 'dome', 'cone', 'ring', 'disc'];

export function buildPlannedCity(THREE, { radius, terrain, urban, centre, capitalR = 0, u = 1, level = 5, family = 'hands', palette: C = {}, occupied = () => false, near = 480, far = 3000, coarse = false, seed = 'city' }) {
  const r = rng(seed, 'planned-city'), group = new THREE.Group();
  const U = Math.max(1, Math.min(u, 3)); // giants build bigger blocks
  const pitch = Math.round(40 * U), street = 8 * Math.min(U, 1.6), block = pitch - street;
  // A grid at a slight angle of its own, centred on the capital.
  const east = new THREE.Vector3(0, 1, 0).cross(centre); if (east.lengthSq() < 1e-6) east.set(1, 0, 0).cross(centre);
  east.normalize();
  const north = centre.clone().cross(east).normalize(), a0 = r() * Math.PI;
  const e1 = east.clone().multiplyScalar(Math.cos(a0)).addScaledVector(north, Math.sin(a0)), e2 = centre.clone().cross(e1).normalize();
  // A point (x, z) metres out along the grid's axes, measured over the curve of the world.
  const at = (x, z) => { const d = Math.hypot(x, z); if (d < 1e-6) return centre.clone(); const a = d / radius; return centre.clone().multiplyScalar(Math.cos(a)).addScaledVector(e1, x / d * Math.sin(a)).addScaledVector(e2, z / d * Math.sin(a)).normalize(); };
  const ground = (n) => radius + terrain.surface(n);
  const dry = (n) => !terrain.isLiquid(n) && !(Number.isFinite(terrain.sea) && terrain.height(n) < terrain.sea + .5); // not on a frozen sea either

  const lists = Object.fromEntries(KINDS.map((k) => [k, []])); // { m: Matrix4, c: Color, s: [w,h,d], g: glow }
  const obstacles = [], paths = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), basis = new THREE.Matrix4();
  const shade = (hex, k) => new THREE.Color(hex || '#888').multiplyScalar(k);
  const walls = [C.wall, C.wall2, C.trim, C.metal2 || '#d7dde1', C.concrete || '#8b8f91', C.glass || C.window].filter(Boolean);
  const accent = C.accent || '#c0503a';
  // A piece at ground point n (unit), offset (dx, dz) in the block's frame, sized w x h x d, on top of `base` metres.
  const piece = (kind, n, frame, dx, dz, base, w, h, d, colour, rot = 0, glow = 0) => {
    const at2 = n.clone().addScaledVector(frame.x, dx / radius).addScaledVector(frame.z, dz / radius).normalize();
    p.copy(at2).multiplyScalar(frame.ground + base + (kind === 'dome' || kind === 'cone' || kind === 'ring' || kind === 'disc' ? 0 : h / 2));
    const bx = frame.x.clone().addScaledVector(at2, -frame.x.dot(at2)).normalize(); basis.makeBasis(bx, at2, bx.clone().cross(at2));
    q.setFromRotationMatrix(basis).multiply(qy.setFromAxisAngle(Y, rot));
    lists[kind].push({ m: new THREE.Matrix4().compose(p.clone(), q.clone(), sc.set(w, h, d).clone()), c: new THREE.Color(colour), s: [w, h, d], g: glow });
  };

  // The towers of one block, in their builders' idiom. H: the tallest; fp: the room on the podium.
  function towers(n, frame, base, fp, H, near) {
    const wall = walls[Math.floor(r() * walls.length)], dark = shade(wall, .8), n2 = H > 30 * U ? 1 + Math.floor(r() * 3) : 1 + Math.floor(r() * 2);
    for (let i = 0; i < n2; i++) {
      const w = fp * (n2 === 1 ? .55 + r() * .3 : .3 + r() * .2), h = H * (i === 0 ? 1 : .45 + r() * .4);
      const dx = n2 === 1 ? 0 : (i - (n2 - 1) / 2) * fp * .55, dz = n2 === 1 ? 0 : (r() - .5) * fp * .4, rot = r() * Math.PI;
      if (!dry(n.clone().addScaledVector(frame.x, dx / radius).addScaledVector(frame.z, dz / radius).normalize())) continue; // a pond inside the block (bigger worlds have more)
      switch (family) {
        case 'hive': piece('hex', n, frame, dx, dz, base, w, h, w, wall, rot); piece('cone', n, frame, dx, dz, base + h, w * .9, w * .5, w * .9, accent, rot, .2); break;
        case 'tentacles': case 'burrowers':
          if (family === 'burrowers' && r() < .6) { piece('dome', n, frame, dx, dz, base, w * 1.4, Math.min(h * .35, w), w * 1.4, wall); break; }
          piece('cyl', n, frame, dx, dz, base, w, h, w, wall); piece('dome', n, frame, dx, dz, base + h, w, w * .5, w, accent, 0, .15); break;
        case 'nests': piece('cyl', n, frame, dx, dz, base, w * .45, h, w * .45, wall); for (let y = h * .3; y < h; y += h * .22) piece('disc', n, frame, dx, dz, base + y, w * 1.3, w * .06, w * 1.3, dark); piece('cone', n, frame, dx, dz, base + h, w * .5, h * .18, w * .5, accent, 0, .3); break;
        case 'web': piece('hex', n, frame, dx, dz, base, w * .5, h, w * .5, C.silk || wall, rot); for (let y = h * .25; y < h; y += h * .25) piece('ring', n, frame, dx, dz, base + y, w * 1.2, w * .08, w * 1.2, C.silk || '#eee', 0, .4); break;
        case 'grazers': { let y = 0, s = w * 1.4; for (let k = 0; k < 4 && y < h; k++) { const hk = h / 4; piece('box', n, frame, dx, dz, base + y, s, hk, s, wall, rot); piece('box', n, frame, dx, dz, base + y + hk, s * .96, .3, s * .96, C.turf || '#55703a', rot); y += hk; s *= .78; } break; }
        case 'rollers': for (let y = 0, k = 0; y < h; y += w * .45, k++) piece('ring', n, frame, dx, dz, base + y, w * (1 - k * .03), w * .4, w * (1 - k * .03), k % 2 ? dark : wall, 0, .25); break;
        default: { // set-backs: two or three stacked boxes, a crown on top
          let y = 0, ww = w, dd = w * (.7 + r() * .5); const steps = h > 40 ? 3 : h > 18 ? 2 : 1;
          for (let k = 0; k < steps; k++) { const hk = h * (k === 0 ? .55 : .45 / (steps - 1)); piece('box', n, frame, dx, dz, base + y, ww, hk, dd, k ? dark : wall, rot); y += hk; ww *= .72; dd *= .72; }
          if (h > 25) piece('box', n, frame, dx, dz, base + y, ww * .4, h * .06, dd * .4, accent, rot, .6);
        }
      }
      if (near) obstacles.push({ p: n.clone().addScaledVector(frame.x, dx / radius).addScaledVector(frame.z, dz / radius).normalize().multiplyScalar(frame.ground), r: w * .62, h: base + h });
    }
  }
  // How tall the city stands here: tallest at the heart, lower out toward the edges and the coast.
  // Small worlds have lower skylines, or they would bristle like a sea urchin.
  const worldScale = Math.max(.32, Math.min(1, radius / 1400));
  const heightAt = (n, d) => {
    const heart = Math.exp(-d / (900 * U)), edge = urban.mask(n);
    return Math.max(6, worldScale * ((level >= 6 ? 120 : level >= 5 ? 75 : 40) * heart + (level >= 6 ? 26 : 14) + r() * 22) * U * (.55 + .45 * edge) * (.6 + r() * .7));
  };
  // The grid's own axes at a point (along x and across it), wherever on the world it is.
  const frameOf = (n, x = 0, z = 0) => {
    const ax = at(x + 1, z).sub(at(x - 1, z)); ax.addScaledVector(n, -ax.dot(n));
    if (ax.lengthSq() < 1e-16) ax.copy(e1).addScaledVector(n, -e1.dot(n));
    ax.normalize();
    return { x: ax, z: ax.clone().cross(n).normalize(), ground: ground(n) };
  };

  // --- Near: the blocks round you, solid, with their streets --------------------------
  const N = Math.ceil(near / pitch);
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    const x = i * pitch, z = j * pitch, d = Math.hypot(x, z);
    if (d > near) continue;
    const n = at(x, z);
    if (urban.mask(n) < .5 || !dry(n) || d < capitalR * .9 || occupied(n, block * .6)) continue;
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => at(x + a * block * .45, z + b * block * .45));
    if (corners.some((c) => !dry(c))) continue;
    const frame = frameOf(n, x, z);
    if (urban.park(n)) { piece('box', n, frame, 0, 0, -.6, block, .9, block, C.turf || '#4f7a3a'); continue; } // a park: lawn (plants grow here)
    // The podium: flat, at the highest ground under the block, its walls reaching down.
    const lo = Math.min(...corners.map((c) => ground(c))), hi = Math.max(...corners.map((c) => ground(c)), frame.ground), podium = 3 + r() * 3;
    frame.ground = lo;
    piece('box', n, frame, 0, 0, 0, block, hi - lo + podium, block, shade(walls[0], .75));
    obstacles.push({ p: n.clone().multiplyScalar(lo), r: block * .55, h: hi - lo + podium });
    // Plazas now and then; otherwise towers.
    if (r() < .1) { piece('disc', n, frame, 0, 0, hi - lo + podium, block * .3, .5, block * .3, accent, 0, .5); continue; }
    towers(n, frame, hi - lo + podium, block * .8, heightAt(n, d), true);
  }
  // Streets: the grid lines between blocks, on the ground (and the ways townsfolk walk).
  for (const axis of [0, 1]) for (let k = -N; k < N; k++) {
    const line = [];
    for (let t = -near; t <= near; t += 3) {
      const off = (k + .5) * pitch, x = axis ? off : t, z = axis ? t : off;
      if (Math.hypot(x, z) > near) { if (line.length > 1) paths.push(line.splice(0)); else line.length = 0; continue; }
      const n = at(x, z);
      if (!dry(n) || urban.mask(n) < .5) { if (line.length > 1) paths.push(line.splice(0)); else line.length = 0; continue; }
      line.push(n);
    }
    if (line.length > 1) paths.push(line);
  }

  // --- Far: the rest of the city to the horizon, coarser ----------------------------------
  const pitch2 = radius < 1500 ? pitch : pitch * 2, N2 = Math.ceil(far / pitch2), maxFar = coarse ? 2600 : 5200; // small worlds: the same blocks all the way round
  let count = 0;
  for (let i = -N2; i <= N2 && count < maxFar; i++) for (let j = -N2; j <= N2 && count < maxFar; j++) {
    const x = i * pitch2, z = j * pitch2, d = Math.hypot(x, z);
    if (d <= near || d > far) continue;
    const n = at(x, z);
    if (urban.mask(n) < .55 || !dry(n) || urban.park(n) || occupied(n, pitch)) continue;
    const frame = frameOf(n, x, z), H = heightAt(n, d);
    piece('box', n, frame, 0, 0, -2, pitch2 - street * 1.5, 5, pitch2 - street * 1.5, shade(walls[0], .7));
    towers(n, frame, 3, pitch2 * .55, H, false);
    count++;
  }

  // --- The meshes: one per kind, each window drawn from the piece's own size ----------
  const geos = {
    box: new THREE.BoxGeometry(1, 1, 1), hex: new THREE.CylinderGeometry(.5, .5, 1, 6), cyl: new THREE.CylinderGeometry(.5, .5, 1, 14),
    dome: new THREE.SphereGeometry(.5, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 2, 1), cone: new THREE.ConeGeometry(.5, 1, 10).translate(0, .5, 0),
    ring: new THREE.TorusGeometry(.42, .08, 6, 20).rotateX(Math.PI / 2).scale(1, 6, 1), disc: new THREE.CylinderGeometry(.5, .5, 1, 18).translate(0, .5, 0),
  };
  const night = { value: 0 }, winColour = new THREE.Color(C.window || '#ffd98a');
  const meshes = [];
  for (const kind of KINDS) {
    const list = lists[kind];
    if (!list.length) { geos[kind].dispose(); continue; }
    const g = geos[kind], size = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 4), 4);
    list.forEach((x, i) => size.setXYZW(i, x.s[0], x.s[1], x.s[2], x.g));
    g.setAttribute('iSize', size);
    const windows = kind === 'box' || kind === 'hex' || kind === 'cyl';
    const material = new THREE.MeshStandardMaterial({ roughness: .62, metalness: .15, flatShading: kind !== 'dome' });
    material.userData.surfaceDetail = true;
    material.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = night; sh.uniforms.uWin = { value: winColour }; sh.uniforms.uFloor = { value: 3.4 * Math.min(U, 2) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 iSize; varying vec2 vWin; varying float vSide; varying float vGlowI; varying float vSeed;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vSide = 1. - step(.5, abs(normal.y));
float across = ${kind === 'box' ? 'abs(normal.x) > .5 ? iSize.z : iSize.x' : '3.1416 * iSize.x'};
vWin = vec2(uv.x * across, uv.y * iSize.y); vGlowI = iSize.w;
vSeed = fract(sin(dot(vec2(iSize.x + float(gl_InstanceID) * 1.37, iSize.y), vec2(12.9898, 78.233))) * 43758.5453);`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uNight; uniform vec3 uWin; uniform float uFloor; varying vec2 vWin; varying float vSide; varying float vGlowI; varying float vSeed;`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
${windows ? `{
  vec2 cell = vWin / vec2(uFloor * .8, uFloor), f = fract(cell), id = floor(cell);
  float win = step(.18, f.x) * step(f.x, .82) * step(.22, f.y) * step(f.y, .8) * vSide * step(1.2, vWin.y);
  float on = step(.42 - .25 * uNight, fract(sin(dot(id + vSeed * 17., vec2(12.9898, 78.233))) * 43758.5453));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * .35 + vec3(.05, .07, .09), win);
  totalEmissiveRadiance += uWin * win * on * (.12 + 1.3 * uNight);
}` : ''}
totalEmissiveRadiance += diffuseColor.rgb * vGlowI * (.3 + .9 * uNight);`);
    };
    const mesh = new THREE.InstancedMesh(g, material, list.length);
    list.forEach((x, i) => { mesh.setMatrixAt(i, x.m); mesh.setColorAt(i, x.c); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere(); mesh.frustumCulled = false;
    group.add(mesh); meshes.push(mesh);
  }
  return {
    group, obstacles, paths, pieces: KINDS.reduce((s, k) => s + lists[k].length, 0), pitch,
    update(n) { night.value = n; },
    dispose() { for (const m of meshes) { m.geometry.dispose(); m.material.dispose(); m.dispose(); } },
  };
}
