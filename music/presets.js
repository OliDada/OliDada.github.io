// Instrument presets, song templates and scales for the music studio.

export const PRESETS = {
    Keys: {
        "Piano": { type: "synth", wave: "triangle", volume: 0.34, attack: 0.004, decay: 0.7, sustain: 0.2, release: 0.45, filter: 3200, filterEnv: 0.5, unison: 2, spread: 6, reverb: 0.22 },
        "Electric Piano": { type: "synth", wave: "sine", volume: 0.36, attack: 0.004, decay: 1.1, sustain: 0.3, release: 0.5, unison: 2, spread: 9, vibrato: 4, vibratoRate: 4, reverb: 0.3, delay: 0.12 },
        "Organ": { type: "synth", wave: "triangle", volume: 0.22, attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.1, filter: 2400, unison: 3, spread: 6, vibrato: 7, vibratoRate: 6, reverb: 0.2 },
        "Bell": { type: "synth", wave: "sine", volume: 0.24, attack: 0.002, decay: 1.6, sustain: 0, release: 1.2, octave: 1, unison: 2, spread: 4, reverb: 0.4, delay: 0.25 },
        "Music Box": { type: "synth", wave: "triangle", volume: 0.22, attack: 0.001, decay: 0.5, sustain: 0, release: 0.6, octave: 1, filter: 5000, reverb: 0.35, delay: 0.15 },
    },
    Lead: {
        "Chip Lead": { type: "synth", wave: "square", volume: 0.14, attack: 0.004, decay: 0.1, sustain: 0.6, release: 0.08, vibrato: 14, vibratoRate: 6 },
        "Saw Lead": { type: "synth", wave: "sawtooth", volume: 0.13, attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.2, filter: 3600, resonance: 2, unison: 3, spread: 14, delay: 0.2 },
        "Soft Lead": { type: "synth", wave: "triangle", volume: 0.26, attack: 0.04, decay: 0.3, sustain: 0.7, release: 0.3, vibrato: 10, vibratoRate: 5, reverb: 0.3, delay: 0.2 },
        "Flute": { type: "synth", wave: "sine", volume: 0.3, attack: 0.08, decay: 0.2, sustain: 0.8, release: 0.2, vibrato: 12, vibratoRate: 5, reverb: 0.35 },
        "Pluck": { type: "synth", wave: "sawtooth", volume: 0.2, attack: 0.002, decay: 0.25, sustain: 0, release: 0.2, filter: 900, resonance: 4, filterEnv: 0.9, reverb: 0.2, delay: 0.2 },
    },
    Pad: {
        "Warm Pad": { type: "synth", wave: "sawtooth", volume: 0.1, attack: 0.8, decay: 1, sustain: 0.8, release: 1.5, filter: 900, unison: 3, spread: 18, reverb: 0.5 },
        "Glass Pad": { type: "synth", wave: "triangle", volume: 0.12, attack: 1.2, decay: 1, sustain: 0.8, release: 2, unison: 2, spread: 10, reverb: 0.6, delay: 0.2 },
        "Strings": { type: "synth", wave: "sawtooth", volume: 0.11, attack: 0.3, decay: 0.5, sustain: 0.8, release: 0.6, filter: 2200, unison: 3, spread: 10, vibrato: 6, vibratoRate: 5, reverb: 0.4 },
        "Choir": { type: "synth", wave: "triangle", volume: 0.16, attack: 0.5, decay: 0.6, sustain: 0.75, release: 1, filter: 1600, resonance: 3, unison: 3, spread: 16, vibrato: 8, vibratoRate: 4.5, reverb: 0.6 },
    },
    Bass: {
        "Sub Bass": { type: "synth", wave: "sine", volume: 0.45, attack: 0.005, decay: 0.2, sustain: 0.9, release: 0.1, octave: -1 },
        "Synth Bass": { type: "synth", wave: "sawtooth", volume: 0.24, attack: 0.003, decay: 0.2, sustain: 0.4, release: 0.1, filter: 600, resonance: 6, filterEnv: 0.7, octave: -1 },
        "Chip Bass": { type: "synth", wave: "triangle", volume: 0.36, attack: 0.002, decay: 0.1, sustain: 0.8, release: 0.05, octave: -1 },
        "Pluck Bass": { type: "synth", wave: "square", volume: 0.2, attack: 0.002, decay: 0.3, sustain: 0.1, release: 0.1, filter: 700, filterEnv: 0.6, octave: -1 },
    },
    FX: {
        "Wind": { type: "synth", wave: "noise", volume: 0.3, attack: 0.6, decay: 1, sustain: 0.7, release: 1.2, filter: 1500, resonance: 6, reverb: 0.5 },
        "Laser": { type: "synth", wave: "square", volume: 0.12, attack: 0.001, decay: 0.15, sustain: 0, release: 0.1, filter: 400, resonance: 12, filterEnv: 1, octave: 1 },
    },
    Drums: {
        "Kick": { type: "drum", kind: "kick", volume: 0.6 },
        "Snare": { type: "drum", kind: "snare", volume: 0.4 },
        "Clap": { type: "drum", kind: "clap", volume: 0.4, reverb: 0.15 },
        "Hi-hat": { type: "drum", kind: "hat", volume: 0.18 },
        "Open Hat": { type: "drum", kind: "openhat", volume: 0.15 },
        "Tom": { type: "drum", kind: "tom", volume: 0.45 },
        "Perc": { type: "drum", kind: "perc", volume: 0.3, delay: 0.2 },
    },
};

