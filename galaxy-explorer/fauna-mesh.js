// Builds, animates and moves the animals on the world you are on. Each species is
// one model drawn with instancing (one draw call). Bodies are a single smooth tube
// swept along a spine (tail, hips, belly, shoulders, neck, skull, snout) and limbs
// are jointed tubes rooted inside the body, so everything connects. On top of that
// each species carries its own features (head shape, jaws, beaks, ears, antennae,
// frills, shells, spines, sails, tail clubs and fans, claws or hooves), colour
// scheme and pattern, and optional glowing markings. Legs (with
// knees), arms, wings, tails and tentacles are animated in the vertex shader from a
// per-animal gait cycle, so dozens of animals cost almost nothing. A behaviour model
// driven by each species' ecology (ecology.mjs) moves every animal across the
// sphere: hunters stalk and chase their prey, prey bolt and warn their herd (big
// grazers stand their ground), grazers walk to plants and eat, animals drink at the
// shore, and each sleeps in its herd outside its time of day. Skittish animals bolt
// from you, curious ones come closer, fliers and floaters drift overhead and fliers
// swoop on prey. THREE is passed in.
import { rng } from './rng.mjs';
import { faunaFor, habitatFit } from './fauna.mjs';
import { isAwake } from './ecology.mjs';
import { cultureOf, cultureSkin, cultureGlow, dress, KIND, tag } from './fauna-culture.mjs';
import { createExpression, express, lookAngles, startGesture, gestureOf, moodOf } from './express.mjs';

// Vertex roles for animation.
const BODY = 0, LEG = 1, WING = 2, SWAY = 3, SLITHER = 4, SHIN = 5, ARM = 6, FOREARM = 7, RLEG = 9, ROLL = 10, WAVE = 11, SPIN = 12, HEAD = 13; // HEAD: turns to look (iLook)
const RANGE = 230; // metres around you (at first, the site) that animals roam

