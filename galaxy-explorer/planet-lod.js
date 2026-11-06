// Level of detail for planets and moons. Each world is a cube projected onto a
// sphere; every face is a quadtree of tiles that split into four finer tiles as
// the camera approaches and merge back as it leaves. Detail therefore rises
// smoothly with closeness, for every body (a nearby moon gets sharper too), and
// close up the terrain resolves to well under a metre. Tiles are built off the
// main thread by terrain-worker.js when available. THREE is passed in.
import { addWaterLook } from './water.js';
import { buildChunk, chunkIndices, faceDirection } from './chunk-build.mjs';
import { terrainFor } from './terrain.mjs';
import { addCloudShadows } from './cloud-mesh.js';

// Close-up surface detail, drawn in the ground's shader so it costs no triangles:
// cracks and grain on rock, speckled grass, fine sand, pitted crust, ice veins.
// It shades the colour and tilts the lighting (a bump), using noise on the
// world position. Each noise layer fades out once it is smaller than a pixel, and
// the whole effect fades out gently far away (40-90 m; 25-50 m on phones). It is
// balanced to leave the ground's average colour unchanged, so there is no visible
// edge where it ends. 'lite' (phones) uses fewer noise layers. Runs after addMorph.
const STYLE = { rocky: [1, 0, 0, 0], volcanic: [.8, 0, 0, 1], sand: [0, 1, 0, 0], ice: [0, 0, 1, 0], toxic: [.3, 0, 0, 1], soft: [0, 0, 0, 0] };
// objects: for rocks and formations (instanced meshes, no per-vertex cover): drawn as bare rock.
// objects: for anything standing on the ground (rocks, formations, plants, animals,
// buildings). They all get the same subtle grain and bump, at the same strength as
// grassy ground, fixed to the object's own shape (so it moves with animals and
// swaying plants), so the whole scene has one consistent surface. Cracks and pits
// belong to bare ground only.
export function addSurfaceDetail(material, { ground, airless, lite = false, objects = false }) {
  if (material.userData.surfaceDetail) return; // once per material
  material.userData.surfaceDetail = true;
  addDetail(material, ground, airless, lite, objects);
}
function addDetail(material, ground, airless, lite, objects = false, wind = null) {
  const style = STYLE[ground] || (airless ? STYLE.rocky : STYLE.soft);
  // The existing cache key, taken now: afterwards the default key would describe this
  // wrapper, and materials with different shaders underneath would share a program.
  const before = material.onBeforeCompile, baseKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.uniforms.uStyle = { value: style };
    shader.uniforms.uRippleDir = { value: wind ? [wind[0], wind[1], wind[2]] : [0, 0, 0] };
    shader.vertexShader = (objects ? '' : 'attribute vec3 cover;\n') + 'varying vec3 vCover; varying vec3 vDetailPos;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vCover = ${objects ? 'vec3(0.0)' : 'cover'};
      ${objects ? `vDetailPos = position; // the rest shape: the grain stays put on the surface as plants sway and animals move
      #ifdef USE_INSTANCING
        vDetailPos *= length(instanceMatrix[0].xyz); // metres, whatever the instance's size
      #endif` : 'vDetailPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'}`);
    shader.fragmentShader = `uniform vec4 uStyle; uniform vec3 uRippleDir; varying vec3 vCover; varying vec3 vDetailPos;
      float dHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float dNoise(vec3 x) {
        vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), f.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), f.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
` + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
      float detailK = 1.0 - smoothstep(${lite ? '45.0, 110.0' : objects ? '40.0, 90.0' : '120.0, 260.0'}, length(vViewPosition)); // ground: a wide area round you (each layer still fades below a pixel)
      float detailH = 0.0;
      // Screen-space slopes are taken here, outside any branch: taken inside one, they
      // are undefined where neighbouring pixels differ, which drew a ring of black
      // dots where the detail ends.
      vec3 P = vDetailPos;
      float px = length(fwidth(P));
      if (detailK > 0.0) {
        // Each layer fades out once its features get smaller than a pixel, so nothing shimmers.
        float w1 = 1.0 - smoothstep(.2, .45, 6.0 * px), w2 = 1.0 - smoothstep(.2, .45, 17.0 * px), w3 = 1.0 - smoothstep(.2, .45, 41.0 * px);
        float n1 = mix(.5, dNoise(P * 6.0), w1), n2 = mix(.5, dNoise(P * 17.0), w2);
        float n3 = ${lite ? '.5' : 'mix(.5, dNoise(P * 41.0), w3)'};
        // The shared grain: the same on every surface.
        float f = 1.0 + ((n1 - .5) * .14 + (n2 - .5) * .12 + (n3 - .5) * .08)${objects ? ' * .5' : ''}; // objects: a lighter grain, so plants and animals read as smooth shapes
        detailH = (n1 * .3 + n2 * .4 + n3 * .3) * ${objects ? '.006' : '.015'};
        ${objects ? '' : `// Bare ground adds its own character on top: cracks on rock and ice, pits in crust.
        float grass = vCover.x * (1.0 - vCover.z), snow = vCover.z;
        float rock = clamp(max(vCover.y, uStyle.x) * (1.0 - snow) * (1.0 - grass), 0.0, 1.0);
        float sand = uStyle.y * (1.0 - grass) * (1.0 - snow), ice = max(uStyle.z * (1.0 - grass), snow * .5);
        float crust = uStyle.w * (1.0 - grass) * (1.0 - snow);
        float crack = 0.0, crackAvg = 0.0; // crackAvg: its average, subtracted so the cracks don't darken the ground overall
        ${lite ? '' : `if (rock + ice + crust > .05) { // a network of cracks: edges between random cells, about a metre across
          vec3 C = P / 1.15 + (vec3(dNoise(P * .9), dNoise(P * .9 + 5.0), dNoise(P * .9 + 9.0)) - .5) * .6;
          vec3 ci = floor(C); float f1 = 9.0, f2 = 9.0;
          for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
            vec3 c = ci + vec3(x, y, z), o = c + vec3(dHash(c), dHash(c + 3.1), dHash(c + 7.7));
            float d = length(C - o);
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          }
          float width = .035 + 1.2 * px; // never thinner than about a pixel
          float crackFade = 1.0 - smoothstep(.3, .6, 1.15 * px * 8.0);
          crack = (1.0 - smoothstep(0.0, width, f2 - f1)) * smoothstep(.35, .55, dNoise(P * .4 + 2.0)) * crackFade;
          crackAvg = .04 * width / .035 * crackFade;
        }`}
        float pits = smoothstep(.74, .88, n1) * w1;
        f += rock * (-(crack - crackAvg) * .2) + sand * (n3 - .5) * .04 + ice * (crack - crackAvg) * .12
           + crust * (-(pits - .051 * w1) * .06 - (crack - crackAvg) * .14);
        detailH += (rock * (n1 * .3 - crack * .08) * .03 + ice * (-crack * .008) + crust * (-crack * .006));`}
        diffuseColor.rgb *= mix(1.0, f, detailK);
        detailH *= detailK;
      }
      ${objects ? '' : `// Wind ripples on sand (new land: drawn here, not in the mesh, so they cover all the
      // sand you can see): a gentle upwind slope and a steep lee, across the wind, bending
      // with it; fading only once a ripple would be smaller than a few pixels.
      if (dot(uRippleDir, uRippleDir) > .5) {
        float sandR = uStyle.y * (1.0 - vCover.x) * (1.0 - vCover.z);
        float gr = (1.0 - smoothstep(.12, .35, px / 1.6)) * sandR;
        if (gr > .01) {
          float al = (dot(P, uRippleDir) / 1.6 + 1.2 * dNoise(P / 7.0) + .7 * dNoise(P / 29.0 + 4.0)) * 6.2832;
          float rr = .5 + .5 * sin(al + .7 * sin(al)); // a smooth, slightly lopsided wave: no hard edge to catch the light as a line
          float fadeIn = smoothstep(.25, .65, dNoise(P / 17.0 + 8.0)) * .7 + .3; // ripple fields come and go
          detailH += gr * fadeIn * rr * .018;
          diffuseColor.rgb *= 1.0 + gr * fadeIn * (rr - .5) * .05;
        }
      }`}
      ${objects ? '' : `// Far detail: broad patches a few metres to a few dozen across (lighter and darker
      // ground, drier and lusher grass, worn rock), kept far beyond the close-up grain so
      // distant country never looks like a smooth wash of colour. Each layer fades only
      // once it is smaller than a few pixels.
      {
        float g1 = 1.0 - smoothstep(.12, .3, px / 3.2), g2 = 1.0 - smoothstep(.12, .3, px / 11.0), g3 = 1.0 - smoothstep(.12, .3, px / 37.0), g4 = 1.0 - smoothstep(.12, .3, px / 120.0);
        float m = (dNoise(P / 3.2 + 11.0) - .5) * .06 * g1 + (dNoise(P / 11.0 + 3.0) - .5) * .1 * g2 + (dNoise(P / 37.0 + 7.0) - .5) * .1 * g3 + (dNoise(P / 120.0 + 1.0) - .5) * .08 * g4;
        float lush = vCover.x * (1.0 - vCover.z);
        float dryPatch = smoothstep(.55, .8, dNoise(P / 23.0 + 17.0)) * g3 * lush;
        diffuseColor.rgb *= 1.0 + m;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.05, .82), dryPatch * .3);
        // Vegetation seen from above: clumps of growth (darker, with a lit top) a metre or two
        // across in tighter and looser drifts, and a fine speckle of paler blades, so grassy
        // country reads as a living carpet from the air instead of a smooth wash of green.
        float g0 = 1.0 - smoothstep(.15, .35, px / 1.4), gc = 1.0 - smoothstep(.15, .35, px / 2.6), gd = 1.0 - smoothstep(.15, .35, px / 7.0);
        if (lush > .05) {
          float drift = smoothstep(.3, .7, dNoise(P / 14.0 + 41.0));
          float c1 = smoothstep(.56 - .12 * drift, .72 - .1 * drift, dNoise(P / 2.6 + 3.7)) * gc;
          float c2 = smoothstep(.6, .78, dNoise(P / 7.0 + 19.0)) * gd;
          float top = smoothstep(.75, .9, dNoise(P / 2.6 + 3.7 + vec3(.18, .25, .1))) * gc; // the lit side of a clump
          float blades = smoothstep(.72, .92, dNoise(P / 1.4 + 9.1)) * g0;
          diffuseColor.rgb *= 1.0 - lush * (.34 * c1 + .07 * c2) + lush * (.06 * top * c1 + .1 * blades);
        }
      }`}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // Bump: tilt the normal by the slope of detailH across the pixel (slopes taken unconditionally, see above).
      vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
      float hx = dFdx(detailH), hy = dFdy(detailH);
      if (detailK > 0.0 || abs(hx) + abs(hy) > 0.0) {
        vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
        float det = dot(dpx, r1);
        normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2) * 2.5);
      }`);
  };
  material.customProgramCacheKey = () => baseKey + '-detail-' + style.join(',') + (lite ? '-lite' : '') + (objects ? '-objects' : '') + (wind ? '-ripples' : '');
}

