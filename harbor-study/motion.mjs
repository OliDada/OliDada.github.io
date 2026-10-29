// Route generation and the running simulation. Every run gets its own seed:
// lengths, turn directions, elevation, narrow beams, covered passages, gaps,
// hazards, districts and forks are all drawn from it.

export const route = [];
export let routeRevision = 0;
export let seed = 1;

export function random(n) {
    const v = Math.sin(n * 127.1 + seed * 311.7 + 83.7) * 43758.5453;
    return v - Math.floor(v);
}

export const DECK = 3.6, BEAM = 0.5, RAMP = 8;

// District blocks: the harbor opens every run, then a shuffled sequence.
function areaSequence(n) {
    if (n < 3) return "harbor";
    let index = 3, block = 0;
    while (true) {
        const size = 3 + Math.floor(random(9000 + block) * 3) + (random(9100 + block) > 0.66 ? 2 : 0);
        if (n < index + size) {
            const kinds = ["swamp", "village", "exposed", "harbor", "forest", "forest"];
            let kind = kinds[Math.floor(random(9100 + block) * kinds.length)];
            if (block === 0 && kind === "harbor") kind = "swamp";
            return kind;
        }
        index += size;
        block++;
    }
}

// Lay out ramps, gaps and hazards along one stretch without overlaps.
function furnish(s, n) {
    const L = s.length, used = [];
    const free = (a, b) => used.every(([u, v]) => b < u - 6 || a > v + 6);
    const claim = (a, b) => used.push([a, b]);
    s.ramp = null;
    if (s.rise) {
        const start = 5 + random(n * 7 + 1) * Math.max(0, L - RAMP - 12);
        s.ramp = { start, end: start + RAMP };
        claim(s.ramp.start - 1, s.ramp.end + 1);
    }
    const place = (len, salt) => {
        for (let k = 0; k < 12; k++) {
            const a = 7.5 + random(n * 31 + salt * 7 + k) * Math.max(1, L - 22 - len);
            if (free(a, a + len)) { claim(a, a + len); return a; }
        }
        return null;
    };
    s.gap = null;
    const gapChance = n === 0 ? 1 : s.narrow ? 0.55 : 0.5;
    if (random(n * 13 + 2) < gapChance) {
        const width = 2.6 + random(n + 8) * 0.7;
        const a = place(width, 1);
        if (a !== null) s.gap = { segment: n, start: a, end: a + width };
    }
    s.hazards = [];
    const count = n < 1 ? 0 : s.narrow ? (random(n * 3 + 5) < 0.4 ? 1 : 0) : 1 + Math.floor(random(n * 3 + 6) * 2.4);
    for (let h = 0; h < count; h++) {
        const at = place(1, 10 + h);
        if (at === null) continue;
        const type = s.narrow || random(n * 17 + h) < 0.45 ? "beam" : "cargo";
        const lane = type === "cargo" ? [-0.9, 0, 0.9][Math.floor(random(n * 23 + h) * 3)] : 0;
        s.hazards.push({ at: at + 0.5, type, lane });
    }
    s.hazards.sort((a, b) => a.at - b.at);
    // A covered passage: through a house, or under a row of archways.
    s.cover = null;
    if (!s.narrow && n > 0 && random(n * 41 + 3) < 0.38) {
        const len = 10 + random(n * 41 + 4) * 8;
        const start = 4 + random(n * 41 + 5) * Math.max(0, L - len - 10);
        s.cover = { type: random(n * 41 + 6) < 0.5 ? "house" : "arches", start, end: start + len };
    } else if (s.narrow && random(n * 41 + 7) < 0.5) {
        s.cover = { type: "arches", start: 3, end: L - 3 };
    }
}

function makeSegment(n, x, z, dx, dz, y, forkAllowed = true) {
    const north = dz === -1;
    const narrow = n > 1 && random(n * 5 + 3) < 0.26;
    const length = narrow
        ? 16 + Math.floor(random(n) * 8)
        : north ? 30 + Math.floor(random(n) * 22) : 22 + Math.floor(random(n) * 16);
    let rise = 0;
    if (n > 0 && random(n * 11 + 4) < 0.45) rise = random(n * 11 + 5) < 0.5 ? 1.7 : -1.7;
    if (y + rise > 3.5 || y + rise < -0.1) rise = -rise;
    if (y + rise > 3.5 || y + rise < -0.1) rise = 0;
    const s = {
        x, z, dx, dz, length, turn: 0, y, rise,
        narrow, width: narrow ? BEAM : DECK,
        area: areaSequence(n),
        fork: forkAllowed && north && !narrow && n >= 2 && random(n * 19 + 9) < 0.3,
    };
    if (s.fork) s.narrow = false, s.width = DECK;
    furnish(s, n);
    return s;
}

export function ensureRoute(index) {
    while (route.length < index + 7) {
        const n = route.length, prev = route[n - 1];
        const x = prev.x + prev.dx * prev.length,
            z = prev.z + prev.dz * prev.length;
        let dx = 0, dz = -1;
        if (prev.dz) {
            // Leaving a northward leg: east or west, but drift back toward the coast.
            dz = 0;
            dx = x > 30 ? -1 : x < -30 ? 1 : random(n * 3 + 1) < 0.5 ? -1 : 1;
        }
        prev.turn = prev.dx * dz - prev.dz * dx;
        route.push(makeSegment(n, x, z, dx, dz, prev.y + prev.rise));
    }
}

export function newRoute(value = Math.floor(Math.random() * 1e9)) {
    seed = value;
    route.length = 0;
    route.push(makeSegment(0, 0, 12, 0, -1, 0, false));
    route[0].length = 38;
    furnish(route[0], 0);
    ensureRoute(0);
    routeRevision++;
    return seed;
}
newRoute();

