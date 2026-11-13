// Easy mode: the playful front of the Studio. Same songs, same player, simpler controls.
// Notes are limited to the song's key (and by default its "safe" notes), so nothing sounds wrong.

import {
    state, hooks, start, setUi, player, song, inst, pattern, trackNames, drumTracks, notesOf, edit, pushHistory,
    markChanged, renderAll, selectPattern, toast, manifest, setSong, uniqueName, nextColor, nextPatternName,
    patternColor, mySongs, confirmDiscard, openSongDialog, openUseInGameDialog, shareLink, exportWav, esc, ago,
    openHelp, openModal, closeModal, store, setMode, togglePlay,
} from "./maker.js";
import { normalizeSong, serializeSong, withDefaults, DRUM_KINDS, getGameSongOverride, setGameSong } from "./player.js";
import { encodeShare, decodeShare } from "./share.js";
import {
    PRESETS, findPreset, KEYS, SCALES, MOODS, STYLES, KITS, kitDrum, BEATS, PROGRESSIONS, safeDegrees, degreeOf,
    isSafe, degreeToMidi, remapNote, chordPcs, roleOf, ROLE_NAMES, inScale, TRACK_COLORS,
} from "./presets.js";

const $ = (s) => document.querySelector(s);
const GUTTER = 44;
const CHORD_BAND = 22;
const EASY_PREFS = "olid-music:easy";

const es = {
    safe: store.get(EASY_PREFS, {}).safe ?? true,
    beat: 0,
    center: {},      // per track: which notes are in view
    anim: new Map(), // note key -> time it popped
    layout: null,
    drag: null,
    touch: null,
    songRef: null,
};

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mod = (a, n) => ((a % n) + n) % n;

// ---------- Which track is on the grid ----------

const melodicTracks = () => trackNames().filter((n) => inst(n).type !== "drum");

function melodyTrack() {
    const sel = state.selTrack;
    if (sel && inst(sel) && inst(sel).type !== "drum") return sel;
    return melodicTracks()[0] ?? null;
}

const role = (name) => roleOf(name, inst(name));

function defaultCenter(track) {
    const notes = (pattern().tracks[track] ?? []).map((n) => n.note).sort((a, b) => a - b);
    if (notes.length) return notes[Math.floor(notes.length / 2)];
    return { bass: 48, pad: 62, keys: 64, lead: 67 }[role(track)] ?? 64;
}

function melodyRows(track) {
    if (!track) return [];
    const s = song();
    if (es.center[track] === undefined) es.center[track] = defaultCenter(track);
    const c = es.center[track];
    const used = new Set();
    let lo = c - 11, hi = c + 11;
    for (const p of [pattern()]) for (const n of p.tracks[track] ?? []) { used.add(n.note); lo = Math.min(lo, n.note); hi = Math.max(hi, n.note); }
    const rows = [];
    for (let m = clamp(hi, 24, 108); m >= clamp(lo, 24, 108); m--) {
        if (used.has(m) || (inScale(m, s.key, s.scale) && (!es.safe || isSafe(m, s.key, s.scale)))) rows.push(m);
    }
    return rows;
}

// ---------- Chords & generators ----------

const chordLen = (p) => (p.steps >= 64 ? 16 : 8);

const FLATS = { "C#": "D♭", "D#": "E♭", "F#": "G♭", "G#": "A♭", "A#": "B♭" };
function useFlats() {
    const s = song();
    const majorish = (SCALES[s.scale]?.steps ?? [])[2] === 4;
    return (majorish ? ["F", "A#", "D#", "G#", "C#"] : ["D", "G", "C", "F", "A#", "D#"]).includes(s.key);
}
const pcName = (pc) => (useFlats() ? FLATS[KEYS[pc]] ?? KEYS[pc] : KEYS[pc].replace("#", "♯"));
const keyName = () => pcName(KEYS.indexOf(song().key));

function chordName(deg, color = "") {
    const s = song();
    const pcs = chordPcs(deg, s.key, s.scale);
    if (pcs.length < 3) return pcName(pcs[0]);
    const third = mod(pcs[1] - pcs[0], 12);
    const fifth = mod(pcs[2] - pcs[0], 12);
    const q = third === 3 ? (fifth === 6 ? "dim" : "m") : fifth === 8 ? "+" : "";
    const name = pcName(pcs[0]);
    if (!color) return name + q;
    if (color === "sus2" || color === "sus4") return name + color;
    if (color === "add9") return name + (q === "m" ? "m(add9)" : "add9");
    // the seventh comes from the scale: a major seventh above a major chord is "maj7"
    const steps = (SCALES[s.scale] ?? SCALES.major).steps;
    const seventh = mod(steps[(deg + 6) % steps.length] - steps[deg % steps.length], 12);
    if (q === "m") return name + "m7";
    if (q === "dim") return name + "m7♭5";
    return name + (seventh === 11 ? "maj7" : "7");
}

function inferChords(p, n) {
    const len = p.steps / n;
    const out = [];
    let found = false;
    for (let i = 0; i < n; i++) {
        const a = i * len, b = a + len;
        let lowest = null;
        for (const [t, notes] of Object.entries(p.tracks)) {
            const ins = inst(t);
            if (!ins || ins.type === "drum" || !["bass", "pad"].includes(role(t))) continue;
            for (const nt of notes) if (nt.step < b && nt.step + nt.length > a && (lowest === null || nt.note < lowest)) lowest = nt.note;
        }
        const d = lowest === null ? -1 : degreeOf(lowest, song().key, song().scale);
        if (d >= 0) found = true;
        out.push(d >= 0 ? d : out[i - 1] ?? 0);
    }
    return found ? out : null;
}

function ensureChords(p, fresh = false) {
    const n = Math.max(1, Math.floor(p.steps / chordLen(p)));
    if (!fresh && p.chords?.length === n) return p.chords;
    if (!fresh) {
        const inferred = inferChords(p, n);
        if (inferred) return (p.chords = inferred);
    }
    let prog = rnd(PROGRESSIONS);
    if (fresh && p.chords) for (let i = 0; i < 5 && prog.join() === p.chords.slice(0, 4).join(); i++) prog = rnd(PROGRESSIONS);
    p.chords = Array.from({ length: n }, (_, i) => prog[i % prog.length]);
    return p.chords;
}

const hitsOf = (rhythm, len) => [...rhythm.repeat(Math.ceil(len / rhythm.length)).slice(0, len)].flatMap((c, i) => (c === "x" ? [i] : []));

function fillLengths(hits, segEnd, max) {
    return hits.map((h, i) => Math.max(1, Math.min(max, (hits[i + 1] ?? segEnd) - h)));
}

function genBass(p) {
    const s = song();
    const chords = ensureChords(p);
    const len = chordLen(p);
    const rhythm = rnd(["x...x...", "x..x..x.", "x.....x.", "x.x...x.", "x.......", "x..x.x.."]);
    const out = [];
    chords.forEach((deg, i) => {
        const start = i * len;
        const hits = hitsOf(rhythm, len);
        const lens = fillLengths(hits, len, 4);
        hits.forEach((h, k) => {
            const fifth = k === hits.length - 1 && hits.length > 2 && Math.random() < 0.4;
            out.push({ step: start + h, note: degreeToMidi(deg + (fifth ? 4 : 0), s.key, s.scale, 48), length: lens[k], velocity: k === 0 ? 1 : 0.85 });
        });
    });
    return out;
}

// Chord notes in the key. A colour adds or swaps a note: 7 adds the seventh, add9 the ninth,
// sus2/sus4 swap the third for the second or fourth.
const COLOR_PICKS = { "": [0, 2, 4], "7": [0, 2, 4, 6], add9: [0, 2, 4, 8], sus2: [0, 1, 4], sus4: [0, 3, 4] };
function chordTones(deg, base = 60, color = "") {
    const s = song();
    const n = SCALES[s.scale]?.steps.length ?? 7;
    const picks = n === 7 ? COLOR_PICKS[color] ?? COLOR_PICKS[""] : [0, 1, 2];
    const root = degreeToMidi(deg, s.key, s.scale, base);
    let r = root;
    while (r > base + 12) r -= 12;
    return picks.map((o) => {
        let m = degreeToMidi(deg + o, s.key, s.scale, base);
        while (m > r + 14) m -= 12;
        while (m < r) m += 12;
        return m;
    });
}

function genPad(p) {
    const chords = ensureChords(p);
    const len = chordLen(p);
    return chords.flatMap((deg, i) => chordTones(deg, 60, p.colors?.[i] || "").map((note) => ({ step: i * len, note, length: len, velocity: 0.8 })));
}

function genKeys(p) {
    const chords = ensureChords(p);
    const len = chordLen(p);
    const shape = rnd([[0, 1, 2, 1], [0, 1, 2, 3], [0, 2, 1, 2], [2, 1, 0, 1]]);
    const out = [];
    chords.forEach((deg, i) => {
        const tones = chordTones(deg, 62);
        tones.push(tones[0] + 12);
        for (let k = 0; k < len / 2; k++) out.push({ step: i * len + k * 2, note: tones[shape[k % 4]], length: 2, velocity: k % 2 ? 0.7 : 0.9 });
    });
    return out;
}

function genMelody(p) {
    const s = song();
    const chords = ensureChords(p);
    const len = chordLen(p);
    const n = SCALES[s.scale]?.steps.length ?? 7;
    const safe = safeDegrees(s.scale);
    const RHYTHMS = ["x.x.x...", "x...x.x.", "x.xx..x.", "x.......", "..x.x.x.", "x.x...x.", "xx..x...", "x..x..x.", "x.x.x.x."];
    const a = rnd(RHYTHMS), b = rnd(RHYTHMS);
    const form = rnd([[a, a, b, a], [a, b, a, b], [a, a, a, b], [a, b, b, a]]);
    let cur = rnd([0, 2, 4]);
    const out = [];
    chords.forEach((deg, i) => {
        const r = len === 16 ? form[i % 4] + form[(i + 1) % 4] : form[i % 4];
        const hits = hitsOf(r, len);
        const lens = fillLengths(hits, len, 4);
        const chordDegs = [deg, deg + 2, deg + 4].map((d) => mod(d, n));
        hits.forEach((h, k) => {
            if (k === 0) {
                let best = cur, dist = 99;
                for (let d = cur - 3; d <= cur + 3; d++) if (chordDegs.includes(mod(d, n)) && Math.abs(d - cur) < dist) { best = d; dist = Math.abs(d - cur); }
                cur = best;
            } else {
                const step = rnd([-2, -1, -1, 1, 1, 2, 0]);
                let d = cur + step;
                for (let guard = 0; guard < 4 && !safe.includes(mod(d, n)); guard++) d += step >= 0 ? 1 : -1;
                cur = d;
            }
            cur = clamp(cur, -2, n + 2);
            out.push({ step: i * len + h, note: degreeToMidi(cur, s.key, s.scale, 64), length: lens[k], velocity: k === 0 ? 1 : 0.85 });
        });
    });
    // End the loop on a chord note so it feels finished.
    const last = out[out.length - 1];
    if (last) {
        const deg = chords[chords.length - 1];
        last.note = degreeToMidi(mod(cur, n) === mod(deg + 2, n) ? cur : deg, s.key, s.scale, 64);
        last.length = Math.max(last.length, p.steps - last.step);
    }
    return out;
}

const GENERATORS = { lead: genMelody, keys: genKeys, pad: genPad, bass: genBass };
const GEN_LABEL = { lead: "Make a melody", keys: "Make a pattern", pad: "Make chords", bass: "Make a bassline" };

function generateFor(track) {
    const r = role(track);
    const gen = GENERATORS[r] ?? genMelody;
    edit(() => { pattern().tracks[track] = gen(pattern()); });
    es.center[track] = defaultCenter(track);
    popAll(track);
    renderAll();
}

function newChords() {
    const p = pattern();
    edit(() => {
        ensureChords(p, true);
        delete p.colors;
        for (const t of melodicTracks()) {
            const r = role(t);
            const had = (p.tracks[t] ?? []).length > 0;
            if (r === "pad" || r === "bass" || (r === "keys" && had)) p.tracks[t] = GENERATORS[r](p);
        }
    });
    toast(p.chords.slice(0, 4).map((d) => chordName(d)).join("  →  "));
    popAll();
}

function applyBeat(beat) {
    edit(() => {
        if (!drumTracks().length && beat.kick) addKit("classic");
        const p = pattern();
        for (const t of drumTracks()) {
            const kind = inst(t).kind;
            const line = { kick: beat.kick, snare: beat.snare, clap: beat.snare, hat: beat.hat, openhat: beat.open, tom: beat.perc, perc: beat.perc }[kind] ?? "";
            const hits = [];
            if (line) for (let s = 0; s < p.steps; s++) {
                const c = line[s % 16];
                if (c === "x" || c === "o") hits.push({ step: s, note: null, length: 1, velocity: c === "x" ? 1 : 0.55 });
            }
            p.tracks[t] = hits;
        }
    });
    popAll();
}

function addKit(kitId) {
    for (const kind of ["kick", "snare", "hat"]) {
        const name = uniqueName({ kick: "Kick", snare: "Snare", hat: "Hi-hat" }[kind], trackNames());
        song().instruments[name] = withDefaults({ ...kitDrum(kitId, kind), color: nextColor() });
    }
}

// ---------- Vibe ----------

function setMood(scale) {
    const s = song();
    if (s.scale === scale) return;
    edit(() => {
        for (const p of Object.values(s.patterns)) {
            for (const [t, notes] of Object.entries(p.tracks)) {
                if (inst(t)?.type === "drum") continue;
                for (const n of notes) n.note = remapNote(n.note, s.key, s.scale, scale);
            }
        }
        s.scale = scale;
    });
    es.center = {};
}

function setStyle(style) {
    const s = song();
    edit(() => {
        for (const name of trackNames()) {
            const old = inst(name);
            if (old.type === "drum") {
                s.instruments[name] = withDefaults({ ...kitDrum(style.kit, old.kind), color: old.color });
            } else {
                const r = role(name);
                s.instruments[name] = withDefaults({ ...findPreset(style.sounds[r] ?? style.sounds.lead), role: r, color: old.color });
            }
        }
        s.swing = style.swing;
        s.style = style.id;
    });
}

function transpose(semis) {
    const s = song();
    const k = mod(KEYS.indexOf(s.key) + semis, 12);
    edit(() => {
        for (const p of Object.values(s.patterns)) for (const [t, notes] of Object.entries(p.tracks)) {
            if (inst(t)?.type === "drum") continue;
            for (const n of notes) n.note += semis;
        }
        s.key = KEYS[k];
    });
    for (const t of Object.keys(es.center)) es.center[t] += semis;
}

// ---------- Rendering ----------

function render() {
    if (es.songRef !== state.song) { es.songRef = state.song; es.center = {}; }
    const s = song();
    if (document.activeElement !== $("#eTitle")) $("#eTitle").value = s.title;
    $("#eSpeed").value = s.bpm;
    $("#eSpeedOut").textContent = s.bpm;
    renderBand();
    renderTools();
    renderParts();
    renderJam();
    renderChordsView();
    draw();
    renderViews();
}

function renderTools() {
    const t = melodyTrack();
    const gen = $("#eGen");
    gen.disabled = !t;
    gen.innerHTML = `<span class="spark">✦</span> ${t ? GEN_LABEL[role(t)] ?? "Make a melody" : "Make a melody"}`;
    gen.title = t ? `Write something for ${t} in this part (press again for another idea)` : "";
    $("#eBeat").innerHTML = `Beat: <b>${esc(BEATS[es.beat].name)}</b> <span class="cycle">↻</span>`;
    $("#eSafe").classList.toggle("on", es.safe);
    const mood = MOODS.find((m) => m.scale === song().scale);
    const style = STYLES.find((x) => x.id === song().style);
    $("#eHint").textContent = matchMedia("(pointer: coarse)").matches
        ? "Tap a square to add a note, tap it again to remove it. Tap a chord name to change it. Swipe sideways for more."
        : "Click squares to add notes, drag to make them longer, click a note to remove it. Click a chord name to change it.";
}

function renderParts() {
    const box = $("#eParts");
    box.innerHTML = "";
    const arr = song().arrangement;
    arr.forEach((name, idx) => {
        const card = document.createElement("div");
        const playingHere = player.playing && state.mode === "song" && state.playPos?.index === idx;
        const blockOk = arr[state.selBlock] === state.selPattern;
        const isSel = blockOk ? idx === state.selBlock : name === state.selPattern && arr.indexOf(name) === idx;
        card.className = `e-part${isSel ? " sel" : ""}${playingHere ? " now" : ""}`;
        card.dataset.index = idx;
        card.draggable = true;
        card.style.setProperty("--c", patternColor(name));
        card.innerHTML = `<span class="e-part-label">Part ${esc(name)}</span><button class="e-part-x" title="Remove this part">×</button><canvas></canvas>`;
        card.onclick = (e) => {
            if (e.target.closest("button")) return;
            state.selBlock = idx;
            if (player.playing && state.mode === "song") player.seek(idx);
            selectPattern(name);
            es.center = {};
            es.page = 0;
            render();
        };
        card.querySelector(".e-part-x").onclick = () => removePart(idx);
        card.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", String(idx)));
        card.addEventListener("dragover", (e) => { e.preventDefault(); card.classList.add("drag-over"); });
        card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
        card.addEventListener("drop", (e) => {
            e.preventDefault();
            const from = Number(e.dataTransfer.getData("text/plain"));
            if (Number.isNaN(from) || from === idx) return renderParts();
            edit(() => { const [m] = arr.splice(from, 1); arr.splice(idx, 0, m); });
        });
        box.append(card);
        miniDraw(card.querySelector("canvas"), song().patterns[name]);
    });
    const add = document.createElement("button");
    add.className = "e-part add";
    add.innerHTML = "<b>+</b><span>Add a part</span>";
    add.title = "Adds a copy of the part you're editing, ready to change";
    add.onclick = addPart;
    box.append(add);
}

