import * as THREE from "./vendor/three.module.js";
import {
    damp,
    smoothstep,
    smootherstep,
    verticalTarget,
} from "./flight-math.mjs";
import { generateSystem, terrainHeight, cruisePoint } from "./system.mjs";
import { terrainFor } from "./terrain.mjs";
import { buildSurface, disposeSurface } from "./surface.js";
import { createKestrel, updateShipEffects } from "./kestrel.js";
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
} from "./deep-space.js";
import { setupInput } from "./input.js";
import { updateHUD, updateWaypoint } from "./hud.js";
import { createEngineSound } from "./audio.js";
import { orbitClock, systemPositions } from "./orbits.mjs";
import { starById, homeStar } from "./galaxy.mjs";
import {
    loadGalaxyState,
    saveGalaxyState,
    playJump,
    playArrival,
} from "./galaxy-ui.js";
import { createStarMap } from "./starmap.js";

// Surface flight uses coordinates relative to the current world; space travel is continuous.
const $ = (id) => document.getElementById(id);
const coarsePointer = matchMedia("(pointer: coarse)").matches; // phones and tablets
const clamp = THREE.MathUtils.clamp;
const Y = new THREE.Vector3(0, 1, 0);
// Which star are we at? ?star= (galaxy chart), ?seed= (off-chart system), else the saved position or home.
const params = new URLSearchParams(location.search);
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
    system.bodies.find((b) => b.id === system.startId);
let RADIUS = activeBody.radius;
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// Where every body is right now (orbits.mjs). Coordinates in the scene are
// relative to the world you are at (worldOrigin).
let orbitTime = orbitClock(),
    positions = systemPositions(system, orbitTime);
const positionOf = (body) => vec(...positions.get(body.id));
let worldOrigin = positionOf(activeBody);
let signalNormal = vec(...terrainFor(activeBody).site); // dry, level ground near the signal
let landingNormal = vec(0, 1, 30 / RADIUS) // landing pad ~30 m from the signal
    .normalize()
    .applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(Y, signalNormal),
    );
const heightAt = (n) => terrainHeight(activeBody, n);
const surfaceRadius = (n) => RADIUS + heightAt(n);
const surfacePoint = (n, offset = 0) =>
    n.clone().multiplyScalar(surfaceRadius(n) + offset);
const tangent = (forward, up) =>
    forward.clone().addScaledVector(up, -forward.dot(up)).normalize();
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
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#07101d");
const camera = new THREE.PerspectiveCamera(
    58,
    innerWidth / innerHeight,
    0.08,
    90000,
);
scene.add(new THREE.HemisphereLight(0xb6dfdf, 0x4c3844, 2.0));
// Sunlight takes the star's colour: red dwarfs cast warm, dim-looking light.
const sun = new THREE.DirectionalLight(
    new THREE.Color(system.star.color).lerp(new THREE.Color(0xffffff), 0.45),
    3.1,
);
sun.position.set(-600, 550, 350);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x749bd5, 0.65);
fill.position.set(200, -100, -300);
scene.add(fill);

// The landing site around the current world's signal (surface.js), rebuilt on arrival.
let site = null;
function buildSite() {
    if (site) {
        scene.remove(site.group);
        disposeSurface(site.group);
    }
    site = buildSurface({
        body: activeBody,
        radius: RADIUS,
        signalNormal,
        landingNormal,
        surfacePoint,
        coarse: coarsePointer,
    });
    scene.add(site.group);
}
// Every world and the star of the system you are in (system-view.js). Terrain
// tiles for every system are built by one shared pool of background threads.
const streamer = createTerrainStreamer();
let systemView = createSystemView(scene, system, streamer, { coarse: coarsePointer });
let edge = systemEdge(system); // beyond this (metres from the star) is interstellar space
// The real stars of the galaxy, seen from where you are (deep-space.js).
const sky = createSky(scene, renderer);
const nearStar = createNearStar(scene);
const streaks = createDriveStreaks(scene);
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
    if (mode === "space" || mode === "transit") {
        shipPosition.sub(shift);
        camera.position.sub(shift);
    }
    worldOrigin.copy(origin);
    positionSystem();
}
function positionSystem() {
    systemView.place(positions, worldOrigin);
    if (mode !== "deep") sun.position.copy(systemView.starMesh.position);
}


const kestrel = createKestrel();
const { ship, shipShadow, dust } = kestrel;
scene.add(ship, shipShadow, dust);

