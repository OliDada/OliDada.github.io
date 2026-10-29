// Gravity Dash movement: the rolling ground and the ball that rolls over it.
// Shared by gravity_dash.js (the game) and tests/forest-rush.cjs (the checks).

export const RADIUS = 0.6;            // ball radius in metres
const LANE = 8;                       // how far left/right the ball can roll; scenery lives beyond this
const MAX_SIDE = 9;                   // top sideways speed
const STEER_RATE = 20;                // how fast steering responds
const BRAKE_RATE = 32;                // how fast sideways drift stops when you let go
const FORWARD = 12;                   // forward rolling speed (m/s)
const GRAVITY = 20;
const HOP_SPEED = 7;
const HOP_BUFFER = 0.15;              // a hop pressed just before landing still counts

// Gentle rolling hills along the path, rising a little towards the forest on both sides.
export function groundHeight(x, z) {
  const hills = 1.3 * Math.sin(z * 0.075) + 0.55 * Math.sin(z * 0.19 + 1.3) + 0.2 * Math.sin(z * 0.43 + x * 0.25);
  const sides = Math.max(0, Math.abs(x) - 10) * 0.18;
  return hills + sides;
}

export function createBall() {
  const x = 0, z = 0;
  return { x, z, y: groundHeight(x, z) + RADIUS, vx: 0, vy: 0, speed: FORWARD, distance: 0, grounded: true, hopBuffer: 0 };
}

// Advance the ball by dt seconds. steer is -1..1, hop is true on the frame the hop was pressed.
// Returns how far it moved, so the game can spin the ball.
export function stepBall(ball, steer, hop, dt) {
  const startX = ball.x, startZ = ball.z;
  if (hop) ball.hopBuffer = HOP_BUFFER;

  // sideways: respond quickly to steering, stop quickly when released
  const target = Math.max(-1, Math.min(1, steer || 0)) * MAX_SIDE;
  const rate = Math.abs(target) > 1e-6 ? STEER_RATE : BRAKE_RATE;
  ball.vx += (target - ball.vx) * (1 - Math.exp(-rate * dt));
  ball.x += ball.vx * dt;
  if (ball.x > LANE) { ball.x = LANE; ball.vx = Math.min(0, ball.vx); }
  if (ball.x < -LANE) { ball.x = -LANE; ball.vx = Math.max(0, ball.vx); }

  // forward
  ball.speed = FORWARD;
  ball.z -= ball.speed * dt;
  ball.distance += ball.speed * dt;

  // up and down
  const ground = groundHeight(ball.x, ball.z) + RADIUS;
  if (ball.grounded) {
    if (ball.hopBuffer > 0) { ball.grounded = false; ball.vy = HOP_SPEED; ball.hopBuffer = 0; ball.y = ground; }
    else ball.y = ground;
  }
  if (!ball.grounded) {
    ball.vy -= GRAVITY * dt;
    ball.y += ball.vy * dt;
    if (ball.y <= ground) {
      ball.y = ground; ball.vy = 0; ball.grounded = true;
      if (ball.hopBuffer > 0) { ball.grounded = false; ball.vy = HOP_SPEED; ball.hopBuffer = 0; }
    }
  }
  ball.hopBuffer = Math.max(0, ball.hopBuffer - dt);
  return { dx: ball.x - startX, dz: ball.z - startZ };
}
