// Music for a game, made in the Studio. Add one line to a game's page:
//
//   <script type="module" src="/music/game-music.js" data-slot="stillwater" data-song="/music/songs/stillwater-undertow.json"></script>
//
// It plays the visitor's own version if they made one in the Studio (or a friend's, from a ?music= link),
// otherwise the default song. It starts on the first click or key press.
//
// When the game is played inside olid.is, the site's Music button (next to Controls and Fullscreen)
// turns it on and off and links to the Studio. The game page talks to it with postMessage:
//   game → site  { type: "olid-music", slot, title, on }
//   site → game  { type: "olid-music:toggle" }
//
// Optional:
//   data-follow="#soundBtn"   start and stop the music with the game's own sound button (each click toggles it)

import { createPlayer, loadGameSong, normalizeSong } from "./player.js";
import { decodeShare } from "./share.js";

const script = [...document.querySelectorAll("script[src]")].find((s) => s.src.includes("/music/game-music.js"));
const slot = script?.dataset.slot;
const defaultUrl = script?.dataset.song;
const follow = script?.dataset.follow;
const MUTE_KEY = "olid-music:game-muted";

const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* blocked */ } },
};

// Listen for the first click/tap/key straight away, so one that happens while the song is still loading counts.
let gestured = false;
let onGestureHook = null;
const GESTURES = ["pointerdown", "pointerup", "touchend", "click", "keydown"];
if (slot && defaultUrl) {
    for (const type of GESTURES) addEventListener(type, () => { gestured = true; onGestureHook?.(); }, { capture: true, passive: true });
    boot();
}

async function boot() {
    const code = new URLSearchParams(location.search).get("music");
    let song;
    try {
        if (code) song = normalizeSong(JSON.parse(await decodeShare(code)));
    } catch { /* broken link: fall back */ }
    try {
        song ??= await loadGameSong(slot, defaultUrl);
    } catch {
        return; // no music, the game still works
    }

    const music = createPlayer({ volume: 0.55 });
    // follow mode: the game's own sound button decides; otherwise the site's Music button (remembered)
    let on = follow ? false : store.get(MUTE_KEY) !== "1";
    let started = false;

    const report = () => {
        if (window.parent !== window) window.parent.postMessage({ type: "olid-music", slot, title: song.title || "Untitled", on }, location.origin);
    };
    const apply = () => {
        if (on && gestured && !document.hidden) {
            if (!started) { started = true; music.play(song, { loop: true, fadeIn: 1.5 }); }
            else if (music.context?.state !== "running") music.context?.resume();
        } else if (started && music.context?.state === "running") music.context.suspend();
        report();
    };

    // Browsers only allow sound after a click, tap or key press, and some (iPhone Safari) only count
    // the end of a tap. So every gesture retries until the audio is actually running.
    onGestureHook = () => { if (on && !document.hidden && (!started || music.context?.state !== "running")) apply(); };
    document.addEventListener("visibilitychange", apply);
    if (gestured) apply();

    if (follow) {
        document.addEventListener("click", (e) => {
            if (!e.target.closest?.(follow)) return;
            on = !on;
            gestured = true;
            apply();
        }, true);
    }

    addEventListener("message", (e) => {
        if (e.source !== window.parent || e.data?.type !== "olid-music:toggle") return;
        on = !on;
        gestured = true; // the click on the site's button counts (the player frame allows autoplay)
        if (!follow) store.set(MUTE_KEY, on ? null : "1");
        apply();
    });

    report();
    window.olidMusic = { player: music, song };
}