// species/herdCentres: an explicit list of species (instead of the world's own) and
// where their herds live; used for colonists from another world (see suitUp).
// absent: ids of species that no longer live here (a spaceborne civilization's): their
// homes are still worked out (their empty towns stand there), but none of them are.
export function buildFauna(THREE, { body, terrain, radius, signalNormal, budget = 90, plants = [], species: only = null, herdCentres = null, absent = null }) {
  const species = only || faunaFor(body).species;
  const group = new THREE.Group();
  const creatures = [], events = [];
  const time = { value: 0 };
  if (!species.length) return { group, species, creatures, events, homes: new Map(), update() {}, follow() {}, pin() {}, positionsOf: () => [], individualsOf: () => [] };
  const Y = new THREE.Vector3(0, 1, 0), toSite = new THREE.Quaternion().setFromUnitVectors(Y, signalNormal);
  // The middle of the area animals live in. It starts at the site and follows you
  // across the world (follow): herds left far behind move, out of sight, to fitting
  // ground near you, so every part of a living world has its animals.
  const home = signalNormal.clone(), toHome = toSite.clone();
  // Land and sea animals have budgets of their own, so sea life never thins out the herds on land.
  const total = (list) => Math.max(1, list.reduce((n, s) => n + s.group * s.herds, 0));
  const scale = Math.min(1, budget / total(species.filter(s => !s.aquatic))), seaScale = Math.min(1, budget * .45 / total(species.filter(s => s.aquatic)));
  // Sea life needs water deep enough to swim in; everything else needs dry ground.
  const depthAt = (n) => terrain.sea - terrain.height(n);
  const needOf = (sp) => .6 + sp.size * .22;
  // Big towns and cities are no place for wild animals (keepOut): none live or wander there.
  const keepZones = [], tame = new Set(); // tame: species that may (their builders)
  let keepTest = null; // and a whole city world's city (keepOut test)
  const zoneAt = (sp, n) => sp.aquatic || tame.has(sp.id) ? null : keepZones.find((z) => z.n.angleTo(n) * radius < z.r) || (keepTest?.(n) ? { n: nearestOutside(n), r: 0 } : null);
  // Somewhere just outside the city, for animals to head for: the way the city thins.
  function nearestOutside(n) { let best = n, bv = Infinity; for (let k = 0; k < 8; k++) { const t = n.clone().add(randomNear(THREE, Math.random, 60 / radius).sub(Y)).normalize(); const v = keepTest(t) ? 1 : 0; if (v < bv) { bv = v; best = t; } } return best.clone().multiplyScalar(-1).add(n.clone().multiplyScalar(2)).normalize(); }
  const fits = (sp, n) => (sp.aquatic ? terrain.liquid === 'water' && depthAt(n) > needOf(sp) : !terrain.isLiquid(n)) && !zoneAt(sp, n);
  // Where an animal may go once it is out and about. Ground animals wade into the
  // shallows (up to about knee-deep for their legs), amphibious ones swim anywhere,
  // sea life keeps to water deep enough for it; nothing enters lava.
  const wadeOf = (sp) => ['serpent', 'slug'].includes(sp.plan) ? .12 + sp.size * .1 : sp.legLength * .6 + .08;
  const wet = (n) => terrain.liquid === 'water' ? depthAt(n) : terrain.isLiquid(n) ? Infinity : -1;
  function canGo(sp, n, airborne) {
    if (airborne) return true;
    if (sp.aquatic) return depthAt(n) > needOf(sp) * .7;
    const d = wet(n);
    return d === Infinity ? false : sp.swims ? true : d <= wadeOf(sp);
  }
  // The ground (or sea floor) under a point.
  const bedAt = (n) => terrain.liquid === 'water' ? terrain.height(n) : terrain.surface(n);
  const meshes = [];
  const er = rng(body.seed, 'ecology-places');
  const homes = new Map(); // species id -> herd centres (where intelligent species build)

  // Food and water where the animals live. Plants are flora instances (any species can
  // be grazed; they are read again as plants fill in around you); shore points are dry
  // ground beside a sea, with the way to the water.
  const food = [], shore = [];
  function findFood() {
    food.length = 0;
    const reach = Math.cos((RANGE + 20) / radius);
    for (const { positions } of plants)
      for (let i = 0; i < positions.length; i += 3) {
        const n = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]).normalize();
        if (n.dot(home) > reach) food.push(n);
      }
  }
  findFood();
  function findShore() {
  shore.length = 0;
  if (terrain.liquid === 'water') {
    const probe = new THREE.Vector3(), side = new THREE.Vector3();
    for (let i = 0; i < 700 && shore.length < 60; i++) {
      const n = randomNear(THREE, er, RANGE * .95 / radius).applyQuaternion(toHome);
      if (terrain.isLiquid(n)) continue;
      side.set(1, 0, 0);
      for (let k = 0; k < 6; k++) {
        const d = tangent(side.set(Math.cos(k * 1.047), .3, Math.sin(k * 1.047)), n);
        probe.copy(n).addScaledVector(d, 3 / radius).normalize();
        if (terrain.isLiquid(probe)) { shore.push({ n, toWater: d }); break; }
      }
    }
  }
  }
  findShore();
  const bands = []; // every herd: { sp, herd }, for moving herds to where you are

  for (const sp of species) {
    const r = rng(body.seed, 'animals', sp.id);
    const geometry = buildGeometry(THREE, sp, r);
    // Builders are many more than a herd: a village has its households, a city its crowds.
    const townsfolk = !only && sp.civilization >= 2 ? Math.round((6 + Math.min(sp.civilization, 7) * 3) * (budget < 70 ? .6 : 1)) : 0;
    const count = absent?.has(sp.id) ? 0 : Math.max(1, townsfolk, Math.round(sp.group * sp.herds * (sp.aquatic ? seaScale : scale)));
    geometry.computeBoundingBox();
    const extent = { top: geometry.boundingBox.max.y, bottom: Math.max(geometry.boundingBox.min.y, -sp.size * .6) };
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    anim.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('iAnim', anim);
    const look = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    look.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('iLook', look);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 });
    material.userData.surfaceDetail = true; // creatures have their own surfaces (addAnimation), not the ground's grain
    addAnimation(material, sp);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    if (!sp.aquatic) { mesh.customDepthMaterial = creatureDepthMaterial(THREE, sp); mesh.castShadow = true; } // shadows that walk with them
    group.add(mesh);
    // Suited colonists wear a glass helmet over the head (found from the model's extent).
    if (sp.suit) {
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox, hr = sp.head * 1.45, upright = sp.plan === 'biped';
      const centre = new THREE.Vector3(0, bb.max.y - hr * (upright ? .75 : 1), upright ? bb.max.z * .35 : bb.max.z - hr * 1.05);
      const helmet = new THREE.InstancedMesh(new THREE.SphereGeometry(hr, 14, 10), new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: .32, roughness: .05, metalness: .2, depthWrite: false }), count);
      helmet.instanceMatrix.setUsage(THREE.DynamicDrawUsage); helmet.frustumCulled = false; group.add(helmet);
      sp.helmet = { mesh: helmet, offset: new THREE.Matrix4().makeTranslation(centre.x, centre.y, centre.z) };
    }
    meshes.push({ sp, mesh, anim, look });
    // Herds start at places that suit the species, near the site.
    const herdCount = Math.max(1, Math.round(sp.herds * Math.min(1, scale * 1.5)));
    const herds = [];
    for (let h = 0; h < herdCount; h++) {
      if (herdCentres?.length) { herds.push({ centre: herdCentres[h % herdCentres.length].clone(), alarm: 0, threat: null }); continue; }
      let best = null, bestFit = -1;
      for (let t = 0; t < (sp.aquatic ? 60 : 30); t++) {
        const n = randomNear(THREE, r, RANGE * .8 / radius).applyQuaternion(toSite);
        if (n.angleTo(signalNormal) < 25 / radius || !fits(sp, n)) continue;
        const c = terrain.climate(n), f = habitatFit(sp, c) + r() * .15;
        if (f > bestFit) { bestFit = f; best = n; }
      }
      // Nothing suits it nearby: any dry ground (or deep enough water) will do, rather than piling every herd onto one spot.
      for (let t = 0; !best && t < 60; t++) { const n = randomNear(THREE, r, RANGE * .8 / radius).applyQuaternion(toSite); if (fits(sp, n) && n.angleTo(signalNormal) * radius > 15) best = n; }
      // Sea life with no water near enough waits (unseen) until you come to a coast.
      herds.push({ centre: best || signalNormal.clone(), alarm: 0, threat: null, dry: !!sp.aquatic && !best });
    }
    homes.set(sp.id, herds.map(h => h.centre));
    if (!herdCentres?.length) for (const herd of herds) bands.push({ sp, herd, r });
    for (let i = 0; i < count; i++) {
      const herd = herds[i % herds.length], centre = herd.centre;
      const n = centre.clone().add(randomNear(THREE, r, 12 / radius).sub(Y)).normalize();
      if (!fits(sp, n)) n.copy(centre);
      const heading = tangent(new THREE.Vector3(r() - .5, r() - .5, r() - .5), n);
      const depth = sp.aquatic ? sp.depth[0] + r() * (sp.depth[1] - sp.depth[0]) : 0;
      creatures.push({ sp, eco: sp.ecology, mesh, index: i, herd: centre, band: herd, n, heading, speed: 0, target: 0, cycle: r() * 6.28, timer: r() * 3, state: 'idle',
        alt: sp.altitude[0] + r() * (sp.altitude[1] - sp.altitude[0]), altPhase: r() * 6.28, r,
        hunger: er() * .6, thirst: er() * .6, scan: er() * .5, goal: null, face: null, prey: null, threat: null, chase: 0, rest: 0, hidden: 0,
        tilt: 0, sink: 0, dive: 0, cooldown: er() * 10, stalking: false,
        perch: 0, depth, depthGoal: depth, depthTimer: r() * 6, breath: 10 + r() * 30, surfacing: 0, leap: -1, leapTime: 1, ...extent, pos: new THREE.Vector3() });
    }
  }
  const bySpecies = new Map(species.map(s => [s.id, creatures.filter(c => c.sp === s)]));
  // Townsfolk: an intelligent species living among its buildings (setTown). Instead of
  // roaming like a herd, each goes from one place in town to another (a doorstep to work
  // at, a square to talk in), walks round the buildings on the way, works with its hands
  // there (or bends to the work), and sleeps by a door at night.
  const towns = new Map(); // species id -> { spots: [{ n, face, kind, taken }], near(p) -> [{ p, r, h }] }
  const TOWN_TIME = { work: [14, 34], chat: [12, 26], watch: [10, 22], stroll: [3, 9], graze: [20, 50] };
  // The ways along the streets (structures-mesh.js paths): a graph of points about 3 m
  // apart, joined along each street and wherever two meet. Trips across town follow it.
  function streetGraph(paths) {
    const nodes = [], adj = [], cell = new Map(), key = (v) => `${Math.round(v.x * radius / 3)},${Math.round(v.y * radius / 3)},${Math.round(v.z * radius / 3)}`;
    for (const path of paths || []) {
      let prev = -1;
      for (const n of path) {
        const i = nodes.length; nodes.push(n); adj.push([]);
        if (prev >= 0 && apart(nodes[prev], n) < 6) { adj[i].push(prev); adj[prev].push(i); }
        prev = i;
        const k = key(n); (cell.get(k) || cell.set(k, []).get(k)).push(i);
      }
    }
    // Junctions: points of different streets within 2.5 m of each other.
    for (const list of cell.values()) for (const a of list) for (const b of list) if (a < b && !adj[a].includes(b) && apart(nodes[a], nodes[b]) < 2.5) { adj[a].push(b); adj[b].push(a); }
    for (let i = 0; i < nodes.length; i++) {
      const v = nodes[i], [x, y, z] = key(v).split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dy && !dz) continue;
        for (const j of cell.get(`${x + dx},${y + dy},${z + dz}`) || []) if (j > i && !adj[i].includes(j) && apart(v, nodes[j]) < 2.5) { adj[i].push(j); adj[j].push(i); }
      }
    }
    return { nodes, adj };
  }
  // --- Vignettes: things a town does together -----------------------------------------
  // Every so often a few townsfolk who are not busy leave what they are doing for something
  // their people do: by their path (civilizations.mjs) and the time of day. Mercantile
  // peoples hold a market in a square (one in the middle, the rest round it); devotional ones
  // walk in procession along the streets to the heart of the capital and bow there;
  // scholarly ones go out at night to look at the sky; martial ones change the watch, in
  // pairs; farming ones work in their fields; expansionist ones are building at the edge of
  // town. And at dusk, those with hearths gather round them. Each one is an event (type
  // 'vignette'), so the game can say what is going on.
  const sunNow = new THREE.Vector3(); let hasSun = false;
  const VIGNETTE_WORDS = {
    market: 'are holding a market in the square', procession: 'are walking in procession to the heart of their town', stargaze: 'have gone out to watch the sky',
    watch: 'are changing the watch', field: 'are out working in their fields', build: 'are building at the edge of town', hearth: 'are gathering for the evening',
  };
  function vignettes(id, town, dt, t) {
    const o = town.opts;
    if (!o || (town.nextVignette ??= t + 8 + Math.random() * 12) > t) return;
    town.nextVignette = t + 60 + Math.random() * 60;
    const folk = (bySpecies.get(id) || []).filter((c) => c.spots && !c.young && !c.kept && !c.duty && !c.meet && !c.talk && !c.hidden && ['atSpot', 'idle', 'toSpot'].includes(c.state));
    if (folk.length < 2) return;
    const centres = o.centres || [];
    if (!centres.length) return;
    const near = playerNow.current, pick = (list) => list[Math.floor(Math.random() * list.length)];
    // Day or night, here (the middle of town).
    const light = hasSun ? centres[0].dot(sunNow) : .5, night = light < -.05, dusk = Math.abs(light) < .18;
    const choices = [];
    if (dusk && o.hearths) choices.push('hearth', 'hearth');
    if (night && o.path === 'scholarly') choices.push('stargaze', 'stargaze');
    if (!night) {
      if (o.path === 'mercantile') choices.push('market', 'market');
      if (o.path === 'devotional') choices.push('procession', 'procession');
      if (o.path === 'martial') choices.push('watch', 'watch');
      if (o.path === 'agrarian' && o.fields?.length) choices.push('field', 'field');
      if (o.path === 'expansionist') choices.push('build', 'build');
      if (o.fields?.length) choices.push('field');
      choices.push('market'); // anyone gathers to talk
    }
    if (!choices.length) return;
    const kind = pick(choices);
    // Where: the square nearest you (so you see it), or the capital's heart for processions.
    const byYou = near ? [...centres].sort((a, b) => a.angleTo(near) - b.angleTo(near)) : centres;
    const centre = kind === 'procession' ? centres[0] : kind === 'field' ? (near ? nearest(o.fields, near, (x) => x) : pick(o.fields)) : byYou[0];
    const n = Math.min(Math.ceil(folk.length * .6), { market: 6, procession: 7, stargaze: 4, watch: 4, field: 5, build: 4, hearth: 7 }[kind]);
    const crew = folk.sort((a, b) => apart(a.n, centre) - apart(b.n, centre)).slice(0, n);
    const frame = frameAround(centre), size = crew[0].sp.size;
    const until = t + (kind === 'procession' ? 110 : 40 + Math.random() * 30);
    crew.forEach((c, i) => {
      let dist, ang = i / n * Math.PI * 2 + Math.random() * .2, pose = 'chat', face = null, look = null, gesture = null, inward = true;
      switch (kind) {
        case 'market': dist = i === 0 ? 0 : 3 + size * 1.4; pose = i === 0 ? 'work' : 'chat'; break;
        case 'hearth': dist = 2.4 + size * 1.3; pose = 'chat'; break;
        case 'procession': dist = 3.5 + size * 1.2; pose = 'stand'; gesture = 'bow'; break;
        case 'stargaze': dist = 6 + size * 2 + Math.random() * 3; pose = 'stand'; look = 'up'; inward = false; break;
        case 'watch': dist = 10 + i * 6; ang = (i >> 1) * Math.PI + (i % 2) * .25; pose = 'stand'; inward = false; break;
        case 'field': dist = 1 + Math.random() * 6; ang = Math.random() * 6.28; pose = 'field'; inward = false; break;
        case 'build': dist = (town.edge || 30) + 4; ang = 1.1 + (i - n / 2) * .12; pose = 'work'; break;
      }
      const dir = frame.east.clone().multiplyScalar(Math.cos(ang)).addScaledVector(frame.north, Math.sin(ang));
      const at = centre.clone().addScaledVector(dir, dist / radius).normalize();
      if (terrain.isLiquid(at)) return;
      face = inward && dist > 0 ? tangent(centre.clone().sub(at), at) : tangent(dir, at);
      releaseSpot(c); c.spot = null;
      c.duty = { kind, n: at, face, pose, look, gesture, centre: inward ? centre : null, until, start: kind === 'procession' ? t + i * 2.2 : t, night: kind === 'stargaze' || kind === 'hearth', pace: kind === 'procession' ? .5 : .75,
        path: streetRoute(town.graph, c.n, at)?.slice() ?? null };
      c.state = 'duty'; c.goal = null;
    });
    if (!crew.some((c) => c.duty)) return;
    events.push({ type: 'vignette', kind, species: crew[0].sp, at: centre.clone(), words: VIGNETTE_WORDS[kind] });
  }
  function frameAround(n) {
    const east = new THREE.Vector3(0, 1, 0).cross(n); if (east.lengthSq() < 1e-6) east.set(1, 0, 0).cross(n);
    east.normalize(); return { east, north: n.clone().cross(east).normalize() };
  }
  // A way along the streets from one place to another (null if there is none, or no need).
  function streetRoute(g, from, to) {
    if (!g?.nodes.length || apart(from, to) < 18) return null;
    let a = -1, b = -1, da = 14, db = 14;
    for (let i = 0; i < g.nodes.length; i++) { const x = apart(g.nodes[i], from), y = apart(g.nodes[i], to); if (x < da) { da = x; a = i; } if (y < db) { db = y; b = i; } }
    if (a < 0 || b < 0 || a === b) return null;
    const prev = new Int32Array(g.nodes.length).fill(-2), queue = [a]; prev[a] = -1;
    for (let q = 0; q < queue.length && prev[b] === -2; q++) for (const j of g.adj[queue[q]]) if (prev[j] === -2) { prev[j] = queue[q]; queue.push(j); }
    if (prev[b] === -2) return null;
    const out = []; for (let i = b; i >= 0; i = prev[i]) out.push(g.nodes[i]);
    out.reverse();
    return out.length * 3 < apart(from, to) * 4 ? out : null; // not a long way round
  }
  const helmetM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion(), basis = new THREE.Matrix4(), m = new THREE.Matrix4(), pos = new THREE.Vector3(), right = new THREE.Vector3();
  const up = new THREE.Vector3(), fwd = new THREE.Vector3(), hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const apart = (a, b) => a.angleTo(b) * radius;
  const steer = (c, toward, rate, dt) => c.heading.lerp(tangent(toward.clone().sub(c.n), c.n), Math.min(1, dt * rate));

  // player: { position: Vector3 (planet-local), onFoot: boolean } or null
  // sun: unit Vector3 toward the star (planet-local), or null for always day
  const playerNow = { current: null, onFoot: false };
  function update(dt, t, player, sun = null) {
    time.value = t;
    events.length = 0;
    playerNow.current = player ? player.position.clone().normalize() : null; playerNow.onFoot = !!player?.onFoot;
    if (sun) sunNow.copy(sun); hasSun = !!sun;
    for (const [id, town] of towns) vignettes(id, town, dt, t);
    for (const c of creatures) step(c, dt, t, player, sun);
    for (const { mesh, anim, look } of meshes) { mesh.instanceMatrix.needsUpdate = true; anim.needsUpdate = true; look.needsUpdate = true; }
  }

  // Every half second or so an animal looks around: for hunters closing in, and,
  // when hungry and awake, for something to hunt.
  function scan(c, t, awake) {
    const eco = c.eco, range = eco.sight * (awake ? 1 : .4);
    c.inZone = keepZones.length && !c.kept ? zoneAt(c.sp, c.n) : null;
    c.threat = null;
    let best = Infinity;
    // Townsfolk are safe among their buildings: hunters keep away from towns.
    if (!c.spots) for (const id of eco.predators) for (const h of bySpecies.get(id)) {
      if (h.hidden) continue;
      const d = apart(c.n, h.n), hunting = h.prey === c || h.state === 'hunt';
      if (d < (hunting ? range : range * .45) && d < best) { best = d; c.threat = h; }
    }
    if (c.threat) { c.band.alarm = t + 2 + c.sp.traits.sociality * 3; c.band.threat = c.threat; }
    // Omnivores mostly eat plants and take prey only now and then.
    const opportunist = c.sp.traits.diet === 'omnivore';
    if (!c.prey && awake && c.hunger > (opportunist ? .75 : .6) && c.rest <= 0 && c.state !== 'feed' && eco.prey.length && (!opportunist || c.r() < .06)) {
      let pick = null, d0 = eco.sight;
      for (const id of eco.prey) for (const p of bySpecies.get(id)) {
        if (p.hidden || p.spots) continue;
        const d = apart(c.n, p.n);
        if (d < d0) { d0 = d; pick = p; }
      }
      if (pick) { c.prey = pick; c.chase = eco.stamina; c.state = 'hunt'; }
    }
  }

  // --- Townsfolk ---------------------------------------------------------------------
  const tmpP = new THREE.Vector3(), tmpD = new THREE.Vector3(), tmpS = new THREE.Vector3();
  function releaseSpot(c) { if (c.spot && c.spot.taken === c) c.spot.taken = null; }
  function pickSpot(c, night) {
    const list = c.spots.filter((s) => (!s.taken || s.taken === c) && s !== c.spot && (!night || s.kind === 'work'));
    if (!list.length) return null;
    const near = list.filter((s) => apart(s.n, c.n) < 35);
    const from = near.length && c.r() < .85 ? near : list.sort((a, b) => apart(a.n, c.n) - apart(b.n, c.n)).slice(0, 4);
    return from[Math.floor(c.r() * from.length)];
  }
  function goTo(c, s, state) {
    releaseSpot(c); c.spot = s; if (s) s.taken = c;
    c.state = s ? state : 'idle'; c.goal = null;
    c.route = s ? streetRoute(towns.get(c.sp.id)?.graph, c.n, s.n) : null;
    c.timer = s ? (c.route ? c.route.length * 3 : apart(c.n, s.n)) / Math.max(.3, c.sp.speed.walk * .7) + 12 : 2;
  }
  function townLife(c, dt, t, awake, player = playerNow) {
    const sp = c.sp;
    if (c.state === 'inside') { // indoors: out again after a while (or in the morning)
      c.target = 0; c.speed = 0;
      if (c.timer > 1e8 ? awake : (c.timer -= dt) <= 0) { c.state = 'atSpot'; c.timer = 2 + c.r() * 4; if (c.spot) c.heading = tangent(c.spot.face.clone().negate(), c.n); }
      return 0;
    }
    // Come out to meet you (arrive): walk to the place given, wait there facing you, greet.
    if (c.meet) {
      const mt = c.meet;
      if (t > mt.until || (!awake && mt.until - t > 5)) { c.meet = null; c.state = 'idle'; c.timer = 0; return 0; }
      const d = apart(c.n, mt.n);
      if (c.state === 'toMeet' && d > .6 + sp.size * .3 && t < mt.leave) { steer(c, mt.n, 4, dt); c.target = sp.speed.walk * (d > 12 ? 1.1 : d < 3 ? .45 : .8); return 0; }
      c.target = 0;
      if (c.state === 'toMeet') { c.state = 'meeting'; mt.greetAt = t + (mt.delay || 0); }
      if (mt.greet && mt.greetAt != null && t >= mt.greetAt) { mt.greetAt = null; startGesture(c.ex ||= createExpression(c.r), gestureOf(sp)); }
      return 0;
    }
    // Part of something the town is doing together (vignettes, below).
    if (c.duty) {
      const du = c.duty;
      if (t > du.until || (!awake && !du.night)) { c.duty = null; c.state = 'idle'; c.timer = 0; return 0; }
      c.state = 'duty';
      if (t < du.start) { c.target = 0; return 0; } // waiting for its turn (a procession sets off one by one)
      while (du.path?.length && apart(c.n, du.path[0]) < 2.2) du.path.shift();
      const d = apart(c.n, du.n);
      if (!du.arrived && (du.path?.length || d > .5 + sp.size * .3)) { steer(c, du.path?.length ? du.path[0] : du.n, 4, dt); c.target = sp.speed.walk * (du.pace || .7) * (d < 3 ? .6 : 1); return 0; }
      if (!du.arrived) { du.arrived = true; if (du.gesture) startGesture(c.ex ||= createExpression(c.r), du.gesture === true ? gestureOf(sp) : du.gesture); }
      c.target = 0;
      if (du.face) c.heading.lerp(tangent(du.face, c.n), Math.min(1, dt * 2.5));
      return du.pose === 'field' ? 1 : 0;
    }
    // Kept animals graze in their pens, and sleep where they are.
    if (c.kept) {
      if (!awake) { c.target = 0; c.state = 'sleep'; return 2; }
      if (c.state === 'sleep') { c.state = 'idle'; c.timer = 0; }
      if (c.state === 'atSpot') { c.target = 0; c.heading.lerp(tangent(c.spot.face, c.n), Math.min(1, dt)); if (c.timer <= 0) c.state = 'idle'; return 1; }
    }
    // The young: never far from a grown-up, at play (chasing round, hopping), and drawn to
    // a stranger: they come close to stare (unless their people are wary of you: then they hide).
    if (c.young) {
      let p = c.parent;
      if (!p || p.hidden || p.young) { p = c.parent = nearest(bySpecies.get(sp.id).filter((o) => !o.young && o.spots), c.n, (o) => o.n); }
      if (!p) return 0;
      if (p.state === 'inside' || p.state === 'sleep') { c.state = p.state === 'inside' ? 'inside' : 'sleep'; c.timer = 1e9; if (c.state === 'inside') return 0; c.target = 0; return 2; }
      if (c.state === 'sleep' || c.state === 'inside') c.state = 'play';
      c.state = 'play';
      const pp = player.current, pd = pp ? apart(c.n, pp) : Infinity;
      if (pp && player.onFoot && pd < 12 && c.townStance !== 'wary' && c.townStance !== 'guarded') { // come and stare
        if (pd > 2.6 + sp.size) { steer(c, pp, 4, dt); c.target = sp.speed.walk * .9; } else { c.target = 0; if (c.r() < dt * .25) startGesture(c.ex ||= createExpression(c.r), 'hop'); }
        return 0;
      }
      if (pp && pd < 10 && c.townStance === 'wary') { steer(c, tmpP.copy(p.n).addScaledVector(tmpD.copy(p.n).sub(pp).normalize(), 1.5 / radius).normalize(), 5, dt); c.target = sp.speed.run * .7; return 0; } // behind the grown-up
      const ang = t * (.6 + (c.index % 3) * .2) + c.altPhase, rr = (1.8 + sp.size * 1.5) / radius;
      const orbit = tmpP.copy(p.n).add(tmpD.copy(p.heading).multiplyScalar(Math.cos(ang) * rr)).add(tmpS.copy(p.n).cross(p.heading).multiplyScalar(Math.sin(ang) * rr)).normalize();
      steer(c, orbit, 5, dt); c.target = apart(c.n, orbit) > 1 ? sp.speed.walk * (Math.sin(t * .5 + c.altPhase) > .3 ? 1.6 : .8) : sp.speed.walk * .4;
      if (c.r() < dt * .06) startGesture(c.ex ||= createExpression(c.r), c.r() < .5 ? 'hop' : 'spin');
      return 0;
    }
    if (!awake && c.state !== 'sleep' && c.state !== 'toBed') goTo(c, pickSpot(c, true), 'toBed');
    if (c.state === 'sleep') { c.target = 0; if (awake) { c.state = 'idle'; c.timer = 0; } return 2; }
    if ((c.state === 'toSpot' || c.state === 'toBed') && c.spot) {
      const d = apart(c.n, c.spot.n);
      if (d < .45 + sp.size * .25) {
        c.target = 0;
        if (c.state === 'toBed') { if (c.r() < .6) { c.state = 'inside'; c.timer = 1e9; } else c.state = 'sleep'; return 2; } // most sleep indoors
        c.state = 'atSpot'; const [a, b] = TOWN_TIME[c.spot.kind] || [10, 20]; c.timer = a + c.r() * (b - a);
        // Someone to talk to, at the next place round the square.
        c.partner = null;
        if (c.spot.kind === 'chat') for (const o of bySpecies.get(sp.id)) if (o !== c && o.spot?.kind === 'chat' && apart(o.n, c.n) < 6 + sp.size * 2) { c.partner = o; if (!o.partner || o.partner.spot?.kind !== 'chat') o.partner = c; break; }
      } else {
        // Along the streets when it is far, then straight to the place.
        while (c.route?.length && apart(c.n, c.route[0]) < 2.2) c.route.shift();
        steer(c, c.route?.length ? c.route[0] : c.spot.n, 4, dt); c.target = sp.speed.walk * (d < 3 ? .45 : .75);
        if (c.timer <= 0) c.state = 'idle'; // couldn't get there: do something else
      }
      return 0;
    }
    if (c.state === 'atSpot' && c.spot) {
      c.target = 0;
      const face = tmpS.copy(c.spot.face);
      if (c.spot.kind === 'watch' || c.spot.kind === 'stroll') face.applyAxisAngle(c.n, Math.sin(t * .4 + c.altPhase) * .6); // looking about
      c.heading.lerp(tangent(face, c.n), Math.min(1, dt * 2.5));
      if (c.timer <= 0) {
        // Now and then, in through the door for a while.
        if (c.spot.kind === 'work' && c.spot.door && c.r() < .3) { c.state = 'inside'; c.timer = 15 + c.r() * 35; }
        else c.state = 'idle';
      }
      return 0;
    }
    goTo(c, pickSpot(c, false), 'toSpot');
    return 0;
  }
  // Steer round buildings ahead (they are circles on the ground: { p, r }).
  function avoidBuildings(c, list, dt) {
    const here = tmpP.copy(c.n).multiplyScalar(radius + terrain.surface(c.n)), look = 2.5 + c.sp.size * 1.5 + c.speed, rad = c.sp.size * .45;
    let turn = 0;
    for (const o of list) {
      tmpD.copy(o.p).sub(here); tmpD.addScaledVector(c.n, -tmpD.dot(c.n));
      const along = tmpD.dot(c.heading);
      if (along <= 0 || along > look + o.r) continue;
      const lat = tmpS.copy(c.n).cross(c.heading).dot(tmpD), need = o.r + rad + .4; // + : to the left
      if (Math.abs(lat) >= need) continue;
      turn += (lat > 0 ? -1 : 1) * (need - Math.abs(lat)) / need * (1 - along / (look + o.r + 1));
    }
    if (turn) c.heading.applyAxisAngle(c.n, Math.max(-1, Math.min(1, turn)) * dt * 4);
  }
  // Never inside a building: step back out to its edge.
  function pushOut(c, list) {
    const here = tmpP.copy(c.n).multiplyScalar(radius + terrain.surface(c.n)), rad = c.sp.size * .4;
    for (const o of list) {
      tmpD.copy(here).sub(o.p); tmpD.addScaledVector(c.n, -tmpD.dot(c.n));
      const d = tmpD.length(), min = o.r + rad;
      if (d < min && d > 1e-4) { here.addScaledVector(tmpD, (min - d) / d); c.n.copy(here).normalize(); }
    }
  }

  // Animals that were caught come back later at their herd, out of your sight.
  function respawn(c, player) {
    if (player && apart(player.position.clone().normalize(), c.herd) < 70) return false;
    c.n.copy(c.herd).add(randomNear(THREE, c.r, 10 / radius).sub(Y)).normalize();
    if (!fits(c.sp, c.n)) c.n.copy(c.herd);
    c.heading = tangent(c.heading, c.n); c.hidden = 0; c.state = 'idle'; c.timer = 0; c.speed = 0; c.hunger = .2; c.threat = null;
    return true;
  }

  function step(c, dt, t, player, sun) {
    // Fliers that have landed (perch) walk like ground animals until they take off again.
    const sp = c.sp, eco = c.eco, flying = sp.altitude[1] > 0 && c.perch < .5, swim = !!sp.aquatic;
    if (c.band.dry) { c.mesh.setMatrixAt(c.index, hidden); return; }
    if (c.hidden > 0) {
      c.hidden -= dt;
      if (c.hidden > 0 || !respawn(c, player)) { c.hidden = Math.max(c.hidden, .01); c.mesh.setMatrixAt(c.index, hidden); return; }
    }
    c.timer -= dt; c.scan -= dt; c.rest -= dt; c.cooldown -= dt;
    c.hunger = Math.min(1, c.hunger + eco.hungerRate * dt);
    if (eco.drinks) c.thirst = Math.min(1, c.thirst + eco.thirstRate * dt);
    const awake = isAwake(eco.activity, sun ? c.n.dot(sun) : null);
    if (c.scan <= 0) { c.scan = .4 + c.r() * .3; scan(c, t, awake); }
    const sleeping = c.state === 'sleep';
    let posture = 0; // 0 standing, 1 head down (feeding, drinking), 2 lying down
    let busy = true;

    // 1. Danger from hunters: run, or (big grazers) stand and face it. Herd-mates
    //    take the alarm from whoever saw it first.
    const threat = c.threat || (c.band.alarm > t && c.band.threat && !c.band.threat.hidden ? c.band.threat : null);
    const toPlayer = player ? player.position.clone().normalize().sub(c.n).multiplyScalar(radius) : null, playerDist = toPlayer ? toPlayer.length() : Infinity;
    const fear = 6 + sp.size * 5 + (player && !player.onFoot ? 10 : 0);
    const reacting = (state) => { c.state = state; c.meal = null; c.goal = null; c.face = null; c.timer = Math.min(c.timer, 1.5); };
    if (c.talk) { c.target = 0; c.state = 'talk'; c.prey = null; } // talking with you (talkWith): stand and attend
    else if (c.meet && c.spots) busy = false; // coming out to meet you (arrive): townLife
    // Wary townsfolk step back if you come too close (unless it is to talk).
    else if (c.spots && c.state !== 'inside' && c.townStance === 'wary' && player?.onFoot && playerDist < 4 + sp.size && awake) {
      const away = tangent(toPlayer.clone().negate(), c.n);
      c.heading.lerp(away, Math.min(1, dt * 4)); c.target = sp.speed.walk; if (c.spot) releaseSpot(c); c.spot = null; c.state = 'idle'; c.timer = 0;
    }
    else if (threat && apart(c.n, threat.n) < eco.sight * 1.5) {
      c.prey = null;
      if (eco.defends && threat.sp.size < sp.size * 1.4) {
        const d = apart(c.n, threat.n);
        steer(c, threat.n, 5, dt); c.target = d < 3 + sp.size ? sp.speed.walk * 1.4 : 0; reacting('defend');
      } else {
        const away = tangent(c.n.clone().sub(threat.n), c.n);
        if (c.heading.dot(away) < -.5) away.addScaledVector(c.n.clone().cross(c.heading), 1.2);
        c.heading.lerp(away, Math.min(1, dt * 6)); c.target = sp.speed.run; reacting('flee');
      }
    }
    // 2. You, as prey: big aggressive hunters stalk you on foot, close in at a run and
    //    lunge, then back off for a while. Your ship is a refuge (you are not on foot there).
    else if (eco.stalksYou && !c.spots && player?.onFoot && awake && !c.prey && c.cooldown <= 0 && playerDist < (c.stalking ? eco.sight * 1.7 : eco.sight)) {
      c.heading.lerp(tangent(toPlayer, c.n), Math.min(1, dt * (playerDist < 8 ? 7 : 3)));
      c.target = playerDist > 16 ? sp.speed.walk * .9 : sp.speed.run;
      if (flying) c.dive = Math.min(1, c.dive + dt * (playerDist < 25 ? .9 : 0));
      if (!c.stalking) { c.stalking = true; events.push({ type: 'stalk', creature: c }); }
      reacting('stalk');
      if (playerDist < sp.size * .6 + 1.4) {
        events.push({ type: 'attack', creature: c, damage: Math.min(.45, .16 + sp.size * .07 + sp.traits.aggression * .1), from: c.n.clone() });
        c.cooldown = 10 + c.r() * 8; c.stalking = false; c.heading.negate(); c.target = sp.speed.walk; c.state = 'idle'; c.timer = 3;
      }
    }
    // 2b. Otherwise: skittish animals bolt (sleepers let you come closer), curious ones come over.
    else if (sp.behavior === 'skittish' && !c.spots && playerDist < fear * (sleeping ? .5 : 1)) {
      const away = tangent(toPlayer.clone().negate(), c.n);
      if (c.heading.dot(away) < -.5) away.addScaledVector(c.n.clone().cross(c.heading), 1.2); // wheel round rather than freeze when you are dead ahead
      c.heading.lerp(away, Math.min(1, dt * 6)); c.target = sp.speed.run; c.prey = null; reacting('flee');
    } else if (sp.behavior === 'curious' && !c.spots && player?.onFoot && playerDist < 35 && awake && !c.prey && !eco.stalksYou) {
      c.heading.lerp(tangent(toPlayer, c.n), Math.min(1, dt * 2)); c.target = playerDist > 4 + sp.size * 2 ? sp.speed.walk : 0; reacting('approach');
    }
    // 3. The hunt: stalk at a walk, then sprint; give up when tired or outrun.
    else if (c.prey) {
      const p = c.prey, d = apart(c.n, p.n);
      if (p.hidden || d > eco.sight * 1.6 || c.chase <= 0) { c.prey = null; c.rest = 10 + c.r() * 10; c.state = 'idle'; c.timer = 2; c.target = sp.speed.walk * .5; }
      else {
        steer(c, p.n, d < 6 ? 8 : 4, dt);
        const sprint = d < 12 || p.state === 'flee';
        c.target = sprint ? sp.speed.run * 1.05 : sp.speed.walk * .8;
        if (sprint) c.chase -= dt * (p.state === 'defend' ? 3 : 1); // prey that turns to fight is rarely worth it
        reacting('hunt');
        if (flying) c.dive = Math.min(1, c.dive + dt * (d < 25 ? .8 : 0));
        if (d < (sp.size + p.sp.size) * .45 + .6) {
          p.hidden = 50 + c.r() * 40; p.band.alarm = t + 4; p.band.threat = c;
          events.push({ type: 'catch', hunter: c, prey: p, position: c.n.clone().multiplyScalar(radius + terrain.surface(c.n)) });
          c.prey = null; c.state = 'feed'; c.meal = 'kill'; c.timer = 8 + c.r() * 8; c.target = 0; c.hunger = 0; c.goal = null;
          // Pack-mates close by share the kill.
          for (const o of bySpecies.get(sp.id)) if (o !== c && o.band === c.band && !o.hidden && apart(o.n, c.n) < 15) {
            o.prey = null; o.hunger = Math.min(o.hunger, .1); o.state = 'feed'; o.meal = 'kill'; o.timer = c.timer; o.goal = null; o.face = null;
          }
        }
      }
    } else busy = false;

    // 4. Daily life: sleep when it is not your time of day, otherwise drink, eat or roam
    //    (or, in a town, go about its work).
    const town = !busy && !flying && !swim && c.spots?.length ? towns.get(sp.id) : null;
    if (town) {
      posture = townLife(c, dt, t, awake, playerNow);
      if (c.state === 'inside') { c.mesh.setMatrixAt(c.index, hidden); if (sp.helmet) sp.helmet.mesh.setMatrixAt(c.index, hidden); return; }
    }
    else if (!busy) {
      const arrived = c.goal && apart(c.n, c.goal) < 1 + sp.size * .5;
      if (c.state === 'feed' || c.state === 'drink') {
        c.target = 0; posture = 1;
        if (c.face) c.heading.lerp(c.face, Math.min(1, dt * 3));
        if (c.timer <= 0) { if (c.state === 'drink') c.thirst = 0; else c.hunger = 0; c.state = 'idle'; c.meal = null; c.face = null; }
      } else if (c.state === 'sleep') {
        c.target = 0; posture = 2;
        if (awake) { c.state = 'idle'; c.timer = 0; }
      } else if (c.goal && !arrived && c.timer > 0) {
        steer(c, c.goal, 3, dt); c.target = sp.speed.walk * (c.state === 'toRest' ? .8 : 1.2); // a purposeful walk
      } else if (c.goal && arrived) {
        const s = c.state; c.goal = null; c.target = 0;
        if (s === 'toWater') { c.state = 'drink'; c.timer = 4 + c.r() * 5; }
        else if (s === 'toFood') { c.state = 'feed'; c.timer = 6 + c.r() * 8; }
        else if (s === 'toRest') { c.state = 'sleep'; }
        else if (s === 'toSwim') { c.state = 'paddle'; c.timer = 12 + c.r() * 20; }
      } else if ((c.state === 'perch' || c.state === 'paddle') && c.timer > 0) {
        // On the ground (or paddling about): a slow amble with the odd turn.
        c.target = awake ? sp.speed.walk * (c.state === 'paddle' ? .5 : .3) * (Math.sin(t * .7 + c.altPhase) > 0 ? 1 : 0) : 0;
        if (c.r() < dt * .4) c.heading.applyAxisAngle(c.n, (c.r() - .5) * 2);
        if (!awake && c.state === 'perch') posture = 2;
      } else if (c.timer <= 0 || c.goal) {
        c.goal = null; c.face = null; c.timer = 2 + c.r() * 5; c.state = 'idle';
        // Trips are limited to what this animal can walk in about a minute and a half,
        // and time out a little after it should have arrived.
        const reach = Math.max(12, sp.speed.walk * 1.2 * 90), trip = (g) => apart(c.n, g) / (sp.speed.walk * 1.2) + 8;
        if (!awake && !flying) {
          c.state = 'toRest'; c.goal = c.herd.clone().add(randomNear(THREE, c.r, 5 / radius).sub(Y)).normalize();
          if (apart(c.n, c.goal) > reach) c.goal = c.n.clone(); // too far from the herd: bed down where it is
          c.timer = trip(c.goal);
        }
        else if (eco.drinks && c.thirst > .6) {
          const s = shore.length ? nearest(shore, c.n, x => x.n) : null;
          if (s && apart(c.n, s.n) < Math.min(160, reach)) { c.state = 'toWater'; c.goal = s.n; c.face = s.toWater; c.timer = trip(s.n); }
          else c.thirst = .3; // no water in reach: it makes do with what it eats
        }
        if (!c.goal && eco.eatsPlants && c.hunger > .55 && !flying) {
          const f = food.length ? nearest(food, c.n, x => x, 40, c.r) : null;
          if (f && apart(c.n, f) < Math.min(90, reach)) { c.state = 'toFood'; c.goal = f; c.face = null; c.timer = trip(f); }
          else { c.state = 'feed'; c.timer = 6 + c.r() * 6; } // graze the ground cover where it stands
        }
        // Fliers that perch land now and then to walk and feed, and roost on the ground by night.
        if (sp.perches && !c.goal && c.state !== 'feed' && !c.prey && (!awake || c.r() < .35) && !terrain.isLiquid(c.n)) {
          c.state = 'perch'; c.timer = awake ? 10 + c.r() * 20 : 20 + c.r() * 20; c.target = 0;
        }
        // Amphibious animals go for a swim: out into the water, paddle about, then back.
        else if (sp.swims && awake && !c.goal && c.state !== 'feed' && shore.length && c.r() < .3) {
          const s = nearest(shore, c.n, x => x.n, 12, c.r);
          if (s && apart(c.n, s.n) < Math.min(120, reach)) { c.state = 'toSwim'; c.goal = s.n.clone().addScaledVector(s.toWater, (6 + c.r() * 16) / radius).normalize(); c.timer = trip(c.goal) + 6; }
        }
        if (!c.goal && c.state !== 'feed' && c.state !== 'perch') {
          const prowl = eco.prey.length && c.hunger > .6 && awake;
          c.state = flying || swim ? 'drift' : !prowl && c.r() < .35 ? 'graze' : 'wander';
          c.target = swim ? sp.speed.walk * (awake ? (prowl ? 1 : .4 + c.r() * .7) : .15) : flying ? sp.speed.walk * (awake ? 2.2 : 1.2) : c.state === 'graze' ? 0 : sp.speed.walk * (prowl ? 1 : .6 + c.r() * .6);
          c.heading.applyAxisAngle(c.n, (c.r() - .5) * (prowl ? 1.2 : 2.2));
        }
      }
      if (c.state === 'graze') posture = 1;
      // Herd cohesion keeps roaming animals near their herd.
      if (['wander', 'graze', 'drift', 'idle'].includes(c.state)) {
        const fromHerd = c.n.angleTo(c.herd) * radius;
        if (fromHerd > (swim ? 5 + sp.group * 1.2 + sp.size * 2 : 14 + sp.group * 2)) steer(c, c.herd, .8, dt); // schools keep closer than herds
        if (flying || swim) c.heading.applyAxisAngle(c.n, dt * (swim ? .12 : .25)); // lazy circles
      }
    }
    if (c.state !== 'stalk') c.stalking = false; // lost you, or you got back aboard
    if (!c.prey) c.dive = Math.max(0, c.dive - dt * .3);
    // Out of the towns (keepOut), unless it is running for its life.
    if (c.inZone && c.state !== 'flee') {
      c.heading.lerp(tangent(c.n.clone().sub(c.inZone.n), c.n), Math.min(1, dt * 3)); c.target = Math.max(c.target, sp.speed.walk * .9);
      if (c.goal) { c.goal = null; c.state = 'wander'; c.timer = 4; }
    }
    // A leash keeps everything within the explorable area.
    if (!pinned.has(sp.id) && c.n.angleTo(home) * radius > RANGE) steer(c, home, 1, dt);

    c.speed += (c.target - c.speed) * Math.min(1, dt * 3);
    c.heading = tangent(c.heading, c.n);
    const solidsHere = c.spots?.length && !flying && !swim ? towns.get(sp.id)?.near(tmpP.copy(c.n).multiplyScalar(radius + terrain.surface(c.n))) : null;
    if (solidsHere && c.speed > .05) avoidBuildings(c, solidsHere, dt);
    if (c.speed > .01) {
      const angle = c.speed * dt / radius, axis = c.n.clone().cross(c.heading).normalize();
      tmpQ.setFromAxisAngle(axis, angle);
      const next = c.n.clone().applyQuaternion(tmpQ);
      // Ground animals turn back where the water gets too deep to wade (amphibious ones
      // swim on), sea life at the shallows; nothing leaves the sky.
      if (!canGo(sp, next, flying)) {
        c.heading.negate(); c.speed *= .3;
        if (c.goal && c.state === 'toWater') { c.state = 'drink'; c.goal = null; c.timer = 4 + c.r() * 5; c.face = c.heading.clone().negate(); }
        else c.timer = Math.min(c.timer, 1);
      }
      else { c.n.copy(next).normalize(); c.heading.applyQuaternion(tmpQ); }
      if (solidsHere) pushOut(c, solidsHere);
    }
    // Gait: legs cycle with distance travelled; wings and floaters keep moving in place.
    // Rollers turn once per circumference travelled, so they really roll.
    const stride = sp.plan === 'roller' ? sp.size * .5 : Math.max(.3, sp.legLength * 1.6 || sp.size);
    const still = posture === 2 && !flying;
    c.perch += ((c.state === 'perch' ? 1 : 0) - c.perch) * Math.min(1, dt * .8);
    // Swimmers beat their tails faster the faster they go (jellies pulse slowly).
    c.cycle += still ? 0 : swim ? dt * Math.min(14, sp.form === 'jelly' ? 1.4 : 1.8 + c.speed / Math.max(.25, sp.size) * 2.2) : flying ? dt * (sp.plan === 'floater' ? 1.2 : 5) : c.speed * dt / stride * (sp.plan === 'roller' ? 1 : Math.PI);
    // amp 1 marks full flight (wings beat); below that, a landed flier's wings stay nearly folded.
    let amp = still ? 0 : flying ? 1 : sp.altitude[1] > 0 ? Math.min(.95, c.speed / Math.max(.2, sp.speed.walk)) : swim ? 1 : Math.min(1, c.speed / Math.max(.2, sp.speed.walk));
    // At work in town: hands busy (negative amp, see addAnimation); talking: now and then a gesture.
    if (c.state === 'duty' && c.duty?.arrived && c.speed < .1) {
      if (c.duty.pose === 'work' || c.duty.pose === 'field') { c.cycle += dt * 3.2; amp = -1; }
      else if (c.duty.pose === 'chat') { c.cycle += dt * 2; amp = -(.2 + .4 * Math.max(0, Math.sin(t * .9 + c.altPhase))); }
    } else if (c.state === 'atSpot' && c.speed < .1 && c.spot) {
      if (c.spot.kind === 'work') { c.cycle += dt * 3.2; amp = -1; }
      else if (c.spot.kind === 'chat') { c.cycle += dt * 2; amp = -(.2 + .4 * Math.max(0, Math.sin(t * .9 + c.altPhase))); }
    }
    // Posture: lower the head to eat or drink, settle down to sleep. Fliers swoop on prey.
    const grounded = !flying && !swim && !['serpent', 'slug'].includes(sp.plan) && !(sp.altitude[1] > 0);
    // Bending to the work, for those with no hands to work with.
    const bend = ((c.state === 'atSpot' && c.spot?.kind === 'work') || (c.state === 'duty' && c.duty?.arrived && (c.duty.pose === 'work' || c.duty.pose === 'field'))) && !sp.arms ? .1 + .16 * (.5 + .5 * Math.sin(t * 2.4 + c.altPhase)) : 0;
    c.tilt += ((posture === 1 && grounded ? .32 : bend) - c.tilt) * Math.min(1, dt * 3);
    if (swim) swimDepth(c, dt, awake);
    c.sink += ((posture === 2 && grounded ? (sp.plan === 'roller' ? .15 * sp.size : sp.legLength * .55) : 0) - c.sink) * Math.min(1, dt * 1.5);
    const air = sp.altitude[1] > 0 ? (c.alt + Math.sin(t * .6 + c.altPhase) * 1.5) * (1 - c.dive * .85) * (1 - c.perch) : 0;
    let ground = swim ? swimHeight(c) : radius + terrain.surface(c.n) + air - c.sink;
    if (!swim && sp.altitude[1] === 0) {
      // On the bed of the shallows when wading; amphibious animals float with their backs at the surface where it is deeper.
      const bed = radius + bedAt(c.n) - c.sink;
      ground = sp.swims ? Math.max(bed, radius + terrain.sea - sp.legLength - sp.body.height * .55 - (c.state === 'hunt' || c.state === 'flee' ? .6 : 0)) : bed;
    } else if (sp.altitude[1] > 0) {
      ground -= c.perch * (terrain.surface(c.n) - bedAt(c.n)); // a landed flier stands on the bed of the shallows
      // Diving fliers plunge after what they hunt, even under the water.
      if (sp.dives && c.prey && c.dive > .5 && c.prey.pos.lengthSq()) ground = Math.max(radius + terrain.surface(c.n) + .2, ground + (c.prey.pos.length() - ground) * Math.min(1, (c.dive - .5) * 2.2)); // (never into a hillside: the prey may be lower down a slope)
    }
    pos.copy(c.n).multiplyScalar(ground);
    c.pos.copy(pos);
    right.copy(c.n).cross(c.heading).normalize();
    const ct = Math.cos(c.tilt), st = Math.sin(c.tilt);
    up.copy(c.n).multiplyScalar(ct).addScaledVector(c.heading, st);
    fwd.copy(c.heading).multiplyScalar(ct).addScaledVector(c.n, -st);
    // Expression (express.mjs): what it looks at, how it carries itself, a greeting.
    const pose = expression(c, dt, t, player, toPlayer, playerDist, posture, flying, swim);
    if (pose.arms !== null && sp.arms) { amp = pose.arms; c.cycle += dt * 2; }
    basis.makeBasis(right, up, fwd); // local +Y up, +Z forward
    m.copy(basis).setPosition(pos);
    const k = c.young ? .55 : 1; // the young are small
    if (pose.pitch || pose.roll || pose.yaw || pose.lift || pose.scale !== 1 || k !== 1) {
      const hip = (c.top ?? sp.size) * .35 * k;
      exQ.setFromEuler(exE.set(pose.pitch, pose.yaw, pose.roll, 'YXZ'));
      exM.compose(exV.set(0, hip + pose.lift, 0), exQ, exS.set(k, pose.scale * k, k)).multiply(exM2.makeTranslation(0, -hip, 0));
      m.multiply(exM);
    }
    c.mesh.setMatrixAt(c.index, m);
    if (sp.helmet) {
      helmetM.copy(m);
      const hp = c.mesh.geometry.userData.headPivot;
      if (hp) helmetM.multiply(exM2.makeTranslation(hp[0], hp[1], hp[2])).multiply(exM3.makeRotationFromEuler(exE.set(-pose.headPitch, pose.headYaw, 0, 'YXZ'))).multiply(exM2.makeTranslation(-hp[0], -hp[1], -hp[2]));
      helmetM.multiply(sp.helmet.offset); sp.helmet.mesh.setMatrixAt(c.index, helmetM); sp.helmet.mesh.instanceMatrix.needsUpdate = true;
    }
    c.mesh.geometry.attributes.iAnim.setXY(c.index, c.cycle, amp);
    c.mesh.geometry.attributes.iLook.setXYZ(c.index, pose.headYaw, pose.headPitch, pose.glow);
  }
  // What an animal is paying attention to, and how that shows (express.mjs). In order: you,
  // when you are talking to it (talk) or it has come out to meet you (meet); whoever it is
  // talking to in town; something it hunts or runs from; you, if you are close and it is
  // the kind to notice; otherwise it glances about.
  const exQ = new THREE.Quaternion(), exE = new THREE.Euler(), exM = new THREE.Matrix4(), exM2 = new THREE.Matrix4(), exM3 = new THREE.Matrix4(), exV = new THREE.Vector3(), exS = new THREE.Vector3(), exT = new THREE.Vector3();
  function expression(c, dt, t, player, toPlayer, playerDist, posture, flying, swim) {
    const sp = c.sp, ex = c.ex ||= createExpression(c.r);
    const headY = (c.top ?? sp.size) * .8 * (c.young ? .55 : 1);
    let at = null, mood = null;
    const playerHead = () => exT.copy(player.position).addScaledVector(c.n, player.onFoot ? 1.6 : 2.5);
    if (posture === 2 || c.state === 'sleep') at = null;
    else if (c.talk && player) { at = playerHead(); mood = c.talk.mood; }
    else if (c.meet && player && c.meet.until > t) { at = playerHead(); mood = c.meet.mood; }
    else if (c.state === 'duty' && c.duty?.arrived && c.duty.look === 'up') at = exT.copy(pos).addScaledVector(c.n, 30).addScaledVector(c.heading, 12); // stargazing
    else if (c.state === 'duty' && c.duty?.arrived && c.duty.centre && !(player && playerDist < 5)) at = exT.copy(c.duty.centre).multiplyScalar(radius + terrain.surface(c.duty.centre)).addScaledVector(c.n, headY);
    else if (c.state === 'flee' || c.state === 'hunt' || c.state === 'defend') at = c.prey && c.state !== 'flee' ? exT.copy(c.prey.pos) : null;
    else if (c.state === 'atSpot' && c.spot?.kind === 'chat' && c.partner && c.partner.state === 'atSpot' && !c.partner.hidden) at = exT.copy(c.partner.pos).addScaledVector(c.n, (c.partner.top ?? c.partner.sp.size) * .8);
    else if (player && playerDist < (c.spots ? 14 : sp.behavior === 'indifferent' ? 7 : 12 + sp.size * 2) && !flying) {
      at = playerHead();
      if (c.spots && playerDist < 10) mood = c.townMood;
    }
    let look = null;
    if (at) {
      const a = lookAngles(at.x - pos.x - up.x * headY, at.y - pos.y - up.y * headY, at.z - pos.z - up.z * headY, right, up, fwd);
      look = a;
      // Townsfolk (and anything you talk to) turn to face what they look at, if it is behind them.
      if ((c.talk || c.meet || c.spots) && c.speed < .1 && Math.abs(a.yaw) > (c.talk || c.meet ? .2 : .9)) c.heading.applyAxisAngle(c.n, Math.sign(a.yaw) * Math.min(Math.abs(a.yaw) - (c.talk || c.meet ? 0 : .6), dt * 2));
    }
    return express(ex, dt, { look, mood, t, phase: c.altPhase, sp, still: c.speed < .15 && !flying && !swim });
  }
  // Sea life: how deep each swimmer is. Each picks a depth in its range every few
  // seconds (deeper when asleep or fleeing); leviathans and some rays come up to
  // breathe, their backs breaking the surface; quick swimmers leap clear now and then,
  // more often when chased or chasing.
  function swimDepth(c, dt, awake) {
    const sp = c.sp, [d0, d1] = sp.depth, alarmed = c.state === 'flee' || c.state === 'hunt';
    if ((c.depthTimer -= dt) <= 0) { c.depthTimer = 4 + c.r() * 8; c.depthGoal = awake ? d0 + c.r() * (d1 - d0) : d1; }
    if (sp.surfaces && awake && (c.breath -= dt) <= 0) { c.breath = 25 + c.r() * 35; c.surfacing = 6 + c.r() * 5; }
    let goal = c.state === 'flee' ? d1 : c.depthGoal;
    if (c.surfacing > 0) { c.surfacing -= dt; goal = sp.body.height * .1; }
    c.depth += (goal - c.depth) * Math.min(1, dt * (alarmed ? 1.2 : .5));
    if (c.leap < 0 && sp.leaps && awake && c.depth < d1 + .5 && c.r() < dt * (alarmed ? .3 : sp.glides ? .04 : .02)) { c.leap = 0; c.leapTime = sp.glides ? 2.2 + sp.size * 1.2 : .55 + Math.sqrt(sp.size) * .45; }
    if (c.leap >= 0 && sp.glides) c.target = Math.max(c.target, sp.speed.run); // gliders sail far
    if (c.leap >= 0) {
      c.leap += dt / c.leapTime;
      if (c.leap >= 1) { c.leap = -1; c.depth = Math.max(c.depth, .5); }
      else c.tilt = -(sp.glides ? .35 : .85) * Math.cos(Math.PI * c.leap); // nose up out of the water, nose down back in
    }
  }
  function swimHeight(c) {
    const floor = radius + terrain.height(c.n) - c.bottom + .05, sea = radius + terrain.sea;
    if (c.leap >= 0) { const a = Math.sin(Math.PI * c.leap), arc = c.sp.glides ? Math.min(1, a * 2.5) * (1.2 + c.sp.size * 1.4) : a * (.35 + c.sp.size * .8); return Math.max(floor, sea + arc - (1 - a) * .4); }
    return Math.max(floor, sea - c.depth);
  }
  // Moves the animals' home area to follow you. Herds left more than RANGE behind
  // find new ground that suits them near you (never right beside you), and their
  // animals out of your sight go there at once; any in sight walk. Species that have
  // built settlements stay at home (pin).
  const pinned = new Set();
  let refresh = 0;
  const here = new THREE.Vector3();
  function follow(camera) {
    here.copy(camera).normalize();
    if (++refresh % 240 === 0) findFood(); // plants fill in as you move
    if (here.angleTo(home) * radius < RANGE * .45) return;
    home.copy(here); toHome.setFromUnitVectors(Y, home);
    for (const { sp, herd, r } of bands) {
      if (pinned.has(sp.id) || (!herd.dry && herd.centre.angleTo(home) * radius < RANGE * .9)) continue;
      let best = null, bestFit = -1;
      for (let t = 0; t < (sp.aquatic ? 48 : 24); t++) {
        const n = randomNear(THREE, r, RANGE * .8 / radius).applyQuaternion(toHome);
        if ((!sp.aquatic && n.angleTo(here) * radius < 70) || n.angleTo(signalNormal) < 25 / radius || !fits(sp, n)) continue;
        const c = terrain.climate(n), f = habitatFit(sp, c) + r() * .15;
        if (f > bestFit) { bestFit = f; best = n; }
      }
      if (!best) continue; // no dry ground (or open water) here: stay put for now
      const wasDry = herd.dry;
      herd.centre.copy(best); herd.dry = false;
      herd.alarm = 0; herd.threat = null;
      for (const c of creatures) {
        if (c.band !== herd || (!wasDry && c.n.angleTo(here) * radius < 90)) continue;
        c.n.copy(best).add(randomNear(THREE, c.r, 10 / radius).sub(Y)).normalize();
        if (!fits(sp, c.n)) c.n.copy(best);
        c.heading = tangent(c.heading, c.n); c.state = 'idle'; c.timer = 0; c.speed = 0; c.goal = null; c.prey = null; c.threat = null;
      }
    }
    findFood(); findShore();
  }

  return {
    group, species: absent ? species.filter((s) => !absent.has(s.id)) : species, creatures, events, update, homes, follow,
    // Keeps a species' herds where they are (builders stay in their settlements).
    pin(id) { pinned.add(id); },
    // An intelligent species' town: places to go (spots: { n, face, kind }) and the buildings to walk round (near(p)).
    // stance: how they take to you (station-deck.js stanceOf), shown in how they carry themselves.
    // opts: { path, centres (unit vectors of squares and hearts of town), fields, hearths, edge (metres) }:
    // what the town does together (vignettes). A quarter of them are young.
    setTown(id, town, { stance = null, ...opts } = {}) {
      towns.set(id, town); tame.add(id);
      town.opts = opts; town.edge = opts.edge;
      (bySpecies.get(id) || []).forEach((c, i) => { c.young = i % 4 === 3 && (bySpecies.get(id).length >= 4); });
      town.graph ||= streetGraph(town.paths);
      // A few places along the streets to stroll to.
      if (town.graph.nodes.length && !town.strolls) {
        town.strolls = [];
        for (let i = 0; i < town.graph.nodes.length; i += 7) { const n = town.graph.nodes[i], nx = town.graph.nodes[Math.min(i + 1, town.graph.nodes.length - 1)]; town.strolls.push({ n, face: tangent(nx.clone().sub(n).lengthSq() > 1e-12 ? nx.clone().sub(n) : new THREE.Vector3(1, 0, 0), n), kind: 'stroll', taken: null }); }
        town.spots = [...town.spots, ...town.strolls];
      }
      for (const c of creatures) if (c.sp.id === id) { c.townStance = stance; c.townMood = moodOf(stance); c.spots = town.spots.filter((s) => apart(s.n, c.herd) < 70); if (c.spots.length < 3) { c.spots = null; continue; }
        // They start out in town, already at something (their herds were moved there when it was built).
        const s = c.spots.find((x) => !x.taken);
        if (s) { c.n.copy(s.n); c.heading = tangent(s.face, s.n); s.taken = c; c.spot = s; c.state = 'atSpot'; c.timer = 3 + c.r() * 20; c.goal = null; }
        else { c.state = 'idle'; c.timer = 0; c.goal = null; }
      }
    },
    // Some of a wild species live in town, kept by the builders: they graze in pens round
    // the edge and are never chased off. pens: [{ n, face }]. Returns the species, or null.
    keepAnimals(pens, { count = 5, builderSize = 1 } = {}) {
      if (!pens?.length) return null;
      const fit = species.filter((sp) => !sp.aquatic && !(sp.altitude[1] > 0) && !tame.has(sp.id) && !sp.ecology.stalksYou && sp.traits.diet === 'herbivore' && sp.size < builderSize * 2.5 && !sp.arms);
      if (!fit.length) return null;
      const sp = fit.sort((a, b) => a.size - b.size)[0], spots = pens.map((p) => ({ n: p.n, face: p.face, kind: 'graze', taken: null }));
      const kept = bySpecies.get(sp.id).filter((c) => !c.hidden).slice(0, count);
      kept.forEach((c, i) => {
        c.kept = true; c.spots = spots;
        const s = spots[i % spots.length]; c.n.copy(s.n).add(randomNear(THREE, c.r, 2 / radius).sub(Y)).normalize(); c.heading = tangent(s.face, c.n); c.state = 'idle'; c.timer = 0; c.goal = null;
      });
      towns.set(sp.id, { spots, near: [...towns.values()][0]?.near ?? (() => []), graph: [...towns.values()][0]?.graph });
      return kept.length ? sp : null;
    },
    // You have set down near a town (at: unit vector of where; stance: theirs). Welcoming
    // townsfolk gather at the edge of the landing ground and greet you; curious ones, a few,
    // come close to look; wary ones go to their doorways and watch; guarded ones send two
    // out to stand a few metres off. Returns how many came.
    arrive(at, stance, { from = 160, ship = 9 } = {}) {
      const t = time.value, mood = moodOf(stance);
      const near = creatures.filter((c) => c.spots && !c.kept && !c.hidden && !c.talk && c.state !== 'sleep' && c.state !== 'toBed' && apart(c.n, at) < from).sort((a, b) => apart(a.n, at) - apart(b.n, at));
      const n = { welcome: 9, curious: 3, wary: 6, guarded: 2 }[stance] ?? 0, chosen = near.slice(0, n);
      if (!chosen.length) return 0;
      // Toward the town: the arc they gather on faces where they came from.
      const toward = new THREE.Vector3();
      for (const c of chosen) toward.add(tangent(c.n.clone().sub(at), at));
      if (toward.lengthSq() < 1e-6) toward.copy(tangent(new THREE.Vector3(1, 0, 0), at)); else toward.copy(tangent(toward, at));
      const across = at.clone().cross(toward).normalize();
      chosen.forEach((c, i) => {
        let dist, ang;
        if (stance === 'welcome') { dist = ship + 4 + (i % 2) * 2.5 + c.sp.size; ang = (i / Math.max(1, chosen.length - 1) - .5) * 1.8; }
        else if (stance === 'curious') { dist = ship - 2 + c.sp.size + i * 1.5; ang = (i - 1) * .6; }
        else if (stance === 'guarded') { dist = ship - 3 + c.sp.size * 1.5; ang = (i ? 1 : -1) * (.12 + c.sp.size * .05); }
        else { // wary: the doorstep nearest them, facing you
          const s = c.spots.filter((x) => x.kind !== 'chat' && (!x.taken || x.taken === c)).sort((a, b) => apart(a.n, c.n) - apart(b.n, c.n))[0];
          releaseSpot(c); if (s) { c.spot = s; s.taken = c; }
          c.meet = { n: (s?.n ?? c.n).clone(), mood, until: t + 50 + c.r() * 20, leave: t + 40, greet: false };
          c.state = 'toMeet'; c.goal = null; return;
        }
        const dir = toward.clone().multiplyScalar(Math.cos(ang)).addScaledVector(across, Math.sin(ang));
        releaseSpot(c); c.spot = null;
        c.meet = { n: at.clone().addScaledVector(dir, dist / radius).normalize(), mood, until: t + (stance === 'guarded' ? 120 : 45 + c.r() * 25), leave: t + 40, greet: stance !== 'guarded', delay: i * .35 + c.r() * .4 };
        c.state = 'toMeet'; c.goal = null;
      });
      return chosen.length;
    },
    // Talking to one of them (contact): it stops, turns to you and attends; mood from stance.
    talkWith(creature, stance) {
      for (const c of creatures) if (c.talk) { c.talk = null; c.state = 'idle'; c.timer = 0; }
      if (!creature) return;
      if (creature.spot) releaseSpot(creature); creature.spot = null; creature.meet = null;
      creature.talk = { mood: moodOf(stance) }; creature.speed = 0;
    },
    // A gesture (its greeting, unless another kind is given).
    gesture(creature, kind) { if (creature) startGesture(creature.ex ||= createExpression(creature.r), kind || gestureOf(creature.sp)); },
    // Keep wild animals out of big towns and cities: zones [{ n (unit), r (metres) }]. Herds
    // living there move out to fitting ground nearby, at once.
    keepOut(zones, test = null) {
      keepZones.length = 0; keepZones.push(...zones); keepTest = test;
      for (const b of bands) {
        if (b.sp.aquatic || tame.has(b.sp.id) || !zoneAt(b.sp, b.herd.centre)) continue;
        let best = null;
        for (let k = 0; k < 70 && !best; k++) { const n = b.herd.centre.clone().add(randomNear(THREE, b.r, (60 + k * (keepTest ? 30 : 6)) / radius).sub(Y)).normalize(); if (fits(b.sp, n)) best = n; }
        if (best) b.herd.centre.copy(best);
      }
      for (const c of creatures) if (!c.kept && zoneAt(c.sp, c.n)) {
        c.n.copy(c.band.centre).add(randomNear(THREE, c.r, 8 / radius).sub(Y)).normalize();
        if (!fits(c.sp, c.n)) c.n.copy(c.band.centre);
        c.heading = tangent(c.heading, c.n); c.goal = null; c.state = 'idle'; c.timer = 0;
      }
    },
    // Planet-local positions of every visible animal of a species (for cataloguing).
    positionsOf(sp) { return creatures.filter(c => c.sp === sp && !c.hidden && !c.band.dry && c.state !== 'inside').map(c => sp.aquatic ? c.pos.clone() : c.n.clone().multiplyScalar(radius + terrain.surface(c.n))); },
    // The same, with each animal: [{ creature, position }] (for watching what one is doing).
    individualsOf(sp) { return creatures.filter(c => c.sp === sp && !c.hidden && !c.band.dry && c.state !== 'inside').map(c => ({ creature: c, position: sp.aquatic ? c.pos.clone() : c.n.clone().multiplyScalar(radius + terrain.surface(c.n)) })); },
  };
}

