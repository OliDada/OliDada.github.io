// Drawing what falls (weather.mjs): rain and acid rain as streaks, methane rain as
// slow fat drops, snow, ash and dust as drifting flakes. A box of particles
// travels with the camera; each particle falls (and is blown along) on its own,
// wrapping around inside the box, so there are always drops around you and
// nothing is spawned or freed. All the motion is in the vertex shader: one draw
// call, and on phones fewer particles. THREE is passed in.
//
//   const fx = createWeatherFX(THREE, scene, { lite })
//   fx.update({ camera, up, kind, amount, wind, light, time })   amount 0..1; wind: THREE.Vector3 (m/s, scene coordinates); light 0..1
//   fx.update(null)                                                nothing falling
const B = 15; // half the box, metres
const LOOKS = {
  rain: { lines: true, fall: 9, streak: 0.11, color: [0.8, 0.85, 0.92], alpha: 0.55, blow: 0.5 },
  acid: { lines: true, fall: 7, streak: 0.11, color: [0.92, 0.88, 0.55], alpha: 0.5, blow: 0.5 },
  methane: { lines: true, fall: 3.2, streak: 0.14, color: [0.9, 0.66, 0.42], alpha: 0.6, blow: 0.4 },
  snow: { lines: false, fall: 1.1, flutter: 0.5, size: 0.11, color: [0.95, 0.97, 1], alpha: 0.9, blow: 0.8 },
  ash: { lines: false, fall: 0.8, flutter: 0.35, size: 0.09, color: [0.42, 0.39, 0.37], alpha: 0.85, blow: 0.8 },
  dust: { lines: false, fall: 0.15, flutter: 0.6, size: 0.07, color: [0.78, 0.66, 0.5], alpha: 0.6, blow: 1.4 },
};

