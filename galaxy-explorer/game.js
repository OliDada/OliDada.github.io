import * as THREE from "./vendor/three.module.js";
import { applyLook, createPerf } from "./look.js";
import {
    damp,
    smoothstep,
    smootherstep,
    verticalTarget,
} from "./flight-math.mjs";
import { generateSystem, terrainHeight, cruisePoint } from "./system.mjs";
import { terrainFor } from "./terrain.mjs";
import { floraFor, plantBiome } from "./flora.mjs";
import { PLANT_STYLE } from "./style.mjs";
import { buildSurface, disposeSurface } from "./surface.js";
import { createKestrel, updateShipEffects, setShipDesign } from "./kestrel.js";
import { createSkyDome, setupShadows, SHADOWS, makeMistFog, installMist, createSunShafts, MIST, BEAMS, AIR } from "./atmosphere.js";
import { WATER } from "./water.js";
import { createSystemView, buildSystemViewGradually } from "./system-view.js";
import { createTerrainStreamer } from "./planet-lod.js";
import {
    ARRIVE_LY,
    toGalaxy,
    toScene,
    systemEdge,
    starGameRadius,
    createSky,
    createNearStar,
    createDriveStreaks,
    createWorldDots,
    BOOT_PARAMS,
} from "./deep-space.js";
import { setupInput } from "./input.js";
import { updateHUD, updateWaypoint } from "./hud.js";
import { createEngineSound } from "./audio.js";
import { orbitClock, systemPositions, bodyPosition, angularSpeed, setClockShift } from "./orbits.mjs";
import { TIER, TIER_AUTO, Q, TIME_OF_DAY, HIDE_HUD, SPOT, SPOT_AT, SPOT_BACK, EYE_UP, GIANT_TEST, DIVE_TEST } from "./quality.mjs";
import { VIEW_RANGE } from "./scale.mjs";
import { starById, homeStar, starsNear, START } from "./galaxy.mjs";
import { createRelations, canTalk, askOf, valueOf, tradeable, giftsOf, giftWords, keepsakeOf, stepAtLeast, STEPS } from "./contact.mjs";
import { createContactUI } from "./contact-ui.js";
import { createVoices } from "./voices.js";
import { buildInterior, canEnter } from "./interior.js";
import { GESTURE_WORDS, gestureOf } from "./express.mjs";
import { rarityOf, rarityAtLeast } from "./rarity.mjs";
import { createCodexUI } from "./codex-ui.js";
import { stanceOf } from "./station-deck.js";
import { plural } from "./structures.mjs";
import { networkFor } from "./settlements.mjs";
import {
    loadGalaxyState,
    saveGalaxyState,
    playJump,
    playArrival,
} from "./galaxy-ui.js";
import { createStarMap } from "./starmap.js";
import { seaOnly } from "./codex.mjs";
import { createCodex, backfill, stationEntry, contactEntry, coreEntry, floraEntry, faunaEntry, formationEntry, settlementEntry, fieldNoteEntry, worldEntry, signalEntry, behaviourEntry, phenomenonEntry } from "./codex.mjs";
import { coreSample } from "./geology.mjs";
import { WADE_DEPTH, diveDepth, swimDepth, divesIn, cloudDepth } from "./upgrades.mjs";
import { cloudFaunaFor } from "./fauna.mjs";
import { findsNear, findInCell, DETECT_LY, REVEAL_LY, FIND_KINDS } from "./deep-finds.mjs";
import { createFindViews } from "./deep-finds-view.js";
import { rockClearance, rockDensity } from "./space-objects.mjs";
import { createSpaceObjectsView } from "./space-objects-view.js";
import { buildCrew } from "./fauna-mesh.js";
import { UPGRADES, completedWorlds, progress, advanced, recordedOn, jumpRange as rangeFor, suitDamageScale, suitRecoveryScale, heatScale, observeTime, behaviourAlerts, hasFieldGlasses, ZOOM_REACH, radioHearing, decodesSignals, landsBesideLava, exposureScale, exposureOf } from "./upgrades.mjs";
import { BEHAVIOURS, behavioursOf, behaviourNow } from "./ecology.mjs";
import { forecast, eclipseAt } from "./phenomena.mjs";
import { createSkyEvents } from "./sky-events.js";
import { createWeatherFX } from "./weather-fx.js";
import { PRECIP } from "./weather.mjs";
import { wind } from "./wind.mjs";
import { createUpgradeScreen } from "./upgrades-ui.js";
import { findScanTarget, followTarget, cardFor, wordFor, titleFor, verbFor } from "./scanning.js";
import { setupDev } from "./dev-panel.js";
import { createScanUI } from "./scan-ui.js";
import { civilizationOf, colonistOf, arkPosition, civilizationsIn } from "./civilizations.mjs";
import { createPost } from "./post.js";
import { quietHud } from "./hud-quiet.js";
import { rememberPlace, placesPanel, setGoto, takeGoto } from "./places.js";
import { patrolFor, createPatrol } from "./patrol.js";
import { personaOf, talkTopics, bodyLine } from "./persona.mjs";

// Surface flight uses coordinates relative to the current world; space travel is continuous.
const $ = (id) => document.getElementById(id);
const coarsePointer = matchMedia("(pointer: coarse)").matches; // phones and tablets: touch controls and a simpler HUD
// How much is drawn follows the quality tier (quality.mjs), which is "low" on phones unless forced.
const lite = Q.lite;
const clamp = THREE.MathUtils.clamp;
const Y = new THREE.Vector3(0, 1, 0);
// Which star are we at? ?star= (galaxy chart), ?seed= (off-chart system), else the saved position or home.
// A second "?" (…&world=planet-4?dev) is read as "&", so a mistyped option still works.
const params = new URLSearchParams(location.search.replace(/(?!^)\?/g, "&"));
const galaxyState = loadGalaxyState();
let currentStar = starById(params.get("star"));
let offChart = !currentStar && params.get("seed") !== null;
if (!currentStar) currentStar = starById(galaxyState.current) || homeStar();
if (!offChart) {
    galaxyState.current = currentStar.id;
    galaxyState.visited.add(currentStar.id);
    saveGalaxyState(galaxyState);
    if (params.get("star") !== currentStar.id)
        try {
            history.replaceState(null, "", `?star=${currentStar.id}`);
        } catch {} // some hosts (sandboxed frames) don't allow query strings
}
let system = generateSystem(offChart ? params.get("seed") : currentStar.seed);
// The galaxy star whose system is loaded. An off-chart test system (?seed=)
// sits at your last charted star, but is not that star's real system.
let loadedId = offChart ? null : currentStar.id;
// &world=planet-1 starts above a specific world (handy for sharing a planet).
// Giants have no surface, so they are never the world you are at.
let activeBody =
    system.bodies.find((b) => b.id === params.get("world") && !b.giant) ||
    (loadedId === START.star && system.bodies.find((b) => b.id === START.world)) ||
    system.bodies.find((b) => b.id === system.startId);
let RADIUS = activeBody.radius;
// The codex: everything documented in every system, and the upgrades it unlocks
// (codex.mjs, upgrades.mjs, upgrades-ui.js; plan in PROGRESSION.md).
const codex = createCodex();
if (!codex.backfilled) backfill(codex);
codex.add(worldEntry(system, activeBody));
const upgradeScreen = createUpgradeScreen({
    codex,
    onOpen: () => { keys.clear(); if (starMap?.isOpen) starMap.close(); },
    onUnlock: (id) => applyUpgrade(id),
    touch: coarsePointer,
});
// Records a codex entry and works out what it moved forward:
// { added, ready (an upgrade that just became ready), moved, progressText, text }.
// text is a sentence to append to a toast ("" if nothing to say).
function recordInfo(entry) {
    const before = progress(codex.entries, codex.unlocked);
    if (!codex.add(entry)) return { added: false, text: "" };
    const moved = advanced(before, progress(codex.entries, codex.unlocked));
    upgradeScreen.refresh();
    updateTally(true);
    const ready = moved.find((m) => m.ready);
    const m = moved.find((x) => x.id === codex.tracked) || moved.find((x) => x.have < x.count) || moved[0];
    const s = m && m.have >= m.count && m.spread.find((x) => x.have < x.need);
    const progressText = m ? (s ? `${s.have} of ${s.need} ${s.label}` : `${m.label} · ${m.have}/${m.count}`) : "";
    const text = ready ? ` Upgrade ready: ${ready.name}. Open Upgrades (U).` : m ? ` Counts toward ${m.name} (${s ? progressText : `${m.have} / ${m.count}`}).` : "";
    return { added: true, ready, moved: m, progressText, text };
}
const record = (entry) => recordInfo(entry).text;
function applyUpgrade(id) {
    const u = UPGRADES[id];
    if (id === "petrel") setShipDesign(kestrel, "petrel");
    if (id.startsWith("jumpDrive")) starMap?.setRange?.(jumpRangeNow());
    updateTally(true);
    toast(u.status === "planned" ? `${u.name} unlocked. Its effect is not built yet (see PROGRESSION.md).` : `${u.name} installed. ${u.effect}`, 6);
}
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// Contact (contact.mjs, contact-ui.js): relationships with other minds, saved per civilization.
const relations = createRelations();
const contactUI = createContactUI({ onClose: () => { keys.clear(); endTalk(); } });
// Whoever you are talking to: { herd, creature } on a world, { deck, i } on a deck (they face
// you and attend; the view turns to them and keeps them clear of the panel).
let talking = null;
function endTalk() {
    if (talking?.herd) talking.herd.talkWith(null);
    if (talking?.deck) talking.deck.talkWith(null);
    talking = null;
    if (camera.view?.enabled) { camera.clearViewOffset(); camera.updateProjectionMatrix(); }
}
// The codex overview (codex-ui.js): K or the CODEX button.
const codexUI = createCodexUI({ codex, THREE, onOpen: () => { keys.clear(); if (document.pointerLockElement) document.exitPointerLock?.(); if (upgradeScreen.isOpen) upgradeScreen.close(); } });
// Jump range: the drive upgrades, plus drive technology from spacefaring friends.
const jumpRangeNow = () => rangeFor(codex.unlocked) + relations.effects().drive;
// Where every body is right now (orbits.mjs). Coordinates in the scene are
// relative to the world you are at (worldOrigin).
// ?time= (quality.mjs): worlds do not spin, so a place's day is its world's trip round the
// star. Find when the star stands highest over the landing site (noon) during the next
// orbit, then shift the clock to the hour asked for. It applies to the world you load on.
function solarShift(hour) {
    const body = activeBody, around = body.parent ? system.bodies.find((b) => b.id === body.parent) : body;
    const period = (2 * Math.PI) / angularSpeed(system, around), t0 = orbitClock(), up = terrainFor(body).landing;
    let best = -Infinity, noon = 0;
    for (let i = 0; i < 1440; i++) {
        const dt = (period * i) / 1440, p = bodyPosition(system, body, t0 + dt), l = Math.hypot(...p);
        const elevation = -(p[0] * up[0] + p[1] * up[1] + p[2] * up[2]) / l;
        if (elevation > best) { best = elevation; noon = dt; }
    }
    return noon + ((hour - 12) / 24) * period;
}
if (TIME_OF_DAY !== null) setClockShift(solarShift(TIME_OF_DAY));
if (HIDE_HUD) document.body.classList.add("nohud");
let orbitTime = orbitClock(),
    positions = systemPositions(system, orbitTime);
// Worlds, and arks (chosen on the map: { ark: true, civ }), sixty degrees ahead of their builders' worlds.
// One destination per ark, the same object the map uses ids for (starmap.js arkBodyOf);
// radius: the sphere its hull fits in, so distances read to the hull as they do for worlds.
const arkBodyCache = new Map();
function arkBody(a) {
    const id = `ark:${a.civ.id}`;
    if (!arkBodyCache.has(id)) arkBodyCache.set(id, { id, ark: true, civ: a.civ, name: a.civ.arkName.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase()), type: "Ark", radius: 0 });
    const b = arkBodyCache.get(id);
    b.radius = a.size * 0.5;
    return b;
}
const arkBodies = () => (systemView?.arks?.() ?? []).map(arkBody);
// The map hands over its own ark objects: use ours.
const ownBody = (body) => (body?.ark ? arkBodies().find((b) => b.id === body.id) ?? body : body);
const positionOf = (body) => (body.ark ? vec(...arkPosition(system, body.civ, positions)) : vec(...positions.get(body.id)));
let worldOrigin = positionOf(activeBody);
let signalNormal = vec(...terrainFor(activeBody).site); // dry, level ground near the signal
let landingNormal = vec(...terrainFor(activeBody).landing); // the landing pad: dry, level ground beside the site (terrain.mjs)
const heightAt = (n) => terrainHeight(activeBody, n);
const surfaceRadius = (n) => RADIUS + heightAt(n);
const surfacePoint = (n, offset = 0) =>
    n.clone().multiplyScalar(surfaceRadius(n) + offset);
const tangent = (forward, up) =>
    forward.clone().addScaledVector(up, -forward.dot(up)).normalize();
// --- Water: wading, swimming and diving -----------------------------------------
// Seas of water, methane, ammonia or sulfur (terrain liquid 'water'). surfaceRadius is the
// top of the sea; bedRadius the sea floor under it (the same as surfaceRadius on land).
const seaTerrain = () => { const t = terrainFor(activeBody); return t.liquid === "water" ? t : null; };
const depthAt = (n) => { const t = seaTerrain(); return t ? t.sea - t.height(n) : -1; }; // metres of water (negative: dry)
const bedRadius = (n) => { const t = seaTerrain(); return t ? RADIUS + t.height(n) : surfaceRadius(n); };
const seaRadius = () => RADIUS + (seaTerrain()?.sea ?? -1e9);
const solventHere = () => terrainFor(activeBody).solvent ?? "water";
// Molten sulfur is too hot to wade in; the rest is fine in a suit.
const wadable = () => !!seaTerrain() && solventHere() !== "sulfur";
const canSwimHere = () => wadable() && swimDepth(codex.unlocked) > 0 && divesIn(codex.unlocked, solventHere());
const canDiveHere = () => !!seaTerrain() && codex.unlocked.has("petrel") && diveDepth(codex.unlocked) > 0 && divesIn(codex.unlocked, solventHere());
let swimming = false, // on foot, in water too deep to stand in (Dive suit)
    swimD = 0, // how far your eyes are below the surface while swimming (m; negative: just above)
    shipSubmerged = false; // the Petrel was left parked under water (you swam out)
// Where you are: your eyes while swimming, your feet otherwise.
const playerPos = () => (mode === "walk" && swimming ? camera.position.clone() : surfacePoint(playerNormal));
applyLook(THREE); // the shared stylised look (look.js); before anything is drawn
installMist(THREE); // valley mist in the fog shader (atmosphere.js); before anything is drawn
let renderer;
try {
    renderer = new THREE.WebGLRenderer({
        canvas: $("world"),
                antialias: true,
        powerPreference: "high-performance",
        // Keeps depth precise across huge distances, so distant seas and coastlines don't flicker.
        logarithmicDepthBuffer: true,
    });
} catch (error) {
    $("error").hidden = false;
    $("errorMessage").textContent =
        "This browser could not create a WebGL renderer. Try a browser with hardware acceleration enabled.";
    throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.ratio));
const perf = createPerf(renderer, { maxRatio: Q.ratio, onChange: () => sky.resize(), scene: () => scene, note: () => `   quality ${TIER}${TIER_AUTO ? " (auto)" : ""}` }); // frame-rate overlay (?perf) and adaptive resolution
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
// Glow around bright things (post.js); ?glow=0 turns it off. Lighter on phones.
const post = BOOT_PARAMS.get("glow") === "0"
    ? { enabled: false, render: (s, c) => renderer.render(s, c) }
    : createPost(renderer, TIER === "low" ? { samples: 0, levels: 4 } : {});
const hudQuiet = quietHud(); // the HUD fades what you have read (hud-quiet.js)
const scene = new THREE.Scene();
// Lamplight inside a home (interior.js). Always in the scene (dark until you go in), so
// going in never makes every material rebuild its shader for one more light.
const indoorLight = new THREE.PointLight(0xffd9a8, 0, 40, 1.4);
scene.add(indoorLight);
let indoor = null; // inside a home: { d (the dwelling), room, x, z, yaw, native (species) }
let doorCache = { at: -1, d: null };
scene.background = new THREE.Color("#07101d");
const camera = new THREE.PerspectiveCamera(
    58,
    innerWidth / innerHeight,
    0.08,
    VIEW_RANGE,
);
const hemi = new THREE.HemisphereLight(0xb6dfdf, 0x4c3844, 2.0);
scene.add(hemi);
// Sunlight takes the star's colour: red dwarfs cast warm, dim-looking light.
const sun = new THREE.DirectionalLight(
    new THREE.Color(system.star.color).lerp(new THREE.Color(0xffffff), 0.45),
    3.1,
);
sun.position.set(-600, 550, 350);
scene.add(sun);
// The star's own light colour, before dusk warms it (updateAtmosphere).
const sunBase = sun.color.clone();
// Soft shadows from the star near the ground, and the sky dome (atmosphere.js).
const shadows = setupShadows(THREE, renderer, scene, sun, { size: Q.shadowMap, half: Q.shadowHalf, every: Q.shadowEvery });
const skyDome = createSkyDome(THREE);
scene.add(skyDome.mesh);
// Shafts of sunlight in the woods (atmosphere.js): strength from updateLocalAir.
const shafts = createSunShafts(THREE);
scene.add(shafts.mesh);
let mistWant = 0; // valley mist for the world you are on (updateAtmosphere)
const fill = new THREE.DirectionalLight(0x749bd5, 0.65);
fill.position.set(200, -100, -300);
scene.add(fill);

// The landing site around the current world's signal (surface.js), built on arrival.
// The last few sites are kept, so hopping between a moon and its planet (or coming
// back) doesn't rebuild them, and a cruise builds its destination's site on the way.
let site = null;
const siteCache = new Map(); // body id -> site, oldest first
// The surface of the world you are flying toward (rocks, plants, formations,
// settlements, its glowing rim), shown from a few kilometres out so it grows
// into view as you approach instead of appearing all at once when you reach orbit.
let approachSite = null,
    approachBody = null,
    siteBody = null; // the world `site` belongs to
function makeSite(body) {
    const R = body.radius, t = terrainFor(body), signal = vec(...t.site);
    const built = buildSurface({
        body,
        radius: R,
        signalNormal: signal,
        landingNormal: vec(...t.landing),
        surfacePoint: (n, offset = 0) => n.clone().multiplyScalar(R + t.surface(n) + offset),
        coarse: lite,
        colonist: colonistOf(system, body),
    });
    // From now on its lights seen from space are the real ones (city-lights.js).
    try { if (built.structures?.nightLights && systemView.system === system) systemView.useSiteLights?.(body, built.structures.nightLights); } catch {} // (the view may not exist yet at start-up)
    return built;
}
function clearSites() {
    leaveHome(true);
    if (site) scene.remove(site.group);
    for (const s of siteCache.values()) disposeSurface(s.group);
    siteCache.clear();
    site = siteBody = null;
    approachSite = approachBody = null;
}
// A world's surface, built once and kept for the last few worlds.
function siteFor(body) {
    const s = siteCache.get(body.id) ?? makeSite(body);
    siteCache.delete(body.id);
    siteCache.set(body.id, s); // now the newest
    for (const [id, old] of siteCache) {
        if (siteCache.size <= 3) break;
        if (old === s || old === site || old === approachSite) continue;
        disposeSurface(old.group);
        siteCache.delete(id);
    }
    return s;
}
function buildSite() {
    const old = site, oldBody = siteBody;
    const next = siteFor(activeBody);
    if (approachSite === next) approachSite = approachBody = null; // it was already in view
    if (old && old !== next) {
        // The world you just left stays in view, as the nearby one (if it is
        // still close, updateApproachSite keeps it; otherwise it is removed).
        if (approachSite) scene.remove(approachSite.group);
        approachSite = old;
        approachBody = oldBody;
        old.halo.farFrom.value = oldBody.radius + 3500;
        old.halo.farTo.value = oldBody.radius + 5800;
    }
    leaveHome(true);
    site = next;
    siteBody = activeBody;
    site.group.position.set(0, 0, 0);
    site.halo.farFrom.value = 1e9;
    site.halo.farTo.value = 1e9 + 1;
    site.group.visible = mode !== "deep"; // (a site finished while you are already out between the stars stays hidden)
    scene.add(site.group);
    if (!activeBody.giant) codex.add(worldEntry(system, activeBody, siteTotals()));
}
// Every world and the star of the system you are in (system-view.js). Terrain
// tiles for every system are built by one shared pool of background threads.
const streamer = createTerrainStreamer();
let systemView = createSystemView(scene, system, streamer, { coarse: lite });
// Asteroid belts, Trojan swarms and comets of this system (space-objects.mjs).
let spaceView = createSpaceObjectsView(scene, system);
// Sites built before the view existed: light them from space where their lights really are.
for (const [id, built] of siteCache) { const b = system.bodies.find((x) => x.id === id); if (b && built.structures?.nightLights) systemView.useSiteLights(b, built.structures.nightLights); }
let edge = systemEdge(system); // beyond this (metres from the star) is interstellar space
// The real stars of the galaxy, seen from where you are (deep-space.js).
const sky = createSky(scene, renderer);
const nearStar = createNearStar(scene);
const streaks = createDriveStreaks(scene, 340);
// The star drive's streaks fade in as it engages and out as it lets go (0..1), rather than switching.
let driveFade = 0,
    drivePower = 0;
// Dust and ice motes rushing past near worlds: they move at your real speed, so
// going faster is something you see, not just a number.
const spaceDust = createDriveStreaks(scene, 80, { R: 80, L: 300, min: 10, color: 0xe4f2ec });
const worldDots = createWorldDots(scene);
const starPoint = (star) => [star.x, star.y, star.z];
sky.update(starPoint(currentStar), camera, currentStar.id);
// Moves every body to where it is now. Near a world you travel with it, so
// nothing changes locally; in free space and on cruise the ship holds its
// course through the system while the world you left moves on.
function advanceOrbits() {
    orbitTime = orbitClock();
    positions = systemPositions(system, orbitTime);
    const origin = positionOf(activeBody),
        shift = origin.clone().sub(worldOrigin);
    if (mode === "space" || mode === "transit" || (dock?.ark && atStation())) {
        shipPosition.sub(shift);
        camera.position.sub(shift);
    }
    if (holding && mode === "space") {
        const now = positionOf(holding.body), moved = now.clone().sub(holding.last);
        shipPosition.add(moved);
        camera.position.add(moved);
        holding.last.copy(now);
    } else holding = null;
    worldOrigin.copy(origin);
    positionSystem();
}
function positionSystem() {
    systemView.place(positions, worldOrigin);
    if (mode !== "deep") sun.position.copy(systemView.starMesh.position);
}


const kestrel = createKestrel();
// Your ship: the Kestrel, until the Petrel upgrade replaces it with its own design.
const shipName = () => (codex.unlocked.has("petrel") ? "Petrel" : "Kestrel");
const { ship, shipShadow, dust } = kestrel;
ship.traverse((o) => { if (o.isMesh) o.castShadow = true; });
if (codex.unlocked.has("petrel")) setShipDesign(kestrel, "petrel");
scene.add(ship, shipShadow, dust);

let verticalSpeed = 0,
    flightPitch = 0,
    bankAngle = 0,
    turnVelocity = 0,
    maneuver = null;
// Mouse / drag steering in flight: movement is queued here and eased into the
// ship's heading over the next frames, so mice and trackpads both turn smoothly.
let steerYaw = 0,
    steerPitch = 0,
    aimPitch = 0, // nose angle held in atmospheric flight, set with the mouse
    strafeSpeed = 0, // sideways thrust near worlds (A/D in space)
    lastMouseSteer = -1e9,
    lastFreeLook = -1e9,
    invertPitch = false;
// Speed feel and orbit transitions (camera).
let spaceBlend = 0, // 0 = flying near a world's surface, 1 = in space; eases between the two
    rushLevel = 0, // 0..1, how fast you are going for the camera
    reveal = 0, // camera pull-back as you break orbit
    exitGlide = 0, // the climb carrying on for a moment after breaking orbit
    exitClimb = 0,
    lastLocal = null,
    lastBodyId = null,
    orbitEntry = 0, // 1 right after dropping into orbit from space, fading to 0 over ~3 s
    camBack = null, // the camera's (smoothed) direction behind and ahead of the ship
    camAhead = null;
const flowVel = new THREE.Vector3(); // ship velocity relative to the world it is near
// The ship's velocity this frame, unsmoothed: the camera is carried along by exactly
// this, so how it frames the ship never depends on speed.
const shipVel = new THREE.Vector3();
try { invertPitch = localStorage.getItem("elsewhere.invertPitch") === "1"; } catch {}
{
    const box = document.getElementById("invertPitch");
    if (box) {
        box.checked = invertPitch;
        box.addEventListener("change", () => {
            invertPitch = box.checked;
            try { localStorage.setItem("elsewhere.invertPitch", invertPitch ? "1" : "0"); } catch {}
        });
    }
}

let started = false,
    mode = "flight",
    speed = 0,
    autoApproach = false,
    stage = 0,
    discovered = false,
    completed = false;
buildSite();
positionSystem();
// Survey records are saved per system.
let saveKey,
    records = new Set(),
    visited = new Set(),
    catalogue = {}, // plant species catalogued per world: { bodyId: [speciesId] }
    bestiary = {}, // animal species observed per world: { bodyId: [speciesId] }
    traces = {}, // worlds where you have seen what an intelligent species built: { bodyId: tier name }
    strata = {}; // rock and ice formations recorded per world: { bodyId: [formationId] }
function loadSurvey(arrivedAt) {
    saveKey = `elsewhere-system-${system.seed}`;
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(saveKey) || "{}");
    } catch {}
    const known = (id) => system.bodies.some((b) => b.id === id);
    records = new Set((saved.records || []).filter(known));
    visited = new Set([...(arrivedAt ? [arrivedAt.id] : []), ...(saved.visited || []).filter(known)]);
    catalogue = saved.flora || {};
    bestiary = saved.fauna || {};
    traces = saved.traces || {};
    strata = saved.geology || {};
}
loadSurvey(activeBody);
discovered = records.has(activeBody.id);
let selectedBody = null, // the world you chose as your destination, if any
    travel = null;
const spaceUp = Y.clone();
function saveSurvey() {
    try {
        localStorage.setItem(
            saveKey,
            JSON.stringify({
                records: [...records],
                visited: [...visited],
                flora: catalogue,
                fauna: bestiary,
                traces,
                geology: strata,
            }),
        );
    } catch {}
}
function setDiscoveryText(body) {
    $("discoveryEyebrow").textContent =
        `FIELD NOTE / ${body.name.toUpperCase()}`;
    $("discoveryTitle").textContent = body.title;
    $("discoveryText").textContent = body.note;
    $("discoveryQuote").textContent = body.message;
}

$("logBtn").hidden = !discovered;
$("logBtn").onclick = () => {
    keys.clear();
    setDiscoveryText(activeBody);
    $("discovery").showModal();
};
let shipPosition = landingNormal.clone().multiplyScalar(RADIUS + 150),
    shipForward = tangent(
        signalNormal.clone().sub(landingNormal),
        landingNormal,
    );
let playerNormal = landingNormal.clone(),
    playerForward = vec(0, 0, -1),
    lookPitch = 0;
let orbitYaw = 0,
    orbitPitch = 0.18;
let toastTime = 0,
    animationTime = 0,
    previousTime = performance.now(),
    bob = 0;
const keys = new Set();
const clockBasis = new THREE.Matrix4();
function orientShip(dt = 1) {
    const up = shipPosition.clone().normalize();
    shipForward = tangent(shipForward, up);
    const right = shipForward.clone().cross(up).normalize();
    clockBasis.makeBasis(right, up, shipForward.clone().negate());
    const attitude = new THREE.Quaternion().setFromRotationMatrix(clockBasis);
    attitude.multiply(
        new THREE.Quaternion().setFromAxisAngle(
            vec(1, 0, 0),
            flightPitch + clamp(verticalSpeed * 0.004, -0.1, 0.1),
        ),
    );
    attitude.multiply(
        new THREE.Quaternion().setFromAxisAngle(vec(0, 0, 1), bankAngle),
    );
    // Just after entering orbit the ship rolls gently to the world's horizon
    // instead of snapping to it.
    ship.quaternion.slerp(attitude, 1 - Math.exp(-dt * (9 - 8.2 * smoothstep(orbitEntry))));
    ship.position.copy(shipPosition);
    shipShadow.position.copy(surfacePoint(up, 0.13));
    shipShadow.quaternion.setFromUnitVectors(vec(0, 0, 1), up);
    shipShadow.material.opacity = clamp(
        0.3 - (shipPosition.length() - surfaceRadius(up)) * 0.007,
        0,
        0.25,
    ) * (shadows.enabled ? 0 : 1); // (no blob where the star casts the ship's real shadow; it stays for ?shadows=0)
}
function altitude() {
    const n = shipPosition.clone().normalize();
    return shipPosition.length() - surfaceRadius(n) - 1.7;
}
function distanceToSignal() {
    return (
        Math.acos(
            clamp(
                (mode === "walk"
                    ? playerNormal
                    : shipPosition.clone().normalize()
                ).dot(signalNormal),
                -1,
                1,
            ),
        ) * RADIUS
    );
}
function toast(message, seconds = 4) {
    $("toast").textContent = message;
    $("toast").classList.add("visible");
    toastTime = seconds;
}
function setStage(next) {
    stage = next;
    const entries = [
        ["Follow the signal", "Something is transmitting from the surface."],
        [
            "Investigate the surface",
            "Leave the ship and follow the signal on foot.",
        ],
        [`Return to the ${shipName()}`, "Signal recorded. Your ship is waiting nearby."],
        [
            "A beginning, not an ending",
            `Signal recorded. Open the star map (M) for another world, or zoom out on it (G) to jump to another star.`,
        ],
    ];
    // The objective panel now shows the next upgrade (upgrades-ui.js); the signal
    // still guides you through the waypoint and the action button.
    void entries;
}
function modalOpen() {
    return $("help").open || $("discovery").open || $("starMap").open || upgradeScreen.isOpen || contactUI.isOpen || codexUI.isOpen;
}
// Dev: ?find=hole (or nebula, rogue, dwarf) starts in deep space beside the nearest find of that kind.
function startAtFind(kind) {
    const c = starPoint(currentStar).map(Math.floor);
    let f = null;
    for (let r = 1; !f && r < 40; r++) for (let x = -r; x <= r && !f; x++) for (let y = -r; y <= r && !f; y++) for (let z = -r; z <= r && !f; z++) {
        if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) !== r) continue;
        const g = findInCell(c[0] + x, c[1] + y, c[2] + z);
        if (g && g.kind === kind) f = g;
    }
    if (!f) return void toast(`No ${kind} found nearby.`);
    enterDeep(new THREE.Vector3(1, 0, 0));
    course = null; autopilot = false; throttle = 0;
    const away = f.kind === "nebula" ? f.size * 1.6 : f.size + f.stop * 3;
    galactic = [f.x + away * 0.8, f.y + away * 0.36, f.z + away * 0.48];
    shipForward.copy(toScene(findOffset(f)).normalize());
    deepTarget = f; deepDetour = false;
    deepNear = findsNear(galactic, DETECT_LY + 0.25);
    sky.update(galactic, camera);
}
// A patrol ship of a spacefaring people meets you when you arrive (patrol.js); ?patrol forces one.
let patrol = null;
function setupPatrol() {
    patrol?.dispose();
    patrol = null;
    if (offChart && !params.has("patrol")) return;
    try {
        const civ = patrolFor(system, currentStar.id, { force: params.has("patrol") });
        if (civ) patrol = createPatrol(THREE, scene, civ, $("hud"), { starId: currentStar.id, name: system.name });
    } catch (e) { console.warn("patrol", e); }
}
function start() {
    if (started) return;
    started = true;
    setupPatrol();
    if (params.get("find")) setTimeout(() => startAtFind(params.get("find")), 50);
    $("hud").inert = false;
    $("intro").inert = true;
    $("intro").classList.add("hidden");
    document.body.classList.add("playing");
    toast(
        "Welcome to " +
            system.name +
            ". Press M to choose a world, or explore " +
            activeBody.name +
            ".",
    );
    // ?spot (quality.mjs): skip the descent. The ship stands on the landing pad and you
    // are on foot beside it, facing the signal, some metres on toward it if asked.
    if (GIANT_TEST && mode === "flight") { // ?giant (quality.mjs): straight to the giant
        const g = system.bodies.find((b) => b.giant && (GIANT_TEST === "1" || b.id === GIANT_TEST));
        if (g) { selectedBody = g; beginCruise(); }
    }
    if (SPOT !== null && mode === "flight" && !activeBody.giant) {
        shipPosition.copy(landingNormal).multiplyScalar(surfaceRadius(landingNormal) + 1.7);
        speed = 0; verticalSpeed = 0; autoApproach = false;
        mode = "landed";
        interact();
        if (mode === "walk" && SPOT > 0) {
            playerNormal = playerNormal.clone().multiplyScalar(RADIUS).addScaledVector(playerForward, SPOT).normalize();
            const ahead = tangent(signalNormal.clone().sub(playerNormal), playerNormal);
            if (ahead.lengthSq() > 0.1) playerForward = ahead;
        }
        // ?at=town | port: stand looking at the capital's centre or its spaceport.
        const goal = SPOT_AT === "port" ? site?.structures?.spaceportAt : SPOT_AT === "town" ? site?.structures?.sites?.[0] : null;
        if (mode === "walk" && goal) {
            const from = tangent(playerNormal.clone().sub(goal), goal).normalize();
            playerNormal = goal.clone().multiplyScalar(RADIUS).addScaledVector(from, SPOT_BACK).normalize();
            playerForward = tangent(goal.clone().sub(playerNormal), playerNormal);
            if (playerForward.lengthSq() < 1e-9) playerForward = from.negate();
        }
    }
}
// "Find landing site": the approach assist flies to a place worth landing at and stops just
// above it. Each press picks the next place, nearest first: the signal site, and every town,
// city and village of the world's builders (towns are built in detail wherever you go).
// Manual controls cancel it.
let approachSpeed = 0, // the assist's ground speed (m/s)
    approachTo = null, // { n, name, note } where the assist is flying
    poiCache = { id: null, list: [] },
    poiIndex = -1,
    poiAt = 0;