const SPLIT = 2.1; // (1.8 before the new land: its hills and valleys want finer tiles further out)
const MORPH_START = .7;
const FADE_IN = .7;       // seconds for a newly shown tile to ease from its parent's shape into its own
const JUMP = 8;           // metres: a camera move bigger than this in one frame is a jump (e.g. stepping out of the ship)   // a tile starts blending toward its parent's shape at 70% of the parent's split distance

// Vertex-shader blend between a tile's own shape (near) and its parent's (far).
// lodCam: { value: Vector3 }, the camera position detail is measured from (world
// space); it eases after a sudden camera jump (see update()) so detail never pops.
// lodScale: { value: number }, stretches every blend range by the same factor as
// the split distances (see FAR_BOOST), so tiles split earlier still show their detail.
function addMorph(material, withColor, lodCam, lodScale) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLodCam = lodCam;
    shader.uniforms.uLodScale = lodScale;
    // The blend is worked out where the normal is set up, which comes before the position.
    shader.vertexShader = 'uniform vec3 uLodCam;\nuniform float uLodScale;\nattribute vec3 lodDelta;\nattribute vec2 lodRange;\n' + (withColor ? 'attribute vec3 lodColor;\nattribute vec3 lodNormal;\n' : '') +
      shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec4 lodWorld = modelMatrix * vec4(position, 1.0);
        float lodK = clamp((distance(lodWorld.xyz, uLodCam) / uLodScale - lodRange.x) / max(lodRange.y - lodRange.x, 1e-3), 0.0, 1.0);` + (withColor ? `
        objectNormal = normalize(objectNormal + lodNormal * lodK);` : '')).replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += lodDelta * lodK;` + (withColor ? `
        #ifdef USE_COLOR
          vColor.rgb += lodColor * lodK;
        #endif` : ''));
  };
  material.customProgramCacheKey = () => (withColor ? 'lod-colour' : 'lod');
}        // split a tile when the camera is closer than SPLIT × its width
const FINEST = .6;
// Seen from a distance a world is only a few tiles, so it can afford finer ones:
// tiles split up to (1 + FAR_BOOST) times farther away as the camera climbs from
// 250 m to 2750 m above the ground (laptops; phones get less). Close to the ground
// nothing changes. The boost grows slowly with height, so as you descend, a tile
// keeps getting relatively closer and never merges back.
const FAR_BOOST = 2.2, FAR_BOOST_LITE = 1.2, FAR_FROM = 250, FAR_SPAN = 2500;
// A world you are near but not on (a planet seen from its moon, or the other way
// round) fills the sky, and close-to-the-ground tiles made it look blocky. It always
// gets at least this boost: about 3.5 times the tiles of the plain setting.
const AWAY_BOOST = 1, AWAY_BOOST_LITE = .5;        // target size of the smallest triangles, metres

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

