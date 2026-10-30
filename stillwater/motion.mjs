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

// Each district plays differently, not just looks different: how often the walk
// narrows, climbs, is covered (and by what), how many hazards and gaps it has.
export const AREAS = {
    harbor:  { narrow: .08, rise: .3,  cover: .3,  covers: ["house", "arches"], beamCover: null,      hazards: 1.4, gap: .45 },
    swamp:   { narrow: .45, rise: .15, cover: .3,  covers: ["roots"],           beamCover: "roots",   hazards: .8,  gap: .5 },
    village: { narrow: .12, rise: .5,  cover: .6,  covers: ["house"],           beamCover: null,      hazards: 1.1, gap: .4 },
    exposed: { narrow: .2,  rise: .35, cover: .15, covers: ["arches"],          beamCover: "arches",  hazards: 1.2, gap: .6 },
    forest:  { narrow: .3,  rise: .3,  cover: .35, covers: ["roots"],           beamCover: "roots",   hazards: 1,   gap: .45 },
    canal:   { narrow: .05, rise: .25, cover: .8,  covers: ["house", "bridge", "bridge"], beamCover: null, hazards: 1.3, gap: .35 },
    cliffs:  { narrow: .25, rise: .8,  cover: .35, covers: ["overhang"],        beamCover: "overhang", hazards: .9, gap: .55, high: true },
    marsh:   { narrow: .7,  rise: .05, cover: 0,   covers: [],                  beamCover: null,      hazards: .6,  gap: .55 },
    wrecks:  { narrow: .3,  rise: .45, cover: .45, covers: ["ribs"],            beamCover: "ribs",    hazards: 1.2, gap: .65 },
    breakers:{ narrow: .4,  rise: .45, cover: 0,   covers: [],                  beamCover: null,      hazards: .9,  gap: .7 },
    shallows:{ narrow: .3,  rise: 0,   cover: 0,   covers: [],                  beamCover: null,      hazards: .8,  gap: .5, flat: true },
    sunken:  { narrow: .25, rise: .2,  cover: .3,  covers: ["house"],           beamCover: null,      hazards: 1.1, gap: .55 },
    lighthouse:{ narrow: .2, rise: .7, cover: 0,   covers: [],                  beamCover: null,      hazards: 1,   gap: .55, high: true },
};
// How rough the sea is in each district; it also sets the water level
// (calmer districts sit higher), which scenery uses to sit on the surface.
export const SEA_ENERGY = { swamp: 0.18, forest: 0.06, canal: 0.1, marsh: 0.08, cliffs: 1.35, wrecks: 0.8, exposed: 1.15, breakers: 1.6, shallows: 0.015, sunken: 0.22, lighthouse: 1.2 };
export const waterLevel = (area) => -2.1 + (1 - (SEA_ENERGY[area] ?? 1)) * 1.4;
const SEQUENCE_KINDS = Object.keys(AREAS).filter((k) => k !== "harbor");

