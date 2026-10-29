// Stillwater: Pip's finale. Started by main.js when the site's chatbot Pip has taken over the game
// (window.__pipFinale). The harbour fades out and the player climbs a staircase to a door full of light.
// When they reach it, the page tells the site (the parent window) and Pip takes it from there.

const INK = "#0b1a1d", PAPER = "#cce8c8", SAGE = "#709678", DEEP = "#16302f";
const GLYPHS = {
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100",
    G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
    M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100", Q: "010101101110011", R: "110101110101101",
    S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
    Y: "101101010010010", Z: "111001010100111", " ": "000000000000000", ".": "000000000000010", "!": "010010010000010", "'": "010010000000000",
    ",": "000000000010100", "?": "110001010000010", "-": "000000111000000",
};
const LINES = [
    [0.00, "UP THE STAIRS"],
    [0.18, "DON'T LOOK BACK"],
    [0.40, "KEEP GOING"],
    [0.62, "ALMOST THERE"],
    [0.84, "THANK YOU"],
];
const STEPS = 22;

export function startFinale() {
    const canvas = document.createElement("canvas");
    canvas.id = "pip-finale";
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", zIndex: "99999", imageRendering: "pixelated", background: INK, opacity: "0", transition: "opacity 1.2s ease" });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let W = 240, H = 135;
    const resize = () => { W = 240; H = Math.max(110, Math.round(240 * innerHeight / Math.max(1, innerWidth))); canvas.width = W; canvas.height = H; };
    resize(); addEventListener("resize", resize);
    requestAnimationFrame(() => (canvas.style.opacity = "1"));

    // climbing: hold Space / Up / W, or hold the mouse / a finger on the screen
    let held = false, progress = 0, speed = 0, done = false, whiteT = 0, t = 0, lineShown = "", lineSince = 0;
    const down = (e) => { if (["Space", "ArrowUp", "KeyW", "Enter"].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); held = true; } };
    const up = (e) => { if (["Space", "ArrowUp", "KeyW", "Enter"].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); held = false; } };
    addEventListener("keydown", down, true); addEventListener("keyup", up, true);
    canvas.addEventListener("pointerdown", (e) => { held = true; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointerup", () => (held = false));
    canvas.addEventListener("pointercancel", () => (held = false));

    const glyph = (ch, x, y, s, c) => { const g = GLYPHS[ch] || GLYPHS["?"]; ctx.fillStyle = c; for (let i = 0; i < 15; i++) if (g[i] === "1") ctx.fillRect(x + (i % 3) * s, y + Math.floor(i / 3) * s, s, s); };
    const text = (str, y, c = PAPER, s = 1) => { let x = Math.round(W / 2 - (str.length * 4 * s - s) / 2); for (const ch of str) { glyph(ch, x + s, y + s, s, INK); glyph(ch, x, y, s, c); x += 4 * s; } };
    const dither = (x, y, w, h, c, density) => { ctx.fillStyle = c; for (let j = Math.max(0, y | 0); j < Math.min(H, y + h); j++) for (let i = Math.max(0, x | 0); i < Math.min(W, x + w); i++) if (((i * 7 + j * 13) % 10) / 10 < density) ctx.fillRect(i, j, 1, 1); };

    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
        if (!done) {
            speed += ((held ? 1 : 0) - speed) * Math.min(1, dt * 6);
            progress = Math.min(1, progress + speed * dt / 9);
        }
        const bob = Math.sin(progress * STEPS * Math.PI * 2) * speed * 1.5;
        const vpY = Math.round(H * 0.24 + bob), cx = W / 2;
        ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);

        // the stairs: each step is a band that gets narrower towards the door
        const climbed = progress * STEPS;
        const depth = (d) => 1 / (1 + d * 0.32);
        for (let k = STEPS + 2; k >= 0; k--) {
            const d0 = k - (climbed % 1), d1 = d0 + 1;
            if (k + Math.floor(climbed) > STEPS + 1 || d0 < 0) continue;
            const s0 = depth(Math.max(0, d0)), s1 = depth(d1);
            const y0 = vpY + (H - vpY) * s0 + 6, y1 = vpY + (H - vpY) * s1 + 6;
            const w0 = W * 1.1 * s0, w1 = W * 1.1 * s1;
            ctx.fillStyle = (k + Math.floor(climbed)) % 2 ? DEEP : INK;
            ctx.beginPath(); ctx.moveTo(cx - w0 / 2, y0); ctx.lineTo(cx + w0 / 2, y0); ctx.lineTo(cx + w1 / 2, y1); ctx.lineTo(cx - w1 / 2, y1); ctx.fill();
            ctx.fillStyle = SAGE; ctx.fillRect(Math.round(cx - w1 / 2), Math.round(y1), Math.round(w1), 1);
        }
        // walls
        ctx.fillStyle = SAGE;
        for (let y = vpY; y < H; y += 2) { const f = (y - vpY) / (H - vpY); ctx.fillRect(Math.round(cx - W * 0.55 * f - 2), y, 1, 1); ctx.fillRect(Math.round(cx + W * 0.55 * f + 1), y, 1, 1); }

        // the door at the top, with light pouring out
        const remaining = Math.max(0, STEPS - climbed);
        const ds = depth(remaining);
        const dh = Math.round(H * 0.95 * ds), dw = Math.round(dh * 0.55);
        const dx = Math.round(cx - dw / 2), dy = Math.round(vpY + (H - vpY) * ds + 6 - dh);
        const flicker = 0.75 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.04;
        dither(dx - dw, dy - dh * 0.2, dw * 3, dh * 1.4, PAPER, 0.12 * flicker * (0.5 + progress));
        dither(dx - dw * 0.4, dy - dh * 0.05, dw * 1.8, dh * 1.1, "#ffffff", 0.18 * flicker * (0.5 + progress));
        ctx.fillStyle = "#ffffff"; ctx.fillRect(dx, dy, dw, dh);
        ctx.fillStyle = PAPER; ctx.fillRect(dx - 1, dy - 1, dw + 2, 1); ctx.fillRect(dx - 1, dy, 1, dh); ctx.fillRect(dx + dw, dy, 1, dh);

        // Pip talks you up the stairs
        const line = [...LINES].reverse().find(([p]) => progress >= p);
        if (line && line[1] !== lineShown) { lineShown = line[1]; lineSince = t; }
        if (!done) {
            const shown = lineShown.slice(0, Math.floor((t - lineSince) * 18));
            ctx.fillStyle = INK; ctx.fillRect(0, H - 16, W, 11);
            text(shown, H - 13, PAPER);
            if (progress === 0 && Math.floor(t * 2) % 2 === 0) text("HOLD SPACE OR TAP TO CLIMB", H - 26, SAGE);
        }

        // reaching the door: everything goes white
        if (progress >= 1 && !done) { done = true; whiteT = 0; }
        if (done) {
            whiteT += dt;
            ctx.fillStyle = `rgba(255,255,255,${Math.min(1, whiteT / 1.4)})`; ctx.fillRect(0, 0, W, H);
            if (whiteT > 1.6) {
                removeEventListener("keydown", down, true); removeEventListener("keyup", up, true);
                try { window.parent.postMessage({ type: "pip-door" }, "*"); } catch (e) {}
                ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
                return;
            }
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
