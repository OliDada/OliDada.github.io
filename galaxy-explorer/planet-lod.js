// Level of detail for planets and moons. Each world is a cube projected onto a
// sphere; every face is a quadtree of tiles that split into four finer tiles as
// the camera approaches and merge back as it leaves. Detail therefore rises
// smoothly with closeness, for every body (a nearby moon gets sharper too), and
// close up the terrain resolves to well under a metre. Tiles are built off the
// main thread by terrain-worker.js when available. THREE is passed in.
import { buildChunk, chunkIndices, faceDirection } from './chunk-build.mjs';
import { terrainFor } from './terrain.mjs';

const SPLIT = 1.8;
const MORPH_START = .7;   // a tile starts blending toward its parent's shape at 70% of the parent's split distance

// Vertex-shader blend between a tile's own shape (near) and its parent's (far).
function addMorph(material, withColor) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute vec3 lodDelta;\nattribute vec2 lodRange;\n' + (withColor ? 'attribute vec3 lodColor;\n' : '') +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 lodWorld = modelMatrix * vec4(position, 1.0);
        float lodK = clamp((distance(lodWorld.xyz, cameraPosition) - lodRange.x) / max(lodRange.y - lodRange.x, 1e-3), 0.0, 1.0);
        transformed += lodDelta * lodK;` + (withColor ? `
        #ifdef USE_COLOR
          vColor.rgb += lodColor * lodK;
        #endif` : ''));
  };
  material.customProgramCacheKey = () => (withColor ? 'lod-colour' : 'lod');
}        // split a tile when the camera is closer than SPLIT × its width
const FINEST = .6;        // target size of the smallest triangles, metres

// Shared queue and worker pool for every planet in the scene.
export function createTerrainStreamer({ maxWorkers = 3 } = {}) {
  let workers = [];
  const queue = [], pending = new Map();
  let nextId = 1;
  try {
    const count = Math.min(maxWorkers, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < count; i++) {
      const w = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
      w.busy = false; w.bodies = new Set();
      w.onmessage = (e) => { const job = pending.get(e.data.id); pending.delete(e.data.id); w.busy = false; if (job && !job.node.disposed) job.node.planet.attach(job.node, e.data); };
      w.onerror = () => fallBack();
      workers.push(w);
    }
  } catch { workers = []; }
  // If workers fail (old browser, blocked file), build on the main thread instead.
  function fallBack() {
    for (const w of workers) w.terminate();
    workers = [];
    for (const { node } of pending.values()) if (!node.disposed) { node.state = 'queued'; queue.push(node); }
    pending.clear();
  }
  return {
    request(node) { if (node.state === 'none') { node.state = 'queued'; queue.push(node); } },
    // Called once per frame: hand out work, or build within a small time budget.
    pump(budgetMs = 4) {
      if (!queue.length) return;
      queue.sort((a, b) => a.priority - b.priority);
      if (workers.length) {
        for (const w of workers) {
          if (w.busy) continue;
          let node;
          while ((node = queue.shift()) && node.disposed);
          if (!node) break;
          const key = node.planet.key;
          if (!w.bodies.has(key)) { w.postMessage({ type: 'body', key, body: node.planet.body }); w.bodies.add(key); }
          const id = nextId++;
          pending.set(id, { node, w }); w.busy = true; node.state = 'building';
          w.postMessage({ type: 'chunk', id, key, spec: node.spec });
        }
      } else {
        const t0 = performance.now();
        while (queue.length && performance.now() - t0 < budgetMs) {
          const node = queue.shift();
          if (!node.disposed) node.planet.attach(node, buildChunk(node.planet.body, node.spec));
        }
      }
    },
    get busy() { return queue.length + pending.size; },
    get usingWorkers() { return workers.length > 0; },
  };
}

