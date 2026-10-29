// A tiny bitmap UI drawn at the game's own resolution, so every letter is
// made of the same chunky pixels as the world. 3×5 glyphs, two colours.
const GLYPHS = {
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
    E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
    I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
    M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
    Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
    U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
    Y: "101101010010010", Z: "111001010100111",
    0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
    4: "101101111001001", 5: "111100110001110", 6: "011100111101111", 7: "111001010010010",
    8: "111101111101111", 9: "111101111001110",
    " ": "000000000000000", ".": "000000000000010", ":": "000010000010000", "!": "010010010000010",
    "?": "110001010000010", "-": "000000111000000", "'": "010010000000000", "/": "001001010100100",
    "<": "001010100010001", ">": "100010001010100", "^": "010101000000000", "x": "000101010101000",
    "*": "000010111010000",
};
const INK = "#0b1a1d", PAPER = "#cce8c8", SAGE = "#709678";

export function createUI() {
    const canvas = document.createElement("canvas");
    canvas.id = "ui";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const width = (text, scale = 1) => text.length * 4 * scale - scale;
    function glyph(ch, x, y, scale, color) {
        const g = GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS["?"];
        ctx.fillStyle = color;
        for (let i = 0; i < 15; i++) if (g[i] === "1") ctx.fillRect(x + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
    }
    // Text with a one-pixel ink shadow so it reads over any part of the scene.
    function text(str, x, y, { scale = 1, color = PAPER, align = "left", shadow = true } = {}) {
        str = String(str).toUpperCase();
        let left = Math.round(align === "center" ? x - width(str, scale) / 2 : align === "right" ? x - width(str, scale) : x);
        for (const ch of str) {
            if (shadow) glyph(ch, left + scale, y + scale, scale, INK);
            glyph(ch, left, y, scale, color);
            left += 4 * scale;
        }
    }
    function diamond(x, y, filled) {
        const rows = ["00100", "01110", "11111", "01110", "00100"];
        const hollow = ["00100", "01010", "10001", "01010", "00100"];
        (filled ? rows : hollow).forEach((r, j) => [...r].forEach((b, i) => {
            if (b !== "1") return;
            ctx.fillStyle = INK; ctx.fillRect(x + i + 1, y + j + 1, 1, 1);
            ctx.fillStyle = filled ? PAPER : SAGE; ctx.fillRect(x + i, y + j, 1, 1);
        }));
    }
    // A dithered band behind centred text, so menus feel part of the picture.
    function band(y, h) {
        ctx.fillStyle = INK;
        for (let j = y; j < y + h; j++)
            for (let i = (j % 2); i < canvas.width; i += 2) ctx.fillRect(i, j, 1, 1);
        ctx.fillRect(0, y + 2, canvas.width, h - 4);
    }
    let area = "", areaSince = -10;
    return {
        resize(w, h) { canvas.width = w; canvas.height = h; },
        draw(state) {
            const W = canvas.width, H = canvas.height, t = state.clock;
            ctx.clearRect(0, 0, W, H);
            const blink = Math.floor(t * 2.5) % 2 === 0;
            if (state.screen === "title") {
                band(Math.round(H * 0.3), 34);
                text("STILLWATER", W / 2, Math.round(H * 0.3) + 6, { scale: 3, align: "center" });
                if (blink) text(state.touch ? "TAP TO BEGIN" : "PRESS SPACE", W / 2, Math.round(H * 0.3) + 25, { align: "center", color: SAGE });
                if (state.touch) {
                    band(H - 21, 19);
                    text("SWIPE ^ JUMP  V DUCK", W / 2, H - 17, { align: "center", color: SAGE });
                    text("SWIPE < > MOVE", W / 2, H - 10, { align: "center", color: SAGE });
                } else {
                    band(H - 14, 12);
                    text("SPACE JUMP  DOWN DUCK  < > MOVE", W / 2, H - 10, { align: "center", color: SAGE });
                }
                if (state.best) text(`BEST ${state.best}`, W / 2, 6, { align: "center", color: SAGE });
                return;
            }
            if (state.screen === "over") {
                band(Math.round(H * 0.28), 44);
                const y = Math.round(H * 0.28) + 6;
                text(state.record ? "A NEW BEST" : "THE WATER TOOK YOU", W / 2, y, { align: "center", color: SAGE });
                text(state.score, W / 2, y + 9, { scale: 2, align: "center" });
                text(`${state.distance} M   BEST ${state.best}`, W / 2, y + 23, { align: "center", color: SAGE });
                if (blink) text(state.touch ? "TAP" : "SPACE", W / 2, y + 32, { align: "center" });
                return;
            }
            // In play: score top left, lives top right, and nothing else unless it matters.
            text(state.score, 4, 4);
            if (state.mult > 1) text(`x${state.mult}`, 4, 11, { color: SAGE });
            for (let i = 0; i < 3; i++) diamond(W - 8 - i * 7, 4, i < state.lives);
            if (state.area !== area) { area = state.area; areaSince = t; }
            const shown = t - areaSince;
            // Area names: large paper-white letters on their own dark band, typed in,
            // held, then wiped away. Scale drops to fit narrow (portrait) screens.
            if (shown < 3.6) {
                const scale = 1;
                const y = Math.round(H * 0.2);
                const bandH = 5 * scale + 8;
                const reveal = Math.min(1, shown * 4), hide = shown > 3.1 ? (shown - 3.1) / 0.5 : 0;
                const bw = Math.round((width(area, scale) + 16) * reveal * (1 - hide));
                ctx.fillStyle = INK;
                ctx.fillRect(Math.round(W / 2 - bw / 2), y - 4, bw, bandH);
                for (let i = Math.round(W / 2 - bw / 2) - 2; i < W / 2 + bw / 2 + 2; i += 2) { ctx.fillRect(i, y - 6, 1, 1); ctx.fillRect(i + 1, y + bandH - 3, 1, 1); }
                const letters = Math.floor(Math.max(0, shown - 0.2) * 22);
                if (hide === 0) text(area.slice(0, letters), W / 2, y, { scale, align: "center", shadow: false });
            }
            if (state.paused) { band(Math.round(H / 2) - 8, 16); text("PAUSED", W / 2, Math.round(H / 2) - 2, { align: "center" }); return; }
            if (state.hint && (!state.urgent || blink)) text(state.hint, W / 2, H - 12, { align: "center" });
        },
    };
}
