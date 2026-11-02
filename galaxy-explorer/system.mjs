// Deterministic system generation. Physics (physics.mjs) decides what each world
// is; this file turns that into the shape the game renders. Game distances are
// deliberately compressed: real AU and Earth radii live in body.physics.
import { rng } from './rng.mjs';
import { makeStar, makeWorld, makeGiant, giantChance, clamp } from './physics.mjs';
import { BIOMES, classify, worldLook, describe, factLine, giantLook, describeGiant, giantFacts } from './biomes.mjs';
import { terrainFor } from './terrain.mjs';

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
}

const SYLLABLES = ['ca', 've', 'lo', 'ri', 'tha', 'sen', 'mor', 'ael', 'dra', 'ny', 'os', 'ket', 'lu', 'va', 'zen', 'ir', 'qua', 'bel', 'tor', 'sa', 'phe', 'ion', 'ra', 'ul', 'cin', 'der', 'pe', 'ris', 'no', 'wen'];
function makeName(r, used) {
  for (let attempt = 0; attempt < 20; attempt++) {
    let name = '';
    for (let i = r.int(2, 3); i > 0; i--) name += r.pick(SYLLABLES);
    name = name[0].toUpperCase() + name.slice(1);
    if (name.length <= 9 && !used.has(name)) { used.add(name); return name; }
  }
  const fallback = `World ${used.size + 1}`; used.add(fallback); return fallback;
}
const normalize = (v) => { const d = Math.hypot(...v); return v.map(x => x / d); };

// Game-space layout (compressed). Spacing is wide enough that moons of
// neighbouring planets can never overlap.
const FIRST_ORBIT = 3000, ORBIT_STEP = 3100, ORBIT_JITTER = 150, MAX_BODIES = 9;
// Giants are far bigger and carry wider moon systems, so they get more room.
// A rocky planet's reach (radius plus moons) fits the normal orbit step, so
// systems without giants keep exactly the same layout.
const ROCKY_REACH = 1300, GIANT_MOON_GAP = 1100, GIANT_MOON_STEP = 500, GIANT_MOONS = 4, MAX_WITH_GIANTS = 12;
const giantRadius = (physics) => Math.round(clamp(420 + 100 * physics.radius, 700, 1700));
// Giants' moons orbit outside the rings (which reach 2.25 radii; giant-mesh.js).
const giantMoonStart = (radius) => Math.max(radius + GIANT_MOON_GAP, 2.25 * radius + 400);
const reachOf = (physics) => physics.giant ? giantMoonStart(giantRadius(physics)) + (GIANT_MOONS - 1) * GIANT_MOON_STEP + 200 : ROCKY_REACH;

function buildBody(args) {
  return args.physics.giant ? buildGiant(args) : buildWorld(args);
}
function buildGiant({ id, name, physics, star, seed, r, position, orbit, angle, ringed }) {
  const biome = physics.kind === 'ice' ? 'Ice giant' : 'Gas giant';
  return {
    id, name, biome, ...giantLook(physics, star, r), giant: true,
    type: biome, description: describeGiant(physics), facts: giantFacts(physics),
    note: '', title: '', message: '', starTemperature: star.temperature, starAge: star.age,
    seed, radius: giantRadius(physics), orbit, angle, position, ringed, parent: null,
    // Arrival point for cruise: on the day side, a little above the orbital
    // plane, so the planet and its rings are seen side-on and lit.
    signal: (() => { const h = Math.hypot(position[0], position[2]), turn = r.range(-.5, .5), lift = r.range(.25, .45);
      const x = -position[0] / h, z = -position[2] / h;
      return normalize([x * Math.cos(turn) - z * Math.sin(turn), lift, x * Math.sin(turn) + z * Math.cos(turn)]); })(),
    landmarkCount: 0, physics,
  };
}
function buildWorld({ id, name, physics, star, seed, r, parent, position, orbit, angle, ringed }) {
  const biome = classify(physics);
  const look = worldLook(biome, physics, star, r);
  const b = BIOMES[biome];
  return {
    id, name, biome, ...look,
    type: parent ? `${biome} moon` : biome,
    description: describe(biome, { ...physics, isMoon: !!parent }),
    facts: factLine(physics),
    note: b.note, title: b.title, message: b.message,
    starTemperature: star.temperature, starAge: star.age,
    // Sizes are compressed for play but keep a wide range: small rocks stay small, big worlds are several times larger.
    seed, radius: parent ? Math.round(70 + 160 * physics.radius ** 1.2) : Math.round(110 + 260 * physics.radius ** 1.3),
    orbit, angle, position, ringed, parent: parent ? parent.id : null,
    signal: normalize([r.range(-.25, .25), 1, r.range(-.25, .25)]),
    landmarkCount: 3 + Math.floor(r() * 3),
    physics,
  };
}

