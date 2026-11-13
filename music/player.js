// Shared song player for olid.is.
// Games play songs through this, and the music studio (/music/) edits the same files.
//
//   import { createPlayer, loadGameSong } from "/music/player.js";
//   const music = createPlayer({ volume: 0.6 });
//   const song = await loadGameSong("stillwater/run", "/music/songs/stillwater-run.json");
//   startButton.onclick = () => music.play(song);   // first play must follow a click/key press
//
// The song format is described in music/FORMAT.md.

// ---------- Notes ----------

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// "C4", "F#3", "Bb5" or a MIDI number -> MIDI number.
export function noteToMidi(note) {
    if (typeof note === "number") return note;
    const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(note).trim());
    if (!m) throw new Error(`Bad note "${note}"`);
    const accidental = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
    return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1].toUpperCase()] + accidental;
}

export const midiToNote = (midi) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const noteToFreq = (note) => 440 * 2 ** ((noteToMidi(note) - 69) / 12);

// ---------- Song data ----------

export const SYNTH_DEFAULTS = {
    type: "synth", wave: "square", volume: 0.3, pan: 0,
    attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.15,
    filter: 0, resonance: 0, filterEnv: 0,
    unison: 1, spread: 12, vibrato: 0, vibratoRate: 5,
    detune: 0, octave: 0, reverb: 0, delay: 0,
};
export const DRUM_DEFAULTS = {
    type: "drum", kind: "kick", volume: 0.5, pan: 0, pitch: 1, decay: 1, reverb: 0, delay: 0,
};
export const DRUM_KINDS = ["kick", "snare", "clap", "hat", "openhat", "tom", "perc"];

// Fill an instrument's missing settings with defaults.
export const withDefaults = (inst) => (inst.type === "drum" ? { ...DRUM_DEFAULTS, ...inst } : { ...SYNTH_DEFAULTS, ...inst });

const normalized = new WeakSet();

// Fill defaults and check structure, so games and the studio can trust a song.
// In a normalized song every note is { step, note, length, velocity } with note as a MIDI number.
// Safe to call twice: an already-normalized song is returned as is.
export function normalizeSong(raw) {
    if (normalized.has(raw)) return raw;
    if (!raw || raw.format !== "olid-song") throw new Error("Not an olid-song file");
    const song = {
        title: "Untitled", game: null, bpm: 120, stepsPerBeat: 4, swing: 0, volume: 1,
        loopFrom: 0, key: "C", scale: "major", ...raw,
    };
    song.fx = { delaySteps: 3, delayFeedback: 0.35, ...raw.fx };
    song.instruments = {};
    for (const [name, inst] of Object.entries(raw.instruments ?? {})) {
        song.instruments[name] = withDefaults(inst);
    }
    song.patterns = {};
    for (const [name, pat] of Object.entries(raw.patterns ?? {})) {
        const tracks = {};
        for (const [inst, notes] of Object.entries(pat.tracks ?? {})) {
            if (!song.instruments[inst]) throw new Error(`Pattern ${name} uses unknown instrument "${inst}"`);
            tracks[inst] = notes.map((n) => {
                // [step, note, length, velocity] in files; {step, note, ...} objects also accepted.
                const [step, note = null, length = 1, velocity = 1] = Array.isArray(n) ? n : [n.step, n.note, n.length, n.velocity];
                return { step, note: note === null ? null : noteToMidi(note), length, velocity };
            });
        }
        song.patterns[name] = { steps: pat.steps ?? 16, tracks };
        if (Array.isArray(pat.chords)) song.patterns[name].chords = [...pat.chords];
        if (Array.isArray(pat.colors)) song.patterns[name].colors = [...pat.colors];
    }
    song.arrangement = raw.arrangement?.length ? [...raw.arrangement] : Object.keys(song.patterns).slice(0, 1);
    for (const p of song.arrangement) if (!song.patterns[p]) throw new Error(`Arrangement uses unknown pattern "${p}"`);
    song.loopFrom = Math.min(Math.max(0, song.loopFrom | 0), Math.max(0, song.arrangement.length - 1));
    normalized.add(song);
    return song;
}

