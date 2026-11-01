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
    const desired = input * (boost ? 38 : 19) + Math.sin(pitch) * forwardSpeed;
    // Descents automatically brake above the surface, including while boosting.
    const safeDescent = Math.sqrt(2 * 9 * Math.max(0, clearance - 1.5));
    return Math.max(-safeDescent, desired) + 0;
}