const PLACE_WORDS = { camp: "Camp", village: "Village", town: "Town", city: "City", metropolis: "Metropolis", capital: "Capital", megacity: "Megacity", colony: "Colony" };
function placesOfInterest() {
    if (poiCache.id === activeBody.id) return poiCache.list;
    const list = [{ n: landingNormal.clone(), name: "the signal site", note: "" }];
    try {
        const t = terrainFor(activeBody), civ = site?.structures?.civ || civilizationOf(activeBody);
        if (civ) {
            const net = networkFor(activeBody, civ, t, { colony: !!civ.colony }), sea = civ.underwater || civ.species?.aquatic;
            const P = (v) => ({ x: v.x, y: v.y, z: v.z });
            const level = (v) => { if (t.isLiquid(P(v))) return false; const h = t.surface(P(v)); for (let j = 0; j < 6; j++) { const q = v.clone().add(tangent(vec(Math.cos(j), 0.3, Math.sin(j)), v).multiplyScalar(8 / RADIUS)).normalize(); if (t.isLiquid(P(q)) || Math.abs(t.surface(P(q)) - h) > 3.5) return false; } return true; };
            const who = civ.species?.name ? plural(civ.species.name) : "builders";
            for (const st of net.settlements) {
                const c = vec(...st.n).normalize();
                // Set down just outside it (sea builders: on the nearest shore), on open level ground.
                let spot = null;
                for (let d = st.radius + 18; !spot && d < st.radius + (sea ? 420 : 140); d += 12)
                    for (let j = 0; j < 12 && !spot; j++) { const q = c.clone().add(tangent(vec(Math.cos(j * 0.52 + d), 0.2, Math.sin(j * 0.52 + d)), c).multiplyScalar(d / RADIUS)).normalize(); if (level(q)) spot = q; }
                list.push({
                    n: spot || c, name: `${civ.spaceborne ? "the empty " : "a "}${(PLACE_WORDS[st.kind] || "Town").toLowerCase()} of the ${who}`.replace("a capital", "the capital"),
                    note: sea ? " It stands on the sea floor offshore." : civ.spaceborne ? " Its builders left long ago." : "",
                });
            }
        }
    } catch (e) { console.warn("places", e); }
    poiCache = { id: activeBody.id, list };
    return list;
}
function approach() {
    if (mode !== "flight") return;
    const up = shipPosition.clone().normalize(), now = performance.now();
    const far = (p) => p.n.angleTo(up) * RADIUS;
    // Pressing again while it flies (or soon after) moves on to the next place; otherwise start from the nearest.
    const list = placesOfInterest().slice().sort((a, b) => far(a) - far(b)).filter((p, i) => i < 10);
    const fresh = !autoApproach && now - poiAt > 8000;
    let pick = null;
    for (let k = 0; k < list.length && !pick; k++) {
        poiIndex = fresh && k === 0 ? 0 : (poiIndex + 1) % list.length;
        if (far(list[poiIndex]) > 60 || list.length === 1) pick = list[poiIndex];
    }
    if (!pick) return;
    poiAt = now;
    approachTo = pick;
    if (!autoApproach) approachSpeed = Math.max(20, Math.abs(speed));
    autoApproach = true;
    const d = far(pick);
    toast(`Approach assist: ${pick.name}, ${d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`} away.${list.length > 1 ? " Press again for the next place." : ""} Manual controls cancel it.`, 5);
}
function act() {
    if (!started || modalOpen()) return;
    if (mode === "deep") {
        if (course || deepTarget) toggleAutopilot();
        else openGalaxy();
        return;
    }
    if ((mode === "flight" || mode === "space") && tryDock()) return;
    if (mode === "docked") return undock();
    if (atStation()) return;
    if (mode === "space") {
        cruiseOrAutopilot();
        return;
    }
    if (mode === "transit") {
        cancelCruise();
        return;
    }
    if (mode === "flight") {
        if (altitude() > 32) {
            toast("Descend below 32 m with F, or use Find landing site.");
            return;
        }
        if (Math.abs(speed) > 18) {
            toast("Slow below 18 m/s. Release thrust or hold X to brake.");
            return;
        }
        // The ground under the ship must not be steeper than about 24 degrees, measured
        // 6 m either side along and across the ship (the old check compared heights over
        // a span that grew with the world's size: on big worlds almost every hill failed).
        const n = shipPosition.clone().normalize(),
            side = shipForward.clone().cross(n).normalize(),
            ahead = n.clone().cross(side).normalize(),
            d = 6 / RADIUS;
        const rise = (dir) => Math.abs(heightAt(n.clone().addScaledVector(dir, d).normalize()) - heightAt(n.clone().addScaledVector(dir, -d).normalize())) / 12;
        if (Math.max(rise(side), rise(ahead)) > 0.45) {
            toast("Terrain too steep. Move toward flatter ground.");
            return;
        }
        const wet = terrainFor(activeBody).isLiquid(n);
        if (wet && !floatsHere()) {
            toast(
                terrainFor(activeBody).liquid === "lava"
                    ? "That is molten rock. Find solid ground to land."
                    : codex.unlocked.has("petrel")
                      ? "The Petrel floats only on water; this sea is something else. Find solid ground."
                      : "Kestrel cannot land on water. Find solid ground.",
            );
            return;
        }
        afloat = wet;
        // The world's own landing pad is always allowed: only picking your own spot by lava needs Heat plating.
        if (!wet && !landsBesideLava(codex.unlocked) && n.angleTo(landingNormal) * RADIUS > 40 && nearLava(n)) {
            toast("Too close to lava: the hull would overheat. Move away from it, or install Heat plating to land here.", 5);
            return;
        }
        autoApproach = false;
        keys.clear();
        maneuver = {
            time: 0,
            duration: 3.8,
            start: shipPosition.clone(),
            normal: n.clone(),
            height: shipPosition.length() - surfaceRadius(n) - 1.7,
        };
        mode = "landing";
        toast("Landing sequence. Gear down; settling onto the surface.");
    } else if (mode === "landed") {
        keys.clear();
        speed = 0;
        verticalSpeed = 0;
        maneuver = {
            time: 0,
            duration: 3.6,
            start: shipPosition.clone(),
            normal: shipPosition.clone().normalize(),
        };
        mode = "takeoff";
        toast("Lift engines charging. Clearing the surface.");
    } else if (mode === "walk" && indoor) {
        const c = householdInReach();
        if (c) talkTo(civOfSpecies(indoor.native) || stationCiv(), { where: "IN THEIR HOME", waited: footTime, partner: { deck: indoor.room, i: c.i } });
        else if (nearHomeDoor()) leaveHome();
    } else if (mode === "walk" && !scanTarget && doorInReach()) {
        enterHome(doorInReach());
    } else if (mode === "walk") {
        const shipDistance =
            playerPos().distanceTo(shipPosition);
        if (distanceToSignal() < 9 && !discovered) {
            discover();
        } else if (scanTarget?.known && scanTarget.kind === "fauna" && scanTarget.creature?.young && civOfSpecies(scanTarget.ref)) {
            herdOf(scanTarget.ref)?.gesture(scanTarget.creature, "hop");
            toast(`A young ${scanTarget.ref.name} stares up at you, hops, and runs back to the grown-ups.`, 4);
            voices.say(scanTarget.ref, { mood: "happy", young: true });
        } else if (scanTarget?.known && scanTarget.kind === "fauna" && civOfSpecies(scanTarget.ref)) {
            talkTo(civOfSpecies(scanTarget.ref), { where: "IN THEIR TOWN", waited: footTime, partner: scanTarget.creature ? { herd: herdOf(scanTarget.ref), creature: scanTarget.creature } : null }); // one of the builders: greet them
        } else if (scanTarget?.known) {
            showScanCard(scanTarget, null);
        } else if (scanTarget) {
            // Something new: holding E scans it (updateScan).
        } else if (shipDistance < 9) {
            speed = 0;
            verticalSpeed = 0;
            swimming = false;
            if (shipSubmerged) { // the Petrel waited under water
                shipSubmerged = false;
                mode = "dive";
                toast("Back aboard the Petrel, submerged. Hold R at the surface to fly out.");
                return;
            }
            mode = "landed";
            toast(`Back aboard the ${shipName()}. Press L to lift off.`);
        } else if (distanceToSignal() < 9) {
            discover();
        }
    }
}
// Petrel: sets down and floats on seas of liquid water (not methane, ammonia or sulfur).
let afloat = false;
const floatsHere = () => {
    const t = terrainFor(activeBody);
    return codex.unlocked.has("petrel") && t.liquid === "water" && (t.solvent ?? "water") === "water";
};
// Lava within ~25 m of a point on the ground (Heat plating lets the Kestrel land there anyway).
function nearLava(n) {
    const t = terrainFor(activeBody);
    if (t.liquid !== "lava") return false;
    const a = tangent(Math.abs(n.y) < 0.9 ? vec(0, 1, 0) : vec(1, 0, 0), n), b = n.clone().cross(a);
    for (const d of [8, 16, 25])
        for (let i = 0; i < 12; i++) {
            const k = (i / 12) * Math.PI * 2;
            const p = n.clone().addScaledVector(a, (Math.cos(k) * d) / RADIUS).addScaledVector(b, (Math.sin(k) * d) / RADIUS).normalize();
            if (t.isLiquid(p)) return true;
        }
    return false;
}
function interact() {
    if (!started || modalOpen()) return;
    if (mode === "dive") return diveAct();
    if (mode === "space" && scanTarget?.cloud) { if (scanTarget.known) showScanCard(scanTarget, null); return; }
    if (mode === "docked") return leaveShipOnDeck();
    if (mode === "deck") {
        const crew = crewInReach();
        if (crew) talkTo(dock.civ, { where: dock.ark ? `ON ${dock.ark.name.toUpperCase()}` : "ON THEIR STATION", waited: deckTime, stance: dock.deck.stance, partner: { deck: dock.deck, i: crew.i } });
        else if (nearShipOnDeck()) { mode = "docked"; speed = 0; toast(`Back aboard the ${shipName()}. Press L to undock.`); }
        return;
    }
    if (mode === "landed" && afloat) {
        toast(canDiveHere() ? "You are afloat. Press F to dive, or take off and land on shore to go on foot." : "You are afloat: the water is too deep to walk. Take off and land on shore to go on foot.", 4);
        return;
    }
    if (mode === "landed") {
        const up = shipPosition.clone().normalize(),
            right = shipForward.clone().cross(up).normalize();
        playerNormal = shipPosition
            .clone()
            .addScaledVector(right, 5.5)
            .addScaledVector(shipForward, 2)
            .normalize();
        playerForward = tangent(
            signalNormal.clone().sub(playerNormal),
            playerNormal,
        );
        if (playerForward.lengthSq() < 0.1)
            playerForward = tangent(shipForward, playerNormal);
        lookPitch = 0;
        mode = "walk";
        if (stage === 0) setStage(1);
        footTime = 0;
        jumpHeight = 0;
        jumpVelocity = 0;
    } else if (mode === "walk") act();
}
function discover() {
    discovered = true;
    records.add(activeBody.id);
    saveSurvey();
    const noteText = record(fieldNoteEntry(system, activeBody));
    if (noteText) toast(noteText.trim(), 8);
    setDiscoveryText(activeBody);
    $("logBtn").hidden = false;
    setStage(2);
    keys.clear();
    $("discovery").showModal();
}
$("startBtn").onclick = start;
// Enter starts from the title screen too.
addEventListener("keydown", (e) => {
    if (!started && e.key === "Enter" && !e.repeat && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !modalOpen()) { e.preventDefault(); start(); }
});
$("approachBtn").onclick = approach;
$("actionBtn").onclick = () => (mode === "landed" || mode === "dive" || mode === "docked" || mode === "deck" ? interact() : act());
$("helpBtn").onclick = () => {
    keys.clear();
    $("help").showModal();
};
$("closeHelp").onclick = () => $("help").close();
$("closeDiscovery").onclick = () => $("discovery").close();
$("resetBtn").onclick = () => {
    try {
        localStorage.removeItem(saveKey);
    } catch {}
    location.reload();
};
const canvas = $("world");
const input = setupInput({
    keys,
    canvas,
    started: () => started,
    mode: () => mode,
    modalOpen,
    on: {
        map: () => (starMap.isOpen ? starMap.close() : openMap()),
        galaxy: () => (starMap.isOpen ? starMap.close() : openGalaxy()),
        cruise: () => cruiseOrAutopilot(),
        clear: () => clearTarget(),
        help: () => {
            hudQuiet.wakeAll();
            if ($("help").open) $("help").close();
            else {
                keys.clear();
                $("help").showModal();
            }
        },
        act,
        interact,
        look(dx, dy, k) {
            if (mode === "walk" && indoor) {
                indoor.yaw += dx * 0.004 * k;
                lookPitch = clamp(lookPitch - dy * 0.003 * k, -1.15, 1.1);
            } else if (mode === "deck") {
                const fine = camera.fov / 70;
                deckYaw += dx * 0.004 * k * fine;
                lookPitch = clamp(lookPitch - dy * 0.003 * k * fine, -1.15, 1.1);
            } else if (mode === "walk") {
                const fine = camera.fov / 70; // zoomed in (field glasses), the view turns more finely
                playerForward.applyAxisAngle(playerNormal, -dx * 0.004 * k * fine);
                lookPitch = clamp(lookPitch - dy * 0.003 * k * fine, -1.15, 1.1);
            } else if (mouseSteers()) {
                steerYaw -= dx * 0.0032 * k;
                steerPitch -= dy * 0.0032 * k * (invertPitch ? -1 : 1);
                lastMouseSteer = performance.now();
            } else {
                orbitYaw -= dx * 0.005 * k;
                orbitPitch = clamp(orbitPitch + dy * 0.004 * k, -0.25, 1.15);
                lastFreeLook = performance.now();
                steerYaw = steerPitch = 0;
            }
        },
        manualControl: () => (autoApproach = false),
        toast,
        pick: (x, y) => pickAt(x, y),
        cycle: () => cycleTarget(),
        upgrades: () => { if (!$("help").open && !$("discovery").open) upgradeScreen.toggle(); },
        codex: () => { if (!$("help").open && !$("discovery").open && !upgradeScreen.isOpen && !contactUI.isOpen) codexUI.toggle(); },
    },
});
document.addEventListener("visibilitychange", () => (previousTime = performance.now()));


const engine = createEngineSound({
    button: $("soundBtn"),
    label: $("soundLabel"),
    onError: () => toast("Audio is unavailable in this browser."),
});
const voices = createVoices(engine.context); // alien voices (voices.js), only with sound on


function refreshWorldLabels() {
    $("worldName").textContent = activeBody.name.toUpperCase();
    $("worldType").textContent =
        activeBody.type + " · " + system.name + " system";
    $("seedInput").value = system.seed;
    $("introDescription").textContent =
        `${system.star.name} · class ${system.star.physics.spectralClass} star · ${system.bodies.length} worlds`;
    $("systemCoordinates").textContent = offChart
        ? `${system.name.toUpperCase()} SYSTEM / OFF-CHART SEED ${system.seed}`
        : `${system.name.toUpperCase()} SYSTEM / ${(Math.hypot(currentStar.x, currentStar.y) / 1000).toFixed(1)}K LY FROM THE CORE`;
}
let lastSwitch = -10; // animationTime of the last change of world (see the neighbour check in flight)
function switchWorld(body, globalPosition) {
    // The ship keeps its momentum and heading across the change of world, so arriving
    // (or crossing from a moon to its planet) is seamless rather than a dead stop.
    const oldUp = mode === "flight" ? shipPosition.clone().normalize() : spaceUp.clone();
    const velocity = shipForward.clone().multiplyScalar(speed * (mode === "flight" ? Math.cos(flightPitch) : 1)).addScaledVector(oldUp, verticalSpeed);
    lastSwitch = animationTime;
    const oldOrigin = worldOrigin.clone();
    activeBody = body;
    RADIUS = body.radius;
    worldOrigin = positionOf(body);
    signalNormal = vec(...terrainFor(body).site);
    landingNormal = vec(...terrainFor(body).landing);
    buildSite();
    positionSystem();
    shipPosition.copy(globalPosition).sub(worldOrigin);
    camera.position.add(oldOrigin).sub(worldOrigin);
    const arrivalNormal =
        shipPosition.lengthSq() > 0.01
            ? shipPosition.clone().normalize()
            : signalNormal.clone();
    const safeRadius = surfaceRadius(arrivalNormal) + 4;
    if (shipPosition.length() < safeRadius)
        shipPosition.copy(arrivalNormal.multiplyScalar(safeRadius));
    const n = shipPosition.clone().normalize();
    const along = velocity.clone().addScaledVector(n, -velocity.dot(n));
    // From space, keep the way the nose points (heading and pitch), so the ship
    // doesn't swing round as it meets the world.
    const fromSpace = mode === "space";
    const nose = shipForward.clone(),
        noseAlong = nose.clone().addScaledVector(n, -nose.dot(n));
    if (fromSpace && noseAlong.length() > 0.15) shipForward = noseAlong.clone().normalize();
    else if (along.length() > 2) shipForward = along.clone().normalize();
    else {
        shipForward = tangent(shipForward.clone(), n);
        if (shipForward.lengthSq() < 0.01) shipForward = tangent(signalNormal.clone().sub(n), n);
        if (shipForward.lengthSq() < 0.01) shipForward = tangent(vec(0, 0, -1), n);
    }
    // Arriving from space keeps most of your momentum and the angle you came in
    // at; flight drag then eases you down to flying speed and the nose levels out.
    speed = fromSpace ? clamp(along.dot(shipForward), -100, 320) : Math.min(along.length(), 320);
    verticalSpeed = clamp(velocity.dot(n), -120, 120);
    flightPitch = fromSpace
        ? clamp(Math.asin(clamp(nose.dot(n), -1, 1)), -1.35, 1.35)
        : clamp(Math.atan2(velocity.dot(n), Math.max(along.length(), 1)), -0.65, 0.65);
    aimPitch = clamp(flightPitch, -0.65, 0.65);
    if (fromSpace) orbitEntry = 1;
    lastMouseSteer = Math.min(lastMouseSteer, performance.now() - 1000); // levels out soon
    exitGlide = 0;
    turnVelocity = 0;
    autoApproach = false;
    mode = "flight";
    kestrel.gear = 0;
    discovered = records.has(body.id);
    if (target?.id === body.id) target = null; // arrived
    if (selectedBody?.id === body.id) selectedBody = null;
    completed = discovered;
    setStage(discovered ? 3 : 0);
    $("logBtn").hidden = !discovered;
    visited.add(body.id);
    const worldNote = record(worldEntry(system, body));
    saveSurvey();
    refreshWorldLabels();
    orientShip(0); // place the ship; its attitude turns to the new "up" smoothly over the next frames
    toast(
        `Arrived at ${body.name}. Fly down, or use Find landing site.${worldNote}`,
    );
}
function orientSpace(dt) {
    // Keep "up" at right angles to the nose by carrying the previous up along with
    // it. Rebuilding it from a fixed axis flipped the ship whenever the nose pointed
    // straight up or down (short cruises between a moon and its planet).
    spaceUp.addScaledVector(shipForward, -spaceUp.dot(shipForward));
    if (spaceUp.lengthSq() < 1e-6) spaceUp.copy(vec(0, 1, 0).applyQuaternion(ship.quaternion)).addScaledVector(shipForward, -vec(0, 1, 0).applyQuaternion(ship.quaternion).dot(shipForward));
    if (spaceUp.lengthSq() < 1e-6) spaceUp.copy(Math.abs(shipForward.y) < 0.9 ? Y : vec(1, 0, 0)).addScaledVector(shipForward, -(Math.abs(shipForward.y) < 0.9 ? shipForward.y : shipForward.x));
    spaceUp.normalize();
    const right = shipForward.clone().cross(spaceUp).normalize();
    clockBasis.makeBasis(right, spaceUp, shipForward.clone().negate());
    const attitude = new THREE.Quaternion().setFromRotationMatrix(clockBasis);
    attitude.multiply(
        new THREE.Quaternion().setFromAxisAngle(vec(0, 0, 1), bankAngle),
    );
    ship.quaternion.slerp(attitude, 1 - Math.exp(-dt * 6));
    ship.position.copy(shipPosition);
    shipShadow.visible = false;
}
// Closest approach to a giant's cloud tops: 250 m, more on the biggest giants.
const giantClearance = (body) => Math.max(250, body.radius * 0.02);
// Cloud diving (the Cloud diver, upgrades.mjs). With it the ship may go below a giant's
// cloud tops, as far as its crush depth. Coming down you pass through the cloud deck (thick
// cloud for a few tens of metres), then fly in murky air in the giant's own colours that
// darkens and thickens with depth. The wind there blows along the giant's bands, one way in
// one band and the other way in the next, harder the deeper you go, and carries the ship
// and the loose cloud around it. Lightning lights the murk on stormy giants.
const crushDepth = (body) => { const d = cloudDepth(codex.unlocked) || (DIVE_TEST ? 1500 : 0); return d ? Math.min(d, body.radius * 0.06) : 0; };
let bumpShake = 0; // a jolt from hitting a ring rock, fading
const dive = { body: null, k: 0, depth: 0, flash: 0, told: 0, wind: 0, puffs: null, off: [], last: null };
const DIVE_AIR = new THREE.Color(), DIVE_DEEP = new THREE.Color(), DIVE_FLASH = new THREE.Color(0xdfe8ff), DIVE_TINT = new THREE.Color(), DIVE_TOP = new THREE.Color(), DIVE_LOW = new THREE.Color();
// Soft cloud: camera-facing lumps with ragged edges, lit from the sun's side and from above,
// fading into the murk with distance (their own fog, so they match the dome) and out as the
// ship passes through them (no hard edge across the view).
function cloudPuffMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uMurk: { value: new THREE.Color() }, uDensity: { value: 0.01 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uLight: { value: 1 }, uFlash: { value: 0 } },
        vertexShader: `varying vec2 vUv; varying vec3 vCol; varying float vDist, vSize, vSeed; varying vec3 vRight, vUpV;
void main() {
  vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float s = length(instanceMatrix[0].xyz);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = c + (right * position.x + up * position.y) * s;
  vUv = uv; vSize = s; vDist = distance(cameraPosition, c); vRight = right; vUpV = up;
  vSeed = fract(sin(dot(c.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vCol = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
        fragmentShader: `uniform vec3 uMurk, uSun, uUp; uniform float uDensity, uLight, uFlash;
varying vec2 vUv; varying vec3 vCol; varying float vDist, vSize, vSeed; varying vec3 vRight, vUpV;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 q = vUv - 0.5;
  float n = n2(q * 3.2 + vSeed * 17.0) * 0.6 + n2(q * 7.5 + vSeed * 5.0) * 0.4;
  float r = length(q) * 2.0 + (n - 0.5) * 0.75;
  float a = smoothstep(1.0, 0.15, r);
  if (a < 0.01) discard;
  // Lit on the side toward the sun and from above, shadowed beneath and inside.
  vec3 sideDir = normalize(vRight * q.x + vUpV * q.y + 1e-4);
  float lit = 0.55 + 0.35 * max(dot(sideDir, uSun), 0.0) + 0.25 * max(dot(sideDir, uUp), 0.0) - 0.25 * (1.0 - r) * n;
  vec3 col = vCol * lit * uLight + vec3(0.85, 0.9, 1.0) * uFlash * 0.6;
  float f = 1.0 - exp(-uDensity * uDensity * vDist * vDist);
  col = mix(col, uMurk, f);
  a *= 0.62 * smoothstep(vSize * 0.15, vSize * 0.55 + 6.0, vDist) * (1.0 - 0.85 * f);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`,
        transparent: true, depthWrite: false, fog: false,
    });
}
function updateCloudDive(dt, global) {
    let body = null, h = Infinity;
    for (const b of system.bodies) if (b.giant) { const hb = global.distanceTo(positionOf(b)) - b.radius; if (hb < h) { h = hb; body = b; } }
    const limit = body ? crushDepth(body) : 0;
    dive.k = limit ? clamp(1 - (h + 20) / 260, 0, 1) : 0; // 0 from 240 m above the tops, 1 just under them
    dive.flash = Math.max(0, dive.flash - dt * 6);
    if (!dive.k) { dive.body = null; dive.told = 0; dive.last = null; if (dive.puffs) dive.puffs.visible = false; hideCloudLife(); return; }
    dive.body = body; dive.depth = -h;
    const centre = positionOf(body), out = global.clone().sub(centre).normalize(), deep = clamp(-h / limit, 0, 1), gas = body.physics.kind === "gas";
    // The wind: along the bands (round the giant's axis), by the band you are in.
    const axis = vec(-Math.sin(body.tilt || 0), Math.cos(body.tilt || 0), 0), lat = Math.asin(clamp(out.dot(axis), -1, 1));
    const east = axis.clone().cross(out); if (east.lengthSq() > 1e-6) east.normalize();
    dive.wind = clamp(Math.sin(lat * body.bands * 2 + (body.seed % 1000) / 159) * 2.5, -1, 1) * (8 + 26 * deep) * dive.k * (gas ? 1 : 0.5);
    shipPosition.addScaledVector(east, dive.wind * dt);
    // Buffeting, and the horizon steadies to the giant's own up and down.
    const rough = (0.3 + deep) * dive.k * Math.min(1.5, body.turbulence ?? 1);
    verticalSpeed += (Math.random() - 0.5) * rough * 30 * dt; strafeSpeed += (Math.random() - 0.5) * rough * 30 * dt;
    const level = out.clone().addScaledVector(shipForward, -out.dot(shipForward));
    if (level.lengthSq() > 0.04) spaceUp.lerp(level.normalize(), dt * 0.8 * dive.k).normalize();
    // Lightning, on the stormier giants and more of it deeper down.
    if (Math.random() < dt * (0.03 + 0.2 * deep) * (body.turbulence ?? 1) * (gas ? 1 : 0.3) * (h < 40 ? 1 : 0)) dive.flash = 1;
    // What the pilot is told: on going in, and near the limit.
    if (h < 0 && dive.told < 1) { dive.told = 1; toast(`Below ${body.name}'s cloud tops. Wind ${Math.round(Math.abs(dive.wind))} m/s along the bands. The hull holds to ${Math.round(limit)} m down.`, 6); }
    if (deep > 0.8 && dive.told < 2) { dive.told = 2; toast(`Hull pressure rising: crush depth in ${Math.round(limit + h)} m.`, 4); }
    if (deep < 0.6 && dive.told === 2) dive.told = 1;
    if (h > 120) dive.told = 0;
    // Loose cloud round the ship: lumps that stay where they are in the air as you fly
    // through them, carried along by the wind, and come round again ahead when left behind.
    const N = lite ? 48 : 110;
    if (!dive.puffs) {
        dive.puffs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), cloudPuffMaterial(), N);
        dive.puffs.frustumCulled = false; dive.puffs.renderOrder = 3; dive.puffs.userData.perf = "clouds";
        dive.puffs.setColorAt(0, new THREE.Color());
        scene.add(dive.puffs);
        for (let i = 0; i < N; i++) dive.off.push({ p: vec(), s: 0, a: 0, c: 0 });
    }
    // The giant moves along its orbit: in its air, the ship is carried with it.
    if (!holding && dive.last && dive.last.body === body) shipPosition.add(centre.clone().sub(dive.last.centre));
    const rel = global.clone().sub(centre), moved = dive.last && dive.last.body === body ? rel.clone().sub(dive.last.rel) : vec();
    const fresh = !dive.last || dive.last.body !== body;
    dive.last = { body, rel, centre };
    const show = clamp((80 - h) / 80, 0, 1), m4 = new THREE.Matrix4(), qd = new THREE.Quaternion(), sc = vec(), tint = new THREE.Color();
    dive.puffs.visible = show > 0.01;
    dive.puffs.position.copy(shipPosition);
    // Each lump in one of the giant's own cloud colours, darker the deeper it hangs.
    const pal = body.palette || [body.atmosphere, body.atmosphere, body.atmosphere, body.atmosphere], dark = 1 - 0.65 * deep;
    for (let i = 0; i < N; i++) {
        const o = dive.off[i];
        o.p.sub(moved).addScaledVector(east, dive.wind * 0.5 * dt);
        if (fresh || o.p.lengthSq() > 300 * 300 || !o.s) {
            const dir = vec(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            if (!fresh && dir.dot(shipForward) < 0 && Math.abs(speed) > 4) dir.negate().multiplyScalar(Math.sign(speed));
            o.p.copy(dir).multiplyScalar(fresh ? 60 + Math.random() * 230 : 250 + Math.random() * 45);
            o.s = 30 + Math.random() ** 1.6 * 110; o.a = Math.random() * 6.28; o.c = Math.random();
        }
        sc.setScalar(i / N < show ? o.s : 0.0001);
        dive.puffs.setMatrixAt(i, m4.compose(o.p, qd, sc));
        tint.set(pal[1 + Math.floor(o.c * 3) % 3] || body.atmosphere).lerp(DIVE_TINT.set(body.atmosphere), 0.35).multiplyScalar(dark * (0.85 + 0.3 * o.c));
        dive.puffs.setColorAt(i, tint);
    }
    dive.puffs.instanceMatrix.needsUpdate = true;
    dive.puffs.instanceColor.needsUpdate = true;
    updateCloudLife(dt, body, centre, out, east, h, limit);
}
// --- Life in the clouds -------------------------------------------------------
// About one giant in three (fauna.mjs cloudFaunaFor): flocks of drifters, and on some the
// fliers that hunt them, live below the cloud tops. Each flock keeps its place in the air
// (relative to the giant), rides the band's wind, and swims slowly on its own heading; when
// it falls far behind it comes round again out of the murk ahead, past where the cloud hides
// it, so nothing appears in plain view. Point the nose at one and hold E to scan it.
const cloudLife = new Map(); // body id -> { species, crews: [{ sp, crew, flocks: [{ rel, heading, members }] }] } (built on first dive)
const CL_M = new THREE.Matrix4(), CL_Q = new THREE.Quaternion(), CL_S = new THREE.Vector3(), CL_X = new THREE.Vector3(), CL_Y = new THREE.Vector3(), CL_Z = new THREE.Vector3();
function cloudLifeOf(body) {
    let life = cloudLife.get(body.id);
    if (life) return life;
    const species = cloudFaunaFor(body).species;
    life = { body, species, crews: [], site: { fauna: { species } } };
    for (const sp of species) {
        const herds = Math.min(sp.herds, lite ? 2 : 3), group = Math.min(sp.group, 5), crew = buildCrew(THREE, sp, herds * group, `cloud:${body.id}`);
        crew.group.visible = false;
        scene.add(crew.group);
        const flocks = [];
        for (let f = 0; f < herds; f++) flocks.push({ rel: null, heading: vec(), turn: 0, members: Array.from({ length: group }, () => ({ off: vec(), phase: Math.random() * 6.28 })) });
        life.crews.push({ sp, crew, flocks });
    }
    cloudLife.set(body.id, life);
    return life;
}
function hideCloudLife() {
    for (const life of cloudLife.values()) for (const c of life.crews) c.crew.group.visible = false;
    if (scanTarget?.cloud) { scanTarget = null; scanProgress = 0; }
}
// Places a flock somewhere in the giant's air near the ship (rel: from the giant's centre).
function placeFlock(f, sp, body, centre, global, out, limit, ahead) {
    let dir = vec(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    dir.addScaledVector(out, -dir.dot(out));
    if (ahead && Math.abs(speed) > 3) dir.add(shipForward.clone().addScaledVector(out, -shipForward.dot(out)).multiplyScalar(1.5 * Math.sign(speed)));
    dir.normalize();
    const reach = ahead ? 650 + Math.random() * 350 : 120 + Math.random() * 700;
    const depth = 60 + Math.random() * Math.max(80, limit * 0.8 - 60); // below the cloud deck, above crush depth
    const p = global.clone().addScaledVector(dir, reach).sub(centre).setLength(body.radius - depth);
    f.rel = p;
    f.heading.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    f.turn = (Math.random() - 0.5) * (sp.plan === "flyer" ? 0.5 : 0.08);
    const spread = sp.size * (sp.plan === "flyer" ? 4 : 2.5) + 6;
    for (const m of f.members) m.off.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * 0.4, (Math.random() - 0.5) * spread);
}
function updateCloudLife(dt, body, centre, out, east, h, limit) {
    const life = cloudLifeOf(body);
    if (!life.crews.length || h > 40) return hideCloudLife(); // only below the deck
    const global = shipPosition.clone().add(worldOrigin), eye = camera.position, look = camera.getWorldDirection(vec());
    let best = null;
    for (const { sp, crew, flocks } of life.crews) {
        crew.group.visible = true;
        let i = 0;
        for (const f of flocks) {
            if (!f.rel) placeFlock(f, sp, body, centre, global, out, limit, false);
            const at = centre.clone().add(f.rel);
            if (at.distanceTo(global) > 1100) { placeFlock(f, sp, body, centre, global, out, limit, true); at.copy(centre).add(f.rel); }
            const up = f.rel.clone().normalize();
            // Its own way through the air (kept level), plus the band's wind where it is.
            f.heading.addScaledVector(up, -f.heading.dot(up)).applyAxisAngle(up, f.turn * dt);
            if (f.heading.lengthSq() < 1e-6) f.heading.copy(east);
            f.heading.normalize();
            const swim = sp.plan === "flyer" ? clamp(sp.speed?.run ?? 8, 6, 18) : clamp(sp.speed?.walk ?? 2, 1.5, 5);
            const lat = Math.asin(clamp(up.dot(vec(-Math.sin(body.tilt || 0), Math.cos(body.tilt || 0), 0)), -1, 1));
            const wind = clamp(Math.sin(lat * body.bands * 2 + (body.seed % 1000) / 159) * 2.5, -1, 1) * 14 * (body.physics.kind === "gas" ? 1 : 0.5);
            f.rel.addScaledVector(f.heading, swim * dt).addScaledVector(east, wind * 0.8 * dt);
            const fwd = f.heading;
            CL_X.crossVectors(up, fwd).normalize();
            CL_Q.setFromRotationMatrix(CL_M.makeBasis(CL_X, up, fwd));
            for (const m of f.members) {
                m.phase += dt * (sp.plan === "flyer" ? 5 : 1.2);
                const p = at.clone().add(CL_Y.copy(m.off).applyQuaternion(CL_Q)).addScaledVector(up, Math.sin(m.phase * 0.4) * sp.size * 0.15).sub(worldOrigin);
                crew.set(i++, CL_M.compose(p, CL_Q, CL_S.set(1, 1, 1)), m.phase, 1);
                // The one nearest your aim, within the scanner's reach, is what E scans.
                const to = p.clone().sub(eye), d = to.length(), reach = 160 + sp.size * 14;
                if (d > reach) continue;
                const off = to.normalize().angleTo(look) - Math.atan((sp.size * 0.8) / Math.max(d, 1));
                if (off < 0.12 && (!best || off < best.off)) best = { off, sp, point: p };
            }
        }
        crew.commit();
    }
    // Scanning from the cockpit (the same ring, hold time and card as on foot).
    const keep = scanTarget?.cloud && scanProgress > 0 && life.species.includes(scanTarget.ref) ? scanTarget : null;
    if (best && (!keep || keep.ref === best.sp)) {
        const known = (bestiary[body.id] ||= []).includes(best.sp.id);
        if (scanTarget?.cloud && scanTarget.ref === best.sp) Object.assign(scanTarget, { point: best.point, known });
        else { scanTarget = { kind: "fauna", id: best.sp.id, ref: best.sp, point: best.point, known, cloud: true, body, site: life.site }; scanProgress = 0; }
    } else if (!keep && scanTarget?.cloud) { scanTarget = null; scanProgress = 0; }
    const held = scanHeld();
    if (!held) scanNeedsRelease = false;
    if (scanTarget?.cloud && !scanTarget.known && held && !scanNeedsRelease) {
        scanProgress += dt / SCAN_TIME;
        if (scanProgress >= 1) {
            const t = scanTarget;
            scanProgress = 0; scanNeedsRelease = true; t.known = true;
            bestiary[body.id].push(t.id);
            saveSurvey();
            scanUI.flash();
            showScanCard(t, recordInfo(faunaEntry(system, body, t.ref)));
        }
    } else scanProgress = Math.max(0, scanProgress - dt * 2.5);
    if (dive.told === 1 && !life.told) { life.told = true; toast(`Something is alive down here. Point the nose at it and hold E to scan.`, 5); }
}
// Space is big and worlds are far apart, so out in the open the engines scale up
// with the distance to the nearest surface (the star's, a giant's cloud tops or a
// world's ground): 1x within 900 m, so arrival speeds are unchanged.
function spaceReach(global) {
    let clearance = global.length() - system.star.radius;
    for (const body of system.bodies) clearance = Math.min(clearance, global.distanceTo(positionOf(body)) - body.radius);
    for (const a of systemView.arks?.() ?? []) clearance = Math.min(clearance, global.distanceTo(positionOf(arkBody(a))) - a.size);
    clearance = Math.min(clearance, rockClearance(system, spaceView.objs, global.toArray(), orbitClock()) + 300); // among the rocks of a belt or swarm, slow
    return clamp(clearance / 900, 1, 150);
}
// A jump chosen on the map: the ship turns to the star, runs up and is gone (then the page
// reloads into that system, see starMap onJump).
let jumpAnim = null; // { t, duration, aim }
function updateJump(dt) {
    const j = jumpAnim, k = clamp((j.t += dt) / j.duration, 0, 1);
    shipForward.lerp(j.aim, 1 - Math.exp(-dt * 3.5)).normalize();
    spaceUp.addScaledVector(shipForward, -spaceUp.dot(shipForward)).normalize();
    // Turn first, then the surge.
    const surge = smoothstep((k - 0.3) / 0.7);
    speed = damp(speed, 250 + 90000 * surge * surge, 2 + 4 * surge, dt);
    verticalSpeed = damp(verticalSpeed, 0, 4, dt);
    strafeSpeed = damp(strafeSpeed, 0, 4, dt);
    bankAngle = damp(bankAngle, 0, 3, dt);
    heat = 0;
    shipPosition.addScaledVector(shipForward, speed * dt).addScaledVector(spaceUp, verticalSpeed * dt);
    driveFade = 1;
    drivePower = smoothstep(k * 1.4);
    streaks.update(camera, shipForward, drivePower, dt);
    orientSpace(dt);
}
function updateSpace(dt) {
    if (driveFade > 0) {
        driveFade = driveFade < 0.03 ? 0 : damp(driveFade, 0, 1.6, dt);
        streaks.update(camera, shipForward, drivePower * driveFade, dt);
    }
    // A selected world, or else your course star: hold the nose on it whenever
    // you are not steering.
    const aim = target ? positionOf(target).sub(worldOrigin).sub(shipPosition).normalize() : course ? towardStar(course) : null;
    if (aim && !steering() && !(dive.k > 0.3 && target === dive.body)) turnToward(aim, dt); // (in a giant's clouds the nose is yours)
    const autoThrust = autopilot && course && !target && !keys.has("KeyW") && !keys.has("KeyS") && !keys.has("KeyX");
    if (holding && ["KeyW", "KeyS", "KeyR", "KeyF", "KeyX"].some((k) => keys.has(k))) holding = null; // flying off
    // Near worlds A/D slide the ship sideways (handy for lining up a scan or an
    // approach); the mouse or the arrow keys turn it.
    const yaw = arrowTurn();
    const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const m = takeMouseSteer(dt);
    shipForward.applyAxisAngle(spaceUp, yaw * dt * 0.85 + m.yaw);
    const right = shipForward.clone().cross(spaceUp).normalize();
    const pitch =
        (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
    shipForward.applyAxisAngle(right, pitch * dt * 0.7 + m.pitch).normalize();
    spaceUp.applyAxisAngle(right, pitch * dt * 0.7 + m.pitch).normalize();
    // Out in a system the view slowly rolls level with the orbital plane (roll only: the nose
    // stays where you point it), so giants and their rings aren't seen on their side just
    // because of where you came from. Not while diving into a giant's clouds.
    if (dive.k < 0.1) { const lv = Y.clone().addScaledVector(shipForward, -Y.dot(shipForward)); if (lv.lengthSq() > 0.04) spaceUp.lerp(lv.normalize(), Math.min(1, dt * 0.6)).normalize(); }
    const boost = keys.has("ShiftLeft") || keys.has("ShiftRight"),
        brake = keys.has("KeyX"),
        reach = spaceReach(shipPosition.clone().add(worldOrigin));
    speed = damp(
        speed,
        brake
            ? 0
            : autoThrust
              ? shipForward.dot(aim) > 0.97 ? 900 * reach : 60
              : ((keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)) *
                  (boost ? 900 : 220) * reach,
        // Spooling up is quick once clear of a world (the engines are far stronger out there).
        brake ? 4 : reach > 2 ? 2.6 : 1.4,
        dt,
    );
    // Just after breaking orbit the climb carries on and fades, unless you steer
    // it yourself (F, or the brake).
    exitGlide = Math.max(0, exitGlide - dt / 3);
    const lift = ((keys.has("KeyR") ? 1 : 0) - (keys.has("KeyF") ? 1 : 0)) * (boost ? 100 : 35);
    verticalSpeed = damp(
        verticalSpeed,
        brake ? 0 : lift < 0 ? lift : Math.max(lift, exitClimb * smoothstep(exitGlide)),
        exitGlide > 0 ? 1.2 : 3,
        dt,
    );
    strafeSpeed = damp(strafeSpeed, brake ? 0 : strafe * (boost ? 100 : 35), 3, dt);
    bankAngle = damp(bankAngle, clamp(yaw * 0.25 + m.rate * 0.12 - strafe * 0.15, -0.45, 0.45), 4, dt);
    shipPosition
        .addScaledVector(shipForward, speed * dt)
        .addScaledVector(spaceUp, verticalSpeed * dt)
        .addScaledVector(right, strafeSpeed * dt);
    const global = shipPosition.clone().add(worldOrigin);
    // The star's exclusion zone and giants' cloud tops are hard limits. The ship
    // slides along them (no bounce), and slows if it keeps pushing inward.
    const holdOff = (centre, limit, message) => {
        const out = global.clone().sub(centre);
        if (out.length() >= limit) return;
        out.normalize();
        global.copy(centre).addScaledVector(out, limit);
        shipPosition.copy(global).sub(worldOrigin);
        const inward = -shipForward.dot(out);
        if (inward > 0) speed = damp(speed, 0, 6 * inward, dt);
        if (verticalSpeed * spaceUp.dot(out) < 0) verticalSpeed = damp(verticalSpeed, 0, 6, dt);
        if (strafeSpeed * right.dot(out) < 0) strafeSpeed = damp(strafeSpeed, 0, 6, dt);
        if (toastTime <= 0) toast(message);
    };
    holdOff(vec(), system.star.radius + 140, `Stellar exclusion zone. Turn away from ${system.star.name}.`);
    // Among a ring's rocks the drive holds you to a speed you can steer at (as near a world).
    const inRing = systemView.ringDepth(shipPosition);
    if (inRing > 0.05) {
        const cap = 160 + 1400 * (1 - inRing) ** 2;
        if (Math.abs(speed) > cap) { speed = damp(speed, Math.sign(speed) * cap, 2.2, dt); if (toastTime <= 0) toast("In the ring: slowing among the rocks.", 2); }
    }
    // A ring's rocks: you glance off them with a jolt rather than flying through.
    const rockHit = systemView.bump(shipPosition);
    if (rockHit) {
        shipPosition.add(rockHit.push);
        const out = rockHit.push.clone().normalize(), into = -shipForward.dot(out);
        if (into > 0) speed *= 1 - 0.6 * into;
        bumpShake = Math.min(1, bumpShake + 0.25 + Math.min(0.5, Math.abs(speed) / 400));
        if (toastTime <= 0) toast(rockHit.what || "Ring debris. Slow down among the rocks.", 2);
    }
    // Close to a star the hull heats up: the view glows and warnings start well
    // before the hard limit above.
    heat = clamp(1 - (global.length() - system.star.radius - 140) / (system.star.radius * 0.5), 0, 1) * heatScale(codex.unlocked);
    if (heat > 0.35 && toastTime <= 0)
        toast(heat > 0.75 ? `Hull temperature critical. Turn away from ${system.star.name}!` : `Hull temperature rising near ${system.star.name}.`, 2);
    for (const body of system.bodies)
        if (body.giant) {
            const crush = crushDepth(body);
            holdOff(
                positionOf(body),
                crush ? body.radius - crush : body.radius + giantClearance(body),
                crush ? `Crush depth. The hull will not go deeper into ${body.name}.` : `${body.name} has no surface: the clouds only thicken into crushing pressure. Its moons are safe to land on.`,
            );
        }
    updateCloudDive(dt, shipPosition.clone().add(worldOrigin));
    // Rocks are solid: the ship glances off them.
    if (spaceView.collide(shipPosition, SHIP_RADIUS + 1.5, worldOrigin)) { speed *= 0.9; if (toastTime <= 0) toast("Rock alongside. Ease off the throttle among the rocks.", 2); }
    updateSpaceRecord(dt, shipPosition.clone().add(worldOrigin));
    // Past the outermost orbits lies interstellar space.
    if (global.length() > edge * 0.85 && global.length() < edge && toastTime <= 0 && spaceReach(global) > 20) // (not beside an outer giant)
        toast(`Leaving the ${system.name} system. The star drive engages beyond the outer orbits.`);
    if (global.length() > edge) {
        enterDeep(global);
        return;
    }
    const nearby = system.bodies
        .filter((body) => !body.giant)
        .map((body) => ({
            body,
            clearance: global.distanceTo(positionOf(body)) - body.radius,
        }))
        .sort((a, b) => a.clearance - b.clearance);
    // Heading in toward a world the ship sheds speed as its sky gets close, so
    // reaching orbit is a glide rather than a sudden stop.
    if (nearby.length && nearby[0].clearance < 2200) {
        const toward = positionOf(nearby[0].body).sub(global).normalize();
        if (shipForward.dot(toward) * speed > 0) {
            const cap = 220 + 680 * smoothstep((nearby[0].clearance - 520) / 1600);
            if (Math.abs(speed) > cap) speed = damp(speed, Math.sign(speed) * cap, 3, dt);
        }
    }
    // The same on the way in to an ark: down to docking speed by the time its hull is alongside.
    for (const a of systemView.arks?.() ?? []) {
        const centre = positionOf(arkBody(a)), clearance = global.distanceTo(centre) - a.size;
        if (clearance > 2600 || shipForward.dot(centre.sub(global).normalize()) * speed <= 0) continue;
        const cap = 75 + 825 * smoothstep(clearance / 2600);
        if (Math.abs(speed) > cap) speed = damp(speed, Math.sign(speed) * cap, 3, dt);
    }
    // Orbit begins at 520 m (it ends again above 600 m), high enough for the
    // change of view to happen gradually.
    if (nearby.length && nearby[0].clearance >= 520) nearby.length = 0;
    if (nearby.length) {
        switchWorld(nearby[0].body, global);
        return;
    }
    orientSpace(dt);
}
function beginCruise() {
    if (!started) return;
    if (!selectedBody)
        return void toast("Choose a destination first: press Tab, tap a world, or pick one on the system map (M).");
    if (mode !== "flight" && mode !== "space") {
        toast("Return to your ship and take off before engaging cruise.");
        return;
    }
    const start = shipPosition.clone().add(worldOrigin),
        n = shipPosition.clone().normalize();
    const departure =
        mode === "space"
            ? start.clone()
            : worldOrigin.clone().addScaledVector(n, RADIUS + 650);
    const end = cruiseEnd(selectedBody);
    travel = {
        body: selectedBody,
        start: start.toArray(),
        departure: departure.toArray(),
        end: end.toArray(),
        time: 0,
        duration: 12,
    };
    autoApproach = false;
    keys.clear();
    mode = "transit";
    spaceUp.copy(n);
    starMap.close();
    $("transit").hidden = false;
    $("transitTitle").textContent =
        `BOUND FOR ${selectedBody.name.toUpperCase()}`;
    toast("Cruise engaged. Press T to disengage and fly manually.");
}
function cancelCruise() {
    if (mode !== "transit") return;
    mode = "space";
    travel = null;
    speed = Math.min(speed, 150);
    verticalSpeed = 0;
    $("transit").hidden = true;
    keys.clear();
    toast("Cruise disengaged. Manual spaceflight.");
}
// Where a cruise ends: above the signal, or for giants well above the cloud
// tops, where the whole planet fills the view. Follows the body along its orbit.
function cruiseEnd(body) {
    if (body.ark) { // above the ark, its deck in view
        const a = systemView.arks().find((x) => x.civ.id === body.civ.id), size = a?.size ?? 2000;
        return positionOf(body).add(vec(0, size * 0.55 + 260, size * 0.35));
    }
    // On rocky worlds, above the landing site itself (on big worlds with wide seas it
    // can be a few hundred metres from the signal, at the nearest dry land).
    return positionOf(body).addScaledVector(
        vec(...(body.giant ? body.signal : terrainFor(body).site)),
        body.radius + (body.giant ? body.radius * 0.9 + 500 : 190),
    );
}
function updateCruise(dt) {
    travel.time += dt;
    travel.end = cruiseEnd(travel.body).toArray(); // the destination keeps moving
    const t = clamp(travel.time / travel.duration, 0, 1);
    const next = vec(
        ...cruisePoint(travel.start, travel.departure, travel.end, t, system.star.radius),
    ).sub(worldOrigin);
    const delta = next.clone().sub(shipPosition);
    speed = delta.length() / Math.max(dt, 0.001);
    verticalSpeed = 0;
    if (delta.lengthSq() > 0.00001)
        shipForward.lerp(delta.normalize(), 1 - Math.exp(-dt * 3)).normalize();
    shipPosition.copy(next);
    bankAngle = damp(bankAngle, 0, 3, dt);
    // Ease "up" toward the system's up, but only as far as the nose allows (never toward the nose itself).
    const level = Y.clone().addScaledVector(shipForward, -Y.dot(shipForward));
    if (level.lengthSq() > 0.04) spaceUp.lerp(level.normalize(), Math.min(1, dt * 1.5 * Math.sqrt(level.lengthSq()))).normalize();
    orientSpace(dt);
    // Build the destination's landing site halfway, not in the frame you arrive.
    if (!travel.prepared && t > 0.5) {
        travel.prepared = true;
        if (!travel.body.giant && !travel.body.ark && !siteCache.has(travel.body.id)) siteCache.set(travel.body.id, makeSite(travel.body));
    }
    $("transitProgress").style.width = `${t * 100}%`;
    $("transitPercent").textContent = `${Math.round(t * 100)}%`;
    if (t >= 1) {
        const destination = travel.body,
            global = next.clone().add(worldOrigin);
        travel = null;
        $("transit").hidden = true;
        if (destination.ark) { // stay in open space beside it: fly down and dock (L)
            mode = "space"; speed = 0; verticalSpeed = 0; selectedBody = target = null;
            toast(`${destination.name} fills the view. Fly down over its deck and press L to dock.`, 6);
        } else if (destination.giant) arriveAtGiant(destination);
        else switchWorld(destination, global);
    }
}

// --- Interstellar flight ---------------------------------------------------
// Beyond a system's edge the ship flies between the galaxy's real stars. Its
// position is kept in light years (galactic); the scene stays centred on it.
// The star drive's speed scales with the distance to the nearest star, so
// crossing light years takes a minute or two and arrivals are gentle. Nearing
// a star builds its system in the background; at its edge you fly straight in.
let galactic = null, // ship position (ly) while in deep space
    course = null, // destination star chosen on the galaxy map
    autopilot = false,
    throttle = 0,
    incoming = null; // { star, system, view, ready } being built ahead of arrival
const DRIVE_TIME = 5; // seconds to cover the distance to the nearest star, at full throttle
const PREPARE_LY = 0.4; // start building a system this far out, so its worlds show early
const edgeCache = new Map();
function edgeOf(star) {
    if (star.id === loadedId) return edge;
    let e = edgeCache.get(star.id);
    if (!e) {
        e = systemEdge(generateSystem(star.seed));
        if (edgeCache.size > 200) edgeCache.clear();
        edgeCache.set(star.id, e);
    }
    return e;
}
function enterDeep(global) {
    const out = toGalaxy(global.clone().normalize());
    galactic = starPoint(currentStar).map((v, i) => v + out[i] * ARRIVE_LY * 1.05);
    const shift = shipPosition.clone();
    shipPosition.set(0, 0, 0);
    camera.position.sub(shift);
    mode = "deep";
    // The drive picks up at the speed the ship already had (it used to leap to a third throttle).
    throttle = clamp(Math.abs(speed) / (edge / DRIVE_TIME), 0.06, 1);
    autopilot = autopilot && !!course;
    systemView.visible = false;
    if (site) site.group.visible = false;
    sky.update(galactic, camera);
    toast(
        course
            ? `Star drive engaged. Press T for autopilot to ${starName(course)}.`
            : "Star drive engaged. Fly toward any star, or set a course on the galaxy map (G).",
        6,
    );
}
const starName = (star) => (star.id === loadedId ? system.name : nameCache(star));
const names = new Map();
function nameCache(star) {
    let n = names.get(star.id);
    if (!n) names.set(star.id, (n = generateSystem(star.seed).name));
    return n;
}
// A course replaces any world you had in focus: the ship now points at the star.
function setCourse(star) {
    if (!star) return clearTarget();
    course = star;
    deepTarget = null;
    target = pendingBody = selectedBody = null;
    starMap.close();
    if (mode === "deep") {
        autopilot = true;
        toast(`Course set for ${starName(star)}. Autopilot engaged; steer to take over.`);
    } else
        toast(
            mode === "space"
                ? `Course set for ${starName(star)}. Press T for autopilot: it flies you out of the system and on to the star.`
                : `Course set for ${starName(star)}. Climb above 600 m, then press T for autopilot.`,
            6,
        );
}
function toggleAutopilot() {
    if (!course && !deepTarget) return void toast("Set a course on the galaxy map (G) first.");
    autopilot = !autopilot;
    toast(autopilot ? `Autopilot to ${deepTarget ? findLabel(deepTarget) : starName(course)}.` : "Autopilot off. Manual flight.");
}
// T and the main button: with a star as your course (and no world in focus),
// they work the autopilot; otherwise they cruise to the selected world.
function cruiseOrAutopilot() {
    if (mode === "deep" || (mode === "space" && course && !target)) toggleAutopilot();
    else if (mode === "transit") cancelCruise();
    else if (mode === "flight" && course && !target) toast("Climb above 600 m to leave orbit, then press T for autopilot.");
    else if (mode === "space" && !selectedBody) cycleTarget();
    else beginCruise();
}
// Where you are in the galaxy (ly): your ship in deep space, else your star.
const viewer = () => (mode === "deep" ? galactic : starPoint(currentStar));
const towardStar = (star) => toScene(starPoint(star).map((v, i) => v - viewer()[i])).normalize();
function startIncoming(star) {
    if (incoming?.view) incoming.view.dispose();
    const job = (incoming = { star, system: generateSystem(star.seed), view: null, ready: false });
    buildSystemViewGradually(scene, job.system, streamer, { coarse: lite }).then((view) => {
        if (incoming === job) {
            job.view = view;
            job.ready = true;
        } else view.dispose();
    });
}
// The mouse (or a drag on touch) steers while flying, unless Q / the Look button
// is held for looking around, or an automatic approach is flying the ship.
const mouseSteers = () => (mode === "flight" || mode === "dive" || mode === "space" || mode === "deep") && !keys.has("KeyQ") && !autoApproach;
// This frame's share of the queued mouse steering, in radians.
function takeMouseSteer(dt) {
    const f = 1 - Math.exp(-dt * 12);
    const m = { yaw: steerYaw * f, pitch: steerPitch * f, rate: 0 };
    steerYaw -= m.yaw;
    steerPitch -= m.pitch;
    m.rate = m.yaw / Math.max(dt, 1e-3); // turn rate, for banking
    return m;
}
const arrowTurn = () => (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
// Any steering input: keys, joystick, mouse. (Near worlds A/D slide sideways, so
// they don't count there.)
const steering = () =>
    (mode !== "space" && (keys.has("KeyA") || keys.has("KeyD"))) ||
    keys.has("ArrowUp") || keys.has("ArrowDown") || keys.has("ArrowLeft") || keys.has("ArrowRight") ||
    performance.now() - lastMouseSteer < 500;
// Smoothly turns the ship's nose toward a direction, keeping it upright.
function turnToward(want, dt) {
    shipForward.lerp(want, 1 - Math.exp(-dt * 1.4)).normalize();
    spaceUp.addScaledVector(shipForward, -spaceUp.dot(shipForward)).normalize();
}
// Where the course points: the chosen world of the system ahead once it can be
// seen, otherwise its star.
function courseAim() {
    if (pendingBody && ahead && ahead.star.id === course.id) {
        const p = ahead.positions.get(pendingBody.id);
        return ahead.starScene.clone().add(vec(...p)).sub(shipPosition).normalize();
    }
    return toScene(starPoint(course).map((v, i) => v - galactic[i])).normalize();
}
// The system around the nearest star, seen from deep space: its worlds as dots
// around the star from 0.4 ly, and the real worlds once they are close enough
// to draw (the departing system as you leave, the next one as you arrive).
let ahead = null,
    shownView = null,
    pendingBody = null; // world chosen in the system ahead; becomes the target on arrival
const aheadSystems = new Map();
function systemOfStar(star) {
    if (star.id === loadedId) return system;
    if (incoming?.star.id === star.id) return incoming.system;
    let s = aheadSystems.get(star.id);
    if (!s) {
        if (aheadSystems.size > 20) aheadSystems.clear();
        aheadSystems.set(star.id, (s = generateSystem(star.seed)));
    }
    return s;
}
function showSystemAhead(entry, offset, d) {
    const star = entry.star;
    if (d > 0.4) {
        if (shownView) shownView.visible = false;
        shownView = ahead = null;
        worldDots.hide();
        return;
    }
    const sys = systemOfStar(star),
        metresPerLy = edgeOf(star) / ARRIVE_LY,
        starScene = toScene(offset).multiplyScalar(metresPerLy),
        positions = systemPositions(sys, orbitClock());
    ahead = { star, system: sys, starScene, positions, real: false };
    const view = star.id === loadedId ? systemView : incoming?.ready && incoming.star.id === star.id ? incoming.view : null;
    if (shownView && shownView !== view) shownView.visible = false;
    shownView = null;
    if (view) {
        // The real worlds, as a miniature when far off (see systemView.place).
        const reach = starScene.length(),
            scale = Math.min(1, (VIEW_RANGE * 0.3) / reach);
        view.visible = true;
        view.place(positions, starScene.clone().negate(), scale);
        view.update(camera.position, streamer);
        shownView = view;
        ahead.real = true;
        ahead.scale = scale;
        nearStar.hide();
    }
    // Dots mark worlds still too small to see (under ~2 pixels across), so the
    // system is visible from afar; each dot gives way to its world as it grows.
    const pixels = innerHeight / 2 / Math.tan((camera.fov * Math.PI) / 360);
    worldDots.show(
        camera,
        sys.bodies
            .map((b) => ({ b, at: starScene.clone().add(vec(...positions.get(b.id))) }))
            .filter((e) => !view || (e.b.radius / e.at.length()) * pixels < 2)
            .map((e) => ({ dir: e.at.normalize(), color: e.b.palette[2] })),
    );
}
// --- Finds between the stars (deep-finds.mjs, deep-finds-view.js) --------------------
// The drive's sensors pick up anything within DETECT_LY: an unknown contact at first, named
// once you are close. Tap it (or Tab) to set course; the drive eases you in and holds you
// beside a world, dwarf or black hole; a nebula you fly into. Hold E to record it (codex).
// Found ones are remembered (and drawn on the galaxy map).
const FINDS_KEY = "elsewhere-finds";
const knownFinds = (() => { try { return JSON.parse(localStorage.getItem(FINDS_KEY) || "{}"); } catch { return {}; } })();
const saveFinds = () => { try { localStorage.setItem(FINDS_KEY, JSON.stringify(knownFinds)); } catch {} };
let deepTarget = null, // a find you set course for
    deepNear = [],
    deepScanAt = 0,
    nebulaIn = 0, // 0..1, eases in and out
    nebulaFind = null,
    heldBeside = null,
    deepDetour = false, // deepTarget was set by the sensors, not by you: C or recording it resumes your course
    deepSpeed = 0; // light years per second, last frame (the sensors look further ahead the faster you go)
const findViews = createFindViews(scene, { puffMaterial: cloudPuffMaterial });
const findOffset = (f) => [f.x - galactic[0], f.y - galactic[1], f.z - galactic[2]];
const findLabel = (f) => (knownFinds[f.id]?.revealed ? f.title : "Unknown contact");
const findEntry = (f) => ({ kind: "phenomenon", seed: String(f.seed), bodyId: "deep", id: f.kind, traits: { type: f.kind, name: f.title, deep: true, life: !!f.life }, world: { name: f.title, giant: false, moon: false, life: f.life ? "microbial" : "none" } });
function updateFinds(dt, inNebula) {
    for (const n of deepNear) {
        const f = n.f, k = knownFinds[f.id];
        // Picked up by the sensors, then identified as you close in.
        if (n.edge < DETECT_LY && !k) {
            knownFinds[f.id] = { id: f.id, kind: f.kind, x: f.x, y: f.y, z: f.z, title: f.title, revealed: false, recorded: false };
            saveFinds();
            // The drive drops to approach speed and turns toward it, so a contact can't be missed.
            // Steer away to ignore it; C clears the detour and goes back to your course.
            if (!deepTarget && !inNebula) {
                deepTarget = f; deepDetour = true; autopilot = true; throttle = Math.min(throttle, 0.4);
                starMap.refresh();
                toast(`Sensor contact, ${fmtLightYears(Math.max(0, n.edge))} away. Dropping out of full drive and turning toward it. C to ignore.`, 7);
            } else toast(`Sensor contact: something ${fmtLightYears(Math.max(0, n.edge))} away. Tab or tap it to set course.`, 6);
        } else if (k && !k.revealed && n.edge < REVEAL_LY) {
            k.revealed = true; saveFinds();
            toast(`Contact identified: ${f.name}, ${FIND_KINDS[f.kind].word}.${f.kind === "nebula" ? " Fly into it." : " The drive will bring you alongside."}`, 7);
        }
        // Held beside a solid find: the drive will not take you into it.
        if (f.kind !== "nebula" && n.d < f.size + f.stop) {
            const off = findOffset(f), out = off.map((v) => -v / n.d);
            galactic = [f.x + out[0] * (f.size + f.stop), f.y + out[1] * (f.size + f.stop), f.z + out[2] * (f.size + f.stop)];
            if (shipForward.dot(toScene(off).normalize()) > 0) throttle = damp(throttle, 0, 6, dt);
            if (heldBeside !== f.id) { heldBeside = f.id; autopilot = false; toast(`${f.title} fills the view.${knownFinds[f.id]?.recorded ? "" : " Hold E to record it."}`, 6); }
        } else if (heldBeside === f.id && n.d > f.size + f.stop * 3) heldBeside = null;
    }
    // In a nebula: its gas round you and the sky its colour.
    if (inNebula && nebulaFind !== inNebula) { nebulaFind = inNebula; toast(`Inside ${inNebula.name}. ${knownFinds[inNebula.id]?.recorded ? "" : "Hold E to record it. "}The drive slows in the gas.`, 6); }
    nebulaIn = damp(nebulaIn, inNebula ? 1 : 0, 1.5, dt);
    if (!inNebula && nebulaIn < 0.02) nebulaFind = null;
    findViews.update(camera, galactic, deepNear, dt);
    findViews.inside(camera, nebulaIn > 0.02 ? nebulaFind : null, shipForward, 150 + throttle * 2600, dt, 1);
    // What E records: the nebula you are in, or the find you are beside.
    const here = inNebula || deepNear.find((n) => n.f.kind !== "nebula" && n.edge < n.f.stop * 4)?.f || null;
    if (here) {
        const known = codex.has(findEntry(here));
        if (scanTarget?.deepFind !== here) { scanTarget = { kind: "phenomenon", id: here.kind, deepFind: here, ref: { name: here.title }, known }; scanProgress = 0; }
        scanTarget.known = known;
        const held = scanHeld();
        if (!held) scanNeedsRelease = false;
        if (!known && held && !scanNeedsRelease) {
            scanProgress += dt / RECORD_TIME;
            if (scanProgress >= 1) {
                scanProgress = 0; scanNeedsRelease = true;
                const info = recordInfo(findEntry(here));
                knownFinds[here.id] = { ...(knownFinds[here.id] || {}), revealed: true, recorded: true }; saveFinds();
                scanUI.flash();
                toast(`${here.title} recorded in your codex.${info.text || ""}${deepDetour && deepTarget === here && course ? ` Back on course to ${starName(course)}.` : ""}`, 7);
                if (deepDetour && deepTarget === here) { deepTarget = null; deepDetour = false; autopilot = !!course; starMap.refresh(); }
            }
        } else scanProgress = Math.max(0, scanProgress - dt * 2.5);
    } else if (scanTarget?.deepFind) { scanTarget = null; scanProgress = 0; }
}
// In a belt or swarm, or close to a comet: hold E to record it (codex, as a sky event).
const spaceEntry = (o) => ({ kind: "phenomenon", seed: String(system.seed), bodyId: "space", id: o.id, traits: { type: o.kind, name: o.name.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase()), deep: true }, world: { name: system.name, giant: false, moon: false, life: "none" } });
let spaceHere = null;
function updateSpaceRecord(dt, global) {
    const t = orbitClock(), objs = spaceView.objs, p = global.toArray();
    let here = null;
    if (rockDensity(system, objs, p, t) > 0.15) {
        const rho = Math.hypot(p[0], p[2]);
        here = objs.belts.find((b) => Math.abs(rho - b.R) < b.width * .6) || objs.trojans.find((tr) => rockDensity(system, { belts: [], trojans: [tr] }, p, t) > 0.1) || null;
    }
    const c = spaceView.nearestComet(p, t);
    if (!here && c && c.d < 4000) here = c.c;
    if (here !== spaceHere) { spaceHere = here; if (here && !codex.has(spaceEntry(here))) toast(`${here.name.replace(/^the /, "").replace(/^./, (x) => x.toUpperCase())}. Hold E to record it.`, 5); }
    if (here) {
        const known = codex.has(spaceEntry(here));
        if (scanTarget?.spaceObj !== here) { scanTarget = { kind: "phenomenon", id: here.kind, spaceObj: here, deepFind: here, ref: { name: here.name.replace(/^the /, "") }, known }; scanProgress = 0; }
        scanTarget.known = known;
        const held = scanHeld();
        if (!held) scanNeedsRelease = false;
        if (!known && held && !scanNeedsRelease) {
            scanProgress += dt / RECORD_TIME;
            if (scanProgress >= 1) { scanProgress = 0; scanNeedsRelease = true; const info = recordInfo(spaceEntry(here)); scanUI.flash(); toast(`${scanTarget.ref.name} recorded in your codex.${info.text || ""}`, 7); }
        } else scanProgress = Math.max(0, scanProgress - dt * 2.5);
    } else if (scanTarget?.spaceObj) { scanTarget = null; scanProgress = 0; }
}
function updateDeep(dt) {
    const steer = steering();
    // Between stars there is nothing to slide past, so A/D turn here.
    strafeSpeed = 0;
    const yaw = clamp((keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0) + arrowTurn(), -1, 1);
    const m = takeMouseSteer(dt);
    shipForward.applyAxisAngle(spaceUp, yaw * dt * 0.85 + m.yaw);
    const right = shipForward.clone().cross(spaceUp).normalize();
    const pitch = (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
    shipForward.applyAxisAngle(right, pitch * dt * 0.7 + m.pitch).normalize();
    spaceUp.applyAxisAngle(right, pitch * dt * 0.7 + m.pitch).normalize();
    bankAngle = damp(bankAngle, clamp(yaw * 0.25 + m.rate * 0.12, -0.45, 0.45), 4, dt);
    // With a course set, the ship holds its heading toward it whenever you are
    // not steering; steering takes over until you let go.
    let want = null;
    if ((course || deepTarget) && !steer) {
        want = deepTarget ? toScene(findOffset(deepTarget)).normalize() : courseAim();
        turnToward(want, dt);
    }
    const manualThrottle = keys.has("KeyW") || keys.has("KeyS") || keys.has("KeyX");
    if (autopilot && want && !manualThrottle) throttle = damp(throttle, shipForward.dot(want) > 0.97 ? 1 : 0.15, 1.5, dt);
    else if (keys.has("KeyX")) throttle = damp(throttle, 0, 4, dt);
    else throttle = clamp(throttle + ((keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)) * dt * 0.45, 0, 1);
    const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const nearest = sky.stars[0];
    const d = nearest ? nearest.distance : 1;
    // Finds between the stars (deep-finds.mjs) slow the drive as you near them, as stars do,
    // and a nebula's gas holds it back while you are inside.
    // The sensors look about a second of flight ahead, so even at full drive nothing is skipped
    // between two scans. Finds already recorded don't slow you, unless you are heading for one.
    if ((deepScanAt -= dt) <= 0) { deepScanAt = 0.25; deepNear = findsNear(galactic, Math.min(4, DETECT_LY + 0.25 + deepSpeed * 1.2)); }
    let dFind = Infinity, inNebula = null;
    for (const n of deepNear) {
        const off = findOffset(n.f), dd = Math.hypot(...off);
        n.d = dd; n.edge = dd - n.f.size;
        if (n.f.kind === "nebula") { if (n.edge < 0) inNebula = n.f; continue; }
        if (knownFinds[n.f.id]?.recorded && n.f !== deepTarget) continue;
        // Approaching your target, the drive eases in hard so you come to rest beside it.
        const left = Math.max(0, n.edge - n.f.stop * 0.6);
        dFind = Math.min(dFind, n.f === deepTarget ? left * 0.5 : left);
    }
    const lyPerSecond = (throttle * Math.max(Math.min(d, dFind + 0.0004), 0.0008)) / (boost ? DRIVE_TIME / 2.5 : DRIVE_TIME) * (inNebula ? 0.45 : 1);
    deepSpeed = lyPerSecond;
    const step = toGalaxy(shipForward);
    // Never more than half the way to a find in one frame (a slow frame can't jump past it).
    const move = Math.min(lyPerSecond * dt, dFind * 0.5 + 0.0002);
    for (let i = 0; i < 3; i++) galactic[i] += step[i] * move;
    updateFinds(dt, inNebula);
    speed = 120 + throttle * 600; // for engine glow
    verticalSpeed = 0;
    sky.update(galactic, camera);
    orientSpace(dt);
    driveFade = damp(driveFade, 1, 1.2, dt);
    drivePower = throttle * (boost ? 1 : 0.7);
    streaks.update(camera, shipForward, drivePower * driveFade, dt);
    if (!nearest) return;
    // Light comes from the nearest star.
    const toStar = toScene(starPoint(nearest.star).map((v, i) => v - galactic[i])).normalize();
    sun.position.copy(toStar).multiplyScalar(1000);
    sun.color.copy(sunBase.set(nearest.physics.color).lerp(new THREE.Color(0xffffff), 0.45));
    sun.intensity = 3.1 * clamp(0.25 + 0.75 * (ARRIVE_LY * 30) / Math.max(d, ARRIVE_LY), 0.25, 1);
    // The star ahead grows into a sphere as you close in.
    const offset = starPoint(nearest.star).map((v, i) => v - galactic[i]);
    if (d < 0.3)
        nearStar.show(camera, offset, edgeOf(nearest.star) / ARRIVE_LY, starGameRadius(nearest.physics), nearest.physics.color);
    else nearStar.hide();
    showSystemAhead(nearest, offset, d);
    // Build the system ahead before you get there.
    if (d < PREPARE_LY && nearest.star.id !== loadedId && incoming?.star.id !== nearest.star.id)
        startIncoming(nearest.star);
    if (d < ARRIVE_LY) {
        // Enter when this star is your course, when you have no course, or when
        // you steer into it yourself. Otherwise the drive skims past its edge.
        const entering = shipForward.dot(toStar) > 0.2 && (!course || course.id === nearest.star.id || steer);
        const ready = nearest.star.id === loadedId || (incoming?.ready && incoming.star.id === nearest.star.id);
        if (entering && ready) return arriveInSystem(nearest.star, offset);
        const back = offset.map((v) => -v / d);
        galactic = starPoint(nearest.star).map((v, i) => v + back[i] * ARRIVE_LY);
        if (entering) {
            throttle = Math.min(throttle, 0.2);
            if (toastTime <= 0) toast(`Charting the ${starName(nearest.star)} system…`, 1.5);
        }
    }
}
// offset: star minus ship (ly). Enters the star's system at its edge, on the
// side you came from, still heading the way you were flying.
function arriveInSystem(star, offset) {
    const fresh = star.id !== loadedId;
    if (fresh) {
        systemView.dispose();
        systemView = incoming.view;
        system = incoming.system;
        spaceView.dispose(); spaceView = createSpaceObjectsView(scene, system);
        incoming = null;
        currentStar = star;
        loadedId = star.id;
        offChart = false;
        edge = systemEdge(system);
        galaxyState.current = star.id;
        galaxyState.visited.add(star.id);
        saveGalaxyState(galaxyState);
        try {
            history.replaceState(null, "", `?star=${star.id}`);
        } catch {}
        clearSites();
        starMap.setHere(star, system);
        loadSurvey(null);
        setupPatrol();
        if (course?.id === star.id) course = null;
    }
    nearStar.hide();
    worldDots.hide();
    findViews.hide(); nebulaIn = 0; nebulaFind = null; deepNear = [];
    if (scanTarget?.deepFind) scanTarget = null;
    if (shownView && shownView !== incoming?.view) shownView.visible = false;
    shownView = ahead = null;
    autopilot = false;
    positions = systemPositions(system, orbitClock());
    const d = Math.hypot(...offset);
    const entry = toScene(offset.map((v) => -v / d)).multiplyScalar(edge * 0.97);
    // Coordinates are kept relative to the nearest solid world.
    if (fresh || !site) {
        activeBody = system.bodies
            .filter((b) => !b.giant)
            .sort((a, b) => positionOf(a).distanceTo(entry) - positionOf(b).distanceTo(entry))[0];
        RADIUS = activeBody.radius;
        signalNormal = vec(...terrainFor(activeBody).site);
        landingNormal = vec(...terrainFor(activeBody).landing);
        discovered = records.has(activeBody.id);
    }
    worldOrigin = positionOf(activeBody);
    shipPosition.copy(entry).sub(worldOrigin);
    camera.position.add(shipPosition);
    mode = "space";
    // Come in at the speed the drive had and ease down from there (it used to stop dead).
    speed = Math.max(150, throttle * (edge / DRIVE_TIME));
    systemView.visible = true;
    if (site) site.group.visible = true;
    sun.intensity = 3.1;
    sun.color.copy(sunBase.set(system.star.color).lerp(new THREE.Color(0xffffff), 0.45));
    positionSystem();
    sky.update(starPoint(star), camera, star.id);
    selectedBody = null;
    target = null;
    if (pendingBody && system.bodies.some((b) => b.id === pendingBody.id)) {
        // The world you picked on the way in: aim for it.
        selectedBody = target = system.bodies.find((b) => b.id === pendingBody.id);
    }
    pendingBody = null;
    refreshWorldLabels();
    toast(
        fresh
            ? `Entering the ${system.name} system: ${system.bodies.length} worlds around a ${system.star.physics.spectralClass} star. Press M to choose one.`
            : `Back in the ${system.name} system.`,
        6,
    );
}
// What the HUD shows in deep space.
function deepInfo() {
    if (mode !== "deep") {
        if (!course || target) return null;
        const d = Math.hypot(...starPoint(course).map((v, i) => v - viewer()[i]));
        return { name: starName(course), isCourse: true, autopilot, distance: d, point: towardStar(course).multiplyScalar(5000).add(camera.position) };
    }
    const nearest = sky.stars[0];
    if (deepTarget) {
        const off = findOffset(deepTarget), nd = nearest ? nearest.distance : 1;
        return { name: findLabel(deepTarget), isCourse: true, autopilot, distance: Math.max(0, Math.hypot(...off) - deepTarget.size), nearestName: nearest ? starName(nearest.star) : "", nearestDistance: nd,
            lightSpeeds: ((throttle * Math.max(nd, 0.0008)) / DRIVE_TIME) * 31557600, point: toScene(off).normalize().multiplyScalar(5000).add(camera.position) };
    }
    const aimed = course || nearest?.star;
    if (!aimed) return null;
    const offset = starPoint(aimed).map((v, i) => v - galactic[i]);
    const d = Math.hypot(...offset);
    const nd = nearest ? nearest.distance : 1;
    return {
        name: pendingBody && course ? `${pendingBody.name} · ${starName(course)}` : starName(aimed),
        isCourse: !!course,
        autopilot,
        distance: d,
        nearestName: nearest ? starName(nearest.star) : "",
        nearestDistance: nd,
        // Multiples of light speed.
        lightSpeeds: ((throttle * Math.max(nd, 0.0008)) / DRIVE_TIME) * 31557600,
        point: (course ? courseAim() : toScene(offset).normalize()).multiplyScalar(5000).add(camera.position),
    };
}
// After a jump: in open space a little way from a world, on its sunlit side,
// facing it. Fly in to reach its orbit.
function arriveNear(body) {
    mode = "space";
    const sunward = positionOf(body).negate().normalize();
    const side = sunward.clone().cross(Y).normalize();
    const dir = sunward.multiplyScalar(0.8).addScaledVector(side, 0.45).addScaledVector(Y, 0.3).normalize();
    shipPosition.copy(dir).multiplyScalar(body.radius * 3 + 1100);
    shipForward = shipPosition.clone().negate().normalize();
    spaceUp.copy(Y).addScaledVector(shipForward, -Y.dot(shipForward)).normalize();
    speed = verticalSpeed = 0;
    selectedBody = target = body;
    camera.position.copy(shipPosition).addScaledVector(shipForward, -30).addScaledVector(spaceUp, 12);
    camera.up.copy(spaceUp);
    camera.lookAt(shipPosition.clone().addScaledVector(shipForward, 32));
    orientSpace(1);
}
// Giants are visited from space: hold position facing the planet.
// The ship then moves with the giant along its orbit until you fly off, and turns
// to face it smoothly (it used to snap round, then drift away as the giant moved on).
let holding = null; // { body, last: global position of the body } while holding above a giant
function arriveAtGiant(body) {
    mode = "space";
    speed = 0;
    verticalSpeed = 0;
    selectedBody = target = body; // the nose turns to it gradually (updateSpace)
    holding = { body, last: positionOf(body) };
    keys.clear();
    visited.add(body.id);
    const worldNote = record(worldEntry(system, body));
    saveSurvey();
    const moons = system.bodies.filter((b) => b.parent === body.id);
    toast(
        `Holding above ${body.name}. No surface to land on${moons.length ? `: chart a course to ${moons.map((m) => m.name).join(" or ")}` : ""}.${worldNote}`,
        6,
    );
}
$("cancelTransit").onclick = cancelCruise;
$("seedForm").onsubmit = (e) => {
    e.preventDefault();
    const value = $("seedInput").value;
    if (!/^\d+$/.test(value) || Number(value) > 4294967295) return;
    location.search = `?seed=${value}`;
};
$("randomSystem").onclick = () => {
    const value = crypto.getRandomValues(new Uint32Array(1))[0];
    location.search = `?seed=${value}`;
};
// The world the ship is close to while flying in space: within a few of its radii (giants
// count as near out to their moons' reach), nearest first. Null when nothing is that close.
let mapFocus = null;
function worldNearShip() {
    let best = null, bd = Infinity;
    for (const b of system.bodies) {
        const d = positionOf(b).sub(worldOrigin).distanceTo(shipPosition) - b.radius;
        if (d < b.radius * (b.giant ? 1.6 : 2.5) && d < bd) { bd = d; best = b; }
    }
    return best;
}
function openMap() {
    if ($("help").open || $("discovery").open) return;
    keys.clear();
    // At a world (in its orbit, flying low, landed or on foot): the map opens on that world;
    // zooming out goes on to the system, the neighbourhood and the galaxy.
    // In deep space it opens on the ship, between the stars. Out in a system but close to a world
    // (a giant you are holding above, a moon you are passing), it opens on that world.
    mapFocus = mode === "space" ? worldNearShip() : null;
    starMap.open(mode === "deep" ? "local" : mapFocus ? "world" : ["space", "transit"].includes(mode) ? "system" : "world");
}
$("mapBtn").onclick = openMap;

function updateFlight(dt) {
    orbitEntry = Math.max(0, orbitEntry - dt / 3);
    const up = shipPosition.clone().normalize();
    if (autoApproach) {
        const goal = approachTo?.n || landingNormal,
            angle = up.angleTo(goal),
            currentRadius = shipPosition.length();
        const nextUp = up.clone();
        // Fast over open ground (up to ~300 m/s at height when the place is far), easing in as it nears.
        const dist = angle * currentRadius, cruiseSpeed = clamp(dist * 0.9, 12, 320);
        approachSpeed = damp(approachSpeed || speed || 20, cruiseSpeed, 1.2, dt);
        const turnStep = Math.min(angle, (approachSpeed / currentRadius) * dt);
        if (angle > 0.001) {
            const axis = up.clone().cross(goal).normalize();
            nextUp.applyAxisAngle(axis, turnStep);
            shipForward = tangent(goal.clone().sub(up), nextUp);
        }
        // High while far (clear of hills and towers at speed), down to 14 m on arrival.
        const targetRadius = surfaceRadius(nextUp) + 14 + clamp((dist - 60) * 0.18, 0, 160);
        const targetVertical = clamp(
            (targetRadius - currentRadius) * 0.8,
            -45,
            60,
        );
        verticalSpeed = damp(verticalSpeed, targetVertical, 2.2, dt);
        const radius = currentRadius + verticalSpeed * dt;
        shipPosition.copy(nextUp.multiplyScalar(radius));
        speed = angle > 0.001 ? (turnStep / dt) * radius : 0;
        flightPitch = damp(flightPitch, 0, 3, dt);
        bankAngle = damp(bankAngle, 0, 3, dt);
        if (angle < 0.012 && altitude() < 18) {
            autoApproach = false;
            approachSpeed = 0;
            speed = 0;
            toast(`Approach complete${approachTo ? `: ${approachTo.name}.${approachTo.note}` : "."} Press L to land.`, 5);
        }
    } else {
        strafeSpeed = 0;
        const turn = clamp((keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0) + arrowTurn(), -1, 1);
        turnVelocity = damp(turnVelocity, turn * 1.0, 4, dt);
        const m = takeMouseSteer(dt);
        shipForward.applyAxisAngle(up, turnVelocity * dt + m.yaw);
        bankAngle = damp(bankAngle, clamp(turnVelocity * 0.3 + m.rate * 0.15, -0.5, 0.5), 4, dt);
        const pitchInput =
            (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
        // The mouse sets a nose angle that holds while you steer and eases back
        // to level once you leave it alone; the arrow keys pitch while held.
        aimPitch = clamp(aimPitch + m.pitch * 1.5, -0.65, 0.65);
        if (pitchInput) aimPitch = 0;
        else if (performance.now() - lastMouseSteer > 1500) aimPitch = damp(aimPitch, 0, 0.5, dt);
        flightPitch = damp(flightPitch, pitchInput ? pitchInput * 0.65 : aimPitch, 2.4 * (1 - 0.8 * smoothstep(orbitEntry)), dt);
        const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const braking = keys.has("KeyX");
        let targetSpeed =
            ((keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)) *
            (boost ? 100 : 40);
        if (braking) targetSpeed = 0;
        speed = damp(speed, targetSpeed, braking ? 5 : 1.7, dt);
        const lift = (keys.has("KeyR") ? 1 : 0) - (keys.has("KeyF") ? 1 : 0);
        // Pressure hull: holding F right down on deep water takes the Petrel under.
        if (lift < 0 && altitude() < 7 && canDiveHere() && depthAt(shipPosition.clone().normalize()) > 0) {
            if ((diveHold += dt) > 0.5 && tryDive()) return;
        } else diveHold = 0;
        const desiredVertical = braking
            ? 0
            : verticalTarget(lift, flightPitch, speed, boost, altitude());
        verticalSpeed = damp(
            verticalSpeed,
            desiredVertical,
            braking ? 5 : lift ? 2.2 : 3.2,
            dt,
        );
        const radius = shipPosition.length() + verticalSpeed * dt;
        const n = shipPosition
            .clone()
            .addScaledVector(shipForward, speed * Math.cos(flightPitch) * dt)
            .normalize();
        const floor = surfaceRadius(n) + 3.2;
        const boundedRadius = Math.max(radius, floor);
        if (boundedRadius !== radius) verticalSpeed = 0;
        shipPosition.copy(n.multiplyScalar(boundedRadius));
    }
    collideShip();
    orientShip(dt);
    const global = shipPosition.clone().add(worldOrigin);
    const neighbor = system.bodies
        .filter((body) => body.id !== activeBody.id && !body.giant)
        .map((body) => ({
            body,
            clearance: global.distanceTo(positionOf(body)) - body.radius,
        }))
        // Switch only when clearly closer to the other world, and not straight after a
        // switch: near a moon and its planet the two were otherwise swapped back and forth.
        .filter((item) => item.clearance < 240 && item.clearance < altitude() * 0.6 && animationTime - lastSwitch > 2)
        .sort((a, b) => a.clearance - b.clearance)[0];
    if (neighbor) {
        switchWorld(neighbor.body, global);
        return;
    }
    if (altitude() > 600) {
        mode = "space";
        shipForward = shipForward
            .clone()
            .multiplyScalar(Math.cos(flightPitch))
            .addScaledVector(up, Math.sin(flightPitch))
            .normalize();
        spaceUp.copy(up);
        autoApproach = false;
        // Breaking orbit: the climb carries on for a moment and the camera eases
        // back so you see the world fall away below.
        exitClimb = clamp(verticalSpeed, 45, 140);
        exitGlide = 1;
        reveal = 1;
        toast(`Leaving ${activeBody.name}'s orbit. Fly freely, or press M to chart a course.`);
    }
}
// --- The Petrel under water (Pressure hull I and II) ----------------------------
// Fly low over deep water and hold F (or press F while afloat): the hull seals, the wings
// fold and the Petrel dives. W/S throttle, A/D or the mouse turn, R/F rise and sink, X stops.
// It keeps clear of the sea floor and no deeper than its hull is rated for. Hold R at the
// surface to break out and fly. E scans what is in front of you, or (Dive suit) swims out.
let diveHold = 0, diveRise = 0, lastDiveWarn = -10;
function tryDive() {
    if (!canDiveHere()) return false;
    const n = shipPosition.clone().normalize();
    if (depthAt(n) < 6) {
        if (toastTime <= 0) toast("Too shallow to dive here. Find water at least 6 m deep.");
        return false;
    }
    mode = "dive";
    afloat = false; autoApproach = false; diveHold = diveRise = 0;
    speed = Math.min(Math.abs(speed), 6); verticalSpeed = -1.5; flightPitch = 0; bankAngle = 0;
    shipPosition.setLength(Math.min(shipPosition.length(), seaRadius() - 1.5));
    toast("Hull sealed, wings folded: the Petrel dives. W/S throttle, A/D turn, R/F rise and sink, E to scan" + (swimDepth(codex.unlocked) ? " or swim out." : "."), 6);
    return true;
}
function updateDive(dt) {
    const up = shipPosition.clone().normalize();
    const turn = clamp((keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0) + arrowTurn(), -1, 1);
    turnVelocity = damp(turnVelocity, turn * 0.8, 4, dt);
    const m = takeMouseSteer(dt);
    shipForward.applyAxisAngle(up, turnVelocity * dt + m.yaw);
    bankAngle = damp(bankAngle, clamp(turnVelocity * 0.15, -0.25, 0.25), 3, dt);
    const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const throttle = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    speed = damp(speed, keys.has("KeyX") ? 0 : throttle * (boost ? 14 : 8), keys.has("KeyX") ? 4 : 1.2, dt);
    const lift = (keys.has("KeyR") ? 1 : 0) - (keys.has("KeyF") ? 1 : 0) + ((keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0)) * 0.6;
    verticalSpeed = damp(verticalSpeed, keys.has("KeyX") ? 0 : lift * 4, 2, dt);
    flightPitch = damp(flightPitch, clamp(verticalSpeed * 0.08, -0.35, 0.35), 2, dt);
    const sea = seaRadius(), limit = diveDepth(codex.unlocked);
    let n = shipPosition.clone().addScaledVector(shipForward, speed * dt).normalize();
    if (depthAt(n) < 3.5) {
        n = up; speed *= 0.5;
        if (toastTime <= 0) toast("Too shallow for the Petrel to go on submerged. Turn back, or rise and fly out (hold R).");
    }
    let r = Math.max(shipPosition.length() + verticalSpeed * dt, bedRadius(n) + 2.4);
    if (sea - r > limit) {
        r = sea - limit; verticalSpeed = Math.max(0, verticalSpeed);
        if (animationTime - lastDiveWarn > 6) { lastDiveWarn = animationTime; toast(`The hull groans: ${limit} m is as deep as it is rated for.` + (codex.unlocked.has("pressureHull2") ? "" : " Pressure hull II goes deeper.")); }
    }
    if (r >= sea - 0.8) { // at the surface: hold R to break out and fly
        r = sea - 0.8;
        diveRise = lift > 0 ? diveRise + dt : 0;
        if (diveRise > 0.7) {
            mode = "flight";
            shipPosition.copy(n).multiplyScalar(sea + 3.6);
            verticalSpeed = 6; flightPitch = 0;
            toast("The Petrel breaks the surface, unfolds its wings and lifts off.");
            orientShip(dt);
            return;
        }
    } else diveRise = 0;
    shipPosition.copy(n).multiplyScalar(r);
    collideShip();
    orientShip(dt);
    updateScan(dt);
}
// E in the Petrel under water: a recorded thing shows its card; with a Dive suit and
// nothing to scan, you swim out (the Petrel waits where it is).
function diveAct() {
    if (scanTarget?.known) return showScanCard(scanTarget, null);
    if (scanTarget) return; // hold E to scan (updateScan)
    if (!canSwimHere()) { toast(codex.unlocked.has("diveSuit") ? "Your suit is not sealed for this sea." : "You need a Dive suit to leave the Petrel under water."); return; }
    const up = shipPosition.clone().normalize(), right = shipForward.clone().cross(up).normalize();
    playerNormal = shipPosition.clone().addScaledVector(right, 6).normalize(); // out of the side hatch, facing away from the hull
    playerForward = tangent(right, playerNormal);
    swimming = true; swimD = Math.max(0, seaRadius() - shipPosition.length()); eyeRadius = null; lookPitch = 0;
    shipSubmerged = true; speed = 0; verticalSpeed = 0;
    mode = "walk";
    toast("You swim out of the Petrel. Space or R to rise, F to sink. Swim back and press E to board.", 5);
}
function updateManeuver(dt) {
    maneuver.time += dt;
    const t = clamp(maneuver.time / maneuver.duration, 0, 1);
    const before = shipPosition.clone();
    bankAngle = damp(bankAngle, 0, 5, dt);
    flightPitch = damp(flightPitch, 0, 5, dt);
    speed = damp(speed, 0, 5, dt);
    if (mode === "landing") {
        const ease = smootherstep(t);
        shipPosition
            .copy(maneuver.normal)
            .multiplyScalar(
                surfaceRadius(maneuver.normal) +
                    1.7 +
                    maneuver.height * (1 - ease),
            );
        verticalSpeed =
            shipPosition.clone().sub(before).dot(maneuver.normal) / dt;
        if (t >= 1) {
            mode = "landed";
            verticalSpeed = 0;
            speed = 0;
            maneuver = null;
            toast(afloat ? `Splashdown. The Petrel rides the swell.${canDiveHere() ? " Press F to dive." : " Take off and land on shore to go on foot."}` : `Touchdown. Engines idle. Press E to leave the ${shipName()}.`);
            if (!afloat) arriveAtTown();
            keepPlace("landing");
        }
    } else {
        // Charge, lift vertically, then gently hand control back above the terrain.
        const liftT = clamp((t - 0.16) / 0.84, 0, 1);
        const height = 22 * smootherstep(liftT);
        shipPosition
            .copy(maneuver.normal)
            .multiplyScalar(surfaceRadius(maneuver.normal) + 1.7 + height);
        verticalSpeed =
            shipPosition.clone().sub(before).dot(maneuver.normal) / dt;
        if (t >= 1) {
            mode = "flight";
            verticalSpeed = 0;
            speed = 0;
            maneuver = null;
            if (stage === 2) {
                completed = true;
                setStage(3);
                toast("Signal recorded. Press M to choose your next world.");
            } else toast("Clear of the surface. You have control.");
        }
    }
    orientShip(dt);
}

// The ship's velocity relative to the world it is near (for the camera and the
// dust rushing past), measured from how far it actually moved.
function updateFlow(dt) {
    const flying = started && mode !== "deep" && mode !== "walk" && mode !== "landed" && mode !== "deck";
    if (!flying || lastBodyId !== activeBody.id || !lastLocal) {
        if (!flying) flowVel.set(0, 0, 0);
        shipVel.set(0, 0, 0);
        lastLocal = flying ? shipPosition.clone() : null;
        lastBodyId = activeBody.id;
        spaceDust.hide();
        return;
    }
    // Under your own control, the ship's own motion (worlds drift along their
    // orbits, which shouldn't read as speed); on autopilot, how far it moved.
    let v;
    if (mode === "space") {
        const right = shipForward.clone().cross(spaceUp).normalize();
        v = shipForward.clone().multiplyScalar(speed).addScaledVector(spaceUp, verticalSpeed).addScaledVector(right, strafeSpeed);
    } else if (mode === "flight")
        v = shipForward.clone().multiplyScalar(speed * Math.cos(flightPitch)).addScaledVector(shipPosition.clone().normalize(), verticalSpeed);
    else v = shipPosition.clone().sub(lastLocal).divideScalar(Math.max(dt, 1e-3));
    lastLocal.copy(shipPosition);
    if (v.length() < 400000) { flowVel.lerp(v, 1 - Math.exp(-dt * 8)); shipVel.copy(v); } // (bigger is a jump: a rebase or arrival)
    else shipVel.set(0, 0, 0);
    const s = flowVel.length();
    const power = clamp((s - 30) / 1000, 0, 1);
    if (power > 0.02)
        spaceDust.update(camera, flowVel.clone().normalize(), power, dt, {
            speed: s,
            len: clamp(s * 0.022, 0.8, 18),
            opacity: (0.03 + 0.11 * power) * (0.45 + 0.55 * smoothstep(spaceBlend)),
        });
    else spaceDust.hide();
}
// Shows the surface of the nearest other world once you are within a few km of it
// (see approachSite), and keeps it where that world is.
function updateApproachSite() {
    let best = null,
        clearance = Infinity;
    if (started && (mode === "space" || mode === "flight" || mode === "transit")) {
        const cam = camera.position.clone().add(worldOrigin);
        for (const b of system.bodies) {
            if (b === activeBody || b.giant) continue;
            const c = cam.distanceTo(positionOf(b)) - b.radius;
            if (c < clearance) {
                clearance = c;
                best = b;
            }
        }
    }
    const want = best && clearance < (best === approachBody ? 7000 : 6000) ? best : null;
    if (want !== approachBody) {
        if (approachSite && approachSite !== site) scene.remove(approachSite.group);
        approachBody = want;
        approachSite = want ? siteFor(want) : null;
        if (approachSite) {
            approachSite.halo.farFrom.value = want.radius + 3500;
            approachSite.halo.farTo.value = want.radius + 5800;
            approachSite.group.visible = true;
            scene.add(approachSite.group);
        }
    }
    if (approachSite) approachSite.group.position.copy(positionOf(approachBody)).sub(worldOrigin);
}
function updateWalk(dt) {
    const turn =
        (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
    playerForward.applyAxisAngle(playerNormal, turn * dt * 1.6);
    lookPitch = clamp(
        lookPitch +
            ((keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0)) *
                dt,
        -1.15,
        1.1,
    );
    const right = playerForward.clone().cross(playerNormal).normalize();
    const direction = playerForward
        .clone()
        .multiplyScalar((keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0))
        .addScaledVector(
            right,
            (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
        );
    const moving = direction.lengthSq() > 0.01;
    footTime += dt;
    if (swimming) return updateSwim(dt, direction, moving);
    // Wading slows you down, more the deeper it gets.
    const wading = clamp(depthAt(playerNormal) / WADE_DEPTH, 0, 1);
        const walkingSpeed =
        (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 8 : 4.5) * (1 - 0.55 * wading);
    // Jumping: gravity follows the world's surface gravity, so moons give floaty leaps.
    const gravity = 9.8 * Math.max(0.15, activeBody.physics?.gravity ?? 1);
    if (keys.has("Space") && jumpHeight <= 0 && wading < 0.5) jumpVelocity = 4.4;
    if (jumpHeight > 0 || jumpVelocity > 0) {
        jumpHeight += jumpVelocity * dt;
        jumpVelocity -= gravity * dt;
        if (jumpHeight <= 0) {
            jumpHeight = 0;
            jumpVelocity = 0;
        }
    }
    if (moving) {
        direction.normalize();
        // Steep uphill slows you down (to a third on the steepest ground); downhill doesn't.
        const step = walkingSpeed * dt;
        const ahead = surfacePoint(playerNormal).addScaledVector(direction, Math.max(step, 0.3)).normalize();
        const rise = (surfaceRadius(ahead) - surfaceRadius(playerNormal)) / Math.max(step, 0.3);
        const uphill = clamp(1 - Math.max(0, rise - 0.35) * 0.9, 0.33, 1);
        const next = resolveCollisions(
            surfacePoint(playerNormal)
                .addScaledVector(direction, step * uphill)
                .normalize(),
        );
        // Into the water: wade up to WADE_DEPTH; deeper, swim (Dive suit) or turn back.
        const lava = terrainFor(activeBody).liquid === "lava" && terrainFor(activeBody).isLiquid(next);
        const d = depthAt(next), tooDeep = d > WADE_DEPTH, sulfur = d > 0 && !wadable();
        if (lava || sulfur || (tooDeep && !canSwimHere())) {
            if (toastTime <= 0)
                toast(lava ? "Lava ahead. Too hot to go further."
                    : sulfur ? "Molten sulfur: far too hot to wade into."
                    : swimDepth(codex.unlocked) > 0 ? "Your suit is not sealed for this sea."
                    : "The water is too deep to wade further." + (codex.unlocked.has("pressureHull1") ? " A Dive suit would let you swim." : ""));
        } else {
            playerNormal.copy(next);
            if (tooDeep) { swimming = true; swimD = -0.2; jumpHeight = jumpVelocity = 0; toast("You swim out. Space or R to rise, F to sink, look where you want to go.", 4); }
        }
    }
    playerForward = tangent(playerForward, playerNormal);
            bob += moving && jumpHeight <= 0 ? dt * walkingSpeed * 1.8 : 0;
    speed = moving ? walkingSpeed : 0;
    updateScan(dt);
}
// Swimming (Dive suit): you move where you look; Space or R rises, F sinks. Your eyes
// stay between the sea floor and just above the surface, no deeper than the suit allows.
// Back in the shallows, you stand up and wade out.
function updateSwim(dt, direction, moving) {
    const fast = keys.has("ShiftLeft") || keys.has("ShiftRight"), v = fast ? 4.5 : 2.6;
    const rise = (keys.has("Space") || keys.has("KeyR") ? 1 : 0) - (keys.has("KeyF") ? 1 : 0);
    let climb = rise * 2.2;
    if (moving) {
        direction.normalize();
        const along = direction.dot(playerForward); // forward/back follows the look pitch
        climb += Math.sin(lookPitch) * along * v;
        const step = v * dt * (moving ? Math.max(0.35, Math.cos(lookPitch * Math.abs(along))) : 0);
        const next = resolveCollisions(playerNormal.clone().multiplyScalar(seaRadius()).addScaledVector(direction, step).normalize());
        if (depthAt(next) > 0.3 || swimD < 0.4) playerNormal.copy(next);
    }
    const limit = swimDepth(codex.unlocked);
    swimD = clamp(swimD - climb * dt, -0.25, limit);
    if (swimD >= limit - 0.05 && rise < 0 && toastTime <= 0) toast(`Your suit is rated to ${limit} m.`);
    // Never below the sea floor.
    swimD = Math.min(swimD, seaRadius() - (bedRadius(playerNormal) + 0.5));
    // Shallow enough to stand: wade out.
    if (depthAt(playerNormal) <= WADE_DEPTH && swimD < 0.5) { swimming = false; eyeRadius = null; }
    playerForward = tangent(playerForward, playerNormal);
    speed = moving ? v : 0;
    updateScan(dt);
}
let jumpHeight = 0,
    jumpVelocity = 0,
    eyeRadius = null; // smoothed eye distance from the world's centre while walking
// Ground radius averaged over a stride-sized footprint around a point (centre and four
// points 0.45 m away), so walking follows the lie of the land rather than every pebble.
function footHeight(n) {
    const a = tangent(Math.abs(n.y) < 0.9 ? Y.clone() : vec(1, 0, 0), n), b = n.clone().cross(a), e = 0.45 / RADIUS;
    let sum = bedRadius(n) * 2; // in the shallows, the sea bed (you wade, you don't walk on the water)
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        sum += bedRadius(n.clone().addScaledVector(a, da * e).addScaledVector(b, db * e).normalize());
    return sum / 6;
}
const PLAYER_RADIUS = 0.35;
// Slide around obstacles: push the next step out of anything taller than your feet.
function resolveCollisions(next) {
    const p = next.clone().multiplyScalar(surfaceRadius(next));
    const list = site.nearbyObstacles(p);
    list.push({ p: shipPosition.clone(), r: 3.2, h: 4 }); // the parked ship
    systemView.obstaclesNear?.(activeBody.id, p).forEach((o) => list.push(o)); // a world-city's towers
    for (let pass = 0; pass < 2; pass++) {
        const up = p.clone().normalize();
        for (const o of list) {
            if (jumpHeight > o.h) continue; // high enough to clear it
            const d = p.clone().sub(o.p);
            d.addScaledVector(up, -d.dot(up));
            const min = o.r + PLAYER_RADIUS,
                len = d.length();
            if (len < min && len > 1e-6) p.addScaledVector(d, (min - len) / len);
        }
    }
    return p.normalize();
}
// The ship can't fly through what has been built: buildings and towers near the site,
// the towers of a world-city, space elevators (megastructures.js) and an orbital ring.
// It slides round the side of a building, or rides up over its roof if it comes in
// close to the top.
const SHIP_RADIUS = 3.2;
function collideShip() {
    if (!site || altitude() > 400) return;
    const p = shipPosition, list = site.buildingsNear?.(p) ?? [];
    systemView.obstaclesNear?.(activeBody.id, p).forEach((o) => list.push(o));
    for (let pass = 0; pass < 2; pass++) {
        const up = p.clone().normalize(), alt = p.length();
        for (const o of list) {
            const top = o.p.length() + o.h;
            if (alt > top + SHIP_RADIUS * 0.6 || alt < o.p.length() - SHIP_RADIUS) continue;
            const d = p.clone().sub(o.p);
            d.addScaledVector(up, -d.dot(up));
            const len = d.length(), min = o.r + SHIP_RADIUS;
            if (len >= min) continue;
            if (alt > top - 2.5) { p.setLength(top + SHIP_RADIUS * 0.6); verticalSpeed = Math.max(0, verticalSpeed); }
            else if (len > 1e-6) { p.addScaledVector(d, (min - len) / len); speed *= 0.85; }
        }
    }
    // An orbital ring is a band round the world: go round it, not through it.
    const ring = systemView.ringOf?.(activeBody.id);
    if (ring) {
        const h = p.dot(ring.axis), inPlane = p.clone().addScaledVector(ring.axis, -h), off = inPlane.length() - ring.radius;
        const halfW = ring.width / 2 + SHIP_RADIUS, halfT = ring.thick + SHIP_RADIUS;
        if (Math.abs(h) < halfW && Math.abs(off) < halfT) {
            // out the nearer way: past an edge of the band, or above or below it
            if (halfW - Math.abs(h) < halfT - Math.abs(off)) p.addScaledVector(ring.axis, (Math.sign(h) || 1) * (halfW - Math.abs(h)));
            else p.addScaledVector(inPlane.normalize(), (Math.sign(off) || 1) * (halfT - Math.abs(off)));
            speed *= 0.85;
        }
    }
}
// --- Stations (station-deck.js) ---------------------------------------------------
// Orbital, spacefaring and system-shaping civilizations keep a station with a landing
// deck on top. Fly up to it and press L to dock on the visitors' pad; E steps out onto
// the deck, where their crew meet you in their own way (welcoming, curious, wary or
// guarded, from their traits). E beside your ship boards it again; L undocks.
// Modes: "docking" (the ship settling onto the pad), "docked" (aboard on the pad),
// "deck" (on foot on the deck) and "undocking" (lifting off it).
const STATION_MODES = ["docking", "docked", "deck", "undocking"];
const atStation = () => STATION_MODES.includes(mode);
const DOCK_REACH = 90, // metres beyond the deck's rim from which you can dock
    SHIP_REST = 1.7; // the ship's centre above the pad, as on the ground
const deckM = new THREE.Matrix4(),
    deckQ = new THREE.Quaternion(),
    deckInv = new THREE.Matrix4(),
    tmpQ = new THREE.Quaternion(),
    tmpS = new THREE.Vector3();
let dock = null, // { deck, civ, ark } of the station you are at (ark: a spaceborne civilization's, megastation.js)
    deckX = 0, deckZ = 0, deckYaw = 0, // you, on foot on the deck (its own frame)
    deckY = 0, // how high you stand above the deck (an ark's walkways: megastation.js walk)
    greeted = new Set(), // stations whose crew have met you (this session)
    lastDockHint = -100;
const stationDeck = () => site?.structures?.deck || null;
const stationCiv = () => { const s = site?.structures; return s?.civ?.colony ? colonistOf(system, activeBody) : s?.civ; };
// Every deck in reach of this system: the station of the world you are at, and any arks.
function allDecks() {
    const out = [], d = stationDeck();
    if (d) out.push({ deck: d, civ: stationCiv(), ark: null });
    for (const a of systemView.arks?.() ?? []) out.push({ deck: a.deck, civ: a.civ, ark: a });
    return out;
}
// The deck's frame now (it moves with its station or ark): matrix, rotation and its inverse.
function deckFrame(deck = dock?.deck, ark = dock?.ark) {
    if (deck.place) deck.place(animationTime);
    else ark?.sync?.(systemView.starMesh.position);
    deck.group.updateWorldMatrix(true, false);
    deckM.copy(deck.group.matrixWorld);
    deckM.decompose(tmpS, deckQ, tmpS.clone());
    deckInv.copy(deckM).invert();
    return deckM;
}
const deckUp = () => vec(0, 1, 0).applyQuaternion(deckQ);
// The station deck you could dock at from here, with your ship in its frame, or null.
function dockable() {
    if (!["flight", "space"].includes(mode)) return null;
    let best = null;
    for (const e of allDecks()) {
        deckFrame(e.deck, e.ark);
        const local = shipPosition.clone().applyMatrix4(deckInv), reach = Math.hypot(local.x, local.z) - e.deck.radius;
        if (Math.abs(local.y) < 4000 && (!best || reach < best.reach)) best = { ...e, local, reach, dist: local.length() };
    }
    if (best) deckFrame(best.deck, best.ark); // leave the frame on the one chosen
    return best;
}
const padLocal = (deck = dock.deck) => vec(deck.pads[0].x, SHIP_REST, deck.pads[0].z);
// The ship's rotation on the visitors' pad: level, nose toward the deck's centre (or, lifting off, along +Z).
function padRotation(deck, alongZ = 0) {
    const p = deck.pads[0], fwd = vec(-p.x, 0, -p.z).normalize().lerp(vec(0, 0, 1), alongZ).normalize(), up = vec(0, 1, 0);
    const right = fwd.clone().cross(up).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd.clone().negate()));
}
function tryDock() {
    const near = dockable();
    if (!near || near.reach > DOCK_REACH) return false;
    const { deck, local } = near;
    if (local.y < -4) return toast(`Come round above the ${near.ark ? "ark's" : "station's"} deck to dock.`), true;
    if (Math.abs(speed) > 80) return toast("Slow below 80 m/s to dock (hold X to brake)."), true;
    dock = { deck, civ: near.civ, ark: near.ark };
    autoApproach = false;
    keys.clear();
    maneuver = { time: 0, duration: 6, start: local.clone(), rot: deckQ.clone().invert().multiply(ship.quaternion) };
    mode = "docking";
    toast(dock.ark ? `Docking on ${dock.ark.name}. The visitors' pad is lit for you.` : `Docking at the ${dock.civ?.species ? `${dock.civ.species.name} ` : ""}station. The visitors' pad is lit for you.`);
    return true;
}
// Ship pose from deck-frame position and rotation.
function placeShipOnDeck(local, rot) {
    shipPosition.copy(local).applyMatrix4(deckM);
    ship.position.copy(shipPosition);
    ship.quaternion.copy(deckQ).multiply(rot);
    shipForward.set(0, 0, -1).applyQuaternion(ship.quaternion);
    spaceUp.copy(deckUp());
}
function updateDocking(dt) {
    const deck = dock.deck;
    deckFrame();
    maneuver.time += dt;
    const t = clamp(maneuver.time / maneuver.duration, 0, 1), e = smootherstep(t);
    // Over the pad first, then straight down onto it.
    const P0 = maneuver.start, P2 = padLocal(), C = vec(P2.x, Math.max(P0.y, 18), P2.z);
    const local = P0.clone().multiplyScalar((1 - e) ** 2).addScaledVector(C, 2 * (1 - e) * e).addScaledVector(P2, e * e);
    const before = shipPosition.clone();
    placeShipOnDeck(local, maneuver.rot.clone().slerp(padRotation(deck), smoothstep(t * 1.4)));
    speed = 0;
    verticalSpeed = before.sub(shipPosition).length() / Math.max(dt, 1e-3) * (t < 1 ? -1 : 0);
    if (t >= 1) {
        mode = "docked";
        maneuver = null;
        verticalSpeed = 0;
        toast(`Docked. Press E to step out onto the deck, or L to undock.`, 5);
    }
}
function updateDocked() {
    deckFrame();
    placeShipOnDeck(padLocal(), padRotation(dock.deck));
}
function undock() {
    keys.clear();
    maneuver = { time: 0, duration: 3.5 };
    mode = "undocking";
    toast("Releasing the clamps. Lifting clear of the deck.");
}
function updateUndocking(dt) {
    deckFrame();
    maneuver.time += dt;
    const t = clamp(maneuver.time / maneuver.duration, 0, 1);
    const local = padLocal().add(vec(0, 26 * smootherstep(t), 0));
    placeShipOnDeck(local, padRotation(dock.deck, smoothstep(t)));
    verticalSpeed = t < 1 ? 7 : 0;
    if (t < 1) return;
    // Clear of the deck: fly on as usual, in space or in the world's sky.
    maneuver = null;
    speed = verticalSpeed = 0;
    flightPitch = bankAngle = turnVelocity = 0;
    dock = null;
    lastDockHint = animationTime; // no "press L to dock" straight after leaving
    if (altitude() > 600) {
        mode = "space";
        spaceUp.copy(deckUp());
        toast("Clear of the station. You have control.");
    } else {
        mode = "flight";
        shipForward = tangent(shipForward, shipPosition.clone().normalize());
        if (shipForward.lengthSq() < 0.1) shipForward = tangent(deckUp(), shipPosition.clone().normalize());
        toast("Clear of the station. You have control.");
    }
}
// Stepping out onto the deck beside the ship, facing the spire.
function leaveShipOnDeck() {
    const p = dock.deck.pads[0], toC = vec(-p.x, 0, -p.z).normalize();
    deckY = 0;
    deckX = p.x + toC.x * 5.5 - toC.z * 2;
    deckZ = p.z + toC.z * 5.5 + toC.x * 2;
    deckYaw = Math.atan2(toC.z, toC.x);
    lookPitch = 0.05;
    jumpHeight = jumpVelocity = 0;
    mode = "deck";
    deckTime = 0;
    keepPlace(dock.ark ? "ark" : "station", dock.ark?.name || (dock.civ?.species?.name ? `the station of the ${plural(dock.civ.species.name)}` : "a station"));
    const key = dock.civ?.id ?? activeBody.id;
    if (!greeted.has(key)) {
        greeted.add(key);
        const home = dock.ark ? system.bodies.find((b) => b.id === dock.civ.home) || activeBody : activeBody;
        const info = recordInfo(stationEntry(system, home, dock.civ, dock.deck.stance));
        if (info.added) showScanCard({ kind: "station", ref: dock.civ || {}, deck: dock.deck, ark: dock.ark }, info);
        setTimeout(() => { if (mode === "deck" && dock?.deck.greeting) toast(dock.deck.greeting, 6); }, 1800);
    } else toast(dock.ark ? `Back on the deck of ${dock.ark.name}.` : `Back on the deck of the ${dock.civ?.species?.name ?? ""} station.`.replace("  ", " "));
}
const shipOnDeck = () => (dock ? { x: dock.deck.pads[0].x, z: dock.deck.pads[0].z, r: 3.4 } : null);
const nearShipOnDeck = () => dock && deckY < 1 && Math.hypot(deckX - dock.deck.pads[0].x, deckZ - dock.deck.pads[0].z) < 6.5;
function updateDeck(dt) {
    deckTime += dt;
    deckFrame();
    placeShipOnDeck(padLocal(), padRotation(dock.deck));
    deckYaw -= arrowTurn() * dt * 1.6;
    lookPitch = clamp(lookPitch + ((keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0)) * dt, -1.15, 1.1);
    const fx = Math.cos(deckYaw), fz = Math.sin(deckYaw); // forward; right is (-fz, fx)
    const ahead = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0), side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    let dx = fx * ahead - fz * side, dz = fz * ahead + fx * side;
    const len = Math.hypot(dx, dz), moving = len > 0.01;
    const walkingSpeed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 8 : 4.5;
    // The deck keeps a steady 1 g.
    if (keys.has("Space") && jumpHeight <= 0) jumpVelocity = 4.4;
    if (jumpHeight > 0 || jumpVelocity > 0) {
        jumpHeight += jumpVelocity * dt;
        jumpVelocity -= 9.8 * dt;
        if (jumpHeight <= 0) jumpHeight = jumpVelocity = 0;
    }
    const walk = dock.ark?.walk;
    if (moving && walk) {
        // In an ark's port: off the deck onto the hall floor, up the terminals' stairs, along
        // their balconies and over the bridge. On the deck itself its own obstacles still count.
        const nx = deckX + (dx / len) * walkingSpeed * dt, nz = deckZ + (dz / len) * walkingSpeed * dt;
        let [rx, rz] = walk.onDeck(nx, nz, deckY, PLAYER_RADIUS) ? dock.deck.resolve(deckX, deckZ, nx, nz, PLAYER_RADIUS, jumpHeight) : [nx, nz];
        const s = shipOnDeck(), to = walk.support(rx, rz, deckY);
        if (!walk.blocked(rx, rz, deckY, to) && (Math.hypot(rx - s.x, rz - s.z) >= s.r + PLAYER_RADIUS || deckY > 3)) { deckX = rx; deckZ = rz; }
    }
    if (walk) deckY = THREE.MathUtils.damp(deckY, walk.support(deckX, deckZ, deckY), 14, dt);
    if (moving && !walk) {
        const nx = deckX + (dx / len) * walkingSpeed * dt, nz = deckZ + (dz / len) * walkingSpeed * dt;
        const [rx, rz] = dock.deck.resolve(deckX, deckZ, nx, nz, PLAYER_RADIUS, jumpHeight), s = shipOnDeck();
        // Your own ship on its pad is solid too.
        if (Math.hypot(rx - s.x, rz - s.z) >= s.r + PLAYER_RADIUS || Math.hypot(rx - s.x, rz - s.z) > Math.hypot(deckX - s.x, deckZ - s.z)) { deckX = rx; deckZ = rz; }
    }
    bob += moving && jumpHeight <= 0 ? dt * walkingSpeed * 1.8 : 0;
    speed = moving ? walkingSpeed : 0;
}
// What the HUD shows at a station (hud.js applies it over the usual readouts), or null.
function stationHUD() {
    if (mode === "walk" && indoor) {
        const c = householdInReach(), sp = indoor.room.species;
        return {
            modeLabel: `${indoor.native?.name?.toUpperCase() ?? ""} ${placeWord(indoor.d).toUpperCase()} / INSIDE`.trim(), status: "INSIDE",
            action: c ? `${stepAtLeast(relations.step(civOfSpecies(indoor.native)?.id) || "observed", "contact") ? "Talk with" : "Greet"} the ${sp?.name ?? "household"} <kbd>E</kbd>` : nearHomeDoor() ? "Go outside <kbd>E</kbd>" : "",
            hint: "<kbd>W A S D</kbd> walk <kbd>E</kbd> greet / go outside <span>Click: mouse look · M map · H controls</span>", walking: true,
        };
    }
    if (mode === "walk" && !scanTarget) {
        const d = doorInReach();
        if (d) { const ok = canEnter(d, site.structures.civ); return { action: ok.ok ? `Go inside <kbd>E</kbd>` : `Look in at the door <kbd>E</kbd>` }; }
    }
    const st = dock?.ark ? dock.ark.name.toUpperCase() : `${dock?.civ?.species?.name ? `${dock.civ.species.name.toUpperCase()} ` : ""}STATION`;
    if (mode === "deck") {
        const p = dock.deck.pads[0];
        return {
            modeLabel: `${st} / ON DECK`, status: "ON DECK", altLabel: "TO SHIP", altitude: Math.hypot(deckX - p.x, deckZ - p.z),
            action: crewInReach() ? `${stepAtLeast(relations.step(dock.civ?.id) || "observed", "contact") ? "Talk with" : "Greet"} the ${dock.civ?.species?.name ?? "crew"} <kbd>E</kbd>` : nearShipOnDeck() ? `Board the ${shipName()} <kbd>E</kbd>` : "", approach: null, walking: true,
            hint: "<kbd>W A S D</kbd> walk <kbd>SPACE</kbd> jump <kbd>E</kbd> greet the crew / board your ship <span>Click: mouse look · M map · H controls</span>",
        };
    }
    if (mode === "docked")
        return {
            modeLabel: `DOCKED / ${st}`, status: "DOCKED", action: "Step onto the deck <kbd>E</kbd>", approach: { text: "↑ Undock [L]", onclick: act },
            hint: "<kbd>E</kbd> step onto the deck <kbd>L</kbd> undock <span>Drag or Q: look around · M map · H controls</span>",
        };
    if (mode === "docking" || mode === "undocking")
        return { modeLabel: mode === "docking" ? "DOCKING / VISITORS' PAD" : "UNDOCKING / LIFTING CLEAR", status: shipName().toUpperCase(), action: mode === "docking" ? "Settling onto the pad…" : "Lifting clear…", busy: true, approach: null };
    if (mode === "flight" || mode === "space") {
        const near = dockable();
        if (near && near.reach < DOCK_REACH) return { action: near.local.y < -4 ? "Fly above the deck to dock" : near.ark ? `Dock on ${near.ark.name} <kbd>L</kbd>` : `Dock at the station <kbd>L</kbd>`, open: true };
    }
    return null;
}
// The waypoint at a station: your ship on the deck, or the visitors' pad when flying nearby.
function stationMark() {
    if (mode === "deck") return { point: shipPosition.clone(), name: shipName().toUpperCase(), distance: Math.hypot(deckX - dock.deck.pads[0].x, deckZ - dock.deck.pads[0].z) };
    if ((mode !== "flight" && mode !== "space") || selectedBody || deepInfo()) return null;
    let best = null;
    for (const e of allDecks()) {
        deckFrame(e.deck, e.ark);
        const p = e.deck.pads[0], point = vec(p.x, 0, p.z).applyMatrix4(deckM), d = point.distanceTo(shipPosition);
        if (d < 40 || d > (e.ark ? 400000 : 4000)) continue;
        if (!best || d < best.distance) best = { point, name: e.ark ? `${e.ark.name.toUpperCase()} · ARK` : "STATION · VISITORS' PAD", distance: d };
    }
    return best;
}
// The crew go about their work whether or not you are there (only near the station).
let scannedToldAt = -100;
function animateStation(dt) {
    for (const e of allDecks()) {
        const deck = e.deck, here = dock?.deck === deck && atStation();
        deckFrame(deck, e.ark);
        const centre = vec().setFromMatrixPosition(deckM);
        if (!here && camera.position.distanceTo(centre) > 2500 + deck.radius) continue;
        const events = deck.update(dt, animationTime, mode === "deck" && here ? { x: deckX, z: deckZ } : null, here ? shipOnDeck() : null);
        for (const ev of events)
            if (ev.type === "scanned" && animationTime - scannedToldAt > 30) {
                scannedToldAt = animationTime;
                toast(`A ${deck.species?.name ?? "crew member"} sweeps a scanner over you, the way you scan their world.`, 5);
            }
    }
    if (mode !== "flight" && mode !== "space") return;
    // Decks and arks are solid: fly round them, over them or under them, not through them.
    const near = dockable();
    if (near && near.reach < SHIP_RADIUS) {
        const l = near.local, r = Math.hypot(l.x, l.z), top = 1.1 + SHIP_RADIUS, bottom = -(near.deck.thickness + 2 + SHIP_RADIUS);
        if (l.y < top && l.y > bottom) {
            const up = top - l.y, down = l.y - bottom, out = near.deck.radius + SHIP_RADIUS - r;
            if (out < up && out < down && r > 1e-3) { l.x *= (r + out) / r; l.z *= (r + out) / r; }
            else l.y = up < down ? top : bottom;
            shipPosition.copy(l).applyMatrix4(deckM);
            speed *= 0.85;
        }
    }
    for (const a of systemView.arks?.() ?? []) {
        a.group.updateWorldMatrix(true, false);
        const inv = a.group.matrixWorld.clone().invert(), l = shipPosition.clone().applyMatrix4(inv);
        if (l.length() > a.size + 50) { a._prev = null; continue; }
        // Sweep from last frame's spot so fast flight can't skip through a floor or wall.
        const from = a._prev ?? l.clone(), n = Math.min(64, Math.ceil(from.distanceTo(l) / (SHIP_RADIUS * 0.5)));
        let hit = false;
        const p = from.clone();
        for (let i = 1; i <= Math.max(1, n); i++) {
            p.lerpVectors(from, l, i / Math.max(1, n));
            if (a.collide(p, SHIP_RADIUS)) { hit = true; break; }
        }
        if (hit) { l.copy(p); shipPosition.copy(p.applyMatrix4(a.group.matrixWorld)); speed *= 0.9; }
        a._prev = l.clone();
    }
    // Flying close by: say once in a while that you can dock.
    if (animationTime - lastDockHint > 25 && near && near.reach < DOCK_REACH * 0.8 && near.local.y > -4) {
        lastDockHint = animationTime;
        toast(near.ark ? `${near.ark.name}: a landing deck. Press L to dock.` : `A station with a landing deck. Press L to dock.`, 4);
    }
}

// --- Contact --------------------------------------------------------------------
// E beside one of an intelligent species (a scanned townsperson, or the crew on a deck)
// opens the exchange (contact-ui.js): greet them, then show them things from your codex.
// What they value raises their trust; steps on the ladder go into the codex ('contact'
// entries, which the upgrade line reads) and bring gifts: their charts, where things
// live on their world, their drive technology, and a keepsake.
let deckTime = 0, footTime = 0, guideCache = { at: -1, set: new Set() }, chartedCache = { at: -1e9, set: new Set() };
const guidedHere = () => {
    if (animationTime - guideCache.at > 1) guideCache = { at: animationTime, set: relations.effects().guides };
    return guideCache.set.has(`${system.seed}:${activeBody.id}`);
};
// The civilization a species of this world belongs to, if it builds here (natives or colonists).
function civOfSpecies(sp) {
    const s = site?.structures;
    if (!s?.civ?.species || s.ruins || !sp) return null;
    if (s.civ.colony) return sp.id === `${s.civ.species.id}-colonist` ? colonistOf(system, activeBody) : null;
    return sp.id === s.civ.species.id ? civilizationOf(activeBody) : null;
}
// One of the crew close enough to talk to, on the deck you are on.
function crewInReach() {
    if (mode !== "deck" || !dock) return null;
    let best = null, bd = Infinity;
    for (const c of dock.deck.crew()) { const d = Math.hypot(c.x - deckX, c.z - deckZ) - c.r; if (d < 2.6 && d < bd) { bd = d; best = c; } }
    return best;
}
const KIND_WORDS = { fauna: "Animal", flora: "Plant", formation: "Rock", core: "Core sample", behaviour: "Behaviour", phenomenon: "Sky event", settlement: "Settlement", station: "Station", "field-note": "Signal", world: "World", signal: "Radio source" };
function entryName(e) {
    if (e.kind === "behaviour") return `${e.traits?.name ?? "An animal"}: ${e.traits?.behaviour ?? "behaviour"}`;
    if (e.kind === "phenomenon") return e.traits?.deep ? e.traits.name : ({ eclipse: "An eclipse", aurora: "An aurora", meteors: "A meteor shower" })[e.traits?.type] || "A sky event";
    if (e.kind === "settlement") return `${e.traits?.name ?? "A people"} (${e.traits?.tier ?? "builders"})`;
    if (e.kind === "station") return `${e.traits?.name ?? "A"} station`;
    if (e.kind === "signal") return `A radio voice (${e.traits?.tier ?? "unknown"})`;
    if (e.kind === "world") return e.traits?.name || e.world?.name || "A world";
    return e.traits?.name || e.world?.name || e.id;
}
// What you could show them: the things they would value most, and one or two others.
function offersFor(civ, rel, homeSeed) {
    const scored = codex.entries.filter(tradeable).map((e) => ({ e, v: valueOf(civ, e, rel, homeSeed) })).filter((x) => x.v > 0);
    scored.sort((a, b) => b.v - a.v);
    const top = scored.slice(0, 3), rest = scored.slice(3), r = () => Math.random();
    const extra = rest.length ? [rest[Math.floor(r() * rest.length)]] : [];
    return [...top, ...extra].sort(() => r() - 0.5).map(({ e }) => ({ entry: e, name: entryName(e), kind: KIND_WORDS[e.kind] || e.kind, from: e.world?.name ?? "" }));
}
// Steps reached: into the codex, and the gifts that come with them. Returns lines to show.
function applyReached(civ, reached) {
    const lines = [], home = system.bodies.find((b) => b.id === civ.home) || activeBody;
    for (const step of reached) {
        const info = recordInfo(contactEntry(system, home, civ, step));
        const g = giftsOf(civ);
        if (step === "contact" && info.text) lines.push(info.text.trim());
        if (step === "trust") {
            const granted = {};
            if (g.guide) granted.guide = true;
            if (g.charts && !offChart) granted.charted = starsNear(currentStar, g.charts).map((x) => x.star.id);
            relations.setGranted(civ.id, granted);
            lines.push(`They trust you. They share ${giftWords({ guide: g.guide, charts: g.charts })}.${info.text}`);
        }
        if (step === "friendship") {
            const keepsake = keepsakeOf(civ);
            relations.setGranted(civ.id, { keepsake, ...(g.drive ? { drive: g.drive } : {}) });
            if (g.drive) starMap?.setRange?.(jumpRangeNow());
            lines.push(`Friendship. They give you ${keepsake}${g.drive ? `, and ${giftWords({ drive: g.drive })}` : ""}.${info.text}`);
        }
    }
    if (reached.length) { upgradeScreen.refresh(); guideCache.at = -1; chartedCache.at = -1e9; }
    return lines;
}
// --- Homes (interior.js) -------------------------------------------------------
// A house's door within reach on foot; inside, the household within reach, and the way out.
function doorInReach() {
    if (mode !== "walk" || indoor || swimming || !site?.structures?.dwellings?.length) return null;
    if (animationTime - doorCache.at < 0.2) return doorCache.d;
    const here = playerPos();
    let best = null, bd = 2.6;
    for (const d of site.structures.dwellings) { const dd = d.door.distanceTo(here); if (dd < bd) { bd = dd; best = d; } }
    doorCache = { at: animationTime, d: best };
    return best;
}
function householdInReach() {
    if (!indoor) return null;
    let best = null, bd = Infinity;
    for (const c of indoor.room.crew()) { const d = Math.hypot(c.x - indoor.x, c.z - indoor.z) - c.r; if (d < 2.4 && d < bd) { bd = d; best = c; } }
    return best;
}
const nearHomeDoor = () => indoor && Math.hypot(indoor.x - indoor.room.door.x, indoor.z - indoor.room.door.z) < 1.6;
function enterHome(d) {
    const s = site.structures, civ = s.civ, ok = canEnter(d, civ), name = civ.species.name;
    if (!ok.ok) return toast(ok.why === "small" ? `The doorway is too small for you: the ${plural(name)} build to their own size. Inside, in the half-light, you can make out the shapes of their things.` : `You can't go in here.`, 5);
    const civF = s.civ.colony ? colonistOf(system, activeBody) : civilizationOf(activeBody), stance = stanceOf(civF);
    const room = buildInterior(THREE, { dwelling: d, civ, palette: s.palette, stance, ruins: !!s.ruins, seed: `${system.seed}:${activeBody.id}:${s.dwellings.indexOf(d)}`, light: indoorLight });
    site.group.add(room.group);
    // Hide the house's own outside within its footprint, so nothing of it shows in the room.
    s.hideInside?.({ centre: vec().setFromMatrixPosition(d.base), up: d.n.clone(), radius: Math.max(room.radius, d.foot) * 1.08, height: d.h * 2.5 + 4 });
    const native = s.civ.colony ? site.fauna.colonists?.species[0] : site.fauna.species.find((x) => x.id === civ.species.id);
    indoor = { d, room, x: room.start.x, z: room.start.z, yaw: room.start.yaw, native: native || civ.species };
    lookPitch = 0; jumpHeight = 0; keys.clear();
    indoorLight.intensity = (s.ruins ? 0.4 : 0.8 + civ.level * 0.15) * Math.max(1.5, room.radius * room.radius) * 0.9;
    indoorLight.distance = room.radius * 4; indoorLight.decay = 2;
    const who = room.crew().length;
    toast(s.ruins ? `An empty ${name} home, long abandoned. Plants have found their way in.`
        : who ? `Inside a ${name} ${placeWord(d)}. ${who > 1 ? `${who} of ${d.kind && !HOMES.includes(d.kind) ? "them" : "the household"} are` : d.kind && !HOMES.includes(d.kind) ? "One of them is" : "One of the household is"} here.` : `Inside a ${name} ${placeWord(d)}. No one is in.`, 4);
}
// What a building is, for the words (town-plan.mjs lot kinds; anything else is a home).
const HOMES = ["house", "row"];
const placeWord = (d) => ({ shop: "shop", workshop: "workshop", hall: "hall", tower: "flat" })[d?.kind] || "home";
function leaveHome(quiet = false) {
    if (!indoor) return;
    const { d, room } = indoor;
    if (contactUI.isOpen) contactUI.close();
    room.dispose();
    site?.structures?.hideInside?.(null);
    indoorLight.intensity = 0;
    indoor = null;
    if (quiet) return;
    playerNormal.copy(d.door.clone().normalize().addScaledVector(d.face, 1.4 / RADIUS).normalize());
    playerForward.copy(d.face).addScaledVector(playerNormal, -d.face.dot(playerNormal)).normalize();
    eyeRadius = null; lookPitch = 0;
}
function updateIndoor(dt) {
    footTime += dt;
    indoor.yaw -= arrowTurn() * dt * 1.6;
    lookPitch = clamp(lookPitch + ((keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0)) * dt, -1.15, 1.1);
    const fx = Math.cos(indoor.yaw), fz = Math.sin(indoor.yaw);
    const ahead = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0), side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const dx = fx * ahead - fz * side, dz = fz * ahead + fx * side, len = Math.hypot(dx, dz), moving = len > 0.01, v = 2.6;
    if (moving) {
        const nx = indoor.x + (dx / len) * v * dt, nz = indoor.z + (dz / len) * v * dt;
        // Walking out through the doorway takes you outside.
        if (nz > indoor.room.door.z - 0.5 && Math.abs(nx) < 0.8 && dz > 0) return leaveHome();
        [indoor.x, indoor.z] = indoor.room.resolve(indoor.x, indoor.z, nx, nz, PLAYER_RADIUS);
    }
    bob += moving ? dt * v * 1.8 : 0;
    speed = moving ? v : 0;
}
// While you talk, the view turns to whoever you are talking to, and the picture is shifted
// so they stand in the middle of the part of the screen the panel leaves clear.
function faceTalker(dt) {
    if (!talking) return;
    // Stand back far enough to see their face (a giant's is high above you), without looking far up.
    const backOff = (dist, dy) => { const want = Math.max(1.8, dy * 1.6 + 0.3); return dist < want - 0.2 ? Math.min(want - dist, dt * 1.6) : 0; };
    const pitchTo = (dy, dist) => clamp(Math.atan2(dy, Math.max(0.5, dist)), -0.6, 0.7);
    if (indoor && talking.deck === indoor.room) {
        const c = indoor.room.crew()[talking.i];
        if (!c) return;
        const dx = c.x - indoor.x, dz = c.z - indoor.z, dy = c.top * 0.75 - 1.75, dist = Math.hypot(dx, dz), want = Math.atan2(dz, dx), b = backOff(dist, dy);
        if (b && dist > 0.01) [indoor.x, indoor.z] = indoor.room.resolve(indoor.x, indoor.z, indoor.x - dx / dist * b, indoor.z - dz / dist * b, PLAYER_RADIUS);
        indoor.yaw += Math.atan2(Math.sin(want - indoor.yaw), Math.cos(want - indoor.yaw)) * Math.min(1, dt * 4);
        lookPitch = damp(lookPitch, pitchTo(dy, dist), 4, dt);
    } else if (talking.deck && mode === "deck") {
        const c = talking.deck.crew()[talking.i];
        if (!c) return;
        const dx = c.x - deckX, dz = c.z - deckZ, dy = c.top * 0.75 - 1.75, dist = Math.hypot(dx, dz), b = backOff(dist, dy);
        if (b && dist > 0.01) [deckX, deckZ] = talking.deck.resolve(deckX, deckZ, deckX - dx / dist * b, deckZ - dz / dist * b, PLAYER_RADIUS, 0);
        deckYaw += Math.atan2(Math.sin(Math.atan2(dz, dx) - deckYaw), Math.cos(Math.atan2(dz, dx) - deckYaw)) * Math.min(1, dt * 4);
        lookPitch = damp(lookPitch, pitchTo(dy, dist), 4, dt);
    } else if (talking.creature && mode === "walk") {
        const c = talking.creature, eye = playerNormal.clone().multiplyScalar((eyeRadius ?? surfaceRadius(playerNormal) + 1.75));
        const head = c.pos.clone().addScaledVector(c.n, (c.top ?? c.sp.size) * 0.75 * (c.young ? 0.55 : 1)), d = head.sub(eye);
        const up = d.dot(playerNormal), flat = d.addScaledVector(playerNormal, -up), across = flat.length();
        if (across > 0.01) {
            const dir = flat.normalize(), b = backOff(across, up);
            if (b) playerNormal.addScaledVector(dir, -b / RADIUS).normalize();
            playerForward.lerp(dir, Math.min(1, dt * 4)).addScaledVector(playerNormal, -playerForward.dot(playerNormal)).normalize();
        }
        lookPitch = damp(lookPitch, pitchTo(up, across), 4, dt);
    }
}
function talkView() {
    if (!contactUI.isOpen || !talking) { if (camera.view?.enabled) { camera.clearViewOffset(); camera.updateProjectionMatrix(); } return; }
    const W = innerWidth, H = innerHeight, f = contactUI.free();
    const ox = Math.round(W / 2 - (f.x + f.w / 2)), oy = Math.round(H / 2 - (f.y + f.h / 2));
    if (camera.view?.enabled && camera.view.offsetX === ox && camera.view.offsetY === oy && camera.view.fullWidth === W) return;
    camera.setViewOffset(W, H, ox, oy, W, H);
    camera.updateProjectionMatrix();
}
// Setting down by a town: the townsfolk react as their stance toward you has it (fauna-mesh.js arrive).
function arriveAtTown() {
    const s = site?.structures;
    if (!s?.civ?.species || s.ruins || !site.fauna) return;
    const herd = s.civ.colony ? site.fauna.colonists : site.fauna, civ = s.civ.colony ? colonistOf(system, activeBody) : civilizationOf(activeBody);
    if (!herd?.arrive || !civ) return;
    const stance = stanceOf(civ), came = herd.arrive(shipPosition.clone().normalize(), stance);
    if (!came) return;
    const many = plural(civ.species.name);
    const line = {
        welcome: `${came > 3 ? "A crowd of" : "Some"} ${many} come out to meet your ship.`,
        curious: `${came > 1 ? "A few" : "One of the"} ${many} come${came > 1 ? "" : "s"} over to look at your ship.`,
        wary: `The ${many} stop what they are doing and watch you from their doorways.`,
        guarded: `Two ${many} walk out and stand a few metres from your ship, watching.`,
    }[stance];
    setTimeout(() => { if (mode === "landed" || mode === "walk") toast(line, 5); }, 2600);
    setTimeout(() => voices.say(herd.species.find((x) => x.id === s.civ.species.id || x.id === `${s.civ.species.id}-colonist`) ?? civ.species, { mood: { welcome: "happy", curious: "curious", wary: "wary", guarded: "guarded" }[stance] }), 4200);
}
// What a town near you has started doing together (fauna-mesh.js vignettes), in a line.
function townNews(watcher) {
    if (!watcher || indoor || contactUI.isOpen) return;
    for (const h of [site.fauna, site.fauna.colonists].filter(Boolean)) for (const e of h.events) {
        if (e.type !== "vignette" || e.at.angleTo(watcher.position.clone().normalize()) * RADIUS > 90) continue;
        toast(`The ${plural(e.species.name.replace(/-colonist$/, ""))} ${e.words}.`, 5);
        setTimeout(() => voices.say(e.species, { mood: "happy", volume: 0.6 }), 600);
    }
}
// Now and then, someone near you says something: to whoever they are talking to, or to you.
let chatterIn = 3;
function townChatter(dt) {
    if ((chatterIn -= dt) > 0 || contactUI.isOpen) return;
    chatterIn = 3.5 + Math.random() * 6;
    if (mode === "deck" && dock?.deck?.species) {
        const near = dock.deck.crew().filter((c) => Math.hypot(c.x - deckX, c.z - deckZ) < 14);
        if (near.length) voices.say(dock.deck.species, { volume: 0.5, length: 2 + Math.floor(Math.random() * 3) });
        return;
    }
    if (mode !== "walk" || !site?.fauna) return;
    const here = playerPos(), herds = [site.fauna, site.fauna.colonists].filter(Boolean);
    let best = null, bd = 18;
    for (const h of herds) for (const c of h.creatures) {
        if (!c.spots || c.kept || c.hidden || !(c.partner || c.meet || c.duty || c.state === "atSpot" || c.state === "play")) continue;
        const d = c.pos.distanceTo(here);
        if (d < bd && Math.random() < 0.6) { bd = d; best = c; }
    }
    if (best) voices.say(best.sp, { mood: best.townMood && bd < 10 ? best.townMood : null, volume: 1 - bd / 18, length: 2 + Math.floor(Math.random() * 3), young: best.young });
}
// The herd (natives, or a colony's colonists) a species belongs to on this world.
const herdOf = (sp) => (site?.fauna?.colonists?.species.includes(sp) ? site.fauna.colonists : site?.fauna);
function talkTo(civ, { where = "", waited = 0, stance = stanceOf(civ), partner = null } = {}) {
    if (!civ) return;
    const can = canTalk(civ, codex.unlocked);
    if (!can.ok) return toast(`You can't make sense of the ${plural(civ.species.name)} yet. ${UPGRADES[can.needs].name}, on the upgrade line, would let you try.`, 5);
    keys.clear();
    endTalk();
    talking = partner;
    if (partner?.herd) partner.herd.talkWith(partner.creature, stance);
    if (partner?.deck) partner.deck.talkWith(partner.i);
    const mood = { welcome: "happy", curious: "curious", wary: "wary", guarded: "guarded" }[stance];
    const speaker = partner?.creature?.sp ?? partner?.deck?.species ?? civ.species;
    const gesture = (kind) => { if (partner?.herd) partner.herd.gesture(partner.creature, kind); if (partner?.deck) partner.deck.gesture(partner.i, kind); };
    setTimeout(() => voices.say(speaker, { mood }), 350);
    if (document.pointerLockElement) document.exitPointerLock?.();
    const rel = relations.meet(civ), home = system.bodies.find((b) => b.id === civ.home), homeSeed = String(system.seed);
    const early = applyReached(civ, relations.settle(civ, stance));
    // The one before you, as a person (persona.mjs): a name, a job, a temper; and what you can ask.
    const placeKind = mode === "deck" ? (dock?.ark ? "ark" : "deck") : indoor ? "home" : "town";
    const persona = personaOf(civ, partner?.i ?? partner?.creature?.id ?? partner?.creature?.seed ?? "one", placeKind);
    const others = civilizationsIn(system).filter((c) => c.id !== civ.id && !c.spaceborne);
    const topics = talkTopics(civ, persona, {
        home: home?.name, homeType: home?.type, stance, step: rel.step, ark: civ.arkName,
        others: others.length ? `There are the ${plural(others[0].species.name)}, on ${system.bodies.find((b) => b.id === others[0].home)?.name ?? "another world"}. We ${stance === "guarded" ? "keep an eye on them" : "trade with them, now and then"}.` : `Not in this system. You are the first stranger we have ever met.`,
    });
    const FEEL = { glad: "welcome", curious: "curious", uneasy: "wary", proud: "guarded" };
    const feel = (feeling) => { // their body answers too
        if (partner?.herd) partner.herd.talkWith(partner.creature, FEEL[feeling] || stance);
        if (partner?.deck) partner.deck.talkWith(partner.i, FEEL[feeling] || stance);
    };
    contactUI.open({
        where: `${where}${home ? ` · ${home.name.toUpperCase()}` : ""}`,
        title: `The ${plural(civ.species.name)}`,
        sub: `${civ.tier[0].toUpperCase()}${civ.tier.slice(1)}${civ.spaceborne ? " (spaceborne)" : ""} · ${civ.path} · ${{ welcome: "welcoming", curious: "curious", wary: "wary", guarded: "guarded" }[stance]} toward you`,
        rel, friendAt: stance === "guarded" ? 4.48 : stance === "welcome" ? 2.88 : 3.2,
        greeted: stepAtLeast(rel.step, "contact"),
        stanceLine: { welcome: "They seem glad you came.", curious: "They lean in, studying you.", wary: "They keep a careful distance.", guarded: "They are watchful, and slow to warm." }[stance],
        ask: askOf(civ),
        persona,
        topics,
        opening: { welcome: `${persona.name} waits, plainly glad of the company.`, curious: `${persona.name} studies you, head on one side.`, wary: `${persona.name} waits for you to speak first.`, guarded: `${persona.name} watches you, unblinking.` }[stance],
        ask2: (tp) => {
            const r = tp.answer();
            feel(r.feeling);
            const secs = Math.min(9, r.text.length * 0.045); // they speak it aloud, the head moving with the words
            if (partner?.herd) partner.herd.speak?.(partner.creature, secs);
            if (partner?.deck) partner.deck.speak?.(partner.i, secs);
            if (r.gesture) gesture();
            voices.say(speaker, { mood: { glad: "happy", curious: "curious", uneasy: "wary", proud: "guarded" }[r.feeling] || mood });
            return { text: r.text, body: bodyLine(speaker, r.feeling) };
        },
        offers: offersFor(civ, rel, homeSeed),
        log: early.map((text) => ({ text, gift: true })),
        greet: () => {
            const r = relations.greet(civ, stance, waited);
            // They answer in their own way (express.mjs), and say something.
            const g = gestureOf(speaker), answer = r.ok && partner ? `The one before you ${GESTURE_WORDS[g]}.` : null;
            if (r.ok) gesture(g);
            voices.say(speaker, { mood: r.ok ? mood : "wary" });
            return { ...r, text: [r.text, answer, ...applyReached(civ, r.reached)].filter(Boolean).join(" ") };
        },
        give: (o) => {
            const r = relations.give(civ, stance, o.entry, homeSeed, o.name);
            if (r.value > 0.45) gesture(); // delighted
            voices.say(speaker, { mood: r.value > 0.45 ? "happy" : r.value > 0.15 ? "curious" : "wary" });
            return { ...r, gifts: applyReached(civ, r.reached) };
        },
    });
}
// --- Scanning ----------------------------------------------------------------
// On foot, the recordable thing nearest the crosshair within reach gets a prompt
// (scanning.js, scan-ui.js). Hold E, or the Scan button, until the ring fills to scan
// something new; press E on something already recorded to see its card again.
const scanUI = createScanUI({ touch: coarsePointer });
const SCAN_TIME = 1.3, // seconds of holding
    RECORD_TIME = 1.6; // a sky event
const holdTime = (t) => (t.kind === "core" ? 2 : t.kind === "behaviour" ? observeTime(codex.unlocked) : t.kind === "phenomenon" ? RECORD_TIME : SCAN_TIME);
let zoom = 0; // field glasses, 0..1 (eases in and out)
const glassesView = $("glasses");
let scanTarget = null, // { kind, id, ref, point, reach, known }
    scanProgress = 0, // 0..1 while holding
    scanSearch = 0,
    scanNeedsRelease = false, // after a scan, let go before the next one starts
    touchScanHeld = false;
const scanHeld = () => keys.has("KeyE") || touchScanHeld;
$("actionBtn").addEventListener("pointerdown", () => {
    if ((mode === "walk" || (mode === "space" && scanTarget?.cloud)) && scanTarget && !scanTarget.known) touchScanHeld = true;
});
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) $("actionBtn").addEventListener(ev, () => (touchScanHeld = false));
// Behaviours and sky events live only in the codex: ask it.
const inCodex = (kind) => ({ includes: (id) => codex.has({ kind, seed: String(system.seed), bodyId: activeBody.id, id }) });
const scannedHere = () => ({
    fauna: (bestiary[activeBody.id] ||= []),
    flora: (catalogue[activeBody.id] ||= []),
    formation: (strata[activeBody.id] ||= []),
    behaviour: inCodex("behaviour"),
    phenomenon: inCodex("phenomenon"),
    core: inCodex("core"),
});
// Behaviours already recorded for a species on this world.
const seenOf = (sp) => behavioursOf(sp).filter((b) => codex.has(behaviourEntry(system, activeBody, sp, b)));
function updateScan(dt) {
    if (indoor) { scanTarget = null; scanProgress = 0; return; } // nothing to scan through the walls
    const held = scanHeld();
    if (!held) scanNeedsRelease = false;
    const scanning = held && !scanNeedsRelease && scanTarget && !scanTarget.known;
    if (scanTarget) scanTarget.point = followTarget(site, scanTarget);
    if ((scanSearch += dt) >= 0.1) {
        scanSearch = 0;
        const holding = !!scanning && scanProgress > 0;
        const next = scanTarget?.kind === "phenomenon" && holding
            ? skyTarget(true)
            : findScanTarget({
                site,
                here: mode === "dive" ? shipPosition : playerPos(),
                eye: camera.position,
                forward: camera.getWorldDirection(vec()),
                // Field glasses: zoomed in, you can scan from farther and the aim narrows with the view.
                reachScale: (1 + (ZOOM_REACH - 1) * smoothstep(zoom)) * (mode === "dive" ? 2 : 1), // the Petrel's scanner reaches farther
                aimScale: camera.fov / 70,
                cores: codex.unlocked.has("deepCoreSampler"),
                known: scannedHere(),
                keep: scanTarget,
                holding,
            }) || skyTarget(false);
        if (scanProgress > 0 && (!next || next.kind !== scanTarget?.kind || next.id !== scanTarget?.id)) scanProgress = 0;
        scanTarget = next;
    }
    if (scanning && scanTarget && !scanTarget.known) {
        scanProgress += dt / holdTime(scanTarget);
        if (scanProgress >= 1) completeScan();
    } else scanProgress = Math.max(0, scanProgress - dt * 2.5);
}
function completeScan() {
    const t = scanTarget, list = scannedHere()[t.kind];
    scanProgress = 0;
    scanNeedsRelease = true;
    t.known = true;
    if (t.kind === "core") t.sample = coreSample(activeBody, t.ref);
    if (t.kind === "behaviour" || t.kind === "phenomenon" || t.kind === "core") {
        const entry = t.kind === "core" ? coreEntry(system, activeBody, t.ref, t.sample) : t.kind === "behaviour" ? behaviourEntry(system, activeBody, t.ref, t.behaviour) : phenomenonEntry(system, activeBody, t.id, { total: t.ref.total });
        if (codex.has(entry)) return;
        scanUI.flash();
        showScanCard(t, recordInfo(entry));
        return;
    }
    if (list.includes(t.id)) return;
    list.push(t.id);
    saveSurvey();
    scanUI.flash();
    const entry = t.kind === "fauna" ? faunaEntry(system, activeBody, t.ref) : t.kind === "flora" ? floraEntry(system, activeBody, t.ref) : formationEntry(system, activeBody, t.ref);
    showScanCard(t, recordInfo(entry));
}
// info: what recording it moved forward (recordInfo), or null to show a recorded thing again.
// The codex entry a scan target makes (for its rarity), or null.
function entryOfTarget(t) {
    try {
        if (t.kind === "fauna") return faunaEntry(system, t.body || activeBody, t.ref);
        if (t.kind === "flora") return floraEntry(system, activeBody, t.ref);
        if (t.kind === "formation") return formationEntry(system, activeBody, t.ref);
        if (t.kind === "behaviour") return behaviourEntry(system, activeBody, t.ref, t.behaviour);
        if (t.kind === "phenomenon") return phenomenonEntry(system, activeBody, t.id, { total: t.ref.total });
        if (t.kind === "settlement") return settlementEntry(system, activeBody, civilizationOf(activeBody) || t.ref, t.ref?.tier);
        if (t.kind === "station") return { kind: "station", traits: { tier: t.ref?.tier } };
    } catch {}
    return null;
}
function showScanCard(t, info) {
    const body = t.body || activeBody, where = `${wordFor(t).toUpperCase()} · ${body.name.toUpperCase()}`;
    const card = cardFor(t, t.site || site, body, (t.kind === "fauna" || t.kind === "behaviour") && !t.cloud ? seenOf(t.ref) : []);
    // Rarity (rarity.mjs): a tag on the card, and a word when you find something rare.
    const e = entryOfTarget(t), grade = e ? rarityOf(e) : "common";
    if (grade !== "common") card.tags = [{ text: grade[0].toUpperCase() + grade.slice(1), tone: grade }, ...(card.tags || [])];
    if (info && rarityAtLeast(grade, "rare")) toast(`${grade === "legendary" ? "A legendary find!" : grade === "exceptional" ? "An exceptional find!" : "A rare find."} It is in your codex (K).`, 5);
    scanUI.card({
        ...card,
        eyebrow: info ? `NEW ${where}` : `RECORDED ${where}`,
        footer: !info
            ? null
            : info.ready
              ? { text: `Upgrade ready: ${info.ready.name}. Press U to install it.`, ready: true }
              : info.moved
                ? { text: `Counts toward ${info.moved.name}: ${info.progressText}` }
                : { text: "Recorded in your codex." },
    });
}
// The prompt at the crosshair, every frame.
function drawScanMarker() {
    if ((mode !== "walk" && !(mode === "space" && scanTarget?.cloud) && !((mode === "deep" || mode === "space") && scanTarget?.deepFind)) || indoor || !scanTarget || modalOpen()) return scanUI.prompt(null);
    scanUI.prompt({ title: titleFor(scanTarget), known: scanTarget.known, verb: verbFor(scanTarget) }, scanProgress);
}
function updateCamera(dt) {
    if (mode === "deck") {
        // On a station's deck: the same eye as on foot, in the deck's own frame.
        const eye = vec(deckX, deckY + 1.75 + jumpHeight + Math.sin(bob) * 0.025, deckZ).applyMatrix4(deckM);
        const look = vec(Math.cos(deckYaw) * Math.cos(lookPitch), Math.sin(lookPitch), Math.sin(deckYaw) * Math.cos(lookPitch)).applyQuaternion(deckQ);
        camera.position.copy(eye);
        camera.up.copy(deckUp());
        camera.lookAt(eye.add(look));
        const zooming = hasFieldGlasses(codex.unlocked) && keys.has("KeyZ") && !modalOpen();
        zoom = damp(zoom, zooming ? 1 : 0, 7, dt);
        if (zoom < 0.002) zoom = 0;
        camera.fov = 70 - 56 * smoothstep(zoom);
        glassesView.style.opacity = zoom.toFixed(3);
        camera.updateProjectionMatrix();
        return;
    }
    if (mode === "walk" && indoor) {
        // Inside a home: the eye in the room's own frame.
        const B = indoor.d.base, eye = vec(indoor.x, 1.75 + jumpHeight + Math.sin(bob) * 0.025, indoor.z).applyMatrix4(B);
        const look = vec(Math.cos(indoor.yaw) * Math.cos(lookPitch), Math.sin(lookPitch), Math.sin(indoor.yaw) * Math.cos(lookPitch)).transformDirection(B);
        camera.position.copy(eye); camera.up.copy(indoor.d.n); camera.lookAt(eye.add(look));
        zoom = 0; glassesView.style.opacity = 0; camera.fov = 70; camera.updateProjectionMatrix();
        return;
    }
    if (mode === "walk") {
        // The eye glides over the ground: it follows the average height under your
        // feet (not the exact point), easing up and down, so small bumps and sharp
        // rocky crests don't jolt the view. It never sinks far below standing height.
        // Swimming, it sits where you swim, rocking gently on the swell near the surface.
        const ground = footHeight(playerNormal);
        const want = swimming ? seaRadius() - swimD + (swimD < 0.3 ? Math.sin(animationTime * 1.3) * 0.06 : 0) : ground + 1.75;
        if (eyeRadius === null || Math.abs(eyeRadius - want) > 4) eyeRadius = want;
        eyeRadius = damp(eyeRadius, want, swimming ? 5 : want > eyeRadius ? 9 : 6, dt);
        eyeRadius = Math.max(eyeRadius, swimming ? bedRadius(playerNormal) + 0.45 : bedRadius(playerNormal) + 1.35);
        const eye = playerNormal.clone().multiplyScalar(eyeRadius + jumpHeight + Math.sin(bob) * 0.025);
        camera.position.copy(eye);
        camera.up.copy(playerNormal);
        const look = playerForward
            .clone()
            .multiplyScalar(Math.cos(lookPitch))
            .addScaledVector(playerNormal, Math.sin(lookPitch));
        camera.lookAt(eye.clone().add(look));
        if (EYE_UP) { camera.position.addScaledVector(playerNormal, EYE_UP); camera.lookAt(eye.clone().addScaledVector(playerForward, EYE_UP * 0.9)); }
        // Field glasses: hold Z (or the touch button) to zoom in.
        const zooming = hasFieldGlasses(codex.unlocked) && keys.has("KeyZ") && !modalOpen();
        zoom = damp(zoom, zooming ? 1 : 0, 7, dt);
        if (zoom < 0.002) zoom = 0;
        camera.fov = 70 - 56 * smoothstep(zoom);
        glassesView.style.opacity = zoom.toFixed(3);
    } else {
        if (zoom) glassesView.style.opacity = zoom = 0;
                // The camera drifts back behind the ship once you stop looking around.
        // While the mouse steers, only looking around (Q) moves the camera off the ship.
        const holdView = mouseSteers()
            ? performance.now() - lastFreeLook < 1200
            : keys.has("KeyQ") || input.lookingAround(2500);
        if (!holdView) {
            orbitYaw = THREE.MathUtils.damp(orbitYaw, 0, 2, dt);
            orbitPitch = THREE.MathUtils.damp(orbitPitch, 0.18, 2, dt);
        }
        // At a station the deck's own up is the camera's up (as in space).
        const inSpace = mode === "space" || mode === "transit" || mode === "deep" || atStation();
        // Entering or leaving orbit, the camera eases between its low flying view
        // and its space view over a couple of seconds instead of jumping.
        spaceBlend = damp(spaceBlend, inSpace ? 1 : 0, 1.3, dt);
        const sb = smoothstep(spaceBlend);
        reveal = Math.max(0, reveal - dt / 3.5);
        const pull = smoothstep(reveal) * Math.min(1, reveal * 4); // rises fast, fades slowly
        // How fast you are going, 0..1: wider view, camera dropping back, a faint shake.
        const boosting = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const rush = mode === "deep"
            ? throttle * (boosting ? 1 : 0.8)
            : clamp(flowVel.length() / (110 + 1190 * sb), 0, 0.75);
        rushLevel = damp(rushLevel, rush, 2.5, dt);
        const radial = shipPosition.clone().normalize();
        const up = radial.clone().lerp(spaceUp, sb);
        if (up.lengthSq() < 1e-4) up.copy(inSpace ? spaceUp : radial);
        up.normalize();
        // Right after entering orbit the camera swings round to its new place
        // slowly; otherwise it follows the ship directly.
        const ease = smoothstep(orbitEntry);
        const backTarget = shipForward.clone().negate().applyAxisAngle(up, orbitYaw);
        if (!camBack || ease <= 0 || mode === "walk") {
            camBack = backTarget.clone();
            camAhead = shipForward.clone();
        } else {
            const f = 1 - Math.exp(-dt * (0.9 + 6 * (1 - ease)));
            camBack.lerp(backTarget, f).normalize();
            camAhead.lerp(shipForward, f).normalize();
        }
        const back = camBack;
        const framing = Math.max(1, 0.65 / camera.aspect);
        // Under water the view is short: the camera follows the Petrel closely, and stays
        // between the sea floor and the surface.
        const diving = mode === "dive";
        const distance = diving ? 12 : 26 * (1 + 0.28 * rushLevel + 0.9 * pull);
        const desired = shipPosition
            .clone()
            .addScaledVector(back, distance * framing * Math.cos(orbitPitch))
            .addScaledVector(up, (diving ? 3.5 + 8 * Math.sin(orbitPitch) : 21 - 10 * sb + 14 * pull + 20 * Math.sin(orbitPitch)) * framing);
        const normal = desired.clone().normalize();
        const floor = diving ? bedRadius(normal) + 1.2 : surfaceRadius(normal) + 2;
        if (!inSpace && desired.length() < floor)
            desired.copy(normal.multiplyScalar(floor));
        if (diving && desired.length() > seaRadius() - 0.4) desired.setLength(seaRadius() - 0.4);
        // Carry the camera along with the ship, so at speed it stays close behind
        // (a little lag is left in, which reads as speed).
        // Carried along by exactly how far the ship moved, then eased toward its place
        // behind the ship: the easing (and so the swing when you turn) is the same at
        // any speed. Carrying it by a smoothed velocity left it hundreds of metres off
        // at high speed, so a small turn or a touch of thrust threw the view about.
        if (mode !== "deep") camera.position.addScaledVector(shipVel, dt);
        camera.position.lerp(desired, 1 - Math.exp(-dt * (4 - 2.6 * ease)));
        // The camera trails at most a few metres behind its place (a little lag reads as speed).
        // (In deep space the ship stays put and the stars move, so its heading stands in: without
        // it the last stretch flown before the drive engaged left the camera far behind for a moment.)
        const along = mode === "deep" ? shipForward.clone() : shipVel.lengthSq() > 1 ? shipVel.clone().normalize() : null;
        if (along) {
            const behind = -camera.position.clone().sub(desired).dot(along), most = (3 + 5 * rushLevel) * framing;
            if (behind > most) camera.position.addScaledVector(along, behind - most);
        }
        camera.up.lerp(up, 1 - Math.exp(-dt * (4 - 3.2 * ease))).normalize();
        const look = shipPosition
            .clone()
            // In space, look far ahead so what you fly toward sits mid-screen.
            .addScaledVector(camAhead, 12 + 20 * sb)
            // Near the ground the camera looks down a little; this fades out
            // while climbing, so leaving orbit doesn't jolt the view.
            .addScaledVector(up, (diving ? -1.5 : -7 * (1 - smoothstep((altitude() - 120) / 480))) * (1 - sb) - 10 * pull);
        // A faint shake when really moving (more with boost).
        const shake = Math.max(0, rushLevel - 0.45) / 0.55;
        bumpShake = Math.max(0, bumpShake - dt * 2.2);
        if (shake > 0 || bumpShake > 0) {
            const a = 0.35 * shake * shake * (boosting ? 1.4 : 1) * framing + 2.2 * bumpShake * bumpShake, t = animationTime;
            look.addScaledVector(up, a * (Math.sin(t * 31) + Math.sin(t * 17.3)) * 0.5);
            look.addScaledVector(back.clone().cross(up), a * (Math.sin(t * 27.1) + Math.sin(t * 13.7)) * 0.5);
        }
        camera.lookAt(look);
        camera.fov = THREE.MathUtils.damp(
            camera.fov,
            58 + 13 * rushLevel + (mode === "deep" ? 9 * rushLevel : 0) + 4 * pull,
            3,
            dt,
        );
    }
    camera.updateProjectionMatrix();
}

// --- Targets --------------------------------------------------------------
// Tap or click a world or star (or press Tab) to select it. Its name and
// distance show on the waypoint, and in space the ship keeps its nose on it
// whenever you are not steering. In deep space, stars and the worlds of the
// system ahead can be picked; picking one sets your course.
let target = null; // a world of this system
function targetCandidates() {
    const out = [];
    if (mode === "deep") {
        for (const e of sky.stars.slice(0, 400))
            out.push({ kind: "star", star: e.star, point: toScene(starPoint(e.star).map((v, i) => v - galactic[i])).normalize().multiplyScalar(5000).add(camera.position) });
        for (const n of deepNear)
            if (knownFinds[n.f.id]) out.push({ kind: "find", find: n.f, point: toScene(findOffset(n.f)).normalize().multiplyScalar(5000).add(camera.position) });
        if (ahead)
            for (const b of ahead.system.bodies) {
                const p = ahead.starScene.clone().add(vec(...ahead.positions.get(b.id)));
                out.push({ kind: "body", body: b, star: ahead.star, point: p.normalize().multiplyScalar(5000).add(camera.position) });
            }
    } else {
        for (const b of system.bodies)
            if (b.id !== activeBody.id || mode === "space" || mode === "transit")
                out.push({ kind: "body", body: b, point: positionOf(b).sub(worldOrigin) });
        // Arks are destinations like worlds: tap them, Tab to them, cruise to them.
        for (const b of arkBodies()) out.push({ kind: "body", body: b, point: positionOf(b).sub(worldOrigin) });
        // Other stars, so you can find the way to another system.
        for (const e of sky.stars.slice(0, 300))
            if (e.star.id !== currentStar.id)
                out.push({ kind: "star", star: e.star, point: towardStar(e.star).multiplyScalar(5000).add(camera.position) });
    }
    return out;
}
function onScreen(point) {
    const v = point.clone().project(camera);
    const ahead = point.clone().sub(camera.position).dot(camera.getWorldDirection(vec())) > 0;
    return ahead && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 ? [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight] : null;
}
function pickAt(x, y) {
    if (mode === "walk" || mode === "landing" || mode === "takeoff") return;
    let best = null,
        bestD = coarsePointer ? 60 : 40;
    for (const c of targetCandidates()) {
        const s = onScreen(c.point);
        if (!s) continue;
        // Worlds win over stars at the same spot.
        const d = Math.hypot(s[0] - x, s[1] - y) - (c.kind === "body" ? 10 : 0);
        if (d < bestD) {
            bestD = d;
            best = c;
        }
    }
    if (best) chooseTarget(best);
    else if ((mode === "space" || mode === "deep") && (target || course || selectedBody)) clearTarget();
}
let cycleIndex = -1;
function cycleTarget() {
    if (mode === "walk" || mode === "landing" || mode === "takeoff") return;
    // Nothing chosen yet: start with the nearest world, wherever it is.
    if (mode !== "deep" && !selectedBody && !course) {
        const nearest = targetCandidates()
            .filter((c) => c.kind === "body")
            .sort((a, b) => a.point.distanceTo(shipPosition) - a.body.radius - (b.point.distanceTo(shipPosition) - b.body.radius))[0];
        if (nearest) {
            cycleIndex = -1;
            return chooseTarget(nearest);
        }
    }
    // Only what is on screen: nearest worlds first, then the nearest stars.
    const reach = (c) =>
        c.kind === "find" ? 1e5 + Math.hypot(...findOffset(c.find)) * 1e5 : c.kind === "star"
            ? 1e12 + Math.hypot(...starPoint(c.star).map((v, i) => v - viewer()[i]))
            : mode === "deep"
              ? 1e6 + ahead.starScene.clone().add(vec(...ahead.positions.get(c.body.id))).length()
              : c.point.distanceTo(shipPosition);
    const list = targetCandidates()
        .filter((c) => onScreen(c.point))
        .map((c) => ({ c, d: reach(c) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 12);
    if (!list.length) return void toast("Nothing in view to select. Turn toward a world or star.");
    cycleIndex = (cycleIndex + 1) % list.length;
    chooseTarget(list[cycleIndex].c);
}
const fmtDistance = (m) => (m >= 10000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const fmtLightYears = (ly) => (ly < 0.05 ? `${Math.max(1, Math.round(ly * 63241))} AU` : `${ly.toFixed(2)} ly`);
function chooseTarget(c) {
    if (c.kind === "find") {
        deepTarget = c.find; deepDetour = false;
        autopilot = true;
        toast(`Course: ${findLabel(c.find)}, ${fmtLightYears(Math.max(0, Math.hypot(...findOffset(c.find)) - c.find.size))}. Autopilot engaged; steer to take over, C to clear.`, 5);
        starMap.refresh();
        return;
    }
    if (c.kind === "star") deepTarget = null;
    if (c.kind === "star") {
        course = c.star;
        target = pendingBody = selectedBody = null;
        const ly = Math.hypot(...starPoint(c.star).map((v, i) => v - viewer()[i]));
        toast(`Course: ${starName(c.star)}, ${fmtLightYears(ly)}. The ship points there when you are not steering; T for autopilot, C to clear.`, 5);
    } else if (mode === "deep") {
        course = c.star;
        pendingBody = c.body;
        toast(`Course: ${c.body.name}, ${c.body.type.toLowerCase()} of ${starName(c.star)}. T for autopilot.`, 5);
    } else {
        selectedBody = target = c.body;
        const m = positionOf(c.body).sub(worldOrigin).distanceTo(shipPosition) - c.body.radius;
        toast(
            `Target: ${c.body.name}, ${c.body.type.toLowerCase()}, ${fmtDistance(m)}. ${mode === "space" ? "The ship keeps its nose on it when you are not steering. " : ""}T to cruise there.`,
            5,
        );
    }
    starMap.refresh();
}
// C, the Clear button, tapping empty space, or Clear course on the map.
function clearTarget() {
    if (!target && !course && !selectedBody && !deepTarget) return;
    if (deepDetour && deepTarget) { // ignore the sensor contact, back to your course
        deepTarget = null; deepDetour = false; autopilot = !!course;
        toast(course ? `Contact ignored. Back on course to ${starName(course)}.` : "Contact ignored.", 4);
        starMap.refresh(); return;
    }
    deepDetour = false;
    target = course = pendingBody = selectedBody = deepTarget = null;
    autopilot = false;
    starMap.refresh();
    toast("Target cleared. Free flight.");
}

// --- Skies ---------------------------------------------------------------
// Worlds with enough air have a sky. Its colour comes from the air (the biome's
// atmosphere tint) lit by the star: bright by day, warm at sunrise and sunset,
// dark at night. It fades to black as you climb out, stars fade in daylight,
// and haze softens distant land. Thin or no air keeps the black sky of space.
const SPACE = new THREE.Color("#07101d"),
    DUSK = new THREE.Color("#ff7a45");
const skyZenith = new THREE.Color(), skyHorizon = new THREE.Color(), fogHorizon = new THREE.Color(), tmpColor = new THREE.Color(), tmpColor2 = new THREE.Color(), hemiSky = new THREE.Color();
const HEMI_SKY = new THREE.Color(0xb6dfdf), HEMI_GROUND = new THREE.Color(0x4c3844);
const skyDay = new THREE.Color(),
    skyNow = new THREE.Color(),
    skyNight = new THREE.Color();
scene.fog = makeMistFog(THREE, SPACE.getHex()); // distance fog (fog.density) plus valley mist (fog.mist), atmosphere.js
const plantWorlds = new Map();
const hasPlants = (body) => { if (!plantWorlds.has(body.id + ":" + body.seed)) plantWorlds.set(body.id + ":" + body.seed, floraFor(body).species.some((sp) => !sp.aquatic)); return plantWorlds.get(body.id + ":" + body.seed); };
function airOf(body) {
    // 0 below ~0.03 bar, about 0.6 at Earth's 1 bar, 1 for very thick air.
    const p = body.physics?.pressure ?? 0;
    return clamp((Math.log10(Math.max(p, 1e-4)) + 1.5) / 2.5, 0, 1);
}
const cloudFog = new THREE.Color();
const NEBULA_SKY = new THREE.Color();
let diveBuried = false; // the system outside hidden while deep in a giant (finishSky)
let dayNow = 1; // daylight where the camera is, 0..1 (updateAtmosphere)
let inCloud = 0, // 0..1: how deep in cloud the camera is
    hiddenLayer = null; // the cloud layer faded out while you are inside it
// Just before drawing: what came after updateAtmosphere (clouds around you, storms, the
// local haze, being under water) has reshaped scene.background; the dome and the fog
// follow it, and the shadows are centred on where you are.
function finishSky() {
    const du = skyDome.uniforms;
    // In a giant's clouds (updateCloudDive): thick cloud at the deck itself, murk below it
    // that darkens and thickens with depth, lit up for a moment by lightning.
    let diveIn = 0;
    if (dive.k > 0 && dive.body && mode === "space") {
        const b = dive.body, deep = clamp(dive.depth / Math.max(1, crushDepth(b)), 0, 1), deck = Math.exp(-((dive.depth / 45) ** 2));
        diveIn = clamp((dive.depth + 130) / 150, 0, 1);
        const light = (0.12 + 0.88 * dayNow), flash = 0.55 * dive.flash * dive.flash;
        // The air between the cloud layers: the giant's mid colour; the cloud ceiling above is
        // its palest band warmed by the star, the depths below its darkest, fading to near black.
        DIVE_AIR.set(b.palette?.[2] ?? b.atmosphere).lerp(DIVE_DEEP.set(b.atmosphere), 0.3);
        DIVE_DEEP.set(b.palette?.[0] ?? b.atmosphere).multiplyScalar(0.35);
        DIVE_AIR.lerp(DIVE_DEEP, deep * 0.85).multiplyScalar(light).lerp(DIVE_FLASH, flash);
        DIVE_TOP.set(b.palette?.[3] ?? b.atmosphere).lerp(sun.color, 0.15).multiplyScalar((1.25 - 0.75 * deep) * light).lerp(DIVE_FLASH, flash);
        DIVE_LOW.set(b.palette?.[0] ?? b.atmosphere).multiplyScalar(0.28 * (1 - 0.7 * deep) * light).lerp(DIVE_FLASH, flash * 0.5);
        scene.background.lerp(DIVE_AIR, diveIn);
        scene.fog.density = Math.max(scene.fog.density, diveIn * (0.003 + 0.022 * deep) + 0.05 * deck * diveIn);
        if (dive.flash > 0.01) hemi.intensity *= 1 + 2 * dive.flash * dive.flash;
        du.uDive.value = diveIn; du.uDiveTop.value.copy(DIVE_TOP); du.uDiveLow.value.copy(DIVE_LOW);
        du.uDiveUp.value.copy(camera.position).add(worldOrigin).sub(positionOf(b)).normalize();
        skyDome.mesh.visible = true;
        if (dive.puffs) {
            const pu = dive.puffs.material.uniforms;
            pu.uMurk.value.copy(scene.background); pu.uDensity.value = scene.fog.density; pu.uLight.value = light;
            pu.uFlash.value = dive.flash * dive.flash; pu.uUp.value.copy(du.uDiveUp.value);
            pu.uSun.value.copy(sun.position).sub(camera.position).normalize();
        }
    } else du.uDive.value = 0;
    // Inside a nebula (deep space): the sky takes its colour.
    if (mode === "deep" && nebulaIn > 0.01 && nebulaFind) scene.background.lerp(NEBULA_SKY.set(nebulaFind.hue[1]).multiplyScalar(0.35), 0.85 * nebulaIn);
    // Below the cloud deck nothing outside the giant shows: its moons, rings and the star are
    // hidden (the thick deck covers the moment they go), and the dome's glow stands in for the sun.
    const buried = diveIn > 0 && dive.depth > 35;
    if (buried !== diveBuried) { diveBuried = buried; systemView.visible = !buried; }
    const over = Math.min(1, Math.max(inCloud * 0.95, gloomNow * 0.8, localAir.mix * 0.6, cameraDepth > 0 ? 1 : 0, diveIn));
    du.uBack.value.copy(scene.background); du.uOver.value = over;
    scene.fog.color.copy(fogHorizon).lerp(scene.background, over);
    if (cameraDepth > 0) skyDome.mesh.visible = false;
    skyDome.mesh.position.copy(camera.position);
    const near = onWorld() && !indoor && altitude() < 260;
    const focus = mode === "walk" ? playerPos() : surfacePoint(shipPosition.clone().normalize());
    shadows.update(focus, near && dayNow > 0.02);
    // Valley mist and the water's reflection of the sky follow the fog's final colour.
    scene.fog.mist = !MIST || indoor || cameraDepth > 0 ? 0 : mistWant * (1 - inCloud) * (1 - over * 0.5);
    WATER.sky.value?.copy(scene.fog.color); // (no water anywhere in the system: not set yet)
    const t = performance.now() / 1000;
    WATER.time.value = t;
    // Sunbeams: in woods, by day, under a sky that is not overcast, on foot or low down.
    const beams = BEAMS && near && !indoor && cameraDepth <= 0 ? localAir.woods * dayNow * (1 - gloomNow) * (1 - inCloud) * (1 - smoothstep((altitude() - 20) / 60)) : 0;
    shafts.update(focus, surfaceRadius, beams * (AIR ? 1.8 : 1), shafts.uniforms.uSunDir.value.copy(sun.position).sub(focus).normalize(), t);
}
function updateAtmosphere() {
    // The sky comes from the world nearest the camera, so a world's air fades in
    // as you descend toward it, not all at once when you reach its orbit.
    let body = activeBody,
        height = camera.position.length() - RADIUS,
        centre = vec(0, 0, 0);
    if (mode === "space" || mode === "transit") {
        const cam = camera.position.clone().add(worldOrigin);
        for (const b of system.bodies) {
            if (b === activeBody) continue;
            const at = positionOf(b), h = cam.distanceTo(at) - b.radius;
            if (h < height) {
                height = h;
                body = b;
                centre = at.sub(worldOrigin);
            }
        }
    }
    const air = airOf(body);
    let k = 0;
    if (air > 0 && mode !== "deep")
        k = air * (1 - smoothstep((height - 40) / (300 + 600 * air)));
    const up = camera.position.clone().sub(centre).normalize(),
        elevation = up.dot(sun.position.clone().normalize()); // the star's height in your sky
    const day = smoothstep((elevation + 0.1) / 0.35) * (1 - 0.9 * eclipseCover),
        dusk = clamp(1 - Math.abs(elevation - 0.03) / 0.22, 0, 1);
    // The air's own colour, slightly tinted by the star and brighter in thick air.
    skyDay.set(body.atmosphere).lerp(sun.color, 0.12).multiplyScalar(0.95 + 0.5 * air);
    skyNight.copy(skyDay).multiplyScalar(AIR ? 0.11 : 0.06);
    if (AIR) skyNight.lerp(tmpColor.set(0x1a2a52).multiplyScalar(0.5 + 0.5 * air), 0.35); // nights lean blue, and can be seen in
    // Sunrise and sunset: a gentle warm shift, then dimming into night.
    skyNow.copy(skyDay).lerp(DUSK, dusk * (AIR ? 0.45 : 0.28));
    skyNow.lerp(skyNight, 1 - day);
    scene.background.copy(SPACE).lerp(skyNow, k);
    // The sky dome (atmosphere.js): a deeper zenith, a paler hazy horizon (thicker air,
    // paler still), the ground below, and the star's glow; distant land fades into the
    // horizon's colour, as it does through real air.
    const lum = skyNow.r * 0.2126 + skyNow.g * 0.7152 + skyNow.b * 0.0722;
    skyZenith.copy(skyNow).multiplyScalar(0.72).lerp(skyNow.clone().multiplyScalar(0.55), 0.3);
    skyHorizon.copy(skyNow).lerp(tmpColor.setScalar(lum * 1.25 + 0.04 * day), 0.3 + 0.25 * air).lerp(sun.color, 0.08 * day).multiplyScalar(1.12);
    // Restraint in colour: the haze takes a little of the land's own colour (at the
    // horizon's brightness), so sky, distant hills and plants share one palette.
    const hl = skyHorizon.r * 0.2126 + skyHorizon.g * 0.7152 + skyHorizon.b * 0.0722;
    const landHaze = tmpColor2.set(body.palette?.[1] || "#556644"), ll = Math.max(0.02, landHaze.r * 0.2126 + landHaze.g * 0.7152 + landHaze.b * 0.0722);
    skyHorizon.lerp(landHaze.multiplyScalar(hl / ll).lerp(tmpColor.setScalar(hl), 0.4), 0.14);
    skyZenith.lerp(tmpColor.setScalar(skyZenith.r * 0.2126 + skyZenith.g * 0.7152 + skyZenith.b * 0.0722), 0.1); // a touch less saturated overhead
    const groundTint = tmpColor2.set(body.palette?.[1] || "#556644").multiplyScalar(0.35 * (0.15 + 0.85 * day));
    const du = skyDome.uniforms;
    du.uZenith.value.copy(skyZenith); du.uHorizon.value.copy(skyHorizon); du.uGround.value.copy(skyHorizon).lerp(groundTint, 0.6);
    du.uSpace.value.copy(SPACE); du.uAir.value = k; du.uUp.value.copy(up);
    du.uSunDir.value.copy(sun.position).sub(camera.position).normalize();
    du.uSunColor.value.copy(sun.color).multiplyScalar(day * (0.4 + 0.8 * air) * (1 - eclipseCover));
    du.uGlow.value = 1;
    skyDome.mesh.visible = k > 0.003;
    fogHorizon.copy(SPACE).lerp(skyHorizon, k);
    scene.fog.color.copy(fogHorizon);
    // Atmospheric depth: haze thick enough to part near, middle and far ground into layers
    // (and to hide the edge of what is drawn), thicker in thick air and a little at dusk.
    scene.fog.density = AIR ? k * (0.0005 + 0.0015 * air) * (1 + 0.35 * dusk) : k * (0.0002 + 0.0007 * air);
    // On a world with plants the haze near the ground is never thinner than it takes to
    // hide the far edge of what is planted (five sixths gone at the distance trees are
    // drawn to, Q.treeReach): things then gain detail inside the haze as you come up to
    // them and are never seen to appear. It lifts as you climb, and the view opens out.
    if (AIR && air > 0.03 && body === activeBody && mode !== "deep" && hasPlants(body)) scene.fog.density = Math.max(scene.fog.density, (1.35 / Q.treeReach) * (1 - smoothstep((height - 250) / 700)));
    // Valley mist: wet worlds, thick air, strongest at dawn and dusk, thin by day, gone on dry worlds.
    const wet = body.physics?.waterState === "liquid" ? Math.min(1, 0.25 + (body.physics.waterCoverage ?? 0.4)) : 0.15;
    mistWant = k * wet * (0.25 + 0.5 * air) * (0.45 + 0.55 * dusk) * (0.35 + 0.65 * day);
    // The light takes the world's mood: the star warms at dusk and dims at night, the sky's
    // fill light is the air's own colour, and the light bounced from below is the ground's.
    sun.color.copy(sunBase).lerp(DUSK, dusk * (AIR ? 0.62 : 0.4) * k);
    hemiSky.copy(HEMI_SKY).lerp(tmpColor.copy(skyDay).multiplyScalar(0.75 / Math.max(0.05, skyDay.r * 0.2126 + skyDay.g * 0.7152 + skyDay.b * 0.0722)).lerp(HEMI_SKY, 0.35), k);
    hemi.color.copy(hemiSky).multiplyScalar(1 - k * (AIR ? 0.42 : 0.6) * (1 - day));
    if (AIR) hemi.color.lerp(tmpColor.set(0x6f8fd8), 0.45 * k * (1 - day)); // moonless starlight: cool, dim, readable
    hemi.groundColor.copy(HEMI_GROUND).lerp(tmpColor2.set(body.palette?.[1] || "#4c3844").multiplyScalar(0.55), k).multiplyScalar(1 - k * (AIR ? 0.5 : 0.7) * (1 - day));
    // Inside a cloud (clouds.mjs, cloud-mesh.js) the view closes in to a few dozen
    // metres of grey-white, lit like the cloud is; in a gap the air stays clear.
    const layer = mode !== "deep" && systemView.cloudsOf?.(body.id);
    inCloud = 0;
    if (layer) {
        const rel = camera.position.clone().sub(centre),
            depth = 1 - Math.abs(rel.length() - body.radius - layer.c.height) / layer.c.thickness;
        if (depth > 0) inCloud = smoothstep(depth / 0.6) * layer.densityAt(rel) * Math.min(1, layer.c.opacity * 1.2);
    }
    if (layer) layer.setSky(scene.background); // the sky behind the clouds, before any cloud fog
    if (inCloud > 0) {
        cloudFog.copy(layer.color).multiplyScalar(0.05 + 0.85 * day);
        scene.background.lerp(cloudFog, inCloud * 0.9);
        scene.fog.color.copy(scene.background);
        scene.fog.density = Math.max(scene.fog.density, inCloud * 0.028);
    }
    if (hiddenLayer && hiddenLayer !== layer) hiddenLayer.hide(0);
    hiddenLayer = layer || null;
    if (layer) layer.hide(inCloud);
    sky.setDaylight(Math.max(k * day, inCloud)); // no stars through a cloud
    nightNow = mode === "walk" ? 1 - day : 0;
    dayNow = day;
}
// Night filter: on foot at night the suit's visor brightens the view (glowing species most of all).
let nightNow = 0,
    nightFilter = 0;
const nightTint = document.createElement("div");
nightTint.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;background:#5dff9a;mix-blend-mode:soft-light";
document.body.append(nightTint);
function updateNightFilter(dt) {
    const want = codex.unlocked.has("nightFilter") ? smoothstep((nightNow - 0.3) / 0.5) : 0;
    nightFilter = damp(nightFilter, want, 1.5, dt);
    if (nightFilter < 0.002) nightFilter = 0;
    if (mode !== "deep") hemi.intensity = 2.0 * (shadows.enabled ? 1.2 : 1) * (1 - 0.55 * eclipseCover) * (1 + 2.2 * nightFilter); // (a little more sky light where the sun is shadowed) // set (not scaled) every frame, so it never compounds
    renderer.toneMappingExposure = 1.15 * (1 + 0.6 * nightFilter) * worldExposure();
    nightTint.style.opacity = (0.35 * nightFilter).toFixed(3);
}

// Dim stars and thick hazy air make a darker, moodier world; harsh light a brighter one.
let exposureFor = null, exposureValue = 1;
function worldExposure() {
    if (exposureFor !== activeBody) { exposureFor = activeBody; const e = floraEnvironmentLight(activeBody); exposureValue = 0.88 + 0.12 * clamp(e, 0, 1.4); }
    return onWorld() ? exposureValue : 1;
}
function floraEnvironmentLight(body) {
    const p = body.physics; if (!p) return 1;
    const irr = p.equilibrium ? (p.equilibrium / (1 - (p.albedo ?? .3)) ** 0.25 / 278) ** 4 : 1;
    return irr * ((body.starTemperature || 5600) < 4000 ? 0.7 : 1) / Math.max(1, (p.pressure ?? 1) / 3);
}

// --- Under water ------------------------------------------------------------------
// When the camera is below the surface of a sea: the view closes in to the water's own
// colour, light fades with depth (and with night), the surface is seen from below, and
// the Petrel's lamps come on. Runs last, after the sky, the weather and the night filter.
const underwaterTint = document.createElement("div");
underwaterTint.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;transition:opacity .4s;background:radial-gradient(ellipse at 50% 0%,rgba(140,210,255,.25),rgba(0,30,50,.55))";
document.body.append(underwaterTint);
const waterTint = new THREE.Color();
let cameraDepth = -1, lastWaterSide = null;
function updateUnderwater() {
    const t = onWorld() ? seaTerrain() : null, up = camera.position.clone().normalize();
    cameraDepth = t ? seaRadius() - camera.position.length() : -1;
    const under = cameraDepth > 0 && depthAt(up) > 0;
    const water = systemView.waterOf?.(activeBody.id);
    const side = under ? THREE.DoubleSide : THREE.FrontSide;
    if (water && lastWaterSide !== side) { water.side = side; water.needsUpdate = true; lastWaterSide = side; }
    underwaterTint.style.opacity = under ? "1" : "0";
    if (!under) { ship.userData.lamp.intensity = 0; return; }
    const fade = Math.exp(-cameraDepth / 26), light = (0.12 + 0.88 * dayNow) * (0.2 + 0.8 * fade);
    waterTint.setRGB(...t.waterColor, THREE.SRGBColorSpace);
    scene.background.copy(waterTint).multiplyScalar(0.05 + 0.6 * light);
    scene.fog.color.copy(scene.background);
    scene.fog.density = (t.solvent && t.solvent !== "water" ? 0.045 : 0.022) + cameraDepth * 0.0005;
    sun.intensity *= 0.25 + 0.75 * fade;
    hemi.intensity *= 0.35 + 0.65 * fade;
    sky.setDaylight(0);
    ship.userData.lamp.intensity = mode === "dive" ? 30 * (1.2 - light) : 0; // the Petrel's lamps
}

// --- The air of the country you are in (new plant style, style.mjs) ---------------
// Near the ground each kind of country has its own air. Under the trees of an old
// forest the light goes dim and green and the distance closes into haze, so a wood feels
// like a place you could get lost in; an ordinary forest is shaded and a little hazy;
// wetlands lie under a low mist; dry scrub and deserts shimmer with dust; frozen ground
// has a white ice haze, volcanic country an ash haze, toxic country a yellow one.
// fog: added fog density; tint: the haze's colour; sun, sky: how much of the direct and
// sky light gets through; mix: how far the sky itself takes the haze's colour.
const LOCAL_AIR = {
    darkwood: { fog: 0.017, tint: "#1d2c27", sun: 0.55, sky: 0.82, mix: 0.6 }, // (shadows now do much of the darkening)
    forest: { fog: 0.0085, tint: "#33463a", sun: 0.8, sky: 0.92, mix: 0.35 },
    wetland: { fog: 0.011, tint: "#6d7a66", sun: 0.85, sky: 0.92, mix: 0.45 },
    dryland: { fog: 0.0025, tint: "#c9b48a", sun: 1, sky: 1, mix: 0.15 },
    highland: { fog: 0.0015, tint: "#b9c6d2", sun: 1, sky: 1, mix: 0.08 },
    grassland: { fog: 0, tint: "#a8b89a", sun: 1, sky: 1, mix: 0 },
    Desert: { fog: 0.0025, tint: "#d1b27e", sun: 1, sky: 1, mix: 0.25 },
    Frozen: { fog: 0.005, tint: "#dfe8ee", sun: 0.95, sky: 1, mix: 0.3 },
    Volcanic: { fog: 0.006, tint: "#4a3e3a", sun: 0.8, sky: 0.9, mix: 0.35 },
    Toxic: { fog: 0.008, tint: "#a89a4a", sun: 0.85, sky: 0.95, mix: 0.4 },
};
// The cinematic air (?air=0 for the old): under trees the sky's fill light drops a long way
// and turns a cool blue-green, while the star keeps nearly all its strength and warms a
// little. The floor is dim and cool, and where the sun gets through it burns warm: the
// contrast that makes a wood feel deep.
if (AIR) {
    Object.assign(LOCAL_AIR.darkwood, { fog: 0.017, tint: "#1b2e2b", sun: 0.9, sky: 0.74, mix: 0.6 });
    Object.assign(LOCAL_AIR.forest, { fog: 0.0105, tint: "#2c4640", sun: 1, sky: 0.88, mix: 0.4 });
}
const WOOD_FILL = new THREE.Color(0x5f9c94), WOOD_SUN = new THREE.Color(0xffdfae);
const localAir = { fog: 0, sun: 1, sky: 1, mix: 0, woods: 0, tint: new THREE.Color() }, airTint = new THREE.Color(), airWant = { fog: 0, sun: 1, sky: 1, mix: 0, woods: 0, tint: new THREE.Color() };
let localAirAt = -1, localAirBody = null;
function updateLocalAir(dt) {
    if (PLANT_STYLE === "classic" || !onWorld() || indoor || cameraDepth > 0) return;
    const up = camera.position.clone().normalize(), t = terrainFor(activeBody);
    // Only near the ground: it fades out as you climb away (gone 140 m up).
    const height = camera.position.length() - RADIUS - t.surface(up), near = 1 - smoothstep((height - 25) / 115);
    if (orbitTime - localAirAt > 0.3 || localAirBody !== activeBody) {
        localAirAt = orbitTime;
        localAirBody = activeBody;
        const env = floraFor(activeBody).environment, c = t.climate(up);
        const biome = env && floraFor(activeBody).species.length > 1 ? plantBiome(c, env) : null;
        const a = (biome && biome !== "barren" && LOCAL_AIR[biome]) || LOCAL_AIR[activeBody.biome] || null;
        // A forest's glades let the light back in (the same stand field the trees follow).
        const open = biome === "darkwood" || biome === "forest" ? smoothstep((c.stand + 0.75) / 0.8) : 1;
        airWant.fog = a ? a.fog * open : 0;
        airWant.sun = a ? 1 - (1 - a.sun) * open : 1;
        airWant.sky = a ? 1 - (1 - a.sky) * open : 1;
        airWant.mix = a ? a.mix * open : 0;
        // Sunbeams (atmosphere.js) where trees stand thick enough to break the light up, but not so thick it is dark.
        airWant.woods = biome === "forest" || biome === "darkwood" ? (biome === "darkwood" ? 0.8 : 1) * (1 - 0.6 * Math.abs(open - 0.5) * 2) : 0;
        if (a) airWant.tint.set(a.tint);
    }
    const k = 1 - Math.exp(-dt / 1.6); // eases over a couple of seconds as you walk in or out
    localAir.fog += (airWant.fog - localAir.fog) * k;
    localAir.sun += (airWant.sun - localAir.sun) * k;
    localAir.sky += (airWant.sky - localAir.sky) * k;
    localAir.mix += (airWant.mix - localAir.mix) * k;
    localAir.woods += (airWant.woods - localAir.woods) * k;
    localAir.tint.lerp(airWant.tint, k);
    const air = airOf(activeBody) * near;
    if (air <= 0.001) return;
    // The haze is lit like everything else: dark at night, warm at dusk.
    airTint.copy(localAir.tint).multiplyScalar(0.06 + 0.94 * dayNow);
    scene.background.lerp(airTint, localAir.mix * air);
    scene.fog.color.copy(scene.background);
    scene.fog.density += localAir.fog * air;
    sun.intensity *= 1 - (1 - localAir.sun) * near;
    hemi.intensity *= 1 - (1 - localAir.sky) * near;
    if (AIR) {
        const shade = Math.min(1, (1 - localAir.sky) / 0.26) * near; // how far under the canopy you are
        hemi.color.lerp(WOOD_FILL, 0.62 * shade);
        sun.color.lerp(WOOD_SUN, 0.3 * shade * dayNow);
    }
}

// --- Weather (weather.mjs, weather-fx.js, wind.mjs) --------------------------------
// Below the clouds of the world you are on: rain, snow, ash or dust falling around
// you, where the cloud overhead is thick; wind that bends the plants; a darker,
// greyer sky under heavy cloud and storms, and lightning in the worst of them.
// Above the cloud layer the sky is clear. Runs after the sky, the sky events and the
// night filter have set this frame's light, and dims it.
const weatherFX = createWeatherFX(THREE, scene, { lite });
const GREY = new THREE.Color(0.32, 0.34, 0.37), FLASH = new THREE.Color(0.85, 0.88, 1);
const windVec = new THREE.Vector3();
let windNow = 0, rainNow = 0, gloomNow = 0, flash = 0, nextFlash = 0, weatherHere = null, weatherState = "", weatherToldAt = new Map();
function updateWeather(dt) {
    const layer = onWorld() ? systemView.cloudsOf?.(activeBody.id) : null;
    const up = camera.position.clone().normalize(),
        height = camera.position.length() - RADIUS;
    const w = layer?.weatherAt(up) ?? null;
    weatherHere = w;
    // Only below the cloud base; fading out as you climb into it.
    const below = layer ? 1 - smoothstep((height - (layer.c.height - 30)) / 25) : 0;
    const amount = w && !indoor ? w.precip * below : 0; // no rain indoors
    rainNow = damp(rainNow, amount, 0.6, dt);
    windNow = damp(windNow, w ? w.wind : 0, 0.4, dt);
    // The wind blows along the cloud drift (east or west), swinging round in storms.
    const east = Y.clone().cross(up);
    if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
    east.normalize().multiplyScalar(layer && layer.c.drift < 0 ? -1 : 1);
    windVec.copy(east).applyAxisAngle(up, (w?.storm ?? 0) * 1.2 + 0.3 * Math.sin(animationTime * 0.05));
    wind.strength.value = windNow * (layer ? 1 : 0);
    wind.dir.value = windVec.toArray();
    weatherFX.update(w && rainNow > 0.003 && cameraDepth <= 0 ? { camera, up, kind: w.kind, amount: rainNow, wind: windVec.clone().multiplyScalar(2 + 14 * windNow), light: dayNow, time: animationTime } : null);
    // Gloom: thick cloud and storms overhead darken the day and grey the sky.
    const gloom = w ? clamp(0.5 * w.thick * (0.4 + w.storm) + 0.35 * rainNow, 0, 0.7) * below : 0;
    gloomNow = damp(gloomNow, gloom, 0.5, dt);
    if (mode === "deep") return; // deep space: the lights are set elsewhere, and only once
    if (gloomNow > 0.002) {
        sun.intensity *= 1 - gloomNow;
        hemi.intensity *= 1 - 0.45 * gloomNow;
        GREY.setScalar(scene.background.r * 0.3 + scene.background.g * 0.59 + scene.background.b * 0.11).multiplyScalar(0.8);
        scene.background.lerp(GREY, gloomNow);
    }
    // Falling rain, snow and dust close in the view.
    const thicken = { rain: 0.004, acid: 0.005, methane: 0.006, snow: 0.012, ash: 0.014, dust: 0.03 }[w?.kind] ?? 0;
    scene.fog.density += thicken * rainNow;
    // Lightning: a flash every few seconds in the heart of a storm, lighting the clouds from inside.
    flash = Math.max(0, flash - dt * 5);
    if (w?.lightning && below > 0.5 && rainNow > 0.3 && animationTime > nextFlash) {
        flash = 0.6 + Math.random() * 0.4;
        nextFlash = animationTime + 1.5 + Math.random() * 7;
        if (Math.random() < 0.4) nextFlash = animationTime + 0.12; // often a double flash
    }
    const f = flash * flash;
    if (f > 0.001) {
        hemi.intensity *= 1 + 2.5 * f;
        scene.background.lerp(FLASH, 0.45 * f);
    }
    scene.fog.color.copy(scene.background);
    layer?.flash(f);
    // Tell the player when the weather turns where they are (at most once a minute per kind).
    const state = !w || rainNow < 0.25 ? "" : w.storm > 0.5 ? `${w.kind}-storm` : w.kind;
    if (started && state && state !== weatherState && orbitTime - (weatherToldAt.get(state) ?? -1e9) > 60) {
        weatherToldAt.set(state, orbitTime);
        const p = PRECIP[w.kind], storm = state.endsWith("-storm");
        toast(storm ? `${p.storm}: ${WEATHER_WORDS[w.kind].storm}` : WEATHER_WORDS[w.kind].calm, 5);
    }
    weatherState = state;
}
const WEATHER_WORDS = {
    rain: { calm: "It has started to rain.", storm: "wind, heavy rain and lightning overhead." },
    snow: { calm: "It has started to snow.", storm: "driving snow and a howling wind." },
    acid: { calm: "Acid drizzle is falling from the yellow clouds.", storm: "acid rain lashes down and lightning flickers in the cloud." },
    ash: { calm: "Ash is drifting down from the clouds.", storm: "thick falling ash, and lightning in the clouds." },
    methane: { calm: "Fat drops of methane rain are drifting down.", storm: "methane rain pours from the orange sky." },
    dust: { calm: "The wind is lifting dust.", storm: "a wall of dust is blowing through." },
};

// --- Sky events (phenomena.mjs, sky-events.js) ------------------------------------
// Eclipses, aurorae and meteor showers. On a world, a forecast for where you are is
// worked out every few seconds; the HUD tally shows what comes next, a toast says
// when one begins, and looking at it (the star, or up at the night sky) lets you
// record it with E. An eclipse dims the daylight, and a total one sends day animals
// to sleep and wakes the night ones.
const skyEvents = createSkyEvents(scene);
skyEvents.setWorld(activeBody);
let eclipseCover = 0,
    skyCast = [], // forecast: [{ type, name, start, end, total, by }] seen from here
    skyCastAt = -Infinity,
    skyCastBody = null,
    visibleSky = []; // what can be seen right now
const announcedSky = new Set();
const onWorld = () => ["walk", "landed", "flight", "landing", "takeoff", "dive"].includes(mode) && !activeBody.giant;
const skyRecorded = (type) => codex.has({ kind: "phenomenon", seed: String(system.seed), bodyId: activeBody.id, id: type });
function skyDescription(e) {
    const star = system.star.name, by = system.bodies.find((b) => b.id === e.by)?.name;
    const giant = system.bodies.find((b) => b.id === activeBody.parent && b.giant);
    if (e.type === "eclipse")
        return {
            description: `${by} slides across ${star}${e.total ? " and hides it completely: the day goes dark and the stars come out." : ", and the daylight dims."}`,
            facts: [["Caused by", by], ["Lasts", `About ${Math.max(1, Math.round((e.end - e.start) / 60))} min`], ["Seen", "By day, while the star is up"]],
        };
    if (e.type === "aurora")
        return {
            description: `Curtains of light ripple across the night sky where ${giant ? `particles caught in ${giant.name}'s magnetic field` : `particles from ${star}'s flares`} strike the upper air.`,
            facts: [["Caused by", giant ? `${giant.name}'s magnetic field` : `Flares from ${star}`], ["Seen", "At night, during a storm"]],
        };
    return {
        description: `Streaks of light cross the night sky as ${activeBody.name} passes through the dust trail of a comet.`,
        facts: [["Caused by", "Comet dust burning up in the air"], ["Seen", "At night, during a shower"]],
    };
}
// A sky event you are looking at (the star for an eclipse, the sky for the rest).
function skyTarget(holding) {
    if (mode !== "walk") return null;
    const fwd = camera.getWorldDirection(vec()), up = camera.position.clone().normalize();
    for (const e of visibleSky) {
        if (e.type === "eclipse") {
            const toStar = sun.position.clone().sub(camera.position).normalize();
            if (fwd.dot(toStar) < (holding ? 0.8 : 0.9)) continue;
        } else if (fwd.dot(up) < (holding ? 0.12 : 0.3)) continue;
        return {
            kind: "phenomenon", id: e.type, known: skyRecorded(e.type), reach: Infinity,
            point: camera.position.clone().addScaledVector(fwd, 400),
            ref: { name: e.name, type: e.type, total: !!e.total, ...skyDescription(e) },
        };
    }
    return null;
}
function updateSkyEvents(dt) {
    const here = onWorld();
    if (here && (orbitTime - skyCastAt > 8 || skyCastBody !== activeBody)) {
        if (skyCastBody !== activeBody) skyEvents.setWorld(activeBody);
        skyCastAt = orbitTime;
        skyCastBody = activeBody;
        const n = mode === "walk" ? playerNormal : shipPosition.clone().normalize();
        skyCast = forecast(system, activeBody, n.toArray(), orbitTime, 1800);
    }
    visibleSky = here ? skyCast.filter((e) => e.start <= orbitTime && orbitTime < e.end) : [];
    eclipseCover = here ? eclipseAt(system, activeBody, orbitTime).cover : 0;
    if (mode !== "deep") {
        sun.intensity = 3.1 * (1 - 0.92 * eclipseCover);
        hemi.intensity = 2.0 * (1 - 0.55 * eclipseCover);
    }
    for (const e of started ? visibleSky : []) {
        const key = `${system.seed}:${activeBody.id}:${e.type}:${Math.round(e.start / 30)}`;
        if (announcedSky.has(key)) continue;
        announcedSky.add(key);
        if (e.type === "eclipse" && skyRecorded("eclipse")) continue; // common on moons: only news the first time
        const look = skyRecorded(e.type) ? "" : mode !== "walk" ? " Step outside to record it." : e.type === "eclipse" ? " Look at the star and hold E to record it." : " Look up and hold E to record it.";
        const by = system.bodies.find((b) => b.id === e.by)?.name;
        toast(
            e.type === "eclipse" ? `${e.total ? "A total eclipse" : "An eclipse"} is beginning: ${by} is crossing ${system.star.name}.${look}`
                : e.type === "aurora" ? `An aurora is lighting up the night sky.${look}` : `A meteor shower has begun.${look}`,
            6,
        );
    }
    // Drawn only near the ground, and only as dark as the sky really is.
    const up = camera.position.clone().normalize(),
        dark = clamp(-up.dot(sun.position.clone().normalize()) / 0.12, 0, 1),
        low = here ? 1 - smoothstep((camera.position.length() - RADIUS - 150) / 400) : 0;
    const strength = (type) => {
        const e = visibleSky.find((x) => x.type === type);
        return e ? clamp(Math.min(orbitTime - e.start, e.end - orbitTime) / 25, 0, 1) * dark * low : 0;
    };
    skyEvents.update({ camera, up, aurora: strength("aurora"), meteors: strength("meteors"), dt, time: animationTime });
}
// The tally's last line: what the sky does next, seen from here.
function skyLine() {
    const ahead = skyCast.filter((e) => e.end > orbitTime);
    const e = ahead.find((x) => !skyRecorded(x.type)) || ahead[0];
    if (!e) return "";
    const mins = (e.start - orbitTime) / 60;
    const when = e.start <= orbitTime ? (skyRecorded(e.type) || mode !== "walk" ? "now" : e.type === "eclipse" ? "now · look at the star" : "now · look up")
        : mins < 1 ? "in under a minute" : `in ${Math.round(mins)} min`;
    return `<div class="tally-sky${skyRecorded(e.type) ? " done" : ""}"><span>${e.name}</span> ${when}</div>`;
}
// Behaviour logger (upgrade): say when an animal nearby is doing something new.
let alertTimer = 0,
    lastAlert = -Infinity;
function updateBehaviourAlerts(dt) {
    if (mode !== "walk" || !site?.fauna?.individualsOf || !behaviourAlerts(codex.unlocked) || (alertTimer += dt) < 1.5) return;
    alertTimer = 0;
    if (animationTime - lastAlert < 25) return;
    const here = surfacePoint(playerNormal);
    let best = null;
    for (const sp of site.fauna.species)
        for (const { creature, position } of site.fauna.individualsOf(sp)) {
            const b = behaviourNow(creature), d = position.distanceTo(here);
            if (!b || d > 90 || (best && d > best.d) || codex.has(behaviourEntry(system, activeBody, sp, b))) continue;
            best = { sp, b, d };
        }
    if (!best) return;
    lastAlert = animationTime;
    toast(`Behaviour logger: a ${best.sp.name} is ${BEHAVIOURS[best.b].verb} ${Math.round(best.d)} m away.`, 5);
}

// Heat glow at the screen edges when flying close to a star.
let heat = 0,
    shownHeat = 0;
const heatGlow = document.createElement("div");
heatGlow.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;background:radial-gradient(ellipse at center,rgba(255,170,90,0) 35%,rgba(255,120,40,.55) 80%,rgba(255,210,150,.85) 100%)";
document.body.append(heatGlow);
function updateHeat(dt) {
    if (mode !== "space") heat = 0;
    if (mode !== "space" && mode !== "deep" && driveFade) { driveFade = 0; streaks.hide(); } // (into orbit or a cruise mid-fade)
    shownHeat = damp(shownHeat, heat, 4, dt);
    heatGlow.style.opacity = shownHeat < 0.01 ? "0" : shownHeat.toFixed(3);
}

// --- Danger without combat ---------------------------------------------------
// Some big hunters stalk you on foot. A lunge knocks you back and damages your suit;
// the suit recovers once you are left alone for a while. If it fails, the Kestrel's
// emergency recall brings you back beside the ship. On board you are always safe.
let suit = 1,
    sinceHit = 99,
    lastStalkToast = -Infinity;
const suitReadout = document.createElement("div");
suitReadout.style.cssText =
    "position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:3;pointer-events:none;font:600 10px 'DM Sans',sans-serif;letter-spacing:2px;color:#ffd0b0;text-shadow:0 1px 6px #000;display:none;text-align:center";
document.body.append(suitReadout);
const hitFlash = document.createElement("div");
hitFlash.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;transition:opacity .5s;background:radial-gradient(ellipse at center,rgba(255,40,30,0) 45%,rgba(255,40,30,.6) 100%)";
document.body.append(hitFlash);
function sufferAttacks() {
    for (const e of site.fauna.events) {
        if (e.type === "stalk" && mode === "walk" && animationTime - lastStalkToast > 20) {
            lastStalkToast = animationTime;
            toast(`A ${e.creature.sp.name} is stalking you. Keep moving, or get back aboard the ${shipName()}.`, 5);
        }
        if (e.type !== "attack" || mode !== "walk") continue;
        suit = Math.max(0, suit - e.damage * suitDamageScale(codex.unlocked));
        sinceHit = 0;
        hitFlash.style.transition = "none";
        hitFlash.style.opacity = "1";
        requestAnimationFrame(() => { hitFlash.style.transition = "opacity .9s"; hitFlash.style.opacity = "0"; });
        // Knocked back, away from the animal.
        const away = tangent(playerNormal.clone().sub(e.from), playerNormal);
        if (away.lengthSq() > 0.01) playerNormal.addScaledVector(away, 3.5 / RADIUS).normalize();
        jumpVelocity = Math.max(jumpVelocity, 2.4);
        if (jumpHeight <= 0) jumpHeight = 0.01;
        if (suit <= 0) {
            suit = 1;
            recallToShip();
            toast(`Suit integrity failed. Emergency recall: you are back beside the ${shipName()}.`, 6);
        } else toast(`Struck by a ${e.creature.sp.name}! Suit integrity ${Math.round(suit * 100)}%.`, 4);
    }
}
// Cold and heat on foot: on worlds below −80 °C or above 80 °C the suit's heat reserve runs
// down while you walk (1.5–2.5 minutes; four times longer with Thermal lining). It refills
// aboard the Kestrel or right beside it. Empty means the same emergency recall as a failed suit.
let warmth = 1,
    exposureWarned = null;
function updateExposure(dt) {
    const severity = exposureOf(activeBody.physics?.temperature ?? 288);
    const sheltered = mode !== "walk" || surfacePoint(playerNormal).distanceTo(shipPosition) < 9;
    if (!severity || sheltered) {
        warmth = Math.min(1, warmth + dt * 0.2);
        return null;
    }
    if (exposureWarned !== activeBody.id) {
        exposureWarned = activeBody.id;
        const cold = activeBody.physics.temperature < 288;
        toast(`${cold ? "Extreme cold" : "Extreme heat"}: your suit's heat reserve is running down. Stay near the ${shipName()} to recharge it${codex.unlocked.has("thermalLining") ? "" : ", or install Thermal lining to stay out longer"}.`, 7);
    }
    warmth = Math.max(0, warmth - dt * (1 + 0.65 * severity) / 150 * exposureScale(codex.unlocked));
    if (warmth <= 0) {
        warmth = 1;
        recallToShip();
        toast(`Suit heat reserve empty. Emergency recall: you are back beside the ${shipName()}.`, 6);
    }
    return activeBody.physics.temperature < 288 ? "COLD" : "HEAT";
}
function updateSuit(dt) {
    sinceHit += dt;
    if (sinceHit > 6) suit = Math.min(1, suit + dt * 0.05 * suitRecoveryScale(codex.unlocked));
    const exposure = updateExposure(dt);
    const lines = [];
    if (mode === "walk" && suit < 0.999) lines.push(`SUIT INTEGRITY ${Math.round(suit * 100)}%${sinceHit > 6 ? " · RECOVERING" : ""}`);
    if (mode === "walk" && (exposure || warmth < 0.999)) lines.push(`${exposure === "HEAT" ? "COOLING" : "HEAT"} RESERVE ${Math.round(warmth * 100)}%${exposure ? ` · EXTREME ${exposure === "HEAT" ? "HEAT" : "COLD"}` : " · RECHARGING"}`);
    suitReadout.style.display = lines.length ? "block" : "none";
    if (lines.length) suitReadout.innerHTML = lines.join("<br>");
}
// Life sonar: on foot, an arrow at the top of the view points to the nearest plant or
// animal species on this world that you have not recorded yet (within 600 m).
// Drawn like the ship's waypoint: a marker over the thing itself (clamped to the screen
// edges), or at the side to turn toward when it is behind you.
const sonarView = document.createElement("div");
sonarView.id = "sonarMark";
sonarView.style.display = "none";
sonarView.innerHTML = '<span class="diamond">◇</span><strong></strong><span class="dist"></span>';
$("hud").append(sonarView);
// The suit readouts and the sonar share one column under the header, so they never overlap.
const topStack = document.createElement("div");
topStack.style.cssText = "position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:3;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:8px";
document.body.append(topStack);
for (const el of [suitReadout]) {
    el.style.position = "static";
    el.style.transform = "none";
    topStack.append(el);
}
let sonarTimer = 0,
    sonarTarget = null; // { point, kind }
function nearestUnrecorded() {
    const here = surfacePoint(playerNormal), known = scannedHere();
    let best = null, bestD = 600 * 600;
    const offer = (point, kind) => {
        const d = point.distanceToSquared(here);
        if (d < bestD) { bestD = d; best = { point, kind }; }
    };
    for (const sp of site.fauna?.species || []) {
        if (known.fauna.includes(sp.id)) continue;
        for (const p of site.fauna.positionsOf(sp)) offer(p, "animal");
    }
    for (const { species, positions } of site.flora?.placed || []) {
        if (known.flora.includes(species.id)) continue;
        for (let i = 0; i < positions.length; i += 3) {
            const dx = positions[i] - here.x, dy = positions[i + 1] - here.y, dz = positions[i + 2] - here.z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bestD) { bestD = d; best = { point: vec(positions[i], positions[i + 1], positions[i + 2]), kind: "plant" }; }
        }
    }
    return best;
}
function updateSonar(dt) {
    if (!(codex.unlocked.has("lifeSonar") || guidedHere()) || mode !== "walk" || !site || modalOpen()) {
        sonarView.style.display = "none";
        return;
    }
    if ((sonarTimer -= dt) <= 0) {
        sonarTimer = 0.5;
        sonarTarget = nearestUnrecorded();
    }
    if (!sonarTarget) {
        sonarView.style.display = "none";
        return;
    }
    const here = surfacePoint(playerNormal), to = sonarTarget.point.clone().sub(here);
    const right = playerForward.clone().cross(playerNormal);
    const angle = Math.atan2(to.dot(right), to.dot(playerForward));
    const mark = sonarTarget.point.clone().addScaledVector(playerNormal, 1.2);
    const ahead = mark.clone().sub(camera.position).dot(camera.getWorldDirection(vec())) > 0;
    let x, y;
    if (ahead) {
        const p = mark.project(camera);
        x = clamp((p.x * 0.5 + 0.5) * innerWidth, 55, innerWidth - 55);
        y = clamp((-p.y * 0.5 + 0.5) * innerHeight, 100, innerHeight - 200);
    } else {
        x = angle > 0 ? innerWidth - 70 : 70;
        y = innerHeight * 0.45;
    }
    sonarView.style.display = "block";
    sonarView.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    sonarView.children[1].textContent = `${ahead ? "" : angle > 0 ? "" : "↶ "}UNRECORDED ${sonarTarget.kind.toUpperCase()}${ahead || angle <= 0 ? "" : " ↷"}`;
    sonarView.children[2].textContent = fmtDistance(to.length()) + (ahead ? "" : " · behind you");
}
// Back on foot beside the parked ship, facing away from it.
function recallToShip() {
    const up = shipPosition.clone().normalize(),
        right = shipForward.clone().cross(up).normalize();
    playerNormal = shipPosition.clone().addScaledVector(right, 5.5).addScaledVector(shipForward, 2).normalize();
    playerForward = tangent(right, playerNormal);
    jumpHeight = 0;
    jumpVelocity = 0;
    keys.clear();
}

// Animals hunt each other whether or not you watch; if a catch happens near you, say so.
const sunDirection = new THREE.Vector3();
let lastHuntToast = -Infinity;
function witnessHunts(watcher) {
    if (!watcher || animationTime - lastHuntToast < 25) return;
    for (const e of site.fauna.events)
        if (e.type === "catch" && e.position.distanceTo(watcher.position) < 70) {
            lastHuntToast = animationTime;
            toast(`You watch a ${e.hunter.sp.name} catch a ${e.prey.sp.name}.`, 5);
            return;
        }
}

// The HUD reads live state through these getters (hud.js).
const hudState = {
    get mode() { return mode; },
    get autoApproach() { return autoApproach; },
    get stage() { return stage; },
    get discovered() { return discovered; },
    get selectedBody() { return selectedBody; },
    get activeBody() { return activeBody; },
    get shipPosition() { return shipPosition; },
    get playerNormal() { return playerNormal; },
    get speed() { return speed; },
    get verticalSpeed() { return verticalSpeed; },
    get signalNormal() { return signalNormal; },
    get worldOrigin() { return worldOrigin; },
    get system() { return system; },
    get deep() { return deepInfo(); },
    get target() { return target; },
    get swimming() { return mode === "walk" && swimming; },
    get canSwim() { return canSwimHere(); },
    // Depth below the surface: the Petrel's while diving, your eyes' while swimming.
    get depth() { return mode === "dive" ? Math.max(0, seaRadius() - shipPosition.length()) : mode === "walk" && swimming ? Math.max(0, swimD) : 0; },
    playerPos,
    get shipName() { return shipName(); },
    get scanLabel() {
        if ((mode !== "walk" && mode !== "dive") || !scanTarget) return null;
        const verb = verbFor(scanTarget);
        if (scanTarget.known && scanTarget.kind === "fauna" && civOfSpecies(scanTarget.ref)) return stepAtLeast(relations.step(civOfSpecies(scanTarget.ref).id) || "observed", "contact") ? "Talk with them" : "Greet them";
        return scanTarget.known ? "Details" : scanProgress > 0 ? { scan: "Scanning…", observe: "Observing…", record: "Recording…", sample: "Drilling…" }[verb] : `Hold to ${verb}`;
    },
    get station() { return stationHUD(); },
    get stationMark() { return stationMark(); },
    clearTarget,
    camera,
    shipShadow,
    surfacePoint,
    distanceToSignal,
    altitude,
    openMap,
    act,
    approach,
    openGalaxy,
    positionOf,
};
const refreshHUD = () => {
    updateHUD(hudState);
    const glasses = hasFieldGlasses(codex.unlocked);
    document.body.classList.toggle("glasses", glasses);
    if (glasses && mode === "walk") $("controlHint").innerHTML = $("controlHint").innerHTML.replace("<kbd>E</kbd> scan / interact", "<kbd>E</kbd> scan / interact <kbd>Z</kbd> zoom");
};
let hudTimer = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;
    if (document.hidden) return;
    perf.begin();
    advanceOrbits();
    // Talking (contact-ui.js) does not stop the world: only you stand still.
    const talk = contactUI.isOpen, paused = modalOpen() && !talk;
    if ((paused || talk) && input.mouseLocked()) document.exitPointerLock?.();
    if (!paused) {
        animationTime += dt;
        if (started) {
            // A patrol ship meeting you (patrol.js), whatever you are doing.
            if (patrol) {
                const r = patrol.update(dt, { pos: shipPosition, fwd: shipForward, up: spaceUp }, mode === "space" && !jumpAnim);
                if (r.hold && mode === "space") speed = damp(speed, 0, 1.2, dt); // asked to hold position
                if (patrol.done) { patrol.dispose(); patrol = null; }
            }
            if (mode === "deep") updateDeep(dt);
            else if (mode === "space") jumpAnim ? updateJump(dt) : updateSpace(dt);
            else if (mode === "transit") updateCruise(dt);
            else if (mode === "flight") updateFlight(dt);
            else if (mode === "dive") updateDive(dt);
            else if (mode === "landed" && afloat && keys.has("KeyF")) tryDive();
            else if (mode === "landing" || mode === "takeoff")
                updateManeuver(dt);
            else if (mode === "walk") { if (talk) faceTalker(dt); else if (indoor) updateIndoor(dt); else updateWalk(dt); }
            else if (mode === "docking") updateDocking(dt);
            else if (mode === "docked") updateDocked();
            else if (mode === "undocking") updateUndocking(dt);
            else if (mode === "deck") { if (talk) faceTalker(dt); else updateDeck(dt); }
        } else orientShip();
        animateStation(dt);
        if (started) townChatter(dt);
        if (indoor) indoor.room.update(dt, animationTime, mode === "walk" ? { x: indoor.x, z: indoor.z } : null);
        updateFlow(dt);
        updateApproachSite();
        updateCamera(dt);
        talkView();
        if (started) updateWaypoint(hudState);
        $("waypoint").style.visibility = indoor || contactUI.isOpen ? "hidden" : ""; // nothing in the way of who you are with
        if (started) drawScanMarker();
        updateHeat(dt);
        updateSuit(dt);
        updateSonar(dt);
        updateAtmosphere();
        updateSkyEvents(dt);
        updateNightFilter(dt);
        updateWeather(dt);
        updateLocalAir(dt);
        updateUnderwater();
        updateBehaviourAlerts(dt);
        if (site) animateSite(dt);
        if (site?.fauna && mode !== "space" && mode !== "transit" && mode !== "deep") {
            const watcher =
                mode === "walk"
                    ? { position: playerPos(), onFoot: !indoor }
                    : altitude() < 60
                      ? { position: shipPosition, onFoot: false }
                      : null;
            // In a total eclipse the animals act as if night had fallen.
            sunDirection.copy(sun.position).normalize();
            if (eclipseCover > 0.9) sunDirection.negate();
            site.fauna.update(dt, animationTime, watcher, sunDirection);
            townNews(watcher);
            witnessHunts(watcher);
            sufferAttacks();
        }
        updateShipEffects(
            kestrel,
            {
                mode: { docking: "landing", docked: "landed", deck: "landed", undocking: "takeoff" }[mode] || mode,
                speed,
                verticalSpeed,
                altitude: altitude(),
                maneuverTime: maneuver?.time ?? 0,
                animationTime,
                shipPosition,
                surfacePoint,
            },
            dt,
        );
        toastTime -= dt;
        if (toastTime <= 0) $("toast").classList.remove("visible");
        hudTimer += dt;
        if (hudTimer > 0.08) {
            refreshHUD();
            hudTimer = 0;
        }
    }
    engine.update(
        !paused &&
            started &&
            (mode === "flight" || mode === "landing" || mode === "takeoff" || mode === "space" || mode === "transit" || mode === "docking" || mode === "undocking"),
        // In space the engine note climbs with speed too, scaled to space speeds.
        mode === "space" || mode === "transit" ? 30 + Math.min(Math.abs(speed), 1500) * 0.12 : speed,
        verticalSpeed,
    );
    if (!starMap.isOpen) {
        if (mode !== "deep") {
            systemView.update(camera.position, streamer);
            spaceView.visible = mode === "space" || mode === "transit" || (mode === "flight" && altitude() > 400);
            if (mode === "space" || mode === "transit" || mode === "flight") spaceView.update(camera.position, worldOrigin, orbitClock(), systemView.starMesh.position, dt);
            sky.follow(camera);
        } else { streamer.pump(4); spaceView.visible = false; }
        perf.beforeRender(); // a resolution change wipes the canvas, so it happens just before drawing
        finishSky();
        // Indoors, the daylight comes in only by the door and windows: the room is lit by its own lamp.
        // No haze or fog in a room either.
        // An eclipse: a moon or planet in front of the star dims its light (and the sky's).
        const ecl = mode === "deep" ? 0 : Math.max(0, systemView.eclipse(camera.position) - eclipseCover); // (eclipses seen from a world's surface already dim it: phenomena.mjs)
        const eclLit = ecl > 0.01 ? [sun.intensity, hemi.intensity] : null;
        if (eclLit) { sun.intensity *= 1 - 0.96 * ecl; hemi.intensity *= 1 - 0.6 * ecl; }
        const lit = indoor ? [sun.intensity, hemi.intensity, fill.intensity, scene.fog?.density] : null;
        if (lit) { sun.intensity *= 0.08; hemi.intensity *= 0.3; fill.intensity *= 0.2; if (scene.fog?.density !== undefined) scene.fog.density = 0.0005; }
        post.render(scene, camera); // the full-screen map hides the scene
        if (lit) { [sun.intensity, hemi.intensity, fill.intensity] = lit; if (lit[3] !== undefined) scene.fog.density = lit[3]; }
        if (eclLit) [sun.intensity, hemi.intensity] = eclLit;
        perf.tick(now);
    }
}
window.addEventListener("resize", () => {
    starMap.resize();
    sky.resize();
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});
canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    keys.clear();
    $("error").hidden = false;
    $("errorMessage").textContent =
        "The graphics context was interrupted. Reload to start again; recorded discoveries are preserved.";
});
orientShip();
camera.position
    .copy(shipPosition)
    .addScaledVector(shipForward, -22)
    .addScaledVector(shipPosition.clone().normalize(), 10);