const GROUP_ROLE = { Keys: "keys", Lead: "lead", Pad: "pad", Bass: "bass", FX: "lead", Drums: "drum" };

// A copy of a preset, tagged with its name and the role it plays (melody, chords, bass…).
export function findPreset(name) {
    for (const [group, presets] of Object.entries(PRESETS)) {
        if (presets[name]) return { ...structuredClone(presets[name]), preset: name, role: GROUP_ROLE[group] };
    }
    return null;
}

export const TRACK_COLORS = ["#9b87ff", "#ff7aa8", "#4fd1c5", "#ffb547", "#6fb6ff", "#a3e05f", "#ff8a5c", "#e07bff", "#5ce0a0", "#ffd95c"];

const kit = (extra = {}) => ({
    Kick: { ...findPreset("Kick"), ...extra.kick },
    Snare: { ...findPreset("Snare"), ...extra.snare },
    "Hi-hat": { ...findPreset("Hi-hat"), ...extra.hat },
});

export const TEMPLATES = [
    {
        id: "blank", name: "Blank", description: "Piano, bass and drums",
        song: { bpm: 110, key: "C", scale: "major", instruments: { Piano: findPreset("Piano"), Bass: findPreset("Synth Bass"), ...kit() } },
    },
    {
        id: "chip", name: "Chiptune", description: "Retro game sounds, fast tempo",
        song: { bpm: 140, key: "E", scale: "minor", instruments: { Lead: findPreset("Chip Lead"), Bass: findPreset("Chip Bass"), ...kit({ kick: { pitch: 1.3, decay: 0.6 }, snare: { decay: 0.6 }, hat: { decay: 0.7 } }) } },
    },
    {
        id: "lofi", name: "Lo-fi", description: "Slow, swung and warm",
        song: { bpm: 78, swing: 0.35, key: "A", scale: "minor", instruments: { Keys: findPreset("Electric Piano"), Bass: findPreset("Sub Bass"), ...kit({ kick: { volume: 0.5 }, snare: { volume: 0.25, reverb: 0.2 }, hat: { volume: 0.12 } }) } },
    },
    {
        id: "ambient", name: "Ambient", description: "Pads and bells, no drums",
        song: { bpm: 70, key: "D", scale: "dorian", instruments: { Pad: findPreset("Glass Pad"), Bells: findPreset("Bell"), Bass: findPreset("Sub Bass") } },
    },
];

export function songFromTemplate(template) {
    const instruments = {};
    Object.entries(template.song.instruments).forEach(([name, inst], i) => {
        instruments[name] = { ...inst, color: TRACK_COLORS[i % TRACK_COLORS.length] };
    });
    return {
        format: "olid-song", version: 1, title: "Untitled", author: "", game: null,
        stepsPerBeat: 4, swing: 0, volume: 1, loopFrom: 0, ...template.song,
        instruments,
        patterns: { A: { steps: 32, tracks: {} } },
        arrangement: ["A"],
    };
}

