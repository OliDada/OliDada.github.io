// A star up close: a churning, limb-darkened surface with sunspots, inside a
// soft corona and a wide glow. Shared by the star of the system you are in and
// the star you approach in deep space.
import * as THREE from "./vendor/three.module.js";

let glowTexture = null;
function glow() {
    if (glowTexture) return glowTexture;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d"), grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.18, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.12)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return (glowTexture = new THREE.CanvasTexture(c));
}

const vertexShader = `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObj; varying vec3 vNormalView; varying vec3 vView;
void main() {
  vObj = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`;
const fragmentShader = `#include <logdepthbuf_pars_fragment>
uniform vec3 tint; uniform float time; uniform float seed;
varying vec3 vObj; varying vec3 vNormalView; varying vec3 vView;
float h(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
#include <logdepthbuf_fragment>
  vec3 p = vObj * 7.0 + vec3(seed);
  // Granulation: small convection cells drifting slowly.
  float g = n(p * 3.0 + vec3(time * 0.05, 0.0, time * 0.03)) * 0.55 + n(p * 7.0 - vec3(0.0, time * 0.08, 0.0)) * 0.3 + n(p * 15.0) * 0.15;
  // A few small sunspots, in the active belts either side of the equator (they were huge
  // dark blotches): a dark core in a paler penumbra, only where a broad active region is.
  float belt = smoothstep(0.08, 0.25, abs(vObj.y)) * (1.0 - smoothstep(0.45, 0.6, abs(vObj.y)));
  float region = smoothstep(0.55, 0.75, n(vObj * 2.0 + vec3(seed * 3.0, time * 0.004, 0.0)));
  float sn = n(vObj * 11.0 + vec3(seed, 0.0, time * 0.006));
  float spots = belt * region * (smoothstep(0.7, 0.78, sn) * 0.45 + smoothstep(0.78, 0.84, sn) * 0.55);
  // Limb darkening: the edge of a star is cooler and dimmer than its centre.
  float mu = clamp(dot(normalize(vNormalView), normalize(vView)), 0.0, 1.0);
  float limb = 0.35 + 0.65 * pow(mu, 0.55);
  vec3 hot = mix(tint, vec3(1.0), 0.55);
  vec3 col = mix(tint * 0.9, hot, g) * limb * (1.0 - spots * 0.6);
  gl_FragColor = vec4(col * 1.35, 1.0);
}`;

export function createStarVisual({ radius, color, seed = 1 }) {
    const group = new THREE.Group();
    const material = new THREE.ShaderMaterial({
        uniforms: { tint: { value: new THREE.Color(color) }, time: { value: 0 }, seed: { value: (seed % 1000) / 37 } },
        vertexShader,
        fragmentShader,
    });
    const surface = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), material);
    group.add(surface);
    const sprite = (size, opacity) => {
        const s = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: glow(), color, transparent: true, opacity, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
        );
        s.scale.setScalar(size);
        group.add(s);
        return s;
    };
    const corona = sprite(radius * 4.2, 0.85),
        halo = sprite(radius * 16, 0.28);
    const t0 = performance.now();
    return {
        group,
        setColor(c) {
            material.uniforms.tint.value.set(c);
            corona.material.color.set(c);
            halo.material.color.set(c);
        },
        update() {
            material.uniforms.time.value = (performance.now() - t0) / 1000;
        },
        dispose() {
            surface.geometry.dispose();
            material.dispose();
            corona.material.dispose();
            halo.material.dispose();
        },
    };
}
