import { playAnimIfNotPlaying } from "../utils.js";
import { dialog } from "../uiComponents/dialog.js";
import wizardLines from "../content/wizardDialogue.js";
import { gameState, wizardState, playerState } from "../state/stateManagers.js";

export function generateWitchComponents(k, pos) {
    return [
        k.sprite('Everything', {
            anim: 'witch-idle-side',
        }),
        k.area({ shape: new k.Rect(k.vec2(2, 6), 12, 15) }),
        k.body({ isStatic: true }),
        k.pos(pos),
        k.offscreen(),
        'witch',
    ];
}

export async function startInteraction(k, witch, player, options = {}) {
    if (options.overrideDialogue && Array.isArray(options.overrideDialogue)) {
        // Always face left for special dialogue
        witch.flipX = true;
        playAnimIfNotPlaying(witch, "witch-idle-side");
        // After dialogue, face down after 0.5s
        await dialog(k, k.vec2(250, 500), options.overrideDialogue);
        setTimeout(() => {
            playAnimIfNotPlaying(witch, "witch-idle-down");
        }, 7000);
        return;
    } else {
        if (player.direction === "left") {
            witch.flipX = false;
            playAnimIfNotPlaying(witch, "witch-idle-side");
        }
        if (player.direction === "right") {
            witch.flipX = true;
            playAnimIfNotPlaying(witch, "witch-idle-side");
        }
        if (player.direction === "up") {
            playAnimIfNotPlaying(witch, "witch-idle-up");
        }
        if (player.direction === "down") {
            playAnimIfNotPlaying(witch, "witch-idle-down");
        }
    }


    const responses = witchLines[gameState.getLanguage()];

    // Get the number of times the player has talked to the witch
    let nbOfTimesTalkedWitch = witchState.getNbOfTimesTalkedWitch();
    if (nbOfTimesTalkedWitch > responses.length - 1) {
        witchState.setNbOfTimesTalkedWitch(1);
        nbOfTimesTalkedWitch = witchState.getNbOfTimesTalkedWitch();
    }

    // Check if there is a response for the current number of times talked
    if (responses[nbOfTimesTalkedWitch]) {
        await dialog(k, k.vec2(250, 500), responses[nbOfTimesTalkedWitch]);
        witchState.setNbOfTimesTalkedWitch(nbOfTimesTalkedWitch + 1);
    }
}