// The reverse of normalizeSong: compact JSON with note names, for saving.
export function serializeSong(song) {
    const patterns = {};
    for (const [name, pat] of Object.entries(song.patterns)) {
        const tracks = {};
        for (const [inst, notes] of Object.entries(pat.tracks)) {
            if (!notes.length) continue;
            tracks[inst] = [...notes].sort((a, b) => a.step - b.step || (a.note ?? 0) - (b.note ?? 0)).map(({ step, note, length, velocity }) => {
                const n = note === null ? null : midiToNote(note);
                const v = Math.round(velocity * 100) / 100;
                return v !== 1 ? [step, n, length, v] : length !== 1 ? [step, n, length] : n !== null ? [step, n] : [step];
            });
        }
        patterns[name] = {
            steps: pat.steps,
            ...(pat.chords ? { chords: pat.chords } : {}),
            ...(pat.colors?.some(Boolean) ? { colors: pat.colors } : {}),
            tracks,
        };
    }
    const { format, version, patterns: _p, ...rest } = song;
    // Arrays of notes stay on one line each, so files are readable and diff nicely.
    return JSON.stringify({ format: "olid-song", version: 1, ...rest, patterns }, null, 2)
        .replace(/\[\s+([^\[\]{}]*?)\s+\]/g, (_, inner) => `[${inner.replace(/\s*\n\s*/g, " ")}]`);
}

export async function loadSong(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Couldn't load song ${url} (${res.status})`);
    return normalizeSong(await res.json());
}

// ---------- Game song slots ----------
// A game asks for a slot (e.g. "stillwater/run"). A visitor can swap in their own song
// from the studio; it is stored in this browser only.

const slotKey = (slotId) => `olid-music:slot:${slotId}`;

export function getGameSongOverride(slotId) {
    try {
        const json = localStorage.getItem(slotKey(slotId));
        return json ? normalizeSong(JSON.parse(json)) : null;
    } catch {
        return null;
    }
}

export function setGameSong(slotId, song) {
    try {
        if (song) localStorage.setItem(slotKey(slotId), serializeSong(normalizeSong(song)));
        else localStorage.removeItem(slotKey(slotId));
        return true;
    } catch {
        return false;
    }
}

export async function loadGameSong(slotId, defaultUrl) {
    return getGameSongOverride(slotId) ?? loadSong(defaultUrl);
}

// ---------- Sound engine ----------

const noiseBuffers = new WeakMap();
function noiseBuffer(ctx) {
    if (!noiseBuffers.has(ctx)) {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noiseBuffers.set(ctx, buf);
    }
    return noiseBuffers.get(ctx);
}

const impulses = new WeakMap();
function impulse(ctx) {
    if (!impulses.has(ctx)) {
        const seconds = 2.6;
        const len = Math.floor(ctx.sampleRate * seconds);
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = buf.getChannelData(c);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
        }
        impulses.set(ctx, buf);
    }
    return impulses.get(ctx);
}

// One engine per playing song: per-track channels (volume for mute/solo, pan, effect sends)
// feeding a shared reverb and tempo-synced delay.
function createEngine(ctx, out) {
    const input = ctx.createGain();
    input.connect(out);

    const reverbIn = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse(ctx);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.55;
    reverbIn.connect(convolver).connect(reverbOut).connect(input);

    const delayIn = ctx.createGain();
    const delay = ctx.createDelay(4);
    const feedback = ctx.createGain();
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 3200;
    delayIn.connect(delay);
    delay.connect(damp).connect(feedback).connect(delay);
    damp.connect(input);

    const channels = new Map();
    let audible = () => true;

    // inst.gain is the track's fader level (default 1); muting sets the channel to 0.
    const level = (name, inst) => (audible(name) ? Math.max(0, inst?.gain ?? 1) : 0);

    function channel(name, inst) {
        let ch = channels.get(name);
        if (!ch) {
            ch = { gain: ctx.createGain(), pan: ctx.createStereoPanner(), rev: ctx.createGain(), del: ctx.createGain() };
            ch.gain.connect(ch.pan).connect(input);
            ch.pan.connect(ch.rev).connect(reverbIn);
            ch.pan.connect(ch.del).connect(delayIn);
            ch.gain.gain.value = level(name, inst);
            channels.set(name, ch);
        }
        if (ch.inst !== inst || ch.level !== level(name, inst)) {
            ch.level = level(name, inst);
            ch.gain.gain.setTargetAtTime(ch.level, ctx.currentTime, 0.01);
        }
        ch.inst = inst;
        ch.pan.pan.value = inst.pan ?? 0;
        ch.rev.gain.value = inst.reverb ?? 0;
        ch.del.gain.value = inst.delay ?? 0;
        return ch.gain;
    }

    return {
        input,
        channel,
        setFx(song) {
            delay.delayTime.value = Math.min(4, song.fx.delaySteps * stepSeconds(song));
            feedback.gain.value = Math.min(0.9, song.fx.delayFeedback);
        },
        setAudible(fn) {
            audible = fn;
            for (const [name, ch] of channels) {
                ch.level = level(name, ch.inst);
                ch.gain.gain.setTargetAtTime(ch.level, ctx.currentTime, 0.01);
            }
        },
        disconnect() { input.disconnect(); },
    };
}

