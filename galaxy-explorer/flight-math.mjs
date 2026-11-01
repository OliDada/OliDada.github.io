// Pure motion helpers: exponential damping is stable across different frame rates.
export function damp(current, target, response, dt) {
    return target + (current - target) * Math.exp(-response * dt);
}
export function smoothstep(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
}
export function smootherstep(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * x * (x * (x * 6 - 15) + 10);
}
export function verticalTarget(input, pitch, forwardSpeed, boost, clearance) {
    // Climbing speeds up with altitude, so leaving orbit (600 m) takes seconds,
    // not half a minute; near the ground lift stays gentle and precise.
    const climb = input > 0 ? 1 + Math.min(Math.max(clearance, 0), 600) / 140 : 1;
    const desired = input * (boost ? 38 : 19) * climb + Math.sin(pitch) * forwardSpeed;
    // Descents automatically brake above the surface, including while boosting.
    const safeDescent = Math.sqrt(2 * 9 * Math.max(0, clearance - 1.5));
    return Math.max(-safeDescent, desired) + 0;
}