camera.up.copy(shipPosition.clone().normalize());
camera.lookAt(shipPosition);
refreshWorldLabels();
setStage(discovered ? 3 : 0);
refreshHUD();
// Field scanner (upgrade): the HUD counts what is left to record on this world.
let tallyTimer = 0;
function updateTally(now = false, dt = 1 / 60) {
    if (!now && (tallyTimer += dt) < 0.5) return;
    tallyTimer = 0;
    const el = $("worldTally");
    if (!el) return;
    const totals = site && !activeBody.giant ? siteTotals() : null;
    const on = totals && ["walk", "landed", "flight", "landing", "takeoff", "dive"].includes(mode);
    el.hidden = !on;
    if (!on) return;
    const got = recordedOn(codex.entries, system.seed, activeBody.id);
    const rows = [["Plants", got.flora, totals.flora], ["Animals", got.fauna, totals.fauna], ["Geology", got.formation, totals.formations], ["Under water", got.sea, totals.sea]].filter(([, , t]) => t > 0);
    const html = rows.map(([w, g, t]) => `<div class="tally-row${g >= t ? " done" : ""}"><span>${w}</span><b>${Math.min(g, t)} / ${t}</b><i style="--f:${Math.min(1, g / t).toFixed(3)}"></i></div>`).join("") + skyLine();
    if (el.innerHTML !== html) el.innerHTML = html;
}
// What the world holds (a formation cleared by builders is not counted).
function siteTotals() {
    // Life found only under water is counted apart: a bonus, not needed to complete a world.
    const flora = site.flora?.species ?? [], fauna = site.fauna?.species ?? [];
    return {
        flora: flora.filter((s) => !s.aquatic).length, // every species grows somewhere on the world
        fauna: fauna.filter((s) => !seaOnly(s)).length,
        sea: flora.filter((s) => s.aquatic).length + fauna.filter(seaOnly).length,
        formations: site.geology?.placed?.filter((p) => p.scales.some((x) => x > 0)).length ?? 0,
    };
}
const structureSun = new THREE.Vector3();
// Where you will be in a couple of seconds, as an offset from the camera: plants and
// ground cover are filled in around that point, not around where you are, so what lies
// ahead is already there when it comes into view (flying, it used to appear on screen).
const leadAhead = new THREE.Vector3(), leadPrev = new THREE.Vector3(), leadStep = new THREE.Vector3();
let leadKnown = false;
function updateLead(dt) {
    leadStep.copy(camera.position).sub(leadPrev); leadPrev.copy(camera.position);
    if (!leadKnown || dt <= 0 || leadStep.length() > 60) { leadKnown = true; leadAhead.set(0, 0, 0); return; } // (a jump: landing, boarding, a new world)
    leadStep.multiplyScalar(2.4 / dt); // metres travelled in the next 2.4 seconds at this speed
    if (leadStep.length() > 170) leadStep.setLength(170);
    leadAhead.lerp(leadStep, Math.min(1, dt * 3));
}
function animateSite(dt) {
    upgradeScreen.setMode(mode);
    updateTally(false, dt);
    updateLead(dt);
    site.update(camera.position, animationTime, leadAhead); // plants, rocks and animals fill in around you
    if (site.structures) site.structures.update(animationTime, structureSun.copy(sun.position).normalize()); // lamps by night, solar wings to the star
    // Towns built in full near you and as masses far off (structures-mesh.js units), swapped as you go.
    if (site.structures?.follow && site.group.visible) site.structures.follow(mode === "walk" || mode === "landed" ? playerPos() : shipPosition);
    if (site.groundCover) site.groundCover.update(camera.position, animationTime, undefined, leadAhead);
    checkTraces(dt);
}
// Seeing a settlement (on foot nearby, or flying low over it) records who built it.
let tracesTimer = 0;
function checkTraces(dt) {
    const built = site.structures;
    if (!built?.civ || traces[activeBody.id] || (tracesTimer += dt) < 0.5) return;
    tracesTimer = 0;
    const here = mode === "walk" ? playerPos() : ["flight", "landed", "landing", "takeoff", "dive"].includes(mode) && altitude() < 140 ? shipPosition : null;
    if (!here) return;
    const reach = (mode === "walk" ? 45 : 110) + built.civ.unit * 10;
    if (!built.sites.some((n) => n.clone().multiplyScalar(RADIUS).distanceTo(here) < reach)) return;
    traces[activeBody.id] = built.civ.tier; // a name, so a longer ladder later keeps old saves meaningful
    saveSurvey();
    showScanCard({ kind: "settlement", ref: built.civ }, recordInfo(settlementEntry(system, activeBody, civilizationOf(activeBody), built.civ.tier)));
}
requestAnimationFrame(frame);