export const gap = { get segment() { return route.findIndex(s => s.gap); }, get start() { return firstGap().start; }, get end() { return firstGap().end; } };
function firstGap() { return route.find(s => s.gap)?.gap; }
export function gapFor(index) { return route[index]?.gap ?? null; }
export const isFork = index => !!route[index]?.fork;
export const areaFor = index => route[index]?.area ?? areaSequence(index);
export function hazardsFor(index) { return route[index]?.hazards ?? []; }

// Deck height along a stretch: a smooth ramp between two levels.
export function groundAt(index, p) {
    const s = route[index];
    if (!s) return 0;
    if (!s.ramp) return s.y;
    const t = Math.min(1, Math.max(0, (p - s.ramp.start) / RAMP));
    return s.y + s.rise * t * t * (3 - 2 * t);
}
export function slopeAt(index, p) {
    const s = route[index];
    if (!s?.ramp) return 0;
    const t = Math.min(1, Math.max(0, (p - s.ramp.start) / RAMP));
    return (s.rise * 6 * t * (1 - t)) / RAMP;
}

export function chooseBranch(index, turn) {
    if (!isFork(index) || ![-1, 1].includes(turn)) return;
    const s = route[index];
    if (s.turn === turn) return;
    route.splice(index + 1);
    s.turn = turn;
    const n = index + 1;
    const next = makeSegment(n, s.x + s.dx * s.length, s.z + s.dz * s.length, -s.dz * turn, s.dx * turn, s.y + s.rise, false);
    next.length = 30 + Math.floor(random(index + turn * 7) * 9);
    furnish(next, n + (turn > 0 ? 500 : 0));
    route.push(next);
    ensureRoute(index + 1);
    routeRevision++;
}
export function createRun() {
    return {
        lane: 0, laneTarget: 0, duck: false,
        segment: 0,
        progress: 0,
        jumpHeight: 0,
        vy: 0,
        buffer: 0,
        queued: 0,
        turnTime: 0,
        turnFrom: 0,
        heading: 0,
        state: "running",
        distance: 0,
        speed: 8.5,
        failAt: 0,
        score: 0,
        combo: 0,
        events: [],
    };
}
export function position(run) {
    const s = route[run.segment];
    return {
        x: s.x + s.dx * run.progress - s.dz * run.lane,
        z: s.z + s.dz * run.progress + s.dx * run.lane,
        y: groundAt(run.segment, run.progress),
    };
}
export const multiplier = (run) => 1 + Math.floor(Math.min(run.combo, 60) / 10);
function fail(run, failure) {
    run.combo = 0;
    run.state = "fell";
    run.failure = failure;
    run.failAt = run.progress;
}
export function step(run, dt, input = {}) {
    if (run.state !== "running") return;
    ensureRoute(run.segment);
    if (input.jump) run.buffer = 0.17;
    const s = route[run.segment];
    run.duck = !!input.duck;
    if (input.turn) {
        if (run.progress > s.length - 11) {
            if (isFork(run.segment)) chooseBranch(run.segment, input.turn);
            if (input.turn === s.turn) run.queued = input.turn;
        } else if (!s.narrow) run.laneTarget = Math.max(-.9, Math.min(.9, run.laneTarget + input.turn * .9));
    }
    if (s.narrow) run.laneTarget = 0;
    run.lane += (run.laneTarget - run.lane) * (1 - Math.exp(-18 * dt));
    run.turnTime = Math.max(0, run.turnTime - dt);
    if (run.buffer > 0 && run.jumpHeight === 0) {
        run.vy = 7.1;
        run.buffer = 0;
    }
    run.buffer = Math.max(0, run.buffer - dt);
    if (run.jumpHeight > 0 || run.vy > 0) {
        run.vy -= 21 * dt;
        run.jumpHeight = Math.max(0, run.jumpHeight + run.vy * dt);
        if (run.jumpHeight === 0) run.vy = 0;
    }
    run.speed = 8.5 + Math.min(4.5, run.distance / 220);
    // Climbing costs a little speed, descending gives some back.
    const pace = run.speed * (1 - slopeAt(run.segment, run.progress) * 0.6);
    const amount = Math.min(pace * dt, s.length - run.progress);
    const before = run.progress;
    run.progress += amount;
    run.distance += amount;
    run.score += amount * (1 + Math.min(run.combo, 40) * 0.05);
    const hole = gapFor(run.segment);
    if (hole && run.progress > hole.start && run.progress < hole.end && run.jumpHeight < 0.08) {
        fail(run, "gap");
        return;
    }
    // Clearing obstacles feeds the combo; a clean run builds the multiplier.
    const reward = (points, type) => { run.combo++; run.score += points * multiplier(run); run.events.push({ type, combo: run.combo }); };
    if (hole && before < hole.end && run.progress >= hole.end) reward(20, "gap");
    for (const hazard of hazardsFor(run.segment)) {
        if (before < hazard.at + .65 && run.progress >= hazard.at + .65) reward(15, hazard.type);
        if (Math.abs(run.progress - hazard.at) < .65) {
            const hit = hazard.type === 'beam' ? (!run.duck || run.jumpHeight > .1)
                : Math.abs(run.lane - hazard.lane) < .65 && run.jumpHeight < .85;
            if (hit) { fail(run, hazard.type); return; }
        }
    }
    if (run.progress >= s.length) {
        if (run.queued !== s.turn) {
            fail(run, "turn");
            return;
        }
        reward(10, "turn");
        run.turnFrom = run.heading;
        run.heading += (s.turn * Math.PI) / 2;
        run.turnTime = 0.28;
        run.segment++;
        run.lane = run.laneTarget = 0;
        run.progress = 0;
        run.queued = 0;
    }
}
