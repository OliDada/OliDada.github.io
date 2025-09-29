import { playAnimIfNotPlaying } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import wolfLines from "../content/oldmanDialogue.js";
import { gameState, playerState } from "../state/stateManagers.js";
import { onCollideWithPlayer } from "../utils.js";

export function generateWolfComponents(k, pos) {
    return [
        k.sprite('Everything', { anim: 'wolf-idle-down' }),
        k.area({ shape: new k.Rect(k.vec2(3, 4), 10, 12) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.health(10),
        k.opacity(),
        k.offscreen(),
        k.state("idle", ["idle", "circle", "charge", "attack", "evade"]),
        { attackPower: 0.5 },
        'wolf',
    ];
}

export async function startInteraction(k, wolf, player) {
    if (player.direction === "left") {
        wolf.flipX = true;
        playAnimIfNotPlaying(wolf, "wolf-idle-side");
    }
    if (player.direction === "right") {
        wolf.flipX = false;
        playAnimIfNotPlaying(wolf, "wolf-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(wolf, "wolf-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(wolf, "wolf-idle-up");
    }

    const responses = wolfLines[gameState.getLanguage()];

    // Get the number of times the player has talked to the wolf
    let nbTimesTalkedWolf = wolfState.getNbTimesTalkedWolf();
    if (nbTimesTalkedWolf > responses.length - 1) {
        wolfState.setNbTimesTalkedWolf(1);
        nbTimesTalkedWolf = wolfState.getNbTimesTalkedWolf();
    }

    // Check if there is a response for the current number of times talked
    if (responses[nbTimesTalkedWolf]) {
        let dialogOptions = {};
        await dialog(
            k,
            k.vec2(250, 500),
            responses[nbTimesTalkedWolf],
            dialogOptions
        );
        wolfState.setNbTimesTalkedWolf(nbTimesTalkedWolf + 1);
    }
}

export function startWolfBossFight(k, wolf, player) {
    wolf.isBoss = true;
    wolf.isStatic = false;

    // Save previous position for evade
    k.loop(5, () => {
        wolf.prevPos = wolf.pos.clone();
    });

    // CIRCLE state
    const circle = wolf.onStateEnter("circle", async () => {
        if (!wolf.isBoss || wolf.paused) return;
        if (wolf.circleAngle === undefined) wolf.circleAngle = 0;
        const duration = 1.5 + Math.random();
        const startTime = k.time();
        while (k.time() - startTime < duration) {
            if (!wolf.isBoss || wolf.paused) return;
            wolf.circleAngle += k.dt() * 1.5;
            const radius = 48;
            const speed = 60;
            const target = player.pos.add(
                k.vec2(Math.cos(wolf.circleAngle), Math.sin(wolf.circleAngle)).scale(radius)
            );
            const dir = target.sub(wolf.pos).unit();
            wolf.move(dir.scale(speed));
            playAnimIfNotPlaying(wolf, "wolf-side");
            wolf.flipX = dir.x < 0;
            await k.wait(0.01);
        }
        if (!wolf.isBoss || wolf.paused) return;
        wolf.enterState("charge");
    });

    // CHARGE state
    const charge = wolf.onStateEnter("charge", async () => {
        if (!wolf.isBoss || wolf.paused) return;
        // Capture the player's position at the start of the charge
        const chargeTarget = k.vec2(player.pos.x, player.pos.y);
        const speed = 180;
        const duration = 0.5 + Math.random();
        const startTime = k.time();

        // Determine direction and animation ONCE
        const dir = chargeTarget.sub(wolf.pos).unit();
        let anim;
        if (Math.abs(dir.x) > Math.abs(dir.y)) {
            anim = "wolf-side";
            wolf.flipX = dir.x < 0;
        } else if (dir.y > 0) {
            anim = "wolf-down";
            wolf.flipX = false;
        } else {
            anim = "wolf-up";
            wolf.flipX = false;
        }
        playAnimIfNotPlaying(wolf, anim);

        while (k.time() - startTime < duration) {
            if (!wolf.isBoss || wolf.paused) return;
            wolf.move(dir.scale(speed));
            await k.wait(0.01);
        }
        if (!wolf.isBoss || wolf.paused) return;
        wolf.enterState("attack");
    });

    // ATTACK state
    const attack = wolf.onStateEnter("attack", async () => {
        if (!wolf.isBoss || wolf.paused) return;
        // Capture the player's position at the start of the attack (guaranteed fixed)
        const attackTarget = k.vec2(player.pos.x, player.pos.y);

        // Calculate the charge direction for use in evade
        const chargeDir = attackTarget.sub(wolf.pos).unit();

        // Determine animation and flip ONCE
        let anim;
        if (Math.abs(chargeDir.x) > Math.abs(chargeDir.y)) {
            anim = "wolf-side";
            wolf.flipX = chargeDir.x < 0;
        } else if (chargeDir.y > 0) {
            anim = "wolf-down";
            wolf.flipX = false;
        } else {
            anim = "wolf-up";
            wolf.flipX = false;
        }
        playAnimIfNotPlaying(wolf, anim);

        // Tween toward the captured position
        await k.tween(
            wolf.pos,
            attackTarget,
            0.7,
            (val) => (wolf.pos = val),
            k.easings.linear
        );

        wolf.lastChargeDir = chargeDir;

        if (wolf.getCollisions().some(c => c.target && c.target.is && c.target.is("player"))) {
            wolf.enterState("evade");
            return;
        }
        wolf.enterState("evade");
    });

    // EVADE state
    const evade = wolf.onStateEnter("evade", async () => {
        if (!wolf.isBoss || wolf.paused) return;
        const speed = 100;
        const duration = 0.7;
        const startTime = k.time();
        // Use the opposite of the last charge direction, or default to away from player
        const retreatDir = wolf.lastChargeDir ? wolf.lastChargeDir.scale(-1) : wolf.pos.sub(player.pos).unit();
        while (k.time() - startTime < duration) {
            if (!wolf.isBoss || wolf.paused) return;
            wolf.move(retreatDir.scale(speed));
            playAnimIfNotPlaying(wolf, "wolf-side");
            wolf.flipX = retreatDir.x < 0;
            await k.wait(0.01);
        }
        wolf.enterState("circle");
    });

    // Hurt player on collision (use your utility)
    onCollideWithPlayer(k, wolf);

    // Clean up on scene leave
    k.onSceneLeave(() => {
        circle.cancel();
        charge.cancel();
        attack.cancel();
        evade.cancel();
    });

    // Start the boss fight
    wolf.enterState("evade");

    // When attack starts
    player.isAttacking = true;
    // After attack animation or timeout
    setTimeout(() => { player.isAttacking = false; }, 200); // adjust timing as needed
}