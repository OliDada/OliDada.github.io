// Studio: the music maker for olid.is.
// Edits olid-song files (see FORMAT.md) and plays them through the same player the games use.

import {
    createPlayer, normalizeSong, serializeSong, renderSong, midiToNote,
    getGameSongOverride, setGameSong, DRUM_KINDS, withDefaults,
} from "./player.js";
import { PRESETS, findPreset, TEMPLATES, songFromTemplate, TRACK_COLORS, KEYS, SCALES, inScale } from "./presets.js";

const $ = (sel) => document.querySelector(sel);
const LOW = 24;   // C1
const HIGH = 96;  // C7
const KEYS_W = 54;
const PATTERN_COLORS = ["#9b87ff", "#4fd1c5", "#ffb547", "#ff7aa8", "#6fb6ff", "#a3e05f", "#ff8a5c", "#e07bff"];
const KEYBOARD = "awsedftgyhujkolp;'"; // computer keys -> semitones above the keyboard octave
const STORE = { draft: "olid-music:draft", songs: "olid-music:mysongs", prefs: "olid-music:prefs" };

const player = createPlayer({ volume: 0.8 });

// Easy mode (easy.js) plugs in here.
export const hooks = { render: null, onStep: null, firstVisit: null };

export const state = {
    ui: "easy",
    song: null,
    selTrack: null,
    selPattern: null,
    selBlock: 0,
    mode: "pattern",
    noteLen: 2,
    scaleOnly: true,
    kbOctave: 4,
    fileId: null,
    dirty: false,
    playPos: null,
    mix: { muted: new Set(), soloed: new Set() },
    layout: null,
    drag: null,
};

// ---------- Storage ----------

const store = {
    get(key, fallback = null) {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
};

export function savePrefs() {
    store.set(STORE.prefs, { ui: state.ui, scaleOnly: state.scaleOnly, noteLen: state.noteLen, mode: state.mode, kbOctave: state.kbOctave });
}

let draftTimer = null;
function saveDraftSoon() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => store.set(STORE.draft, { json: serializeSong(state.song), fileId: state.fileId, dirty: state.dirty }), 400);
}

const mySongs = () => store.get(STORE.songs, {});

// ---------- History ----------

const history = { past: [], future: [] };

function pushHistory() {
    history.past.push(serializeSong(state.song));
    if (history.past.length > 150) history.past.shift();
    history.future = [];
    updateUndoButtons();
}

function restore(json) {
    setSong(normalizeSong(JSON.parse(json)), { keepSelection: true, keepHistory: true, fileId: state.fileId });
    markChanged();
}

function undo() {
    if (!history.past.length) return;
    history.future.push(serializeSong(state.song));
    restore(history.past.pop());
}

function redo() {
    if (!history.future.length) return;
    history.past.push(serializeSong(state.song));
    restore(history.future.pop());
}

function updateUndoButtons() {
    document.querySelectorAll("[data-undo]").forEach((b) => (b.disabled = !history.past.length));
    document.querySelectorAll("[data-redo]").forEach((b) => (b.disabled = !history.future.length));
}

export function setPlayUI(on) {
    document.querySelectorAll("[data-play]").forEach((b) => b.classList.toggle("on", on));
}
const playUIOn = () => document.querySelector("[data-play]")?.classList.contains("on");

// Every undoable change goes through edit().
function edit(fn, { render = true } = {}) {
    pushHistory();
    fn();
    markChanged();
    if (render) renderAll();
}

function markChanged() {
    state.dirty = true;
    updateSaveButton();
    saveDraftSoon();
}

// ---------- Song helpers ----------

const song = () => state.song;
const inst = (name = state.selTrack) => song().instruments[name];
const pattern = (name = state.selPattern) => song().patterns[name];
const trackNames = () => Object.keys(song().instruments);
const drumTracks = () => trackNames().filter((n) => inst(n).type === "drum");
const notesOf = (track = state.selTrack, pat = state.selPattern) => {
    const p = pattern(pat);
    if (!p.tracks[track]) p.tracks[track] = [];
    return p.tracks[track];
};
const patternColor = (name) => PATTERN_COLORS[Object.keys(song().patterns).indexOf(name) % PATTERN_COLORS.length];

function uniqueName(base, taken) {
    if (!taken.includes(base)) return base;
    let i = 2;
    while (taken.includes(`${base} ${i}`)) i++;
    return `${base} ${i}`;
}

function nextPatternName() {
    const taken = Object.keys(song().patterns);
    for (let round = 1; ; round++) {
        for (let c = 65; c <= 90; c++) {
            const name = String.fromCharCode(c) + (round > 1 ? round : "");
            if (!taken.includes(name)) return name;
        }
    }
}

function nextColor() {
    const used = Object.values(song().instruments).map((i) => i.color);
    return TRACK_COLORS.find((c) => !used.includes(c)) ?? TRACK_COLORS[trackNames().length % TRACK_COLORS.length];
}

function ensureColors(s) {
    let i = 0;
    for (const ins of Object.values(s.instruments)) {
        if (!ins.color) ins.color = TRACK_COLORS[i % TRACK_COLORS.length];
        i++;
    }
}

function setSong(s, { keepSelection = false, keepHistory = false, fileId = null, dirty = false } = {}) {
    ensureColors(s);
    state.song = s;
    state.fileId = fileId;
    if (!keepSelection || !s.instruments[state.selTrack]) state.selTrack = trackNames()[0] ?? null;
    if (!keepSelection || !s.patterns[state.selPattern]) state.selPattern = s.arrangement[0] ?? Object.keys(s.patterns)[0];
    state.selBlock = Math.min(state.selBlock, s.arrangement.length - 1);
    if (!keepHistory) {
        history.past = [];
        history.future = [];
        state.dirty = dirty;
        state.mix = { muted: new Set(), soloed: new Set() };
        player.setMix(state.mix);
    }
    player.replaceSong(s);
    if (player.playing && state.mode === "pattern") player.setPattern(state.selPattern);
    updateUndoButtons();
    updateSaveButton();
    renderAll();
    if (!keepSelection) requestAnimationFrame(scrollRollToNotes);
}

function renameTrack(oldName, newName) {
    newName = newName.trim();
    if (!newName || newName === oldName || song().instruments[newName]) return false;
    edit(() => {
        const rebuilt = {};
        for (const [n, i] of Object.entries(song().instruments)) rebuilt[n === oldName ? newName : n] = i;
        song().instruments = rebuilt;
        for (const p of Object.values(song().patterns)) {
            if (p.tracks[oldName]) { p.tracks[newName] = p.tracks[oldName]; delete p.tracks[oldName]; }
        }
        for (const set of [state.mix.muted, state.mix.soloed]) if (set.delete(oldName)) set.add(newName);
        state.selTrack = newName;
    });
    return true;
}

// ---------- Rendering ----------

// Pro mode is only for those who know the address: /music/?pro
const proAllowed = new URLSearchParams(location.search).has("pro");

export function setUi(ui) {
    if (ui === "pro" && !proAllowed) ui = "easy";
    state.ui = ui;
    document.body.classList.toggle("ui-easy", ui === "easy");
    document.body.classList.toggle("ui-pro", ui === "pro");
    savePrefs();
    renderAll();
    if (ui === "pro") requestAnimationFrame(scrollRollToNotes);
}

function renderAll() {
    if (!state.song) return;
    document.querySelectorAll("[data-ui]").forEach((b) => b.classList.toggle("on", b.dataset.ui === state.ui));
    if (state.ui === "easy") {
        renderTop();
        hooks.render?.();
        return;
    }
    document.body.classList.toggle("drum-track", inst()?.type === "drum");
    renderTop();
    renderTracks();
    renderEditorBar();
    renderInspector();
    renderArrangement();
    requestDraw();
}

