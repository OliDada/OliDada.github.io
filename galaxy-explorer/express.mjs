// Expression: how a creature carries itself, beyond walking about. Shared by the animals
// on a world (fauna-mesh.js) and a station's crew (station-deck.js), so a species looks
// and greets the same everywhere.
//
//  - Looking: the head turns (fauna-mesh.js HEAD part) toward what it is paying attention
//    to: you, whoever it is talking to, or, when nothing holds it, glances about (fidgets).
//  - Greeting: each species has its own gesture (gestureOf), from its body and culture:
//    a bow, arms raised, a spin on the spot, a hop, a sway, rearing up, a crest flare.
//    Anything with glowing markings pulses them as it does.
//  - Mood: how a stance toward you shows in the body (moodOf): curious ones lean in and
//    tilt their heads, wary ones shrink back, guarded ones stand tall, happy ones bounce.
//
//   const ex = createExpression(random);
//   const pose = express(ex, dt, { look, mood, t, phase, sp, still });
//   pose: { pitch, roll, yaw, lift, scale, arms, glow, headYaw, headPitch, turn }
//     pitch (+ leans forward), roll, yaw: radians about the body's own axes; lift: metres
//     up; scale: height (1 = as built); arms: an animation amp to use instead (or null);
//     glow: 0..1 extra glow; headYaw/headPitch: where the head points; turn: how much more
//     the body would have to turn (radians, + to its right) to look at what it wants to.
import { hash32 } from './rng.mjs';

export const GESTURES = ['bow', 'raise', 'spin', 'hop', 'sway', 'rear', 'flare'];
export const GESTURE_WORDS = {
  bow: 'bows low', raise: 'raises its arms', spin: 'turns a slow circle', hop: 'hops on the spot',
  sway: 'sways from side to side', rear: 'rears up tall', flare: 'flares its crest',
};
const DURATION = { bow: 1.8, raise: 1.9, spin: 2, hop: 1.3, sway: 2.2, rear: 1.7, flare: 1.8 };
const HEAD_YAW = 1.15, HEAD_PITCH = .55;

// The greeting a species uses (the same for every one of them).
export function gestureOf(sp) {
  if (!sp) return 'bow';
  const plan = sp.plan, opts = [];
  if (sp.arms) opts.push('raise', 'raise', 'bow');
  if (plan === 'biped') opts.push('bow');
  if (plan === 'serpent' || plan === 'slug' || sp.aquatic) opts.push('sway', 'rear');
  if (plan === 'roller' || plan === 'radial' || plan === 'floater') opts.push('spin', 'spin', plan === 'floater' ? 'sway' : 'hop');
  if (plan === 'quadruped' || plan === 'hexapod' || plan === 'arachnid') opts.push('hop', 'bow', 'rear');
  if (plan === 'flyer') opts.push('hop', 'raise');
  if (sp.frill || sp.crest) opts.push('flare', 'flare');
  if (!opts.length) opts.push('bow');
  const pick = opts[hash32(sp.id || sp.name || 'x', 'greeting') % opts.length];
  return pick === 'raise' && !sp.arms && plan !== 'flyer' ? 'rear' : pick;
}
// How a stance toward you shows in the body.
export function moodOf(stance) { return ({ welcome: 'happy', curious: 'curious', wary: 'wary', guarded: 'guarded' })[stance] || null; }

export function createExpression(r = Math.random) {
  return { yaw: 0, pitch: 0, wantYaw: 0, wantPitch: 0, fid: 1 + r() * 4, gesture: null, gt: 0, mood: 0, r };
}
// Start a gesture (a greeting, or a reaction). kind defaults to the species' own.
export function startGesture(ex, kind) { ex.gesture = kind; ex.gt = 0; }
export const gestureBusy = (ex) => !!ex.gesture;

