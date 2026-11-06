// Drawing clouds (clouds.mjs): a few stacked shells around each world with air, and
// the clouds' shadows on its ground. The same shells are the cloud cover seen from
// orbit and the overcast seen from the ground, so they always agree.
//
// Seen from space, the layer sinks toward the ground as you climb away (the noise
// is on the direction from the centre, so the pattern stays put): close up it is at
// its real height to fly through, from orbit it hugs the world as real clouds do.
// From outside, extra shells a little higher hold only the thicker cloud, so clouds
// have tops and sides; each is shaded by whether the cloud rises toward the star.
// Clouds fade out when their world is only a small disc. Cheap enough for phones
// (fewer shells and noise octaves). THREE is passed in.
//
//   const layer = createCloudLayer(THREE, body, sun, { lite, light, maxH })   null if no clouds
//   layer.mesh                       a group: add to the world's group
//   layer.update(cameraLocal, t)     camera relative to the world's centre; t = orbitClock()
//   layer.densityAt(dir)             0..1 cloud at a unit direction (THREE.Vector3) right now
//   layer.hide(k)                    0..1: fade the shells out (when the camera is in a cloud)
//   layer.setSky(color)              the sky's colour where you stand: night cloud blends into it
//   layer.weatherAt(dir)             the weather (weather.mjs) at a unit direction right now, or null
//   layer.flash(k)                   0..1: lightning lighting the clouds from inside
//   addCloudShadows(material, layer, { lite })   darkens sunlight under the clouds
import { cloudsFor, cloudAngles, cloudDensity, CLOUD_GLSL, OCTAVES, OCTAVES_LITE, MAX_STORMS } from './clouds.mjs';
import { weatherOf, stormsAt, weatherAt } from './weather.mjs';

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

