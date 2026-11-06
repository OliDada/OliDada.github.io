// Moving orbits. Every body follows a circular orbit from the snapshot that
// generateSystem() makes (body.position, body.angle, body.orbit at time 0).
// Time is the real clock, so everyone sees the same sky, positions survive a
// reload, and the star map matches the 3D view. Planets obey Kepler's third
// law (period grows with orbit^1.5); all orbits run the same way round.
export const EPOCH = Date.UTC(2026, 0, 1);
import { SIZE } from './scale.mjs';
// Worlds are big and far apart (scale.mjs), so orbits are slow: what is kept is the
// speed along the orbit, about 30 m/s close in, so a ship can always catch a world.
const INNER_ORBIT = 30000 * SIZE; // a typical innermost orbit
export const PLANET_PERIOD = 2 * Math.PI * INNER_ORBIT / 30; // seconds for one orbit there (30 m/s)
// Moons of a rocky planet share one period, so moons on neighbouring orbits
// never pass through each other. Giants' moons are spaced widely enough to
// follow Kepler's law individually.
export const MOON_PERIOD = 180 * SIZE;
const GIANT_MOON_SPEED = 55; // m/s along the orbit of a giant's innermost moon

export function orbitClock(now = Date.now()) {
    return (now - EPOCH) / 1000;
}

// Angular speed (radians per second) of a body around whatever it orbits.
export function angularSpeed(system, body) {
    if (!body.parent) return (2 * Math.PI) / (PLANET_PERIOD * (body.orbit / INNER_ORBIT) ** 1.5);
    const parent = system.bodies.find((b) => b.id === body.parent);
    if (!parent.giant) return (2 * Math.PI) / MOON_PERIOD;
    const innermost = Math.min(...system.bodies.filter((b) => b.parent === parent.id).map((b) => b.orbit));
    return (2 * Math.PI) / ((2 * Math.PI * innermost / GIANT_MOON_SPEED) * (body.orbit / innermost) ** 1.5);
}

// Where a body is at time t (seconds since EPOCH), in system coordinates.
export function bodyPosition(system, body, t) {
    const a = body.angle + angularSpeed(system, body) * t;
    if (!body.parent) return [Math.cos(a) * body.orbit, body.position[1], Math.sin(a) * body.orbit];
    const parent = system.bodies.find((b) => b.id === body.parent);
    const p = bodyPosition(system, parent, t);
    // The snapshot keeps each moon a fixed height above its planet's orbital plane.
    const lift = body.position[1] - parent.position[1];
    return [p[0] + Math.cos(a) * body.orbit, p[1] + lift, p[2] + Math.sin(a) * body.orbit];
}

// Every body's position at time t, keyed by id.
export function systemPositions(system, t) {
    const out = new Map();
    for (const b of system.bodies) out.set(b.id, bodyPosition(system, b, t));
    return out;
}