function miniDraw(canvas, p) {
    const dpr = devicePixelRatio || 1;
    const w = canvas.clientWidth || 90, h = canvas.clientHeight || 34;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const c = canvas.getContext("2d");
    c.scale(dpr, dpr);
    let lo = 127, hi = 0;
    for (const [t, ns] of Object.entries(p.tracks)) if (inst(t)?.type !== "drum") for (const n of ns) { lo = Math.min(lo, n.note); hi = Math.max(hi, n.note); }
    const span = Math.max(12, hi - lo + 1), sx = w / p.steps;
    for (const [t, ns] of Object.entries(p.tracks)) {
        const i = inst(t);
        if (!i) continue;
        c.fillStyle = i.color;
        for (const n of ns) {
            if (i.type === "drum") { c.globalAlpha = 0.45; c.fillRect(n.step * sx, h - 4, Math.max(1, sx - 1), 4); }
            else { c.globalAlpha = 0.9; c.fillRect(n.step * sx, (h - 8) * (1 - (n.note - lo + 0.5) / span), Math.max(2, n.length * sx - 1), 2.5); }
        }
    }
}

function addPart() {
    const name = nextPatternName();
    edit(() => {
        song().patterns[name] = structuredClone(pattern());
        song().arrangement.push(name);
        state.selPattern = name;
        state.selBlock = song().arrangement.length - 1;
    });
    es.page = 0;
    if (player.playing && state.mode === "pattern") player.setPattern(name);
    requestAnimationFrame(() => { const b = $("#eParts"); b.scrollLeft = b.scrollWidth; });
    toast(`Part ${name} added. It's a copy, so change it however you like`);
}

function removePart(idx) {
    const s = song();
    if (s.arrangement.length <= 1) return toast("A song needs at least one part");
    edit(() => {
        const [name] = s.arrangement.splice(idx, 1);
        if (!s.arrangement.includes(name) && Object.keys(s.patterns).length > 1) delete s.patterns[name];
        if (s.loopFrom >= s.arrangement.length) s.loopFrom = s.arrangement.length - 1;
        else if (idx < s.loopFrom) s.loopFrom--;
        if (!s.patterns[state.selPattern]) state.selPattern = s.arrangement[Math.max(0, idx - 1)];
        state.selBlock = Math.min(state.selBlock, s.arrangement.length - 1);
    });
    if (player.playing && state.mode === "pattern") player.setPattern(state.selPattern);
}

// ---------- Popovers ----------

const pop = $("#ePop");
function openPop(anchor, html) {
    pop.classList.remove("journey");
    pop.innerHTML = html;
    pop.hidden = false;
    const sheet = innerWidth < 600;
    pop.classList.toggle("sheet", sheet);
    if (sheet) { pop.style.left = pop.style.top = ""; return; }
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = clamp(r.left, 8, innerWidth - w - 8);
    let top = r.bottom + 6;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
}
const closePop = () => (pop.hidden = true);
document.addEventListener("pointerdown", (e) => {
    if (pop.hidden || e.target.closest("#ePop, [data-pop]")) return;
    if (e.target === canvas && chordHit(e)) return; // the chord strip opens its own picker
    if (e.target.id === "eDraw" && es.dlayout && e.offsetY < es.dlayout.top) return;
    closePop();
});

function presetButtons(current) {
    return Object.entries(PRESETS).filter(([g]) => g !== "Drums").map(([group, presets]) => `
        <div class="pop-group">${esc(group === "Pad" ? "Chords & pads" : group)}</div>
        <div class="pop-grid">${Object.keys(presets).map((p) => `<button data-preset="${esc(p)}" class="${p === current ? "on" : ""}">${esc(p)}</button>`).join("")}</div>`).join("");
}

function soundMenu(anchor, name) {
    const i = inst(name);
    openPop(anchor, `<div class="pop-title">Sound for ${esc(name)}</div>${presetButtons(i.preset)}
        <div class="pop-foot"><button class="btn ghost small-btn danger" data-remove>Remove ${esc(name)}</button></div>`);
    pop.querySelectorAll("[data-preset]").forEach((b) => (b.onclick = () => {
        const p = findPreset(b.dataset.preset);
        edit(() => { song().instruments[name] = withDefaults({ ...p, color: i.color }); });
        player.preview(song(), name, defaultCenter(name), 4);
        pop.querySelectorAll("[data-preset]").forEach((x) => x.classList.toggle("on", x === b));
    }));
    pop.querySelector("[data-remove]").onclick = () => {
        closePop();
        if (trackNames().length <= 1) return toast("A song needs at least one instrument");
        edit(() => {
            delete song().instruments[name];
            for (const p of Object.values(song().patterns)) delete p.tracks[name];
            state.selTrack = melodicTracks()[0] ?? trackNames()[0];
        });
    };
}

const DRUM_LABEL = { kick: "Kick", snare: "Snare", clap: "Clap", hat: "Hi-hat", openhat: "Open hat", tom: "Tom", perc: "Perc" };
const DRUM_TRACK_NAME = { kick: "Kick", snare: "Snare", clap: "Clap", hat: "Hi-hat", openhat: "Open Hat", tom: "Tom", perc: "Perc" };

// Rename a track everywhere it's used (instrument list keeps its order).
function renameTrackDirect(oldName, newName) {
    const s = song();
    const rebuilt = {};
    for (const [n, i] of Object.entries(s.instruments)) rebuilt[n === oldName ? newName : n] = i;
    s.instruments = rebuilt;
    for (const p of Object.values(s.patterns)) if (p.tracks[oldName]) { p.tracks[newName] = p.tracks[oldName]; delete p.tracks[oldName]; }
    for (const set of [state.mix.muted, state.mix.soloed]) if (set.delete(oldName)) set.add(newName);
    if (state.selTrack === oldName) state.selTrack = newName;
}

// One history step per slider drag.
function sliderHistory(input) {
    let pushed = false;
    const begin = () => { if (!pushed) { pushHistory(); pushed = true; } };
    input.addEventListener("pointerdown", begin);
    input.addEventListener("keydown", begin);
    input.addEventListener("change", () => { pushed = false; markChanged(); });
    return begin;
}

function kitHTML() {
    const drums = drumTracks();
    const current = inst(drums[0])?.kit;
    const room = drums.length ? drums.reduce((a, t) => a + (inst(t).reverb ?? 0), 0) / drums.length : 0;
    const range = (k, label, min, max, step, v, lo, hi) => `<label class="drum-slider"><span>${label}</span><small>${lo}</small><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}"><small>${hi}</small></label>`;
    return `<div class="pop-title">Drum kit</div>
        <div class="pop-sub">Pick a kit to start from, then tune each drum.</div>
        <div class="pop-grid">${Object.entries(KITS).map(([id, k]) => `<button data-kit="${id}" class="${id === current ? "on" : ""}">${esc(k.name)}</button>`).join("")}</div>
        ${drums.length ? `<label class="drum-slider room"><span>Room</span><small>Dry</small><input type="range" id="kitRoom" min="0" max="0.8" step="0.01" value="${room.toFixed(2)}"><small>Echoey</small></label>` : ""}
        <div class="drum-rows">${drums.map((t) => {
            const i = inst(t);
            return `<div class="drum-row" data-t="${esc(t)}" style="--c:${i.color}">
                <div class="drum-row-head"><button class="drum-hear" title="Hear it">▶</button><b>${esc(t)}</b>
                  <select class="drum-kind" aria-label="Drum type">${DRUM_KINDS.map((k) => `<option value="${k}"${k === i.kind ? " selected" : ""}>${DRUM_LABEL[k]}</option>`).join("")}</select>
                  <button class="drum-x" title="Remove ${esc(t)}">×</button></div>
                ${range("pitch", "Pitch", 0.5, 2, 0.01, i.pitch, "Low", "High")}
                ${range("decay", "Length", 0.2, 3, 0.01, i.decay, "Short", "Long")}
                ${range("gain", "Volume", 0, 1.5, 0.01, i.gain ?? 1, "", "")}
            </div>`;
        }).join("")}</div>
        <div class="pop-title">Add a drum</div>
        <div class="pop-grid">${DRUM_KINDS.map((k) => `<button data-add="${k}">+ ${DRUM_LABEL[k]}</button>`).join("")}</div>
        ${drums.length ? `<div class="pop-foot"><button class="btn ghost small-btn danger" data-remove>Remove all drums</button></div>` : ""}`;
}

function kitMenu(anchor) {
    openPop(anchor, kitHTML());
    wireKit();
}

function refreshKit() {
    if (pop.hidden) return;
    const top = pop.scrollTop;
    pop.innerHTML = kitHTML();
    pop.scrollTop = top;
    wireKit();
}

function wireKit() {
    const hear = (t) => { player.preview(song(), t, 60, 1); sing(t, { note: null }, 0.2); };
    pop.querySelectorAll("[data-kit]").forEach((b) => (b.onclick = () => {
        edit(() => {
            for (const t of drumTracks()) {
                const old = inst(t);
                song().instruments[t] = withDefaults({ ...kitDrum(b.dataset.kit, old.kind), color: old.color, gain: old.gain });
            }
        });
        if (drumTracks()[0]) hear(drumTracks()[0]);
        refreshKit();
    }));
    const room = pop.querySelector("#kitRoom");
    if (room) {
        sliderHistory(room);
        room.addEventListener("input", () => { for (const t of drumTracks()) inst(t).reverb = Number(room.value); });
        room.addEventListener("change", () => hear(drumTracks().find((t) => inst(t).kind === "snare" || inst(t).kind === "clap") ?? drumTracks()[0]));
    }
    pop.querySelectorAll(".drum-row").forEach((row) => {
        const t = row.dataset.t;
        row.querySelector(".drum-hear").onclick = () => hear(t);
        row.querySelectorAll("input[data-k]").forEach((input) => {
            sliderHistory(input);
            input.addEventListener("input", () => {
                inst(t)[input.dataset.k] = Number(input.value);
                if (input.dataset.k === "gain") { player.setMix(state.mix); syncFaders(); }
            });
            input.addEventListener("change", () => hear(t));
        });
        row.querySelector(".drum-kind").onchange = (e) => {
            const kind = e.target.value;
            const old = inst(t);
            edit(() => {
                old.kind = kind;
                // a drum still called by its old type's name gets the new type's name
                if (/^(Kick|Snare|Clap|Hi-hat|Open Hat|Tom|Perc)( \d+)?$/.test(t)) {
                    renameTrackDirect(t, uniqueName(DRUM_TRACK_NAME[kind], trackNames().filter((x) => x !== t)));
                }
            });
            const renamed = drumTracks().find((x) => inst(x) === old);
            if (renamed) hear(renamed);
            refreshKit();
        };
        row.querySelector(".drum-x").onclick = () => {
            edit(() => {
                delete song().instruments[t];
                for (const p of Object.values(song().patterns)) delete p.tracks[t];
                state.mix.muted.delete(t);
                state.mix.soloed.delete(t);
            });
            if (!drumTracks().length) closePop(); else refreshKit();
        };
    });
    pop.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => {
        const kind = b.dataset.add;
        const kit = inst(drumTracks()[0])?.kit ?? "classic";
        const name = uniqueName(DRUM_TRACK_NAME[kind], trackNames());
        edit(() => { song().instruments[name] = withDefaults({ ...kitDrum(kit, kind), color: nextColor() }); });
        hear(name);
        refreshKit();
        pop.scrollTop = pop.scrollHeight;
    }));
    pop.querySelector("[data-remove]")?.addEventListener("click", () => {
        if (!melodicTracks().length) return toast("A song needs at least one instrument");
        closePop();
        edit(() => {
            for (const t of drumTracks()) {
                delete song().instruments[t];
                for (const p of Object.values(song().patterns)) delete p.tracks[t];
            }
        });
    });
}

function addMenu(anchor) {
    const hasDrums = drumTracks().length > 0;
    openPop(anchor, `<div class="pop-title">Add an instrument</div>
        ${hasDrums ? "" : `<div class="pop-grid"><button data-drums>Drums</button></div>`}
        ${presetButtons(null)}`);
    pop.querySelectorAll("[data-preset]").forEach((b) => (b.onclick = () => {
        const p = findPreset(b.dataset.preset);
        const name = uniqueName(ROLE_NAMES[p.role] ?? b.dataset.preset, trackNames());
        edit(() => {
            song().instruments[name] = withDefaults({ ...p, color: nextColor() });
            state.selTrack = name;
        });
        player.preview(song(), name, defaultCenter(name), 4);
        closePop();
    }));
    pop.querySelector("[data-drums]")?.addEventListener("click", () => {
        edit(() => addKit("classic"));
        closePop();
        toast("Drums added. Press Beat to get one going");
    });
}

function vibeMenu(anchor) {
    const s = song();
    openPop(anchor, `<div class="pop-title">Mood</div>
        <div class="pop-sub">Moves every note to a new scale, so the same tune feels different.</div>
        <div class="pop-grid moods">${MOODS.map((m) => `<button data-mood="${m.scale}" class="${m.scale === s.scale ? "on" : ""}">${m.name}</button>`).join("")}</div>
        <div class="pop-title">Style</div>
        <div class="pop-sub">Swaps every instrument for a matching set.</div>
        <div class="pop-grid styles">${STYLES.map((x) => `<button data-style="${x.id}" class="${x.id === s.style ? "on" : ""}">${x.name}</button>`).join("")}</div>
        <div class="pop-title">Speed</div>
        <div class="pop-row"><span class="pop-sub" style="margin:0">Slow</span><input type="range" id="popSpeed" min="50" max="180" step="1" value="${s.bpm}" style="flex:1"><span class="pop-sub" style="margin:0">Fast</span><output id="popSpeedOut" class="pop-key" style="flex:none;width:34px">${s.bpm}</output></div>
        <div class="pop-title">Pitch</div>
        <div class="pop-row"><button data-tr="-1" class="btn ghost small-btn">Lower</button><span class="pop-key">Key of ${esc(keyName())}</span><button data-tr="1" class="btn ghost small-btn">Higher</button></div>`);
    pop.querySelectorAll("[data-mood]").forEach((b) => (b.onclick = () => {
        setMood(b.dataset.mood);
        pop.querySelectorAll("[data-mood]").forEach((x) => x.classList.toggle("on", x === b));
        if (!player.playing) previewChord();
    }));
    pop.querySelectorAll("[data-style]").forEach((b) => (b.onclick = () => {
        setStyle(STYLES.find((x) => x.id === b.dataset.style));
        pop.querySelectorAll("[data-style]").forEach((x) => x.classList.toggle("on", x === b));
        if (!player.playing) previewChord();
    }));
    const sp = pop.querySelector("#popSpeed");
    sp.addEventListener("pointerdown", () => pushHistory());
    sp.addEventListener("input", () => {
        song().bpm = Number(sp.value);
        pop.querySelector("#popSpeedOut").textContent = sp.value;
        $("#eSpeed").value = sp.value;
        $("#eSpeedOut").textContent = sp.value;
    });
    sp.addEventListener("change", markChanged);
    pop.querySelectorAll("[data-tr]").forEach((b) => (b.onclick = () => {
        transpose(Number(b.dataset.tr));
        pop.querySelector(".pop-key").textContent = `Key of ${keyName()}`;
        if (!player.playing) previewChord();
    }));
}

function previewChord() {
    const t = melodyTrack();
    if (!t) return;
    const s = song();
    for (const d of [0, 2, 4]) player.preview(s, t, degreeToMidi(d, s.key, s.scale, 62), 6, 0.7);
}

function moreMenu(anchor) {
    openPop(anchor, `<div class="pop-list">
        <button data-a="home">Studio home</button>
        <button data-a="open">Open a song…</button>
        <button data-a="share">Copy share link</button>
        <button data-a="game">Use in a game…</button>
        <button data-a="wav">Export .wav</button>
        <button data-a="help">How it works</button>
        <button data-a="pro" class="phone-only">Switch to Pro editor</button></div>`);
    pop.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => {
        closePop();
        ({ home: showLanding, open: () => openSongDialog(), share: shareLink, game: openUseInGameDialog, wav: exportWav, help: easyHelp, pro: () => setUi("pro") })[b.dataset.a]();
    }));
}