let verticalSpeed = 0,
    flightPitch = 0,
    bankAngle = 0,
    turnVelocity = 0,
    maneuver = null;

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
    traces = {}; // worlds where you have seen what an intelligent species built: { bodyId: level }
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
    ship.quaternion.slerp(attitude, 1 - Math.exp(-dt * 9));
    ship.position.copy(shipPosition);
    shipShadow.position.copy(surfacePoint(up, 0.13));
    shipShadow.quaternion.setFromUnitVectors(vec(0, 0, 1), up);
    shipShadow.material.opacity = clamp(
        0.3 - (shipPosition.length() - surfaceRadius(up)) * 0.007,
        0,
        0.25,
    );
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
        ["Return to Kestrel", "Signal recorded. Your ship is waiting nearby."],
        [
            "A beginning, not an ending",
            `Signal recorded. Open the star map (M) for another world, or zoom out on it (G) to jump to another star.`,
        ],
    ];
    $("objective").textContent = entries[stage][0];
    $("objectiveDetail").textContent = entries[stage][1];
    $("stepCount").textContent = `0${stage + 1} / 04`;
    $("progress").style.width = `${(stage + 1) * 25}%`;
}
function modalOpen() {
    return $("help").open || $("discovery").open || $("starMap").open;
}
function start() {
    if (started) return;
    started = true;
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
}
function approach() {
    if (mode !== "flight") return;
    autoApproach = !autoApproach;
    toast(
        autoApproach
            ? "Approach assist engaged. Manual controls cancel it."
            : "Approach assist disengaged.",
    );
}
function act() {
    if (!started || modalOpen()) return;
    if (mode === "deep") {
        if (course) toggleAutopilot();
        else openGalaxy();
        return;
    }
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
            toast("Descend below 32 m with F, or use Approach signal.");
            return;
        }
        if (Math.abs(speed) > 18) {
            toast("Slow below 18 m/s. Release thrust or hold X to brake.");
            return;
        }
        // A conservative slope check rejects exceptionally steep generated ridges.
        const n = shipPosition.clone().normalize(),
            side = shipForward.clone().cross(n).normalize();
        const slope = Math.abs(
            heightAt(n.clone().addScaledVector(side, 0.018).normalize()) -
                heightAt(n.clone().addScaledVector(side, -0.018).normalize()),
        );
        if (slope > 3.5) {
            toast("Terrain too steep. Move toward flatter ground.");
            return;
        }
        if (terrainFor(activeBody).isLiquid(n)) {
            toast(
                terrainFor(activeBody).liquid === "lava"
                    ? "That is molten rock. Find solid ground to land."
                    : "Kestrel cannot land on water. Find solid ground.",
            );
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
    } else if (mode === "walk") {
        const shipDistance =
            surfacePoint(playerNormal).distanceTo(shipPosition);
        if (shipDistance < 9) {
            mode = "landed";
            speed = 0;
            verticalSpeed = 0;
            toast("Back aboard Kestrel. Press L to lift off.");
        } else if (distanceToSignal() < 9) {
            discover();
        } else
            toast(
                stage === 2
                    ? "Follow the Kestrel marker to return to your ship."
                    : "Follow the signal. Get closer to investigate.",
            );
    }
}
function interact() {
    if (!started || modalOpen()) return;
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
        jumpHeight = 0;
        jumpVelocity = 0;
        toast(
            coarsePointer
                ? "On foot. Drag to look, use the stick to walk, ⤒ to jump."
                : "On foot. Click the view for mouse look; WASD to walk, Space to jump.",
        );
    } else if (mode === "walk") act();
}
function discover() {
    discovered = true;
    records.add(activeBody.id);
    saveSurvey();
    setDiscoveryText(activeBody);
    $("logBtn").hidden = false;
    setStage(2);
    keys.clear();
    $("discovery").showModal();
}
$("startBtn").onclick = start;
$("approachBtn").onclick = approach;
$("actionBtn").onclick = () => (mode === "landed" ? interact() : act());
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
            if ($("help").open) $("help").close();
            else {
                keys.clear();
                $("help").showModal();
            }
        },
        act,
        interact,
        look(dx, dy, k) {
            if (mode === "walk") {
                playerForward.applyAxisAngle(playerNormal, -dx * 0.004 * k);
                lookPitch = clamp(lookPitch - dy * 0.003 * k, -1.15, 1.1);
            } else {
                orbitYaw -= dx * 0.005 * k;
                orbitPitch = clamp(orbitPitch + dy * 0.004 * k, -0.25, 1.15);
            }
        },
        manualControl: () => (autoApproach = false),
        toast,
        pick: (x, y) => pickAt(x, y),
        cycle: () => cycleTarget(),
    },
});
document.addEventListener("visibilitychange", () => (previousTime = performance.now()));