export function createPlanet(THREE, streamer, body, { segments = 20, lite = false, clouds = null } = {}) {
  const terrain = terrainFor(body), R = body.radius;
  const group = new THREE.Group();
  // Smoothly shaded: with triangles a metre or two across, flat facets only read as a
  // blotchy mosaic of light and dark (most visible from the ship, looking down).
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const skirtMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });

  const lava = terrain.liquid === 'lava', wet = lava || terrain.liquid === 'water';
  const liquidColor = new THREE.Color().setRGB(...terrain.waterColor, THREE.SRGBColorSpace);
  const waterMaterial = wet ? new THREE.MeshStandardMaterial(lava
    ? { color: new THREE.Color('#4a1606'), emissive: liquidColor, emissiveIntensity: .75, roughness: .8 }
    : { color: liquidColor, transparent: true, opacity: .84, roughness: .16, metalness: .08 }) : null;
  const lodCam = { value: new THREE.Vector3(1e9, 0, 0) }, lodScale = { value: 1 };
  const farBoost = lite ? FAR_BOOST_LITE : FAR_BOOST;
  addMorph(material, true, lodCam, lodScale);
  addDetail(material, terrain.ground, terrain.airless, lite, false, terrain.windDir);
  if (clouds) addCloudShadows(material, clouds, { lite }); // cloud-mesh.js
  addMorph(skirtMaterial, true, lodCam, lodScale);
  const gridIndexCount = segments * segments * 6;
  if (waterMaterial) addMorph(waterMaterial, false, lodCam, lodScale);
  if (waterMaterial && !lava) addWaterLook(THREE, waterMaterial, { color: liquidColor, ground: body.palette?.[0] }); // depth-coloured, foam at the shore, small waves (water.js)
  const { indices } = chunkIndices(segments);
  const waterIndices = indices.subarray(0, gridIndexCount);
  const maxLevel = Math.max(2, Math.ceil(Math.log2(R * Math.PI / 2 / segments / FINEST)));
  const mountain = Math.acos(R / (R + Math.max(5, terrain.maxH)));
  const planet = { body, key: `${body.id}:${body.seed}`, group, terrain, attach, update, dispose, maxLevel, waterMaterial }; // waterMaterial: seen from below when diving (game.js)

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
    if (withColor) { g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3)); g.setAttribute('cover', new THREE.BufferAttribute(data.cover, 3)); g.setAttribute('lodColor', new THREE.BufferAttribute(data.lodColor, 3)); g.setAttribute('lodNormal', new THREE.BufferAttribute(data.lodNormal, 3)); }
    g.setAttribute('lodDelta', new THREE.BufferAttribute(withColor ? data.lodDelta : data.waterDelta, 3));
    if (!withColor && data.waterDepth) g.setAttribute('waterDepth', new THREE.BufferAttribute(data.waterDepth, 1));
    // Fully blended to the parent's shape by the distance at which the parent would replace this tile.
    const end = node.lodEnd = node.level ? SPLIT * node.arc * 2 * .95 : 1e9, range = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { range[i * 2] = end * MORPH_START; range[i * 2 + 1] = end; }
    g.setAttribute('lodRange', new THREE.BufferAttribute(range, 2));
    // Own attribute object: disposing one tile must not free another's buffer. Water
    // leaves out the skirts: being see-through, skirts overlapping the next tile's
    // water drew darker lines along every tile edge (a grid of rectangles on the sea).
    g.setIndex(new THREE.BufferAttribute(withColor ? indices : waterIndices, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), data.radius);
    if (withColor) { g.addGroup(0, gridIndexCount, 0); g.addGroup(gridIndexCount, indices.length - gridIndexCount, 1); }
    return g;
  }
  function attach(node, data) {
    if (node.disposed) return;
    node.mesh = new THREE.Mesh(geometryFrom(data.positions, data, true, node), [material, skirtMaterial]);
    node.mesh.receiveShadow = true; // the star's shadows near you (atmosphere.js)
    node.mesh.position.fromArray(data.center); node.mesh.visible = false;
    group.add(node.mesh);
    if (data.water) {
      node.water = new THREE.Mesh(geometryFrom(data.water, data, false, node), waterMaterial);
      node.water.position.fromArray(data.center); node.water.visible = false; node.water.renderOrder = 1;
      group.add(node.water);
    }
    node.state = 'ready';
  }
  // A tile shown for the first time starts out looking exactly like its parent and
  // eases into its own detail over FADE_IN seconds, so new detail never pops in
  // (it does this by sliding its blend range in from zero; see fadeTiles()).
  const fading = new Set();
  function show(node, on) {
    if (on && node.level && node.fade === undefined && node.mesh) { node.fade = 0; setRange(node, 0); fading.add(node); }
    if (node.mesh) node.mesh.visible = on; if (node.water) node.water.visible = on;
  }
  function setRange(node, u) {
    for (const m of [node.mesh, node.water]) {
      if (!m) continue;
      const a = m.geometry.attributes.lodRange, arr = a.array, end = Math.max(node.lodEnd * u, 1e-3), start = node.lodEnd * MORPH_START * u;
      for (let i = 0; i < arr.length; i += 2) { arr[i] = start; arr[i + 1] = end; }
      a.needsUpdate = true;
    }
  }
  let lastFade = performance.now();
  function fadeTiles() {
    const now = performance.now(), dt = Math.min(.1, (now - lastFade) / 1000); lastFade = now;
    for (const node of fading) {
      if (node.disposed) { fading.delete(node); continue; }
      node.fade = Math.min(1, node.fade + dt / FADE_IN);
      const u = node.fade * node.fade * (3 - 2 * node.fade);
      setRange(node, u);
      if (node.fade >= 1) fading.delete(node);
    }
  }
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

  // Detail follows the camera, but after a sudden jump (stepping out of the ship,
  // arriving at a world) it eases over from where the camera was, so the ground
  // refines smoothly instead of snapping to a new level of detail.
  const lagOffset = new THREE.Vector3(), lastCam = new THREE.Vector3(), lagged = new THREE.Vector3();
  let lastLag = 0, seen = false, lastMove = 0;
  // cam: camera position relative to the planet centre (THREE.Vector3).
  // instant: skip the easing after a jump (tests, or when a hard cut is wanted).
  // away: this is not the world the camera is on (system-view.js decides).
  function update(realCam, { instant = false, away = false } = {}) {
    const now = performance.now(), dt = Math.min(.1, (now - lastLag) / 1000); lastLag = now;
    if (!seen) { lastCam.copy(realCam); seen = true; }
    // A jump is a sudden move, much bigger than the frame before. Flying fast moves
    // the camera far every frame too, but steadily: that is not a jump, so detail
    // keeps up with the ship instead of lagging and then catching up all at once.
    const move = realCam.distanceTo(lastCam);
    if (move > JUMP && move > lastMove * 3 + 2) lagOffset.add(lastCam).sub(realCam);
    lastMove = move;
    lagOffset.multiplyScalar(instant ? 0 : Math.exp(-dt / .35));
    if (lagOffset.lengthSq() < 1e-4) lagOffset.set(0, 0, 0);
    lastCam.copy(realCam);
    const cam = lagged.copy(realCam).add(lagOffset);
    group.updateWorldMatrix(true, false);
    lodCam.value.copy(cam).applyMatrix4(group.matrixWorld);
    fadeTiles();
    const D = cam.length();
    lodScale.value = 1 + Math.max(farBoost * Math.min(1, Math.max(0, (D - R - FAR_FROM) / FAR_SPAN)), away ? (lite ? AWAY_BOOST_LITE : AWAY_BOOST) : 0);
    const S = SPLIT * lodScale.value;
    const horizon = D > R ? Math.acos(Math.min(1, R / D)) : Math.PI;
    const visit = (node) => {
      const d = node.dir, px = d[0] * node.ground, py = d[1] * node.ground, pz = d[2] * node.ground;
      const dist = Math.max(0, Math.hypot(cam.x - px, cam.y - py, cam.z - pz) - node.arc * .7);
      const angle = Math.acos(Math.max(-1, Math.min(1, (cam.x * d[0] + cam.y * d[1] + cam.z * d[2]) / Math.max(D, 1e-6))));
      // Tiles entirely beyond the horizon (allowing for mountains) are not drawn.
      const visible = angle - node.size * .6 < horizon + mountain;
      node.priority = dist / node.arc + (visible ? 0 : 50);
      const split = node.level < maxLevel && (dist < node.arc * S || (node.children && dist < node.arc * S * 1.25));
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