function envelope(param, inst, peak, t, end) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + inst.attack);
    param.setTargetAtTime(peak * inst.sustain, t + inst.attack, Math.max(inst.decay, 0.001) / 3);
    param.cancelScheduledValues(end);
    param.setTargetAtTime(0, end, Math.max(inst.release, 0.001) / 3);
}

function playSynth(ctx, out, inst, midi, t, duration, velocity) {
    const freq = noteToFreq(midi) * 2 ** inst.octave;
    const end = t + Math.max(duration, inst.attack);
    const stopAt = end + inst.release * 2 + 0.05;
    const voices = Math.max(1, Math.min(4, inst.unison | 0));

    const amp = ctx.createGain();
    envelope(amp.gain, inst, inst.volume * velocity / Math.sqrt(voices), t, end);

    let head = amp;
    if (inst.filter > 0) {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.Q.value = 0.7 + inst.resonance;
        const base = inst.filter;
        if (inst.filterEnv > 0) {
            lp.frequency.setValueAtTime(Math.min(18000, base * (1 + inst.filterEnv * 7)), t);
            lp.frequency.setTargetAtTime(base, t + inst.attack, Math.max(inst.decay, 0.02) / 2);
        } else {
            lp.frequency.value = base;
        }
        lp.connect(amp);
        head = lp;
    }
    amp.connect(out);

    let lfo = null;
    if (inst.vibrato > 0) {
        lfo = ctx.createOscillator();
        lfo.frequency.value = inst.vibratoRate;
        const depth = ctx.createGain();
        depth.gain.value = inst.vibrato;
        lfo.connect(depth);
        lfo.depth = depth;
        lfo.start(t);
        lfo.stop(stopAt);
    }

    for (let i = 0; i < voices; i++) {
        const offset = voices === 1 ? 0 : (i / (voices - 1) - 0.5) * inst.spread;
        let src;
        if (inst.wave === "noise") {
            src = ctx.createBufferSource();
            src.buffer = noiseBuffer(ctx);
            src.loop = true;
            const bp = ctx.createBiquadFilter();
            bp.type = "bandpass";
            bp.frequency.value = freq;
            bp.Q.value = 1.5;
            src.connect(bp).connect(head);
        } else {
            src = ctx.createOscillator();
            src.type = inst.wave;
            src.frequency.value = freq;
            src.detune.value = inst.detune + offset;
            if (lfo) lfo.depth.connect(src.detune);
            src.connect(head);
        }
        src.start(t);
        src.stop(stopAt);
    }
}

function playDrum(ctx, out, inst, t, velocity) {
    const v = inst.volume * velocity;
    const p = inst.pitch;
    const d = inst.decay;
    const amp = ctx.createGain();
    amp.connect(out);

    const tone = (type, from, to, length, gain = 1) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(from * p, t);
        osc.frequency.exponentialRampToValueAtTime(to * p, t + length * 0.4);
        const g = ctx.createGain();
        g.gain.setValueAtTime(v * gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + length);
        osc.connect(g).connect(amp);
        osc.start(t);
        osc.stop(t + length + 0.02);
    };
    const noise = (filterType, freq, length, gain = 1, at = t, q = 1) => {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx);
        const f = ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.value = freq * p;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(v * gain, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + length);
        src.connect(f).connect(g).connect(amp);
        src.start(at);
        src.stop(at + length + 0.02);
    };

    switch (inst.kind) {
        case "kick": tone("sine", 160, 42, 0.32 * d, 1.2); break;
        case "snare": noise("bandpass", 1900, 0.2 * d, 1, t, 0.8); tone("triangle", 220, 160, 0.09 * d, 0.6); break;
        case "clap":
            for (let i = 0; i < 3; i++) noise("bandpass", 1300, 0.03, 0.9, t + i * 0.011, 1.2);
            noise("bandpass", 1300, 0.18 * d, 0.8, t + 0.033, 1.2);
            break;
        case "hat": noise("highpass", 7500, 0.05 * d, 0.8); break;
        case "openhat": noise("highpass", 7000, 0.32 * d, 0.7); break;
        case "tom": tone("sine", 140, 85, 0.38 * d, 1); break;
        case "perc": tone("square", 820, 780, 0.07 * d, 0.35); break;
        default: tone("sine", 160, 42, 0.3 * d);
    }
}

