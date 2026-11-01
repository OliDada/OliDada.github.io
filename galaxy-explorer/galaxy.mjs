// The galaxy is never stored. Space is divided into 10-light-year cells, and a
// cell's stars are computed on demand from hash(galaxySeed, cell). A spiral
// density field decides how many stars each cell gets, so arms, gaps and a
// dense core emerge without generating 100 billion stars. Units: light years.
// x/y is the galactic plane, z is height above it.
import { rng, hash32 } from "./rng.mjs";
import { makeStar } from "./physics.mjs";

export const GALAXY_SEED = 1;
export const CELL = 10; // light years per cell edge
export const JUMP_RANGE = 12; // standard jump drive range, light years
const HOME_DENSITY = 8e-4; // stars per cubic light year in an arm near home (real Sun's area: ~4e-3; thinned for play)

export const GALAXY = (() => {
    const r = rng(GALAXY_SEED, "shape");
    const radius = 30000;
    return {
        seed: GALAXY_SEED,
        radius,
        arms: r.int(2, 4),
        pitch: r.range(0.2, 0.3), // spiral tightness (radians, ~11–17°)
        armOffset: r() * Math.PI * 2,
        diskScale: 0.32 * radius,
        thickness: 320,
        bulgeRadius: 0.12 * radius,
        homeRadius: 0.52 * radius,
    };
})();

const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

// 0 between arms, 1 at an arm's centre line (logarithmic spiral).
export function armStrength(x, y) {
    const r = Math.hypot(x, y);
    if (r < 1) return 0;
    const theta = Math.atan2(y, x);
    const phase =
        GALAXY.arms * (theta - Math.log(r / 1000) / Math.tan(GALAXY.pitch)) +
        GALAXY.armOffset;
    return (
        (0.5 + 0.5 * Math.cos(phase)) ** 4 *
        smooth(GALAXY.bulgeRadius * 0.7, GALAXY.bulgeRadius * 1.8, r)
    );
}
function rawDensity(x, y, z) {
    const r = Math.hypot(x, y);
    const edge =
        r > GALAXY.radius ? Math.exp(-(((r - GALAXY.radius) / 2500) ** 2)) : 1;
    const disk =
        Math.exp(-r / GALAXY.diskScale) *
        Math.exp(-Math.abs(z) / (GALAXY.thickness * (1 + r / GALAXY.radius)));
    const bulge = Math.exp(-(r * r + (z * 2.5) ** 2) / GALAXY.bulgeRadius ** 2);
    return (disk * (0.12 + armStrength(x, y)) + 2.5 * bulge) * edge;
}
// Home sits on an arm's centre line at homeRadius.
export const HOME_POINT = (() => {
    const r = GALAXY.homeRadius;
    const theta =
        -GALAXY.armOffset / GALAXY.arms +
        Math.log(r / 1000) / Math.tan(GALAXY.pitch);
    return [Math.cos(theta) * r, Math.sin(theta) * r, 0];
})();
const DENSITY_SCALE = HOME_DENSITY / rawDensity(...HOME_POINT);
export const density = (x, y, z) => rawDensity(x, y, z) * DENSITY_SCALE;

function poisson(lambda, r) {
    const limit = Math.exp(-lambda);
    let k = 0,
        p = 1;
    do {
        k++;
        p *= r();
    } while (p > limit && k < 40);
    return k - 1;
}

const cellCache = new Map();
export function cellStars(cx, cy, cz) {
    const key = `${cx}_${cy}_${cz}`;
    let stars = cellCache.get(key);
    if (stars) return stars;
    const lambda =
        density((cx + 0.5) * CELL, (cy + 0.5) * CELL, (cz + 0.5) * CELL) *
        CELL ** 3;
    const r = rng(GALAXY_SEED, "cell", cx, cy, cz);
    const count = Math.min(16, poisson(lambda, r));
    stars = [];
    for (let i = 0; i < count; i++) {
        stars.push({
            id: `${key}_${i}`,
            x: (cx + r()) * CELL,
            y: (cy + r()) * CELL,
            z: (cz + r()) * CELL,
            seed: hash32(GALAXY_SEED, "star", cx, cy, cz, i),
        });
    }
    if (cellCache.size > 60000) cellCache.clear();
    cellCache.set(key, stars);
    return stars;
}