export function createCloudLayer(THREE, body, sun, { lite = false, light = '#ffffff', maxH = 20 } = {}) {
  const c = cloudsFor(body);
  if (!c) return null;
  const R = body.radius;
  // From orbit: just above the highest ground, or a few percent of the radius.
  const low = Math.min(c.height, Math.max(maxH + 4, 0.03 * R));
  const shells = lite ? 2 : 3;
  let angles = cloudAngles(c, 0), storms = [];
  const weather = weatherOf(body, c);
  // Shared with the terrain's shadow lookup, so shadows move with the clouds.
  const uniforms = {
    uCloudRot: { value: new THREE.Vector4(1, 0, 1, 0) },
    uCloudScale: { value: c.scale },
    uCloudOffset: { value: new THREE.Vector3(...c.offset) },
    uCloudThreshold: { value: c.threshold },
    uCloudSoft: { value: c.soft },
    uCloudSun: sun, // the star's position in the scene, kept up to date by system-view.js
    uCloudCentre: { value: new THREE.Vector3() },
    uCloudHeight: { value: c.height },
    uCloudShadow: { value: 0.55 * c.opacity },
    // Storms (weather.mjs) heap the cloud up; set every frame.
    uStorm: { value: Array.from({ length: MAX_STORMS }, () => new THREE.Vector4(0, 1, 0, 1)) },
    uStormK: { value: new THREE.Vector3() },
  };
  const shared = {
    ...uniforms,
    uColor: { value: new THREE.Color(c.color) },
    uLight: { value: new THREE.Color(light) },
    uSky: { value: new THREE.Color(0, 0, 0) },
    uOpacity: { value: c.opacity },
    uInside: { value: 0 },
    uHide: { value: 0 }, // inside a cloud the fog does the drawing (game.js)
    uFar: { value: 1 },
    uFlash: { value: 0 },
  };
  const geometry = new THREE.SphereGeometry(1, lite ? 72 : 112, lite ? 48 : 72);
  const group = new THREE.Group();
  group.name = 'clouds';
  const meshes = [];
  for (let i = 0; i < shells; i++) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        // Higher shells only hold thicker cloud, and are brighter: the tops.
        uLift: { value: (i / Math.max(1, shells - 1)) * 1.6 * c.soft },
        uTop: { value: shells > 1 ? i / (shells - 1) : 1 },
      },
      defines: { CLOUD_OCT: lite ? OCTAVES_LITE : OCTAVES, SUN_RELIEF: lite ? 0 : 1 },
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vDir, vWorld, vUp;
        varying float vFar;
        void main() {
          vDir = position;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vec3 centre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vWorld = w.xyz;
          vUp = w.xyz - centre;
          vFar = distance(cameraPosition, centre) / length(vUp); // how many radii away the world is
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uCloudSun, uColor, uLight, uSky;
        uniform float uOpacity, uInside, uFar, uHide, uLift, uTop, uFlash;
        varying vec3 vDir, vWorld, vUp;
        varying float vFar;
        ${CLOUD_GLSL}
        void main() {
          #include <logdepthbuf_fragment>
          vec3 dir = normalize(vDir), up = normalize(vUp), toSun = normalize(uCloudSun - vWorld);
          float v = cloudValue(dir);
          float d = smoothstep(uCloudThreshold + uLift, uCloudThreshold + uLift + uCloudSoft, v);
          if (d < 0.004) discard;
          float thick = clamp((v - uCloudThreshold - uCloudSoft) / (2.5 * uCloudSoft), 0.0, 1.0); // deeper inside a cloud
          float ndl = dot(up, toSun);
          float lit = smoothstep(-0.14, 0.3, ndl); // the terminator is soft: clouds catch the light after sunset
          float dusk = clamp(1.0 - abs(ndl - 0.03) / 0.24, 0.0, 1.0);
          vec3 col = mix(uColor, uColor * vec3(1.0, 0.6, 0.4), dusk * 0.55) * uLight;
          float shade;
          vec3 view = normalize(vWorld - cameraPosition);
          if (uInside > 0.5) {
            // From below: a bank is a soft mass, bright and thin at its edges, blue-grey
            // and lumpy where it is thick, and where the star is behind it the edges glow.
            float lumps = cNoise(dir * uCloudScale * 9.0 + uCloudOffset * 1.7) * 0.6 + cNoise(dir * uCloudScale * 23.0 - uCloudOffset) * 0.4;
            shade = mix(1.0, 0.5, thick) * (0.82 + 0.34 * lumps) * mix(1.0, 1.12, uTop);
            col = mix(col, col * vec3(0.78, 0.83, 0.92), thick * 0.6);
            float behind = pow(max(dot(view, toSun), 0.0), 5.0);
            col += uLight * behind * (1.0 - thick) * 0.55 * lit;
          }
          else {
            shade = mix(0.72, 1.0, uTop) * mix(0.85, 1.0, sqrt(thick));
            #if SUN_RELIEF
            // Relief: cloud rising toward the star is lit, the far side of a cloud is in its shade.
            vec3 side = toSun - up * ndl;
            if (dot(side, side) > 1e-6) {
              float ahead = cloudValue(normalize(dir + normalize(side) * (0.35 / uCloudScale)));
              shade *= 1.0 + 0.22 * clamp((v - ahead) / uCloudSoft, -1.0, 1.0) * lit;
            }
            #endif
          }
          // Night side: faint light, as the ground gets, not black.
          vec3 night = uColor * vec3(0.065, 0.08, 0.11);
          col = col * shade * 1.05 * lit + night * (1.0 - lit);
          col += uFlash * uInside * vec3(0.75, 0.8, 1.0) * (0.4 + thick); // lightning inside the cloud, seen from below
          float a = d * uOpacity * (1.0 - uHide);
          float dist = distance(vWorld, cameraPosition);
          if (uInside > 0.5) a *= 1.0 - smoothstep(0.45 * uFar, uFar, dist); // into the haze at the horizon
          else {
            a *= smoothstep(0.02, 0.45, dot(up, normalize(cameraPosition - vWorld))); // thin at the world's edge (seen edge-on the shells left a dark, ragged ring round the world)
            a *= 1.0 - smoothstep(14.0, 45.0, vFar); // a distant world: its clouds fade with it
          }
          a *= smoothstep(4.0, 30.0, dist); // passing through, the fog takes over (game.js)
          if (uInside > 0.5) a *= mix(1.0, 0.75 + 0.25 * thick, uTop); // the higher banks show through gaps, a little softer
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          // From below at night, cloud is a little lighter than the sky behind it, never darker.
          if (uInside > 0.5) gl_FragColor.rgb = mix(uSky * 1.25 + 0.004, gl_FragColor.rgb, lit);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2 + i; // after the sea, bottom shell first
    group.add(mesh);
    meshes.push(mesh);
  }
  // Wisps: thin streaks of low cloud, drawn out along the wind, below the deck. Only for
  // looking at from the ground or low flight (they fade out as you climb); seen only,
  // never flown through (they are not part of the cloud density).
  const wisp = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: { ...shared },
    defines: { CLOUD_OCT: 2 },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vDir, vWorld, vUp;
      void main() {
        vDir = position; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
        vUp = w.xyz - (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uCloudSun, uColor, uLight, uSky; uniform float uOpacity, uFar, uHide, uWisp;
      varying vec3 vDir, vWorld, vUp;
      ${CLOUD_GLSL}
      void main() {
        #include <logdepthbuf_fragment>
        vec3 d = normalize(vDir), up = normalize(vUp), toSun = normalize(uCloudSun - vWorld);
        vec3 q = vec3(d.x * uCloudRot.z - d.z * uCloudRot.w, d.y, d.x * uCloudRot.w + d.z * uCloudRot.z) * uCloudScale;
        float streak = cNoise(q * vec3(1.4, 9.0, 5.0) + uCloudOffset) * 0.65 + cNoise(q * vec3(3.0, 20.0, 11.0) - uCloudOffset) * 0.35;
        float wPatch = cNoise(q * 0.9 + uCloudOffset * 0.5);
        float a = smoothstep(0.52, 0.78, streak) * smoothstep(0.42, 0.7, wPatch) * 0.42 * uOpacity * uWisp * (1.0 - uHide);
        float dist = distance(vWorld, cameraPosition);
        a *= 1.0 - smoothstep(0.35 * uFar, 0.8 * uFar, dist); // into the haze
        a *= smoothstep(6.0, 40.0, dist);
        if (a < 0.003) discard;
        float lit = smoothstep(-0.14, 0.3, dot(up, toSun));
        vec3 col = uColor * uLight * (0.95 * lit + 0.06) + uLight * pow(max(dot(normalize(vWorld - cameraPosition), toSun), 0.0), 5.0) * 0.4 * lit;
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, fog: false, side: THREE.BackSide,
  }));
  wisp.material.uniforms.uWisp = { value: 0 };
  wisp.renderOrder = 1; // before the deck: it is below it
  if (!lite && c.kind !== 'dust') group.add(wisp);
  const dir = new THREE.Vector3();
  return {
    c, mesh: group, uniforms, lite,
    get color() { return shared.uColor.value; },
    update(cameraLocal, t) {
      angles = cloudAngles(c, t);
      storms = stormsAt(body, c, t, weather);
      for (let i = 0; i < MAX_STORMS; i++) {
        const st = storms[i];
        if (st) uniforms.uStorm.value[i].set(st.dir[0], st.dir[1], st.dir[2], st.cos);
        uniforms.uStormK.value.setComponent(i, st ? st.k : 0);
      }
      uniforms.uCloudRot.value.set(Math.cos(angles[0]), Math.sin(angles[0]), Math.cos(angles[1]), Math.sin(angles[1]));
      group.getWorldPosition(uniforms.uCloudCentre.value);
      // Real height near the world; sinking to `low` as you climb away.
      const r = cameraLocal.length(), k = smooth((r - R - c.height - 40) / 600);
      const h = c.height + (low - c.height) * k;
      const gap = 4 + (Math.max(0.8, 0.007 * R) - 4) * k; // between shells
      uniforms.uCloudHeight.value = h;
      const base = R + h;
      shared.uFar.value = 1.15 * Math.sqrt(base * base - R * R);
      const inside = r < base;
      shared.uInside.value = inside ? 1 : 0;
      // Wisps halfway between the land and the deck, seen from below them only.
      const wr = R + Math.max(c.height * .55, c.height - 120);
      wisp.scale.setScalar(wr);
      wisp.material.uniforms.uWisp.value = (r < wr - 5 ? 1 : 0) * (1 - k);
      wisp.visible = wisp.material.uniforms.uWisp.value > 0.01;
      meshes.forEach((m, i) => {
        const radius = base + i * gap;
        m.scale.setScalar(radius);
        // From below the higher shells show too, through the gaps and as the thicker cores
        // of banks, for depth (drawn first, farthest first, so the base lies over them);
        // a shell the camera is above shows from outside.
        m.visible = inside || r > radius || i === 0;
        m.material.side = inside ? THREE.BackSide : THREE.FrontSide;
        m.renderOrder = inside ? 2 + (meshes.length - 1 - i) : 2 + i;
      });
    },
    hide(k) { shared.uHide.value = k; },
    flash(k) { shared.uFlash.value = k; },
    weatherAt(v) {
      dir.copy(v).normalize();
      return weatherAt(body, c, weather, [dir.x, dir.y, dir.z], angles, storms);
    },
    setSky(color) { shared.uSky.value.copy(color); },
    densityAt(v) {
      dir.copy(v).normalize();
      return cloudDensity(c, [dir.x, dir.y, dir.z], angles, OCTAVES, storms);
    },
    dispose() { geometry.dispose(); for (const m of meshes) m.material.dispose(); wisp.material.dispose(); },
  };
}