// Nearest item to n; with `sample`, the nearest of that many random picks (cheap, and varied).
function nearest(list, n, get, sample = 0, r = Math.random) {
  let best = null, d0 = -2;
  const k = sample ? Math.min(sample, list.length) : list.length;
  for (let i = 0; i < k; i++) {
    const x = sample ? list[Math.floor(r() * list.length)] : list[i], d = get(x).dot(n);
    if (d > d0) { d0 = d; best = x; }
  }
  return best;
}

// A crew of one species for a place that is not a world's surface (a station deck): one
// instanced mesh (plus helmets for suited species) in the caller's own frame. set(i, matrix,
// cycle, amp) poses individual i; cycle is its gait phase and amp how hard it is moving
// (the same values the herds use). THREE is passed in.
export function buildCrew(THREE, sp, count, seed = 'crew') {
  const geometry = buildGeometry(THREE, sp, rng(seed, 'crew', sp.id));
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox, extent = { top: bb.max.y, bottom: Math.max(bb.min.y, -sp.size * .6) };
  const anim = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
  anim.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('iAnim', anim);
  const look = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  look.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('iLook', look);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 });
  material.userData.surfaceDetail = true;
  addAnimation(material, sp);
  const group = new THREE.Group(), mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; group.add(mesh);
  if (!sp.aquatic) { mesh.customDepthMaterial = creatureDepthMaterial(THREE, sp); mesh.castShadow = true; }
  let helmet = null, offset = null;
  if (sp.suit) {
    const hr = sp.head * 1.45, upright = sp.plan === 'biped';
    offset = new THREE.Matrix4().makeTranslation(0, bb.max.y - hr * (upright ? .75 : 1), upright ? bb.max.z * .35 : bb.max.z - hr * 1.05);
    helmet = new THREE.InstancedMesh(new THREE.SphereGeometry(hr, 14, 10), new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: .32, roughness: .05, metalness: .2, depthWrite: false }), count);
    helmet.instanceMatrix.setUsage(THREE.DynamicDrawUsage); helmet.frustumCulled = false; group.add(helmet);
  }
  const hm = new THREE.Matrix4(), hr = new THREE.Matrix4(), ht = new THREE.Matrix4(), he = new THREE.Euler(), hp = geometry.userData.headPivot;
  const stride = sp.plan === 'roller' ? sp.size * .5 : Math.max(.3, sp.legLength * 1.6 || sp.size);
  return {
    group, mesh, extent, stride, headPivot: hp,
    // yaw/pitch: where the head points (express.mjs); glow: extra glow, 0..1.
    set(i, matrix, cycle, amp, yaw = 0, pitch = 0, glow = 0) {
      mesh.setMatrixAt(i, matrix); anim.setXY(i, cycle, amp); look.setXYZ(i, yaw, pitch, glow);
      if (helmet) {
        hm.copy(matrix);
        if (hp && (yaw || pitch)) hm.multiply(ht.makeTranslation(hp[0], hp[1], hp[2])).multiply(hr.makeRotationFromEuler(he.set(-pitch, yaw, 0, 'YXZ'))).multiply(ht.makeTranslation(-hp[0], -hp[1], -hp[2]));
        helmet.setMatrixAt(i, hm.multiply(offset));
      }
    },
    commit() { mesh.instanceMatrix.needsUpdate = true; anim.needsUpdate = true; look.needsUpdate = true; if (helmet) helmet.instanceMatrix.needsUpdate = true; },
  };
}