function easyHelp() {
    openModal(`<h2>How it works</h2>
        <div class="help-grid">
          <b>Squares</b><span>Each row is a note, each column a moment in time. Click to place a note; higher rows are higher notes. Only notes that fit the song are shown, so nothing sounds wrong.</span>
          <b>Instruments</b><span>The chips along the top. Pick one to write its notes; the others show as faint outlines. "Sound" swaps how it sounds.</span>
          <b>✦ Make</b><span>Writes something for the selected instrument that fits the chords. Press again for another idea, or undo.</span>
          <b>Parts</b><span>A song is a row of parts. Add a part to copy the one you're on, then change it to make a chorus or a bridge.</span>
          <b>Vibe</b><span>Mood changes the scale (happy, sad, spooky…), Style swaps all the sounds. Great for remixing a game song.</span>
          <b>Pro</b><span>The full editor, for exact control. Same song, so you can switch back and forth.</span>
          <span class="kbd">Space</span><span>Play / stop</span>
        </div>`);
}

// ---------- Choosing chords: the chord journey ----------
// Every chord in a key has a feeling and a level of tension. The journey draws a part's chords as a
// story arc: calm Home at the bottom, tension at the top. Drag a chord up or down to change it.

const chordCount = (p) => Math.max(1, Math.floor(p.steps / chordLen(p)));

// The chords to show: the part's own, or a guess from its bass and chords if it doesn't have any yet.
function displayChords(p) {
    const n = chordCount(p);
    if (p.chords?.length === n) return p.chords;
    return inferChords(p, n);
}
const colorAt = (p, i) => (p.colors?.[i]) || "";

const isMajorish = () => ((SCALES[song().scale] ?? SCALES.major).steps[2] === 4);
const sevenNotes = () => ((SCALES[song().scale] ?? SCALES.major).steps.length === 7);

function quality(deg) {
    const s = song();
    const pcs = chordPcs(deg, s.key, s.scale);
    if (pcs.length < 3) return "";
    const third = mod(pcs[1] - pcs[0], 12);
    const fifth = mod(pcs[2] - pcs[0], 12);
    return third === 3 ? (fifth === 6 ? "dim" : "m") : fifth === 8 ? "+" : "";
}

// Feelings by the chord's job in the key. The tint groups them: home, moving away, tension, moody, bold.
const TINT = { home: "#6fb6ff", away: "#5ce0a0", tension: "#ffb547", moody: "#b9aaff", bold: "#ff8fb3" };
const FEEL = {
    "maj:0:": ["Home", "Settled and at rest. Songs love to end here.", "home", 0],
    "maj:1:m": ["On the move", "Gently leads somewhere, often to the tension chord.", "away", 0.6],
    "maj:1:": ["Floating", "Bright and weightless, the sound of wonder.", "bold", 0.55],
    "maj:2:m": ["Dreamy", "Hazy and in-between, a soft shadow of home.", "moody", 0.28],
    "maj:3:": ["Lift", "Warm and opening up, like stepping outside.", "away", 0.45],
    "maj:4:": ["Tension", "Leans forward and wants to go back home.", "tension", 1],
    "maj:4:m": ["Easygoing", "A relaxed pull, softer than real tension.", "tension", 0.72],
    "maj:5:m": ["Bittersweet", "Sad but gentle, home's moody twin.", "moody", 0.36],
    "maj:6:": ["Bold", "Big and heroic, with a bit of swagger.", "bold", 0.66],
    "min:0:m": ["Home, but sad", "Where a minor song rests. Serious and a little lonely.", "home", 0],
    "min:1:": ["Mysterious", "Dark and dramatic, like somewhere far away.", "bold", 0.82],
    "min:1:m": ["Searching", "Restless and curious, still looking.", "away", 0.6],
    "min:2:": ["Relief", "A burst of light, the sun breaking through.", "bold", 0.3],
    "min:3:m": ["Longing", "Sorrowful and yearning.", "away", 0.5],
    "min:3:": ["Hopeful", "A ray of warmth inside a minor song.", "away", 0.46],
    "min:4:m": ["Drifting", "Soft, unresolved tension.", "tension", 0.7],
    "min:4:": ["Drama", "A strong pull back home. Very cinematic.", "tension", 1],
    "min:5:": ["Epic", "Wide and hopeful, a big-screen moment.", "moody", 0.38],
    "min:6:": ["Driving", "Pushes forward, heroic and determined.", "bold", 0.64],
    "min:6:m": ["Brooding", "Dark and heavy, circling home.", "tension", 0.74],
};
function feeling(deg) {
    const key = `${isMajorish() ? "maj" : "min"}:${deg}:${quality(deg)}`;
    const f = FEEL[key] ?? (deg === 0 ? ["Home", "Where this song rests.", "home", 0] : ["Colourful", "An unusual flavour for this key.", "moody", 0.5 + deg * 0.04]);
    return { word: f[0], line: f[1], tint: TINT[f[2]], group: f[2], tension: f[3] };
}

// Extensions ("colours") and what they do to a chord.
const COLORS = [
    { id: "", name: "Plain", feel: "as it is" },
    { id: "7", name: "7", feel: "smooth, jazzy" },
    { id: "sus2", name: "sus2", feel: "open, airy" },
    { id: "sus4", name: "sus4", feel: "floating, unresolved" },
    { id: "add9", name: "add9", feel: "sparkly, dreamy" },
];

// Chords that fit the key, friendliest first (no tense diminished ones).
function chordChoices() {
    const n = (SCALES[song().scale] ?? SCALES.major).steps.length;
    const order = n === 7 ? [0, 3, 4, 5, 1, 2, 6] : [...Array(n).keys()];
    return order.filter((d) => !/^(dim|\+)$/.test(quality(d)));
}

// Move the Chords, Bass and Keys notes in one stretch of the part to a new chord,
// keeping their shape (a root stays a root, a third stays a third).
function shiftSegment(p, a, b, oldDeg, newDeg) {
    const s = song();
    const steps = (SCALES[s.scale] ?? SCALES.major).steps;
    const n = steps.length;
    const root = KEYS.indexOf(s.key);
    let shift = newDeg - oldDeg;
    while (shift > n / 2) shift -= n;
    while (shift < -n / 2) shift += n;
    const abs = (m) => {
        const r = mod(m - root, 12);
        const i = steps.indexOf(r);
        return i < 0 ? null : Math.round((m - root - r) / 12) * n + i;
    };
    const toMidi = (i) => root + Math.floor(i / n) * 12 + steps[mod(i, n)];
    for (const [t, notes] of Object.entries(p.tracks)) {
        if (inst(t)?.type === "drum" || !["pad", "bass", "keys"].includes(role(t))) continue;
        for (const nt of notes) {
            if (nt.step < a || nt.step >= b) continue;
            const i = abs(nt.note);
            if (i !== null) nt.note = toMidi(i + shift);
        }
    }
}

// The Chords player plays exactly the chord (with its colour) in that stretch.
function voicePad(p, seg, len) {
    const padTrack = melodicTracks().find((t) => role(t) === "pad");
    if (!padTrack) return;
    const list = notesOf(padTrack);
    const a = seg * len, b = a + len;
    const inSeg = list.filter((nt) => nt.step >= a && nt.step < b);
    const starts = [...new Set(inSeg.map((nt) => nt.step))];
    const lengths = new Map(inSeg.map((nt) => [nt.step, nt.length]));
    for (let i = list.length - 1; i >= 0; i--) if (list[i].step >= a && list[i].step < b) list.splice(i, 1);
    const tones = chordTones(p.chords[seg], 60, colorAt(p, seg));
    for (const st of starts.length ? starts : [a]) {
        for (const note of tones) list.push({ step: st, note, length: lengths.get(st) ?? len, velocity: 0.8 });
    }
}

function ensureChordArrays(p) {
    const n = chordCount(p);
    if (p.chords?.length !== n) p.chords = displayChords(p) ?? Array(n).fill(0);
    if (!Array.isArray(p.colors) || p.colors.length !== n) p.colors = Array.from({ length: n }, (_, i) => p.colors?.[i] ?? "");
}

function setChord(seg, deg) {
    const p = pattern();
    const len = p.steps / chordCount(p);
    edit(() => {
        ensureChordArrays(p);
        const old = p.chords[seg];
        p.chords[seg] = deg;
        p.colors[seg] = "";
        shiftSegment(p, seg * len, (seg + 1) * len, old, deg);
        voicePad(p, seg, len);
    });
    popAll();
}

function setColor(seg, color) {
    const p = pattern();
    const len = p.steps / chordCount(p);
    edit(() => {
        ensureChordArrays(p);
        p.colors[seg] = color;
        voicePad(p, seg, len);
    });
    popAll();
}

function hearChord(deg, color = "") {
    const t = melodicTracks().find((x) => role(x) === "pad") ?? melodyTrack();
    if (t) chordTones(deg, 60, color).forEach((m) => player.preview(song(), t, m, 6, 0.75));
}

// ---------- Hills and valleys ----------
// A part's chords drawn as a landscape: Home is the valley floor, tense chords are hills (height =
// tension). A ball rolls over it as the music plays, so you can see tension building and letting go.

const hillY = (t, H) => H - 46 - t * (H - 112);
// Each chord owns an equal slice of the width; its hill top sits in the middle of the slice.
const arcX = (i, n, W) => ((i + 0.5) * W) / n;
const arcY = hillY;

