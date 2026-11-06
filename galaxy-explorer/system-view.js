// Every world of one system and its star, in the 3D scene: level-of-detail
// planets and giants, including the one you are on. Worlds move along their
// orbits (orbits.mjs); game.js keeps coordinates relative to the world you are
// at, so place() takes that world's position as the origin.
//
// A system can be built all at once, or gradually (one world per frame, giant
// cloud maps in slices) while you approach it in deep space, so arriving at a
// new star never stalls the game. dispose() frees it when you leave for good.
import * as THREE from "./vendor/three.module.js";
import { createPlanet } from "./planet-lod.js";
import { createGiant, createRing } from "./giant-mesh.js";
import { createStarVisual } from "./star-mesh.js";
import { buildCityLights } from "./city-lights.js";
import { buildMegastructures } from "./megastructures.js";
import { createCloudLayer } from "./cloud-mesh.js";
import { orbitClock } from "./orbits.mjs";
import { terrainFor } from "./terrain.mjs";
import { SIZE } from "./scale.mjs";

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

function buildWorld(system, body, streamer, coarse, gradual, sun) {
    // Clouds (cloud-mesh.js) on worlds with air: a shell at the cloud layer, and
    // shadows cast on the ground. Sunlit in the star's colour, like the ground.
    const clouds = body.giant ? null : createCloudLayer(THREE, body, sun, { lite: coarse, light: sunlight(system), maxH: terrainFor(body).maxH });
    const planet = body.giant
        ? createGiant(THREE, body, { coarse, gradual })
        // Grid points per terrain tile: finer on laptops; phones get a lighter grid.
        : createPlanet(THREE, streamer, body, { segments: coarse ? 24 : 32, lite: coarse, clouds });
    if (clouds) {
        planet.group.add(clouds.mesh);
        planet.clouds = clouds;
        const dispose = planet.dispose;
        planet.dispose = () => { dispose(); clouds.dispose(); };
    }
    if (body.ringed && !body.giant) {
        // Rocky worlds use the same banded rings as the giants, kept inside
        // their moons' orbits (which start 420 m x SIZE above the surface).
        const R = body.radius,
            inner = R * 1.2,
            outer = Math.min(R * 1.95, R + 210 * SIZE);
        if (outer > inner + 25 * SIZE) {
            const ring = createRing(THREE, body, inner, outer, { segments: 160, opacity: 0.8 });
            const tilt = new THREE.Group();
            tilt.rotation.z = (((body.seed % 1000) / 1000) - 0.5) * 0.5;
            tilt.add(ring.mesh);
            planet.group.add(tilt);
            const dispose = planet.dispose;
            planet.dispose = () => { dispose(); for (const d of ring.disposables) d.dispose(); };
        }
    }
    return planet;
}

// The colour of sunlight, as game.js lights the scene.
const sunlight = (system) => "#" + new THREE.Color(system.star.color).lerp(new THREE.Color(0xffffff), 0.45).getHexString();

function makeStar(system) {
    const star = createStarVisual({ radius: system.star.radius, color: system.star.color, seed: system.seed });
    star.group.userData.star = star;
    return star.group;
}

// City lights on civilized worlds (city-lights.js), lit only on their night side:
// they share one uniform holding the star's position, updated every frame.
// actual: where a built site's lights really are (structures-mesh.js nightLights).
function addCityLights(system, body, planet, sun, actual = null) {
    try {
        if (planet.cityLights) { planet.group.remove(planet.cityLights); planet.cityLights.geometry.dispose(); planet.cityLights.material.dispose(); planet.cityLights = null; }
        const lights = buildCityLights(THREE, system, body, sun, actual);
        if (lights) { planet.group.add(lights); planet.cityLights = lights; }
    } catch (e) { console.warn("city lights", e); }
}

// What civilizations built between and around the worlds (megastructures.js).
function addMegastructures(system, worlds, group, sun) {
    try { return buildMegastructures(THREE, system, worlds, group, sun); } catch (e) { console.warn("megastructures", e); return null; }
}

