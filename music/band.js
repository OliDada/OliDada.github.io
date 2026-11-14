// The band: one character per kind of instrument, drawn as small SVGs. Each has its own shape,
// its own eyes and its own way of being:
//   lead → Bird, the diva: crest, lashes, a beak that opens when it sings
//   keys → Cat, the clever one: big head, round glasses, slit pupils
//   pad  → Ghost, the shy dreamer: big dark eyes, floats, blushes
//   bass → Bear, the laid-back giant: tiny sleepy eyes, big snout
//   drum → Bunny, the excitable one: mismatched wide eyes, buck teeth, one floppy ear
// What they hold follows the sound (preset or drum kit), their expression follows the song's mood,
// and the whole band dresses for the song's style.
//
// Class names the Studio animates: .bob .squash .mouth .pupil .eyes .lids .ears .flair .stick-l .stick-r

const INK = "#1a1626";
const MOUTH = "#2a1630";
const PINK = "#ff9ec0";

const MOOD_OF = {
    major: "happy", pentatonic: "happy", mixolydian: "sunny", lydian: "dreamy", dorian: "cool", blues: "cool",
    minorPentatonic: "cool", minor: "sad", harmonic: "spooky", phrygian: "spooky",
};
// how the pupils sit for each mood: size, and where they look
const GAZE = { happy: [1, 0.6, 0.6], sunny: [1.05, 0.5, 0.2], dreamy: [1.3, 0.3, -0.9], cool: [1, 0.9, 0.7], sad: [1.05, 0, 1.5], spooky: [0.55, 0, 0] };
const n = (v) => Math.round(v * 100) / 100;

// ----- shared pieces of an expression. Eyes are [{x, y, r}] (left, right). -----
const lid = (e) => `<path class="body" d="M${n(e.x - e.r - .7)} ${n(e.y - e.r * .12)}a${n(e.r + .7)} ${n(e.r + .7)} 0 0 1 ${n(2 * e.r + 1.4)} 0z"/><path d="M${n(e.x - e.r - .2)} ${n(e.y - e.r * .12)}h${n(2 * e.r + .4)}" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`;

function brows(mood, eyes) {
    const d = eyes.map((e, i) => {
        const s = i ? 1 : -1; // towards the outside of the face
        if (mood === "sad") return `M${n(e.x + s * e.r * .95)} ${n(e.y - e.r - 1)}L${n(e.x - s * e.r * .7)} ${n(e.y - e.r - 4.4)}`;
        if (mood === "spooky") return `M${n(e.x + s * e.r * .75)} ${n(e.y - e.r - 2.4)}L${n(e.x - s * e.r * .5)} ${n(e.y - e.r - 4.8)}`;
        if (mood === "sunny") return `M${n(e.x - e.r * .8)} ${n(e.y - e.r - 2.4)}q${n(e.r * .8)}-2.8 ${n(e.r * 1.6)} 0`;
        if (mood === "cool") return i ? `M${n(e.x - e.r * .8)} ${n(e.y - e.r - 3)}q${n(e.r * .8)}-2.4 ${n(e.r * 1.6)} .6` : `M${n(e.x - e.r * .8)} ${n(e.y - e.r - 1)}h${n(e.r * 1.6)}`;
        return "";
    }).join("");
    return d ? `<path d="${d}" stroke="${INK}" stroke-width="1.9" fill="none" stroke-linecap="round" opacity=".8"/>` : "";
}

function extras(mood, eyes) {
    const [a, b] = eyes;
    if (mood === "sad") return `<path class="tear" d="M${n(b.x + b.r * .4)} ${n(b.y + b.r + .6)}q2.2 3.2 0 4.800q-2.2-1.6 0-4.800z" fill="#8fd3ff"/>`;
    if (mood === "spooky") return `<path class="tear" d="M${n(b.x + b.r + 3)} ${n(b.y - b.r - 3)}q2 3 0 4.400q-2-1.4 0-4.400z" fill="#bfe6ff"/>`;
    if (mood === "dreamy") {
        const star = (x, y, k) => `<path d="M${n(x)} ${n(y - 2.6 * k)}l${n(.8 * k)} ${n(1.8 * k)}l${n(1.8 * k)} ${n(.8 * k)}l${n(-1.8 * k)} ${n(.8 * k)}l${n(-.8 * k)} ${n(1.8 * k)}l${n(-.8 * k)} ${n(-1.8 * k)}l${n(-1.8 * k)} ${n(-.8 * k)}l${n(1.8 * k)} ${n(-.8 * k)}z" fill="#fff6c9"/>`;
        return `<g class="sparkle">${star(a.x - a.r - 3.5, a.y - a.r - 1, 1)}${star(b.x + b.r + 4, b.y - b.r - 4, .7)}</g>`;
    }
    return "";
}