function smoothPath(pts) {
    if (!pts.length) return "";
    let d = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
        d += ` C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
    }
    return d;
}

// Sample the terrain densely so the ball can follow it. The ends wrap around, because parts loop.
function terrain(chords, W, H) {
    const n = chords.length;
    const key = (i) => {
        const d = chords[((i % n) + n) % n];
        return { x: arcX(i, n, W), y: hillY(feeling(d).tension, H) };
    };
    const ctrl = [];
    for (let i = -2; i <= n + 1; i++) ctrl.push(key(i));
    const samples = [];
    for (let k = 1; k < ctrl.length - 2; k++) {
        const p0 = ctrl[k - 1], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[k + 2];
        for (let s = 0; s < 24; s++) {
            const t = s / 24, t2 = t * t, t3 = t2 * t;
            const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
            samples.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
        }
    }
    return samples.filter((p) => p.x >= -4 && p.x <= W + 4);
}

function terrainYAt(samples, x) {
    for (let i = 1; i < samples.length; i++) {
        if (samples[i].x >= x) {
            const a = samples[i - 1], b = samples[i];
            return a.y + ((b.y - a.y) * (x - a.x)) / Math.max(0.001, b.x - a.x);
        }
    }
    return samples[samples.length - 1]?.y ?? 0;
}

function arcSVG(seg, W, H) {
    const p = pattern();
    const chords = displayChords(p) ?? Array(chordCount(p)).fill(0);
    const n = chords.length;
    const samples = terrain(chords, W, H);
    es.hills = { samples, W, H, n };
    const top = samples.map((pt, i) => `${i ? "L" : "M"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
    const ground = `${top} L${W} ${H} L0 ${H} Z`;
    const stops = chords.map((d, i) => `<stop offset="${((i + 0.5) / n).toFixed(3)}" stop-color="${feeling(d).tint}"/>`).join("");
    const far = `M0 ${H - 70} Q${W * 0.18} ${H - 120} ${W * 0.36} ${H - 84} T${W * 0.72} ${H - 96} T${W} ${H - 78} L${W} ${H} L0 ${H} Z`;
    const stars = Array.from({ length: 22 }, (_, i) => `<circle cx="${((i * 97) % 100) / 100 * W}" cy="${8 + ((i * 53) % 60)}" r="${i % 3 ? 0.9 : 1.4}" fill="#fff" opacity="${0.2 + (i % 4) * 0.12}"/>`).join("");
    return `<svg class="arc hills" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-w="${W}" data-h="${H}">
        <defs>
          <linearGradient id="hSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14162b"/><stop offset="1" stop-color="#262245"/></linearGradient>
          <linearGradient id="hLand" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>
          <linearGradient id="hShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
          <radialGradient id="hBall" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#f1eeff"/><stop offset="1" stop-color="#b9aaff"/></radialGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#hSky)"/>${stars}
        <path d="${far}" fill="#1d1b33"/>
        <path d="${ground}" fill="url(#hLand)" opacity=".55"/>
        <path d="${ground}" fill="url(#hShade)"/>
        <path d="${top}" class="hill-top"/>
        <text class="hill-axis" x="10" y="${hillY(0, H) + 30}">home valley</text>
        ${chords.map((d, i) => {
            const f = feeling(d);
            const x = arcX(i, n, W), y = hillY(f.tension, H);
            return `<g class="arc-pt${i === seg ? " on" : ""}" data-seg="${i}" style="--t:${f.tint}">
                <line class="hill-pole" x1="${x}" y1="${y - 10}" x2="${x}" y2="${y - 30}"/>
                <g transform="translate(${x} ${y - 44})"><rect class="hill-sign" x="-38" y="-13" width="76" height="26" rx="8"/>
                  <text class="arc-name" y="-1">${esc(chordName(d, colorAt(p, i)))}</text><text class="arc-word" y="9">${esc(f.word.split(",")[0])}</text></g>
                <g class="hill-handle" transform="translate(${x} ${y})"><circle class="arc-hit" r="24"/><circle class="arc-dot" r="${i === seg ? 8 : 6.5}"/></g>
              </g>`;
        }).join("")}
        <g id="hBallG"><ellipse class="ball-shadow" cx="0" cy="11" rx="9" ry="2.6"/><g class="ball-spin"><circle r="10" fill="url(#hBall)"/><path d="M-6 -2 a7 7 0 0 1 9 -6" stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"/><path d="M-10 0 h20" stroke="#9b87ff" stroke-width="1.2" opacity=".5"/></g></g>
      </svg>`;
}

// The ball: rolls along with the music, or rests on the chord you're looking at.
let ballRaf = 0;
function ballLoop() {
    cancelAnimationFrame(ballRaf);
    const tick = () => {
        if (!es.cv.on) return;
        const g = document.getElementById("hBallG");
        const h = es.hills;
        if (g && h) {
            const pos = player.position();
            let x;
            if (pos && pos.pattern === state.selPattern) x = (pos.step / pos.steps) * h.W;
            else x = arcX(journeySeg, h.n, h.W);
            const y = terrainYAt(h.samples, x) - 10;
            g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
            g.querySelector(".ball-spin").setAttribute("transform", `rotate(${((x / (2 * Math.PI * 10)) * 360).toFixed(1)})`);
        }
        ballRaf = requestAnimationFrame(tick);
    };
    tick();
}

// What a move between two chords does, in plain words.
function moveText(prev, cur) {
    if (prev === undefined || cur === undefined) return "";
    const a = feeling(prev), b = feeling(cur);
    const from = `${chordName(prev)} (${a.word})`, to = `${chordName(cur)} (${b.word})`;
    let say;
    if (prev === cur) say = "Staying put. Nothing moves, a calm moment to settle in.";
    else if (a.group === "tension" && b.group === "home") say = "From the big hill back down into the valley. That's called resolving: the tension lets go, like arriving home. It's why songs feel finished.";
    else if (a.group === "tension" && b.group === "moody") say = "A twist! The ball was about to roll home, but lands somewhere bittersweet instead. Songwriters use this to surprise you.";
    else if (b.group === "tension") say = "Climbing the biggest hill. Tension makes your ears lean forward, wanting the next chord to be Home.";
    else if (a.group === "home" && b.group === "away") say = "Stepping out of the valley. Warm and open, like walking out the door.";
    else if (b.group === "home") say = "Rolling gently back to the valley. A soft way to come home.";
    else if (b.tension > a.tension + 0.1) say = "Climbing a little. The energy rises.";
    else if (b.tension < a.tension - 0.1) say = "Going downhill. Things relax.";
    else say = "Moving sideways: a change of colour without much change in tension.";
    return `<b>${esc(from)} → ${esc(to)}</b><span>${esc(say)}</span>`;
}

// ---------- The Chords & mood view ----------
// Its own view, like Jam: how the song should feel (mood, style, key, speed) next to its chords.

const MOOD_DESC = {
    major: "bright and sunny", mixolydian: "laid-back, summery", lydian: "floating, magical",
    dorian: "smooth, a bit mysterious", minor: "gentle and blue", harmonic: "eerie and exotic",
};
es.cv = { on: false };
let journeySeg = 0;

function chordDetailHTML() {
    const p = pattern();
    const seg = journeySeg;
    const cur = displayChords(p)?.[seg];
    const f = cur === undefined ? null : feeling(cur);
    const colour = colorAt(p, seg);
    const ladder = chordChoices().sort((a, b) => feeling(a).tension - feeling(b).tension);
    const chords = displayChords(p);
    const prev = chords ? chords[mod(seg - 1, chords.length)] : undefined;
    return `<div class="cv-explain">
        <div class="j-about" style="--t:${f?.tint ?? "#8d8ca3"}">
          ${f ? `<b>Chord ${seg + 1}: ${esc(chordName(cur, colour))} · ${esc(f.word)}</b><span>${esc(f.line)}</span>` : "<b>Pick a chord</b>"}
        </div>
        ${chords && chords.length > 1 ? `<div class="j-move"><div class="cv-label">What's happening here</div>${moveText(prev, cur)}</div>` : ""}
        </div>
        <div class="j-ladder-head"><span>calm</span><span>Choose chord ${seg + 1}</span><span>tense</span></div>
        <div class="j-ladder">${ladder.map((d) => {
            const lf = feeling(d);
            return `<button data-deg="${d}" class="${d === cur ? "on" : ""}" style="--t:${lf.tint}"><b>${esc(chordName(d))}</b><small>${esc(lf.word)}</small></button>`;
        }).join("")}</div>
        ${sevenNotes() && cur !== undefined ? `<div class="cv-label">Add colour</div>
        <div class="j-colors">${COLORS.map((c) => `<button data-color="${c.id}" class="${c.id === colour ? "on" : ""}"><b>${esc(c.name)}</b><small>${esc(c.feel)}</small></button>`).join("")}</div>` : ""}`;
}

function renderChordsView() {
    const box = $("#eChordsView");
    const btn = $("#eVibe");
    btn.innerHTML = es.cv.on ? "▦ Back to grid" : "♫ Chords &amp; mood";
    btn.classList.toggle("on", es.cv.on);
    document.body.classList.toggle("chordsview", es.cv.on);
    if (!es.cv.on) { box.hidden = true; if (!es.jam.on) canvas.hidden = false; return; }
    box.hidden = false;
    canvas.hidden = true;
    $("#ePager").hidden = true;
    const s = song();
    const p = pattern();
    journeySeg = clamp(journeySeg, 0, chordCount(p) - 1);
    const parts = [...new Set(s.arrangement)];
    const top = box.scrollTop;
    box.innerHTML = `
      <section class="cv-feel">
        <div class="cv-title">How should it feel?</div>
        <div class="cv-label">Mood</div>
        <div class="cv-moods">${MOODS.map((m) => `<button data-mood="${m.scale}" class="${m.scale === s.scale ? "on" : ""}"><b>${esc(m.name)}</b><small>${esc(MOOD_DESC[m.scale] ?? "")}</small></button>`).join("")}</div>
        <div class="cv-label">Sounds</div>
        <div class="cv-styles">${STYLES.map((x) => `<button data-style="${x.id}" class="${x.id === s.style ? "on" : ""}">${esc(x.name)}</button>`).join("")}</div>
        <div class="cv-row"><span class="cv-label">Key</span><button class="icon-btn" data-tr="-1" title="Lower">−</button><b class="cv-key">${esc(keyName())}</b><button class="icon-btn" data-tr="1" title="Higher">+</button></div>
        <div class="cv-row"><span class="cv-label">Speed</span><input type="range" id="cvSpeed" min="50" max="180" step="1" value="${s.bpm}"><output id="cvSpeedOut">${s.bpm}</output></div>
      </section>
      <section class="cv-chords">
        <div class="cv-head">
          <div class="cv-title">Chord journey</div>
          ${parts.length > 1 ? `<div class="seg cv-parts">${parts.map((name) => `<button data-part="${esc(name)}" class="${name === state.selPattern ? "on" : ""}">Part ${esc(name)}</button>`).join("")}</div>` : ""}
          <div class="spacer"></div>
          <button class="btn ghost small-btn" id="cvSurprise" title="A whole new set of chords for this part">Surprise me</button>
        </div>
        <div class="cv-sub">Home is the valley, tense chords are hills. Drag a hill up or down to change its chord. Press play and watch the ball climb the tension and roll back home.</div>
        <div class="j-arc hills-box"><div class="cv-arc-box" id="cvArc"></div></div>
        <div class="cv-detail" id="cvDetail">${chordDetailHTML()}</div>
      </section>`;
    box.scrollTop = top;
    drawArc();
    wireChordsView();
}

function drawArc() {
    const host = $("#cvArc");
    if (!host) return;
    const W = Math.max(280, Math.round(host.clientWidth));
    const H = innerWidth < 600 ? 230 : 270;
    host.innerHTML = arcSVG(journeySeg, W, H);
    wireArc(host.querySelector(".arc"));
    ballLoop();
}

function refreshDetail() {
    const d = $("#cvDetail");
    if (!d) return;
    d.innerHTML = chordDetailHTML();
    wireDetail();
}

function selectSlot(i) {
    journeySeg = i;
    es.chordOpen = i;
    const d = displayChords(pattern())?.[i];
    if (d !== undefined) hearChord(d, colorAt(pattern(), i));
    drawArc();
    refreshDetail();
    requestDraw();
}

// Drag a point up or down: it snaps to the chord whose tension is closest.
function wireArc(svg) {
    if (!svg) return;
    const W = Number(svg.dataset.w), H = Number(svg.dataset.h);
    svg.querySelectorAll(".arc-pt").forEach((g) => {
        g.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            const i = Number(g.dataset.seg);
            const start = displayChords(pattern())?.[i] ?? 0;
            const choices = chordChoices();
            const rect = svg.getBoundingClientRect();
            const scale = H / rect.height;
            const y0pt = arcY(feeling(start).tension, H);
            let cand = start, moved = false;
            const y0 = e.clientY;
            svg.setPointerCapture(e.pointerId);
            const move = (ev) => {
                if (Math.abs(ev.clientY - y0) > 4) moved = true;
                if (!moved) return;
                const y = (ev.clientY - rect.top) * scale;
                let best = cand, dist = Infinity;
                for (const d of choices) { const dd = Math.abs(arcY(feeling(d).tension, H) - y); if (dd < dist) { dist = dd; best = d; } }
                g.setAttribute("transform", `translate(0 ${(clamp(y, arcY(1, H) - 6, arcY(0, H) + 6) - y0pt).toFixed(1)})`);
                if (best !== cand) {
                    cand = best;
                    const f = feeling(best);
                    g.style.setProperty("--t", f.tint);
                    g.querySelector(".arc-name").textContent = chordName(best);
                    g.querySelector(".arc-word").textContent = f.word.split(",")[0];
                    hearChord(best);
                }
            };
            const up = () => {
                svg.removeEventListener("pointermove", move);
                svg.removeEventListener("pointerup", up);
                svg.removeEventListener("pointercancel", up);
                if (!moved) { selectSlot(i); return; }
                journeySeg = i;
                if (cand !== start) setChord(i, cand);
                else { drawArc(); refreshDetail(); }
            };
            svg.addEventListener("pointermove", move);
            svg.addEventListener("pointerup", up);
            svg.addEventListener("pointercancel", up);
        });
    });
}

function wireDetail() {
    const box = $("#cvDetail");
    box.querySelectorAll(".j-ladder [data-deg]").forEach((b) => (b.onclick = () => {
        const d = Number(b.dataset.deg);
        hearChord(d);
        if (d !== displayChords(pattern())?.[journeySeg] || colorAt(pattern(), journeySeg)) setChord(journeySeg, d);
    }));
    box.querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => {
        const c = b.dataset.color;
        const d = displayChords(pattern())?.[journeySeg];
        if (d === undefined) return;
        hearChord(d, c);
        if (c !== colorAt(pattern(), journeySeg)) setColor(journeySeg, c);
    }));
}

function wireChordsView() {
    const box = $("#eChordsView");
    box.querySelectorAll("[data-mood]").forEach((b) => (b.onclick = () => { setMood(b.dataset.mood); if (!isPlaying()) previewChord(); }));
    box.querySelectorAll("[data-style]").forEach((b) => (b.onclick = () => { setStyle(STYLES.find((x) => x.id === b.dataset.style)); if (!isPlaying()) previewChord(); }));
    box.querySelectorAll("[data-tr]").forEach((b) => (b.onclick = () => { transpose(Number(b.dataset.tr)); if (!isPlaying()) previewChord(); }));
    box.querySelectorAll("[data-part]").forEach((b) => (b.onclick = () => {
        selectPattern(b.dataset.part);
        state.selBlock = Math.max(0, song().arrangement.indexOf(b.dataset.part));
        journeySeg = 0;
        es.center = {};
        render();
    }));
    const sp = $("#cvSpeed");
    sp.addEventListener("pointerdown", () => pushHistory());
    sp.addEventListener("input", () => {
        song().bpm = Number(sp.value);
        $("#cvSpeedOut").textContent = sp.value;
        $("#eSpeed").value = sp.value;
        $("#eSpeedOut").textContent = sp.value;
    });
    sp.addEventListener("change", markChanged);
    $("#cvSurprise").onclick = () => { newChords(); };
    wireDetail();
}

function openChordsView(seg = journeySeg) {
    closePop();
    journeySeg = seg;
    es.chordOpen = seg;
    if (es.jam.on) { if (es.jam.rec) toggleRecord(); es.jam.on = false; renderJam(); }
    es.cv.on = true;
    renderChordsView();
}

function toggleChordsView() {
    if (es.cv.on) {
        es.cv.on = false;
        es.chordOpen = undefined;
        es.jam.on = es.view === "jam";
        renderChordsView();
        render();
    } else openChordsView(journeySeg);
}

// the chord strip above the grid opens the view on that chord
function openChordPicker(seg) { openChordsView(seg); }

addEventListener("resize", () => { if (es.cv.on) drawArc(); });

function chordHit(e) {
    const L = es.layout;
    if (!L?.band) return null;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (y < 0 || y >= L.band || x < L.gutter) return null;
    const step = L.viewStart + Math.floor((x - L.gutter) / L.cellW);
    const seg = Math.floor(step / (L.steps / chordCount(pattern())));
    return { seg: clamp(seg, 0, chordCount(pattern()) - 1), x: e.clientX, y: r.top + L.band };
}

// ---------- Grid ----------

const stage = $("#eStage");
const canvas = $("#eGrid");
let drawQueued = false;

function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; draw(); });
}

// On narrow screens the grid shows one page (8 or 16 steps) at a time with big squares.
function pageSize(steps, W) {
    const size = W < 520 ? 8 : W < 860 ? 16 : steps;
    return Math.min(size, steps);
}
const isPaged = () => es.layout && es.layout.viewSteps < es.layout.steps;

function computeLayout() {
    const p = pattern();
    const track = melodyTrack();
    const rows = melodyRows(track);
    const drums = drumTracks();
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const narrow = W < 520;
    const gutter = narrow ? 30 : GUTTER;
    const viewSteps = pageSize(p.steps, W);
    const pages = Math.ceil(p.steps / viewSteps);
    es.page = clamp(es.page ?? 0, 0, pages - 1);
    const viewStart = es.page * viewSteps;
    const band = rows.length ? CHORD_BAND : 0;
    const drumH = drums.length ? clamp(Math.floor(H * 0.075), narrow ? 34 : 28, 40) : 0;
    const gap = drums.length && rows.length ? 12 : 0;
    const rowH = rows.length ? clamp(Math.floor((H - band - gap - drumH * drums.length - 2) / rows.length), narrow ? 26 : 15, 40) : 0;
    const cellW = viewSteps < p.steps ? (W - gutter) / viewSteps : Math.max(18, Math.floor((W - gutter) / p.steps));
    const melodyH = rows.length * rowH;
    return {
        track, rows, drums, band, drumH, gap, rowH, cellW, gutter, steps: p.steps, viewStart, viewSteps, pages,
        melodyTop: band, drumTop: band + melodyH + gap,
        width: Math.round(gutter + cellW * viewSteps), height: band + melodyH + gap + drums.length * drumH,
    };
}

const degreeColor = (midi, alpha = 1) => {
    const s = song();
    const d = degreeOf(midi, s.key, s.scale);
    if (d < 0) return `rgba(160,160,175,${alpha})`;
    const n = SCALES[s.scale]?.steps.length ?? 7;
    const oct = Math.floor((midi - 48) / 12);
    return `hsla(${(258 + (d * 360) / n) % 360}, 82%, ${clamp(60 + oct * 3, 52, 74)}%, ${alpha})`;
};

function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h);
    c.fill();
}

function drumShape(c, kind, cx, cy, size) {
    size = Math.max(4, size || 0);
    c.beginPath();
    if (kind === "kick" || kind === "tom") c.arc(cx, cy, size * (kind === "tom" ? 0.38 : 0.46), 0, Math.PI * 2);
    else if (kind === "snare" || kind === "clap") { c.moveTo(cx, cy - size * 0.45); c.lineTo(cx + size * 0.45, cy + size * 0.38); c.lineTo(cx - size * 0.45, cy + size * 0.38); c.closePath(); }
    else if (kind === "hat" || kind === "openhat") { c.moveTo(cx, cy - size * 0.4); c.lineTo(cx + size * 0.4, cy); c.lineTo(cx, cy + size * 0.4); c.lineTo(cx - size * 0.4, cy); c.closePath(); }
    else c.rect(cx - size * 0.32, cy - size * 0.32, size * 0.64, size * 0.64);
    c.fill();
}

const popScale = (key, now) => {
    const t0 = es.anim.get(key);
    if (t0 === undefined) return 1;
    const age = now - t0;
    if (age > 260) { es.anim.delete(key); return 1; }
    return 1 + 0.28 * (1 - Math.max(0, age) / 260) ** 2;
};

function popAll(track) {
    const now = performance.now();
    for (const [t, notes] of Object.entries(pattern().tracks)) {
        if (track && t !== track) continue;
        for (const n of notes) es.anim.set(`${t}:${n.step}:${n.note}`, now + (n.step % 16) * 6);
    }
    requestDraw();
}

function draw() {
    if (state.ui !== "easy" || !state.song || es.jam?.on || es.cv?.on || es.view !== "grid") return;
    const L = es.drag ? es.layout : (es.layout = computeLayout());
    const dpr = devicePixelRatio || 1;
    if (canvas.width !== Math.round(L.width * dpr) || canvas.height !== Math.round(L.height * dpr)) {
        canvas.width = Math.round(L.width * dpr);
        canvas.height = Math.round(L.height * dpr);
        canvas.style.width = `${L.width}px`;
        canvas.style.height = `${L.height}px`;
    }
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = song();
    const p = pattern();
    const now = performance.now();
    const beat = s.stepsPerBeat;
    const playStep = player.playing && state.playPos?.pattern === state.selPattern ? state.playPos.step : -1;
    const G = L.gutter;
    // Grid x for a step; the visible page starts at the gutter.
    const gx = (step) => G + (step - L.viewStart) * L.cellW;
    const viewEnd = L.viewStart + L.viewSteps;

    c.fillStyle = "#14141b";
    c.fillRect(0, 0, L.width, L.height);

    c.save();
    c.beginPath();
    c.rect(G, 0, L.width - G, L.height);
    c.clip();

    for (let b = 0; b * beat < L.steps; b++) {
        if (b % 2) { c.fillStyle = "rgba(255,255,255,0.022)"; c.fillRect(gx(b * beat), 0, beat * L.cellW, L.height); }
    }
    for (let st = 0; st <= L.steps; st += beat * 4) { c.fillStyle = "rgba(255,255,255,0.09)"; c.fillRect(Math.round(gx(st)), 0, 1, L.height); }

    if (L.band) {
        const shown = displayChords(p);
        const n = chordCount(p);
        const segSteps = L.steps / n;
        c.font = "800 11px Nunito, sans-serif";
        for (let i = 0; i < n; i++) {
            const a = i * segSteps, b = a + segSteps;
            if (b <= L.viewStart || a >= viewEnd) continue;
            const x0 = gx(Math.max(a, L.viewStart)) + 3;
            const room = gx(Math.min(b, viewEnd)) - x0 - 3;
            const f = shown ? feeling(shown[i]) : null;
            const name = shown ? chordName(shown[i], colorAt(p, i)) : "Chord";
            c.font = "800 11px Nunito, sans-serif";
            const nameW = c.measureText(name).width;
            c.font = "600 10px Nunito, sans-serif";
            const wordW = f ? c.measureText(f.word).width : 0;
            const withWord = f && nameW + wordW + 40 <= room;
            const w = Math.min(Math.max((withWord ? nameW + wordW + 12 : nameW) + 28, 46), room);
            const active = playStep >= a && playStep < b;
            const open = es.chordOpen === i;
            const tint = f?.tint ?? "#8d8ca3";
            c.globalAlpha = open ? 0.5 : active ? 0.38 : 0.17;
            c.fillStyle = tint;
            rr(c, x0, 3, w, 16, 8);
            c.globalAlpha = 1;
            c.font = "800 11px Nunito, sans-serif";
            c.fillStyle = active || open ? "#ffffff" : shown ? "#e4e3f0" : "rgba(141,140,163,0.8)";
            c.fillText(name, x0 + 8, 15);
            if (withWord) {
                c.font = "600 10px Nunito, sans-serif";
                c.fillStyle = tint;
                c.fillText(f.word, x0 + 8 + nameW + 7, 14.6);
            }
            c.font = "800 11px Nunito, sans-serif";
            c.fillStyle = "rgba(200,199,216,0.55)";
            if (w > 30) c.fillText("▾", x0 + w - 12, 14.5);
        }
    }

    const rowOf = new Map(L.rows.map((m, i) => [m, i]));
    const root = KEYS.indexOf(s.key);
    L.rows.forEach((m, i) => {
        const y = L.melodyTop + i * L.rowH;
        if (mod(m - root, 12) === 0) { c.fillStyle = "rgba(155,135,255,0.07)"; c.fillRect(G, y, L.width - G, L.rowH); }
        c.fillStyle = "rgba(255,255,255,0.045)";
        c.fillRect(G, y + L.rowH - 1, L.width - G, 1);
    });

    if (p.chords && L.rows.length) {
        const segSteps = L.steps / p.chords.length;
        p.chords.forEach((deg, i) => {
            const pcs = chordPcs(deg, s.key, s.scale);
            L.rows.forEach((m, r) => {
                if (!pcs.includes(mod(m, 12))) return;
                c.fillStyle = "rgba(255,255,255,0.03)";
                c.fillRect(gx(i * segSteps), L.melodyTop + r * L.rowH, segSteps * L.cellW, L.rowH - 1);
            });
        });
    }

    if (playStep >= 0) {
        c.fillStyle = "rgba(185,170,255,0.14)";
        c.fillRect(gx(playStep), L.melodyTop, L.cellW, L.height - L.melodyTop);
    }

    c.fillStyle = "rgba(255,255,255,0.07)";
    for (let i = 0; i < L.rows.length; i++) for (let st = L.viewStart; st < viewEnd; st++) {
        c.fillRect(gx(st) + L.cellW / 2 - 1, L.melodyTop + i * L.rowH + L.rowH / 2 - 1, 2, 2);
    }

    for (const [t, notes] of Object.entries(p.tracks)) {
        const ins = inst(t);
        if (!ins || ins.type === "drum" || t === L.track) continue;
        c.strokeStyle = ins.color;
        c.globalAlpha = 0.28;
        c.lineWidth = 1.5;
        for (const n of notes) {
            const r = rowOf.get(n.note);
            if (r === undefined || n.step + n.length <= L.viewStart || n.step >= viewEnd) continue;
            c.beginPath();
            c.roundRect?.(gx(n.step) + 3, L.melodyTop + r * L.rowH + 3, n.length * L.cellW - 6, L.rowH - 6, 6);
            c.stroke();
        }
        c.globalAlpha = 1;
    }

    if (L.track) {
        for (const n of p.tracks[L.track] ?? []) {
            const r = rowOf.get(n.note);
            if (r === undefined || n.step >= L.steps || n.step + n.length <= L.viewStart || n.step >= viewEnd) continue;
            const k = popScale(`${L.track}:${n.step}:${n.note}`, now);
            const lit = playStep >= n.step && playStep < n.step + n.length;
            const w = Math.min(n.length, L.steps - n.step) * L.cellW - 4;
            const h = L.rowH - 4;
            const x = gx(n.step) + 2, y = L.melodyTop + r * L.rowH + 2;
            c.save();
            c.translate(x + w / 2, y + h / 2);
            c.scale(k, k);
            c.fillStyle = degreeColor(n.note, 0.55 + 0.45 * n.velocity);
            if (lit) { c.shadowColor = degreeColor(n.note, 0.9); c.shadowBlur = 14; }
            rr(c, -w / 2, -h / 2, w, h, Math.min(h, L.cellW) / 2.2);
            c.restore();
        }
    }

    L.drums.forEach((t, i) => {
        const ins = inst(t);
        const y = L.drumTop + i * L.drumH;
        c.fillStyle = "rgba(255,255,255,0.025)";
        c.fillRect(G, y + 2, L.width - G, L.drumH - 4);
        const hits = new Map((p.tracks[t] ?? []).map((n) => [n.step, n]));
        for (let st = L.viewStart; st < viewEnd; st++) {
            const cx = gx(st) + L.cellW / 2, cy = y + L.drumH / 2;
            const hit = hits.get(st);
            if (!hit) {
                c.fillStyle = "rgba(255,255,255,0.08)";
                c.fillRect(cx - 1.5, cy - 1.5, 3, 3);
                continue;
            }
            const k = popScale(`${t}:${st}:null`, now);
            c.fillStyle = st === playStep ? "#ffffff" : ins.color;
            c.globalAlpha = 0.45 + 0.55 * hit.velocity;
            drumShape(c, ins.kind, cx, cy, Math.min(L.cellW, L.drumH) * 0.72 * k);
            c.globalAlpha = 1;
        }
    });
    c.restore();

    // Gutter: colored keys to hear each row, and drum icons.
    L.rows.forEach((m, i) => {
        c.fillStyle = degreeColor(m, 0.85);
        rr(c, G > 36 ? 10 : 5, L.melodyTop + i * L.rowH + 3, G - (G > 36 ? 18 : 10), L.rowH - 6, 5);
    });
    L.drums.forEach((t, i) => {
        const ins = inst(t);
        c.fillStyle = ins.color;
        c.globalAlpha = 0.8;
        drumShape(c, ins.kind, G / 2 - 1, L.drumTop + i * L.drumH + L.drumH / 2, Math.min(L.drumH - 12, G - 14, 20));
        c.globalAlpha = 1;
    });

    if (!L.rows.length && !L.drums.length) {
        c.fillStyle = "#8d8ca3";
        c.font = "700 14px Nunito, sans-serif";
        c.fillText("Add an instrument to start", G + 12, 30);
    }

    renderPager();
    canvas.style.touchAction = L.pages > 1 ? "pan-y" : "pan-x pan-y";
    if (es.anim.size) requestDraw();
}

// Page dots + arrows, only when the grid is paged (phones).
function renderPager() {
    const pager = $("#ePager");
    const L = es.layout;
    if (!L || L.pages <= 1) { pager.hidden = true; return; }
    pager.hidden = false;
    const sig = `${L.pages}:${es.page}`;
    if (pager.dataset.sig === sig) return;
    pager.dataset.sig = sig;
    pager.innerHTML = `<button class="icon-btn" data-dir="-1" aria-label="Previous"${es.page === 0 ? " disabled" : ""}>‹</button>
        <div class="e-dots">${Array.from({ length: L.pages }, (_, i) => `<button class="e-pdot${i === es.page ? " on" : ""}" data-page="${i}" aria-label="Page ${i + 1}"></button>`).join("")}</div>
        <button class="icon-btn" data-dir="1" aria-label="Next"${es.page === L.pages - 1 ? " disabled" : ""}>›</button>`;
    pager.querySelectorAll("[data-dir]").forEach((b) => (b.onclick = () => goPage(es.page + Number(b.dataset.dir))));
    pager.querySelectorAll("[data-page]").forEach((b) => (b.onclick = () => goPage(Number(b.dataset.page))));
}

function goPage(n, { user = true } = {}) {
    const L = es.layout;
    if (!L) return;
    const next = clamp(n, 0, L.pages - 1);
    if (user) es.touchedAt = performance.now();
    if (next === es.page) return;
    es.page = next;
    requestDraw();
}

function hit(e) {
    const L = es.layout;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const step = clamp(L.viewStart + Math.floor((x - L.gutter) / L.cellW), L.viewStart, L.viewStart + L.viewSteps - 1);
    const inGutter = x < L.gutter;
    if (y >= L.melodyTop && y < L.melodyTop + L.rows.length * L.rowH) {
        return { kind: "note", step, pitch: L.rows[Math.floor((y - L.melodyTop) / L.rowH)], inGutter };
    }
    if (y >= L.drumTop && L.drums.length) {
        const lane = Math.floor((y - L.drumTop) / L.drumH);
        if (lane < L.drums.length) return { kind: "drum", step, track: L.drums[lane], inGutter };
    }
    return null;
}

const defaultLen = (track) => ({ pad: 8, bass: 2, keys: 2, lead: 2 })[role(track)] ?? 2;
const noteAt = (list, step, pitch) => list.find((n) => n.note === pitch && step >= n.step && step < n.step + n.length);

function toggleAt(h, { allowDrag = false, velocity = 1 } = {}) {
    const L = es.layout;
    es.touchedAt = performance.now();
    if (h.kind === "drum") {
        const list = notesOf(h.track);
        const idx = list.findIndex((n) => n.step === h.step);
        pushHistory();
        if (idx >= 0) list.splice(idx, 1);
        else {
            list.push({ step: h.step, note: null, length: 1, velocity });
            es.anim.set(`${h.track}:${h.step}:null`, performance.now());
            player.preview(song(), h.track, 60, 1, velocity);
        }
        if (allowDrag) es.drag = { kind: "paint", add: idx < 0, visited: new Set([`${h.track}:${h.step}`]), velocity };
        markChanged();
        requestDraw();
        return;
    }
    const track = L.track;
    const list = notesOf(track);
    const n = noteAt(list, h.step, h.pitch);
    pushHistory();
    if (n) list.splice(list.indexOf(n), 1);
    else {
        const note = { step: h.step, note: h.pitch, length: Math.min(defaultLen(track), L.steps - h.step), velocity };
        list.push(note);
        es.anim.set(`${track}:${note.step}:${note.note}`, performance.now());
        player.preview(song(), track, h.pitch, note.length, velocity);
        if (allowDrag) es.drag = { kind: "stretch", note, startStep: h.step, moved: false };
    }
    markChanged();
    requestDraw();
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
    if (!es.layout) return;
    const ch = chordHit(e);
    const h = hit(e);
    if (e.pointerType === "touch") { es.touch = { x: e.clientX, y: e.clientY, h, ch }; return; }
    if (ch) { openChordPicker(ch.seg, ch.x, ch.y); return; }
    if (!h) return;
    if (h.inGutter) {
        if (h.kind === "note") player.preview(song(), es.layout.track, h.pitch, 3);
        else player.preview(song(), h.track, 60, 1);
        return;
    }
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    toggleAt(h, { allowDrag: true, velocity: e.shiftKey ? 0.55 : 1 });
});
canvas.addEventListener("pointermove", (e) => {
    if (!es.drag && e.pointerType !== "touch") canvas.style.cursor = chordHit(e) ? "pointer" : "";
    const d = es.drag;
    if (!d || e.pointerType === "touch") return;
    const h = hit(e);
    if (!h) return;
    if (d.kind === "stretch") {
        const len = clamp(h.step - d.note.step + 1, 1, es.layout.steps - d.note.step);
        if (len !== d.note.length && h.step >= d.note.step) { d.note.length = len; d.moved = true; requestDraw(); }
    } else if (d.kind === "paint" && h.kind === "drum") {
        const key = `${h.track}:${h.step}`;
        if (d.visited.has(key)) return;
        d.visited.add(key);
        const list = notesOf(h.track);
        const idx = list.findIndex((n) => n.step === h.step);
        if (d.add && idx < 0) {
            list.push({ step: h.step, note: null, length: 1, velocity: d.velocity });
            es.anim.set(`${h.track}:${h.step}:null`, performance.now());
            player.preview(song(), h.track, 60, 1, d.velocity);
        } else if (!d.add && idx >= 0) list.splice(idx, 1);
        requestDraw();
    }
});
function endDrag() {
    if (!es.drag) return;
    es.drag = null;
    markChanged();
    render();
}
canvas.addEventListener("pointerup", (e) => {
    if (e.pointerType === "touch" && es.touch) {
        const t = es.touch;
        es.touch = null;
        const dx = e.clientX - t.x, dy = e.clientY - t.y;
        // A sideways swipe flips the page; a tap places or removes a note.
        if (isPaged() && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) { goPage(es.page + (dx < 0 ? 1 : -1)); return; }
        if (Math.hypot(dx, dy) < 10 && t.ch) { openChordPicker(t.ch.seg, t.ch.x, t.ch.y); return; }
        if (Math.hypot(dx, dy) < 10 && t.h) {
            if (t.h.inGutter) {
                if (t.h.kind === "note") player.preview(song(), es.layout.track, t.h.pitch, 3);
                else player.preview(song(), t.h.track, 60, 1);
                return;
            }
            toggleAt(t.h);
            render();
        }
        return;
    }
    endDrag();
});
canvas.addEventListener("pointercancel", () => { es.touch = null; endDrag(); });

// While playing on a phone, turn the page to follow the music (unless the player just touched the grid).
function followPlayhead(info) {
    const L = es.layout;
    if (!L || L.pages <= 1 || !info || info.pattern !== state.selPattern) return;
    if (performance.now() - (es.touchedAt ?? 0) < 2500) return;
    const page = Math.floor(info.step / L.viewSteps);
    if (page !== es.page) goPage(page, { user: false });
}

// ---------- The band ----------
// Every instrument is a little character on stage. They bop on the beat, sing their notes and
// fall asleep when muted. The drummer covers all the drum tracks.

const DRUMS_ID = "__drums";
const BODY = {
    lead: `<path d="M32 10C47 10 55 22 55 36C55 51 45 58 32 58C19 58 9 51 9 36C9 22 17 10 32 10Z"/>`,
    keys: `<rect x="11" y="10" width="42" height="44" rx="16"/>`,
    pad: `<path d="M11 32C11 16 21 7 32 7C43 7 53 16 53 32V57L46.5 51L39.5 57L32 51L24.5 57L17.5 51L11 57Z"/>`,
    bass: `<path d="M5 42C5 27 17 20 32 20C47 20 59 27 59 42C59 54 49 59 32 59C15 59 5 54 5 42Z"/>`,
    drum: `<path d="M32 10C45 10 52 19 52 30C52 42 44 48 32 48C20 48 12 42 12 30C12 19 19 10 32 10Z"/>`,
};
const FACE_Y = { lead: 31, keys: 28, pad: 27, bass: 36, drum: 26 };

function creature(r) {
    const y = FACE_Y[r] ?? 31;
    const front = {
        lead: `<g class="prop"><rect x="45" y="42" width="3.5" height="16" rx="1.75" fill="#4a4a5a"/><circle cx="46.75" cy="40" r="5" fill="#b9b8c9"/><circle cx="46.75" cy="40" r="5" fill="none" stroke="#7a7990" stroke-dasharray="1.5 1.5"/></g>`,
        keys: `<g class="prop"><rect x="3" y="49" width="58" height="12" rx="3" fill="#ecebf5"/>${[9, 16, 27, 34, 41, 52].map((x) => `<rect x="${x}" y="49" width="4" height="7" rx="1" fill="#2a2a35"/>`).join("")}</g>`,
        pad: `<g class="prop sparkle"><path d="M7 10l1.2 2.8L11 14l-2.8 1.2L7 18l-1.2-2.8L3 14l2.8-1.2z" fill="#fff"/><circle cx="58" cy="20" r="1.6" fill="#fff"/><circle cx="54" cy="5" r="1.1" fill="#fff"/></g>`,
        bass: `<g class="prop"><rect x="47" y="2" width="4" height="34" rx="2" fill="#8a6a4f" transform="rotate(28 49 19)"/><ellipse cx="42" cy="44" rx="9" ry="7" fill="#a5805f" transform="rotate(28 42 44)"/></g>`,
        drum: `<g class="stick stick-l"><rect x="5" y="33" width="19" height="3.2" rx="1.6" fill="#f0d2a8"/></g><g class="stick stick-r"><rect x="40" y="33" width="19" height="3.2" rx="1.6" fill="#f0d2a8"/></g>
            <g class="prop"><rect x="12" y="48" width="40" height="13" rx="3" fill="#d9d2ff"/><ellipse cx="32" cy="48" rx="20" ry="4.5" fill="#f4f2ff"/><path d="M12 52h40M12 57h40" stroke="#b9aaff" stroke-width="1"/></g>`,
    }[r] ?? "";
    return `<svg viewBox="0 0 64 64" class="creature r-${r}" aria-hidden="true">
      <ellipse cx="32" cy="61" rx="20" ry="2.6" fill="rgba(0,0,0,.35)"/>
      <g class="bob"><g class="breath"><g class="squash">
        <g class="body">${BODY[r] ?? BODY.lead}</g>
        <g class="face">
          <g class="eyes"><circle cx="24" cy="${y}" r="6" fill="#fff"/><circle cx="40" cy="${y}" r="6" fill="#fff"/>
            <circle class="pupil" cx="25" cy="${y + 1}" r="3" fill="#1a1626"/><circle class="pupil" cx="41" cy="${y + 1}" r="3" fill="#1a1626"/></g>
          <g class="lids"><path d="M18 ${y} q6 4 12 0M34 ${y} q6 4 12 0" stroke="#1a1626" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>
          <ellipse class="mouth" cx="32" cy="${y + 11}" rx="4.5" ry="2.2" fill="#2a1630"/>
          <circle cx="15.5" cy="${y + 8}" r="3" fill="#ff9ec0" opacity=".45"/><circle cx="48.5" cy="${y + 8}" r="3" fill="#ff9ec0" opacity=".45"/>
        </g>
      </g></g></g>${front}</svg>`;
}

const audible = (t) => !state.mix.muted.has(t) && (state.mix.soloed.size === 0 || state.mix.soloed.has(t));
const memberId = (t) => (inst(t)?.type === "drum" ? DRUMS_ID : t);
const memberEl = (id) => document.querySelector(`#eChips .member[data-member="${CSS.escape(id)}"]`);
const SPEAKER = `<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M2 6h3l4-3v10L5 10H2z"/><path d="M11 5.5c1 .7 1.5 1.5 1.5 2.5s-.5 1.8-1.5 2.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
const SPEAKER_OFF = `<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M2 6h3l4-3v10L5 10H2z"/><path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;

function renderBand() {
    const box = $("#eChips");
    box.innerHTML = "";
    const sel = melodyTrack();
    const members = melodicTracks().map((t) => ({ id: t, r: role(t), name: t, sub: inst(t).preset ?? ROLE_NAMES[role(t)], color: inst(t).color, tracks: [t] }));
    const drums = drumTracks();
    if (drums.length) {
        const kit = KITS[inst(drums[0]).kit]?.name ?? "Classic";
        members.push({ id: DRUMS_ID, r: "drum", name: "Drums", sub: `${kit} kit`, color: "#ff8fb3", tracks: drums });
    }
    for (const m of members) {
        const asleep = m.tracks.every((t) => !audible(t));
        const el = document.createElement("div");
        el.className = `member${m.id === sel ? " sel" : ""}${asleep ? " sleep" : ""}`;
        el.dataset.member = m.id;
        el.style.setProperty("--c", m.color);
        el.innerHTML = `<button class="m-mute" title="${asleep ? "Wake up (unmute)" : "Mute"}">${asleep ? SPEAKER_OFF : SPEAKER}</button>
            <button class="m-body" title="${m.id === DRUMS_ID ? "Drums" : `Write notes for ${esc(m.name)}`}">${creature(m.r)}</button>
            <div class="m-name"><b></b><small></small></div>
            <button class="m-sound" data-pop>${m.id === DRUMS_ID ? "Kit" : "Sound"} ▾</button>
            <input type="range" class="m-fader" min="0" max="1.5" step="0.01" value="${groupLevel(m.tracks).toFixed(2)}" title="Volume" aria-label="${esc(m.name)} volume">`;
        el.querySelector("b").textContent = m.name;
        el.querySelector("small").textContent = m.sub;
        el.querySelector(".m-body").onclick = () => {
            if (m.id === DRUMS_ID) {
                player.preview(song(), drums[0], 60, 1);
                sing(drums[0], { note: null }, 0.2);
                return;
            }
            const changed = state.selTrack !== m.id;
            state.selTrack = m.id;
            const n = defaultCenter(m.id);
            player.preview(song(), m.id, n, 4);
            if (changed) render();
            sing(m.id, { note: n }, 0.5);
        };
        el.querySelector(".m-sound").onclick = (e) => (m.id === DRUMS_ID ? kitMenu(e.currentTarget) : soundMenu(e.currentTarget, m.id));
        const fader = el.querySelector(".m-fader");
        let start = null;
        const begin = sliderHistory(fader);
        fader.addEventListener("pointerdown", () => { start = m.tracks.map((t) => inst(t).gain ?? 1); });
        fader.addEventListener("input", () => {
            begin();
            start ??= m.tracks.map((t) => inst(t).gain ?? 1);
            const v = Number(fader.value);
            const avg = start.reduce((a, b) => a + b, 0) / start.length;
            // a group (the drums) keeps its balance: every drum moves by the same ratio
            m.tracks.forEach((t, k) => { inst(t).gain = clamp(avg > 0.001 ? start[k] * (v / avg) : v, 0, 1.5); });
            player.setMix(state.mix);
            el.classList.toggle("quiet", v < 0.02);
        });
        fader.addEventListener("change", () => { start = null; });
        el.classList.toggle("quiet", groupLevel(m.tracks) < 0.02);
        el.querySelector(".m-mute").onclick = () => {
            const allMuted = m.tracks.every((t) => state.mix.muted.has(t));
            for (const t of m.tracks) allMuted ? state.mix.muted.delete(t) : state.mix.muted.add(t);
            player.setMix(state.mix);
            renderBand();
        };
        box.append(el);
    }
    const add = document.createElement("button");
    add.className = "member add";
    add.dataset.pop = "";
    add.innerHTML = `<span class="add-plus">+</span><span>Join the band</span>`;
    add.onclick = (e) => addMenu(e.currentTarget);
    box.append(add);
}

function groupLevel(tracks) {
    return tracks.length ? tracks.reduce((a, t) => a + (inst(t).gain ?? 1), 0) / tracks.length : 1;
}

// Keep the band's faders in step when levels change elsewhere (the drum kit editor).
function syncFaders() {
    document.querySelectorAll("#eChips .member[data-member]").forEach((el) => {
        const id = el.dataset.member;
        const tracks = id === DRUMS_ID ? drumTracks() : [id];
        const f = el.querySelector(".m-fader");
        if (f && tracks.every((t) => inst(t))) f.value = groupLevel(tracks).toFixed(2);
    });
}

function sing(track, n, durSec) {
    const el = memberEl(memberId(track));
    if (!el || el.classList.contains("sleep")) return;
    const ins = inst(track);
    const squash = el.querySelector(".squash");
    if (ins?.type === "drum") {
        const k = ins.kind;
        if (k === "kick" || k === "tom") squash.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.1,.88)" }, { transform: "scale(1,1)" }], { duration: 190, easing: "ease-out" });
        if (k !== "kick") {
            const left = k === "snare" || k === "clap";
            el.querySelector(left ? ".stick-l" : ".stick-r")?.animate(
                [{ transform: "rotate(0deg)" }, { transform: `rotate(${left ? 32 : -32}deg)` }, { transform: "rotate(0deg)" }], { duration: 170, easing: "ease-out" });
        }
        return;
    }
    const d = clamp(durSec * 1000, 150, 1800);
    if (role(track) === "pad") {
        squash.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(-5deg)" }, { transform: "rotate(4deg)" }, { transform: "rotate(0deg)" }], { duration: Math.max(d, 700), easing: "ease-in-out" });
    } else {
        squash.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.07,.93)" }, { transform: "scale(.97,1.05)" }, { transform: "scale(1,1)" }], { duration: 240, easing: "ease-out" });
    }
    const high = n.note === null || n.note === undefined ? 0.5 : clamp((n.note - 55) / 26, 0, 1);
    el.querySelector(".mouth").animate([
        { transform: "scale(1,1)" },
        { transform: `scale(1.25,${2.2 + high * 1.6})`, offset: 0.12 },
        { transform: `scale(1.15,${1.8 + high * 1.2})`, offset: 0.8 },
        { transform: "scale(1,1)" },
    ], { duration: d, easing: "ease-out" });
    el.querySelectorAll(".pupil").forEach((p) => p.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-2.2 * high}px)` }, { transform: "translateY(0)" }], { duration: d }));
}

function bob(id) {
    const el = memberEl(id);
    if (!el || el.classList.contains("sleep")) return;
    el.querySelector(".bob").animate([{ transform: "translateY(0)" }, { transform: "translateY(-3px)" }, { transform: "translateY(0)" }], { duration: 170, easing: "ease-out" });
}

function bandStep(info) {
    if (!info) return;
    const s = song();
    const p = s.patterns[info.pattern];
    if (!p) return;
    const st = 60 / s.bpm / s.stepsPerBeat;
    const busy = new Set();
    for (const [t, notes] of Object.entries(p.tracks)) {
        if (!inst(t) || !notes.length) continue;
        busy.add(memberId(t));
        if (!audible(t)) continue;
        for (const n of notes) if (n.step === info.step) sing(t, n, n.length * st);
    }
    if (info.step % s.stepsPerBeat === 0) for (const id of busy) bob(id);
}

// Now and then someone blinks.
setInterval(() => {
    const eyes = document.querySelectorAll("#eChips .member:not(.sleep) .eyes");
    if (!eyes.length || document.hidden) return;
    eyes[Math.floor(Math.random() * eyes.length)].animate([{ transform: "scaleY(1)" }, { transform: "scaleY(.1)" }, { transform: "scaleY(1)" }], { duration: 160 });
}, 1300);

// ---------- Jam mode ----------
// Big pads to play along with the loop. With Record on, what you play snaps into the part.

const JAM_KEYS = "asdfghjk";
const JAM_DRUM_KEYS = "zxcvbnm";
es.jam = { on: false, rec: false, tidy: true, take: 0, held: new Map(), pads: [] };

function jamPads(track) {
    if (!track) return [];
    const s = song();
    if (role(track) === "pad") {
        const n = SCALES[s.scale]?.steps.length ?? 7;
        // the six friendliest chords in the key (no tense diminished ones)
        const degs = (n === 7 ? [0, 3, 4, 5, 1, 2, 6] : [0, 1, 2, 3, 4]).filter((d) => !/dim|\+$/.test(chordName(d))).slice(0, 6);
        return degs.map((d) => ({
            label: chordName(d), sub: feeling(d).word, notes: chordTones(d, 60), color: feeling(d).tint,
        }));
    }
    const c = es.center[track] ?? defaultCenter(track);
    const pool = [];
    for (let m = c - 12; m <= c + 16; m++) if (inScale(m, s.key, s.scale) && (!es.safe || isSafe(m, s.key, s.scale))) pool.push(m);
    let start = pool.findIndex((m) => m >= c - 5);
    if (start < 0) start = 0;
    start = Math.max(0, Math.min(start, pool.length - 8));
    return pool.slice(start, start + 8).map((m) => ({ label: pcName(mod(m, 12)), notes: [m], color: degreeColor(m) }));
}

function renderJam() {
    const box = $("#eJam");
    document.body.classList.toggle("jamming", es.jam.on);
    if (!es.jam.on) { box.hidden = true; canvas.hidden = !!es.cv?.on; return; }
    box.hidden = false;
    canvas.hidden = true;
    $("#ePager").hidden = true;
    const t = melodyTrack();
    es.jam.pads = jamPads(t);
    const keys = !matchMedia("(pointer: coarse)").matches;
    const drums = drumTracks();
    const chordsPads = t && role(t) === "pad";
    box.innerHTML = `
      <div class="jam-head">
        <button class="jam-rec${es.jam.rec ? " on" : ""}" id="jamRec" title="Record what you play into this part${keys ? " (R)" : ""}"><span class="dot"></span>${es.jam.rec ? "Recording" : "Record"}</button>
        <button class="toggle${es.jam.tidy ? " on" : ""}" id="jamTidy" title="Snap what you play to the nearest 8th note, so it lines up neatly">Tidy timing</button>
        <div class="jam-loop${es.jam.rec ? " rec" : ""}" title="Where the loop is"><div class="jam-loop-fill" id="jamFill"></div>${Array.from({ length: Math.round(pattern().steps / song().stepsPerBeat) - 1 }, (_, i) => `<span style="left:${((i + 1) / Math.round(pattern().steps / song().stepsPerBeat)) * 100}%"></span>`).join("")}</div>
        <span class="jam-count" id="jamCount"></span>
      </div>
      ${t ? `<div class="jam-label">${esc(t)} <small>${chordsPads ? "· tap a chord" : "· every pad fits the song"}</small></div>
      <div class="jam-pads mel" style="--n:${es.jam.pads.length};--cols:${Math.min(es.jam.pads.length, 4)}">${es.jam.pads.map((p, i) => `<button class="pad${chordsPads ? " chord" : ""}" data-i="${i}" style="--pc:${p.color}"><span class="pad-label">${esc(p.label)}${p.sub ? `<small>${esc(p.sub)}</small>` : ""}</span>${keys ? `<kbd>${JAM_KEYS[i].toUpperCase()}</kbd>` : ""}</button>`).join("")}</div>` : ""}
      ${drums.length ? `<div class="jam-label">Drums</div>
      <div class="jam-pads drums" style="--n:${drums.length};--cols:${Math.min(drums.length, 4)}">${drums.map((d, i) => `<button class="pad drum" data-d="${esc(d)}" style="--pc:${inst(d).color}"><span class="pad-label">${esc(d)}</span>${keys && i < JAM_DRUM_KEYS.length ? `<kbd>${JAM_DRUM_KEYS[i].toUpperCase()}</kbd>` : ""}</button>`).join("")}</div>` : ""}
      <div class="jam-hint">${es.jam.rec ? "Play along. Everything you play goes into this part, layered each time the loop comes round. Undo takes the whole recording back out." : keys ? "Play with the pads or your keyboard. Press Record (or R) to put what you play into the song." : "Tap along with the beat. Press Record to put what you play into the song."}</div>`;

    box.querySelectorAll(".pad").forEach((el) => {
        const id = el.dataset.d ? `d:${el.dataset.d}` : `m:${el.dataset.i}`;
        el.addEventListener("pointerdown", (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); padDown(id, el); });
        for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(ev, () => padUp(id));
        el.addEventListener("contextmenu", (e) => e.preventDefault());
    });
    $("#jamRec").onclick = toggleRecord;
    $("#jamTidy").onclick = () => { es.jam.tidy = !es.jam.tidy; renderJam(); };
    updateJamCount();
    jamLoop();
}

function padTarget(id) {
    if (id.startsWith("d:")) return { track: id.slice(2), notes: [null] };
    const p = es.jam.pads[Number(id.slice(2))];
    return p ? { track: melodyTrack(), notes: p.notes } : null;
}

function padDown(id, el) {
    if (es.jam.held.has(id)) return;
    const target = padTarget(id);
    if (!target?.track || !inst(target.track)) return;
    el ??= padEl(id);
    const { track, notes } = target;
    const drum = inst(track).type === "drum";
    for (const m of notes) player.preview(song(), track, drum ? 60 : m, drum ? 1 : role(track) === "pad" ? 8 : 3, 1);
    sing(track, { note: notes[0] }, drum ? 0.2 : 0.4);
    el?.classList.add("down");
    const rec = notes.map((m) => recordHit(track, drum ? null : m)).filter(Boolean);
    es.jam.held.set(id, { track, rec, t0: performance.now(), el });
}

function padUp(id) {
    const h = es.jam.held.get(id);
    if (!h) return;
    es.jam.held.delete(id);
    h.el?.classList.remove("down");
    if (!h.rec.length || inst(h.track)?.type === "drum") return;
    const st = 60 / song().bpm / song().stepsPerBeat;
    const grid = es.jam.tidy ? 2 : 1;
    const held = (performance.now() - h.t0) / 1000 / st;
    const min = role(h.track) === "pad" ? 4 : grid;
    const len = Math.max(min, Math.round(held / grid) * grid);
    for (const n of h.rec) n.length = Math.max(1, Math.min(len, pattern().steps - n.step));
    markChanged();
}

const padEl = (id) => (id.startsWith("d:")
    ? document.querySelector(`#eJam .pad[data-d="${CSS.escape(id.slice(2))}"]`)
    : document.querySelector(`#eJam .pad[data-i="${id.slice(2)}"]`));

