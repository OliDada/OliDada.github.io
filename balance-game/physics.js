/* Velocities use pixels per 60 Hz reference frame; dt is measured in those frames.
   Position is relative to the platform, but velocity is in world space. */
function stepBalanceBall(ball, platform, dt, gravity) {
    const steps = Math.max(1, Math.ceil(dt * 4));
    const h = dt / steps;
    const vx = (platform.x - platform.previousX) / dt;
    const omega = (platform.angle - platform.previousAngle) / dt;
    const radius = 15,
        contactRadius = radius + 10;
    for (let i = 0; i < steps; i++) {
        const angle = platform.previousAngle + omega * h * (i + 1);
        const tx = Math.cos(angle),
            ty = Math.sin(angle);
        ball.vy += gravity * h;
        ball.x += (ball.vx - vx) * h;
        ball.y += ball.vy * h;
        const along = Math.max(
            -platform.length / 2,
            Math.min(platform.length / 2, ball.x * tx + ball.y * ty),
        );
        const cx = along * tx,
            cy = along * ty;
        const dx = ball.x - cx,
            dy = ball.y - cy;
        const distance = Math.hypot(dx, dy);
        if (distance < contactRadius) {
            const nx = distance > 0.0001 ? dx / distance : ty;
            const ny = distance > 0.0001 ? dy / distance : -tx;
            ball.x += nx * (contactRadius - distance);
            ball.y += ny * (contactRadius - distance);
            // Surface velocity includes both translation and rotation of the rail.
            const surfaceX = vx - omega * (cy + ny * 10);
            const surfaceY = omega * (cx + nx * 10);
            const normalSpeed =
                (ball.vx - surfaceX) * nx + (ball.vy - surfaceY) * ny;
            if (normalSpeed < 0) {
                const impulse = -normalSpeed * (normalSpeed < -1.2 ? 1.12 : 1);
                ball.vx += nx * impulse;
                ball.vy += ny * impulse;
                // A solid sphere has I = 2/5 mr². Friction trades sliding for spin,
                // rather than adding gravity a second time along the slope.
                const tangentX = -ny,
                    tangentY = nx;
                const slip =
                    (ball.vx - surfaceX) * tangentX +
                    (ball.vy - surfaceY) * tangentY -
                    ball.spin * radius;
                const friction = Math.max(
                    -impulse * 0.55,
                    Math.min(impulse * 0.55, -slip / 3.5),
                );
                ball.vx += tangentX * friction;
                ball.vy += tangentY * friction;
                ball.spin -= friction / (0.4 * radius);
                const resistance = Math.pow(0.998, h);
                ball.spin *= resistance;
            }
        }
        ball.rotation += ball.spin * h;
    }
    return ball;
}
if (typeof module !== "undefined") module.exports = { stepBalanceBall };

// Use the same rotated polygon for rendering and collision, including chipped corners.
function circleHitsShard(x, y, radius, shard) {
    const c = Math.cos(shard.rotation),
        s = Math.sin(shard.rotation);
    const dx = x - shard.x,
        dy = y - shard.y;
    const px = dx * c + dy * s,
        py = -dx * s + dy * c;
    let inside = false;
    const points = shard.points;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j],
            b = points[i];
        if (
            a.y > py !== b.y > py &&
            px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x
        )
            inside = !inside;
        const ex = b.x - a.x,
            ey = b.y - a.y;
        const t = Math.max(
            0,
            Math.min(
                1,
                ((px - a.x) * ex + (py - a.y) * ey) / (ex * ex + ey * ey || 1),
            ),
        );
        if (Math.hypot(px - a.x - t * ex, py - a.y - t * ey) <= radius)
            return true;
    }
    return inside;
}
if (typeof module !== "undefined")
    module.exports.circleHitsShard = circleHitsShard;