function renderTop() {
    const s = song();
    if (document.activeElement !== $("#songTitle")) $("#songTitle").value = s.title;
    if (document.activeElement !== $("#bpm")) $("#bpm").value = s.bpm;
    $("#swing").value = s.swing;
    document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === state.mode));
    setPlayUI(player.playing || playUIOn());
    document.title = `${s.title || "Untitled"} · Studio`;
}

function updateSaveButton() {
    document.querySelectorAll("[data-save]").forEach((btn) => {
        btn.textContent = state.dirty || !state.fileId ? "Save" : "Saved";
        btn.classList.toggle("primary", state.dirty || !state.fileId);
    });
}

function renderTracks() {
    const list = $("#trackList");
    list.innerHTML = "";
    const { muted, soloed } = state.mix;
    for (const name of trackNames()) {
        const i = inst(name);
        const row = document.createElement("div");
        const silent = muted.has(name) || (soloed.size && !soloed.has(name));
        row.className = `track${name === state.selTrack ? " sel" : ""}${silent ? " silent" : ""}`;
        row.style.setProperty("--c", i.color);
        const has = (pattern().tracks[name] ?? []).length > 0;
        row.innerHTML = `<span class="dot${has ? " has" : ""}"></span><span class="name"></span><span class="kind">${i.type === "drum" ? "drum" : WAVE_LABEL[i.wave]?.toLowerCase() ?? ""}</span>
            <button class="ms m${muted.has(name) ? " on" : ""}" title="Mute">M</button><button class="ms s${soloed.has(name) ? " on" : ""}" title="Solo">S</button>`;
        row.querySelector(".name").textContent = name;
        row.onclick = (e) => {
            if (e.target.closest(".ms")) return;
            selectTrack(name);
        };
        row.querySelector(".m").onclick = () => toggleMix("muted", name);
        row.querySelector(".s").onclick = () => toggleMix("soloed", name);
        list.append(row);
    }
}

function toggleMix(kind, name) {
    const set = state.mix[kind];
    set.has(name) ? set.delete(name) : set.add(name);
    player.setMix(state.mix);
    renderTracks();
}

function selectTrack(name) {
    if (state.selTrack === name) return;
    const wasDrum = inst()?.type === "drum";
    state.selTrack = name;
    renderAll();
    if (wasDrum !== (inst().type === "drum") || inst().type !== "drum") requestAnimationFrame(scrollRollToNotes);
}

function selectPattern(name, { scroll = false } = {}) {
    state.selPattern = name;
    if (player.playing && state.mode === "pattern") player.setPattern(name);
    renderTracks();
    renderEditorBar();
    renderArrangement();
    requestDraw();
    if (scroll) requestAnimationFrame(scrollRollToNotes);
}

function renderEditorBar() {
    const p = pattern();
    if (document.activeElement !== $("#patternName")) $("#patternName").value = state.selPattern;
    $("#patternSteps").value = String(p.steps);
    $("#songKey").value = song().key;
    $("#songScale").value = SCALES[song().scale] ? song().scale : "chromatic";
    $("#scaleOnly").classList.toggle("on", state.scaleOnly);
    $("#noteLen").value = String(state.noteLen);
    const touch = matchMedia("(pointer: coarse)").matches;
    $("#editorHint").textContent = inst()?.type === "drum"
        ? (touch ? "Tap a step to add or remove a hit." : "Click a step to add a hit · Shift-click for a softer hit · drag to paint · right-click to erase")
        : (touch ? "Tap to add a note, tap a note to remove it. Pick the note length above."
            : "Click to add a note · drag to move · drag its right edge to resize · click a note to delete · Shift for softer · keys A–K play the sound, Z/X change octave");
}

// ---------- Inspector ----------

const WAVES = {
    sine: "M1 7 C5 -2 9 -2 13 7 S21 16 25 7",
    triangle: "M1 11 L7 3 L13 11 L19 3 L25 11",
    square: "M1 11 V3 H9 V11 H17 V3 H25",
    sawtooth: "M1 11 L9 3 V11 L17 3 V11 L25 3",
    noise: "M1 7 L3 3 L5 10 L7 5 L9 12 L11 2 L13 9 L15 4 L17 11 L19 6 L21 10 L23 3 L25 8",
};
const WAVE_LABEL = { sine: "Sine", triangle: "Tri", square: "Square", sawtooth: "Saw", noise: "Noise" };
const DRUM_LABEL = { kick: "Kick", snare: "Snare", clap: "Clap", hat: "Hat", openhat: "Open hat", tom: "Tom", perc: "Perc" };