function recordHit(track, midi) {
    if (!es.jam.rec) return null;
    const pos = player.position();
    if (!pos || pos.pattern !== state.selPattern) return null;
    const p = pattern();
    const grid = es.jam.tidy ? 2 : 1;
    const q = Math.round(pos.raw / grid) * grid;
    const step = mod(q, p.steps);
    const list = notesOf(track);
    if (list.some((n) => n.step === step && n.note === midi)) return null;
    const n = { step, note: midi, length: midi === null ? 1 : grid, velocity: 1 };
    if (q >= pos.scheduled) n.skipOnce = true; // you just heard it; don't play it again a moment later
    list.push(n);
    es.jam.take++;
    markChanged();
    updateJamCount();
    return n;
}

function updateJamCount() {
    const el = $("#jamCount");
    if (el) el.textContent = es.jam.rec ? `${es.jam.take} note${es.jam.take === 1 ? "" : "s"}` : "";
}

const isPlaying = () => document.querySelector(".easy [data-play]")?.classList.contains("on");

function toggleRecord() {
    if (!es.jam.rec) {
        pushHistory();
        es.jam.rec = true;
        es.jam.take = 0;
        if (state.mode !== "pattern") setMode("pattern");
        if (!isPlaying()) togglePlay();
    } else {
        es.jam.rec = false;
        toast(es.jam.take ? `Recorded ${es.jam.take} note${es.jam.take === 1 ? "" : "s"} into Part ${state.selPattern}` : "Nothing recorded");
        renderParts();
    }
    renderJam();
}