// --- Galaxy travel: jumps reload into the destination system. ---
let jumping = false;
let beaconCache = { n: -1, set: null };
// --- Fast travel to places you have been (places.js) ---------------------------------
function keepPlace(kind, label) {
    if (offChart) return;
    let name = label, n = null;
    if (kind === "landing") {
        n = shipPosition.clone().normalize();
        const near = placesOfInterest().map((p) => ({ p, d: p.n.angleTo(n) * RADIUS })).sort((a, b) => a.d - b.d)[0];
        name = near && near.d < 2500 ? near.p.name.replace(/^./, (c) => c.toUpperCase()) : `A landing site on ${activeBody.name}`;
        if (near && near.d < 2500 && near.p.name !== "the signal site") kind = "town";
    }
    rememberPlace({ star: currentStar.id, world: activeBody.id, n: n && n.toArray(), name, where: `${activeBody.name} · ${system.name}`, kind });
}
// Arrive just above a remembered place (or near its world, for an ark or a station).
function arriveAtPlace(p) {
    if (!p.n) { toast(`Fast travel: ${activeBody.name}. ${p.name} is near.`, 5); return; }
    const n = vec(...p.n).normalize();
    mode = "flight";
    shipPosition.copy(n).multiplyScalar(surfaceRadius(n) + 260);
    const f = tangent(Math.abs(n.y) < 0.95 ? Y.clone() : vec(1, 0, 0), n);
    if (f.lengthSq() > 1e-9) shipForward.copy(f.normalize());
    speed = verticalSpeed = 0; autoApproach = false; target = selectedBody = null;
    camera.position.copy(shipPosition).addScaledVector(shipForward, -30).addScaledVector(n, 12);
    toast(`Fast travel: above ${p.name}.`, 5);
}
function travelTo(p) {
    if (!["flight", "space", "landed", "deep"].includes(mode)) return void toast("Fast travel leaves from the cockpit: board your ship first.", 4);
    places.close();
    starMap.close();
    keys.clear();
    if (p.star === loadedId && p.world === activeBody.id && !offChart) { arriveAtPlace(p); return; }
    const star = starById(p.star);
    if (!star) return;
    setGoto(p);
    jumping = true;
    galaxyState.current = star.id;
    galaxyState.visited.add(star.id);
    saveGalaxyState(galaxyState);
    try { sessionStorage.setItem("elsewhere-arrival", star.id); } catch {}
    if (mode === "space") jumpAnim = { t: 0, duration: 2.6, aim: shipForward.clone() };
    playJump(p.name, () => {
        try { history.replaceState(null, "", `?star=${star.id}&world=${p.world}${params.has("dev") ? "&dev" : ""}`); } catch {}
        location.reload();
    });
}
const starMap = createStarMap({
    jumpRange: () => jumpRangeNow(),
    charted: () => { const now = performance.now(); if (now - chartedCache.at > 1000) chartedCache = { at: now, set: relations.effects().charted }; return chartedCache.set; },
    radioHearing: () => radioHearing(codex.unlocked),
    decodes: () => decodesSignals(codex.unlocked),
    orbitalSurvey: () => codex.unlocked.has("orbitalSurvey"),
    // Return beacons: the seeds of systems with a fully documented world (recomputed when the codex grows).
    beacons: () => {
        if (!codex.unlocked.has("returnBeacons")) return null;
        if (beaconCache.n !== codex.entries.length) beaconCache = { n: codex.entries.length, set: new Set(completedWorlds(codex.entries).map((e) => e.seed)) };
        return beaconCache.set;
    },
    // Radio sources heard from here go into the codex quietly (they arrive in the background).
    onRadio: (sources) => sources.forEach((s) => record(signalEntry(s))),
    here: currentStar,
    system,
    deep: () => (mode === "deep" ? { position: galactic, course } : null),
    finds: () => Object.values(knownFinds),
    onCourse: (star) => setCourse(star),
    clearCourse: () => clearTarget(),
    course: () => course,
    state: galaxyState,
    offChart: () => offChart,
    canJump: () => started && mode === "space" && !jumping,
    blockedReason: () =>
        !started
            ? "Begin the expedition first."
            : mode === "transit"
              ? "Disengage cruise (T) before jumping."
              : "The jump drive needs free space: take off and climb above 600 m, then jump.",
    onJump: (star, name) => {
        jumping = true;
        keys.clear();
        starMap.close();
        galaxyState.current = star.id;
        galaxyState.visited.add(star.id);
        galaxyState.jumps++;
        saveGalaxyState(galaxyState);
        try {
            sessionStorage.setItem("elsewhere-arrival", star.id);
        } catch {}
        jumpAnim = { t: 0, duration: 2.6, aim: towardStar(star) };
        target = selectedBody = null;
        playJump(name, () => {
            // The destination is already saved, so a plain reload lands there even
            // where query strings are unavailable; the URL is updated where it can be.
            try {
                history.replaceState(null, "", `?star=${star.id}`);
            } catch {}
            if (new URLSearchParams(location.search).get("star") === star.id || !location.search) location.reload();
            else location.search = `?star=${star.id}`;
        });
    },
        survey: () => ({
        records,
        visited,
                activeId: activeBody.id,
        flora: catalogue,
        fauna: bestiary,
        traces,
        geology: strata,
    }),
    selectedBody: () => selectedBody,
    // The world view (starmap.js): the world you are at, and where on it you are.
    currentBody: () => mapFocus || activeBody, // (mapFocus: set as the map opens, see openMap)
    // Where the ship is in this system (system coordinates, metres), for the map's marker.
    shipInSystem: () => (mode === "deep" ? null : shipPosition.clone().add(worldOrigin).toArray()),
    shipNormal: (body) => body?.id === activeBody.id && !["space", "transit", "deep"].includes(mode) ? (mode === "walk" ? playerPos() : shipPosition).clone().normalize().toArray() : null,
    onSelectBody: (body) => {
        selectedBody = body = ownBody(body);
        if (body.id !== activeBody.id) target = body;
    },
    cruise: (body) => {
        if (body.id === activeBody.id && mode !== "space" && mode !== "transit")
            return { enabled: false, label: "You are here" };
        if (mode === "transit")
            return {
                enabled: false,
                label: "Cruise in progress",
                note: "Press T to disengage.",
            };
        if (!started)
            return { enabled: false, label: "Start the game first" };
        if (!["flight", "space"].includes(mode))
            return {
                enabled: false,
                label: "Take off to travel",
                note: `Return to the ${shipName()} and lift off to cruise to another world.`,
            };
        return { enabled: true, label: `Cruise to ${body.name} ↗` };
    },
    onCruise: (body) => {
        selectedBody = ownBody(body);
        beginCruise();
    },
});
const places = placesPanel($("starMap"), travelTo); // the list of places you have been (places.js)
$("mapPlacesBtn").onclick = () => places.toggle();
function openGalaxy() {
    if ($("help").open || $("discovery").open) return;
    keys.clear();
    starMap.open("local");
}
// G still opens the map on nearby stars; the one Map button (M) covers both.
try {
    if (
        sessionStorage.getItem("elsewhere-arrival") === currentStar.id &&
        !offChart
    ) {
        sessionStorage.removeItem("elsewhere-arrival");
        start();
        arriveNear(activeBody);
        const goto = takeGoto(currentStar.id, activeBody.id);
        if (goto) { playArrival(); arriveAtPlace(goto); } // (a fast-travel arrival: no glide in)
        else {
            // Out of the jump still moving: the ship glides in and settles where it used to appear.
            const glide = 30000, back = glide / 2.6;
            shipPosition.addScaledVector(shipForward, -back);
            camera.position.addScaledVector(shipForward, -back);
            speed = glide;
            driveFade = 1;
            drivePower = 0.8;
            playArrival();
            toast(
                `Jump complete: ${system.name}, a ${system.star.physics.spectralClass} star with ${system.bodies.length} worlds. ${activeBody.name} is ahead.`,
                6,
            );
        }
    }
} catch {}
// Not a jump arrival after all (or storage is blocked): show the start menu as usual.
if (!started) document.documentElement.classList.remove("arriving");
// Test mode (?dev): install or remove any upgrade and travel to worlds to try them (dev-panel.js).
setupDev({
    codex,
    system,
    star: currentStar,
    body: () => activeBody,
    onChange: () => {
        setShipDesign(kestrel, codex.unlocked.has("petrel") ? "petrel" : "kestrel"); // (the ship switch, or the Petrel ticked or unticked)
        starMap.setRange(jumpRangeNow());
        upgradeScreen.refresh();
        updateTally(true);
        refreshHUD();
    },
    toast,
});