const pct = (v) => `${Math.round(v * 100)}`;
const sec = (v) => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`);
const FILTER_MAX = 18000;
const filterToSlider = (hz) => (hz <= 0 ? 100 : Math.round((Math.log2(hz / 80) / Math.log2(FILTER_MAX / 80)) * 100));
const sliderToFilter = (v) => (v >= 100 ? 0 : Math.round(80 * 2 ** ((v / 100) * Math.log2(FILTER_MAX / 80))));

const FADER = ["gain", "Fader", 0, 1.5, 0.01, pct, (v) => v ?? 1];
const SYNTH_SECTIONS = [
    ["Sound", [
        FADER,
        ["volume", "Volume", 0, 1, 0.01, pct],
        ["pan", "Pan", -1, 1, 0.05, (v) => (Math.abs(v) < 0.03 ? "C" : `${v < 0 ? "L" : "R"}${Math.round(Math.abs(v) * 100)}`)],
        ["octave", "Octave", -3, 3, 1, (v) => (v > 0 ? `+${v}` : `${v}`)],
        ["detune", "Detune", -100, 100, 1, (v) => `${v}ct`],
    ]],
    ["Shape", [
        ["attack", "Attack", 0, 2, 0.005, sec],
        ["decay", "Decay", 0, 3, 0.01, sec],
        ["sustain", "Sustain", 0, 1, 0.01, pct],
        ["release", "Release", 0, 4, 0.01, sec],
    ]],
    ["Tone", [
        ["filter", "Brightness", 0, 100, 1, (v) => (v >= 100 ? "Open" : sliderToFilter(v) >= 1000 ? `${(sliderToFilter(v) / 1000).toFixed(1)}k` : `${sliderToFilter(v)}`), filterToSlider, sliderToFilter],
        ["resonance", "Resonance", 0, 20, 0.5, (v) => v.toFixed(1)],
        ["filterEnv", "Sweep", 0, 1, 0.01, pct],
    ]],
    ["Character", [
        ["unison", "Voices", 1, 4, 1, (v) => `${v}`],
        ["spread", "Spread", 0, 60, 1, (v) => `${v}ct`],
        ["vibrato", "Vibrato", 0, 60, 1, (v) => `${v}ct`],
        ["vibratoRate", "Vib. speed", 1, 12, 0.5, (v) => `${v}Hz`],
    ]],
    ["Space", [
        ["reverb", "Reverb", 0, 1, 0.01, pct],
        ["delay", "Echo", 0, 1, 0.01, pct],
    ]],
];
const DRUM_SECTIONS = [
    ["Sound", [
        FADER,
        ["volume", "Volume", 0, 1, 0.01, pct],
        ["pan", "Pan", -1, 1, 0.05, (v) => (Math.abs(v) < 0.03 ? "C" : `${v < 0 ? "L" : "R"}${Math.round(Math.abs(v) * 100)}`)],
        ["pitch", "Pitch", 0.5, 2, 0.01, (v) => `${v.toFixed(2)}×`],
        ["decay", "Length", 0.2, 3, 0.01, (v) => `${v.toFixed(2)}×`],
    ]],
    ["Space", [
        ["reverb", "Reverb", 0, 1, 0.01, pct],
        ["delay", "Echo", 0, 1, 0.01, pct],
    ]],
];
const SONG_FX = [
    ["delaySteps", "Echo time", 1, 8, 1, (v) => `${v}/16`],
    ["delayFeedback", "Echo repeats", 0, 0.85, 0.01, pct],
];

function slider(target, [key, label, min, max, step, fmt, toUi = (v) => v, fromUi = (v) => v], { onLive, onDone } = {}) {
    const row = document.createElement("label");
    row.className = "slider";
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    const input = row.querySelector("input");
    const out = row.querySelector("output");
    input.value = toUi(target[key]);
    out.textContent = fmt(Number(input.value));
    let pushed = false;
    const begin = () => { if (!pushed) { pushHistory(); pushed = true; } };
    input.addEventListener("pointerdown", begin);
    input.addEventListener("keydown", begin);
    input.addEventListener("input", () => {
        begin();
        target[key] = fromUi(Number(input.value));
        out.textContent = fmt(Number(input.value));
        onLive?.();
    });
    input.addEventListener("change", () => {
        pushed = false;
        markChanged();
        onDone?.();
    });
    return row;
}

function presetSelect(isDrum) {
    const sel = document.createElement("select");
    sel.innerHTML = `<option value="">Load a preset…</option>`;
    for (const [group, presets] of Object.entries(PRESETS)) {
        if ((group === "Drums") !== isDrum) continue;
        const og = document.createElement("optgroup");
        og.label = group;
        for (const name of Object.keys(presets)) og.append(new Option(name, name));
        sel.append(og);
    }
    return sel;
}

function previewSelected() {
    const i = inst();
    if (!i) return;
    player.preview(song(), state.selTrack, 12 * (state.kbOctave + 1) + KEYS.indexOf(song().key), 4);
}

function renderInspector() {
    const box = $("#inspector");
    box.innerHTML = "";
    const name = state.selTrack;
    const i = inst();
    if (!i) {
        box.innerHTML = `<p class="note-small">Add a track to start.</p>`;
        return;
    }
    const isDrum = i.type === "drum";

    const head = document.createElement("div");
    head.className = "insp-head";
    head.innerHTML = `<input class="insp-name" maxlength="20" spellcheck="false" aria-label="Track name"><button class="icon-btn" title="Hear it">▶</button><button class="icon-btn danger" title="Delete track">×</button>`;
    const nameInput = head.querySelector("input");
    nameInput.value = name;
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nameInput.blur(); if (e.key === "Escape") { nameInput.value = name; nameInput.blur(); } });
    nameInput.addEventListener("blur", () => { if (!renameTrack(name, nameInput.value)) nameInput.value = state.selTrack; });
    head.children[1].onclick = previewSelected;
    head.children[2].onclick = () => deleteTrack(name);
    box.append(head);

    const pr = document.createElement("div");
    pr.className = "insp-row";
    const ps = presetSelect(isDrum);
    ps.onchange = () => {
        const preset = findPreset(ps.value);
        if (!preset) return;
        edit(() => { song().instruments[name] = withDefaults({ ...preset, color: i.color }); });
        previewSelected();
    };
    pr.append(ps);
    box.append(pr);

    const section = (title) => {
        const wrap = document.createElement("div");
        wrap.innerHTML = `<div class="section-title">${title}</div>`;
        box.append(wrap);
        return wrap;
    };

    const kinds = section(isDrum ? "Drum" : "Wave");
    const grid = document.createElement("div");
    grid.className = `waves${isDrum ? " drums" : ""}`;
    const options = isDrum ? DRUM_KINDS : Object.keys(WAVES);
    for (const k of options) {
        const b = document.createElement("button");
        const current = isDrum ? i.kind : i.wave;
        b.className = k === current ? "on" : "";
        b.innerHTML = isDrum ? DRUM_LABEL[k] : `<svg viewBox="0 0 26 14"><path d="${WAVES[k]}"/></svg>${WAVE_LABEL[k]}`;
        b.onclick = () => {
            edit(() => { i[isDrum ? "kind" : "wave"] = k; });
            previewSelected();
        };
        grid.append(b);
    }
    kinds.append(grid);

    for (const [title, defs] of isDrum ? DRUM_SECTIONS : SYNTH_SECTIONS) {
        const s = section(title);
        for (const def of defs) s.append(slider(i, def, { onDone: () => { previewSelected(); renderTracks(); } }));
    }

    const fx = section("Song echo <span class='note-small'>(shared by all tracks)</span>");
    for (const def of SONG_FX) fx.append(slider(song().fx, def));
    fx.append(slider(song(), ["volume", "Song volume", 0, 1.5, 0.01, pct]));
}

function deleteTrack(name) {
    if (trackNames().length <= 1) return toast("A song needs at least one track");
    const idx = trackNames().indexOf(name);
    edit(() => {
        delete song().instruments[name];
        for (const p of Object.values(song().patterns)) delete p.tracks[name];
        state.mix.muted.delete(name);
        state.mix.soloed.delete(name);
        state.selTrack = trackNames()[Math.max(0, idx - 1)];
    });
    player.setMix(state.mix);
}

function buildAddMenu() {
    const menu = $("#addTrackMenu");
    menu.innerHTML = "";
    for (const [group, presets] of Object.entries(PRESETS)) {
        const g = document.createElement("div");
        g.className = "menu-group";
        g.textContent = group;
        menu.append(g);
        if (group === "Drums") {
            const kit = document.createElement("button");
            kit.textContent = "Drum kit (kick, snare, hat)";
            kit.onclick = () => { addTracks(["Kick", "Snare", "Hi-hat"]); closeMenus(); };
            menu.append(kit);
        }
        for (const name of Object.keys(presets)) {
            const b = document.createElement("button");
            b.textContent = name;
            b.onclick = () => { addTracks([name]); closeMenus(); };
            menu.append(b);
        }
    }
}

function addTracks(presetNames) {
    let last = null;
    edit(() => {
        for (const p of presetNames) {
            const name = uniqueName(p, trackNames());
            song().instruments[name] = withDefaults({ ...findPreset(p), color: nextColor() });
            last = name;
        }
        state.selTrack = last;
    });
    previewSelected();
    requestAnimationFrame(scrollRollToNotes);
}

// ---------- Arrangement ----------

function renderArrangement() {
    const bank = $("#patternBank");
    bank.innerHTML = "";
    for (const name of Object.keys(song().patterns)) {
        const b = document.createElement("button");
        b.className = `pchip${name === state.selPattern ? " sel" : ""}`;
        b.style.setProperty("--c", patternColor(name));
        b.textContent = name;
        b.title = `Edit pattern ${name}`;
        b.onclick = () => selectPattern(name, { scroll: true });
        bank.append(b);
    }

    const tl = $("#timeline");
    tl.innerHTML = "";
    const arr = song().arrangement;
    arr.forEach((name, idx) => {
        const p = song().patterns[name];
        const block = document.createElement("div");
        block.className = "block";
        block.dataset.index = idx;
        block.draggable = true;
        if (idx < song().loopFrom) block.classList.add("intro");
        if (name === state.selPattern) block.classList.add("sel");
        block.style.setProperty("--c", patternColor(name));
        block.style.width = `${Math.max(56, p.steps * 2.6)}px`;
        block.title = idx < song().loopFrom ? "Plays once before the song starts looping" : `Pattern ${name}`;
        block.innerHTML = `<span class="label">${name}</span><button class="loop${idx === song().loopFrom ? " is" : ""}" title="Loop the song from here">↻</button><button class="x" title="Remove from song">×</button><canvas></canvas>`;
        block.querySelector(".label").textContent = name;
        block.onclick = (e) => {
            if (e.target.closest("button")) return;
            state.selBlock = idx;
            if (player.playing && state.mode === "song") player.seek(idx);
            selectPattern(name, { scroll: true });
        };
        block.querySelector(".x").onclick = () => {
            if (arr.length <= 1) return toast("The song needs at least one block");
            edit(() => {
                arr.splice(idx, 1);
                if (song().loopFrom >= arr.length) song().loopFrom = arr.length - 1;
                else if (idx < song().loopFrom) song().loopFrom--;
            });
        };
        block.querySelector(".loop").onclick = () => edit(() => { song().loopFrom = idx; });
        block.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", String(idx)); e.dataTransfer.effectAllowed = "move"; });
        block.addEventListener("dragover", (e) => { e.preventDefault(); block.classList.add("drag-over"); });
        block.addEventListener("dragleave", () => block.classList.remove("drag-over"));
        block.addEventListener("drop", (e) => {
            e.preventDefault();
            const from = Number(e.dataTransfer.getData("text/plain"));
            if (Number.isNaN(from) || from === idx) return renderArrangement();
            edit(() => { const [moved] = arr.splice(from, 1); arr.splice(idx, 0, moved); });
        });
        tl.append(block);
        drawMini(block.querySelector("canvas"), p);
    });
    const add = document.createElement("button");
    add.className = "add-block";
    add.textContent = "+";
    add.title = `Add pattern ${state.selPattern} to the end of the song`;
    add.onclick = () => edit(() => arr.push(state.selPattern));
    tl.append(add);
    markNowPlaying();
}

function drawMini(canvas, p) {
    const dpr = devicePixelRatio || 1;
    const w = canvas.clientWidth || 50;
    const h = canvas.clientHeight || 28;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const c = canvas.getContext("2d");
    c.scale(dpr, dpr);
    let lo = 127, hi = 0;
    for (const [t, notes] of Object.entries(p.tracks)) {
        if (inst(t)?.type === "drum") continue;
        for (const n of notes) { lo = Math.min(lo, n.note); hi = Math.max(hi, n.note); }
    }
    const span = Math.max(12, hi - lo + 1);
    const sx = w / p.steps;
    const drumH = 4;
    for (const [t, notes] of Object.entries(p.tracks)) {
        const i = inst(t);
        if (!i) continue;
        c.fillStyle = i.color;
        for (const n of notes) {
            if (i.type === "drum") {
                c.globalAlpha = 0.5;
                c.fillRect(n.step * sx, h - drumH, Math.max(1, sx - 1), drumH);
            } else {
                c.globalAlpha = 0.9;
                const y = (h - drumH - 3) * (1 - (n.note - lo + 0.5) / span);
                c.fillRect(n.step * sx, y, Math.max(1.5, n.length * sx - 1), 2);
            }
        }
    }
}

function markNowPlaying() {
    const idx = player.playing && state.mode === "song" ? state.playPos?.index : -1;
    document.querySelectorAll("#timeline .block").forEach((b) => b.classList.toggle("now", Number(b.dataset.index) === idx));
}

// ---------- Piano roll / drum grid ----------

const roll = $("#roll");
const gridCanvas = $("#gridCanvas");
const keysCanvas = $("#keysCanvas");
let drawQueued = false;

function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; draw(); });
}

function computeLayout() {
    const p = pattern();
    const i = inst();
    const isDrum = i?.type === "drum";
    const steps = p.steps;
    const avail = Math.max(200, roll.clientWidth - KEYS_W - 2);
    let rows;
    let rowH;
    if (isDrum) {
        rows = drumTracks();
        rowH = Math.max(38, Math.min(60, Math.floor((roll.clientHeight - 2) / Math.max(1, rows.length))));
    } else {
        const used = new Set((p.tracks[state.selTrack] ?? []).map((n) => n.note));
        rows = [];
        for (let m = HIGH; m >= LOW; m--) {
            if (!state.scaleOnly || inScale(m, song().key, song().scale) || used.has(m)) rows.push(m);
        }
        rowH = state.scaleOnly ? 20 : 15;
    }
    const cellW = Math.max(isDrum ? 22 : 16, Math.floor(avail / steps));
    return { isDrum, rows, rowH, cellW, steps, width: cellW * steps, height: rows.length * rowH };
}

function sizeCanvas(canvas, w, h) {
    const dpr = devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
    }
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
}

function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h);
    c.fill();
}

function draw() {
    if (!state.song || !inst()) return;
    const L = state.drag ? state.layout : (state.layout = computeLayout());
    const { isDrum, rows, rowH, cellW, steps, width, height } = L;
    const g = sizeCanvas(gridCanvas, width, height);
    const k = sizeCanvas(keysCanvas, KEYS_W, height);
    const p = pattern();
    const playStep = player.playing && state.playPos?.pattern === state.selPattern ? state.playPos.step : -1;
    const rootPc = KEYS.indexOf(song().key);
    const beat = song().stepsPerBeat;

    g.fillStyle = "#15151c";
    g.fillRect(0, 0, width, height);

    // rows
    rows.forEach((r, idx) => {
        const y = idx * rowH;
        if (isDrum) {
            g.fillStyle = idx % 2 ? "#17171f" : "#1a1a23";
        } else {
            const pc = r % 12;
            const black = [1, 3, 6, 8, 10].includes(pc);
            const fits = inScale(r, song().key, song().scale);
            g.fillStyle = !fits ? "#121218" : black && !state.scaleOnly ? "#16161d" : "#1b1b24";
            if (pc === rootPc) g.fillStyle = "#211f2e";
        }
        g.fillRect(0, y, width, rowH);
        g.fillStyle = !isDrum && r % 12 === 0 ? "#2e2e3c" : "#20202a";
        g.fillRect(0, y + rowH - 1, width, 1);
    });

    // playhead column
    if (playStep >= 0) {
        g.fillStyle = "rgba(155,135,255,0.13)";
        g.fillRect(playStep * cellW, 0, cellW, height);
    }

    // vertical lines
    for (let s = 0; s <= steps; s++) {
        g.fillStyle = s % (beat * 4) === 0 ? "#3a3a4c" : s % beat === 0 ? "#2b2b38" : "#1f1f29";
        g.fillRect(s * cellW, 0, 1, height);
    }

    if (isDrum) {
        rows.forEach((name, idx) => {
            const ins = inst(name);
            const hits = p.tracks[name] ?? [];
            for (let s = 0; s < steps; s++) {
                const hit = hits.find((n) => n.step === s);
                const x = s * cellW + 3;
                const y = idx * rowH + 4;
                if (hit) {
                    g.globalAlpha = 0.35 + 0.65 * hit.velocity;
                    g.fillStyle = s === playStep ? "#ffffff" : ins.color;
                } else {
                    g.globalAlpha = 1;
                    g.fillStyle = s % beat === 0 ? "#272733" : "#20202a";
                }
                roundRect(g, x, y, cellW - 6, rowH - 8, 4);
            }
        });
        g.globalAlpha = 1;
    } else {
        const rowOf = new Map(rows.map((r, idx) => [r, idx]));
        // ghost notes from the other melodic tracks
        g.lineWidth = 1;
        for (const [t, notes] of Object.entries(p.tracks)) {
            const ins = inst(t);
            if (t === state.selTrack || !ins || ins.type === "drum") continue;
            g.strokeStyle = ins.color;
            g.globalAlpha = 0.3;
            for (const n of notes) {
                const idx = rowOf.get(n.note);
                if (idx === undefined) continue;
                g.strokeRect(n.step * cellW + 1.5, idx * rowH + 2.5, n.length * cellW - 3, rowH - 5);
            }
        }
        g.globalAlpha = 1;
        const color = inst().color;
        for (const n of p.tracks[state.selTrack] ?? []) {
            const idx = rowOf.get(n.note);
            if (idx === undefined || n.step >= steps) continue;
            const lit = playStep >= n.step && playStep < n.step + n.length;
            g.globalAlpha = 0.45 + 0.55 * n.velocity;
            g.fillStyle = color;
            const w = Math.min(n.length, steps - n.step) * cellW - 2;
            roundRect(g, n.step * cellW + 1, idx * rowH + 1, w, rowH - 2, 4);
            if (lit) { g.fillStyle = "rgba(255,255,255,0.4)"; roundRect(g, n.step * cellW + 1, idx * rowH + 1, w, rowH - 2, 4); }
            g.globalAlpha = 1;
            g.fillStyle = "rgba(0,0,0,0.25)";
            if (w > 10) g.fillRect(n.step * cellW + w - 3, idx * rowH + 5, 2, rowH - 10);
            if (rowH >= 18 && w > 26) {
                g.fillStyle = "rgba(10,10,20,0.75)";
                g.font = "700 10px Nunito, sans-serif";
                g.fillText(midiToNote(n.note), n.step * cellW + 5, idx * rowH + rowH / 2 + 3.5);
            }
        }
    }

    // keys / row labels
    k.fillStyle = "#17171f";
    k.fillRect(0, 0, KEYS_W, height);
    rows.forEach((r, idx) => {
        const y = idx * rowH;
        if (isDrum) {
            const ins = inst(r);
            k.fillStyle = ins.color;
            k.fillRect(0, y + 6, 3, rowH - 12);
            k.fillStyle = r === state.selTrack ? "#ecebf5" : "#8d8ca3";
            k.font = "700 11px Nunito, sans-serif";
            k.fillText(r.length > 7 ? r.slice(0, 6) + "…" : r, 8, y + rowH / 2 + 4);
        } else {
            const pc = r % 12;
            const black = [1, 3, 6, 8, 10].includes(pc);
            k.fillStyle = black ? "#2a2a35" : "#d7d6e3";
            if (state.scaleOnly) k.fillStyle = pc === rootPc ? "#c9bfff" : "#d7d6e3";
            k.fillRect(0, y, KEYS_W - 4, rowH - 1);
            const label = state.scaleOnly || pc === 0;
            if (label) {
                k.fillStyle = black && !state.scaleOnly ? "#d7d6e3" : "#1a1a24";
                k.font = `${pc === 0 ? 800 : 600} 10px Nunito, sans-serif`;
                k.fillText(midiToNote(r), 6, y + rowH / 2 + 3.5);
            }
            if (!state.scaleOnly && pc === rootPc) {
                k.fillStyle = "#9b87ff";
                k.fillRect(KEYS_W - 4, y, 3, rowH - 1);
            }
        }
    });
}

function scrollRollToNotes() {
    const L = (state.layout = computeLayout());
    if (L.isDrum) { roll.scrollTop = 0; return; }
    const notes = pattern().tracks[state.selTrack] ?? [];
    let target = 60 + (inst()?.octave < 0 ? -12 : 0);
    if (notes.length) target = Math.round(notes.reduce((s, n) => s + n.note, 0) / notes.length);
    let idx = L.rows.findIndex((r) => r <= target);
    if (idx < 0) idx = L.rows.length - 1;
    roll.scrollTop = Math.max(0, idx * L.rowH - roll.clientHeight / 2);
}

function cellAt(e) {
    const rect = gridCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const L = state.layout;
    const step = Math.max(0, Math.min(L.steps - 1, Math.floor(x / L.cellW)));
    const row = Math.max(0, Math.min(L.rows.length - 1, Math.floor(y / L.rowH)));
    return { x, y, step, row, value: L.rows[row] };
}

const noteAt = (notes, step, pitch) => notes.find((n) => n.note === pitch && step >= n.step && step < n.step + n.length);

function hoverCursor(e) {
    if (state.drag || !state.layout) return;
    const L = state.layout;
    if (L.isDrum) { gridCanvas.style.cursor = "pointer"; return; }
    const { x, step, value } = cellAt(e);
    const n = noteAt(notes(), step, value);
    if (!n) { gridCanvas.style.cursor = "crosshair"; return; }
    const endX = (n.step + n.length) * L.cellW;
    gridCanvas.style.cursor = endX - x < Math.min(9, L.cellW * 0.45) ? "ew-resize" : "grab";
}

const notes = () => notesOf();

gridCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

gridCanvas.addEventListener("pointerdown", (e) => {
    if (!state.layout) return;
    const L = state.layout;
    const c = cellAt(e);

    if (e.pointerType === "touch") {
        state.touch = { x: e.clientX, y: e.clientY, c };
        return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    gridCanvas.setPointerCapture(e.pointerId);

    if (L.isDrum) {
        const track = c.value;
        if (track !== state.selTrack) { state.selTrack = track; renderTracks(); renderInspector(); }
        const hits = notesOf(track);
        const hit = hits.find((n) => n.step === c.step);
        pushHistory();
        let paint;
        if (e.button === 2) paint = "erase";
        else if (hit && e.shiftKey) paint = "soft";
        else paint = hit ? "erase" : e.shiftKey ? "soft" : "add";
        state.drag = { kind: "paint", paint, visited: new Set() };
        applyPaint(c);
        return;
    }

    const list = notes();
    const n = noteAt(list, c.step, c.value);
    if (e.button === 2) {
        if (n) edit(() => list.splice(list.indexOf(n), 1));
        return;
    }
    pushHistory();
    if (n) {
        const endX = (n.step + n.length) * L.cellW;
        const resize = endX - c.x < Math.min(9, L.cellW * 0.45);
        state.drag = { kind: resize ? "resize" : "move", note: n, grab: c.step - n.step, moved: false, startStep: c.step, startPitch: c.value };
        gridCanvas.style.cursor = resize ? "ew-resize" : "grabbing";
    } else {
        const len = Math.min(state.noteLen, L.steps - c.step);
        const note = { step: c.step, note: c.value, length: len, velocity: e.shiftKey ? 0.5 : 1 };
        list.push(note);
        state.drag = { kind: "create", note, moved: false };
        player.preview(song(), state.selTrack, c.value, len, note.velocity);
        markChanged();
        renderTracks();
    }
    requestDraw();
});

gridCanvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const d = state.drag;
    if (!d) return hoverCursor(e);
    const L = state.layout;
    const c = cellAt(e);
    if (d.kind === "paint") return applyPaint(c);
    const n = d.note;
    if (d.kind === "resize" || d.kind === "create") {
        const len = Math.max(1, Math.min(L.steps - n.step, c.step - n.step + 1));
        if (len !== n.length) { n.length = len; d.moved = true; }
    } else if (d.kind === "move") {
        const step = Math.max(0, Math.min(L.steps - n.length, c.step - d.grab));
        if (step !== n.step || c.value !== n.note) {
            if (c.value !== n.note) player.preview(song(), state.selTrack, c.value, Math.min(n.length, 2), n.velocity);
            n.step = step;
            n.note = c.value;
            d.moved = true;
        }
    }
    requestDraw();
});

function endDrag() {
    const d = state.drag;
    if (!d) return;
    state.drag = null;
    if (d.kind === "move" && !d.moved) {
        const list = notes();
        list.splice(list.indexOf(d.note), 1);
    } else if (d.kind === "resize" || (d.kind === "create" && d.moved)) {
        state.noteLen = d.note.length;
        $("#noteLen").value = String([1, 2, 4, 8, 16].includes(d.note.length) ? d.note.length : state.noteLen);
        savePrefs();
    } else if (d.kind === "paint" && d.visited.size === 0) {
        history.past.pop();
        updateUndoButtons();
    }
    gridCanvas.style.cursor = "";
    markChanged();
    renderTracks();
    renderArrangement();
    requestDraw();
}
gridCanvas.addEventListener("pointerup", (e) => {
    if (e.pointerType === "touch" && state.touch) {
        const t = state.touch;
        state.touch = null;
        if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 10) touchTap(t.c);
        return;
    }
    endDrag();
});
gridCanvas.addEventListener("pointercancel", () => { state.touch = null; endDrag(); });
gridCanvas.addEventListener("pointerleave", () => { if (!state.drag) gridCanvas.style.cursor = ""; });

function applyPaint(c) {
    const d = state.drag;
    const key = `${c.row}:${c.step}`;
    if (d.visited.has(key)) return;
    d.visited.add(key);
    const track = c.value;
    const hits = notesOf(track);
    const idx = hits.findIndex((n) => n.step === c.step);
    if (d.paint === "erase") {
        if (idx >= 0) hits.splice(idx, 1);
    } else {
        const velocity = d.paint === "soft" ? 0.5 : 1;
        if (idx >= 0) hits[idx].velocity = velocity;
        else hits.push({ step: c.step, note: null, length: 1, velocity });
        player.preview(song(), track, 60, 1, velocity);
    }
    requestDraw();
}

function touchTap(c) {
    const L = state.layout;
    if (L.isDrum) {
        edit(() => {
            const hits = notesOf(c.value);
            const idx = hits.findIndex((n) => n.step === c.step);
            if (idx >= 0) hits.splice(idx, 1);
            else { hits.push({ step: c.step, note: null, length: 1, velocity: 1 }); player.preview(song(), c.value, 60, 1); }
            state.selTrack = c.value;
        });
        return;
    }
    edit(() => {
        const list = notes();
        const n = noteAt(list, c.step, c.value);
        if (n) list.splice(list.indexOf(n), 1);
        else {
            const len = Math.min(state.noteLen, L.steps - c.step);
            list.push({ step: c.step, note: c.value, length: len, velocity: 1 });
            player.preview(song(), state.selTrack, c.value, len);
        }
    });
}

keysCanvas.addEventListener("pointerdown", (e) => {
    const L = state.layout;
    if (!L) return;
    const rect = keysCanvas.getBoundingClientRect();
    const row = Math.floor((e.clientY - rect.top) / L.rowH);
    const value = L.rows[row];
    if (value === undefined) return;
    if (L.isDrum) { selectTrack(value); player.preview(song(), value, 60, 1); }
    else player.preview(song(), state.selTrack, value, 4);
});

// ---------- Playback ----------

player.onStep((info) => {
    state.playPos = info;
    if (!info) {
        setPlayUI(false);
        markNowPlaying();
        requestDraw();
        hooks.onStep?.(null);
        return;
    }
    // In song mode the editor follows the music.
    if (state.mode === "song" && info.pattern !== state.selPattern && !state.drag && song().patterns[info.pattern]) {
        state.selPattern = info.pattern;
        state.selBlock = info.index;
        if (state.ui === "pro") { renderTracks(); renderEditorBar(); renderArrangement(); }
    }
    hooks.onStep?.(info);
    if (state.ui === "pro") { markNowPlaying(); requestDraw(); }
});

export function play() {
    const opts = state.mode === "pattern" ? { pattern: state.selPattern } : { from: state.selBlock };
    setPlayUI(true);
    player.play(song(), opts).catch((err) => { setPlayUI(false); toast("Couldn't start audio: " + err.message); });
}

export function togglePlay() {
    if (playUIOn()) {
        player.stop();
        setPlayUI(false);
    } else play();
}

export function setMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    savePrefs();
    renderTop();
    if (player.playing) {
        if (mode === "song") state.selBlock = Math.max(0, song().arrangement.indexOf(state.selPattern));
        play();
    }
}

// ---------- Patterns ----------

function setPatternSteps(steps) {
    edit(() => {
        const p = pattern();
        p.steps = steps;
        for (const list of Object.values(p.tracks)) {
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].step >= steps) list.splice(i, 1);
                else list[i].length = Math.min(list[i].length, steps - list[i].step);
            }
        }
    });
}

function renamePattern(oldName, newName) {
    newName = newName.trim().slice(0, 12);
    if (!newName || newName === oldName || song().patterns[newName]) return false;
    edit(() => {
        const rebuilt = {};
        for (const [n, p] of Object.entries(song().patterns)) rebuilt[n === oldName ? newName : n] = p;
        song().patterns = rebuilt;
        song().arrangement = song().arrangement.map((n) => (n === oldName ? newName : n));
        state.selPattern = newName;
    });
    if (player.playing && state.mode === "pattern") player.setPattern(newName);
    return true;
}

function newPattern(copy) {
    const name = nextPatternName();
    edit(() => {
        song().patterns[name] = copy ? structuredClone(pattern()) : { steps: pattern().steps, tracks: {} };
        song().arrangement.push(name);
        state.selPattern = name;
    });
    if (player.playing && state.mode === "pattern") player.setPattern(name);
    toast(`Pattern ${name} added to the end of the song`);
}

function deletePattern() {
    const names = Object.keys(song().patterns);
    if (names.length <= 1) return toast("A song needs at least one pattern");
    const name = state.selPattern;
    edit(() => {
        delete song().patterns[name];
        const arr = song().arrangement.filter((n) => n !== name);
        if (!arr.length) arr.push(Object.keys(song().patterns)[0]);
        song().arrangement = arr;
        song().loopFrom = Math.min(song().loopFrom, arr.length - 1);
        state.selPattern = Object.keys(song().patterns)[Math.max(0, names.indexOf(name) - 1)];
    });
    if (player.playing && state.mode === "pattern") player.setPattern(state.selPattern);
}

// ---------- Files, saving, sharing ----------

function saveToMySongs() {
    const all = mySongs();
    const id = state.fileId ?? `s${Date.now().toString(36)}`;
    all[id] = { title: song().title || "Untitled", json: serializeSong(song()), updated: Date.now() };
    if (!store.set(STORE.songs, all)) return toast("Couldn't save, browser storage is full or blocked");
    state.fileId = id;
    state.dirty = false;
    updateSaveButton();
    saveDraftSoon();
    toast("Saved to My songs");
}

const slug = (s) => (s || "song").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "song";

function download(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function encodeWav(buffer) {
    const ch = buffer.numberOfChannels;
    const len = buffer.length;
    const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF"); data.setUint32(4, 36 + len * ch * 2, true); str(8, "WAVE");
    str(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, buffer.sampleRate, true); data.setUint32(28, buffer.sampleRate * ch * 2, true);
    data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
    str(36, "data"); data.setUint32(40, len * ch * 2, true);
    const chans = [...Array(ch)].map((_, i) => buffer.getChannelData(i));
    let o = 44;
    for (let i = 0; i < len; i++) {
        for (let c = 0; c < ch; c++) {
            const v = Math.max(-1, Math.min(1, chans[c][i]));
            data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
            o += 2;
        }
    }
    return new Blob([data], { type: "audio/wav" });
}

async function exportWav() {
    toast("Rendering…");
    try {
        const buf = await renderSong(song());
        download(encodeWav(buf), `${slug(song().title)}.wav`);
        toast("Exported .wav");
    } catch (err) {
        toast("Couldn't export: " + err.message);
    }
}

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function streamBytes(bytes, stream) {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

async function encodeShare(json) {
    const bytes = new TextEncoder().encode(json);
    if ("CompressionStream" in window) return "z" + b64url(await streamBytes(bytes, new CompressionStream("deflate-raw")));
    return "j" + b64url(bytes);
}

async function decodeShare(code) {
    const bytes = fromB64url(code.slice(1));
    const raw = code[0] === "z" ? await streamBytes(bytes, new DecompressionStream("deflate-raw")) : bytes;
    return new TextDecoder().decode(raw);
}

async function shareLink() {
    const json = JSON.stringify(JSON.parse(serializeSong(song())));
    const url = `${location.origin}${location.pathname}#s=${await encodeShare(json)}`;
    try {
        await navigator.clipboard.writeText(url);
        toast("Share link copied");
    } catch {
        openModal(`<h2>Share link</h2><p>Copy this link. Anyone who opens it gets a copy of your song.</p><input class="insp-name" style="width:100%" readonly>`);
        const input = $("#modalBody input");
        input.value = url;
        input.select();
    }
}