let jamRaf = 0;
function jamLoop() {
    cancelAnimationFrame(jamRaf);
    const tick = () => {
        if (!es.jam.on) return;
        const fill = $("#jamFill");
        const pos = player.position();
        if (fill) fill.style.width = pos && pos.pattern === state.selPattern ? `${(pos.step / pos.steps) * 100}%` : "0%";
        jamRaf = requestAnimationFrame(tick);
    };
    tick();
}

// Pads light up when the loop plays their notes back.
function jamStep(info) {
    if (!es.jam.on || !info || info.pattern !== state.selPattern) return;
    const p = pattern();
    const t = melodyTrack();
    for (const n of p.tracks[t] ?? []) {
        if (n.step !== info.step) continue;
        const i = es.jam.pads.findIndex((pad) => pad.notes.includes(n.note));
        if (i >= 0) flash(padEl(`m:${i}`));
    }
    for (const d of drumTracks()) if ((p.tracks[d] ?? []).some((n) => n.step === info.step)) flash(padEl(`d:${d}`));
}

function flash(el) {
    if (!el || el.classList.contains("down")) return;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
}

function toggleJam() {
    es.jam.on = !es.jam.on;
    if (es.jam.on && es.cv.on) { es.cv.on = false; es.chordOpen = undefined; renderChordsView(); }
    if (!es.jam.on && es.jam.rec) toggleRecord();
    closePop();
    renderJam();
    if (!es.jam.on) render();
}