function view(scene, system, worlds, starMesh, group, sun) {
    const local = new THREE.Vector3(), mega = addMegastructures(system, worlds, group, sun);
    return {
        system,
        group,
        starMesh,
        get visible() { return group.visible; },
        set visible(on) { group.visible = on; },
        // What has been built around a world that can't be passed through (megastructures.js).
        obstaclesNear: (id, p) => mega?.obstaclesNear(id, p) ?? [],
        ringOf: (id) => mega?.ringOf(id) ?? null,
        // Arks of spaceborne civilizations (megastation.js): { group, deck, civ, name, collide }.
        arks: () => mega?.arks ?? [],
        // Once a world's settlements are built, light them from space where their lights really are.
        useSiteLights(body, actual) { const planet = worlds.get(body.id); if (planet && actual) addCityLights(system, body, planet, sun, actual); },
        // positions: Map id -> [x, y, z] (system coordinates); origin: THREE.Vector3.
        // scale < 1 draws the whole system as a miniature around the scene origin:
        // seen from the origin it looks exactly like the full-size system, but it
        // fits inside the camera's range, so far-off systems can be drawn for real.
        place(positions, origin, scale = 1) {
            group.scale.setScalar(scale);
            for (const [id, planet] of worlds) {
                const p = positions.get(id);
                planet.group.position.set(p[0] - origin.x, p[1] - origin.y, p[2] - origin.z);
            }
            starMesh.position.copy(origin).negate();
        },
        // Refines detail around the camera (camera position in the same local frame).
        update(cameraPosition, streamer) {
            const s = group.scale.x;
            // The world you are on (or nearest to) is the one whose surface is closest;
            // the others are "away" and may use finer tiles (see planet-lod.js AWAY_BOOST).
            let here = null, best = Infinity;
            for (const planet of worlds.values()) {
                if (!planet.body || planet.body.giant) continue;
                const clearance = local.copy(cameraPosition).divideScalar(s).sub(planet.group.position).length() - planet.body.radius;
                if (clearance < best) { best = clearance; here = planet; }
            }
            const t = orbitClock();
            for (const planet of worlds.values()) {
                local.copy(cameraPosition).divideScalar(s).sub(planet.group.position);
                planet.update(local, { away: planet !== here });
                planet.clouds?.update(local, t);
            }
            starMesh.userData.star.update();
            mega?.update(performance.now() / 1000, starMesh.position);
            starMesh.getWorldPosition(sun.value);
            streamer.pump(4);
        },
        // The material of a world's sea surface (planet-lod.js), or undefined: game.js shows its underside when you dive.
        waterOf(id) { return worlds.get(id)?.waterMaterial; },
        // The cloud layer of a world (cloud-mesh.js), or undefined.
        cloudsOf(id) { return worlds.get(id)?.clouds; },
        dispose() {
            scene.remove(group);
            for (const planet of worlds.values()) planet.dispose();
            mega?.dispose();
            starMesh.userData.star.dispose();
        },
    };
}

export function createSystemView(scene, system, streamer, { coarse = false } = {}) {
    const group = new THREE.Group();
    const worlds = new Map(), sun = { value: new THREE.Vector3() };
    for (const body of system.bodies) {
        const planet = buildWorld(system, body, streamer, coarse, false, sun);
        addCityLights(system, body, planet, sun);
        group.add(planet.group);
        worlds.set(body.id, planet);
    }
    const starMesh = makeStar(system);
    group.add(starMesh);
    scene.add(group);
    return view(scene, system, worlds, starMesh, group, sun);
}

// The same, spread over many frames. Resolves with a hidden view.
export async function buildSystemViewGradually(scene, system, streamer, { coarse = false } = {}) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    const worlds = new Map(), sun = { value: new THREE.Vector3() };
    for (const body of system.bodies) {
        await nextFrame();
        const planet = buildWorld(system, body, streamer, coarse, true, sun);
        if (planet.ready) await planet.ready; // giants fill their cloud maps a slice per frame
        await nextFrame();
        addCityLights(system, body, planet, sun);
        group.add(planet.group);
        worlds.set(body.id, planet);
    }
    const starMesh = makeStar(system);
    group.add(starMesh);
    return view(scene, system, worlds, starMesh, group, sun);
}