// Cloud shadows on the ground: where the line toward the star crosses the cloud
// layer, sunlight is dimmed by how much cloud is there. Added after the material's
// other shader changes (planet-lod.js), inside its existing program.
export function addCloudShadows(material, layer, { lite = false } = {}) {
  const before = material.onBeforeCompile, baseKey = material.customProgramCacheKey();
  const octaves = lite ? 2 : 3; // shadows are soft: fine detail would not show
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    Object.assign(shader.uniforms, layer.uniforms);
    shader.vertexShader = 'varying vec3 vCloudWorld;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vCloudWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = `#define CLOUD_OCT ${octaves}
      varying vec3 vCloudWorld; uniform vec3 uCloudSun, uCloudCentre; uniform float uCloudHeight, uCloudShadow;
      ${CLOUD_GLSL}
` + shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        vec3 rel = vCloudWorld - uCloudCentre, toSun = normalize(uCloudSun - vCloudWorld);
        float ndl = dot(normalize(rel), toSun);
        if (ndl > 0.0) {
          vec3 through = normalize(rel + toSun * (uCloudHeight / max(ndl, 0.2)));
          float k = 1.0 - uCloudShadow * cloudDensity(through);
          reflectedLight.directDiffuse *= k;
          reflectedLight.directSpecular *= k;
        }
      }`);
  };
  material.customProgramCacheKey = () => `${baseKey}-clouds${octaves}`;
}