async function confirmDiscard() {
    if (!state.dirty) return true;
    return confirmModal("You have unsaved changes", "Opening another song replaces what's in the studio now. Save first if you want to keep it.", "Open anyway");
}

function importFile(file) {
    file.text().then(async (text) => {
        try {
            const s = normalizeSong(JSON.parse(text));
            if (!(await confirmDiscard())) return;
            setSong(s, { dirty: true });
            closeModal();
            toast(`Opened ${s.title}`);
        } catch (err) {
            toast("That file isn't a song: " + err.message);
        }
    });
}

let manifestCache = null;
async function manifest() {
    if (!manifestCache) {
        try { manifestCache = await (await fetch("songs/index.json")).json(); } catch { manifestCache = { songs: [], slots: [] }; }
    }
    return manifestCache;
}

// ---------- Dialogs ----------

const modal = $("#modal");
let modalResolve = null;

function openModal(html) {
    $("#modalBody").innerHTML = html;
    modal.hidden = false;
}
function closeModal(result = false) {
    modal.hidden = true;
    if (modalResolve) { const r = modalResolve; modalResolve = null; r(result); }
}
modal.addEventListener("pointerdown", (e) => { if (e.target === modal) closeModal(); });
modal.querySelector(".modal-close").onclick = () => closeModal();