// Keyboard: A–K melody pads, Z–M drum pads, R record. Runs before the Studio's own keyboard piano.
window.addEventListener("keydown", (e) => {
    if (!es.jam.on || state.ui !== "easy" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.("input:not([type=range]), select, textarea") || !$("#modal").hidden || !$("#landing").hidden) return;
    const k = e.key.toLowerCase();
    const mi = JAM_KEYS.indexOf(k);
    const di = JAM_DRUM_KEYS.indexOf(k);
    let id = null;
    if (mi >= 0 && es.jam.pads[mi]) id = `m:${mi}`;
    else if (di >= 0 && drumTracks()[di]) id = `d:${drumTracks()[di]}`;
    if (id) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) padDown(id); return; }
    if (k === "r" && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); toggleRecord(); }
}, true);
window.addEventListener("keyup", (e) => {
    if (!es.jam.on) return;
    const k = e.key.toLowerCase();
    const mi = JAM_KEYS.indexOf(k);
    const di = JAM_DRUM_KEYS.indexOf(k);
    if (mi >= 0) padUp(`m:${mi}`);
    else if (di >= 0 && drumTracks()[di]) padUp(`d:${drumTracks()[di]}`);
}, true);

// ---------- Draw: make a song without a grid ----------
// Draw a line for the selected band member: left to right is time, up is higher. The line snaps to
// notes that fit the song. Chords are picked by feeling along the top; drums come from the Beat.

const VIEW_PREF = store.get(EASY_PREFS, {}).view;
es.view = ["draw", "grid", "jam"].includes(VIEW_PREF) ? VIEW_PREF : "draw";
es.jam.on = es.view === "jam";
es.draw = { tool: "draw", rhythm: store.get(EASY_PREFS, {}).rhythm ?? "bouncy", stroke: null, lastPitch: null };
const RHYTHMS = [
    { id: "smooth", name: "Smooth", tip: "Long, flowing notes" },
    { id: "bouncy", name: "Bouncy", tip: "A note every half-beat" },
    { id: "busy", name: "Busy", tip: "Quick notes" },
];
const drawCanvas = $("#eDraw");

function saveEasyPrefs() {
    store.set(EASY_PREFS, { safe: es.safe, view: es.view, rhythm: es.draw.rhythm });
}

function setView(v) {
    if (v === es.view && !es.cv.on) return;
    if (es.cv.on) { es.cv.on = false; es.chordOpen = undefined; }
    if (es.jam.rec && v !== "jam") toggleRecord();
    es.view = v;
    es.jam.on = v === "jam";
    saveEasyPrefs();
    closePop();
    render();
}

function renderViews() {
    const draw = es.view === "draw" && !es.cv.on;
    const grid = es.view === "grid" && !es.cv.on && !es.jam.on;
    document.body.classList.toggle("view-draw", es.view === "draw");
    document.body.classList.toggle("view-grid", es.view === "grid");
    document.body.classList.toggle("view-jam", es.view === "jam");
    document.querySelectorAll("#eViewSeg [data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === es.view && !es.cv.on));
    $("#eDrawView").hidden = !draw;
    canvas.hidden = !grid;
    if (!grid) $("#ePager").hidden = true;
    if (draw) renderDrawBar();
    requestDrawView();
}

function renderDrawBar() {
    const t = melodyTrack();
    const isPad = t && role(t) === "pad";
    $("#eDrawBar").innerHTML = `
        <div class="seg"><button data-tool="draw" class="${es.draw.tool === "draw" ? "on" : ""}">✎ Draw</button><button data-tool="erase" class="${es.draw.tool === "erase" ? "on" : ""}">⌫ Erase</button></div>
        <div class="seg" title="How the line turns into notes">${RHYTHMS.map((r) => `<button data-rhythm="${r.id}" class="${es.draw.rhythm === r.id ? "on" : ""}" title="${r.tip}">${r.name}</button>`).join("")}</div>
        <div class="spacer"></div>
        <span class="d-who" style="--c:${t ? inst(t).color : "#8d8ca3"}"><i></i>${t ? `Drawing for <b>${esc(t)}</b>` : "Add a band member to draw"}${isPad ? " · its notes follow the chords" : ""}</span>
        <button class="btn ghost small-btn" id="dClear">Clear</button>`;
    $("#eDrawBar").querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => { es.draw.tool = b.dataset.tool; renderDrawBar(); }));
    $("#eDrawBar").querySelectorAll("[data-rhythm]").forEach((b) => (b.onclick = () => { es.draw.rhythm = b.dataset.rhythm; saveEasyPrefs(); renderDrawBar(); }));
    $("#dClear").onclick = () => {
        if (!t || !(pattern().tracks[t] ?? []).length) return;
        edit(() => { pattern().tracks[t] = []; });
    };
}

// ----- layout -----
function drawLayout() {
    const host = $("#eDrawView");
    const W = drawCanvas.clientWidth || host.clientWidth;
    const H = drawCanvas.clientHeight || 300;
    const p = pattern();
    const t = melodyTrack();
    const rows = t ? melodyRows(t) : [];
    const top = 34, bottom = 26, padL = 14, padR = 14;
    const laneH = Math.max(60, H - top - bottom);
    return {
        W, H, p, t, rows, top, bottom, padL, padR, laneH, steps: p.steps,
        stepW: (W - padL - padR) / p.steps,
        rowH: rows.length ? laneH / rows.length : laneH,
    };
}
const dx = (L, step) => L.padL + step * L.stepW;
function dy(L, midi) {
    if (!L.rows.length) return L.top + L.laneH / 2;
    let idx = L.rows.indexOf(midi);
    if (idx < 0) {
        // nearest row (rows run high → low)
        let best = 0, dist = Infinity;
        L.rows.forEach((m, i) => { if (Math.abs(m - midi) < dist) { dist = Math.abs(m - midi); best = i; } });
        idx = best;
    }
    return L.top + (idx + 0.5) * L.rowH;
}
const pitchAtY = (L, y) => L.rows[clamp(Math.floor((y - L.top) / L.rowH), 0, L.rows.length - 1)];
const stepAtX = (L, x) => clamp((x - L.padL) / L.stepW, 0, L.steps - 0.001);

// ----- drawing the view -----
let drawViewQueued = false;
function requestDrawView() {
    if (drawViewQueued || es.view !== "draw" || es.cv.on) return;
    drawViewQueued = true;
    requestAnimationFrame(() => { drawViewQueued = false; paintDrawView(); });
}

function noteLine(c, L, notes, color, width, alpha, glowStep = -1) {
    const sorted = [...notes].filter((n) => n.note !== null).sort((a, b) => a.step - b.step);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = color;
    c.globalAlpha = alpha;
    c.lineWidth = width;
    // connected runs: notes that touch are joined by a smooth curve
    let run = [];
    const flush = () => {
        if (!run.length) return;
        c.beginPath();
        run.forEach((n, i) => {
            const x0 = dx(L, n.step) + 3, x1 = dx(L, n.step + n.length) - 3, y = dy(L, n.note);
            if (i === 0) c.moveTo(x0, y);
            else {
                const prev = run[i - 1];
                const px = dx(L, prev.step + prev.length) - 3, py = dy(L, prev.note);
                const mid = (px + x0) / 2;
                c.bezierCurveTo(mid, py, mid, y, x0 + 1, y);
            }
            c.lineTo(Math.max(x0 + 0.5, x1), y);
        });
        c.stroke();
        run = [];
    };
    sorted.forEach((n, i) => {
        const prev = sorted[i - 1];
        if (prev && n.step > prev.step + prev.length) flush();
        run.push(n);
    });
    flush();
    // the note that's playing glows
    if (glowStep >= 0) {
        for (const n of sorted) {
            if (glowStep < n.step || glowStep >= n.step + n.length) continue;
            c.globalAlpha = 1;
            c.shadowColor = color;
            c.shadowBlur = 16;
            c.beginPath();
            c.arc(dx(L, glowStep + 0.5), dy(L, n.note), width * 0.9, 0, Math.PI * 2);
            c.fillStyle = "#fff";
            c.fill();
            c.shadowBlur = 0;
        }
    }
    c.globalAlpha = 1;
}

