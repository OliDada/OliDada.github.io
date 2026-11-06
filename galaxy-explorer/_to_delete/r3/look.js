// The game's look, in one place, plus test switches for performance work.
//
// applyLook(THREE) restyles every lit material in the game at once: it swaps three.js's
// physically based lighting (used by every MeshStandardMaterial: terrain, plants,
// animals, buildings, the ship) for a stylised model. Light falls off smoothly, wrapping
// a little past the terminator (shadows come from atmosphere.js), a thin rim catches the sun on silhouettes, shiny
// surfaces (water, glass, hulls) get a small crisp highlight instead of a blurry
// one, and the reflected-environment pass is skipped. Colour is graded once, after
// tone mapping, for every material that tone-maps (including the custom shaders).
// It is cheaper than the physical model and makes everything share one look.
// Call it before anything is drawn: three.js builds shaders on first use.
//
// URL switches (each one is remembered in this browser until switched back):
//   ?look=classic   the original physical lighting      ?look=new   the stylised look
//   ?perf           frame rate, draw calls and triangles ?perf=0     hide it
//   ?stress=3       plants 3x as dense, with 3x budget  ?stress=0   normal
//   ?adaptive=0     fixed resolution                     ?adaptive   resolution adapts (default)

const params = new URLSearchParams((globalThis.location?.search ?? '').replace(/(?!^)\?/g, '&'));
function setting(name, key, fallback) {
  const v = params.get(name);
  try {
    if (v !== null) localStorage.setItem(key, v);
    return localStorage.getItem(key) ?? fallback;
  } catch { return v ?? fallback; }
}
export const LOOK = setting('look', 'elsewhere-look', 'new') === 'classic' ? 'classic' : 'new';
export const SHOW_PERF = !['0', null].includes(setting('perf', 'elsewhere-perf', null));
export const STRESS = Math.max(1, Math.min(8, Number(setting('stress', 'elsewhere-stress', '1')) || 1));
export const ADAPTIVE = setting('adaptive', 'elsewhere-adaptive', '1') !== '0';

// --- Tunables: the whole look is these few numbers. ---
export const STYLE = {
  top: 1.0, // brightness in full sun
  wrap: 0.22, // a little light wraps past the terminator, so the shaded side isn't flat black
  rim: 0.16, // strength of the sunlit rim on silhouettes
  gloss: 0.9, // strength of the highlight on smooth surfaces
  saturation: 1.12, // grade after tone mapping
  lift: [0.012, 0.010, 0.022], // shadows lean slightly cool
};

export function applyLook(THREE) {
  if (LOOK === 'classic') return;
  const C = THREE.ShaderChunk, S = STYLE, f = (x) => x.toFixed(4);
  const lighting = /* glsl */ `
float styleRamp( const in float NdL ) {
	// One smooth lighting model for everything (the stepped bands are gone): light wraps
	// a little past the terminator, so the shaded side is soft rather than black, and
	// shadows (atmosphere.js) do the rest.
	float w = ${f(S.wrap)};
	float l = saturate( ( NdL + w ) / ( 1.0 + w ) );
	return ${f(S.top)} * l * ( 0.6 + 0.4 * l );
}
void RE_Direct_Stylised( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float NdL = dot( geometryNormal, directLight.direction );
	float lit = styleRamp( NdL );
	reflectedLight.directDiffuse += lit * directLight.color * BRDF_Lambert( material.diffuseColor );
	// Rim: silhouettes facing away from you catch the light on their sunward side.
	float NdV = saturate( dot( geometryNormal, geometryViewDir ) );
	float rim = smoothstep( 0.62, 0.9, 1.0 - NdV ) * smoothstep( -0.1, 0.35, NdL );
	reflectedLight.directDiffuse += rim * ${f(S.rim)} * directLight.color * ( material.diffuseColor + 0.15 );
	// Gloss: one crisp highlight, only on smooth surfaces.
	float glossy = 1.0 - material.roughness;
	if ( glossy > 0.25 ) {
		vec3 H = directLight.direction + geometryViewDir;
		H *= inversesqrt( max( dot( H, H ), 1e-8 ) ); // (normalize() of a zero vector is NaN: a black pixel)
		float spec = pow( saturate( dot( geometryNormal, H ) ), exp2( 2.0 + 9.0 * glossy ) );
		spec = smoothstep( 0.45, 0.6, spec ) * glossy * glossy * step( 0.0, NdL );
		reflectedLight.directSpecular += spec * ${f(S.gloss)} * directLight.color * ( material.specularColor + 0.35 );
	}
}
void RE_IndirectSpecular_Stylised( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {}
#undef RE_Direct
#undef RE_IndirectSpecular
#define RE_Direct RE_Direct_Stylised
#define RE_IndirectSpecular RE_IndirectSpecular_Stylised
`;
  // Insert after the physical model's defines, so ours replace them.
  const at = C.lights_physical_pars_fragment.indexOf('float computeSpecularOcclusion');
  C.lights_physical_pars_fragment = C.lights_physical_pars_fragment.slice(0, at) + lighting + C.lights_physical_pars_fragment.slice(at);

  const grade = /* glsl */ `
	{
		float l = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
		gl_FragColor.rgb = max( mix( vec3( l ), gl_FragColor.rgb, ${f(S.saturation)} ), 0.0 );
		gl_FragColor.rgb += vec3( ${S.lift.map(f).join(', ')} ) * ( 1.0 - smoothstep( 0.0, 0.35, l ) );
	}
`;
  C.tonemapping_fragment = C.tonemapping_fragment + grade;
}