const engine = createEngineSound({
    button: $("soundBtn"),
    label: $("soundLabel"),
    onError: () => toast("Audio is unavailable in this browser."),
});


function refreshWorldLabels() {
    $("worldName").textContent = activeBody.name.toUpperCase();
    $("worldType").textContent =
        activeBody.type + " · " + system.name + " system";
    $("seedInput").value = system.seed;
    $("introDescription").textContent =
        `${system.bodies.length} worlds orbit ${system.star.name}, a ${system.star.physics.spectralClass} star. Start above ${activeBody.name}, or open your map and chart a different course.`;
    $("systemCoordinates").textContent = offChart
        ? `${system.name.toUpperCase()} SYSTEM / OFF-CHART SEED ${system.seed}`
        : `${system.name.toUpperCase()} SYSTEM / ${(Math.hypot(currentStar.x, currentStar.y) / 1000).toFixed(1)}K LY FROM THE CORE`;
}
function switchWorld(body, globalPosition) {
    const oldOrigin = worldOrigin.clone();
    activeBody = body;
    RADIUS = body.radius;
    worldOrigin = positionOf(body);
    signalNormal = vec(...terrainFor(body).site);
        landingNormal = vec(0, 1, 30 / RADIUS)
        .normalize()
        .applyQuaternion(
            new THREE.Quaternion().setFromUnitVectors(Y, signalNormal),
        );
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
    shipForward = tangent(signalNormal.clone().sub(n), n);
    if (shipForward.lengthSq() < 0.01) shipForward = tangent(vec(0, 0, -1), n);
    speed = 0;
    verticalSpeed = 0;
    flightPitch = 0;
    bankAngle = 0;
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
    saveSurvey();
    refreshWorldLabels();
    orientShip();
    toast(
        `Arrived at ${body.name}. Fly down, or use Approach signal to find a landing site.`,
    );
}
function orientSpace(dt) {
    let right = shipForward.clone().cross(spaceUp);
    if (right.lengthSq() < 1e-8)
        right = shipForward
            .clone()
            .cross(Math.abs(shipForward.x) < 0.9 ? vec(1, 0, 0) : vec(0, 0, 1));
    right.normalize();
    spaceUp.copy(right.clone().cross(shipForward).normalize());
    clockBasis.makeBasis(right, spaceUp, shipForward.clone().negate());
    const attitude = new THREE.Quaternion().setFromRotationMatrix(clockBasis);
    attitude.multiply(
        new THREE.Quaternion().setFromAxisAngle(vec(0, 0, 1), bankAngle),
    );
    ship.quaternion.slerp(attitude, 1 - Math.exp(-dt * 6));
    ship.position.copy(shipPosition);
    shipShadow.visible = false;
}
const GIANT_CLEARANCE = 250; // closest approach to a giant's cloud tops
function updateSpace(dt) {
    // A selected world, or else your course star: hold the nose on it whenever
    // you are not steering.
    const aim = target ? positionOf(target).sub(worldOrigin).sub(shipPosition).normalize() : course ? towardStar(course) : null;
    if (aim && !steering()) turnToward(aim, dt);
    const autoThrust = autopilot && course && !target && !keys.has("KeyW") && !keys.has("KeyS") && !keys.has("KeyX");
    const yaw = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);
    shipForward.applyAxisAngle(spaceUp, yaw * dt * 0.85);
    const right = shipForward.clone().cross(spaceUp).normalize();
    const pitch =
        (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
    shipForward.applyAxisAngle(right, pitch * dt * 0.7).normalize();
    spaceUp.applyAxisAngle(right, pitch * dt * 0.7).normalize();
    const boost = keys.has("ShiftLeft") || keys.has("ShiftRight"),
        brake = keys.has("KeyX");
    speed = damp(
        speed,
        brake
            ? 0
            : autoThrust
              ? shipForward.dot(aim) > 0.97 ? 900 : 60
              : ((keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)) *
                  (boost ? 900 : 220),
        brake ? 4 : 1.4,
        dt,
    );
    verticalSpeed = damp(
        verticalSpeed,
        brake
            ? 0
            : ((keys.has("KeyR") ? 1 : 0) - (keys.has("KeyF") ? 1 : 0)) *
                  (boost ? 100 : 35),
        3,
        dt,
    );
    bankAngle = damp(bankAngle, yaw * 0.25, 4, dt);
    shipPosition
        .addScaledVector(shipForward, speed * dt)
        .addScaledVector(spaceUp, verticalSpeed * dt);
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
        if (toastTime <= 0) toast(message);
    };
    holdOff(vec(), system.star.radius + 140, `Stellar exclusion zone. Turn away from ${system.star.name}.`);
    // Close to a star the hull heats up: the view glows and warnings start well
    // before the hard limit above.
    heat = clamp(1 - (global.length() - system.star.radius - 140) / (system.star.radius * 4), 0, 1);
    if (heat > 0.35 && toastTime <= 0)
        toast(heat > 0.75 ? `Hull temperature critical. Turn away from ${system.star.name}!` : `Hull temperature rising near ${system.star.name}.`, 2);
    for (const body of system.bodies)
        if (body.giant)
            holdOff(
                positionOf(body),
                body.radius + GIANT_CLEARANCE,
                `${body.name} has no surface: the clouds only thicken into crushing pressure. Its moons are safe to land on.`,
            );
    // Past the outermost orbits lies interstellar space.
    if (global.length() > edge * 0.85 && global.length() < edge && toastTime <= 0)
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
        .filter((item) => item.clearance < 240)
        .sort((a, b) => a.clearance - b.clearance);
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
    return positionOf(body).addScaledVector(
        vec(...body.signal),
        body.radius + (body.giant ? body.radius * 0.9 + 500 : 190),
    );
}
function updateCruise(dt) {
    travel.time += dt;
    travel.end = cruiseEnd(travel.body).toArray(); // the destination keeps moving
    const t = clamp(travel.time / travel.duration, 0, 1);
    const next = vec(
        ...cruisePoint(travel.start, travel.departure, travel.end, t),
    ).sub(worldOrigin);
    const delta = next.clone().sub(shipPosition);
    speed = delta.length() / Math.max(dt, 0.001);
    verticalSpeed = 0;
    if (delta.lengthSq() > 0.00001)
        shipForward.lerp(delta.normalize(), 1 - Math.exp(-dt * 3)).normalize();
    shipPosition.copy(next);
    bankAngle = damp(bankAngle, 0, 3, dt);
    spaceUp.lerp(Y, dt * 0.4).normalize();
    orientSpace(dt);
    $("transitProgress").style.width = `${t * 100}%`;
    $("transitPercent").textContent = `${Math.round(t * 100)}%`;
    if (t >= 1) {
        const destination = travel.body,
            global = next.clone().add(worldOrigin);
        travel = null;
        $("transit").hidden = true;
        if (destination.giant) arriveAtGiant(destination);
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
    throttle = autopilot && course ? 1 : 0.35;
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
    if (!course) return void toast("Set a course on the galaxy map (G) first.");
    autopilot = !autopilot;
    toast(autopilot ? `Autopilot to ${starName(course)}.` : "Autopilot off. Manual flight.");
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
    buildSystemViewGradually(scene, job.system, streamer, { coarse: coarsePointer }).then((view) => {
        if (incoming === job) {
            job.view = view;
            job.ready = true;
        } else view.dispose();
    });
}
// Any steering input (keys, joystick sideways).
const steering = () => keys.has("KeyA") || keys.has("KeyD") || keys.has("ArrowUp") || keys.has("ArrowDown");
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
            scale = Math.min(1, 45000 / reach);
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
function updateDeep(dt) {
    const steer = steering();
    const yaw = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);
    shipForward.applyAxisAngle(spaceUp, yaw * dt * 0.85);
    const right = shipForward.clone().cross(spaceUp).normalize();
    const pitch = (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
    shipForward.applyAxisAngle(right, pitch * dt * 0.7).normalize();
    spaceUp.applyAxisAngle(right, pitch * dt * 0.7).normalize();
    bankAngle = damp(bankAngle, yaw * 0.25, 4, dt);
    // With a course set, the ship holds its heading toward it whenever you are
    // not steering; steering takes over until you let go.
    let want = null;
    if (course && !steer) {
        want = courseAim();
        turnToward(want, dt);
    }
    const manualThrottle = keys.has("KeyW") || keys.has("KeyS") || keys.has("KeyX");
    if (autopilot && want && !manualThrottle) throttle = damp(throttle, shipForward.dot(want) > 0.97 ? 1 : 0.15, 1.5, dt);
    else if (keys.has("KeyX")) throttle = damp(throttle, 0, 4, dt);
    else throttle = clamp(throttle + ((keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)) * dt * 0.45, 0, 1);
    const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const nearest = sky.stars[0];
    const d = nearest ? nearest.distance : 1;
    const lyPerSecond = (throttle * Math.max(d, 0.0008)) / (boost ? DRIVE_TIME / 2.5 : DRIVE_TIME);
    const step = toGalaxy(shipForward);
    for (let i = 0; i < 3; i++) galactic[i] += step[i] * lyPerSecond * dt;
    speed = 120 + throttle * 600; // for engine glow
    verticalSpeed = 0;
    sky.update(galactic, camera);
    orientSpace(dt);
    streaks.update(camera, shipForward, throttle * (boost ? 1 : 0.7), dt);
    if (!nearest) return;
    // Light comes from the nearest star.
    const toStar = toScene(starPoint(nearest.star).map((v, i) => v - galactic[i])).normalize();
    sun.position.copy(toStar).multiplyScalar(1000);
    sun.color.set(nearest.physics.color).lerp(new THREE.Color(0xffffff), 0.45);
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
        if (site) {
            scene.remove(site.group);
            disposeSurface(site.group);
            site = null;
        }
        starMap.setHere(star, system);
        loadSurvey(null);
        if (course?.id === star.id) course = null;
    }
    nearStar.hide();
    streaks.hide();
    worldDots.hide();
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
        landingNormal = vec(0, 1, 30 / RADIUS)
            .normalize()
            .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, signalNormal));
        discovered = records.has(activeBody.id);
    }
    worldOrigin = positionOf(activeBody);
    shipPosition.copy(entry).sub(worldOrigin);
    camera.position.add(shipPosition);
    mode = "space";
    speed = 150;
    systemView.visible = true;
    if (site) site.group.visible = true;
    sun.intensity = 3.1;
    sun.color.set(system.star.color).lerp(new THREE.Color(0xffffff), 0.45);
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
function arriveAtGiant(body) {
    mode = "space";
    speed = 0;
    verticalSpeed = 0;
    shipForward = positionOf(body)
        .sub(worldOrigin)
        .sub(shipPosition)
        .normalize();
    spaceUp.copy(Y);
    keys.clear();
    visited.add(body.id);
    saveSurvey();
    const moons = system.bodies.filter((b) => b.parent === body.id);
    toast(
        `Holding above ${body.name}. No surface to land on${moons.length ? `: chart a course to ${moons.map((m) => m.name).join(" or ")}` : ""}.`,
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
function openMap() {
    if ($("help").open || $("discovery").open) return;
    keys.clear();
    starMap.open("system");
}
$("mapBtn").onclick = openMap;

function updateFlight(dt) {
    const up = shipPosition.clone().normalize();
    if (autoApproach) {
        const angle = up.angleTo(landingNormal),
            currentRadius = shipPosition.length();
        const nextUp = up.clone();
        const turnStep = Math.min(angle, dt * Math.min(0.14, angle * 0.75));
        if (angle > 0.001) {
            const axis = up.clone().cross(landingNormal).normalize();
            nextUp.applyAxisAngle(axis, turnStep);
            shipForward = tangent(landingNormal.clone().sub(up), nextUp);
        }
        const targetRadius = surfaceRadius(nextUp) + (angle > 0.16 ? 65 : 14);
        const targetVertical = clamp(
            (targetRadius - currentRadius) * 0.8,
            -18,
            18,
        );
        verticalSpeed = damp(verticalSpeed, targetVertical, 2.2, dt);
        const radius = currentRadius + verticalSpeed * dt;
        shipPosition.copy(nextUp.multiplyScalar(radius));
        speed = angle > 0.001 ? (turnStep / dt) * radius : 0;
        flightPitch = damp(flightPitch, 0, 3, dt);
        bankAngle = damp(bankAngle, 0, 3, dt);
        if (angle < 0.012 && altitude() < 18) {
            autoApproach = false;
            speed = 0;
            toast("Approach complete. Press L to land.");
        }
    } else {
        const turn = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);
        turnVelocity = damp(turnVelocity, turn * 1.0, 4, dt);
        shipForward.applyAxisAngle(up, turnVelocity * dt);
        bankAngle = damp(bankAngle, turnVelocity * 0.3, 4, dt);
        const pitchInput =
            (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
        flightPitch = damp(flightPitch, pitchInput * 0.65, 2.4, dt);
        const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const braking = keys.has("KeyX");
        let targetSpeed =
            ((keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)) *
            (boost ? 100 : 40);
        if (braking) targetSpeed = 0;
        speed = damp(speed, targetSpeed, braking ? 5 : 1.7, dt);
        const lift = (keys.has("KeyR") ? 1 : 0) - (keys.has("KeyF") ? 1 : 0);
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
    orientShip(dt);
    const global = shipPosition.clone().add(worldOrigin);
    const neighbor = system.bodies
        .filter((body) => body.id !== activeBody.id && !body.giant)
        .map((body) => ({
            body,
            clearance: global.distanceTo(positionOf(body)) - body.radius,
        }))
        .filter((item) => item.clearance < 240 && item.clearance < altitude())
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
        toast("Orbit cleared. Fly freely, or press M to chart a course.");
    }
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
            toast("Touchdown. Engines idle. Press E to leave Kestrel.");
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
        const walkingSpeed =
        keys.has("ShiftLeft") || keys.has("ShiftRight") ? 8 : 4.5;
    // Jumping: gravity follows the world's surface gravity, so moons give floaty leaps.
    const gravity = 9.8 * Math.max(0.15, activeBody.physics?.gravity ?? 1);
    if (keys.has("Space") && jumpHeight <= 0) jumpVelocity = 4.4;
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
        const next = resolveCollisions(
            surfacePoint(playerNormal)
                .addScaledVector(direction, walkingSpeed * dt)
                .normalize(),
        );
        const wet = terrainFor(activeBody).isLiquid(next);
        if (wet && toastTime <= 0)
            toast(
                terrainFor(activeBody).liquid === "lava"
                    ? "Lava ahead. Too hot to go further."
                    : "The water is too deep to go further.",
            );
        if (!wet) playerNormal.copy(next);
    }
    playerForward = tangent(playerForward, playerNormal);
            bob += moving && jumpHeight <= 0 ? dt * walkingSpeed * 1.8 : 0;
    speed = moving ? walkingSpeed : 0;
    checkFlora(dt);
}
let jumpHeight = 0,
    jumpVelocity = 0;
const PLAYER_RADIUS = 0.35;
// Slide around obstacles: push the next step out of anything taller than your feet.
function resolveCollisions(next) {
    const p = next.clone().multiplyScalar(surfaceRadius(next));
    const list = site.nearbyObstacles(p);
    list.push({ p: shipPosition.clone(), r: 3.2, h: 4 }); // the parked ship
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
// Walking close to a plant catalogues its species.
let floraTimer = 0;
function checkFlora(dt) {
    floraTimer += dt;
        if (floraTimer < 0.25) return;
        floraTimer = 0;
    const here = surfacePoint(playerNormal);
    // Animals: observed from a little way off, so even skittish ones can be recorded.
    const { flora, fauna } = site;
    if (fauna && fauna.species.length) {
        const seen = (bestiary[activeBody.id] ||= []);
        for (const sp of fauna.species) {
            if (seen.includes(sp.id)) continue;
            const reach = 12 + sp.size * 6;
            if (fauna.positionsOf(sp).some((p) => p.distanceTo(here) < reach)) {
                seen.push(sp.id);
                saveSurvey();
                toast(
                    `New animal observed (${seen.length} of ${fauna.species.length}): ${sp.name}. ${sp.description}`,
                    7,
                );
                return;
            }
        }
    }
    if (!flora || !flora.placed.length) return;
    const known = (catalogue[activeBody.id] ||= []);
    for (const { species, positions } of flora.placed) {
        if (known.includes(species.id)) continue;
        const reach = 3 + species.height * 0.5;
        for (let i = 0; i < positions.length; i += 3) {
            const dx = positions[i] - here.x,
                dy = positions[i + 1] - here.y,
                dz = positions[i + 2] - here.z;
            if (dx * dx + dy * dy + dz * dz < reach * reach) {
                known.push(species.id);
                saveSurvey();
                toast(
                    `New species catalogued (${known.length} of ${flora.species.length}): ${species.name}. ${species.description}`,
                    7,
                );
                return;
            }
        }
    }
}
function updateCamera(dt) {
    if (mode === "walk") {
                const eye = surfacePoint(
            playerNormal,
            1.75 + jumpHeight + Math.sin(bob) * 0.025,
        );
        camera.position.copy(eye);
        camera.up.copy(playerNormal);
        const look = playerForward
            .clone()
            .multiplyScalar(Math.cos(lookPitch))
            .addScaledVector(playerNormal, Math.sin(lookPitch));
        camera.lookAt(eye.clone().add(look));
        camera.fov = 70;
    } else {
                // The camera drifts back behind the ship once you stop looking around.
        if (!input.lookingAround(2500)) {
            orbitYaw = THREE.MathUtils.damp(orbitYaw, 0, 2, dt);
            orbitPitch = THREE.MathUtils.damp(orbitPitch, 0.18, 2, dt);
        }
        const inSpace = mode === "space" || mode === "transit" || mode === "deep";
        const up = inSpace ? spaceUp.clone() : shipPosition.clone().normalize();
        const back = shipForward.clone().negate().applyAxisAngle(up, orbitYaw);
        const framing = Math.max(1, 0.65 / camera.aspect);
        const desired = shipPosition
            .clone()
            .addScaledVector(back, 26 * framing * Math.cos(orbitPitch))
            .addScaledVector(up, ((inSpace ? 11 : 21) + 20 * Math.sin(orbitPitch)) * framing);
        const normal = desired.clone().normalize();
        const floor = surfaceRadius(normal) + 2;
        if (!inSpace && desired.length() < floor)
            desired.copy(normal.multiplyScalar(floor));
        camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
        camera.up.lerp(up, 1 - Math.exp(-dt * 4)).normalize();
        camera.lookAt(
            shipPosition
                .clone()
                // In space, look far ahead so what you fly toward sits mid-screen.
                .addScaledVector(shipForward, inSpace ? 32 : 12)
                // Near the ground the camera looks down a little; this fades out
                // while climbing, so leaving orbit doesn't jolt the view.
                .addScaledVector(up, inSpace ? 0 : -7 * (1 - smoothstep((altitude() - 120) / 480))),
        );
        camera.fov = THREE.MathUtils.damp(
            camera.fov,
            58 + (Math.abs(speed) > 55 ? 7 : 0),
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
        if (ahead)
            for (const b of ahead.system.bodies) {
                const p = ahead.starScene.clone().add(vec(...ahead.positions.get(b.id)));
                out.push({ kind: "body", body: b, star: ahead.star, point: p.normalize().multiplyScalar(5000).add(camera.position) });
            }
    } else {
        for (const b of system.bodies)
            if (b.id !== activeBody.id || mode === "space" || mode === "transit")
                out.push({ kind: "body", body: b, point: positionOf(b).sub(worldOrigin) });
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
        c.kind === "star"
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
    if (!target && !course && !selectedBody) return;
    target = course = pendingBody = selectedBody = null;
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
const skyDay = new THREE.Color(),
    skyNow = new THREE.Color(),
    skyNight = new THREE.Color();
scene.fog = new THREE.FogExp2(SPACE.getHex(), 0);
function airOf(body) {
    // 0 below ~0.03 bar, about 0.6 at Earth's 1 bar, 1 for very thick air.
    const p = body.physics?.pressure ?? 0;
    return clamp((Math.log10(Math.max(p, 1e-4)) + 1.5) / 2.5, 0, 1);
}
function updateAtmosphere() {
    const air = airOf(activeBody);
    let k = 0;
    if (air > 0 && mode !== "deep") {
        const height = camera.position.length() - RADIUS;
        k = air * (1 - smoothstep((height - 40) / (300 + 600 * air)));
    }
    const up = camera.position.clone().normalize(),
        elevation = up.dot(sun.position.clone().normalize()); // the star's height in your sky
    const day = smoothstep((elevation + 0.1) / 0.35),
        dusk = clamp(1 - Math.abs(elevation - 0.03) / 0.22, 0, 1);
    // The air's own colour, slightly tinted by the star and brighter in thick air.
    skyDay.set(activeBody.atmosphere).lerp(sun.color, 0.12).multiplyScalar(0.95 + 0.5 * air);
    skyNight.copy(skyDay).multiplyScalar(0.06);
    // Sunrise and sunset: a gentle warm shift, then dimming into night.
    skyNow.copy(skyDay).lerp(DUSK, dusk * 0.28);
    skyNow.lerp(skyNight, 1 - day);
    scene.background.copy(SPACE).lerp(skyNow, k);
    scene.fog.color.copy(scene.background);
    scene.fog.density = k * (0.00012 + 0.00045 * air);
    sky.setDaylight(k * day);
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
    shownHeat = damp(shownHeat, heat, 4, dt);
    heatGlow.style.opacity = shownHeat < 0.01 ? "0" : shownHeat.toFixed(3);
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
const refreshHUD = () => updateHUD(hudState);
let hudTimer = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;
    if (document.hidden) return;
    advanceOrbits();
        const paused = modalOpen();
    if (paused && input.mouseLocked()) document.exitPointerLock?.();
    if (!paused) {
        animationTime += dt;
        if (started) {
            if (mode === "deep") updateDeep(dt);
            else if (mode === "space") updateSpace(dt);
            else if (mode === "transit") updateCruise(dt);
            else if (mode === "flight") updateFlight(dt);
            else if (mode === "landing" || mode === "takeoff")
                updateManeuver(dt);
            else if (mode === "walk") updateWalk(dt);
        } else orientShip();
        updateCamera(dt);
        if (started) updateWaypoint(hudState);
        updateHeat(dt);
        updateAtmosphere();
        if (site) animateSite(dt);
        if (site?.fauna && mode !== "space" && mode !== "transit" && mode !== "deep") {
            const watcher =
                mode === "walk"
                    ? { position: surfacePoint(playerNormal), onFoot: true }
                    : altitude() < 60
                      ? { position: shipPosition, onFoot: false }
                      : null;
            site.fauna.update(dt, animationTime, watcher, sunDirection.copy(sun.position).normalize());
            witnessHunts(watcher);
        }
        updateShipEffects(
            kestrel,
            {
                mode,
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
            (mode === "flight" || mode === "landing" || mode === "takeoff"),
        speed,
        verticalSpeed,
    );
    if (!starMap.isOpen) {
        if (mode !== "deep") {
            systemView.update(camera.position, streamer);
            sky.follow(camera);
        } else streamer.pump(4);
        renderer.render(scene, camera); // the full-screen map hides the scene
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
function animateSite(dt) {
    if (site.flora) site.flora.update(animationTime);
    if (site.structures) site.structures.update(animationTime);
    checkTraces(dt);
}
// Seeing a settlement (on foot nearby, or flying low over it) records who built it.
let tracesTimer = 0;
function checkTraces(dt) {
    const built = site.structures;
    if (!built?.civ || traces[activeBody.id] || (tracesTimer += dt) < 0.5) return;
    tracesTimer = 0;
    const here = mode === "walk" ? surfacePoint(playerNormal) : ["flight", "landed", "landing", "takeoff"].includes(mode) && altitude() < 140 ? shipPosition : null;
    if (!here) return;
    const reach = (mode === "walk" ? 45 : 110) + built.civ.unit * 10;
    if (!built.sites.some((n) => n.clone().multiplyScalar(RADIUS).distanceTo(here) < reach)) return;
    traces[activeBody.id] = built.civ.level;
    saveSurvey();
    toast(`Signs of intelligence. ${built.civ.description}`, 9);
}
requestAnimationFrame(frame);

// --- Galaxy travel: jumps reload into the destination system. ---
let jumping = false;
const starMap = createStarMap({
    here: currentStar,
    system,
    deep: () => (mode === "deep" ? { position: galactic, course } : null),
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
    }),
    selectedBody: () => selectedBody,
    onSelectBody: (body) => {
        selectedBody = body;
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
            return { enabled: false, label: "Begin expedition first" };
        if (!["flight", "space"].includes(mode))
            return {
                enabled: false,
                label: "Take off to travel",
                note: "Return to Kestrel and lift off to cruise to another world.",
            };
        return { enabled: true, label: `Cruise to ${body.name} ↗` };
    },
    onCruise: (body) => {
        selectedBody = body;
        beginCruise();
    },
});
function openGalaxy() {
    if ($("help").open || $("discovery").open) return;
    keys.clear();
    starMap.open("local");
}
$("galaxyBtn").onclick = openGalaxy;
try {
    if (
        sessionStorage.getItem("elsewhere-arrival") === currentStar.id &&
        !offChart
    ) {
        sessionStorage.removeItem("elsewhere-arrival");
        start();
        arriveNear(activeBody);
        playArrival();
        toast(
            `Jump complete: ${system.name}, a ${system.star.physics.spectralClass} star with ${system.bodies.length} worlds. ${activeBody.name} is ahead.`,
            6,
        );
    }
} catch {}
// Not a jump arrival after all (or storage is blocked): show the start menu as usual.
if (!started) document.documentElement.classList.remove("arriving");
