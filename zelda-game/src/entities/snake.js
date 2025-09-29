import { gameState, playerState } from "../state/stateManagers.js";

export function generateSnakeComponents(k, pos) {
    return [
        k.sprite('snake', { anim: "snake-side" }),
        k.area({ shape: new k.Rect(k.vec2(16 + 2, 4), 12, 12) }),
        k.body(),
        k.pos(pos),
        k.health(4),
        k.opacity(),
        k.offscreen(),
        k.state("idle", ["idle", "attack", "evade", "patrol"]),
        {
            isAttacking: false,
            attackPower: 0.5,
            prevPos: k.vec2(0, 0),
            isFrozen: false,
        },
        'snake',
    ];
}

export function setSnakeAI(k, snake, player) {
    const patrolDistance = 60 + Math.random() * 40;
    const patrolOrigin = snake.pos.clone();
    let patrolDir = 1;
    let currentTween = null;


    function playerIsClose() {
        return player && player.pos && snake.pos.dist(player.pos) < 16 * 6;
    }

    function playerIsVeryClose() {
        return player && player.pos && snake.pos.dist(player.pos) < 40;
    }

    function setSnakeAreaForDirection(animBase, from, to, isAttacking) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        if (isAttacking) {
            if (Math.abs(dx) > Math.abs(dy)) {
                // Attacking sideways: covers both tiles
                snake.area.shape = new k.Rect(k.vec2(0, 0), 32, 16);
            } else {
                // Attacking up or down: only right tile
                snake.area.shape = new k.Rect(k.vec2(16, 0), 16, 16);
            }
        } else if (Math.abs(dx) > Math.abs(dy)) {
            // Sideways: right or left tile
            if (dx > 0) {
                // Facing right
                snake.area.shape = new k.Rect(k.vec2(0, 0), 16, 16);
            } else {
                // Facing left
                snake.area.shape = new k.Rect(k.vec2(16, 0), 16, 16);
            }
        } else {
            // Up or down: use right tile by default
            snake.area.shape = new k.Rect(k.vec2(16, 0), 16, 16);
        }
    }

    function playAnimForDirection(animBase, from, to, isAttacking = false) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        setSnakeAreaForDirection(animBase, from, to, isAttacking);
        if (Math.abs(dx) > Math.abs(dy)) {
            snake.flipX = dx > 0; // Flip for right
            snake.play(`${animBase}-side`);
        } else if (dy > 0) {
            snake.flipX = false;
            snake.play(`${animBase}-down`);
        } else {
            snake.flipX = false;
            snake.play(`${animBase}-up`);
        }
    }

    // Patrol state: move back and forth
    const patrol = snake.onStateEnter("patrol", async () => {
        if (snake.isFrozen) {
            snake.enterState("idle");
            return;
        }
        while (!playerIsClose()) {
            if (snake.isFrozen) {
                snake.enterState("idle");
                return;
            }
            const targetX = patrolOrigin.x + patrolDir * patrolDistance;
            currentTween = k.tween(
                snake.pos.x,
                targetX,
                3 + Math.random() * 2,
                (val) => {
                    if (snake.isFrozen) {
                        if (currentTween) currentTween.cancel();
                        return;
                    }
                    snake.pos.x = val;
                },
                k.easings.linear,
            );
            await currentTween;
            if (snake.isFrozen) return;
            patrolDir *= -1;
            await k.wait(0.1);
            if (snake.isFrozen) return;
        }
        snake.enterState("attack");
    });

    // Attack state: chase player
    const attack = snake.onStateEnter("attack", async () => {
        if (snake.isFrozen) {
            snake.enterState("idle");
            return;
        }
        if (!playerIsClose()) {
            snake.enterState("patrol");
            return;
        }
        const attackSpeeds = [1.0, 1.5, 2.0];

        while (playerIsClose()) {
            if (snake.isFrozen) {
                if (currentTween) currentTween.cancel();
                return;
            }
            const from = snake.pos.clone();
            const to = player.pos.clone();
            let attacked = false;

            currentTween = k.tween(
                0, 1, 
                attackSpeeds[Math.floor(Math.random() * attackSpeeds.length)],
                (t) => {
                    if (snake.isFrozen) {
                        if (currentTween) currentTween.cancel();
                        return;
                    }
                    snake.pos.x = from.x + (to.x - from.x) * t;
                    snake.pos.y = from.y + (to.y - from.y) * t;

                    if (!attacked && playerIsVeryClose()) {
                        playAnimForDirection("snake-attack", from, to, true);
                        attacked = true;
                    } 
                },
                k.easings.linear
            );
            await currentTween;
            if (snake.isFrozen) return;

            if (attacked) {
                playAnimForDirection("snake", snake.pos, player.pos, false);
                setSnakeAreaForDirection("snake", snake.pos, player.pos, false);
            }

            if (snake.getCollisions().length > 0) {
                snake.enterState("evade");
                return;
            }
            await k.wait(0.1);
            if (snake.isFrozen) return;
        }
        snake.enterState("patrol");
    });

    // Evade state: move back to previous position
    const evade = snake.onStateEnter("evade", async () => {
        if (snake.isFrozen) {
            snake.enterState("idle");
            return;
        }
        const from = snake.pos.clone();
        const to = snake.prevPos.clone();
        playAnimForDirection("snake", from, to, false);
        currentTween = k.tween(
            snake.pos,
            snake.prevPos,
            2 + Math.random() * 2,
            (val) => {
                if (snake.isFrozen) {
                    if (currentTween) currentTween.cancel();
                    return;
                }
                snake.pos = val;
            },
            k.easings.linear,
        );
        await currentTween;
        if (snake.isFrozen) return;
        snake.enterState("patrol");
    });

    // Save previous position every 5 frames
    k.loop(5, () => {
        snake.prevPos = snake.pos.clone();
    });

    // Start in patrol state
    snake.enterState("patrol");

    k.onSceneLeave(() => {
        patrol.cancel();
        attack.cancel();
        evade.cancel();
    });
};
