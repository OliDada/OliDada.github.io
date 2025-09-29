import { playAnimIfNotPlaying, followPlayer } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import prisonerLines, { prisonerFreedLines } from "../content/prisonerDialogue.js";
import { gameState, prisonerState, playerState } from "../state/stateManagers.js";

export function generatePrisonerComponents(k, pos) {
    return [
        k.sprite('sprites', {
            anim: 'prisoner-idle-down',
        }),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 50) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'prisoner',
        {   
            name: 'prisoner',
            hp() { return 1; },
            hurt() {},
        },
    ];
}

export async function startInteraction(k, prisoner, player) {
    if (player.direction === "left") {
        prisoner.flipX = true;
        playAnimIfNotPlaying(prisoner, "prisoner-idle-side");
    }
    if (player.direction === "right") {
        prisoner.flipX = false;
        playAnimIfNotPlaying(prisoner, "prisoner-idle-side");
    }
    if (player.direction === "up") {
        playAnimIfNotPlaying(prisoner, "prisoner-idle-down");
    }
    if (player.direction === "down") {
        playAnimIfNotPlaying(prisoner, "prisoner-idle-up");
    }

    if (gameState.getPrisonDoorOpened()) {
        const freedResponses = prisonerFreedLines[gameState.getLanguage()][0];
        await dialog(k, k.vec2(250, 500), freedResponses);
        prisoner.unuse('body');
        followPlayer(k, player, prisoner);
        // Sync prisoner idle animation with player idle (check velocity)
        k.onUpdate(() => {
            if (prisoner.isFollowing && prisoner.vel) {
                const prisonerIdle = prisoner.vel.x === 0 && prisoner.vel.y === 0;
                if (prisonerIdle) {
                    // Prisoner is idle
                    switch (player.direction) {
                        case "left":
                            prisoner.flipX = true;
                            prisoner.play && prisoner.play("prisoner-idle-side");
                            break;
                        case "right":
                            prisoner.flipX = false;
                            prisoner.play && prisoner.play("prisoner-idle-side");
                            break;
                        case "up":
                            prisoner.play && prisoner.play("prisoner-idle-down");
                            break;
                        case "down":
                            prisoner.play && prisoner.play("prisoner-idle-up");
                            break;
                    }
                } else {
                    // Prisoner is moving, play walk animation
                    switch (player.direction) {
                        case "left":
                            prisoner.flipX = true;
                            prisoner.play && prisoner.play("prisoner-walk-side");
                            break;
                        case "right":
                            prisoner.flipX = false;
                            prisoner.play && prisoner.play("prisoner-walk-side");
                            break;
                        case "up":
                            prisoner.play && prisoner.play("prisoner-walk-up");
                            break;
                        case "down":
                            prisoner.play && prisoner.play("prisoner-walk-down");
                            break;
                    }
                }
            }
        });
        return;
    }

    const responses = prisonerLines[gameState.getLanguage()];
    let nbTimesTalkedPrisoner = prisonerState.getNbTimesTalkedPrisoner();
    if (nbTimesTalkedPrisoner > responses.length - 1) {
        prisonerState.setNbTimesTalkedPrisoner(1);
        nbTimesTalkedPrisoner = prisonerState.getNbTimesTalkedPrisoner();
    }
    if (responses[nbTimesTalkedPrisoner]) {
        await dialog(k, k.vec2(250, 500), responses[nbTimesTalkedPrisoner]);
        prisonerState.setNbTimesTalkedPrisoner(nbTimesTalkedPrisoner + 1);
    }
}