export function starsInBox(min, max) {
    const out = [];
    const lo = min.map((v) => Math.floor(v / CELL)),
        hi = max.map((v) => Math.floor(v / CELL));
    for (let cx = lo[0]; cx <= hi[0]; cx++)
        for (let cy = lo[1]; cy <= hi[1]; cy++)
            for (let cz = lo[2]; cz <= hi[2]; cz++)
                for (const s of cellStars(cx, cy, cz))
                    if (
                        s.x >= min[0] &&
                        s.x <= max[0] &&
                        s.y >= min[1] &&
                        s.y <= max[1] &&
                        s.z >= min[2] &&
                        s.z <= max[2]
                    )
                        out.push(s);
    return out;
}
export const starDistance = (a, b) =>
    Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function starsNear(point, radius) {
    const p = Array.isArray(point)
        ? { x: point[0], y: point[1], z: point[2] }
        : point;
    return starsInBox(
        [p.x - radius, p.y - radius, p.z - radius],
        [p.x + radius, p.y + radius, p.z + radius],
    )
        .map((s) => ({ star: s, distance: starDistance(s, p) }))
        .filter((e) => e.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
}

export function starById(id) {
    const m = /^(-?\d+)_(-?\d+)_(-?\d+)_(\d+)$/.exec(String(id || ""));
    if (!m) return null;
    return cellStars(+m[1], +m[2], +m[3])[+m[4]] || null;
}

let home = null;
export function homeStar() {
    if (home) return home;
    for (let radius = 10; !home; radius *= 2)
        home = starsNear(HOME_POINT, radius)[0]?.star || null;
    return home;
}

// Stars within jump range. If a star is stranded in a sparse gap, the drive
// overcharges just enough to reach the nearest neighbour.
export function jumpTargets(star, range = JUMP_RANGE) {
    let near = starsNear(star, range).filter((e) => e.star.id !== star.id);
    if (near.length) return { range, targets: near };
    for (let r = range * 2; ; r *= 1.5) {
        near = starsNear(star, r).filter((e) => e.star.id !== star.id);
        if (near.length) {
            const reach = near[0].distance * 1.02;
            return {
                range: reach,
                targets: near.filter((e) => e.distance <= reach),
            };
        }
    }
}

const starCache = new Map();
export function starPhysics(star) {
    let p = starCache.get(star.id);
    if (!p) {
        p = makeStar(star.seed);
        if (starCache.size > 20000) starCache.clear();
        starCache.set(star.id, p);
    }
    return p;
}

// --- Visual layer for zoomed-out views ---
// Real stars are far too numerous to draw from far away, so distant views use
// procedural "light" points arranged in a quadtree of tiles. Each zoom level
// adds a finer level of tiles, so detail sharpens as you zoom instead of an
// image getting stretched. Brightness, not star counts: arms are lit by young
// blue stars, so they stand out more than density alone suggests.
export const VISUAL_EXTENT = GALAXY.radius * 2.3;
export function glowAt(x, y) {
    const d = Math.hypot(x, y),
        edge =
            d > GALAXY.radius
                ? Math.exp(-(((d - GALAXY.radius) / 2500) ** 2))
                : 1;
    return (
        (Math.exp(-d / (GALAXY.radius * 0.42)) * (0.012 + armStrength(x, y)) +
            1.4 * Math.exp(-(d * d) / GALAXY.bulgeRadius ** 2)) *
        edge
    );
}
const GLOW_PEAK = glowAt(0, 0);
export const glowLevel = (x, y) =>
    Math.min(1, glowAt(x, y) / (GLOW_PEAK * 0.12)); // core saturates so the disc gets its share

const POINTS_PER_TILE = 1000;
const COLORS = ["#ffd9a8", "#a9c4ff", "#dfe3f0"];
const tileCache = new Map();
// Points are pre-sorted into colour × brightness buckets so drawing needs few state changes.
export function visualTile(level, tx, ty) {
    const key = `${level}_${tx}_${ty}`;
    let tile = tileCache.get(key);
    if (tile) return tile;
    const size = VISUAL_EXTENT / 2 ** level,
        x0 = -VISUAL_EXTENT / 2 + tx * size,
        y0 = -VISUAL_EXTENT / 2 + ty * size;
    let mean = 0,
        peak = 0;
    for (let i = 0; i < 5; i++)
        for (let j = 0; j < 5; j++) {
            const g = glowLevel(
                x0 + ((i + 0.5) * size) / 5,
                y0 + ((j + 0.5) * size) / 5,
            );
            mean += g / 25;
            peak = Math.max(peak, g);
        }
    const target = Math.round(POINTS_PER_TILE * mean);
    const r = rng(GALAXY_SEED, "visual", level, tx, ty);
    const buckets = Array.from({ length: 9 }, (_, i) => ({
        color: COLORS[i % 3],
        alpha: [0.3, 0.55, 0.9][Math.floor(i / 3)],
        xs: [],
        ys: [],
    }));
    let count = 0;
    for (
        let attempts = 0;
        count < target && attempts < target * 25;
        attempts++
    ) {
        const x = x0 + r() * size,
            y = y0 + r() * size;
        if (r() * peak > glowLevel(x, y)) continue;
        const d2 = x * x + y * y,
            bulge = Math.exp(-d2 / (GALAXY.bulgeRadius * 1.6) ** 2),
            arm = armStrength(x, y);
        const color =
            bulge > 0.25 || (arm < 0.15 && r() < 0.5) ? 0 : arm > 0.45 ? 1 : 2;
        const bright = Math.min(
            2,
            Math.floor((r() * 0.6 + arm * 0.5 + bulge * 0.3) * 3),
        );
        const b = buckets[bright * 3 + color];
        b.xs.push(x);
        b.ys.push(y);
        count++;
    }
    tile = { level, size, buckets: buckets.filter((b) => b.xs.length) };
    if (tileCache.size > 4000) tileCache.clear();
    tileCache.set(key, tile);
    return tile;
}