// look: { yaw, pitch } (radians, the target relative to the body; yaw + to its right) or null.
// mood: 'happy' | 'curious' | 'wary' | 'guarded' | null (shown while attending to you).
// still: standing still (fidgets only then; walking, the head looks where it goes).
export function express(ex, dt, { look = null, mood = null, t = 0, phase = 0, sp = null, still = true } = {}) {
  const size = sp?.size ?? 1;
  const pose = { pitch: 0, roll: 0, yaw: 0, lift: 0, scale: 1, arms: null, glow: 0, headYaw: 0, headPitch: 0, turn: 0 };
  // Where the head points.
  if (look) {
    ex.wantYaw = clamp(look.yaw, -HEAD_YAW, HEAD_YAW); ex.wantPitch = clamp(look.pitch, -HEAD_PITCH, HEAD_PITCH);
    pose.turn = look.yaw - ex.wantYaw;
    // Looking far down at someone small: bend toward them.
  } else if (!still) { ex.wantYaw = 0; ex.wantPitch = 0; }
  else if ((ex.fid -= dt) <= 0) { // a glance about, or back ahead
    const r = ex.r;
    ex.fid = 1.5 + r() * 4.5;
    if (r() < .35) { ex.wantYaw = 0; ex.wantPitch = 0; } else { ex.wantYaw = (r() - .5) * 1.6; ex.wantPitch = (r() - .55) * .5; }
  }
  // Looking far down at someone small: bend toward them.
  ex.stoop = (ex.stoop || 0) + ((look ? Math.min(.35, Math.max(0, -look.pitch - .4) * .6) : 0) - (ex.stoop || 0)) * Math.min(1, dt * 2);
  pose.pitch += ex.stoop;
  const k = Math.min(1, dt * (look ? 5 : 3));
  ex.yaw += (ex.wantYaw - ex.yaw) * k; ex.pitch += (ex.wantPitch - ex.pitch) * k;
  pose.headYaw = ex.yaw; pose.headPitch = ex.pitch;
  // A weight shift now and then, standing about.
  if (still) pose.roll += Math.sin(t * .5 + phase) * .025;
  // Mood, easing in and out.
  ex.mood += ((mood ? 1 : 0) - ex.mood) * Math.min(1, dt * 2);
  const m = ex.mood;
  if (mood && m > .01) ex.moodKind = mood;
  if (m > .01) switch (ex.moodKind) {
    case 'curious': pose.pitch += .14 * m; pose.roll += .16 * m * Math.sin(t * .7 + phase); pose.headPitch -= .05 * m; break;
    case 'wary': pose.pitch -= .08 * m; pose.scale -= .07 * m; pose.lift -= size * .05 * m; break;
    case 'guarded': pose.pitch -= .06 * m; pose.scale += .06 * m; pose.headPitch += .08 * m; break;
    case 'happy': pose.lift += Math.max(0, Math.sin(t * 6 + phase)) * size * .05 * m * (Math.sin(t * .9 + phase) > 0 ? 1 : .2); break;
  }
  // The gesture.
  if (ex.gesture) {
    const kind = ex.gesture, dur = DURATION[kind] || 1.8;
    ex.gt += dt / dur;
    const f = Math.min(1, ex.gt), e = Math.sin(Math.PI * f), s = f * f * (3 - 2 * f);
    switch (kind) {
      case 'bow': pose.pitch += .42 * e; pose.headPitch -= .35 * e; break;
      case 'raise': pose.arms = -2; pose.pitch -= .1 * e; pose.headPitch += .25 * e; break;
      case 'spin': pose.yaw += Math.PI * 2 * s; pose.lift += e * size * .06; break;
      case 'hop': pose.lift += Math.abs(Math.sin(f * Math.PI * 2)) * size * .28; pose.pitch -= .1 * e; break;
      case 'sway': pose.roll += Math.sin(f * Math.PI * 4) * .28 * e; pose.headYaw += Math.sin(f * Math.PI * 4 + 1) * .3 * e; break;
      case 'rear': pose.pitch -= .38 * e; pose.lift += size * .12 * e; pose.headPitch += .2 * e; break;
      case 'flare': pose.scale += .08 * e; pose.headPitch += .3 * e; pose.glow = Math.max(pose.glow, e); break;
    }
    if ((sp?.glow ?? 0) > .2) pose.glow = Math.max(pose.glow, e);
    if (f >= 1) ex.gesture = null;
  }
  return pose;
}

// The direction to a point, from a body at `origin` with axes right/up/forward
// (Vector3-likes): { yaw, pitch, dist } as express() wants it.
export function lookAngles(dx, dy, dz, right, up, fwd) {
  const x = dx * right.x + dy * right.y + dz * right.z, y = dx * up.x + dy * up.y + dz * up.z, z = dx * fwd.x + dy * fwd.y + dz * fwd.z;
  const flat = Math.hypot(x, z);
  return { yaw: Math.atan2(x, z), pitch: Math.atan2(y, Math.max(.3, flat)), dist: Math.hypot(flat, y) };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