function confirmModal(title, text, okLabel) {
    return new Promise((resolve) => {
        if (modalResolve) modalResolve(false);
        openModal(`<h2></h2><p></p><div class="insp-row"><div class="spacer"></div><button class="btn ghost" data-r="0">Cancel</button><button class="btn primary" data-r="1"></button></div>`);
        const body = $("#modalBody");
        body.querySelector("h2").textContent = title;
        body.querySelector("p").textContent = text;
        body.querySelector("[data-r='1']").textContent = okLabel;
        body.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { modalResolve = null; modal.hidden = true; resolve(b.dataset.r === "1"); }));
        modalResolve = resolve;
    });
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    if (m < 1440) return `${Math.round(m / 60)} h ago`;
    return new Date(t).toLocaleDateString();
};

async function openSongDialog(tab = "games") {
    const m = await manifest();
    const songs = mySongs();
    const mine = Object.entries(songs).sort((a, b) => b[1].updated - a[1].updated);
    openModal(`<h2>Open a song</h2>
        <div class="tabs seg"><button data-tab="games">Game songs</button><button data-tab="mine">My songs</button></div>
        <div id="tabBody"></div>
        <div class="insp-row" style="margin-top:14px"><button class="btn ghost" id="fromFile">Import a .json file…</button></div>`);
    const body = $("#tabBody");
    const show = (t) => {
        document.querySelectorAll("#modalBody .tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
        if (t === "games") {
            body.innerHTML = m.songs.length
                ? `<p>Songs from the games on olid.is. Opening one gives you a copy to play with, so the game keeps its own version.</p><div class="list">${m.songs.map((s, i) => `
                    <button class="list-item" data-i="${i}"><span class="grow">${esc(s.title)}<div class="sub">${esc(s.gameTitle || "Example")}</div></span>Open</button>`).join("")}</div>`
                : `<div class="list-empty">No game songs yet.</div>`;
            body.querySelectorAll("[data-i]").forEach((b) => (b.onclick = async () => {
                const entry = m.songs[Number(b.dataset.i)];
                try {
                    const raw = await (await fetch(`songs/${entry.file}`)).json();
                    if (!(await confirmDiscard())) return;
                    setSong(normalizeSong(raw));
                    closeModal();
                    toast(`Opened ${entry.title}`);
                } catch (err) { toast("Couldn't open: " + err.message); }
            }));
        } else {
            body.innerHTML = mine.length
                ? `<div class="list">${mine.map(([id, s]) => `
                    <div class="list-item" data-id="${id}"><span class="grow">${esc(s.title)}<div class="sub">Saved ${ago(s.updated)}</div></span>
                    <button class="btn small-btn" data-open>Open</button><button class="icon-btn danger" data-del title="Delete">×</button></div>`).join("")}</div>`
                : `<div class="list-empty">Nothing saved yet. Press Save and your songs show up here. They're kept in this browser.</div>`;
            body.querySelectorAll("[data-id]").forEach((row) => {
                const id = row.dataset.id;
                row.querySelector("[data-open]").onclick = async () => {
                    if (id !== state.fileId && !(await confirmDiscard())) return;
                    setSong(normalizeSong(JSON.parse(songs[id].json)), { fileId: id });
                    closeModal();
                };
                row.querySelector("[data-del]").onclick = async () => {
                    if (!(await confirmModal("Delete this song?", `"${songs[id].title}" will be gone for good.`, "Delete"))) return openSongDialog("mine");
                    const all = mySongs();
                    delete all[id];
                    store.set(STORE.songs, all);
                    if (state.fileId === id) { state.fileId = null; state.dirty = true; updateSaveButton(); }
                    openSongDialog("mine");
                };
            });
        }
    };
    document.querySelectorAll("#modalBody .tabs button").forEach((b) => (b.onclick = () => show(b.dataset.tab)));
    $("#fromFile").onclick = () => $("#fileInput").click();
    show(tab === "mine" || (!m.songs.length && mine.length) ? "mine" : "games");
}

function openNewDialog() {
    openModal(`<h2>New song</h2><p>Pick a starting point. You can change every sound afterwards.</p>
        <div class="templates">${TEMPLATES.map((t) => `<button class="list-item" data-t="${t.id}"><b>${esc(t.name)}</b><span class="sub">${esc(t.description)}</span></button>`).join("")}</div>`);
    document.querySelectorAll("#modalBody [data-t]").forEach((b) => (b.onclick = async () => {
        const t = TEMPLATES.find((x) => x.id === b.dataset.t);
        if (!(await confirmDiscard())) return;
        player.stop();
        setSong(normalizeSong(songFromTemplate(t)), { dirty: true });
        closeModal();
    }));
}

async function openUseInGameDialog() {
    const m = await manifest();
    if (!m.slots.length) {
        openModal(`<h2>Use in a game</h2><p>No games play songs from the studio yet. Once a game is connected, its songs show up here and you can swap any of them for one of yours.</p>`);
        return;
    }
    const render = () => {
        $("#modalBody").innerHTML = `<h2>Use in a game</h2><p>Swap a game's music for "${esc(song().title)}". This only changes the game in your browser.</p>
            <div class="list">${m.slots.map((slot, i) => {
                const mine = getGameSongOverride(slot.id);
                return `<div class="list-item"><span class="grow">${esc(slot.gameTitle)} · ${esc(slot.label)}<div class="sub">Now playing: ${mine ? esc(mine.title) + " (yours)" : "original"}</div></span>
                    <button class="btn small-btn primary" data-use="${i}">Use this song</button>${mine ? `<button class="btn small-btn ghost" data-reset="${i}">Reset</button>` : ""}</div>`;
            }).join("")}</div>`;
        document.querySelectorAll("#modalBody [data-use]").forEach((b) => (b.onclick = () => {
            const slot = m.slots[Number(b.dataset.use)];
            if (setGameSong(slot.id, song())) toast(`${slot.gameTitle} will now play "${song().title}"`);
            else toast("Couldn't save, browser storage is blocked");
            render();
        }));
        document.querySelectorAll("#modalBody [data-reset]").forEach((b) => (b.onclick = () => {
            setGameSong(m.slots[Number(b.dataset.reset)].id, null);
            render();
        }));
    };
    openModal("");
    render();
}

function openHelp() {
    const k = (s) => `<span class="kbd">${s}</span>`;
    openModal(`<h2>Shortcuts &amp; tips</h2><p>How the studio fits together: a song is made of <b>patterns</b> (short loops), lined up in the <b>Song</b> row. Each pattern holds the notes for every track.</p>
        <div class="help-grid">
          ${k("Space")}<span>Play / stop</span>
          ${k("A W S E D F T G Y H U J K")}<span>Play the selected sound like a piano</span>
          ${k("Z")} ${k("X")}<span>Keyboard octave down / up</span>
          ${k("Ctrl/Cmd Z")}<span>Undo (Shift for redo)</span>
          ${k("Ctrl/Cmd S")}<span>Save to My songs</span>
          ${k("Shift + click")}<span>Softer note or hit</span>
          ${k("Right-click")}<span>Delete a note</span>
          <span>↻</span><span>On a song block, loops the song from there, so earlier blocks work as an intro</span>
          <span>In key</span><span>Hides notes outside the key, so everything you place fits together</span>
        </div>`);
}

// ---------- Menus & toast ----------

function closeMenus() {
    document.querySelectorAll(".menu").forEach((m) => (m.hidden = true));
}
document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".menu-wrap")) closeMenus(); });