function paintDrawView() {
    if (es.view !== "draw" || es.cv.on || !state.song) return;
    const dpr = devicePixelRatio || 1;
    const host = $("#eDrawView");
    const W = Math.round(drawCanvas.clientWidth), H = Math.round(drawCanvas.clientHeight);
    if (!W || !H) return;
    if (drawCanvas.width !== W * dpr || drawCanvas.height !== H * dpr) { drawCanvas.width = W * dpr; drawCanvas.height = H * dpr; }
    const c = drawCanvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = drawLayout();
    es.dlayout = L;
    const s = song();
    const p = L.p;
    const pos = player.position();
    const playing = pos && pos.pattern === state.selPattern;
    const playStep = playing ? pos.step : -1;

    // background: a soft glow, no grid
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#17172a");
    bg.addColorStop(1, "#111118");
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // bars: very faint dividers so you know where you are in the loop
    for (let st = 0; st <= L.steps; st += s.stepsPerBeat * 4) {
        c.fillStyle = "rgba(255,255,255,0.05)";
        c.fillRect(Math.round(dx(L, st)), L.top, 1, L.laneH);
    }
    // home notes: dotted lines, so the "home" of the key is easy to find
    const root = KEYS.indexOf(s.key);
    c.setLineDash([2, 6]);
    c.strokeStyle = "rgba(111,182,255,0.28)";
    c.lineWidth = 1;
    L.rows.forEach((m) => {
        if (mod(m - root, 12) !== 0) return;
        const y = dy(L, m);
        c.beginPath(); c.moveTo(L.padL, y); c.lineTo(W - L.padR, y); c.stroke();
        c.fillStyle = "rgba(111,182,255,0.55)";
        c.font = "700 9px Nunito, sans-serif";
        c.fillText("home note", W - L.padR - 52, y - 4);
    });
    c.setLineDash([]);

    // chord row along the top
    const chords = displayChords(p);
    const n = chordCount(p);
    const seg = L.steps / n;
    for (let i = 0; i < n; i++) {
        const x0 = dx(L, i * seg) + 2, x1 = dx(L, (i + 1) * seg) - 2;
        const d = chords?.[i];
        const f = d === undefined ? null : feeling(d);
        const active = playStep >= i * seg && playStep < (i + 1) * seg;
        c.globalAlpha = active ? 0.45 : 0.2;
        c.fillStyle = f?.tint ?? "#8d8ca3";
        rr(c, x0, 6, x1 - x0, 22, 11);
        c.globalAlpha = 1;
        c.font = "800 12px Nunito, sans-serif";
        c.fillStyle = "#ecebf5";
        const name = d === undefined ? "Chord" : chordName(d, colorAt(p, i));
        c.fillText(name, x0 + 10, 21);
        if (f && x1 - x0 > 90) {
            c.font = "700 11px Nunito, sans-serif";
            c.fillStyle = f.tint;
            c.fillText(f.word, x0 + 16 + c.measureText(name).width + 4, 21);
        }
        c.fillStyle = "rgba(236,235,245,0.5)";
        c.font = "800 11px Nunito, sans-serif";
        c.fillText("▾", x1 - 16, 21);
    }

    // other band members, faint, then the selected one on top
    for (const t of melodicTracks()) {
        if (t === L.t || role(t) === "pad") continue;
        noteLine(c, L, p.tracks[t] ?? [], inst(t).color, 3, 0.25);
    }
    if (L.t) noteLine(c, L, p.tracks[L.t] ?? [], inst(L.t).color, 7, 1, playing ? Math.floor(playStep) : -1);

    // the stroke being drawn
    const st = es.draw.stroke;
    if (st && st.pts.length > 1) {
        c.strokeStyle = st.erase ? "rgba(255,107,125,0.7)" : "rgba(255,255,255,0.55)";
        c.lineWidth = st.erase ? 14 : 2;
        c.lineCap = "round";
        c.beginPath();
        st.pts.forEach((pt, i) => (i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
        c.stroke();
    }

    // drums: a row of dots along the bottom that pulse with the beat
    const by = H - L.bottom / 2 - 2;
    const hits = new Array(L.steps).fill(0);
    for (const d of drumTracks()) for (const h of p.tracks[d] ?? []) if (h.step < L.steps && audible(d)) hits[h.step] += h.velocity;
    for (let i = 0; i < L.steps; i++) {
        const x = dx(L, i + 0.5);
        const lit = playing && Math.floor(playStep) === i;
        const r = hits[i] ? 2 + Math.min(3, hits[i] * 1.4) : 1.2;
        c.fillStyle = lit ? "#fff" : hits[i] ? "rgba(255,143,179,0.75)" : "rgba(255,255,255,0.12)";
        c.beginPath(); c.arc(x, by, lit && hits[i] ? r + 2 : r, 0, Math.PI * 2); c.fill();
    }

    // playhead
    if (playing) {
        const x = dx(L, playStep);
        const grad = c.createLinearGradient(x - 18, 0, x + 2, 0);
        grad.addColorStop(0, "rgba(185,170,255,0)");
        grad.addColorStop(1, "rgba(185,170,255,0.22)");
        c.fillStyle = grad;
        c.fillRect(x - 18, L.top, 20, L.laneH);
        c.fillStyle = "rgba(236,233,255,0.8)";
        c.fillRect(x, L.top, 1.5, L.laneH);
    }

    // first-time hint
    if (L.t && !(p.tracks[L.t] ?? []).length && !st) {
        c.textAlign = "center";
        c.fillStyle = "rgba(236,235,245,0.75)";
        c.font = "800 18px Nunito, sans-serif";
        c.fillText(role(L.t) === "pad" ? `${L.t} plays the chords along the top` : `Draw a line to give ${L.t} a melody`, W / 2, L.top + L.laneH / 2 - 8);
        c.font = "600 13px Nunito, sans-serif";
        c.fillStyle = "rgba(141,140,163,0.9)";
        c.fillText(role(L.t) === "pad" ? "Tap a chord name to change how it feels" : "Higher on the screen means higher notes. Lift your pen for a pause.", W / 2, L.top + L.laneH / 2 + 16);
        c.textAlign = "left";
    }
    if (playing) requestDrawView();
}

// ----- turning a stroke into notes -----
function strokeToNotes(L, pts) {
    const res = es.draw.rhythm === "busy" ? 1 : 2;
    // y at each slot: walk the stroke's segments; later parts of the stroke win (drawing back over redraws)
    const ys = new Map();
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
        const s0 = Math.ceil(stepAtX(L, lo) / res - 0.5), s1 = Math.floor(stepAtX(L, hi) / res - 0.5);
        for (let k = s0; k <= s1; k++) {
            const cx = dx(L, (k + 0.5) * res);
            const t = hi - lo < 0.01 ? 0 : (cx - a.x) / (b.x - a.x);
            ys.set(k, a.y + (b.y - a.y) * clamp(t, 0, 1));
        }
    }
    if (pts.length === 1) ys.set(Math.floor(stepAtX(L, pts[0].x) / res), pts[0].y);
    const slots = [...ys.keys()].filter((k) => k * res < L.steps).sort((a, b) => a - b);
    const out = [];
    for (const k of slots) {
        const note = pitchAtY(L, ys.get(k));
        const prev = out[out.length - 1];
        if (es.draw.rhythm === "smooth" && prev && prev.note === note && prev.step + prev.length === k * res) prev.length += res;
        else out.push({ step: k * res, note, length: res, velocity: 1 });
    }
    return { notes: out, from: slots.length ? slots[0] * res : 0, to: slots.length ? (slots[slots.length - 1] + 1) * res : 0 };
}

function strokeRange(L, pts) {
    const xs = pts.map((p) => p.x);
    return { from: Math.floor(stepAtX(L, Math.min(...xs))), to: Math.ceil(stepAtX(L, Math.max(...xs))) };
}

function applyStroke() {
    const st = es.draw.stroke;
    const L = es.dlayout;
    if (!st || !L?.t) return;
    const base = st.before;
    if (st.erase) {
        const { from, to } = strokeRange(L, st.pts);
        pattern().tracks[L.t] = base.filter((n) => n.step + n.length <= from || n.step >= to).map((n) => ({ ...n }));
        return;
    }
    const { notes, from, to } = strokeToNotes(L, st.pts);
    const kept = base.filter((n) => n.step + n.length <= from || n.step >= to).map((n) => ({ ...n }));
    // trim a kept note that would run into the new line
    for (const n of kept) if (n.step < from && n.step + n.length > from) n.length = from - n.step;
    pattern().tracks[L.t] = [...kept, ...notes];
}

function chordMenuAt(seg, clientX, clientY) {
    const anchor = { getBoundingClientRect: () => ({ left: clientX - 20, right: clientX + 20, top: clientY - 8, bottom: clientY + 8, width: 40, height: 16 }) };
    const p = pattern();
    const cur = displayChords(p)?.[seg];
    const ladder = chordChoices().sort((a, b) => feeling(a).tension - feeling(b).tension);
    openPop(anchor, `<div class="pop-title">Chord ${seg + 1}: how should it feel?</div>
        <div class="d-chords">${ladder.map((d) => {
            const f = feeling(d);
            return `<button data-deg="${d}" class="${d === cur ? "on" : ""}" style="--t:${f.tint}"><b>${esc(chordName(d))}</b><span>${esc(f.word)}</span><small>${esc(f.line)}</small></button>`;
        }).join("")}</div>
        <div class="d-chords-foot"><span>calm at the top, tense at the bottom</span><button class="btn ghost small-btn" id="dMore">More in Chords &amp; mood</button></div>`);
    pop.querySelectorAll("[data-deg]").forEach((b) => (b.onclick = () => {
        const d = Number(b.dataset.deg);
        hearChord(d);
        if (d !== displayChords(pattern())?.[seg] || colorAt(pattern(), seg)) setChord(seg, d);
        pop.querySelectorAll("[data-deg]").forEach((x) => x.classList.toggle("on", x === b));
    }));
    $("#dMore").onclick = () => openChordsView(seg);
}

drawCanvas.addEventListener("pointerdown", (e) => {
    const L = es.dlayout;
    if (!L) return;
    const r = drawCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (y < L.top) {
        const seg = Math.floor(stepAtX(L, x) / (L.steps / chordCount(pattern())));
        chordMenuAt(clamp(seg, 0, chordCount(pattern()) - 1), e.clientX, r.top + L.top);
        return;
    }
    if (!L.t || role(L.t) === "pad" || y > L.top + L.laneH) return;
    e.preventDefault();
    drawCanvas.setPointerCapture(e.pointerId);
    pushHistory();
    es.draw.stroke = { pts: [{ x, y }], erase: es.draw.tool === "erase" || e.button === 2, before: (pattern().tracks[L.t] ?? []).map((n) => ({ ...n })) };
    es.draw.lastPitch = null;
    applyStroke();
    hearPen(L, y);
    requestDrawView();
});
drawCanvas.addEventListener("pointermove", (e) => {
    const st = es.draw.stroke;
    const L = es.dlayout;
    if (!st || !L) return;
    const r = drawCanvas.getBoundingClientRect();
    const x = clamp(e.clientX - r.left, L.padL, L.W - L.padR), y = clamp(e.clientY - r.top, L.top, L.top + L.laneH - 1);
    st.pts.push({ x, y });
    applyStroke();
    hearPen(L, y);
    requestDrawView();
});
function endStroke() {
    if (!es.draw.stroke) return;
    es.draw.stroke = null;
    markChanged();
    renderParts();
    renderBand();
    requestDrawView();
}
drawCanvas.addEventListener("pointerup", endStroke);
drawCanvas.addEventListener("pointercancel", endStroke);
drawCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

// You hear the note under your pen as it changes.
function hearPen(L, y) {
    if (es.draw.stroke?.erase) return;
    const m = pitchAtY(L, y);
    if (m === es.draw.lastPitch) return;
    es.draw.lastPitch = m;
    player.preview(song(), L.t, m, 2, 0.85);
    sing(L.t, { note: m }, 0.2);
}

new ResizeObserver(() => requestDrawView()).observe(drawCanvas);

// ---------- Game mode: changing the music of one of the site's games ----------
// Opened from a game's ♪ button (/music/?game=<slot>). The song you make here plays in that game.

es.game = null; // { slot }

async function slotDefault(slot) {
    return normalizeSong(await (await fetch(`songs/${slot.default}`)).json());
}

async function openGame(slot, { shared } = {}) {
    let s = shared ?? getGameSongOverride(slot.id);
    if (!s) s = await slotDefault(slot);
    player.stop();
    setSong(s, { dirty: !!shared });
    es.center = {};
    es.game = { slot };
    const mel = melodyTrack();
    if (mel) state.selTrack = mel;
    window.history.replaceState(null, "", `${location.pathname}?game=${encodeURIComponent(slot.id)}`);
    hideLanding();
    renderGameBar();
    renderAll();
    toast(shared ? "Someone sent you this song. Change it, or play the game with it" : `This is the music in ${slot.gameTitle}. Press play, then change anything`);
}

function leaveGame() {
    if (!es.game) return;
    es.game = null;
    window.history.replaceState(null, "", location.pathname);
    renderGameBar();
}

function renderGameBar() {
    const bar = $("#eGameBar");
    document.body.classList.toggle("in-game", !!es.game);
    if (!es.game) { bar.hidden = true; bar.innerHTML = ""; return; }
    const { slot } = es.game;
    const mine = !!getGameSongOverride(slot.id);
    bar.hidden = false;
    bar.innerHTML = `
      <span class="g-art" style="${slot.thumbnail ? `--img:url('${esc(slot.thumbnail)}')` : ""}"></span>
      <span class="g-txt"><small>Music for</small><b>${esc(slot.gameTitle)}</b></span>
      <span class="g-grow"></span>
      ${mine ? `<button class="btn ghost small-btn" id="gReset" title="Go back to the game's original music">Original</button>` : ""}
      <button class="btn ghost small-btn" id="gShare" title="Copy a link: friends play the game with your music">Share</button>
      <button class="btn primary g-play" id="gPlay">▶ Play ${esc(slot.gameTitle)} with it</button>
      <button class="g-x" id="gLeave" title="Stop making music for this game" aria-label="Close">×</button>`;
    $("#gPlay").onclick = () => {
        if (!setGameSong(slot.id, song())) { toast("Couldn't save, browser storage is blocked"); return; }
        state.dirty = false;
        player.stop();
        location.href = slot.path;
    };
    $("#gShare").onclick = async () => {
        const code = await encodeShare(JSON.stringify(JSON.parse(serializeSong(song()))));
        const url = new URL(slot.path, location.href);
        url.searchParams.set("music", code);
        try {
            await navigator.clipboard.writeText(url.href);
            toast(`Link copied. Whoever opens it plays ${slot.gameTitle} with your music`);
        } catch {
            openModal(`<h2>Share your music</h2><p>Whoever opens this link plays ${esc(slot.gameTitle)} with your music.</p><input class="insp-name" style="width:100%" readonly>`);
            const input = document.querySelector("#modalBody input");
            input.value = url.href;
            input.select();
        }
    };
    $("#gReset") && ($("#gReset").onclick = async () => {
        setGameSong(slot.id, null);
        player.stop();
        setSong(await slotDefault(slot));
        renderGameBar();
        renderAll();
        toast(`${slot.gameTitle} plays its original music again`);
    });
    $("#gLeave").onclick = leaveGame;
}

hooks.boot = async () => {
    const params = new URLSearchParams(location.search);
    const id = params.get("game");
    if (!id) return false;
    const m = await manifest();
    const slot = m.slots.find((x) => x.id === id);
    if (!slot) return false;
    let shared;
    try { if (params.get("music")) shared = normalizeSong(JSON.parse(await decodeShare(params.get("music")))); } catch { /* ignore */ }
    try { await openGame(slot, { shared }); return true; } catch { return false; }
};

// ---------- Landing ----------

const STYLE_START = {
    chip: { scale: ["major", "minor"], beat: "Gallop" },
    lofi: { scale: ["dorian", "minor"], beat: "Hip-hop" },
    dreamy: { scale: ["lydian", "major"], beat: "Slow" },
    synth: { scale: ["minor", "dorian"], beat: "Dance" },
    fairy: { scale: ["major", "mixolydian"], beat: "Basic" },
};

function starterSong(style) {
    const cfg = STYLE_START[style.id];
    const raw = {
        format: "olid-song", version: 1, title: `My ${style.name} song`, bpm: style.bpm, swing: style.swing, style: style.id,
        key: rnd(["C", "D", "E", "F", "G", "A"]), scale: rnd(cfg.scale), instruments: {}, patterns: { A: { steps: 32, tracks: {} } }, arrangement: ["A"],
    };
    const add = (name, inst) => (raw.instruments[name] = { ...inst, color: TRACK_COLORS[Object.keys(raw.instruments).length % TRACK_COLORS.length] });
    add("Melody", { ...findPreset(style.sounds.lead), role: "lead" });
    add("Chords", { ...findPreset(style.sounds.pad), role: "pad" });
    add("Bass", { ...findPreset(style.sounds.bass), role: "bass" });
    for (const kind of ["kick", "snare", "hat"]) add({ kick: "Kick", snare: "Snare", hat: "Hi-hat" }[kind], kitDrum(style.kit, kind));
    const s = normalizeSong(raw);
    const p = s.patterns.A;
    // borrow the generators: they read from the current song
    return { song: s, fill() {
        ensureChords(p, true);
        p.tracks.Chords = genPad(p);
        p.tracks.Bass = genBass(p);
        es.beat = Math.max(0, BEATS.findIndex((b) => b.name === cfg.beat));
        const beat = BEATS[es.beat];
        for (const t of ["Kick", "Snare", "Hi-hat"]) {
            const line = { Kick: beat.kick, Snare: beat.snare, "Hi-hat": beat.hat }[t];
            p.tracks[t] = [];
            for (let st = 0; st < p.steps; st++) if ("xo".includes(line[st % 16]) && line[st % 16]) p.tracks[t].push({ step: st, note: null, length: 1, velocity: line[st % 16] === "x" ? 1 : 0.55 });
        }
    } };
}

async function startFresh(style) {
    if (!(await confirmDiscard())) return;
    leaveGame();
    player.stop();
    const { song: s, fill } = starterSong(style);
    setSong(s, { dirty: true });
    fill();
    markChanged();
    state.selTrack = "Melody";
    es.center = {};
    hideLanding();
    renderAll();
    popAll();
    toast("Chords, bass and drums are ready. Now add a melody");
}

async function remix(entry) {
    try {
        const raw = await (await fetch(`songs/${entry.file}`)).json();
        if (!(await confirmDiscard())) return;
        player.stop();
        setSong(normalizeSong(raw), { dirty: true });
        es.center = {};
        hideLanding();
        toast("Press play, then try Vibe, Sound or ✦ Make");
    } catch (err) {
        toast("Couldn't open that song: " + err.message);
    }
}

const landing = $("#landing");
async function showLanding() {
    closePop();
    const m = await manifest();
    const draft = state.song;
    const mine = Object.entries(mySongs()).sort((a, b) => b[1].updated - a[1].updated).slice(0, 6);
    const hasWork = draft && (state.dirty || state.fileId) ;
    $("#lContinue").innerHTML = hasWork
        ? `<button class="l-continue"><span>Keep going</span><b>${esc(draft.title || "Untitled")}</b></button>` : "";
    $("#lContinue").querySelector("button")?.addEventListener("click", hideLanding);
    $("#lGames").innerHTML = m.slots.map((s, i) => `
        <button class="l-card game" data-i="${i}" style="${s.thumbnail ? `--img:url('${esc(s.thumbnail)}')` : ""}">
          <span class="l-card-art${s.thumbnail ? " img" : ""}"></span>
          <span class="l-card-text"><b>${esc(s.gameTitle)}</b><small>${getGameSongOverride(s.id) ? "Playing your music" : "Change its music"}</small></span>
        </button>`).join("") || `<div class="list-empty">Games will show up here.</div>`;
    $("#lGames").querySelectorAll("[data-i]").forEach((b) => (b.onclick = async () => {
        if (!(await confirmDiscard())) return;
        openGame(m.slots[Number(b.dataset.i)]).catch((err) => toast("Couldn't open that: " + err.message));
    }));
    $("#lStyles").innerHTML = STYLES.map((s) => `
        <button class="l-card style s-${s.id}" data-s="${s.id}"><span class="l-card-art"></span>
          <span class="l-card-text"><b>${esc(s.name)}</b><small>${esc({ chip: "Retro game bleeps", lofi: "Slow and cosy", dreamy: "Bells and soft pads", synth: "80s neon", fairy: "Flutes and strings" }[s.id])}</small></span></button>`).join("");
    $("#lStyles").querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => startFresh(STYLES.find((x) => x.id === b.dataset.s))));
    $("#lMine").innerHTML = mine.length ? `<h3>Your songs</h3><div class="l-mine">${mine.map(([id, s]) => `<button data-id="${id}">${esc(s.title)}<small>${ago(s.updated)}</small></button>`).join("")}</div>` : "";
    $("#lMine").querySelectorAll("[data-id]").forEach((b) => (b.onclick = async () => {
        const id = b.dataset.id;
        if (id !== state.fileId && !(await confirmDiscard())) return;
        leaveGame();
        setSong(normalizeSong(JSON.parse(mySongs()[id].json)), { fileId: id });
        hideLanding();
    }));
    landing.hidden = false;
    document.body.classList.add("landing-open");
}

function hideLanding() {
    landing.hidden = true;
    document.body.classList.remove("landing-open");
    requestDraw();
}

// ---------- Wiring ----------

function wire() {
    const title = $("#eTitle");
    title.addEventListener("focus", () => pushHistory());
    title.addEventListener("input", () => { song().title = title.value; markChanged(); });
    title.addEventListener("keydown", (e) => { if (e.key === "Enter") title.blur(); });

    const speed = $("#eSpeed");
    speed.addEventListener("pointerdown", () => pushHistory());
    speed.addEventListener("input", () => { song().bpm = Number(speed.value); $("#eSpeedOut").textContent = speed.value; });
    speed.addEventListener("change", markChanged);

    $("#eGen").onclick = () => { const t = melodyTrack(); if (t) generateFor(t); if (es.jam.on) renderJam(); };
    document.querySelectorAll("#eViewSeg [data-view]").forEach((b) => (b.onclick = () => setView(b.dataset.view)));
    $("#eBeat").onclick = () => {
        es.beat = (es.beat + 1) % BEATS.length;
        applyBeat(BEATS[es.beat]);
        if (!player.playing) toast(`Beat: ${BEATS[es.beat].name}. Press play to hear it`);
    };
    $("#eVibe").onclick = toggleChordsView;
    $("#eSafe").onclick = () => {
        es.safe = !es.safe;
        store.set(EASY_PREFS, { safe: es.safe });
        toast(es.safe ? "Showing only the safest notes" : "Showing every note in the key");
        render();
    };
    const shift = (d) => { const t = melodyTrack(); if (!t) return; es.center[t] = (es.center[t] ?? defaultCenter(t)) + d; draw(); };
    $("#eUp").onclick = () => shift(12);
    $("#eDown").onclick = () => shift(-12);
    $("#eClear").onclick = () => {
        const t = melodyTrack();
        const targets = [t, ...drumTracks()].filter((x) => x && (pattern().tracks[x] ?? []).length);
        if (!targets.length) return;
        openPop($("#eClear"), `<div class="pop-title">Clear this part</div><div class="pop-list">
            ${t && (pattern().tracks[t] ?? []).length ? `<button data-c="one">${esc(t)}'s notes</button>` : ""}
            ${drumTracks().some((d) => (pattern().tracks[d] ?? []).length) ? `<button data-c="drums">The drums</button>` : ""}
            <button data-c="all">Everything</button></div>`);
        pop.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => {
            const which = b.dataset.c;
            edit(() => {
                const p = pattern();
                const list = which === "one" ? [t] : which === "drums" ? drumTracks() : trackNames();
                for (const x of list) p.tracks[x] = [];
                if (which === "all") { delete p.chords; delete p.colors; }
            });
            closePop();
        }));
    };
    $("#eClear").dataset.pop = "";
    $("#eMoreBtn").onclick = (e) => moreMenu(e.currentTarget);
    $("#eHome").onclick = showLanding;
    $("#lClose").onclick = hideLanding;

    new ResizeObserver(() => requestDraw()).observe(stage);
}

hooks.render = render;
hooks.onStep = (info) => {
    if (state.ui !== "easy") return;
    bandStep(info);
    jamStep(info);
    if (es.view === "draw") requestDrawView();
    if (es.cv.on) {
        const p = pattern();
        const playing = info && info.pattern === state.selPattern ? Math.floor(info.step / (p.steps / chordCount(p))) : -1;
        document.querySelectorAll("#cvArc .arc-pt").forEach((g) => g.classList.toggle("playing", Number(g.dataset.seg) === playing));
    }
    if (info && info.pattern === state.selPattern) {
        followPlayhead(info);
        const now = performance.now();
        for (const [t, notes] of Object.entries(pattern().tracks)) {
            if (t !== melodyTrack() && inst(t)?.type !== "drum") continue;
            for (const n of notes) if (n.step === info.step) es.anim.set(`${t}:${n.step}:${n.note}`, now);
        }
    }
    if (state.mode === "song") {
        document.querySelectorAll("#eParts .e-part").forEach((c) => c.classList.toggle("now", !!info && Number(c.dataset.index) === info.index));
        if (info && info.pattern === state.selPattern && !document.querySelector(`#eParts .e-part.sel[data-index="${info.index}"]`)) renderParts();
    }
    requestDraw();
};
hooks.firstVisit = () => { if (state.ui === "easy") showLanding(); };

wire();
start();