// --- Frame-rate overlay and adaptive resolution ---
// beforeRender() once a frame, just before the main render; tick(now) just after it.
// Adaptive resolution lowers the render resolution (down to 55% of the full one) when
// frames run slow and raises it again when there is headroom. Changing resolution
// resizes the canvas, which wipes it, so a change is only ever applied right before a
// render (never after one, which would show a black frame), and only after two slow
// (or two fast) checks in a row, at most once every two seconds, so it doesn't hunt.
export function createPerf(renderer, { maxRatio, onChange = () => {} }) {
  let el = null, frames = 0, worst = 0, last = performance.now(), lastFrame = last, scale = 1, want = 1, slow = 0, fast = 0, changed = 0;
  if (SHOW_PERF) {
    el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:50;pointer-events:none;font:11px/1.35 ui-monospace,Menlo,monospace;color:#cfe;background:#000a;padding:6px 8px;border-radius:6px;white-space:pre';
    document.body.appendChild(el);
  }
  const target = () => Math.min(devicePixelRatio, maxRatio) * scale;
  return {
    beforeRender() {
      if (want === scale) return;
      scale = want;
      renderer.setPixelRatio(target());
      onChange();
    },
    tick(now = performance.now()) {
      frames++;
      worst = Math.max(worst, now - lastFrame);
      lastFrame = now;
      const span = now - last;
      if (span < 500) return;
      const fps = frames * 1000 / span;
      if (ADAPTIVE) {
        slow = fps < 48 ? slow + 1 : 0;
        fast = fps > 58 ? fast + 1 : 0;
        if (now - changed > 2000) {
          if (slow >= 2 && scale > 0.55) { want = Math.max(0.55, scale * 0.85); changed = now; slow = 0; }
          else if (fast >= 2 && scale < 1) { want = Math.min(1, scale * 1.08); changed = now; fast = 0; }
        }
      }
      if (el) {
        const r = renderer.info.render, m = renderer.info.memory;
        el.textContent = `${fps.toFixed(0)} fps   worst ${worst.toFixed(0)} ms\n` +
          `draw calls ${r.calls}\ntriangles  ${(r.triangles / 1000).toFixed(0)}k\n` +
          `geometries ${m.geometries}   shaders ${renderer.info.programs?.length ?? '?'}\n` +
          `resolution ${(renderer.getPixelRatio()).toFixed(2)}x${ADAPTIVE ? ' (adaptive)' : ''}\n` +
          `look ${LOOK}${STRESS > 1 ? `   stress ${STRESS}x` : ''}`;
      }
      frames = 0; worst = 0; last = now;
    },
    ratio: target,
  };
}
