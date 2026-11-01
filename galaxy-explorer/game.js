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
import { createSystemView } from "./system-view.js";
import { setupInput } from "./input.js";
import { updateHUD } from "./hud.js";
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
const offChart = !currentStar && params.get("seed") !== null;
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
const system = generateSystem(offChart ? params.get("seed") : currentStar.seed);
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
let signalNormal = vec(...activeBody.signal);
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
// Every world, the star and the background stars (system-view.js).
const systemView = createSystemView(scene, system, { coarse: coarsePointer });
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
    sun.position.copy(systemView.starMesh.position);
}
buildSite();
positionSystem();


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
const saveKey = `elsewhere-system-${system.seed}`;
let records = new Set(),
    visited = new Set([activeBody.id]),
        catalogue = {}, // plant species catalogued per world: { bodyId: [speciesId] }
    bestiary = {}; // animal species observed per world: { bodyId: [speciesId] }
try {
    const saved = JSON.parse(localStorage.getItem(saveKey) || "{}");
    records = new Set(
        (saved.records || []).filter((id) =>
            system.bodies.some((b) => b.id === id),
        ),
    );
    visited = new Set([
        activeBody.id,
        ...(saved.visited || []).filter((id) =>
            system.bodies.some((b) => b.id === id),
        ),
    ]);
} catch {}
try {
        const savedLife = JSON.parse(localStorage.getItem(saveKey) || "{}");
    catalogue = savedLife.flora || {};
    bestiary = savedLife.fauna || {};
} catch {}
discovered = records.has(activeBody.id);
let selectedBody = system.bodies[0],
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
    if (mode === "space") {
        beginCruise();
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
    site.beacon.visible = false;
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
        cruise: () => (mode === "transit" ? cancelCruise() : beginCruise()),
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
    signalNormal = vec(...body.signal);
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
    completed = discovered;
    setStage(discovered ? 3 : 0);
    site.beacon.visible = !discovered;
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
    if (global.length() < system.star.radius + 140) {
        global.setLength(system.star.radius + 145);
        shipPosition.copy(global).sub(worldOrigin);
        speed = 0;
        verticalSpeed = 0;
        toast(`Stellar exclusion zone. Turn away from ${system.star.name}.`);
    }
    // Giants: the cloud tops are as far as Kestrel can go.
    for (const body of system.bodies) {
        if (!body.giant) continue;
        const centre = positionOf(body),
            limit = body.radius + GIANT_CLEARANCE;
        if (global.distanceTo(centre) < limit) {
            global.sub(centre).setLength(limit + 2).add(centre);
            shipPosition.copy(global).sub(worldOrigin);
            speed = Math.min(speed, 40);
            verticalSpeed = 0;
            toast(
                `${body.name} has no surface: the clouds only thicken into crushing pressure. Its moons are safe to land on.`,
            );
        }
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
        // Keep the player outside the central solid pedestal; interaction is available around it.
        const wet = terrainFor(activeBody).isLiquid(next);
        if (wet && toastTime <= 0)
            toast(
                terrainFor(activeBody).liquid === "lava"
                    ? "Lava ahead. Too hot to go further."
                    : "The water is too deep to go further.",
            );
        if (
            !wet &&
            Math.acos(clamp(next.dot(signalNormal), -1, 1)) * RADIUS > 3.7
        )
            playerNormal.copy(next);
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
        const inSpace = mode === "space" || mode === "transit";
        const up = inSpace ? spaceUp.clone() : shipPosition.clone().normalize();
        const back = shipForward.clone().negate().applyAxisAngle(up, orbitYaw);
        const framing = Math.max(1, 0.65 / camera.aspect);
        const desired = shipPosition
            .clone()
            .addScaledVector(back, 26 * framing * Math.cos(orbitPitch))
            .addScaledVector(up, (21 + 20 * Math.sin(orbitPitch)) * framing);
        const normal = desired.clone().normalize();
        const floor = surfaceRadius(normal) + 2;
        if (!inSpace && desired.length() < floor)
            desired.copy(normal.multiplyScalar(floor));
        camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
        camera.up.lerp(up, 1 - Math.exp(-dt * 4)).normalize();
        camera.lookAt(
            shipPosition
                .clone()
                .addScaledVector(shipForward, 12)
                .addScaledVector(up, inSpace ? 0 : -7),
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
    system,
    camera,
    shipShadow,
    surfacePoint,
    distanceToSignal,
    altitude,
    openMap,
    act,
    approach,
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
            if (mode === "space") updateSpace(dt);
            else if (mode === "transit") updateCruise(dt);
            else if (mode === "flight") updateFlight(dt);
            else if (mode === "landing" || mode === "takeoff")
                updateManeuver(dt);
            else if (mode === "walk") updateWalk(dt);
        } else orientShip();
        updateCamera(dt);
        site.core.rotation.y += dt * 0.5;
        site.core.position.y = 4 + Math.sin(animationTime * 1.4) * 0.3;
        site.ring.rotation.z += dt * 0.2;
        if (site.flora) site.flora.update(animationTime);
        if (site.fauna && mode !== "space" && mode !== "transit")
            site.fauna.update(
                dt,
                animationTime,
                mode === "walk"
                    ? { position: surfacePoint(playerNormal), onFoot: true }
                    : altitude() < 60
                      ? { position: shipPosition, onFoot: false }
                      : null,
            );
        site.beacon.material.opacity = 0.1 + Math.sin(animationTime * 2) * 0.045;
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
        systemView.update(camera.position);
        renderer.render(scene, camera); // the full-screen map hides the scene
    }
}
window.addEventListener("resize", () => {
    starMap.resize();
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
site.beacon.visible = !discovered;
refreshHUD();
requestAnimationFrame(frame);

// --- Galaxy travel: jumps reload into the destination system. ---
let jumping = false;
const starMap = createStarMap({
    here: currentStar,
    system,
    state: galaxyState,
    offChart,
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
    }),
    selectedBody: () => selectedBody,
    onSelectBody: (body) => {
        selectedBody = body;
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
        playArrival();
        toast(
            `Jump complete: ${system.name}, a ${system.star.physics.spectralClass} star with ${system.bodies.length} worlds. You are above ${activeBody.name}.`,
        );
    }
} catch {}
