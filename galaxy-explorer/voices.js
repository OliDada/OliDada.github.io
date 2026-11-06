// Voices: each species that can speak (or call) has a voice of its own, synthesized
// with WebAudio from its body and nature, so nothing is recorded and every species
// sounds different. Big bodies are low, small ones high; fliers chirp and trill, coils
// and creepers hiss and rasp, drifters hum in long slides, rollers and spokes click and
// ring; silicon life buzzes, glowing species shimmer. A voice says a few syllables
// shaped by mood: rising and quick when happy, a rising question when curious, low
// and soft when wary, short and flat when guarded. Silent unless sound is on (audio.js).
//
//   const voices = createVoices(() => audioContext | null);
//   voices.say(sp, { mood, volume, length, young })
import { rng } from './rng.mjs';

export function voiceOf(sp) {
  const r = rng(sp.id || sp.name || 'voice', 'voice'), size = Math.max(.15, sp.size || 1), plan = sp.plan;
  const kind = plan === 'flyer' ? 'chirp' : plan === 'serpent' || plan === 'slug' ? 'hiss' : plan === 'floater' || sp.aquatic ? 'song' : plan === 'roller' || plan === 'radial' ? 'click' : 'talk';
  return {
    kind,
    pitch: Math.max(55, Math.min(900, 300 / Math.pow(size, .6))) * (kind === 'chirp' ? 2.6 : kind === 'song' ? .6 : 1) * (.85 + r() * .3),
    wave: sp.chemistry === 'silicon' ? 'sawtooth' : sp.chemistry === 'sulfur' || sp.chemistry === 'ammonia' ? 'square' : r() < .5 ? 'triangle' : 'sine',
    formant: 600 + r() * 1800,
    rate: (kind === 'chirp' ? 9 : kind === 'click' ? 7 : kind === 'song' ? 1.6 : 4.5) * (.8 + r() * .4) / Math.pow(size, .15),
    shimmer: (sp.glow || 0) > .3 ? 4 + r() * 8 : 0,
    rough: kind === 'hiss' ? .9 : r() * .3,
  };
}

export function createVoices(getContext) {
  let noise = null;
  const noiseOf = (ctx) => {
    if (noise?.ctx === ctx) return noise.buffer;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = { ctx, buffer }; return buffer;
  };
  let busyUntil = 0;
  return {
    // Says something (a few syllables). Returns how long it lasts, in seconds (0 if silent).
    say(sp, { mood = null, volume = 1, length = null, young = false } = {}) {
      const ctx = getContext?.();
      if (!ctx || !sp || volume <= .02) return 0;
      const v = voiceOf(sp), now = ctx.currentTime;
      if (now < busyUntil - .05) return 0; // one at a time
      const n = length ?? (mood === 'guarded' ? 2 : mood === 'wary' ? 2 + (Math.random() < .5) : 3 + Math.floor(Math.random() * 4));
      const step = 1 / v.rate * (mood === 'happy' ? .8 : mood === 'wary' ? 1.3 : 1);
      const out = ctx.createGain(); out.gain.value = .1 * Math.min(1, volume) * (mood === 'wary' ? .6 : 1);
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = v.formant; filter.Q.value = v.kind === 'hiss' ? 1.2 : 2.5;
      const dry = ctx.createGain(); dry.gain.value = .55;
      filter.connect(out); dry.connect(out); out.connect(ctx.destination);
      let t = now + .02;
      for (let i = 0; i < n; i++) {
        const f = i / Math.max(1, n - 1), last = i === n - 1;
        // The melody of what is said, by mood.
        const contour = mood === 'happy' ? 1 + f * .35 : mood === 'curious' ? (last ? 1.45 : 1 + Math.sin(f * 3) * .1) : mood === 'wary' ? .85 - f * .1 : mood === 'guarded' ? .8 : 1 + Math.sin(i * 2.1) * .15;
        const dur = step * (v.kind === 'song' ? 1.6 : .75) * (.7 + Math.random() * .6) * (young ? .7 : 1), f0 = v.pitch * contour * (.92 + Math.random() * .16) * (young ? 1.7 : 1);
        const env = ctx.createGain(); env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(1, t + Math.min(.03, dur * .2)); env.gain.setTargetAtTime(0, t + dur * .55, dur * .18);
        env.connect(filter); env.connect(dry);
        if (v.kind === 'hiss' || v.rough > .5) {
          const src = ctx.createBufferSource(); src.buffer = noiseOf(ctx); src.connect(env); src.start(t, Math.random() * .5); src.stop(t + dur * 1.4);
        }
        if (v.kind !== 'hiss') {
          const osc = ctx.createOscillator(); osc.type = v.kind === 'click' ? 'square' : v.wave;
          osc.frequency.setValueAtTime(f0 * (v.kind === 'chirp' ? .7 : .95), t);
          osc.frequency.exponentialRampToValueAtTime(f0 * (v.kind === 'chirp' ? 1.5 : v.kind === 'song' ? 1.3 : 1.05), t + dur * (v.kind === 'click' ? .1 : .8));
          if (v.shimmer) { const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = v.shimmer; depth.gain.value = f0 * .04; lfo.connect(depth).connect(osc.frequency); lfo.start(t); lfo.stop(t + dur * 1.4); }
          osc.connect(env); osc.start(t); osc.stop(t + (v.kind === 'click' ? dur * .35 : dur * 1.4));
        }
        t += dur + step * (v.kind === 'click' ? .4 : .25);
      }
      busyUntil = t;
      setTimeout(() => out.disconnect(), (t - now + 1) * 1000);
      return t - now;
    },
  };
}
