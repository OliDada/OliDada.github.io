// Saved galaxy position and the jump / arrival effects. The map itself is starmap.js.

const STORE = "elsewhere-galaxy-v1";
export function loadGalaxyState() {
    try {
        const s = JSON.parse(localStorage.getItem(STORE) || "{}");
        return {
            current: s.current || null,
            visited: new Set(s.visited || []),
            jumps: s.jumps || 0,
        };
    } catch {
        return { current: null, visited: new Set(), jumps: 0 };
    }
}
export function saveGalaxyState(state) {
    try {
        localStorage.setItem(
            STORE,
            JSON.stringify({
                current: state.current,
                visited: [...state.visited],
                jumps: state.jumps,
            }),
        );
    } catch {}
}

// --- Jump effects ---
const reducedMotion = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches;
function overlay() {
    const c = document.createElement("canvas");
    c.className = "jump-overlay";
    document.body.append(c);
    const d = Math.min(devicePixelRatio || 1, 2);
    c.width = innerWidth * d;
    c.height = innerHeight * d;
    const g = c.getContext("2d");
    g.scale(d, d);
    return { c, g };
}
function streaks(count) {
    return Array.from({ length: count }, () => ({
        a: Math.random() * Math.PI * 2,
        d: 20 + Math.random() * 400,
        s: 0.5 + Math.random(),
    }));
}
export function playJump(destinationName, done) {
    const { c, g } = overlay(),
        parts = streaks(260),
        duration = reducedMotion() ? 500 : 2300,
        t0 = performance.now();
    const label = document.createElement("div");
    label.className = "jump-label";
    label.textContent = `JUMPING TO ${destinationName.toUpperCase()}`;
    document.body.append(label);
    (function frame(now) {
        const t = Math.min(1, (now - t0) / duration),
            cx = innerWidth / 2,
            cy = innerHeight / 2;
        g.fillStyle = `rgba(4,10,18,${0.25 + t * 0.5})`;
        g.fillRect(0, 0, innerWidth, innerHeight);
        const speed = 2 + t ** 3 * 90;
        g.lineCap = "round";
        for (const p of parts) {
            p.d += speed * p.s;
            if (p.d > Math.hypot(cx, cy)) p.d = 10 + Math.random() * 60;
            const len = 2 + t ** 2 * 160 * p.s;
            g.strokeStyle = `rgba(${200 + 55 * t},${225 + 30 * t},255,${0.35 + 0.6 * t})`;
            g.lineWidth = 0.6 + t * 1.6;
            g.beginPath();
            g.moveTo(cx + Math.cos(p.a) * p.d, cy + Math.sin(p.a) * p.d);
            g.lineTo(
                cx + Math.cos(p.a) * (p.d + len),
                cy + Math.sin(p.a) * (p.d + len),
            );
            g.stroke();
        }
        if (t > 0.82) {
            g.fillStyle = `rgba(240,250,255,${(t - 0.82) / 0.18})`;
            g.fillRect(0, 0, innerWidth, innerHeight);
        }
        if (t < 1) requestAnimationFrame(frame);
        else done();
    })(t0);
}
export function playArrival() {
    const { c, g } = overlay(),
        parts = streaks(200),
        duration = reducedMotion() ? 400 : 1400,
        t0 = performance.now();
    (function frame(now) {
        const t = Math.min(1, (now - t0) / duration),
            cx = innerWidth / 2,
            cy = innerHeight / 2;
        g.clearRect(0, 0, innerWidth, innerHeight);
        g.fillStyle = `rgba(240,250,255,${Math.max(0, 1 - t * 2.2)})`;
        g.fillRect(0, 0, innerWidth, innerHeight);
        for (const p of parts) {
            p.d += (1 - t) ** 2 * 60 * p.s;
            const len = (1 - t) ** 2 * 140 * p.s;
            g.strokeStyle = `rgba(220,240,255,${(1 - t) * 0.7})`;
            g.lineWidth = 1.5;
            g.beginPath();
            g.moveTo(cx + Math.cos(p.a) * p.d, cy + Math.sin(p.a) * p.d);
            g.lineTo(
                cx + Math.cos(p.a) * (p.d + len),
                cy + Math.sin(p.a) * (p.d + len),
            );
            g.stroke();
        }
        if (t < 1) requestAnimationFrame(frame);
        else c.remove();
    })(t0);
}