export function createWeatherFX(THREE, scene, { lite = false } = {}) {
  const N = lite ? 1500 : 4500;
  const seeds = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { seeds[i * 4] = Math.random(); seeds[i * 4 + 1] = Math.random(); seeds[i * 4 + 2] = Math.random(); seeds[i * 4 + 3] = Math.random(); }
  const uniforms = {
    uTime: { value: 0 }, uShift: { value: new THREE.Vector3() }, uFall: { value: 9 }, uWindV: { value: new THREE.Vector3() },
    uStreak: { value: 0.05 }, uFlutter: { value: 0 }, uSize: { value: 0.06 }, uPx: { value: 500 },
    uColor: { value: new THREE.Color() }, uAlpha: { value: 0.4 },
  };
  const vertex = (lines) => /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec4 aSeed;${lines ? ' attribute float aEnd;' : ''}
    uniform float uTime, uFall, uStreak, uFlutter, uSize, uPx;
    uniform vec3 uShift, uWindV;
    varying float vFade;
    void main() {
      vec3 v = vec3(uWindV.x, -uFall * (0.8 + 0.4 * aSeed.w), uWindV.z);
      vec3 p = (aSeed.xyz * 2.0 - 1.0) * ${B.toFixed(1)} + v * uTime - uShift;
      p += vec3(sin(uTime * 1.3 + aSeed.w * 40.0), 0.0, cos(uTime * 1.1 + aSeed.w * 31.0)) * uFlutter;
      p = mod(p + ${B.toFixed(1)}, ${(2 * B).toFixed(1)}) - ${B.toFixed(1)}; // wrap around the camera
      ${lines ? 'p -= v * uStreak * aEnd; // the tail of the streak' : ''}
      float r = length(p);
      vFade = (1.0 - smoothstep(${(0.6 * B).toFixed(1)}, ${B.toFixed(1)}, r)) * smoothstep(0.3, 1.2, r);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      ${lines ? '' : 'gl_PointSize = clamp(uSize * uPx / -mv.z, 1.5, 9.0);'}
      #include <logdepthbuf_vertex>
    }`;
  const fragment = (lines) => /* glsl */ `
    #include <logdepthbuf_pars_fragment>
    uniform vec3 uColor; uniform float uAlpha;
    varying float vFade;
    void main() {
      #include <logdepthbuf_fragment>
      ${lines ? 'float f = 1.0;' : 'vec2 q = gl_PointCoord - 0.5; float f = smoothstep(0.5, 0.2, length(q));'}
      gl_FragColor = vec4(uColor, uAlpha * vFade * f);
    }`;
  const material = (lines) => new THREE.ShaderMaterial({
    uniforms, vertexShader: vertex(lines), fragmentShader: fragment(lines),
    transparent: true, depthWrite: false, fog: false,
  });

  // Streaks: two vertices per drop (head, tail).
  const lineGeo = new THREE.BufferGeometry();
  const lineSeeds = new Float32Array(N * 8), ends = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) for (let e = 0; e < 2; e++) { lineSeeds.set(seeds.subarray(i * 4, i * 4 + 4), (i * 2 + e) * 4); ends[i * 2 + e] = e; }
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3)); // unused: the shader places them
  lineGeo.setAttribute('aSeed', new THREE.BufferAttribute(lineSeeds, 4));
  lineGeo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  const lines = new THREE.LineSegments(lineGeo, material(true));
  // Flakes: one point each.
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  pointGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const points = new THREE.Points(pointGeo, material(false));
  const group = new THREE.Group();
  group.name = 'weather';
  for (const o of [lines, points]) { o.frustumCulled = false; o.renderOrder = 5; group.add(o); }
  group.visible = false;
  scene.add(group);

  const Y = new THREE.Vector3(0, 1, 0), last = new THREE.Vector3(), delta = new THREE.Vector3(), inverse = new THREE.Quaternion();
  let hasLast = false;
  return {
    update(state) {
      if (!state || state.amount < 0.003) { group.visible = false; hasLast = false; return; }
      const { camera, up, kind, amount, wind, light, time } = state, look = LOOKS[kind] || LOOKS.rain;
      group.visible = true;
      group.position.copy(camera.position);
      group.quaternion.setFromUnitVectors(Y, up);
      inverse.copy(group.quaternion).invert();
      // Drops stay put in the world as you move: shift the box by your movement.
      if (hasLast) {
        delta.copy(camera.position).sub(last).applyQuaternion(inverse);
        if (delta.lengthSq() < 1e4) uniforms.uShift.value.add(delta); // not on a teleport
        const s = uniforms.uShift.value;
        s.set(((s.x % (2 * B)) + 2 * B) % (2 * B), ((s.y % (2 * B)) + 2 * B) % (2 * B), ((s.z % (2 * B)) + 2 * B) % (2 * B));
      }
      last.copy(camera.position);
      hasLast = true;
      uniforms.uWindV.value.copy(wind).multiplyScalar(look.blow).applyQuaternion(inverse);
      uniforms.uTime.value = time % 1000;
      uniforms.uFall.value = look.fall;
      uniforms.uStreak.value = look.streak || 0;
      uniforms.uFlutter.value = look.flutter || 0;
      uniforms.uSize.value = look.size || 0.06;
      uniforms.uPx.value = camera.isPerspectiveCamera ? (0.5 * innerHeight * devicePixelRatio) / Math.tan((camera.fov * Math.PI) / 360) : 500;
      const lit = 0.12 + 0.88 * light;
      uniforms.uColor.value.setRGB(look.color[0] * lit, look.color[1] * lit, look.color[2] * lit);
      uniforms.uAlpha.value = look.alpha * Math.min(1, 0.4 + amount);
      lines.visible = look.lines;
      points.visible = !look.lines;
      const count = Math.round(N * Math.sqrt(Math.min(1, amount))); // light rain is sparse, but not invisible
      lineGeo.setDrawRange(0, count * 2);
      pointGeo.setDrawRange(0, count);
    },
  };
}
