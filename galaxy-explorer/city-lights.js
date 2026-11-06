// City lights seen from space: every world with city builders or above (and every
// colony) gets a layer of lights from its settlement network (settlements.mjs),
// shown only on its night side. Once a world's settlements have been built
// (structures-mesh.js), `actual` holds where their lit windows and lamps really are:
// those places are lit from exactly those points, so what you see from orbit is what
// you find on the ground. Places not built in detail keep an even scatter. One small Points object per world, drawn by
// system-view.js on every world of the system, so a civilized planet glows when you
// look at it from orbit, from a moon or from another world. THREE is passed in.
import { civilizationOf, colonistOf, tierAtLeast } from './civilizations.mjs';
import { networkFor } from './settlements.mjs';
import { terrainFor } from './terrain.mjs';
import { rng } from './rng.mjs';
import { urbanOf } from './urban.mjs';

// How many lights each kind of place gets.
const LIGHTS = { village: 4, town: 14, city: 34, metropolis: 70, capital: 90, megacity: 150, colony: 16 };

export function buildCityLights(THREE, system, body, sun, actual = null) {
  if (body.giant) return null;
  const native = civilizationOf(body), colonist = native ? null : colonistOf(system, body);
  const civ = native || colonist;
  if (!civ || civ.spaceborne || !(colonist || tierAtLeast(civ.tier, 'city builders'))) return null; // an ark's world is dark
  const terrain = terrainFor(body), net = networkFor(body, civ, terrain, { colony: !!colonist });
  if (!net.capital) return null;
  const R = body.radius, r = rng(body.seed, 'city-lights'), pos = [], bright = [], real = [];
  const strength = colonist || tierAtLeast(civ.tier, 'spacefarers') ? 1 : tierAtLeast(civ.tier, 'planet-shapers') ? .85 : civ.tier === 'industrial' ? .7 : .55;
  const p = new THREE.Vector3(), east = new THREE.Vector3(), north = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (const s of net.settlements) {
    if (actual?.places.has(s.id)) continue;
    const n = new THREE.Vector3(...s.n);
    east.copy(Y).cross(n); if (east.lengthSq() < 1e-6) east.set(1, 0, 0).cross(n); east.normalize(); north.copy(n).cross(east);
    const count = Math.round((LIGHTS[s.kind] || 4) * (.6 + civ.cohesion * .6));
    for (let i = 0; i < count; i++) {
      // Denser toward the centre, like a real city at night.
      const d = (r() ** 1.6) * s.radius * 1.2, a = r() * Math.PI * 2;
      p.copy(n).multiplyScalar(Math.cos(d / R)).addScaledVector(east, Math.sin(d / R) * Math.cos(a)).addScaledVector(north, Math.sin(d / R) * Math.sin(a)).normalize();
      if (terrain.isLiquid(p) && civ.culture !== 'stilts' && !civ.underwater) continue; // sea builders' lights glow up through the water
      p.multiplyScalar(R + terrain.surface(p) + 3);
      pos.push(p.x, p.y, p.z); bright.push(strength * (.6 + r() * .4)); real.push(0);
    }
  }
  // A city world is lit all over its city (urban.mjs), not just its towns.
  const urban = urbanOf(body);
  if (urban) {
    const N = 9000, ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i + .5) / N * 2, rr = Math.sqrt(1 - y * y), a = i * ga + r() * .02;
      p.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      const m = urban.mask(p);
      if (m < .5 || r() > m || urban.park(p) || terrain.isLiquid(p)) continue;
      p.multiplyScalar(R + terrain.surface(p) + 3);
      pos.push(p.x, p.y, p.z); bright.push(strength * (.5 + r() * .5)); real.push(0);
    }
  }
  for (const q of actual?.points || []) { pos.push(q.x, q.y, q.z); bright.push(strength * (.75 + r() * .25)); real.push(1); }
  if (!pos.length) return null;
  // The same warm colour as the windows and lamps on the ground (structures-mesh.js).
  const colour = actual?.colour || (civ.species.glow ? '#' + new THREE.Color('#ffd98a').lerp(new THREE.Color(civ.species.colors?.glow || civ.species.colors?.accent || '#ffd98a'), .4).getHexString() : '#ffd98a');
  const points = nightPoints(THREE, pos, sun, colour, bright, real);
  return points;
}

// Points of light seen only on a world's night side, fading in through dusk.
// positions: [Vector3] or a flat array; sun: { value } the star's world position.
// real: per point, 1 where a lit building really stands, 0 for the even scatter over
// places not built in detail. Those are only a picture from afar: they fade out as you
// come within a few kilometres, so on the ground no light shines where no house is.
export function nightPoints(THREE, positions, sun, colourHex = '#ffd98a', bright = null, real = null) {
  const pos = positions.length && typeof positions[0] === 'number' ? positions : positions.flatMap(p => [p.x, p.y, p.z]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('bright', new THREE.Float32BufferAttribute(bright || new Array(pos.length / 3).fill(.85), 1));
  g.setAttribute('real', new THREE.Float32BufferAttribute(real || new Array(pos.length / 3).fill(1), 1));
  const colour = new THREE.Color(colourHex);
  const material = new THREE.ShaderMaterial({
    uniforms: { sun, colour: { value: colour } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute float bright; attribute float real; uniform vec3 sun; varying float vAlpha;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 centre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 up = normalize(world.xyz - centre), toSun = normalize(sun - world.xyz);
  // Lit only on the night side, fading in through dusk.
  vAlpha = bright * smoothstep(0.08, -0.18, dot(up, toSun));
  // Scattered (not real) lights: gone near you, in the world's own metres (whatever the view's scale).
  if (real < 0.5) { vec3 cam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz; vAlpha *= smoothstep(2000.0, 5000.0, distance(cam, position)); }
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(2600.0 / -mv.z, 1.2, 3.0);
  if (vAlpha < 0.01) gl_PointSize = 0.0;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
uniform vec3 colour; varying float vAlpha;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5; float f = smoothstep(0.5, 0.15, length(c));
  gl_FragColor = vec4(colour * vAlpha * f, 1.0);
}`,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false; points.name = 'city-lights';
  return points;
}
