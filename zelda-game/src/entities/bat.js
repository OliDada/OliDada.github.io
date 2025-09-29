import { gameState, playerState } from "../state/stateManagers.js";

export function generateBatComponents(k, pos) {
    return [
        k.sprite('Everything', { anim: "bat-down" }),
        k.area({ shape: new k.Rect(k.vec2(2, 4), 12, 12) }),
        k.pos(pos),
        k.health(2),
        k.opacity(),
        k.offscreen(),
        k.state("idle", ["idle", "attack", "evade", "patrol"]),
        {
            isAttacking: false,
            attackPower: 0.5,
            prevPos: k.vec2(0, 0),
            isFrozen: false,
        },
        'bat',
    ];
}

export function setBatAI(k, bat, player) {
    // Patrol area (change as needed)
    const patrolDistance = 60 + Math.random() * 40;
    const patrolOrigin = bat.pos.clone();
    let patrolDir = 1;

    // Helper: is player close?
    function playerIsClose() {
        return player && player.pos && bat.pos.dist(player.pos) < 16 * 6;
    }

    // Patrol state: move back and forth
    const patrol = bat.onStateEnter("patrol", async () => {
        while (!playerIsClose()) {
            if (bat.isFrozen) return;
            const targetX = patrolOrigin.x + patrolDir * patrolDistance;
            await k.tween(
                bat.pos.x,
                targetX,
                3 + Math.random() * 2,
                (val) => {
                    if (bat.isFrozen) return; // Interrupt tween if frozen
                    bat.pos.x = val;
                },
                k.easings.linear,
            );
            patrolDir *= -1;
        }
        bat.enterState("attack");
    });

    // Attack state: chase player
    const attack = bat.onStateEnter("attack", async () => {
        if (!playerIsClose()) {
            bat.enterState("patrol");
            return;
        }
        if (bat.isFrozen) return;
        const attackSpeeds = [1.0, 1.5, 2.0];
        await k.tween(
            bat.pos,
            player.pos,
            attackSpeeds[Math.floor(Math.random() * attackSpeeds.length)],
            (val) => (bat.pos = val),
            k.easings.linear,
        );
        if (bat.getCollisions().length > 0) {
            bat.enterState("evade");
            return;
        }
        bat.enterState("attack");
    });

    // Evade state: move back to previous position
    const evade = bat.onStateEnter("evade", async () => {
        if (bat.isFrozen) return;
        await k.tween(
            bat.pos,
            bat.prevPos,
            2 + Math.random() * 2,
            (val) => (bat.pos = val),
            k.easings.linear,
        );
        bat.enterState("patrol");
    });

    // Save previous position every 5 frames
    k.loop(5, () => {
        bat.prevPos = bat.pos.clone();
    });

    // Start in patrol state
    bat.enterState("patrol");

    k.onSceneLeave(() => {
        patrol.cancel();
        attack.cancel();
        evade.cancel();
    });
};
