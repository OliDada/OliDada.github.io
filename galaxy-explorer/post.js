// Glow (bloom): bright things bleed soft light around them — stars, engines, lava, city
// lights, a black hole's disc, sunlit ice. The scene is drawn into an off-screen picture
// exactly as it would be drawn to the screen (same tone mapping and colours, via three's
// output path for XR targets), the brightest parts are blurred through a chain of smaller
// and smaller copies, and the glow is added back on top. Half-float, so a star's surface
// (drawn brighter than white) glows the most. Off where the GPU can't render half-floats.
//
//   const post = createPost(THREE, renderer, { strength, threshold });
//   post.render(scene, camera)   instead of renderer.render(scene, camera)
import * as THREE from "./vendor/three.module.js";

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// threshold 1.25: only what is well beyond white glows (a star's surface, a black hole's disc),
// never a sunlit snowfield, nor a giant whose haze and cloud layers add up to just over white.
export function createPost(renderer, { strength = 0.5, threshold = 1.25, levels = 5, samples = 4 } = {}) {
  const gl = renderer.getContext();
  const ok = renderer.capabilities.isWebGL2 && (gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
  if (!ok) return { enabled: false, render: (s, c) => renderer.render(s, c), setStrength() {} };
  const opts = { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
  const main = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: true });
  main.isXRRenderTarget = true; // three then tone-maps and colour-encodes into it, as for the screen
  main.texture.colorSpace = THREE.SRGBColorSpace;
  const down = Array.from({ length: levels }, () => new THREE.WebGLRenderTarget(1, 1, opts));
  const up = Array.from({ length: levels }, () => new THREE.WebGLRenderTarget(1, 1, opts));
  const scene = new THREE.Scene(), cam = new THREE.Camera();
  const tri = new THREE.BufferGeometry();
  tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  tri.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(tri); quad.frustumCulled = false; scene.add(quad);
  const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  // Bright parts only (soft knee), then a 4-tap blur each step down and a tent blur back up.
  const bright = mat(`uniform sampler2D t; uniform vec2 px; uniform float th; varying vec2 vUv;
    void main() { vec3 c = (texture2D(t, vUv + px * vec2(-1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(-1.0, 1.0)).rgb + texture2D(t, vUv + px * vec2(1.0, 1.0)).rgb) * 0.25;
      float l = max(c.r, max(c.g, c.b)), k = smoothstep(th, th + 0.35, l);
      gl_FragColor = vec4(c * k * (0.6 + 0.4 * min(l, 3.0)), 1.0); }`, { t: { value: null }, px: { value: new THREE.Vector2() }, th: { value: threshold } });
  const blurDown = mat(`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
    void main() { gl_FragColor = vec4((texture2D(t, vUv + px * vec2(-1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(-1.0, 1.0)).rgb + texture2D(t, vUv + px * vec2(1.0, 1.0)).rgb) * 0.25, 1.0); }`, { t: { value: null }, px: { value: new THREE.Vector2() } });
  const blurUp = mat(`uniform sampler2D t; uniform sampler2D base; uniform vec2 px; varying vec2 vUv;
    void main() { vec3 s = texture2D(t, vUv).rgb * 4.0 + (texture2D(t, vUv + vec2(px.x, 0.0)).rgb + texture2D(t, vUv - vec2(px.x, 0.0)).rgb + texture2D(t, vUv + vec2(0.0, px.y)).rgb + texture2D(t, vUv - vec2(0.0, px.y)).rgb) * 2.0
        + texture2D(t, vUv + px).rgb + texture2D(t, vUv - px).rgb + texture2D(t, vUv + vec2(px.x, -px.y)).rgb + texture2D(t, vUv - vec2(px.x, -px.y)).rgb;
      gl_FragColor = vec4(s / 16.0 + texture2D(base, vUv).rgb, 1.0); }`, { t: { value: null }, base: { value: null }, px: { value: new THREE.Vector2() } });
  const final = mat(`uniform sampler2D t; uniform sampler2D glow; uniform float strength; varying vec2 vUv;
    void main() { vec3 c = texture2D(t, vUv).rgb, g = texture2D(glow, vUv).rgb * strength;
      gl_FragColor = vec4(min(c, vec3(1.0)) + g * (1.0 - min(c, vec3(1.0)) * 0.5), 1.0); }`, { t: { value: null }, glow: { value: null }, strength: { value: strength } });
  const size = new THREE.Vector2();
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(scene, cam); };
  function resize() {
    renderer.getDrawingBufferSize(size);
    if (main.width === size.x && main.height === size.y) return;
    main.setSize(size.x, size.y);
    let w = size.x, h = size.y;
    for (let i = 0; i < levels; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); down[i].setSize(w, h); up[i].setSize(w, h); }
  }
  return {
    enabled: true,
    setStrength(v) { final.uniforms.strength.value = v; },
    render(s, c) {
      resize();
      const auto = renderer.autoClear;
      renderer.setRenderTarget(main); renderer.clear(); renderer.render(s, c);
      renderer.autoClear = true;
      bright.uniforms.t.value = main.texture; bright.uniforms.px.value.set(0.5 / main.width, 0.5 / main.height); pass(bright, down[0]);
      for (let i = 1; i < levels; i++) { blurDown.uniforms.t.value = down[i - 1].texture; blurDown.uniforms.px.value.set(0.5 / down[i - 1].width, 0.5 / down[i - 1].height); pass(blurDown, down[i]); }
      let src = down[levels - 1];
      for (let i = levels - 2; i >= 0; i--) { blurUp.uniforms.t.value = src.texture; blurUp.uniforms.base.value = down[i].texture; blurUp.uniforms.px.value.set(1 / src.width, 1 / src.height); pass(blurUp, up[i]); src = up[i]; }
      final.uniforms.t.value = main.texture; final.uniforms.glow.value = src.texture; pass(final, null);
      renderer.autoClear = auto;
    },
  };
}