export const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALES = {
    major: { name: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
    minor: { name: "Minor", steps: [0, 2, 3, 5, 7, 8, 10] },
    harmonic: { name: "Harmonic minor", steps: [0, 2, 3, 5, 7, 8, 11] },
    dorian: { name: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
    lydian: { name: "Lydian", steps: [0, 2, 4, 6, 7, 9, 11] },
    mixolydian: { name: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10] },
    phrygian: { name: "Phrygian", steps: [0, 1, 3, 5, 7, 8, 10] },
    pentatonic: { name: "Pentatonic", steps: [0, 2, 4, 7, 9] },
    minorPentatonic: { name: "Minor pentatonic", steps: [0, 3, 5, 7, 10] },
    blues: { name: "Blues", steps: [0, 3, 5, 6, 7, 10] },
    chromatic: { name: "Chromatic", steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

export function inScale(midi, key, scale) {
    const root = KEYS.indexOf(key);
    const steps = (SCALES[scale] ?? SCALES.chromatic).steps;
    return steps.includes((((midi - root) % 12) + 12) % 12);
}

// ---------- Easy mode helpers ----------

export const MOODS = [
    { scale: "major", name: "Happy" },
    { scale: "mixolydian", name: "Sunny" },
    { scale: "lydian", name: "Dreamy" },
    { scale: "dorian", name: "Cool" },
    { scale: "minor", name: "Sad" },
    { scale: "harmonic", name: "Spooky" },
];

const rel = (midi, key) => (((midi - KEYS.indexOf(key)) % 12) + 12) % 12;
const scaleSteps = (scale) => (SCALES[scale] ?? SCALES.major).steps;

// The five notes of a 7-note scale that never clash (its pentatonic). Other scales: all notes.
export function safeDegrees(scale) {
    const s = scaleSteps(scale);
    if (s.length !== 7) return s.map((_, i) => i);
    return s[2] === 4 ? [0, 1, 2, 4, 5] : [0, 2, 3, 4, 6];
}

export const degreeOf = (midi, key, scale) => scaleSteps(scale).indexOf(rel(midi, key));
export const isSafe = (midi, key, scale) => safeDegrees(scale).includes(degreeOf(midi, key, scale));

// Scale degree (0 = root, can go above 6 or below 0) near a reference octave -> MIDI.
export function degreeToMidi(degree, key, scale, base = 60) {
    const s = scaleSteps(scale);
    const n = s.length;
    const oct = Math.floor(degree / n);
    const root = base + ((KEYS.indexOf(key) - (base % 12) + 12) % 12) - (KEYS.indexOf(key) > (base % 12) + 5 ? 12 : 0);
    return root + oct * 12 + s[((degree % n) + n) % n];
}

// Move a note into another scale, keeping its place in the scale (3rd stays the 3rd...).
export function remapNote(midi, key, from, to) {
    const a = scaleSteps(from);
    const b = scaleSteps(to);
    const r = rel(midi, key);
    const base = midi - r;
    if (a.length === b.length) {
        let i = a.indexOf(r);
        if (i >= 0) return base + b[i];
        i = a.findLastIndex((x) => x < r);
        return base + b[Math.max(0, i)] + (r - a[Math.max(0, i)]);
    }
    let best = b[0];
    for (const x of [...b, 12]) if (Math.abs(x - r) < Math.abs(best - r)) best = x;
    return base + best;
}

// Pitch classes (relative to C) of the chord built on a scale degree.
export function chordPcs(degree, key, scale) {
    const s = scaleSteps(scale);
    const root = KEYS.indexOf(key);
    const picks = s.length === 7 ? [0, 2, 4] : [0];
    return picks.map((o) => (root + s[(degree + o) % s.length]) % 12);
}

// Guess how a track is used, for the generators and style swaps.
export function roleOf(name, inst) {
    if (inst.type === "drum") return "drum";
    if (inst.role) return inst.role;
    if (/bass/i.test(name) || inst.octave < 0) return "bass";
    if (inst.attack >= 0.25) return "pad";
    if (inst.sustain <= 0.3 && inst.decay >= 0.4) return "keys";
    return "lead";
}

export const ROLE_NAMES = { lead: "Melody", keys: "Keys", pad: "Chords", bass: "Bass", drum: "Drums" };

export const STYLES = [
    { id: "chip", name: "Chiptune", sounds: { lead: "Chip Lead", keys: "Chip Lead", pad: "Organ", bass: "Chip Bass" }, kit: "retro", swing: 0, bpm: 140 },
    { id: "lofi", name: "Lo-fi", sounds: { lead: "Soft Lead", keys: "Electric Piano", pad: "Warm Pad", bass: "Sub Bass" }, kit: "soft", swing: 0.3, bpm: 80 },
    { id: "dreamy", name: "Dreamy", sounds: { lead: "Bell", keys: "Music Box", pad: "Glass Pad", bass: "Sub Bass" }, kit: "soft", swing: 0, bpm: 76 },
    { id: "synth", name: "Synthwave", sounds: { lead: "Saw Lead", keys: "Pluck", pad: "Warm Pad", bass: "Synth Bass" }, kit: "big", swing: 0, bpm: 108 },
    { id: "fairy", name: "Fairytale", sounds: { lead: "Flute", keys: "Piano", pad: "Strings", bass: "Pluck Bass" }, kit: "classic", swing: 0, bpm: 96 },
];

const DRUM_PRESET = { kick: "Kick", snare: "Snare", clap: "Clap", hat: "Hi-hat", openhat: "Open Hat", tom: "Tom", perc: "Perc" };

export const KITS = {
    classic: { name: "Classic" },
    retro: { name: "Retro", all: { decay: 0.6 }, kick: { pitch: 1.3 }, snare: { pitch: 1.2 }, hat: { decay: 0.5 } },
    soft: { name: "Soft", all: { reverb: 0.15 }, kick: { volume: 0.45, decay: 0.8 }, snare: { volume: 0.22, decay: 0.8, pitch: 0.9 }, clap: { volume: 0.25 }, hat: { volume: 0.1 } },
    big: { name: "Big", all: { reverb: 0.35 }, kick: { pitch: 0.85, decay: 1.4, volume: 0.65 }, snare: { decay: 1.4, pitch: 0.85, volume: 0.45 }, clap: { decay: 1.3 } },
};

export function kitDrum(kitId, kind) {
    const kit = KITS[kitId] ?? KITS.classic;
    return { ...findPreset(DRUM_PRESET[kind] ?? "Kick"), ...kit.all, ...kit[kind], kit: kitId };
}

// 16-step drum beats. x = hit, o = soft hit.
export const BEATS = [
    { name: "Basic", kick: "x.......x.......", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." },
    { name: "Dance", kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x." },
    { name: "Hip-hop", kick: "x......x.x......", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.xo" },
    { name: "Slow", kick: "x.........x.....", snare: "........x.......", hat: "x...x...x...x..." },
    { name: "Shuffle", kick: "x.....x...x.....", snare: "....x.......x..o", hat: "x.ox.ox.ox.ox.o." },
    { name: "Gallop", kick: "x..x..x.x..x..x.", snare: "....x.......x...", hat: "x.xxx.xxx.xxx.xx" },
    { name: "Busy", kick: "x..x..x...x.x...", snare: "....x..o.o..x..o", hat: "xoxoxoxoxoxoxoxo", perc: "...x.......x...." },
    { name: "Marching", kick: "x.......x.......", snare: "x.oox.o.x.oox.oo", hat: "................" },
    { name: "No drums", kick: "", snare: "", hat: "" },
];

// Chord progressions as scale degrees (0 = I, 3 = IV, 4 = V, 5 = vi).
export const PROGRESSIONS = [[0, 5, 3, 4], [0, 4, 5, 3], [5, 3, 0, 4], [0, 3, 0, 4], [0, 3, 5, 4], [3, 4, 0, 0], [0, 0, 3, 3], [5, 4, 3, 4]];
