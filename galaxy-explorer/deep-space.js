// Interstellar space. The stars in the sky are the galaxy's real stars
// (galaxy.mjs), drawn in their true directions with their apparent brightness,
// so any of them can be flown to. Positions here are in light years; the scene
// keeps the ship near its origin and only directions are drawn.
//
// Frames: a system's game coordinates (metres, y up) map onto the galaxy chart
// (light years, z up) as galaxy = (x, -z, y), matching the star map. Each system
// is compressed: its edge (just beyond the outermost orbit) sits ARRIVE_LY from
// its star, so the metres-per-light-year scale differs between systems.
import * as THREE from "./vendor/three.module.js";
import { starsNear, starPhysics } from "./galaxy.mjs";
import { createStarVisual } from "./star-mesh.js";
import { SIZE, VIEW_RANGE, starGameRadius as starRadius } from "./scale.mjs";

export const ARRIVE_LY = 0.002; // a system's edge, measured from its star
const SKY_RANGE = 60; // light years of real stars drawn around you
export const SKY_RADIUS = VIEW_RANGE * 0.8; // scene distance of the star sphere (inside the far plane, beyond every orbit)
const MAX_STARS = 3000;

export const toGalaxy = (v) => [v.x, -v.z, v.y];
export const toScene = (g, out = new THREE.Vector3()) => out.set(g[0], g[2], -g[1]);

// Radius (metres) at which a system hands over to interstellar space.
export function systemEdge(system) {
    const byId = new Map(system.bodies.map((b) => [b.id, b]));
    let reach = 0;
    for (const b of system.bodies) {
        const centre = b.parent ? byId.get(b.parent).orbit : 0;
        reach = Math.max(reach, centre + b.orbit + b.radius);
    }
    return reach + 8000 * SIZE;
}
// Game radius of a star's sphere (matches generateSystem).
export const starGameRadius = starRadius;

// Apparent brightness of a star from distance d (ly): luminosity / d².
function appearance(physics, d) {
    const b = Math.log10(physics.luminosity / Math.max(d * d, 1e-12));
    return {
        size: Math.min(18, Math.max(1.4, 1.6 + 1.5 * (b + 2.5))),
        alpha: Math.min(1, Math.max(0.22, 0.35 + 0.25 * (b + 3))),
    };
}