export function createPlanet(THREE, streamer, body, { segments = 20 } = {}) {
  const terrain = terrainFor(body), R = body.radius;
  const group = new THREE.Group();
  // Faceted ground; skirts use smooth shading with the ground's own normals so they
  // are lit exactly like the ground beside them.
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  const skirtMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const lava = terrain.liquid === 'lava', wet = lava || terrain.liquid === 'water';
  const liquidColor = new THREE.Color(...terrain.waterColor);
  const waterMaterial = wet ? new THREE.MeshStandardMaterial(lava
    ? { color: new THREE.Color('#4a1606'), emissive: liquidColor, emissiveIntensity: .75, roughness: .8 }
    : { color: liquidColor, transparent: true, opacity: .84, roughness: .16, metalness: .08 }) : null;
  addMorph(material, true);
  addMorph(skirtMaterial, true);
  const gridIndexCount = segments * segments * 6;
  if (waterMaterial) addMorph(waterMaterial, false);
  const { indices } = chunkIndices(segments);
  const maxLevel = Math.max(2, Math.ceil(Math.log2(R * Math.PI / 2 / segments / FINEST)));
  const mountain = Math.acos(R / (R + Math.max(5, terrain.maxH)));
  const planet = { body, key: `${body.id}:${body.seed}`, group, terrain, attach, update, dispose, maxLevel };

  function makeNode(face, level, a0, b0, size) {
    const c = faceDirection(face, a0 + size / 2, b0 + size / 2);
    // Distances are measured to the tile's real ground (not sea level), so split decisions
    // agree with the per-vertex blending even on tiles only a few metres across.
    const ground = R + terrain.meshHeight({ x: c[0], y: c[1], z: c[2] });
    return { planet, face, level, a0, b0, size, spec: { face, a0, b0, size, segments }, dir: c, ground, arc: R * size * Math.PI / 4,
      children: null, mesh: null, water: null, state: 'none', priority: 0, disposed: false };
  }
  function geometryFrom(positions, data, withColor, node) {
    const g = new THREE.BufferGeometry(), n = positions.length / 3;
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(withColor ? data.normals : data.waterNormals, 3));
    if (withColor) { g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3)); g.setAttribute('lodColor', new THREE.BufferAttribute(data.lodColor, 3)); }
    g.setAttribute('lodDelta', new THREE.BufferAttribute(withColor ? data.lodDelta : data.waterDelta, 3));
    // Fully blended to the parent's shape by the distance at which the parent would replace this tile.
    const end = node.level ? SPLIT * node.arc * 2 * .95 : 1e9, range = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { range[i * 2] = end * MORPH_START; range[i * 2 + 1] = end; }
    g.setAttribute('lodRange', new THREE.BufferAttribute(range, 2));
    g.setIndex(new THREE.BufferAttribute(indices, 1)); // own attribute object: disposing one tile must not free another's buffer
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), data.radius);
    if (withColor) { g.addGroup(0, gridIndexCount, 0); g.addGroup(gridIndexCount, indices.length - gridIndexCount, 1); }
    return g;
  }
  function attach(node, data) {
    if (node.disposed) return;
    node.mesh = new THREE.Mesh(geometryFrom(data.positions, data, true, node), [material, skirtMaterial]);
    node.mesh.position.fromArray(data.center); node.mesh.visible = false;
    group.add(node.mesh);
    if (data.water) {
      node.water = new THREE.Mesh(geometryFrom(data.water, data, false, node), waterMaterial);
      node.water.position.fromArray(data.center); node.water.visible = false; node.water.renderOrder = 1;
      group.add(node.water);
    }
    node.state = 'ready';
  }
  function show(node, on) { if (node.mesh) node.mesh.visible = on; if (node.water) node.water.visible = on; }
  function hideTree(node) { show(node, false); if (node.children) for (const c of node.children) hideTree(c); }
  function disposeTree(node) {
    node.disposed = true;
    for (const m of [node.mesh, node.water]) if (m) { group.remove(m); m.geometry.dispose(); }
    node.mesh = node.water = null;
    if (node.children) for (const c of node.children) disposeTree(c);
    node.children = null;
  }

  // Coarsest level is built immediately so every world is visible from the first frame.
  const roots = [0, 1, 2, 3, 4, 5].map(f => makeNode(f, 0, -1, -1, 2));
  for (const r of roots) attach(r, buildChunk(body, r.spec));

  // cam: camera position relative to the planet centre (THREE.Vector3).
  function update(cam) {
    const D = cam.length();
    const horizon = D > R ? Math.acos(Math.min(1, R / D)) : Math.PI;
    const visit = (node) => {
      const d = node.dir, px = d[0] * node.ground, py = d[1] * node.ground, pz = d[2] * node.ground;
      const dist = Math.max(0, Math.hypot(cam.x - px, cam.y - py, cam.z - pz) - node.arc * .7);
      const angle = Math.acos(Math.max(-1, Math.min(1, (cam.x * d[0] + cam.y * d[1] + cam.z * d[2]) / Math.max(D, 1e-6))));
      // Tiles entirely beyond the horizon (allowing for mountains) are not drawn.
      const visible = angle - node.size * .6 < horizon + mountain;
      node.priority = dist / node.arc + (visible ? 0 : 50);
      const split = node.level < maxLevel && (dist < node.arc * SPLIT || (node.children && dist < node.arc * SPLIT * 1.25));
      if (split) {
        if (!node.children) {
          const h = node.size / 2;
          node.children = [[0, 0], [h, 0], [0, h], [h, h]].map(([da, db]) => makeNode(node.face, node.level + 1, node.a0 + da, node.b0 + db, h));
        }
        let ready = true;
        for (const c of node.children) { if (c.state !== 'ready') { ready = false; c.priority = node.priority * .9; streamer.request(c); } }
        if (ready) { show(node, false); for (const c of node.children) visit(c); }
        else { show(node, visible); for (const c of node.children) hideTree(c); }
      } else {
        if (node.children) { disposeTree({ ...node, children: node.children, mesh: null, water: null }); node.children = null; }
        show(node, visible);
      }
    };
    for (const r of roots) visit(r);
  }
  function dispose() {
    for (const r of roots) disposeTree(r);
    material.dispose(); skirtMaterial.dispose(); waterMaterial?.dispose();
  }
  return planet;
}
