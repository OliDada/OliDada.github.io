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

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

function buildWorld(body, streamer, coarse, gradual) {
    const planet = body.giant
        ? createGiant(THREE, body, { coarse, gradual })
        // Grid points per terrain tile: finer on laptops; phones get a lighter grid.
        : createPlanet(THREE, streamer, body, { segments: coarse ? 24 : 32, lite: coarse });
    if (body.ringed && !body.giant) {
        // Rocky worlds use the same banded rings as the giants, kept inside
        // their moons' orbits (which start 420 m above the surface).
        const R = body.radius,
            inner = R * 1.2,
            outer = Math.min(R * 1.95, R + 210);
        if (outer > inner + 25) {
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

function makeStar(system) {
    const star = createStarVisual({ radius: system.star.radius, color: system.star.color, seed: system.seed });
    star.group.userData.star = star;
    return star.group;
}

function view(scene, system, worlds, starMesh, group) {
    const local = new THREE.Vector3();
    return {
        system,
        group,
        starMesh,
        get visible() { return group.visible; },
        set visible(on) { group.visible = on; },
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
            for (const planet of worlds.values()) {
                local.copy(cameraPosition).divideScalar(s).sub(planet.group.position);
                planet.update(local);
            }
            starMesh.userData.star.update();
            streamer.pump(4);
        },
        dispose() {
            scene.remove(group);
            for (const planet of worlds.values()) planet.dispose();
            starMesh.userData.star.dispose();
        },
    };
}

export function createSystemView(scene, system, streamer, { coarse = false } = {}) {
    const group = new THREE.Group();
    const worlds = new Map();
    for (const body of system.bodies) {
        const planet = buildWorld(body, streamer, coarse, false);
        group.add(planet.group);
        worlds.set(body.id, planet);
    }
    const starMesh = makeStar(system);
    group.add(starMesh);
    scene.add(group);
    return view(scene, system, worlds, starMesh, group);
}

// The same, spread over many frames. Resolves with a hidden view.
export async function buildSystemViewGradually(scene, system, streamer, { coarse = false } = {}) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    const worlds = new Map();
    for (const body of system.bodies) {
        await nextFrame();
        const planet = buildWorld(body, streamer, coarse, true);
        if (planet.ready) await planet.ready; // giants fill their cloud maps a slice per frame
        group.add(planet.group);
        worlds.set(body.id, planet);
    }
    const starMesh = makeStar(system);
    group.add(starMesh);
    return view(scene, system, worlds, starMesh, group);
}