// A colonist from another world: the same species in a pressure suit (plain suit
// fabric with the civilization's accent colour, a glass helmet), calm and unafraid,
// with no prey, no thirst and no time of day of its own.
export function suitUp(sp, { suit = true } = {}) {
  const c = structuredClone({ ...sp, helmet: undefined });
  c.id = `${sp.id}-colonist`;
  c.behavior = 'indifferent';
  c.ecology = { ...sp.ecology, prey: [], predators: [], drinks: false, eatsPlants: false, activity: 'any', stalksYou: false };
  c.herds = 2; c.group = Math.max(3, Math.min(6, sp.group));
  if (suit) {
    c.suit = true;
    c.colors = { ...sp.colors, base: '#e6e9ec', belly: '#c4cad0', shimmer: '#d9dde1', accent: sp.colors.accent || '#c0503a' };
    c.pattern = 'saddle'; c.glow = 0;
  }
  return c;
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
// Surfaces (aKind, see KIND in fauna-culture.mjs) get their own close-up look, taken
// from the rest pose so it stays put on moving limbs: soft pores and blotches on skin,
// a woven weave and drape on cloth, quilted panels on suits, brushed metal, wood
// grain, gloss on eyes and horn, and the old rocky grain only on stone.
const CREATURE_POSE = `attribute float aPart; attribute vec3 aPivot; attribute vec3 aKnee; attribute vec2 aPhase; /* x: phase, y: bend (packed: WebGL allows only 16 attributes) */ attribute float aGlow; attribute float aKind; attribute vec2 iAnim; attribute vec3 iLook; uniform float uSize; varying float vGlow; flat varying float vKind; varying vec3 vRest; varying vec3 vRestN; // flat: a kind must not blend into another across a triangle
mat3 rX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
vec3 rotK(vec3 v, vec3 k, float a) { return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1. - cos(a)); }
void creaturePose(inout vec3 p, inout vec3 n) {
  // iAnim.y below zero: standing at work. The legs rest and the arms work: reach forward,
  // and lift and fall in a steady rhythm (hammering, tending, handling), each arm its own way.
  float cyc = iAnim.x, amp = max(0., iAnim.y), work = max(0., -iAnim.y);
  if (aPart == 1. || aPart == 5. || aPart == 6. || aPart == 7.) {
    bool arm = aPart >= 6.;
    float ph = cyc + aPhase.x + (arm ? 3.14159 : 0.);
    float swing = sin(ph) * (arm ? .35 : .5) * amp;
    if (arm && work > 0.) swing = (-.8 + sin(cyc + aPhase.x * 1.7) * .45) * min(1., work);
    if (arm && work > 1.5) swing = -2.5 + sin(cyc * 1.3 + aPhase.x) * .18; // both arms raised high (a greeting)
    if (aPart == 5. || aPart == 7.) {
      float bend = (arm ? (work > 1.5 ? .25 : work > 0. ? .55 + .5 * (.5 + .5 * sin(cyc + aPhase.x * 1.7 + 1.2)) * work : .5) : max(0., sin(ph + 1.5708)) * .9 * amp) * aPhase.y;
      mat3 k = rX(bend); p = k * (p - aKnee) + aKnee; n = k * n;
    }
    mat3 h = rX(swing); p = h * (p - aPivot) + aPivot; n = h * n;
  } else if (aPart == 2.) {
    mat3 w = rZ(sin(cyc) * .75 * aPhase.x * (amp > .99 ? 1. : amp * .15)); p = w * (p - aPivot) + aPivot; n = w * n; // landed: wings still
  } else if (aPart == 3.) {
    mat3 t = rY(sin(cyc * .5 + aPhase.x) * .4 * aPhase.y) * rX(sin(cyc * .37 + aPhase.x) * .12 * aPhase.y); p = t * (p - aPivot) + aPivot; n = t * n;
  } else if (aPart == 4.) {
    p.x += sin(cyc * 1.5 - p.z * 6. / uSize) * uSize * .1 * (.3 + amp) * (aPhase.y > 0. ? aPhase.y : 1.); // aPhase.y: how far it swings (fish swing their tails more than their heads)
  } else if (aPart == 9.) {
    // Radial legs (aKnee holds the leg's outward direction): lift the foot, then swing it round.
    float ph = cyc + aPhase.x; vec3 k = normalize(cross(aKnee, vec3(0., 1., 0.)));
    float lift = max(0., sin(ph)) * .45 * amp * aPhase.y, yaw = cos(ph) * .22 * amp;
    p = rotK(p - aPivot, k, lift) + aPivot; n = rotK(n, k, lift);
    mat3 y = rY(yaw); p = y * (p - aPivot) + aPivot; n = y * n;
  } else if (aPart == 10.) {
    mat3 r = rX(cyc); p = r * (p - aPivot) + aPivot; n = r * n;
  } else if (aPart == 11.) {
    // An up-and-down wave travelling down the body (ribbons, leviathans), stronger toward the tail.
    p.y += sin(cyc * 1.5 + p.z * 5. / uSize) * uSize * .05 * (.4 + amp) * (.35 + aPhase.y);
  } else if (aPart == 12.) {
    mat3 r = rY(cyc * .45); p = r * (p - aPivot) + aPivot; n = r * n;
  } else if (aPart == 13.) {
    // The head turns to look (iLook.x yaw, + to its right; iLook.y pitch, + up).
    mat3 r = rY(iLook.x) * rX(-iLook.y); p = r * (p - aPivot) + aPivot; n = r * n;
  }
  if (aPart != 2. && (aPart < 10. || aPart == 13.) && aPivot.y >= 0.) p.y += abs(sin(cyc)) * amp * uSize * .025;
}
`;
// Its shadow (atmosphere.js): drawn in the same pose, so the shadow's legs walk with the animal's.
export function creatureDepthMaterial(THREE, sp) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSize = { value: sp.size };
    shader.vertexShader = CREATURE_POSE + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 cP = position; vec3 cN = vec3(0., 1., 0.); creaturePose(cP, cN); transformed = cP;`);
  };
  m.customProgramCacheKey = () => 'creature-depth';
  return m;
}
function addAnimation(material, sp) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSize = { value: sp.size };
    shader.vertexShader = CREATURE_POSE + shader.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 cP = position; vec3 cN = objectNormal; creaturePose(cP, cN); objectNormal = cN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed = cP; vGlow = aGlow * (1. + iLook.z * 2.5) + iLook.z * .12 * step(.01, aGlow); vKind = aKind; vRest = position; vRestN = normal;
#ifdef USE_INSTANCING
vRest *= length(instanceMatrix[0].xyz); // metres, whatever the instance's size
#endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vGlow; flat varying float vKind; varying vec3 vRest; varying vec3 vRestN; // flat: a kind must not blend into another across a triangle
float cHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float cNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cHash(i), cHash(i + vec3(1, 0, 0)), f.x), mix(cHash(i + vec3(0, 1, 0)), cHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(cHash(i + vec3(0, 0, 1)), cHash(i + vec3(1, 0, 1)), f.x), mix(cHash(i + vec3(0, 1, 1)), cHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      // Close-up surface by kind. Slopes are taken outside any branch (see planet-lod.js).
      vec3 P = vRest;
      float px = length(fwidth(P));
      float cK = 1.0 - smoothstep(30.0, 70.0, length(vViewPosition));
      float fine = 1.0 - smoothstep(.2, .45, 60.0 * px), mid = 1.0 - smoothstep(.2, .45, 12.0 * px);
      int kind = int(vKind + .5);
      float cH = 0.0, cF = 1.0, cRough = .7, cMetal = 0.0;
      if (kind == 0) {        // skin: faint blotches and soft pores, a slight sheen
        float blot = cNoise(P * 5.0), pore = cNoise(P * 70.0);
        cF = 1.0 + (blot - .5) * .12 + (pore - .5) * .06 * fine;
        cH = blot * .0012 * mid - pore * .0004 * fine;
        cRough = .58;
      } else if (kind == 1) { // woven cloth: threads over and under, and a soft drape
        vec3 an = abs(normalize(vRestN));
        vec2 uv = an.x > an.y && an.x > an.z ? P.yz : an.y > an.z ? P.xz : P.xy;
        float k = 190.0, wf = 1.0 - smoothstep(.15, .35, px * k / 6.283);
        float over = step(0.0, sin(uv.x * k * .5) * sin(uv.y * k * .5));
        float thread = mix(abs(sin(uv.x * k)), abs(sin(uv.y * k)), over);
        float drape = cNoise(vec3(P.x * 3.5, P.y * 1.2, P.z * 3.5));
        cF = 1.0 + (drape - .5) * .26 + (thread - .5) * .16 * wf;
        cH = drape * .012 * mid + thread * .0015 * wf;
        cRough = .95;
      } else if (kind == 2) { // suit fabric: smooth coated panels, quilted between seams
        float q = fract(P.y * 3.0), seam = 1.0 - smoothstep(0.0, .012 + px * 1.5, min(q, 1.0 - q));
        float grain = cNoise(P * 120.0), crease = cNoise(vec3(P.x * 6.0, P.y * 2.0, P.z * 6.0));
        cF = 1.0 - seam * .1 * mid + (crease - .5) * .08 + (grain - .5) * .03 * fine;
        cH = sin(q * 3.14159) * .0018 * mid + crease * .004 * mid - seam * .0008 * mid;
        cRough = .42;
      } else if (kind == 3) { // metal: brushed, shiny
        float b = cNoise(vec3(P.x * 260.0, P.y * 5.0, P.z * 260.0));
        cF = 1.0 + (b - .5) * .07 * fine;
        cRough = .28 + b * .12; cMetal = .75;
      } else if (kind == 4) { // wood: grain along the shaft
        float g = cNoise(vec3(P.x * 50.0, P.y * 3.0, P.z * 50.0));
        float ring = sin(g * 24.0);
        cF = 1.0 + ring * .09;
        cH = ring * .0006 * fine;
        cRough = .8;
      } else if (kind == 5) { // gloss: eyes, horn, claws, beads, visor
        cRough = .18;
      } else {                // stone: the rocky grain the ground has
        float n1 = cNoise(P * 6.0), n2 = cNoise(P * 17.0);
        cF = 1.0 + (n1 - .5) * .14 + (n2 - .5) * .12 * mid;
        cH = (n1 * .3 + n2 * .4) * .015;
        cRough = .9;
      }
      diffuseColor.rgb *= mix(1.0, cF, cK);
      cH *= cK;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = cRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = cMetal;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // Bump: tilt the normal by the slope of cH across the pixel.
      vec3 cdx = dFdx(-vViewPosition), cdy = dFdy(-vViewPosition);
      float chx = dFdx(cH), chy = dFdy(cH);
      if (cK > 0.0) {
        vec3 r1 = cross(cdy, normal), r2 = cross(normal, cdx);
        float det = dot(cdx, r1);
        normal = normalize(abs(det) * normal - sign(det) * (chx * r1 + chy * r2) * 2.5);
      }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * vGlow * 1.4;\n#endif');
  };
  material.customProgramCacheKey = () => 'fauna-v7';
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
  tag(horn, KIND.gloss); // horns, claws, beaks
  const A = (part = BODY, pivot = [0, 0, 0], knee = [0, 0, 0], phase = 0, bend = 0) => ({ part, pivot, knee, phase, bend });
  const V3 = (a) => new THREE.Vector3(...a);
  const add3 = (a, b2, k = 1) => [a[0] + b2[0] * k, a[1] + b2[1] * k, a[2] + b2[2] * k];
  const glowLevel = sp.glow || 0;
  // Civilized species: evolved manipulators and visible culture (fauna-culture.mjs).
  // Builders record anchor points (torso, collar, back, head, mouth, shoulders, limbs, hands) for it.
  const cult = cultureOf(sp), anchors = { limbs: [], hands: [] };
  let zone = null, headPivotOut = null;

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
    return cultureSkin(cult, THREE, pt, ang, sy, cc, zone);
  };
  // Glowing markings: spots or lines along the flanks.
  const skinGlow = (pt, ang, sy) => Math.max(cultureGlow(cult, pt, ang, sy, zone), glowLevel && Math.abs(sy) < .35 && Math.sin((pt.t ?? 0) * 40 + seed) > .55 ? glowLevel : 0);

  // Limb: hip (inside the body) -> knee -> ankle -> toe; tapering; jointed.
  function limb(points, radii, upperPart, lowerPart, pivot, knee, phase, bend, color) {
    const path = [];
    for (let i = 0; i < points.length - 1; i++) for (let k = 0; k < 3; k++) {
      const t = k / 3, q = points[i].map((v, j) => v + (points[i + 1][j] - v) * t);
      path.push({ p: q, rx: radii[i] + (radii[i + 1] - radii[i]) * t, ry: radii[i] + (radii[i + 1] - radii[i]) * t, seg: i });
    }
    path.push({ p: points[points.length - 1], rx: radii[radii.length - 1], ry: radii[radii.length - 1], seg: points.length - 2 });
    tube(path, 7, (pt, ang, sy) => color.clone().lerp(belly, Math.max(0, -sy) * .3), (pt) => A(pt.seg === 0 ? upperPart : lowerPart, pivot, knee, phase, bend));
    if (upperPart === LEG || upperPart === ARM) anchors.limbs.push({ a: points[0], b: points[1], r: radii[0], anim: A(upperPart, pivot, knee, phase, bend) });
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
      ellipsoid([ex, y, ez], [er, er, er], tag(eyeC.clone().lerp(white, .25), KIND.gloss), anim, 1, eg);
      ellipsoid([ex + Math.sin(yaw) * er * .55, y, ez + Math.cos(yaw) * er * .55], [er * .55, er * .62, er * .55], tag(dark.clone(), KIND.gloss), anim, 0);
    }
  }

  const plan = sp.plan, form = sp.form;
  if (plan === 'swimmer') buildSwimmer();
  else if (plan === 'floater') form === 'skywhale' ? buildSkywhale() : form === 'siphon' ? buildSiphon() : buildFloater();
  else if (plan === 'radial') form === 'tower' ? buildTower() : form === 'dome' ? buildDome() : buildRadial();
  else if (plan === 'roller') buildRoller(); else buildSpineAnimal();
  if (cult) {
    if (plan === 'roller') {
      const R = s * .5;
      if (form === 'wheel') { anchors.torso = { c: [0, R, 0], axis: [1, 0, 0], rx: R * .27, ry: R * .27, anim: A(BODY) }; anchors.back = { p: [0, R * 1.2, 0], size: s * .18, anim: A(BODY) }; }
      anchors.shoulders = [-1, 1].map(side => ({ p: [side * (form === 'wheel' ? s * .2 : R * 1.05), R * 1.05, R * .1], side }));
    }
    dress({ THREE, sp, c: cult, s, tube, ellipsoid, spike, A, P: { BODY, LEG, WING, SWAY, SLITHER, SHIN, ARM, FOREARM }, col: { base, belly, dark, white, horn }, anchors });
  }

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
    anchors.torso = { c: [0, bodyY, 0], axis: [0, 1, 0], rx: R * .95, ry: R * .95, anim: A(BODY) };
    anchors.belt = { c: [0, bodyY - R * .2, 0], axis: [0, 1, 0], rx: R * .85, ry: R * .85, anim: A(BODY) };
    anchors.back = { p: [0, bodyY + prof[prof.length - 1][0] * R * .8, 0], size: s * .25, anim: A(BODY) };
    anchors.head = form === 'star' ? null : { p: [0, ringY, 0], size: ringR, ring: true, anim: form === 'tripod' ? A(SWAY, [0, bodyY + R * .4, 0], [0, 0, 0], 0, .3) : A(BODY) };
    anchors.mouth = { p: [0, bodyY - R * .45, 0], dir: [0, -1, .25], size: R * .6, anim: A(BODY) };
    anchors.shoulders = [-1, 1].map(side => ({ p: [side * R * .6, bodyY - R * .3, R * .3], side }));
    // Spines or crystals on the dome for defensive or silicon species.
    if (sp.back === 'spines' || sp.back === 'plates' || sp.facets) for (let k = 0; k < n * 2; k++) {
      const a = (k + .5) / (n * 2) * Math.PI * 2, top = prof[prof.length - 2], y0 = bodyY + top[0] * R, r0 = top[1] * R * .9;
      spike([Math.sin(a) * r0 * .8, y0, Math.cos(a) * r0 * .8], [Math.sin(a) * r0 * 1.3, y0 + s * .18, Math.cos(a) * r0 * 1.3], s * .03, sp.facets ? accent : horn, A(BODY), { glow: sp.facets ? glowLevel * .7 : 0 });
    }
  }

  // ---- Rollers: living wheels and balls ----
  function buildRoller() {
    const R = s * .5 * Math.sqrt(sp.bulk || 1), hub = [0, R, 0];
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
  function buildFloater(form = sp.form) {
    const R = s * .5 * Math.sqrt(sp.bulk || 1), lobes = sp.lobes || 10, ribs = sp.ribs ?? .05, frills = sp.frills ?? .08;
    const tentacle = (x, y, z, len, i, thick = .045) => {
      const a = Math.atan2(z, x), path = [];
      len *= sp.stretch || 1;
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
      anchors.torso = { c: [0, rimY - R * .15, 0], axis: [0, 1, 0], rx: R * .28, ry: R * .28, anim: A(BODY) };
      anchors.belt = { c: [0, rimY + R * .05, 0], axis: [0, 1, 0], rx: R * 1.02, ry: R * 1.02, anim: A(BODY) };
      anchors.mouth = { p: [0, rimY - R * .1, 0], dir: [0, -1, 0], size: R * .5, anim: A(BODY) };
      anchors.head = { p: [0, rimY + R * .1, 0], size: R * .98, ring: true, anim: A(BODY) };
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
      anchors.torso = { c: [0, gy, 0], axis: [0, 1, 0], rx: R * .32, ry: R * .32, anim: A(BODY) };
      anchors.mouth = { p: [0, gy - R * .2, 0], dir: [0, -1, .3], size: R * .3, anim: A(BODY) };
      anchors.head = { p: [0, gy - R * .02, R * .05], size: R * .5, anim: A(BODY) };
      ellipsoid([0, gy, 0], [R * .3, R * .22, R * .38], base.clone().lerp(dark, .2), A(BODY), 2);
      eyesAt([0, gy, R * .3], R * .18, R * .5, .5);
      for (let i = 0; i < Math.min(sp.tentacles, 8); i++) { const a = i / 8 * Math.PI * 2; tentacle(Math.cos(a) * R * .2, gy, Math.sin(a) * R * .2, s * (.6 + r() * .6), i); }
    } else if (form === 'manta') {
      // Flat glider: a wide, thin body with undulating wing-fins and a whip tail.
      const L = s * 1.1, path = [];
      anchors.torso = { c: [0, 0, 0], axis: [0, 0, 1], rx: R * .7, ry: R * .22, anim: A(BODY) };
      anchors.mouth = { p: [0, -R * .1, L / 2], dir: [0, -.3, 1], size: R * .3, anim: A(BODY) };
      anchors.head = { p: [0, R * .05, L / 2 - s * .12], size: R, anim: A(BODY) };
      anchors.back = { p: [0, R * .2, -L * .1], size: s * .2, anim: A(BODY) };
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
      anchors.torso = { c: [0, -R * .15, 0], axis: [0, 1, 0], rx: R * .36, ry: R * .36, anim: A(BODY) };
      anchors.mouth = { p: [0, -R * .4, 0], dir: [0, -1, .2], size: R * .4, anim: A(BODY) };
      anchors.head = { p: [0, -R * .1, R * .12], size: R * .55, anim: A(BODY) };
      eyesAt([0, -R * .1, R * .3], R * .22, R * .55, .6);
      for (let i = 0; i < Math.min(sp.tentacles, 10); i++) { const a = i / 10 * Math.PI * 2; tentacle(Math.cos(a) * R * .25, -R * .35, Math.sin(a) * R * .25, s * (.6 + r() * .7), i); }
    }
  }

  // ---- Alien forms: walking towers and domes ----
  // A radial leg: hip -> knee -> foot on the ground, stepping in turn with its neighbours.
  function radialLeg(i, n, hipR, hipY, pts, thick, colorAt) {
    const a = i / n * Math.PI * 2, dir = [Math.sin(a), 0, Math.cos(a)];
    const hip = [dir[0] * hipR, hipY, dir[2] * hipR], phase = (i % 2) * Math.PI + i * .4;
    const P = [hip, ...pts.map(([out, y]) => [dir[0] * out, y, dir[2] * out])];
    const path = catmull(P.map((p, k) => ({ p, rx: thick * (1 - k / P.length * .6), ry: thick * (1 - k / P.length * .6) })), 3);
    tube(path, 7, colorAt, () => A(RLEG, hip, dir, phase, 1), { glowAt: (pt) => glowLevel && pt.t > .92 ? glowLevel * .8 : 0 });
  }
  // A tall ringed column on a skirt of short legs, crowned with feeding arms and a ring of eyes.
  // The column bends gently (more toward the top) as it walks.
  function buildTower() {
    const n = sp.legs, R = s * .17, ly = sp.legLength, bodyY = ly * .55, H0 = s * .95 * (sp.stretch || 1), lobes = sp.lobes || 8;
    const pivot = [0, bodyY, 0], bendAt = (y) => Math.max(0, (y - bodyY) / H0) * .55;
    const prof = [[0, .8], [.05, 1], [.25, .8], [.5, .76], [.7, .68], [.84, .95], [.93, .75], [1, .22]];
    const path = catmull(prof.map(([y, rr], i) => ({ p: [0, bodyY + y * H0, 0], rx: rr * R, ry: rr * R, t: i / (prof.length - 1) })), 3)
      .map(pt => ({ ...pt, mod: (ang) => 1 + (sp.ribs ?? .05) * Math.cos(lobes * ang) }));
    tube(path, 16, (pt, ang) => skin({ t: pt.t }, ang * 2, .35 + .3 * Math.cos(ang)).lerp(dark, Math.abs(Math.sin(pt.t * 30)) > .94 ? .35 : 0),
      (pt) => A(SWAY, pivot, [0, 0, 0], 0, bendAt(pt.p[1])), { glowAt: (pt, ang) => glowLevel && Math.cos(lobes * ang) > .85 && pt.t > .3 ? glowLevel : 0 });
    for (let i = 0; i < n; i++) radialLeg(i, n, R * .7, bodyY + H0 * .04, [[R + ly * .45, bodyY * .95], [R + ly * .75, ly * .18], [R + ly * .8, 0]], s * .05, (pt, ang, sy) => base.clone().lerp(belly, Math.max(0, -sy) * .5));
    const ringY = bodyY + H0 * .84, ne = Math.max(5, sp.eyes.count), eyeAnim = A(SWAY, pivot, [0, 0, 0], 0, bendAt(ringY));
    for (let k = 0; k < ne; k++) {
      const a = k / ne * Math.PI * 2, er = R * .2, rr = R * .93;
      ellipsoid([Math.sin(a) * rr, ringY, Math.cos(a) * rr], [er, er, er], tag(eyeC.clone().lerp(white, .25), KIND.gloss), eyeAnim, 1, glowLevel > .5 ? .6 : 0);
      ellipsoid([Math.sin(a) * (rr + er * .6), ringY, Math.cos(a) * (rr + er * .6)], [er * .5, er * .6, er * .5], tag(dark.clone(), KIND.gloss), eyeAnim, 0);
    }
    const sw = (y) => A(SWAY, pivot, [0, 0, 0], 0, bendAt(y));
    anchors.torso = { c: [0, bodyY + H0 * .45, 0], axis: [0, 1, 0], rx: R * .78, ry: R * .78, anim: sw(bodyY + H0 * .45) };
    anchors.belt = { c: [0, bodyY + H0 * .2, 0], axis: [0, 1, 0], rx: R * .82, ry: R * .82, anim: sw(bodyY + H0 * .2) };
    anchors.back = { p: [0, bodyY + H0 * .62, -R * .75], size: s * .2, anim: sw(bodyY + H0 * .62) };
    anchors.head = { p: [0, ringY, 0], size: R * .93, ring: true, anim: eyeAnim };
    anchors.shoulders = [-1, 1].map(side => ({ p: [side * R * .75, bodyY + H0 * .72, R * .3], side }));
    const top = bodyY + H0, arms = Math.min(10, Math.max(5, sp.tentacles));
    anchors.mouth = { p: [0, top, 0], dir: [0, .6, .8], size: R * .5, anim: sw(top) };
    for (let k = 0; k < arms; k++) {
      const a = k / arms * Math.PI * 2, p2 = [];
      for (let j = 0; j <= 7; j++) { const f = j / 7, out = R * .2 + f * s * .38; p2.push({ p: [Math.sin(a) * out, top + Math.sin(f * 2.4) * s * .22 - f * f * s * .1, Math.cos(a) * out], rx: s * .03 * (1 - f * .75), ry: s * .03 * (1 - f * .75), w: f, t: f }); }
      tube(p2, 6, (pt) => accent.clone().lerp(belly, pt.w * .4), (pt) => A(SWAY, [0, top, 0], [0, 0, 0], k * 1.1, .55 + pt.w * .6), { glowAt: (pt) => glowLevel && pt.w > .85 ? glowLevel : 0 });
    }
  }
  // A broad, low dome walking on a ring of thick legs, with a fringe round its rim and eyes on stalks.
  function buildDome() {
    const n = sp.legs, bulk = Math.sqrt(sp.bulk || 1), R = s * .42 * bulk, ly = sp.legLength, bodyY = ly * .6, lobes = sp.lobes || 10;
    const prof = [[-.12, .9], [0, 1], [.2, .95], [.4, .8], [.55, .56], [.64, .26], [.67, .02]];
    const path = prof.map(([y, rr], i) => ({ p: [0, bodyY + y * R, 0], rx: rr * R, ry: rr * R, t: i / (prof.length - 1), mod: (ang) => 1 + (sp.ribs ?? .04) * Math.cos(lobes * ang) }));
    tube(path, 28, (pt, ang) => skin({ t: .15 + pt.t * .7 }, ang * 3, .6).lerp(accent, Math.cos(lobes * ang) > .9 && pt.t > .2 ? .3 : 0), () => A(BODY),
      { glowAt: (pt, ang) => glowLevel && Math.cos(lobes * ang) > .9 && pt.t > .5 ? glowLevel : 0 });
    for (let i = 0; i < n; i++) radialLeg(i, n, R * .78, bodyY, [[R + ly * .15, bodyY * .8], [R + ly * .22, ly * .12], [R + ly * .26, 0]], s * .075 * bulk, (pt, ang, sy) => base.clone().lerp(dark, .15).lerp(belly, Math.max(0, -sy) * .4));
    anchors.torso = { c: [0, bodyY + R * .15, 0], axis: [0, 1, 0], rx: R * .98, ry: R * .98, anim: A(BODY) };
    anchors.back = { p: [0, bodyY + R * .62, 0], size: s * .25, anim: A(BODY) };
    anchors.mouth = { p: [0, bodyY - R * .05, R * .92], dir: [0, -.3, 1], size: R * .3, anim: A(BODY) };
    anchors.shoulders = [-1, 1].map(side => ({ p: [side * R * .55, bodyY + R * .35, R * .7], side }));
    // Fringe of short feelers hanging round the rim.
    for (let k = 0; k < 18; k++) {
      const a = (k + .5) / 18 * Math.PI * 2, rr = R * .93, y0 = bodyY - R * .1, p2 = [];
      for (let j = 0; j <= 3; j++) { const f = j / 3; p2.push({ p: [Math.sin(a) * rr * (1 + f * .05), y0 - f * ly * .3, Math.cos(a) * rr * (1 + f * .05)], rx: s * .018 * (1 - f * .6), ry: s * .018 * (1 - f * .6), w: f }); }
      tube(p2, 5, () => accent.clone().lerp(belly, .5), (pt) => A(SWAY, [Math.sin(a) * rr, y0, Math.cos(a) * rr], [0, 0, 0], k, pt.w * .6));
    }
    // Plates or spines on top for defensive species.
    if (sp.back === 'spines' || sp.back === 'plates' || sp.back === 'shell' || sp.facets) for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, ring = k % 2 ? .45 : .7, y0 = bodyY + R * (k % 2 ? .52 : .35), rr = R * ring * .9;
      if (sp.back === 'spines' || sp.facets) spike([Math.sin(a) * rr, y0, Math.cos(a) * rr], [Math.sin(a) * rr * 1.2, y0 + s * .16, Math.cos(a) * rr * 1.2], s * .035, sp.facets ? accent : horn, A(BODY), { glow: sp.facets ? glowLevel * .7 : 0 });
      else ellipsoid([Math.sin(a) * rr, y0, Math.cos(a) * rr], [s * .1, s * .03, s * .1], accent.clone().lerp(dark, .2), A(BODY), 1);
    }
    // Eyes on stalks rising from the crown.
    const stalks = Math.min(4, Math.max(2, sp.eyes.count));
    for (let k = 0; k < stalks; k++) {
      const a = k / stalks * Math.PI * 2 + .4, b0 = [Math.sin(a) * R * .2, bodyY + R * .62, Math.cos(a) * R * .2], p2 = [];
      for (let j = 0; j <= 5; j++) { const f = j / 5; p2.push({ p: [b0[0] * (1 + f * 2), b0[1] + f * s * .45, b0[2] * (1 + f * 2)], rx: s * .025 * (1 - f * .3), ry: s * .025 * (1 - f * .3), w: f }); }
      const anim = (w) => A(SWAY, b0, [0, 0, 0], k * 2.1, w * .7);
      tube(p2, 6, () => base.clone().lerp(belly, .4), (pt) => anim(pt.w));
      const tip = p2[5].p, er = s * .05;
      ellipsoid(tip, [er, er, er], tag(eyeC.clone().lerp(white, .25), KIND.gloss), anim(1), 1, glowLevel > .5 ? .6 : 0);
      ellipsoid([tip[0] * 1.08, tip[1], tip[2] * 1.08], [er * .5, er * .55, er * .5], tag(dark.clone(), KIND.gloss), anim(1), 0);
    }
  }

  // ---- Alien drifters: sky whales and chains of bells ----
  function hanging(x, y, z, len, i, thick) {
    const a = Math.atan2(z, x), path = [];
    for (let k = 0; k <= 8; k++) { const f = k / 8, curl = Math.sin(f * 2.6 + i) * s * .1; path.push({ p: [x + Math.cos(a) * curl, y - len * f, z + Math.sin(a) * curl], rx: thick * (1 - f * .8), ry: thick * (1 - f * .8), w: f, t: f }); }
    tube(path, 5, (pt) => accent.clone().lerp(belly, .3 + pt.w * .5), (pt) => A(SWAY, [x, y, z], [0, 0, 0], i * .9, pt.w), { glowAt: (pt) => glowLevel && pt.w > .75 ? glowLevel : 0 });
  }
  // A long gas-filled body like a whale of the air: blunt head, tapering tail with
  // flukes, broad fins, a row of gas sacs along its back and feeding tendrils beneath.
  function buildSkywhale() {
    const L = s * 1.15 * (sp.stretch || 1), R = s * .2 * Math.sqrt(sp.bulk || 1), path = [];
    const shape = (f) => f < .12 ? .14 + f / .12 * .3 : f < .6 ? .44 + (f - .12) / .48 * .56 : 1 - Math.pow((f - .6) / .4, 2.4) * .5;
    const wave = (z) => A(WAVE, [0, 0, 0], [0, 0, 0], 0, Math.max(0, .5 - z / L) * .9);
    for (let k = 0; k <= 16; k++) { const f = k / 16; path.push({ p: [0, 0, -L / 2 + f * L], rx: R * shape(f), ry: R * shape(f) * .92, t: f }); }
    tube(path, 18, (pt, ang, sy) => skin(pt, ang, sy).lerp(dark, sy < -.45 && pt.t > .55 && Math.sin(ang * 26) > .7 ? .3 : 0), (pt) => wave(pt.p[2]), { glowAt: skinGlow });
    for (const side of [-1, 1]) {
      const z0 = L * .15, root = [[side * R * .8, -R * .2, z0 + R * .5], [side * R * .85, -R * .25, z0], [side * R * .8, -R * .2, z0 - R * .4]];
      const tip = [[side * R * 1.4, -R * .45, z0 + R * .1], [side * R * 2.6, -R * .7, z0 - R * .9], [side * R * 1.3, -R * .4, z0 - R * .8]];
      membrane(root, tip, (f, w) => base.clone().lerp(accent, w * .6).lerp(shimmer, sp.scheme === 'iridescent' ? .4 : 0), A(WING, [side * R * .8, -R * .2, z0], [0, 0, 0], side * .3));
    }
    const tz = -L / 2, fl = [], fr = [];
    for (let k = 0; k <= 6; k++) { const f = k / 6 * 2 - 1; fl.push([f * R * .2, 0, tz + R * .3]); fr.push([f * R * 1.6, Math.abs(f) * R * .1, tz - R * (.25 + (1 - Math.abs(f)) * .1 + Math.abs(f) * .5)]); }
    membrane(fl, fr, (f, w) => base.clone().lerp(accent, w * .5), wave(tz));
    const sacs = 3 + (sp.seed % 3);
    for (let k = 0; k < sacs; k++) {
      const z = L * (.25 - k * .5 / sacs), top = R * shape(.5 + z / L) * .92;
      ellipsoid([0, top * .85, z], [R * .35, R * .3, R * .45], shimmer.clone().lerp(white, .2), wave(z), 1, glowLevel ? glowLevel * .7 : 0);
    }
    eyesAt([0, R * .05, L / 2 - R * .75], R * .62, R * .6, 1.2, wave(L / 2));
    ellipsoid([0, -R * .28, L / 2 - R * .35], [R * .45, R * .04, R * .35], dark, wave(L / 2), 1);
    for (let k = 0; k < Math.min(10, sp.tentacles); k++) {
      const z = L * (.3 - k * .05), x = (k % 2 ? 1 : -1) * R * .3;
      hanging(x, -R * .8, z, s * (.35 + (k % 3) * .15) * (sp.stretch || 1), k, s * .02);
    }
  }
  // A colony: a gas float on top, a stem, and bell after bell strung along it, trailing tentacles.
  function buildSiphon() {
    const n = 4 + (sp.seed % 4), seg = s * .26 * Math.min(1.4, sp.stretch || 1), R = s * .3, top = [0, 0, 0];
    const fp = [[1.1, .1], [.85, .75], [.4, 1], [0, .95], [-.4, .55], [-.6, .12]];
    tube(fp.map(([y, rr], i) => ({ p: [0, y * R, 0], rx: rr * R * .8, ry: rr * R * .8, t: i / 5 })), 16, (pt, ang) => shimmer.clone().lerp(white, .25).lerp(accent, Math.sin(ang * 4) > .8 ? .4 : 0), () => A(BODY),
      { glowAt: () => glowLevel * .4 });
    const stem = [];
    for (let k = 0; k <= n * 2; k++) { const f = k / (n * 2); stem.push({ p: [Math.sin(f * 5) * s * .03, -R * .5 - f * n * seg, 0], rx: s * .035, ry: s * .035, w: f }); }
    tube(stem, 5, () => accent.clone().lerp(dark, .2), (pt) => A(SWAY, top, [0, 0, 0], 0, pt.w));
    for (let k = 1; k <= n; k++) {
      const side = k % 2 ? 1 : -1, y = -R * .5 - (k - .5) * seg, w = k / n, cx = side * R * .45, bp = [];
      const prof = [[.55, .1], [.4, .7], [.1, 1], [-.2, .95], [-.3, .75]];
      for (const [yy, rr] of prof) bp.push({ p: [cx, y + yy * R * .75, 0], rx: rr * R * .7, ry: rr * R * .7, t: (yy + .3) / .85 });
      tube(bp, 12, (pt, ang) => base.clone().lerp(shimmer, .3 + .3 * Math.sin(ang * 3)).lerp(accent, Math.cos(ang * 6) > .8 ? .4 : 0), () => A(SWAY, top, [0, 0, 0], 0, w), { capEnd: false, glowAt: (pt) => glowLevel && pt.t < .2 ? glowLevel : 0 });
    }
    const bottom = -R * .5 - n * seg;
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; hanging(Math.cos(a) * s * .06, bottom, Math.sin(a) * s * .06, s * (.5 + (i % 2) * .4) * (sp.stretch || 1), i, s * .015); }
    eyesAt([0, -R * .1, R * .55], R * .3, R * .6, .8);
  }

  // ---- Sea life ----
  // Built around its centre (the animal swims at a depth, not on the ground), +Z forward.
  function buildSwimmer() {
    const an = sp.anatomy || {};
    if (form === 'jelly') {
      buildFloater('bell');
      // A second, smaller bell stacked above the first (twin-bells).
      if (an.bells > 1) { const R = s * .3, path = [[.6, .05], [.45, .7], [.15, 1], [-.1, .9]].map(([y, rr], i) => ({ p: [0, s * .45 + y * R, 0], rx: rr * R, ry: rr * R, t: i / 3 })); tube(path, 18, () => shimmer.clone().lerp(base, .3), () => A(BODY), { glowAt: () => glowLevel * .6 }); }
    } else if (form === 'ray') {
      buildFloater('manta');
      // Four-winged: a second, smaller pair of wing-fins behind the first.
      if (an.wingPairs > 1) for (const side of [-1, 1]) { const L = s * 1.1, R = s * .5, root = [], edge = []; for (let k = 0; k <= 4; k++) { const f = k / 4, z = -L * .45 + f * L * .3; root.push([side * R * .3, 0, z]); edge.push([side * (R * .3 + Math.sin(f * Math.PI) * s * .6), 0, z - Math.sin(f * Math.PI) * s * .15]); } membrane(root, edge, (f, w) => base.clone().lerp(accent, w * .6), A(WING, [side * R * .3, 0, -L * .3], [0, 0, 0], -side * .45)); }
    } else if (form === 'squid') buildSquid(an);
    else if (form === 'ribbon') buildRibbon();
    else if (form === 'disc') buildDisc();
    else return buildFish(form);
    // What every swimmer may share with its world's style: glowing organs and trailing filaments.
    if (an.skin === 'translucent') for (let k = 0; k < 3; k++) ellipsoid([(k - 1) * s * .08, -s * .02, (k - 1) * s * .1], [s * .06, s * .05, s * .08], glowC, A(BODY), 1, .8);
    for (let k = 0; k < (an.filaments || 0); k++) {
      const b0 = [(k % 2 ? 1 : -1) * s * .05 * (1 + k * .3), -s * .12, -s * .1 * k], p2 = [], len = s * (.6 + (k % 3) * .3);
      for (let j = 0; j <= 7; j++) { const f = j / 7; p2.push({ p: [b0[0] * (1 + f), b0[1] - f * len * .7, b0[2] - f * len * .5], rx: s * .012 * (1 - f * .7), ry: s * .012 * (1 - f * .7), w: f }); }
      tube(p2, 4, () => accent.clone().lerp(shimmer, .4), (pt) => A(SWAY, b0, [0, 0, 0], k, pt.w), { glowAt: (pt) => glowLevel && pt.w > .8 ? glowLevel : 0 });
    }
  }
  // Fish-like swimmers (fish, big hunters, leviathans), built from their anatomy
  // (fauna.mjs seaAnatomy): a body shape (torpedo, deep, long, bulb-headed, flat) that may
  // be a chain of segments; fin rows set two-sided like ours or in three or five rows round
  // the body; a tail (forked, fanned, paddle, double, whip) or a jet funnel; a back fin;
  // eyes (paired, on stalks, in rows, one great eye, or glowing pits); a mouth (jaws, a
  // beard of feelers, a round sucker, a spear-like rostrum, a glowing lure); skin (plates,
  // spines, flank frills, glowing organs); trailing filaments. Fish swing from side to
  // side; leviathans flex up and down.
  function buildFish(kind) {
    const lev = kind === 'leviathan', hunter = kind === 'hunter', a = sp.anatomy || { symmetry: 'bilateral', eyes: 'paired', skin: 'smooth', mouth: 'jaws', swim: 'tail', finShape: 'paddle', segments: 1, shape: 'torpedo', dorsal: 'none', tail: 'fork', finRows: 1, filaments: 0 };
    const shapeK = { torpedo: [1, 1, 1], deep: [.95, .75, 1.6], long: [1.45, .6, .6], bulb: [1, 1.05, 1.05], flat: [1, 1.6, .5] }[a.shape] || [1, 1, 1];
    const L = b.length * shapeK[0], W = b.width * (lev ? 1.35 : hunter ? .95 : 1) * shapeK[1], H = b.height * (lev ? .95 : 1) * shapeK[2], hd = sp.head;
    const bendAt = (z) => .2 + Math.min(1, Math.max(0, .5 - z / L)) * .9;
    const mv = (z) => lev ? A(WAVE, [0, 0, 0], [0, 0, 0], 0, Math.max(0, .5 - z / L) * .9) : A(SLITHER, [0, 0, 0], [0, 0, 0], 0, bendAt(z));
    const prof = a.shape === 'bulb' ? [[-.5, .06, .08], [-.3, .22, .26], [-.05, .45, .45], [.15, .85, .85], [.3, 1, 1], [.42, .85, .85], [.5, .3, .3]]
      : a.shape === 'long' ? [[-.5, .08, .1], [-.4, .5, .55], [-.2, .9, .95], [0, 1, 1], [.2, 1, 1], [.4, .8, .8], [.5, .25, .25]]
      : lev ? [[-.5, .05, .05], [-.42, .15, .17], [-.25, .55, .6], [0, .95, .95], [.2, 1, 1], [.37, .93, .9], [.46, .74, .72], [.5, .38, .4]]
      : hunter ? [[-.5, .08, .12], [-.4, .2, .3], [-.22, .62, .75], [0, .92, .98], [.18, 1, 1], [.34, .82, .8], [.45, .45, .48], [.53, .08, .1]]
      : [[-.5, .1, .14], [-.4, .22, .3], [-.25, .58, .72], [-.05, .88, .96], [.15, 1, 1], [.32, .86, .84], [.43, .58, .58], [.5, .2, .22]];
    // A chain of segments: the body pinches in between them.
    const seg = (t) => a.segments > 1 && t > .08 && t < .92 ? .7 + .3 * Math.abs(Math.sin(Math.PI * a.segments * (t - .08) / .84)) : 1;
    const path = catmull(prof.map(([z, w, h], i) => ({ p: [0, 0, z * L], rx: W * .5 * w, ry: H * .5 * h, t: i / (prof.length - 1) })), a.segments > 1 ? 6 : 3)
      .map(pt => { const k = seg(pt.t ?? 0); return { ...pt, rx: pt.rx * k, ry: pt.ry * k }; });
    tube(path, 14, (pt, ang, sy) => skin(pt, ang, sy).lerp(dark, lev && sy < -.5 && pt.t > .5 && Math.sin(ang * 30) > .6 ? .25 : 0).lerp(white, a.skin === 'translucent' ? .35 : 0),
      (pt) => mv(pt.p[2]), { glowAt: skinGlow });
    // The body's surface at z, in the direction th round the axis (0 = right, PI/2 = up).
    const ring = (z) => { let best = path[0]; for (const pt of path) if (Math.abs(pt.p[2] - z) < Math.abs(best.p[2] - z)) best = pt; return best; };
    const surf = (z, th, out = 0) => { const q = ring(z), c = Math.cos(th), s0 = Math.sin(th), rr = 1 / Math.sqrt((c / q.rx) ** 2 + (s0 / q.ry) ** 2); return [c * (rr * .92 + out), s0 * (rr * .92 + out), z]; };
    const angles = a.symmetry === 'tri' ? [0, 1, 2].map(i => Math.PI / 2 + i * 2.094) : a.symmetry === 'radial' ? [0, 1, 2, 3, 4].map(i => Math.PI / 2 + i * 1.2566) : null;
    const finC = (f, w) => accent.clone().lerp(shimmer, w * .5).lerp(base, .2);
    // A fin from the body at z, round angle th, reaching len out.
    const fin = (z, th, len, shape, span = L * .12) => {
      const d = [Math.cos(th), Math.sin(th)], o = (zz, out) => { const s0 = surf(zz, th); return [s0[0] + d[0] * out, s0[1] + d[1] * out, zz]; };
      const shapes = {
        paddle: [[z + span * .5, z, z - span * .5], [[z + span * .3, .75], [z - span * .1, 1], [z - span * .6, .7]]],
        blade: [[z + span * .5, z - span * .5], [[z - span * .3, 1], [z - span * .9, .35]]],
        frond: [[z + span * .2, z - span * .2], [[z - len * 1.2, .55], [z - len * 1.45, .45]]],
      }[shape] || null;
      const [rootZ, outer] = shapes;
      membrane(rootZ.map(zz => o(zz, 0)), outer.map(([zz, f]) => o(zz, len * f)), finC, (f) => mv(z - f * span));
    };
    // Fin rows: two-sided pairs (and a small belly fin), or rows evenly round the body.
    const flen = W * .55 * (a.finShape === 'frond' ? 1.3 : 1) * (lev ? 1.6 : 1);
    for (let k = 0; k < a.finRows; k++) {
      const z = L * (.2 - k * (.45 / Math.max(1, a.finRows - 1 || 1))) * (a.finRows > 1 ? 1 : 1);
      for (const th of angles || [-.35, Math.PI + .35]) fin(z, th, flen * (1 - k * .12), a.finShape);
    }
    if (!angles && !lev) fin(-L * .28, -Math.PI / 2, H * .3, 'blade', L * .08);
    // Tail.
    const tz = -L * .5 + L * .02, Lt = L * (hunter ? .26 : lev ? .22 : .22);
    const lobeAngles = angles || (lev ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2]);
    const lobe = (th, x0 = 0) => {
      const d = [Math.cos(th), Math.sin(th)], at = (out, zz) => [x0 + d[0] * out, d[1] * out, zz];
      const outer = { fork: [[Lt * .95, tz - Lt], [Lt * .3, tz - Lt * .5]], fan: [[Lt * .75, tz - Lt * .7], [Lt * .25, tz - Lt * .95]], paddle: [[Lt * .55, tz - Lt * .85], [Lt * .08, tz - Lt * 1.05]], double: [[Lt * .8, tz - Lt * .9], [Lt * .25, tz - Lt * .55]] }[a.tail] || [[Lt * .8, tz - Lt], [Lt * .3, tz - Lt * .6]];
      membrane([at(W * .05, tz + L * .03), at(0, tz)], outer.map(([out, zz]) => at(out, zz)), finC, (f, w) => mv(tz - w * Lt));
    };
    if (a.tail === 'jet') { // a funnel at the tail, glowing inside
      const q = ring(tz + L * .04), rr = Math.max(q.rx, q.ry) * 1.6 + W * .08;
      const fp = [{ p: [0, 0, tz + L * .05], rx: rr * .6, ry: rr * .6 }, { p: [0, 0, tz - L * .02], rx: rr, ry: rr }, { p: [0, 0, tz - L * .06], rx: rr * 1.15, ry: rr * 1.15 }];
      tube(fp, 12, () => accent.clone().lerp(dark, .2), () => mv(tz), { capStart: false, capEnd: false });
      ellipsoid([0, 0, tz - L * .01], [rr * .7, rr * .7, rr * .1], glowC, mv(tz), 1, .9);
    } else if (a.tail === 'whip') {
      const wp = []; for (let k = 0; k <= 8; k++) { const f = k / 8; wp.push({ p: [0, 0, tz - f * L * .6], rx: W * .06 * (1 - f * .85), ry: W * .06 * (1 - f * .85), w: f }); }
      tube(wp, 6, () => base, (pt) => mv(tz - pt.w * L * .6));
    } else if (a.tail === 'double') for (const x0 of [-W * .18, W * .18]) for (const th of lobeAngles) lobe(th, x0);
    else for (const th of lobeAngles) lobe(th);
    // Back fin (two-sided bodies only).
    const topAt = (z) => ring(z).ry;
    if (!angles && (hunter || lev || a.dorsal !== 'none')) {
      const kindD = hunter ? 'blade' : lev ? 'low' : a.dorsal;
      if (kindD === 'spines') for (let k = 0; k < 6; k++) { const z = -L * .25 + k * L * .08, h = H * (.25 + Math.sin(k / 5 * Math.PI) * .25); spike([0, topAt(z) * .85, z], [0, topAt(z) + h, z - h * .3], s * .015, horn.clone().lerp(accent, .4), mv(z)); }
      else if (kindD === 'finlets') for (let k = 0; k < 6; k++) { const z = -L * .3 + k * L * .1; membrane([[0, topAt(z) * .9, z + L * .03], [0, topAt(z) * .9, z - L * .03]], [[0, topAt(z) + H * .18, z - L * .03], [0, topAt(z) + H * .05, z - L * .05]], finC, mv(z)); }
      else {
        const z0 = hunter ? -L * .02 : lev ? -L * .2 : -L * .12, z1 = hunter ? L * .16 : lev ? -L * .1 : kindD === 'sail' ? L * .3 : L * .1;
        const h = hunter ? H * 1.05 : lev ? H * .22 : kindD === 'sail' ? H * .9 : H * .5, ea = [], eo = [];
        for (let k = 0; k <= 4; k++) { const f = k / 4, z = z0 + (z1 - z0) * f; ea.push([0, topAt(z) * .9, z]); eo.push([0, topAt(z) * .9 + h * Math.sin(f * Math.PI * (kindD === 'sail' ? 1 : .9)) * (hunter ? (f < .7 ? f / .7 : 1) : 1), z - h * f * .55]); }
        if (hunter) eo[4] = [0, topAt(z1) + h, z0 - h * .35];
        membrane(ea, eo, (f, w) => base.clone().lerp(accent, w * .5).lerp(dark, hunter ? .15 : 0), (f) => mv(z0 + (z1 - z0) * f));
      }
    }
    // Skin.
    if (a.skin === 'plated') for (let k = 0; k < 6; k++) { const z = L * (.3 - k * .12), q = ring(z); for (let j = 0; j < 6; j++) { const th = j / 6 * Math.PI * 2 + k * .5, p0 = surf(z, th, q.rx * .05); ellipsoid(p0, [Math.max(q.rx, q.ry) * .32, Math.max(q.rx, q.ry) * .32, L * .045], accent.clone().lerp(dark, .25), mv(z), 0); } }
    if (a.skin === 'spined') for (let k = 0; k < 7; k++) { const z = L * (.28 - k * .09); for (const th of angles || [Math.PI / 2, .2, Math.PI - .2]) { const p0 = surf(z, th), d = [Math.cos(th), Math.sin(th)], h = H * .28; spike(p0, [p0[0] + d[0] * h, p0[1] + d[1] * h, z - h * .4], s * .012, horn.clone().lerp(accent, .3), mv(z)); } }
    if (a.skin === 'frilled') for (const th of angles || [0, Math.PI]) { const ea = [], eo = []; for (let k = 0; k <= 10; k++) { const z = L * (.32 - k * .065), p0 = surf(z, th), d = [Math.cos(th), Math.sin(th)], out = W * .28 * (1 + .3 * Math.sin(k * 1.3)); ea.push(p0); eo.push([p0[0] + d[0] * out, p0[1] + d[1] * out, z]); } membrane(ea, eo, (f, w) => accent.clone().lerp(shimmer, w), (f) => mv(L * (.32 - f * .65))); }
    if (a.skin === 'translucent') for (let k = 0; k < 3; k++) { const z = L * (.15 - k * .15), q = ring(z); ellipsoid([0, -q.ry * .2, z], [q.rx * .55, q.ry * .45, L * .06], glowC, mv(z), 1, .8); }
    // Where an intelligent swimmer's manipulators and gear go (fauna-culture.mjs dress).
    Object.assign(anchors, {
      torso: { c: [0, 0, L * .05], axis: [0, 0, 1], rx: W * .5, ry: H * .5, anim: mv(L * .05) }, belt: { c: [0, 0, -L * .15], axis: [0, 0, 1], rx: W * .4, ry: H * .4, anim: mv(-L * .15) },
      back: { p: [0, H * .45, -L * .05], size: s * .18, anim: mv(-L * .05) }, head: { p: [0, H * .1, L * .33], size: hd * .8, anim: mv(L * .33) },
      mouth: { p: [0, -H * .1, L * .45], dir: [0, -.2, 1], size: W * .25, anim: mv(L * .45) }, shoulders: [-1, 1].map(side => ({ p: [side * W * .42, -H * .15, L * .22], side })),
    });
    // Eyes.
    const ez = lev ? L * .36 : L * .33, eyeAnim = mv(ez), er0 = hd * (sp.eyes?.size ?? .1);
    const eyeball = (p0, er, look) => { ellipsoid(p0, [er, er, er], tag(eyeC.clone().lerp(white, .25), KIND.gloss), eyeAnim, 1, glowLevel > .6 ? .5 : 0); ellipsoid([p0[0] + look[0] * er * .55, p0[1] + look[1] * er * .55, p0[2] + look[2] * er * .55], [er * .5, er * .55, er * .5], tag(dark.clone(), KIND.gloss), eyeAnim, 0); };
    if (a.eyes === 'paired' && !angles) eyesAt([0, lev ? -H * .08 : H * .1, ez], W * .5 * (lev ? .78 : .7), lev ? hd * .55 : hd, lev ? 1.4 : sp.eyes.forward, eyeAnim);
    else if (a.eyes === 'paired') for (const th of angles) { const p0 = surf(ez, th, er0 * .3); eyeball(p0, er0 * 1.2, [Math.cos(th), Math.sin(th), .4]); }
    else if (a.eyes === 'stalked') for (const side of [-1, 1]) {
      const b0 = surf(ez, side > 0 ? .9 : Math.PI - .9), tip = [b0[0] + side * W * .35, b0[1] + H * .45, b0[2] + L * .04];
      tube([{ p: b0, rx: er0 * .35, ry: er0 * .35 }, { p: [b0[0] + side * W * .15, b0[1] + H * .3, b0[2]], rx: er0 * .3, ry: er0 * .3 }, { p: tip, rx: er0 * .25, ry: er0 * .25 }], 5, () => base.clone().lerp(belly, .4), () => eyeAnim);
      eyeball(tip, er0 * 1.4, [side * .5, .2, .8]);
    } else if (a.eyes === 'row') for (const th of angles || [.25, Math.PI - .25]) for (let k = 0; k < 4; k++) { const z = ez - k * L * .045, p0 = surf(z, th, er0 * .2); eyeball(p0, er0 * (.8 - k * .1), [Math.cos(th), Math.sin(th), .3]); }
    else if (a.eyes === 'cyclops') { const p0 = surf(ez + L * .03, Math.PI / 2, er0 * .4); eyeball(p0, er0 * 2.6, [0, .4, .9]); }
    else for (let k = 0; k < 6; k++) { const th = Math.PI / 2 + (k - 2.5) * .35, p0 = surf(ez - (k % 2) * L * .03, th, 0); ellipsoid(p0, [er0 * .6, er0 * .6, er0 * .6], glowC, eyeAnim, 0, .9); } // glowing pits
    // Mouth.
    const nose = path[path.length - 1].p, mz = L * (lev ? .43 : .46), my = lev ? -H * .16 : -H * .08;
    if (a.mouth === 'jaws' || lev) {
      ellipsoid([0, my, mz], [W * (lev ? .4 : .15), H * .035, L * (lev ? .07 : .03)], dark, mv(mz), 1);
      if (hunter) for (let k = 0; k < 6; k++) { const side = k % 2 ? 1 : -1, z = L * (.38 + Math.floor(k / 2) * .03); spike([side * W * .12, -H * .1, z], [side * W * .12, -H * .17, z + L * .005], L * .006, white, mv(z)); }
    }
    if (a.mouth === 'beard') for (let k = 0; k < 8; k++) {
      const x0 = (k - 3.5) * W * .05, b0 = [x0, my - H * .05, mz - L * .03], p2 = [];
      for (let j = 0; j <= 5; j++) { const f = j / 5; p2.push({ p: [x0 * (1 + f), b0[1] - f * H * (.5 + (k % 3) * .2), b0[2] - f * L * .08], rx: W * .025 * (1 - f * .6), ry: W * .025 * (1 - f * .6), w: f }); }
      tube(p2, 5, () => accent.clone().lerp(belly, .3), (pt) => A(SWAY, b0, [0, 0, 0], k, pt.w * .5), { glowAt: (pt) => glowLevel && pt.w > .85 ? glowLevel : 0 });
    }
    if (a.mouth === 'sucker') {
      ellipsoid([nose[0], nose[1], nose[2]], [W * .18, W * .18, L * .02], dark, mv(mz), 1);
      tube(Array.from({ length: 13 }, (_, k) => { const t0 = k / 12 * Math.PI * 2; return { p: [Math.cos(t0) * W * .2, Math.sin(t0) * W * .2, nose[2]], rx: W * .05, ry: W * .05 }; }), 6, () => accent, () => mv(mz), { capStart: false, capEnd: false });
      for (let k = 0; k < 8; k++) { const t0 = k / 8 * Math.PI * 2; spike([Math.cos(t0) * W * .18, Math.sin(t0) * W * .18, nose[2]], [Math.cos(t0) * W * .08, Math.sin(t0) * W * .08, nose[2] - L * .01], W * .02, white, mv(mz)); }
    }
    if (a.mouth === 'rostrum') spike([0, nose[1], nose[2] - L * .02], [0, nose[1] + H * .02, nose[2] + L * .38], W * .1, horn.clone().lerp(base, .3), mv(mz));
    if (a.mouth === 'lure') {
      const b0 = [0, topAt(L * .32) * .9, L * .32], p2 = [];
      for (let j = 0; j <= 6; j++) { const f = j / 6; p2.push({ p: [0, b0[1] + Math.sin(f * 2.4) * H * .55, b0[2] + f * L * .28], rx: W * .03 * (1 - f * .5), ry: W * .03 * (1 - f * .5), w: f }); }
      tube(p2, 5, () => base, (pt) => A(SWAY, b0, [0, 0, 0], 1, pt.w * .3));
      ellipsoid(p2[6].p, [W * .1, W * .1, W * .1], glowC, A(SWAY, b0, [0, 0, 0], 1, .3), 1, 1.2);
      ellipsoid([0, my, mz], [W * .3, H * .08, L * .04], dark, mv(mz), 1);
    }
    if (lev) {
      for (const side of [-1, 1]) ellipsoid([side * W * .07, H * .45, L * .3], [W * .035, H * .03, L * .02], dark, mv(L * .3), 0);
      const humps = 3 + (sp.seed % 4);
      for (let k = 0; k < humps; k++) { const z = -L * (.08 + k * .07); ellipsoid([0, topAt(z) * .92, z], [W * .06, H * .06, L * .025], accent.clone().lerp(base, .5), mv(z), 1, glowLevel ? glowLevel * .8 : 0); }
    }
    // Trailing filaments from the belly.
    for (let k = 0; k < (a.filaments || 0); k++) {
      const z0 = -L * (.05 + k * .06), b0 = [(k % 2 ? 1 : -1) * W * .1, -ring(z0).ry * .8, z0], p2 = [], len = L * (.5 + (k % 3) * .25);
      for (let j = 0; j <= 7; j++) { const f = j / 7; p2.push({ p: [b0[0] * (1 + f), b0[1] - f * H * .3, z0 - f * len], rx: W * .015 * (1 - f * .7), ry: W * .015 * (1 - f * .7), w: f }); }
      tube(p2, 4, () => accent.clone().lerp(shimmer, .4), (pt) => mv(z0 - pt.w * len), { glowAt: (pt) => glowLevel && pt.w > .8 ? glowLevel : 0 });
    }
  }
  // Squid: swims mantle first, fins near the tip, big eyes, a crown of arms trailing behind.
  // Many-armed swimmers: the body (pointed, round or ridged) leads, fins at its tip (a
  // pair, a frill all round, or none), eyes as its world's style has them, and a crown of
  // 5 to 12 arms behind: even, with two long lashing ones, or webbed together like a skirt.
  function buildSquid(an = {}) {
    const L = b.length, R = b.width * .55, mz = -L * .12;
    const prof = an.mantle === 'round' ? [[-.12, .7], [0, 1], [.15, 1.15], [.3, 1], [.42, .6], [.48, .1]] : [[-.12, .7], [-.05, .95], [.12, 1], [.28, .8], [.42, .45], [.5, .06]];
    const lobes = an.mantle === 'ridged' ? 5 : 0;
    tube(prof.map(([z, rr], i) => ({ p: [0, 0, z * L], rx: rr * R, ry: rr * R * .95, t: i / 5, mod: lobes ? (ang) => 1 + .12 * Math.cos(lobes * ang) : null })), 14, skin, () => A(BODY), { glowAt: skinGlow });
    if (an.fins === 'ring') { const ea = [], eo = []; for (let k = 0; k <= 16; k++) { const t0 = k / 16 * Math.PI * 2; ea.push([Math.cos(t0) * R * .55, Math.sin(t0) * R * .55, L * .36]); eo.push([Math.cos(t0) * R * 1.1, Math.sin(t0) * R * 1.1, L * .3]); } membrane(ea, eo, (f, w) => base.clone().lerp(accent, w * .5).lerp(shimmer, .2), A(BODY)); }
    else if (an.fins !== 'none') for (const side of [-1, 1]) membrane([[side * R * .45, 0, L * .45], [side * R * .7, 0, L * .28]], [[side * R * 1.3, 0, L * .4], [side * R * 1.45, 0, L * .25]],
      (f, w) => base.clone().lerp(accent, w * .5).lerp(shimmer, .2), A(WING, [side * R * .5, 0, L * .35], [0, 0, 0], side * .35));
    ellipsoid([0, 0, mz - L * .06], [R * .75, R * .7, L * .1], base.clone().lerp(belly, .3), A(BODY), 2);
    const er = R * (sp.eyes?.size ?? .1) * 1.3;
    const eye = (p0, e0, look) => { ellipsoid(p0, [e0, e0, e0], tag(eyeC.clone().lerp(white, .25), KIND.gloss), A(BODY), 1, glowLevel > .6 ? .5 : 0); ellipsoid([p0[0] + look[0] * e0 * .55, p0[1] + look[1] * e0 * .55, p0[2] + look[2] * e0 * .55], [e0 * .5, e0 * .55, e0 * .5], tag(dark.clone(), KIND.gloss), A(BODY), 0); };
    if (an.eyes === 'cyclops') eye([0, R * .55, mz - L * .05], er * 2.4, [0, .5, -.5]);
    else if (an.eyes === 'row') for (const side of [-1, 1]) for (let k = 0; k < 4; k++) eye([side * R * .72, R * .1, mz - L * .02 - k * L * .035], er * (.8 - k * .1), [side, 0, 0]);
    else if (an.eyes === 'stalked') for (const side of [-1, 1]) { const b0 = [side * R * .5, R * .4, mz - L * .05], tip = [side * R * 1.1, R * 1.2, mz - L * .1]; tube([{ p: b0, rx: er * .3, ry: er * .3 }, { p: tip, rx: er * .25, ry: er * .25 }], 5, () => base, () => A(BODY)); eye(tip, er * 1.3, [side * .5, .3, -.5]); }
    else if (an.eyes === 'none') for (let k = 0; k < 6; k++) { const t0 = k / 6 * Math.PI * 2; ellipsoid([Math.cos(t0) * R * .72, Math.sin(t0) * R * .66, mz - L * .05], [er * .5, er * .5, er * .5], glowC, A(BODY), 0, .9); }
    else eyesAt([0, R * .1, mz - L * .05], R * .7, R * 1.3, 1.4);
    Object.assign(anchors, {
      torso: { c: [0, 0, L * .15], axis: [0, 0, 1], rx: R * .95, ry: R * .9, anim: A(BODY) }, back: { p: [0, R * .9, L * .1], size: s * .2, anim: A(BODY) },
      head: { p: [0, R * .1, mz - L * .05], size: R * .8, anim: A(BODY) }, mouth: { p: [0, 0, mz - L * .16], dir: [0, 0, -1], size: R * .4, anim: A(BODY) },
      shoulders: [-1, 1].map(side => ({ p: [side * R * .6, -R * .2, mz - L * .1], side })),
    });
    const arms = an.arms || 8, len = L * .55 * (sp.stretch || 1), longs = an.armStyle === 'even' ? 0 : an.armStyle === 'webbed' ? 0 : 2;
    if (an.armStyle === 'webbed') { // a web between the arms, a skirt that pulses as it swims
      const ea = [], eo = []; for (let k = 0; k <= arms * 2; k++) { const t0 = k / (arms * 2) * Math.PI * 2, deep = k % 2 ? .45 : .7; ea.push([Math.cos(t0) * R * .4, Math.sin(t0) * R * .4, mz - L * .14]); eo.push([Math.cos(t0) * R * (.4 + deep * 1.2), Math.sin(t0) * R * (.4 + deep * 1.2), mz - L * .14 - len * deep]); }
      membrane(ea, eo, (f, w) => base.clone().lerp(accent, w * .4).lerp(shimmer, .15), (f, w) => A(SWAY, [0, 0, mz - L * .14], [0, 0, 0], f * 6, w * .5));
    }
    for (let k = 0; k < arms + longs; k++) {
      const a = k / arms * Math.PI * 2, long = k >= arms, x0 = Math.cos(a) * R * .35, y0 = Math.sin(a) * R * .35, z0 = mz - L * .14, p2 = [], l = long ? len * 1.7 : len;
      for (let j = 0; j <= 8; j++) { const f = j / 8, wob = Math.sin(f * 3 + k) * R * .2; p2.push({ p: [x0 * (1 + f * .5) + (long ? (k % 2 ? 1 : -1) * R * .2 : wob), y0 * (1 + f * .5), z0 - f * l], rx: R * (long ? .07 : .14) * (1 - f * .75), ry: R * (long ? .07 : .14) * (1 - f * .75), w: f, t: f }); }
      tube(p2, 6, (pt, ang, sy) => base.clone().lerp(belly, Math.max(0, -sy) * .6).lerp(accent, sy < -.3 && Math.sin(pt.t * 60) > .5 ? .5 : 0), (pt) => A(SWAY, [0, 0, z0], [0, 0, 0], k * .8, pt.w * .8),
        { glowAt: (pt) => glowLevel && pt.w > .85 ? glowLevel : 0 });
      if (long) ellipsoid(p2[8].p, [R * .12, R * .08, R * .22], accent.clone().lerp(base, .3), A(SWAY, [0, 0, z0], [0, 0, 0], k * .8, .8), 1);
    }
  }
  // A long, flat ribbon that swims by rippling, with frilled edges and stalked eyes at the front.
  function buildRibbon() {
    const L = b.length, Wd = s * .2, Th = s * .028, path = [], mv = A(WAVE, [0, 0, 0], [0, 0, 0], 0, .7);
    const wAt = (f) => f < .12 ? .35 + f / .12 * .65 : f > .85 ? .25 + (1 - f) / .15 * .75 : 1;
    for (let k = 0; k <= 22; k++) { const f = k / 22; path.push({ p: [0, 0, -L / 2 + f * L], rx: Wd * .5 * wAt(f), ry: Th * wAt(f), t: f }); }
    tube(path, 10, (pt, ang, sy) => skin(pt, ang, sy).lerp(accent, Math.abs(Math.cos(ang)) < .3 && Math.sin(pt.t * 50) > .4 ? .5 : 0), () => mv,
      { glowAt: (pt, ang) => glowLevel && sy0(ang) && Math.sin(pt.t * 40) > .6 ? glowLevel : 0 });
    for (const side of [-1, 1]) {
      const a = [], o = [];
      for (let k = 0; k <= 22; k++) { const f = k / 22, z = -L / 2 + f * L, w = Wd * .5 * wAt(f); a.push([side * w * .95, 0, z]); o.push([side * (w + Wd * .22 * wAt(f)), Math.sin(k * .9) * Th * 2.5, z]); }
      membrane(a, o, (f, w) => accent.clone().lerp(shimmer, w * .6), mv);
    }
    Object.assign(anchors, {
      torso: { c: [0, 0, L * .2], axis: [0, 0, 1], rx: Wd * .5, ry: Th * 1.2, anim: mv }, back: { p: [0, Th, L * .15], size: s * .12, anim: mv },
      mouth: { p: [0, 0, L / 2], dir: [0, 0, 1], size: Wd * .2, anim: mv }, shoulders: [-1, 1].map(side => ({ p: [side * Wd * .45, 0, L * .35], side })),
    });
    for (const side of [-1, 1]) {
      const b0 = [side * Wd * .18, Th * .6, L / 2 - Wd * .25], tip = [side * Wd * .3, Th * 4 + Wd * .15, L / 2 - Wd * .15], er = Wd * .07;
      tube([{ p: b0, rx: er * .4, ry: er * .4 }, { p: tip, rx: er * .3, ry: er * .3 }], 5, () => base, () => mv);
      ellipsoid(tip, [er, er, er], tag(eyeC.clone().lerp(white, .25), KIND.gloss), mv, 1, glowLevel > .5 ? .6 : 0);
      ellipsoid([tip[0], tip[1], tip[2] + er * .6], [er * .5, er * .55, er * .5], tag(dark.clone(), KIND.gloss), mv, 0);
    }
  }
  function sy0(ang) { return Math.abs(Math.sin(ang)) > .8; }
  // A flat disc fringed with paddles that spins as it swims, with eyes all round its rim.
  function buildDisc() {
    const R = s * .5, T = R * .2, spin = A(SPIN, [0, 0, 0]), lobes = sp.lobes || 8;
    const prof = [[-1, .2], [-.8, .8], [-.3, 1], [0, 1.02], [.4, .92], [.8, .6], [1.15, .28], [1.3, .05]];
    tube(prof.map(([y, rr], i) => ({ p: [0, y * T, 0], rx: rr * R, ry: rr * R, t: i / 7 })), 26,
      (pt, ang) => skin({ t: pt.t }, ang * 3, .5).lerp(accent, Math.cos(lobes * ang) > .75 && pt.t > .2 ? .45 : 0), () => spin,
      { glowAt: (pt, ang) => glowLevel && Math.cos(lobes * ang) > .8 && pt.t > .5 ? glowLevel : 0 });
    const m = 26;
    for (let k = 0; k < m; k++) {
      const a = k / m * Math.PI * 2, d = .09, c0 = Math.cos(a - d), s0 = Math.sin(a - d), c1 = Math.cos(a + d), s1 = Math.sin(a + d);
      membrane([[c0 * R * .97, 0, s0 * R * .97], [c1 * R * .97, 0, s1 * R * .97]], [[c0 * R * 1.24, T * .3 * Math.sin(k), s0 * R * 1.24], [c1 * R * 1.24, T * .3 * Math.sin(k), s1 * R * 1.24]],
        (f, w) => accent.clone().lerp(shimmer, w * .6), spin);
    }
    const ne = Math.max(6, sp.eyes.count + 4);
    for (let k = 0; k < ne; k++) {
      const a = (k + .5) / ne * Math.PI * 2, er = R * .07, x = Math.cos(a) * R * .9, z = Math.sin(a) * R * .9;
      ellipsoid([x, T * .55, z], [er, er, er], tag(eyeC.clone().lerp(white, .25), KIND.gloss), spin, 1, glowLevel > .5 ? .6 : 0);
      ellipsoid([x * 1.05, T * .7, z * 1.05], [er * .5, er * .5, er * .5], tag(dark.clone(), KIND.gloss), spin, 0);
    }
    ellipsoid([0, T * 1.1, 0], [R * .3, T * .6, R * .3], shimmer.clone().lerp(white, .15), spin, 1, glowLevel * .6);
    Object.assign(anchors, {
      torso: { c: [0, 0, 0], axis: [0, 1, 0], rx: R * .99, ry: R * .99, anim: spin }, back: { p: [0, T * 1.3, 0], size: s * .2, anim: spin },
      head: { p: [0, T * .55, 0], size: R * .9, ring: true, anim: spin }, mouth: { p: [0, -T, 0], dir: [0, -1, 0], size: R * .3, anim: spin },
      shoulders: [-1, 1].map(side => ({ p: [side * R * .7, -T * .5, R * .3], side })),
    });
  }

  // ---- Everything with a spine ----
  function buildSpineAnimal() {
    const hexa = plan === 'hexapod', arach = plan === 'arachnid', bug = hexa || arach, biped = plan === 'biped', flyer = plan === 'flyer';
    const serp = plan === 'serpent', slug = plan === 'slug', g = sp.girth || { hips: .5, belly: .56, shoulders: .48 };
    let legY = sp.legLength * ({ tank: .7, prowler: .78, waddler: .65, harvestman: 1.6 }[form] || 1);
    const L = b.length * ({ prowler: 1.3, tank: 1.1, harvestman: .45, ant: 1.1 }[form] || 1), W = b.width * ({ tank: 1.35, roach: 1.4, waddler: 1.3 }[form] || 1), H = b.height * ({ prowler: .8, roach: .55, tank: 1.1, waddler: 1.35 }[form] || 1);
    const bodyY = serp || slug ? 0 : bug ? Math.max(legY * (form === 'harvestman' ? .9 : .7), H * .5) : legY + H * .3; // heavy bugs: keep the belly off the ground
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
    } else if (form === 'centipede') {
      // Many segments, each a swelling with a narrow joint behind it.
      const n = sp.legs / 2;
      for (let i = 0; i < n; i++) {
        const z = -L / 2 + i * L / Math.max(1, n - 1), taper = i === 0 ? .55 : i === n - 1 ? .8 : 1;
        body.push({ p: [0, bodyY, z - L / n * .3], rx: W * .3 * taper, ry: H * .26 * taper }, { p: [0, bodyY + H * .04, z], rx: W * .46 * taper, ry: H * .36 * taper, mod: (ang) => 1 + .08 * Math.cos(ang * 2) });
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
    const headless = sp.alien === 'headless' && !serp && !slug && !bug;
    const neck = serp || slug || bug || headless ? [] : neckLen > 0 ? [{ p: [0, neckBase[1] + headUp * .55, L / 2 + headFwd * .5], rx: s * .07 + W * .1, ry: s * .07 + H * .1 }] : [];
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
    const head = headless
      ? [{ p: [0, neckBase[1] - H * .05, L / 2 + W * .16], rx: W * .26, ry: H * .28 }, { p: [0, neckBase[1] - H * .08, L / 2 + W * .3], rx: W * .12, ry: H * .14 }]
      : (HEADS[shape] || HEADS.round).map(([f, w, h2, d]) => ({ p: [0, hy - d * hd, hz + f * hd], rx: hd * w, ry: hd * h2 }));
    const spine = serp || slug ? [...body, ...head.slice(1)] : [...sp0, ...body, ...neck, ...head];
    const path = catmull(spine, 3);
    // Garments (city builders and up) cover the torso; suits more of it.
    if (cult && cult.level >= 3) zone = serp || slug
      ? (pt) => pt.p && pt.t > .25 && pt.t < .78 ? Math.min(pt.t - .25, .78 - pt.t) / .26 : 0
      : (pt) => { if (!pt.p || pt.tail) return 0; const z0 = -L * (cult.level >= 5 ? .45 : .32), z1 = L * (cult.level >= 5 ? .5 : .42), z = pt.p[2]; return z > z0 && z < z1 ? Math.min(z - z0, z1 - z) / ((z1 - z0) / 2) : 0; };
    // The head (and neck) turn about the base of the neck to look at things (iLook).
    const turns = !serp && !slug && !bug && !headless;
    const headPivot = neckBase;
    if (turns) headPivotOut = headPivot;
    tube(path, 14, skin, (pt) => serp ? A(SLITHER) : pt.tail ? A(SWAY, (body[0] || sp0[0]).p, [0, 0, 0], 0, pt.tail) : turns && pt.p[2] > headPivot[2] ? A(HEAD, headPivot) : A(BODY), { glowAt: skinGlow });
    const snoutTip = head[head.length - 1].p, skull = head[0].p, base0 = base;
    const headAnim = serp ? A(SLITHER) : turns ? A(HEAD, headPivot) : A(BODY);

    // Face: eyes, brow, jaw, beak, ears, antennae, mandibles, frill, horns, crest.
    if (headless) headlessFace(); else {
    if (sp.alien !== 'hammerhead' && sp.alien !== 'stalkeye') eyesAt([0, skull[1] + hd * .12, skull[2] + hd * .42], hd * (shape === 'flat' ? .58 : .5), hd, slug ? 1 : sp.eyes.forward, headAnim);
    alienHead();
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
    }

    // Alien heads: a bar with an eye at each end, eyes on tall stalks, a long tube of a mouth.
    function alienHead() {
      if (sp.alien === 'hammerhead') {
        const span = hd * 1.5, y = skull[1] + hd * .08, z = skull[2] + hd * .35, bar = [];
        for (let k = 0; k <= 8; k++) { const f = k / 8 * 2 - 1; bar.push({ p: [f * span, y + Math.abs(f) * hd * .1, z - f * f * hd * .25], rx: hd * .2 * (1 - Math.abs(f) * .35), ry: hd * .17 * (1 - Math.abs(f) * .3), t: .85 }); }
        tube(bar, 8, skin, () => headAnim);
        for (const side of [-1, 1]) {
          const e = [side * (span + hd * .02), y + hd * .14, z - hd * .25], er = hd * .17;
          ellipsoid(e, [er, er, er], tag(eyeC.clone().lerp(white, .25), KIND.gloss), headAnim, 1, glowLevel > .6 ? .5 : 0);
          ellipsoid([e[0] + side * er * .55, e[1], e[2] + er * .2], [er * .5, er * .6, er * .55], tag(dark.clone(), KIND.gloss), headAnim, 0);
        }
      } else if (sp.alien === 'stalkeye') {
        const n = Math.min(4, Math.max(2, sp.eyes.count)), len = hd * (1.4 + (sp.seed % 5) * .15) * (serp ? .8 : 1);
        for (let k = 0; k < n; k++) {
          const x = (k - (n - 1) / 2) * hd * .32, base = [x, skull[1] + hd * .3, skull[2] + hd * .15], path2 = [];
          for (let j = 0; j <= 5; j++) { const f = j / 5; path2.push({ p: [x * (1 + f * 1.4), base[1] + f * len, base[2] + Math.sin(f * 2) * hd * .35], rx: hd * .07 * (1 - f * .4), ry: hd * .07 * (1 - f * .4), w: f }); }
          const anim = (w) => A(SWAY, base, [0, 0, 0], k * 1.9, w * .7);
          tube(path2, 6, () => belly.clone().lerp(base0, .5), (pt) => anim(pt.w));
          const tip = path2[5].p, er = hd * .16;
          ellipsoid(tip, [er, er, er], tag(eyeC.clone().lerp(white, .25), KIND.gloss), anim(1), 1, glowLevel > .6 ? .6 : 0);
          ellipsoid([tip[0], tip[1], tip[2] + er * .6], [er * .5, er * .55, er * .5], tag(dark.clone(), KIND.gloss), anim(1), 0);
        }
      } else if (sp.alien === 'proboscis') {
        // Hanging down to the ground from a raised head; reaching forward from one held low.
        const t0 = snoutTip, low = t0[1] < hd * 2.2, len = low ? hd * 2.2 : Math.max(hd * 1.6, t0[1] * .85), path2 = [];
        for (let j = 0; j <= 8; j++) { const f = j / 8; path2.push({ p: [0, low ? t0[1] + Math.sin(f * 2.4) * hd * .35 - f * t0[1] * .5 : t0[1] - f * len * .9, t0[2] + (low ? f * len : Math.sin(f * 1.8) * hd * .9)], rx: hd * (.13 - f * .06 + (j === 8 ? .07 : 0)), ry: hd * (.13 - f * .06 + (j === 8 ? .07 : 0)), w: f, t: f }); }
        tube(path2, 8, (pt, ang, sy) => base0.clone().lerp(belly, .3).lerp(dark, Math.sin(pt.t * 40) > .6 ? .25 : 0), (pt) => serp ? A(SLITHER) : A(SWAY, t0, [0, 0, 0], 1, pt.w * .8));
      }
    }
    // No head at all: a row of eyes across the chest above a vertical mouth, and feeding feelers below it.
    function headlessFace() {
      const c0 = head[0].p, z = c0[2] + W * .2, n = Math.max(3, Math.min(6, sp.eyes.count + 1));
      for (let k = 0; k < n; k++) {
        const x = (k - (n - 1) / 2) * W * .11, y = c0[1] + H * .14 - Math.abs(x) * .3, er = W * .045 * (1 + sp.eyes.size * 3), zz = z - Math.abs(x) * .6;
        ellipsoid([x, y, zz], [er, er, er], tag(eyeC.clone().lerp(white, .2), KIND.gloss), A(BODY), 1, glowLevel ? .7 : 0);
        ellipsoid([x, y, zz + er * .6], [er * .5, er * .55, er * .4], tag(dark.clone(), KIND.gloss), A(BODY), 0);
      }
      ellipsoid([0, c0[1] - H * .06, z - W * .02], [W * .025, H * .14, W * .03], dark, A(BODY), 1);
      for (let k = 0; k < 5; k++) {
        const x = (k - 2) * W * .045, top = [x, c0[1] - H * .2, z - W * .05], path2 = [];
        for (let j = 0; j <= 4; j++) { const f = j / 4; path2.push({ p: [x * (1 + f), top[1] - f * H * .35, top[2] + Math.sin(f * 2) * W * .06], rx: W * .02 * (1 - f * .6), ry: W * .02 * (1 - f * .6), w: f }); }
        tube(path2, 5, () => accent.clone().lerp(belly, .4), (pt) => A(SWAY, top, [0, 0, 0], k * 1.3, pt.w));
      }
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

    if (cult) {
      const near = (z) => path.reduce((b, pt) => Math.abs(pt.p[2] - z) < Math.abs(b.p[2] - z) ? pt : b, path[0]);
      const atT = (t) => path.reduce((b, pt) => Math.abs(pt.t - t) < Math.abs(b.t - t) ? pt : b, path[0]);
      const anim = serp ? A(SLITHER) : A(BODY);
      const sect = (pt) => { const i = path.indexOf(pt), a = path[Math.max(0, i - 1)].p, b2 = path[Math.min(path.length - 1, i + 1)].p; return { c: pt.p, axis: [b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]], rx: pt.rx, ry: pt.ry, anim }; };
      const long = serp || slug, mid = long ? atT(.5) : near(L * .15), hips = long ? atT(.36) : near(-L * .22), neckPt = long ? atT(.8) : near(L / 2 + (neckLen > 0 ? headFwd * .25 : 0)), fz = long ? atT(.74) : near(L * .38);
      anchors.torso = sect(mid); anchors.belt = sect(hips); anchors.collar = bug ? null : sect(neckPt);
      anchors.back = { p: [mid.p[0], mid.p[1] + mid.ry * .9, mid.p[2] - (long ? 0 : L * .1)], size: s * .28, anim };
      anchors.head = { p: [skull[0], skull[1] + hd * .1, skull[2] + hd * .3], size: hd, anim: headAnim };
      anchors.mouth = { p: [snoutTip[0], snoutTip[1] - hd * .12, snoutTip[2]], dir: [0, -.3, 1], size: hd * .4, anim: headAnim };
      anchors.shoulders = [-1, 1].map(side => ({ p: [side * fz.rx * .85, fz.p[1] - fz.ry * .3, fz.p[2]], side }));
      if (flyer) {
        anchors.wingAnim = (side) => A(WING, [side * W * .35, bodyY + H * .2, L * .12], [0, 0, 0], side);
        if (cult.manip === 'wing-hands') anchors.shoulders = [-1, 1].map(side => ({ p: [side * sp.wingSpan * .22, bodyY + H * .2 + s * .1, L * .2], side }));
      }
    }
    // Legs (and the mantid's raised forelegs, the scorpion's pincers).
    if (serp || slug) return;
    const pairs = sp.legs / 2;
    for (let i = 0; i < pairs; i++) {
      let z = pairs === 1 ? -L * .12 : L * .3 - i * (L * .62) / (pairs - 1);
      if (bug && form !== 'harvestman') z = (arach ? L * .3 : L * .25) - i * (arach ? L * .5 : L * .55) / Math.max(1, pairs - 1);
      if (form === 'centipede') z = L * .45 - i * L * .9 / Math.max(1, pairs - 1);
      const frontPair = pairs > 1 && i === 0;
      const hopperHind = form === 'hopper' && i === pairs - 1, hopperFront = form === 'hopper' && i === 0;
      for (const side of [-1, 1]) {
        const ly = legY * (hopperHind ? 1.35 : hopperFront ? .8 : 1);
        const hipY = bodyY + lift(z) - H * .15, hipX = side * W * .3;
        const thick = s * (bug ? .03 : .06) * (biped ? 1.35 : 1) * (tr.diet === 'herbivore' ? 1.1 : .95) * (form === 'tank' ? 1.5 : form === 'harvestman' ? .5 : 1) * (hopperHind ? 1.5 : 1)
          * Math.sqrt(sp.bulk || 1) * (sp.build === 'giant' ? 1.25 : sp.build === 'lanky' ? .8 : 1);
        // Centipede legs step in a wave that runs along the body.
        const phase = form === 'centipede' ? i * .85 + (side > 0 ? Math.PI : 0) : ((i + (side > 0 ? 1 : 0)) % 2) * Math.PI;
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
          const spread = form === 'harvestman' ? 2.2 : arach ? 1.4 : 1, fwd = form === 'centipede' ? 0 : arach ? (i - 1.5) * -.35 : (i - 1) * -.25;
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
      // Builders' arms vary (fauna-culture.mjs armStyle): boneless tentacles, pincers, or jointed arms with fingers.
      if (cult?.armStyle === 'tentacle') {
        const path2 = [];
        for (let j = 0; j <= 8; j++) { const f = j / 8; path2.push({ p: [shoulder[0] + side * Math.sin(f * 2) * armL * .25, shoulder[1] - f * armL * .85, shoulder[2] + Math.sin(f * 2.6) * armL * .45], rx: s * .045 * (1 - f * .6), ry: s * .045 * (1 - f * .6), w: f }); }
        const ta = A(SWAY, shoulder, [0, 0, 0], side, .45), tip = path2[8].p;
        tube(path2, 7, (pt, ang, sy) => base.clone().lerp(belly, Math.max(0, -sy) * .5), (pt) => A(SWAY, shoulder, [0, 0, 0], side, pt.w * .45));
        for (const f of [-1, 0, 1]) spike(tip, [tip[0] + f * s * .04, tip[1] - s * .06, tip[2] + s * .05], s * .01, belly, ta, { bendDir: [0, 1, 0], bend: s * .015 });
        anchors.hands.push({ p: tip, dir: [0, -.3, 1], anim: ta, size: s * .035 });
        continue;
      }
      limb([shoulder, elbow, hand], [s * .05, s * .035, s * .03], ARM, FOREARM, shoulder, elbow, side > 0 ? 0 : Math.PI, 1, base);
      if (cult?.armStyle === 'pincer') {
        const fa = A(FOREARM, shoulder, elbow, side > 0 ? 0 : Math.PI, 1);
        ellipsoid(hand, [s * .05, s * .045, s * .065], horn, fa, 1);
        for (const k of [-1, 1]) spike([hand[0] + k * s * .02, hand[1], hand[2] + s * .04], [hand[0] - k * s * .005, hand[1] - s * .02, hand[2] + s * .13], s * .02, horn, fa, { bendDir: [-k, 0, 0], bend: s * .015 });
        anchors.hands.push({ p: hand, dir: [0, -.3, 1], anim: fa, size: s * .04 });
        continue;
      }
      ellipsoid(hand, [s * .045, s * .04, s * .05], belly, A(FOREARM, shoulder, elbow, side > 0 ? 0 : Math.PI, 1), 1);
      for (const f of [-1, 0, 1]) spike([hand[0] + f * s * .02, hand[1] - s * .02, hand[2] + s * .03], [hand[0] + f * s * .03, hand[1] - s * .07, hand[2] + s * .06], s * .012, belly, A(FOREARM, shoulder, elbow, side > 0 ? 0 : Math.PI, 1));
      anchors.hands.push({ p: hand, dir: [0, -.3, 1], anim: A(FOREARM, shoulder, elbow, side > 0 ? 0 : Math.PI, 1), size: s * .04 });
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
  const pos = [], colr = [], part = [], pivot = [], knee = [], phase = [], bend = [], normal = [], glow = [], kind = [];
  const bodyKind = sp.suit ? KIND.suit : sp.aquatic ? KIND.gloss : KIND.skin; // a suited colonist's body is all suit; sea life is wet and shiny
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
      colr.push(cc.r, cc.g, cc.b); part.push(a.part); pivot.push(...a.pivot); knee.push(...a.knee); phase.push(a.phase); bend.push(a.bend); glow.push(p.gl?.[v] ?? 0); kind.push(cc.kind ?? bodyKind);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  out.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  out.setAttribute('aPivot', new THREE.Float32BufferAttribute(pivot, 3));
  out.setAttribute('aKnee', new THREE.Float32BufferAttribute(knee, 3));
  out.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase.flatMap((v, i) => [v, bend[i]]), 2)); // phase, bend
  out.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  out.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  out.computeBoundingSphere();
  out.userData.headPivot = headPivotOut;
  return out;
}
