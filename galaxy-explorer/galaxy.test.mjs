import test from "node:test";
import assert from "node:assert/strict";
import {
    GALAXY,
    CELL,
    JUMP_RANGE,
    HOME_POINT,
    density,
    cellStars,
    starsInBox,
    starsNear,
    starById,
    homeStar,
    jumpTargets,
    starDistance,
    visualTile,
    VISUAL_EXTENT,
} from "./galaxy.mjs";
import { generateSystem, starName } from "./system.mjs";

test("cells are deterministic and star ids round-trip", () => {
    assert.deepEqual(cellStars(-917, 1262, 0), cellStars(-917, 1262, 0));
    const stars = starsNear(HOME_POINT, 40);
    assert.ok(stars.length > 10);
    for (const { star } of stars) {
        assert.equal(starById(star.id), star);
        assert.equal(Math.floor(star.x / CELL), Number(star.id.split("_")[0]));
    }
    assert.equal(starById("nonsense"), null);
    assert.equal(starById("1_2_3_999"), null);
});

test("the density field has a dense core, spiral arms and empty space beyond the rim", () => {
    const r = GALAXY.homeRadius;
    assert.ok(density(0, 0, 0) > density(...HOME_POINT) * 5);
    // Around the home ring, arm density clearly exceeds the gaps between arms.
    const ring = Array.from({ length: 360 }, (_, i) =>
        density(Math.cos(i / 57.3) * r, Math.sin(i / 57.3) * r, 0),
    );
    assert.ok(Math.max(...ring) > Math.min(...ring) * 5);
    assert.ok(
        density(GALAXY.radius * 1.5, 0, 0) < density(...HOME_POINT) * 1e-3,
    );
    assert.ok(
        density(...HOME_POINT.slice(0, 2), 3000) <
            density(...HOME_POINT) * 0.01,
    );
});

test("home has neighbours in range and the jump network keeps expanding", () => {
    const home = homeStar();
    assert.ok(
        starDistance(home, { x: HOME_POINT[0], y: HOME_POINT[1], z: 0 }) < 20,
    );
    assert.ok(jumpTargets(home).targets.length >= 2);
    const seen = new Set([home.id]);
    let frontier = [home];
    for (let hop = 0; hop < 5; hop++) {
        const next = [];
        for (const s of frontier)
            for (const t of jumpTargets(s).targets)
                if (!seen.has(t.star.id)) {
                    seen.add(t.star.id);
                    next.push(t.star);
                }
        frontier = next;
    }
    assert.ok(seen.size > 60, `only ${seen.size} stars within 5 jumps`);
});

test("no star is ever stranded: the drive overcharges to the nearest neighbour", () => {
    const lonely = starsInBox(
        [HOME_POINT[0] - 2000, HOME_POINT[1] - 2000, 150],
        [HOME_POINT[0] + 2000, HOME_POINT[1] + 2000, 400],
    ).slice(0, 25);
    assert.ok(lonely.length > 0);
    for (const s of lonely) {
        const { range, targets } = jumpTargets(s);
        assert.ok(targets.length >= 1 && range >= JUMP_RANGE);
        for (const t of targets) assert.ok(t.distance <= range + 1e-9);
    }
});

test("every star opens a valid system whose name matches the chart", () => {
    for (const { star } of starsNear(HOME_POINT, 30).slice(0, 40)) {
        const system = generateSystem(star.seed);
        assert.equal(system.name, starName(star.seed));
        assert.ok(system.bodies.length >= 4);
    }
});

test("map queries are fast enough for phones", () => {
    const t = performance.now();
    starsInBox(
        [HOME_POINT[0] - 300, HOME_POINT[1] - 150, -40],
        [HOME_POINT[0] + 300, HOME_POINT[1] + 150, 40],
    );
    assert.ok(performance.now() - t < 400);
    const t2 = performance.now();
    visualTile(3, 3, 4);
    assert.ok(performance.now() - t2 < 200);
});

test("visual tiles are deterministic, follow the galaxy and get finer with each level", () => {
    assert.deepEqual(visualTile(4, 7, 9), visualTile(4, 7, 9));
    const count = (t) => t.buckets.reduce((n, b) => n + b.xs.length, 0);
    const core = visualTile(4, 8, 8),
        rim = visualTile(4, 0, 0);
    assert.ok(count(core) > count(rim) * 5);
    for (const b of visualTile(5, 10, 21).buckets)
        for (let i = 0; i < b.xs.length; i++) {
            const size = VISUAL_EXTENT / 32;
            assert.ok(
                b.xs[i] >= -VISUAL_EXTENT / 2 + 10 * size &&
                    b.xs[i] <= -VISUAL_EXTENT / 2 + 11 * size,
            );
        }
});
