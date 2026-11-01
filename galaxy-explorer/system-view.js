// Everything in the system you see from anywhere: every world (level-of-detail
// planets and giants, including the one you are on), the star and the
// background stars. Worlds move along their orbits (orbits.mjs); game.js
// keeps coordinates relative to the world you are at, so place() takes that
// world's position as the origin.
import * as THREE from "./vendor/three.module.js";
import { createTerrainStreamer, createPlanet } from "./planet-lod.js";
import { createGiant } from "./giant-mesh.js";

export function createSystemView(scene, system, { coarse = false } = {}) {
    const group = new THREE.Group();
    scene.add(group);
    // Every world, including the one you are on, is a level-of-detail planet: detail
    // rises smoothly as the camera gets closer (planet-lod.js).
    const streamer = createTerrainStreamer();
    const worlds = new Map(); // id -> { planet, group }
    for (const body of system.bodies) {
        const planet = body.giant
            ? createGiant(THREE, body, { coarse })
            : createPlanet(THREE, streamer, body);
        if (body.ringed && !body.giant) {
            const r = new THREE.Mesh(
                new THREE.RingGeometry(body.radius * 1.45, body.radius * 2.05, 96),
                new THREE.MeshBasicMaterial({
                    color: body.atmosphere,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.3,
                }),
            );
            r.rotation.x = Math.PI / 2 + 0.12;
            planet.group.add(r);
        }
        group.add(planet.group);
        worlds.set(body.id, planet);
    }

    const starMesh = new THREE.Mesh(
        new THREE.SphereGeometry(system.star.radius, 48, 32),
        new THREE.MeshBasicMaterial({ color: system.star.color }),
    );
    starMesh.add(
        new THREE.Mesh(
            new THREE.SphereGeometry(system.star.radius * 1.15, 32, 24),
            new THREE.MeshBasicMaterial({
                color: system.star.color,
                transparent: true,
                opacity: 0.08,
                side: THREE.BackSide,
                depthWrite: false,
            }),
        ),
    );
    group.add(starMesh);

    // Distant stars on a far sphere that travels with the camera, so they stay
    // behind every world however far across the system you fly.
    let seed = system.seed >>> 0;
    const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
    const positions = [],
        colors = [];
    for (let i = 0; i < 2800; i++) {
        const n = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1)
            .normalize()
            .multiplyScalar(85000);
        positions.push(n.x, n.y, n.z);
        const c = new THREE.Color().setHSL(0.48 + random() * 0.2, 0.12 + random() * 0.25, 0.4 + random() * 0.5);
        colors.push(c.r, c.g, c.b);
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    starsGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const stars = new THREE.Points(
        starsGeo,
        new THREE.PointsMaterial({ size: 37, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.85 }),
    );
    scene.add(stars);

    const local = new THREE.Vector3();
    return {
        group,
        starMesh,
        // positions: Map id -> [x, y, z] (system coordinates); origin: THREE.Vector3.
        place(positions, origin) {
            for (const [id, planet] of worlds) {
                const p = positions.get(id);
                planet.group.position.set(p[0] - origin.x, p[1] - origin.y, p[2] - origin.z);
            }
            starMesh.position.copy(origin).negate();
        },
        // Refines detail around the camera (camera position in the same local frame).
        update(cameraPosition) {
            stars.position.copy(cameraPosition);
            for (const planet of worlds.values()) {
                local.copy(cameraPosition).sub(planet.group.position);
                planet.update(local);
            }
            streamer.pump(4);
        },
    };
}