// A mouth: the line is the expression, the little dark shape (.mouth) is what opens when they sing.
function mouth(cx, y, w, mood) {
    const line = (d) => `<path d="${d}" stroke="${MOUTH}" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    const hole = (x, yy, rx, ry) => `<ellipse class="mouth" cx="${n(x)}" cy="${n(yy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${MOUTH}"/>`;
    if (mood === "sunny") return `<g class="mouth"><path d="M${n(cx - w - 1)} ${n(y - 1)}q${n(w + 1)} ${n(w * 1.9 + 1)} ${n(2 * w + 2)} 0z" fill="${MOUTH}"/><ellipse cx="${cx}" cy="${n(y + w * .62)}" rx="${n(w * .5)}" ry="${n(w * .3)}" fill="#ff7a9c"/></g>`;
    if (mood === "dreamy") return line(`M${n(cx - w * .6)} ${y}q${n(w * .6)} 2 ${n(w * 1.2)} 0`) + hole(cx, y + 1.2, w * .42, 1);
    if (mood === "cool") return line(`M${n(cx - w)} ${n(y + .6)}q${n(w * 1.2)} 2.6 ${n(2 * w)}-1.6`) + hole(cx + w * .35, y + 1.1, w * .4, .8);
    if (mood === "sad") return line(`M${n(cx - w)} ${n(y + 2.6)}q${w}-3.8 ${n(2 * w)} 0`) + hole(cx, y + 1.3, w * .4, .7);
    if (mood === "spooky") { const q = n(w / 2); return `<g class="mouth">${line(`M${n(cx - w)} ${n(y + 1)}q${n(q / 2)}-2.6 ${q} 0t${q} 0t${q} 0t${q} 0`)}</g>`; }
    return line(`M${n(cx - w)} ${y}q${w} ${n(w * .95)} ${n(2 * w)} 0`) + hole(cx, y + w * .5, w * .5, 1.1);
}

const cheeks = (y, x1 = 15.5, x2 = 48.5, o = .5) => `<ellipse cx="${x1}" cy="${y}" rx="3.4" ry="2.4" fill="${PINK}" opacity="${o}"/><ellipse cx="${x2}" cy="${y}" rx="3.4" ry="2.4" fill="${PINK}" opacity="${o}"/>`;
const sleepLids = (eyes) => `<g class="lids"><path d="${eyes.map((e) => `M${n(e.x - e.r)} ${n(e.y)}q${n(e.r)} ${n(e.r * .7)} ${n(2 * e.r)} 0`).join("")}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>`;

// classic eyes: a white with a pupil that looks around
function whiteEyes(eyes, pr, mood, slit = false) {
    const [s, dx, dy] = GAZE[mood] ?? GAZE.happy;
    return eyes.map((e) => {
        const r = mood === "spooky" ? e.r + .5 : e.r, px = e.x + dx, py = e.y + dy;
        const pupil = slit
            ? `<ellipse class="pupil" cx="${n(px)}" cy="${n(py)}" rx="${n(pr * .72 * s)}" ry="${n(pr * 1.15 * s)}" fill="${INK}"/>`
            : `<circle class="pupil" cx="${n(px)}" cy="${n(py)}" r="${n(pr * s)}" fill="${INK}"/>`;
        return `<circle cx="${e.x}" cy="${e.y}" r="${n(r)}" fill="#fff"/>${pupil}<circle cx="${n(px + pr * .42)}" cy="${n(py - pr * .48)}" r="${n(pr * .36)}" fill="#fff"/>${mood === "dreamy" || mood === "sad" ? `<circle cx="${n(px - pr * .5)}" cy="${n(py + pr * .5)}" r="${n(pr * .2)}" fill="#fff"/>` : ""}`;
    }).join("");
}

// ----- the five characters -----
const SPECIES = {
    lead(mood) {
        const eyes = [{ x: 25, y: 24, r: 5.6 }, { x: 39, y: 24, r: 5.6 }];
        const open = mood === "sunny" ? 2.4 : mood === "spooky" ? 1.6 : .9;
        const lashes = eyes.map((e, i) => { const s = i ? 1 : -1; return `M${n(e.x + s * 4)} ${n(e.y - 4.2)}l${s * 2.2}-2.400M${n(e.x + s * 5.3)} ${n(e.y - 1.8)}l${s * 2.8}-1.3`; }).join("");
        return {
            faceY: 24, top: 10, hat: .9, above: -4,
            back: `<path class="body shade" d="M13 47q-11-1-11-10q6 1 11 5zM13 51q-10 3-12-4q6-1 12 1z"/>
                <path d="M26 56v4M38 56v4" stroke="#f08a24" stroke-width="2"/><ellipse cx="25" cy="60" rx="4.5" ry="1.8" fill="#ffb547"/><ellipse cx="39" cy="60" rx="4.5" ry="1.8" fill="#ffb547"/>`,
            body: `<g class="flair"><path class="body tint" d="M28 12C21 8 21 2 25-1C25 4 28 7 31 9Z"/><path class="body tint" d="M31 11C26 3 29-3 35-4C32 1 33 6 35 9Z"/><path class="body tint" d="M35 11C35 4 39 0 44 1C41 4 41 8 39 12Z"/></g>
                <path class="body" d="M32 9C44 9 50 18 50 28C50 33 55 38 55 45C55 54 45 58 32 58C19 58 9 54 9 45C9 38 14 33 14 28C14 18 20 9 32 9Z"/>
                <ellipse cx="32" cy="47" rx="14" ry="9" fill="#fff" opacity=".2"/>
                <ellipse class="body shade" cx="10" cy="44" rx="4.2" ry="8" transform="rotate(12 10 44)"/><ellipse class="body shade" cx="54" cy="44" rx="4.2" ry="8" transform="rotate(-12 54 44)"/>`,
            face: `<g class="eyes">${whiteEyes(eyes, 2.9, mood)}${mood === "cool" ? eyes.map(lid).join("") : ""}<path d="${lashes}" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>${brows(mood, eyes)}${extras(mood, eyes)}</g>${sleepLids(eyes)}
                ${cheeks(31, 18.5, 45.5)}
                <path d="M29 33.300h6l-3 ${n(3.2 + open)}z" fill="#f08a24"/><ellipse class="mouth" cx="32" cy="33.4" rx="2.7" ry="${open}" fill="${MOUTH}"/>
                <path d="M27 29.600Q32 26.2 37 29.600L32 ${mood === "sad" ? 33.2 : 34}Z" fill="#ffb547"/>`,
        };
    },
    keys(mood) {
        const eyes = [{ x: 23, y: 28, r: 6.6 }, { x: 41, y: 28, r: 6.6 }];
        const m = mood === "happy" || mood === "dreamy" || mood === "sunny"
            ? `<path d="M28.4 38.400q1.8 2.5 3.6 0q1.8 2.5 3.6 0" stroke="${MOUTH}" stroke-width="1.5" fill="none" stroke-linecap="round"/><ellipse class="mouth" cx="32" cy="${mood === "sunny" ? 41 : 40.5}" rx="${mood === "sunny" ? 2.4 : 1.7}" ry="${mood === "sunny" ? 1.9 : .7}" fill="${MOUTH}"/>`
            : mouth(32, 39, 3, mood);
        return {
            faceY: 28, top: 11.5, hat: 1, above: 1,
            back: `<path class="tail" d="M47 52q13 0 12-13q-1-6-5-4" stroke="var(--c)" stroke-width="5" fill="none" stroke-linecap="round"/>`,
            body: `<g class="flair ears"><path class="body" d="M9 25L10 1L27 12Z"/><path class="body" d="M55 25L54 1L37 12Z"/><path d="M13 17L13.5 6.500L21.5 12Z" fill="${PINK}" opacity=".85"/><path d="M51 17L50.5 6.500L42.5 12Z" fill="${PINK}" opacity=".85"/></g>
                <rect class="body" x="17" y="38" width="30" height="21" rx="10"/>
                <rect class="body" x="7" y="10" width="50" height="37" rx="18"/>
                <ellipse cx="32" cy="52" rx="8" ry="5" fill="#fff" opacity=".18"/>
                <path d="M9 36l-8-1.500M9 39.500l-8 2M55 36l8-1.500M55 39.500l8 2" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>`,
            face: `<g class="eyes">${whiteEyes(eyes, 2.9, mood, true)}${mood === "cool" ? eyes.map(lid).join("") : ""}${brows(mood, eyes)}${extras(mood, eyes)}</g>${sleepLids(eyes)}
                <g fill="none" stroke="#2a2440" stroke-width="1.7"><circle cx="23" cy="28" r="7.3"/><circle cx="41" cy="28" r="7.3"/><path d="M30.3 28q1.7-1.6 3.4 0M15.7 27.500l-5.5-1.500M48.3 27.500l5.5-1.5" stroke-linecap="round"/></g>
                ${cheeks(37, 14.5, 49.5, .45)}<path d="M30.3 35.400h3.400l-1.7 2.100z" fill="#ff8fb3"/>${m}`,
        };
    },
    pad(mood) {
        const eyes = [{ x: 25, y: 26, r: 5.2 }, { x: 39, y: 26, r: 5.2 }];
        const big = mood === "spooky" || mood === "dreamy";
        const hollow = eyes.map((e, i) => `<ellipse cx="${e.x}" cy="${e.y}" rx="${big ? 4.7 : 4.1}" ry="${big ? 6.3 : 5.5}" fill="${INK}"${mood === "sad" ? ` transform="rotate(${i ? -14 : 14} ${e.x} ${e.y})"` : ""}/>` + (mood === "spooky"
            ? `<circle class="pupil" cx="${e.x}" cy="${e.y}" r="1.3" fill="#fff"/>`
            : `<circle class="pupil" cx="${n(e.x - 1.2)}" cy="${n(e.y - 2.2)}" r="${mood === "dreamy" ? 2 : 1.6}" fill="#fff"/><circle cx="${n(e.x + 1.3)}" cy="${n(e.y + 2)}" r="${mood === "dreamy" ? 1.1 : .7}" fill="#fff" opacity=".9"/>`)).join("");
        return {
            faceY: 26, top: 8, hat: .9, above: 2,
            back: ``,
            body: `<path d="M32 8q-1-6 5-6" stroke="var(--c)" stroke-width="3" fill="none" stroke-linecap="round"/>
                <path class="body" opacity=".95" d="M10 33C10 16 20 7 32 7C44 7 54 16 54 33V58L47.5 52L40 58L32 52L24 58L16.5 52L10 58Z"/>
                <path d="M16 30C16 19 22 12 30 11" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".28"/>
                <g class="flair"><ellipse class="body shade" cx="8" cy="38" rx="5" ry="3.2" transform="rotate(-28 8 38)"/><ellipse class="body shade" cx="56" cy="38" rx="5" ry="3.2" transform="rotate(28 56 38)"/></g>`,
            face: `<g class="eyes">${hollow}${mood === "cool" ? eyes.map(lid).join("") : ""}${brows(mood, eyes)}${extras(mood, eyes)}</g>${sleepLids(eyes)}
                ${cheeks(34, 18.5, 45.5, .6)}${mouth(32, 35.5, 2.6, mood)}`,
        };
    },
    bass(mood) {
        const eyes = [{ x: 21.5, y: 35, r: 3.6 }, { x: 42.5, y: 35, r: 3.6 }];
        const [s, dx, dy] = GAZE[mood] ?? GAZE.happy;
        const wide = mood === "spooky" || mood === "dreamy";
        const dots = eyes.map((e) => `${wide ? `<circle cx="${e.x}" cy="${e.y}" r="4.6" fill="#fff"/>` : ""}<circle class="pupil" cx="${n(e.x + dx * .5)}" cy="${n(e.y + dy * .5)}" r="${n(2.6 * (mood === "spooky" ? .6 : mood === "dreamy" ? 1.25 : 1))}" fill="${INK}"/><circle cx="${n(e.x + dx * .5 + .9)}" cy="${n(e.y + dy * .5 - 1)}" r=".85" fill="#fff"/>`).join("");
        const heavy = wide ? "" : `<path d="${eyes.map((e) => `M${n(e.x - 4.4)} ${n(e.y - 2.5)}h8.8`).join("")}" stroke="${INK}" stroke-width="2.3" stroke-linecap="round" opacity=".8"/>`;
        return {
            faceY: 35, top: 21, hat: 1.15, above: 15,
            back: ``,
            body: `<g class="flair ears"><circle class="body" cx="12.5" cy="23.5" r="7.5"/><circle class="body" cx="51.5" cy="23.5" r="7.5"/><circle cx="12.5" cy="23.5" r="3.8" fill="${PINK}" opacity=".55"/><circle cx="51.5" cy="23.5" r="3.8" fill="${PINK}" opacity=".55"/></g>
                <path class="body" d="M4 42C4 27 16 19.5 32 19.500C48 19.5 60 27 60 42C60 54 50 59 32 59C14 59 4 54 4 42Z"/>
                <ellipse cx="32" cy="45" rx="10.5" ry="8" fill="#fff" opacity=".32"/>`,
            face: `<g class="eyes">${dots}${heavy}${brows(mood, eyes)}${extras(mood, eyes)}</g>${sleepLids(eyes.map((e) => ({ ...e, r: 4.4 })))}
                ${cheeks(42, 13.5, 50.5, .4)}
                <ellipse cx="32" cy="40.6" rx="3.6" ry="2.4" fill="${MOUTH}"/><ellipse cx="31" cy="39.9" rx="1.1" ry=".6" fill="#fff" opacity=".5"/><path d="M32 43v2" stroke="${MOUTH}" stroke-width="1.5" stroke-linecap="round"/>
                ${mouth(32, 45.2, 3.6, mood)}`,
        };
    },
    drum(mood, look) {
        const eyes = [{ x: 23.5, y: 27, r: 7 }, { x: 41, y: 28, r: 5.6 }];
        const band = { retro: "#5ce06a", soft: "#f3d9b1", big: "#ffd166" }[look.kit] ?? "#ff5f6d";
        const grin = mood === "happy" || mood === "sunny" || mood === "dreamy";
        const m = grin
            ? `<g class="mouth"><path d="M26 36.500q6 ${mood === "dreamy" ? 6 : 9} 12 0z" fill="${MOUTH}"/><ellipse cx="32" cy="${mood === "dreamy" ? 38.8 : 40.2}" rx="2.6" ry="1.3" fill="#ff7a9c"/></g>`
            : mouth(32, 37.5, 4, mood);
        return {
            faceY: 27.5, top: 12.5, hat: .85, above: -4,
            back: `<g class="flair ears"><ellipse class="body" cx="23" cy="7" rx="4.6" ry="11.5" transform="rotate(-9 23 16)"/><ellipse cx="23" cy="7.5" rx="2" ry="7.5" fill="#ffc2d6" transform="rotate(-9 23 16)"/>
                <ellipse class="body" cx="43" cy="6" rx="4.6" ry="11.5" transform="rotate(52 41 16)"/><ellipse cx="43" cy="6.5" rx="2" ry="7.5" fill="#ffc2d6" transform="rotate(52 41 16)"/></g>`,
            body: `<path class="body" d="M32 11C45.5 11 53 20 53 31C53 43 44.5 49 32 49C19.5 49 11 43 11 31C11 20 18.5 11 32 11Z"/>
                <path class="body tint" d="M28 13q0-6 4-8q-1 4 0 6q2-4 6-4q-3 3-3 7z"/>
                <path d="M12.5 22.500q19.5-7.5 39 0" stroke="${band}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`,
            face: `<g class="eyes">${whiteEyes(eyes, 2.1, mood)}${mood === "cool" ? eyes.map(lid).join("") : ""}${brows(mood, eyes)}${extras(mood, eyes)}</g>${sleepLids(eyes)}
                ${cheeks(36, 15, 49, .55)}${m}
                <rect x="29.3" y="${grin ? 36.2 : 38.6}" width="2.6" height="3.6" rx=".7" fill="#fff"/><rect x="32.1" y="${grin ? 36.2 : 38.6}" width="2.6" height="3.6" rx=".7" fill="#fff"/>`,
        };
    },
};

// ----- what the band wears: the style -----
function outfit(style, sp) {
    const hat = {
        lofi: `<path d="M-13 0q0-14 13-14q13 0 13 14z" fill="#f3d9b1"/><rect x="-14.5" y="-3.5" width="29" height="5.5" rx="2.75" fill="#e2a878"/><circle cx="0" cy="-15" r="3.2" fill="#fff7ea"/>`,
        dreamy: `<g class="sparkle"><path d="M4-17a7 7 0 1 0 8 9.5a5.6 5.6 0 1 1-8-9.5z" fill="#ffe9a8"/><path d="M-10-12l.9 2.1l2.1.9l-2.1.9l-.9 2.1l-.9-2.1l-2.1-.9l2.1-.9z" fill="#fff"/></g>`,
        fairy: `<path d="M-13 0q13-7 26 0" stroke="#6fcf7f" stroke-width="2.6" fill="none" stroke-linecap="round"/>${[[-11, -1, "#ff9ec0"], [-5.5, -3.2, "#fff"], [0, -4, "#ffd166"], [5.5, -3.2, "#fff"], [11, -1, "#ff9ec0"]].map(([x, yy, c]) => `<circle cx="${x}" cy="${yy}" r="2.7" fill="${c}"/><circle cx="${x}" cy="${yy}" r="1" fill="#ffb547"/>`).join("")}`,
    }[style];
    const y = sp.faceY;
    const visor = style === "synth"
        ? `<rect x="14.5" y="${y - 5.5}" width="35" height="10" rx="5" fill="#ff5fd2" opacity=".34"/><rect x="14.5" y="${y - 5.5}" width="35" height="10" rx="5" fill="none" stroke="#ff7ae0" stroke-width="1.3"/><path d="M19 ${y - 3}h7" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>`
        : "";
    // chiptune: a pixel heart floats over everyone's head, like lives in an old game
    const rows = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."], u = 1.15;
    const heart = style === "chip"
        ? `<g class="pixel-heart" shape-rendering="crispEdges" transform="translate(${32 - 3.5 * u} ${sp.above - 6 * u - 1.5})">${rows.map((row, y) => [...row].map((ch, x) => (ch === "X" ? `<rect x="${n(x * u)}" y="${n(y * u)}" width="${n(u + .05)}" height="${n(u + .05)}" fill="${x === 1 && y === 1 ? "#ffd3da" : "#ff4d6d"}"/>` : "")).join("")).join("")}</g>`
        : "";
    return (hat ? `<g class="hat" transform="translate(32 ${sp.top}) scale(${sp.hat})">${hat}</g>` : "") + visor + heart;
}

// ----- what they play: the sound -----
const MIC = `<rect x="45" y="42" width="3.5" height="16" rx="1.75" fill="#4a4a5a"/><circle cx="46.75" cy="40" r="5" fill="#b9b8c9"/><circle cx="46.75" cy="40" r="5" fill="none" stroke="#7a7990" stroke-dasharray="1.5 1.5"/>`;
const KEYBED = `<rect x="3" y="49" width="58" height="12" rx="3" fill="#ecebf5"/>${[9, 16, 27, 34, 41, 52].map((x) => `<rect x="${x}" y="49" width="4" height="7" rx="1" fill="#2a2a35"/>`).join("")}`;
const PAWS = `<ellipse class="body shade" cx="20" cy="49.5" rx="4.5" ry="3"/><ellipse class="body shade" cx="44" cy="49.5" rx="4.5" ry="3"/>`;
const UPRIGHT = `<rect x="47" y="2" width="4" height="34" rx="2" fill="#8a6a4f" transform="rotate(28 49 19)"/><ellipse cx="42" cy="44" rx="9" ry="7" fill="#a5805f" transform="rotate(28 42 44)"/>`;
const STICKS = `<g class="stick stick-l"><rect x="5" y="33" width="19" height="3.2" rx="1.6" fill="#f0d2a8"/></g><g class="stick stick-r"><rect x="40" y="33" width="19" height="3.2" rx="1.6" fill="#f0d2a8"/></g>`;
const SNARE = (fill, top, line) => `<rect x="12" y="48" width="40" height="13" rx="3" fill="${fill}"/><ellipse cx="32" cy="48" rx="20" ry="4.5" fill="${top}"/><path d="M12 52h40M12 57h40" stroke="${line}" stroke-width="1"/>`;

const PROPS = {
    lead: {
        "": MIC,
        "Chip Lead": `<rect x="45" y="44" width="3.5" height="14" fill="#4a4a5a"/><g shape-rendering="crispEdges"><rect x="41.5" y="35" width="10" height="10" fill="#b9b8c9"/><rect x="43.5" y="37" width="2" height="2" fill="#5ce06a"/><rect x="47.5" y="39" width="2" height="2" fill="#5ce06a"/><rect x="43.5" y="41" width="2" height="2" fill="#5ce06a"/></g>`,
        "Saw Lead": `<rect x="22" y="47" width="34" height="3" rx="1.2" fill="#3a2a35" transform="rotate(-24 22 48)"/><path d="M10 54l12-10l7 7l-10 9z" fill="#ff5f6d"/><path d="M15 53l8-6" stroke="#fff" stroke-width="1" opacity=".7"/><path d="M52 31l3-5l-1 4l3-1l-4 5z" fill="#ffe14d"/>`,
        "Flute": `<rect x="20" y="46.5" width="40" height="3.4" rx="1.7" fill="#dfe3ee"/><circle cx="36" cy="48.2" r=".9" fill="#7a7990"/><circle cx="43" cy="48.2" r=".9" fill="#7a7990"/><circle cx="50" cy="48.2" r=".9" fill="#7a7990"/><rect x="20" y="46.5" width="5" height="3.4" rx="1.7" fill="#ffd166"/>`,
        "Pluck": `<rect x="26" y="49" width="30" height="2.6" rx="1.2" fill="#6b4423" transform="rotate(-22 26 50)"/><ellipse cx="22" cy="52" rx="9" ry="6.5" fill="#dba066"/><circle cx="23" cy="52" r="2.2" fill="#6b4423"/>`,
        "Wind": `<g class="sparkle" fill="none" stroke="#d6ecff" stroke-width="1.8" stroke-linecap="round"><path d="M2 20q6-4 9 0t-3 3"/><path d="M52 14q7-3 9 2t-4 2"/><path d="M50 52q6-2 9 1"/></g>`,
        "Laser": `<path d="M46 44l-2 14" stroke="#4a4a5a" stroke-width="3" stroke-linecap="round"/><g class="sparkle"><path d="M47 34l1.6 3.9l3.9 1.6l-3.9 1.6L47 45l-1.6-3.9l-3.9-1.6l3.9-1.6z" fill="#7df9ff"/></g>`,
    },
    keys: {
        "": KEYBED + PAWS,
        "Electric Piano": `<rect x="3" y="45.5" width="58" height="5" rx="2" fill="#e0485a"/><circle cx="9" cy="48" r="1.1" fill="#fff"/><circle cx="13" cy="48" r="1.1" fill="#fff"/>` + KEYBED.replace(/y="49"/g, `y="50"`) + PAWS,
        "Organ": KEYBED + PAWS,
        "Bell": `${["#ff7a7a", "#ffb547", "#ffe14d", "#7fe08a", "#6fb6ff", "#9b87ff", "#ff8fd0"].map((c, i) => `<rect x="${5 + i * 7.9}" y="${48 + i * 0.5}" width="6.4" height="${13 - i}" rx="1.6" fill="${c}"/>`).join("")}<path d="M45 40l8 8" stroke="#f0d2a8" stroke-width="2" stroke-linecap="round"/><circle cx="53.5" cy="48.5" r="2.4" fill="#ff8fb3"/>` + `<ellipse class="body shade" cx="20" cy="48.5" rx="4.5" ry="3"/>`,
        "Music Box": `<rect x="12" y="48" width="36" height="13" rx="3" fill="#c98b5a"/><rect x="12" y="48" width="36" height="4" rx="2" fill="#e2ad7c"/><circle cx="22" cy="56" r="1" fill="#fff3d6"/><circle cx="28" cy="57.5" r="1" fill="#fff3d6"/><circle cx="34" cy="55.5" r="1" fill="#fff3d6"/><circle cx="40" cy="57" r="1" fill="#fff3d6"/><path d="M48 55h6v-5" stroke="#8a8aa0" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="54" cy="49" r="2" fill="#ffd166"/>` + PAWS,
    },
    pad: {
        "": `<g class="sparkle"><path d="M7 10l1.2 2.8L11 14l-2.8 1.2L7 18l-1.2-2.8L3 14l2.8-1.2z" fill="#fff"/><circle cx="58" cy="20" r="1.6" fill="#fff"/><circle cx="54" cy="5" r="1.1" fill="#fff"/></g>`,
        "Warm Pad": `<g class="sparkle"><circle cx="32" cy="47" r="7" fill="#ffb37a" opacity=".35"/></g><path d="M32 51.5c-6-4-6-8-3-8.6c1.6-.3 2.6.8 3 1.8c.4-1 1.4-2.1 3-1.8c3 .6 3 4.6-3 8.600z" fill="#ff8f7a"/>`,
        "Glass Pad": `<g class="sparkle" fill="#c8f4ff"><path d="M6 16l3-5l3 5l-3 5z"/><path d="M55 8l2.4-4l2.4 4l-2.4 4z"/><path d="M56 44l2-3.400l2 3.400l-2 3.400z"/></g>`,
        "Strings": `<path d="M40 30l18 26" stroke="#f3e6c8" stroke-width="1.6" stroke-linecap="round"/><rect x="47.8" y="30" width="2.4" height="14" rx="1" fill="#5a3418"/><circle cx="49" cy="46" r="4.2" fill="#b5651d"/><circle cx="49" cy="52" r="5.4" fill="#b5651d"/><path d="M47.5 49h3" stroke="#5a3418" stroke-width="1"/>`,
        "Choir": `<path d="M20 46l12 2.500v10L20 56z" fill="#fff"/><path d="M44 46l-12 2.500v10L44 56z" fill="#f1eeff"/><path d="M23 50l6 1.200M23 53l6 1.200M41 50l-6 1.200M41 53l-6 1.2" stroke="#9b87ff" stroke-width=".9"/><g class="sparkle"><circle cx="57" cy="14" r="1.5" fill="#fff"/><circle cx="8" cy="18" r="1.2" fill="#fff"/></g>`,
    },
    bass: {
        "": UPRIGHT,
        "Sub Bass": `<path d="M8 40q0-23 24-23q24 0 24 23" stroke="#2f2f3d" stroke-width="3.2" fill="none" stroke-linecap="round"/><rect x="2.5" y="36" width="8" height="13" rx="3.5" fill="#2f2f3d"/><rect x="53.5" y="36" width="8" height="13" rx="3.5" fill="#2f2f3d"/><rect x="4.5" y="39" width="2" height="7" rx="1" fill="#7df9ff"/><rect x="57.5" y="39" width="2" height="7" rx="1" fill="#7df9ff"/>`,
        "Synth Bass": `<g transform="rotate(-10 32 53)"><rect x="40" y="49" width="20" height="3.4" rx="1.5" fill="#3a2a55"/><rect x="8" y="46" width="36" height="11" rx="3" fill="#7f6bff"/><rect x="11" y="50" width="30" height="5" rx="1" fill="#f4f2ff"/>${[15, 19, 27, 31, 35].map((x) => `<rect x="${x}" y="50" width="2.2" height="3" fill="#2a2a35"/>`).join("")}</g>`,
        "Chip Bass": `<g shape-rendering="crispEdges"><rect x="21" y="45" width="22" height="15" fill="#c9c9d6"/><rect x="24" y="47" width="16" height="6" fill="#5ce06a"/><rect x="25" y="55" width="5" height="2" fill="#2f2f3d"/><rect x="26.5" y="53.5" width="2" height="5" fill="#2f2f3d"/><rect x="36" y="55" width="3" height="3" fill="#ff5f6d"/></g>`,
        "Pluck Bass": UPRIGHT,
    },
    drum: {
        "": STICKS + SNARE("#d9d2ff", "#f4f2ff", "#b9aaff"),
        retro: STICKS + `<path d="M8 50l6-3.500h10l6 3.500v8H8z" fill="#2a2a3d" stroke="#5ce06a" stroke-width="1.3"/><path d="M34 50l6-3.500h10l6 3.500v8H34z" fill="#2a2a3d" stroke="#ff5fd2" stroke-width="1.3"/>`,
        soft: STICKS + `<rect x="9" y="49" width="20" height="12" rx="4" fill="#c98b5a"/><ellipse cx="19" cy="49" rx="10" ry="3.2" fill="#f6e7cf"/><rect x="33" y="47" width="23" height="14" rx="4" fill="#b87a4c"/><ellipse cx="44.5" cy="47" rx="11.5" ry="3.5" fill="#f6e7cf"/>`,
        big: `<path d="M57 30v30" stroke="#8a8aa0" stroke-width="1.6"/><ellipse cx="57" cy="30" rx="7" ry="2" fill="#ffd166" transform="rotate(-10 57 30)"/>` + STICKS + SNARE("#ff8fb3", "#fff0f5", "#ff5f8f").replace(`x="12" y="48" width="40" height="13"`, `x="8" y="48" width="44" height="14"`).replace(`cx="32" cy="48" rx="20"`, `cx="30" cy="48" rx="22"`),
    },
};
const BACK_PROPS = {
    keys: { "Organ": `${[[4, 20], [9, 12], [14, 24], [47, 24], [52, 12], [57, 20]].map(([x, y]) => `<rect x="${x}" y="${y}" width="3.6" height="${52 - y}" rx="1.8" fill="#d9c27a"/><ellipse cx="${x + 1.8}" cy="${y + 4}" rx="1" ry="1.8" fill="#7a6a35"/>`).join("")}` },
};

// look: { preset, kit, scale, style }
export function creature(role, look = {}) {
    const r = SPECIES[role] ? role : "lead";
    const mood = MOOD_OF[look.scale] ?? "happy";
    const sp = SPECIES[r](mood, look);
    const variant = r === "drum" ? look.kit : look.preset;
    const prop = PROPS[r][variant] ?? PROPS[r][""];
    const backProp = BACK_PROPS[r]?.[variant] ?? "";
    return `<svg viewBox="0 0 64 64" class="creature r-${r} m-${mood}" aria-hidden="true">
      <ellipse class="ground" cx="32" cy="61" rx="20" ry="2.6" fill="rgba(0,0,0,.35)"/>
      <g class="idle"><g class="bob"><g class="breath"><g class="squash">
        ${backProp}${sp.back}${sp.body}
        <g class="face">${sp.face}</g>
        ${outfit(look.style, sp)}
      </g></g></g></g><g class="prop">${prop}</g></svg>`;
}