export function generateSystem(input = 1408) {
  const seed = Number(input) >>> 0;
  const star = makeStar(seed);
  const r = rng(seed, 'system');
  const used = new Set();
  const starName = makeName(r, used);

  // Orbits roughly double outward, starting well inside the habitable zone so
  // most systems have a world or two near it.
  const planetCount = r.int(4, 7);
  const ratio = r.range(1.45, 1.85);
  let au = star.habitableZone[0] * r.range(.3, .7);
  // Gameplay nudge: most systems get one planet inside the habitable zone.
  let candidate = -1;
  if (r.chance(.65)) {
    const k = candidate = r.int(1, Math.min(3, planetCount - 1));
    au = star.habitableZone[0] * r.range(1.05, 1.35) / ratio ** k;
  }

  const starRadius = Math.round(clamp(500 + 250 * star.radius, 450, 1000));
  const bodies = [];
  let base = 0, previousReach = 0;
  for (let i = 0; i < planetCount; i++) {
    const pr = rng(seed, 'planet', i);
    // The rocky world is always drawn so this planet's stream stays the same
    // whether or not a giant takes its place; giants draw from their own key.
    const rocky = makeWorld(star, au, pr, null, { candidate: i === candidate });
    const gr = rng(seed, 'giant', i);
    const physics = i !== candidate && gr() < giantChance(star, au) ? makeGiant(star, au, gr) : rocky;
    const reach = reachOf(physics);
    base = i === 0 ? Math.max(FIRST_ORBIT, physics.giant ? starRadius + reach + 400 : 0) : base + Math.max(ORBIT_STEP, previousReach + reach + 500);
    previousReach = reach;
    const angle = pr() * Math.PI * 2;
    const orbit = base + pr() * ORBIT_JITTER;
    const position = [Math.cos(angle) * orbit, (pr() - .5) * 140, Math.sin(angle) * orbit];
    let ringed = physics.icy ? pr.chance(physics.mass > 1 ? .55 : .15) : pr.chance(.05);
    if (physics.giant) ringed = gr.chance(physics.kind === 'gas' ? .6 : .45);
    bodies.push(buildBody({ id: `planet-${i}`, name: makeName(r, used), physics, star, seed: hash(seed, 'surface', i), r: pr, parent: null, position, orbit, angle, ringed }));
    au *= ratio * pr.range(.9, 1.1);
  }

  // Moons: heavier and outer planets are more likely to have them. Giants
  // always have some, and get theirs first so they are never crowded out.
  let moonIndex = 0;
  const giants = bodies.filter(b => b.giant).length, maxBodies = giants ? MAX_WITH_GIANTS : MAX_BODIES;
  for (const planet of bodies.slice().sort((a, b) => (b.giant ? 1 : 0) - (a.giant ? 1 : 0))) {
    const mr = rng(seed, 'moons', planet.id);
    const chance = clamp(.15 + planet.physics.mass * .2 + (planet.physics.icy ? .25 : 0), 0, .85);
    const count = planet.giant ? mr.int(1, GIANT_MOONS) : mr.chance(chance) ? (mr.chance(.35) ? 2 : 1) : 0;
    let baseAngle = mr() * Math.PI * 2;
    for (let k = 0; k < count && (bodies.length < maxBodies || (planet.giant && k === 0)); k++) {
      const physics = makeWorld(star, planet.physics.au, mr, planet.physics);
      physics.isMoon = true;
      const orbit = planet.giant ? giantMoonStart(planet.radius) + k * GIANT_MOON_STEP : planet.radius + 420 + k * 110;
      const angle = baseAngle + k * (Math.PI + mr.range(-.6, .6));
      const position = [planet.position[0] + Math.cos(angle) * orbit, planet.position[1] + 110, planet.position[2] + Math.sin(angle) * orbit];
      bodies.push(buildBody({ id: `moon-${moonIndex}`, name: makeName(r, used), physics, star, seed: hash(seed, 'surface', 'moon', moonIndex), r: mr, parent: planet, position, orbit, angle, ringed: false }));
      moonIndex++;
    }
  }

  // Start above the most habitable world; otherwise the one nearest the habitable zone.
  const hzMid = (star.habitableZone[0] + star.habitableZone[1]) / 2;
  const start = bodies.filter(b => !b.giant).sort((a, b) =>
    (b.physics.habitability - a.physics.habitability) || (Math.abs(Math.log(a.physics.au / hzMid)) - Math.abs(Math.log(b.physics.au / hzMid))))[0];

  return {
    seed, name: starName,
    star: { name: starName, radius: starRadius, color: star.color, physics: star },
    bodies, startId: start.id,
  };
}
import { hash32 as hash } from './rng.mjs';

// Height of the top surface (land, sea or ice) above the base radius. See terrain.mjs.
export function terrainHeight(body, n) { return terrainFor(body).surface(n); }
export function distance(a, b) { return Math.hypot(...a.map((v, i) => v - b[i])); }
export function cruisePoint(start, departure, end, t) {
  const ease = x => x * x * (3 - 2 * x);
  if (t < .22) { const u = ease(Math.max(0, t / .22)); return start.map((v, i) => v + (departure[i] - v) * u); }
  const u = ease(Math.min(1, (t - .22) / .78));
  // Travel above the orbital plane, avoiding the star and intervening planets. Short
  // hops (a moon and its planet) take a low arc instead: climbing 5 km to cross a
  // few hundred metres meant flying straight up and straight down.
  const d = Math.hypot(end[0] - departure[0], end[2] - departure[2]);
  const lift = d < 1500 ? 300 + d * .35 : 5000;
  const control = [(departure[0] + end[0]) / 2, Math.max(departure[1], end[1]) + lift, (departure[2] + end[2]) / 2];
  return departure.map((v, i) => (1 - u) * (1 - u) * v + 2 * (1 - u) * u * control[i] + u * u * end[i]);
}

// The star's name without generating the whole system (matches generateSystem).
export function starName(seed) { return makeName(rng(Number(seed) >>> 0, 'system'), new Set()); }
