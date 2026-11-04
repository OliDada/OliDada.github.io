// Drawing the sky events of phenomena.mjs: aurora curtains and meteor streaks.
// Eclipses need nothing here: the moon really crosses the star in the 3D view, and
// game.js dims the daylight. Both effects sit far out around the camera, like the
// star sky, so the ground hides what is below the horizon. Cheap enough for phones:
// one band for the aurora (a single shader) and one small batch of line segments.
//
//   const events = createSkyEvents(scene);
//   events.setWorld(body)                  picks the aurora's colours
//   events.update({ camera, up, aurora, meteors, dt, time })   aurora, meteors: 0..1 strength
import * as THREE from "./vendor/three.module.js";
import { rng } from "./rng.mjs";

const R = 20000; // distance of the curtains
const LOW = Math.tan((6 * Math.PI) / 180) * R, HIGH = Math.tan((48 * Math.PI) / 180) * R;
// Aurora colours, low edge then high: green and pink, blue and violet, red and gold, teal and green.
const PALETTES = [
    [[0.25, 1, 0.55], [0.95, 0.3, 0.65]],
    [[0.35, 0.55, 1], [0.75, 0.3, 1]],
    [[1, 0.35, 0.25], [1, 0.8, 0.35]],
    [[0.2, 0.95, 0.9], [0.45, 1, 0.45]],
];
const MAX_METEORS = 24;

export function createSkyEvents(scene) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    const aurora = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R, HIGH - LOW, 160, 1, true),
        new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uLow: { value: new THREE.Color() }, uHigh: { value: new THREE.Color() } },
            vertexShader: /* glsl */ `
                #include <common>
                #include <logdepthbuf_pars_vertex>
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    #include <logdepthbuf_vertex>
                }`,
            fragmentShader: /* glsl */ `
                #include <logdepthbuf_pars_fragment>
                uniform float uTime, uStrength;
                uniform vec3 uLow, uHigh;
                varying vec2 vUv;
                float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float n2(vec2 p) {
                    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
                }
                // Noise sampled around a circle, so the band has no seam.
                float around(float k, float drift) {
                    float a = vUv.x * 6.2831853;
                    return n2(vec2(cos(a), sin(a)) * k + vec2(drift, -0.7 * drift));
                }
                void main() {
                    #include <logdepthbuf_fragment>
                    float y = vUv.y;
                    float curtain = smoothstep(0.3, 0.78, around(2.2, uTime * 0.015));
                    float folds = 0.55 + 0.45 * around(9.0, uTime * 0.05);
                    float rays = 0.45 + 0.55 * around(70.0, uTime * 0.12);
                    float edge = 0.1 * around(12.0, uTime * 0.04);
                    float fade = smoothstep(0.0, 0.07, y - edge) * pow(1.0 - y, 1.7);
                    float a = curtain * folds * rays * fade * uStrength;
                    gl_FragColor = vec4(mix(uLow, uHigh, smoothstep(0.15, 0.85, y)), a);
                }`,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
        }),
    );
    aurora.position.y = (LOW + HIGH) / 2;
    aurora.frustumCulled = false;
    aurora.renderOrder = -1;
    group.add(aurora);

    // Meteors: each a short streak along a great circle, bright at the head.
    const positions = new Float32Array(MAX_METEORS * 6), colors = new Float32Array(MAX_METEORS * 6);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    lineGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    lines.frustumCulled = false;
    group.add(lines);
    const meteors = Array.from({ length: MAX_METEORS }, () => ({ alive: false }));
    const Y = new THREE.Vector3(0, 1, 0), head = new THREE.Vector3(), tail = new THREE.Vector3();
    let spawnDebt = 0;
    function spawn() {
        const m = meteors.find((x) => !x.alive);
        if (!m) return;
        const az = Math.random() * Math.PI * 2, el = (25 + Math.random() * 55) * (Math.PI / 180);
        m.start = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(R * 0.75);
        // Mostly falling: the axis is tilted so the streak runs downward across the sky.
        const down = Y.clone().addScaledVector(m.start.clone().normalize(), -Math.sin(el)).negate().normalize();
        const side = m.start.clone().normalize().cross(down).normalize();
        const dir = down.multiplyScalar(0.8).addScaledVector(side, (Math.random() - 0.5) * 1.2).normalize();
        m.axis = m.start.clone().normalize().cross(dir).normalize();
        m.age = 0;
        m.life = 0.45 + Math.random() * 0.6;
        m.speed = (14 + Math.random() * 16) * (Math.PI / 180); // radians a second
        m.length = (6 + Math.random() * 9) * (Math.PI / 180);
        m.bright = 0.6 + Math.random() * 0.4;
        m.alive = true;
    }

    return {
        setWorld(body) {
            const [lo, hi] = PALETTES[Math.floor(rng(body?.seed ?? 0, "aurora")() * PALETTES.length)];
            aurora.material.uniforms.uLow.value.setRGB(...lo);
            aurora.material.uniforms.uHigh.value.setRGB(...hi);
        },
        update({ camera, up, aurora: a = 0, meteors: rate = 0, dt, time }) {
            const anyMeteor = meteors.some((m) => m.alive);
            group.visible = a > 0.002 || rate > 0.002 || anyMeteor;
            if (!group.visible) return;
            group.position.copy(camera.position);
            group.quaternion.setFromUnitVectors(Y, up);
            aurora.visible = a > 0.002;
            aurora.material.uniforms.uStrength.value = a * 1.25;
            aurora.material.uniforms.uTime.value = time;
            spawnDebt += rate * 1.4 * dt;
            while (spawnDebt > 1) { spawnDebt -= 1; if (Math.random() < 0.85) spawn(); }
            if (rate > 0 && Math.random() < rate * dt * 0.3) spawn(); // the odd one between
            meteors.forEach((m, i) => {
                let b = 0;
                if (m.alive) {
                    m.age += dt;
                    if (m.age > m.life) m.alive = false;
                    else {
                        const angle = m.speed * m.age;
                        head.copy(m.start).applyAxisAngle(m.axis, angle);
                        tail.copy(m.start).applyAxisAngle(m.axis, Math.max(0, angle - m.length));
                        b = m.bright * Math.sin((m.age / m.life) * Math.PI);
                    }
                }
                if (!b) head.set(0, 0, 0), tail.set(0, 0, 0);
                positions.set([head.x, head.y, head.z, tail.x, tail.y, tail.z], i * 6);
                colors.set([b, b * 0.95, b * 0.85, 0, 0, 0], i * 6);
            });
            lineGeometry.attributes.position.needsUpdate = true;
            lineGeometry.attributes.color.needsUpdate = true;
        },
    };
}