const stepSeconds = (song) => 60 / song.bpm / song.stepsPerBeat;

// Schedule the notes of one step of a pattern at time t.
function scheduleStep(ctx, engine, song, pattern, step, t) {
    const stepTime = stepSeconds(song);
    const at = t + (step % 2 === 1 ? song.swing * stepTime * 0.5 : 0);
    for (const [name, notes] of Object.entries(pattern.tracks)) {
        const inst = song.instruments[name];
        if (!inst) continue;
        for (const n of notes) {
            if (n.step !== step) continue;
            // A note recorded live was already heard when it was played; skip its first pass.
            if (n.skipOnce) { n.skipOnce = false; continue; }
            const out = engine.channel(name, inst);
            if (inst.type === "drum") playDrum(ctx, out, inst, at, n.velocity);
            else if (n.note !== null) playSynth(ctx, out, inst, n.note, at, n.length * stepTime, n.velocity);
        }
    }
}

// ---------- The player ----------

export function createPlayer({ context, destination, volume = 1 } = {}) {
    let ctx = context ?? null;
    let master = null;
    let timer = null;
    let state = null; // { song, engine, bus, loop, pattern, index, step, nextTime }
    let previewEngine = null;
    let mix = { muted: new Set(), soloed: new Set() };
    const stepListeners = new Set();
    const audible = (name) => !mix.muted.has(name) && (mix.soloed.size === 0 || mix.soloed.has(name));

    function ensureContext() {
        if (!ctx) ctx = new AudioContext();
        if (!master) {
            master = ctx.createGain();
            master.gain.value = volume;
            const limiter = ctx.createDynamicsCompressor();
            limiter.threshold.value = -6;
            limiter.ratio.value = 8;
            master.connect(limiter).connect(destination ?? ctx.destination);
        }
        return ctx;
    }

    function tick() {
        if (!state) return;
        const s = state;
        const { song } = s;
        let guard = 0;
        while (s.nextTime < ctx.currentTime + 0.12 && guard++ < 64) {
            const name = s.pattern ?? song.arrangement[s.index];
            const pattern = song.patterns[name];
            if (!pattern) { // pattern deleted while playing
                if (s.pattern) s.pattern = song.arrangement[0] ?? null;
                s.index = 0; s.step = 0;
                if (!song.patterns[s.pattern ?? song.arrangement[0]]) return;
                continue;
            }
            if (s.step >= pattern.steps) {
                s.step = 0;
                if (!s.pattern) {
                    s.index++;
                    if (s.index >= song.arrangement.length) {
                        if (!s.loop) { endAt(s.nextTime); return; }
                        s.index = Math.min(song.loopFrom, song.arrangement.length - 1);
                    }
                }
                continue;
            }
            s.engine.setFx(song);
            scheduleStep(ctx, s.engine, song, pattern, s.step, s.nextTime);
            if (stepListeners.size) {
                const info = { pattern: name, index: s.pattern ? -1 : s.index, step: s.step };
                const delay = (s.nextTime - ctx.currentTime) * 1000;
                setTimeout(() => { if (state === s) stepListeners.forEach((cb) => cb(info)); }, Math.max(0, delay));
            }
            s.nextTime += stepSeconds(song);
            s.step++;
        }
    }

    function endAt(time) {
        clearInterval(timer);
        timer = null;
        const s = state;
        setTimeout(() => { if (state === s) { state = null; stepListeners.forEach((cb) => cb(null)); } }, Math.max(0, (time - ctx.currentTime) * 1000));
    }

    function fadeOut(s, seconds) {
        const now = ctx.currentTime;
        s.bus.gain.cancelScheduledValues(now);
        s.bus.gain.setValueAtTime(s.bus.gain.value, now);
        s.bus.gain.linearRampToValueAtTime(0, now + Math.max(seconds, 0.02));
        setTimeout(() => s.bus.disconnect(), (seconds + 3) * 1000);
    }

    return {
        // Start a song. Options: loop (default true), fadeIn/fadeOut seconds,
        // pattern: loop just that pattern (the studio uses this), from: arrangement index to start at.
        async play(rawSong, { loop = true, fadeIn = 0, fadeOut: fadeOutTime = 0.25, pattern = null, from = 0 } = {}) {
            const song = normalizeSong(rawSong);
            ensureContext();
            await ctx.resume();
            if (state) fadeOut(state, fadeOutTime);
            const bus = ctx.createGain();
            bus.gain.setValueAtTime(fadeIn > 0 ? 0 : song.volume, ctx.currentTime);
            if (fadeIn > 0) bus.gain.linearRampToValueAtTime(song.volume, ctx.currentTime + fadeIn);
            bus.connect(master);
            const engine = createEngine(ctx, bus);
            engine.setAudible(audible);
            state = { song, engine, bus, loop, pattern, index: Math.min(from, song.arrangement.length - 1), step: 0, nextTime: ctx.currentTime + 0.06 };
            clearInterval(timer);
            timer = setInterval(tick, 25);
            tick();
        },
        stop({ fadeOut: fadeOutTime = 0.25 } = {}) {
            clearInterval(timer);
            timer = null;
            if (state) fadeOut(state, fadeOutTime);
            state = null;
            stepListeners.forEach((cb) => cb(null));
        },
        // Studio helpers: swap in an edited copy of the song, change what loops, or jump.
        replaceSong(song) { if (state) state.song = normalizeSong(song); },
        setPattern(name) { if (state) state.pattern = name; },
        seek(index, step = 0) {
            if (!state) return;
            state.pattern = null;
            state.index = Math.max(0, Math.min(index, state.song.arrangement.length - 1));
            state.step = step;
            state.nextTime = ctx.currentTime + 0.05;
        },
        setMix({ muted = mix.muted, soloed = mix.soloed } = {}) {
            mix = { muted: new Set(muted), soloed: new Set(soloed) };
            state?.engine.setAudible(audible);
        },
        setVolume(v) {
            volume = v;
            if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
        },
        // Where playback is right now, as heard (output latency included): a fractional step in the
        // current pattern. raw can be just below 0 or past the scheduled step; scheduled = next step not yet queued.
        position() {
            if (!state || !ctx) return null;
            const s = state;
            const name = s.pattern ?? s.song.arrangement[s.index];
            const pat = s.song.patterns[name];
            if (!pat) return null;
            const st = stepSeconds(s.song);
            const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
            const raw = s.step - (s.nextTime - ctx.currentTime + latency) / st;
            return { pattern: name, raw, step: ((raw % pat.steps) + pat.steps) % pat.steps, steps: pat.steps, scheduled: s.step, stepTime: st };
        },
        get playing() { return !!state; },
        get song() { return state?.song ?? null; },
        get context() { return ctx; },
        // cb({ pattern, index, step }) on every step; cb(null) when playback stops. Returns an unsubscribe function.
        onStep(cb) { stepListeners.add(cb); return () => stepListeners.delete(cb); },
        // Play a single note right now (studio previews, game sound effects).
        preview(rawSong, instName, note = "C4", lengthSteps = 2, velocity = 1) {
            const song = normalizeSong(rawSong);
            const inst = song.instruments[instName];
            if (!inst) return;
            ensureContext();
            ctx.resume();
            if (!previewEngine) previewEngine = createEngine(ctx, master);
            previewEngine.setFx(song);
            const out = previewEngine.channel(instName, inst);
            const t = ctx.currentTime + 0.01;
            if (inst.type === "drum") playDrum(ctx, out, inst, t, velocity);
            else playSynth(ctx, out, inst, noteToMidi(note), t, lengthSteps * stepSeconds(song), velocity);
        },
    };
}

// Render a song once through to an AudioBuffer (tests, and WAV export in the studio).
export async function renderSong(rawSong, { sampleRate = 44100, tail = 3 } = {}) {
    const song = normalizeSong(rawSong);
    const stepTime = stepSeconds(song);
    const steps = song.arrangement.reduce((sum, p) => sum + song.patterns[p].steps, 0);
    const ctx = new OfflineAudioContext(2, Math.ceil((steps * stepTime + tail) * sampleRate), sampleRate);
    const bus = ctx.createGain();
    bus.gain.value = song.volume;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.ratio.value = 8;
    bus.connect(limiter).connect(ctx.destination);
    const engine = createEngine(ctx, bus);
    engine.setFx(song);
    let t = 0.02;
    for (const name of song.arrangement) {
        const pattern = song.patterns[name];
        for (let s = 0; s < pattern.steps; s++, t += stepTime) scheduleStep(ctx, engine, song, pattern, s, t);
    }
    return ctx.startRendering();
}
