import test from "node:test";
import assert from "node:assert/strict";
import { damp, smootherstep, verticalTarget } from "./flight-math.mjs";

test("vertical thrust has the same response at 30, 60, and 144 FPS", () => {
    const simulate = (fps) => {
        let v = 0;
        for (let i = 0; i < fps; i++) v = damp(v, 19, 2.2, 1 / fps);
        return v;
    };
    assert.ok(Math.abs(simulate(30) - simulate(144)) < 1e-10);
    assert.ok(simulate(60) > 0 && simulate(60) < 19);
});

test("releasing lift brakes without reversing direction", () => {
    let v = 19;
    for (let i = 0; i < 120; i++) {
        const next = damp(v, 0, 3.2, 1 / 60);
        assert.ok(next >= 0 && next <= v);
        v = next;
    }
    assert.ok(v < 0.05);
});

test("boosted descent is limited near terrain and stops at the hover floor", () => {
    assert.equal(verticalTarget(-1, 0, 0, true, 1.5), 0);
    assert.ok(verticalTarget(-1, -0.65, 100, true, 3) > -6);
    assert.ok(verticalTarget(-1, 0, 0, true, 100) < -30);
    assert.equal(verticalTarget(1, 0, 0, false, 0), 19);
});

test("landing and liftoff easing never overshoot and approach both endpoints gently", () => {
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
        const value = smootherstep(i / 100);
        assert.ok(value >= previous && value <= 1);
        previous = value;
    }
    assert.equal(smootherstep(-1), 0);
    assert.equal(smootherstep(2), 1);
    assert.ok(smootherstep(0.001) < 1e-7);
    assert.ok(1 - smootherstep(0.999) < 1e-7);
});