let toastTimer = null;
function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2400);
}

// ---------- Wiring ----------

function wire() {
    for (const key of KEYS) $("#songKey").append(new Option(key, key));
    for (const [id, s] of Object.entries(SCALES)) $("#songScale").append(new Option(s.name, id));
    buildAddMenu();

    const each = (sel, fn) => document.querySelectorAll(sel).forEach((b) => (b.onclick = fn));
    each("[data-play]", (e) => { togglePlay(); e.currentTarget.blur(); });
    each("[data-mode]", (e) => setMode(e.currentTarget.dataset.mode));
    each("[data-ui]", (e) => setUi(e.currentTarget.dataset.ui));
    each("[data-undo]", undo);
    each("[data-redo]", redo);
    each("[data-save]", saveToMySongs);
    $("#openBtn").onclick = () => openSongDialog();

    const title = $("#songTitle");
    title.addEventListener("focus", () => pushHistory());
    title.addEventListener("input", () => { song().title = title.value; markChanged(); document.title = `${title.value || "Untitled"} · Studio`; });
    title.addEventListener("keydown", (e) => { if (e.key === "Enter") title.blur(); });

    $("#bpm").addEventListener("change", (e) => {
        const v = Math.max(40, Math.min(240, Math.round(Number(e.target.value) || song().bpm)));
        edit(() => { song().bpm = v; });
    });
    const swing = $("#swing");
    swing.addEventListener("pointerdown", () => pushHistory());
    swing.addEventListener("input", () => { song().swing = Number(swing.value); });
    swing.addEventListener("change", markChanged);

    const pname = $("#patternName");
    pname.addEventListener("keydown", (e) => { if (e.key === "Enter") pname.blur(); if (e.key === "Escape") { pname.value = state.selPattern; pname.blur(); } });
    pname.addEventListener("blur", () => { if (!renamePattern(state.selPattern, pname.value)) pname.value = state.selPattern; });
    $("#patternSteps").onchange = (e) => setPatternSteps(Number(e.target.value));
    $("#songKey").onchange = (e) => edit(() => { song().key = e.target.value; });
    $("#songScale").onchange = (e) => edit(() => { song().scale = e.target.value; });
    $("#scaleOnly").onclick = () => { state.scaleOnly = !state.scaleOnly; savePrefs(); renderEditorBar(); requestAnimationFrame(scrollRollToNotes); requestDraw(); };
    $("#noteLen").onchange = (e) => { state.noteLen = Number(e.target.value); savePrefs(); };
    $("#clearPattern").onclick = () => {
        const isDrum = inst().type === "drum";
        const targets = isDrum ? drumTracks() : [state.selTrack];
        if (!targets.some((t) => (pattern().tracks[t] ?? []).length)) return;
        edit(() => { for (const t of targets) pattern().tracks[t] = []; });
        toast(isDrum ? "Cleared the drums in this pattern" : `Cleared ${state.selTrack} in this pattern`);
    };
    $("#newPattern").onclick = () => newPattern(false);
    $("#dupPattern").onclick = () => newPattern(true);
    $("#delPattern").onclick = deletePattern;

    $("#addTrackBtn").onclick = () => { const m = $("#addTrackMenu"); const open = m.hidden; closeMenus(); m.hidden = !open; };
    $("#moreBtn").onclick = () => { const m = $("#moreMenu"); const open = m.hidden; closeMenus(); m.hidden = !open; };
    $("#moreMenu").onclick = (e) => {
        const action = e.target.closest("button")?.dataset.action;
        if (!action) return;
        closeMenus();
        ({
            new: openNewDialog,
            share: shareLink,
            useInGame: openUseInGameDialog,
            download: () => download(new Blob([serializeSong(song())], { type: "application/json" }), `${slug(song().title)}.json`),
            import: () => $("#fileInput").click(),
            wav: exportWav,
            help: openHelp,
        })[action]?.();
    };
    $("#fileInput").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importFile(f); };

    new ResizeObserver(() => requestDraw()).observe(roll);

    const held = new Set();
    document.addEventListener("keydown", (e) => {
        const typing = e.target.closest("input:not([type=range]), select, textarea, [contenteditable]");
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
        if (mod && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); redo(); return; }
        if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveToMySongs(); return; }
        if (e.key === "Escape") { closeMenus(); if (!modal.hidden) closeModal(); return; }
        if (typing || mod || e.altKey || !modal.hidden) return;
        if (e.code === "Space") { e.preventDefault(); togglePlay(); return; }
        const key = e.key.toLowerCase();
        if (key === "z" || key === "x") {
            state.kbOctave = Math.max(1, Math.min(7, state.kbOctave + (key === "x" ? 1 : -1)));
            savePrefs();
            toast(`Keyboard octave ${state.kbOctave}`);
            return;
        }
        const semi = KEYBOARD.indexOf(key);
        if (semi >= 0 && !e.repeat && !held.has(key)) {
            held.add(key);
            player.preview(song(), state.selTrack, 12 * (state.kbOctave + 1) + semi, 3);
        }
    });
    document.addEventListener("keyup", (e) => held.delete(e.key.toLowerCase()));
    window.addEventListener("beforeunload", () => {
        clearTimeout(draftTimer);
        store.set(STORE.draft, { json: serializeSong(state.song), fileId: state.fileId, dirty: state.dirty });
    });
}

