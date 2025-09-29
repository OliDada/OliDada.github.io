import { gameState, playerState } from "../state/stateManagers.js";


export function generateGhostComponents(k, pos) {
    return [
        k.sprite('sprites', { anim: "ghost-down" }),
        k.area({ shape: new k.Rect(k.vec2(2, 4), 12, 12) }),
        k.body(),
        k.pos(pos),
        k.health(6),
        k.opacity(),
        k.offscreen(),
        k.state("idle", ["idle", "right", "backtrack", "attack", "evade"]),
        {
            isAttacking: false,
            attackPower: 0.5,
            prevPos: k.vec2(0, 0),
        },
        'ghost',
    ];
}

export function setGhostAI(k, ghost, player) {
    const updateRef = k.onUpdate(() => {
        if (player.pos.dist(ghost.pos) < 30) {
            ghost.enterState("backtrack");
            updateRef.cancel();
        }
    });
    
    k.loop(5, () => {
        ghost.prevPos = ghost.pos;
    });

    const backtrack = ghost.onStateEnter("backtrack", async () => {
        await k.tween(
            ghost.pos.y,
            ghost.pos.y - 40,
            0.2,
            (val) => (ghost.pos.y = val),
            k.easings.linear,
        );

        ghost.enterState("right");
    });

    const right = ghost.onStateEnter("right", async () => {
        await k.tween(
            ghost.pos.x,
            ghost.pos.x + 50,
            1,
            (val) => (ghost.pos.x = val),
            k.easings.linear,
        );

        ghost.enterState("attack");
    });

    const attack = ghost.onStateEnter("attack", async () => {
        const attackSpeeds = [0.5, 0.8, 1];

        await k.tween(
            ghost.pos,
            player.pos,
            attackSpeeds[Math.floor(Math.random() * attackSpeeds.length)],
            (val) => (ghost.pos = val),
            k.easings.linear,
        );

        if (ghost.getCollisions().length > 0) {
            ghost.enterState("evade");
            return;
        }

        ghost.enterState("attack");
    });

    const evade = ghost.onStateEnter("evade", async () => {
        await k.tween(
            ghost.pos,
            ghost.prevPos,
            0.8,
            (val) => (ghost.pos = val),
            k.easings.linear,
        );

        ghost.enterState("attack");
    });

    k.onSceneLeave(() => {
        backtrack.cancel();
        right.cancel();
        attack.cancel();
        evade.cancel();
        updateRef.cancel();
    });
};

export function onGhostDestroyed(k) {
    gameState.setHasDefeatedGhost(true);
};
