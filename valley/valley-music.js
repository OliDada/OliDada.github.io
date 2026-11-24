// The Valley's music, made in the Studio (/music/). Two slots, so either can be swapped from the Studio
// ("Use in a game…"): "valley" plays through the game, "valley-intro" under the opening.
// Like /music/game-music.js, the site's Music button turns it on and off (game → site { type: "olid-music" },
// site → game { type: "olid-music:toggle" }), and the choice is remembered.
import { createPlayer, loadGameSong, normalizeSong } from "/music/player.js";
import { decodeShare } from "/music/share.js";

const SLOT = "valley", INTRO_SLOT = "valley-intro";
const THEME_URL = "/music/songs/valley-the-valley.json", INTRO_URL = "/music/songs/valley-ashford-night.json";
const MUTE_KEY = "olid-music:game-muted";
const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* blocked */ } },
};

// our own context, so a click can wake it before there is anything to play
let ctx = null;
try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ }
const music = createPlayer({ context: ctx ?? undefined, volume: 0.55 });
let on = store.get(MUTE_KEY) !== "1";
let want = null;            // what should be playing: "intro", "theme" or null
let playing = null;
let theme = null, intro = null;

const ready = (async () => {
    const code = new URLSearchParams(location.search).get("music");
    try { if (code) theme = normalizeSong(JSON.parse(await decodeShare(code))); } catch { /* broken link */ }
    try { theme ??= await loadGameSong(SLOT, THEME_URL); } catch { theme = null; }
    try { intro = await loadGameSong(INTRO_SLOT, INTRO_URL); } catch { intro = null; }
})();

const report = () => {
    if (window.parent !== window) window.parent.postMessage({ type: "olid-music", slot: SLOT, title: (playing === "intro" ? intro : theme)?.title || "The Valley", on }, location.origin);
};

// playback follows `want`, `on` and the tab being visible
function apply(opts = {}) {
    if (!on || !want || document.hidden) {
        if (playing && music.context?.state === "running") music.context.suspend();
    } else if (playing !== want) {
        const song = want === "intro" ? intro : theme;
        if (song) {
            playing = want;
            const p = music.play(song, want === "intro" ? { loop: false, fadeIn: 0.4 } : { loop: true, fadeIn: opts.fadeIn ?? 3, fadeOut: opts.fadeOut ?? 1.5 });
            if (want === "intro") p.then(() => { api.introStart = music.context.currentTime + 0.06; });
        }
    } else if (music.context?.state !== "running") music.context?.resume();
    report();
}

const api = {
    introStart: null,
    // inside a click: let sound start later without another one
    unlock() { try { ctx?.resume(); } catch { /* fine */ } },
    get context() { return music.context; },
    get on() { return on; },
    // the opening: call from inside the click that starts it
    playIntro() { want = "intro"; api.introStart = null; if (intro) apply(); else ready.then(() => want === "intro" && apply()); },
    playTheme(fadeIn) { want = "theme"; if (theme) apply({ fadeIn }); else ready.then(() => want === "theme" && apply({ fadeIn })); },
    stop(fadeOut = 0.6) { want = null; playing = null; music.stop({ fadeOut }); report(); },
};
window.valleyMusic = api;

// "Continue" (or a new game without the opening) goes straight to the valley's own music.
// The opening stops this click before it gets here and starts its own.
addEventListener("click", (e) => { if (e.target.closest?.("#go") && !want) api.playTheme(2); });
document.addEventListener("visibilitychange", () => apply());
addEventListener("message", (e) => {
    if (e.source !== window.parent || e.data?.type !== "olid-music:toggle") return;
    on = !on;
    store.set(MUTE_KEY, on ? null : "1");
    if (on && !want) want = "theme";
    if (on && playing && music.context?.state !== "running") music.context.resume();
    apply();
});
ready.then(report);