export async function start() {
    const prefs = store.get(STORE.prefs, {});
    Object.assign(state, {
        ui: proAllowed ? (prefs.ui === "easy" ? "easy" : "pro") : "easy",
        scaleOnly: prefs.scaleOnly ?? true,
        noteLen: prefs.noteLen ?? 2,
        mode: prefs.mode ?? "pattern",
        kbOctave: prefs.kbOctave ?? 4,
    });
    wire();
    document.body.classList.add(state.ui === "pro" ? "ui-pro" : "ui-easy");
    document.body.classList.toggle("pro-allowed", proAllowed);

    if (location.hash.startsWith("#s=")) {
        try {
            const s = normalizeSong(JSON.parse(await decodeShare(location.hash.slice(3))));
            window.history.replaceState(null, "", location.pathname + location.search);
            setSong(s, { dirty: true });
            toast(`Opened shared song "${s.title}"`);
            return;
        } catch {
            toast("That share link is broken");
        }
    }
    const draft = store.get(STORE.draft);
    if (draft?.json) {
        try {
            setSong(normalizeSong(JSON.parse(draft.json)), { fileId: draft.fileId ?? null, dirty: !!draft.dirty });
            return;
        } catch { /* fall through to the demo */ }
    }
    try {
        setSong(normalizeSong(await (await fetch("songs/demo-harbor.json")).json()));
    } catch {
        setSong(normalizeSong(songFromTemplate(TEMPLATES[0])));
    }
    hooks.firstVisit?.();
}

export {
    player, song, inst, pattern, trackNames, drumTracks, notesOf, edit, pushHistory, markChanged, renderAll,
    selectPattern, undo, redo, saveToMySongs, openSongDialog, openUseInGameDialog, shareLink, exportWav,
    toast, manifest, setSong, uniqueName, nextColor, nextPatternName, patternColor, mySongs, store, STORE,
    closeMenus, confirmDiscard, openHelp, openModal, closeModal, esc, ago, download, slug,
};