export function createSky(scene, renderer) {
    const positions = new Float32Array(MAX_STARS * 3),
        colors = new Float32Array(MAX_STARS * 3),
        sizes = new Float32Array(MAX_STARS),
        alphas = new Float32Array(MAX_STARS);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SKY_RADIUS * 1.1);
    const material = new THREE.ShaderMaterial({
        uniforms: { pixelRatio: { value: renderer.getPixelRatio() }, fade: { value: 1 } },
        vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float pixelRatio; uniform float fade;
varying vec3 vColor; varying float vAlpha;
void main() {
  vColor = aColor; vAlpha = aAlpha * fade;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * pixelRatio;
  gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`,
        fragmentShader: `#include <logdepthbuf_pars_fragment>
varying vec3 vColor; varying float vAlpha;
void main() {
#include <logdepthbuf_fragment>
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, r)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * (1.0 + (1.0 - r) * 0.6), a);
}`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    scene.add(points);

    // A dim, distant backdrop (the unresolved galaxy) behind the real stars.
    let seed = 0x5eed;
    const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
    const bg = [], bgColors = [];
    for (let i = 0; i < 2200; i++) {
        const n = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize().multiplyScalar(SKY_RADIUS * 1.05);
        bg.push(n.x, n.y, n.z);
        const c = new THREE.Color().setHSL(0.48 + random() * 0.2, 0.12 + random() * 0.25, 0.25 + random() * 0.35);
        bgColors.push(c.r, c.g, c.b);
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.Float32BufferAttribute(bg, 3));
    bgGeo.setAttribute("color", new THREE.Float32BufferAttribute(bgColors, 3));
    const backdrop = new THREE.Points(
        bgGeo,
        new THREE.PointsMaterial({ size: 30 * SKY_RADIUS / 80000, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    backdrop.frustumCulled = false;
    scene.add(backdrop);

    let list = [], queriedAt = null, count = 0;
    const dir = new THREE.Vector3();
    const sky = {
        // Every real star near the viewer, nearest first: { star, physics, distance }.
        get stars() { return list; },
        // viewer: galaxy position (ly); hide: id of a star drawn as a mesh instead.
        update(viewer, camera, hide = null) {
            if (!queriedAt || Math.hypot(viewer[0] - queriedAt[0], viewer[1] - queriedAt[1], viewer[2] - queriedAt[2]) > 6) {
                queriedAt = viewer.slice();
                list = starsNear(viewer, SKY_RANGE).slice(0, MAX_STARS).map((e) => { const physics = starPhysics(e.star); return { star: e.star, physics, color: new THREE.Color(physics.color), distance: e.distance }; });
            }
            count = 0;
            for (const e of list) {
                const s = e.star;
                const dx = s.x - viewer[0], dy = s.y - viewer[1], dz = s.z - viewer[2];
                e.distance = Math.hypot(dx, dy, dz);
                if (s.id === hide) continue;
                toScene([dx, dy, dz], dir).normalize().multiplyScalar(SKY_RADIUS);
                const a = appearance(e.physics, e.distance), c = e.color, k = count * 3;
                positions[k] = dir.x; positions[k + 1] = dir.y; positions[k + 2] = dir.z;
                colors[k] = c.r; colors[k + 1] = c.g; colors[k + 2] = c.b;
                sizes[count] = a.size;
                alphas[count] = a.alpha;
                count++;
            }
            list.sort((a, b) => a.distance - b.distance);
            geo.setDrawRange(0, count);
            for (const name of ["position", "aColor", "aSize", "aAlpha"]) geo.attributes[name].needsUpdate = true;
            points.position.copy(camera.position);
            backdrop.position.copy(camera.position);
        },
        // Keeps the sky centred on the camera without recomputing it.
        follow(camera) {
            points.position.copy(camera.position);
            backdrop.position.copy(camera.position);
        },
        resize() { material.uniforms.pixelRatio.value = renderer.getPixelRatio(); },
        // 0 at night or in space, 1 in full daylight under thick air: stars fade out.
        setDaylight(v) {
            material.uniforms.fade.value = 1 - 0.97 * v;
            backdrop.material.opacity = 0.55 * (1 - v);
        },
    };
    return sky;
}

// The star you are approaching in deep space, drawn as a real sphere whose
// apparent size matches what you will see from that system's edge on arrival.
export function createNearStar(scene) {
    const DRAW_AT = 60000;
    const star = createStarVisual({ radius: 1, color: 0xffffff }), core = star.group;
    core.visible = false;
    scene.add(core);
    const d = new THREE.Vector3();
    return {
        hide() { core.visible = false; },
        // offset: star minus viewer (ly); metresPerLy: that system's scale; radius: star's game radius.
        show(camera, offset, metresPerLy, radius, color) {
            const distance = Math.hypot(...offset) * metresPerLy;
            const scale = (DRAW_AT * radius) / Math.max(distance, radius * 1.5);
            if (scale < 40) return void (core.visible = false); // just a point at this range
            toScene(offset, d).normalize().multiplyScalar(DRAW_AT).add(camera.position);
            core.position.copy(d);
            core.scale.setScalar(scale);
            star.setColor(color);
            star.update();
            core.visible = true;
        },
    };
}

// Faint streaks rushing past the ship while the star drive runs, so speed is
// felt even though the stars barely move. Kept around the camera.
// Options (for other uses, such as dust rushing past near worlds): R and L size
// the cloud around the camera, min keeps streaks off the camera, color tints them.
export function createDriveStreaks(scene, count = 220, { R = 260, L = 900, min = 30, color = 0xbfe8ff } = {}) {
    const pos = new Float32Array(count * 6), seeds = new Float32Array(count * 3);
    let seed = 0xd21e;
    const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < count; i++) {
        const a = random() * Math.PI * 2, r = min + random() * R;
        seeds.set([Math.cos(a) * r, Math.sin(a) * r, (random() - 0.5) * 2 * L], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), L * 2);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const lines = new THREE.LineSegments(geo, material);
    lines.frustumCulled = false;
    lines.visible = false;
    scene.add(lines);
    const basis = new THREE.Matrix4(), side = new THREE.Vector3(), up = new THREE.Vector3(), p = new THREE.Vector3();
    let travel = 0;
    return {
        hide() { lines.visible = false; },
        // power: 0..1 (throttle); forward: unit direction of flight. flow, when
        // given, sets the real rush speed, streak length and opacity instead.
        update(camera, forward, power, dt, flow = null) {
            lines.visible = power > 0.02;
            if (!lines.visible) return;
            travel += dt * (flow ? flow.speed : 400 + 4200 * power);
            side.crossVectors(forward, Math.abs(forward.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
            up.crossVectors(side, forward);
            basis.makeBasis(side, up, forward);
            const len = flow ? flow.len : 30 + 420 * power;
            for (let i = 0; i < count; i++) {
                const z = ((((seeds[i * 3 + 2] - travel) % (2 * L)) + 3 * L) % (2 * L)) - L;
                p.set(seeds[i * 3], seeds[i * 3 + 1], z).applyMatrix4(basis);
                pos[i * 6] = p.x; pos[i * 6 + 1] = p.y; pos[i * 6 + 2] = p.z;
                p.addScaledVector(forward, -len);
                pos[i * 6 + 3] = p.x; pos[i * 6 + 4] = p.y; pos[i * 6 + 5] = p.z;
            }
            geo.attributes.position.needsUpdate = true;
            lines.position.copy(camera.position);
            material.opacity = flow ? flow.opacity : 0.1 + 0.4 * power;
        },
    };
}

// The worlds of a system seen from afar: dots around its star that spread out
// as you approach, before its worlds are close enough to draw for real.
export function createWorldDots(scene, max = 24) {
    const pos = new Float32Array(max * 3), col = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    // Round, soft-edged dots (plain points are square).
    const dot = document.createElement("canvas");
    dot.width = dot.height = 32;
    const g = dot.getContext("2d"), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "#fff"); grad.addColorStop(0.55, "#fff"); grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    const points = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.95, depthWrite: false }),
    );
    points.frustumCulled = false;
    points.visible = false;
    scene.add(points);
    const c = new THREE.Color();
    return {
        hide() { points.visible = false; },
        // items: [{ dir: unit THREE.Vector3 (scene), color }]
        show(camera, items) {
            const n = Math.min(max, items.length);
            for (let i = 0; i < n; i++) {
                const p = items[i].dir.clone().multiplyScalar(SKY_RADIUS * 0.9);
                pos.set([p.x, p.y, p.z], i * 3);
                c.set(items[i].color);
                col.set([c.r, c.g, c.b], i * 3);
            }
            geo.setDrawRange(0, n);
            geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
            points.position.copy(camera.position);
            points.visible = n > 0;
        },
    };
}