// District blocks: the harbor opens every run, then long districts that never
// repeat back-to-back and cycle through every kind before revisiting one.
function areaSequence(n) {
    if (n < 4) return "harbor";
    let index = 4, block = 0, bag = [], last = "harbor";
    while (true) {
        if (!bag.length) {
            bag = [...SEQUENCE_KINDS];
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(random(9200 + block * 13 + i) * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
            if (bag[bag.length - 1] === last) bag.unshift(bag.pop());
        }
        const kind = bag.pop();
        const size = 7 + Math.floor(random(9000 + block) * 4);
        if (n < index + size) return kind;
        index += size;
        last = kind;
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
    const profile = AREAS[s.area];
    const gapChance = n === 0 ? 1 : profile.gap;
    if (random(n * 13 + 2) < gapChance) {
        const width = 2.6 + random(n + 8) * 0.7;
        const a = place(width, 1);
        if (a !== null) s.gap = { segment: n, start: a, end: a + width };
    }
    s.hazards = [];
    const count = n < 1 ? 0 : s.narrow ? (random(n * 3 + 5) < 0.4 ? 1 : 0) : Math.floor(random(n * 3 + 6) * profile.hazards * 1.8 + 0.6);
    for (let h = 0; h < count; h++) {
        // Five kinds: duck under a low beam, dodge or jump a crate, jump a low log
        // across the whole walk, dodge round a wall that leaves one lane open, or
        // duck (or time your way past) a weight swinging from side to side.
        const roll = random(n * 17 + h);
        const type = s.narrow
            ? (roll < 0.45 ? "beam" : roll < 0.8 ? "log" : "swing")
            : roll < 0.24 ? "beam" : roll < 0.48 ? "cargo" : roll < 0.66 ? "log" : roll < 0.84 ? "wall" : "swing";
        // A jump carries you ~9 m, so a log keeps the boards after it clear.
        const placed = place(type === "log" ? 8 : 1, 10 + h);
        if (placed === null) continue;
        const at = placed;
        const pick = Math.floor(random(n * 23 + h) * 3);
        const lane = type === "cargo" ? [-0.9, 0, 0.9][pick] : 0;
        const hazard = { at: at + 0.5, type, lane };
        if (type === "wall") hazard.open = [-0.9, 0, 0.9][pick];
        if (type === "swing") hazard.phase = random(n * 29 + h) * 6.28;
        s.hazards.push(hazard);
    }
    s.hazards.sort((a, b) => a.at - b.at);
    // A covered passage: through a house, or under a row of archways.
    s.cover = null;
    if (!s.narrow && n > 0 && random(n * 41 + 3) < profile.cover) {
        const len = 10 + random(n * 41 + 4) * 8;
        const start = 4 + random(n * 41 + 5) * Math.max(0, L - len - 10);
        s.cover = { type: profile.covers[Math.floor(random(n * 41 + 6) * profile.covers.length)], start, end: start + len };
    } else if (s.narrow && profile.beamCover && random(n * 41 + 7) < 0.5) {
        s.cover = { type: profile.beamCover, start: 3, end: L - 3 };
    }
}

function makeSegment(n, x, z, dx, dz, y, forkAllowed = true) {
    const north = dz === -1;
    const area = areaSequence(n), profile = AREAS[area];
    const narrow = n > 1 && random(n * 5 + 3) < profile.narrow;
    const length = narrow
        ? 16 + Math.floor(random(n) * 8)
        : north ? 30 + Math.floor(random(n) * 22) : 22 + Math.floor(random(n) * 16);
    let rise = 0;
    // The mirror shallows lie dead level; the walk comes back down to them.
    if (profile.flat && y > 0.1) rise = -1.7;
    else if (n > 0 && random(n * 11 + 4) < profile.rise) rise = random(n * 11 + 5) < (profile.high ? 0.8 : 0.5) ? 1.7 : -1.7;
    // Cliff paths climb high and stay there; leaving them, the walk comes back down.
    if (!profile.high && y > 1.8 && random(n * 11 + 6) < 0.6) rise = -1.7;
    if (y + rise > 3.5 || y + rise < -0.1) rise = -rise;
    if (y + rise > 3.5 || y + rise < -0.1) rise = 0;
    const s = {
        x, z, dx, dz, length, turn: 0, y, rise,
        narrow, width: narrow ? BEAM : DECK,
        area,
        fork: forkAllowed && north && !narrow && n >= 2 && random(n * 19 + 9) < 0.3,
    };
    if (s.fork) s.narrow = false, s.width = DECK;
    furnish(s, n);
    return s;
}

// The stretch that follows `prev` (stretch number n), setting prev's turn.
function nextAfter(prev, n, forkAllowed = true) {
    const x = prev.x + prev.dx * prev.length,
        z = prev.z + prev.dz * prev.length;
    let dx = 0, dz = -1;
    if (prev.dz) {
        // Leaving a northward leg: east or west, but drift back toward the coast.
        dz = 0;
        dx = x > 30 ? -1 : x < -30 ? 1 : random(n * 3 + 1) < 0.5 ? -1 : 1;
    }
    prev.turn = prev.dx * dz - prev.dz * dx;
    return makeSegment(n, x, z, dx, dz, prev.y + prev.rise, forkAllowed);
}
// How far a fork's untaken branch is planned ahead, so scenery can keep clear of it.
const BRANCH_PLAN = 10;
export function ensureRoute(index) {
    if (route[0]?.finale) { finaleTail(index); return; }
    while (route.length < index + 7) {
        const n = route.length, prev = route[n - 1];
        if (prev.fork) {
            const x = prev.x + prev.dx * prev.length, z = prev.z + prev.dz * prev.length;
            prev.turn = random(n * 3 + 1) < 0.5 ? -1 : 1;
            const chains = {};
            for (const turn of [-1, 1]) {
                const chain = [branchSegment(prev, n - 1, turn)];
                for (let k = 1; k < BRANCH_PLAN; k++) chain.push(nextAfter(chain[k - 1], n + k, false));
                chains[turn] = chain;
            }
            void x; void z;
            prev.chains = chains;
            prev.branches = { [-1]: chains[-1][0], [1]: chains[1][0] };
            prev.alt = prev.branches[-prev.turn];
            route.push(...chains[prev.turn]);
            continue;
        }
        route.push(nextAfter(prev, n));
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

// Pip's finale (the site's chatbot takes over the game, see bit.js on olid.is):
// one long, empty, dead-level road over the mirror shallows. Nothing on it, nothing
// beside it. At the far end a timber staircase climbs to a landing with a door.
// The staircase is the dream's timber one (16 open treads, 0.42 by 0.3), scaled up by half.
export const FINALE = { road: 250, steps: 16, scale: 1.5, landing: 8 };
export function finaleRoute() {
    seed = 4242;
    route.length = 0;
    const f = FINALE, tread = 0.42 * f.scale, riser = 0.3 * f.scale, top = f.road + f.steps * tread, length = top + f.landing;
    route.push({
        x: 0, z: 12, dx: 0, dz: -1, length, turn: 0, y: 0, rise: 0,
        narrow: false, width: DECK, area: "shallows", fork: false,
        ramp: null, gap: null, hazards: [], cover: null,
        finale: true, stairs: { start: f.road, steps: f.steps, tread, riser, top, scale: f.scale },
        door: top + 1.35 * f.scale,
    });
    finaleTail(0);
    routeRevision++;
}
// Beyond the door there is nothing at all (empty stretches nothing gets built on).
function finaleTail(index) {
    while (route.length < index + 7) {
        const prev = route[route.length - 1];
        route.push({ x: prev.x + prev.dx * prev.length, z: prev.z + prev.dz * prev.length, dx: 0, dz: -1, length: 40, turn: 0,
            y: groundOf(prev, prev.length), rise: 0, narrow: false, width: DECK, area: "shallows", fork: false,
            ramp: null, gap: null, hazards: [], cover: null, finale: true, empty: true });
    }
}

export const gap = { get segment() { return route.findIndex(s => s.gap); }, get start() { return firstGap().start; }, get end() { return firstGap().end; } };
function firstGap() { return route.find(s => s.gap)?.gap; }
// How deep into the dream a stretch lies: 0 at the opening quay, 1 after ~45 stretches.
export const strangeness = (index) => Math.min(1, Math.max(0, (index - 2) / 45));
export function gapFor(index) { return route[index]?.gap ?? null; }
export const isFork = index => !!route[index]?.fork;
export const areaFor = index => route[index]?.area ?? areaSequence(index);
export function hazardsFor(index) { return route[index]?.hazards ?? []; }

// Deck height along a stretch: a smooth ramp between two levels.
export function groundAt(index, p) { return groundOf(route[index], p); }
export function slopeAt(index, p) { return slopeOf(route[index], p); }
export function groundOf(s, p) {
    if (!s) return 0;
    if (s.stairs && p >= s.stairs.start) return s.y + Math.min(s.stairs.steps, Math.floor((p - s.stairs.start) / s.stairs.tread) + 1) * s.stairs.riser;
    if (!s.ramp) return s.y;
    const t = Math.min(1, Math.max(0, (p - s.ramp.start) / RAMP));
    return s.y + s.rise * t * t * (3 - 2 * t);
}
export function slopeOf(s, p) {
    if (s?.stairs) return p >= s.stairs.start && p < s.stairs.top ? s.stairs.riser / s.stairs.tread : 0;
    if (!s?.ramp) return 0;
    const t = Math.min(1, Math.max(0, (p - s.ramp.start) / RAMP));
    return (s.rise * 6 * t * (1 - t)) / RAMP;
}

// The first stretch of a fork's branch in a given direction. Both branches exist
// before you choose, so the world can show both and nothing changes when you do.
function branchSegment(s, index, turn) {
    const n = index + 1;
    const next = makeSegment(n, s.x + s.dx * s.length, s.z + s.dz * s.length, -s.dz * turn, s.dx * turn, s.y + s.rise, false);
    next.length = 30 + Math.floor(random(index + turn * 7) * 9);
    furnish(next, n + (turn > 0 ? 500 : 0));
    return next;
}
export function chooseBranch(index, turn) {
    if (!isFork(index) || ![-1, 1].includes(turn)) return;
    const s = route[index];
    if (s.turn === turn) { s.decided = true; return; }
    // Swap in the planned branch; the abandoned one is kept as the alternative.
    const abandoned = route.splice(index + 1);
    s.chains[s.turn] = abandoned.slice(0, BRANCH_PLAN);
    s.alt = s.branches[s.turn];
    s.decided = true;
    s.turn = turn;
    route.push(...s.chains[turn]);
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
        clock: 0,
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
// Where a swinging weight is across the walk (lane units) at a given moment.
export const swingLane = (hazard, clock) => Math.sin(clock * 1.9 + hazard.phase) * 1.05;
export function hazardHits(hazard, run) {
    switch (hazard.type) {
        case "beam": return !run.duck || run.jumpHeight > 0.1;
        case "cargo": return Math.abs(run.lane - hazard.lane) < 0.65 && run.jumpHeight < 0.85;
        case "log": return Math.abs(run.progress - hazard.at) < 0.4 && run.jumpHeight < 0.4;
        case "wall": return Math.abs(run.lane - hazard.open) > 0.45;
        case "swing": return !run.duck && Math.abs(run.lane - swingLane(hazard, run.clock)) < 0.6;
    }
    return false;
}
export function step(run, dt, input = {}) {
    if (run.state !== "running") return;
    run.clock += dt;
    ensureRoute(run.segment);
    if (input.jump) run.buffer = 0.17;
    const s = route[run.segment];
    run.duck = !!input.duck;
    if (input.turn) {
        if (run.progress > s.length - 11) {
            if (isFork(run.segment)) chooseBranch(run.segment, input.turn);
            if (input.turn === s.turn) { run.queued = input.turn; s.decided = true; }
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
            const hit = hazardHits(hazard, run);
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
